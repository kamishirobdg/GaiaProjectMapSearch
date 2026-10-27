// src/lib/pairPlan.ts
// Pair の「提案を生成」の選定ロジック（旧 List タブ「セット提案」。2026-08-02 に ListView.tsx から分離）。
//
// 元は handleGenerate という1つの巨大な useCallback に全部入っていたが、
// 依存配列が実際に読んでいる値（mapTopOf / factionPrefArg）と食い違っていて
// React Compiler が既存のメモ化を保てず、ListView 全体の最適化がスキップされて
// いた（react-hooks/preserve-manual-memoization = lint エラー）。
// ここには「計算」だけを置き、画面状態の更新（setState）はコンポーネントに残す。
//
// planPair は seeds を渡せば決定論（同じ入力 → 同じ結果）。localStorage を読むのは
// deriveSetupSettings の共有設定フォールバックだけで、これは分離前からの挙動。

import type { PersistedCandidate } from "@/app/board/persistence";
import {
  criterionScore,
  recommendSetups,
  scoreSetupFactions,
  topFactions,
  topKOf,
  type FactionPref,
  type FactionScores,
  type RecommendCriterion,
  type Recommendation,
} from "@/gaia/eval/factionEval";
import type { FactionId } from "@/gaia/eval/factionWeights";
import { mapFactionScores } from "@/gaia/eval/mapFaction";
import { applyShipInteraction, shipInteractionOf } from "@/gaia/eval/shipInteraction";
import type { ScoreBlend } from "@/gaia/eval/scoreBlend";
import { factionPrefArgOf, prefOnTotal, totalScoresOf, usesTotalBasis } from "@/lib/pairScore";

export { factionPrefArgOf, prefOnTotal, totalScoresOf, usesTotalBasis } from "@/lib/pairScore";
import type { FactionPrefByFaction, SetupWeights } from "@/gaia/eval/setupWeights";
import { buildSetupFromSeed, type BuildSetupInput } from "@/gaia/setup/buildSetup";
import type { SavedSetup } from "@/lib/setupHistory";
import { readSharedExpansion, readSharedPlayers } from "@/lib/sharedSettings";

/** 提案を出す件数（比較用に複数出す、2026-07-25 要望）。 */
export const PAIR_TOP_N = 5;

/** ランダム生成で試すシードの数。 */
const RANDOM_TRIALS = 200;

/** 探索の向き（2026-07-25 要望）。 */
export type PairDir = "mapToSetup" | "setupToMap";
/** マップ→セットアップ時の相手の探し方。 */
export type SetupSource = "random" | "saved";

/** 提案1件分（マップ＋セットアップ＋スコア）。クリックで切り替えて見比べる。 */
export type PairOption = {
  key: string;
  /** 表示対象のマップ id（候補に無い場合は ""）。 */
  mapId: string;
  rec: Recommendation;
  mapTop: Array<{ id: FactionId; score: number }> | null;
};

/** 提案ログ1件（生成のたびに自動で残す履歴、2026-07-25 要望）。 */
export type PairLogEntry = {
  id: string;
  /** どの条件で生成したログか（条件バケツのキー） */
  conditionKey: string;
  at: number;
  dir: PairDir;
  source: SetupSource;
  criterion: RecommendCriterion;
  players: number;
  lf: boolean;
  /** 提示できた候補数（上位N件の N）。 */
  count: number;
  /** 先頭候補の識別子（マップ＝盤面ハッシュ先頭、セットアップ＝シード）。 */
  seed: string;
  mapHash: string;
  mapScore: number;
  score: number;
  /**
   * クリックで再表示するための候補一覧。セットアップは入力そのものを持つ
   * （保存済み由来の回避/強制ルールまで忠実に復元するため。シードだけでは
   * ルール付きセットアップを再現できない）。マップは盤面ハッシュで引き当てる。
   * 旧バージョンのログには無いので optional。
   */
  opts?: Array<{ input: BuildSetupInput; mapHash: string; mapScore: number; score: number }>;
};

