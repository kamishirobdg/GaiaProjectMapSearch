// src/gaia/eval/roundScoringWeights.ts
//
// ラウンド得点の重みテーブル（タイル → ラウンド(0始まり) → 種族 → 値）。
// **自動生成ファイル**:
//   python scripts/gen_round_scoring_table.py --emit-file <このパス> <base.csv> <lf.csv>
// 手で直さず、CSV を直して生成し直すこと（検算は `<csv> --check`）。
//
// 値は **VP 換算**（2026-08-03 ユーザー確定。全カテゴリを同じ物差しへ移す途中）。
// 「そのラウンドにこのタイルが出たとき、この種族が狙って取れば何点分か」。
// 中央値は10で、噛み合う種族ほど高い。
//
// 曲線（旧 ROUND_SCORING_TIMING）は 2026-08-02 に廃止した。「何ラウンド目に出たか」
// の差はこの表がラウンドごとの値として直に持つので、倍率の掛け算も丸めも要らない。
// 曲線では表せなかった種族差（R1 に同盟を作れるのはダー・シュワーム人だけ、など）を
// 入れられるのが狙い。
//
// 通常版 9タイル×6ラウンド×14種族＝756セル / 拡張版 12×6×18＝1296セル。
// RS04 は物理2枚なので2枠に出ることがあり、その場合は枠ごとに引いて両方を足す。

import type { FactionId } from "./factionWeights";

export type RoundScoringTable = Record<
  string,
  ReadonlyArray<Partial<Record<FactionId, number>>>
>;

