import { describe, expect, it } from "vitest";
import { searchChunk } from "./setupSearchCore";
import { scorePairs } from "./pairSearch";
import { mapTopOfPlacement } from "./pairPlan";
import { FACTION_IDS } from "@/gaia/eval/factionWeights";
import { DEFAULT_SETUP_WEIGHTS } from "@/gaia/eval/setupWeights";
import type { PersistedCandidate } from "@/app/board/persistence";

function mapWith(id: string, totals: Partial<Record<string, number>>, score: number): PersistedCandidate {
  const byFaction: Record<string, { total: number }> = {};
  for (const f of FACTION_IDS) byFaction[f] = { total: totals[f] ?? 100 };
  return { id, searchKey: "k", placementHash: `h_${id}`, seed: "1", score, rankValue: -score, placement: [], evaluation: { breakdown: { audit: { startAccess: { byFaction } } } }, used: false, usedKey: 0, createdAt: 0, updatedAt: 0 };
}
const TMAP = { k: "4p_lostFleet" };
const BASE = { playerCount: 4, mode: "lostFleet" as const };
const SEEDS = ["101", "102", "103", "104", "105", "106"];

describe("setupSearchCore.searchChunk の pairWith（連続で両方を探索: マップに合わせた採点）", () => {
  it("同じマップ・同じシードなら scorePairs（planPair と同じ式）と同じ基準値になる（基準 1: 合計 T_f）", () => {
    const m = mapWith("a", { terrans: 160, lantids: 60 }, 3);
    const bd = m.evaluation.breakdown;
    const top = mapTopOfPlacement("4p_lostFleet", [], 4);
    const hits = searchChunk(
      { seeds: SEEDS, criterion: "topBalance", playerCount: 4, lostFleet: true, weights: DEFAULT_SETUP_WEIGHTS, topN: 6, baseInput: BASE, pairWith: { mapBreakdown: bd, mapTop3: top?.top3, mapTopK: top?.topK, factionPrefByFaction: {} } },
      SEEDS,
      []
    );
    const ref = scorePairs({ maps: [m], setups: SEEDS.map((seed) => ({ seed, input: { ...BASE, seed } })), templateIdBySearchKey: TMAP, criterion: "topBalance", players: 4, lf: true, evalWeights: DEFAULT_SETUP_WEIGHTS, factionPref: {}, k: 1, l: 6, topN: 6 });
    expect(hits.map((h) => h.seed)).toEqual(ref.map((o) => o.rec.input.seed));
    hits.forEach((h, i) => expect(h.score).toBeCloseTo(ref[i].rec.score, 9));
  });

  it("種族優遇と合算比も同じ式（基準 2）。マップ無しの採点とは値が違う", () => {
    const m = mapWith("b", { xenos: 150 }, 1);
    const bd = m.evaluation.breakdown;
    const pref = { terrans: 2, xenos: -1 };
    const blend = { map: 1.5, setup: 1 };
    const hits = searchChunk(
      { seeds: SEEDS, criterion: "neutralBalance", playerCount: 4, lostFleet: true, weights: DEFAULT_SETUP_WEIGHTS, topN: 6, baseInput: BASE, pairWith: { mapBreakdown: bd, blend, factionPrefByFaction: pref } },
      SEEDS,
      []
    );
    const ref = scorePairs({ maps: [m], setups: SEEDS.map((seed) => ({ seed, input: { ...BASE, seed } })), templateIdBySearchKey: TMAP, criterion: "neutralBalance", players: 4, lf: true, evalWeights: DEFAULT_SETUP_WEIGHTS, factionPref: pref, blend, k: 1, l: 6, topN: 6 });
    expect(hits.map((h) => h.seed)).toEqual(ref.map((o) => o.rec.input.seed));
    hits.forEach((h, i) => expect(h.score).toBeCloseTo(ref[i].rec.score, 9));
    const plain = searchChunk({ seeds: SEEDS, criterion: "neutralBalance", playerCount: 4, lostFleet: true, weights: DEFAULT_SETUP_WEIGHTS, topN: 6, baseInput: BASE }, SEEDS, []);
    const byScore = (xs: Array<{ seed: string; score: number }>) => Object.fromEntries(xs.map((x) => [x.seed, x.score]));
    const a = byScore(hits);
    const b = byScore(plain);
    expect(SEEDS.some((s) => Math.abs(a[s] - b[s]) > 1e-6)).toBe(true);
  });
});
