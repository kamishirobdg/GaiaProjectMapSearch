// src/gaia/eval/reachCost.test.ts
//
// Map 評価の集計「開始地点＋到達しやすさ」の定数と経路探索（2026-10-03 確定）。
// 定数の値そのものを固定する —— 変えるときはユーザー判断のうえ、docs/design-notes.md と
// このテストを一緒に直す。

import { describe, it, expect } from "vitest";
import { axialDistance } from "../hex";
import {
  BASIC_FACTION_ORDER,
  BASIC_REACH_PROFILES,
  HOP_COST_BY_DISTANCE,
  LF_REACH_PROFILES,
  RIM_GAP_RANGE,
  RIM_GAP_RING_CELLS,
  START_COUNT_LF,
  START_COUNT_STANDARD,
  TERRAFORM_WHEEL,
  hopCost,
  hopCostForBasicFaction,
  missingCellsWithin,
  planStarts,
  reachCostsFrom,
  reachFactor,
  stoneCostForBasicFaction,
  stoneCostForColor,
  stoneCostForLfFaction,
  terraformSteps,
  type PlanetNode,
} from "./reachCost";
import { FACTIONS } from "./factionWeights";

const node = (q: number, r: number, kind: string): PlanetNode => ({ key: `${q},${r}`, q, r, kind });

describe("改造の輪と入植コスト", () => {
  it("輪の順は テラ→酸化→火山→砂漠→沼沢→チタン→氷（2026-10-02 ユーザー確定）", () => {
    expect(TERRAFORM_WHEEL).toEqual(["BLUE", "RED", "ORANGE", "YELLOW", "BROWN", "BLACK", "WHITE"]);
  });

  it("隣は1歩、2つ先は2歩、反対は3歩で、輪は閉じている", () => {
    expect(terraformSteps("BLUE", "BLUE")).toBe(0);
    expect(terraformSteps("BLUE", "RED")).toBe(1);
    expect(terraformSteps("BLUE", "WHITE")).toBe(1); // 端どうしも隣
    expect(terraformSteps("BLUE", "ORANGE")).toBe(2);
    expect(terraformSteps("BLUE", "YELLOW")).toBe(3);
    expect(terraformSteps("BLUE", "BROWN")).toBe(3);
    expect(terraformSteps("YELLOW", "BLUE")).toBe(3);
  });

  it("基本色の視点: 同色0・ガイア1・次元横断1・原始3・小惑星2", () => {
    const c = stoneCostForColor("RED");
    expect(c("RED")).toBe(0);
    expect(c("BLUE")).toBe(1);
    expect(c("GAIA")).toBe(1);
    expect(c("TRANSDIM")).toBe(1);
    expect(c("PROTO")).toBe(3);
    expect(c("ASTEROID")).toBe(2);
  });

  it("LF4種族の視点: 母星種別が無いので同じ種別にも原始3・小惑星2を払う", () => {
    expect(LF_REACH_PROFILES.darkanians).toEqual({ home: "ASTEROID", standard: 1, gaia: 2, transdim: 2 });
    // ガイア Lv1 開始のモウェイド人は次元横断 0.5（2026-10-05 ユーザー確定）。ガイア惑星は 1 のまま
    expect(LF_REACH_PROFILES.moweyds).toEqual({ home: "PROTO", standard: 1, gaia: 1, transdim: 0.5 });
    expect(stoneCostForLfFaction("moweyds")("TRANSDIM")).toBe(0.5);
    expect(stoneCostForLfFaction("moweyds")("GAIA")).toBe(1);
    expect(stoneCostForLfFaction("spaceGiants")("TRANSDIM")).toBe(2);
    expect(LF_REACH_PROFILES.tinkerroids.standard).toBe(1); // 相手次第で1か3。Map 探索では既定1
    expect(LF_REACH_PROFILES.moweyds.standard).toBe(1);
    expect(LF_REACH_PROFILES.spaceGiants.standard).toBe(2);
    const d = stoneCostForLfFaction("darkanians");
    expect(d("ASTEROID")).toBe(2);
    expect(d("PROTO")).toBe(3);
    expect(d("BLUE")).toBe(1);
    expect(d("GAIA")).toBe(2);
    expect(stoneCostForLfFaction("spaceGiants")("WHITE")).toBe(2);
    expect(stoneCostForLfFaction("moweyds")("GAIA")).toBe(1);
  });
});

