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
    terra: { terrans: 12, lantids: 14, xenos: 18, gleens: 12, taklons: 16, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 14, balTaks: 16, firaks: 18, bescods: 12, nevlas: 16, itars: 16 }, // 惑星改造
    nav:   { terrans: 12, lantids: 16, xenos: 18, gleens: 10, taklons: 16, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 16, balTaks: 10, firaks: 16, bescods: 16, nevlas: 16, itars: 16 }, // 航行
    ai:    { terrans: 12, lantids: 16, xenos: 18, gleens: 12, taklons: 16, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 12, balTaks: 16, firaks: 12, bescods: 12, nevlas: 16, itars: 16 }, // 人工知能
    gaia:  { terrans: 12, lantids: 12, xenos: 12, gleens: 10, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 14, firaks: 12, bescods: 12, nevlas: 12, itars: 16 }, // ガイア計画
    eco:   { terrans: 12, lantids: 14, xenos: 16, gleens: 12, taklons: 16, ambas: 16, hadschHallas: 18, ivits: 16, geodens: 12, balTaks: 12, firaks: 18, bescods: 14, nevlas: 16, itars: 16 }, // 経済
    sci:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 14, itars: 12 }, // 科学
  },
  // TS2 即時:惑星種類×知識1
  TS2: {
    terra: { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 14, ambas: 12, hadschHallas: 12, ivits: 16, geodens: 20, balTaks: 16, firaks: 12, bescods: 12, nevlas: 16, itars: 12 }, // 惑星改造
    nav:   { terrans: 12, lantids: 12, xenos: 12, gleens: 10, taklons: 14, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 18, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 航行
    ai:    { terrans: 12, lantids: 12, xenos: 16, gleens: 12, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 22, balTaks: 16, firaks: 14, bescods: 12, nevlas: 16, itars: 14 }, // 人工知能
    gaia:  { terrans: 10, lantids: 12, xenos: 12, gleens: 10, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // ガイア計画
    eco:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 14, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 経済
    sci:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 14, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 14, balTaks: 12, firaks: 12, bescods: 12, nevlas: 16, itars: 12 }, // 科学
  },
  // TS3 首府学院のパワー値4
  TS3: {
    terra: { terrans: 12, lantids: 14, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 14, nevlas: 12, itars: 12 }, // 惑星改造
    nav:   { terrans: 16, lantids: 14, xenos: 12, gleens: 14, taklons: 14, ambas: 14, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 16, nevlas: 12, itars: 12 }, // 航行
    ai:    { terrans: 12, lantids: 14, xenos: 14, gleens: 12, taklons: 14, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 16, nevlas: 12, itars: 14 }, // 人工知能
    gaia:  { terrans: 16, lantids: 10, xenos: 10, gleens: 16, taklons: 8, ambas: 10, hadschHallas: 10, ivits: 14, geodens: 10, balTaks: 16, firaks: 12, bescods: 14, nevlas: 8, itars: 16 }, // ガイア計画
    eco:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 14, ambas: 12, hadschHallas: 14, ivits: 12, geodens: 12, balTaks: 12, firaks: 14, bescods: 16, nevlas: 14, itars: 14 }, // 経済
    sci:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 科学
  },
  // TS4 即時:7VP
  TS4: {
    terra: { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 惑星改造
    nav:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 航行
    ai:    { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 人工知能
    gaia:  { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // ガイア計画
    eco:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 経済
    sci:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 科学
  },
  // TS5 収入:鉱石1+パワー1
  TS5: {
    terra: { terrans: 14, lantids: 16, xenos: 16, gleens: 16, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 16, firaks: 16, bescods: 14, nevlas: 16, itars: 16 }, // 惑星改造
    nav:   { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 16, balTaks: 12, firaks: 14, bescods: 18, nevlas: 16, itars: 18 }, // 航行
    ai:    { terrans: 12, lantids: 12, xenos: 16, gleens: 12, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 12, balTaks: 12, firaks: 14, bescods: 12, nevlas: 14, itars: 16 }, // 人工知能
    gaia:  { terrans: 16, lantids: 12, xenos: 12, gleens: 16, taklons: 8, ambas: 12, hadschHallas: 12, ivits: 14, geodens: 12, balTaks: 18, firaks: 12, bescods: 12, nevlas: 8, itars: 16 }, // ガイア計画
    eco:   { terrans: 12, lantids: 18, xenos: 16, gleens: 12, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 14, balTaks: 16, firaks: 18, bescods: 16, nevlas: 18, itars: 18 }, // 経済
    sci:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 14, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 14, balTaks: 12, firaks: 12, bescods: 12, nevlas: 14, itars: 12 }, // 科学
  },
  // TS6 収入:知識1+クレ1
  TS6: {
    terra: { terrans: 12, lantids: 16, xenos: 12, gleens: 12, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 14, geodens: 16, balTaks: 16, firaks: 16, bescods: 14, nevlas: 14, itars: 14 }, // 惑星改造
    nav:   { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 18, ambas: 18, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 12, firaks: 16, bescods: 16, nevlas: 16, itars: 16 }, // 航行
    ai:    { terrans: 14, lantids: 14, xenos: 16, gleens: 12, taklons: 14, ambas: 16, hadschHallas: 12, ivits: 16, geodens: 12, balTaks: 12, firaks: 12, bescods: 14, nevlas: 12, itars: 14 }, // 人工知能
    gaia:  { terrans: 18, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 10, ivits: 12, geodens: 12, balTaks: 18, firaks: 12, bescods: 12, nevlas: 10, itars: 16 }, // ガイア計画
    eco:   { terrans: 12, lantids: 16, xenos: 12, gleens: 12, taklons: 16, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 16, balTaks: 16, firaks: 18, bescods: 16, nevlas: 18, itars: 14 }, // 経済
    sci:   { terrans: 14, lantids: 16, xenos: 12, gleens: 18, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 14, geodens: 14, balTaks: 14, firaks: 18, bescods: 14, nevlas: 18, itars: 16 }, // 科学
  },
  // TS7 ガイア鉱山+3VP
  TS7: {
    terra: { terrans: 16, lantids: 12, xenos: 12, gleens: 16, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 惑星改造
    nav:   { terrans: 20, lantids: 12, xenos: 12, gleens: 20, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 14 }, // 航行
    ai:    { terrans: 16, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 16, firaks: 12, bescods: 12, nevlas: 12, itars: 14 }, // 人工知能
    gaia:  { terrans: 20, lantids: 12, xenos: 12, gleens: 20, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 14, geodens: 12, balTaks: 14, firaks: 12, bescods: 16, nevlas: 12, itars: 16 }, // ガイア計画
    eco:   { terrans: 14, lantids: 12, xenos: 12, gleens: 14, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 経済
    sci:   { terrans: 14, lantids: 12, xenos: 12, gleens: 14, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 科学
  },
  // TS8 収入:クレ4
  TS8: {
    terra: { terrans: 16, lantids: 16, xenos: 16, gleens: 18, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 16, firaks: 16, bescods: 16, nevlas: 16, itars: 16 }, // 惑星改造
    nav:   { terrans: 18, lantids: 18, xenos: 18, gleens: 20, taklons: 18, ambas: 20, hadschHallas: 20, ivits: 18, geodens: 18, balTaks: 12, firaks: 18, bescods: 18, nevlas: 18, itars: 18 }, // 航行
    ai:    { terrans: 14, lantids: 14, xenos: 18, gleens: 12, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 14, balTaks: 14, firaks: 14, bescods: 14, nevlas: 14, itars: 14 }, // 人工知能
    gaia:  { terrans: 20, lantids: 12, xenos: 12, gleens: 18, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 20, firaks: 12, bescods: 14, nevlas: 12, itars: 12 }, // ガイア計画
    eco:   { terrans: 16, lantids: 18, xenos: 18, gleens: 16, taklons: 18, ambas: 18, hadschHallas: 20, ivits: 16, geodens: 16, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18 }, // 経済
    sci:   { terrans: 12, lantids: 14, xenos: 14, gleens: 12, taklons: 12, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 12, balTaks: 12, firaks: 14, bescods: 16, nevlas: 14, itars: 14 }, // 科学
  },
  // TS9 アクション:パワー4
  TS9: {
    terra: { terrans: 12, lantids: 16, xenos: 14, gleens: 14, taklons: 18, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 16, firaks: 16, bescods: 16, nevlas: 18, itars: 16 }, // 惑星改造
    nav:   { terrans: 18, lantids: 18, xenos: 18, gleens: 18, taklons: 22, ambas: 18, hadschHallas: 18, ivits: 18, geodens: 18, balTaks: 12, firaks: 18, bescods: 18, nevlas: 18, itars: 16 }, // 航行
    ai:    { terrans: 12, lantids: 12, xenos: 18, gleens: 12, taklons: 18, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 16, firaks: 16, bescods: 16, nevlas: 16, itars: 16 }, // 人工知能
    gaia:  { terrans: 18, lantids: 12, xenos: 12, gleens: 18, taklons: 6, ambas: 12, hadschHallas: 12, ivits: 14, geodens: 12, balTaks: 20, firaks: 12, bescods: 16, nevlas: 8, itars: 16 }, // ガイア計画
    eco:   { terrans: 12, lantids: 18, xenos: 16, gleens: 16, taklons: 22, ambas: 18, hadschHallas: 20, ivits: 18, geodens: 16, balTaks: 16, firaks: 20, bescods: 18, nevlas: 20, itars: 16 }, // 経済
    sci:   { terrans: 16, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 14, itars: 12 }, // 科学
  },
};

/** ★拡張版（18種族×9枚）。CSV から生成。 */
export const TECH_POSITION_WEIGHTS_LF: TechPositionTable = {
  // TS1 即時:鉱石1+QIC1
  TS1: {
    terra: { terrans: 12, lantids: 12, xenos: 14, gleens: 8, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 16, geodens: 16, balTaks: 14, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 16, tinkerroids: 16, darkanians: 12 }, // 惑星改造
    nav:   { terrans: 12, lantids: 12, xenos: 14, gleens: 10, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 16, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 14, tinkerroids: 12, darkanians: 16 }, // 航行
    ai:    { terrans: 12, lantids: 12, xenos: 16, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 20, geodens: 14, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 14, darkanians: 12 }, // 人工知能
    gaia:  { terrans: 12, lantids: 12, xenos: 12, gleens: 8, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 16, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // ガイア計画
    eco:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 14 }, // 経済
    sci:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 14, darkanians: 12 }, // 科学
  },
  // TS2 即時:惑星種類×知識1
  TS2: {
    terra: { terrans: 12, lantids: 12, xenos: 14, gleens: 16, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 20, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 20, tinkerroids: 16, darkanians: 12 }, // 惑星改造
    nav:   { terrans: 12, lantids: 12, xenos: 14, gleens: 14, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 16, tinkerroids: 12, darkanians: 20 }, // 航行
    ai:    { terrans: 12, lantids: 12, xenos: 16, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 16, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 14, darkanians: 12 }, // 人工知能
    gaia:  { terrans: 12, lantids: 12, xenos: 12, gleens: 16, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // ガイア計画
    eco:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 16 }, // 経済
    sci:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 14, darkanians: 12 }, // 科学
  },
  // TS3 首府学院のパワー値4
  TS3: {
    terra: { terrans: 12, lantids: 12, xenos: 14, gleens: 12, taklons: 12, ambas: 14, hadschHallas: 12, ivits: 14, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 16, spaceGiants: 12, tinkerroids: 20, darkanians: 12 }, // 惑星改造
    nav:   { terrans: 12, lantids: 12, xenos: 14, gleens: 12, taklons: 20, ambas: 16, hadschHallas: 12, ivits: 14, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 16, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 航行
    ai:    { terrans: 12, lantids: 12, xenos: 16, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 16, geodens: 12, balTaks: 12, firaks: 12, bescods: 14, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 16, darkanians: 12 }, // 人工知能
    gaia:  { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 16, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // ガイア計画
    eco:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 20, ambas: 14, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 14, nevlas: 20, itars: 12, moweyds: 20, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 経済
    sci:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 16, nevlas: 20, itars: 14, moweyds: 12, spaceGiants: 12, tinkerroids: 16, darkanians: 12 }, // 科学
  },
  // TS4 即時:7VP
  TS4: {
    terra: { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 惑星改造
    nav:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 航行
    ai:    { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 人工知能
    gaia:  { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // ガイア計画
    eco:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 経済
    sci:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 科学
  },
  // TS5 収入:鉱石1+パワー1
  TS5: {
    terra: { terrans: 12, lantids: 12, xenos: 12, gleens: 16, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 16, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 14, spaceGiants: 20, tinkerroids: 16, darkanians: 12 }, // 惑星改造
    nav:   { terrans: 12, lantids: 12, xenos: 12, gleens: 14, taklons: 16, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 14, spaceGiants: 16, tinkerroids: 12, darkanians: 12 }, // 航行
    ai:    { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 14, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 14, darkanians: 12 }, // 人工知能
    gaia:  { terrans: 12, lantids: 12, xenos: 12, gleens: 16, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 16, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // ガイア計画
    eco:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 16, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 16, itars: 12, moweyds: 16, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 経済
    sci:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 16, itars: 14, moweyds: 12, spaceGiants: 12, tinkerroids: 14, darkanians: 12 }, // 科学
  },
  // TS6 収入:知識1+クレ1
  TS6: {
    terra: { terrans: 12, lantids: 14, xenos: 12, gleens: 8, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 16, darkanians: 12 }, // 惑星改造
    nav:   { terrans: 12, lantids: 14, xenos: 12, gleens: 10, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 16 }, // 航行
    ai:    { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 14, bescods: 14, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 14, darkanians: 12 }, // 人工知能
    gaia:  { terrans: 12, lantids: 12, xenos: 12, gleens: 8, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // ガイア計画
    eco:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 14, bescods: 14, nevlas: 16, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 14 }, // 経済
    sci:   { terrans: 12, lantids: 16, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 16, bescods: 16, nevlas: 16, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 14, darkanians: 12 }, // 科学
  },
  // TS7 ガイア鉱山+3VP
  TS7: {
    terra: { terrans: 16, lantids: 12, xenos: 12, gleens: 20, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 14, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 8, tinkerroids: 8, darkanians: 12 }, // 惑星改造
    nav:   { terrans: 12, lantids: 12, xenos: 12, gleens: 16, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 10, tinkerroids: 12, darkanians: 8 }, // 航行
    ai:    { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 10, darkanians: 12 }, // 人工知能
    gaia:  { terrans: 20, lantids: 12, xenos: 12, gleens: 20, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 16, firaks: 12, bescods: 12, nevlas: 12, itars: 20, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // ガイア計画
    eco:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 10 }, // 経済
    sci:   { terrans: 16, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 16, moweyds: 12, spaceGiants: 12, tinkerroids: 10, darkanians: 12 }, // 科学
  },
  // TS8 収入:クレ4
  TS8: {
    terra: { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 14, hadschHallas: 16, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 惑星改造
    nav:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 16, ambas: 16, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 20 }, // 航行
    ai:    { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 人工知能
    gaia:  { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // ガイア計画
    eco:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 16, ambas: 14, hadschHallas: 20, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 16, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 16 }, // 経済
    sci:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 16, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 科学
  },
  // TS9 アクション:パワー4
  TS9: {
    terra: { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 16, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 惑星改造
    nav:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 20, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 16, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 航行
    ai:    { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 14, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 人工知能
    gaia:  { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 16, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // ガイア計画
    eco:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 20, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 14, nevlas: 20, itars: 12, moweyds: 20, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 経済
    sci:   { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 16, nevlas: 20, itars: 14, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 科学
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
