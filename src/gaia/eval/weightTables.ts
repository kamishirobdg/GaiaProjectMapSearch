// src/gaia/eval/weightTables.ts
//
// 重みテーブルを画面から編集するためのメタ情報（2026-08-06）。
//
// 値の正本は `data/weights/*.csv` で、アプリ内の4本の表はその自動生成物。
// **ここは読むだけ**にしてある —— 編集の結果は差分テキストとして出力し、
// `scripts/apply_weight_edits.py` で CSV へ戻す。画面から生成物を書き換えないのは
// 「CSV が正本」という約束（data/weights/README.md）を崩さないため。
//
// 4本のうち3本は「タイル × 軸 × 種族」で同型（軸は研究列またはラウンド）、
// tile_weights だけ軸が無い「タイル × 種族」。ここでは軸ありに揃えて扱い、
// 軸なしの表は axes を空配列にしてある。

import { SETUP_CATALOG } from "@/gaia/setup/data";
import { RESEARCH_TRACK_IDS, type ResearchTrackId } from "@/gaia/setup/types";
import {
  FACTIONS,
  LF_FACTION_IDS,
  type FactionDef,
  type FactionId,
} from "./factionWeights";
import {
  ADVANCED_TECH_WEIGHTS_BASE,
  ADVANCED_TECH_WEIGHTS_LF,
} from "./advancedTechWeights";
import {
  TECH_POSITION_WEIGHTS_BASE,
  TECH_POSITION_WEIGHTS_LF,
} from "./techPositionWeights";
import {
  ROUND_SCORING_WEIGHTS_BASE,
  ROUND_SCORING_WEIGHTS_LF,
} from "./roundScoringWeights";
import { TILE_VALUE_WEIGHTS_BASE, TILE_VALUE_WEIGHTS_LF } from "./tileWeights";

/** CSV のファイル名に合わせた表の id（差分テキストのヘッダに出す）。 */
export type WeightTableId =
  | "advanced_tech"
  | "tech_position"
  | "round_scoring"
  | "tile_weights";

export type WeightAxis = { key: string; ja: string; en: string };

export type WeightTile = {
  id: string;
  ja: string;
  en: string;
  effectJa?: string;
  effectEn?: string;
  /** tile_weights だけカテゴリで区切る（ブースター / 最終得点 / 同盟タイル / LF船）。 */
  group?: string;
};

export type WeightTableMeta = {
  id: WeightTableId;
  ja: string;
  en: string;
  /**
   * 軸の見出し。tile_weights は空配列＝軸なし（基準値だけを編集する）。
   * `lf` を引数に取るのは advanced_tech の拡張版だけ研究列6つに加えて
   * 得点ボード拡張部の面（vp25/shuttle）を持つため（2026-08-08）。
   */
  axes: (lf: boolean) => WeightAxis[];
  /** 軸そのものの呼び名（画面の見出しに出す）。 */
  axisJa: string;
  axisEn: string;
  tiles: (lf: boolean) => WeightTile[];
  cell: (
    tileId: string,
    axisKey: string,
    faction: FactionId,
    lf: boolean,
  ) => number | undefined;
  /**
   * 拡張版だけ素点が違うタイルの比（拡張版 ÷ 通常版）。`gen_*_table.py` の
   * `TILE_VP_LF` に対応する。通常版の値を拡張版へコピーするときに掛ける
   * （`scripts/copy_base_to_lf.py` と同じ扱い）。
   */
  lfVpRatio?: (tileId: string) => number;
  /** 画面に出す注意書き（自動で追随する枠など）。 */
  noteJa?: string;
  noteEn?: string;
};

// ---------------------------------------------------------------- 軸

