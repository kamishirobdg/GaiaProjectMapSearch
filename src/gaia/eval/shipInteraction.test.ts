// src/gaia/eval/shipInteraction.test.ts
//
// LF 船の中身とスカウトの位置の相互作用・段階 1（2026-10-08、案 (ii) 加重和、α 0.5）。
// 式: 加点_f ＝ Σ_s α × (C_s − C̄) / C̄ × T_{s,f}。重みの値は見直しで動くので、期待値は表から組み立てる。

import { describe, expect, it } from "vitest";
import type { SetupResult } from "@/gaia/setup/types";
import { FACTION_IDS, type FactionId } from "./factionWeights";
import { scoreSetupFactions, setupFactionBreakdown } from "./factionEval";
import { DEFAULT_SETUP_WEIGHTS, SETUP_SCORE_DIVISOR } from "./setupWeights";
import { shipTileCell, tileValueCell } from "./tileWeights";
import {
  SHIP_INTERACTION_ALPHA,
  applyShipInteraction,
  shipContactOf,
  shipInteractionOf,
  shipTileValuesByShip,
} from "./shipInteraction";

function lfSetup(partial?: Partial<SetupResult>): SetupResult {
  return {
    seed: "t",
    playerCount: 4,
    mode: "lostFleet",
    ships: ["twilight", "eclipse", "rebellion", "tfmars"],
    standardTech: {
      byTrack: { terra: "TS1", nav: "TS2", ai: "TS3", gaia: "TS4", eco: "TS5", sci: "TS6" },
      free: ["TS7", "TS8", "TS9"],
    },
    advancedTech: {
      byTrack: { terra: "AT02", nav: "AT03", ai: "AT13", gaia: "AT06", eco: "AT07", sci: "AT09" },
    },
    boosters: { available: ["RB01", "RB02"], unused: [] },
    roundScoring: ["RS07", "RS07", "RS01", "RS02", "RS03", "RS04"],
    finalScoring: ["FS02", "FS06"],
    federationLv5: "FED12",
    planetSatellites: ["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW"],
    goldFederations: { twilight: "FEDG1", eclipse: "FEDG2", rebellion: "FEDG3", tfmars: "FEDG4" },
    shipTech: { eclipse: "TSL1", rebellion: "TSL2", tfmars: "TSL3" },
    artifacts: ["ART01", "ART02"],
    ...partial,
  };
}

/** Map の評価内訳のフェイク: 船ごとの船接触の値だけ scoutHits に入れる */
function breakdownWithContact(contact: Record<string, number[]>) {
  const scoutHits: Array<{ scoutId: string; planetKey: string; value: number }> = [];
  for (const [scoutId, values] of Object.entries(contact)) {
    values.forEach((value, i) => scoutHits.push({ scoutId, planetKey: `${scoutId}:${i}`, value }));
  }
  return { audit: { scout: { scoutHits } } };
}

const scale = DEFAULT_SETUP_WEIGHTS.lfShip / SETUP_SCORE_DIVISOR;

describe("shipContactOf: 船ごとの船接触の合計", () => {
  it("scoutId ごとに value を足す。ヒットが無ければ null、知らない船は無視", () => {
    expect(shipContactOf(breakdownWithContact({ twilight: [10, 9], eclipse: [8], tfmars: [] }))).toEqual({ twilight: 19, eclipse: 8 });
    expect(shipContactOf({ audit: { scout: { scoutHits: [] } } })).toBeNull();
    expect(shipContactOf(null)).toBeNull();
    expect(shipContactOf({ audit: { scout: { scoutHits: [{ scoutId: "", value: 5 }, { scoutId: "unknown", value: 5 }] } } })).toBeNull();
  });
});

describe("shipTileValuesByShip: 船に乗るタイルの種族別の値", () => {
  it("基本技術・金枠同盟はその船、アーティファクトはトワイライト。全船の和は lfShip の列に一致", () => {
    const s = lfSetup();
    const byShip = shipTileValuesByShip(s);
    const lfShip = setupFactionBreakdown(s).byCategory.lfShip;
    for (const f of FACTION_IDS) {
      const sum = (["twilight", "eclipse", "rebellion", "tfmars"] as const).reduce((a, ship) => a + (byShip[ship]?.[f] ?? 0), 0);
      expect(sum).toBeCloseTo(lfShip[f], 9);
    }
    // トワイライト ＝ FEDG1（船の上書き込み）＋ ART01 ＋ ART02
    const f: FactionId = "terrans";
    const expectTwilight =
      ((shipTileCell("FEDG1", "twilight", true)?.[f] ?? 0) + (tileValueCell("ART01", true)?.[f] ?? 0) + (tileValueCell("ART02", true)?.[f] ?? 0)) * scale;
    expect(byShip.twilight?.[f]).toBeCloseTo(expectTwilight, 9);
    // エクリプス ＝ FEDG2 ＋ TSL1（どちらも船の上書き込み）
    const expectEclipse = ((shipTileCell("FEDG2", "eclipse", true)?.[f] ?? 0) + (shipTileCell("TSL1", "eclipse", true)?.[f] ?? 0)) * scale;
    expect(byShip.eclipse?.[f]).toBeCloseTo(expectEclipse, 9);
  });

  it("通常版（船なし）は空", () => {
    const base = lfSetup({ mode: undefined, ships: undefined, goldFederations: undefined, shipTech: undefined, artifacts: undefined });
    expect(shipTileValuesByShip(base)).toEqual({});
  });
});

