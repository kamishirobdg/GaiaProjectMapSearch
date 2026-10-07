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
  it("each planet in a cluster of n gets +n x weight（評価の軸は惑星ごと。監査の byType は色ごとに1回）", () => {
    // RED-RED-BLUE の3連結: 惑星ごとに +3 なので RED は 2つで 6、BLUE は 3。
    // 2026-10-03 の「開始地点＋到達加重」から軸は惑星ごとの値の重み付き和になった
    // （同色2つはどちらも開始地点なので重み1）。色ごとに1回の合算は audit.cluster.byType に残る。
    const e = extractedOf([
      cell({ q: 0, r: 0, color: "RED" }),
      cell({ q: 1, r: 0, color: "RED" }),
      cell({ q: 2, r: 0, color: "BLUE" }),
      cell({ q: 9, r: 9, color: "WHITE" }), // 孤立 => 加点なし
    ]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wClusterSize: 1 });
    expect(r.breakdown.axesByType.cluster).toBeDefined();
    expect(r.breakdown.axesByType.cluster!.RED).toBe(6);
    expect(r.breakdown.axesByType.cluster!.BLUE).toBe(3);
    expect(r.breakdown.axesByType.cluster!.WHITE).toBe(0);
    expect(r.breakdown.audit.cluster?.byType.RED).toBe(3);
    expect(r.breakdown.audit.cluster?.clusters).toEqual([{ size: 3, weightedSize: 3, colors: ["BLUE", "RED"] }]);
  });

  it("gaia/transdim join clusters for size（H5と同じ連結定義）。eval_v6 からは入植先として到達加重で色の値にも入る", () => {
    // RED-GAIA の2連結: サイズ2、色はREDのみ。惑星ごとの星系の値は RED 2 / GAIA 2。
    // 色ごとに1回の合算（監査）は RED 2 のまま。色の値は RED 2 ＋ GAIA 2 × 入植先の係数 0.5 × 到達係数
    // （隣接 0 ＋ ガイア 1 ＝ 1 → 1.0）＝ 3
    const e = extractedOf([
      cell({ q: 0, r: 0, color: "RED" }),
      cell({ q: 1, r: 0, kind: "GAIA" }),
    ]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wClusterSize: 1 });
    expect(r.breakdown.audit.cluster?.byType.RED).toBe(2);
    expect(r.breakdown.axesByType.cluster!.RED).toBe(3);
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
    // RED-TRANSDIM が2組（それぞれ 1.5）。赤2つの 1.5 + 1.5 ＝ 3 に、eval_v6 からは次元横断2つ
    // （各 1.5 × 入植先の係数 0.25 × 到達係数 0.5。隣接 0 ＋ 次元横断 2 ＝ コスト 2）＝ 0.375 が乗り、
    // 合計 3.375 を丸めて 3。監査の色ごとに1回の合算は 3 のまま。
    const e = extractedOf([
      cell({ q: 0, r: 0, color: "RED" }),
      cell({ q: 1, r: 0, kind: "TRANSDIM" }),
      cell({ q: 5, r: 0, color: "RED" }),
      cell({ q: 6, r: 0, kind: "TRANSDIM" }),
    ]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wClusterSize: 1 });
    expect(r.breakdown.audit.cluster?.byType.RED).toBe(3); // 1.5 + 1.5
    expect(r.breakdown.axesByType.cluster!.RED).toBe(3); // 3 + 0.1875 + 0.1875 = 3.375 → 3
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
    expect(r.breakdown.audit.cluster?.clusters).toEqual([{ size: 2, weightedSize: 2, colors: ["RED"] }]);
    expect(r.breakdown.axesByType.cluster!.RED).toBe(3); // RED 2 ＋ GAIA 2 × 0.5 × 1.0（eval_v6）
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
