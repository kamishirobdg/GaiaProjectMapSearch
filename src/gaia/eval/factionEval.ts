// src/gaia/eval/factionEval.ts
//
// セットアップの種族別評価と推奨基準（一覧タブ「セット提案」用、2026-07-24）。
// 重みは factionWeights.ts の DRAFT 行列（レビューで数値だけ差し替え可能）。
//
// スコアの意味: scoreSetupFactions は「そのセットアップで各種族がどれだけ
// 有利か」の相対値（タイル重みの単純合計、ラウンド得点は枚数分加算）。
// 標準技術9種は「どのトラックの下に付くか」で価値が変わるため、
// TECH_POSITION_WEIGHTS[タイル][配置][種族] を引く（2026-07-31 に
// TRACK_AFFINITY × TECH_PREF の積から1つの表へ統合した）。

import type { SetupResult } from "@/gaia/setup/types";
import { buildSetupFromSeed, type BuildSetupInput } from "@/gaia/setup/buildSetup";
import {
  FACTION_IDS,
  factionIdsForMode,
  factionsForMode,
  type FactionId,
} from "./factionWeights";
import {
  techPositionCell,
  type TechPosition,
} from "./techPositionWeights";
import { advancedTechCell, advancedTechExtensionCell } from "./advancedTechWeights";
import { roundScoringCell } from "./roundScoringWeights";
import { tileValueCell } from "./tileWeights";
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
 * 標準技術の寄与だけを取り出す（内訳表の1列ぶん）。
 * 値は TECH_POSITION_WEIGHTS[タイル][配置][種族]（2026-07-31 に統合）。
 * フリー枠は研究列6つの最大値として自動で決まる（techPositionCell）。
 * 係数は評価指数 standardTech の1つ（旧 stdTrack / stdFree は廃止）。
 */
