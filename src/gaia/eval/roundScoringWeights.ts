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
    { terrans: 5, lantids: 8, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 6, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R1
    { terrans: 5, lantids: 8, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 6, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R2
    { terrans: 5, lantids: 8, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 6, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R3
    { terrans: 5, lantids: 8, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 6, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R4
    { terrans: 5, lantids: 8, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 6, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R5
    { terrans: 5, lantids: 8, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 6, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R6
  ],
  // RS02 交易所建設 +3VP
  RS02: [
    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 6, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5 }, // R1
    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 6, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5 }, // R2
    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 6, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5 }, // R3
    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 6, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5 }, // R4
    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 6, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5 }, // R5
    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 6, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5 }, // R6
  ],
  // RS03 交易所建設 +4VP
  RS03: [
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 8, ambas: 6, hadschHallas: 8, ivits: 6, geodens: 6, balTaks: 6, firaks: 9, bescods: 6, nevlas: 8, itars: 6 }, // R1
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 8, ambas: 6, hadschHallas: 8, ivits: 6, geodens: 6, balTaks: 6, firaks: 9, bescods: 6, nevlas: 8, itars: 6 }, // R2
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 8, ambas: 6, hadschHallas: 8, ivits: 6, geodens: 6, balTaks: 6, firaks: 9, bescods: 6, nevlas: 8, itars: 6 }, // R3
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 8, ambas: 6, hadschHallas: 8, ivits: 6, geodens: 6, balTaks: 6, firaks: 9, bescods: 6, nevlas: 8, itars: 6 }, // R4
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 8, ambas: 6, hadschHallas: 8, ivits: 6, geodens: 6, balTaks: 6, firaks: 9, bescods: 6, nevlas: 8, itars: 6 }, // R5
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 8, ambas: 6, hadschHallas: 8, ivits: 6, geodens: 6, balTaks: 6, firaks: 9, bescods: 6, nevlas: 8, itars: 6 }, // R6
  ],
  // RS04 学院・惑星首府建設 +5VP ×2
  RS04: [
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 8, nevlas: 8, itars: 8 }, // R1
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 8, nevlas: 8, itars: 8 }, // R2
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 8, nevlas: 8, itars: 8 }, // R3
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 8, nevlas: 8, itars: 8 }, // R4
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 8, nevlas: 8, itars: 8 }, // R5
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 8, nevlas: 8, itars: 8 }, // R6
  ],
  // RS05 ガイア惑星に鉱山建設 +3VP
  RS05: [
    { terrans: 6, lantids: 4, xenos: 4, gleens: 6, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 5, firaks: 4, bescods: 4, nevlas: 4, itars: 6 }, // R1
    { terrans: 6, lantids: 4, xenos: 4, gleens: 6, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 5, firaks: 4, bescods: 4, nevlas: 4, itars: 6 }, // R2
    { terrans: 6, lantids: 4, xenos: 4, gleens: 6, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 5, firaks: 4, bescods: 4, nevlas: 4, itars: 6 }, // R3
    { terrans: 6, lantids: 4, xenos: 4, gleens: 6, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 5, firaks: 4, bescods: 4, nevlas: 4, itars: 6 }, // R4
    { terrans: 6, lantids: 4, xenos: 4, gleens: 6, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 5, firaks: 4, bescods: 4, nevlas: 4, itars: 6 }, // R5
    { terrans: 6, lantids: 4, xenos: 4, gleens: 6, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 5, firaks: 4, bescods: 4, nevlas: 4, itars: 6 }, // R6
  ],
  // RS06 ガイア惑星に鉱山建設 +4VP
  RS06: [
    { terrans: 8, lantids: 5, xenos: 5, gleens: 8, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 6, firaks: 5, bescods: 5, nevlas: 5, itars: 8 }, // R1
    { terrans: 8, lantids: 5, xenos: 5, gleens: 8, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 6, firaks: 5, bescods: 5, nevlas: 5, itars: 8 }, // R2
    { terrans: 8, lantids: 5, xenos: 5, gleens: 8, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 6, firaks: 5, bescods: 5, nevlas: 5, itars: 8 }, // R3
    { terrans: 8, lantids: 5, xenos: 5, gleens: 8, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 6, firaks: 5, bescods: 5, nevlas: 5, itars: 8 }, // R4
    { terrans: 8, lantids: 5, xenos: 5, gleens: 8, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 6, firaks: 5, bescods: 5, nevlas: 5, itars: 8 }, // R5
    { terrans: 8, lantids: 5, xenos: 5, gleens: 8, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 6, firaks: 5, bescods: 5, nevlas: 5, itars: 8 }, // R6
  ],
  // RS07 研究1レベル +2VP
  RS07: [
    { terrans: 5, lantids: 6, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 8, nevlas: 6, itars: 8 }, // R1
    { terrans: 5, lantids: 6, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 8, nevlas: 6, itars: 8 }, // R2
    { terrans: 5, lantids: 6, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 8, nevlas: 6, itars: 8 }, // R3
    { terrans: 5, lantids: 6, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 8, nevlas: 6, itars: 8 }, // R4
    { terrans: 5, lantids: 6, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 8, nevlas: 6, itars: 8 }, // R5
    { terrans: 5, lantids: 6, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 8, nevlas: 6, itars: 8 }, // R6
  ],
  // RS08 同盟タイル獲得 +5VP
  RS08: [
    { terrans: 5, lantids: 5, xenos: 8, gleens: 6, taklons: 5, ambas: 6, hadschHallas: 5, ivits: 8, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R1
    { terrans: 5, lantids: 5, xenos: 8, gleens: 6, taklons: 5, ambas: 6, hadschHallas: 5, ivits: 8, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R2
    { terrans: 5, lantids: 5, xenos: 8, gleens: 6, taklons: 5, ambas: 6, hadschHallas: 5, ivits: 8, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R3
    { terrans: 5, lantids: 5, xenos: 8, gleens: 6, taklons: 5, ambas: 6, hadschHallas: 5, ivits: 8, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R4
    { terrans: 5, lantids: 5, xenos: 8, gleens: 6, taklons: 5, ambas: 6, hadschHallas: 5, ivits: 8, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R5
    { terrans: 5, lantids: 5, xenos: 8, gleens: 6, taklons: 5, ambas: 6, hadschHallas: 5, ivits: 8, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R6
  ],
  // RS09 惑星改造1段階 +2VP
  RS09: [
    { terrans: 5, lantids: 5, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 8, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R1
    { terrans: 5, lantids: 5, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 8, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R2
    { terrans: 5, lantids: 5, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 8, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R3
    { terrans: 5, lantids: 5, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 8, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R4
    { terrans: 5, lantids: 5, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 8, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R5
    { terrans: 5, lantids: 5, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 8, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5 }, // R6
  ],
};

/** ★拡張版（18種族×12枚）。CSV から生成。 */
export const ROUND_SCORING_WEIGHTS_LF: RoundScoringTable = {
  // RS01 鉱山建設 +2VP
  RS01: [
    { terrans: 5, lantids: 8, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 6, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 8, tinkerroids: 5, darkanians: 8 }, // R1
    { terrans: 5, lantids: 8, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 6, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 8, tinkerroids: 5, darkanians: 8 }, // R2
    { terrans: 5, lantids: 8, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 6, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 8, tinkerroids: 5, darkanians: 8 }, // R3
    { terrans: 5, lantids: 8, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 6, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 8, tinkerroids: 5, darkanians: 8 }, // R4
    { terrans: 5, lantids: 8, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 6, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 8, tinkerroids: 5, darkanians: 8 }, // R5
    { terrans: 5, lantids: 8, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 6, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 8, tinkerroids: 5, darkanians: 8 }, // R6
  ],
  // RS02 交易所建設 +3VP
  RS02: [
    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 6, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R1
    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 6, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R2
    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 6, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R3
    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 6, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R4
    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 6, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R5
    { terrans: 5, lantids: 5, xenos: 5, gleens: 5, taklons: 6, ambas: 5, hadschHallas: 6, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 5, nevlas: 6, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R6
  ],
  // RS03 交易所建設 +4VP
  RS03: [
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 8, ambas: 6, hadschHallas: 8, ivits: 6, geodens: 6, balTaks: 6, firaks: 9, bescods: 6, nevlas: 8, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // R1
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 8, ambas: 6, hadschHallas: 8, ivits: 6, geodens: 6, balTaks: 6, firaks: 9, bescods: 6, nevlas: 8, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // R2
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 8, ambas: 6, hadschHallas: 8, ivits: 6, geodens: 6, balTaks: 6, firaks: 9, bescods: 6, nevlas: 8, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // R3
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 8, ambas: 6, hadschHallas: 8, ivits: 6, geodens: 6, balTaks: 6, firaks: 9, bescods: 6, nevlas: 8, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // R4
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 8, ambas: 6, hadschHallas: 8, ivits: 6, geodens: 6, balTaks: 6, firaks: 9, bescods: 6, nevlas: 8, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // R5
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 8, ambas: 6, hadschHallas: 8, ivits: 6, geodens: 6, balTaks: 6, firaks: 9, bescods: 6, nevlas: 8, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 6 }, // R6
  ],
  // RS04 学院・惑星首府建設 +5VP ×2
  RS04: [
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 8, nevlas: 8, itars: 8, moweyds: 6, spaceGiants: 6, tinkerroids: 4, darkanians: 6 }, // R1
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 8, nevlas: 8, itars: 8, moweyds: 6, spaceGiants: 6, tinkerroids: 4, darkanians: 6 }, // R2
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 8, nevlas: 8, itars: 8, moweyds: 6, spaceGiants: 6, tinkerroids: 4, darkanians: 6 }, // R3
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 8, nevlas: 8, itars: 8, moweyds: 6, spaceGiants: 6, tinkerroids: 4, darkanians: 6 }, // R4
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 8, nevlas: 8, itars: 8, moweyds: 6, spaceGiants: 6, tinkerroids: 4, darkanians: 6 }, // R5
    { terrans: 6, lantids: 6, xenos: 6, gleens: 6, taklons: 6, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 6, firaks: 6, bescods: 8, nevlas: 8, itars: 8, moweyds: 6, spaceGiants: 6, tinkerroids: 4, darkanians: 6 }, // R6
  ],
  // RS05 ガイア惑星に鉱山建設 +3VP
  RS05: [
    { terrans: 6, lantids: 4, xenos: 4, gleens: 6, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 5, firaks: 4, bescods: 4, nevlas: 4, itars: 6, moweyds: 4, spaceGiants: 3, tinkerroids: 3, darkanians: 3 }, // R1
    { terrans: 6, lantids: 4, xenos: 4, gleens: 6, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 5, firaks: 4, bescods: 4, nevlas: 4, itars: 6, moweyds: 4, spaceGiants: 3, tinkerroids: 3, darkanians: 3 }, // R2
    { terrans: 6, lantids: 4, xenos: 4, gleens: 6, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 5, firaks: 4, bescods: 4, nevlas: 4, itars: 6, moweyds: 4, spaceGiants: 3, tinkerroids: 3, darkanians: 3 }, // R3
    { terrans: 6, lantids: 4, xenos: 4, gleens: 6, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 5, firaks: 4, bescods: 4, nevlas: 4, itars: 6, moweyds: 4, spaceGiants: 3, tinkerroids: 3, darkanians: 3 }, // R4
    { terrans: 6, lantids: 4, xenos: 4, gleens: 6, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 5, firaks: 4, bescods: 4, nevlas: 4, itars: 6, moweyds: 4, spaceGiants: 3, tinkerroids: 3, darkanians: 3 }, // R5
    { terrans: 6, lantids: 4, xenos: 4, gleens: 6, taklons: 4, ambas: 4, hadschHallas: 4, ivits: 4, geodens: 4, balTaks: 5, firaks: 4, bescods: 4, nevlas: 4, itars: 6, moweyds: 4, spaceGiants: 3, tinkerroids: 3, darkanians: 3 }, // R6
  ],
  // RS06 ガイア惑星に鉱山建設 +4VP
  RS06: [
    { terrans: 8, lantids: 5, xenos: 5, gleens: 8, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 6, firaks: 5, bescods: 5, nevlas: 5, itars: 8, moweyds: 5, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // R1
    { terrans: 8, lantids: 5, xenos: 5, gleens: 8, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 6, firaks: 5, bescods: 5, nevlas: 5, itars: 8, moweyds: 5, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // R2
    { terrans: 8, lantids: 5, xenos: 5, gleens: 8, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 6, firaks: 5, bescods: 5, nevlas: 5, itars: 8, moweyds: 5, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // R3
    { terrans: 8, lantids: 5, xenos: 5, gleens: 8, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 6, firaks: 5, bescods: 5, nevlas: 5, itars: 8, moweyds: 5, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // R4
    { terrans: 8, lantids: 5, xenos: 5, gleens: 8, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 6, firaks: 5, bescods: 5, nevlas: 5, itars: 8, moweyds: 5, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // R5
    { terrans: 8, lantids: 5, xenos: 5, gleens: 8, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 6, firaks: 5, bescods: 5, nevlas: 5, itars: 8, moweyds: 5, spaceGiants: 4, tinkerroids: 4, darkanians: 4 }, // R6
  ],
  // RS07 研究1レベル +2VP
  RS07: [
    { terrans: 5, lantids: 6, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 8, nevlas: 6, itars: 8, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R1
    { terrans: 5, lantids: 6, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 8, nevlas: 6, itars: 8, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R2
    { terrans: 5, lantids: 6, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 8, nevlas: 6, itars: 8, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R3
    { terrans: 5, lantids: 6, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 8, nevlas: 6, itars: 8, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R4
    { terrans: 5, lantids: 6, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 8, nevlas: 6, itars: 8, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R5
    { terrans: 5, lantids: 6, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 8, nevlas: 6, itars: 8, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R6
  ],
  // RS08 同盟タイル獲得 +5VP
  RS08: [
    { terrans: 5, lantids: 5, xenos: 8, gleens: 6, taklons: 5, ambas: 6, hadschHallas: 5, ivits: 8, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 6, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R1
    { terrans: 5, lantids: 5, xenos: 8, gleens: 6, taklons: 5, ambas: 6, hadschHallas: 5, ivits: 8, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 6, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R2
    { terrans: 5, lantids: 5, xenos: 8, gleens: 6, taklons: 5, ambas: 6, hadschHallas: 5, ivits: 8, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 6, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R3
    { terrans: 5, lantids: 5, xenos: 8, gleens: 6, taklons: 5, ambas: 6, hadschHallas: 5, ivits: 8, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 6, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R4
    { terrans: 5, lantids: 5, xenos: 8, gleens: 6, taklons: 5, ambas: 6, hadschHallas: 5, ivits: 8, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 6, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R5
    { terrans: 5, lantids: 5, xenos: 8, gleens: 6, taklons: 5, ambas: 6, hadschHallas: 5, ivits: 8, geodens: 5, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 6, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R6
  ],
  // RS09 惑星改造1段階 +2VP
  RS09: [
    { terrans: 5, lantids: 5, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 8, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 6, spaceGiants: 8, tinkerroids: 6, darkanians: 4 }, // R1
    { terrans: 5, lantids: 5, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 8, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 6, spaceGiants: 8, tinkerroids: 6, darkanians: 4 }, // R2
    { terrans: 5, lantids: 5, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 8, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 6, spaceGiants: 8, tinkerroids: 6, darkanians: 4 }, // R3
    { terrans: 5, lantids: 5, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 8, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 6, spaceGiants: 8, tinkerroids: 6, darkanians: 4 }, // R4
    { terrans: 5, lantids: 5, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 8, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 6, spaceGiants: 8, tinkerroids: 6, darkanians: 4 }, // R5
    { terrans: 5, lantids: 5, xenos: 6, gleens: 5, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 8, balTaks: 5, firaks: 5, bescods: 5, nevlas: 5, itars: 5, moweyds: 6, spaceGiants: 8, tinkerroids: 6, darkanians: 4 }, // R6
  ],
  // RS10 未入植の宙域で鉱山建設 +3VP
  RS10: [
    { terrans: 6, lantids: 8, xenos: 8, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 3, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 9 }, // R1
    { terrans: 6, lantids: 8, xenos: 8, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 3, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 9 }, // R2
    { terrans: 6, lantids: 8, xenos: 8, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 3, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 9 }, // R3
    { terrans: 6, lantids: 8, xenos: 8, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 3, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 9 }, // R4
    { terrans: 6, lantids: 8, xenos: 8, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 3, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 9 }, // R5
    { terrans: 6, lantids: 8, xenos: 8, gleens: 6, taklons: 8, ambas: 8, hadschHallas: 6, ivits: 6, geodens: 6, balTaks: 3, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 6, tinkerroids: 6, darkanians: 9 }, // R6
  ],
  // RS11 未入植の種類の惑星に鉱山建設 +3VP
  RS11: [
    { terrans: 6, lantids: 6, xenos: 6, gleens: 8, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 9, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 9, tinkerroids: 8, darkanians: 9 }, // R1
    { terrans: 6, lantids: 6, xenos: 6, gleens: 8, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 9, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 9, tinkerroids: 8, darkanians: 9 }, // R2
    { terrans: 6, lantids: 6, xenos: 6, gleens: 8, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 9, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 9, tinkerroids: 8, darkanians: 9 }, // R3
    { terrans: 6, lantids: 6, xenos: 6, gleens: 8, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 9, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 9, tinkerroids: 8, darkanians: 9 }, // R4
    { terrans: 6, lantids: 6, xenos: 6, gleens: 8, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 9, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 9, tinkerroids: 8, darkanians: 9 }, // R5
    { terrans: 6, lantids: 6, xenos: 6, gleens: 8, taklons: 6, ambas: 6, hadschHallas: 6, ivits: 6, geodens: 9, balTaks: 6, firaks: 6, bescods: 6, nevlas: 6, itars: 6, moweyds: 6, spaceGiants: 9, tinkerroids: 8, darkanians: 9 }, // R6
  ],
  // RS12 研究所建設 +4VP
  RS12: [
    { terrans: 5, lantids: 6, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 6, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R1
    { terrans: 5, lantids: 6, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 6, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R2
    { terrans: 5, lantids: 6, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 6, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R3
    { terrans: 5, lantids: 6, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 6, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R4
    { terrans: 5, lantids: 6, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 6, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R5
    { terrans: 5, lantids: 6, xenos: 5, gleens: 4, taklons: 5, ambas: 5, hadschHallas: 5, ivits: 5, geodens: 5, balTaks: 5, firaks: 8, bescods: 6, nevlas: 5, itars: 5, moweyds: 5, spaceGiants: 5, tinkerroids: 5, darkanians: 5 }, // R6
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
