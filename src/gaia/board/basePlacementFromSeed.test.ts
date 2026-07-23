import { describe, it, expect } from "vitest";
import { basePlacementFromSeed } from "./basePlacementFromSeed";
import {
  BASE_34P_INNER_SLOTS,
  BASE_34P_OUTER_SLOTS,
} from "../templates/base_34p_slotCenters";
import {
  buildLogicalMapFromPlacement,
  type LogicalCell,
} from "../logicalMap/buildLogicalMap";
import { checkH0SameKindAdjacency } from "../constraints";
import { axialDistance } from "../hex";
import type { AxialKey, EvalCell, ExtractedForEval } from "./../eval/extractForEval";

const INNER = ["01", "02", "03", "04"];
const OUTER = ["05", "06", "07", "08", "09", "10"];

function bySlot(p: Array<{ slotId: string; sectorId: string; rot: number }>) {
  return new Map(p.map((x) => [x.slotId, x]));
}

describe("basePlacementFromSeed", () => {
  it("is deterministic for the same seed and method", () => {
    for (const method of [1, 2, 3] as const) {
      const a = basePlacementFromSeed({ seed: 42, placementMethod: method });
      const b = basePlacementFromSeed({ seed: 42, placementMethod: method });
      expect(a).toEqual(b);
    }
  });

  it("method 1 keeps 01..04 on their first-game slots L1..L4", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const m = bySlot(basePlacementFromSeed({ seed, placementMethod: 1 }));
      expect(m.get("L1")!.sectorId).toBe("01");
      expect(m.get("L2")!.sectorId).toBe("02");
      expect(m.get("L3")!.sectorId).toBe("03");
      expect(m.get("L4")!.sectorId).toBe("04");
      const outs = BASE_34P_OUTER_SLOTS.map((s) => m.get(s)!.sectorId).sort();
      expect(outs).toEqual(OUTER);
    }
  });

  it("method 2 permutes 01..04 within inner slots and 05..10 within outer slots", () => {
    let innerMoved = false;
    for (let seed = 1; seed <= 30; seed++) {
      const m = bySlot(basePlacementFromSeed({ seed, placementMethod: 2 }));
      const ins = BASE_34P_INNER_SLOTS.map((s) => m.get(s)!.sectorId);
      const outs = BASE_34P_OUTER_SLOTS.map((s) => m.get(s)!.sectorId);
      expect([...ins].sort()).toEqual(INNER);
      expect([...outs].sort()).toEqual(OUTER);
      if (ins.join(",") !== INNER.join(",")) innerMoved = true;
    }
    expect(innerMoved).toBe(true); // 30シードのどこかで内側が実際に入替わる
  });

  it("method 3 permutes all 10 tiles across all slots (inner slots can host 05..10)", () => {
    let outerOnInner = false;
    for (let seed = 1; seed <= 30; seed++) {
      const p = basePlacementFromSeed({ seed, placementMethod: 3 });
      expect(p.map((x) => x.sectorId).sort()).toEqual([...INNER, ...OUTER]);
      const m = bySlot(p);
      if (BASE_34P_INNER_SLOTS.some((s) => OUTER.includes(m.get(s)!.sectorId))) {
        outerOnInner = true;
      }
    }
    expect(outerOnInner).toBe(true);
  });

  it("rotations are within 0..5 and rot30 is always 0", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      for (const p of basePlacementFromSeed({ seed, placementMethod: 3 })) {
        expect(p.rot).toBeGreaterThanOrEqual(0);
        expect(p.rot).toBeLessThanOrEqual(5);
        expect(p.rot30).toBe(0);
        seen.add(p.rot);
      }
    }
    expect(seen.size).toBe(6); // 全回転値が実際に出現する
  });
});

// ---------------------------------------------------------------------------
// H0 boundary cross-check on real base_34p boards:
// checkH0SameKindAdjacency (via the eval-cell shape) must agree with a
// brute-force distance-1 scan of basic-colour planets on the LogicalMap.
// ---------------------------------------------------------------------------

const BASIC = new Set(["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW"]);

function basicPlanetCells(cells: LogicalCell[]): EvalCell[] {
  return cells
    .filter((c) => c.kind === "planet" && BASIC.has(String(c.planetType)))
    .map(
      (c) =>
        ({
          key: `${c.pos.q},${c.pos.r}` as AxialKey,
          q: c.pos.q,
          r: c.pos.r,
          slotId: c.slotId,
          sectorId: c.sectorId,
          rotSeed: c.rotSeed,
          rotLogical: c.rot,
          kind: c.kind,
          tags: c.tags,
          isPlanet: true,
          isExcludedPlanet: false,
          isNormalPlanet: true,
          colorKey: String(c.planetType),
        }) as EvalCell
    );
}

function fakeExtracted(normalPlanetCells: EvalCell[]): ExtractedForEval {
  return {
    templateId: "base_34p",
    seed: 0,
    placementHash: "x",
    cells: normalPlanetCells,
    planetCells: normalPlanetCells,
    normalPlanetCells,
    normalPlanetsByColor: {},
    scoutCells: [],
    outerCells: new Set(),
    touchCells: new Set(),
    centralSlotIds: new Set(),
    audit: {
      outerNormalCount: 0,
      touchNormalCount: 0,
      placementHash: "x",
      tagCountsAll: {},
      tagCountsPlanet: {},
      specialCellsSample: [],
      scoutOrScTagSample: [],
    },
  } as unknown as ExtractedForEval;
}

describe("H0 on real base_34p boards", () => {
  it("matches a brute-force adjacency scan over 60 seeds x methods 1..3", () => {
    let failSeen = 0;
    let passSeen = 0;

    for (const method of [1, 2, 3] as const) {
      for (let seed = 1; seed <= 60; seed++) {
        const placement = basePlacementFromSeed({ seed, placementMethod: method });
        const lm = buildLogicalMapFromPlacement({
          templateId: "base_34p",
          placement,
        });
        expect(lm.collisionCount).toBe(0);

        const norm = basicPlanetCells([...lm.cellsByKey.values()]);

        // brute force: any same-colour pair at hex distance 1?
        let brute = false;
        for (let i = 0; i < norm.length && !brute; i++) {
          for (let j = i + 1; j < norm.length; j++) {
            if (
              norm[i].colorKey === norm[j].colorKey &&
              axialDistance(norm[i].q, norm[i].r, norm[j].q, norm[j].r) === 1
            ) {
              brute = true;
              break;
            }
          }
        }

        const h0 = checkH0SameKindAdjacency(fakeExtracted(norm), true);
        expect(h0.pass).toBe(!brute);
        if (brute) failSeen++;
        else passSeen++;
      }
    }

    // サンプル中に両側の実例が出ていること（テストが空回りしていない）
    expect(failSeen).toBeGreaterThan(0);
    expect(passSeen).toBeGreaterThan(0);
  });
});
