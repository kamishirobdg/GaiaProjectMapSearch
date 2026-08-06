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
  /** 軸の見出し。tile_weights は空配列＝軸なし（基準値だけを編集する）。 */
  axes: WeightAxis[];
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
    axes: TRACK_AXES,
    axisJa: "研究列",
    axisEn: "Track",
    tiles: (lf) => tilesFrom(lf ? ADVANCED_TECH_WEIGHTS_LF : ADVANCED_TECH_WEIGHTS_BASE),
    cell: (tileId, axisKey, faction, lf) =>
      (lf ? ADVANCED_TECH_WEIGHTS_LF : ADVANCED_TECH_WEIGHTS_BASE)[tileId]?.[
        axisKey as ResearchTrackId
      ]?.[faction],
    noteJa: "得点ボード拡張部の1枚は6列の最大値を自動で使う（列に紐付かないため）。",
    noteEn: "The scoring-board extension slot auto-uses the max of the six tracks.",
  },
  {
    id: "tech_position",
    ja: "標準技術",
    en: "Standard tech",
    axes: TRACK_AXES,
    axisJa: "研究列",
    axisEn: "Track",
    tiles: (lf) => tilesFrom(lf ? TECH_POSITION_WEIGHTS_LF : TECH_POSITION_WEIGHTS_BASE),
    cell: (tileId, axisKey, faction, lf) =>
      (lf ? TECH_POSITION_WEIGHTS_LF : TECH_POSITION_WEIGHTS_BASE)[tileId]?.[
        axisKey as ResearchTrackId
      ]?.[faction],
    noteJa: "フリー枠は6列の最大値を自動で使う（データに持たない）。",
    noteEn: "The free slot auto-uses the max of the six tracks (not stored).",
  },
  {
    id: "round_scoring",
    ja: "ラウンド得点",
    en: "Round scoring",
    axes: ROUND_AXES,
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
    axes: [],
    axisJa: "—",
    axisEn: "—",
    tiles: (lf) => tilesFrom(lf ? TILE_VALUE_WEIGHTS_LF : TILE_VALUE_WEIGHTS_BASE),
    cell: (tileId, _axisKey, faction, lf) =>
      (lf ? TILE_VALUE_WEIGHTS_LF : TILE_VALUE_WEIGHTS_BASE)[tileId]?.[faction],
    noteJa: "ブースター・最終得点・同盟タイル・LF船。列が無いので値をそのまま入れる。",
    noteEn: "Boosters, final scoring, federations and LF ships. No axis — edit values directly.",
  },
];

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
