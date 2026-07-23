import { describe, it, expect } from "vitest";
import { buildSetupFromSeed } from "./buildSetup";
import { SETUP_CATALOG } from "./data";
import { RESEARCH_TRACK_IDS } from "./types";

const LF = { mode: "lostFleet" as const };

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

  it("has the expected Lost Fleet counts", () => {
    expect(SETUP_CATALOG.boostersLF).toHaveLength(4);
    expect(SETUP_CATALOG.roundScoringLF).toHaveLength(3);
    expect(SETUP_CATALOG.advancedTechLF).toHaveLength(6);
    expect(SETUP_CATALOG.standardTechLF).toHaveLength(3);
    expect(SETUP_CATALOG.finalScoringLF).toHaveLength(3);
    expect(SETUP_CATALOG.federationsGold).toHaveLength(8);
    expect(SETUP_CATALOG.artifacts).toHaveLength(13);
  });

  it("uses globally unique ids across every group (base + LF)", () => {
    const all = Object.values(SETUP_CATALOG).flatMap((group) => group.map((t) => t.id));
    expect(new Set(all).size).toBe(all.length);
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

describe("Lost Fleet mode", () => {
  const LF_STD_IDS = SETUP_CATALOG.standardTechLF.map((t) => t.id);
  const GOLD_IDS = SETUP_CATALOG.federationsGold.map((t) => t.id);
  const ART_IDS = SETUP_CATALOG.artifacts.map((t) => t.id);
  const ADV_ALL = [...ADV_IDS, ...SETUP_CATALOG.advancedTechLF.map((t) => t.id)];
  const BOOSTER_ALL = [...BOOSTER_IDS, ...SETUP_CATALOG.boostersLF.map((t) => t.id)];
  const FINAL_ALL = [...FINAL_IDS, ...SETUP_CATALOG.finalScoringLF.map((t) => t.id)];

  it("leaves base-mode output byte-identical (no LF fields, same roll)", () => {
    // The whole compatibility contract: rolling without `mode` must not change
    // when LF support exists. The base golden test pins the values; this pins
    // the SHAPE and that mode:"base" is the same as omitting it.
    const plain = buildSetupFromSeed({ seed: "snap-0001", playerCount: 4 });
    const explicit = buildSetupFromSeed({ seed: "snap-0001", playerCount: 4, mode: "base" });
    expect(explicit).toEqual(plain);
    for (const key of ["mode", "ships", "shipTech", "artifacts", "goldFederations", "econTileFace", "extensionFace"]) {
      expect(key in plain).toBe(false);
    }
    expect("extension" in plain.advancedTech).toBe(false);
  });

  it("pins a golden LF roll for a fixed seed", () => {
    const r = buildSetupFromSeed({ seed: "snap-0001", playerCount: 4, ...LF });
    expect(r).toEqual(GOLDEN_LF_SNAP_0001);
  });

  const r4 = buildSetupFromSeed({ seed: "lf-structure", playerCount: 4, ...LF });
  const r2 = buildSetupFromSeed({ seed: "lf-structure", playerCount: 2, ...LF });

  it("draws 7 distinct advanced tech (6 tracks + extension) from the merged 21", () => {
    const used = [...Object.values(r4.advancedTech.byTrack), r4.advancedTech.extension!];
    expect(used).toHaveLength(7);
    expect(new Set(used).size).toBe(7);
    expect(used.every((id) => ADV_ALL.includes(id))).toBe(true);
  });

  it("partitions the merged 14-booster pool", () => {
    const { available, unused } = r4.boosters;
    expect(available).toHaveLength(7);
    expect([...available, ...unused].sort()).toEqual([...BOOSTER_ALL].sort());
  });

  it("draws round scoring from the merged 13-tile physical pool", () => {
    expect(r4.roundScoring).toHaveLength(6);
    const validIds = [...SCORING_IDS, ...SETUP_CATALOG.roundScoringLF.map((t) => t.id)];
    expect(r4.roundScoring.every((id) => validIds.includes(id))).toBe(true);
  });

  it("draws 2 distinct final scoring tiles from the merged 9", () => {
    expect(r4.finalScoring).toHaveLength(2);
    expect(new Set(r4.finalScoring).size).toBe(2);
    expect(r4.finalScoring.every((id) => FINAL_ALL.includes(id))).toBe(true);
  });

  it("at 4 players: 4 ships, 3 ship-tech spaces, 4 gold federations, 4 artifacts", () => {
    expect(r4.ships).toEqual(["twilight", "eclipse", "rebellion", "tfmars"]);
    expect(Object.keys(r4.shipTech!).sort()).toEqual(["eclipse", "rebellion", "tfmars"]);
    const shipTechIds = Object.values(r4.shipTech!);
    expect(new Set(shipTechIds).size).toBe(3);
    expect(shipTechIds.every((id) => LF_STD_IDS.includes(id!))).toBe(true);
    const golds = Object.values(r4.goldFederations!);
    expect(Object.keys(r4.goldFederations!).sort()).toEqual([...r4.ships!].sort());
    expect(new Set(golds).size).toBe(4);
    expect(golds.every((id) => GOLD_IDS.includes(id!))).toBe(true);
    expect(r4.artifacts).toHaveLength(4);
    expect(new Set(r4.artifacts).size).toBe(4);
    expect(r4.artifacts!.every((id) => ART_IDS.includes(id))).toBe(true);
  });

  it("at 2 players: Rebellion boxed, 2 ship-tech spaces, 3 gold federations, 2 artifacts", () => {
    expect(r2.ships).toEqual(["twilight", "eclipse", "tfmars"]);
    expect(Object.keys(r2.shipTech!).sort()).toEqual(["eclipse", "tfmars"]);
    expect(new Set(Object.values(r2.shipTech!)).size).toBe(2);
    expect(Object.keys(r2.goldFederations!).sort()).toEqual(["eclipse", "tfmars", "twilight"]);
    expect(r2.artifacts).toHaveLength(2);
  });

  it("clamps LF player count to 2..4", () => {
    expect(buildSetupFromSeed({ seed: "pc", playerCount: 1, ...LF }).playerCount).toBe(2);
    expect(buildSetupFromSeed({ seed: "pc", playerCount: 9, ...LF }).playerCount).toBe(4);
  });

  it("extension face defaults by player count and can be randomized", () => {
    expect(r2.extensionFace).toBe("vp25");
    expect(r4.extensionFace).toBe("shuttle");
    const rnd = buildSetupFromSeed({ seed: "lf-structure", playerCount: 4, ...LF, randomExtensionFace: true });
    expect(["vp25", "shuttle"]).toContain(rnd.extensionFace);
    // Deterministic for the same seed.
    const rnd2 = buildSetupFromSeed({ seed: "lf-structure", playerCount: 4, ...LF, randomExtensionFace: true });
    expect(rnd2.extensionFace).toBe(rnd.extensionFace);
    // Some seed yields each face.
    const faces = new Set(
      Array.from({ length: 20 }, (_, i) =>
        buildSetupFromSeed({ seed: `face-${i}`, playerCount: 4, ...LF, randomExtensionFace: true }).extensionFace
      )
    );
    expect(faces).toEqual(new Set(["vp25", "shuttle"]));
  });

  it("econ tile face is deterministic and covers both faces across seeds", () => {
    expect(["A", "B"]).toContain(r4.econTileFace);
    const faces = new Set(
      Array.from({ length: 20 }, (_, i) =>
        buildSetupFromSeed({ seed: `econ-${i}`, playerCount: 4, ...LF }).econTileFace
      )
    );
    expect(faces).toEqual(new Set(["A", "B"]));
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

// Golden LF roll for the same seed (regenerate deliberately, same command with
// mode: "lostFleet"). The mixed pools shuffle different id lists, so LF values
// legitimately differ from the base roll above.
const GOLDEN_LF_SNAP_0001 = {
  seed: "snap-0001",
  playerCount: 4,
  standardTech: {
    byTrack: { terra: "TS5", nav: "TS1", ai: "TS6", gaia: "TS9", eco: "TS7", sci: "TS4" },
    free: ["TS3", "TS8", "TS2"],
  },
  advancedTech: {
    byTrack: { terra: "AT21", nav: "AT17", ai: "AT16", gaia: "AT03", eco: "AT04", sci: "AT08" },
    extension: "AT10",
  },
  boosters: {
    available: ["RB12", "RB11", "RB10", "RB09", "RB04", "RB14", "RB07"],
    unused: ["RB13", "RB01", "RB06", "RB03", "RB05", "RB02", "RB08"],
  },
  roundScoring: ["RS01", "RS05", "RS06", "RS02", "RS11", "RS09"],
  finalScoring: ["FS04", "FS06"],
  federationLv5: "FED8PT",
  mode: "lostFleet",
  ships: ["twilight", "eclipse", "rebellion", "tfmars"],
  shipTech: { eclipse: "TSL1", rebellion: "TSL3", tfmars: "TSL2" },
  artifacts: ["ART10", "ART05", "ART03", "ART07"],
  goldFederations: { twilight: "FEDG8", eclipse: "FEDG4", rebellion: "FEDG5", tfmars: "FEDG2" },
  econTileFace: "B",
  extensionFace: "shuttle",
};
