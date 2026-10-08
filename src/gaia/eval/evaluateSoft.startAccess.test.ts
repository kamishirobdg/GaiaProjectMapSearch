// src/gaia/eval/evaluateSoft.startAccess.test.ts
//
// Map 評価の集計「全惑星を同一の式で」（2026-10-07 ユーザー確定、eval_v7。docs/design-notes.md 2.10）。
//   種族の値 ＝ Σ_{盤面の全惑星} 係数(種別) × (固有値 10 ＋ 状況の値) × 到達係数(開始地点 → 惑星)
//   状況の値 ＝ 船接触 ＋ 船星系 ＋ 端の罰点（欠けマス × w）。ガイア近接・星系の軸は廃止。
//   係数 ＝ 母星色 1 / 他色 0.25（改造種族 × 1.2）/ ガイア 0.5 / 次元横断 0.25（ガイア種族 0.5）/ 原始・小惑星 0.1
//   開始地点は母星色（LF は母星種別）から k 個を総当たり（eval_v3〜v6 の性質を保つ）。
// 2026-10-03（eval_v3）〜 2026-10-06（eval_v6）の「開始地点＋到達加重」「種族ごとの計算」「ガイア・次元横断を
// 入植先に」はこの式に吸収された。端の罰点（2026-10-04、eval_v4。設計ノート 2.8）は末尾の describe。
//
// evaluateSoft が読むのは cells / planetCells / scoutCells / outerCells / touchCells
// だけなので、最小のフェイクを組む。欠けマスは cells（空セルも含む盤面の全セル）から数えるので、
// 端の罰点のテストだけは空セルを足して盤面の形を作る。

import { describe, it, expect } from "vitest";
import { evaluateSoft, type SoftParams } from "./evaluateSoft";
import type { AxialKey, EvalCell, ExtractedForEval } from "./extractForEval";
import { axialDistance } from "../hex";
import { DESTINATION_KINDS, UNIFIED_VALUE } from "./reachCost";

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

const B = UNIFIED_VALUE.BASE; // 固有値 10
const auditOf = (r: ReturnType<typeof evaluateSoft>) => r.breakdown.audit as any;
const factionOf = (r: ReturnType<typeof evaluateSoft>, id: string) => auditOf(r).startAccess.byFaction[id];
const rowOf = (r: ReturnType<typeof evaluateSoft>, id: string, cellKey: string) =>
  factionOf(r, id).planets.find((p: any) => p.cellKey === cellKey);
const extraStartOf = (r: ReturnType<typeof evaluateSoft>, kind: string) => auditOf(r).extraStart?.[kind];
const SQ = Math.SQRT1_2; // 0.5^(1.5−1)
const kinds = (own: number, other = 0, gaia = 0, transdim = 0, extra = 0) => ({ own, other, gaia, transdim, extra });

