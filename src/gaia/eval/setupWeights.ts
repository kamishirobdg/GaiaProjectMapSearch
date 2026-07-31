// src/gaia/eval/setupWeights.ts
//
// セットアップ評価の「評価指数」（カテゴリ別係数）。2026-07-30。
// Map の評価指数（軸ごとの重み）に対応する Setup/List 側の入力で、
// 種族スコアをカテゴリ単位でスケールする純データ。
//
// 2026-07-31: 標準技術を「どこに配置されたか」で1つの表にまとめたので、
// stdTrack / stdFree の2カテゴリを standardTech 1つへ統合した。

import { STD_TECH_SCALE } from "./factionWeights";

/**
 * 係数のカテゴリ。タイルの出どころで分けてある:
 * - advanced      上級技術（研究トラック下の6枚）
 * - advExtension  得点ボード拡張部の追加上級技術（取得条件が通常の上級と違うため別枠。
 *                 2026-07-30 ユーザー要望）
 * - booster       ラウンドブースター（使用分のみ）
 * - roundScoring  ラウンド得点（×2タイルは枚数分入る。何ラウンド目かで倍率が変わる）
 * - finalScoring  最終得点計算
 * - federation    同盟タイル（惑星改造 研究レベル5）
 * - standardTech  標準技術9枚（TECH_POSITION_WEIGHTS 経由。トラック下もフリー枠も
 *                 「配置」の違いとして同じ表で評価する。2026-07-31）
 * - lfShip        LFの船関連（船の基本技術・金枠同盟・アーティファクト）
 */
export const SETUP_WEIGHT_KEYS = [
  "advanced",
  "advExtension",
  "booster",
  "roundScoring",
  "finalScoring",
  "federation",
  "standardTech",
  "lfShip",
] as const;

export type SetupWeightKey = (typeof SETUP_WEIGHT_KEYS)[number];
export type SetupWeights = Record<SetupWeightKey, number>;

/**
 * 画面での並び順（評価表の列・評価指数の入力欄で共用）。
 * ブースターとラウンド得点はラベルが長い割に影響が小さいので右端へ置く
 * （横スクロールで最初に隠れるのが影響の小さい列になる。2026-07-30 要望）。
 */
export const SETUP_WEIGHT_DISPLAY_ORDER: readonly SetupWeightKey[] = [
  "advanced",
  "advExtension",
  "finalScoring",
  "federation",
  "standardTech",
  "lfShip",
  "roundScoring",
  "booster",
];

/**
 * 既定値。基準は 10（2026-07-31）。タイルの重みはすべて整数なので、
 * 係数を整数にすると評価値から小数が消える。基準を10にしたのは、
 * 評価値の桁をゲームの得点に揃えるため（種族ごとの評価値が100前後、
 * Map の色ごとの評価値と足して200前後）。
 */
export const SETUP_WEIGHT_BASE = 10;
export const DEFAULT_SETUP_WEIGHTS: SetupWeights = {
  advanced: SETUP_WEIGHT_BASE,
  advExtension: SETUP_WEIGHT_BASE,
  booster: SETUP_WEIGHT_BASE,
  roundScoring: SETUP_WEIGHT_BASE,
  finalScoring: SETUP_WEIGHT_BASE,
  federation: SETUP_WEIGHT_BASE,
  standardTech: STD_TECH_SCALE,
  lfShip: SETUP_WEIGHT_BASE,
};

/** 評価指数の入力範囲（基準10に合わせて -90..90）。 */
export const SETUP_WEIGHT_MIN = -90;
export const SETUP_WEIGHT_MAX = 90;
/** 入力欄の刻み。整数のまま動かせるように1。 */
export const SETUP_WEIGHT_STEP = 1;

/** LF でしか効かないカテゴリ（基本版では列も入力欄も出さない）。 */
export const LF_ONLY_WEIGHT_KEYS: ReadonlySet<SetupWeightKey> = new Set<SetupWeightKey>([
  "advExtension",
  "lfShip",
]);

export function isDefaultWeights(w: SetupWeights): boolean {
  return SETUP_WEIGHT_KEYS.every((k) => w[k] === DEFAULT_SETUP_WEIGHTS[k]);
}

/**
 * 任意の入力（localStorage の JSON など）を係数へ正規化する。
 * 数値でないキー・非有限値は既定値へフォールバックし、範囲へクランプする。
 */
export function sanitizeSetupWeights(raw: unknown): SetupWeights {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out = {} as SetupWeights;
  for (const k of SETUP_WEIGHT_KEYS) {
    const n = Number(src[k]);
    out[k] = Number.isFinite(n)
      ? Math.max(SETUP_WEIGHT_MIN, Math.min(SETUP_WEIGHT_MAX, n))
      : DEFAULT_SETUP_WEIGHTS[k];
  }
  return out;
}