// 研究列の並びは RESEARCH_TRACK_IDS と同じ。CSV の3列目は日本語なので、
// 差分テキストには **TS 側のキー**（terra/nav/...）を出して照合を安定させる。
// 列見出しは**狭い画面の列幅（40px）に収まる長さ**にしてある（2026-08-06）。
// 「惑星改造」「人工知能」のままだと4文字で列からはみ出す。
const TRACK_JA: Record<ResearchTrackId, string> = {
  terra: "惑改",
  nav: "航行",
  ai: "AI",
  gaia: "ガイア",
  eco: "経済",
  sci: "科学",
};
const TRACK_EN: Record<ResearchTrackId, string> = {
  terra: "Terra",
  nav: "Nav",
  ai: "AI",
  gaia: "Gaia",
  eco: "Eco",
  sci: "Sci",
};

const TRACK_AXES: WeightAxis[] = RESEARCH_TRACK_IDS.map((id) => ({
  key: id,
  ja: TRACK_JA[id],
  en: TRACK_EN[id],
}));

// 得点ボード拡張部（研究列に紐付かない7枚目）の面。拡張版だけに出る
// （2人=25VP面固定／3・4人=探査シャトル面。gen_advanced_tech_table.py の
// EXT_TRACK と同じ。2026-08-08 追加）。
const EXTENSION_AXES: WeightAxis[] = [
  { key: "vp25", ja: "25点", en: "25VP" },
  { key: "shuttle", ja: "3船", en: "Shuttle" },
];
const ADVANCED_TECH_AXES = (lf: boolean): WeightAxis[] =>
  lf ? [...TRACK_AXES, ...EXTENSION_AXES] : TRACK_AXES;

/** ラウンドは R1..R6。表の側は配列なので添字へ直して引く。 */
const ROUND_AXES: WeightAxis[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  key: `R${n}`,
  ja: `R${n}`,
  en: `R${n}`,
}));

// ---------------------------------------------------------------- タイル辞書

type CatalogTile = {
  id: string;
  label: string;
  labelEn: string;
  effect?: string;
  effectEn?: string;
};

const BY_ID = new Map<string, CatalogTile>();
for (const group of [
  SETUP_CATALOG.standardTech,
  SETUP_CATALOG.advancedTech,
  SETUP_CATALOG.boosters,
  SETUP_CATALOG.roundScoring,
  SETUP_CATALOG.finalScoring,
  SETUP_CATALOG.federations,
  SETUP_CATALOG.boostersLF,
  SETUP_CATALOG.roundScoringLF,
  SETUP_CATALOG.advancedTechLF,
  SETUP_CATALOG.standardTechLF,
  SETUP_CATALOG.finalScoringLF,
  SETUP_CATALOG.federationsGold,
  SETUP_CATALOG.artifacts,
]) {
  for (const t of group) BY_ID.set(t.id, t);
}

/** tile_weights のカテゴリ。gen_tile_weights_table.py の CATEGORY と同じ区分。 */
const TILE_GROUP = new Map<string, string>();
for (const [ja, keys] of [
  ["ブースター", ["boosters", "boostersLF"]],
  ["最終得点", ["finalScoring", "finalScoringLF"]],
  ["同盟タイル", ["federations"]],
  ["LF船", ["standardTechLF", "federationsGold", "artifacts"]],
] as const) {
  for (const key of keys) {
    for (const t of SETUP_CATALOG[key as keyof typeof SETUP_CATALOG] as CatalogTile[]) {
      if (!TILE_GROUP.has(t.id)) TILE_GROUP.set(t.id, ja);
    }
  }
}

function tileOf(id: string): WeightTile {
  const t = BY_ID.get(id);
  return {
    id,
    ja: t?.label ?? id,
    en: t?.labelEn ?? id,
    effectJa: t?.effect,
    effectEn: t?.effectEn,
    group: TILE_GROUP.get(id),
  };
}

/** 表のキー順をそのままタイルの並びにする（CSV の行順と一致する）。 */
function tilesFrom(table: Record<string, unknown>): WeightTile[] {
  return Object.keys(table).map(tileOf);
}

// ---------------------------------------------------------------- 表の定義

