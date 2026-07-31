// src/gaia/eval/setupWeights.ts
//
// セットアップ評価の「評価指数」（カテゴリ別係数）。2026-07-30。
// Map の評価指数（軸ごとの重み）に対応する Setup/List 側の入力で、
// 種族スコアをカテゴリ単位でスケールする純データ。
//
// 既定値は導入前の計算と完全に一致させてある（stdTrack=0.5 / stdFree=0.25 は
// これまで factionWeights.ts の定数だった値、他は 1.0＝素通し）。したがって
// 未設定のユーザーのスコア・提案結果は変わらない。

import { STD_TECH_FREE_SCALE, STD_TECH_TRACK_SCALE } from "./factionWeights";

/**
 * 係数のカテゴリ。タイルの出どころで分けてある:
 * - advanced      上級技術（研究トラック下の6枚）
 * - advExtension  得点ボード拡張部の追加上級技術（取得条件が通常の上級と違うため別枠。
 *                 2026-07-30 ユーザー要望）
 * - booster       ラウンドブースター（使用分のみ）
 * - roundScoring  ラウンド得点（×2タイルは枚数分入る）
 * - finalScoring  最終得点計算
 * - federation    同盟タイル（惑星改造 研究レベル5）
 * - stdTrack      標準技術のうちトラック下の6枚（TECH_TRACK_WEIGHTS 経由）
 * - stdFree       標準技術のうちフリー枠3枚（TECH_PREF 経由）
 * - lfShip        LFの船関連（船の基本技術・金枠同盟・アーティファクト）
 */
export const SETUP_WEIGHT_KEYS = [
  "advanced",
  "advExtension",
  "booster",
  "roundScoring",
  "finalScoring",
  "federation",
  "stdTrack",
  "stdFree",
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
  "stdTrack",
  "stdFree",
  "lfShip",
  "roundScoring",
  "booster",
];

/**
 * 既定値。基準は 100（2026-07-31 に 1 から変更）。
 * タイルの重みはすべて整数なので、係数を100倍にすると評価値から小数が消える。
 * 比率は変えていないのでカテゴリどうしの効き具合は従来と同じ。
 */
export const SETUP_WEIGHT_BASE = 100;
export const DEFAULT_SETUP_WEIGHTS: SetupWeights = {
  advanced: SETUP_WEIGHT_BASE,
  advExtension: SETUP_WEIGHT_BASE,
  booster: SETUP_WEIGHT_BASE,
  roundScoring: SETUP_WEIGHT_BASE,
  finalScoring: SETUP_WEIGHT_BASE,
  federation: SETUP_WEIGHT_BASE,
  stdTrack: STD_TECH_TRACK_SCALE,
  stdFree: STD_TECH_FREE_SCALE,
  lfShip: SETUP_WEIGHT_BASE,
};

/** 評価指数の入力範囲（基準100に合わせて -900..900）。 */
export const SETUP_WEIGHT_MIN = -900;
export const SETUP_WEIGHT_MAX = 900;
/** 入力欄の刻み。旧 0.25 相当（基準の 1/4）。 */
export const SETUP_WEIGHT_STEP = 25;

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