// --- localStorage（Setup タブと List タブで共有）-----------------------------
//
// 保存は「既定と異なるキーだけ」を書く（互換の鉄則と同じスプレッド構築）。
// 全部既定ならキー自体を消し、未設定の状態へ戻す。

export const LS_SETUP_EVAL_WEIGHTS = "gaia_setup_eval_weights";

export function readSetupWeights(): SetupWeights {
  try {
    const raw = localStorage.getItem(LS_SETUP_EVAL_WEIGHTS);
    if (!raw) return { ...DEFAULT_SETUP_WEIGHTS };
    return sanitizeSetupWeights(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETUP_WEIGHTS };
  }
}

/** 既定と異なる値だけを JSON にする（全部既定なら null＝キー削除）。 */
export function serializeSetupWeights(w: SetupWeights): string | null {
  const diff: Partial<SetupWeights> = {};
  for (const k of SETUP_WEIGHT_KEYS) {
    if (w[k] !== DEFAULT_SETUP_WEIGHTS[k]) diff[k] = w[k];
  }
  return Object.keys(diff).length === 0 ? null : JSON.stringify(diff);
}

export function writeSetupWeights(w: SetupWeights): void {
  try {
    const s = serializeSetupWeights(w);
    if (s === null) localStorage.removeItem(LS_SETUP_EVAL_WEIGHTS);
    else localStorage.setItem(LS_SETUP_EVAL_WEIGHTS, s);
  } catch {
    // ignore
  }
}

// --- 色優遇/冷遇（母星色ごと。2026-07-31）------------------------------------
//
// Map の colorPrefByType と同じ形。0 のキーは持たない（＝未指定と同じ）ので、
// 使っていない条件のキーは従来とバイト不変。

/** 優遇/冷遇を付けられる母星色。基本7色＋LFの原始・小惑星。 */
export const COLOR_PREF_KEYS = [
  "BLACK",
  "BLUE",
  "BROWN",
  "ORANGE",
  "RED",
  "WHITE",
  "YELLOW",
  "PROTO",
  "ASTEROID",
] as const;
export type ColorPrefKey = (typeof COLOR_PREF_KEYS)[number];
export type ColorPrefByColor = Partial<Record<ColorPrefKey, number>>;

/** 入力範囲。Map の色優遇と同じ目盛り（1=互角 / 2=主導 / 5=ほぼ全て）。 */
export const COLOR_PREF_MIN = -20;
export const COLOR_PREF_MAX = 20;

export const LS_SETUP_COLOR_PREF = "gaia_setup_color_pref";

/** 0・非数値・範囲外を落として正規化する（0 はキーごと落とす）。 */
export function sanitizeColorPref(raw: unknown): ColorPrefByColor {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out: ColorPrefByColor = {};
  for (const k of COLOR_PREF_KEYS) {
    const n = Number(src[k]);
    if (!Number.isFinite(n) || n === 0) continue;
    out[k] = Math.max(COLOR_PREF_MIN, Math.min(COLOR_PREF_MAX, n));
  }
  return out;
}

export function readColorPref(): ColorPrefByColor {
  try {
    const raw = localStorage.getItem(LS_SETUP_COLOR_PREF);
    if (!raw) return {};
    return sanitizeColorPref(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function writeColorPref(p: ColorPrefByColor): void {
  try {
    const clean = sanitizeColorPref(p);
    if (Object.keys(clean).length === 0) localStorage.removeItem(LS_SETUP_COLOR_PREF);
    else localStorage.setItem(LS_SETUP_COLOR_PREF, JSON.stringify(clean));
  } catch {
    // ignore
  }
}

// --- 種族優遇/冷遇（List 専用。2026-07-31）------------------------------------
//
// List は色ではなく種族ごとに ± を付ける（ユーザー確定）。掛け先は
// 「Map の評価値（母星色ぶん）＋ Setup の評価値」。色優遇と同じく 0 は持たない。

export type FactionPrefByFaction = Record<string, number>;
export const LS_LIST_FACTION_PREF = "gaia_list_faction_pref";

export function sanitizeFactionPref(raw: unknown): FactionPrefByFaction {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out: FactionPrefByFaction = {};
  for (const [k, v] of Object.entries(src)) {
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0) continue;
    out[k] = Math.max(COLOR_PREF_MIN, Math.min(COLOR_PREF_MAX, n));
  }
  return out;
}

export function readFactionPref(): FactionPrefByFaction {
  try {
    const raw = localStorage.getItem(LS_LIST_FACTION_PREF);
    if (!raw) return {};
    return sanitizeFactionPref(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function writeFactionPref(p: FactionPrefByFaction): void {
  try {
    const clean = sanitizeFactionPref(p);
    if (Object.keys(clean).length === 0) localStorage.removeItem(LS_LIST_FACTION_PREF);
    else localStorage.setItem(LS_LIST_FACTION_PREF, JSON.stringify(clean));
  } catch {
    // ignore
  }
}
