import { describe, it, expect } from "vitest";
import {
  checkHardConstraints,
  checkH1MinDist,
  checkH2OuterColorCap,
  checkH4CenterLarge14,
  checkH5ConnectedCap,
  type HardCheckResult,
  type HardFailReason,
} from "./constraints";
import type {
  AxialKey,
  EvalCell,
  ExtractedForEval,
  HardParams,
} from "./eval/extractForEval";

// ---------------------------------------------------------------------------
// Builders: the constraint checks only read a handful of fields off
// ExtractedForEval, so these fill in inert defaults for the rest rather than
// running the real extractor (which would make the cases untargetable).
// ---------------------------------------------------------------------------

type CellSpec = {
  q: number;
  r: number;
  kind?: EvalCell["kind"];
  colorKey?: string;
  slotId?: string;
  sectorId?: string;
};

function cell(spec: CellSpec): EvalCell {
  const kind = spec.kind ?? "planet";
  return {
    key: `${spec.q},${spec.r}` as AxialKey,
    q: spec.q,
    r: spec.r,
    slotId: spec.slotId ?? "L1",
    sectorId: spec.sectorId ?? "01",
    rotSeed: 0,
    rotLogical: 0,
    kind,
    tags: [],
    isPlanet: kind === "planet",
    isExcludedPlanet: false,
    isNormalPlanet: kind === "planet" && spec.colorKey !== undefined,
    colorKey: spec.colorKey,
    isScoutCell: false,
  };
}

function extracted(parts: {
  cells?: EvalCell[];
  normalPlanetCells?: EvalCell[];
  scoutCells?: EvalCell[];
  outerCells?: AxialKey[];
  centralSlotIds?: string[];
}): ExtractedForEval {
  const cells = parts.cells ?? parts.normalPlanetCells ?? [];
  return {
    templateId: "test",
    seed: 1,
    placementHash: "test-hash",
    cells,
    planetCells: cells.filter((c) => c.isPlanet),
    normalPlanetCells: parts.normalPlanetCells ?? [],
    normalPlanetsByColor: {},
    scoutCells: parts.scoutCells ?? [],
    outerCells: new Set(parts.outerCells ?? []),
    touchCells: new Set(),
    centralSlotIds: new Set(parts.centralSlotIds ?? []),
    audit: {
      outerNormalCount: 0,
      touchNormalCount: 0,
      placementHash: "test-hash",
      tagCountsAll: {},
      tagCountsPlanet: {},
      specialCellsSample: [],
      scoutOrScTagSample: [],
    },
  };
}

function reasonsOf(result: HardCheckResult): HardFailReason[] {
  return result.pass ? [] : result.reasons.map((r) => r.reason);
}

// ---------------------------------------------------------------------------

