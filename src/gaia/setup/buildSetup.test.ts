import { describe, it, expect } from "vitest";
import { buildSetupFromSeed } from "./buildSetup";
import { SETUP_CATALOG } from "./data";
import { RESEARCH_TRACK_IDS } from "./types";

const STD_IDS = SETUP_CATALOG.standardTech.map((t) => t.id);
const ADV_IDS = SETUP_CATALOG.advancedTech.map((t) => t.id);
const BOOSTER_IDS = SETUP_CATALOG.boosters.map((t) => t.id);
const SCORING_IDS = SETUP_CATALOG.roundScoring.map((t) => t.id);
const FINAL_IDS = SETUP_CATALOG.finalScoring.map((t) => t.id);
const FED_IDS = SETUP_CATALOG.federations.map((t) => t.id);

const SCORING_COPIES: Record<string, number> = Object.fromEntries(
  SETUP_CATALOG.roundScoring.map((t) => [t.id, Math.max(1, Math.floor(t.copies ?? 1))])
);

// Guard the structural assumptions the randomizer relies on. Counts verified
// against the rulebook component overview (2026-07-21). If the catalog counts
// drift, several of the slice() calls in the builder would silently produce
// short results instead of failing here.
describe("catalog structure", () => {
  it("has the expected counts", () => {
    expect(STD_IDS).toHaveLength(9);
    expect(ADV_IDS).toHaveLength(15);
    expect(BOOSTER_IDS).toHaveLength(10);
    expect(SCORING_IDS).toHaveLength(9);
    expect(FINAL_IDS).toHaveLength(6);
    expect(FED_IDS).toHaveLength(6);
  });

  it("round scoring entries form a physical pool of 10 (8 x1 + 1 x2)", () => {
    // Appendix V: trading station and gaia-mine exist as separate 3/4 VP
    // tiles (distinct ids), so only the federation +5 VP tile is duplicated.
    const total = Object.values(SCORING_COPIES).reduce((a, b) => a + b, 0);
    expect(total).toBe(10);
    expect(Object.values(SCORING_COPIES).filter((c) => c === 1)).toHaveLength(8);
    expect(Object.values(SCORING_COPIES).filter((c) => c === 2)).toHaveLength(1);
  });

  it("uses unique ids within each component", () => {
    for (const ids of [STD_IDS, ADV_IDS, BOOSTER_IDS, SCORING_IDS, FINAL_IDS, FED_IDS]) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("buildSetupFromSeed determinism", () => {
  it("is a pure function of (seed, playerCount)", () => {
    const a = buildSetupFromSeed({ seed: "snap-0001", playerCount: 4 });
    const b = buildSetupFromSeed({ seed: "snap-0001", playerCount: 4 });
    expect(a).toEqual(b);
  });

  it("pins a golden roll for a fixed seed", () => {
    // Golden values from this implementation + the current catalog ids. A diff
    // means either the RNG or the id set moved; regenerate intentionally.
    const r = buildSetupFromSeed({ seed: "snap-0001", playerCount: 4 });
    expect(r).toEqual(GOLDEN_SNAP_0001);
  });

  it("gives different seeds different rolls", () => {
    const a = buildSetupFromSeed({ seed: "seed-A" });
    const b = buildSetupFromSeed({ seed: "seed-B" });
    expect(a).not.toEqual({ ...b, seed: "seed-A" });
  });
});

describe("buildSetupFromSeed structure", () => {
  const r = buildSetupFromSeed({ seed: "structure", playerCount: 3 });

  it("assigns one distinct standard tech per track plus 3 free, all from the catalog", () => {
    const used = [...Object.values(r.standardTech.byTrack), ...r.standardTech.free];
    expect(used).toHaveLength(9);
    expect(new Set(used).size).toBe(9); // no type used twice
    expect(used.every((id) => STD_IDS.includes(id))).toBe(true);
    expect(Object.keys(r.standardTech.byTrack).sort()).toEqual([...RESEARCH_TRACK_IDS].sort());
  });

  it("assigns 6 distinct advanced tech (of 15), one per track", () => {
    const used = Object.values(r.advancedTech.byTrack);
    expect(used).toHaveLength(6);
    expect(new Set(used).size).toBe(6);
    expect(used.every((id) => ADV_IDS.includes(id))).toBe(true);
  });

  it("partitions the booster pool into available + unused with no overlap", () => {
    const { available, unused } = r.boosters;
    expect(available).toHaveLength(3 + 3); // playerCount 3 + 3
    expect([...available, ...unused].sort()).toEqual([...BOOSTER_IDS].sort());
    expect(available.some((id) => unused.includes(id))).toBe(false);
  });

  it("draws 6 round scoring tiles honoring each type's physical copies", () => {
    expect(r.roundScoring).toHaveLength(6);
    expect(r.roundScoring.every((id) => SCORING_IDS.includes(id))).toBe(true);
    const cnt: Record<string, number> = {};
    for (const id of r.roundScoring) cnt[id] = (cnt[id] ?? 0) + 1;
    for (const [id, n] of Object.entries(cnt)) {
      expect(n).toBeLessThanOrEqual(SCORING_COPIES[id]);
    }
  });

  it("a x2 scoring type CAN occupy two rounds for some seed", () => {
    // Sanity that duplicates are actually possible (the old 10-distinct-types
    // model could never produce one). Scan a few seeds for a duplicate.
    let found = false;
    for (let i = 0; i < 50 && !found; i++) {
      const roll = buildSetupFromSeed({ seed: `dup-${i}` });
      found = new Set(roll.roundScoring).size < roll.roundScoring.length;
    }
    expect(found).toBe(true);
  });

  it("draws 2 distinct final scoring tiles", () => {
    expect(r.finalScoring).toHaveLength(2);
    expect(new Set(r.finalScoring).size).toBe(2);
    expect(r.finalScoring.every((id) => FINAL_IDS.includes(id))).toBe(true);
  });

  it("draws one federation type for Terraforming level 5", () => {
    expect(FED_IDS).toContain(r.federationLv5);
  });
});

describe("player count", () => {
  it("scales available boosters as playerCount + 3", () => {
    for (const [players, expected] of [[1, 4], [2, 5], [3, 6], [4, 7]] as const) {
      const r = buildSetupFromSeed({ seed: "pc", playerCount: players });
      expect(r.boosters.available).toHaveLength(expected);
    }
  });

  it("clamps out-of-range player counts into 1..4", () => {
    expect(buildSetupFromSeed({ seed: "pc", playerCount: 0 }).playerCount).toBe(1);
    expect(buildSetupFromSeed({ seed: "pc", playerCount: 9 }).playerCount).toBe(4);
    expect(buildSetupFromSeed({ seed: "pc" }).playerCount).toBe(4); // default
  });
});

// ---------------------------------------------------------------------------
// Golden roll (regenerate deliberately when the RNG or catalog ids change):
//   npx tsx -e "import('./src/gaia/setup/buildSetup').then(m => console.log(JSON.stringify(m.buildSetupFromSeed({ seed: 'snap-0001', playerCount: 4 }), null, 2)))"
// ---------------------------------------------------------------------------
const GOLDEN_SNAP_0001 = {
  seed: "snap-0001",
  playerCount: 4,
  standardTech: {
    byTrack: { terra: "TS5", nav: "TS1", ai: "TS6", gaia: "TS9", eco: "TS7", sci: "TS4" },
    free: ["TS3", "TS8", "TS2"],
  },
  advancedTech: {
    byTrack: { terra: "AT04", nav: "AT06", ai: "AT02", gaia: "AT09", eco: "AT12", sci: "AT03" },
  },
  boosters: {
    available: ["RB07", "RB10", "RB03", "RB05", "RB09", "RB08", "RB02"],
    unused: ["RB04", "RB01", "RB06"],
  },
  roundScoring: ["RS01", "RS03", "RS04", "RS08", "RS05", "RS02"],
  finalScoring: ["FS05", "FS06"],
  federationLv5: "FED8PT",
};