describe("基本14種族の到達プロファイル（2026-10-05 ユーザー確定）", () => {
  it("母星色は種族の定義と一致し、14種族すべてにプロファイルがある", () => {
    expect(BASIC_FACTION_ORDER).toHaveLength(14);
    for (const id of BASIC_FACTION_ORDER) {
      const def = FACTIONS.find((f) => f.id === id)!;
      expect(def).toBeDefined();
      expect(BASIC_REACH_PROFILES[id].color).toBe(def.color);
    }
  });

  it("開始建物の数: ゼノ族3 / ダー・シュワーム人1 / 他2", () => {
    expect(BASIC_REACH_PROFILES.xenos.startCount).toBe(3);
    expect(BASIC_REACH_PROFILES.ivits.startCount).toBe(1);
    for (const id of BASIC_FACTION_ORDER) if (id !== "xenos" && id !== "ivits") expect(BASIC_REACH_PROFILES[id].startCount).toBe(2);
  });

  it("航行: Lv1 開始のグリーン人・アンバス人は距離2が 0.5、伸ばせないバルタック人は 1.5、他は色の表", () => {
    expect(hopCostForBasicFaction("gleens")(2)).toBe(0.5);
    expect(hopCostForBasicFaction("ambas")(2)).toBe(0.5);
    expect(hopCostForBasicFaction("balTaks")(2)).toBe(1.5);
    expect(hopCostForBasicFaction("terrans")(2)).toBe(1);
    // 距離2以外は全員同じ
    for (const id of BASIC_FACTION_ORDER) {
      const h = hopCostForBasicFaction(id);
      expect([h(1), h(3), h(4), h(5), h(6)]).toEqual([0, 1.5, 2, 3, Infinity]);
    }
  });

  it("改造: ジオデン人は歩数 × 2/3、他は色の表そのもの", () => {
    const g = stoneCostForBasicFaction("geodens"); // 橙。輪で隣は RED / YELLOW
    expect(g("ORANGE")).toBe(0);
    expect(g("RED")).toBeCloseTo(2 / 3, 10);
    expect(g("BLUE")).toBeCloseTo(4 / 3, 10); // 2歩
    expect(g("BLACK")).toBeCloseTo(2, 10); // 3歩
    const t = stoneCostForBasicFaction("taklons");
    for (const k of ["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW", "GAIA", "TRANSDIM", "PROTO", "ASTEROID"]) {
      expect(t(k)).toBe(stoneCostForColor("BROWN")(k));
    }
  });

  it("ガイア Lv1 開始の地球人・バルタック人は次元横断 0.5（ガイア惑星は 1）、グリーン人はガイア惑星 0.5（次元横断は 1）", () => {
    expect(stoneCostForBasicFaction("terrans")("TRANSDIM")).toBe(0.5);
    expect(stoneCostForBasicFaction("terrans")("GAIA")).toBe(1);
    expect(stoneCostForBasicFaction("balTaks")("TRANSDIM")).toBe(0.5);
    expect(stoneCostForBasicFaction("balTaks")("GAIA")).toBe(1);
    expect(stoneCostForBasicFaction("gleens")("GAIA")).toBe(0.5);
    expect(stoneCostForBasicFaction("gleens")("TRANSDIM")).toBe(1);
    expect(stoneCostForBasicFaction("lantids")("GAIA")).toBe(1);
    expect(stoneCostForBasicFaction("lantids")("TRANSDIM")).toBe(1);
  });

  it("プロファイルの表そのもの（変えるときはユーザー判断）", () => {
    expect(BASIC_REACH_PROFILES).toEqual({
      terrans: { color: "BLUE", startCount: 2, transdim: 0.5 },
      lantids: { color: "BLUE", startCount: 2 },
      xenos: { color: "YELLOW", startCount: 3 },
      gleens: { color: "YELLOW", startCount: 2, hop2: 0.5, gaia: 0.5 },
      taklons: { color: "BROWN", startCount: 2 },
      ambas: { color: "BROWN", startCount: 2, hop2: 0.5 },
      hadschHallas: { color: "RED", startCount: 2 },
      ivits: { color: "RED", startCount: 1 },
      geodens: { color: "ORANGE", startCount: 2, terraformScale: 2 / 3 },
      balTaks: { color: "ORANGE", startCount: 2, hop2: 1.5, transdim: 0.5 },
      firaks: { color: "BLACK", startCount: 2 },
      bescods: { color: "BLACK", startCount: 2 },
      nevlas: { color: "WHITE", startCount: 2 },
      itars: { color: "WHITE", startCount: 2 },
    });
  });
});