/** ログに積む中身。id/at/conditionKey は積む側（画面）が付ける。 */
export type PairLogPayload = Omit<PairLogEntry, "id" | "at" | "conditionKey">;

/** 人数/拡張。マップのテンプレートかセットアップの入力から決まる。 */
export type PairSettings = { players: number; lf: boolean };

/** 生成できなかった理由。表示文言は画面側が UI[lang] から引く。 */
export type PairPlanFailure = "needSetup" | "needMap" | "needMapPool" | "needSetupPool";

/** 生成結果。失敗なら理由だけ、成功なら画面へ反映する内容ひとそろい。 */
export type PairPlan =
  | { ok: false; failure: PairPlanFailure }
  | {
      ok: true;
      /** 添える注記（無ければ null）。 */
      note: "mapIndependent" | null;
      options: PairOption[];
      settings: PairSettings;
      /** 提案ログに積む中身（積まないときは null）。 */
      log: PairLogPayload | null;
    };

export type PairPlanInput = {
  pairDir: PairDir;
  setupSource: SetupSource;
  criterion: RecommendCriterion;
  /** 起点に選んだマップ／セットアップの id。 */
  pairMapId: string;
  pairSetupId: string;
  selectableMaps: PersistedCandidate[];
  selectableSetups: SavedSetup[];
  templateIdBySearchKey: Record<string, string>;
  evalWeights: SetupWeights;
  factionPref: FactionPrefByFaction;
  /** Map と Setup の合算比（種族優遇の掛け先に通す。省略時 1:1。2026-09-19）。 */
  blend?: ScoreBlend;
  /** ランダム生成で試すシード。省略時はその場で作る（テストでは固定値を渡す）。 */
  seeds?: string[];
  /** 上位 K（共有設定。省略時 人数＋2） */
  topK?: number | null;
};

/** セットアップ保存レコードの人数/拡張。 */
export function setupSettingsOf(r: SavedSetup): PairSettings {
  return { players: r.input.playerCount ?? 4, lf: r.input.mode === "lostFleet" };
}

/**
 * ペア提案のセットアップ条件はマップのテンプレートから導出する
 * （マップと拡張・人数が食い違う提案を出さないため）。マップなしのときは
 * 共有設定（人数・拡張）に従う。
 */
export function deriveSetupSettings(templateId: string | null): PairSettings {
  if (templateId === "3p_lostFleet") return { players: 3, lf: true };
  if (templateId === "4p_lostFleet") return { players: 4, lf: true };
  const p = readSharedPlayers() ?? 4;
  if (templateId === "base_34p") return { players: Math.min(4, Math.max(3, p)), lf: false };
  return { players: p, lf: (readSharedExpansion() ?? "base") === "lostFleet" };
}

/** マップの上位種族。top3 は基準3（逆優位）用、topK は基準4（優位）用で K=人数+2。 */
export type MapTop = {
  tid: string;
  top3: FactionId[];
  topK: FactionId[];
  detail: Array<{ id: FactionId; score: number }>;
};

/** 配置だけからマップの上位種族を出す（候補に無い盤面＝保存した組・連続探索の順位表の行も同じ式。2026-10-17）。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTopOfPlacement(tid: string, placement: any[], playersForK?: number, topKSetting?: number | null): MapTop | null {
  if (!tid) return null;
  try {
    const derived = deriveSetupSettings(tid);
    const ms = mapFactionScores(tid, placement ?? []);
    const top3 = topFactions(ms, 3, derived.lf);
    const topK = topFactions(ms, topKOf(playersForK ?? derived.players, topKSetting), derived.lf);
    return { tid, top3, topK, detail: top3.map((f) => ({ id: f, score: ms[f] })) };
  } catch {
    return null;
  }
}

/** マップの上位種族（テンプレ不明・計算不能なら null）。生成とログ復元で共用。 */
export function mapTopOf(
  c: PersistedCandidate,
  templateIdBySearchKey: Record<string, string>,
  playersForK?: number,
  topKSetting?: number | null
): MapTop | null {
  const tid = templateIdBySearchKey[c.searchKey] ?? null;
  if (!tid) return null;
  return mapTopOfPlacement(tid, c.placement ?? [], playersForK, topKSetting);
}


