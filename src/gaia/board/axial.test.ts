import { describe, it, expect } from "vitest";
import {
  AXIAL_DIRS,
  keyOf,
  parseKey,
  add,
  axialAdd,
  axialDistance,
  rotate60,
  type Axial,
} from "./axial";

describe("keyOf", () => {
  it("produces the same string for both call conventions", () => {
    // The overload exists only because two historical call sites disagreed on
    // the signature; if they ever diverge, cell keys stop matching across
    // modules and lookups silently miss.
    expect(keyOf(3, -2)).toBe("3,-2");
    expect(keyOf({ q: 3, r: -2 })).toBe("3,-2");
    expect(keyOf(3, -2)).toBe(keyOf({ q: 3, r: -2 }));
  });

  it("keeps the sign of negative coordinates", () => {
    expect(keyOf(-1, -1)).toBe("-1,-1");
    expect(keyOf(0, 0)).toBe("0,0");
  });
});

describe("parseKey", () => {
  it("round-trips through keyOf", () => {
    const points: Axial[] = [
      { q: 0, r: 0 },
      { q: 5, r: -3 },
      { q: -7, r: 12 },
      { q: -1, r: -1 },
    ];
    for (const p of points) {
      expect(parseKey(keyOf(p))).toEqual(p);
    }
  });
});

describe("add / axialAdd", () => {
  it("adds componentwise", () => {
    expect(add({ q: 1, r: 2 }, { q: -3, r: 4 })).toEqual({ q: -2, r: 6 });
  });

  it("axialAdd is an alias of add", () => {
    const a = { q: 2, r: -5 };
    const b = { q: -4, r: 1 };
    expect(axialAdd(a, b)).toEqual(add(a, b));
  });

  it("does not mutate its arguments", () => {
    const a = { q: 1, r: 2 };
    const b = { q: 3, r: 4 };
    add(a, b);
    expect(a).toEqual({ q: 1, r: 2 });
    expect(b).toEqual({ q: 3, r: 4 });
  });
});

describe("axialDistance", () => {
  it("is zero for a point to itself", () => {
    expect(axialDistance({ q: 4, r: -2 }, { q: 4, r: -2 })).toBe(0);
  });

  it("is one for each of the six neighbours", () => {
    const origin = { q: 0, r: 0 };
    for (const d of AXIAL_DIRS) {
      expect(axialDistance(origin, d)).toBe(1);
    }
  });

  it("is symmetric", () => {
    const a = { q: 3, r: -5 };
    const b = { q: -2, r: 1 };
    expect(axialDistance(a, b)).toBe(axialDistance(b, a));
  });

  it("counts straight-line steps", () => {
    expect(axialDistance({ q: 0, r: 0 }, { q: 3, r: 0 })).toBe(3);
    expect(axialDistance({ q: 0, r: 0 }, { q: 0, r: -4 })).toBe(4);
    // Moving +q and +r together is a "wide" direction: it costs 2 steps, not 1.
    expect(axialDistance({ q: 0, r: 0 }, { q: 1, r: 1 })).toBe(2);
  });

  it("satisfies the triangle inequality", () => {
    const pts: Axial[] = [
      { q: 0, r: 0 },
      { q: 2, r: -3 },
      { q: -4, r: 1 },
      { q: 5, r: 5 },
    ];
    for (const a of pts) {
      for (const b of pts) {
        for (const c of pts) {
          expect(axialDistance(a, c)).toBeLessThanOrEqual(
            axialDistance(a, b) + axialDistance(b, c)
          );
        }
      }
    }
  });
});

describe("rotate60", () => {
  it("is the identity for 0 and 6 steps", () => {
    const p = { q: 3, r: -1 };
    expect(rotate60(p, 0)).toEqual(p);
    expect(rotate60(p, 6)).toEqual(p);
    expect(rotate60(p, 12)).toEqual(p);
  });

  it("normalizes negative step counts", () => {
    const p = { q: 3, r: -1 };
    expect(rotate60(p, -1)).toEqual(rotate60(p, 5));
    expect(rotate60(p, -7)).toEqual(rotate60(p, 5));
  });

  it("fixes the origin", () => {
    // The cube negation yields -0 components here. That never reaches a cell
    // lookup because keyOf stringifies -0 to "0", so this asserts on the key
    // form rather than pinning a distinction the rest of the code cannot see.
    for (let s = 0; s < 6; s++) {
      expect(keyOf(rotate60({ q: 0, r: 0 }, s))).toBe("0,0");
    }
  });

  it("preserves distance from the origin", () => {
    const p = { q: 4, r: -2 };
    const d = axialDistance({ q: 0, r: 0 }, p);
    for (let s = 0; s < 6; s++) {
      expect(axialDistance({ q: 0, r: 0 }, rotate60(p, s))).toBe(d);
    }
  });

  it("maps the direction ring onto itself", () => {
    // One 60° step must send each unit direction to another unit direction;
    // sector rotation depends on this, so a wrong cube formula would show up
    // as directions leaving the ring.
    const ring = AXIAL_DIRS.map((d) => keyOf(d)).sort();
    const rotated = AXIAL_DIRS.map((d) => keyOf(rotate60(d, 1))).sort();
    expect(rotated).toEqual(ring);
  });

  it("composes: rotating by 1 six times returns the original", () => {
    let p: Axial = { q: 2, r: 3 };
    for (let i = 0; i < 6; i++) p = rotate60(p, 1);
    expect(p).toEqual({ q: 2, r: 3 });
  });

  it("agrees with repeated single steps for multi-step rotations", () => {
    const p: Axial = { q: -3, r: 5 };
    for (let s = 0; s < 6; s++) {
      let step: Axial = p;
      for (let i = 0; i < s; i++) step = rotate60(step, 1);
      expect(rotate60(p, s)).toEqual(step);
    }
  });
});
