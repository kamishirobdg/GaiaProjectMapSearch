import { describe, it, expect } from "vitest";
import { evaluateSoft, type SoftParams } from "./evaluateSoft";
import type { AxialKey, EvalCell, ExtractedForEval } from "./extractForEval";

// ---------------------------------------------------------------------------
// 基本版専用の新評価軸（ガイア近接・星系クラスタ）のユニットテスト。
// evaluateSoft は extracted の cells / normalPlanetCells / planetCells /
// scoutCells / outerCells / touchCells しか読まないので、最小のフェイクを組む。
// ---------------------------------------------------------------------------

type Spec = { q: number; r: number; color?: string; kind?: "GAIA" | "TRANSDIM" };

function cell(s: Spec): EvalCell {
  const planetKind = s.kind ?? s.color;
  const isExcluded = s.kind !== undefined;
  return {
    key: `${s.q},${s.r}` as AxialKey,
    q: s.q,
    r: s.r,
    slotId: "L1",
    sectorId: "01",
    rotSeed: 0,
    rotLogical: 0,
    kind: "planet",
    tags: [],
    planetKind: planetKind as any,
    isPlanet: true,
    isExcludedPlanet: isExcluded,
    isNormalPlanet: !isExcluded,
    colorKey: isExcluded ? undefined : s.color,
  } as unknown as EvalCell;
}

function extractedOf(cells: EvalCell[]): ExtractedForEval {
  return {
    templateId: "base_34p",
    seed: 0,
    placementHash: "x",
    cells,
    planetCells: cells.filter((c) => !c.isExcludedPlanet),
    normalPlanetCells: cells.filter((c) => c.isNormalPlanet),
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

const BASE_SOFT: SoftParams = {
  wOuter: 0,
  wTouch: 0,
  wScout: 0,
  scoutRadius: 3,
  wImbalance: 0,
};

describe("gaia proximity axis (base)", () => {
  it("sums ALL gaia planets at distance 1/2/3 with per-distance weights", () => {
    const e = extractedOf([
      cell({ q: 0, r: 0, color: "RED" }),
      cell({ q: 1, r: 0, kind: "GAIA" }), // d1 => +5
      cell({ q: 2, r: 0, kind: "GAIA" }), // d2 => +3
      cell({ q: 3, r: 0, kind: "GAIA" }), // d3 => +1
      cell({ q: 4, r: 0, kind: "GAIA" }), // d4 => 0
    ]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wGaiaDist1: 5, wGaiaDist2: 3, wGaiaDist3: 1 });
    expect(r.breakdown.axesByType.gaia).toBeDefined();
    expect(r.breakdown.axesByType.gaia!.RED).toBe(9);
    expect(r.breakdown.planetTypeTotals.RED).toBe(9);
    expect(r.breakdown.audit.gaiaProximity?.hitCount).toBe(3);
    expect(r.breakdown.audit.gaiaProximity?.gaiaCellCount).toBe(4);
  });

  it("two gaia at distance 1 give double the d1 weight (合算, not nearest-only)", () => {
    const e = extractedOf([
      cell({ q: 0, r: 0, color: "BLUE" }),
      cell({ q: 1, r: 0, kind: "GAIA" }),
      cell({ q: -1, r: 0, kind: "GAIA" }),
    ]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wGaiaDist1: 5, wGaiaDist2: 3, wGaiaDist3: 1 });
    expect(r.breakdown.axesByType.gaia!.BLUE).toBe(10);
  });

  it("TRANSDIM does not count as gaia", () => {
    const e = extractedOf([
      cell({ q: 0, r: 0, color: "RED" }),
      cell({ q: 1, r: 0, kind: "TRANSDIM" }),
    ]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wGaiaDist1: 5, wGaiaDist2: 3, wGaiaDist3: 1 });
    expect(r.breakdown.axesByType.gaia!.RED).toBe(0);
  });
});

