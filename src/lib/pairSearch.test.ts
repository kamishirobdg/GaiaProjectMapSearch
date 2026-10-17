import { describe, expect, it } from "vitest";
import { scorePairs } from "./pairSearch";
import { totalScoresOf } from "./pairPlan";
import { criterionScore, scoreSetupFactions } from "@/gaia/eval/factionEval";
import { FACTION_IDS } from "@/gaia/eval/factionWeights";
import { DEFAULT_SETUP_WEIGHTS } from "@/gaia/eval/setupWeights";
import { buildSetupFromSeed } from "@/gaia/setup/buildSetup";
import type { PersistedCandidate } from "@/app/board/persistence";

function mapWith(id: string, totals: Partial<Record<string, number>>, score: number): PersistedCandidate {
  const byFaction: Record<string, { total: number }> = {};
  for (const f of FACTION_IDS) byFaction[f] = { total: totals[f] ?? 100 };
  return { id, searchKey: "k", placementHash: `h_${id}`, seed: "1", score, rankValue: -score, placement: [], evaluation: { breakdown: { audit: { startAccess: { byFaction } } } }, used: false, usedKey: 0, createdAt: 0, updatedAt: 0 };
}
const TMAP = { k: "4p_lostFleet" };
const setup = (seed: string) => ({ seed, input: { seed, playerCount: 4, mode: "lostFleet" as const } });

describe("pairSearch（両方を探索: 上位 K × L の総当たり）", () => {
  it("K × L の全組を合計 T_f の基準で採点し、上位 topN を降順で返す", () => {
    const maps = [mapWith("a", {}, 3), mapWith("b", { terrans: 200, lantids: 10 }, 2), mapWith("c", { xenos: 150 }, 1)];
    const setups = [setup("11"), setup("12"), setup("13")];
    const res = scorePairs({ maps, setups, templateIdBySearchKey: TMAP, criterion: "neutralBalance", players: 4, lf: true, evalWeights: DEFAULT_SETUP_WEIGHTS, factionPref: {}, k: 2, l: 3, topN: 4 });
    expect(res).toHaveLength(4);
    expect(res.every((o) => o.mapId === "a" || o.mapId === "b")).toBe(true);
    for (let i = 1; i < res.length; i++) expect(res[i - 1].rec.score).toBeGreaterThanOrEqual(res[i].rec.score);
    const top = res[0];
    const m = maps.find((x) => x.id === top.mapId)!;
    const ss = scoreSetupFactions(buildSetupFromSeed(top.rec.input), DEFAULT_SETUP_WEIGHTS);
    expect(top.rec.score).toBeCloseTo(criterionScore("neutralBalance", totalScoresOf(ss, m.evaluation.breakdown), { playerCount: 4, lostFleet: true }), 9);
    // 偏ったマップ b は上位に来ない（合計の散らばりが大きい）
    expect(top.mapId).toBe("a");
    expect(top.rec.trials).toBe(6);
  });

  it("K・L は上限 50 に丸め、maps / setups が足りなければあるぶんだけ", () => {
    const res = scorePairs({ maps: [mapWith("a", {}, 1)], setups: [setup("21")], templateIdBySearchKey: TMAP, criterion: "topBalance", players: 4, lf: true, evalWeights: DEFAULT_SETUP_WEIGHTS, factionPref: {}, k: 999, l: 999 });
    expect(res).toHaveLength(1);
    expect(res[0].key).toBe("b:a:21");
  });
});