/** 候補マップの評価内訳（種族優遇の Map ぶんと、合計 T_f の材料）。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function breakdownOf(c: PersistedCandidate | null): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (c as any)?.evaluation?.breakdown ?? null;
}

// usesTotalBasis / totalScoresOf / prefOnTotal は pairScore.ts へ（ワーカーからも使うため。2026-10-17）

function randomSeeds(n: number): string[] {
  return Array.from({ length: n }, () => String(Math.floor(Math.random() * 2147483647) + 1));
}

/** セットアップ→マップ: 起点のセットアップに最も合うマップを探す。 */
function planSetupToMap(a: PairPlanInput): PairPlan {
  const src = a.selectableSetups.find((r) => r.id === a.pairSetupId) ?? null;
  if (!src) return { ok: false, failure: "needSetup" };

  const settings = setupSettingsOf(src);
  const result = buildSetupFromSeed(src.input);
  const rawSetupScores = scoreSetupFactions(result, a.evalWeights);
  // 人数/拡張が一致するマップだけを対象にする。
  const cands = a.selectableMaps.filter((c) => {
    const tid = a.templateIdBySearchKey[c.searchKey] ?? "";
    if (!tid) return false;
    const s = deriveSetupSettings(tid);
    return s.lf === settings.lf && (s.lf ? s.players === settings.players : true);
  });
  const scored: Array<{ c: PersistedCandidate; score: number; top: MapTop; setupScores: FactionScores }> = [];
  let anyTotalBasis = false;
  for (const c of cands) {
    const top = mapTopOf(c, a.templateIdBySearchKey, undefined, a.topK);
    if (!top) continue;
    const bd = breakdownOf(c);
    // 船の相互作用（段階 1、2026-10-08）: 組にするマップごとに船のタイルの値を船接触で増減する
    const setupScores = applyShipInteraction(rawSetupScores, shipInteractionOf(result, bd, a.evalWeights));
    // 基準 1・2 は合計 T_f で（段階 2）。内訳が無い候補は Setup の値で
    const totalBasis = usesTotalBasis(a.criterion) && !!bd;
    if (totalBasis) anyTotalBasis = true;
    scored.push({
      c,
      top,
      setupScores,
      score: criterionScore(a.criterion, totalBasis ? totalScoresOf(setupScores, bd, a.blend) : setupScores, {
        playerCount: settings.players,
        lostFleet: settings.lf,
        mapTop3: top.top3,
        factionPref: totalBasis ? prefOnTotal(a.factionPref) : factionPrefArgOf(a.factionPref, bd, a.blend),
        topK: a.topK,
      }),
    });
  }
  if (scored.length === 0) return { ok: false, failure: "needMapPool" };

  scored.sort((x, y) => y.score - x.score);
  const topN = scored.slice(0, PAIR_TOP_N);
  return {
    ok: true,
    note: usesTotalBasis(a.criterion) && !anyTotalBasis ? "mapIndependent" : null,
    settings,
    options: topN.map((x) => ({
      key: `m:${x.c.id}`,
      mapId: x.c.id,
      mapTop: x.top.detail,
      rec: {
        input: src.input,
        result,
        setupScores: x.setupScores,
        criterion: a.criterion,
        score: x.score,
        trials: cands.length,
      },
    })),
    log: {
      dir: a.pairDir,
      source: a.setupSource,
      criterion: a.criterion,
      players: settings.players,
      lf: settings.lf,
      count: Math.min(scored.length, PAIR_TOP_N),
      seed: String(src.input.seed),
      mapHash: String(scored[0].c.placementHash ?? ""),
      mapScore: Number(scored[0].c.score ?? 0),
      score: scored[0].score,
      opts: topN.map((x) => ({
        input: src.input,
        mapHash: String(x.c.placementHash ?? ""),
        mapScore: Number(x.c.score ?? 0),
        score: x.score,
      })),
    },
  };
}

