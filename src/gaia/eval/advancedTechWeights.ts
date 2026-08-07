// src/gaia/eval/advancedTechWeights.ts
//
// 上級技術の重みテーブル（タイル → 研究列 → 種族 → 値）。**自動生成ファイル**:
//   python scripts/gen_advanced_tech_table.py --emit-file <このパス> <base.csv> <lf.csv>
// 手で直さず、CSV を直して生成し直すこと（検算は `<csv> --check`）。
// 中身が大きい（合計3528セル）ので factionWeights.ts とは別ファイルにしてある。
//
// 値は **VP 換算**（2026-08-03 ユーザー確定）。「その上級技術を適切なタイミングで
// 取れたら何点分の価値があるか」で、20〜30 程度が上限、0 はほぼ無く 5 以下も稀。
// 研究列ごとに値が違うのは「その列に置かれたタイルをその種族が取りに行けるか」を
// 織り込むため —— 上級技術はその列をレベル4まで上げないと取れないので、
// 登らない列に置かれた1枚は事実上取れない。
//
// 拡張版だけ、6つの研究列に加えて **vp25 / shuttle**（得点ボード拡張部の面。
// 2026-08-08 追加）を持つ。拡張部の7枚目は研究列に紐付かないので、代わりに
// 面（2人=25VP面固定／3・4人=探査シャトル面）ごとの価値を入れる。
//
// 通常版 15タイル×6列×14種族＝1260セル / 拡張版 21×8軸×18種族＝3024セル。
// 拡張の有無で場に出るタイルの母集団が変わるので、標準技術と同じく表を分ける。

import type { ResearchTrackId } from "@/gaia/setup/types";
import type { FactionId } from "./factionWeights";

/** 拡張部の面。2人=25VP面固定／3・4人=探査シャトル面（ランダム選択も可）。 */
export type ExtensionFace = "vp25" | "shuttle";

export type AdvancedTechTable = Record<
  string,
  Partial<Record<ResearchTrackId | ExtensionFace, Partial<Record<FactionId, number>>>>
>;

