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
  RB01: { terrans: 6, lantids: 6, xenos: 6, gleens: 8, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 6 }, // 収入：鉱石1・知識1
  RB02: { terrans: 6, lantids: 6, xenos: 8, gleens: 4, taklons: 6, ambas: 6, hadschHallas: 8, ivits: 10, geodens: 6, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6 }, // 収入：クレジット2・QIC1
  RB03: { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 10, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 6, nevlas: 8, itars: 10 }, // 収入：パワートークン2・鉱石1
  RB04: { terrans: 6, lantids: 8, xenos: 8, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 8, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6 }, // 収入：クレジット2／特別：鉱山建設（改造1無料）
  RB05: { terrans: 8, lantids: 6, xenos: 6, gleens: 8, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 10, firaks: 6, bescods: 6, nevlas: 6, itars: 8 }, // 収入：パワー2／特別：鉱山建設orガイア計画（距離+3）
  RB06: { terrans: 6, lantids: 10, xenos: 8, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6 }, // 収入：鉱石1／パス：鉱山×1VP
  RB07: { terrans: 6, lantids: 8, xenos: 6, gleens: 4, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 10, bescods: 8, nevlas: 6, itars: 6 }, // 収入：知識1／パス：研究所×3VP
  RB08: { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 8, ambas: 6, hadschHallas: 10, ivits: 6, geodens: 6, balTaks: 6, firaks: 8, bescods: 6, nevlas: 8, itars: 6 }, // 収入：鉱石1／パス：交易所×2VP
  RB09: { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 8, nevlas: 10, itars: 8 }, // 収入：パワー4／パス：学院・首府×4VP
  RB10: { terrans: 8, lantids: 6, xenos: 6, gleens: 10, taklons: 6, ambas: 6, hadschHallas: 8, ivits: 6, geodens: 6, balTaks: 8, firaks: 6, bescods: 6, nevlas: 6, itars: 8 }, // 収入：クレジット4／パス：ガイア惑星×1VP
  // ===== 最終得点 =====
  FS01: { terrans: 9, lantids: 9, xenos: 13, gleens: 9, taklons: 9, ambas: 11, hadschHallas: 9, ivits: 13, geodens: 9, balTaks: 9, firaks: 9, bescods: 9, nevlas: 9, itars: 9 }, // 同盟内の建造物 最多
  FS02: { terrans: 9, lantids: 13, xenos: 11, gleens: 9, taklons: 11, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 9, firaks: 9, bescods: 9, nevlas: 9, itars: 9 }, // 建造物 最多
  FS03: { terrans: 9, lantids: 9, xenos: 11, gleens: 11, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 13, balTaks: 9, firaks: 9, bescods: 9, nevlas: 9, itars: 9 }, // 惑星の種類 最多
  FS04: { terrans: 13, lantids: 9, xenos: 9, gleens: 13, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 11, firaks: 9, bescods: 9, nevlas: 9, itars: 13 }, // ガイア惑星 最多
  FS05: { terrans: 9, lantids: 11, xenos: 9, gleens: 9, taklons: 11, ambas: 11, hadschHallas: 9, ivits: 7, geodens: 9, balTaks: 5, firaks: 9, bescods: 9, nevlas: 9, itars: 9 }, // 入植宙域 最多
  FS06: { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 13, geodens: 9, balTaks: 9, firaks: 9, bescods: 9, nevlas: 9, itars: 9 }, // 衛星 最多
  // ===== 同盟タイル =====
  FED12: { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 同盟：12VP
  FED8Q: { terrans: 8, lantids: 8, xenos: 10, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 10, geodens: 8, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 同盟：8VP＋QIC1
  FED8PT: { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 10, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 8, bescods: 8, nevlas: 10, itars: 10 }, // 同盟：8VP＋パワートークン2
  FED7O: { terrans: 8, lantids: 8, xenos: 8, gleens: 10, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 同盟：7VP＋鉱石2
  FED7C: { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 10, ivits: 8, geodens: 8, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // 同盟：7VP＋クレジット6
  FED6K: { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 10, bescods: 10, nevlas: 10, itars: 8 }, // 同盟：6VP＋知識2
};

/** ★拡張版（18種族）。CSV から生成。 */
export const TILE_VALUE_WEIGHTS_LF: TileValueTable = {
  // ===== ブースター =====
  RB01: { terrans: 6, lantids: 6, xenos: 6, gleens: 8, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 8, balTaks: 6, firaks: 8, bescods: 8, nevlas: 8, itars: 6, moweyds: 6, spaceGiants: 8, tinkerroids: 8, darkanians: 6 }, // 収入：鉱石1・知識1
  RB02: { terrans: 6, lantids: 6, xenos: 8, gleens: 4, taklons: 6, ambas: 6, hadschHallas: 8, ivits: 10, geodens: 6, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // 収入：クレジット2・QIC1
  RB03: { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 10, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 6, nevlas: 8, itars: 10, moweyds: 8, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // 収入：パワートークン2・鉱石1
  RB04: { terrans: 6, lantids: 8, xenos: 8, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 8, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 8, tinkerroids: 6, darkanians: 10 }, // 収入：クレジット2／特別：鉱山建設（改造1無料）
  RB05: { terrans: 8, lantids: 6, xenos: 6, gleens: 8, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 10, firaks: 6, bescods: 6, nevlas: 6, itars: 8, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 8 }, // 収入：パワー2／特別：鉱山建設orガイア計画（距離+3）
  RB06: { terrans: 6, lantids: 10, xenos: 8, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 8, tinkerroids: 6, darkanians: 8 }, // 収入：鉱石1／パス：鉱山×1VP
  RB07: { terrans: 6, lantids: 8, xenos: 6, gleens: 4, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 10, bescods: 8, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // 収入：知識1／パス：研究所×3VP
  RB08: { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 8, ambas: 6, hadschHallas: 10, ivits: 6, geodens: 6, balTaks: 6, firaks: 8, bescods: 6, nevlas: 8, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // 収入：鉱石1／パス：交易所×2VP
  RB09: { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 8, nevlas: 10, itars: 8, moweyds: 8, spaceGiants: 6, tinkerroids: 10, darkanians: 6 }, // 収入：パワー4／パス：学院・首府×4VP
  RB10: { terrans: 8, lantids: 6, xenos: 6, gleens: 10, taklons: 6, ambas: 6, hadschHallas: 8, ivits: 6, geodens: 6, balTaks: 8, firaks: 6, bescods: 6, nevlas: 6, itars: 8, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // 収入：クレジット4／パス：ガイア惑星×1VP
  RB11: { terrans: 10, lantids: 6, xenos: 6, gleens: 8, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 10, firaks: 6, bescods: 6, nevlas: 6, itars: 8, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // 収入：鉱石1／パス：ガイアフォーマー×3VP
  RB12: { terrans: 6, lantids: 6, xenos: 6, gleens: 8, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 10, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 10, tinkerroids: 8, darkanians: 10 }, // 収入：鉱石1／パス：惑星種類×1VP
  RB13: { terrans: 6, lantids: 8, xenos: 8, gleens: 6, taklons: 8, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 2, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 10 }, // 収入：クレジット3／パス：深宇宙×2VP
  RB14: { terrans: 10, lantids: 6, xenos: 6, gleens: 8, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 10, firaks: 6, bescods: 6, nevlas: 6, itars: 8, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // 収入：パワー2／特別：ガイア計画（即変換）
  // ===== 最終得点 =====
  FS01: { terrans: 9, lantids: 9, xenos: 13, gleens: 9, taklons: 9, ambas: 11, hadschHallas: 9, ivits: 13, geodens: 9, balTaks: 9, firaks: 9, bescods: 9, nevlas: 9, itars: 9, moweyds: 11, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // 同盟内の建造物 最多
  FS02: { terrans: 9, lantids: 13, xenos: 11, gleens: 9, taklons: 11, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 9, firaks: 9, bescods: 9, nevlas: 9, itars: 9, moweyds: 9, spaceGiants: 11, tinkerroids: 9, darkanians: 11 }, // 建造物 最多
  FS03: { terrans: 9, lantids: 9, xenos: 11, gleens: 11, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 13, balTaks: 9, firaks: 9, bescods: 9, nevlas: 9, itars: 9, moweyds: 9, spaceGiants: 13, tinkerroids: 11, darkanians: 13 }, // 惑星の種類 最多
  FS04: { terrans: 13, lantids: 9, xenos: 9, gleens: 13, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 11, firaks: 9, bescods: 9, nevlas: 9, itars: 13, moweyds: 9, spaceGiants: 7, tinkerroids: 7, darkanians: 7 }, // ガイア惑星 最多
  FS05: { terrans: 9, lantids: 11, xenos: 9, gleens: 9, taklons: 11, ambas: 11, hadschHallas: 9, ivits: 7, geodens: 9, balTaks: 5, firaks: 9, bescods: 9, nevlas: 9, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 9, darkanians: 13 }, // 入植宙域 最多
  FS06: { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 13, geodens: 9, balTaks: 9, firaks: 9, bescods: 9, nevlas: 9, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 9, darkanians: 9 }, // 衛星 最多
  FS07: { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 7, firaks: 9, bescods: 9, nevlas: 9, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 11, darkanians: 11 }, // 小惑星 最多
  FS08: { terrans: 9, lantids: 9, xenos: 9, gleens: 9, taklons: 9, ambas: 13, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 7, firaks: 9, bescods: 9, nevlas: 9, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 11, darkanians: 11 }, // 首府⇔学院の距離 最長
  FS09: { terrans: 9, lantids: 11, xenos: 11, gleens: 9, taklons: 11, ambas: 9, hadschHallas: 9, ivits: 9, geodens: 9, balTaks: 5, firaks: 9, bescods: 9, nevlas: 9, itars: 9, moweyds: 9, spaceGiants: 9, tinkerroids: 9, darkanians: 13 }, // 深宇宙宙域 最多
  // ===== 同盟タイル =====
  FED12: { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // 同盟：12VP
  FED8Q: { terrans: 8, lantids: 8, xenos: 10, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 10, geodens: 8, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // 同盟：8VP＋QIC1
  FED8PT: { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 10, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 8, bescods: 8, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // 同盟：8VP＋パワートークン2
  FED7O: { terrans: 8, lantids: 8, xenos: 8, gleens: 10, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 10, tinkerroids: 10, darkanians: 8 }, // 同盟：7VP＋鉱石2
  FED7C: { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 10, ivits: 8, geodens: 8, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 10 }, // 同盟：7VP＋クレジット6
  FED6K: { terrans: 8, lantids: 10, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 10, bescods: 10, nevlas: 10, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // 同盟：6VP＋知識2
  // ===== LF船 =====
  TSL1: { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 12, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 12, spaceGiants: 14, tinkerroids: 12, darkanians: 12 }, // 即時：2段階無料改造＋鉱山建設
  TSL3: { terrans: 10, lantids: 12, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 12, bescods: 12, nevlas: 12, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 12, darkanians: 10 }, // 即時：鉱石1＋知識3
  TSL2: { terrans: 10, lantids: 12, xenos: 12, gleens: 12, taklons: 12, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 14, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 14 }, // 基本到達距離＋1
  FEDG1: { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // 金枠同盟：12VP（緑面あり）
  FEDG2: { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 12, bescods: 12, nevlas: 10, itars: 12, moweyds: 10, spaceGiants: 12, tinkerroids: 10, darkanians: 10 }, // 金枠同盟：任意の技術タイル1枚
  FEDG3: { terrans: 10, lantids: 12, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 14, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 14 }, // 金枠同盟：距離無限の鉱山建設
  FEDG4: { terrans: 10, lantids: 12, xenos: 10, gleens: 12, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 14, spaceGiants: 12, tinkerroids: 14, darkanians: 10 }, // 金枠同盟：3段階無料改造＋鉱山建設
  FEDG5: { terrans: 10, lantids: 10, xenos: 12, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 12, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 12, tinkerroids: 12, darkanians: 10 }, // 金枠同盟：4VP＋鉱石2＋QIC1
  FEDG6: { terrans: 10, lantids: 12, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 12, bescods: 12, nevlas: 12, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 12, darkanians: 10 }, // 金枠同盟：4VP＋知識4
  FEDG7: { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 14, itars: 12, moweyds: 12, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // 金枠同盟：7VP＋パワートークン2
  FEDG8: { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 14, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 12 }, // 金枠同盟：8VP＋クレジット8
  ART12: { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 14, itars: 12, moweyds: 12, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // 収入：パワー駒2個（エリアIII）
  ART13: { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 12, balTaks: 10, firaks: 12, bescods: 12, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 12, tinkerroids: 12, darkanians: 10 }, // 収入：知識1＋鉱石1
  ART09: { terrans: 10, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 12, geodens: 10, balTaks: 10, firaks: 12, bescods: 12, nevlas: 12, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 12, darkanians: 10 }, // 即時：知識3＋QIC1
  ART10: { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 12, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 12, tinkerroids: 10, darkanians: 10 }, // 即時：クレジット5＋鉱石2
  ART11: { terrans: 10, lantids: 10, xenos: 10, gleens: 12, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 12, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 12, tinkerroids: 12, darkanians: 10 }, // 即時：クレジット3＋鉱石3
  ART01: { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 12, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // 7VP（小惑星鉱山扱い）
  ART02: { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 12, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // 7VP（原始惑星鉱山扱い）
  ART03: { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 12, bescods: 14, nevlas: 12, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 12, darkanians: 10 }, // 科学レベル×3VP
  ART04: { terrans: 14, lantids: 10, xenos: 10, gleens: 12, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 14, firaks: 10, bescods: 10, nevlas: 10, itars: 14, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // ガイア計画レベル×3VP
  ART05: { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 12, bescods: 14, nevlas: 12, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // Lv3以上の研究×3VP
  ART06: { terrans: 10, lantids: 12, xenos: 12, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 6, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 14 }, // 深宇宙宙域×3VP
  ART07: { terrans: 10, lantids: 10, xenos: 10, gleens: 12, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 12, tinkerroids: 12, darkanians: 12 }, // 3VP＋惑星種類×1VP
  ART08: { terrans: 10, lantids: 10, xenos: 12, gleens: 10, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 14, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 12, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // 同盟タイル1枚の恩恵を再取得
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
