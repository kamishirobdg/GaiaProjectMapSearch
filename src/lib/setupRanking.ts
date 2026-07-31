// src/lib/setupRanking.ts
//
// /setup の一括探索ランキング（2026-07-31）。Map の candidates と同じ考え方で、
// 「条件 × 基準」ごとに上位 SETUP_RANKING_CAP 件だけを貯める。次の探索は
// 前回の上位と今回の結果をマージして、また上位だけを残す。
//
// 保存するのは入力（BuildSetupInput）だけ。buildSetupFromSeed は決定論なので
// 表示時に再構築すれば完全に再現できる（setupHistory と同じ方針）。
//
// **スコアは保存値を信用せず、読むたびに再計算する。** 基準値は評価指数
// （SetupWeights）に依存するのに、条件バケツのキーは「セットアップの設定だけ」で
// 指数を含まない（指数をいじっても貯めた結果が消えないようにするため）。
// 保存したスコアをそのまま並べると、指数を変えた後に古い順序が残ってしまう。
// 生成は 0.25ms/件 と軽いので、20件の再計算は数ミリ秒で済む。
// row.score は最後に書いた時点の値で、デバッグ・参考用。

import type { BuildSetupInput } from "@/gaia/setup/buildSetup";
import { buildSetupFromSeed } from "@/gaia/setup/buildSetup";
import {
  criterionScore,
  scoreSetupFactions,
  type RecommendCriterion,
  type SetupColorPref,
} from "@/gaia/eval/factionEval";
import type { SetupWeights } from "@/gaia/eval/setupWeights";
import {
  openDb,
  STORE_SETUP_RANKING,
  idbDeleteByIds,
  idbGetAllFromStore,
  idbPutAll,
} from "@/app/board/persistence";

/** 条件×基準ごとに残す件数。 */
export const SETUP_RANKING_CAP = 20;

export type RankedSetup = {
  /** `${conditionKey}:${criterion}:${seed}` */
  id: string;
  conditionKey: string;
  criterion: RecommendCriterion;
  seed: string;
  input: BuildSetupInput;
  /** 最後に書いた時点の基準値（表示は必ず再計算する。上のコメント参照）。 */
  score: number;
  createdAt: number;
};

/** 表示用の1行。score は現在の評価指数で計算し直した値。 */
export type ScoredSetup = RankedSetup & { score: number };

function rankingId(conditionKey: string, criterion: string, seed: string): string {
  return `${conditionKey}:${criterion}:${seed}`;
}

/** その入力の基準値をいまの評価指数で計算する。 */
export function scoreOf(
  input: BuildSetupInput,
  criterion: RecommendCriterion,
  playerCount: number,
  lostFleet: boolean,
  weights?: SetupWeights,
  colorPref?: SetupColorPref
): number {
  const result = buildSetupFromSeed(input);
  const setupScores = scoreSetupFactions(result, weights);
  return criterionScore(criterion, setupScores, { playerCount, lostFleet, colorPref });
}

function sortDesc(rows: ScoredSetup[]): ScoredSetup[] {
  // 同点は seed で安定させる（同じ入力なら毎回同じ並び）。
  return rows
    .slice()
    .sort((a, b) => b.score - a.score || (a.seed < b.seed ? -1 : a.seed > b.seed ? 1 : 0));
}

/**
 * マージの純粋部分（persistence.ts の mergeCandidates と同じ切り分け方。
 * IndexedDB を伴う関数はブラウザ専用でテストできないため、判断はここに寄せる）。
 * 同じシードは1件に畳み、保存済みの createdAt を保つ。上位 cap 件を keep、
 * あふれた分の id を drop として返す。
 */
export function mergeRankingRows(args: {
  conditionKey: string;
  criterion: RecommendCriterion;
  existing: ScoredSetup[];
  fresh: Array<{ seed: string; input: BuildSetupInput; score: number }>;
  cap: number;
  now: number;
}): { keep: ScoredSetup[]; drop: string[] } {
  const { conditionKey, criterion, existing, fresh, cap, now } = args;
  const bySeed = new Map<string, ScoredSetup>();
  for (const r of existing) bySeed.set(r.seed, r);
  for (const f of fresh) {
    const prev = bySeed.get(f.seed);
    bySeed.set(f.seed, {
      id: rankingId(conditionKey, criterion, f.seed),
      conditionKey,
      criterion,
      seed: f.seed,
      input: f.input,
      score: f.score,
      // 既存の生成時刻は保つ（いつ見つけた候補かが分かるように）。
      createdAt: prev?.createdAt ?? now,
    });
  }
  const ranked = sortDesc([...bySeed.values()]);
  const keep = ranked.slice(0, cap);
  const keepIds = new Set(keep.map((r) => r.id));
  const drop = ranked
    .slice(cap)
    .map((r) => r.id)
    .filter((id) => !keepIds.has(id));
  return { keep, drop };
}