export const WEIGHT_TABLES: WeightTableMeta[] = [
  {
    id: "advanced_tech",
    ja: "上級技術",
    en: "Advanced tech",
    axes: ADVANCED_TECH_AXES,
    axisJa: "研究列",
    axisEn: "Track",
    tiles: (lf) => tilesFrom(lf ? ADVANCED_TECH_WEIGHTS_LF : ADVANCED_TECH_WEIGHTS_BASE),
    cell: (tileId, axisKey, faction, lf) =>
      (lf ? ADVANCED_TECH_WEIGHTS_LF : ADVANCED_TECH_WEIGHTS_BASE)[tileId]?.[
        axisKey as ResearchTrackId | "vp25" | "shuttle"
      ]?.[faction],
    noteJa:
      "拡張版の「25点」「3船」は得点ボード拡張部（列に紐付かない7枚目）の面ごとの評価。" +
      "未入力のタイルは6列の最大値を自動で使う。",
    noteEn:
      'LF-only "25pt"/"3ship" columns are the scoring-board extension slot per face. ' +
      "Tiles without a value fall back to the max of the six tracks.",
  },
  {
    id: "tech_position",
    ja: "標準技術",
    en: "Standard tech",
    axes: () => TRACK_AXES,
    axisJa: "研究列",
    axisEn: "Track",
    tiles: (lf) => tilesFrom(lf ? TECH_POSITION_WEIGHTS_LF : TECH_POSITION_WEIGHTS_BASE),
    cell: (tileId, axisKey, faction, lf) =>
      (lf ? TECH_POSITION_WEIGHTS_LF : TECH_POSITION_WEIGHTS_BASE)[tileId]?.[
        axisKey as ResearchTrackId
      ]?.[faction],
    // TS3（首府・学院のパワー値4）だけ拡張版の素点が高い（12 → 14）。
    // 金枠同盟と LF船 のぶん、同盟1つの価値が通常版より大きいため。
    lfVpRatio: (tileId) => (tileId === "TS3" ? 14 / 12 : 1),
    noteJa: "フリー枠は6列の最大値を自動で使う（データに持たない）。",
    noteEn: "The free slot auto-uses the max of the six tracks (not stored).",
  },
  {
    id: "round_scoring",
    ja: "ラウンド得点",
    en: "Round scoring",
    axes: () => ROUND_AXES,
    axisJa: "ラウンド",
    axisEn: "Round",
    tiles: (lf) => tilesFrom(lf ? ROUND_SCORING_WEIGHTS_LF : ROUND_SCORING_WEIGHTS_BASE),
    cell: (tileId, axisKey, faction, lf) => {
      const i = roundIndexOf(axisKey);
      if (i < 0) return undefined;
      return (lf ? ROUND_SCORING_WEIGHTS_LF : ROUND_SCORING_WEIGHTS_BASE)[tileId]?.[i]?.[
        faction
      ];
    },
  },
  {
    id: "tile_weights",
    ja: "ブースター他",
    en: "Boosters etc.",
    axes: () => [],
    axisJa: "—",
    axisEn: "—",
    tiles: (lf) => tilesFrom(lf ? TILE_VALUE_WEIGHTS_LF : TILE_VALUE_WEIGHTS_BASE),
    cell: (tileId, _axisKey, faction, lf) =>
      (lf ? TILE_VALUE_WEIGHTS_LF : TILE_VALUE_WEIGHTS_BASE)[tileId]?.[faction],
    noteJa: "ブースター・最終得点・同盟タイル・LF船。列が無いので値をそのまま入れる。",
    noteEn: "Boosters, final scoring, federations and LF ships. No axis — edit values directly.",
  },
];

// ------------------------------------------------ 拡張で値が変わりそうなタイル

/**
 * 「通常版と拡張版で価値が変わるはずのタイル」と、その理由（2026-08-14 の精査）。
 *
 * 拡張版の表は通常版を丸ごとコピーして作ってあるので、**コピーのままでよいタイル**と
 * **拡張の要素で価値が動くはずのタイル**が見た目で区別できない。ここに挙げたものは
 * `/weights` の拡張版タブで別の地色にして、見直しの優先順が分かるようにしている。
 *
 * 素点そのものが版で違うと分かっているものは `TILE_VP_LF`（いまは TS3 だけ）で
 * 既に補正済み。ここは「補正の要否をまだ決めていない」ものの一覧。
 */
