import { describe, it, expect } from "vitest";
import { axialDistance as hexDistance } from "./hex";
import { axialDistance as axialModuleDistance, AXIAL_DIRS } from "./board/axial";

describe("hex.axialDistance", () => {
  it("is zero for a point to itself", () => {
    expect(hexDistance(4, -2, 4, -2)).toBe(0);
  });

  it("is one for each of the six neighbours", () => {
    for (const d of AXIAL_DIRS) {
      expect(hexDistance(0, 0, d.q, d.r)).toBe(1);
    }
  });

  it("counts straight-line steps", () => {
    expect(hexDistance(0, 0, 3, 0)).toBe(3);
    expect(hexDistance(0, 0, 0, -4)).toBe(4);
    expect(hexDistance(0, 0, 1, 1)).toBe(2);
  });

  it("returns whole numbers", () => {
    // The implementation divides a sum of absolute values by 2; an inconsistent
    // formula would surface here as a half-step distance rather than an
    // obviously wrong one.
    for (let q = -6; q <= 6; q++) {
      for (let r = -6; r <= 6; r++) {
        expect(Number.isInteger(hexDistance(0, 0, q, r))).toBe(true);
      }
    }
  });
});

describe("hex.axialDistance vs board/axial.axialDistance", () => {
  it("agrees on every pair in a 13x13 axial window", () => {
    // Two independent implementations of the same metric live in the tree:
    // hex.ts (used by constraints.ts / H1) and board/axial.ts (used by
    // connectedComponents and the display side). H1 rejects boards by distance,
    // so a divergence between them would silently change search results.
    for (let q = -6; q <= 6; q++) {
      for (let r = -6; r <= 6; r++) {
        expect(hexDistance(0, 0, q, r)).toBe(
          axialModuleDistance({ q: 0, r: 0 }, { q, r })
        );
      }
    }
  });

  it("agrees on pairs that do not involve the origin", () => {
    const pts = [
      { q: 2, r: -3 },
      { q: -4, r: 1 },
      { q: 5, r: 5 },
      { q: 0, r: 7 },
      { q: -6, r: -2 },
    ];
    for (const a of pts) {
      for (const b of pts) {
        expect(hexDistance(a.q, a.r, b.q, b.r)).toBe(axialModuleDistance(a, b));
      }
    }
  });
});
