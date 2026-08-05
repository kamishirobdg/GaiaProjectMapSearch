// src/gaia/eval/techPositionWeights.ts
//
// 標準技術の重みテーブル（タイル → 研究列 → 種族 → 値）。**自動生成ファイル**:
//   python scripts/gen_tech_position_table.py --emit-file <このパス> <base.csv> <lf.csv>
// 手で直さず、CSV を直して生成し直すこと（検算は `<csv> --check`）。
//
// 値は **VP 換算**（2026-08-03 ユーザー確定。全カテゴリを同じ物差しへ移す途中）。
// 「その列の下に置かれたこのタイルを取れたら何点分か」。中央値は12で、上級技術（24）の
// 半分 —— 9枚すべてが場に出て取りやすい代わり、1枚の効果は上級より小さい。
//
// **研究列6つだけを書く。フリー枠は書かない**。ルールブック p13「技術タイルの獲得」:
// 研究エリアの真下の6枚はその研究エリアでのみマーカーを進められ、進められない場合は
// 進展分が失われる。フリー枠の3枚は任意の研究エリア1つを進められる。つまりフリー枠は
// 常にトラック配置の完全な上位互換で、利益は「登りたい列を選べる」ことに尽きる。だから
//   free = そのタイルの研究列6つのうち最大値
// が正しく、techPositionCell() がそれを計算する（データには持たない）。
//
// 通常版 9タイル×6列×14種族＝756セル / 拡張版 9×6×18＝972セル。
// 拡張の有無で場に出るタイルの母集団が変わるので表を分ける。

import type { ResearchTrackId } from "@/gaia/setup/types";
import type { FactionId } from "./factionWeights";

/** 標準技術の置き場所: 研究列6つ、または列に紐付かないフリー枠。 */
export type TechPosition = ResearchTrackId | "free";

export type TechPositionTable = Record<
  string,
  Partial<Record<ResearchTrackId, Partial<Record<FactionId, number>>>>
>;

