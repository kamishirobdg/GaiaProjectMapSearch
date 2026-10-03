// src/gaia/eval/evaluateSoft.startAccess.test.ts
//
// Map 評価の集計「開始地点＋到達しやすさ」（2026-10-03 確定。docs/design-notes.md 2.6）。
//   色ごとの値 ＝ 開始地点2ヶ所の値 ＋ Σ 残りの同色惑星の値 × 到達係数
//   原始・小惑星 ＝ LF4種族ごとに開始1ヶ所、行の値は2種族のうち大きい方、係数は掛けない
// 2026-07-31〜2026-10-02 の「最良の1惑星 × 2.75」（extraBest）はこれに置き換わった。
//
// evaluateSoft が読むのは cells / planetCells / scoutCells / outerCells / touchCells
// だけなので、baseAxes テストと同じく最小のフェイクを組む。

import { describe, it, expect } from "vitest";
import { evaluateSoft, type SoftParams } from "./evaluateSoft";
import type { AxialKey, EvalCell, ExtractedForEval } from "./extractForEval";

type Spec = { q: number; r: number; color?: string; kind?: "GAIA" | "TRANSDIM" | "PROTO" | "ASTEROID" };

/** PROTO/ASTEROID は planetCells に入る（GAIA/TRANSDIM だけが除外惑星）。 */
function cell(s: Spec): EvalCell {
  const planetKind = s.kind ?? s.color;
  const isExcluded = s.kind === "GAIA" || s.kind === "TRANSDIM";
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
    isNormalPlanet: !isExcluded && !!s.color,
    colorKey: s.color,
  } as unknown as EvalCell;
}

function scout(q: number, r: number, scoutId: string): any {
  return { key: `${q},${r}` as AxialKey, q, r, scoutId, kind: "scout", tags: [] };
}