/**
 * その条件×基準の保存済みランキングを、いまの評価指数で再採点して返す。
 * DB が使えないときは空配列（呼び出し側は「まだ探索していない」と同じ扱い）。
 */
export async function listRanking(args: {
  conditionKey: string;
  criterion: RecommendCriterion;
  playerCount: number;
  lostFleet: boolean;
  weights?: SetupWeights;
  colorPref?: SetupColorPref;
}): Promise<ScoredSetup[]> {
  const { conditionKey, criterion, playerCount, lostFleet, weights, colorPref } = args;
  try {
    const db = await openDb();
    const rows = await idbGetAllFromStore<RankedSetup>(db, STORE_SETUP_RANKING);
    const mine = rows.filter((r) => r.conditionKey === conditionKey && r.criterion === criterion);
    return sortDesc(
      mine.map((r) => ({
        ...r,
        score: scoreOf(r.input, criterion, playerCount, lostFleet, weights, colorPref),
      }))
    );
  } catch {
    return [];
  }
}

/**
 * 今回の探索結果を保存済みランキングへマージして、上位 cap 件だけを残す。
 * 同じシードは1件に畳む（保存済みの createdAt を保つ）。落ちた分は DB から消す。
 * 戻り値は残った上位（再採点済み・降順）。
 */
export async function mergeRanking(args: {
  conditionKey: string;
  criterion: RecommendCriterion;
  playerCount: number;
  lostFleet: boolean;
  weights?: SetupWeights;
  colorPref?: SetupColorPref;
  fresh: Array<{ seed: string; input: BuildSetupInput; score: number }>;
  cap?: number;
}): Promise<ScoredSetup[]> {
  const { conditionKey, criterion, playerCount, lostFleet, weights, colorPref, fresh } = args;
  const cap = args.cap ?? SETUP_RANKING_CAP;

  const db = await openDb();
  const all = await idbGetAllFromStore<RankedSetup>(db, STORE_SETUP_RANKING);
  const existing = all
    .filter((r) => r.conditionKey === conditionKey && r.criterion === criterion)
    // 保存済みのスコアは信用せず、いまの評価指数で採点し直してから比べる。
    .map((r) => ({
      ...r,
      score: scoreOf(r.input, criterion, playerCount, lostFleet, weights, colorPref),
    }));

  const { keep, drop } = mergeRankingRows({
    conditionKey,
    criterion,
    existing,
    fresh,
    cap,
    now: Date.now(),
  });

  await idbPutAll(
    db,
    STORE_SETUP_RANKING,
    keep.map((r) => ({ ...r } as RankedSetup))
  );
  if (drop.length > 0) await idbDeleteByIds(db, STORE_SETUP_RANKING, drop);

  return keep;
}

/** その条件×基準のランキングを消す（画面の「消去」）。 */
export async function clearRanking(conditionKey: string, criterion: RecommendCriterion): Promise<void> {
  try {
    const db = await openDb();
    const rows = await idbGetAllFromStore<RankedSetup>(db, STORE_SETUP_RANKING);
    const ids = rows
      .filter((r) => r.conditionKey === conditionKey && r.criterion === criterion)
      .map((r) => r.id);
    if (ids.length > 0) await idbDeleteByIds(db, STORE_SETUP_RANKING, ids);
  } catch {
    // ignore
  }
}

/** その条件のランキングを基準ごと全部消す（条件プロファイルの「結果ごと削除」）。 */
export async function deleteRankingByCondition(conditionKey: string): Promise<void> {
  try {
    const db = await openDb();
    const rows = await idbGetAllFromStore<RankedSetup>(db, STORE_SETUP_RANKING);
    const ids = rows.filter((r) => r.conditionKey === conditionKey).map((r) => r.id);
    if (ids.length > 0) await idbDeleteByIds(db, STORE_SETUP_RANKING, ids);
  } catch {
    // ignore
  }
}
