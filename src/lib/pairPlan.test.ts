import { describe, expect, it } from "vitest";
import { planPair, totalScoresOf, usesTotalBasis, type PairPlanInput } from "./pairPlan";
import { criterionScore, scoreSetupFactions, LIST_FACTION_PREF_W } from "@/gaia/eval/factionEval";
import { factionIdsForMode } from "@/gaia/eval/factionWeights";
import { FACTION_IDS } from "@/gaia/eval/factionWeights";
import { buildSetupFromSeed } from "@/gaia/setup/buildSetup";
import type { PersistedCandidate } from "@/app/board/persistence";
import type { SavedSetup } from "@/lib/setupHistory";
import { DEFAULT_SETUP_WEIGHTS } from "@/gaia/eval/setupWeights";

/** 評価内訳の最小形（mapValueByFaction が読む byFaction.total だけ）。船接触の記録は無いので船の相互作用は効かない */
function mapWith(id: string, totals: Partial<Record<string, number>>): PersistedCandidate {
  const byFaction: Record<string, { total: number }> = {};
  for (const f of FACTION_IDS) byFaction[f] = { total: totals[f] ?? 100 };
  return {
    id,
    searchKey: "k",
    placementHash: `h_${id}`,
    seed: "1",
    score: 1,
    rankValue: -1,
    placement: [],
    evaluation: { breakdown: { audit: { startAccess: { byFaction } } } },
    used: false,
    usedKey: 0,
    createdAt: 0,
    updatedAt: 0,
  };
}
function mapWithout(id: string): PersistedCandidate {
  return { ...mapWith(id, {}), evaluation: null };
}
function savedSetup(seed: string): SavedSetup {
  const input = { seed, playerCount: 4, mode: "lostFleet" as const };
  return { id: `s_${seed}`, conditionKey: "c", seed, input, algoVersion: "setup_v2", pinned: false, used: false, createdAt: 0, updatedAt: 0 };
}
const TMAP = { k: "4p_lostFleet" };
const base: Omit<PairPlanInput, "pairDir" | "setupSource" | "criterion" | "pairMapId" | "pairSetupId" | "selectableMaps" | "selectableSetups"> = {
  templateIdBySearchKey: TMAP,
  evalWeights: DEFAULT_SETUP_WEIGHTS,
  factionPref: {},
};

describe("pairPlan（段階 2: 基準 2・3 は合計 T_f で測る）", () => {
  it("usesTotalBasis は上位バランス・全体バランスだけ", () => {
    expect(usesTotalBasis("topBalance")).toBe(true);
    expect(usesTotalBasis("neutralBalance")).toBe(true);
    expect(usesTotalBasis("opposeMap")).toBe(false);
    expect(usesTotalBasis("alignMap")).toBe(false);
  });

  it("セットアップ → マップ: 全体バランスの値は T_f ＝ Map_f ＋ Setup_f の散らばりで、マップごとに違う", () => {
    const flat = mapWith("flat", {});
    const skew = mapWith("skew", { terrans: 180, lantids: 20 });
    const src = savedSetup("11");
    const plan = planPair({ ...base, pairDir: "setupToMap", setupSource: "saved", criterion: "neutralBalance", pairMapId: "", pairSetupId: src.id, selectableMaps: [flat, skew], selectableSetups: [src] });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.note).toBeNull();
    const setupScores = scoreSetupFactions(buildSetupFromSeed(src.input), DEFAULT_SETUP_WEIGHTS);
    const expectFor = (m: PersistedCandidate) => criterionScore("neutralBalance", totalScoresOf(setupScores, m.evaluation.breakdown), { playerCount: 4, lostFleet: true });
    const byId = new Map(plan.options.map((o) => [o.mapId, o.rec.score]));
    expect(byId.get("flat")).toBeCloseTo(expectFor(flat), 9);
    expect(byId.get("skew")).toBeCloseTo(expectFor(skew), 9);
    // 偏ったマップは散らばりが大きいので下位
    expect(plan.options[0].mapId).toBe("flat");
  });

  it("マップ → セットアップ（保存済み）: 種族優遇は T_f に w × 優遇 で掛かる", () => {
    const m = mapWith("m", { xenos: 150 });
    const s1 = savedSetup("21");
    const s2 = savedSetup("22");
    const run = (factionPref: Record<string, number>) =>
      planPair({ ...base, factionPref, pairDir: "mapToSetup", setupSource: "saved", criterion: "topBalance", pairMapId: "m", pairSetupId: "", selectableMaps: [m], selectableSetups: [s1, s2] });
    const p0 = run({});
    const p1 = run({ xenos: 2 });
    expect(p0.ok && p1.ok).toBe(true);
    if (!p0.ok || !p1.ok) return;
    const find = (p: typeof p0, seed: string) => p.options.find((o) => String(o.rec.input.seed) === seed)!;
    for (const s of [s1, s2]) {
      const setupScores = scoreSetupFactions(buildSetupFromSeed(s.input), DEFAULT_SETUP_WEIGHTS);
      const total = totalScoresOf(setupScores, m.evaluation.breakdown);
      expect(find(p0, s.seed).rec.score).toBeCloseTo(criterionScore("topBalance", total, { playerCount: 4, lostFleet: true }), 9);
      // 2026-10-22 から「上位 K（人数＋2）に届かない分だけ減点」
      const others = factionIdsForMode(true).filter((f) => f !== "xenos").map((f) => total[f]).sort((a, b) => b - a);
      expect(find(p1, s.seed).rec.score - find(p0, s.seed).rec.score).toBeCloseTo(LIST_FACTION_PREF_W * 2 * Math.min(0, total.xenos - others[5]), 9);
    }
  });

  it("内訳を持たない古いマップでは従来どおり Setup の値で測り、マップ非依存の注記が付く", () => {
    const m = mapWithout("old");
    const s1 = savedSetup("31");
    const plan = planPair({ ...base, pairDir: "mapToSetup", setupSource: "saved", criterion: "neutralBalance", pairMapId: "old", pairSetupId: "", selectableMaps: [m], selectableSetups: [s1] });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.note).toBe("mapIndependent");
    const setupScores = scoreSetupFactions(buildSetupFromSeed(s1.input), DEFAULT_SETUP_WEIGHTS);
    expect(plan.options[0].rec.score).toBeCloseTo(criterionScore("neutralBalance", setupScores, { playerCount: 4, lostFleet: true }), 9);
  });

  it("ランダム生成でも基準 2 は T_f で測る（seeds を固定して保存済みと同じ値になる）", () => {
    const m = mapWith("m", { ivits: 160 });
    const s1 = savedSetup("41");
    const saved = planPair({ ...base, pairDir: "mapToSetup", setupSource: "saved", criterion: "topBalance", pairMapId: "m", pairSetupId: "", selectableMaps: [m], selectableSetups: [s1] });
    const random = planPair({ ...base, pairDir: "mapToSetup", setupSource: "random", criterion: "topBalance", pairMapId: "m", pairSetupId: "", selectableMaps: [m], selectableSetups: [], seeds: ["41"] });
    expect(saved.ok && random.ok).toBe(true);
    if (!saved.ok || !random.ok) return;
    expect(random.options[0].rec.score).toBeCloseTo(saved.options[0].rec.score, 9);
    // 表示用の Setup の値は T_f ではなく Setup の値のまま
    const setupScores = scoreSetupFactions(buildSetupFromSeed(s1.input), DEFAULT_SETUP_WEIGHTS);
    expect(random.options[0].rec.setupScores.ivits).toBeCloseTo(setupScores.ivits, 9);
  });
});
