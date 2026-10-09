// src/gaia/eval/shipInteraction.test.ts
//
// LF 船の中身とスカウトの位置の相互作用・段階 1（2026-10-08、案 (ii) 加重和 α 0.5 → 同日 掛け算＝α 1 →
// 2026-10-09 案 (ii-f) 種族ごとの船接触）。
// 式: 加点_f ＝ Σ_s α × rel_{s,f} × T_{s,f}。rel は種族ごとの船接触 C_{s,f} の相対値（byFaction が無ければ共通の C_s）。
// 重みの値は見直しで動くので、期待値は表から組み立てる。

import { describe, expect, it } from "vitest";
import type { SetupResult } from "@/gaia/setup/types";
import { FACTION_IDS, type FactionId } from "./factionWeights";
import { scoreSetupFactions, setupFactionBreakdown } from "./factionEval";
import { DEFAULT_SETUP_WEIGHTS, SETUP_SCORE_DIVISOR } from "./setupWeights";
import { shipTileCell, tileValueCell } from "./tileWeights";
import {
  SHIP_INTERACTION_ALPHA,
  applyShipInteraction,
  factionReachOf,
  shipContactByFaction,
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

/**
 * eval_v7 の byFaction を足したフェイク: reach[f] は planetKey → 到達係数（weight）。
 * ヒットの planetKey は breakdownWithContact と同じ `${scoutId}:${i}`。
 */
function breakdownWithFactionReach(contact: Record<string, number[]>, reach: Partial<Record<FactionId, Record<string, number>>>) {
  const bd = breakdownWithContact(contact);
  const byFaction: Record<string, { planets: Array<{ cellKey: string; weight: number }> }> = {};
  for (const [f, m] of Object.entries(reach)) byFaction[f] = { planets: Object.entries(m!).map(([cellKey, weight]) => ({ cellKey, weight })) };
  return { audit: { ...bd.audit, startAccess: { byFaction } } };
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

describe("factionReachOf / shipContactByFaction: 種族ごとの到達係数と船接触（案 (ii-f)）", () => {
  it("byFaction[f].planets の weight を 1 で頭打ちにして cellKey で引く。無ければ null", () => {
    const bd = breakdownWithFactionReach({ twilight: [10, 8], eclipse: [6] }, { ivits: { "twilight:0": 1.5, "twilight:1": 0.5, "eclipse:0": 0 }, terrans: { "eclipse:0": 0.25 } });
    const reach = factionReachOf(bd)!;
    expect(reach.ivits!.get("twilight:0")).toBe(1); // 開始地点の値の倍率 1.5 は到達係数ではない
    expect(reach.ivits!.get("twilight:1")).toBe(0.5);
    expect(reach.ivits!.has("eclipse:0")).toBe(false); // 到達不能（重み 0）は入れない
    expect(reach.terrans!.get("eclipse:0")).toBe(0.25);
    expect(reach.xenos).toBeUndefined();
    expect(factionReachOf(breakdownWithContact({ twilight: [10] }))).toBeNull();
    expect(factionReachOf(null)).toBeNull();
    // C_{s,f} ＝ Σ w_f × value
    const c = shipContactByFaction(bd, reach)!;
    expect(c.ivits).toEqual({ twilight: 1 * 10 + 0.5 * 8 }); // エクリプスには届かない → キー無し（0 扱い）
    expect(c.terrans).toEqual({ eclipse: 0.25 * 6 });
    expect(c.xenos).toBeUndefined();
  });
});

describe("shipInteractionOf（種族ごとの船接触、案 (ii-f)）", () => {
  it("byFaction がある盤面は mode faction。種族ごとの相対値で加点し、届かない船のタイルは α 1 で 0 になる", () => {
    const s = lfSetup();
    // 共通の船接触は全船 10（共通の相対値は 0）。地球人だけ到達係数が船で違う:
    // トワイライト 1 / エクリプス 0.5 / リベリオン 0 / T.F.マーズ 0 → C ＝ 10 / 5 / 0 / 0、平均 3.75
    const bd = breakdownWithFactionReach(
      { twilight: [10], eclipse: [10], rebellion: [10], tfmars: [10] },
      { terrans: { "twilight:0": 1, "eclipse:0": 0.5 } }
    );
    const si = shipInteractionOf(s, bd, undefined, 1)!;
    expect(si.mode).toBe("faction");
    expect(si.ships.map((x) => x.rel)).toEqual([0, 0, 0, 0]);
    const t = si.byFaction!.terrans!;
    expect(t.contact).toEqual({ twilight: 10, eclipse: 5, rebellion: 0, tfmars: 0 });
    expect(t.mean).toBeCloseTo(3.75, 9);
    expect(t.rel.twilight).toBeCloseTo((10 - 3.75) / 3.75, 9);
    expect(t.rel.rebellion).toBe(-1);
    const byShip = shipTileValuesByShip(s);
    const expected =
      ((10 - 3.75) / 3.75) * (byShip.twilight?.terrans ?? 0) +
      ((5 - 3.75) / 3.75) * (byShip.eclipse?.terrans ?? 0) -
      (byShip.rebellion?.terrans ?? 0) -
      (byShip.tfmars?.terrans ?? 0);
    expect(si.bonus.terrans).toBeCloseTo(expected, 9);
    // byFaction に無い種族は共通の相対値（ここでは 0）に後退 → 加点 0
    expect(si.byFaction!.xenos).toBeUndefined();
    expect(si.bonus.xenos).toBeCloseTo(0, 9);
  });

  it("どの船にも届かない種族（C̄_f ＝ 0）は共通の相対値に後退する", () => {
    const s = lfSetup();
    const bd = breakdownWithFactionReach({ twilight: [20], eclipse: [10], rebellion: [10] }, { terrans: {}, lantids: { "twilight:0": 1 } });
    const si = shipInteractionOf(s, bd, undefined, 1)!;
    expect(si.mode).toBe("faction");
    expect(si.byFaction!.terrans!.mean).toBe(0);
    expect(si.byFaction!.terrans!.rel).toEqual({ twilight: 1, eclipse: 0, rebellion: 0, tfmars: -1 });
    const byShip = shipTileValuesByShip(s);
    expect(si.bonus.terrans).toBeCloseTo((byShip.twilight?.terrans ?? 0) - (byShip.tfmars?.terrans ?? 0), 9);
    // ランティダ人はトワイライトだけ → 相対値 +3 / −1 / −1 / −1
    expect(si.byFaction!.lantids!.rel).toEqual({ twilight: 3, eclipse: -1, rebellion: -1, tfmars: -1 });
  });

  it("byFaction を持たない古い候補は mode pooled（段階 1 と同じ）", () => {
    const si = shipInteractionOf(lfSetup(), breakdownWithContact({ twilight: [20], eclipse: [10], rebellion: [10] }))!;
    expect(si.mode).toBe("pooled");
    expect(si.byFaction).toBeUndefined();
  });
});

describe("shipInteractionOf: 加点 Σ_s α × (C_s − C̄) / C̄ × T_{s,f}（共通の船接触＝段階 1 の尺度）", () => {
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