describe("固有値と係数: 全惑星を同一の式で（2026-10-07 確定、eval_v7）", () => {
  it("惑星1つ: 値 ＝ 固有値 10 × 母星色 1 × 到達係数 1。他の色の種族の行は作らない", () => {
    const r = evaluateSoft(extractedOf([cell({ q: 0, r: 0, color: "RED" })]), BASE_SOFT);
    const hh = factionOf(r, "hadschHallas");
    expect(hh.color).toBe("RED");
    expect(hh.starts).toEqual(["0,0"]);
    expect(hh.byKind).toEqual(kinds(B));
    expect(hh.total).toBe(B);
    expect(hh.base).toBe(B);
    expect(hh.scout + hh.core + hh.outer + hh.touch).toBe(0);
    expect(hh.planets).toEqual([{ cellKey: "0,0", kind: "RED", dest: "own", cost: 0, weight: 1, value: B }]);
    // ダー・シュワーム人は開始地点の値 × 1.5（惑星首府。eval_v8）。重みに 1.5 が入り、1 惑星なら代表になる
    expect(factionOf(r, "ivits").total).toBe(B * 1.5);
    expect(factionOf(r, "ivits").planets).toEqual([{ cellKey: "0,0", kind: "RED", dest: "own", cost: 0, weight: 1.5, value: B }]);
    expect(auditOf(r).startAccess.representative.RED).toBe("ivits");
    expect(r.breakdown.planetTypeTotals.RED).toBe(B * 1.5);
    expect(r.breakdown.planetTypeTotals.BLUE).toBe(0);
    expect(factionOf(r, "terrans")).toBeUndefined();
    expect(factionOf(r, "moweyds")).toBeUndefined();
  });

  it("他色: 係数 0.25、到達コストに改造の歩数が入る。改造種族（ジオデン人）は × 1.2 で歩数 × 2/3、バルタック人は距離2が 1.5", () => {
    const r = evaluateSoft(extractedOf([cell({ q: 0, r: 0, color: "ORANGE" }), cell({ q: 2, r: 0, color: "RED" })]), BASE_SOFT);
    // ジオデン人: 赤 ＝ 0.3 × 10 ＝ 3、コスト 跳躍 1 ＋ 改造 1歩 × 2/3 ＝ 1.67 → 0.5^0.67 ＝ 0.63 → 1.89 → 2
    const g = rowOf(r, "geodens", "2,0");
    expect(g.dest).toBe("other");
    expect(g.coef).toBeCloseTo(0.3, 10);
    expect(g.value).toBeCloseTo(3, 10);
    expect(g.cost).toBeCloseTo(1 + 2 / 3, 10);
    expect(g.weight).toBeCloseTo(Math.pow(0.5, 2 / 3), 10);
    expect(factionOf(r, "geodens").byKind).toEqual(kinds(B, Math.round(3 * Math.pow(0.5, 2 / 3))));
    expect(factionOf(r, "geodens").total).toBe(B + 2);
    // バルタック人: 赤 ＝ 0.25 × 10 ＝ 2.5、コスト 1.5 ＋ 1 ＝ 2.5 → 0.35 → 0.88 → 1
    const b = rowOf(r, "balTaks", "2,0");
    expect(b.coef).toBe(0.25);
    expect(b.cost).toBe(2.5);
    expect(b.weight).toBeCloseTo(Math.pow(0.5, 1.5), 10);
    expect(factionOf(r, "balTaks").byKind).toEqual(kinds(B, 1));
    // 赤の種族から見た橙も他色（0.25、コスト 1 ＋ 1 ＝ 2 → 0.5 → 1.25 → 1）
    expect(factionOf(r, "hadschHallas").byKind).toEqual(kinds(B, 1));
    // 色の値は代表種族（ジオデン人）。種別ごとの列も代表のもの
    expect(auditOf(r).startAccess.representative.ORANGE).toBe("geodens");
    expect(r.breakdown.planetTypeTotals.ORANGE).toBe(B + 2);
    expect(r.breakdown.axesByType.own.ORANGE).toBe(B);
    expect(r.breakdown.axesByType.other.ORANGE).toBe(2);
    expect(r.breakdown.axesByType.other.RED).toBe(1);
  });

  it("ガイア 0.5 / 次元横断 0.25（ガイア種族 0.5）。到着時の入植コスト（ガイア 1、次元横断 2 / ガイア Lv1 開始 1 / イタル人 1.5）が到達係数に入る", () => {
    const blue = evaluateSoft(extractedOf([cell({ q: 0, r: 0, color: "BLUE" }), cell({ q: 1, r: 0, kind: "GAIA" }), cell({ q: -1, r: 0, kind: "TRANSDIM" })]), BASE_SOFT);
    // 地球人: ガイア 5 × 1.0（隣接 0 ＋ 1 ＝ 1）、次元横断 0.5 × 10 ＝ 5 × 1.0（0 ＋ 1）
    expect(rowOf(blue, "terrans", "1,0")).toEqual({ cellKey: "1,0", kind: "GAIA", dest: "gaia", cost: 1, weight: 1, value: 5, coef: 0.5 });
    expect(rowOf(blue, "terrans", "-1,0")).toEqual({ cellKey: "-1,0", kind: "TRANSDIM", dest: "transdim", cost: 1, weight: 1, value: 5, coef: 0.5 });
    expect(factionOf(blue, "terrans").byKind).toEqual(kinds(B, 0, 5, 5));
    expect(factionOf(blue, "terrans").total).toBe(20);
    // ランティダ人: 次元横断 0.25 × 10 ＝ 2.5 × 0.5（0 ＋ 2 ＝ 2）＝ 1.25 → 1
    expect(rowOf(blue, "lantids", "-1,0")).toEqual({ cellKey: "-1,0", kind: "TRANSDIM", dest: "transdim", cost: 2, weight: 0.5, value: 2.5, coef: 0.25 });
    expect(factionOf(blue, "lantids").byKind).toEqual(kinds(B, 0, 5, 1));
    expect(auditOf(blue).startAccess.representative.BLUE).toBe("terrans");
    expect(blue.breakdown.planetTypeTotals.BLUE).toBe(20);
    expect(blue.breakdown.axesByType.gaia.BLUE).toBe(5);
    expect(blue.breakdown.axesByType.transdim.BLUE).toBe(5);
    // 白: ネヴラ人は通常（2）、イタル人はガイア種族の係数 0.5 でコスト 1.5 → 5 × 0.71 ＝ 3.54 → 4
    const white = evaluateSoft(extractedOf([cell({ q: 0, r: 0, color: "WHITE" }), cell({ q: 1, r: 0, kind: "GAIA" }), cell({ q: -1, r: 0, kind: "TRANSDIM" })]), BASE_SOFT);
    expect(factionOf(white, "nevlas").byKind).toEqual(kinds(B, 0, 5, 1));
    const it = rowOf(white, "itars", "-1,0");
    expect(it.coef).toBe(0.5);
    expect(it.cost).toBe(1.5);
    expect(it.weight).toBeCloseTo(SQ, 10);
    expect(factionOf(white, "itars").byKind).toEqual(kinds(B, 0, 5, Math.round(5 * SQ)));
    expect(auditOf(white).startAccess.representative.WHITE).toBe("itars");
  });

  it("原始・小惑星は 0.1。LF 種族は母星種別 1・基本色 0.25（種族の表の入植コスト）・他方の種別 0.1", () => {
    const r = evaluateSoft(extractedOf([cell({ q: 0, r: 0, kind: "PROTO" }), cell({ q: 2, r: 0, kind: "ASTEROID" }), cell({ q: 1, r: 0, color: "RED" })]), BASE_SOFT);
    // ハッシュ・ホラ人: 原始 1 × 0.25（0 ＋ 3 ＝ 3）、小惑星 1 × 0.5（0 ＋ 2 ＝ 2）→ 0.75 → 1
    expect(rowOf(r, "hadschHallas", "0,0")).toEqual({ cellKey: "0,0", kind: "PROTO", dest: "extra", cost: 3, weight: 0.25, value: 1, coef: 0.1 });
    expect(rowOf(r, "hadschHallas", "2,0")).toEqual({ cellKey: "2,0", kind: "ASTEROID", dest: "extra", cost: 2, weight: 0.5, value: 1, coef: 0.1 });
    expect(factionOf(r, "hadschHallas").byKind).toEqual(kinds(B, 0, 0, 0, 1));
    // モウェイド人: 開始は原始（母星種別）。赤 2.5 × 1.0（0 ＋ 標準 1 ＝ 1）、小惑星 1 × 0.25（跳躍 1 ＋ 2 ＝ 3）
    const mo = factionOf(r, "moweyds");
    expect(mo.color).toBe("PROTO");
    expect(mo.starts).toEqual(["0,0"]);
    expect(rowOf(r, "moweyds", "0,0").dest).toBe("own");
    expect(rowOf(r, "moweyds", "1,0")).toEqual({ cellKey: "1,0", kind: "RED", dest: "other", cost: 1, weight: 1, value: 2.5, coef: 0.25 });
    expect(rowOf(r, "moweyds", "2,0")).toEqual({ cellKey: "2,0", kind: "ASTEROID", dest: "extra", cost: 3, weight: 0.25, value: 1, coef: 0.1 });
    expect(mo.byKind).toEqual(kinds(B, Math.round(2.5), 0, 0, Math.round(0.25)));
    // スペースジャイアントは標準惑星が 2 → 赤は 0.5 で 1.25 → 1
    expect(factionOf(r, "spaceGiants").byKind).toEqual(kinds(B, 1, 0, 0, 0));
    // 原始の行（extraStart）は大きい方のモウェイド人、小惑星は同点で順の先のティンカーロイド
    expect(extraStartOf(r, "PROTO")).toEqual({ factionId: "moweyds", cellKey: "0,0", byKind: mo.byKind, total: mo.total });
    expect(extraStartOf(r, "ASTEROID").factionId).toBe("tinkerroids");
    expect(factionOf(r, "tinkerroids").starts).toEqual(["2,0"]);
    expect(factionOf(r, "tinkerroids").total).toBe(factionOf(r, "darkanians").total);
    expect(auditOf(r).startAccess.representative.PROTO).toBe("moweyds");
    expect(auditOf(r).startAccess.representative.ASTEROID).toBe("tinkerroids");
  });

  it("状況の値（船接触・船星系・端）は固有値に足してから係数と到達係数を掛ける。固有値と状況の内訳を持つ", () => {
    // 船 (0,0)。赤 (1,0) 船接触 10 → 20。ガイア (0,1) 船接触 10 → (10 ＋ 10) × 0.5 ＝ 10、赤から隣接（0 ＋ 1 ＝ 1）→ 1.0
    const r = evaluateSoft(extractedOf([cell({ q: 1, r: 0, color: "RED" }), cell({ q: 0, r: 1, kind: "GAIA" })], [scout(0, 0, "twilight")]), { ...BASE_SOFT, wScout: 10 });
    const hh = factionOf(r, "hadschHallas");
    expect(rowOf(r, "hadschHallas", "1,0").value).toBe(20);
    expect(rowOf(r, "hadschHallas", "0,1")).toEqual({ cellKey: "0,1", kind: "GAIA", dest: "gaia", cost: 1, weight: 1, value: 10, coef: 0.5 });
    expect(hh.byKind).toEqual(kinds(20, 0, 10));
    expect(hh.total).toBe(30);
    expect(hh.base).toBe(B * 1 + B * 0.5);
    expect(hh.scout).toBe(10 * 1 + 10 * 0.5);
    expect(hh.base + hh.scout + hh.core + hh.outer + hh.touch).toBe(hh.total);
    // マーカーのヒットは素の値（係数は掛けない）。船接触惑星（船星系の起点）にガイアは数えない
    expect(auditOf(r).scout.scoutHits.find((h: any) => h.planetKey === "0,1").value).toBe(10);
    expect(auditOf(r).scout.byType.RED).toBe(10);
    expect(auditOf(r).scout.scoutPlanetCount).toBe(1);
  });

  it("種別ごとに丸めて評価はその合計（列の合計と評価が一致し、小数が出ない）。planetTypeTotals は5列の和", () => {
    const r = evaluateSoft(
      extractedOf(
        [cell({ q: 0, r: 0, color: "BLUE" }), cell({ q: 3, r: 0, color: "BLUE" }), cell({ q: 6, r: 0, color: "RED" }), cell({ q: 7, r: 0, kind: "GAIA" }), cell({ q: -2, r: 0, kind: "TRANSDIM" }), cell({ q: 2, r: 2, kind: "PROTO" })],
        [scout(1, 0, "twilight"), scout(5, 1, "eclipse")]
      ),
      { ...BASE_SOFT, wScout: 7, wScoutCore: 3 }
    );
    for (const f of Object.values(auditOf(r).startAccess.byFaction) as any[]) {
      let sum = 0;
      for (const k of DESTINATION_KINDS) {
        expect(Number.isInteger(f.byKind[k])).toBe(true);
        sum += f.byKind[k];
      }
      expect(f.total).toBe(sum);
      expect(Math.abs(f.base + f.scout + f.core + f.outer + f.touch - f.total)).toBeLessThan(2.5); // 5列の丸め誤差以内
    }
    const ax = r.breakdown.axesByType;
    expect(Object.keys(ax).sort()).toEqual([...DESTINATION_KINDS].sort());
    for (const t of ["BLUE", "RED"] as const) {
      expect(ax.own[t] + ax.other[t] + ax.gaia[t] + ax.transdim[t] + ax.extra[t]).toBe(r.breakdown.planetTypeTotals[t]);
      expect(Number.isInteger(r.breakdown.planetTypeTotals[t])).toBe(true);
    }
  });

  it("ガイア近接・星系の軸は無い。距離2のガイアは入植先として（5 × 0.5）だけ入り、周りの惑星に 8 は付かない", () => {
    const r = evaluateSoft(extractedOf([cell({ q: 0, r: 0, color: "RED" }), cell({ q: 2, r: 0, kind: "GAIA" })]), BASE_SOFT);
    expect(rowOf(r, "hadschHallas", "0,0").value).toBe(B);
    expect(rowOf(r, "hadschHallas", "2,0")).toEqual({ cellKey: "2,0", kind: "GAIA", dest: "gaia", cost: 2, weight: 0.5, value: 5, coef: 0.5 });
    expect(factionOf(r, "hadschHallas").byKind).toEqual(kinds(B, 0, Math.round(2.5)));
    expect(auditOf(r).gaiaProximity).toBeUndefined();
    expect(auditOf(r).cluster).toBeUndefined();
    expect((r.breakdown.axesByType as any).gaiaProximity).toBeUndefined();
  });

  it("定数の記録（startAccess.unified）と跳躍の表", () => {
    const r = evaluateSoft(extractedOf([cell({ q: 0, r: 0, color: "RED" })]), BASE_SOFT);
    const sa = auditOf(r).startAccess;
    expect(sa.unified).toEqual({
      base: 10,
      coef: { OWN: 1, OTHER: 0.25, GAIA: 0.5, TRANSDIM: 0.25, GAIA_FACTION_TRANSDIM: 0.5, EXTRA: 0.1, TERRA_BOOST: 1.2 },
      gaiaFactions: ["terrans", "balTaks", "itars", "moweyds"],
      terraformFactions: ["geodens", "taklons", "nevlas"],
    });
    expect(sa.hopCostByDistance).toEqual([0, 0, 1, 1.5, 2, 3]);
    expect(sa.decay).toBe(0.5);
    expect(sa.freeCost).toBe(1);
    expect(sa.byColor.RED.starts).toEqual(sa.byFaction.hadschHallas.starts);
  });
});

