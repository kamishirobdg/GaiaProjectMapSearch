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
// 通常版 15タイル×6列×14種族＝1260セル / 拡張版 21×6×18＝2268セル。
// 拡張の有無で場に出るタイルの母集団が変わるので、標準技術と同じく表を分ける。

import type { ResearchTrackId } from "@/gaia/setup/types";
import type { FactionId } from "./factionWeights";

export type AdvancedTechTable = Record<
  string,
  Partial<Record<ResearchTrackId, Partial<Record<FactionId, number>>>>
>;

/** ★通常版（基本14種族×15枚）。CSV から生成。 */
export const ADVANCED_TECH_WEIGHTS_BASE: AdvancedTechTable = {
  // AT04 取得時：鉱山×2VP
  AT04: {
    terra: { terrans: 14, lantids: 21, xenos: 21, gleens: 14, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 18, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14 }, // 惑星改造
    nav:   { terrans: 14, lantids: 21, xenos: 21, gleens: 14, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 18, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14 }, // 航行
    ai:    { terrans: 14, lantids: 21, xenos: 21, gleens: 14, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 18, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14 }, // 人工知能
    gaia:  { terrans: 14, lantids: 21, xenos: 21, gleens: 14, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 18, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14 }, // ガイア計画
    eco:   { terrans: 14, lantids: 21, xenos: 21, gleens: 14, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 18, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14 }, // 経済
    sci:   { terrans: 14, lantids: 21, xenos: 21, gleens: 14, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 18, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14 }, // 科学
  },
  // AT06 取得時：宙域×鉱石1
  AT06: {
    terra: { terrans: 4, lantids: 5, xenos: 4, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 3, firaks: 4, bescods: 4, nevlas: 4, itars: 4 }, // 惑星改造
    nav:   { terrans: 4, lantids: 5, xenos: 4, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 3, firaks: 4, bescods: 4, nevlas: 4, itars: 4 }, // 航行
    ai:    { terrans: 4, lantids: 5, xenos: 4, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 3, firaks: 4, bescods: 4, nevlas: 4, itars: 4 }, // 人工知能
    gaia:  { terrans: 4, lantids: 5, xenos: 4, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 3, firaks: 4, bescods: 4, nevlas: 4, itars: 4 }, // ガイア計画
    eco:   { terrans: 4, lantids: 5, xenos: 4, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 3, firaks: 4, bescods: 4, nevlas: 4, itars: 4 }, // 経済
    sci:   { terrans: 4, lantids: 5, xenos: 4, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 3, firaks: 4, bescods: 4, nevlas: 4, itars: 4 }, // 科学
  },
  // AT08 取得時：ガイア惑星×2VP
  AT08: {
    terra: { terrans: 9, lantids: 6, xenos: 6, gleens: 9, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 8, firaks: 6, bescods: 6, nevlas: 6, itars: 9 }, // 惑星改造
    nav:   { terrans: 9, lantids: 6, xenos: 6, gleens: 9, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 8, firaks: 6, bescods: 6, nevlas: 6, itars: 9 }, // 航行
    ai:    { terrans: 9, lantids: 6, xenos: 6, gleens: 9, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 8, firaks: 6, bescods: 6, nevlas: 6, itars: 9 }, // 人工知能
    gaia:  { terrans: 9, lantids: 6, xenos: 6, gleens: 9, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 8, firaks: 6, bescods: 6, nevlas: 6, itars: 9 }, // ガイア計画
    eco:   { terrans: 9, lantids: 6, xenos: 6, gleens: 9, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 8, firaks: 6, bescods: 6, nevlas: 6, itars: 9 }, // 経済
    sci:   { terrans: 9, lantids: 6, xenos: 6, gleens: 9, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 8, firaks: 6, bescods: 6, nevlas: 6, itars: 9 }, // 科学
  },
  // AT09 取得時：交易所×4VP
  AT09: {
    terra: { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 18, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 12, nevlas: 15, itars: 12 }, // 惑星改造
    nav:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 18, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 12, nevlas: 15, itars: 12 }, // 航行
    ai:    { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 18, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 12, nevlas: 15, itars: 12 }, // 人工知能
    gaia:  { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 18, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 12, nevlas: 15, itars: 12 }, // ガイア計画
    eco:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 18, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 12, nevlas: 15, itars: 12 }, // 経済
    sci:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 18, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 12, nevlas: 15, itars: 12 }, // 科学
  },
  // AT10 取得時：宙域×2VP
  AT10: {
    terra: { terrans: 8, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 惑星改造
    nav:   { terrans: 8, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 航行
    ai:    { terrans: 8, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 人工知能
    gaia:  { terrans: 8, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // ガイア計画
    eco:   { terrans: 8, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 経済
    sci:   { terrans: 8, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 科学
  },
  // AT12 取得時：同盟タイル×5VP
  AT12: {
    terra: { terrans: 11, lantids: 11, xenos: 16, gleens: 14, taklons: 11, ambas: 14, hadschHallas: 11, ivits: 16, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11 }, // 惑星改造
    nav:   { terrans: 11, lantids: 11, xenos: 16, gleens: 14, taklons: 11, ambas: 14, hadschHallas: 11, ivits: 16, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11 }, // 航行
    ai:    { terrans: 11, lantids: 11, xenos: 16, gleens: 14, taklons: 11, ambas: 14, hadschHallas: 11, ivits: 16, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11 }, // 人工知能
    gaia:  { terrans: 11, lantids: 11, xenos: 16, gleens: 14, taklons: 11, ambas: 14, hadschHallas: 11, ivits: 16, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11 }, // ガイア計画
    eco:   { terrans: 11, lantids: 11, xenos: 16, gleens: 14, taklons: 11, ambas: 14, hadschHallas: 11, ivits: 16, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11 }, // 経済
    sci:   { terrans: 11, lantids: 11, xenos: 16, gleens: 14, taklons: 11, ambas: 14, hadschHallas: 11, ivits: 16, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11 }, // 科学
  },
  // AT03 アクション：QIC1＋クレジット5
  AT03: {
    terra: { terrans: 10, lantids: 10, xenos: 10, gleens: 8, taklons: 12, ambas: 10, hadschHallas: 15, ivits: 12, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // 惑星改造
    nav:   { terrans: 10, lantids: 10, xenos: 10, gleens: 8, taklons: 12, ambas: 10, hadschHallas: 15, ivits: 12, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // 航行
    ai:    { terrans: 10, lantids: 10, xenos: 10, gleens: 8, taklons: 12, ambas: 10, hadschHallas: 15, ivits: 12, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // 人工知能
    gaia:  { terrans: 10, lantids: 10, xenos: 10, gleens: 8, taklons: 12, ambas: 10, hadschHallas: 15, ivits: 12, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // ガイア計画
    eco:   { terrans: 10, lantids: 10, xenos: 10, gleens: 8, taklons: 12, ambas: 10, hadschHallas: 15, ivits: 12, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // 経済
    sci:   { terrans: 10, lantids: 10, xenos: 10, gleens: 8, taklons: 12, ambas: 10, hadschHallas: 15, ivits: 12, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // 科学
  },
  // AT07 アクション：鉱石3
  AT07: {
    terra: { terrans: 8, lantids: 8, xenos: 8, gleens: 10, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 惑星改造
    nav:   { terrans: 8, lantids: 8, xenos: 8, gleens: 10, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 航行
    ai:    { terrans: 8, lantids: 8, xenos: 8, gleens: 10, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 人工知能
    gaia:  { terrans: 8, lantids: 8, xenos: 8, gleens: 10, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // ガイア計画
    eco:   { terrans: 8, lantids: 8, xenos: 8, gleens: 10, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 経済
    sci:   { terrans: 8, lantids: 8, xenos: 8, gleens: 10, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 科学
  },
  // AT13 アクション：知識3
  AT13: {
    terra: { terrans: 12, lantids: 15, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 15, nevlas: 15, itars: 12 }, // 惑星改造
    nav:   { terrans: 12, lantids: 15, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 15, nevlas: 15, itars: 12 }, // 航行
    ai:    { terrans: 12, lantids: 15, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 15, nevlas: 15, itars: 12 }, // 人工知能
    gaia:  { terrans: 12, lantids: 15, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 15, nevlas: 15, itars: 12 }, // ガイア計画
    eco:   { terrans: 12, lantids: 15, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 15, nevlas: 15, itars: 12 }, // 経済
    sci:   { terrans: 12, lantids: 15, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 15, nevlas: 15, itars: 12 }, // 科学
  },
  // AT01 パス時：同盟タイル×3VP
  AT01: {
    terra: { terrans: 17, lantids: 17, xenos: 26, gleens: 21, taklons: 17, ambas: 21, hadschHallas: 17, ivits: 26, geodens: 17, balTaks: 17, firaks: 17, bescods: 17, nevlas: 17, itars: 17 }, // 惑星改造
    nav:   { terrans: 17, lantids: 17, xenos: 26, gleens: 21, taklons: 17, ambas: 21, hadschHallas: 17, ivits: 26, geodens: 17, balTaks: 17, firaks: 17, bescods: 17, nevlas: 17, itars: 17 }, // 航行
    ai:    { terrans: 17, lantids: 17, xenos: 26, gleens: 21, taklons: 17, ambas: 21, hadschHallas: 17, ivits: 26, geodens: 17, balTaks: 17, firaks: 17, bescods: 17, nevlas: 17, itars: 17 }, // 人工知能
    gaia:  { terrans: 17, lantids: 17, xenos: 26, gleens: 21, taklons: 17, ambas: 21, hadschHallas: 17, ivits: 26, geodens: 17, balTaks: 17, firaks: 17, bescods: 17, nevlas: 17, itars: 17 }, // ガイア計画
    eco:   { terrans: 17, lantids: 17, xenos: 26, gleens: 21, taklons: 17, ambas: 21, hadschHallas: 17, ivits: 26, geodens: 17, balTaks: 17, firaks: 17, bescods: 17, nevlas: 17, itars: 17 }, // 経済
    sci:   { terrans: 17, lantids: 17, xenos: 26, gleens: 21, taklons: 17, ambas: 21, hadschHallas: 17, ivits: 26, geodens: 17, balTaks: 17, firaks: 17, bescods: 17, nevlas: 17, itars: 17 }, // 科学
  },
  // AT05 パス時：研究所×3VP
  AT05: {
    terra: { terrans: 16, lantids: 20, xenos: 16, gleens: 12, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 16, firaks: 24, bescods: 20, nevlas: 16, itars: 16 }, // 惑星改造
    nav:   { terrans: 16, lantids: 20, xenos: 16, gleens: 12, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 16, firaks: 24, bescods: 20, nevlas: 16, itars: 16 }, // 航行
    ai:    { terrans: 16, lantids: 20, xenos: 16, gleens: 12, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 16, firaks: 24, bescods: 20, nevlas: 16, itars: 16 }, // 人工知能
    gaia:  { terrans: 16, lantids: 20, xenos: 16, gleens: 12, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 16, firaks: 24, bescods: 20, nevlas: 16, itars: 16 }, // ガイア計画
    eco:   { terrans: 16, lantids: 20, xenos: 16, gleens: 12, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 16, firaks: 24, bescods: 20, nevlas: 16, itars: 16 }, // 経済
    sci:   { terrans: 16, lantids: 20, xenos: 16, gleens: 12, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 16, firaks: 24, bescods: 20, nevlas: 16, itars: 16 }, // 科学
  },
  // AT15 パス時：惑星種類×1VP
  AT15: {
    terra: { terrans: 14, lantids: 14, xenos: 18, gleens: 18, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 21, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14 }, // 惑星改造
    nav:   { terrans: 14, lantids: 14, xenos: 18, gleens: 18, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 21, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14 }, // 航行
    ai:    { terrans: 14, lantids: 14, xenos: 18, gleens: 18, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 21, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14 }, // 人工知能
    gaia:  { terrans: 14, lantids: 14, xenos: 18, gleens: 18, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 21, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14 }, // ガイア計画
    eco:   { terrans: 14, lantids: 14, xenos: 18, gleens: 18, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 21, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14 }, // 経済
    sci:   { terrans: 14, lantids: 14, xenos: 18, gleens: 18, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 21, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14 }, // 科学
  },
  // AT02 研究を進めるたび＋2VP
  AT02: {
    terra: { terrans: 8, lantids: 10, xenos: 8, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 12, bescods: 12, nevlas: 10, itars: 12 }, // 惑星改造
    nav:   { terrans: 8, lantids: 10, xenos: 8, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 12, bescods: 12, nevlas: 10, itars: 12 }, // 航行
    ai:    { terrans: 8, lantids: 10, xenos: 8, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 12, bescods: 12, nevlas: 10, itars: 12 }, // 人工知能
    gaia:  { terrans: 8, lantids: 10, xenos: 8, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 12, bescods: 12, nevlas: 10, itars: 12 }, // ガイア計画
    eco:   { terrans: 8, lantids: 10, xenos: 8, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 12, bescods: 12, nevlas: 10, itars: 12 }, // 経済
    sci:   { terrans: 8, lantids: 10, xenos: 8, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 12, bescods: 12, nevlas: 10, itars: 12 }, // 科学
  },
  // AT11 交易所を建設するたび＋3VP
  AT11: {
    terra: { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5 }, // 惑星改造
    nav:   { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5 }, // 航行
    ai:    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5 }, // 人工知能
    gaia:  { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5 }, // ガイア計画
    eco:   { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5 }, // 経済
    sci:   { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5 }, // 科学
  },
  // AT14 鉱山を建設するたび＋3VP
  AT14: {
    terra: { terrans: 7, lantids: 10, xenos: 9, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 9, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7 }, // 惑星改造
    nav:   { terrans: 7, lantids: 10, xenos: 9, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 9, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7 }, // 航行
    ai:    { terrans: 7, lantids: 10, xenos: 9, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 9, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7 }, // 人工知能
    gaia:  { terrans: 7, lantids: 10, xenos: 9, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 9, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7 }, // ガイア計画
    eco:   { terrans: 7, lantids: 10, xenos: 9, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 9, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7 }, // 経済
    sci:   { terrans: 7, lantids: 10, xenos: 9, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 9, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7 }, // 科学
  },
};

/** ★拡張版（18種族×21枚）。CSV から生成。 */
export const ADVANCED_TECH_WEIGHTS_LF: AdvancedTechTable = {
  // AT04 取得時：鉱山×2VP
  AT04: {
    terra: { terrans: 14, lantids: 21, xenos: 21, gleens: 14, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 18, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14, moweyds: 14, spaceGiants: 21, tinkerroids: 14, darkanians: 18 }, // 惑星改造
    nav:   { terrans: 14, lantids: 21, xenos: 21, gleens: 14, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 18, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14, moweyds: 14, spaceGiants: 21, tinkerroids: 14, darkanians: 18 }, // 航行
    ai:    { terrans: 14, lantids: 21, xenos: 21, gleens: 14, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 18, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14, moweyds: 14, spaceGiants: 21, tinkerroids: 14, darkanians: 18 }, // 人工知能
    gaia:  { terrans: 14, lantids: 21, xenos: 21, gleens: 14, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 18, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14, moweyds: 14, spaceGiants: 21, tinkerroids: 14, darkanians: 18 }, // ガイア計画
    eco:   { terrans: 14, lantids: 21, xenos: 21, gleens: 14, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 18, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14, moweyds: 14, spaceGiants: 21, tinkerroids: 14, darkanians: 18 }, // 経済
    sci:   { terrans: 14, lantids: 21, xenos: 21, gleens: 14, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 18, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14, moweyds: 14, spaceGiants: 21, tinkerroids: 14, darkanians: 18 }, // 科学
  },
  // AT06 取得時：宙域×鉱石1
  AT06: {
    terra: { terrans: 4, lantids: 5, xenos: 4, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 3, firaks: 4, bescods: 4, nevlas: 4, itars: 4, moweyds: 4, spaceGiants: 4, tinkerroids: 4, darkanians: 6 }, // 惑星改造
    nav:   { terrans: 4, lantids: 5, xenos: 4, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 3, firaks: 4, bescods: 4, nevlas: 4, itars: 4, moweyds: 4, spaceGiants: 4, tinkerroids: 4, darkanians: 6 }, // 航行
    ai:    { terrans: 4, lantids: 5, xenos: 4, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 3, firaks: 4, bescods: 4, nevlas: 4, itars: 4, moweyds: 4, spaceGiants: 4, tinkerroids: 4, darkanians: 6 }, // 人工知能
    gaia:  { terrans: 4, lantids: 5, xenos: 4, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 3, firaks: 4, bescods: 4, nevlas: 4, itars: 4, moweyds: 4, spaceGiants: 4, tinkerroids: 4, darkanians: 6 }, // ガイア計画
    eco:   { terrans: 4, lantids: 5, xenos: 4, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 3, firaks: 4, bescods: 4, nevlas: 4, itars: 4, moweyds: 4, spaceGiants: 4, tinkerroids: 4, darkanians: 6 }, // 経済
    sci:   { terrans: 4, lantids: 5, xenos: 4, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 3, firaks: 4, bescods: 4, nevlas: 4, itars: 4, moweyds: 4, spaceGiants: 4, tinkerroids: 4, darkanians: 6 }, // 科学
  },
  // AT08 取得時：ガイア惑星×2VP
  AT08: {
    terra: { terrans: 9, lantids: 6, xenos: 6, gleens: 9, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 8, firaks: 6, bescods: 6, nevlas: 6, itars: 9, moweyds: 6, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // 惑星改造
    nav:   { terrans: 9, lantids: 6, xenos: 6, gleens: 9, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 8, firaks: 6, bescods: 6, nevlas: 6, itars: 9, moweyds: 6, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // 航行
    ai:    { terrans: 9, lantids: 6, xenos: 6, gleens: 9, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 8, firaks: 6, bescods: 6, nevlas: 6, itars: 9, moweyds: 6, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // 人工知能
    gaia:  { terrans: 9, lantids: 6, xenos: 6, gleens: 9, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 8, firaks: 6, bescods: 6, nevlas: 6, itars: 9, moweyds: 6, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // ガイア計画
    eco:   { terrans: 9, lantids: 6, xenos: 6, gleens: 9, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 8, firaks: 6, bescods: 6, nevlas: 6, itars: 9, moweyds: 6, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // 経済
    sci:   { terrans: 9, lantids: 6, xenos: 6, gleens: 9, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 8, firaks: 6, bescods: 6, nevlas: 6, itars: 9, moweyds: 6, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // 科学
  },
  // AT09 取得時：交易所×4VP
  AT09: {
    terra: { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 18, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 12, nevlas: 15, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 惑星改造
    nav:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 18, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 12, nevlas: 15, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 航行
    ai:    { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 18, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 12, nevlas: 15, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 人工知能
    gaia:  { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 18, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 12, nevlas: 15, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // ガイア計画
    eco:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 18, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 12, nevlas: 15, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 経済
    sci:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 18, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 12, nevlas: 15, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 科学
  },
  // AT10 取得時：宙域×2VP
  AT10: {
    terra: { terrans: 8, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 惑星改造
    nav:   { terrans: 8, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 航行
    ai:    { terrans: 8, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 人工知能
    gaia:  { terrans: 8, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // ガイア計画
    eco:   { terrans: 8, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 経済
    sci:   { terrans: 8, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 科学
  },
  // AT12 取得時：同盟タイル×5VP
  AT12: {
    terra: { terrans: 11, lantids: 11, xenos: 16, gleens: 14, taklons: 11, ambas: 14, hadschHallas: 11, ivits: 16, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 16, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // 惑星改造
    nav:   { terrans: 11, lantids: 11, xenos: 16, gleens: 14, taklons: 11, ambas: 14, hadschHallas: 11, ivits: 16, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 16, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // 航行
    ai:    { terrans: 11, lantids: 11, xenos: 16, gleens: 14, taklons: 11, ambas: 14, hadschHallas: 11, ivits: 16, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 16, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // 人工知能
    gaia:  { terrans: 11, lantids: 11, xenos: 16, gleens: 14, taklons: 11, ambas: 14, hadschHallas: 11, ivits: 16, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 16, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // ガイア計画
    eco:   { terrans: 11, lantids: 11, xenos: 16, gleens: 14, taklons: 11, ambas: 14, hadschHallas: 11, ivits: 16, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 16, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // 経済
    sci:   { terrans: 11, lantids: 11, xenos: 16, gleens: 14, taklons: 11, ambas: 14, hadschHallas: 11, ivits: 16, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 16, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // 科学
  },
  // AT03 アクション：QIC1＋クレジット5
  AT03: {
    terra: { terrans: 10, lantids: 10, xenos: 10, gleens: 8, taklons: 12, ambas: 10, hadschHallas: 15, ivits: 12, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // 惑星改造
    nav:   { terrans: 10, lantids: 10, xenos: 10, gleens: 8, taklons: 12, ambas: 10, hadschHallas: 15, ivits: 12, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // 航行
    ai:    { terrans: 10, lantids: 10, xenos: 10, gleens: 8, taklons: 12, ambas: 10, hadschHallas: 15, ivits: 12, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // 人工知能
    gaia:  { terrans: 10, lantids: 10, xenos: 10, gleens: 8, taklons: 12, ambas: 10, hadschHallas: 15, ivits: 12, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // ガイア計画
    eco:   { terrans: 10, lantids: 10, xenos: 10, gleens: 8, taklons: 12, ambas: 10, hadschHallas: 15, ivits: 12, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // 経済
    sci:   { terrans: 10, lantids: 10, xenos: 10, gleens: 8, taklons: 12, ambas: 10, hadschHallas: 15, ivits: 12, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // 科学
  },
  // AT07 アクション：鉱石3
  AT07: {
    terra: { terrans: 8, lantids: 8, xenos: 8, gleens: 10, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 12, tinkerroids: 10, darkanians: 8 }, // 惑星改造
    nav:   { terrans: 8, lantids: 8, xenos: 8, gleens: 10, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 12, tinkerroids: 10, darkanians: 8 }, // 航行
    ai:    { terrans: 8, lantids: 8, xenos: 8, gleens: 10, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 12, tinkerroids: 10, darkanians: 8 }, // 人工知能
    gaia:  { terrans: 8, lantids: 8, xenos: 8, gleens: 10, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 12, tinkerroids: 10, darkanians: 8 }, // ガイア計画
    eco:   { terrans: 8, lantids: 8, xenos: 8, gleens: 10, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 12, tinkerroids: 10, darkanians: 8 }, // 経済
    sci:   { terrans: 8, lantids: 8, xenos: 8, gleens: 10, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 12, tinkerroids: 10, darkanians: 8 }, // 科学
  },
  // AT13 アクション：知識3
  AT13: {
    terra: { terrans: 12, lantids: 15, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 15, nevlas: 15, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 15, darkanians: 12 }, // 惑星改造
    nav:   { terrans: 12, lantids: 15, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 15, nevlas: 15, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 15, darkanians: 12 }, // 航行
    ai:    { terrans: 12, lantids: 15, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 15, nevlas: 15, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 15, darkanians: 12 }, // 人工知能
    gaia:  { terrans: 12, lantids: 15, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 15, nevlas: 15, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 15, darkanians: 12 }, // ガイア計画
    eco:   { terrans: 12, lantids: 15, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 15, nevlas: 15, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 15, darkanians: 12 }, // 経済
    sci:   { terrans: 12, lantids: 15, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 15, nevlas: 15, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 15, darkanians: 12 }, // 科学
  },
  // AT01 パス時：同盟タイル×3VP
  AT01: {
    terra: { terrans: 17, lantids: 17, xenos: 26, gleens: 21, taklons: 17, ambas: 21, hadschHallas: 17, ivits: 26, geodens: 17, balTaks: 17, firaks: 17, bescods: 17, nevlas: 17, itars: 17, moweyds: 26, spaceGiants: 17, tinkerroids: 17, darkanians: 17 }, // 惑星改造
    nav:   { terrans: 17, lantids: 17, xenos: 26, gleens: 21, taklons: 17, ambas: 21, hadschHallas: 17, ivits: 26, geodens: 17, balTaks: 17, firaks: 17, bescods: 17, nevlas: 17, itars: 17, moweyds: 26, spaceGiants: 17, tinkerroids: 17, darkanians: 17 }, // 航行
    ai:    { terrans: 17, lantids: 17, xenos: 26, gleens: 21, taklons: 17, ambas: 21, hadschHallas: 17, ivits: 26, geodens: 17, balTaks: 17, firaks: 17, bescods: 17, nevlas: 17, itars: 17, moweyds: 26, spaceGiants: 17, tinkerroids: 17, darkanians: 17 }, // 人工知能
    gaia:  { terrans: 17, lantids: 17, xenos: 26, gleens: 21, taklons: 17, ambas: 21, hadschHallas: 17, ivits: 26, geodens: 17, balTaks: 17, firaks: 17, bescods: 17, nevlas: 17, itars: 17, moweyds: 26, spaceGiants: 17, tinkerroids: 17, darkanians: 17 }, // ガイア計画
    eco:   { terrans: 17, lantids: 17, xenos: 26, gleens: 21, taklons: 17, ambas: 21, hadschHallas: 17, ivits: 26, geodens: 17, balTaks: 17, firaks: 17, bescods: 17, nevlas: 17, itars: 17, moweyds: 26, spaceGiants: 17, tinkerroids: 17, darkanians: 17 }, // 経済
    sci:   { terrans: 17, lantids: 17, xenos: 26, gleens: 21, taklons: 17, ambas: 21, hadschHallas: 17, ivits: 26, geodens: 17, balTaks: 17, firaks: 17, bescods: 17, nevlas: 17, itars: 17, moweyds: 26, spaceGiants: 17, tinkerroids: 17, darkanians: 17 }, // 科学
  },
  // AT05 パス時：研究所×3VP
  AT05: {
    terra: { terrans: 16, lantids: 20, xenos: 16, gleens: 12, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 16, firaks: 24, bescods: 20, nevlas: 16, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // 惑星改造
    nav:   { terrans: 16, lantids: 20, xenos: 16, gleens: 12, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 16, firaks: 24, bescods: 20, nevlas: 16, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // 航行
    ai:    { terrans: 16, lantids: 20, xenos: 16, gleens: 12, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 16, firaks: 24, bescods: 20, nevlas: 16, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // 人工知能
    gaia:  { terrans: 16, lantids: 20, xenos: 16, gleens: 12, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 16, firaks: 24, bescods: 20, nevlas: 16, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // ガイア計画
    eco:   { terrans: 16, lantids: 20, xenos: 16, gleens: 12, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 16, firaks: 24, bescods: 20, nevlas: 16, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // 経済
    sci:   { terrans: 16, lantids: 20, xenos: 16, gleens: 12, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 16, firaks: 24, bescods: 20, nevlas: 16, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // 科学
  },
  // AT15 パス時：惑星種類×1VP
  AT15: {
    terra: { terrans: 14, lantids: 14, xenos: 18, gleens: 18, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 21, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14, moweyds: 14, spaceGiants: 21, tinkerroids: 18, darkanians: 21 }, // 惑星改造
    nav:   { terrans: 14, lantids: 14, xenos: 18, gleens: 18, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 21, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14, moweyds: 14, spaceGiants: 21, tinkerroids: 18, darkanians: 21 }, // 航行
    ai:    { terrans: 14, lantids: 14, xenos: 18, gleens: 18, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 21, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14, moweyds: 14, spaceGiants: 21, tinkerroids: 18, darkanians: 21 }, // 人工知能
    gaia:  { terrans: 14, lantids: 14, xenos: 18, gleens: 18, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 21, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14, moweyds: 14, spaceGiants: 21, tinkerroids: 18, darkanians: 21 }, // ガイア計画
    eco:   { terrans: 14, lantids: 14, xenos: 18, gleens: 18, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 21, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14, moweyds: 14, spaceGiants: 21, tinkerroids: 18, darkanians: 21 }, // 経済
    sci:   { terrans: 14, lantids: 14, xenos: 18, gleens: 18, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 21, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14, moweyds: 14, spaceGiants: 21, tinkerroids: 18, darkanians: 21 }, // 科学
  },
  // AT02 研究を進めるたび＋2VP
  AT02: {
    terra: { terrans: 8, lantids: 10, xenos: 8, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 12, bescods: 12, nevlas: 10, itars: 12, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // 惑星改造
    nav:   { terrans: 8, lantids: 10, xenos: 8, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 12, bescods: 12, nevlas: 10, itars: 12, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // 航行
    ai:    { terrans: 8, lantids: 10, xenos: 8, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 12, bescods: 12, nevlas: 10, itars: 12, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // 人工知能
    gaia:  { terrans: 8, lantids: 10, xenos: 8, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 12, bescods: 12, nevlas: 10, itars: 12, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // ガイア計画
    eco:   { terrans: 8, lantids: 10, xenos: 8, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 12, bescods: 12, nevlas: 10, itars: 12, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // 経済
    sci:   { terrans: 8, lantids: 10, xenos: 8, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 12, bescods: 12, nevlas: 10, itars: 12, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // 科学
  },
  // AT11 交易所を建設するたび＋3VP
  AT11: {
    terra: { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // 惑星改造
    nav:   { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // 航行
    ai:    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // 人工知能
    gaia:  { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // ガイア計画
    eco:   { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // 経済
    sci:   { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // 科学
  },
  // AT14 鉱山を建設するたび＋3VP
  AT14: {
    terra: { terrans: 7, lantids: 10, xenos: 9, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 9, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 7, spaceGiants: 10, tinkerroids: 7, darkanians: 10 }, // 惑星改造
    nav:   { terrans: 7, lantids: 10, xenos: 9, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 9, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 7, spaceGiants: 10, tinkerroids: 7, darkanians: 10 }, // 航行
    ai:    { terrans: 7, lantids: 10, xenos: 9, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 9, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 7, spaceGiants: 10, tinkerroids: 7, darkanians: 10 }, // 人工知能
    gaia:  { terrans: 7, lantids: 10, xenos: 9, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 9, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 7, spaceGiants: 10, tinkerroids: 7, darkanians: 10 }, // ガイア計画
    eco:   { terrans: 7, lantids: 10, xenos: 9, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 9, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 7, spaceGiants: 10, tinkerroids: 7, darkanians: 10 }, // 経済
    sci:   { terrans: 7, lantids: 10, xenos: 9, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 9, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 7, spaceGiants: 10, tinkerroids: 7, darkanians: 10 }, // 科学
  },
  // AT16 取得時：首府・学院×6VP
  AT16: {
    terra: { terrans: 11, lantids: 11, xenos: 11, gleens: 11, taklons: 11, ambas: 14, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 11, firaks: 11, bescods: 14, nevlas: 14, itars: 14, moweyds: 11, spaceGiants: 11, tinkerroids: 16, darkanians: 11 }, // 惑星改造
    nav:   { terrans: 11, lantids: 11, xenos: 11, gleens: 11, taklons: 11, ambas: 14, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 11, firaks: 11, bescods: 14, nevlas: 14, itars: 14, moweyds: 11, spaceGiants: 11, tinkerroids: 16, darkanians: 11 }, // 航行
    ai:    { terrans: 11, lantids: 11, xenos: 11, gleens: 11, taklons: 11, ambas: 14, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 11, firaks: 11, bescods: 14, nevlas: 14, itars: 14, moweyds: 11, spaceGiants: 11, tinkerroids: 16, darkanians: 11 }, // 人工知能
    gaia:  { terrans: 11, lantids: 11, xenos: 11, gleens: 11, taklons: 11, ambas: 14, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 11, firaks: 11, bescods: 14, nevlas: 14, itars: 14, moweyds: 11, spaceGiants: 11, tinkerroids: 16, darkanians: 11 }, // ガイア計画
    eco:   { terrans: 11, lantids: 11, xenos: 11, gleens: 11, taklons: 11, ambas: 14, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 11, firaks: 11, bescods: 14, nevlas: 14, itars: 14, moweyds: 11, spaceGiants: 11, tinkerroids: 16, darkanians: 11 }, // 経済
    sci:   { terrans: 11, lantids: 11, xenos: 11, gleens: 11, taklons: 11, ambas: 14, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 11, firaks: 11, bescods: 14, nevlas: 14, itars: 14, moweyds: 11, spaceGiants: 11, tinkerroids: 16, darkanians: 11 }, // 科学
  },
  // AT17 取得時：深宇宙宙域×4VP
  AT17: {
    terra: { terrans: 8, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 4, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 惑星改造
    nav:   { terrans: 8, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 4, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 航行
    ai:    { terrans: 8, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 4, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 人工知能
    gaia:  { terrans: 8, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 4, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // ガイア計画
    eco:   { terrans: 8, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 4, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 経済
    sci:   { terrans: 8, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 4, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 科学
  },
  // AT18 パス時：小惑星×2VP
  AT18: {
    terra: { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 7, firaks: 9, bescods: 9, nevlas: 9, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 14, darkanians: 14 }, // 惑星改造
    nav:   { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 7, firaks: 9, bescods: 9, nevlas: 9, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 14, darkanians: 14 }, // 航行
    ai:    { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 7, firaks: 9, bescods: 9, nevlas: 9, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 14, darkanians: 14 }, // 人工知能
    gaia:  { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 7, firaks: 9, bescods: 9, nevlas: 9, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 14, darkanians: 14 }, // ガイア計画
    eco:   { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 7, firaks: 9, bescods: 9, nevlas: 9, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 14, darkanians: 14 }, // 経済
    sci:   { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 7, firaks: 9, bescods: 9, nevlas: 9, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 14, darkanians: 14 }, // 科学
  },
  // AT21 パス時：深宇宙宙域×2VP
  AT21: {
    terra: { terrans: 11, lantids: 14, xenos: 14, gleens: 11, taklons: 14, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 6, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 16 }, // 惑星改造
    nav:   { terrans: 11, lantids: 14, xenos: 14, gleens: 11, taklons: 14, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 6, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 16 }, // 航行
    ai:    { terrans: 11, lantids: 14, xenos: 14, gleens: 11, taklons: 14, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 6, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 16 }, // 人工知能
    gaia:  { terrans: 11, lantids: 14, xenos: 14, gleens: 11, taklons: 14, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 6, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 16 }, // ガイア計画
    eco:   { terrans: 11, lantids: 14, xenos: 14, gleens: 11, taklons: 14, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 6, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 16 }, // 経済
    sci:   { terrans: 11, lantids: 14, xenos: 14, gleens: 11, taklons: 14, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 6, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 16 }, // 科学
  },
  // AT19 惑星改造1段階ごと＋2VP
  AT19: {
    terra: { terrans: 7, lantids: 7, xenos: 9, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 10, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 9, spaceGiants: 10, tinkerroids: 9, darkanians: 5 }, // 惑星改造
    nav:   { terrans: 7, lantids: 7, xenos: 9, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 10, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 9, spaceGiants: 10, tinkerroids: 9, darkanians: 5 }, // 航行
    ai:    { terrans: 7, lantids: 7, xenos: 9, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 10, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 9, spaceGiants: 10, tinkerroids: 9, darkanians: 5 }, // 人工知能
    gaia:  { terrans: 7, lantids: 7, xenos: 9, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 10, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 9, spaceGiants: 10, tinkerroids: 9, darkanians: 5 }, // ガイア計画
    eco:   { terrans: 7, lantids: 7, xenos: 9, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 10, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 9, spaceGiants: 10, tinkerroids: 9, darkanians: 5 }, // 経済
    sci:   { terrans: 7, lantids: 7, xenos: 9, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 10, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 9, spaceGiants: 10, tinkerroids: 9, darkanians: 5 }, // 科学
  },
  // AT20 QICアクションのたび＋4VP
  AT20: {
    terra: { terrans: 7, lantids: 7, xenos: 7, gleens: 4, taklons: 7, ambas: 7, hadschHallas: 9, ivits: 9, geodens: 7, balTaks: 10, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 7, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 惑星改造
    nav:   { terrans: 7, lantids: 7, xenos: 7, gleens: 4, taklons: 7, ambas: 7, hadschHallas: 9, ivits: 9, geodens: 7, balTaks: 10, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 7, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 航行
    ai:    { terrans: 7, lantids: 7, xenos: 7, gleens: 4, taklons: 7, ambas: 7, hadschHallas: 9, ivits: 9, geodens: 7, balTaks: 10, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 7, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 人工知能
    gaia:  { terrans: 7, lantids: 7, xenos: 7, gleens: 4, taklons: 7, ambas: 7, hadschHallas: 9, ivits: 9, geodens: 7, balTaks: 10, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 7, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // ガイア計画
    eco:   { terrans: 7, lantids: 7, xenos: 7, gleens: 4, taklons: 7, ambas: 7, hadschHallas: 9, ivits: 9, geodens: 7, balTaks: 10, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 7, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 経済
    sci:   { terrans: 7, lantids: 7, xenos: 7, gleens: 4, taklons: 7, ambas: 7, hadschHallas: 9, ivits: 9, geodens: 7, balTaks: 10, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 7, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 科学
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
 * 拡張部の上級技術は研究列に紐付かない＝どの列を登っていても取りに行けるので、
 * **研究列6つの最大値**を使う（標準技術のフリー枠と同じ理屈。techPositionCell 参照）。
 * 取得条件そのものが通常の上級と違う点は、評価指数 advExtension の係数側で見る。
 */
export function advancedTechExtensionCell(
  tileId: string,
  lostFleet: boolean
): Partial<Record<FactionId, number>> | undefined {
  const tile = advancedTechTable(lostFleet)[tileId];
  if (!tile) return undefined;
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
