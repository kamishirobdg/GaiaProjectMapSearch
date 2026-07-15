import { describe, it, expect } from "vitest";
import { mulberry32, hashSeed, shuffleSeeded, type RNG } from "./rng";

function take(rng: RNG, n: number): number[] {
  return Array.from({ length: n }, () => rng());
}

// The whole search pipeline is "deterministic seed -> reproducible board", and
// the regression snapshot in scripts/__snapshots__/baseline.json is only
// meaningful if these primitives never change their output for a given seed.
// The golden values below were generated from this implementation; a diff here
// means every recorded snapshot and every user-saved seed has silently changed
// meaning.

describe("mulberry32", () => {
  it("produces a fixed sequence for a given seed", () => {
    const rng = mulberry32(12345);
    const got = Array.from({ length: 5 }, () => rng());
    expect(got).toEqual([
      0.9797282677609473, 0.3067522644996643, 0.484205421525985,
      0.817934412509203, 0.5094283693470061,
    ]);
  });

  it("is reproducible across independent instances with the same seed", () => {
    expect(take(mulberry32(7), 20)).toEqual(take(mulberry32(7), 20));
  });

  it("diverges for different seeds", () => {
    expect(take(mulberry32(1), 20)).not.toEqual(take(mulberry32(2), 20));
  });

  it("stays within [0, 1)", () => {
    for (const seed of [0, 1, 42, 2 ** 31, 0xffffffff]) {
      const rng = mulberry32(seed);
      for (let i = 0; i < 200; i++) {
        const v = rng();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });
});

describe("hashSeed", () => {
  it("returns the FNV-1a 32-bit offset basis for the empty string", () => {
    expect(hashSeed("")).toBe(2166136261);
  });

  it("matches known FNV-1a values", () => {
    expect(hashSeed("a")).toBe(3826002220);
    expect(hashSeed("snap-0001")).toBe(1375452899);
  });

  it("returns an unsigned 32-bit integer", () => {
    for (const s of ["", "a", "snap-0001", "3p_lostFleet", "テスト"]) {
      const h = hashSeed(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("distinguishes seeds that differ only in the trailing digit", () => {
    // The snapshot seeds are `snap-0001`..`snap-0030`, so a hash that collapsed
    // that suffix would make the whole snapshot suite test one board.
    const hashes = Array.from({ length: 30 }, (_, i) =>
      hashSeed(`snap-${String(i + 1).padStart(4, "0")}`)
    );
    expect(new Set(hashes).size).toBe(30);
  });
});

describe("shuffleSeeded", () => {
  it("produces a fixed permutation for a given seed", () => {
    expect(shuffleSeeded([1, 2, 3, 4, 5, 6, 7, 8], mulberry32(42))).toEqual([
      3, 8, 2, 1, 7, 6, 4, 5,
    ]);
  });

  it("does not mutate the input", () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    shuffleSeeded(input, mulberry32(1));
    expect(input).toEqual(copy);
  });

  it("keeps every element exactly once", () => {
    const input = Array.from({ length: 50 }, (_, i) => i);
    for (const seed of [0, 1, 99, 12345]) {
      const out = shuffleSeeded(input, mulberry32(seed));
      expect(out).toHaveLength(input.length);
      expect([...out].sort((a, b) => a - b)).toEqual(input);
    }
  });

  it("handles empty and single-element arrays", () => {
    expect(shuffleSeeded([], mulberry32(1))).toEqual([]);
    expect(shuffleSeeded(["only"], mulberry32(1))).toEqual(["only"]);
  });
});