describe("開始地点の選び方（eval_v3〜v6 の性質を保つ）", () => {
  it("開始地点は残りの到達加重まで含めて選び、残りは 0.5^(コスト−1) で数える", () => {
    // 赤 (0,0) / (3,0) / (6,0)。船 (1,0) で船接触 10 / 9 / 0 → 値 20 / 19 / 10。
    // 開始 {0,0 / 3,0}: 39 ＋ 10 × 0.71（(3,0) から距離3 ＝ 1.5）＝ 46.1。{0,0 / 6,0}: 30 ＋ 19 × 0.71 ＝ 43.4、{3,0 / 6,0}: 29 ＋ 20 × 0.71 ＝ 43.1
    const r = evaluateSoft(
      extractedOf([cell({ q: 0, r: 0, color: "RED" }), cell({ q: 3, r: 0, color: "RED" }), cell({ q: 6, r: 0, color: "RED" })], [scout(1, 0, "twilight")]),
      { ...BASE_SOFT, wScout: 10 }
    );
    const hh = factionOf(r, "hadschHallas");
    expect(hh.starts.slice().sort()).toEqual(["0,0", "3,0"]);
    const far = rowOf(r, "hadschHallas", "6,0");
    expect(far.cost).toBe(1.5);
    expect(far.weight).toBeCloseTo(SQ, 10);
    expect(far.value).toBe(B);
    expect(hh.total).toBe(Math.round(39 + 10 * SQ));
    // ダー・シュワーム人（開始 1 ヶ所 × 1.5）: 開始 (3,0) ＝ 19 × 1.5 ＋ 20 × 0.71 ＋ 10 × 0.71 ＝ 49.7 → 50 で赤の代表
    const iv = factionOf(r, "ivits");
    expect(iv.starts).toEqual(["3,0"]);
    expect(iv.total).toBe(Math.round(19 * 1.5 + 30 * SQ));
    expect(auditOf(r).startAccess.representative.RED).toBe("ivits");
    expect(r.breakdown.planetTypeTotals.RED).toBe(iv.total);
  });

  it("開始地点は母星色からだけ選ぶ。ガイア・次元横断の方が値が高くても開始地点にならない", () => {
    // 船 (-1,0)。赤 (0,0) 船接触 11 → 21、赤 (9,0) 10、次元横断 (-1,1) 船に隣接 11 → 21 × 0.25 ＝ 5.25、ガイア (2,0) 距離3 ＝ 9 → 19 × 0.5 ＝ 9.5
    // 赤 (0,0) から: 次元横断 隣接 0 ＋ 2 ＝ 2 → 0.5 → 2.63 → 3。ガイア 距離2 ＝ 1 ＋ 1 ＝ 2 → 0.5 → 4.75 → 5
    const r = evaluateSoft(
      extractedOf([cell({ q: 0, r: 0, color: "RED" }), cell({ q: 9, r: 0, color: "RED" }), cell({ q: -1, r: 1, kind: "TRANSDIM" }), cell({ q: 2, r: 0, kind: "GAIA" })], [scout(-1, 0, "twilight")]),
      { ...BASE_SOFT, wScout: 11 }
    );
    const hh = factionOf(r, "hadschHallas");
    expect(hh.starts.slice().sort()).toEqual(["0,0", "9,0"]);
    expect(hh.byKind).toEqual(kinds(31, 0, 5, 3));
    expect(hh.total).toBe(39);
    expect(rowOf(r, "hadschHallas", "-1,1")).toEqual({ cellKey: "-1,1", kind: "TRANSDIM", dest: "transdim", cost: 2, weight: 0.5, value: 5.25, coef: 0.25 });
    expect(rowOf(r, "hadschHallas", "2,0")).toEqual({ cellKey: "2,0", kind: "GAIA", dest: "gaia", cost: 2, weight: 0.5, value: 9.5, coef: 0.5 });
    // マーカー用のヒットは出す。色ごとの合算（byType）には入れない
    expect(auditOf(r).scout.scoutHits.map((h: any) => [h.planetKey, h.planetType]).sort()).toEqual([
      ["-1,1", "TRANSDIM"],
      ["0,0", "RED"],
      ["2,0", "GAIA"],
    ]);
    expect(auditOf(r).scout.byType.RED).toBe(11);
    expect(auditOf(r).scout.extraByKind.GAIA).toBeUndefined();
    expect(auditOf(r).scout.scoutPlanetCount).toBe(1);
  });

  it("ゼノ族は開始3ヶ所、同色のグリーン人は2ヶ所。代表はゼノ族で、色の値はその値", () => {
    // 黄 3つが互いに距離3。船接触で 10 / 10 / 9 → 値 20 / 20 / 19。ゼノ族は3つとも開始＝59。
    // グリーン人は {1,0 / 4,0}: 40 ＋ 19 × 0.71 ＝ 53.4 が最大
    const r = evaluateSoft(
      extractedOf([cell({ q: 1, r: 0, color: "YELLOW" }), cell({ q: 4, r: 0, color: "YELLOW" }), cell({ q: 7, r: 0, color: "YELLOW" })], [scout(0, 0, "twilight"), scout(5, 0, "eclipse")]),
      { ...BASE_SOFT, wScout: 10 }
    );
    expect(factionOf(r, "xenos").starts).toHaveLength(3);
    expect(factionOf(r, "gleens").starts).toHaveLength(2);
    expect(factionOf(r, "xenos").total).toBe(59);
    expect(factionOf(r, "gleens").total).toBe(Math.round(40 + 19 * SQ));
    expect(auditOf(r).startAccess.representative.YELLOW).toBe("xenos");
    expect(r.breakdown.planetTypeTotals.YELLOW).toBe(59);
    expect(r.breakdown.axesByType.own.YELLOW).toBe(59);
  });

  it("ダー・シュワーム人は開始1ヶ所（値 × 1.5）。隣接の同色はコスト0で割引なし", () => {
    // 赤 (1,0)=20、(2,0)=19（船から距離 1 / 2）。ハッシュ・ホラ人は 2 ヶ所で 39。
    // ダー・シュワーム人は (1,0) を開始地点（20 × 1.5 ＝ 30）に選び、(2,0) は隣接 → コスト 0 で 19 → 49
    const r = evaluateSoft(extractedOf([cell({ q: 1, r: 0, color: "RED" }), cell({ q: 2, r: 0, color: "RED" })], [scout(0, 0, "twilight")]), { ...BASE_SOFT, wScout: 10 });
    expect(factionOf(r, "ivits").starts).toEqual(["1,0"]);
    expect(factionOf(r, "hadschHallas").starts).toHaveLength(2);
    expect(factionOf(r, "hadschHallas").total).toBe(39);
    expect(factionOf(r, "ivits").total).toBe(20 * 1.5 + 19);
    expect(rowOf(r, "ivits", "1,0").weight).toBe(1.5);
    expect(rowOf(r, "ivits", "2,0").cost).toBe(0);
    expect(rowOf(r, "ivits", "2,0").weight).toBe(1);
    expect(auditOf(r).startAccess.representative.RED).toBe("ivits");
    // 倍率の無い種族の開始地点の重みは 1 のまま
    expect(rowOf(r, "hadschHallas", "1,0").weight).toBe(1);
  });

  it("航行 Lv1 開始のアンバス人は距離2の跳躍 0.5、タクロン族は 1（改造種族なので他色は × 1.2）", () => {
    // 茶 (0,0)、黄 (2,0)（改造の輪で隣＝1歩）。タクロン族: 0.3 × 10 ＝ 3、コスト 1 ＋ 1 ＝ 2 → 0.5。アンバス人: 2.5、コスト 0.5 ＋ 1 ＝ 1.5 → 0.71
    const r = evaluateSoft(extractedOf([cell({ q: 0, r: 0, color: "BROWN" }), cell({ q: 2, r: 0, color: "YELLOW" })]), BASE_SOFT);
    const t = rowOf(r, "taklons", "2,0");
    expect(t.coef).toBeCloseTo(0.3, 10);
    expect(t.cost).toBe(2);
    expect(t.weight).toBe(0.5);
    const a = rowOf(r, "ambas", "2,0");
    expect(a.coef).toBe(0.25);
    expect(a.cost).toBe(1.5);
    expect(a.weight).toBeCloseTo(SQ, 10);
  });

  it("グリーン人はガイア惑星の入植コスト 0.5（他は 1）。到達係数は 1.0 で同じだが、踏み台のコストでは差が出る", () => {
    const r = evaluateSoft(extractedOf([cell({ q: 0, r: 0, color: "YELLOW" }), cell({ q: 1, r: 0, kind: "GAIA" })]), BASE_SOFT);
    expect(rowOf(r, "gleens", "1,0").cost).toBe(0.5);
    expect(rowOf(r, "xenos", "1,0").cost).toBe(1);
    expect(rowOf(r, "gleens", "1,0").weight).toBe(1);
  });

  it("船星系の加点はガイア・次元横断も受ける（起点にはならない）", () => {
    // 船 (0,0) に接する赤 (1,0) と青 (0,1) が船接触惑星。ガイア (1,1) は両方に隣接 → 船星系 3 を2回
    const r = evaluateSoft(
      extractedOf([cell({ q: 1, r: 0, color: "RED" }), cell({ q: 0, r: 1, color: "BLUE" }), cell({ q: 1, r: 1, kind: "GAIA" })], [scout(0, 0, "twilight")]),
      { ...BASE_SOFT, wScout: 11, wScoutCore: 3 }
    );
    // ガイア ＝ (10 ＋ 船接触 10（距離2）＋ 船星系 6) × 0.5 ＝ 13、赤から隣接 → 1.0
    expect(rowOf(r, "hadschHallas", "1,1")).toEqual({ cellKey: "1,1", kind: "GAIA", dest: "gaia", cost: 1, weight: 1, value: 13, coef: 0.5 });
    // 赤 ＝ 10 ＋ 11（船星系は船接触惑星が1つしか近くに無いので 0）。青は他色 (10 ＋ 11) × 0.25 ＝ 5.25、隣接 ＋ 改造1歩 ＝ 1 → 1.0
    expect(rowOf(r, "hadschHallas", "1,0").value).toBe(21);
    expect(rowOf(r, "hadschHallas", "0,1")).toEqual({ cellKey: "0,1", kind: "BLUE", dest: "other", cost: 1, weight: 1, value: 5.25, coef: 0.25 });
    expect(factionOf(r, "hadschHallas").byKind).toEqual(kinds(21, 5, 13));
    expect(auditOf(r).scoutCore.coreHits.filter((h: any) => h.corePlanetType === "GAIA")).toHaveLength(2);
    expect(auditOf(r).scoutCore.byType.RED).toBe(0);
    expect(auditOf(r).scout.scoutPlanetCount).toBe(2);
  });

  it("色優遇の掛け先は extraStart の値（原始・小惑星）", () => {
    const r = evaluateSoft(extractedOf([cell({ q: 1, r: 0, kind: "PROTO" })], [scout(0, 0, "twilight")]), { ...BASE_SOFT, wScout: 10, wColorPref: 2, colorPrefByType: { PROTO: 1 } as any });
    expect(extraStartOf(r, "PROTO").total).toBe(20);
    expect(r.breakdown.colorPreference?.valueExtraByKind?.PROTO).toBe(20);
    expect(r.breakdown.colorPreference?.scoreExtraByKind?.PROTO).toBe(40);
  });

  it("原始・小惑星が無い盤面では extraStart も LF4種族の行も出さない", () => {
    const r = evaluateSoft(extractedOf([cell({ q: 0, r: 0, color: "RED" })], [scout(1, 0, "twilight")]), { ...BASE_SOFT, wScout: 10 });
    expect(auditOf(r).extraStart).toBeUndefined();
    expect(auditOf(r).startAccess.lf).toBeUndefined();
    expect(factionOf(r, "moweyds")).toBeUndefined();
    expect(factionOf(r, "hadschHallas")).toBeDefined();
    expect(auditOf(r).startAccess.byColor.RED).toBeDefined();
  });
});