export function scoreStandardTech(result: SetupResult, weights?: SetupWeights): FactionScores {
  const b = setupFactionBreakdown(result, weights);
  const out = zeroScores();
  for (const f of FACTION_IDS) out[f] = b.byCategory.standardTech[f];
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
  const lf = result.mode === "lostFleet";
  const out: SetupTileHit[] = [];
  /** 引いたセル1つを、係数を掛けて1エントリにする（非ゼロが1つも無ければ出さない）。 */
  const pushCell = (
    category: SetupWeightKey,
    tileId: string,
    src: Partial<Record<FactionId, number>> | undefined,
    slot?: string
  ) => {
    if (!src) return;
    const scale = w[category];
    const byFaction: Partial<Record<FactionId, number>> = {};
    let any = false;
    for (const [f, v] of Object.entries(src)) {
      const val = (v ?? 0) * scale;
      if (val === 0) continue;
      byFaction[f as FactionId] = val;
      any = true;
    }
    if (any) out.push({ tileId, category, slot, byFaction });
  };
  const push = (category: SetupWeightKey, tileId: string | undefined, slot?: string) => {
    if (!tileId) return;
    pushCell(category, tileId, tileValueCell(tileId, lf), slot);
  };

  // 上級技術は「どの研究列の下に置かれたか」で価値が変わる（2026-08-03。標準技術と
  // 同じ理屈 —— その列をレベル4まで上げないと取れないので、登らない列の1枚は
  // 事実上取れない）。値は VP 換算（advancedTechWeights.ts）。
  for (const track of RESEARCH_TRACK_IDS as readonly ResearchTrackId[]) {
    const id = result.advancedTech.byTrack[track];
    if (id) pushCell("advanced", id, advancedTechCell(id, track, lf), track);
  }
  // 得点ボード拡張部の1枚は研究列に紐付かないので6列の最大値を使う。
  if (result.advancedTech.extension) {
    pushCell(
      "advExtension",
      result.advancedTech.extension,
      advancedTechExtensionCell(result.advancedTech.extension, lf)
    );
  }
  for (const id of result.boosters.available) push("booster", id);
  // ラウンド得点は「何ラウンド目か」で値が変わる（2026-08-02 に曲線から
  // タイル×ラウンド×種族の表へ移した。roundScoringCell）。
  result.roundScoring.forEach((id, i) => {
    pushCell("roundScoring", id, roundScoringCell(id, i, lf), `R${i + 1}`);
  });
  for (const id of result.finalScoring) push("finalScoring", id);
  push("federation", result.federationLv5);
  if (lf) {
    for (const id of Object.values(result.shipTech ?? {})) push("lfShip", id);
    for (const id of Object.values(result.goldFederations ?? {})) push("lfShip", id);
    for (const id of result.artifacts ?? []) push("lfShip", id);
  }
  // 標準技術は「どこに置かれたか」で価値が変わる（研究列6つ＋フリー枠）。
  // テーブルは拡張ごとに別（techPositionCell の第3引数）。
  const stdSlots: Array<{ id: string; pos: TechPosition }> = [
    ...(RESEARCH_TRACK_IDS as readonly ResearchTrackId[]).map((track) => ({
      id: result.standardTech.byTrack[track],
      pos: track as TechPosition,
    })),
    ...result.standardTech.free.map((id) => ({ id, pos: "free" as TechPosition })),
  ];
  for (const { id, pos } of stdSlots) {
    pushCell("standardTech", id, techPositionCell(id, pos, lf), pos);
  }
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
  const lf = result.mode === "lostFleet";
  const byCategory = {} as Record<SetupWeightKey, FactionScores>;
  for (const k of SETUP_WEIGHT_KEYS) byCategory[k] = zeroScores();

  const addCell = (cat: SetupWeightKey, cell: Partial<Record<FactionId, number>> | undefined) => {
    if (!cell) return;
    for (const [f, v] of Object.entries(cell)) byCategory[cat][f as FactionId] += v ?? 0;
  };
  const add = (cat: SetupWeightKey, tileId: string | undefined) => {
    if (!tileId) return;
    addCell(cat, tileValueCell(tileId, lf));
  };

  // 上級技術は「どの研究列の下に置かれたか」で価値が変わる（2026-08-03。値は VP 換算。
  // advancedTechWeights.ts）。標準技術と同じ理屈で、その列を登らない種族は取れない。
  for (const track of RESEARCH_TRACK_IDS as readonly ResearchTrackId[]) {
    const id = result.advancedTech.byTrack[track];
    if (id) addCell("advanced", advancedTechCell(id, track, lf));
  }
  // 得点ボード拡張部の追加上級は取得条件が通常の上級と違うので別カテゴリ。
  // 研究列に紐付かない＝どの列を登っていても取りに行けるので6列の最大値を使う。
  if (result.advancedTech.extension) {
    addCell("advExtension", advancedTechExtensionCell(result.advancedTech.extension, lf));
  }
  for (const id of result.boosters.available) add("booster", id);
  // ラウンド得点は ×2タイルが2回出るので枚数分加算しつつ、**何ラウンド目に出たかで
  // 値が変わる**（2026-08-02 に曲線を廃止し、タイル×ラウンド×種族の表へ移した）。
  // 倍率の掛け算が無くなって整数のまま足せるので、係数は下の一括スケールで掛ける
  // ＝他のカテゴリと同じ扱いになった（以前はここで丸めるため特別扱いしていた）。
  result.roundScoring.forEach((id, i) => addCell("roundScoring", roundScoringCell(id, i, lf)));
  for (const id of result.finalScoring) add("finalScoring", id);
  add("federation", result.federationLv5); // 現行DRAFTでは全0
  if (lf) {
    for (const id of Object.values(result.shipTech ?? {})) add("lfShip", id);
    for (const id of Object.values(result.goldFederations ?? {})) add("lfShip", id);
    for (const id of result.artifacts ?? []) add("lfShip", id);
  }

  // 標準技術は「どこに置かれたか」で価値が変わる（研究列6つ＋フリー枠）。
  // 2026-07-31: トラック下とフリー枠を1つの表へ統合し、係数も1つにした。
  const addStd = (id: string | undefined, pos: TechPosition) => {
    if (id) addCell("standardTech", techPositionCell(id, pos, lf));
  };
  for (const track of RESEARCH_TRACK_IDS as readonly ResearchTrackId[]) {
    addStd(result.standardTech.byTrack[track], track);
  }
  for (const id of result.standardTech.free) addStd(id, "free");

  // 係数を掛けてから合算する（表示の内訳と合計が必ず一致するようにする）。
  const total = zeroScores();
  for (const k of SETUP_WEIGHT_KEYS) {
    for (const f of FACTION_IDS) {
      byCategory[k][f] *= w[k];
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
 * セットアップ側の色優遇/冷遇（2026-07-31）。Map の wColorPref / colorPrefByType と
 * 同じ形。掛け先は「その母星色でいちばん強い種族のスコア」——
 * 実際に遊ぶのはその色の2種族のうち強い方なので、平均や合計より max が意味を持つ。
 */
export type SetupColorPref = {
  /** 係数。pref の目盛りの意味を決める。 */
  w: number;
  /** 母星色（BLACK..YELLOW / PROTO / ASTEROID）→ ±。0 や未指定は効かない。 */
  byColor: Record<string, number>;
};

/**
 * Setup 側の色優遇の係数（2026-07-31）。pref の目盛りを Map と同じ意味にするための値。
 *
 * 実測（scripts/measure_setup_color_pref.ts、4人LF 300件。2026-08-01 に再測）:
 *   基準値の振れ幅（上位10%と下位10%の差） topBalance 12.9 / neutralBalance 11.3
 *   母星色ごとの値の振れ幅（平均） 37.7
 * 0.3 にすると pref=1 で基準の振れ幅と×0.9（topBalance）／×1.0（neutralBalance）。
 * Map と揃えて「1=互角 / 2=主導 / 5=ほぼ全て」と読める。
 * Map の wColorPref と違いユーザーには出さない（入力するのは色ごとの ± だけ）。
 *
 * **重みを変えたらこのスクリプトを再実行して係数と文言を合わせ直すこと。**
 * 2026-08-01 の全タイル見直しで 0.25 → 0.3（掛け先の振れ幅が 53.1 → 37.7 に縮んだ）。
 * 2026-08-03 の VP 換算後も再測して **0.3 のまま据え置き**: 掛け先の振れ幅は
 * 37.7 → 45.8 に増えたが基準値の振れ幅も一緒に増えたので、互角になる係数は
 * 0.330（pref=1 で topBalance ×0.8 / neutralBalance ×0.9）。目盛りの文言も従来どおり。
 */
export const SETUP_COLOR_PREF_W = 0.3;

/**
 * List の種族優遇の係数（2026-07-31）。掛け先が「Map評価＋Setup評価」で
 * Setup 単体（色優遇の掛け先）のおよそ2倍の大きさになるので、目盛りを揃えるため
 * SETUP_COLOR_PREF_W の半分にしてある。
 */
export const LIST_FACTION_PREF_W = SETUP_COLOR_PREF_W / 2;

/** 母星色ごとの「その色でいちばん強い種族のスコア」。色優遇の掛け先。 */
export function colorValueOf(
  scores: FactionScores,
  lostFleet: boolean
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of factionsForMode(lostFleet)) {
    const v = scores[f.id] ?? 0;
    if (out[f.color] == null || v > out[f.color]) out[f.color] = v;
  }
  return out;
}

/**
 * List の種族優遇/冷遇（2026-07-31）。色ではなく種族ごとに ± を付ける。
 * 掛け先は **Map と Setup の合計スコア**（ユーザー確定）。Map 側は色単位・
 * Setup 側は種族単位なので、合成は呼び出し側（List）が作って valueByFaction で渡す。
 * 同じ母星色の2種族は Map ぶんが同じで、Setup ぶんで差がつく。
 */
export type FactionPref = {
  /** 係数。pref の目盛りの意味を決める。 */
  w: number;
  /** 種族 → ±。0 や未指定は効かない。 */
  byFaction: Partial<Record<FactionId, number>>;
  /**
   * 種族ごとの Map 側の評価値（母星色ぶん）。マップ1枚で決まるので呼び出し側が作る。
   * Setup 側は criterionScore が採点中の setupScores から足すので渡さなくてよい
   * ―― これで「候補ごとにセットアップが変わる」探索でも同じ形で使える。
   */
  mapValueByFaction?: FactionScores;
};

/** 種族優遇ぶんの加点（指定が無ければ 0）。掛け先は Map評価＋Setup評価。 */
function factionPrefBonus(
  setupScores: FactionScores,
  lostFleet: boolean,
  pref?: FactionPref
): number {
  if (!pref || !pref.w) return 0;
  let s = 0;
  for (const f of factionIdsForMode(lostFleet)) {
    const p = pref.byFaction[f];
    if (!p) continue;
    const value = (pref.mapValueByFaction?.[f] ?? 0) + (setupScores[f] ?? 0);
    s += pref.w * p * value;
  }
  return s;
}

/** 色優遇ぶんの加点（指定が無ければ 0）。 */
function colorPrefBonus(
  scores: FactionScores,
  lostFleet: boolean,
  pref?: SetupColorPref
): number {
  if (!pref || !pref.w) return 0;
  const vals = colorValueOf(scores, lostFleet);
  let s = 0;
  for (const [c, p] of Object.entries(pref.byColor)) {
    if (!p) continue;
    s += pref.w * p * (vals[c] ?? 0);
  }
  return s;
}

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
  opts: {
    playerCount: number;
    mapTop3?: FactionId[];
    mapTopK?: FactionId[];
    lostFleet?: boolean;
    /** 色優遇/冷遇（2026-07-31）。どの基準にも同じ形で足す。 */
    colorPref?: SetupColorPref;
    /** 種族優遇/冷遇（List 用。2026-07-31）。色優遇と併用できる。 */
    factionPref?: FactionPref;
  }
): number {
  const lf = opts.lostFleet !== false;
  const all = sortedDesc(setupScores, factionIdsForMode(lf));
  // 基準そのものとは独立に足す（Map で偏り項に色優遇を足しているのと同じ形）。
  const bonus =
    colorPrefBonus(setupScores, lf, opts.colorPref) +
    factionPrefBonus(setupScores, lf, opts.factionPref);
  const base = (() => {
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
  })();
  return base + bonus;
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
  /** 色優遇/冷遇（2026-07-31）。 */
  colorPref?: SetupColorPref;
  /** 種族優遇/冷遇（List 用。2026-07-31）。 */
  factionPref?: FactionPref;
}): Recommendation[] {
  const {
    criterion,
    seeds,
    playerCount,
    lostFleet,
    mapTop3,
    mapTopK,
    weights,
    topN,
    baseInput,
    colorPref,
    factionPref,
  } = args;
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
      colorPref,
      factionPref,
    });
    all.push({ input, result, setupScores, criterion, score, trials: seeds.length });
  }
  // 安定ソート（Array#sort は安定）なので同着は seeds の順を保つ。
  return all.sort((a, b) => b.score - a.score).slice(0, topN);
}
