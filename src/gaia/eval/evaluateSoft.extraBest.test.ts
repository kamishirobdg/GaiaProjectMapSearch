// src/gaia/eval/evaluateSoft.extraBest.test.ts
//
// 原始・小惑星の「最良の1惑星 × 補正値」（2026-07-31 ユーザー確定）。
// 複数がそこそこ優位であるより「船に近く星系にも近い最良の惑星が1つ」が望ましい、
// という判断で、種別ごとの単純合算（extraByKind）から置き換えた。
// 単純合算のほうは監査用に残っているので、両方を突き合わせて固定する。
//
// evaluateSoft が読むのは cells / planetCells / scoutCells / outerCells / touchCells
// だけなので、baseAxes テストと同じく最小のフェイクを組む。

import { describe, it, expect } from "vitest";
import { EXTRA_BEST_FACTOR, evaluateSoft, type SoftParams } from "./evaluateSoft";
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

const bestOf = (r: ReturnType<typeof evaluateSoft>, kind: string) =>
  (r.breakdown.audit as any).extraBest?.[kind];
const sumOf = (r: ReturnType<typeof evaluateSoft>, kind: string) => {
  const a: any = r.breakdown.audit;
  const ex = (o: any) => Number(o?.[kind] ?? 0) || 0;
  return (
    ex(a.scout?.extraByKind) +
    ex(a.scoutCore?.extraByKind) +
    ex(a.gaiaProximity?.extraByKind) +
    ex(a.cluster?.extraByKind)
  );
};

describe("extraBest（原始・小惑星の最良の1つ）", () => {
  it("船に近いほうの1惑星だけを採り、合算はしない", () => {
    // 距離が1伸びるごとに DISTANCE_FALLOFF(10) 引く。wScout=100 なら
    // 距離1の PROTO は +100、距離3の PROTO は +80。単純合算なら 180。
    const e = extractedOf(
      [cell({ q: 1, r: 0, kind: "PROTO" }), cell({ q: 3, r: 0, kind: "PROTO" })],
      [scout(0, 0, "twilight")]
    );
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 100 });

    expect(sumOf(r, "PROTO")).toBe(180);
    const best = bestOf(r, "PROTO");
    expect(best.cellKey).toBe("1,0");
    expect(best.raw).toBe(100);
    expect(best.total).toBe(Math.round(100 * EXTRA_BEST_FACTOR));
    expect(best.factor).toBe(EXTRA_BEST_FACTOR);
  });

  // 補正値は 2.75 なので掛けると小数が出る。他の評価値は整数なので、軸ごとに
  // 丸めて評価列はその合計にしてある（2026-07-31）。
  it("評価値に小数を出さない（軸ごとに丸め、評価はその合計）", () => {
    const e = extractedOf(
      [cell({ q: 1, r: 0, kind: "PROTO" }), cell({ q: 2, r: 0, kind: "GAIA" })],
      [scout(0, 0, "twilight")]
    );
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 100, wGaiaDist1: 50, wGaiaDist2: 80 });
    const b = bestOf(r, "PROTO");
    for (const v of [b.scout, b.core, b.gaia, b.cluster, b.total]) {
      expect(Number.isInteger(v)).toBe(true);
    }
    expect(b.scout + b.core + b.gaia + b.cluster).toBe(b.total);
  });

  it("軸ごとの値も同じ補正が掛かるので、4軸の合計＝評価になる", () => {
    // PROTO をガイア2つの隣に置き、船からも拾わせる
    const e = extractedOf(
      [
        cell({ q: 1, r: 0, kind: "PROTO" }),
        cell({ q: 2, r: 0, kind: "GAIA" }),
        cell({ q: 1, r: 1, kind: "GAIA" }),
      ],
      [scout(0, 0, "twilight")]
    );
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 10, wGaiaDist1: 5, wGaiaDist2: 3, wGaiaDist3: 1 });
    const b = bestOf(r, "PROTO");
    expect(b.scout + b.core + b.gaia + b.cluster).toBe(b.total);
    // 軸ごとに丸めるので、raw×補正値との差は軸の数（最大4）の丸め誤差に収まる
    expect(Math.abs(b.raw * EXTRA_BEST_FACTOR - b.total)).toBeLessThanOrEqual(2);
  });

  it("種別ごとに1つずつ選ぶ（原始と小惑星は別枠）", () => {
    const e = extractedOf(
      [
        cell({ q: 1, r: 0, kind: "PROTO" }),
        cell({ q: 3, r: 0, kind: "PROTO" }),
        cell({ q: 2, r: 0, kind: "ASTEROID" }),
      ],
      [scout(0, 0, "twilight")]
    );
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 100 });
    expect(bestOf(r, "PROTO").cellKey).toBe("1,0");
    expect(bestOf(r, "ASTEROID").cellKey).toBe("2,0");
    expect(bestOf(r, "PROTO").raw).toBe(100);
    expect(bestOf(r, "ASTEROID").raw).toBe(90);
  });

  it("最良の1つは種別ごとの単純合算を超えない", () => {
    const e = extractedOf(
      [
        cell({ q: 1, r: 0, kind: "PROTO" }),
        cell({ q: 2, r: 0, kind: "PROTO" }),
        cell({ q: 3, r: 0, kind: "PROTO" }),
      ],
      [scout(0, 0, "twilight")]
    );
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 100, wClusterSize: 10 });
    expect(bestOf(r, "PROTO").raw).toBeLessThanOrEqual(sumOf(r, "PROTO"));
  });

  it("星系は「その惑星が属する星系の大きさ」なので、同じ星系の2つは同じ値を持つ", () => {
    // 3つ連結（PROTO 2 + RED 1）。星系の大きさ3 → 各 PROTO の cluster は 3
    // 単純合算のほうは種別ごとに1回なので 3 のまま。
    const e = extractedOf([
      cell({ q: 0, r: 0, kind: "PROTO" }),
      cell({ q: 1, r: 0, kind: "PROTO" }),
      cell({ q: 2, r: 0, color: "RED" }),
    ]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wClusterSize: 10 });
    expect(sumOf(r, "PROTO")).toBe(30);
    const b = bestOf(r, "PROTO");
    expect(b.cluster).toBe(Math.round(30 * EXTRA_BEST_FACTOR));
    // 同点なのでセルキーの小さい方が安定して選ばれる
    expect(b.cellKey).toBe("0,0");
  });

  it("最外周・外周は評価に入れない（2026-07-30 確定）", () => {
    const e = extractedOf([cell({ q: 0, r: 0, kind: "PROTO" })]);
    (e as any).outerCells = new Set(["0,0"]);
    (e as any).touchCells = new Set(["0,0"]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wOuter: 3, wTouch: 1 });
    // 最外周/外周しか無い惑星は4軸の値が0なので extraBest 自体が立たない
    expect(bestOf(r, "PROTO")).toBeUndefined();
    // 監査側には従来どおり最外周/外周の分が残っている
    expect((r.breakdown.audit as any).outerExtraByKind?.PROTO).toBe(-3);
  });

  it("原始・小惑星が無い盤面では extraBest を出さない", () => {
    const e = extractedOf([cell({ q: 0, r: 0, color: "RED" })], [scout(1, 0, "twilight")]);
    const r = evaluateSoft(e, { ...BASE_SOFT, wScout: 10 });
    expect((r.breakdown.audit as any).extraBest).toBeUndefined();
  });
});
