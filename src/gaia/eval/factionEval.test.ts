// src/gaia/eval/factionEval.test.ts
//
// 種族別評価（セットアップ側・マップ側）と推奨基準のテスト。
// 重み値そのものは DRAFT なので、ここでは「合算・基準式・決定論」という
// 機構だけを固定する（重みレビューで数値が変わっても壊れない書き方）。

import { describe, expect, it } from "vitest";
import type { SetupResult } from "@/gaia/setup/types";
import {
  criterionScore,
  recommendSetup,
  scoreSetupFactions,
  topFactions,
  type FactionScores,
} from "./factionEval";
import { FACTION_IDS, TILE_FACTION_WEIGHTS } from "./factionWeights";
import { countMapPlanets, mapFactionScoresFromCounts } from "./mapFaction";
import { makeSearchPlacementFromSeed } from "@/gaia/ssot/searchPlacementConfig";

function syntheticSetup(partial?: Partial<SetupResult>): SetupResult {
  return {
    seed: "t",
    playerCount: 4,
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
    ...partial,
  };
}

describe("scoreSetupFactions", () => {
  it("sums draft weights over drawn tiles (round scoring counts copies)", () => {
    const s = syntheticSetup();
    const scores = scoreSetupFactions(s);
    // firaks: AT02(+2) + AT13(+1) + RS07×2(+2×2) = 7
    expect(scores.firaks).toBe(7);
    // ivits: FS06(+2) = 2
    expect(scores.ivits).toBe(2);
    // 標準技術は対象外: TS7(terrans+2級のガイア系)でも terrans は AT/RS由来のみ
    const terransExpected =
      (TILE_FACTION_WEIGHTS.AT02?.terrans ?? 0) +
      (TILE_FACTION_WEIGHTS.AT03?.terrans ?? 0) +
      (TILE_FACTION_WEIGHTS.AT13?.terrans ?? 0) +
      (TILE_FACTION_WEIGHTS.AT06?.terrans ?? 0) +
      (TILE_FACTION_WEIGHTS.AT07?.terrans ?? 0) +
      (TILE_FACTION_WEIGHTS.AT09?.terrans ?? 0);
    expect(scores.terrans).toBe(terransExpected);
  });

  it("returns a finite score for every faction", () => {
    const scores = scoreSetupFactions(syntheticSetup());
    for (const f of FACTION_IDS) expect(Number.isFinite(scores[f])).toBe(true);
    expect(Object.keys(scores)).toHaveLength(14);
  });
});

describe("criterionScore", () => {
  const flat = Object.fromEntries(FACTION_IDS.map((f) => [f, 1])) as FactionScores;
  const spiky = { ...flat, terrans: 9, gleens: 8, balTaks: 7 } as FactionScores;

  it("opposeMap: prefers setups where the map's top factions are weak", () => {
    const mapTop3 = ["terrans", "gleens", "balTaks"] as const;
    const a = criterionScore("opposeMap", flat, { playerCount: 4, mapTop3: [...mapTop3] });
    const b = criterionScore("opposeMap", spiky, { playerCount: 4, mapTop3: [...mapTop3] });
    expect(a).toBeGreaterThan(b);
  });

  it("neutralBalance: flat scores beat spiky scores", () => {
    const a = criterionScore("neutralBalance", flat, { playerCount: 4 });
    const b = criterionScore("neutralBalance", spiky, { playerCount: 4 });
    expect(a).toBeGreaterThan(b);
  });

  it("topBalance: a tight strong top group beats one runaway faction", () => {
    const tightTop = { ...flat, terrans: 5, gleens: 5, ivits: 5, firaks: 5, geodens: 5, lantids: 5 } as FactionScores;
    const runaway = { ...flat, terrans: 25 } as FactionScores;
    const a = criterionScore("topBalance", tightTop, { playerCount: 4 });
    const b = criterionScore("topBalance", runaway, { playerCount: 4 });
    expect(a).toBeGreaterThan(b);
  });
});

describe("recommendSetup", () => {
  const seeds = Array.from({ length: 30 }, (_, i) => `rec-${i}`);

  it("is deterministic for the same seed list and picks the argmax", () => {
    const a = recommendSetup({ criterion: "neutralBalance", seeds, playerCount: 4, lostFleet: false });
    const b = recommendSetup({ criterion: "neutralBalance", seeds, playerCount: 4, lostFleet: false });
    expect(a).not.toBeNull();
    expect(b?.input).toEqual(a?.input);
    // 全候補を再評価して argmax であることを確認
    for (const seed of seeds) {
      const r = recommendSetup({ criterion: "neutralBalance", seeds: [seed], playerCount: 4, lostFleet: false });
      expect(a!.score).toBeGreaterThanOrEqual(r!.score);
    }
  });

  it("returns null for an empty seed list", () => {
    expect(recommendSetup({ criterion: "neutralBalance", seeds: [], playerCount: 4, lostFleet: false })).toBeNull();
  });
});

describe("mapFaction", () => {
  it("counts planets from a real 3p LF placement", () => {
    const { placement } = makeSearchPlacementFromSeed({ templateId: "3p_lostFleet", seed: "1" }) as any;
    const counts = countMapPlanets("3p_lostFleet", placement);
    const colorTotal = Object.values(counts.byColor).reduce((a, b) => a + b, 0);
    expect(colorTotal).toBeGreaterThan(10);
    expect(counts.gaia).toBeGreaterThan(0);
    expect(counts.transdim).toBeGreaterThan(0);
    for (const k of Object.keys(counts.byColor)) {
      expect(["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW"]).toContain(k);
    }
  });

  it("applies home color counts + gaia/transdim affinity (draft formula)", () => {
    const counts = { byColor: { BLUE: 4, RED: 5 }, gaia: 2, transdim: 4 };
    const scores = mapFactionScoresFromCounts(counts);
    // 2026-07-25 レビュー反映: ガイア惑星依存=グリーンのみ、
    // ガイアフォーマー(横断)依存= テラン(2) > イタル(1.5) > バルタック(1)。
    // terrans: BLUE4 + 0.5*(transdim 2 * 4) = 8（ガイア惑星依存なし）
    expect(scores.terrans).toBe(8);
    // lantids: BLUE4（親和なし）
    expect(scores.lantids).toBe(4);
    // gleens: 0.5*(gaia 2 * 2) = 2（ガイア惑星依存はグリーンのみ）
    expect(scores.gleens).toBe(2);
    // itars: 0.5*(transdim 1.5 * 4) = 3 / balTaks: 0.5*(transdim 1 * 4) = 2
    expect(scores.itars).toBe(3);
    expect(scores.balTaks).toBe(2);
    // hadschHallas/ivits: RED5（親和なし）
    expect(scores.hadschHallas).toBe(5);
    expect(scores.ivits).toBe(5);
    expect(topFactions(scores, 1)[0]).toBe("terrans");
  });
});