function extractedOf(cells: EvalCell[], scouts: any[] = []): ExtractedForEval {
  return {
    templateId: "4p_lostFleet",
    seed: 0,
    placementHash: "x",
    cells,
    planetCells: cells.filter((c) => !(c as any).isExcludedPlanet),
    normalPlanetCells: cells.filter((c) => (c as any).isNormalPlanet),
    normalPlanetsByColor: {},
    scoutCells: scouts,
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

const auditOf = (r: ReturnType<typeof evaluateSoft>) => r.breakdown.audit as any;
const extraStartOf = (r: ReturnType<typeof evaluateSoft>, kind: string) => auditOf(r).extraStart?.[kind];
const sumOf = (r: ReturnType<typeof evaluateSoft>, kind: string) => {
  const a = auditOf(r);
  const ex = (o: any) => Number(o?.[kind] ?? 0) || 0;
  return ex(a.scout?.extraByKind) + ex(a.scoutCore?.extraByKind) + ex(a.gaiaProximity?.extraByKind) + ex(a.cluster?.extraByKind);
};
const SQ = Math.SQRT1_2; // 0.5^(1.5−1)

describe("基本色: 開始地点2ヶ所＋到達加重", () => {
  it("開始地点は残りの到達加重まで含めて選び、残りは 0.5^(コスト−1) で数える", () => {
    // 赤 (0,0) / (3,0) / (6,0)。船が (1,0) にあり 船接触は 10 / 9 / 0。(6,0) の隣にガイア（距離1=6）。
    // 開始 {0,0 / 3,0}: 19 + (6,0) は (3,0) から距離3（コスト1.5 → 0.71）→ 6×0.71 = 4.2 → 合計 23.2
    // 開始 {0,0 / 6,0}: 16 + 9×0.71 = 22.4、開始 {3,0 / 6,0}: 15 + 10×0.71 = 22.1
    const e = extractedOf(
      [cell({ q: 0, r: 0, color: "RED" }), cell({ q: 3, r: 0, color: "RED" }), cell({ q: 6, r: 0, color: "RED" }), cell({ q: 7, r: 0, kind: "GAIA" })],
      [scout(1, 0, "twilight")]
    );
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 10, wGaiaDist1: 6 });
    const sa = auditOf(r).startAccess;
    expect(sa.byColor.RED.starts.slice().sort()).toEqual(["0,0", "3,0"]);
    const far = sa.byColor.RED.planets.find((p: any) => p.cellKey === "6,0");
    expect(far.cost).toBe(1.5);
    expect(far.weight).toBeCloseTo(SQ, 10);
    expect(far.value).toBe(6);
    // 軸ごとに重み付きで足して丸める。評価はその合計
    expect(r.breakdown.axesByType.scout.RED).toBe(19);
    expect(r.breakdown.axesByType.gaia!.RED).toBe(Math.round(6 * SQ)); // 4
    expect(r.breakdown.planetTypeTotals.RED).toBe(19 + Math.round(6 * SQ));
    // 定数の記録
    expect(sa.hopCostByDistance).toEqual([0, 0, 1, 1.5, 2, 3]);
    expect(sa.decay).toBe(0.5);
    expect(sa.freeCost).toBe(1);
  });

  it("同色が2つ以下なら全部が開始地点で、従来の単純合計と同じ", () => {
    const e = extractedOf([cell({ q: 0, r: 0, color: "RED" }), cell({ q: 5, r: 0, color: "RED" })], [scout(1, 0, "twilight")]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 10 });
    expect(r.breakdown.planetTypeTotals.RED).toBe(10); // (0,0)=10、(5,0) は距離4で 0
    expect(auditOf(r).startAccess.byColor.RED.starts.slice().sort()).toEqual(["0,0", "5,0"]);
  });

  it("最外周・外周は基本色の惑星の値に入る（開始地点の選び方にも効く）", () => {
    const e = extractedOf([cell({ q: 0, r: 0, color: "RED" })]);
    (e as any).outerCells = new Set(["0,0"]);
    (e as any).touchCells = new Set(["0,0"]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wOuter: 3, wTouch: 1 });
    expect(r.breakdown.axesByType.outer.RED).toBe(-3);
    expect(r.breakdown.axesByType.touch.RED).toBe(-1);
    expect(r.breakdown.planetTypeTotals.RED).toBe(-4);
    expect(auditOf(r).startAccess.byColor.RED.planets[0].value).toBe(-4);
  });

  it("軸の列は重み付き和を軸ごとに丸めるので、列の合計と評価が一致し小数が出ない", () => {
    const e = extractedOf(
      [cell({ q: 0, r: 0, color: "BLUE" }), cell({ q: 3, r: 0, color: "BLUE" }), cell({ q: 6, r: 0, color: "BLUE" }), cell({ q: 7, r: 0, kind: "GAIA" })],
      [scout(1, 0, "twilight"), scout(5, 1, "eclipse")]
    );
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 7, wScoutCore: 3, wGaiaDist1: 5, wGaiaDist2: 3, wClusterSize: 1 });
    const ax = r.breakdown.axesByType;
    const sum = ax.outer.BLUE + ax.touch.BLUE + ax.scout.BLUE + ax.scoutCore.BLUE + (ax.gaia?.BLUE ?? 0) + (ax.cluster?.BLUE ?? 0);
    expect(sum).toBe(r.breakdown.planetTypeTotals.BLUE);
    for (const v of [ax.scout.BLUE, ax.scoutCore.BLUE, ax.gaia?.BLUE ?? 0, ax.cluster?.BLUE ?? 0, r.breakdown.planetTypeTotals.BLUE]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe("原始・小惑星: LF4種族ごとに開始1ヶ所、係数なし", () => {
  it("開始1ヶ所の値をそのまま採り、残りは入植コスト込みの到達係数で足す（合算も ×2.75 もしない）", () => {
    // 距離が1伸びるごとに DISTANCE_FALLOFF(1) 引く。wScout=10 なら (1,0) は +10、(3,0) は +8。
    // 開始 (1,0): (3,0) へは距離2（1）＋原始の入植3 ＝ 4 → 0.5^3 = 0.125 → 10 + 1 = 11
    // 開始 (3,0): 8 + 10×0.125 = 9.25 なので (1,0) が選ばれる
    const e = extractedOf([cell({ q: 1, r: 0, kind: "PROTO" }), cell({ q: 3, r: 0, kind: "PROTO" })], [scout(0, 0, "twilight")]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 10 });
    expect(sumOf(r, "PROTO")).toBe(18); // 監査の単純合算は従来どおり
    const st = extraStartOf(r, "PROTO");
    expect(st.cellKey).toBe("1,0");
    expect(st.total).toBe(11);
    expect(st.scout).toBe(11);
    expect(["moweyds", "spaceGiants"]).toContain(st.factionId);
    const lf = auditOf(r).startAccess.lf;
    expect(lf.moweyds.start).toBe("1,0");
    expect(lf.spaceGiants.start).toBe("1,0");
    expect(lf.moweyds.planets.find((p: any) => p.cellKey === "3,0").cost).toBe(4);
    // 小惑星の種族は原始惑星を持たない
    expect(lf.tinkerroids).toBeUndefined();
    expect(lf.darkanians).toBeUndefined();
  });

  it("評価値に小数を出さない（軸ごとに丸め、評価はその合計）", () => {
    const e = extractedOf([cell({ q: 1, r: 0, kind: "PROTO" }), cell({ q: 2, r: 0, kind: "GAIA" })], [scout(0, 0, "twilight")]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 100, wGaiaDist1: 50, wGaiaDist2: 80 });
    const st = extraStartOf(r, "PROTO");
    for (const v of [st.scout, st.core, st.gaia, st.cluster, st.total]) expect(Number.isInteger(v)).toBe(true);
    expect(st.scout + st.core + st.gaia + st.cluster).toBe(st.total);
    expect(st.total).toBe(150);
  });

  it("種別ごとに別枠で、小惑星は小惑星の2種族、原始は原始の2種族で計算する", () => {
    const e = extractedOf(
      [cell({ q: 1, r: 0, kind: "PROTO" }), cell({ q: 3, r: 0, kind: "PROTO" }), cell({ q: 2, r: 0, kind: "ASTEROID" })],
      [scout(0, 0, "twilight")]
    );
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 10 });
    expect(extraStartOf(r, "PROTO").cellKey).toBe("1,0");
    expect(extraStartOf(r, "PROTO").total).toBe(11);
    expect(extraStartOf(r, "ASTEROID").cellKey).toBe("2,0");
    expect(extraStartOf(r, "ASTEROID").total).toBe(9);
    expect(["tinkerroids", "darkanians"]).toContain(extraStartOf(r, "ASTEROID").factionId);
  });

  it("星系は「その惑星が属する星系の大きさ」。同じ星系の原始2つは同じ値で、もう1つは到達係数ぶんだけ足す", () => {
    // 3つ連結（PROTO 2 + RED 1）。星系の大きさ3 → 各 PROTO の cluster は 30。
    // 開始 (0,0): (1,0) は隣接（0）＋入植3 ＝ 3 → 0.25 → 30 + 7.5 = 37.5 → 38
    const e = extractedOf([cell({ q: 0, r: 0, kind: "PROTO" }), cell({ q: 1, r: 0, kind: "PROTO" }), cell({ q: 2, r: 0, color: "RED" })]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wClusterSize: 10 });
    expect(sumOf(r, "PROTO")).toBe(30); // 単純合算は種別ごとに1回
    const st = extraStartOf(r, "PROTO");
    expect(st.cluster).toBe(38);
    expect(st.total).toBe(38);
    expect(st.cellKey).toBe("0,0"); // 同点は座標順で先の方
    // 基本色の軸も惑星ごと（赤は1つなので 30）
    expect(r.breakdown.axesByType.cluster!.RED).toBe(30);
    expect(r.breakdown.planetTypeTotals.RED).toBe(30);
  });

  it("最外周・外周は原始・小惑星の評価に入れない（2026-07-30 確定）", () => {
    const e = extractedOf([cell({ q: 0, r: 0, kind: "PROTO" })]);
    (e as any).outerCells = new Set(["0,0"]);
    (e as any).touchCells = new Set(["0,0"]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wOuter: 3, wTouch: 1 });
    expect(extraStartOf(r, "PROTO").total).toBe(0);
    // 監査側には従来どおり最外周/外周の分が残っている
    expect(auditOf(r).outerExtraByKind?.PROTO).toBe(-3);
  });

  it("原始・小惑星が無い盤面では extraStart も lf も出さない", () => {
    const e = extractedOf([cell({ q: 0, r: 0, color: "RED" })], [scout(1, 0, "twilight")]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 10 });
    expect(auditOf(r).extraStart).toBeUndefined();
    expect(auditOf(r).startAccess.lf).toBeUndefined();
    expect(auditOf(r).startAccess.byColor.RED).toBeDefined();
    expect(auditOf(r).extraBest).toBeUndefined();
  });

  it("色優遇の掛け先は extraStart の値", () => {
    const e = extractedOf([cell({ q: 1, r: 0, kind: "PROTO" })], [scout(0, 0, "twilight")]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 10, wColorPref: 2, colorPrefByType: { PROTO: 1 } as any });
    expect(r.breakdown.colorPreference?.valueExtraByKind?.PROTO).toBe(10);
    expect(r.breakdown.colorPreference?.scoreExtraByKind?.PROTO).toBe(20);
  });
});
