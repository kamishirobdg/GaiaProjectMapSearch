// src/gaia/eval/factionEval.ts
//
// セットアップの種族別評価と推奨基準（一覧タブ「セット提案」用、2026-07-24）。
// 重みは factionWeights.ts の DRAFT 行列（レビューで数値だけ差し替え可能）。
//
// スコアの意味: scoreSetupFactions は「そのセットアップで各種族がどれだけ
// 有利か」の相対値（タイル重みの単純合計、ラウンド得点は枚数分加算）。
// 標準技術9種は「どのトラックの下に付くか」で価値が変わるため、
// TRACK_AFFINITY × TECH_PREF の積で別途加算する（2026-07-25、scoreStandardTech）。

import type { SetupResult } from "@/gaia/setup/types";
import { buildSetupFromSeed, type BuildSetupInput } from "@/gaia/setup/buildSetup";
import {
  FACTION_IDS,
  factionIdsForMode,
  TECH_PREF,
  TECH_TRACK_WEIGHTS,
  TILE_FACTION_WEIGHTS,
  type FactionId,
} from "./factionWeights";
import {
  DEFAULT_SETUP_WEIGHTS,
  SETUP_WEIGHT_KEYS,
  type SetupWeightKey,
  type SetupWeights,
} from "./setupWeights";
import { RESEARCH_TRACK_IDS, type ResearchTrackId } from "@/gaia/setup/types";

export type FactionScores = Record<FactionId, number>;

/** カテゴリ別の内訳（係数適用後）と合計。左ペインの評価表がこれを描く。 */
export type SetupFactionBreakdown = {
  byCategory: Record<SetupWeightKey, FactionScores>;
  total: FactionScores;
};

function zeroScores(): FactionScores {
  const out = {} as FactionScores;
  for (const f of FACTION_IDS) out[f] = 0;
  return out;
}

/**
 * 標準技術の寄与（2026-07-25 案1）。トラック下の6枚は編集用テーブル
 * TECH_TRACK_WEIGHTS[タイル][研究列] を引く。自由列3枚はタイル有用度のみ
 * （低係数）。係数は評価指数（stdTrack / stdFree）で、既定は従来の定数と同値。
 */
export function scoreStandardTech(result: SetupResult, weights?: SetupWeights): FactionScores {
  const b = setupFactionBreakdown(result, weights);
  const out = zeroScores();
  for (const f of FACTION_IDS) out[f] = b.byCategory.stdTrack[f] + b.byCategory.stdFree[f];
  return out;
}

/** タイル1枚ぶんの寄与（マーカー表示用。2026-07-30）。 */
export type SetupTileHit = {
  /** タイルID（同じIDが複数枚出る場合は複数エントリになる） */
  tileId: string;
  category: SetupWeightKey;
  /** どのスロットか（表示用。トラック名など） */
  slot?: string;
  /** 評価指数を掛けた後の種族別寄与（非ゼロのみ） */
  byFaction: Partial<Record<FactionId, number>>;
};

/**
 * セットアップの各タイルが、どの種族の評価値をいくつ動かしているかを返す。
 * 内訳表のクリックから「効いているタイル」を光らせるために使う。
 * 合計は setupFactionBreakdown と一致する（同じ経路で計算している）。
 */
export function setupFactionTileHits(
  result: SetupResult,
  weights?: SetupWeights
): SetupTileHit[] {
  const w = weights ?? DEFAULT_SETUP_WEIGHTS;
  const out: SetupTileHit[] = [];
  const push = (category: SetupWeightKey, tileId: string | undefined, table: any, slot?: string) => {
    if (!tileId) return;
    const src = table[tileId];
    if (!src) return;
    const scale = w[category];
    const byFaction: Partial<Record<FactionId, number>> = {};
    let any = false;
    for (const [f, v] of Object.entries(src as Record<string, number | undefined>)) {
      const val = (v ?? 0) * scale;
      if (val === 0) continue;
      byFaction[f as FactionId] = val;
      any = true;
    }
    if (any) out.push({ tileId, category, slot, byFaction });
  };

  for (const [track, id] of Object.entries(result.advancedTech.byTrack)) {
    push("advanced", id, TILE_FACTION_WEIGHTS, track);
  }
  push("advExtension", result.advancedTech.extension, TILE_FACTION_WEIGHTS);
  for (const id of result.boosters.available) push("booster", id, TILE_FACTION_WEIGHTS);
  for (const id of result.roundScoring) push("roundScoring", id, TILE_FACTION_WEIGHTS);
  for (const id of result.finalScoring) push("finalScoring", id, TILE_FACTION_WEIGHTS);
  push("federation", result.federationLv5, TILE_FACTION_WEIGHTS);
  if (result.mode === "lostFleet") {
    for (const id of Object.values(result.shipTech ?? {})) push("lfShip", id, TILE_FACTION_WEIGHTS);
    for (const id of Object.values(result.goldFederations ?? {})) push("lfShip", id, TILE_FACTION_WEIGHTS);
    for (const id of result.artifacts ?? []) push("lfShip", id, TILE_FACTION_WEIGHTS);
  }
  // 標準技術: トラック下はトラック別テーブル、フリー枠はタイル有用度
  for (const track of RESEARCH_TRACK_IDS as readonly ResearchTrackId[]) {
    const id = result.standardTech.byTrack[track];
    const cell = TECH_TRACK_WEIGHTS[id]?.[track];
    if (!cell) continue;
    const scale = w.stdTrack;
    const byFaction: Partial<Record<FactionId, number>> = {};
    let any = false;
    for (const [f, v] of Object.entries(cell)) {
      const val = (v ?? 0) * scale;
      if (val === 0) continue;
      byFaction[f as FactionId] = val;
      any = true;
    }
    if (any) out.push({ tileId: id, category: "stdTrack", slot: track, byFaction });
  }
  for (const id of result.standardTech.free) push("stdFree", id, TECH_PREF);
  return out;
}