/** ★通常版（基本14種族×9枚）。CSV から生成。 */
export const ROUND_SCORING_WEIGHTS_BASE: RoundScoringTable = {
  // RS01 鉱山建設 +2VP
  RS01: [
    { terrans: 5, lantids: 5, xenos: 3, gleens: 6, taklons: 3, ambas: 5, hadschHallas: 3, ivits: 6, geodens: 6, balTaks: 3, bescods: 5, nevlas: 3 }, // R1
    { terrans: 3, lantids: 3, xenos: 3, gleens: 6, taklons: 3, ambas: 5, hadschHallas: 3, ivits: 6, geodens: 6, balTaks: 3, bescods: 5, nevlas: 3 }, // R2
    { terrans: 10, lantids: 10, xenos: 10, gleens: 9, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 12, geodens: 12, balTaks: 10, firaks: 12, bescods: 10, nevlas: 10, itars: 10 }, // R3
    { terrans: 10, lantids: 10, xenos: 10, gleens: 9, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 12, geodens: 12, balTaks: 10, firaks: 12, bescods: 10, nevlas: 10, itars: 10 }, // R4
    { terrans: 10, lantids: 10, xenos: 10, gleens: 6, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 12, geodens: 12, balTaks: 10, firaks: 12, bescods: 10, nevlas: 10, itars: 10 }, // R5
    { terrans: 10, lantids: 10, xenos: 10, gleens: 6, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 12, geodens: 12, balTaks: 10, firaks: 12, bescods: 10, nevlas: 10, itars: 10 }, // R6
  ],
  // RS02 交易所建設 +3VP
  RS02: [
    { terrans: 3, lantids: 3, xenos: 3, gleens: 3, taklons: 3, ambas: 3, hadschHallas: 6, ivits: 6, geodens: 3, balTaks: 3, firaks: 6, bescods: 6, nevlas: 6, itars: 3 }, // R1
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 12, ivits: 3, geodens: 3, balTaks: 3, firaks: 3, bescods: 6, nevlas: 3, itars: 3 }, // R2
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 12, ivits: 6, geodens: 6, balTaks: 6, firaks: 3, bescods: 6, nevlas: 6, itars: 6 }, // R3
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 12, ivits: 6, geodens: 6, balTaks: 6, firaks: 3, bescods: 6, nevlas: 6, itars: 6 }, // R4
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 12, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6 }, // R5
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 12, ivits: 6, geodens: 6, balTaks: 6, firaks: 9, bescods: 6, nevlas: 9, itars: 9 }, // R6
  ],
  // RS03 交易所建設 +4VP
  RS03: [
    { terrans: 4, lantids: 4, xenos: 4, gleens: 4, taklons: 4, ambas: 4, hadschHallas: 8, ivits: 4, geodens: 4, balTaks: 4, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // R1
    { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 16, ivits: 4, geodens: 4, balTaks: 4, firaks: 4, bescods: 8, nevlas: 4, itars: 4 }, // R2
    { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 16, ivits: 8, geodens: 8, balTaks: 8, firaks: 4, bescods: 8, nevlas: 8, itars: 8 }, // R3
    { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 16, ivits: 8, geodens: 8, balTaks: 8, firaks: 4, bescods: 8, nevlas: 8, itars: 8 }, // R4
    { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 16, ivits: 8, geodens: 8, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // R5
    { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 16, ivits: 8, geodens: 8, balTaks: 8, firaks: 12, bescods: 8, nevlas: 12, itars: 12 }, // R6
  ],
  // RS04 学院・惑星首府建設 +5VP ×2
  RS04: [
    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R1
    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R2
    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R3
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 5, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R4
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 5, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R5
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 5, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R6
  ],
  // RS05 ガイア惑星に鉱山建設 +3VP
  RS05: [
    { terrans: 3, lantids: 3, xenos: 6, gleens: 9, taklons: 3, ambas: 3, hadschHallas: 3, ivits: 3, geodens: 3, balTaks: 3, firaks: 3, bescods: 3, nevlas: 3, itars: 3 }, // R1
    { terrans: 9, lantids: 6, xenos: 6, gleens: 9, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 9, geodens: 6, balTaks: 9, firaks: 6, bescods: 6, nevlas: 6, itars: 3 }, // R2
    { terrans: 12, lantids: 6, xenos: 6, gleens: 12, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 12, geodens: 6, balTaks: 12, firaks: 6, bescods: 6, nevlas: 6, itars: 6 }, // R3
    { terrans: 12, lantids: 6, xenos: 9, gleens: 12, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 12, geodens: 6, balTaks: 12, firaks: 6, bescods: 6, nevlas: 6, itars: 6 }, // R4
    { terrans: 12, lantids: 6, xenos: 9, gleens: 12, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 12, geodens: 6, balTaks: 12, firaks: 6, bescods: 6, nevlas: 6, itars: 6 }, // R5
    { terrans: 9, lantids: 6, xenos: 9, gleens: 9, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 9, geodens: 6, balTaks: 9, firaks: 6, bescods: 6, nevlas: 6, itars: 9 }, // R6
  ],
  // RS06 ガイア惑星に鉱山建設 +4VP
  RS06: [
    { terrans: 4, lantids: 4, xenos: 8, gleens: 12, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 4, firaks: 4, bescods: 4, nevlas: 4, itars: 4 }, // R1
    { terrans: 12, lantids: 8, xenos: 8, gleens: 12, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 12, geodens: 8, balTaks: 12, firaks: 8, bescods: 8, nevlas: 8, itars: 4 }, // R2
    { terrans: 16, lantids: 8, xenos: 8, gleens: 16, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 16, geodens: 8, balTaks: 16, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // R3
    { terrans: 16, lantids: 8, xenos: 12, gleens: 16, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 16, geodens: 8, balTaks: 16, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // R4
    { terrans: 16, lantids: 8, xenos: 12, gleens: 16, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 16, geodens: 8, balTaks: 16, firaks: 8, bescods: 8, nevlas: 8, itars: 8 }, // R5
    { terrans: 12, lantids: 8, xenos: 12, gleens: 12, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 12, geodens: 8, balTaks: 12, firaks: 8, bescods: 8, nevlas: 8, itars: 12 }, // R6
  ],
  // RS07 研究1レベル +2VP
  RS07: [
    { terrans: 4, lantids: 6, xenos: 8, gleens: 4, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 6, bescods: 8, nevlas: 8, itars: 8 }, // R1
    { terrans: 2, lantids: 6, xenos: 2, gleens: 2, taklons: 2, ambas: 2, hadschHallas: 2, ivits: 2, geodens: 5, balTaks: 2, firaks: 6, bescods: 4, nevlas: 2, itars: 2 }, // R2
    { terrans: 2, lantids: 9, xenos: 4, gleens: 4, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 5, balTaks: 2, firaks: 6, bescods: 2, nevlas: 2, itars: 8 }, // R3
    { terrans: 2, lantids: 9, xenos: 4, gleens: 4, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 5, balTaks: 2, firaks: 9, bescods: 6, nevlas: 6, itars: 8 }, // R4
    { terrans: 4, lantids: 12, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 8, balTaks: 8, firaks: 12, bescods: 6, nevlas: 6, itars: 8 }, // R5
    { terrans: 8, lantids: 12, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 12, bescods: 8, nevlas: 8, itars: 8 }, // R6
  ],
  // RS08 同盟タイル獲得 +5VP
  RS08: [
    { ivits: 5 }, // R1
    { ivits: 5 }, // R2
    { terrans: 4, lantids: 4, xenos: 5, gleens: 5, taklons: 4, ambas: 5, hadschHallas: 4, ivits: 5, geodens: 4, balTaks: 4, firaks: 4, bescods: 5, nevlas: 4, itars: 4 }, // R3
    { terrans: 8, lantids: 8, xenos: 10, gleens: 10, taklons: 8, ambas: 10, hadschHallas: 8, ivits: 10, geodens: 8, balTaks: 8, firaks: 8, bescods: 10, nevlas: 8, itars: 8 }, // R4
    { terrans: 11, lantids: 11, xenos: 15, gleens: 15, taklons: 11, ambas: 15, hadschHallas: 11, ivits: 15, geodens: 11, balTaks: 11, firaks: 11, bescods: 15, nevlas: 11, itars: 11 }, // R5
    { terrans: 15, lantids: 15, xenos: 20, gleens: 20, taklons: 15, ambas: 20, hadschHallas: 15, ivits: 20, geodens: 15, balTaks: 15, firaks: 15, bescods: 20, nevlas: 15, itars: 15 }, // R6
  ],
  // RS09 惑星改造1段階 +2VP
  RS09: [
    { terrans: 2, lantids: 2, xenos: 2, gleens: 2, taklons: 2, ambas: 2, hadschHallas: 2, ivits: 2, geodens: 4, balTaks: 2, firaks: 2, bescods: 2, nevlas: 2, itars: 2 }, // R1
    { terrans: 2, lantids: 2, xenos: 2, gleens: 2, taklons: 2, ambas: 2, hadschHallas: 2, ivits: 2, geodens: 6, balTaks: 2, firaks: 2, bescods: 2, nevlas: 2, itars: 2 }, // R2
    { terrans: 2, lantids: 2, xenos: 2, gleens: 2, taklons: 2, ambas: 2, hadschHallas: 2, ivits: 2, geodens: 8, balTaks: 2, firaks: 2, bescods: 2, nevlas: 2, itars: 2 }, // R3
    { terrans: 4, lantids: 4, xenos: 4, gleens: 4, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 8, balTaks: 4, firaks: 4, bescods: 4, nevlas: 4, itars: 4 }, // R4
    { terrans: 4, lantids: 4, xenos: 4, gleens: 4, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 8, balTaks: 4, firaks: 4, bescods: 4, nevlas: 4, itars: 4 }, // R5
    { terrans: 4, lantids: 4, xenos: 4, gleens: 4, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 8, balTaks: 4, firaks: 4, bescods: 4, nevlas: 4, itars: 4 }, // R6
  ],
};

/** ★拡張版（18種族×12枚）。CSV から生成。 */
export const ROUND_SCORING_WEIGHTS_LF: RoundScoringTable = {
  // RS01 鉱山建設 +2VP
  RS01: [
    { terrans: 5, lantids: 5, xenos: 3, gleens: 8, taklons: 3, ambas: 5, hadschHallas: 3, ivits: 6, geodens: 6, balTaks: 3, bescods: 5, nevlas: 3, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // R1
    { terrans: 3, lantids: 3, xenos: 3, gleens: 8, taklons: 3, ambas: 5, hadschHallas: 3, ivits: 6, geodens: 6, balTaks: 3, bescods: 5, nevlas: 3, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // R2
    { terrans: 10, lantids: 10, xenos: 10, gleens: 12, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 12, geodens: 12, balTaks: 10, firaks: 12, bescods: 10, nevlas: 10, itars: 10, moweyds: 9, spaceGiants: 6, tinkerroids: 12, darkanians: 12 }, // R3
    { terrans: 10, lantids: 10, xenos: 10, gleens: 12, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 12, geodens: 12, balTaks: 10, firaks: 12, bescods: 10, nevlas: 10, itars: 10, moweyds: 9, spaceGiants: 6, tinkerroids: 12, darkanians: 12 }, // R4
    { terrans: 10, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 12, geodens: 12, balTaks: 10, firaks: 12, bescods: 10, nevlas: 10, itars: 10, moweyds: 12, spaceGiants: 6, tinkerroids: 12, darkanians: 12 }, // R5
    { terrans: 10, lantids: 10, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 12, geodens: 12, balTaks: 10, firaks: 12, bescods: 10, nevlas: 10, itars: 10, moweyds: 12, spaceGiants: 6, tinkerroids: 12, darkanians: 12 }, // R6
  ],
  // RS02 交易所建設 +3VP
  RS02: [
    { terrans: 3, lantids: 3, xenos: 3, gleens: 3, taklons: 3, ambas: 3, hadschHallas: 6, ivits: 6, geodens: 3, balTaks: 3, firaks: 6, bescods: 6, nevlas: 6, itars: 3, moweyds: 3, spaceGiants: 3, tinkerroids: 3, darkanians: 3 }, // R1
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 12, ivits: 3, geodens: 3, balTaks: 3, firaks: 3, bescods: 6, nevlas: 3, itars: 3, moweyds: 3, spaceGiants: 3, tinkerroids: 3, darkanians: 3 }, // R2
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 12, ivits: 6, geodens: 6, balTaks: 6, firaks: 3, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // R3
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 12, ivits: 6, geodens: 6, balTaks: 6, firaks: 3, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // R4
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 12, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // R5
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 12, ivits: 6, geodens: 6, balTaks: 6, firaks: 9, bescods: 6, nevlas: 9, itars: 9, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // R6
  ],
  // RS03 交易所建設 +4VP
  RS03: [
    { terrans: 4, lantids: 4, xenos: 4, gleens: 4, taklons: 4, ambas: 4, hadschHallas: 8, ivits: 4, geodens: 4, balTaks: 4, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 4, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // R1
    { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 16, ivits: 4, geodens: 4, balTaks: 4, firaks: 4, bescods: 8, nevlas: 4, itars: 4, moweyds: 4, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // R2
    { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 16, ivits: 8, geodens: 8, balTaks: 8, firaks: 4, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // R3
    { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 16, ivits: 8, geodens: 8, balTaks: 8, firaks: 4, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // R4
    { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 16, ivits: 8, geodens: 8, balTaks: 8, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // R5
    { terrans: 8, lantids: 8, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 16, ivits: 8, geodens: 8, balTaks: 8, firaks: 12, bescods: 8, nevlas: 12, itars: 12, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // R6
  ],
  // RS04 学院・惑星首府建設 +5VP ×2
  RS04: [
    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 5, darkanians: 5 }, // R1
    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R2
    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R3
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 5, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 5, darkanians: 10 }, // R4
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 5, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 5, darkanians: 10 }, // R5
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 5, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 5, darkanians: 10 }, // R6
  ],
  // RS05 ガイア惑星に鉱山建設 +3VP
  RS05: [
    { terrans: 3, lantids: 3, xenos: 6, gleens: 9, taklons: 3, ambas: 3, hadschHallas: 3, ivits: 3, geodens: 3, balTaks: 3, firaks: 3, bescods: 3, nevlas: 3, itars: 3, moweyds: 6, spaceGiants: 3, tinkerroids: 3, darkanians: 3 }, // R1
    { terrans: 9, lantids: 6, xenos: 6, gleens: 9, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 9, geodens: 6, balTaks: 9, firaks: 6, bescods: 6, nevlas: 6, itars: 3, moweyds: 6, spaceGiants: 3, tinkerroids: 3, darkanians: 3 }, // R2
    { terrans: 12, lantids: 6, xenos: 6, gleens: 12, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 12, geodens: 6, balTaks: 12, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 12, spaceGiants: 12, tinkerroids: 3, darkanians: 3 }, // R3
    { terrans: 12, lantids: 6, xenos: 9, gleens: 12, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 12, geodens: 6, balTaks: 12, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 12, spaceGiants: 12, tinkerroids: 6, darkanians: 6 }, // R4
    { terrans: 12, lantids: 6, xenos: 9, gleens: 12, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 12, geodens: 6, balTaks: 12, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 12, spaceGiants: 12, tinkerroids: 6, darkanians: 6 }, // R5
    { terrans: 9, lantids: 6, xenos: 9, gleens: 9, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 9, geodens: 6, balTaks: 9, firaks: 6, bescods: 6, nevlas: 6, itars: 9, moweyds: 12, spaceGiants: 12, tinkerroids: 6, darkanians: 6 }, // R6
  ],
  // RS06 ガイア惑星に鉱山建設 +4VP
  RS06: [
    { terrans: 4, lantids: 4, xenos: 8, gleens: 12, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 4, firaks: 4, bescods: 4, nevlas: 4, itars: 4, moweyds: 8, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // R1
    { terrans: 12, lantids: 8, xenos: 8, gleens: 12, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 12, geodens: 8, balTaks: 12, firaks: 8, bescods: 8, nevlas: 8, itars: 4, moweyds: 8, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // R2
    { terrans: 16, lantids: 8, xenos: 8, gleens: 16, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 16, geodens: 8, balTaks: 16, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 16, spaceGiants: 16, tinkerroids: 4, darkanians: 4 }, // R3
    { terrans: 16, lantids: 8, xenos: 12, gleens: 16, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 16, geodens: 8, balTaks: 16, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 16, spaceGiants: 16, tinkerroids: 8, darkanians: 8 }, // R4
    { terrans: 16, lantids: 8, xenos: 12, gleens: 16, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 16, geodens: 8, balTaks: 16, firaks: 8, bescods: 8, nevlas: 8, itars: 8, moweyds: 16, spaceGiants: 16, tinkerroids: 8, darkanians: 8 }, // R5
    { terrans: 12, lantids: 8, xenos: 12, gleens: 12, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 12, geodens: 8, balTaks: 12, firaks: 8, bescods: 8, nevlas: 8, itars: 12, moweyds: 16, spaceGiants: 16, tinkerroids: 8, darkanians: 8 }, // R6
  ],
  // RS07 研究1レベル +2VP
  RS07: [
    { terrans: 4, lantids: 6, xenos: 8, gleens: 4, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 8, balTaks: 8, firaks: 6, bescods: 8, nevlas: 8, itars: 8, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // R1
    { terrans: 2, lantids: 6, xenos: 2, gleens: 2, taklons: 2, ambas: 2, hadschHallas: 2, ivits: 2, geodens: 5, balTaks: 2, firaks: 6, bescods: 4, nevlas: 2, itars: 2, moweyds: 2, spaceGiants: 2, tinkerroids: 2, darkanians: 2 }, // R2
    { terrans: 2, lantids: 9, xenos: 4, gleens: 4, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 5, balTaks: 2, firaks: 6, bescods: 2, nevlas: 2, itars: 8, moweyds: 4, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // R3
    { terrans: 2, lantids: 9, xenos: 4, gleens: 4, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 5, balTaks: 2, firaks: 9, bescods: 6, nevlas: 6, itars: 8, moweyds: 4, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // R4
    { terrans: 4, lantids: 12, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 8, balTaks: 8, firaks: 12, bescods: 6, nevlas: 6, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // R5
    { terrans: 8, lantids: 12, xenos: 8, gleens: 8, taklons: 8, ambas: 8, hadschHallas: 8, ivits: 8, geodens: 10, balTaks: 8, firaks: 12, bescods: 8, nevlas: 8, itars: 8, moweyds: 8, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // R6
  ],
  // RS08 同盟タイル獲得 +5VP
  RS08: [
    { ivits: 5 }, // R1
    { ivits: 5, moweyds: 5 }, // R2
    { terrans: 4, lantids: 4, xenos: 5, gleens: 5, taklons: 4, ambas: 5, hadschHallas: 4, ivits: 5, geodens: 4, balTaks: 4, firaks: 4, bescods: 5, nevlas: 4, itars: 4, moweyds: 5, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // R3
    { terrans: 8, lantids: 8, xenos: 10, gleens: 10, taklons: 8, ambas: 10, hadschHallas: 8, ivits: 10, geodens: 8, balTaks: 8, firaks: 8, bescods: 10, nevlas: 8, itars: 8, moweyds: 10, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // R4
    { terrans: 11, lantids: 11, xenos: 15, gleens: 15, taklons: 11, ambas: 15, hadschHallas: 11, ivits: 15, geodens: 11, balTaks: 11, firaks: 11, bescods: 15, nevlas: 11, itars: 11, moweyds: 15, spaceGiants: 11, tinkerroids: 11, darkanians: 11 }, // R5
    { terrans: 15, lantids: 15, xenos: 20, gleens: 20, taklons: 15, ambas: 20, hadschHallas: 15, ivits: 20, geodens: 15, balTaks: 15, firaks: 15, bescods: 20, nevlas: 15, itars: 15, moweyds: 20, spaceGiants: 15, tinkerroids: 15, darkanians: 15 }, // R6
  ],
  // RS09 惑星改造1段階 +2VP
  RS09: [
    { terrans: 3, lantids: 3, xenos: 3, gleens: 3, taklons: 3, ambas: 3, hadschHallas: 3, ivits: 3, geodens: 5, balTaks: 3, firaks: 3, bescods: 3, nevlas: 3, itars: 3, moweyds: 3, spaceGiants: 4, tinkerroids: 3, darkanians: 5 }, // R1
    { terrans: 3, lantids: 3, xenos: 3, gleens: 3, taklons: 3, ambas: 3, hadschHallas: 3, ivits: 3, geodens: 8, balTaks: 3, firaks: 3, bescods: 3, nevlas: 3, itars: 3, moweyds: 3, spaceGiants: 4, tinkerroids: 3, darkanians: 5 }, // R2
    { terrans: 3, lantids: 3, xenos: 3, gleens: 3, taklons: 3, ambas: 3, hadschHallas: 3, ivits: 3, geodens: 10, balTaks: 3, firaks: 3, bescods: 3, nevlas: 3, itars: 3, moweyds: 3, spaceGiants: 4, tinkerroids: 3, darkanians: 8 }, // R3
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 10, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 8, tinkerroids: 6, darkanians: 10 }, // R4
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 10, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 8, tinkerroids: 6, darkanians: 10 }, // R5
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 10, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 8, tinkerroids: 6, darkanians: 10 }, // R6
  ],
  // RS10 未入植の宙域で鉱山建設 +3VP
  RS10: [
    { terrans: 6, lantids: 9, xenos: 9, gleens: 6, taklons: 9, ambas: 9, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 3, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 9, tinkerroids: 6, darkanians: 9 }, // R1
    { terrans: 6, lantids: 9, xenos: 9, gleens: 6, taklons: 9, ambas: 9, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 3, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 9, tinkerroids: 6, darkanians: 9 }, // R2
    { terrans: 6, lantids: 9, xenos: 9, gleens: 6, taklons: 9, ambas: 9, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 3, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 9, tinkerroids: 6, darkanians: 9 }, // R3
    { terrans: 6, lantids: 9, xenos: 9, gleens: 6, taklons: 9, ambas: 9, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 3, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 9, tinkerroids: 6, darkanians: 9 }, // R4
    { terrans: 6, lantids: 9, xenos: 9, gleens: 6, taklons: 9, ambas: 9, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 3, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 9, tinkerroids: 6, darkanians: 9 }, // R5
    { terrans: 6, lantids: 9, xenos: 9, gleens: 6, taklons: 9, ambas: 9, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 3, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 9, tinkerroids: 6, darkanians: 9 }, // R6
  ],
  // RS11 未入植の種類の惑星に鉱山建設 +3VP
  RS11: [
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 12, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 9, darkanians: 9 }, // R1
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 9, darkanians: 9 }, // R2
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 9, darkanians: 9 }, // R3
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 9, darkanians: 9 }, // R4
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 9, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 9, darkanians: 9 }, // R5
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 9, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 9, darkanians: 9 }, // R6
  ],
  // RS12 研究所建設 +4VP
  RS12: [
    { terrans: 4, lantids: 4, xenos: 4, gleens: 4, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 4, firaks: 8, bescods: 8, nevlas: 4, itars: 4, moweyds: 4, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // R1
    { terrans: 4, lantids: 4, xenos: 4, gleens: 4, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 4, firaks: 4, bescods: 8, nevlas: 4, itars: 4, moweyds: 4, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // R2
    { terrans: 4, lantids: 4, xenos: 4, gleens: 4, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 4, firaks: 8, bescods: 8, nevlas: 4, itars: 4, moweyds: 4, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // R3
    { terrans: 4, lantids: 4, xenos: 4, gleens: 4, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 4, firaks: 8, bescods: 8, nevlas: 4, itars: 4, moweyds: 4, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // R4
    { terrans: 4, lantids: 4, xenos: 4, gleens: 4, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 4, firaks: 8, bescods: 8, nevlas: 4, itars: 4, moweyds: 4, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // R5
    { terrans: 4, lantids: 4, xenos: 4, gleens: 4, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 4, firaks: 8, bescods: 8, nevlas: 4, itars: 4, moweyds: 4, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // R6
  ],
};

/**
 * そのタイルが n ラウンド目（0始まり）に出たときの種族別の値。
 * 表に無いタイル（通常版の RS10-12 など）は undefined ＝寄与なし。
 */
export function roundScoringCell(
  tileId: string,
  roundIndex: number,
  lostFleet: boolean
): Partial<Record<FactionId, number>> | undefined {
  const table = lostFleet ? ROUND_SCORING_WEIGHTS_LF : ROUND_SCORING_WEIGHTS_BASE;
  return table[tileId]?.[roundIndex];
}