describe("checkH1MinDist", () => {
  it("passes when same-colour planets are at least minDist apart", () => {
    const e = extracted({
      normalPlanetCells: [
        cell({ q: 0, r: 0, colorKey: "RED" }),
        cell({ q: 3, r: 0, colorKey: "RED" }),
      ],
    });
    expect(checkH1MinDist(e, 3).pass).toBe(true);
  });

  it("treats a distance exactly equal to minDist as acceptable", () => {
    const e = extracted({
      normalPlanetCells: [
        cell({ q: 0, r: 0, colorKey: "RED" }),
        cell({ q: 2, r: 0, colorKey: "RED" }),
      ],
    });
    expect(checkH1MinDist(e, 2).pass).toBe(true);
    expect(checkH1MinDist(e, 3).pass).toBe(false);
  });

  it("fails when two planets of the same colour are too close", () => {
    const e = extracted({
      normalPlanetCells: [
        cell({ q: 0, r: 0, colorKey: "RED" }),
        cell({ q: 1, r: 0, colorKey: "RED" }),
      ],
    });
    const r = checkH1MinDist(e, 3);
    expect(reasonsOf(r)).toEqual(["H1_MIN_DIST"]);
  });

  it("ignores proximity between planets of different colours", () => {
    const e = extracted({
      normalPlanetCells: [
        cell({ q: 0, r: 0, colorKey: "RED" }),
        cell({ q: 1, r: 0, colorKey: "BLUE" }),
      ],
    });
    expect(checkH1MinDist(e, 3).pass).toBe(true);
  });

  it("reports one reason per offending colour", () => {
    const e = extracted({
      normalPlanetCells: [
        cell({ q: 0, r: 0, colorKey: "RED" }),
        cell({ q: 1, r: 0, colorKey: "RED" }),
        cell({ q: 5, r: 0, colorKey: "BLUE" }),
        cell({ q: 6, r: 0, colorKey: "BLUE" }),
      ],
    });
    const r = checkH1MinDist(e, 3);
    expect(reasonsOf(r)).toEqual(["H1_MIN_DIST", "H1_MIN_DIST"]);
  });

  it("names the offending pair and distance in the detail", () => {
    const e = extracted({
      normalPlanetCells: [
        cell({ q: 0, r: 0, colorKey: "RED" }),
        cell({ q: 1, r: 0, colorKey: "RED" }),
      ],
    });
    const r = checkH1MinDist(e, 3);
    expect(r.pass).toBe(false);
    if (r.pass) return;
    expect(r.reasons[0].detail).toContain("color=RED");
    expect(r.reasons[0].detail).toContain("minDist=1");
  });

  it("passes when a colour has only one planet", () => {
    const e = extracted({
      normalPlanetCells: [cell({ q: 0, r: 0, colorKey: "RED" })],
    });
    expect(checkH1MinDist(e, 99).pass).toBe(true);
  });

  it("passes on an empty board", () => {
    expect(checkH1MinDist(extracted({}), 3).pass).toBe(true);
  });
});

describe("checkH2OuterColorCap", () => {
  it("passes when each colour stays at or under the outer cap", () => {
    const e = extracted({
      normalPlanetCells: [
        cell({ q: 0, r: 0, colorKey: "RED" }),
        cell({ q: 1, r: 0, colorKey: "BLUE" }),
      ],
      outerCells: ["0,0", "1,0"],
    });
    expect(checkH2OuterColorCap(e, 1).pass).toBe(true);
  });

  it("fails when a colour exceeds the cap in the outer ring", () => {
    const e = extracted({
      normalPlanetCells: [
        cell({ q: 0, r: 0, colorKey: "RED" }),
        cell({ q: 1, r: 0, colorKey: "RED" }),
      ],
      outerCells: ["0,0", "1,0"],
    });
    expect(reasonsOf(checkH2OuterColorCap(e, 1))).toEqual(["H2_OUTER_CAP"]);
  });

  it("counts only planets that sit in the outer ring", () => {
    // Same two RED planets, but only one is outer: the inner one must not count
    // toward the cap.
    const e = extracted({
      normalPlanetCells: [
        cell({ q: 0, r: 0, colorKey: "RED" }),
        cell({ q: 1, r: 0, colorKey: "RED" }),
      ],
      outerCells: ["0,0"],
    });
    expect(checkH2OuterColorCap(e, 1).pass).toBe(true);
  });

  it("treats a count exactly equal to the cap as acceptable", () => {
    const e = extracted({
      normalPlanetCells: [
        cell({ q: 0, r: 0, colorKey: "RED" }),
        cell({ q: 1, r: 0, colorKey: "RED" }),
      ],
      outerCells: ["0,0", "1,0"],
    });
    expect(checkH2OuterColorCap(e, 2).pass).toBe(true);
    expect(checkH2OuterColorCap(e, 1).pass).toBe(false);
  });

  it("passes when the outer ring is empty", () => {
    const e = extracted({
      normalPlanetCells: [cell({ q: 0, r: 0, colorKey: "RED" })],
      outerCells: [],
    });
    expect(checkH2OuterColorCap(e, 0).pass).toBe(true);
  });
});

