// src/gaia/eval/factionWeights.test.ts
//
// 勢力ボードの初期研究レベル（FACTION_START_RESEARCH）の固定。2026-09-19 に
// ユーザーが実物のボードで確認した値なので、うっかり書き換えたら落ちるようにする。

import { describe, it, expect } from "vitest";
import { FACTION_IDS, FACTION_START_RESEARCH, LF_FACTION_IDS } from "./factionWeights";
import { RESEARCH_TRACK_IDS } from "@/gaia/setup/types";

describe("FACTION_START_RESEARCH（勢力ボードの初期研究レベル）", () => {
  it("18種族すべてに項目があり、列は研究トラックの id だけ", () => {
    for (const id of FACTION_IDS) {
      const row = FACTION_START_RESEARCH[id];
      expect(row, id).toBeDefined();
      for (const [track, lv] of Object.entries(row)) {
        expect(RESEARCH_TRACK_IDS as readonly string[], `${id}.${track}`).toContain(track);
        expect(Number.isInteger(lv) && (lv as number) >= 1, `${id}.${track}=${lv}`).toBe(true);
      }
    }
  });

  it("2026-09-19 にボードで確認した値そのもの", () => {
    const flat = Object.entries(FACTION_START_RESEARCH)
      .flatMap(([id, row]) => Object.entries(row).map(([track, lv]) => `${id}:${track}=${lv}`))
      .sort();
    expect(flat).toEqual(
      [
        "terrans:gaia=1",
        "balTaks:gaia=1",
        "geodens:terra=1",
        "gleens:nav=1",
        "ambas:nav=1",
        "hadschHallas:eco=1",
        "nevlas:sci=1",
        "xenos:ai=1",
        // Lost Fleet
        "darkanians:nav=1",
        "darkanians:eco=1",
        "tinkerroids:sci=1",
        "moweyds:gaia=1",
        "spaceGiants:nav=1",
      ].sort()
    );
    // 初期レベルなし: lantids / taklons / ivits / bescods / itars / firaks
    for (const id of ["lantids", "taklons", "ivits", "bescods", "itars", "firaks"] as const) {
      expect(Object.keys(FACTION_START_RESEARCH[id])).toEqual([]);
    }
    // 拡張4種族は全部どこかの列が Lv1
    for (const id of LF_FACTION_IDS) {
      expect(Object.keys(FACTION_START_RESEARCH[id]).length, id).toBeGreaterThan(0);
    }
  });
});