describe("shipInteractionOf: 加点 Σ_s α × (C_s − C̄) / C̄ × T_{s,f}", () => {
  it("船接触が全船で同じなら加点 0。材料が無ければ null", () => {
    const s = lfSetup();
    const even = shipInteractionOf(s, breakdownWithContact({ twilight: [10], eclipse: [10], rebellion: [10], tfmars: [10] }));
    expect(even).not.toBeNull();
    for (const f of FACTION_IDS) expect(even!.bonus[f]).toBeCloseTo(0, 9);
    expect(even!.ships.map((x) => x.rel)).toEqual([0, 0, 0, 0]);
    expect(shipInteractionOf(s, { audit: { scout: { scoutHits: [] } } })).toBeNull();
    expect(shipInteractionOf(s, breakdownWithContact({ twilight: [10] }), undefined, 0)).toBeNull();
    // 通常版のセットアップには船が無い
    expect(shipInteractionOf(lfSetup({ mode: undefined }), breakdownWithContact({ twilight: [10] }))).toBeNull();
  });

  it("近い船のタイルは重く、遠い船のタイルは軽く。相対値の和は 0 なので全船同じ T なら総和は変わらない", () => {
    const s = lfSetup();
    // 船接触 トワイライト 20 / エクリプス 10 / リベリオン 10 / T.F.マーズ 0 → 平均 10、rel ＝ +1 / 0 / 0 / −1
    const si = shipInteractionOf(s, breakdownWithContact({ twilight: [12, 8], eclipse: [10], rebellion: [10] }))!;
    expect(si.alpha).toBe(SHIP_INTERACTION_ALPHA);
    expect(si.mean).toBe(10);
    expect(si.ships).toEqual([
      { ship: "twilight", contact: 20, rel: 1 },
      { ship: "eclipse", contact: 10, rel: 0 },
      { ship: "rebellion", contact: 10, rel: 0 },
      { ship: "tfmars", contact: 0, rel: -1 },
    ]);
    const byShip = shipTileValuesByShip(s);
    for (const f of FACTION_IDS) {
      const expected = SHIP_INTERACTION_ALPHA * ((byShip.twilight?.[f] ?? 0) - (byShip.tfmars?.[f] ?? 0));
      expect(si.bonus[f]).toBeCloseTo(expected, 9);
    }
    // α 1 なら「船接触の比で再配分」＝トワイライトのタイルが 2 倍、T.F.マーズのタイルが 0
    const full = shipInteractionOf(s, breakdownWithContact({ twilight: [20], eclipse: [10], rebellion: [10] }), undefined, 1)!;
    for (const f of FACTION_IDS) expect(full.bonus[f]).toBeCloseTo((byShip.twilight?.[f] ?? 0) - (byShip.tfmars?.[f] ?? 0), 9);
  });

  it("使う船は result.ships（2人でリベリオン無し）。船接触の無い船は 0 として平均に入る", () => {
    const s = lfSetup({ ships: ["twilight", "eclipse", "tfmars"], goldFederations: { twilight: "FEDG1", eclipse: "FEDG2", tfmars: "FEDG4" }, shipTech: { eclipse: "TSL1", tfmars: "TSL3" } });
    const si = shipInteractionOf(s, breakdownWithContact({ twilight: [30], rebellion: [99] }))!;
    expect(si.ships.map((x) => x.ship)).toEqual(["twilight", "eclipse", "tfmars"]);
    expect(si.mean).toBe(10); // (30 + 0 + 0) / 3。リベリオンの 99 は使わない船なので無視
    expect(si.ships[0].rel).toBe(2);
    expect(si.ships[1].rel).toBe(-1);
  });

  it("applyShipInteraction は Setup の値に加点を足した写し。null なら同じ参照を返す", () => {
    const s = lfSetup();
    const scores = scoreSetupFactions(s);
    expect(applyShipInteraction(scores, null)).toBe(scores);
    const si = shipInteractionOf(s, breakdownWithContact({ twilight: [20], eclipse: [10], rebellion: [10] }))!;
    const adjusted = applyShipInteraction(scores, si);
    expect(adjusted).not.toBe(scores);
    for (const f of FACTION_IDS) expect(adjusted[f]).toBeCloseTo(scores[f] + si.bonus[f], 9);
    // 元は変えない
    expect(scoreSetupFactions(s)).toEqual(scores);
  });
});