/** ★通常版（基本14種族×15枚）。CSV から生成。 */
export const ADVANCED_TECH_WEIGHTS_BASE: AdvancedTechTable = {
  // AT04 取得時：鉱山×2VP
  AT04: {
    terra: { terrans: 8, lantids: 12, xenos: 16, gleens: 12, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 12, geodens: 16, balTaks: 12, firaks: 16, bescods: 12, nevlas: 16, itars: 12 }, // 惑星改造
    nav:   { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 9, geodens: 16, firaks: 16, bescods: 16, nevlas: 16, itars: 16 }, // 航行
    ai:    { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 12, geodens: 16, balTaks: 16, firaks: 16, bescods: 16, nevlas: 16, itars: 16 }, // 人工知能
    gaia:  { terrans: 16, lantids: 8, xenos: 12, gleens: 16, taklons: 4, ambas: 12, hadschHallas: 8, ivits: 12, geodens: 8, balTaks: 16, firaks: 8, bescods: 16, nevlas: 4, itars: 16 }, // ガイア計画
    eco:   { terrans: 12, lantids: 16, xenos: 16, gleens: 12, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 12, geodens: 16, balTaks: 16, firaks: 16, bescods: 16, nevlas: 16, itars: 16 }, // 経済
    sci:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 9, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 科学
  },
  // AT06 取得時：宙域×鉱石1
  AT06: {
    terra: { terrans: 5, lantids: 8, xenos: 10, gleens: 4, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 4, geodens: 8, balTaks: 3, firaks: 8, bescods: 8, nevlas: 8, itars: 6 }, // 惑星改造
    nav:   { terrans: 10, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 3, geodens: 8, firaks: 8, bescods: 10, nevlas: 8, itars: 8 }, // 航行
    ai:    { terrans: 10, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 4, geodens: 8, balTaks: 6, firaks: 8, bescods: 10, nevlas: 8, itars: 8 }, // 人工知能
    gaia:  { terrans: 10, lantids: 5, xenos: 8, gleens: 8, taklons: 3, ambas: 8, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 6, firaks: 4, bescods: 10, nevlas: 2, itars: 8 }, // ガイア計画
    eco:   { terrans: 8, lantids: 10, xenos: 10, gleens: 6, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 4, geodens: 8, balTaks: 6, firaks: 8, bescods: 10, nevlas: 8, itars: 8 }, // 経済
    sci:   { terrans: 5, lantids: 8, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 4, ivits: 2, geodens: 6, balTaks: 3, firaks: 8, bescods: 8, nevlas: 6, itars: 8 }, // 科学
  },
  // AT08 取得時：ガイア惑星×2VP
  AT08: {
    terra: { terrans: 15, lantids: 8, xenos: 8, gleens: 15, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 12, geodens: 8, balTaks: 9, firaks: 8, bescods: 8, nevlas: 8, itars: 16 }, // 惑星改造
    nav:   { terrans: 20, lantids: 10, xenos: 10, gleens: 20, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 12, geodens: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 16 }, // 航行
    ai:    { terrans: 20, lantids: 10, xenos: 10, gleens: 20, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 12, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 16 }, // 人工知能
    gaia:  { terrans: 20, lantids: 10, xenos: 10, gleens: 20, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 16, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 16 }, // ガイア計画
    eco:   { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 12, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 16 }, // 経済
    sci:   { terrans: 15, lantids: 8, xenos: 5, gleens: 15, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 8, geodens: 8, balTaks: 6, firaks: 10, bescods: 8, nevlas: 8, itars: 16 }, // 科学
  },
  // AT09 取得時：交易所×4VP
  AT09: {
    terra: { terrans: 12, lantids: 12, xenos: 16, gleens: 12, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 12, firaks: 16, bescods: 12, nevlas: 16, itars: 16 }, // 惑星改造
    nav:   { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 12, geodens: 16, firaks: 16, bescods: 16, nevlas: 16, itars: 16 }, // 航行
    ai:    { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 16, firaks: 16, bescods: 16, nevlas: 16, itars: 16 }, // 人工知能
    gaia:  { terrans: 16, lantids: 8, xenos: 12, gleens: 16, taklons: 4, ambas: 12, hadschHallas: 8, ivits: 16, geodens: 8, balTaks: 16, firaks: 8, bescods: 16, nevlas: 4, itars: 16 }, // ガイア計画
    eco:   { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 16, firaks: 16, bescods: 16, nevlas: 16, itars: 16 }, // 経済
    sci:   { terrans: 8, lantids: 12, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 12, balTaks: 8, firaks: 16, bescods: 12, nevlas: 12, itars: 16 }, // 科学
  },
  // AT10 取得時：宙域×2VP
  AT10: {
    terra: { terrans: 8, lantids: 15, xenos: 20, gleens: 10, taklons: 20, ambas: 20, hadschHallas: 16, ivits: 12, geodens: 14, balTaks: 7, firaks: 14, bescods: 15, nevlas: 20, itars: 15 }, // 惑星改造
    nav:   { terrans: 16, lantids: 20, xenos: 20, gleens: 20, taklons: 20, ambas: 20, hadschHallas: 16, ivits: 12, geodens: 14, firaks: 14, bescods: 20, nevlas: 20, itars: 20 }, // 航行
    ai:    { terrans: 16, lantids: 20, xenos: 20, gleens: 20, taklons: 20, ambas: 20, hadschHallas: 16, ivits: 12, geodens: 14, balTaks: 14, firaks: 14, bescods: 20, nevlas: 20, itars: 20 }, // 人工知能
    gaia:  { terrans: 16, lantids: 10, xenos: 15, gleens: 20, taklons: 5, ambas: 15, hadschHallas: 8, ivits: 12, geodens: 7, balTaks: 14, firaks: 7, bescods: 20, nevlas: 5, itars: 20 }, // ガイア計画
    eco:   { terrans: 12, lantids: 20, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 16, ivits: 12, geodens: 14, balTaks: 14, firaks: 14, bescods: 20, nevlas: 20, itars: 20 }, // 経済
    sci:   { terrans: 8, lantids: 15, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 6, geodens: 11, balTaks: 7, firaks: 14, bescods: 15, nevlas: 15, itars: 20 }, // 科学
  },
  // AT12 取得時：同盟タイル×5VP
  AT12: {
    terra: { terrans: 20, lantids: 25, xenos: 25, gleens: 25, taklons: 20, ambas: 25, hadschHallas: 20, ivits: 25, geodens: 20, balTaks: 20, firaks: 20, bescods: 25, nevlas: 20, itars: 20 }, // 惑星改造
    nav:   { terrans: 20, lantids: 25, xenos: 25, gleens: 25, taklons: 20, ambas: 25, hadschHallas: 20, ivits: 19, geodens: 20, firaks: 20, bescods: 25, nevlas: 20, itars: 20 }, // 航行
    ai:    { terrans: 20, lantids: 25, xenos: 25, gleens: 25, taklons: 20, ambas: 25, hadschHallas: 20, ivits: 25, geodens: 20, balTaks: 20, firaks: 20, bescods: 25, nevlas: 20, itars: 20 }, // 人工知能
    gaia:  { terrans: 20, lantids: 13, xenos: 19, gleens: 25, taklons: 5, ambas: 19, hadschHallas: 10, ivits: 25, geodens: 10, balTaks: 20, firaks: 10, bescods: 25, nevlas: 5, itars: 20 }, // ガイア計画
    eco:   { terrans: 15, lantids: 25, xenos: 25, gleens: 19, taklons: 20, ambas: 25, hadschHallas: 20, ivits: 25, geodens: 20, balTaks: 20, firaks: 20, bescods: 25, nevlas: 20, itars: 20 }, // 経済
    sci:   { terrans: 10, lantids: 19, xenos: 13, gleens: 13, taklons: 10, ambas: 13, hadschHallas: 10, ivits: 13, geodens: 15, balTaks: 10, firaks: 20, bescods: 19, nevlas: 15, itars: 20 }, // 科学
  },
  // AT03 アクション：QIC1＋クレジット5
  AT03: {
    terra: { terrans: 17, lantids: 23, xenos: 32, gleens: 13, taklons: 38, ambas: 32, hadschHallas: 47, ivits: 38, geodens: 32, balTaks: 19, firaks: 32, bescods: 23, nevlas: 32, itars: 23 }, // 惑星改造
    nav:   { terrans: 32, lantids: 32, xenos: 32, gleens: 26, taklons: 38, ambas: 32, hadschHallas: 47, ivits: 30, geodens: 32, balTaks: 1, firaks: 32, bescods: 32, nevlas: 32, itars: 32 }, // 航行
    ai:    { terrans: 32, lantids: 32, xenos: 32, gleens: 26, taklons: 38, ambas: 32, hadschHallas: 47, ivits: 38, geodens: 32, balTaks: 38, firaks: 32, bescods: 32, nevlas: 32, itars: 32 }, // 人工知能
    gaia:  { terrans: 32, lantids: 17, xenos: 23, gleens: 26, taklons: 11, ambas: 23, hadschHallas: 23, ivits: 38, geodens: 17, balTaks: 38, firaks: 17, bescods: 32, nevlas: 9, itars: 32 }, // ガイア計画
    eco:   { terrans: 23, lantids: 32, xenos: 32, gleens: 19, taklons: 38, ambas: 32, hadschHallas: 47, ivits: 38, geodens: 32, balTaks: 38, firaks: 32, bescods: 32, nevlas: 32, itars: 32 }, // 経済
    sci:   { terrans: 17, lantids: 23, xenos: 17, gleens: 13, taklons: 19, ambas: 17, hadschHallas: 23, ivits: 19, geodens: 23, balTaks: 19, firaks: 32, bescods: 23, nevlas: 23, itars: 32 }, // 科学
  },
  // AT07 アクション：鉱石3
  AT07: {
    terra: { terrans: 15, lantids: 22, xenos: 28, gleens: 17, taklons: 28, ambas: 28, hadschHallas: 28, ivits: 28, geodens: 34, balTaks: 15, firaks: 28, bescods: 22, nevlas: 28, itars: 22 }, // 惑星改造
    nav:   { terrans: 28, lantids: 28, xenos: 28, gleens: 34, taklons: 28, ambas: 28, hadschHallas: 28, ivits: 22, geodens: 34, balTaks: 1, firaks: 28, bescods: 28, nevlas: 28, itars: 28 }, // 航行
    ai:    { terrans: 28, lantids: 28, xenos: 28, gleens: 34, taklons: 28, ambas: 28, hadschHallas: 28, ivits: 28, geodens: 34, balTaks: 28, firaks: 28, bescods: 28, nevlas: 28, itars: 28 }, // 人工知能
    gaia:  { terrans: 28, lantids: 15, xenos: 22, gleens: 34, taklons: 6, ambas: 22, hadschHallas: 15, ivits: 28, geodens: 17, balTaks: 28, firaks: 15, bescods: 28, nevlas: 6, itars: 28 }, // ガイア計画
    eco:   { terrans: 22, lantids: 28, xenos: 28, gleens: 26, taklons: 28, ambas: 28, hadschHallas: 28, ivits: 28, geodens: 34, balTaks: 28, firaks: 28, bescods: 28, nevlas: 28, itars: 28 }, // 経済
    sci:   { terrans: 15, lantids: 22, xenos: 15, gleens: 17, taklons: 15, ambas: 15, hadschHallas: 15, ivits: 15, geodens: 26, balTaks: 15, firaks: 28, bescods: 22, nevlas: 22, itars: 28 }, // 科学
  },
  // AT13 アクション：知識3
  AT13: {
    terra: { terrans: 11, lantids: 21, xenos: 22, gleens: 11, taklons: 22, ambas: 22, hadschHallas: 22, ivits: 22, geodens: 22, balTaks: 11, firaks: 27, bescods: 21, nevlas: 27, itars: 17 }, // 惑星改造
    nav:   { terrans: 22, lantids: 27, xenos: 22, gleens: 22, taklons: 22, ambas: 22, hadschHallas: 22, ivits: 17, geodens: 22, balTaks: 1, firaks: 27, bescods: 27, nevlas: 27, itars: 22 }, // 航行
    ai:    { terrans: 22, lantids: 27, xenos: 22, gleens: 22, taklons: 22, ambas: 22, hadschHallas: 22, ivits: 22, geodens: 22, balTaks: 22, firaks: 27, bescods: 27, nevlas: 27, itars: 22 }, // 人工知能
    gaia:  { terrans: 22, lantids: 13, xenos: 17, gleens: 22, taklons: 6, ambas: 17, hadschHallas: 11, ivits: 22, geodens: 11, balTaks: 22, firaks: 13, bescods: 27, nevlas: 7, itars: 22 }, // ガイア計画
    eco:   { terrans: 17, lantids: 27, xenos: 22, gleens: 17, taklons: 22, ambas: 22, hadschHallas: 22, ivits: 22, geodens: 22, balTaks: 22, firaks: 27, bescods: 27, nevlas: 27, itars: 22 }, // 経済
    sci:   { terrans: 11, lantids: 21, xenos: 11, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 17, balTaks: 11, firaks: 27, bescods: 21, nevlas: 21, itars: 22 }, // 科学
  },
  // AT01 パス時：同盟タイル×3VP
  AT01: {
    terra: { terrans: 11, lantids: 16, xenos: 30, gleens: 14, taklons: 21, ambas: 30, hadschHallas: 21, ivits: 36, geodens: 27, balTaks: 11, firaks: 30, bescods: 20, nevlas: 21, itars: 23 }, // 惑星改造
    nav:   { terrans: 21, lantids: 21, xenos: 30, gleens: 27, taklons: 21, ambas: 30, hadschHallas: 21, ivits: 27, geodens: 27, firaks: 30, bescods: 27, nevlas: 21, itars: 30 }, // 航行
    ai:    { terrans: 21, lantids: 21, xenos: 30, gleens: 27, taklons: 21, ambas: 30, hadschHallas: 21, ivits: 36, geodens: 27, balTaks: 21, firaks: 30, bescods: 27, nevlas: 21, itars: 30 }, // 人工知能
    gaia:  { terrans: 21, lantids: 11, xenos: 23, gleens: 27, taklons: 5, ambas: 23, hadschHallas: 11, ivits: 36, geodens: 14, balTaks: 21, firaks: 15, bescods: 27, nevlas: 5, itars: 30 }, // ガイア計画
    eco:   { terrans: 16, lantids: 21, xenos: 30, gleens: 20, taklons: 21, ambas: 30, hadschHallas: 21, ivits: 36, geodens: 27, balTaks: 21, firaks: 30, bescods: 27, nevlas: 21, itars: 30 }, // 経済
    sci:   { terrans: 11, lantids: 16, xenos: 15, gleens: 14, taklons: 11, ambas: 15, hadschHallas: 11, ivits: 18, geodens: 20, balTaks: 11, firaks: 30, bescods: 20, nevlas: 16, itars: 30 }, // 科学
  },
  // AT05 パス時：研究所×3VP
  AT05: {
    terra: { terrans: 12, lantids: 18, xenos: 24, gleens: 9, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 12, firaks: 24, bescods: 25, nevlas: 24, itars: 18 }, // 惑星改造
    nav:   { terrans: 18, lantids: 18, xenos: 18, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 18, firaks: 18, bescods: 25, nevlas: 18, itars: 18 }, // 航行
    ai:    { terrans: 24, lantids: 24, xenos: 24, gleens: 18, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 24, bescods: 33, nevlas: 24, itars: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 12, xenos: 18, gleens: 18, taklons: 6, ambas: 18, hadschHallas: 12, ivits: 24, geodens: 12, balTaks: 24, firaks: 12, bescods: 33, nevlas: 6, itars: 24 }, // ガイア計画
    eco:   { terrans: 18, lantids: 24, xenos: 24, gleens: 14, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 24, bescods: 33, nevlas: 24, itars: 24 }, // 経済
    sci:   { terrans: 24, lantids: 24, xenos: 24, gleens: 18, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 24, bescods: 33, nevlas: 24, itars: 24 }, // 科学
  },
  // AT15 パス時：惑星種類×1VP
  AT15: {
    terra: { terrans: 9, lantids: 18, xenos: 18, gleens: 14, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 26, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 14 }, // 惑星改造
    nav:   { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 13, firaks: 9, bescods: 9, nevlas: 9, itars: 9 }, // 航行
    ai:    { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 13, balTaks: 9, firaks: 9, bescods: 9, nevlas: 9, itars: 9 }, // 人工知能
    gaia:  { terrans: 14, lantids: 9, xenos: 9, gleens: 14, taklons: 5, ambas: 9, hadschHallas: 9, ivits: 14, geodens: 13, balTaks: 14, firaks: 9, bescods: 9, nevlas: 5, itars: 9 }, // ガイア計画
    eco:   { terrans: 9, lantids: 14, xenos: 14, gleens: 14, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 20, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14 }, // 経済
    sci:   { terrans: 9, lantids: 14, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 20, balTaks: 9, firaks: 14, bescods: 14, nevlas: 14, itars: 14 }, // 科学
  },
  // AT02 研究を進めるたび＋2VP
  AT02: {
    terra: { terrans: 6, lantids: 11, xenos: 12, gleens: 5, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 6, firaks: 18, bescods: 14, nevlas: 15, itars: 14 }, // 惑星改造
    nav:   { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 9, geodens: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18 }, // 航行
    ai:    { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18 }, // 人工知能
    gaia:  { terrans: 12, lantids: 8, xenos: 9, gleens: 9, taklons: 3, ambas: 9, hadschHallas: 6, ivits: 12, geodens: 6, balTaks: 12, firaks: 9, bescods: 18, nevlas: 4, itars: 18 }, // ガイア計画
    eco:   { terrans: 9, lantids: 15, xenos: 12, gleens: 7, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18 }, // 経済
    sci:   { terrans: 6, lantids: 11, xenos: 6, gleens: 5, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 9, balTaks: 6, firaks: 18, bescods: 14, nevlas: 11, itars: 18 }, // 科学
  },
  // AT11 交易所を建設するたび＋3VP
  AT11: {
    terra: { terrans: 5, lantids: 7, xenos: 9, gleens: 5, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 5, firaks: 14, bescods: 7, nevlas: 11, itars: 7 }, // 惑星改造
    nav:   { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 7, geodens: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9 }, // 航行
    ai:    { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9 }, // 人工知能
    gaia:  { terrans: 9, lantids: 5, xenos: 7, gleens: 9, taklons: 2, ambas: 7, hadschHallas: 6, ivits: 9, geodens: 5, balTaks: 9, firaks: 7, bescods: 9, nevlas: 3, itars: 9 }, // ガイア計画
    eco:   { terrans: 7, lantids: 9, xenos: 9, gleens: 7, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9 }, // 経済
    sci:   { terrans: 5, lantids: 7, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 7, balTaks: 5, firaks: 14, bescods: 7, nevlas: 8, itars: 9 }, // 科学
  },
  // AT14 鉱山を建設するたび＋3VP
  AT14: {
    terra: { terrans: 6, lantids: 12, xenos: 14, gleens: 6, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 6, firaks: 11, bescods: 8, nevlas: 11, itars: 8 }, // 惑星改造
    nav:   { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 8, geodens: 14, firaks: 11, bescods: 11, nevlas: 11, itars: 11 }, // 航行
    ai:    { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11 }, // 人工知能
    gaia:  { terrans: 11, lantids: 8, xenos: 11, gleens: 11, taklons: 3, ambas: 8, hadschHallas: 6, ivits: 11, geodens: 7, balTaks: 11, firaks: 6, bescods: 11, nevlas: 3, itars: 11 }, // ガイア計画
    eco:   { terrans: 8, lantids: 16, xenos: 14, gleens: 8, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11 }, // 経済
    sci:   { terrans: 6, lantids: 12, xenos: 7, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 11, balTaks: 6, firaks: 11, bescods: 8, nevlas: 8, itars: 11 }, // 科学
  },
};

