import { describe, expect, it } from "vitest";
import { mergeIntoPairRanking, mergePairRanking, pairRankId, type PairRankRow } from "./pairRanking";

function row(mapHash: string, seed: string, score: number, extra: Partial<PairRankRow> = {}): PairRankRow {
  return {
    id: pairRankId(mapHash, seed),
    conditionKey: "c",
    mapSearchKey: "k",
    mapHash,
    tid: "4p_lostFleet",
    mapPlacement: [],
    mapScore: 0,
    seed,
    setupInput: { seed, playerCount: 4, mode: "lostFleet" },
    criterion: "topBalance",
    score,
    players: 4,
    lf: true,
    createdAt: 1,
    round: 1,
    ...extra,
  };
}

describe("pairRanking（連続で両方を探索の順位表）", () => {
  it("同じ組は 1 行に畳み、基準値の降順で上位 cap 行を残す（createdAt は古い方、score は新しい方）", () => {
    const existing = [row("a", "1", 10, { createdAt: 5 }), row("a", "2", 8), row("b", "1", 6)];
    const fresh = [row("a", "1", 12, { createdAt: 9, round: 2 }), row("c", "7", 9, { createdAt: 9 })];
    const merged = mergePairRanking(existing, fresh, 3);
    expect(merged.map((r) => [r.id, r.score])).toEqual([
      ["a:1", 12],
      ["c:7", 9],
      ["a:2", 8],
    ]);
    expect(merged[0].createdAt).toBe(5);
    expect(merged[0].round).toBe(2);
  });

  it("条件バケツごとにマージし、他の条件の行は触らない", () => {
    const all = [row("a", "1", 1, { conditionKey: "other" }), row("b", "1", 2)];
    const next = mergeIntoPairRanking(all, "c", [row("b", "2", 3)], 50);
    expect(next.filter((r) => r.conditionKey === "other")).toHaveLength(1);
    expect(next.filter((r) => r.conditionKey === "c").map((r) => r.id)).toEqual(["b:2", "b:1"]);
  });
});
