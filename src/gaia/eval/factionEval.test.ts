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
  recommendSetups,
  scoreSetupFactions,
  scoreStandardTech,
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
    // firaks: AT02(+2) + AT13(+1) + RS07×2(+2×2) + RB01(+1) = 8、
    // ＋標準技術: sci列のTS6 → 2*0.5 = 1 ⇒ 計9
    expect(scores.firaks).toBe(9);
    // ivits: FS06(+2) + RB02(+1) = 3、＋標準技術: terra列のTS1 → 1*0.5 ⇒ 計3.5
    expect(scores.ivits).toBe(3.5);
    // タイル由来と標準技術由来の合計になっていること（terrans で確認）
    const terransTiles =
      (TILE_FACTION_WEIGHTS.AT02?.terrans ?? 0) +
      (TILE_FACTION_WEIGHTS.AT03?.terrans ?? 0) +
      (TILE_FACTION_WEIGHTS.AT13?.terrans ?? 0) +
      (TILE_FACTION_WEIGHTS.AT06?.terrans ?? 0) +
      (TILE_FACTION_WEIGHTS.AT07?.terrans ?? 0) +
      (TILE_FACTION_WEIGHTS.AT09?.terrans ?? 0);
    expect(scores.terrans).toBe(terransTiles + scoreStandardTech(s).terrans);
  });

  it("standard tech: 同じ9枚でもトラック配置が変われば評価が変わる", () => {
    // TS7（ガイア惑星に鉱山＋3VP）が ガイア(terrans aff2) の下にある場合と、
    // terrans が登らない eco の下にある場合で terrans のスコアが変わる。
    const onGaia = syntheticSetup({
      standardTech: {
        byTrack: { terra: "TS1", nav: "TS2", ai: "TS3", gaia: "TS7", eco: "TS5", sci: "TS6" },
        free: ["TS4", "TS8", "TS9"],
      },
    });
    const onEco = syntheticSetup({
      standardTech: {
        byTrack: { terra: "TS1", nav: "TS2", ai: "TS3", gaia: "TS5", eco: "TS7", sci: "TS6" },
        free: ["TS4", "TS8", "TS9"],
      },
    });
    // terrans: gaia aff2 × TS7 pref2 × 0.5 = 2 / eco は aff0 なので 0
    expect(scoreStandardTech(onGaia).terrans).toBeGreaterThan(scoreStandardTech(onEco).terrans);
    expect(scoreStandardTech(onGaia).terrans).toBe(2);
    expect(scoreStandardTech(onEco).terrans).toBe(0);
  });

  it("standard tech: 自由列はトラック非依存に低係数で効く", () => {
    // hadschHallas は TS8（クレ4収入、pref2）を自由列に持つと 2*0.25 = 0.5。
    const s = syntheticSetup({
      standardTech: {
        byTrack: { terra: "TS1", nav: "TS2", ai: "TS3", gaia: "TS4", eco: "TS5", sci: "TS6" },
        free: ["TS7", "TS8", "TS9"],
      },
    });
    expect(scoreStandardTech(s).hadschHallas).toBe(0.5);
  });

  it("returns a finite score for every faction", () => {
    const scores = scoreSetupFactions(syntheticSetup());
    for (const f of FACTION_IDS) expect(Number.isFinite(scores[f])).toBe(true);
    expect(Object.keys(scores)).toHaveLength(18); // 基本14 + LF4
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

  it("alignMap: opposeMap と逆に、マップ上位K種族が強いセットアップを好む", () => {
    const mapTopK = ["terrans", "gleens", "balTaks", "ivits", "firaks"] as const;
    const opts = { playerCount: 3, mapTopK: [...mapTopK] };
    // spiky は上位K のうち3種族が高い → align では高評価、oppose では低評価
    const a = criterionScore("alignMap", spiky, opts);
    const b = criterionScore("alignMap", flat, opts);
    expect(a).toBeGreaterThan(b);
    // 同じ入力で opposeMap とは逆向きになること（順張り/逆張りの関係）
    const oppA = criterionScore("opposeMap", spiky, { playerCount: 3, mapTop3: [...mapTopK].slice(0, 3) });
    const oppB = criterionScore("opposeMap", flat, { playerCount: 3, mapTop3: [...mapTopK].slice(0, 3) });
    expect(oppA).toBeLessThan(oppB);
  });

  it("alignMap: K種族が均等に強い方が、1種族だけ突出より良い", () => {
    const mapTopK = ["terrans", "gleens", "balTaks"] as const;
    const opts = { playerCount: 1, mapTopK: [...mapTopK] };
    const even = { ...flat, terrans: 6, gleens: 6, balTaks: 6 } as FactionScores;
    const spike = { ...flat, terrans: 16, gleens: 1, balTaks: 1 } as FactionScores;
    expect(criterionScore("alignMap", even, opts)).toBeGreaterThan(criterionScore("alignMap", spike, opts));
  });

  it("alignMap: マップ上位が無ければ 0（マップ未選択でも壊れない）", () => {
    expect(criterionScore("alignMap", flat, { playerCount: 4 })).toBe(0);
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

  it("recommendSetups returns topN in descending score, and recommendSetup is its head", () => {
    const top = recommendSetups({
      criterion: "neutralBalance",
      seeds,
      playerCount: 4,
      lostFleet: false,
      topN: 5,
    });
    expect(top).toHaveLength(5);
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1].score).toBeGreaterThanOrEqual(top[i].score);
    }
    // 候補は互いに異なるセットアップ（同一シードの重複が無い）
    expect(new Set(top.map((r) => r.input.seed)).size).toBe(5);
    const single = recommendSetup({ criterion: "neutralBalance", seeds, playerCount: 4, lostFleet: false });
    expect(single?.input).toEqual(top[0].input);
  });

  it("recommendSetups clamps topN to the seed count and handles topN<=0", () => {
    const few = recommendSetups({ criterion: "neutralBalance", seeds: seeds.slice(0, 2), playerCount: 4, lostFleet: false, topN: 5 });
    expect(few).toHaveLength(2);
    expect(recommendSetups({ criterion: "neutralBalance", seeds, playerCount: 4, lostFleet: false, topN: 0 })).toEqual([]);
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
      // LF4種族の母星（PROTO/ASTEROID）も母星色として数える（2026-07-30）
      expect(["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW", "PROTO", "ASTEROID"]).toContain(k);
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