export const LF_REVIEW_HINTS: Record<string, { ja: string; en: string }> = {
  // 惑星の種類を数える系。原始惑星・小惑星が増えて種類の上限が 7 → 9 になる。
  TS2: { ja: "拡張は惑星の種類が7→9（原始・小惑星）", en: "LF adds 2 planet types (7→9)" },
  AT15: { ja: "拡張は惑星の種類が7→9（原始・小惑星）", en: "LF adds 2 planet types (7→9)" },
  // 同盟タイルを数える系。金枠同盟のぶん枚数が増える。TS3 は TILE_VP_LF で補正済み。
  AT01: { ja: "拡張は金枠同盟のぶん同盟が増える（TS3 と同じ理屈）", en: "LF gold federations add count" },
  AT12: { ja: "拡張は金枠同盟のぶん同盟が増える（TS3 と同じ理屈）", en: "LF gold federations add count" },
  RS08: { ja: "拡張は金枠同盟のぶん同盟が増える（TS3 と同じ理屈）", en: "LF gold federations add count" },
  // 宙域・航法系。LF船が深宇宙にあるので到達すること自体の価値が上がる。
  AT10: { ja: "拡張はLF船が深宇宙にあり宙域を広げる価値が上がる", en: "LF ships raise the value of range" },
  AT06: { ja: "拡張はLF船が深宇宙にあり宙域を広げる価値が上がる", en: "LF ships raise the value of range" },
  // LF船に乗る標準技術で研究が余分に進む。
  AT02: { ja: "拡張はLF船の標準技術で研究が余分に進む", en: "LF ship techs add research steps" },
  // QIC の使い道（射程延長・アーティファクト）が増える。
  TS1: { ja: "拡張はQICの使い道が増える（射程延長・アーティファクト）", en: "LF adds QIC sinks" },
  AT03: { ja: "拡張はQICの使い道が増える（射程延長・アーティファクト）", en: "LF adds QIC sinks" },
  RB02: { ja: "拡張はQICの使い道が増える（射程延長・アーティファクト）", en: "LF adds QIC sinks" },
};

/** 拡張版で見直しが要りそうなタイルか（理由付き）。通常版では常に undefined 扱い。 */
export function lfReviewHint(tileId: string): { ja: string; en: string } | undefined {
  return LF_REVIEW_HINTS[tileId];
}

export function weightTableOf(id: WeightTableId): WeightTableMeta {
  const m = WEIGHT_TABLES.find((t) => t.id === id);
  if (!m) throw new Error(`unknown weight table: ${id}`);
  return m;
}

/** "R3" → 2。ラウンド得点の表が配列なので添字へ直す。 */
export function roundIndexOf(axisKey: string): number {
  const m = /^R([1-6])$/.exec(axisKey);
  return m ? Number(m[1]) - 1 : -1;
}

// ---------------------------------------------------------------- 種族

/** 拡張の有無に応じた種族の並び（CSV の列順と同じ＝FACTIONS の順）。 */
export function factionsFor(lf: boolean): FactionDef[] {
  return FACTIONS.filter((f) => lf || !LF_FACTION_IDS.has(f.id));
}

/**
 * 狭い画面の行見出し用の短縮名。スマホの幅では正式名（「スペースジャイアント」等）が
 * 収まらないので、見分けが付く最短の形にしてある。
 */
export const FACTION_SHORT_JA: Record<FactionId, string> = {
  terrans: "地球",
  lantids: "ランティダ",
  xenos: "ゼノ",
  gleens: "グリーン",
  taklons: "タクロン",
  ambas: "アンバス",
  hadschHallas: "ハッシュ",
  ivits: "シュワーム",
  geodens: "ジオデン",
  balTaks: "バルタック",
  firaks: "フィラク",
  bescods: "マッド",
  nevlas: "ネヴラ",
  itars: "イタル",
  moweyds: "モウェイド",
  spaceGiants: "スペースG",
  tinkerroids: "ティンカー",
  darkanians: "ダルカニア",
};