describe("跳躍コストと到達係数", () => {
  it("距離1=0 / 2=1 / 3=1.5 / 4=2 / 5=3 / 6以上は不可", () => {
    expect(HOP_COST_BY_DISTANCE).toEqual([0, 0, 1, 1.5, 2, 3]);
    expect(hopCost(1)).toBe(0);
    expect(hopCost(2)).toBe(1);
    expect(hopCost(3)).toBe(1.5);
    expect(hopCost(4)).toBe(2);
    expect(hopCost(5)).toBe(3);
    expect(hopCost(6)).toBe(Infinity);
  });

  it("係数は 0.5 の（コスト−1）乗。コスト1以下は割引なし、到達不能は 0", () => {
    expect(reachFactor(0)).toBe(1);
    expect(reachFactor(1)).toBe(1);
    expect(reachFactor(1.5)).toBeCloseTo(Math.SQRT1_2, 10);
    expect(reachFactor(2)).toBe(0.5);
    expect(reachFactor(3)).toBe(0.25);
    expect(reachFactor(5)).toBe(0.0625);
    expect(reachFactor(Infinity)).toBe(0);
  });

  it("開始地点の数は 標準2 / LF1", () => {
    expect(START_COUNT_STANDARD).toBe(2);
    expect(START_COUNT_LF).toBe(1);
  });
});

describe("端の罰点「欠けマス × w」の欠けマス数（2026-10-04 確定）", () => {
  /** 原点から距離 R 以内の全マス（自分を含む）を盤面にする */
  const disk = (R: number): Set<string> => {
    const s = new Set<string>();
    for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (axialDistance(0, 0, q, r) <= R) s.add(`${q},${r}`);
    return s;
  };

  it("範囲は距離2、その範囲のマスは自分を除いて18", () => {
    expect(RIM_GAP_RANGE).toBe(2);
    expect(RIM_GAP_RING_CELLS).toBe(18);
    expect(missingCellsWithin(new Set(), 0, 0)).toBe(18);
  });

  it("内側（距離2以内が全部盤面）の欠けは 0", () => {
    expect(missingCellsWithin(disk(2), 0, 0)).toBe(0);
    expect(missingCellsWithin(disk(5), 3, 0)).toBe(0);
  });

  it("半径5の六角形の盤面: 最外周の辺は 7・角は 10、その1つ内側は辺 3・角 5、2つ内側は 0", () => {
    const b = disk(5);
    // 最外周の辺の中ほど (5,-2) / (5,-3)、角 (5,0) / (5,-5)
    expect(missingCellsWithin(b, 5, -2)).toBe(7);
    expect(missingCellsWithin(b, 5, -3)).toBe(7);
    expect(missingCellsWithin(b, 5, 0)).toBe(10);
    expect(missingCellsWithin(b, 5, -5)).toBe(10);
    // 1つ内側（外周）
    expect(missingCellsWithin(b, 4, -2)).toBe(3);
    expect(missingCellsWithin(b, 4, 0)).toBe(5);
    // 2つ内側は 0
    expect(missingCellsWithin(b, 3, -1)).toBe(0);
    expect(missingCellsWithin(b, 3, 0)).toBe(0);
  });

  it("範囲を変えられる（距離1なら隣接6マスのうちの欠け。外周は 0）", () => {
    expect(missingCellsWithin(disk(5), 5, -2, 1)).toBe(2);
    expect(missingCellsWithin(disk(5), 5, 0, 1)).toBe(3);
    expect(missingCellsWithin(disk(5), 4, -2, 1)).toBe(0);
  });
});