/** ★通常版（基本14種族×9枚）。CSV から生成。 */
export const TECH_POSITION_WEIGHTS_BASE: TechPositionTable = {
  // TS1 即時:鉱石1+QIC1
  TS1: {
    terra: { terrans: 11, lantids: 15, xenos: 18, gleens: 11, taklons: 15, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 15, balTaks: 15, firaks: 18, bescods: 11, nevlas: 15, itars: 15 }, // 惑星改造
    nav:   { terrans: 11, lantids: 15, xenos: 18, gleens: 7, taklons: 15, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 15, balTaks: 7, firaks: 15, bescods: 15, nevlas: 15, itars: 15 }, // 航行
    ai:    { terrans: 11, lantids: 15, xenos: 18, gleens: 11, taklons: 15, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 11, balTaks: 15, firaks: 11, bescods: 11, nevlas: 15, itars: 15 }, // 人工知能
    gaia:  { terrans: 11, lantids: 11, xenos: 11, gleens: 7, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 15, firaks: 11, bescods: 11, nevlas: 11, itars: 15 }, // ガイア計画
    eco:   { terrans: 11, lantids: 15, xenos: 15, gleens: 11, taklons: 15, ambas: 15, hadschHallas: 18, ivits: 15, geodens: 11, balTaks: 11, firaks: 18, bescods: 15, nevlas: 15, itars: 15 }, // 経済
    sci:   { terrans: 11, lantids: 11, xenos: 11, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 15, itars: 11 }, // 科学
  },
  // TS2 即時:惑星種類×知識1
  TS2: {
    terra: { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 6, ambas: 5, hadschHallas: 5, ivits: 8, geodens: 10, balTaks: 8, firaks: 5, bescods: 5, nevlas: 8, itars: 5 }, // 惑星改造
    nav:   { terrans: 5, lantids: 5, xenos: 5, gleens: 4, taklons: 6, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 9, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // 航行
    ai:    { terrans: 5, lantids: 5, xenos: 8, gleens: 5, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 11, balTaks: 8, firaks: 6, bescods: 5, nevlas: 8, itars: 6 }, // 人工知能
    gaia:  { terrans: 4, lantids: 5, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // ガイア計画
    eco:   { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 6, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // 経済
    sci:   { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 6, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 6, balTaks: 5, firaks: 5, bescods: 5, nevlas: 8, itars: 5 }, // 科学
  },
  // TS3 首府学院のパワー値4
  TS3: {
    terra: { terrans: 12, lantids: 15, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 15, nevlas: 12, itars: 12 }, // 惑星改造
    nav:   { terrans: 18, lantids: 15, xenos: 12, gleens: 15, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 18, nevlas: 12, itars: 12 }, // 航行
    ai:    { terrans: 12, lantids: 15, xenos: 15, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 18, nevlas: 12, itars: 15 }, // 人工知能
    gaia:  { terrans: 18, lantids: 9, xenos: 9, gleens: 18, taklons: 6, ambas: 9, hadschHallas: 9, ivits: 15, geodens: 9, balTaks: 18, firaks: 12, bescods: 15, nevlas: 6, itars: 18 }, // ガイア計画
    eco:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 15, ambas: 12, hadschHallas: 15, ivits: 12, geodens: 12, balTaks: 12, firaks: 15, bescods: 18, nevlas: 15, itars: 15 }, // 経済
    sci:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 科学
  },
  // TS4 即時:7VP
  TS4: {
    terra: { terrans: 7, lantids: 7, xenos: 7, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 7, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7 }, // 惑星改造
    nav:   { terrans: 7, lantids: 7, xenos: 7, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 7, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7 }, // 航行
    ai:    { terrans: 7, lantids: 7, xenos: 7, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 7, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7 }, // 人工知能
    gaia:  { terrans: 7, lantids: 7, xenos: 7, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 7, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7 }, // ガイア計画
    eco:   { terrans: 7, lantids: 7, xenos: 7, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 7, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7 }, // 経済
    sci:   { terrans: 7, lantids: 7, xenos: 7, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 7, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7 }, // 科学
  },
  // TS5 収入:鉱石1+パワー1
  TS5: {
    terra: { terrans: 11, lantids: 14, xenos: 14, gleens: 14, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 14, balTaks: 14, firaks: 14, bescods: 11, nevlas: 14, itars: 14 }, // 惑星改造
    nav:   { terrans: 14, lantids: 14, xenos: 14, gleens: 14, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 14, balTaks: 9, firaks: 11, bescods: 16, nevlas: 14, itars: 16 }, // 航行
    ai:    { terrans: 9, lantids: 9, xenos: 14, gleens: 9, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 9, balTaks: 9, firaks: 11, bescods: 9, nevlas: 11, itars: 14 }, // 人工知能
    gaia:  { terrans: 14, lantids: 9, xenos: 9, gleens: 14, taklons: 4, ambas: 9, hadschHallas: 9, ivits: 11, geodens: 9, balTaks: 16, firaks: 9, bescods: 9, nevlas: 4, itars: 14 }, // ガイア計画
    eco:   { terrans: 9, lantids: 16, xenos: 14, gleens: 9, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 11, balTaks: 14, firaks: 16, bescods: 14, nevlas: 16, itars: 16 }, // 経済
    sci:   { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 11, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 11, balTaks: 9, firaks: 9, bescods: 9, nevlas: 11, itars: 9 }, // 科学
  },
  // TS6 収入:知識1+クレ1
  TS6: {
    terra: { terrans: 11, lantids: 16, xenos: 11, gleens: 11, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 14, geodens: 16, balTaks: 16, firaks: 16, bescods: 14, nevlas: 14, itars: 14 }, // 惑星改造
    nav:   { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 19, ambas: 19, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 11, firaks: 16, bescods: 16, nevlas: 16, itars: 16 }, // 航行
    ai:    { terrans: 14, lantids: 14, xenos: 16, gleens: 11, taklons: 14, ambas: 16, hadschHallas: 11, ivits: 16, geodens: 11, balTaks: 11, firaks: 11, bescods: 14, nevlas: 11, itars: 14 }, // 人工知能
    gaia:  { terrans: 19, lantids: 11, xenos: 11, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 8, ivits: 11, geodens: 11, balTaks: 19, firaks: 11, bescods: 11, nevlas: 8, itars: 16 }, // ガイア計画
    eco:   { terrans: 11, lantids: 16, xenos: 11, gleens: 11, taklons: 16, ambas: 19, hadschHallas: 19, ivits: 19, geodens: 16, balTaks: 16, firaks: 19, bescods: 16, nevlas: 19, itars: 14 }, // 経済
    sci:   { terrans: 14, lantids: 16, xenos: 11, gleens: 19, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 14, geodens: 14, balTaks: 14, firaks: 19, bescods: 14, nevlas: 19, itars: 16 }, // 科学
  },
  // TS7 ガイア鉱山+3VP
  TS7: {
    terra: { terrans: 12, lantids: 8, xenos: 8, gleens: 12, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 惑星改造
    nav:   { terrans: 16, lantids: 8, xenos: 8, gleens: 16, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 10 }, // 航行
    ai:    { terrans: 12, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 12, firaks: 8, bescods: 8, nevlas: 8, itars: 10 }, // 人工知能
    gaia:  { terrans: 16, lantids: 8, xenos: 8, gleens: 16, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 10, geodens: 8, balTaks: 10, firaks: 8, bescods: 12, nevlas: 8, itars: 12 }, // ガイア計画
    eco:   { terrans: 10, lantids: 8, xenos: 8, gleens: 10, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 経済
    sci:   { terrans: 10, lantids: 8, xenos: 8, gleens: 10, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 科学
  },
  // TS8 収入:クレ4
  TS8: {
    terra: { terrans: 15, lantids: 15, xenos: 15, gleens: 18, taklons: 15, ambas: 15, hadschHallas: 15, ivits: 15, geodens: 15, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15 }, // 惑星改造
    nav:   { terrans: 18, lantids: 18, xenos: 18, gleens: 20, taklons: 18, ambas: 20, hadschHallas: 20, ivits: 18, geodens: 18, balTaks: 10, firaks: 18, bescods: 18, nevlas: 18, itars: 18 }, // 航行
    ai:    { terrans: 12, lantids: 12, xenos: 18, gleens: 10, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 人工知能
    gaia:  { terrans: 20, lantids: 10, xenos: 10, gleens: 18, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 20, firaks: 10, bescods: 12, nevlas: 10, itars: 10 }, // ガイア計画
    eco:   { terrans: 15, lantids: 18, xenos: 18, gleens: 15, taklons: 18, ambas: 18, hadschHallas: 20, ivits: 15, geodens: 15, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18 }, // 経済
    sci:   { terrans: 10, lantids: 12, xenos: 12, gleens: 10, taklons: 10, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 10, balTaks: 10, firaks: 12, bescods: 15, nevlas: 12, itars: 12 }, // 科学
  },
  // TS9 アクション:パワー4
  TS9: {
    terra: { terrans: 12, lantids: 17, xenos: 15, gleens: 15, taklons: 21, ambas: 17, hadschHallas: 17, ivits: 17, geodens: 17, balTaks: 17, firaks: 17, bescods: 17, nevlas: 21, itars: 17 }, // 惑星改造
    nav:   { terrans: 21, lantids: 21, xenos: 21, gleens: 21, taklons: 27, ambas: 21, hadschHallas: 21, ivits: 21, geodens: 21, balTaks: 12, firaks: 21, bescods: 21, nevlas: 21, itars: 17 }, // 航行
    ai:    { terrans: 12, lantids: 12, xenos: 21, gleens: 12, taklons: 21, ambas: 17, hadschHallas: 17, ivits: 17, geodens: 17, balTaks: 17, firaks: 17, bescods: 17, nevlas: 17, itars: 17 }, // 人工知能
    gaia:  { terrans: 21, lantids: 12, xenos: 12, gleens: 21, taklons: 3, ambas: 12, hadschHallas: 12, ivits: 15, geodens: 12, balTaks: 24, firaks: 12, bescods: 17, nevlas: 7, itars: 17 }, // ガイア計画
    eco:   { terrans: 12, lantids: 21, xenos: 17, gleens: 17, taklons: 27, ambas: 21, hadschHallas: 24, ivits: 21, geodens: 17, balTaks: 17, firaks: 24, bescods: 21, nevlas: 24, itars: 17 }, // 経済
    sci:   { terrans: 17, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 15, itars: 12 }, // 科学
  },
};

/** ★拡張版（18種族×9枚）。CSV から生成。 */
export const TECH_POSITION_WEIGHTS_LF: TechPositionTable = {
  // TS1 即時:鉱石1+QIC1
  TS1: {
    terra: { terrans: 11, lantids: 11, xenos: 15, gleens: 7, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 15, geodens: 15, balTaks: 15, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 15, tinkerroids: 15, darkanians: 11 }, // 惑星改造
    nav:   { terrans: 11, lantids: 11, xenos: 15, gleens: 7, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 15, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 15, tinkerroids: 11, darkanians: 15 }, // 航行
    ai:    { terrans: 11, lantids: 11, xenos: 15, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 22, geodens: 15, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 15, darkanians: 11 }, // 人工知能
    gaia:  { terrans: 11, lantids: 11, xenos: 11, gleens: 7, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 15, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // ガイア計画
    eco:   { terrans: 11, lantids: 11, xenos: 11, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 15 }, // 経済
    sci:   { terrans: 11, lantids: 11, xenos: 11, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 15, darkanians: 11 }, // 科学
  },
  // TS2 即時:惑星種類×知識1
  TS2: {
    terra: { terrans: 5, lantids: 5, xenos: 6, gleens: 8, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 10, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 10, tinkerroids: 8, darkanians: 5 }, // 惑星改造
    nav:   { terrans: 5, lantids: 5, xenos: 6, gleens: 6, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 8, tinkerroids: 5, darkanians: 10 }, // 航行
    ai:    { terrans: 5, lantids: 5, xenos: 8, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 8, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 6, darkanians: 5 }, // 人工知能
    gaia:  { terrans: 5, lantids: 5, xenos: 5, gleens: 8, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // ガイア計画
    eco:   { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 8 }, // 経済
    sci:   { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 6, darkanians: 5 }, // 科学
  },
  // TS3 首府学院のパワー値4
  TS3: {
    terra: { terrans: 14, lantids: 14, xenos: 18, gleens: 14, taklons: 14, ambas: 18, hadschHallas: 14, ivits: 18, geodens: 14, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14, moweyds: 21, spaceGiants: 14, tinkerroids: 28, darkanians: 14 }, // 惑星改造
    nav:   { terrans: 14, lantids: 14, xenos: 18, gleens: 14, taklons: 28, ambas: 21, hadschHallas: 14, ivits: 18, geodens: 14, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14, moweyds: 21, spaceGiants: 14, tinkerroids: 14, darkanians: 14 }, // 航行
    ai:    { terrans: 14, lantids: 14, xenos: 21, gleens: 14, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 21, geodens: 14, balTaks: 14, firaks: 14, bescods: 18, nevlas: 14, itars: 14, moweyds: 14, spaceGiants: 14, tinkerroids: 21, darkanians: 14 }, // 人工知能
    gaia:  { terrans: 14, lantids: 14, xenos: 14, gleens: 14, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 14, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 21, moweyds: 14, spaceGiants: 14, tinkerroids: 14, darkanians: 14 }, // ガイア計画
    eco:   { terrans: 14, lantids: 14, xenos: 14, gleens: 14, taklons: 28, ambas: 18, hadschHallas: 14, ivits: 14, geodens: 14, balTaks: 14, firaks: 14, bescods: 18, nevlas: 28, itars: 14, moweyds: 28, spaceGiants: 14, tinkerroids: 14, darkanians: 14 }, // 経済
    sci:   { terrans: 14, lantids: 14, xenos: 14, gleens: 14, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 14, balTaks: 14, firaks: 14, bescods: 21, nevlas: 28, itars: 18, moweyds: 14, spaceGiants: 14, tinkerroids: 21, darkanians: 14 }, // 科学
  },
  // TS4 即時:7VP
  TS4: {
    terra: { terrans: 7, lantids: 7, xenos: 7, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 7, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 7, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 惑星改造
    nav:   { terrans: 7, lantids: 7, xenos: 7, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 7, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 7, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 航行
    ai:    { terrans: 7, lantids: 7, xenos: 7, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 7, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 7, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 人工知能
    gaia:  { terrans: 7, lantids: 7, xenos: 7, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 7, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 7, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // ガイア計画
    eco:   { terrans: 7, lantids: 7, xenos: 7, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 7, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 7, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 経済
    sci:   { terrans: 7, lantids: 7, xenos: 7, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 7, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 7, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // 科学
  },
  // TS5 収入:鉱石1+パワー1
  TS5: {
    terra: { terrans: 9, lantids: 9, xenos: 9, gleens: 14, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 14, balTaks: 9, firaks: 9, bescods: 9, nevlas: 9, itars: 9, moweyds: 11, spaceGiants: 18, tinkerroids: 14, darkanians: 9 }, // 惑星改造
    nav:   { terrans: 9, lantids: 9, xenos: 9, gleens: 11, taklons: 14, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 9, firaks: 9, bescods: 9, nevlas: 9, itars: 9, moweyds: 11, spaceGiants: 14, tinkerroids: 9, darkanians: 9 }, // 航行
    ai:    { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 11, balTaks: 9, firaks: 9, bescods: 9, nevlas: 9, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 11, darkanians: 9 }, // 人工知能
    gaia:  { terrans: 9, lantids: 9, xenos: 9, gleens: 14, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 9, firaks: 9, bescods: 9, nevlas: 9, itars: 14, moweyds: 9, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // ガイア計画
    eco:   { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 14, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 9, firaks: 9, bescods: 9, nevlas: 14, itars: 9, moweyds: 14, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // 経済
    sci:   { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 9, firaks: 9, bescods: 9, nevlas: 14, itars: 11, moweyds: 9, spaceGiants: 9, tinkerroids: 11, darkanians: 9 }, // 科学
  },
  // TS6 収入:知識1+クレ1
  TS6: {
    terra: { terrans: 11, lantids: 14, xenos: 11, gleens: 6, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 16, darkanians: 11 }, // 惑星改造
    nav:   { terrans: 11, lantids: 14, xenos: 11, gleens: 8, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 16 }, // 航行
    ai:    { terrans: 11, lantids: 11, xenos: 11, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 11, firaks: 14, bescods: 14, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 14, darkanians: 11 }, // 人工知能
    gaia:  { terrans: 11, lantids: 11, xenos: 11, gleens: 6, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // ガイア計画
    eco:   { terrans: 11, lantids: 11, xenos: 11, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 11, firaks: 14, bescods: 14, nevlas: 16, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 14 }, // 経済
    sci:   { terrans: 11, lantids: 16, xenos: 11, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 11, ivits: 11, geodens: 11, balTaks: 11, firaks: 16, bescods: 16, nevlas: 16, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 14, darkanians: 11 }, // 科学
  },
  // TS7 ガイア鉱山+3VP
  TS7: {
    terra: { terrans: 12, lantids: 8, xenos: 8, gleens: 16, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 10, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 4, tinkerroids: 4, darkanians: 8 }, // 惑星改造
    nav:   { terrans: 8, lantids: 8, xenos: 8, gleens: 12, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 6, tinkerroids: 8, darkanians: 4 }, // 航行
    ai:    { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 6, darkanians: 8 }, // 人工知能
    gaia:  { terrans: 16, lantids: 8, xenos: 8, gleens: 16, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 12, firaks: 8, bescods: 8, nevlas: 8, itars: 16, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // ガイア計画
    eco:   { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 6 }, // 経済
    sci:   { terrans: 12, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 12, moweyds: 8, spaceGiants: 8, tinkerroids: 6, darkanians: 8 }, // 科学
  },
  // TS8 収入:クレ4
  TS8: {
    terra: { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 12, hadschHallas: 15, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // 惑星改造
    nav:   { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 15, ambas: 15, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 20 }, // 航行
    ai:    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // 人工知能
    gaia:  { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // ガイア計画
    eco:   { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 15, ambas: 12, hadschHallas: 20, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 15, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 15 }, // 経済
    sci:   { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 15, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // 科学
  },
  // TS9 アクション:パワー4
  TS9: {
    terra: { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 17, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 惑星改造
    nav:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 24, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 17, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 航行
    ai:    { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 15, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 人工知能
    gaia:  { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 17, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // ガイア計画
    eco:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 24, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 15, nevlas: 24, itars: 12, moweyds: 24, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 経済
    sci:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 17, nevlas: 24, itars: 15, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 科学
  },
};

const TECH_TRACK_POSITIONS: readonly ResearchTrackId[] = [
  "terra",
  "nav",
  "ai",
  "gaia",
  "eco",
  "sci",
];

/** その拡張で使う標準技術のテーブル。 */
export function techPositionTable(lostFleet: boolean): TechPositionTable {
  return lostFleet ? TECH_POSITION_WEIGHTS_LF : TECH_POSITION_WEIGHTS_BASE;
}

/** `${base|lf}:${tileId}` → 計算した free 枠のセル（初回だけ作る）。 */
const freeCellCache = new Map<string, Partial<Record<FactionId, number>>>();

function computeFreeCell(tileId: string, lostFleet: boolean): Partial<Record<FactionId, number>> {
  const tile = techPositionTable(lostFleet)[tileId];
  const out: Partial<Record<FactionId, number>> = {};
  if (!tile) return out;
  const seen = new Set<FactionId>();
  for (const pos of TECH_TRACK_POSITIONS) {
    for (const f of Object.keys(tile[pos] ?? {}) as FactionId[]) seen.add(f);
  }
  for (const f of seen) {
    // 6列すべての最大値を取る（記載のない列は0）。
    let best = 0;
    for (const pos of TECH_TRACK_POSITIONS) {
      const v = tile[pos]?.[f] ?? 0;
      if (v > best) best = v;
    }
    if (best !== 0) out[f] = best;
  }
  return out;
}

/**
 * 標準技術1枚ぶんの重み（配置ごと）。**参照はここを通すこと。**
 * フリー枠はデータに持たず、研究列6つの最大値として計算する（上の設計メモ参照）。
 * 副作用として、**編集するのは研究列だけでよい**（フリー枠は自動で追随する）。
 */
export function techPositionCell(
  tileId: string,
  pos: TechPosition,
  lostFleet: boolean
): Partial<Record<FactionId, number>> | undefined {
  const table = techPositionTable(lostFleet);
  if (pos !== "free") return table[tileId]?.[pos];
  if (!table[tileId]) return undefined;
  const key = `${lostFleet ? "lf" : "base"}:${tileId}`;
  let cell = freeCellCache.get(key);
  if (!cell) {
    cell = computeFreeCell(tileId, lostFleet);
    freeCellCache.set(key, cell);
  }
  return cell;
}