/** ★拡張版（18種族×21枚）。CSV から生成。 */
export const ADVANCED_TECH_WEIGHTS_LF: AdvancedTechTable = {
  // AT04 取得時：鉱山×2VP
  AT04: {
    terra: { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 18, darkanians: 23 }, // 惑星改造
    nav:   { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 18, darkanians: 23 }, // 航行
    ai:    { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 18, darkanians: 23 }, // 人工知能
    gaia:  { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 18, darkanians: 23 }, // ガイア計画
    eco:   { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 18, darkanians: 23 }, // 経済
    sci:   { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 18, darkanians: 23 }, // 科学
    vp25:  { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 18, darkanians: 23 }, // 拡張部:25VP面
    shuttle: { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 18, darkanians: 23 }, // 拡張部:シャトル面
  },
  // AT06 取得時：宙域×鉱石1
  AT06: {
    terra: { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 惑星改造
    nav:   { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 航行
    ai:    { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 人工知能
    gaia:  { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // ガイア計画
    eco:   { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 経済
    sci:   { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 科学
    vp25:  { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 拡張部:25VP面
    shuttle: { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 拡張部:シャトル面
  },
  // AT08 取得時：ガイア惑星×2VP
  AT08: {
    terra: { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 13, firaks: 10, bescods: 10, nevlas: 10, itars: 15, moweyds: 10, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 惑星改造
    nav:   { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 15, moweyds: 10, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 航行
    ai:    { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 13, firaks: 10, bescods: 10, nevlas: 10, itars: 15, moweyds: 10, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 人工知能
    gaia:  { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 13, firaks: 10, bescods: 10, nevlas: 10, itars: 15, moweyds: 10, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // ガイア計画
    eco:   { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 13, firaks: 10, bescods: 10, nevlas: 10, itars: 15, moweyds: 10, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 経済
    sci:   { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 13, firaks: 10, bescods: 10, nevlas: 10, itars: 15, moweyds: 10, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 科学
    vp25:  { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 13, firaks: 10, bescods: 10, nevlas: 10, itars: 15, moweyds: 10, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 拡張部:25VP面
    shuttle: { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 13, firaks: 10, bescods: 10, nevlas: 10, itars: 15, moweyds: 10, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 拡張部:シャトル面
  },
  // AT09 取得時：交易所×4VP
  AT09: {
    terra: { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // 惑星改造
    nav:   { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // 航行
    ai:    { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // 人工知能
    gaia:  { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // ガイア計画
    eco:   { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // 経済
    sci:   { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // 科学
    vp25:  { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // 拡張部:25VP面
    shuttle: { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // 拡張部:シャトル面
  },
  // AT10 取得時：宙域×2VP
  AT10: {
    terra: { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 9, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 惑星改造
    nav:   { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 航行
    ai:    { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 9, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 人工知能
    gaia:  { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 9, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // ガイア計画
    eco:   { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 9, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 経済
    sci:   { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 9, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 科学
    vp25:  { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 9, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 拡張部:25VP面
    shuttle: { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 9, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 拡張部:シャトル面
  },
  // AT12 取得時：同盟タイル×5VP
  AT12: {
    terra: { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 22, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // 惑星改造
    nav:   { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 22, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // 航行
    ai:    { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 22, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // 人工知能
    gaia:  { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 22, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // ガイア計画
    eco:   { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 22, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // 経済
    sci:   { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 22, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // 科学
    vp25:  { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 22, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // 拡張部:25VP面
    shuttle: { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 22, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // 拡張部:シャトル面
  },
  // AT03 アクション：QIC1＋クレジット5
  AT03: {
    terra: { terrans: 32, lantids: 32, xenos: 32, gleens: 26, taklons: 38, ambas: 32, hadschHallas: 47, ivits: 38, geodens: 32, balTaks: 38, firaks: 32, bescods: 32, nevlas: 32, itars: 32, moweyds: 32, spaceGiants: 32, tinkerroids: 32, darkanians: 32 }, // 惑星改造
    nav:   { terrans: 32, lantids: 32, xenos: 32, gleens: 26, taklons: 38, ambas: 32, hadschHallas: 47, ivits: 38, geodens: 32, balTaks: 1, firaks: 32, bescods: 32, nevlas: 32, itars: 32, moweyds: 32, spaceGiants: 32, tinkerroids: 32, darkanians: 32 }, // 航行
    ai:    { terrans: 32, lantids: 32, xenos: 32, gleens: 26, taklons: 38, ambas: 32, hadschHallas: 47, ivits: 38, geodens: 32, balTaks: 38, firaks: 32, bescods: 32, nevlas: 32, itars: 32, moweyds: 32, spaceGiants: 32, tinkerroids: 32, darkanians: 32 }, // 人工知能
    gaia:  { terrans: 32, lantids: 32, xenos: 32, gleens: 26, taklons: 38, ambas: 32, hadschHallas: 47, ivits: 38, geodens: 32, balTaks: 38, firaks: 32, bescods: 32, nevlas: 32, itars: 32, moweyds: 32, spaceGiants: 32, tinkerroids: 32, darkanians: 32 }, // ガイア計画
    eco:   { terrans: 32, lantids: 32, xenos: 32, gleens: 26, taklons: 38, ambas: 32, hadschHallas: 47, ivits: 38, geodens: 32, balTaks: 38, firaks: 32, bescods: 32, nevlas: 32, itars: 32, moweyds: 32, spaceGiants: 32, tinkerroids: 32, darkanians: 32 }, // 経済
    sci:   { terrans: 32, lantids: 32, xenos: 32, gleens: 26, taklons: 38, ambas: 32, hadschHallas: 47, ivits: 38, geodens: 32, balTaks: 38, firaks: 32, bescods: 32, nevlas: 32, itars: 32, moweyds: 32, spaceGiants: 32, tinkerroids: 32, darkanians: 32 }, // 科学
    vp25:  { terrans: 32, lantids: 32, xenos: 32, gleens: 26, taklons: 38, ambas: 32, hadschHallas: 47, ivits: 38, geodens: 32, balTaks: 38, firaks: 32, bescods: 32, nevlas: 32, itars: 32, moweyds: 32, spaceGiants: 32, tinkerroids: 32, darkanians: 32 }, // 拡張部:25VP面
    shuttle: { terrans: 32, lantids: 32, xenos: 32, gleens: 26, taklons: 38, ambas: 32, hadschHallas: 47, ivits: 38, geodens: 32, balTaks: 38, firaks: 32, bescods: 32, nevlas: 32, itars: 32, moweyds: 32, spaceGiants: 32, tinkerroids: 32, darkanians: 32 }, // 拡張部:シャトル面
  },
  // AT07 アクション：鉱石3
  AT07: {
    terra: { terrans: 28, lantids: 28, xenos: 28, gleens: 34, taklons: 28, ambas: 28, hadschHallas: 28, ivits: 28, geodens: 34, balTaks: 28, firaks: 28, bescods: 28, nevlas: 28, itars: 28, moweyds: 28, spaceGiants: 43, tinkerroids: 34, darkanians: 28 }, // 惑星改造
    nav:   { terrans: 28, lantids: 28, xenos: 28, gleens: 34, taklons: 28, ambas: 28, hadschHallas: 28, ivits: 28, geodens: 34, balTaks: 1, firaks: 28, bescods: 28, nevlas: 28, itars: 28, moweyds: 28, spaceGiants: 43, tinkerroids: 34, darkanians: 28 }, // 航行
    ai:    { terrans: 28, lantids: 28, xenos: 28, gleens: 34, taklons: 28, ambas: 28, hadschHallas: 28, ivits: 28, geodens: 34, balTaks: 28, firaks: 28, bescods: 28, nevlas: 28, itars: 28, moweyds: 28, spaceGiants: 43, tinkerroids: 34, darkanians: 28 }, // 人工知能
    gaia:  { terrans: 28, lantids: 28, xenos: 28, gleens: 34, taklons: 28, ambas: 28, hadschHallas: 28, ivits: 28, geodens: 34, balTaks: 28, firaks: 28, bescods: 28, nevlas: 28, itars: 28, moweyds: 28, spaceGiants: 43, tinkerroids: 34, darkanians: 28 }, // ガイア計画
    eco:   { terrans: 28, lantids: 28, xenos: 28, gleens: 34, taklons: 28, ambas: 28, hadschHallas: 28, ivits: 28, geodens: 34, balTaks: 28, firaks: 28, bescods: 28, nevlas: 28, itars: 28, moweyds: 28, spaceGiants: 43, tinkerroids: 34, darkanians: 28 }, // 経済
    sci:   { terrans: 28, lantids: 28, xenos: 28, gleens: 34, taklons: 28, ambas: 28, hadschHallas: 28, ivits: 28, geodens: 34, balTaks: 28, firaks: 28, bescods: 28, nevlas: 28, itars: 28, moweyds: 28, spaceGiants: 43, tinkerroids: 34, darkanians: 28 }, // 科学
    vp25:  { terrans: 28, lantids: 28, xenos: 28, gleens: 34, taklons: 28, ambas: 28, hadschHallas: 28, ivits: 28, geodens: 34, balTaks: 28, firaks: 28, bescods: 28, nevlas: 28, itars: 28, moweyds: 28, spaceGiants: 43, tinkerroids: 34, darkanians: 28 }, // 拡張部:25VP面
    shuttle: { terrans: 28, lantids: 28, xenos: 28, gleens: 34, taklons: 28, ambas: 28, hadschHallas: 28, ivits: 28, geodens: 34, balTaks: 28, firaks: 28, bescods: 28, nevlas: 28, itars: 28, moweyds: 28, spaceGiants: 43, tinkerroids: 34, darkanians: 28 }, // 拡張部:シャトル面
  },
  // AT13 アクション：知識3
  AT13: {
    terra: { terrans: 22, lantids: 27, xenos: 22, gleens: 22, taklons: 22, ambas: 22, hadschHallas: 22, ivits: 22, geodens: 22, balTaks: 22, firaks: 27, bescods: 27, nevlas: 27, itars: 22, moweyds: 22, spaceGiants: 22, tinkerroids: 27, darkanians: 22 }, // 惑星改造
    nav:   { terrans: 22, lantids: 27, xenos: 22, gleens: 22, taklons: 22, ambas: 22, hadschHallas: 22, ivits: 22, geodens: 22, balTaks: 1, firaks: 27, bescods: 27, nevlas: 27, itars: 22, moweyds: 22, spaceGiants: 22, tinkerroids: 27, darkanians: 22 }, // 航行
    ai:    { terrans: 22, lantids: 27, xenos: 22, gleens: 22, taklons: 22, ambas: 22, hadschHallas: 22, ivits: 22, geodens: 22, balTaks: 22, firaks: 27, bescods: 27, nevlas: 27, itars: 22, moweyds: 22, spaceGiants: 22, tinkerroids: 27, darkanians: 22 }, // 人工知能
    gaia:  { terrans: 22, lantids: 27, xenos: 22, gleens: 22, taklons: 22, ambas: 22, hadschHallas: 22, ivits: 22, geodens: 22, balTaks: 22, firaks: 27, bescods: 27, nevlas: 27, itars: 22, moweyds: 22, spaceGiants: 22, tinkerroids: 27, darkanians: 22 }, // ガイア計画
    eco:   { terrans: 22, lantids: 27, xenos: 22, gleens: 22, taklons: 22, ambas: 22, hadschHallas: 22, ivits: 22, geodens: 22, balTaks: 22, firaks: 27, bescods: 27, nevlas: 27, itars: 22, moweyds: 22, spaceGiants: 22, tinkerroids: 27, darkanians: 22 }, // 経済
    sci:   { terrans: 22, lantids: 27, xenos: 22, gleens: 22, taklons: 22, ambas: 22, hadschHallas: 22, ivits: 22, geodens: 22, balTaks: 22, firaks: 27, bescods: 27, nevlas: 27, itars: 22, moweyds: 22, spaceGiants: 22, tinkerroids: 27, darkanians: 22 }, // 科学
    vp25:  { terrans: 22, lantids: 27, xenos: 22, gleens: 22, taklons: 22, ambas: 22, hadschHallas: 22, ivits: 22, geodens: 22, balTaks: 22, firaks: 27, bescods: 27, nevlas: 27, itars: 22, moweyds: 22, spaceGiants: 22, tinkerroids: 27, darkanians: 22 }, // 拡張部:25VP面
    shuttle: { terrans: 22, lantids: 27, xenos: 22, gleens: 22, taklons: 22, ambas: 22, hadschHallas: 22, ivits: 22, geodens: 22, balTaks: 22, firaks: 27, bescods: 27, nevlas: 27, itars: 22, moweyds: 22, spaceGiants: 22, tinkerroids: 27, darkanians: 22 }, // 拡張部:シャトル面
  },
  // AT01 パス時：同盟タイル×3VP
  AT01: {
    terra: { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, balTaks: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21, moweyds: 32, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // 惑星改造
    nav:   { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21, moweyds: 32, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // 航行
    ai:    { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, balTaks: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21, moweyds: 32, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // 人工知能
    gaia:  { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, balTaks: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21, moweyds: 32, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // ガイア計画
    eco:   { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, balTaks: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21, moweyds: 32, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // 経済
    sci:   { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, balTaks: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21, moweyds: 32, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // 科学
    vp25:  { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, balTaks: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21, moweyds: 32, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // 拡張部:25VP面
    shuttle: { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, balTaks: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21, moweyds: 32, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // 拡張部:シャトル面
  },
  // AT05 パス時：研究所×3VP
  AT05: {
    terra: { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, balTaks: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20, moweyds: 20, spaceGiants: 20, tinkerroids: 20, darkanians: 20 }, // 惑星改造
    nav:   { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20, moweyds: 20, spaceGiants: 20, tinkerroids: 20, darkanians: 20 }, // 航行
    ai:    { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, balTaks: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20, moweyds: 20, spaceGiants: 20, tinkerroids: 20, darkanians: 20 }, // 人工知能
    gaia:  { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, balTaks: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20, moweyds: 20, spaceGiants: 20, tinkerroids: 20, darkanians: 20 }, // ガイア計画
    eco:   { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, balTaks: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20, moweyds: 20, spaceGiants: 20, tinkerroids: 20, darkanians: 20 }, // 経済
    sci:   { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, balTaks: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20, moweyds: 20, spaceGiants: 20, tinkerroids: 20, darkanians: 20 }, // 科学
    vp25:  { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, balTaks: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20, moweyds: 20, spaceGiants: 20, tinkerroids: 20, darkanians: 20 }, // 拡張部:25VP面
    shuttle: { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, balTaks: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20, moweyds: 20, spaceGiants: 20, tinkerroids: 20, darkanians: 20 }, // 拡張部:シャトル面
  },
  // AT15 パス時：惑星種類×1VP
  AT15: {
    terra: { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 23, darkanians: 27 }, // 惑星改造
    nav:   { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 23, darkanians: 27 }, // 航行
    ai:    { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 23, darkanians: 27 }, // 人工知能
    gaia:  { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 23, darkanians: 27 }, // ガイア計画
    eco:   { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 23, darkanians: 27 }, // 経済
    sci:   { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 23, darkanians: 27 }, // 科学
    vp25:  { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 23, darkanians: 27 }, // 拡張部:25VP面
    shuttle: { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 23, darkanians: 27 }, // 拡張部:シャトル面
  },
  // AT02 研究を進めるたび＋2VP
  AT02: {
    terra: { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 惑星改造
    nav:   { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 航行
    ai:    { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 人工知能
    gaia:  { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // ガイア計画
    eco:   { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 経済
    sci:   { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 科学
    vp25:  { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 拡張部:25VP面
    shuttle: { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 拡張部:シャトル面
  },
  // AT11 交易所を建設するたび＋3VP
  AT11: {
    terra: { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // 惑星改造
    nav:   { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // 航行
    ai:    { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // 人工知能
    gaia:  { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // ガイア計画
    eco:   { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // 経済
    sci:   { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // 科学
    vp25:  { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // 拡張部:25VP面
    shuttle: { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // 拡張部:シャトル面
  },
  // AT14 鉱山を建設するたび＋3VP
  AT14: {
    terra: { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 16, tinkerroids: 11, darkanians: 16 }, // 惑星改造
    nav:   { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 16, tinkerroids: 11, darkanians: 16 }, // 航行
    ai:    { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 16, tinkerroids: 11, darkanians: 16 }, // 人工知能
    gaia:  { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 16, tinkerroids: 11, darkanians: 16 }, // ガイア計画
    eco:   { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 16, tinkerroids: 11, darkanians: 16 }, // 経済
    sci:   { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 16, tinkerroids: 11, darkanians: 16 }, // 科学
    vp25:  { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 16, tinkerroids: 11, darkanians: 16 }, // 拡張部:25VP面
    shuttle: { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 16, tinkerroids: 11, darkanians: 16 }, // 拡張部:シャトル面
  },
  // AT16 取得時：首府・学院×6VP
  AT16: {
    terra: { terrans: 15, lantids: 15, xenos: 15, gleens: 15, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 15, firaks: 15, bescods: 19, nevlas: 19, itars: 19, moweyds: 15, spaceGiants: 15, tinkerroids: 22, darkanians: 15 }, // 惑星改造
    nav:   { terrans: 15, lantids: 15, xenos: 15, gleens: 15, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 15, geodens: 15, firaks: 15, bescods: 19, nevlas: 19, itars: 19, moweyds: 15, spaceGiants: 15, tinkerroids: 22, darkanians: 15 }, // 航行
    ai:    { terrans: 15, lantids: 15, xenos: 15, gleens: 15, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 15, firaks: 15, bescods: 19, nevlas: 19, itars: 19, moweyds: 15, spaceGiants: 15, tinkerroids: 22, darkanians: 15 }, // 人工知能
    gaia:  { terrans: 15, lantids: 15, xenos: 15, gleens: 15, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 15, firaks: 15, bescods: 19, nevlas: 19, itars: 19, moweyds: 15, spaceGiants: 15, tinkerroids: 22, darkanians: 15 }, // ガイア計画
    eco:   { terrans: 15, lantids: 15, xenos: 15, gleens: 15, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 15, firaks: 15, bescods: 19, nevlas: 19, itars: 19, moweyds: 15, spaceGiants: 15, tinkerroids: 22, darkanians: 15 }, // 経済
    sci:   { terrans: 15, lantids: 15, xenos: 15, gleens: 15, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 15, firaks: 15, bescods: 19, nevlas: 19, itars: 19, moweyds: 15, spaceGiants: 15, tinkerroids: 22, darkanians: 15 }, // 科学
    vp25:  { terrans: 15, lantids: 15, xenos: 15, gleens: 15, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 15, firaks: 15, bescods: 19, nevlas: 19, itars: 19, moweyds: 15, spaceGiants: 15, tinkerroids: 22, darkanians: 15 }, // 拡張部:25VP面
    shuttle: { terrans: 15, lantids: 15, xenos: 15, gleens: 15, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 15, firaks: 15, bescods: 19, nevlas: 19, itars: 19, moweyds: 15, spaceGiants: 15, tinkerroids: 22, darkanians: 15 }, // 拡張部:シャトル面
  },
  // AT17 取得時：深宇宙宙域×4VP
  AT17: {
    terra: { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 6, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 惑星改造
    nav:   { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 航行
    ai:    { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 6, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 人工知能
    gaia:  { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 6, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // ガイア計画
    eco:   { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 6, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 経済
    sci:   { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 6, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 科学
    vp25:  { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 6, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 拡張部:25VP面
    shuttle: { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 6, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 拡張部:シャトル面
  },
  // AT18 パス時：小惑星×2VP
  AT18: {
    terra: { terrans: 13, lantids: 13, xenos: 13, gleens: 13, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 13, balTaks: 10, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 13, tinkerroids: 20, darkanians: 20 }, // 惑星改造
    nav:   { terrans: 13, lantids: 13, xenos: 13, gleens: 13, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 13, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 13, tinkerroids: 20, darkanians: 20 }, // 航行
    ai:    { terrans: 13, lantids: 13, xenos: 13, gleens: 13, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 13, balTaks: 10, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 13, tinkerroids: 20, darkanians: 20 }, // 人工知能
    gaia:  { terrans: 13, lantids: 13, xenos: 13, gleens: 13, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 13, balTaks: 10, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 13, tinkerroids: 20, darkanians: 20 }, // ガイア計画
    eco:   { terrans: 13, lantids: 13, xenos: 13, gleens: 13, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 13, balTaks: 10, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 13, tinkerroids: 20, darkanians: 20 }, // 経済
    sci:   { terrans: 13, lantids: 13, xenos: 13, gleens: 13, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 13, balTaks: 10, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 13, tinkerroids: 20, darkanians: 20 }, // 科学
    vp25:  { terrans: 13, lantids: 13, xenos: 13, gleens: 13, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 13, balTaks: 10, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 13, tinkerroids: 20, darkanians: 20 }, // 拡張部:25VP面
    shuttle: { terrans: 13, lantids: 13, xenos: 13, gleens: 13, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 13, balTaks: 10, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 13, tinkerroids: 20, darkanians: 20 }, // 拡張部:シャトル面
  },
  // AT21 パス時：深宇宙宙域×2VP
  AT21: {
    terra: { terrans: 15, lantids: 19, xenos: 19, gleens: 15, taklons: 19, ambas: 15, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 8, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 22 }, // 惑星改造
    nav:   { terrans: 15, lantids: 19, xenos: 19, gleens: 15, taklons: 19, ambas: 15, hadschHallas: 15, ivits: 15, geodens: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 22 }, // 航行
    ai:    { terrans: 15, lantids: 19, xenos: 19, gleens: 15, taklons: 19, ambas: 15, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 8, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 22 }, // 人工知能
    gaia:  { terrans: 15, lantids: 19, xenos: 19, gleens: 15, taklons: 19, ambas: 15, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 8, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 22 }, // ガイア計画
    eco:   { terrans: 15, lantids: 19, xenos: 19, gleens: 15, taklons: 19, ambas: 15, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 8, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 22 }, // 経済
    sci:   { terrans: 15, lantids: 19, xenos: 19, gleens: 15, taklons: 19, ambas: 15, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 8, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 22 }, // 科学
    vp25:  { terrans: 15, lantids: 19, xenos: 19, gleens: 15, taklons: 19, ambas: 15, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 8, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 22 }, // 拡張部:25VP面
    shuttle: { terrans: 15, lantids: 19, xenos: 19, gleens: 15, taklons: 19, ambas: 15, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 8, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 22 }, // 拡張部:シャトル面
  },
  // AT19 惑星改造1段階ごと＋2VP
  AT19: {
    terra: { terrans: 11, lantids: 11, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 16, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 14, spaceGiants: 16, tinkerroids: 14, darkanians: 8 }, // 惑星改造
    nav:   { terrans: 11, lantids: 11, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 16, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 14, spaceGiants: 16, tinkerroids: 14, darkanians: 8 }, // 航行
    ai:    { terrans: 11, lantids: 11, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 16, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 14, spaceGiants: 16, tinkerroids: 14, darkanians: 8 }, // 人工知能
    gaia:  { terrans: 11, lantids: 11, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 16, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 14, spaceGiants: 16, tinkerroids: 14, darkanians: 8 }, // ガイア計画
    eco:   { terrans: 11, lantids: 11, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 16, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 14, spaceGiants: 16, tinkerroids: 14, darkanians: 8 }, // 経済
    sci:   { terrans: 11, lantids: 11, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 16, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 14, spaceGiants: 16, tinkerroids: 14, darkanians: 8 }, // 科学
    vp25:  { terrans: 11, lantids: 11, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 16, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 14, spaceGiants: 16, tinkerroids: 14, darkanians: 8 }, // 拡張部:25VP面
    shuttle: { terrans: 11, lantids: 11, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 16, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 14, spaceGiants: 16, tinkerroids: 14, darkanians: 8 }, // 拡張部:シャトル面
  },
  // AT20 QICアクションのたび＋4VP
  AT20: {
    terra: { terrans: 11, lantids: 11, xenos: 11, gleens: 6, taklons: 11, ambas: 11, hadschHallas: 14, ivits: 14, geodens: 11, balTaks: 16, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // 惑星改造
    nav:   { terrans: 11, lantids: 11, xenos: 11, gleens: 6, taklons: 11, ambas: 11, hadschHallas: 14, ivits: 14, geodens: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // 航行
    ai:    { terrans: 11, lantids: 11, xenos: 11, gleens: 6, taklons: 11, ambas: 11, hadschHallas: 14, ivits: 14, geodens: 11, balTaks: 16, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // 人工知能
    gaia:  { terrans: 11, lantids: 11, xenos: 11, gleens: 6, taklons: 11, ambas: 11, hadschHallas: 14, ivits: 14, geodens: 11, balTaks: 16, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // ガイア計画
    eco:   { terrans: 11, lantids: 11, xenos: 11, gleens: 6, taklons: 11, ambas: 11, hadschHallas: 14, ivits: 14, geodens: 11, balTaks: 16, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // 経済
    sci:   { terrans: 11, lantids: 11, xenos: 11, gleens: 6, taklons: 11, ambas: 11, hadschHallas: 14, ivits: 14, geodens: 11, balTaks: 16, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // 科学
    vp25:  { terrans: 11, lantids: 11, xenos: 11, gleens: 6, taklons: 11, ambas: 11, hadschHallas: 14, ivits: 14, geodens: 11, balTaks: 16, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // 拡張部:25VP面
    shuttle: { terrans: 11, lantids: 11, xenos: 11, gleens: 6, taklons: 11, ambas: 11, hadschHallas: 14, ivits: 14, geodens: 11, balTaks: 16, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // 拡張部:シャトル面
  },
};

/** その拡張で使う上級技術のテーブル。 */
export function advancedTechTable(lostFleet: boolean): AdvancedTechTable {
  return lostFleet ? ADVANCED_TECH_WEIGHTS_LF : ADVANCED_TECH_WEIGHTS_BASE;
}

/**
 * 上級技術1枚ぶんの重み（研究列ごと）。**参照はここを通すこと。**
 * 表に無いタイル（通常版の AT16-21）は undefined ＝寄与なし。
 */
export function advancedTechCell(
  tileId: string,
  track: ResearchTrackId,
  lostFleet: boolean
): Partial<Record<FactionId, number>> | undefined {
  return advancedTechTable(lostFleet)[tileId]?.[track];
}

const TRACKS: ResearchTrackId[] = ["terra", "nav", "ai", "gaia", "eco", "sci"];
/** `${base|lf}:${tileId}` → 拡張部用のセル（初回だけ作る）。 */
const extensionCellCache = new Map<string, Partial<Record<FactionId, number>>>();

/**
 * 得点ボード拡張部に置かれた1枚の重み（Lost Fleet のみ）。
 *
 * 2026-08-08: 拡張部の面（vp25/shuttle）ごとの値をCSVへ持つようにしたので、
 * 面が分かっていて値も入っていればそれを使う。面が未指定（呼び出し側が
 * 拡張版のセットアップ結果を持たない場合など）、またはそのタイルにまだ
 * 値が無い場合は**研究列6つの最大値**にフォールバックする（旧来の近似。
 * 標準技術のフリー枠と同じ理屈。techPositionCell 参照）。
 */
export function advancedTechExtensionCell(
  tileId: string,
  lostFleet: boolean,
  face?: ExtensionFace
): Partial<Record<FactionId, number>> | undefined {
  const tile = advancedTechTable(lostFleet)[tileId];
  if (!tile) return undefined;
  if (face) {
    const faceCell = tile[face];
    if (faceCell && Object.keys(faceCell).length > 0) return faceCell;
  }
  const key = `${lostFleet ? "lf" : "base"}:${tileId}`;
  let cell = extensionCellCache.get(key);
  if (cell) return cell;
  cell = {};
  const seen = new Set<FactionId>();
  for (const trk of TRACKS) {
    for (const f of Object.keys(tile[trk] ?? {}) as FactionId[]) seen.add(f);
  }
  for (const f of seen) {
    let best = 0;
    for (const trk of TRACKS) {
      const v = tile[trk]?.[f] ?? 0;
      if (v > best) best = v;
    }
    if (best !== 0) cell[f] = best;
  }
  extensionCellCache.set(key, cell);
  return cell;
}