/** マップ→セットアップの共通部分（起点マップの上位種族と、生成する条件）。 */
type MapSide = {
  selected: PersistedCandidate | null;
  mapTop3?: FactionId[];
  mapTopK?: FactionId[];
  mapTopDetail: Array<{ id: FactionId; score: number }> | null;
  settings: PairSettings;
  /** 種族優遇（Map ぶんは起点マップの評価内訳から引く。2026-07-31。合計 T_f で測るときは T_f に掛ける）。 */
  pref: FactionPref | undefined;
  /** 基準 1・2 を合計 T_f で測るときの起点マップの内訳（内訳が無い・基準 3・4 のときは null）。段階 2 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  totalBd: any;
};

function resolveMapSide(a: PairPlanInput): MapSide | PairPlanFailure {
  const selected = a.selectableMaps.find((c) => c.id === a.pairMapId) ?? null;
  const tid = selected ? (a.templateIdBySearchKey[selected.searchKey] ?? null) : null;
  const mapDependent = a.criterion === "opposeMap" || a.criterion === "alignMap";
  if (mapDependent && (!selected || !tid)) return "needMap";

  let mapTop3: FactionId[] | undefined;
  let mapTopK: FactionId[] | undefined;
  let mapTopDetail: Array<{ id: FactionId; score: number }> | null = null;
  if (selected && tid) {
    const top = mapTopOf(selected, a.templateIdBySearchKey, undefined, a.topK);
    if (top) {
      mapTop3 = top.top3;
      mapTopK = top.topK;
      mapTopDetail = top.detail;
    } else if (mapDependent) {
      return "needMap";
    }
  }
  const bd = breakdownOf(selected);
  const totalBd = usesTotalBasis(a.criterion) && bd ? bd : null;
  return {
    selected,
    mapTop3,
    mapTopK,
    mapTopDetail,
    settings: deriveSetupSettings(tid),
    pref: totalBd ? prefOnTotal(a.factionPref) : factionPrefArgOf(a.factionPref, bd, a.blend),
    totalBd,
  };
}

/** 基準 1・2 で起点マップの内訳が無いときは従来どおり Setup の値で測る（＝マップ非依存の注記）。 */
function noteOf(a: PairPlanInput, m: MapSide): "mapIndependent" | null {
  return usesTotalBasis(a.criterion) && !m.totalBd ? "mapIndependent" : null;
}

/** 保存済みセットアップから選ぶ（2026-07-25 要望）。 */
function planSavedSetups(a: PairPlanInput, m: MapSide): PairPlan {
  const cands = a.selectableSetups.filter((r) => {
    const s = setupSettingsOf(r);
    return s.lf === m.settings.lf && s.players === m.settings.players;
  });
  const scored = cands.map((r) => {
    const res = buildSetupFromSeed(r.input);
    // 船の相互作用（段階 1、2026-10-08）: 起点マップの船接触で船のタイルの値を増減する
    const scores = applyShipInteraction(scoreSetupFactions(res, a.evalWeights), shipInteractionOf(res, breakdownOf(m.selected), a.evalWeights));
    return {
      r,
      res,
      scores,
      score: criterionScore(a.criterion, m.totalBd ? totalScoresOf(scores, m.totalBd, a.blend) : scores, {
        playerCount: m.settings.players,
        lostFleet: m.settings.lf,
        ...(m.mapTop3 ? { mapTop3: m.mapTop3 } : {}),
        ...(m.mapTopK ? { mapTopK: m.mapTopK } : {}),
        factionPref: m.pref,
        topK: a.topK,
      }),
    };
  });
  if (scored.length === 0) return { ok: false, failure: "needSetupPool" };

  scored.sort((x, y) => y.score - x.score);
  const topN = scored.slice(0, PAIR_TOP_N);
  return {
    ok: true,
    note: noteOf(a, m),
    settings: m.settings,
    options: topN.map((x) => ({
      key: `s:${x.r.id}`,
      mapId: a.pairMapId,
      mapTop: m.mapTopDetail,
      rec: {
        input: x.r.input,
        result: x.res,
        setupScores: x.scores,
        criterion: a.criterion,
        score: x.score,
        trials: cands.length,
      },
    })),
    log: {
      dir: a.pairDir,
      source: a.setupSource,
      criterion: a.criterion,
      players: m.settings.players,
      lf: m.settings.lf,
      count: Math.min(scored.length, PAIR_TOP_N),
      seed: String(scored[0].r.input.seed),
      mapHash: String(m.selected?.placementHash ?? ""),
      mapScore: Number(m.selected?.score ?? 0),
      score: scored[0].score,
      opts: topN.map((x) => ({
        input: x.r.input,
        mapHash: String(m.selected?.placementHash ?? ""),
        mapScore: Number(m.selected?.score ?? 0),
        score: x.score,
      })),
    },
  };
}

/** ランダム生成（従来動作）。 */
function planRandomSetups(a: PairPlanInput, m: MapSide): PairPlan {
  const rs = recommendSetups({
    criterion: a.criterion,
    seeds: a.seeds ?? randomSeeds(RANDOM_TRIALS),
    playerCount: m.settings.players,
    lostFleet: m.settings.lf,
    ...(m.mapTop3 ? { mapTop3: m.mapTop3 } : {}),
    ...(m.mapTopK ? { mapTopK: m.mapTopK } : {}),
    weights: a.evalWeights,
    factionPref: m.pref,
    topK: a.topK,
    topN: PAIR_TOP_N,
    // 船の相互作用（段階 1、2026-10-08）: 起点マップの船接触で船のタイルの値を増減する
    adjustSetupScores: (res, scores) => applyShipInteraction(scores, shipInteractionOf(res, breakdownOf(m.selected), a.evalWeights)),
    // 基準 1・2 は合計 T_f で測る（段階 2）
    ...(m.totalBd ? { criterionScores: (_res: unknown, scores: FactionScores) => totalScoresOf(scores, m.totalBd, a.blend) } : {}),
  });
  return {
    ok: true,
    note: noteOf(a, m),
    settings: m.settings,
    options: rs.map((r) => ({
      key: `r:${r.input.seed}`,
      mapId: a.pairMapId,
      mapTop: m.mapTopDetail,
      rec: r,
    })),
    // 0件のときはログを残さない（提案していないので記録も残さない）。
    log:
      rs.length > 0
        ? {
            dir: a.pairDir,
            source: a.setupSource,
            criterion: a.criterion,
            players: m.settings.players,
            lf: m.settings.lf,
            count: rs.length,
            seed: String(rs[0].input.seed),
            mapHash: String(m.selected?.placementHash ?? ""),
            mapScore: Number(m.selected?.score ?? 0),
            score: rs[0].score,
            opts: rs.map((r) => ({
              input: r.input,
              mapHash: String(m.selected?.placementHash ?? ""),
              mapScore: Number(m.selected?.score ?? 0),
              score: r.score,
            })),
          }
        : null,
  };
}

/** セット提案の生成（上位 PAIR_TOP_N 件。要望 2026-07-25）。 */
export function planPair(a: PairPlanInput): PairPlan {
  if (a.pairDir === "setupToMap") return planSetupToMap(a);
  const m = resolveMapSide(a);
  if (typeof m === "string") return { ok: false, failure: m };
  return a.setupSource === "saved" ? planSavedSetups(a, m) : planRandomSetups(a, m);
}