describe("checkH4CenterLarge14", () => {
  const placement = [
    { slotId: "L8", sectorId: "05", rot: 0 },
    { slotId: "L1", sectorId: "09", rot: 0 },
  ];

  it("is disabled when centerMode is NONE", () => {
    const e = extracted({ centralSlotIds: ["L8"] });
    expect(checkH4CenterLarge14(e, placement, "NONE").pass).toBe(true);
  });

  it("fails when a central slot holds a sector outside 01..04", () => {
    const e = extracted({ centralSlotIds: ["L8"] });
    expect(reasonsOf(checkH4CenterLarge14(e, placement, "CENTER_8"))).toEqual([
      "H4_CENTER_LARGE14",
    ]);
  });

  it("passes when every central slot holds a large sector", () => {
    const e = extracted({ centralSlotIds: ["L8"] });
    const ok = [
      { slotId: "L8", sectorId: "02", rot: 0 },
      { slotId: "L1", sectorId: "09", rot: 0 },
    ];
    expect(checkH4CenterLarge14(e, ok, "CENTER_8").pass).toBe(true);
  });

  it("ignores non-central slots regardless of their sector", () => {
    // L1 holds sector 09, but only L8 is central here.
    const e = extracted({ centralSlotIds: ["L8"] });
    const ok = [
      { slotId: "L8", sectorId: "01", rot: 0 },
      { slotId: "L1", sectorId: "21", rot: 0 },
    ];
    expect(checkH4CenterLarge14(e, ok, "CENTER_8").pass).toBe(true);
  });

  it("zero-pads sector ids before comparing", () => {
    // Placement data has carried both "1" and "01" for the same sector.
    const e = extracted({ centralSlotIds: ["L8"] });
    const padded = [{ slotId: "L8", sectorId: "1", rot: 0 }];
    expect(checkH4CenterLarge14(e, padded, "CENTER_8").pass).toBe(true);
  });

  it("reports every offending central slot", () => {
    const e = extracted({ centralSlotIds: ["L7", "L8", "L9"] });
    const bad = [
      { slotId: "L7", sectorId: "05", rot: 0 },
      { slotId: "L8", sectorId: "03", rot: 0 },
      { slotId: "L9", sectorId: "06", rot: 0 },
    ];
    expect(reasonsOf(checkH4CenterLarge14(e, bad, "CENTER_7_9"))).toEqual([
      "H4_CENTER_LARGE14",
      "H4_CENTER_LARGE14",
    ]);
  });
});

