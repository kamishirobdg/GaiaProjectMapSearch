// src/lib/setupRanking.test.ts
//
// 一括探索ランキングのマージ（純粋部分）。IndexedDB を伴う関数はブラウザ専用の
// ため対象外（persistence.test.ts と同じ切り分け）。
//
// 押さえたいのは「次の探索は前回の上位とマージして上位だけを残す」こと:
//   - 前回だけにある良い候補が新しい探索で消えない
//   - 同じシードは1件に畳み、いつ見つけたか（createdAt）は保つ
//   - あふれた分は drop として返る（呼び出し側が DB から消す）

import { describe, expect, it } from "vitest";
import { mergeRankingRows, type ScoredSetup } from "./setupRanking";
import type { BuildSetupInput } from "@/gaia/setup/buildSetup";

const CK = "cond";
const CRIT = "topBalance" as const;

function input(seed: string): BuildSetupInput {
  return { seed, playerCount: 4 } as BuildSetupInput;
}
function old(seed: string, score: number, createdAt = 100): ScoredSetup {
  return {
    id: `${CK}:${CRIT}:${seed}`,
    conditionKey: CK,
    criterion: CRIT,
    seed,
    input: input(seed),
    score,
    createdAt,
  };
}
function fresh(seed: string, score: number) {
  return { seed, input: input(seed), score };
}
const merge = (existing: ScoredSetup[], f: ReturnType<typeof fresh>[], cap: number) =>
  mergeRankingRows({ conditionKey: CK, criterion: CRIT, existing, fresh: f, cap, now: 999 });

describe("mergeRankingRows", () => {
  it("前回の上位と今回の結果を混ぜて上位だけ残す", () => {
    const { keep, drop } = merge([old("a", 5), old("b", 1)], [fresh("c", 3), fresh("d", 0)], 3);
    expect(keep.map((r) => r.seed)).toEqual(["a", "c", "b"]);
    expect(drop).toEqual([`${CK}:${CRIT}:d`]);
  });

  it("前回だけにある良い候補は今回の探索で消えない", () => {
    // 今回の結果が全部弱くても、前回の 1位は残る
    const { keep } = merge([old("keeper", 9)], [fresh("x", 1), fresh("y", 0.5)], 2);
    expect(keep.map((r) => r.seed)).toEqual(["keeper", "x"]);
  });

  it("同じシードは1件に畳み、createdAt は最初に見つけたときのまま", () => {
    const { keep, drop } = merge([old("same", 2, 42)], [fresh("same", 7)], 5);
    expect(keep).toHaveLength(1);
    expect(drop).toEqual([]);
    // スコアは新しい方、createdAt は元のまま
    expect(keep[0].score).toBe(7);
    expect(keep[0].createdAt).toBe(42);
  });

  it("新しく見つけた候補の createdAt は now", () => {
    const { keep } = merge([], [fresh("n", 1)], 5);
    expect(keep[0].createdAt).toBe(999);
  });

  it("同点は seed で安定（同じ入力なら毎回同じ並び）", () => {
    const a = merge([], [fresh("b", 1), fresh("a", 1), fresh("c", 1)], 3);
    const b = merge([], [fresh("c", 1), fresh("b", 1), fresh("a", 1)], 3);
    expect(a.keep.map((r) => r.seed)).toEqual(["a", "b", "c"]);
    expect(b.keep.map((r) => r.seed)).toEqual(["a", "b", "c"]);
  });

  it("残る行の id は条件×基準×シードで、drop と重ならない", () => {
    const { keep, drop } = merge([old("a", 5)], [fresh("b", 9), fresh("c", 1)], 2);
    expect(keep.map((r) => r.id)).toEqual([`${CK}:${CRIT}:b`, `${CK}:${CRIT}:a`]);
    for (const id of drop) expect(keep.some((r) => r.id === id)).toBe(false);
  });
});
