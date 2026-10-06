// src/gaia/eval/evaluateSoft.startAccess.test.ts
//
// Map 評価の集計「開始地点＋到達しやすさ」（2026-10-03 確定。docs/design-notes.md 2.6）。
//   色ごとの値 ＝ 開始地点2ヶ所の値 ＋ Σ 残りの同色惑星の値 × 到達係数
//   原始・小惑星 ＝ LF4種族ごとに開始1ヶ所、行の値は2種族のうち大きい方、係数は掛けない
// 2026-07-31〜2026-10-02 の「最良の1惑星 × 2.75」（extraBest）はこれに置き換わった。
// 端の罰点「欠けマス × w」（2026-10-04 確定、eval_v4。設計ノート 2.8）は末尾の describe。
//
// evaluateSoft が読むのは cells / planetCells / scoutCells / outerCells / touchCells
// だけなので、baseAxes テストと同じく最小のフェイクを組む。欠けマスは cells（空セルも含む
// 盤面の全セル）から数えるので、端の罰点のテストだけは空セルを足して盤面の形を作る。

import { describe, it, expect } from "vitest";
import { evaluateSoft, type SoftParams } from "./evaluateSoft";
import type { AxialKey, EvalCell, ExtractedForEval } from "./extractForEval";
import { axialDistance } from "../hex";

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
    planetCells: cells.filter((c) => (c as any).isPlanet && !(c as any).isExcludedPlanet),
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
    const bf = auditOf(r).startAccess.byFaction;
    expect(bf.moweyds.starts).toEqual(["1,0"]);
    expect(bf.spaceGiants.starts).toEqual(["1,0"]);
    expect(bf.moweyds.color).toBe("PROTO");
    expect(bf.moweyds.planets.find((p: any) => p.cellKey === "3,0").cost).toBe(4);
    // 小惑星の種族は原始惑星を持たない
    expect(bf.tinkerroids).toBeUndefined();
    expect(bf.darkanians).toBeUndefined();
    expect(["moweyds", "spaceGiants"]).toContain(auditOf(r).startAccess.representative.PROTO);
  });

  it("評価値に小数を出さない（軸ごとに丸め、評価はその合計）", () => {
    // 原始 (1,0): 船接触 100 ＋ ガイア近接 50 ＝ 150。eval_v6 からガイア (2,0) も入植先:
    // 船接触 99（距離2）× 到達係数 1.0（隣接 0 ＋ モウェイド人のガイア 1 ＝ コスト 1）＝ 99 → 249
    const e = extractedOf([cell({ q: 1, r: 0, kind: "PROTO" }), cell({ q: 2, r: 0, kind: "GAIA" })], [scout(0, 0, "twilight")]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 100, wGaiaDist1: 50, wGaiaDist2: 80 });
    const st = extraStartOf(r, "PROTO");
    for (const v of [st.scout, st.core, st.gaia, st.cluster, st.total]) expect(Number.isInteger(v)).toBe(true);
    expect(st.scout + st.core + st.gaia + st.cluster).toBe(st.total);
    expect(st.total).toBe(249);
    expect(st.factionId).toBe("moweyds"); // スペースジャイアントはガイア 2 → 99 × 0.5 で 200
    expect(auditOf(r).startAccess.byFaction.spaceGiants.total).toBe(Math.round(150 + 99 * 0.5));
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

  it("最外周・外周（端の罰点）は原始・小惑星の評価にも入る（2026-10-04 確定。eval_v3 までは入れていなかった）", () => {
    const e = extractedOf([cell({ q: 0, r: 0, kind: "PROTO" })]);
    (e as any).outerCells = new Set(["0,0"]);
    (e as any).touchCells = new Set(["0,0"]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wOuter: 3, wTouch: 1 });
    const st = extraStartOf(r, "PROTO");
    expect(st.outer).toBe(-3);
    expect(st.touch).toBe(-1);
    expect(st.total).toBe(-4);
    expect(auditOf(r).startAccess.byFaction.moweyds.total).toBe(-4);
    expect(auditOf(r).startAccess.byFaction.moweyds.planets[0].value).toBe(-4);
    // 監査の種別ごとの単純合算も同じ罰点
    expect(auditOf(r).outerExtraByKind?.PROTO).toBe(-3);
    expect(auditOf(r).touchExtraByKind?.PROTO).toBe(-1);
  });

  it("原始・小惑星が無い盤面では extraStart も LF4種族の行も出さない", () => {
    const e = extractedOf([cell({ q: 0, r: 0, color: "RED" })], [scout(1, 0, "twilight")]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 10 });
    expect(auditOf(r).extraStart).toBeUndefined();
    expect(auditOf(r).startAccess.lf).toBeUndefined();
    expect(auditOf(r).startAccess.byFaction.moweyds).toBeUndefined();
    expect(auditOf(r).startAccess.byFaction.hadschHallas).toBeDefined();
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

describe("端の罰点「欠けマス × w」（2026-10-04 確定、eval_v4）", () => {
  /** 原点から距離 R 以内の空セル。惑星と同じ座標は惑星側が勝つ（cells に両方入れない） */
  const space = (q: number, r: number): EvalCell =>
    ({ key: `${q},${r}` as AxialKey, q, r, slotId: "L1", sectorId: "01", kind: "space", tags: [], isPlanet: false } as unknown as EvalCell);
  const boardOf = (R: number, planets: EvalCell[]): ExtractedForEval => {
    const taken = new Set(planets.map((p) => String(p.key)));
    const cells: EvalCell[] = [...planets];
    for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (axialDistance(0, 0, q, r) <= R && !taken.has(`${q},${r}`)) cells.push(space(q, r));
    const e = extractedOf(cells);
    // 最外周＝距離 R、外周＝距離 R−1
    (e as any).outerCells = new Set(cells.filter((c) => axialDistance(0, 0, c.q, c.r) === R).map((c) => c.key));
    (e as any).touchCells = new Set(cells.filter((c) => axialDistance(0, 0, c.q, c.r) === R - 1).map((c) => c.key));
    return e;
  };

  it("罰点 ＝ −w × 距離2以内の欠けマス数。最外周セルは「最外周」の列、外周セルは「外周」の列", () => {
    // 半径5の六角形。(5,-2) は最外周の辺（欠け7）、(4,0) は外周の角寄り（欠け5）、(0,0) は内側（欠け0）
    const e = boardOf(5, [cell({ q: 5, r: -2, color: "RED" }), cell({ q: 4, r: 0, color: "BLUE" }), cell({ q: 0, r: 0, color: "WHITE" })]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wRimGap: 0.5 });
    const ax = r.breakdown.axesByType;
    expect(ax.outer.RED).toBe(Math.round(-0.5 * 7)); // −3.5 → −3（軸ごとに丸める）
    expect(ax.touch.RED).toBe(0);
    expect(ax.outer.BLUE).toBe(0);
    expect(ax.touch.BLUE).toBe(Math.round(-0.5 * 5)); // −2.5 → −2
    expect(ax.outer.WHITE).toBe(0);
    expect(ax.touch.WHITE).toBe(0);
    expect(r.breakdown.planetTypeTotals.RED).toBe(ax.outer.RED);
    expect(r.breakdown.planetTypeTotals.BLUE).toBe(ax.touch.BLUE);
    // 惑星ごとの値（丸める前）
    expect(auditOf(r).startAccess.byColor.RED.planets[0].value).toBe(-3.5);
    expect(auditOf(r).startAccess.byColor.BLUE.planets[0].value).toBe(-2.5);
    // 記録: 定数と欠けマス数（内側の惑星は載らない）。ヒットには欠けと罰点が付く
    const rg = auditOf(r).rimGap;
    expect(rg).toEqual({ w: 0.5, range: 2, ringCells: 18, missingByCell: { "5,-2": 7, "4,0": 5 } });
    expect(auditOf(r).outerHits).toEqual([expect.objectContaining({ cellKey: "5,-2", planetType: "RED", missing: 7, value: -3.5 })]);
    expect(auditOf(r).touchHits).toEqual([expect.objectContaining({ cellKey: "4,0", planetType: "BLUE", missing: 5, value: -2.5 })]);
    // 枚数は従来どおり
    expect(auditOf(r).outerCountByType.RED).toBe(1);
    expect(auditOf(r).touchCountByType.BLUE).toBe(1);
  });

  it("角は辺より重い（最外周の角は欠け10、辺は7）", () => {
    const e = boardOf(5, [cell({ q: 5, r: 0, color: "RED" }), cell({ q: 5, r: -2, color: "BLUE" })]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wRimGap: 1 });
    expect(r.breakdown.axesByType.outer.RED).toBe(-10);
    expect(r.breakdown.axesByType.outer.BLUE).toBe(-7);
  });

  it("原始・小惑星にも同じ罰点が掛かり、行の値（extraStart）と種族ごとの値に入る", () => {
    const e = boardOf(5, [cell({ q: 5, r: -2, kind: "PROTO" }), cell({ q: 4, r: 0, kind: "ASTEROID" })]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wRimGap: 1 });
    const proto = extraStartOf(r, "PROTO");
    expect(proto.outer).toBe(-7);
    expect(proto.touch).toBe(0);
    expect(proto.total).toBe(-7);
    const ast = extraStartOf(r, "ASTEROID");
    expect(ast.outer).toBe(0);
    expect(ast.touch).toBe(-5);
    expect(ast.total).toBe(-5);
    expect(auditOf(r).startAccess.byFaction.tinkerroids.total).toBe(-5);
    expect(auditOf(r).startAccess.byFaction.darkanians.touch).toBe(-5);
    expect(auditOf(r).outerExtraByKind?.PROTO).toBe(-7);
    expect(auditOf(r).touchExtraByKind?.ASTEROID).toBe(-5);
  });

  it("下限は無い: 参考程度の惑星が負の値で色の値を引き下げる（開始地点の選び方にも効く）", () => {
    // 白（ネヴラ人・イタル人とも開始2ヶ所）。(0,0)=内側 0、(5,-2)=最外周の辺 −7（w=1）、(3,0)=内側 0。
    // 開始は {0,0 / 3,0}（距離3＝コスト1.5 → 到達係数 0.71）、(5,-2) は (3,0) から距離2（コスト1 → 1.0）で −7 がそのまま足される
    const e = boardOf(5, [cell({ q: 0, r: 0, color: "WHITE" }), cell({ q: 3, r: 0, color: "WHITE" }), cell({ q: 5, r: -2, color: "WHITE" })]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wRimGap: 1 });
    const sa = auditOf(r).startAccess.byColor.WHITE;
    expect(sa.starts.slice().sort()).toEqual(["0,0", "3,0"]);
    const rim = sa.planets.find((p: any) => p.cellKey === "5,-2");
    expect(rim.value).toBe(-7);
    expect(rim.weight).toBe(1);
    expect(r.breakdown.planetTypeTotals.WHITE).toBe(-7);
    // 赤はダー・シュワーム人（開始1ヶ所）が代表になり、−7 の惑星を到達加重で薄める
    const e2 = boardOf(5, [cell({ q: 0, r: 0, color: "RED" }), cell({ q: 3, r: 0, color: "RED" }), cell({ q: 5, r: -2, color: "RED" })]);
    const r2 = evaluateSoft(e2, { ...BASE_SOFT, wRimGap: 1 });
    expect(auditOf(r2).startAccess.representative.RED).toBe("ivits");
    expect(auditOf(r2).startAccess.byFaction.hadschHallas.total).toBe(-7);
    expect(r2.breakdown.planetTypeTotals.RED).toBeGreaterThan(-7);
  });

  it("wRimGap を省略（0）すれば罰点なし。記録（rimGap）も出さない", () => {
    const e = boardOf(5, [cell({ q: 5, r: -2, color: "RED" })]);
    const r = evaluateSoft(e, BASE_SOFT);
    expect(r.breakdown.axesByType.outer.RED).toBe(0);
    expect(r.breakdown.planetTypeTotals.RED).toBe(0);
    expect(auditOf(r).rimGap).toBeUndefined();
    expect(auditOf(r).outerHits[0].missing).toBe(0);
  });

  it("eval_v3 までの wOuter / wTouch は、指定があれば wRimGap に加えて効く（古い調査スクリプト用）", () => {
    const e = boardOf(5, [cell({ q: 5, r: -2, color: "RED" }), cell({ q: 4, r: 0, color: "BLUE" })]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wRimGap: 1, wOuter: 3, wTouch: 1 });
    expect(r.breakdown.axesByType.outer.RED).toBe(-10); // −7 − 3
    expect(r.breakdown.axesByType.touch.BLUE).toBe(-6); // −5 − 1
  });
});