describe("checkH5ConnectedCap", () => {
  // A straight run of adjacent planets: {q:1,r:0} is a unit direction, so
  // (0,0),(1,0),(2,0)... form one connected cluster.
  function line(n: number): EvalCell[] {
    return Array.from({ length: n }, (_, i) => cell({ q: i, r: 0 }));
  }

  it("is disabled when the cap is undefined or non-positive", () => {
    const e = extracted({ cells: line(10) });
    expect(checkH5ConnectedCap(e, undefined).pass).toBe(true);
    expect(checkH5ConnectedCap(e, 0).pass).toBe(true);
    expect(checkH5ConnectedCap(e, -1).pass).toBe(true);
  });

  it("treats a cluster exactly at the cap as acceptable", () => {
    const e = extracted({ cells: line(3) });
    expect(checkH5ConnectedCap(e, 3).pass).toBe(true);
  });

  it("rejects a cluster one larger than the cap", () => {
    const e = extracted({ cells: line(4) });
    expect(reasonsOf(checkH5ConnectedCap(e, 3))).toEqual(["H5_CONNECTED_CAP"]);
  });

  it("measures the largest cluster, not the total planet count", () => {
    // Two separate pairs: six planets on the board, but no cluster over 2.
    const e = extracted({
      cells: [
        cell({ q: 0, r: 0 }),
        cell({ q: 1, r: 0 }),
        cell({ q: 10, r: 0 }),
        cell({ q: 11, r: 0 }),
      ],
    });
    expect(checkH5ConnectedCap(e, 2).pass).toBe(true);
  });

  it("connects planets regardless of colour", () => {
    const e = extracted({
      cells: [
        cell({ q: 0, r: 0, colorKey: "RED" }),
        cell({ q: 1, r: 0, colorKey: "BLUE" }),
        cell({ q: 2, r: 0, colorKey: "GAIA" }),
      ],
    });
    expect(checkH5ConnectedCap(e, 2).pass).toBe(false);
  });

  it("ignores non-planet cells", () => {
    const e = extracted({
      cells: [
        cell({ q: 0, r: 0 }),
        cell({ q: 1, r: 0, kind: "space" }),
        cell({ q: 2, r: 0 }),
      ],
    });
    // The space cell breaks the run into two singletons.
    expect(checkH5ConnectedCap(e, 1).pass).toBe(true);
  });

  it("excludes scout cells by default", () => {
    const e = extracted({
      cells: [cell({ q: 0, r: 0 }), cell({ q: 2, r: 0 })],
      scoutCells: [cell({ q: 1, r: 0, kind: "space" })],
    });
    expect(checkH5ConnectedCap(e, 1).pass).toBe(true);
  });

  it("bridges clusters through scout cells when includeScouts is set", () => {
    // The same board: the scout at (1,0) joins the two planets into a cluster
    // of 3 once it counts.
    const e = extracted({
      cells: [cell({ q: 0, r: 0 }), cell({ q: 2, r: 0 })],
      scoutCells: [cell({ q: 1, r: 0, kind: "space" })],
    });
    expect(checkH5ConnectedCap(e, 1, true).pass).toBe(false);
    expect(checkH5ConnectedCap(e, 3, true).pass).toBe(true);
  });

  it("reports the offending cluster size in the detail", () => {
    const e = extracted({ cells: line(4) });
    const r = checkH5ConnectedCap(e, 3);
    expect(r.pass).toBe(false);
    if (r.pass) return;
    expect(r.reasons[0].detail).toContain("maxClusterSize=4");
    expect(r.reasons[0].detail).toContain("cap=3");
  });

  it("passes when there are no planets at all", () => {
    expect(checkH5ConnectedCap(extracted({}), 1).pass).toBe(true);
  });
});

describe("checkHardConstraints", () => {
  const lenient: HardParams = {
    minSameColorDist: 1,
    outerSameColorMax: 99,
    centerMode: "NONE",
  };

  it("passes when no rule is violated", () => {
    const e = extracted({
      cells: [cell({ q: 0, r: 0, colorKey: "RED" })],
      normalPlanetCells: [cell({ q: 0, r: 0, colorKey: "RED" })],
    });
    expect(checkHardConstraints(e, [], lenient).pass).toBe(true);
  });

  it("aggregates reasons from every failing rule", () => {
    // One board that trips H1 (adjacent RED pair), H2 (both RED in the outer
    // ring, cap 1) and H5 (cluster of 2, cap 1) at once.
    const cells = [
      cell({ q: 0, r: 0, colorKey: "RED" }),
      cell({ q: 1, r: 0, colorKey: "RED" }),
    ];
    const e = extracted({
      cells,
      normalPlanetCells: cells,
      outerCells: ["0,0", "1,0"],
    });
    const r = checkHardConstraints(e, [], {
      minSameColorDist: 3,
      outerSameColorMax: 1,
      centerMode: "NONE",
      maxConnectedPlanets: 1,
    });
    expect(new Set(reasonsOf(r))).toEqual(
      new Set(["H1_MIN_DIST", "H2_OUTER_CAP", "H5_CONNECTED_CAP"])
    );
  });

  it("leaves H5 disabled when maxConnectedPlanets is absent", () => {
    // Guards the opt-in contract: existing saved search conditions have no
    // maxConnectedPlanets field and must keep returning their old results.
    const cells = Array.from({ length: 8 }, (_, i) => cell({ q: i, r: 0 }));
    const e = extracted({ cells });
    expect(checkHardConstraints(e, [], lenient).pass).toBe(true);
  });
});
