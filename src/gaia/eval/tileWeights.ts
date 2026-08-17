// src/gaia/eval/tileWeights.ts
//
// 「タイル1枚 → 種族 → 値」で足りるカテゴリの重みテーブル。**自動生成ファイル**:
//   python scripts/gen_tile_weights_table.py --emit-file <このパス> <base.csv> <lf.csv>
// 手で直さず、CSV を直して生成し直すこと（検算は `<csv> --check`）。
//
// 対象は ブースター / 最終得点 / 同盟タイル(惑星改造Lv5) / LF船（基本技術・金枠同盟・
// 遺物）の4カテゴリ。研究列やラウンドで値が変わらないので2次元で足りる
// （上級技術・標準技術・ラウンド得点はそれぞれ専用の3次元テーブルを持つ）。
//
// 値は **VP 換算**（2026-08-03 ユーザー確定）。「そのタイルが場に出ていて、この種族が
// 使えたら何点分の価値があるか」。カテゴリごとに中央値が違う ——
//   ブースター6 / 最終得点9 / 同盟タイル8 / LF船10。
// 1枚の重みがそもそも違うため（ブースターは1ラウンドぶんの収入とパス得点、
// 最終得点は1位18/2位12/3位6 の期待値、というように）。

import type { FactionId } from "./factionWeights";

export type TileValueTable = Record<string, Partial<Record<FactionId, number>>>;