describe("到達コストの経路探索", () => {
  it("直接跳べるときは距離の表そのもの（同色の目的地は入植コスト0）", () => {
    const pair = (d: number) => reachCostsFrom([node(0, 0, "RED"), node(d, 0, "RED")], 0, stoneCostForColor("RED"))[1];
    expect(pair(3)).toBe(1.5);
    expect(pair(4)).toBe(2);
    expect(pair(5)).toBe(3);
    expect(pair(6)).toBe(Infinity);
  });

  it("同色の惑星は0歩の踏み台になるので、遠い同色へも乗り継いで届く", () => {
    // (0,0)→(3,0) 1.5 → (5,0) は距離2で +1 = 2.5（直接なら距離5で 3）。(6,0) は (5,0) から隣接で 2.5。
    const nodes = [node(0, 0, "RED"), node(3, 0, "RED"), node(5, 0, "RED"), node(6, 0, "RED")];
    expect(reachCostsFrom(nodes, 0, stoneCostForColor("RED"))).toEqual([0, 1.5, 2.5, 2.5]);
  });

  it("踏み台を経由すると、跳躍の和に踏み台の入植コストが足される", () => {
    // 開始 → 隣接の青（1歩）→ 距離2 の赤: 0 + 1 + 1 = 2。直接は距離3で 1.5 なので直接が選ばれる。
    // 開始 → 距離6 の赤は直接では不可。隣接の青(0+1)から距離5(3) なら 4 だが、
    // 同色の赤(3,0) を踏み台にすれば 1.5 + 0 + 1.5 = 3 で済む（同色の踏み台は0歩）。
    const nodes = [node(0, 0, "RED"), node(1, 0, "BLUE"), node(3, 0, "RED"), node(6, 0, "RED")];
    const cost = reachCostsFrom(nodes, 0, stoneCostForColor("RED"));
    expect(cost[2]).toBe(1.5);
    expect(cost[3]).toBe(3);
    // 同色の踏み台を外すと青経由の 4 になる
    const noRedStone = reachCostsFrom([nodes[0], nodes[1], nodes[3]], 0, stoneCostForColor("RED"));
    expect(noRedStone[2]).toBe(4);
  });

  it("ガイアと次元横断も踏み台になる（1歩）、原始は3歩、小惑星は2歩", () => {
    const base = [node(0, 0, "RED"), node(6, 0, "RED")];
    const via = (kind: string) => reachCostsFrom([...base, node(1, 0, kind)], 0, stoneCostForColor("RED"))[1];
    expect(via("GAIA")).toBe(4);
    expect(via("TRANSDIM")).toBe(4);
    expect(via("PROTO")).toBe(6);
    expect(via("ASTEROID")).toBe(5);
  });

  it("LF4種族は同じ種別の惑星へ行くにも入植コストを払う", () => {
    const nodes = [node(0, 0, "ASTEROID"), node(3, 0, "ASTEROID"), node(3, 1, "PROTO")];
    const cost = reachCostsFrom(nodes, 0, stoneCostForLfFaction("darkanians"));
    expect(cost[1]).toBe(1.5 + 2);
    expect(cost[2]).toBe(hopCost(4) + 3);
  });
});