/**
 * セットアップに出ているタイル群から、カテゴリ別の種族スコアを作る。
 * 各カテゴリは評価指数（SetupWeights）を掛けた後の値。
 */
export function setupFactionBreakdown(
  result: SetupResult,
  weights?: SetupWeights
): SetupFactionBreakdown {
  const w = weights ?? DEFAULT_SETUP_WEIGHTS;
  const byCategory = {} as Record<SetupWeightKey, FactionScores>;
  for (const k of SETUP_WEIGHT_KEYS) byCategory[k] = zeroScores();

  const add = (cat: SetupWeightKey, tileId: string | undefined) => {
    if (!tileId) return;
    const tw = TILE_FACTION_WEIGHTS[tileId];
    if (!tw) return;
    for (const [f, v] of Object.entries(tw)) byCategory[cat][f as FactionId] += v ?? 0;
  };

  for (const id of Object.values(result.advancedTech.byTrack)) add("advanced", id);
  // 得点ボード拡張部の追加上級は取得条件が通常の上級と違うので別カテゴリ。
  add("advExtension", result.advancedTech.extension);
  for (const id of result.boosters.available) add("booster", id);
  for (const id of result.roundScoring) add("roundScoring", id); // ×2タイルは2回出るので枚数分加算
  for (const id of result.finalScoring) add("finalScoring", id);
  add("federation", result.federationLv5); // 現行DRAFTでは全0
  if (result.mode === "lostFleet") {
    for (const id of Object.values(result.shipTech ?? {})) add("lfShip", id);
    for (const id of Object.values(result.goldFederations ?? {})) add("lfShip", id);
    for (const id of result.artifacts ?? []) add("lfShip", id);
  }

  // 標準技術はトラック配置で価値が変わるので別式（2026-07-25）。
  for (const track of RESEARCH_TRACK_IDS as readonly ResearchTrackId[]) {
    const cell = TECH_TRACK_WEIGHTS[result.standardTech.byTrack[track]]?.[track];
    if (!cell) continue;
    for (const [f, v] of Object.entries(cell)) byCategory.stdTrack[f as FactionId] += v ?? 0;
  }
  for (const id of result.standardTech.free) {
    const pref = TECH_PREF[id];
    if (!pref) continue;
    for (const [f, v] of Object.entries(pref)) byCategory.stdFree[f as FactionId] += v ?? 0;
  }

  // 係数を掛けてから合算する（表示の内訳と合計が必ず一致するようにする）。
  const total = zeroScores();
  for (const k of SETUP_WEIGHT_KEYS) {
    const scale = w[k];
    for (const f of FACTION_IDS) {
      byCategory[k][f] *= scale;
      total[f] += byCategory[k][f];
    }
  }
  return { byCategory, total };
}

/** セットアップに出ているタイル群から種族別スコアを合算する。 */
export function scoreSetupFactions(result: SetupResult, weights?: SetupWeights): FactionScores {
  return setupFactionBreakdown(result, weights).total;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}
function std(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) * (x - m))));
}
function sortedDesc(scores: FactionScores, ids: readonly FactionId[]): number[] {
  return ids.map((f) => scores[f]).sort((a, b) => b - a);
}

/**
 * マップ側スコア上位N種族（同点はFACTION_IDS順で安定）。
 * 基本版では LF の4種族を候補から外す（基本版では選べないため、2026-07-31）。
 */
export function topFactions(
  scores: FactionScores,
  n: number,
  lostFleet: boolean = true
): FactionId[] {
  return [...factionIdsForMode(lostFleet)].sort((a, b) => scores[b] - scores[a]).slice(0, n);
}

export type RecommendCriterion = "opposeMap" | "alignMap" | "topBalance" | "neutralBalance";