describe("cluster axis (base)", () => {
  it("each colour in a cluster of n gets +n x weight, once per colour", () => {
    // RED-RED-BLUE の3連結: RED+3, BLUE+3（同色2個でも色ごとに1回）
    const e = extractedOf([
      cell({ q: 0, r: 0, color: "RED" }),
      cell({ q: 1, r: 0, color: "RED" }),
      cell({ q: 2, r: 0, color: "BLUE" }),
      cell({ q: 9, r: 9, color: "WHITE" }), // 孤立 => 加点なし
    ]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wClusterSize: 1 });
    expect(r.breakdown.axesByType.cluster).toBeDefined();
    expect(r.breakdown.axesByType.cluster!.RED).toBe(3);
    expect(r.breakdown.axesByType.cluster!.BLUE).toBe(3);
    expect(r.breakdown.axesByType.cluster!.WHITE).toBe(0);
    expect(r.breakdown.audit.cluster?.clusters).toEqual([{ size: 3, weightedSize: 3, colors: ["BLUE", "RED"] }]);
  });

  it("gaia/transdim join clusters for size but earn no colour points (H5と同じ連結定義)", () => {
    // RED-GAIA の2連結: サイズ2、色はREDのみ => RED+2
    const e = extractedOf([
      cell({ q: 0, r: 0, color: "RED" }),
      cell({ q: 1, r: 0, kind: "GAIA" }),
    ]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wClusterSize: 1 });
    expect(r.breakdown.axesByType.cluster!.RED).toBe(2);
    expect(r.breakdown.audit.cluster?.clusters).toEqual([{ size: 2, weightedSize: 2, colors: ["RED"] }]);
  });

  it("次元横断惑星は星系の大きさを半分だけ増やす（2026-07-30 確定）", () => {
    // RED-TRANSDIM の2連結: 大きさは 1 + 0.5 = 1.5。
    // 監査には 1.5 がそのまま残り、軸の値だけ丸める（2026-07-31。評価値から
    // 小数を消すため。丸めは色ごとの合計に対して行うので、0.5 が2つあれば
    // 打ち消し合う ―― 下の「2つの星系」のケース参照）。
    const e = extractedOf([
      cell({ q: 0, r: 0, color: "RED" }),
      cell({ q: 1, r: 0, kind: "TRANSDIM" }),
    ]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wClusterSize: 1 });
    expect(r.breakdown.audit.cluster?.clusters).toEqual([
      { size: 2, weightedSize: 1.5, colors: ["RED"] },
    ]);
    expect(r.breakdown.axesByType.cluster!.RED).toBe(2); // Math.round(1.5)
  });

  it("軸の丸めは色ごとの合計に効く（0.5が2つあれば打ち消し合う）", () => {
    // RED-TRANSDIM が2組（それぞれ 1.5）。合計3で丸め不要になる。
    const e = extractedOf([
      cell({ q: 0, r: 0, color: "RED" }),
      cell({ q: 1, r: 0, kind: "TRANSDIM" }),
      cell({ q: 5, r: 0, color: "RED" }),
      cell({ q: 6, r: 0, kind: "TRANSDIM" }),
    ]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wClusterSize: 1 });
    expect(r.breakdown.axesByType.cluster!.RED).toBe(3); // 1.5 + 1.5
  });

  it("星系の軸に小数を出さない", () => {
    const e = extractedOf([
      cell({ q: 0, r: 0, color: "RED" }),
      cell({ q: 1, r: 0, kind: "TRANSDIM" }),
      cell({ q: 2, r: 0, color: "BLUE" }),
    ]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wClusterSize: 1 });
    for (const v of Object.values(r.breakdown.axesByType.cluster!)) {
      expect(Number.isInteger(v)).toBe(true);
    }
    for (const v of Object.values(r.breakdown.planetTypeTotals)) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("ガイア惑星は従来どおり1つ分で数える（半減は次元横断だけ）", () => {
    const e = extractedOf([
      cell({ q: 0, r: 0, color: "RED" }),
      cell({ q: 1, r: 0, kind: "GAIA" }),
    ]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wClusterSize: 1 });
    expect(r.breakdown.axesByType.cluster!.RED).toBe(2);
  });

  it("weight multiplies the size bonus", () => {
    const e = extractedOf([
      cell({ q: 0, r: 0, color: "RED" }),
      cell({ q: 1, r: 0, color: "BLUE" }),
    ]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wClusterSize: 2 });
    expect(r.breakdown.axesByType.cluster!.RED).toBe(4);
    expect(r.breakdown.axesByType.cluster!.BLUE).toBe(4);
  });
});

describe("LF compatibility (fields absent)", () => {
  it("omitting the new fields leaves axes/audit absent and totals unchanged", () => {
    const e = extractedOf([
      cell({ q: 0, r: 0, color: "RED" }),
      cell({ q: 1, r: 0, kind: "GAIA" }),
      cell({ q: 2, r: 0, color: "BLUE" }),
    ]);
    const r = evaluateSoft(e, BASE_SOFT);
    expect(r.breakdown.axesByType.gaia).toBeUndefined();
    expect(r.breakdown.axesByType.cluster).toBeUndefined();
    expect(r.breakdown.audit.gaiaProximity).toBeUndefined();
    expect(r.breakdown.audit.cluster).toBeUndefined();
    expect(r.breakdown.planetTypeTotals.RED).toBe(0);
    expect(r.breakdown.planetTypeTotals.BLUE).toBe(0);
  });
});
