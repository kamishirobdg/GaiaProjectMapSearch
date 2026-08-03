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
    terra: { terrans: 24, lantids: 30, xenos: 30, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 30, xenos: 30, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 航行
    ai:    { terrans: 24, lantids: 30, xenos: 30, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 30, xenos: 30, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 30, xenos: 30, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 経済
    sci:   { terrans: 24, lantids: 30, xenos: 30, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 科学
  },
  // AT06 取得時：宙域×鉱石1
  AT06: {
    terra: { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 航行
    ai:    { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 経済
    sci:   { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 科学
  },
  // AT08 取得時：ガイア惑星×2VP
  AT08: {
    terra: { terrans: 30, lantids: 24, xenos: 24, gleens: 30, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 30 }, // 惑星改造
    nav:   { terrans: 30, lantids: 24, xenos: 24, gleens: 30, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 30 }, // 航行
    ai:    { terrans: 30, lantids: 24, xenos: 24, gleens: 30, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 30 }, // 人工知能
    gaia:  { terrans: 30, lantids: 24, xenos: 24, gleens: 30, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 30 }, // ガイア計画
    eco:   { terrans: 30, lantids: 24, xenos: 24, gleens: 30, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 30 }, // 経済
    sci:   { terrans: 30, lantids: 24, xenos: 24, gleens: 30, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 30 }, // 科学
  },
  // AT09 取得時：交易所×4VP
  AT09: {
    terra: { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 24, nevlas: 27, itars: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 24, nevlas: 27, itars: 24 }, // 航行
    ai:    { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 24, nevlas: 27, itars: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 24, nevlas: 27, itars: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 24, nevlas: 27, itars: 24 }, // 経済
    sci:   { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 24, nevlas: 27, itars: 24 }, // 科学
  },
  // AT10 取得時：宙域×2VP
  AT10: {
    terra: { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 航行
    ai:    { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 経済
    sci:   { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 科学
  },
  // AT12 取得時：同盟タイル×5VP
  AT12: {
    terra: { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 航行
    ai:    { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 経済
    sci:   { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 科学
  },
  // AT03 アクション：QIC1＋クレジット5
  AT03: {
    terra: { terrans: 24, lantids: 24, xenos: 24, gleens: 21, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 27, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 24, xenos: 24, gleens: 21, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 27, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 航行
    ai:    { terrans: 24, lantids: 24, xenos: 24, gleens: 21, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 27, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 24, xenos: 24, gleens: 21, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 27, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 24, xenos: 24, gleens: 21, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 27, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 経済
    sci:   { terrans: 24, lantids: 24, xenos: 24, gleens: 21, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 27, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 科学
  },
  // AT07 アクション：鉱石3
  AT07: {
    terra: { terrans: 24, lantids: 24, xenos: 24, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 24, xenos: 24, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 航行
    ai:    { terrans: 24, lantids: 24, xenos: 24, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 24, xenos: 24, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 24, xenos: 24, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 経済
    sci:   { terrans: 24, lantids: 24, xenos: 24, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 科学
  },
  // AT13 アクション：知識3
  AT13: {
    terra: { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 27, nevlas: 27, itars: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 27, nevlas: 27, itars: 24 }, // 航行
    ai:    { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 27, nevlas: 27, itars: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 27, nevlas: 27, itars: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 27, nevlas: 27, itars: 24 }, // 経済
    sci:   { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 27, nevlas: 27, itars: 24 }, // 科学
  },
  // AT01 パス時：同盟タイル×3VP
  AT01: {
    terra: { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 航行
    ai:    { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 経済
    sci:   { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 科学
  },
  // AT05 パス時：研究所×3VP
  AT05: {
    terra: { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 27, nevlas: 24, itars: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 27, nevlas: 24, itars: 24 }, // 航行
    ai:    { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 27, nevlas: 24, itars: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 27, nevlas: 24, itars: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 27, nevlas: 24, itars: 24 }, // 経済
    sci:   { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 27, nevlas: 24, itars: 24 }, // 科学
  },
  // AT15 パス時：惑星種類×1VP
  AT15: {
    terra: { terrans: 24, lantids: 24, xenos: 27, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 30, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 24, xenos: 27, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 30, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 航行
    ai:    { terrans: 24, lantids: 24, xenos: 27, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 30, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 24, xenos: 27, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 30, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 24, xenos: 27, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 30, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 経済
    sci:   { terrans: 24, lantids: 24, xenos: 27, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 30, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 科学
  },
  // AT02 研究を進めるたび＋2VP
  AT02: {
    terra: { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 30, nevlas: 27, itars: 30 }, // 惑星改造
    nav:   { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 30, nevlas: 27, itars: 30 }, // 航行
    ai:    { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 30, nevlas: 27, itars: 30 }, // 人工知能
    gaia:  { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 30, nevlas: 27, itars: 30 }, // ガイア計画
    eco:   { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 30, nevlas: 27, itars: 30 }, // 経済
    sci:   { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 30, nevlas: 27, itars: 30 }, // 科学
  },
  // AT11 交易所を建設するたび＋3VP
  AT11: {
    terra: { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 27, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 24, nevlas: 27, itars: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 27, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 24, nevlas: 27, itars: 24 }, // 航行
    ai:    { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 27, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 24, nevlas: 27, itars: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 27, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 24, nevlas: 27, itars: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 27, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 24, nevlas: 27, itars: 24 }, // 経済
    sci:   { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 27, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 24, nevlas: 27, itars: 24 }, // 科学
  },
  // AT14 鉱山を建設するたび＋3VP
  AT14: {
    terra: { terrans: 24, lantids: 30, xenos: 27, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 30, xenos: 27, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 航行
    ai:    { terrans: 24, lantids: 30, xenos: 27, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 30, xenos: 27, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 30, xenos: 27, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 経済
    sci:   { terrans: 24, lantids: 30, xenos: 27, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24 }, // 科学
  },
};

/** ★拡張版（18種族×21枚）。CSV から生成。 */
export const ADVANCED_TECH_WEIGHTS_LF: AdvancedTechTable = {
  // AT04 取得時：鉱山×2VP
  AT04: {
    terra: { terrans: 24, lantids: 30, xenos: 30, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 24, darkanians: 27 }, // 惑星改造
    nav:   { terrans: 24, lantids: 30, xenos: 30, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 24, darkanians: 27 }, // 航行
    ai:    { terrans: 24, lantids: 30, xenos: 30, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 24, darkanians: 27 }, // 人工知能
    gaia:  { terrans: 24, lantids: 30, xenos: 30, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 24, darkanians: 27 }, // ガイア計画
    eco:   { terrans: 24, lantids: 30, xenos: 30, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 24, darkanians: 27 }, // 経済
    sci:   { terrans: 24, lantids: 30, xenos: 30, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 24, darkanians: 27 }, // 科学
  },
  // AT06 取得時：宙域×鉱石1
  AT06: {
    terra: { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 惑星改造
    nav:   { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 航行
    ai:    { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 人工知能
    gaia:  { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // ガイア計画
    eco:   { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 経済
    sci:   { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 科学
  },
  // AT08 取得時：ガイア惑星×2VP
  AT08: {
    terra: { terrans: 30, lantids: 24, xenos: 24, gleens: 30, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 30, moweyds: 24, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // 惑星改造
    nav:   { terrans: 30, lantids: 24, xenos: 24, gleens: 30, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 30, moweyds: 24, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // 航行
    ai:    { terrans: 30, lantids: 24, xenos: 24, gleens: 30, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 30, moweyds: 24, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // 人工知能
    gaia:  { terrans: 30, lantids: 24, xenos: 24, gleens: 30, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 30, moweyds: 24, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // ガイア計画
    eco:   { terrans: 30, lantids: 24, xenos: 24, gleens: 30, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 30, moweyds: 24, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // 経済
    sci:   { terrans: 30, lantids: 24, xenos: 24, gleens: 30, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 30, moweyds: 24, spaceGiants: 21, tinkerroids: 21, darkanians: 21 }, // 科学
  },
  // AT09 取得時：交易所×4VP
  AT09: {
    terra: { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 24, nevlas: 27, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 24, nevlas: 27, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 航行
    ai:    { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 24, nevlas: 27, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 24, nevlas: 27, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 24, nevlas: 27, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 経済
    sci:   { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 24, nevlas: 27, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 科学
  },
  // AT10 取得時：宙域×2VP
  AT10: {
    terra: { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 惑星改造
    nav:   { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 航行
    ai:    { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 人工知能
    gaia:  { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // ガイア計画
    eco:   { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 経済
    sci:   { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 科学
  },
  // AT12 取得時：同盟タイル×5VP
  AT12: {
    terra: { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 30, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 30, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 航行
    ai:    { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 30, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 30, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 30, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 経済
    sci:   { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 30, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 科学
  },
  // AT03 アクション：QIC1＋クレジット5
  AT03: {
    terra: { terrans: 24, lantids: 24, xenos: 24, gleens: 21, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 27, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 24, xenos: 24, gleens: 21, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 27, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 航行
    ai:    { terrans: 24, lantids: 24, xenos: 24, gleens: 21, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 27, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 24, xenos: 24, gleens: 21, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 27, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 24, xenos: 24, gleens: 21, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 27, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 経済
    sci:   { terrans: 24, lantids: 24, xenos: 24, gleens: 21, taklons: 27, ambas: 24, hadschHallas: 30, ivits: 27, geodens: 24, balTaks: 27, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 科学
  },
  // AT07 アクション：鉱石3
  AT07: {
    terra: { terrans: 24, lantids: 24, xenos: 24, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 27, darkanians: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 24, xenos: 24, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 27, darkanians: 24 }, // 航行
    ai:    { terrans: 24, lantids: 24, xenos: 24, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 27, darkanians: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 24, xenos: 24, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 27, darkanians: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 24, xenos: 24, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 27, darkanians: 24 }, // 経済
    sci:   { terrans: 24, lantids: 24, xenos: 24, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 27, darkanians: 24 }, // 科学
  },
  // AT13 アクション：知識3
  AT13: {
    terra: { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 27, nevlas: 27, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 27, darkanians: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 27, nevlas: 27, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 27, darkanians: 24 }, // 航行
    ai:    { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 27, nevlas: 27, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 27, darkanians: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 27, nevlas: 27, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 27, darkanians: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 27, nevlas: 27, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 27, darkanians: 24 }, // 経済
    sci:   { terrans: 24, lantids: 27, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 27, bescods: 27, nevlas: 27, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 27, darkanians: 24 }, // 科学
  },
  // AT01 パス時：同盟タイル×3VP
  AT01: {
    terra: { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 30, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 30, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 航行
    ai:    { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 30, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 30, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 30, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 経済
    sci:   { terrans: 24, lantids: 24, xenos: 30, gleens: 27, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 30, geodens: 24, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 30, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 科学
  },
  // AT05 パス時：研究所×3VP
  AT05: {
    terra: { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 27, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 27, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 航行
    ai:    { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 27, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 27, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 27, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 経済
    sci:   { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 27, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 科学
  },
  // AT15 パス時：惑星種類×1VP
  AT15: {
    terra: { terrans: 24, lantids: 24, xenos: 27, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 30, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 27, darkanians: 30 }, // 惑星改造
    nav:   { terrans: 24, lantids: 24, xenos: 27, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 30, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 27, darkanians: 30 }, // 航行
    ai:    { terrans: 24, lantids: 24, xenos: 27, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 30, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 27, darkanians: 30 }, // 人工知能
    gaia:  { terrans: 24, lantids: 24, xenos: 27, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 30, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 27, darkanians: 30 }, // ガイア計画
    eco:   { terrans: 24, lantids: 24, xenos: 27, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 30, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 27, darkanians: 30 }, // 経済
    sci:   { terrans: 24, lantids: 24, xenos: 27, gleens: 27, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 30, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 27, darkanians: 30 }, // 科学
  },
  // AT02 研究を進めるたび＋2VP
  AT02: {
    terra: { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 30, nevlas: 27, itars: 30, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 30, nevlas: 27, itars: 30, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 航行
    ai:    { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 30, nevlas: 27, itars: 30, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 30, nevlas: 27, itars: 30, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 30, nevlas: 27, itars: 30, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 経済
    sci:   { terrans: 24, lantids: 27, xenos: 24, gleens: 21, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 30, nevlas: 27, itars: 30, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 科学
  },
  // AT11 交易所を建設するたび＋3VP
  AT11: {
    terra: { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 27, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 24, nevlas: 27, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 27, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 24, nevlas: 27, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 航行
    ai:    { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 27, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 24, nevlas: 27, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 27, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 24, nevlas: 27, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 27, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 24, nevlas: 27, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 経済
    sci:   { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 27, ivits: 24, geodens: 24, balTaks: 24, firaks: 30, bescods: 24, nevlas: 27, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 科学
  },
  // AT14 鉱山を建設するたび＋3VP
  AT14: {
    terra: { terrans: 24, lantids: 30, xenos: 27, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 24, darkanians: 30 }, // 惑星改造
    nav:   { terrans: 24, lantids: 30, xenos: 27, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 24, darkanians: 30 }, // 航行
    ai:    { terrans: 24, lantids: 30, xenos: 27, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 24, darkanians: 30 }, // 人工知能
    gaia:  { terrans: 24, lantids: 30, xenos: 27, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 24, darkanians: 30 }, // ガイア計画
    eco:   { terrans: 24, lantids: 30, xenos: 27, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 24, darkanians: 30 }, // 経済
    sci:   { terrans: 24, lantids: 30, xenos: 27, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 27, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 30, tinkerroids: 24, darkanians: 30 }, // 科学
  },
  // AT16 取得時：首府・学院×6VP
  AT16: {
    terra: { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 24, bescods: 27, nevlas: 27, itars: 27, moweyds: 24, spaceGiants: 24, tinkerroids: 30, darkanians: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 24, bescods: 27, nevlas: 27, itars: 27, moweyds: 24, spaceGiants: 24, tinkerroids: 30, darkanians: 24 }, // 航行
    ai:    { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 24, bescods: 27, nevlas: 27, itars: 27, moweyds: 24, spaceGiants: 24, tinkerroids: 30, darkanians: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 24, bescods: 27, nevlas: 27, itars: 27, moweyds: 24, spaceGiants: 24, tinkerroids: 30, darkanians: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 24, bescods: 27, nevlas: 27, itars: 27, moweyds: 24, spaceGiants: 24, tinkerroids: 30, darkanians: 24 }, // 経済
    sci:   { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 27, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 24, firaks: 24, bescods: 27, nevlas: 27, itars: 27, moweyds: 24, spaceGiants: 24, tinkerroids: 30, darkanians: 24 }, // 科学
  },
  // AT17 取得時：深宇宙宙域×4VP
  AT17: {
    terra: { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 18, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 惑星改造
    nav:   { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 18, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 航行
    ai:    { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 18, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 人工知能
    gaia:  { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 18, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // ガイア計画
    eco:   { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 18, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 経済
    sci:   { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 18, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 科学
  },
  // AT18 パス時：小惑星×2VP
  AT18: {
    terra: { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 30, darkanians: 30 }, // 惑星改造
    nav:   { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 30, darkanians: 30 }, // 航行
    ai:    { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 30, darkanians: 30 }, // 人工知能
    gaia:  { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 30, darkanians: 30 }, // ガイア計画
    eco:   { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 30, darkanians: 30 }, // 経済
    sci:   { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 21, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 30, darkanians: 30 }, // 科学
  },
  // AT21 パス時：深宇宙宙域×2VP
  AT21: {
    terra: { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 18, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 惑星改造
    nav:   { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 18, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 航行
    ai:    { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 18, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 人工知能
    gaia:  { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 18, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // ガイア計画
    eco:   { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 18, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 経済
    sci:   { terrans: 24, lantids: 27, xenos: 27, gleens: 24, taklons: 27, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 18, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 30 }, // 科学
  },
  // AT19 惑星改造1段階ごと＋2VP
  AT19: {
    terra: { terrans: 24, lantids: 24, xenos: 27, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 30, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 27, spaceGiants: 30, tinkerroids: 27, darkanians: 21 }, // 惑星改造
    nav:   { terrans: 24, lantids: 24, xenos: 27, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 30, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 27, spaceGiants: 30, tinkerroids: 27, darkanians: 21 }, // 航行
    ai:    { terrans: 24, lantids: 24, xenos: 27, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 30, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 27, spaceGiants: 30, tinkerroids: 27, darkanians: 21 }, // 人工知能
    gaia:  { terrans: 24, lantids: 24, xenos: 27, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 30, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 27, spaceGiants: 30, tinkerroids: 27, darkanians: 21 }, // ガイア計画
    eco:   { terrans: 24, lantids: 24, xenos: 27, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 30, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 27, spaceGiants: 30, tinkerroids: 27, darkanians: 21 }, // 経済
    sci:   { terrans: 24, lantids: 24, xenos: 27, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 30, balTaks: 24, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 27, spaceGiants: 30, tinkerroids: 27, darkanians: 21 }, // 科学
  },
  // AT20 QICアクションのたび＋4VP
  AT20: {
    terra: { terrans: 24, lantids: 24, xenos: 24, gleens: 18, taklons: 24, ambas: 24, hadschHallas: 27, ivits: 27, geodens: 24, balTaks: 30, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 惑星改造
    nav:   { terrans: 24, lantids: 24, xenos: 24, gleens: 18, taklons: 24, ambas: 24, hadschHallas: 27, ivits: 27, geodens: 24, balTaks: 30, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 航行
    ai:    { terrans: 24, lantids: 24, xenos: 24, gleens: 18, taklons: 24, ambas: 24, hadschHallas: 27, ivits: 27, geodens: 24, balTaks: 30, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 人工知能
    gaia:  { terrans: 24, lantids: 24, xenos: 24, gleens: 18, taklons: 24, ambas: 24, hadschHallas: 27, ivits: 27, geodens: 24, balTaks: 30, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // ガイア計画
    eco:   { terrans: 24, lantids: 24, xenos: 24, gleens: 18, taklons: 24, ambas: 24, hadschHallas: 27, ivits: 27, geodens: 24, balTaks: 30, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 経済
    sci:   { terrans: 24, lantids: 24, xenos: 24, gleens: 18, taklons: 24, ambas: 24, hadschHallas: 27, ivits: 27, geodens: 24, balTaks: 30, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 科学
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
