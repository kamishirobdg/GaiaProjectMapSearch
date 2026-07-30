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
 * - advanced      上級技術（研究トラック6枚＋LFの追加上級）
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

/** 既定値＝評価指数の導入前と同じ計算になる係数。 */
export const DEFAULT_SETUP_WEIGHTS: SetupWeights = {
  advanced: 1,
  booster: 1,
  roundScoring: 1,
  finalScoring: 1,
  federation: 1,
  stdTrack: STD_TECH_TRACK_SCALE,
  stdFree: STD_TECH_FREE_SCALE,
  lfShip: 1,
};

/** LF でしか効かないカテゴリ（基本版では入力欄を出さない）。 */
export const LF_ONLY_WEIGHT_KEYS: ReadonlySet<SetupWeightKey> = new Set<SetupWeightKey>(["lfShip"]);

export function isDefaultWeights(w: SetupWeights): boolean {
  return SETUP_WEIGHT_KEYS.every((k) => w[k] === DEFAULT_SETUP_WEIGHTS[k]);
}

/**
 * 任意の入力（localStorage の JSON など）を係数へ正規化する。
 * 数値でないキー・非有限値は既定値へフォールバックし、-9..9 にクランプする。
 */
export function sanitizeSetupWeights(raw: unknown): SetupWeights {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out = {} as SetupWeights;
  for (const k of SETUP_WEIGHT_KEYS) {
    const n = Number(src[k]);
    out[k] = Number.isFinite(n) ? Math.max(-9, Math.min(9, n)) : DEFAULT_SETUP_WEIGHTS[k];
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
