// src/gaia/board/placementFromSeed.scoutLegal.test.ts
//
// スカウト配置の合法集合（SCOUT_SLOT_CANDIDATES_3P/4P）が、実テンプレの
// SMALLスロット幾何から規則生成した「全ペア距離 >= SCOUT_MIN_DISTANCE」の
// 完全な列挙と一致することを保証する。テンプレ座標が変わればここで検出できる。
//
// ルール（LFルールブック「準備」）: 宇宙船タイルから3スペース以内に他の宇宙船が
// あってはいけない = スカウト同士を隣接ホール（axial距離3）に置かない = 距離5以上。

import { describe, it, expect } from "vitest";
import {
  legalScoutSlotSets,
  SCOUT_MIN_DISTANCE,
  __test__scoutCandidates3p,
  __test__scoutCandidates4p,
} from "./placementFromSeed";
import { TEMPLATE_3P_LOSTFLEET } from "../data/templates/3p_lostFleet";
import { TEMPLATE_4P_LOSTFLEET } from "../data/templates/4p_lostFleet";
import type { SlotDef } from "./types";

function axDist(a: { q: number; r: number }, b: { q: number; r: number }) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -(dq + dr);
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

function smallPos(tpl: { slots: SlotDef[] }): Record<string, { q: number; r: number }> {
  const out: Record<string, { q: number; r: number }> = {};
  for (const s of tpl.slots) {
    const a = Array.isArray(s.accepts) ? s.accepts[0] : (s.accepts as any);
    if (a !== "LARGE" && a !== "MIDDLE") out[s.slotId] = s.pos;
  }
  return out;
}

describe("scout slot legality", () => {
  it("3p: hardcoded candidates == rule-derived legal sets (byte-identical order)", () => {
    const gen = legalScoutSlotSets(TEMPLATE_3P_LOSTFLEET.slots, 4);
    expect(gen).toEqual(__test__scoutCandidates3p);
    expect(gen.length).toBe(5);
  });

  it("4p: hardcoded candidates == rule-derived legal sets (complete 21)", () => {
    const gen = legalScoutSlotSets(TEMPLATE_4P_LOSTFLEET.slots, 4);
    expect(gen).toEqual(__test__scoutCandidates4p);
    expect(gen.length).toBe(21);
  });

  it("every candidate set keeps all scout pairs at distance >= 5 (no adjacent holes)", () => {
    for (const [tpl, sets] of [
      [TEMPLATE_3P_LOSTFLEET, __test__scoutCandidates3p] as const,
      [TEMPLATE_4P_LOSTFLEET, __test__scoutCandidates4p] as const,
    ]) {
      const pos = smallPos(tpl);
      for (const set of sets) {
        expect(set.length).toBe(4);
        for (const a of set) {
          for (const b of set) {
            if (a < b) expect(axDist(pos[a], pos[b])).toBeGreaterThanOrEqual(SCOUT_MIN_DISTANCE);
          }
        }
      }
    }
  });

  it("4p is a strict superset of the previous 14-set list (the 7 recovered arrangements)", () => {
    const OLD_14 = [
      ["S1", "S2", "S5", "S7"], ["S1", "S2", "S5", "S8"], ["S1", "S2", "S5", "S9"],
      ["S1", "S5", "S7", "S9"], ["S1", "S5", "S7", "S10"], ["S1", "S6", "S8", "S10"],
      ["S2", "S3", "S6", "S8"], ["S2", "S3", "S6", "S9"], ["S2", "S5", "S7", "S9"],
      ["S3", "S4", "S6", "S8"], ["S3", "S4", "S6", "S9"], ["S3", "S4", "S6", "S10"],
      ["S3", "S6", "S8", "S10"], ["S4", "S5", "S8", "S10"],
    ];
    const cur = new Set(__test__scoutCandidates4p.map((s) => [...s].sort().join(",")));
    for (const s of OLD_14) expect(cur.has([...s].sort().join(","))).toBe(true);
    expect(cur.size).toBe(21);
  });
});
