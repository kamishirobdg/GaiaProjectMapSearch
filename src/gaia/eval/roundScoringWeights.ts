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
    { terrans: 10, lantids: 14, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 12, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R1
    { terrans: 10, lantids: 14, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 12, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R2
    { terrans: 10, lantids: 14, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 12, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R3
    { terrans: 10, lantids: 14, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 12, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R4
    { terrans: 10, lantids: 14, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 12, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R5
    { terrans: 10, lantids: 14, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 12, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R6
  ],
  // RS02 交易所建設 +3VP
  RS02: [
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10 }, // R1
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10 }, // R2
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10 }, // R3
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10 }, // R4
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10 }, // R5
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10 }, // R6
  ],
  // RS03 交易所建設 +4VP
  RS03: [
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10 }, // R1
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10 }, // R2
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10 }, // R3
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10 }, // R4
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10 }, // R5
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10 }, // R6
  ],
  // RS04 学院・惑星首府建設 +5VP ×2
  RS04: [
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 12, nevlas: 12, itars: 12 }, // R1
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 12, nevlas: 12, itars: 12 }, // R2
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 12, nevlas: 12, itars: 12 }, // R3
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 12, nevlas: 12, itars: 12 }, // R4
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 12, nevlas: 12, itars: 12 }, // R5
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 12, nevlas: 12, itars: 12 }, // R6
  ],
  // RS05 ガイア惑星に鉱山建設 +3VP
  RS05: [
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14 }, // R1
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14 }, // R2
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14 }, // R3
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14 }, // R4
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14 }, // R5
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14 }, // R6
  ],
  // RS06 ガイア惑星に鉱山建設 +4VP
  RS06: [
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14 }, // R1
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14 }, // R2
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14 }, // R3
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14 }, // R4
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14 }, // R5
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14 }, // R6
  ],
  // RS07 研究1レベル +2VP
  RS07: [
    { terrans: 10, lantids: 12, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 14, nevlas: 12, itars: 14 }, // R1
    { terrans: 10, lantids: 12, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 14, nevlas: 12, itars: 14 }, // R2
    { terrans: 10, lantids: 12, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 14, nevlas: 12, itars: 14 }, // R3
    { terrans: 10, lantids: 12, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 14, nevlas: 12, itars: 14 }, // R4
    { terrans: 10, lantids: 12, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 14, nevlas: 12, itars: 14 }, // R5
    { terrans: 10, lantids: 12, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 14, nevlas: 12, itars: 14 }, // R6
  ],
  // RS08 同盟タイル獲得 +5VP
  RS08: [
    { terrans: 10, lantids: 10, xenos: 14, gleens: 12, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 14, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R1
    { terrans: 10, lantids: 10, xenos: 14, gleens: 12, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 14, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R2
    { terrans: 10, lantids: 10, xenos: 14, gleens: 12, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 14, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R3
    { terrans: 10, lantids: 10, xenos: 14, gleens: 12, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 14, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R4
    { terrans: 10, lantids: 10, xenos: 14, gleens: 12, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 14, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R5
    { terrans: 10, lantids: 10, xenos: 14, gleens: 12, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 14, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R6
  ],
  // RS09 惑星改造1段階 +2VP
  RS09: [
    { terrans: 10, lantids: 10, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R1
    { terrans: 10, lantids: 10, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R2
    { terrans: 10, lantids: 10, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R3
    { terrans: 10, lantids: 10, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R4
    { terrans: 10, lantids: 10, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R5
    { terrans: 10, lantids: 10, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10 }, // R6
  ],
};

/** ★拡張版（18種族×12枚）。CSV から生成。 */
export const ROUND_SCORING_WEIGHTS_LF: RoundScoringTable = {
  // RS01 鉱山建設 +2VP
  RS01: [
    { terrans: 10, lantids: 14, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 12, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 14, tinkerroids: 10, darkanians: 14 }, // R1
    { terrans: 10, lantids: 14, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 12, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 14, tinkerroids: 10, darkanians: 14 }, // R2
    { terrans: 10, lantids: 14, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 12, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 14, tinkerroids: 10, darkanians: 14 }, // R3
    { terrans: 10, lantids: 14, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 12, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 14, tinkerroids: 10, darkanians: 14 }, // R4
    { terrans: 10, lantids: 14, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 12, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 14, tinkerroids: 10, darkanians: 14 }, // R5
    { terrans: 10, lantids: 14, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 12, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 14, tinkerroids: 10, darkanians: 14 }, // R6
  ],
  // RS02 交易所建設 +3VP
  RS02: [
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R1
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R2
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R3
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R4
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R5
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R6
  ],
  // RS03 交易所建設 +4VP
  RS03: [
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R1
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R2
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R3
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R4
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R5
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 12, ambas: 10, hadschHallas: 12, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 10, nevlas: 12, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R6
  ],
  // RS04 学院・惑星首府建設 +5VP ×2
  RS04: [
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 12, nevlas: 12, itars: 12, moweyds: 10, spaceGiants: 10, tinkerroids: 8, darkanians: 10 }, // R1
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 12, nevlas: 12, itars: 12, moweyds: 10, spaceGiants: 10, tinkerroids: 8, darkanians: 10 }, // R2
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 12, nevlas: 12, itars: 12, moweyds: 10, spaceGiants: 10, tinkerroids: 8, darkanians: 10 }, // R3
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 12, nevlas: 12, itars: 12, moweyds: 10, spaceGiants: 10, tinkerroids: 8, darkanians: 10 }, // R4
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 12, nevlas: 12, itars: 12, moweyds: 10, spaceGiants: 10, tinkerroids: 8, darkanians: 10 }, // R5
    { terrans: 10, lantids: 10, xenos: 10, gleens: 10, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 10, bescods: 12, nevlas: 12, itars: 12, moweyds: 10, spaceGiants: 10, tinkerroids: 8, darkanians: 10 }, // R6
  ],
  // RS05 ガイア惑星に鉱山建設 +3VP
  RS05: [
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14, moweyds: 10, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // R1
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14, moweyds: 10, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // R2
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14, moweyds: 10, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // R3
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14, moweyds: 10, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // R4
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14, moweyds: 10, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // R5
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14, moweyds: 10, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // R6
  ],
  // RS06 ガイア惑星に鉱山建設 +4VP
  RS06: [
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14, moweyds: 10, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // R1
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14, moweyds: 10, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // R2
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14, moweyds: 10, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // R3
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14, moweyds: 10, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // R4
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14, moweyds: 10, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // R5
    { terrans: 14, lantids: 10, xenos: 10, gleens: 14, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 12, firaks: 10, bescods: 10, nevlas: 10, itars: 14, moweyds: 10, spaceGiants: 8, tinkerroids: 8, darkanians: 8 }, // R6
  ],
  // RS07 研究1レベル +2VP
  RS07: [
    { terrans: 10, lantids: 12, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 14, nevlas: 12, itars: 14, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R1
    { terrans: 10, lantids: 12, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 14, nevlas: 12, itars: 14, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R2
    { terrans: 10, lantids: 12, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 14, nevlas: 12, itars: 14, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R3
    { terrans: 10, lantids: 12, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 14, nevlas: 12, itars: 14, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R4
    { terrans: 10, lantids: 12, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 14, nevlas: 12, itars: 14, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R5
    { terrans: 10, lantids: 12, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 14, nevlas: 12, itars: 14, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R6
  ],
  // RS08 同盟タイル獲得 +5VP
  RS08: [
    { terrans: 10, lantids: 10, xenos: 14, gleens: 12, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 14, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 12, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R1
    { terrans: 10, lantids: 10, xenos: 14, gleens: 12, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 14, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 12, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R2
    { terrans: 10, lantids: 10, xenos: 14, gleens: 12, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 14, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 12, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R3
    { terrans: 10, lantids: 10, xenos: 14, gleens: 12, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 14, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 12, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R4
    { terrans: 10, lantids: 10, xenos: 14, gleens: 12, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 14, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 12, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R5
    { terrans: 10, lantids: 10, xenos: 14, gleens: 12, taklons: 10, ambas: 12, hadschHallas: 10, ivits: 14, geodens: 10, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 12, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R6
  ],
  // RS09 惑星改造1段階 +2VP
  RS09: [
    { terrans: 10, lantids: 10, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 12, spaceGiants: 14, tinkerroids: 12, darkanians: 8 }, // R1
    { terrans: 10, lantids: 10, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 12, spaceGiants: 14, tinkerroids: 12, darkanians: 8 }, // R2
    { terrans: 10, lantids: 10, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 12, spaceGiants: 14, tinkerroids: 12, darkanians: 8 }, // R3
    { terrans: 10, lantids: 10, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 12, spaceGiants: 14, tinkerroids: 12, darkanians: 8 }, // R4
    { terrans: 10, lantids: 10, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 12, spaceGiants: 14, tinkerroids: 12, darkanians: 8 }, // R5
    { terrans: 10, lantids: 10, xenos: 12, gleens: 10, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 12, spaceGiants: 14, tinkerroids: 12, darkanians: 8 }, // R6
  ],
  // RS10 未入植の宙域で鉱山建設 +3VP
  RS10: [
    { terrans: 10, lantids: 12, xenos: 12, gleens: 10, taklons: 12, ambas: 12, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 6, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 14 }, // R1
    { terrans: 10, lantids: 12, xenos: 12, gleens: 10, taklons: 12, ambas: 12, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 6, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 14 }, // R2
    { terrans: 10, lantids: 12, xenos: 12, gleens: 10, taklons: 12, ambas: 12, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 6, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 14 }, // R3
    { terrans: 10, lantids: 12, xenos: 12, gleens: 10, taklons: 12, ambas: 12, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 6, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 14 }, // R4
    { terrans: 10, lantids: 12, xenos: 12, gleens: 10, taklons: 12, ambas: 12, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 6, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 14 }, // R5
    { terrans: 10, lantids: 12, xenos: 12, gleens: 10, taklons: 12, ambas: 12, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 6, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 14 }, // R6
  ],
  // RS11 未入植の種類の惑星に鉱山建設 +3VP
  RS11: [
    { terrans: 10, lantids: 10, xenos: 10, gleens: 12, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 14, tinkerroids: 12, darkanians: 14 }, // R1
    { terrans: 10, lantids: 10, xenos: 10, gleens: 12, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 14, tinkerroids: 12, darkanians: 14 }, // R2
    { terrans: 10, lantids: 10, xenos: 10, gleens: 12, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 14, tinkerroids: 12, darkanians: 14 }, // R3
    { terrans: 10, lantids: 10, xenos: 10, gleens: 12, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 14, tinkerroids: 12, darkanians: 14 }, // R4
    { terrans: 10, lantids: 10, xenos: 10, gleens: 12, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 14, tinkerroids: 12, darkanians: 14 }, // R5
    { terrans: 10, lantids: 10, xenos: 10, gleens: 12, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 14, balTaks: 10, firaks: 10, bescods: 10, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 14, tinkerroids: 12, darkanians: 14 }, // R6
  ],
  // RS12 研究所建設 +4VP
  RS12: [
    { terrans: 10, lantids: 12, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 12, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R1
    { terrans: 10, lantids: 12, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 12, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R2
    { terrans: 10, lantids: 12, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 12, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R3
    { terrans: 10, lantids: 12, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 12, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R4
    { terrans: 10, lantids: 12, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 12, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R5
    { terrans: 10, lantids: 12, xenos: 10, gleens: 8, taklons: 10, ambas: 10, hadschHallas: 10, ivits: 10, geodens: 10, balTaks: 10, firaks: 14, bescods: 12, nevlas: 10, itars: 10, moweyds: 10, spaceGiants: 10, tinkerroids: 10, darkanians: 10 }, // R6
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