/**
 * 基準ごとの「このセットアップの良さ」（大きいほど良い）。DRAFT の式:
 * - opposeMap: マップ上位3種族のセットアップスコア合計が小さいほど良い
 *   （タイブレークに全体バランス）。
 * - alignMap（優位）: マップ上位 K=プレイ人数+2 種族がセットアップでも強いほど良い
 *   （順張り。opposeMap の逆で、マップで強い種族をさらに後押しする）。
 *   K種族の平均を主項、K内の散らばりを軽い減点にして1種族だけ突出するのを避ける。
 * - topBalance: 上位 K=プレイ人数+2 種族が拮抗して強いほど良い
 *   （上位Kの散らばりを罰し、上位Kと残りの差を少し好む）。
 * - neutralBalance: 全種族の散らばりが小さいほど良い（マップ非依存）。
 *
 * 散らばり系（topBalance / neutralBalance）が見る母集団は、その拡張で選べる種族だけ。
 * 基本版で LF の4種族を混ぜると、遊べない種族の低スコアが散らばりを押し上げてしまう
 * （2026-07-31）。`lostFleet` 省略時は従来どおり全18種族。
 */
export function criterionScore(
  criterion: RecommendCriterion,
  setupScores: FactionScores,
  opts: { playerCount: number; mapTop3?: FactionId[]; mapTopK?: FactionId[]; lostFleet?: boolean }
): number {
  const all = sortedDesc(setupScores, factionIdsForMode(opts.lostFleet !== false));
  switch (criterion) {
    case "opposeMap": {
      const top3 = opts.mapTop3 ?? [];
      const sum = top3.reduce((a, f) => a + setupScores[f], 0);
      return -sum - 0.2 * std(all);
    }
    case "alignMap": {
      // マップ上位 K=人数+2 種族。呼び出し側が K を渡さなければ上位3で代用する。
      const topK = opts.mapTopK ?? opts.mapTop3 ?? [];
      if (topK.length === 0) return 0;
      const vals = topK.map((f) => setupScores[f]);
      return mean(vals) - 0.2 * std(vals);
    }
    case "topBalance": {
      const k = Math.min(all.length, Math.max(2, opts.playerCount + 2));
      const topK = all.slice(0, k);
      const rest = all.slice(k);
      return -std(topK) + 0.3 * (mean(topK) - mean(rest));
    }
    case "neutralBalance":
      return -std(all);
  }
}

export type Recommendation = {
  input: BuildSetupInput;
  result: SetupResult;
  setupScores: FactionScores;
  criterion: RecommendCriterion;
  score: number;
  trials: number;
};

/**
 * シードを trials 件生成して基準スコア最良の1件を返す（要望: 出力は1件のみ）。
 * seeds は呼び出し側が生成する（決定論: 同じ seeds → 同じ結果）。
 * 条件（人数・拡張）以外のルール設定は付けない素のセットアップを対象とする。
 */
export function recommendSetup(args: {
  criterion: RecommendCriterion;
  seeds: string[];
  playerCount: number;
  lostFleet: boolean;
  mapTop3?: FactionId[];
  mapTopK?: FactionId[];
  weights?: SetupWeights;
}): Recommendation | null {
  return recommendSetups({ ...args, topN: 1 })[0] ?? null;
}

/**
 * 同上をスコア降順 topN 件返す（比較用に複数提案を出すため、2026-07-25）。
 * 同着は seeds の順で安定。topN <= 0 は空配列。
 */
export function recommendSetups(args: {
  criterion: RecommendCriterion;
  seeds: string[];
  playerCount: number;
  lostFleet: boolean;
  mapTop3?: FactionId[];
  mapTopK?: FactionId[];
  weights?: SetupWeights;
  topN: number;
  /**
   * 生成条件のベース（Setup タブの一括探索用、2026-07-31）。渡すとこれに seed を
   * 載せて生成するので、タイル指定や面の指定が効いたまま探索できる。
   * 省略時は従来どおり人数・拡張だけの素のセットアップ。
   */
  baseInput?: Omit<BuildSetupInput, "seed">;
}): Recommendation[] {
  const { criterion, seeds, playerCount, lostFleet, mapTop3, mapTopK, weights, topN, baseInput } =
    args;
  if (topN <= 0) return [];
  const all: Recommendation[] = [];
  for (const seed of seeds) {
    const input: BuildSetupInput = baseInput
      ? ({ ...baseInput, seed } as BuildSetupInput)
      : {
          seed,
          playerCount,
          ...(lostFleet ? { mode: "lostFleet" as const } : {}),
        };
    const result = buildSetupFromSeed(input);
    const setupScores = scoreSetupFactions(result, weights);
    const score = criterionScore(criterion, setupScores, {
      playerCount,
      mapTop3,
      mapTopK,
      lostFleet,
    });
    all.push({ input, result, setupScores, criterion, score, trials: seeds.length });
  }
  // 安定ソート（Array#sort は安定）なので同着は seeds の順を保つ。
  return all.sort((a, b) => b.score - a.score).slice(0, topN);
}