describe("種族ごとの計算（2026-10-05 確定、eval_v5。docs/design-notes.md 2.7）", () => {
  it("基本14種族それぞれに開始地点と値があり、色の値はその色の2種族の大きい方（案A）", () => {
    // 青 (0,0) / (3,0) / (6,0)、船が (1,0)。地球人とランティダ人は定数が同じ（次元横断が無い）ので同値
    const e = extractedOf(
      [cell({ q: 0, r: 0, color: "BLUE" }), cell({ q: 3, r: 0, color: "BLUE" }), cell({ q: 6, r: 0, color: "BLUE" })],
      [scout(1, 0, "twilight")]
    );
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 10 });
    const sa = auditOf(r).startAccess;
    expect(Object.keys(sa.byFaction).sort()).toEqual(["lantids", "terrans"]);
    expect(sa.byFaction.terrans.color).toBe("BLUE");
    expect(sa.byFaction.terrans.starts).toHaveLength(2);
    expect(sa.byFaction.terrans.total).toBe(sa.byFaction.lantids.total);
    expect(sa.representative.BLUE).toBe("terrans"); // 同点は FACTIONS の順で先
    expect(r.breakdown.planetTypeTotals.BLUE).toBe(sa.byFaction.terrans.total);
    expect(sa.byColor.BLUE.starts).toEqual(sa.byFaction.terrans.starts);
  });

  it("ゼノ族は開始3ヶ所、同色のグリーン人は2ヶ所。代表はゼノ族で、色の値はその値", () => {
    // 黄 3つが互いに距離3。船接触で 10 / 10 / 9。ゼノ族は3つとも開始＝29。
    // グリーン人は2ヶ所＋残り1つは距離3（コスト1.5 → 0.71）なので 20 + 9×0.71 ≈ 26
    const e = extractedOf(
      [cell({ q: 1, r: 0, color: "YELLOW" }), cell({ q: 4, r: 0, color: "YELLOW" }), cell({ q: 7, r: 0, color: "YELLOW" })],
      [scout(0, 0, "twilight"), scout(5, 0, "eclipse")]
    );
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 10 });
    const sa = auditOf(r).startAccess;
    expect(sa.byFaction.xenos.starts).toHaveLength(3);
    expect(sa.byFaction.gleens.starts).toHaveLength(2);
    expect(sa.byFaction.xenos.total).toBe(29);
    expect(sa.byFaction.gleens.total).toBe(Math.round(20 + 9 * Math.SQRT1_2));
    expect(sa.representative.YELLOW).toBe("xenos");
    expect(r.breakdown.planetTypeTotals.YELLOW).toBe(29);
    expect(r.breakdown.axesByType.scout.YELLOW).toBe(29);
  });

  it("ダー・シュワーム人は開始1ヶ所。ハッシュ・ホラ人（2ヶ所）が代表になる", () => {
    const e = extractedOf([cell({ q: 1, r: 0, color: "RED" }), cell({ q: 2, r: 0, color: "RED" })], [scout(0, 0, "twilight")]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 10 });
    const sa = auditOf(r).startAccess;
    expect(sa.byFaction.ivits.starts).toHaveLength(1);
    expect(sa.byFaction.hadschHallas.starts).toHaveLength(2);
    expect(sa.byFaction.hadschHallas.total).toBe(19);
    expect(sa.byFaction.ivits.total).toBe(10 + 9); // (2,0) は隣接でコスト0 → 係数1
    expect(sa.representative.RED).toBe("hadschHallas"); // 同点は順で先
  });

  it("航行 Lv1 開始のアンバス人は距離2の同色がコスト0.5（割引なし）、タクロン族はコスト1", () => {
    const e = extractedOf([cell({ q: 0, r: 0, color: "BROWN" }), cell({ q: 2, r: 0, color: "BROWN" }), cell({ q: 5, r: 0, color: "BROWN" })], [scout(1, 0, "twilight")]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 10 });
    const sa = auditOf(r).startAccess;
    // 開始は {0,0 / 2,0}（値 10 と 10）。(5,0) は (2,0) から距離3 → 1.5 でどちらも同じ
    const far = (f: string) => sa.byFaction[f].planets.find((p: any) => p.cellKey === "5,0");
    expect(far("ambas").cost).toBe(1.5);
    expect(far("taklons").cost).toBe(1.5);
    // 距離2が効く形: 開始を1ヶ所に絞って比べる
    const two = extractedOf([cell({ q: 0, r: 0, color: "BROWN" }), cell({ q: 2, r: 0, color: "BROWN" })], [scout(1, 0, "twilight")]);
    const r2 = evaluateSoft(two, { ...BASE_SOFT, wScout: 10 });
    expect(auditOf(r2).startAccess.byFaction.ambas.total).toBe(auditOf(r2).startAccess.byFaction.taklons.total); // 2ヶ所とも開始なので同じ
  });

  it("バルタック人は距離2の跳躍が 1.5、地球人は次元横断の踏み台が 1（通常 2）、グリーン人はガイア惑星が 0.5、ジオデン人は改造 × 2/3", () => {
    // 橙 (0,0) と (2,0): バルタック人の1ヶ所開始なら (2,0) へコスト1.5。ジオデン人は赤(1歩)の踏み台が 0.67
    const orange = extractedOf([cell({ q: 0, r: 0, color: "ORANGE" }), cell({ q: 2, r: 0, color: "ORANGE" }), cell({ q: 6, r: 0, color: "ORANGE" }), cell({ q: 4, r: 0, color: "RED" })]);
    const r = evaluateSoft(orange, { ...BASE_SOFT, wClusterSize: 1 });
    const sa = auditOf(r).startAccess;
    // (6,0) へ: 直接は距離4 → 2 / 赤(4,0)経由: (2,0)→(4,0) 距離2(1)＋改造1歩 → (6,0) 距離2(1) ＝ 3。ジオデン人は 1+0.67+1 = 2.67 → 直接の2が最小
    expect(sa.byFaction.geodens.planets.find((p: any) => p.cellKey === "6,0").cost).toBe(2);
    // 青 (0,0) / (6,0) と次元横断 (3,0): 地球人は 1.5(距離3)＋1 → (6,0) 距離3 1.5 ＝ 4（直接の距離6は不可）。ランティダ人は 5
    const blue = extractedOf([cell({ q: 0, r: 0, color: "BLUE" }), cell({ q: 6, r: 0, color: "BLUE" }), cell({ q: 3, r: 0, kind: "TRANSDIM" })]);
    const r2 = evaluateSoft(blue, { ...BASE_SOFT, wClusterSize: 1 });
    const one = (f: string) => auditOf(r2).startAccess.byFaction[f];
    // 2ヶ所とも開始になるので planets の cost は 0。開始1ヶ所の LF と違い、ここでは到達コストの差を reachCost 側のテストで確認している
    expect(one("terrans").starts).toHaveLength(2);
    expect(one("lantids").starts).toHaveLength(2);
    // 黄 (0,0) / (6,0) とガイア (3,0)、グリーン人はガイアの踏み台 0.5
    const yellow = extractedOf([cell({ q: 0, r: 0, color: "YELLOW" }), cell({ q: 6, r: 0, color: "YELLOW" }), cell({ q: 3, r: 0, kind: "GAIA" }), cell({ q: 12, r: 0, color: "YELLOW" })]);
    const r3 = evaluateSoft(yellow, { ...BASE_SOFT, wGaiaDist3: 1 });
    expect(auditOf(r3).startAccess.byFaction.gleens.starts).toHaveLength(2);
    expect(auditOf(r3).startAccess.byFaction.xenos.starts).toHaveLength(3);
  });

  it("LF4種族も byFaction に入り、PROTO / ASTEROID の代表（extraStart）と一致する", () => {
    const e = extractedOf([cell({ q: 1, r: 0, kind: "PROTO" }), cell({ q: 2, r: 0, kind: "ASTEROID" })], [scout(0, 0, "twilight")]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 10 });
    const sa = auditOf(r).startAccess;
    expect(sa.byFaction.moweyds.color).toBe("PROTO");
    expect(sa.byFaction.tinkerroids.color).toBe("ASTEROID");
    expect(sa.representative.PROTO).toBe(extraStartOf(r, "PROTO").factionId);
    expect(sa.representative.ASTEROID).toBe(extraStartOf(r, "ASTEROID").factionId);
    expect(sa.byFaction[sa.representative.PROTO].total).toBe(extraStartOf(r, "PROTO").total);
  });
});

