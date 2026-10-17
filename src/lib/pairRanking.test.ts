import { describe, expect, it } from "vitest";
import { groupPairRows, mergePairRows, pairMapKey, pairRankKeyOf, pairRowId, primaryOf, unexploredOf, type PairRow } from "./pairRanking";
import { DEFAULT_SETUP_WEIGHTS } from "@/gaia/eval/setupWeights";

function row(mapHash: string, seed: string, score: number, extra: Partial<PairRow> = {}): PairRow {
  const mapKey = pairMapKey("4p_lostFleet", mapHash);
  return { id: pairRowId("rk", mapKey, seed), rankKey: "rk", mapKey, seed, input: { seed, playerCount: 4, mode: "lostFleet" }, score, criterion: "topBalance", players: 4, lf: true, createdAt: 1, round: 1, ...extra };
}

describe("pairRanking（順位表: 主ごとに上位 N 組、主は M 件）", () => {
  it("主（マップ）ごとにまとめ、主の中は基準値の降順、主どうしは最良の降順", () => {
    const g = groupPairRows([row("a", "1", 5), row("b", "1", 9), row("a", "2", 7), row("c", "1", 1)], "mapToSetup");
    expect(g.map((x) => x.primary)).toEqual([pairMapKey("4p_lostFleet", "b"), pairMapKey("4p_lostFleet", "a"), pairMapKey("4p_lostFleet", "c")]);
    expect(g[1].rows.map((r) => r.seed)).toEqual(["2", "1"]);
    expect(primaryOf(row("a", "9", 0), "setupToMap")).toBe("9");
  });

  it("マージは主ごとに上位 perPrimary 組、主を primaries 件まで。同じ組は新しい score、古い createdAt。消す id を返す", () => {
    const existing = [row("a", "1", 10, { createdAt: 5 }), row("a", "2", 8), row("a", "3", 6), row("b", "1", 7), row("c", "1", 2)];
    const fresh = [row("a", "1", 12, { createdAt: 9, round: 2 }), row("d", "1", 9, { createdAt: 9 })];
    const { keep, dropIds } = mergePairRows(existing, fresh, "mapToSetup", 2, 3);
    const keys = keep.map((r) => `${r.mapKey.split("|")[1]}:${r.seed}`);
    expect(keys).toEqual(["a:1", "a:2", "d:1", "b:1"]);
    expect(keep[0].score).toBe(12);
    expect(keep[0].createdAt).toBe(5);
    expect(keep[0].round).toBe(2);
    expect(dropIds.sort()).toEqual([row("a", "3", 0).id, row("c", "1", 0).id].sort());
  });

  it("セットアップ → マップでは主がシード（同じシード × 多数のマップが 1 つの主にまとまる）", () => {
    const { keep } = mergePairRows([], [row("a", "7", 3), row("b", "7", 5), row("c", "7", 4), row("d", "8", 1)], "setupToMap", 2, 10);
    expect(keep.map((r) => `${r.mapKey.split("|")[1]}:${r.seed}`)).toEqual(["b:7", "c:7", "d:8"]);
  });

  it("探索済み: N 件に届いていないマップだけを残りの件数つきで返す。rankKey は向きごとに違う", () => {
    const maps = [{ key: "m1" }, { key: "m2" }, { key: "m3" }];
    expect(unexploredOf(maps, (m) => m.key, { m1: 100000, m2: 40000 }, 100000)).toEqual([
      { map: { key: "m2" }, remaining: 60000 },
      { map: { key: "m3" }, remaining: 100000 },
    ]);
    const base = { players: 4, lf: true, criterion: "topBalance" as const, evalWeights: DEFAULT_SETUP_WEIGHTS };
    expect(pairRankKeyOf({ ...base, dir: "mapToSetup" })).toHaveLength(8);
    expect(pairRankKeyOf({ ...base, dir: "mapToSetup" })).not.toBe(pairRankKeyOf({ ...base, dir: "setupToMap" }));
  });
});