describe("端の罰点「欠けマス × w」（2026-10-04 確定、eval_v4。eval_v7 では固有値から引く）", () => {
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

  it("罰点 ＝ −w × 距離2以内の欠けマス数。最外周セルは「最外周」、外周セルは「外周」の内訳。惑星の値は 固有値 − 罰点", () => {
    // 半径5の六角形。(5,-2) は最外周の辺（欠け7）、(4,0) は外周の角寄り（欠け5）、(0,0) は内側（欠け0）
    const red = evaluateSoft(boardOf(5, [cell({ q: 5, r: -2, color: "RED" })]), { ...BASE_SOFT, wRimGap: 0.5 });
    const hh = factionOf(red, "hadschHallas");
    expect(rowOf(red, "hadschHallas", "5,-2").value).toBe(B - 3.5);
    expect(hh.outer).toBe(-3.5);
    expect(hh.touch).toBe(0);
    expect(hh.base).toBe(B);
    expect(hh.total).toBe(Math.round(B - 3.5));
    // 赤の代表はダー・シュワーム人（(B − 3.5) × 1.5 ＝ 9.75 → 10）。罰点も倍率の中に入る
    expect(factionOf(red, "ivits").total).toBe(Math.round((B - 3.5) * 1.5));
    expect(red.breakdown.planetTypeTotals.RED).toBe(Math.round((B - 3.5) * 1.5));
    const rg = auditOf(red).rimGap;
    expect(rg).toEqual({ w: 0.5, range: 2, ringCells: 18, missingByCell: { "5,-2": 7 } });
    expect(auditOf(red).outerHits).toEqual([expect.objectContaining({ cellKey: "5,-2", planetType: "RED", missing: 7, value: -3.5 })]);
    expect(auditOf(red).outerCountByType.RED).toBe(1);
    const blue = evaluateSoft(boardOf(5, [cell({ q: 4, r: 0, color: "BLUE" })]), { ...BASE_SOFT, wRimGap: 0.5 });
    expect(factionOf(blue, "terrans").touch).toBe(-2.5);
    expect(factionOf(blue, "terrans").outer).toBe(0);
    expect(auditOf(blue).touchHits).toEqual([expect.objectContaining({ cellKey: "4,0", planetType: "BLUE", missing: 5, value: -2.5 })]);
    expect(auditOf(blue).touchCountByType.BLUE).toBe(1);
    const white = evaluateSoft(boardOf(5, [cell({ q: 0, r: 0, color: "WHITE" })]), { ...BASE_SOFT, wRimGap: 0.5 });
    expect(factionOf(white, "nevlas").total).toBe(B);
    expect(auditOf(white).rimGap.missingByCell).toEqual({});
  });

  it("角は辺より重い（最外周の角は欠け10、辺は7）。w ＝ 1 なら角の惑星の値は 0", () => {
    const corner = evaluateSoft(boardOf(5, [cell({ q: 5, r: 0, color: "RED" })]), { ...BASE_SOFT, wRimGap: 1 });
    const edge = evaluateSoft(boardOf(5, [cell({ q: 5, r: -2, color: "RED" })]), { ...BASE_SOFT, wRimGap: 1 });
    expect(factionOf(corner, "hadschHallas").outer).toBe(-10);
    expect(factionOf(corner, "hadschHallas").total).toBe(0);
    expect(factionOf(edge, "hadschHallas").outer).toBe(-7);
    expect(factionOf(edge, "hadschHallas").total).toBe(3);
  });

  it("原始・小惑星にも同じ罰点が掛かり、行の値（extraStart）と種族ごとの値に入る", () => {
    const r = evaluateSoft(boardOf(5, [cell({ q: 5, r: -2, kind: "PROTO" }), cell({ q: 4, r: 0, kind: "ASTEROID" })]), { ...BASE_SOFT, wRimGap: 1 });
    // 原始 (5,-2): 10 − 7 ＝ 3。小惑星 (4,0) は他方の種別 0.1 × (10 − 5) ＝ 0.5、距離2 ＝ 1 ＋ 2 ＝ 3 → 0.25 → 0.125 → 0
    expect(factionOf(r, "moweyds").outer).toBe(-7);
    expect(factionOf(r, "moweyds").total).toBe(3);
    expect(extraStartOf(r, "PROTO").total).toBe(3);
    // 小惑星 (4,0): 10 − 5 ＝ 5。原始 (5,-2) は 0.1 × 3 ＝ 0.3、距離2 ＝ 1 ＋ 3 ＝ 4 → 0.125 → 0.04 → 0
    expect(factionOf(r, "tinkerroids").touch).toBe(-5);
    expect(factionOf(r, "tinkerroids").outer).toBeCloseTo(-7 * 0.1 * 0.125, 10); // 原始の罰点は最外周の内訳に
    expect(factionOf(r, "tinkerroids").total).toBe(5);
    expect(extraStartOf(r, "ASTEROID").total).toBe(5);
    expect(auditOf(r).outerExtraByKind?.PROTO).toBe(-7);
    expect(auditOf(r).touchExtraByKind?.ASTEROID).toBe(-5);
  });

  it("下限は無い: 罰点が固有値を超えると負の値になり、開始地点の選び方にも効く", () => {
    const r = evaluateSoft(boardOf(5, [cell({ q: 5, r: 0, color: "RED" })]), { ...BASE_SOFT, wRimGap: 2 });
    expect(factionOf(r, "hadschHallas").total).toBe(B - 20);
    expect(r.breakdown.planetTypeTotals.RED).toBe(B - 20);
    // 白 (0,0) 内側 10 / (3,0) 内側 10 / (5,-2) 最外周の辺 10 − 14 ＝ −4（w ＝ 2）。開始は {0,0 / 3,0}、(5,-2) は (3,0) から距離2（コスト1 → 1.0）
    const w = evaluateSoft(boardOf(5, [cell({ q: 0, r: 0, color: "WHITE" }), cell({ q: 3, r: 0, color: "WHITE" }), cell({ q: 5, r: -2, color: "WHITE" })]), { ...BASE_SOFT, wRimGap: 2 });
    expect(factionOf(w, "nevlas").starts.slice().sort()).toEqual(["0,0", "3,0"]);
    expect(rowOf(w, "nevlas", "5,-2")).toEqual({ cellKey: "5,-2", kind: "WHITE", dest: "own", cost: 1, weight: 1, value: -4 });
    expect(factionOf(w, "nevlas").total).toBe(16);
  });

  it("端の罰点はガイア・次元横断にも掛かり、係数と到達係数で薄まって入る。ヒットは GAIA / TRANSDIM で出す", () => {
    // 赤 (0,0)、ガイア (5,-2)（最外周の辺、欠け7、w ＝ 2 → −14）。ガイア ＝ 0.5 × (10 − 14) ＝ −2、距離5 → 3 ＋ 1 ＝ 4 → 0.125 → −0.25
    const r = evaluateSoft(boardOf(5, [cell({ q: 0, r: 0, color: "RED" }), cell({ q: 5, r: -2, kind: "GAIA" })]), { ...BASE_SOFT, wRimGap: 2 });
    expect(rowOf(r, "hadschHallas", "5,-2")).toEqual({ cellKey: "5,-2", kind: "GAIA", dest: "gaia", cost: 4, weight: 0.125, value: -2, coef: 0.5 });
    expect(factionOf(r, "hadschHallas").outer).toBeCloseTo(-14 * 0.5 * 0.125, 10);
    expect(factionOf(r, "hadschHallas").byKind).toEqual(kinds(B, 0, Math.round(-0.25)));
    expect(auditOf(r).outerHits).toEqual([expect.objectContaining({ cellKey: "5,-2", planetType: "GAIA", missing: 7, value: -14 })]);
    // 枚数（最外周の通常惑星の数）には入れない
    expect(auditOf(r).outerCountByType.RED).toBe(0);
  });

  it("wRimGap を省略（0）すれば罰点なし。記録（rimGap）も出さない", () => {
    const r = evaluateSoft(boardOf(5, [cell({ q: 5, r: -2, color: "RED" })]), BASE_SOFT);
    expect(factionOf(r, "hadschHallas").total).toBe(B);
    expect(auditOf(r).rimGap).toBeUndefined();
    expect(auditOf(r).outerHits[0].missing).toBe(0);
  });

  it("eval_v3 までの wOuter / wTouch は、指定があれば wRimGap に加えて効く（古い調査スクリプト用）", () => {
    const r = evaluateSoft(boardOf(5, [cell({ q: 5, r: -2, color: "RED" })]), { ...BASE_SOFT, wRimGap: 1, wOuter: 3 });
    expect(factionOf(r, "hadschHallas").outer).toBe(-10); // −7 − 3
    expect(factionOf(r, "hadschHallas").total).toBe(0);
    const b = evaluateSoft(boardOf(5, [cell({ q: 4, r: 0, color: "BLUE" })]), { ...BASE_SOFT, wRimGap: 1, wTouch: 1 });
    expect(factionOf(b, "terrans").touch).toBe(-6); // −5 − 1
  });
});