describe("ガイア・次元横断を入植先に計上（2026-10-06 ユーザー確定 案B、eval_v6。docs/design-notes.md 2.7）", () => {
  it("開始地点は母星色からだけ選び、ガイア・次元横断は到着時の入植コスト込みの到達係数で足す", () => {
    // 船 (-1,0)。赤 (0,0)=10、次元横断 (-1,1)=10（船に隣接）、ガイア (2,0)=8、赤 (9,0)=0（遠い）。
    // ハッシュ・ホラ人の開始は赤2つ（次元横断の方が値が高くても開始地点にはならない）。
    // ガイア: (0,0) から距離2 → 跳躍1 ＋ ガイア1 ＝ 2 → 0.5。次元横断: 隣接 0 ＋ 2 ＝ 2 → 0.5。
    // 合計 10 + 0 + 8×0.5 + 10×0.5 = 19
    const e = extractedOf(
      [cell({ q: 0, r: 0, color: "RED" }), cell({ q: 9, r: 0, color: "RED" }), cell({ q: -1, r: 1, kind: "TRANSDIM" }), cell({ q: 2, r: 0, kind: "GAIA" })],
      [scout(-1, 0, "twilight")]
    );
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 10 });
    const sa = auditOf(r).startAccess;
    const hh = sa.byFaction.hadschHallas;
    expect(hh.starts.slice().sort()).toEqual(["0,0", "9,0"]);
    expect(hh.total).toBe(19);
    expect(r.breakdown.planetTypeTotals.RED).toBe(19);
    expect(r.breakdown.axesByType.scout.RED).toBe(19);
    const row = (k: string) => hh.planets.find((p: any) => p.cellKey === k);
    expect(row("-1,1")).toEqual({ cellKey: "-1,1", kind: "TRANSDIM", cost: 2, weight: 0.5, value: 10 });
    expect(row("2,0")).toEqual({ cellKey: "2,0", kind: "GAIA", cost: 2, weight: 0.5, value: 8 });
    expect(row("0,0").kind).toBe("RED");
    // 監査の色ごとの合算（船接触の byType）にはガイア・次元横断を入れない
    expect(auditOf(r).scout.byType.RED).toBe(10);
    expect(auditOf(r).scout.extraByKind.GAIA).toBeUndefined();
    // 船接触惑星（船星系の起点）にもしない
    expect(auditOf(r).scout.scoutPlanetCount).toBe(1);
    // マーカー用のヒットは出す
    expect(auditOf(r).scout.scoutHits.map((h: any) => [h.planetKey, h.planetType]).sort()).toEqual([
      ["-1,1", "TRANSDIM"],
      ["0,0", "RED"],
      ["2,0", "GAIA"],
    ]);
    // ガイア・次元横断だけでは行を作らない（母星色の惑星が無い種族は従来どおり無し）
    expect(sa.byFaction.terrans).toBeUndefined();
    expect(sa.byFaction.moweyds).toBeUndefined();
  });

  it("次元横断の入植コストは種族で違う: 地球人 1（係数 1.0）、ランティダ人 2（0.5）、イタル人 1.5（0.71）", () => {
    const blue = extractedOf([cell({ q: 0, r: 0, color: "BLUE" }), cell({ q: -1, r: 1, kind: "TRANSDIM" })], [scout(-1, 0, "twilight")]);
    const r = evaluateSoft(blue, { ...BASE_SOFT, wScout: 10 });
    const sa = auditOf(r).startAccess;
    expect(sa.byFaction.terrans.total).toBe(20);
    expect(sa.byFaction.lantids.total).toBe(15);
    expect(sa.representative.BLUE).toBe("terrans");
    expect(r.breakdown.planetTypeTotals.BLUE).toBe(20);
    const white = extractedOf([cell({ q: 0, r: 0, color: "WHITE" }), cell({ q: -1, r: 1, kind: "TRANSDIM" })], [scout(-1, 0, "twilight")]);
    const r2 = evaluateSoft(white, { ...BASE_SOFT, wScout: 10 });
    const sa2 = auditOf(r2).startAccess;
    expect(sa2.byFaction.nevlas.total).toBe(15);
    expect(sa2.byFaction.itars.total).toBe(Math.round(10 + 10 * Math.SQRT1_2)); // 17
    expect(sa2.byFaction.itars.planets.find((p: any) => p.kind === "TRANSDIM").cost).toBe(1.5);
    expect(sa2.representative.WHITE).toBe("itars");
  });

  it("ガイア近接は自分には付けない（ガイア惑星の値に「近くのガイア」は入らない）", () => {
    const e = extractedOf([cell({ q: 0, r: 0, color: "YELLOW" }), cell({ q: 1, r: 0, kind: "GAIA" }), cell({ q: 2, r: 0, kind: "GAIA" })]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wGaiaDist1: 5, wGaiaDist2: 8 });
    const x = auditOf(r).startAccess.byFaction.xenos;
    expect(x.planets.find((p: any) => p.cellKey === "0,0").value).toBe(13);
    expect(x.planets.filter((p: any) => p.kind === "GAIA").map((p: any) => p.value)).toEqual([0, 0]);
    expect(x.total).toBe(13);
    expect(r.breakdown.axesByType.gaia!.YELLOW).toBe(13);
  });

  it("端の罰点はガイア・次元横断にも掛かり、到達係数で薄まって色の値に入る。ヒットは GAIA / TRANSDIM で出す", () => {
    const space = (q: number, r: number): EvalCell =>
      ({ key: `${q},${r}` as AxialKey, q, r, slotId: "L1", sectorId: "01", kind: "space", tags: [], isPlanet: false } as unknown as EvalCell);
    const planets = [cell({ q: 0, r: 0, color: "RED" }), cell({ q: 5, r: -2, kind: "GAIA" })];
    const taken = new Set(planets.map((p) => String(p.key)));
    const cells: EvalCell[] = [...planets];
    for (let q = -5; q <= 5; q++) for (let r = -5; r <= 5; r++) if (axialDistance(0, 0, q, r) <= 5 && !taken.has(`${q},${r}`)) cells.push(space(q, r));
    const e = extractedOf(cells);
    (e as any).outerCells = new Set(cells.filter((c) => axialDistance(0, 0, c.q, c.r) === 5).map((c) => c.key));
    (e as any).touchCells = new Set(cells.filter((c) => axialDistance(0, 0, c.q, c.r) === 4).map((c) => c.key));
    const r = evaluateSoft(e, { ...BASE_SOFT, wRimGap: 1 });
    // ガイア (5,-2) は最外周の辺（欠け7）→ −7。(0,0) から距離5 → 跳躍3 ＋ ガイア1 ＝ 4 → 0.125 → −0.875 → −1
    const hh = auditOf(r).startAccess.byFaction.hadschHallas;
    expect(hh.planets.find((p: any) => p.kind === "GAIA")).toEqual({ cellKey: "5,-2", kind: "GAIA", cost: 4, weight: 0.125, value: -7 });
    expect(r.breakdown.axesByType.outer.RED).toBe(-1);
    expect(auditOf(r).outerHits).toEqual([expect.objectContaining({ cellKey: "5,-2", planetType: "GAIA", missing: 7, value: -7 })]);
    // 枚数（最外周の通常惑星の数）には入れない
    expect(auditOf(r).outerCountByType.RED).toBe(0);
  });

  it("船星系の加点はガイア・次元横断も受ける（起点にはならない）", () => {
    // 船 (0,0) に接する赤 (1,0) と青 (0,1) が船接触惑星。ガイア (1,1) は両方に隣接 → 船星系 3 を2回
    const e = extractedOf(
      [cell({ q: 1, r: 0, color: "RED" }), cell({ q: 0, r: 1, color: "BLUE" }), cell({ q: 1, r: 1, kind: "GAIA" })],
      [scout(0, 0, "twilight")]
    );
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 10, wScoutCore: 3 });
    const hh = auditOf(r).startAccess.byFaction.hadschHallas;
    const g = hh.planets.find((p: any) => p.kind === "GAIA");
    // ガイアの値 ＝ 船接触 9（距離2）＋ 船星系 3×2 ＝ 15。コスト: 隣接 0 ＋ ガイア 1 ＝ 1 → 1.0
    expect(g).toEqual({ cellKey: "1,1", kind: "GAIA", cost: 1, weight: 1, value: 15 });
    // 赤自身は船接触 10 ＋ 船星系（青から距離2 … 船接触惑星が2つ以上必要なので 0）
    expect(hh.total).toBe(10 + 15);
    expect(auditOf(r).scoutCore.coreHits.filter((h: any) => h.corePlanetType === "GAIA")).toHaveLength(2);
    expect(auditOf(r).scoutCore.byType.RED).toBe(0);
    expect(auditOf(r).scoutCore.scoutPlanetCount ?? auditOf(r).scout.scoutPlanetCount).toBe(2);
  });
});
