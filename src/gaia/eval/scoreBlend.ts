// src/gaia/eval/scoreBlend.ts
//
// Map と Setup の合算比（2026-09-19、案C）。
//
// 種族別総合評価（Total タブ）の合計列は「Map の評価値 × map ＋ Setup の評価値 × setup」。
// List の種族優遇の掛け先（factionPrefBonus）と「合計の上位」の表示も同じ比を使う。
// 既定は 1:1。どちらを重く見るのが妥当かは実データで試しながら決める
// （TODO.md「Map と Setup のバランス」）。
//
// 保存は localStorage 1キー。「既定と違うフィールドだけ」を書き、全部既定ならキーごと
// 消す（互換の鉄則の無効時フィールド省略）。書き込みはユーザー操作のハンドラだけ。

export type ScoreBlend = { map: number; setup: number };
export type ScoreBlendKey = keyof ScoreBlend;

export const DEFAULT_SCORE_BLEND: Readonly<ScoreBlend> = { map: 1, setup: 1 };
export const SCORE_BLEND_MIN = 0;
export const SCORE_BLEND_MAX = 5;
export const SCORE_BLEND_STEP = 0.1;
export const LS_SCORE_BLEND = "gaia_score_blend";

/** 1つの倍率を範囲に収めて小数2桁へ丸める（number 入力の 1.2000000000000002 対策）。 */
export function clampBlendValue(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.max(SCORE_BLEND_MIN, Math.min(SCORE_BLEND_MAX, n)) * 100) / 100;
}

/** localStorage から読んだ生の値を安全な形へ（欠けたフィールドは既定）。 */
export function sanitizeScoreBlend(raw: unknown): ScoreBlend {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    map: clampBlendValue(o.map, DEFAULT_SCORE_BLEND.map),
    setup: clampBlendValue(o.setup, DEFAULT_SCORE_BLEND.setup),
  };
}

export function isDefaultScoreBlend(b: ScoreBlend): boolean {
  return b.map === DEFAULT_SCORE_BLEND.map && b.setup === DEFAULT_SCORE_BLEND.setup;
}

/** 合算。blend 省略時は 1:1（＝従来どおりの単純な足し算）。 */
export function blendScores(map: number, setup: number, blend?: ScoreBlend): number {
  const b = blend ?? DEFAULT_SCORE_BLEND;
  return b.map * map + b.setup * setup;
}

/** 表示用 "1 : 1.5"。 */
export function formatScoreBlend(b: ScoreBlend): string {
  return `${b.map} : ${b.setup}`;
}

/** 既定と違うフィールドだけ JSON にする（全部既定なら null＝キー削除）。 */
export function serializeScoreBlend(b: ScoreBlend): string | null {
  const diff = {
    ...(b.map !== DEFAULT_SCORE_BLEND.map ? { map: b.map } : {}),
    ...(b.setup !== DEFAULT_SCORE_BLEND.setup ? { setup: b.setup } : {}),
  };
  return Object.keys(diff).length === 0 ? null : JSON.stringify(diff);
}

export function readScoreBlend(): ScoreBlend {
  try {
    const raw = localStorage.getItem(LS_SCORE_BLEND);
    if (!raw) return { ...DEFAULT_SCORE_BLEND };
    return sanitizeScoreBlend(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SCORE_BLEND };
  }
}

export function writeScoreBlend(b: ScoreBlend): void {
  try {
    const s = serializeScoreBlend(b);
    if (s === null) localStorage.removeItem(LS_SCORE_BLEND);
    else localStorage.setItem(LS_SCORE_BLEND, s);
  } catch {
    // ignore
  }
}