/** ★通常版（基本14種族）。CSV から生成。 */
export const TILE_VALUE_WEIGHTS_BASE: TileValueTable = {
  // ===== ブースター =====
  RB01: { terrans: 8, lantids: 4, xenos: 4, gleens: 4, taklons: 4, ambas: 4, hadschHallas: 8, ivits: 6, geodens: 6, balTaks: 4, firaks: 4, bescods: 6, nevlas: 8, itars: 4 }, // 収入：鉱石1・知識1
  RB02: { terrans: 10, lantids: 12, xenos: 16, gleens: 8, taklons: 10, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 10, balTaks: 16, firaks: 16, bescods: 10, nevlas: 10, itars: 16 }, // 収入：クレジット2・QIC1
  RB03: { terrans: 8, lantids: 8, xenos: 8, gleens: 10, taklons: 12, ambas: 2, hadschHallas: 8, ivits: 2, geodens: 2, balTaks: 8, firaks: 2, bescods: 2, nevlas: 8, itars: 16 }, // 収入：パワートークン2・鉱石1
  RB04: { terrans: 3, lantids: 4, xenos: 4, gleens: 3, taklons: 3, ambas: 3, hadschHallas: 8, ivits: 3, geodens: 12, balTaks: 3, firaks: 3, bescods: 3, nevlas: 3, itars: 3 }, // 収入：クレジット2／特別：鉱山建設（改造1無料）
  RB05: { terrans: 4, lantids: 3, xenos: 3, gleens: 16, taklons: 10, ambas: 3, hadschHallas: 3, ivits: 8, geodens: 3, balTaks: 16, firaks: 3, bescods: 3, nevlas: 10, itars: 4 }, // 収入：パワー2／特別：鉱山建設orガイア計画（距離+3）
  RB06: { terrans: 6, lantids: 9, xenos: 8, gleens: 9, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 9, balTaks: 6, firaks: 6, bescods: 9, nevlas: 6, itars: 6 }, // 収入：鉱石1／パス：鉱山×1VP
  RB07: { terrans: 6, lantids: 6, xenos: 6, gleens: 4, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 8, balTaks: 6, firaks: 12, bescods: 12, nevlas: 12, itars: 6 }, // 収入：知識1／パス：研究所×3VP
  RB08: { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 12, ivits: 6, geodens: 6, balTaks: 6, firaks: 4, bescods: 6, nevlas: 6, itars: 6 }, // 収入：鉱石1／パス：交易所×2VP
  RB09: { terrans: 16, lantids: 16, xenos: 10, gleens: 8, taklons: 20, ambas: 16, hadschHallas: 16, ivits: 20, geodens: 16, balTaks: 10, firaks: 16, bescods: 8, nevlas: 20, itars: 16 }, // 収入：パワー4／パス：学院・首府×4VP
  RB10: { terrans: 12, lantids: 4, xenos: 4, gleens: 12, taklons: 4, ambas: 4, hadschHallas: 5, ivits: 8, geodens: 4, balTaks: 8, firaks: 4, bescods: 4, nevlas: 4, itars: 8 }, // 収入：クレジット4／パス：ガイア惑星×1VP
  // ===== 最終得点 =====
  FS01: { terrans: 10, lantids: 10, xenos: 12, gleens: 10, taklons: 10, ambas: 15, hadschHallas: 10, ivits: 18, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // 同盟内の建造物 最多
  FS02: { terrans: 10, lantids: 15, xenos: 12, gleens: 10, taklons: 12, ambas: 12, hadschHallas: 10, ivits: 8, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // 建造物 最多
  FS03: { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 10, ivits: 14, geodens: 18, balTaks: 12, firaks: 10, bescods: 10, nevlas: 12, itars: 10 }, // 惑星の種類 最多
  FS04: { terrans: 14, lantids: 9, xenos: 9, gleens: 14, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 14, geodens: 9, balTaks: 12, firaks: 9, bescods: 9, nevlas: 9, itars: 14 }, // ガイア惑星 最多
  FS05: { terrans: 10, lantids: 20, xenos: 12, gleens: 10, taklons: 12, ambas: 14, hadschHallas: 10, ivits: 5, geodens: 10, balTaks: 5, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // 入植宙域 最多
  FS06: { terrans: 15, lantids: 12, xenos: 6, gleens: 9, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 6, geodens: 12, balTaks: 9, firaks: 12, bescods: 15, nevlas: 9, itars: 6 }, // 衛星 最多
  // ===== 同盟タイル =====
  FED12: { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12 }, // 同盟：12VP
  FED8Q: { terrans: 18, lantids: 24, xenos: 24, gleens: 18, taklons: 24, ambas: 30, hadschHallas: 24, ivits: 30, geodens: 30, balTaks: 18, firaks: 24, bescods: 18, nevlas: 24, itars: 24 }, // 同盟：8VP＋QIC1
  FED8PT: { terrans: 16, lantids: 20, xenos: 20, gleens: 16, taklons: 20, ambas: 22, hadschHallas: 20, ivits: 16, geodens: 22, balTaks: 16, firaks: 20, bescods: 16, nevlas: 20, itars: 28 }, // 同盟：8VP＋パワートークン2
  FED7O: { terrans: 20, lantids: 26, xenos: 26, gleens: 20, taklons: 20, ambas: 34, hadschHallas: 26, ivits: 34, geodens: 34, balTaks: 26, firaks: 26, bescods: 20, nevlas: 26, itars: 26 }, // 同盟：7VP＋鉱石2
  FED7C: { terrans: 20, lantids: 20, xenos: 26, gleens: 20, taklons: 20, ambas: 34, hadschHallas: 40, ivits: 34, geodens: 34, balTaks: 26, firaks: 20, bescods: 20, nevlas: 26, itars: 26 }, // 同盟：7VP＋クレジット6
  FED6K: { terrans: 18, lantids: 22, xenos: 18, gleens: 18, taklons: 18, ambas: 18, hadschHallas: 18, ivits: 22, geodens: 22, balTaks: 18, firaks: 18, bescods: 18, nevlas: 18, itars: 18 }, // 同盟：6VP＋知識2
};

/** ★拡張版（18種族）。CSV から生成。 */
export const TILE_VALUE_WEIGHTS_LF: TileValueTable = {
  // ===== ブースター =====
  RB01: { terrans: 8, lantids: 4, xenos: 4, gleens: 4, taklons: 4, ambas: 4, hadschHallas: 8, ivits: 6, geodens: 6, balTaks: 4, firaks: 4, bescods: 4, nevlas: 8, itars: 4, moweyds: 4, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // 収入：鉱石1・知識1
  RB02: { terrans: 10, lantids: 12, xenos: 16, gleens: 8, taklons: 10, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 10, balTaks: 16, firaks: 16, bescods: 10, nevlas: 10, itars: 16, moweyds: 16, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // 収入：クレジット2・QIC1
  RB03: { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 15, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 16, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // 収入：パワートークン2・鉱石1
  RB04: { terrans: 3, lantids: 4, xenos: 4, gleens: 3, taklons: 3, ambas: 3, hadschHallas: 8, ivits: 3, geodens: 12, balTaks: 3, firaks: 3, bescods: 3, nevlas: 3, itars: 3, moweyds: 3, spaceGiants: 1, tinkerroids: 3, darkanians: 8 }, // 収入：クレジット2／特別：鉱山建設（改造1無料）
  RB05: { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 14, geodens: 10, balTaks: 18, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // 収入：パワー2／特別：鉱山建設orガイア計画（距離+3）
  RB06: { terrans: 6, lantids: 9, xenos: 8, gleens: 9, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 9, balTaks: 6, firaks: 6, bescods: 9, nevlas: 6, itars: 6, moweyds: 4, spaceGiants: 6, tinkerroids: 4, darkanians: 6 }, // 収入：鉱石1／パス：鉱山×1VP
  RB07: { terrans: 6, lantids: 6, xenos: 6, gleens: 4, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 8, balTaks: 6, firaks: 12, bescods: 12, nevlas: 12, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // 収入：知識1／パス：研究所×3VP
  RB08: { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 12, ivits: 6, geodens: 6, balTaks: 6, firaks: 4, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // 収入：鉱石1／パス：交易所×2VP
  RB09: { terrans: 16, lantids: 16, xenos: 10, gleens: 8, taklons: 20, ambas: 16, hadschHallas: 16, ivits: 20, geodens: 16, balTaks: 10, firaks: 16, bescods: 8, nevlas: 20, itars: 16, moweyds: 10, spaceGiants: 16, tinkerroids: 20, darkanians: 8 }, // 収入：パワー4／パス：学院・首府×4VP
  RB10: { terrans: 12, lantids: 4, xenos: 4, gleens: 12, taklons: 4, ambas: 4, hadschHallas: 5, ivits: 8, geodens: 4, balTaks: 8, firaks: 4, bescods: 4, nevlas: 4, itars: 8, moweyds: 8, spaceGiants: 5, tinkerroids: 4, darkanians: 4 }, // 収入：クレジット4／パス：ガイア惑星×1VP
  RB11: { terrans: 15, lantids: 6, xenos: 6, gleens: 9, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 3, balTaks: 15, firaks: 6, bescods: 6, nevlas: 6, itars: 9, moweyds: 12, spaceGiants: 9, tinkerroids: 6, darkanians: 6 }, // 収入：鉱石1／パス：ガイアフォーマー×3VP
  RB12: { terrans: 7, lantids: 7, xenos: 7, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 15, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 9, moweyds: 7, spaceGiants: 15, tinkerroids: 10, darkanians: 15 }, // 収入：鉱石1／パス：惑星種類×1VP
  RB13: { terrans: 4, lantids: 6, xenos: 6, gleens: 6, taklons: 4, ambas: 6, hadschHallas: 6, ivits: 2, geodens: 4, balTaks: 2, firaks: 4, bescods: 6, nevlas: 4, itars: 4, moweyds: 4, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // 収入：クレジット3／パス：深宇宙×2VP
  RB14: { terrans: 12, lantids: 6, xenos: 6, gleens: 12, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 9, geodens: 12, balTaks: 18, firaks: 6, bescods: 6, nevlas: 6, itars: 9, moweyds: 15, spaceGiants: 9, tinkerroids: 6, darkanians: 6 }, // 収入：パワー2／特別：ガイア計画（即変換）
  // ===== 最終得点 =====
  FS01: { terrans: 10, lantids: 10, xenos: 12, gleens: 10, taklons: 10, ambas: 15, hadschHallas: 10, ivits: 18, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // 同盟内の建造物 最多
  FS02: { terrans: 10, lantids: 15, xenos: 12, gleens: 10, taklons: 12, ambas: 12, hadschHallas: 10, ivits: 8, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // 建造物 最多
  FS03: { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 10, ivits: 14, geodens: 18, balTaks: 12, firaks: 10, bescods: 10, nevlas: 12, itars: 10, moweyds: 10, spaceGiants: 15, tinkerroids: 12, darkanians: 15 }, // 惑星の種類 最多
  FS04: { terrans: 14, lantids: 9, xenos: 9, gleens: 14, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 14, geodens: 9, balTaks: 12, firaks: 9, bescods: 9, nevlas: 9, itars: 14, moweyds: 14, spaceGiants: 12, tinkerroids: 9, darkanians: 9 }, // ガイア惑星 最多
  FS05: { terrans: 10, lantids: 20, xenos: 12, gleens: 10, taklons: 12, ambas: 14, hadschHallas: 10, ivits: 5, geodens: 10, balTaks: 5, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 5, tinkerroids: 10, darkanians: 15 }, // 入植宙域 最多
  FS06: { terrans: 15, lantids: 12, xenos: 6, gleens: 9, taklons: 15, ambas: 15, hadschHallas: 12, ivits: 9, geodens: 12, balTaks: 9, firaks: 12, bescods: 15, nevlas: 9, itars: 6, moweyds: 9, spaceGiants: 15, tinkerroids: 15, darkanians: 9 }, // 衛星 最多
  FS07: { terrans: 12, lantids: 9, xenos: 9, gleens: 12, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 6, firaks: 9, bescods: 9, nevlas: 9, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 15, darkanians: 15 }, // 小惑星 最多
  FS08: { terrans: 4, lantids: 4, xenos: 8, gleens: 8, taklons: 8, ambas: 16, hadschHallas: 8, ivits: 4, geodens: 8, balTaks: 4, firaks: 8, bescods: 8, nevlas: 4, moweyds: 8, spaceGiants: 8, tinkerroids: 4, darkanians: 8 }, // 首府⇔学院の距離 最長
  FS09: { terrans: 14, lantids: 20, xenos: 12, gleens: 14, taklons: 8, ambas: 12, hadschHallas: 8, ivits: 4, geodens: 8, balTaks: 4, firaks: 8, bescods: 10, nevlas: 8, itars: 12, moweyds: 6, spaceGiants: 4, tinkerroids: 8, darkanians: 4 }, // 深宇宙宙域 最多
  // ===== 同盟タイル =====
  FED12: { terrans: 12, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 12, hadschHallas: 12, ivits: 12, geodens: 12, balTaks: 12, firaks: 12, bescods: 12, nevlas: 12, itars: 12, moweyds: 12, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 同盟：12VP
  FED8Q: { terrans: 16, lantids: 16, xenos: 18, gleens: 14, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 18, geodens: 18, balTaks: 16, firaks: 16, bescods: 16, nevlas: 16, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // 同盟：8VP＋QIC1
  FED8PT: { terrans: 14, lantids: 14, xenos: 18, gleens: 14, taklons: 18, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 14, balTaks: 14, firaks: 14, bescods: 14, nevlas: 18, itars: 18, moweyds: 14, spaceGiants: 14, tinkerroids: 14, darkanians: 14 }, // 同盟：8VP＋パワートークン2
  FED7O: { terrans: 15, lantids: 15, xenos: 15, gleens: 15, taklons: 15, ambas: 15, hadschHallas: 18, ivits: 18, geodens: 18, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // 同盟：7VP＋鉱石2
  FED7C: { terrans: 15, lantids: 15, xenos: 15, gleens: 15, taklons: 15, ambas: 18, hadschHallas: 20, ivits: 18, geodens: 18, balTaks: 15, firaks: 15, bescods: 15, nevlas: 15, itars: 15, moweyds: 15, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // 同盟：7VP＋クレジット6
  FED6K: { terrans: 14, lantids: 14, xenos: 14, gleens: 14, taklons: 14, ambas: 14, hadschHallas: 14, ivits: 14, geodens: 14, balTaks: 14, firaks: 18, bescods: 18, nevlas: 18, itars: 14, moweyds: 14, spaceGiants: 14, tinkerroids: 18, darkanians: 14 }, // 同盟：6VP＋知識2
  // ===== LF船 =====
  TSL1: { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 12, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 12, tinkerroids: 6, darkanians: 6 }, // 即時：2段階無料改造＋鉱山建設
  TSL3: { terrans: 6, lantids: 8, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 12, balTaks: 6, firaks: 6, bescods: 6, nevlas: 10, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 8, darkanians: 6 }, // 即時：鉱石1＋知識3
  TSL2: { terrans: 24, lantids: 24, xenos: 24, gleens: 24, taklons: 24, ambas: 24, hadschHallas: 24, ivits: 24, geodens: 24, balTaks: 36, firaks: 24, bescods: 24, nevlas: 24, itars: 24, moweyds: 24, spaceGiants: 24, tinkerroids: 24, darkanians: 24 }, // 基本到達距離＋1
  FEDG1: { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 16, balTaks: 16, firaks: 16, bescods: 16, nevlas: 16, itars: 16, moweyds: 16, spaceGiants: 16, tinkerroids: 16, darkanians: 16 }, // 金枠同盟：12VP（緑面あり）
  FEDG2: { terrans: 22, lantids: 22, xenos: 22, gleens: 22, taklons: 22, ambas: 28, hadschHallas: 28, ivits: 34, geodens: 22, balTaks: 22, firaks: 22, bescods: 22, nevlas: 22, itars: 22, moweyds: 22, spaceGiants: 22, tinkerroids: 22, darkanians: 22 }, // 金枠同盟：任意の技術タイル1枚
  FEDG3: { terrans: 8, lantids: 12, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 12, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 4, tinkerroids: 8, darkanians: 12 }, // 金枠同盟：距離無限の鉱山建設
  FEDG4: { terrans: 16, lantids: 16, xenos: 16, gleens: 16, taklons: 16, ambas: 16, hadschHallas: 16, ivits: 16, geodens: 24, balTaks: 16, firaks: 16, bescods: 16, nevlas: 16, itars: 16, moweyds: 16, spaceGiants: 18, tinkerroids: 16, darkanians: 16 }, // 金枠同盟：3段階無料改造＋鉱山建設
  FEDG5: { terrans: 8, lantids: 8, xenos: 10, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 10, tinkerroids: 10, darkanians: 8 }, // 金枠同盟：4VP＋鉱石2＋QIC1
  FEDG6: { terrans: 10, lantids: 12, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 12, bescods: 12, nevlas: 12, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 12, darkanians: 10 }, // 金枠同盟：4VP＋知識4
  FEDG7: { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 11, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 9, firaks: 9, bescods: 9, nevlas: 14, itars: 11, moweyds: 11, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // 金枠同盟：7VP＋パワートークン2
  FEDG8: { terrans: 11, lantids: 11, xenos: 11, gleens: 11, taklons: 11, ambas: 11, hadschHallas: 16, ivits: 11, geodens: 11, balTaks: 11, firaks: 11, bescods: 11, nevlas: 11, itars: 11, moweyds: 11, spaceGiants: 11, tinkerroids: 11, darkanians: 14 }, // 金枠同盟：8VP＋クレジット8
  ART12: { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 8, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 6, nevlas: 9, itars: 8, moweyds: 8, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // 収入：パワー駒2個（エリアIII）
  ART13: { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 10, bescods: 10, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 10, tinkerroids: 10, darkanians: 8 }, // 収入：知識1＋鉱石1
  ART09: { terrans: 6, lantids: 6, xenos: 6, gleens: 4, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 8, geodens: 6, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 8, darkanians: 6 }, // 即時：知識3＋QIC1
  ART10: { terrans: 4, lantids: 4, xenos: 4, gleens: 4, taklons: 4, ambas: 4, hadschHallas: 5, ivits: 4, geodens: 5, balTaks: 4, firaks: 4, bescods: 4, nevlas: 4, itars: 4, moweyds: 4, spaceGiants: 5, tinkerroids: 4, darkanians: 4 }, // 即時：クレジット5＋鉱石2
  ART11: { terrans: 4, lantids: 4, xenos: 4, gleens: 5, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 5, balTaks: 4, firaks: 4, bescods: 4, nevlas: 4, itars: 4, moweyds: 4, spaceGiants: 5, tinkerroids: 5, darkanians: 4 }, // 即時：クレジット3＋鉱石3
  ART01: { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // 7VP（小惑星鉱山扱い）
  ART02: { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // 7VP（原始惑星鉱山扱い）
  ART03: { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 9, firaks: 11, bescods: 14, nevlas: 11, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 11, darkanians: 9 }, // 科学レベル×3VP
  ART04: { terrans: 12, lantids: 8, xenos: 8, gleens: 10, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 12, firaks: 8, bescods: 8, nevlas: 8, itars: 12, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // ガイア計画レベル×3VP
  ART05: { terrans: 7, lantids: 7, xenos: 7, gleens: 7, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 7, balTaks: 7, firaks: 9, bescods: 10, nevlas: 9, itars: 7, moweyds: 7, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // Lv3以上の研究×3VP
  ART06: { terrans: 6, lantids: 8, xenos: 8, gleens: 6, taklons: 8, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 3, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 9 }, // 深宇宙宙域×3VP
  ART07: { terrans: 7, lantids: 7, xenos: 7, gleens: 9, taklons: 7, ambas: 7, hadschHallas: 7, ivits: 7, geodens: 10, balTaks: 7, firaks: 7, bescods: 7, nevlas: 7, itars: 7, moweyds: 7, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // 3VP＋惑星種類×1VP
  ART08: { terrans: 10, lantids: 10, xenos: 12, gleens: 10, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 15, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 12, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // 同盟タイル1枚の恩恵を再取得
};

/**
 * そのタイルの種族別の値。**参照はここを通すこと。**
 * 表に無いタイル（通常版での LF 専用タイルなど）は undefined ＝寄与なし。
 */
export function tileValueCell(
  tileId: string,
  lostFleet: boolean
): Partial<Record<FactionId, number>> | undefined {
  return (lostFleet ? TILE_VALUE_WEIGHTS_LF : TILE_VALUE_WEIGHTS_BASE)[tileId];
}