describe("開始地点の総当たり", () => {
  it("標準種族は2ヶ所、残りは到達係数で重み付けする", () => {
    // 同色3つ。a=0,0 / b=3,0 / c=10,0（c は孤立）
    const nodes = [node(0, 0, "RED"), node(3, 0, "RED"), node(10, 0, "RED")];
    const plan = planStarts({
      nodes,
      candidates: [
        { key: "0,0", value: 30 },
        { key: "3,0", value: 20 },
        { key: "10,0", value: 25 },
      ],
      stoneCost: stoneCostForColor("RED"),
      startCount: START_COUNT_STANDARD,
    })!;
    // 開始 {0,0 / 10,0}: 30 + 25 + 20 × 0.5^(1.5−1) = 69.1。開始 {0,0 / 3,0}: 30 + 20 + 0 = 50。
    expect(plan.starts.sort()).toEqual(["0,0", "10,0"]);
    expect(plan.weights.get("3,0")).toBeCloseTo(Math.SQRT1_2, 10);
    expect(plan.costs.get("3,0")).toBe(1.5);
    expect(plan.total).toBeCloseTo(55 + 20 * Math.SQRT1_2, 10);
  });

  it("残りの到達加重まで含めて選ぶので、「値の上位2」とは違う組になることがある", () => {
    // 値の上位2は a(30), b(29)。しかし a と b は隣り合う位置にあり、c(28) と d(10) は遠い。
    // a と c を開始にすると b(距離3→0.71)と d の両方を拾える。
    const nodes = [node(0, 0, "RED"), node(3, 0, "RED"), node(9, 0, "RED"), node(12, 0, "RED")];
    const plan = planStarts({
      nodes,
      candidates: [
        { key: "0,0", value: 30 },
        { key: "3,0", value: 29 },
        { key: "9,0", value: 28 },
        { key: "12,0", value: 10 },
      ],
      stoneCost: stoneCostForColor("RED"),
      startCount: 2,
    })!;
    expect(plan.starts.sort()).toEqual(["0,0", "9,0"]);
  });

  it("LF4種族は1ヶ所。候補が1つでも動く", () => {
    const nodes = [node(0, 0, "PROTO"), node(4, 0, "PROTO")];
    const one = planStarts({ nodes, candidates: [{ key: "0,0", value: 12 }], stoneCost: stoneCostForLfFaction("moweyds"), startCount: START_COUNT_LF })!;
    expect(one.starts).toEqual(["0,0"]);
    expect(one.total).toBe(12);
    const two = planStarts({
      nodes,
      candidates: [
        { key: "0,0", value: 12 },
        { key: "4,0", value: 20 },
      ],
      stoneCost: stoneCostForLfFaction("moweyds"),
      startCount: START_COUNT_LF,
    })!;
    // 開始 4,0: 20 + 12 × 0.5^(2+3−1) = 20.75。開始 0,0: 12 + 20 × 0.0625 = 13.25
    expect(two.starts).toEqual(["4,0"]);
    expect(two.costs.get("0,0")).toBe(5);
    expect(two.total).toBeCloseTo(20.75, 10);
  });

  it("ゼノ族は3ヶ所の組を総当たり。ダー・シュワーム人は1ヶ所", () => {
    const nodes = [node(0, 0, "YELLOW"), node(3, 0, "YELLOW"), node(6, 0, "YELLOW"), node(9, 0, "YELLOW")];
    const cands = [
      { key: "0,0", value: 10 },
      { key: "3,0", value: 20 },
      { key: "6,0", value: 30 },
      { key: "9,0", value: 5 },
    ];
    const x = planStarts({ nodes, candidates: cands, stoneCost: stoneCostForBasicFaction("xenos"), startCount: BASIC_REACH_PROFILES.xenos.startCount })!;
    expect(x.starts).toHaveLength(3);
    expect(x.starts.sort()).toEqual(["0,0", "3,0", "6,0"]); // 上位3つ ＋ (9,0) は (6,0) から距離3 → 0.71
    expect(x.total).toBeCloseTo(60 + 5 * Math.SQRT1_2, 10);
    const iv = planStarts({ nodes, candidates: cands, stoneCost: stoneCostForBasicFaction("ivits"), startCount: BASIC_REACH_PROFILES.ivits.startCount })!;
    expect(iv.starts).toHaveLength(1);
  });

  it("種族ごとの跳躍表を渡せる（グリーン人は距離2が 0.5）", () => {
    const nodes = [node(0, 0, "YELLOW"), node(2, 0, "YELLOW")];
    const cands = [
      { key: "0,0", value: 10 },
      { key: "2,0", value: 10 },
    ];
    const g = planStarts({ nodes, candidates: cands, stoneCost: stoneCostForBasicFaction("gleens"), startCount: 1, hopCost: hopCostForBasicFaction("gleens") })!;
    expect(g.costs.get("2,0")).toBe(0.5);
    expect(g.weights.get("2,0")).toBe(1); // コスト1以下は割引なし
    const t = planStarts({ nodes, candidates: cands, stoneCost: stoneCostForColor("YELLOW"), startCount: 1 })!;
    expect(t.costs.get("2,0")).toBe(1);
  });

  it("候補が無ければ null、到達不能な残りは重み0", () => {
    expect(planStarts({ nodes: [], candidates: [], stoneCost: stoneCostForColor("RED"), startCount: 2 })).toBeNull();
    const nodes = [node(0, 0, "RED"), node(20, 0, "RED")];
    const plan = planStarts({
      nodes,
      candidates: [
        { key: "0,0", value: 10 },
        { key: "20,0", value: 5 },
      ],
      stoneCost: stoneCostForColor("RED"),
      startCount: 1,
    })!;
    expect(plan.starts).toEqual(["0,0"]);
    expect(plan.weights.get("20,0")).toBe(0);
    expect(plan.costs.get("20,0")).toBe(Infinity);
  });
});
