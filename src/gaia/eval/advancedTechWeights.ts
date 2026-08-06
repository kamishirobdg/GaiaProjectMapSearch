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
    terra: { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18 }, // 惑星改造
    nav:   { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18 }, // 航行
    ai:    { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18 }, // 人工知能
    gaia:  { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18 }, // ガイア計画
    eco:   { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18 }, // 経済
    sci:   { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18 }, // 科学
  },
  // AT06 取得時：宙域×鉱石1
  AT06: {
    terra: { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 惑星改造
    nav:   { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 航行
    ai:    { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 人工知能
    gaia:  { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // ガイア計画
    eco:   { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 経済
    sci:   { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 科学
  },
  // AT08 取得時：ガイア惑星×2VP
  AT08: {
    terra: { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 13, firaks: 10, bescods: 10, nevlas: 10, itars: 15 }, // 惑星改造
    nav:   { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 13, firaks: 10, bescods: 10, nevlas: 10, itars: 15 }, // 航行
    ai:    { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 13, firaks: 10, bescods: 10, nevlas: 10, itars: 15 }, // 人工知能
    gaia:  { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 13, firaks: 10, bescods: 10, nevlas: 10, itars: 15 }, // ガイア計画
    eco:   { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 13, firaks: 10, bescods: 10, nevlas: 10, itars: 15 }, // 経済
    sci:   { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 13, firaks: 10, bescods: 10, nevlas: 10, itars: 15 }, // 科学
  },
  // AT09 取得時：交易所×4VP
  AT09: {
    terra: { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16 }, // 惑星改造
    nav:   { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16 }, // 航行
    ai:    { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16 }, // 人工知能
    gaia:  { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16 }, // ガイア計画
    eco:   { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16 }, // 経済
    sci:   { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16 }, // 科学
  },
  // AT10 取得時：宙域×2VP
  AT10: {
    terra: { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 9, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 惑星改造
    nav:   { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 9, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 航行
    ai:    { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 9, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 人工知能
    gaia:  { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 9, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // ガイア計画
    eco:   { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 9, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 経済
    sci:   { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 9, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 科学
  },
  // AT12 取得時：同盟タイル×5VP
  AT12: {
    terra: { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15 }, // 惑星改造
    nav:   { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15 }, // 航行
    ai:    { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15 }, // 人工知能
    gaia:  { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15 }, // ガイア計画
    eco:   { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15 }, // 経済
    sci:   { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15 }, // 科学
  },
  // AT03 アクション：QIC1＋クレジット5
  AT03: {
    terra: { terrans: 15, lantids: 15, xenos: 15, gleens: 12, taklons: 18, ambas: 15, hadschHallas: 22, ivits: 18, geodens: 15, balTaks: 18, firaks: 15, bescods: 15, nevlas: 15, itars: 15 }, // 惑星改造
    nav:   { terrans: 15, lantids: 15, xenos: 15, gleens: 12, taklons: 18, ambas: 15, hadschHallas: 22, ivits: 18, geodens: 15, balTaks: 18, firaks: 15, bescods: 15, nevlas: 15, itars: 15 }, // 航行
    ai:    { terrans: 15, lantids: 15, xenos: 15, gleens: 12, taklons: 18, ambas: 15, hadschHallas: 22, ivits: 18, geodens: 15, balTaks: 18, firaks: 15, bescods: 15, nevlas: 15, itars: 15 }, // 人工知能
    gaia:  { terrans: 15, lantids: 15, xenos: 15, gleens: 12, taklons: 18, ambas: 15, hadschHallas: 22, ivits: 18, geodens: 15, balTaks: 18, firaks: 15, bescods: 15, nevlas: 15, itars: 15 }, // ガイア計画
    eco:   { terrans: 15, lantids: 15, xenos: 15, gleens: 12, taklons: 18, ambas: 15, hadschHallas: 22, ivits: 18, geodens: 15, balTaks: 18, firaks: 15, bescods: 15, nevlas: 15, itars: 15 }, // 経済
    sci:   { terrans: 15, lantids: 15, xenos: 15, gleens: 12, taklons: 18, ambas: 15, hadschHallas: 22, ivits: 18, geodens: 15, balTaks: 18, firaks: 15, bescods: 15, nevlas: 15, itars: 15 }, // 科学
  },
  // AT07 アクション：鉱石3
  AT07: {
    terra: { terrans: 13, lantids: 13, xenos: 13, gleens: 16, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 16, balTaks: 13, firaks: 13, bescods: 13, nevlas: 13, itars: 13 }, // 惑星改造
    nav:   { terrans: 13, lantids: 13, xenos: 13, gleens: 16, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 16, balTaks: 13, firaks: 13, bescods: 13, nevlas: 13, itars: 13 }, // 航行
    ai:    { terrans: 13, lantids: 13, xenos: 13, gleens: 16, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 16, balTaks: 13, firaks: 13, bescods: 13, nevlas: 13, itars: 13 }, // 人工知能
    gaia:  { terrans: 13, lantids: 13, xenos: 13, gleens: 16, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 16, balTaks: 13, firaks: 13, bescods: 13, nevlas: 13, itars: 13 }, // ガイア計画
    eco:   { terrans: 13, lantids: 13, xenos: 13, gleens: 16, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 16, balTaks: 13, firaks: 13, bescods: 13, nevlas: 13, itars: 13 }, // 経済
    sci:   { terrans: 13, lantids: 13, xenos: 13, gleens: 16, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 16, balTaks: 13, firaks: 13, bescods: 13, nevlas: 13, itars: 13 }, // 科学
  },
  // AT13 アクション：知識3
  AT13: {
    terra: { terrans: 18, lantids: 22, xenos: 18, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 18, balTaks: 18, firaks: 22, bescods: 22, nevlas: 22, itars: 18 }, // 惑星改造
    nav:   { terrans: 18, lantids: 22, xenos: 18, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 18, balTaks: 18, firaks: 22, bescods: 22, nevlas: 22, itars: 18 }, // 航行
    ai:    { terrans: 18, lantids: 22, xenos: 18, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 18, balTaks: 18, firaks: 22, bescods: 22, nevlas: 22, itars: 18 }, // 人工知能
    gaia:  { terrans: 18, lantids: 22, xenos: 18, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 18, balTaks: 18, firaks: 22, bescods: 22, nevlas: 22, itars: 18 }, // ガイア計画
    eco:   { terrans: 18, lantids: 22, xenos: 18, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 18, balTaks: 18, firaks: 22, bescods: 22, nevlas: 22, itars: 18 }, // 経済
    sci:   { terrans: 18, lantids: 22, xenos: 18, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 18, balTaks: 18, firaks: 22, bescods: 22, nevlas: 22, itars: 18 }, // 科学
  },
  // AT01 パス時：同盟タイル×3VP
  AT01: {
    terra: { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, balTaks: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21 }, // 惑星改造
    nav:   { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, balTaks: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21 }, // 航行
    ai:    { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, balTaks: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21 }, // 人工知能
    gaia:  { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, balTaks: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21 }, // ガイア計画
    eco:   { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, balTaks: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21 }, // 経済
    sci:   { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, balTaks: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21 }, // 科学
  },
  // AT05 パス時：研究所×3VP
  AT05: {
    terra: { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, balTaks: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20 }, // 惑星改造
    nav:   { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, balTaks: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20 }, // 航行
    ai:    { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, balTaks: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20 }, // 人工知能
    gaia:  { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, balTaks: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20 }, // ガイア計画
    eco:   { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, balTaks: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20 }, // 経済
    sci:   { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, balTaks: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20 }, // 科学
  },
  // AT15 パス時：惑星種類×1VP
  AT15: {
    terra: { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18 }, // 惑星改造
    nav:   { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18 }, // 航行
    ai:    { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18 }, // 人工知能
    gaia:  { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18 }, // ガイア計画
    eco:   { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18 }, // 経済
    sci:   { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18 }, // 科学
  },
  // AT02 研究を進めるたび＋2VP
  AT02: {
    terra: { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18 }, // 惑星改造
    nav:   { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18 }, // 航行
    ai:    { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18 }, // 人工知能
    gaia:  { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18 }, // ガイア計画
    eco:   { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18 }, // 経済
    sci:   { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18 }, // 科学
  },
  // AT11 交易所を建設するたび＋3VP
  AT11: {
    terra: { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9 }, // 惑星改造
    nav:   { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9 }, // 航行
    ai:    { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9 }, // 人工知能
    gaia:  { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9 }, // ガイア計画
    eco:   { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9 }, // 経済
    sci:   { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9 }, // 科学
  },
  // AT14 鉱山を建設するたび＋3VP
  AT14: {
    terra: { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11 }, // 惑星改造
    nav:   { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11 }, // 航行
    ai:    { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11 }, // 人工知能
    gaia:  { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11 }, // ガイア計画
    eco:   { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11 }, // 経済
    sci:   { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11 }, // 科学
  },
};

/** ★拡張版（18種族×21枚）。CSV から生成。 */
export const ADVANCED_TECH_WEIGHTS_LF: AdvancedTechTable = {
  // AT04 取得時：鉱山×2VP
  AT04: {
    terra: { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 18, darkanians: 23 }, // 惑星改造
    nav:   { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 18, darkanians: 23 }, // 航行
    ai:    { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 18, darkanians: 23 }, // 人工知能
    gaia:  { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 18, darkanians: 23 }, // ガイア計画
    eco:   { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 18, darkanians: 23 }, // 経済
    sci:   { terrans: 18, lantids: 27, xenos: 27, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 23, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 18, darkanians: 23 }, // 科学
  },
  // AT06 取得時：宙域×鉱石1
  AT06: {
    terra: { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 惑星改造
    nav:   { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 航行
    ai:    { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 人工知能
    gaia:  { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // ガイア計画
    eco:   { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 経済
    sci:   { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 科学
  },
  // AT08 取得時：ガイア惑星×2VP
  AT08: {
    terra: { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 13, firaks: 10, bescods: 10, nevlas: 10, itars: 15, moweyds: 10, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 惑星改造
    nav:   { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 13, firaks: 10, bescods: 10, nevlas: 10, itars: 15, moweyds: 10, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 航行
    ai:    { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 13, firaks: 10, bescods: 10, nevlas: 10, itars: 15, moweyds: 10, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 人工知能
    gaia:  { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 13, firaks: 10, bescods: 10, nevlas: 10, itars: 15, moweyds: 10, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // ガイア計画
    eco:   { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 13, firaks: 10, bescods: 10, nevlas: 10, itars: 15, moweyds: 10, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 経済
    sci:   { terrans: 15, lantids: 10, xenos: 10, gleens: 15, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 13, firaks: 10, bescods: 10, nevlas: 10, itars: 15, moweyds: 10, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 科学
  },
  // AT09 取得時：交易所×4VP
  AT09: {
    terra: { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // 惑星改造
    nav:   { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // 航行
    ai:    { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // 人工知能
    gaia:  { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // ガイア計画
    eco:   { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // 経済
    sci:   { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 20, ambas: 16, hadschHallas: 24, ivits: 16, geodens: 16, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // 科学
  },
  // AT10 取得時：宙域×2VP
  AT10: {
    terra: { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 9, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 惑星改造
    nav:   { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 9, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 航行
    ai:    { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 9, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 人工知能
    gaia:  { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 9, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // ガイア計画
    eco:   { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 9, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 経済
    sci:   { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 9, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 科学
  },
  // AT12 取得時：同盟タイル×5VP
  AT12: {
    terra: { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 22, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // 惑星改造
    nav:   { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 22, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // 航行
    ai:    { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 22, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // 人工知能
    gaia:  { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 22, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // ガイア計画
    eco:   { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 22, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // 経済
    sci:   { terrans: 15, lantids: 15, xenos: 22, gleens: 19, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 22, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 22, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // 科学
  },
  // AT03 アクション：QIC1＋クレジット5
  AT03: {
    terra: { terrans: 15, lantids: 15, xenos: 15, gleens: 12, taklons: 18, ambas: 15, hadschHallas: 22, ivits: 18, geodens: 15, balTaks: 18, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // 惑星改造
    nav:   { terrans: 15, lantids: 15, xenos: 15, gleens: 12, taklons: 18, ambas: 15, hadschHallas: 22, ivits: 18, geodens: 15, balTaks: 18, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // 航行
    ai:    { terrans: 15, lantids: 15, xenos: 15, gleens: 12, taklons: 18, ambas: 15, hadschHallas: 22, ivits: 18, geodens: 15, balTaks: 18, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // 人工知能
    gaia:  { terrans: 15, lantids: 15, xenos: 15, gleens: 12, taklons: 18, ambas: 15, hadschHallas: 22, ivits: 18, geodens: 15, balTaks: 18, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // ガイア計画
    eco:   { terrans: 15, lantids: 15, xenos: 15, gleens: 12, taklons: 18, ambas: 15, hadschHallas: 22, ivits: 18, geodens: 15, balTaks: 18, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // 経済
    sci:   { terrans: 15, lantids: 15, xenos: 15, gleens: 12, taklons: 18, ambas: 15, hadschHallas: 22, ivits: 18, geodens: 15, balTaks: 18, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // 科学
  },
  // AT07 アクション：鉱石3
  AT07: {
    terra: { terrans: 13, lantids: 13, xenos: 13, gleens: 16, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 16, balTaks: 13, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 20, tinkerroids: 16, darkanians: 13 }, // 惑星改造
    nav:   { terrans: 13, lantids: 13, xenos: 13, gleens: 16, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 16, balTaks: 13, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 20, tinkerroids: 16, darkanians: 13 }, // 航行
    ai:    { terrans: 13, lantids: 13, xenos: 13, gleens: 16, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 16, balTaks: 13, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 20, tinkerroids: 16, darkanians: 13 }, // 人工知能
    gaia:  { terrans: 13, lantids: 13, xenos: 13, gleens: 16, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 16, balTaks: 13, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 20, tinkerroids: 16, darkanians: 13 }, // ガイア計画
    eco:   { terrans: 13, lantids: 13, xenos: 13, gleens: 16, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 16, balTaks: 13, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 20, tinkerroids: 16, darkanians: 13 }, // 経済
    sci:   { terrans: 13, lantids: 13, xenos: 13, gleens: 16, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 16, balTaks: 13, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 20, tinkerroids: 16, darkanians: 13 }, // 科学
  },
  // AT13 アクション：知識3
  AT13: {
    terra: { terrans: 18, lantids: 22, xenos: 18, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 18, balTaks: 18, firaks: 22, bescods: 22, nevlas: 22, itars: 18, moweyds: 18, spaceGiants: 18, tinkerroids: 22, darkanians: 18 }, // 惑星改造
    nav:   { terrans: 18, lantids: 22, xenos: 18, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 18, balTaks: 18, firaks: 22, bescods: 22, nevlas: 22, itars: 18, moweyds: 18, spaceGiants: 18, tinkerroids: 22, darkanians: 18 }, // 航行
    ai:    { terrans: 18, lantids: 22, xenos: 18, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 18, balTaks: 18, firaks: 22, bescods: 22, nevlas: 22, itars: 18, moweyds: 18, spaceGiants: 18, tinkerroids: 22, darkanians: 18 }, // 人工知能
    gaia:  { terrans: 18, lantids: 22, xenos: 18, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 18, balTaks: 18, firaks: 22, bescods: 22, nevlas: 22, itars: 18, moweyds: 18, spaceGiants: 18, tinkerroids: 22, darkanians: 18 }, // ガイア計画
    eco:   { terrans: 18, lantids: 22, xenos: 18, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 18, balTaks: 18, firaks: 22, bescods: 22, nevlas: 22, itars: 18, moweyds: 18, spaceGiants: 18, tinkerroids: 22, darkanians: 18 }, // 経済
    sci:   { terrans: 18, lantids: 22, xenos: 18, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 18, balTaks: 18, firaks: 22, bescods: 22, nevlas: 22, itars: 18, moweyds: 18, spaceGiants: 18, tinkerroids: 22, darkanians: 18 }, // 科学
  },
  // AT01 パス時：同盟タイル×3VP
  AT01: {
    terra: { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, balTaks: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21, moweyds: 32, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // 惑星改造
    nav:   { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, balTaks: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21, moweyds: 32, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // 航行
    ai:    { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, balTaks: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21, moweyds: 32, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // 人工知能
    gaia:  { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, balTaks: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21, moweyds: 32, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // ガイア計画
    eco:   { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, balTaks: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21, moweyds: 32, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // 経済
    sci:   { terrans: 21, lantids: 21, xenos: 32, gleens: 26, taklons: 21, ambas: 26, hadschHallas: 21, ivits: 32, geodens: 21, balTaks: 21, firaks: 21, bescods: 21, nevlas: 21, itars: 21, moweyds: 32, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // 科学
  },
  // AT05 パス時：研究所×3VP
  AT05: {
    terra: { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, balTaks: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20, moweyds: 20, spaceGiants: 20, tinkerroids: 20, darkanians: 20 }, // 惑星改造
    nav:   { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, balTaks: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20, moweyds: 20, spaceGiants: 20, tinkerroids: 20, darkanians: 20 }, // 航行
    ai:    { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, balTaks: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20, moweyds: 20, spaceGiants: 20, tinkerroids: 20, darkanians: 20 }, // 人工知能
    gaia:  { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, balTaks: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20, moweyds: 20, spaceGiants: 20, tinkerroids: 20, darkanians: 20 }, // ガイア計画
    eco:   { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, balTaks: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20, moweyds: 20, spaceGiants: 20, tinkerroids: 20, darkanians: 20 }, // 経済
    sci:   { terrans: 20, lantids: 25, xenos: 20, gleens: 15, taklons: 20, ambas: 20, hadschHallas: 20, ivits: 20, geodens: 20, balTaks: 20, firaks: 30, bescods: 25, nevlas: 20, itars: 20, moweyds: 20, spaceGiants: 20, tinkerroids: 20, darkanians: 20 }, // 科学
  },
  // AT15 パス時：惑星種類×1VP
  AT15: {
    terra: { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 23, darkanians: 27 }, // 惑星改造
    nav:   { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 23, darkanians: 27 }, // 航行
    ai:    { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 23, darkanians: 27 }, // 人工知能
    gaia:  { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 23, darkanians: 27 }, // ガイア計画
    eco:   { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 23, darkanians: 27 }, // 経済
    sci:   { terrans: 18, lantids: 18, xenos: 23, gleens: 23, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 27, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18, moweyds: 18, spaceGiants: 27, tinkerroids: 23, darkanians: 27 }, // 科学
  },
  // AT02 研究を進めるたび＋2VP
  AT02: {
    terra: { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 惑星改造
    nav:   { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 航行
    ai:    { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 人工知能
    gaia:  { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // ガイア計画
    eco:   { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 経済
    sci:   { terrans: 12, lantids: 15, xenos: 12, gleens: 9, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 18, bescods: 18, nevlas: 15, itars: 18, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 科学
  },
  // AT11 交易所を建設するたび＋3VP
  AT11: {
    terra: { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // 惑星改造
    nav:   { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // 航行
    ai:    { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // 人工知能
    gaia:  { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // ガイア計画
    eco:   { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // 経済
    sci:   { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 11, ivits: 9, geodens: 9, balTaks: 9, firaks: 14, bescods: 9, nevlas: 11, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // 科学
  },
  // AT14 鉱山を建設するたび＋3VP
  AT14: {
    terra: { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 16, tinkerroids: 11, darkanians: 16 }, // 惑星改造
    nav:   { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 16, tinkerroids: 11, darkanians: 16 }, // 航行
    ai:    { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 16, tinkerroids: 11, darkanians: 16 }, // 人工知能
    gaia:  { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 16, tinkerroids: 11, darkanians: 16 }, // ガイア計画
    eco:   { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 16, tinkerroids: 11, darkanians: 16 }, // 経済
    sci:   { terrans: 11, lantids: 16, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 14, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 16, tinkerroids: 11, darkanians: 16 }, // 科学
  },
  // AT16 取得時：首府・学院×6VP
  AT16: {
    terra: { terrans: 15, lantids: 15, xenos: 15, gleens: 15, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 15, firaks: 15, bescods: 19, nevlas: 19, itars: 19, moweyds: 15, spaceGiants: 15, tinkerroids: 22, darkanians: 15 }, // 惑星改造
    nav:   { terrans: 15, lantids: 15, xenos: 15, gleens: 15, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 15, firaks: 15, bescods: 19, nevlas: 19, itars: 19, moweyds: 15, spaceGiants: 15, tinkerroids: 22, darkanians: 15 }, // 航行
    ai:    { terrans: 15, lantids: 15, xenos: 15, gleens: 15, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 15, firaks: 15, bescods: 19, nevlas: 19, itars: 19, moweyds: 15, spaceGiants: 15, tinkerroids: 22, darkanians: 15 }, // 人工知能
    gaia:  { terrans: 15, lantids: 15, xenos: 15, gleens: 15, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 15, firaks: 15, bescods: 19, nevlas: 19, itars: 19, moweyds: 15, spaceGiants: 15, tinkerroids: 22, darkanians: 15 }, // ガイア計画
    eco:   { terrans: 15, lantids: 15, xenos: 15, gleens: 15, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 15, firaks: 15, bescods: 19, nevlas: 19, itars: 19, moweyds: 15, spaceGiants: 15, tinkerroids: 22, darkanians: 15 }, // 経済
    sci:   { terrans: 15, lantids: 15, xenos: 15, gleens: 15, taklons: 15, ambas: 19, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 15, firaks: 15, bescods: 19, nevlas: 19, itars: 19, moweyds: 15, spaceGiants: 15, tinkerroids: 22, darkanians: 15 }, // 科学
  },
  // AT17 取得時：深宇宙宙域×4VP
  AT17: {
    terra: { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 6, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 惑星改造
    nav:   { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 6, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 航行
    ai:    { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 6, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 人工知能
    gaia:  { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 6, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // ガイア計画
    eco:   { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 6, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 経済
    sci:   { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 6, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 18 }, // 科学
  },
  // AT18 パス時：小惑星×2VP
  AT18: {
    terra: { terrans: 13, lantids: 13, xenos: 13, gleens: 13, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 13, balTaks: 10, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 13, tinkerroids: 20, darkanians: 20 }, // 惑星改造
    nav:   { terrans: 13, lantids: 13, xenos: 13, gleens: 13, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 13, balTaks: 10, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 13, tinkerroids: 20, darkanians: 20 }, // 航行
    ai:    { terrans: 13, lantids: 13, xenos: 13, gleens: 13, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 13, balTaks: 10, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 13, tinkerroids: 20, darkanians: 20 }, // 人工知能
    gaia:  { terrans: 13, lantids: 13, xenos: 13, gleens: 13, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 13, balTaks: 10, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 13, tinkerroids: 20, darkanians: 20 }, // ガイア計画
    eco:   { terrans: 13, lantids: 13, xenos: 13, gleens: 13, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 13, balTaks: 10, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 13, tinkerroids: 20, darkanians: 20 }, // 経済
    sci:   { terrans: 13, lantids: 13, xenos: 13, gleens: 13, taklons: 13, ambas: 13, hadschHallas: 13, ivits: 13, geodens: 13, balTaks: 10, firaks: 13, bescods: 13, nevlas: 13, itars: 13, moweyds: 13, spaceGiants: 13, tinkerroids: 20, darkanians: 20 }, // 科学
  },
  // AT21 パス時：深宇宙宙域×2VP
  AT21: {
    terra: { terrans: 15, lantids: 19, xenos: 19, gleens: 15, taklons: 19, ambas: 15, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 8, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 22 }, // 惑星改造
    nav:   { terrans: 15, lantids: 19, xenos: 19, gleens: 15, taklons: 19, ambas: 15, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 8, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 22 }, // 航行
    ai:    { terrans: 15, lantids: 19, xenos: 19, gleens: 15, taklons: 19, ambas: 15, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 8, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 22 }, // 人工知能
    gaia:  { terrans: 15, lantids: 19, xenos: 19, gleens: 15, taklons: 19, ambas: 15, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 8, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 22 }, // ガイア計画
    eco:   { terrans: 15, lantids: 19, xenos: 19, gleens: 15, taklons: 19, ambas: 15, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 8, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 22 }, // 経済
    sci:   { terrans: 15, lantids: 19, xenos: 19, gleens: 15, taklons: 19, ambas: 15, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 8, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 22 }, // 科学
  },
  // AT19 惑星改造1段階ごと＋2VP
  AT19: {
    terra: { terrans: 11, lantids: 11, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 16, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 14, spaceGiants: 16, tinkerroids: 14, darkanians: 8 }, // 惑星改造
    nav:   { terrans: 11, lantids: 11, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 16, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 14, spaceGiants: 16, tinkerroids: 14, darkanians: 8 }, // 航行
    ai:    { terrans: 11, lantids: 11, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 16, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 14, spaceGiants: 16, tinkerroids: 14, darkanians: 8 }, // 人工知能
    gaia:  { terrans: 11, lantids: 11, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 16, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 14, spaceGiants: 16, tinkerroids: 14, darkanians: 8 }, // ガイア計画
    eco:   { terrans: 11, lantids: 11, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 16, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 14, spaceGiants: 16, tinkerroids: 14, darkanians: 8 }, // 経済
    sci:   { terrans: 11, lantids: 11, xenos: 14, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 16, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 14, spaceGiants: 16, tinkerroids: 14, darkanians: 8 }, // 科学
  },
  // AT20 QICアクションのたび＋4VP
  AT20: {
    terra: { terrans: 11, lantids: 11, xenos: 11, gleens: 6, taklons: 11, ambas: 11, hadschHallas: 14, ivits: 14, geodens: 11, balTaks: 16, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // 惑星改造
    nav:   { terrans: 11, lantids: 11, xenos: 11, gleens: 6, taklons: 11, ambas: 11, hadschHallas: 14, ivits: 14, geodens: 11, balTaks: 16, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // 航行
    ai:    { terrans: 11, lantids: 11, xenos: 11, gleens: 6, taklons: 11, ambas: 11, hadschHallas: 14, ivits: 14, geodens: 11, balTaks: 16, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // 人工知能
    gaia:  { terrans: 11, lantids: 11, xenos: 11, gleens: 6, taklons: 11, ambas: 11, hadschHallas: 14, ivits: 14, geodens: 11, balTaks: 16, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // ガイア計画
    eco:   { terrans: 11, lantids: 11, xenos: 11, gleens: 6, taklons: 11, ambas: 11, hadschHallas: 14, ivits: 14, geodens: 11, balTaks: 16, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // 経済
    sci:   { terrans: 11, lantids: 11, xenos: 11, gleens: 6, taklons: 11, ambas: 11, hadschHallas: 14, ivits: 14, geodens: 11, balTaks: 16, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // 科学
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
