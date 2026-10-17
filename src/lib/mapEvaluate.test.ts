import { describe, expect, it } from "vitest";
import { evaluationOfCandidate, evaluationOfPlacement, evaluatePlacement, type MapEvalCache } from "./mapEvaluate";
import { EVAL_VERSION, type PersistedCandidate, type PersistedProfile } from "@/app/board/persistence";
import { makeSearchPlacementFromSeed } from "@/gaia/ssot/searchPlacementConfig";
import { computePlacementHash } from "@/gaia/ssot/placementHash";
import { mapValueByFaction } from "@/gaia/eval/mapFaction";

const TID = "4p_lostFleet";
const { placement } = makeSearchPlacementFromSeed({ templateId: TID, seed: "7" });
const hash = computePlacementHash(placement);

function candidate(storedBreakdown: unknown): PersistedCandidate {
  return { id: `k:${hash}`, searchKey: "k", placementHash: hash, seed: "7", score: 12.5, rankValue: -12.5, placement, evaluation: { breakdown: storedBreakdown }, used: false, usedKey: 0, createdAt: 0, updatedAt: 0 };
}
function profile(evalVersion: string, soft?: unknown): PersistedProfile {
  return { searchKey: "k", evalVersion, templateId: TID, params: { templateId: TID, hard: {}, soft: soft ?? {} }, activeCount: 1, usedCount: 0, createdAt: 0, updatedAt: 0 };
}

describe("mapEvaluate（保存済み候補をいまの評価で評価し直す）", () => {
  it("evalVersion がいまと同じなら保存された評価をそのまま返す", () => {
    const c = candidate({ audit: { startAccess: { byFaction: { terrans: { total: 1 } } } } });
    const ev = evaluationOfCandidate(c, profile(EVAL_VERSION), TID, new Map());
    expect(ev.reevaluated).toBe(false);
    expect(ev.score).toBe(12.5);
    expect(ev.breakdown).toBe(c.evaluation.breakdown);
  });

  it("evalVersion が違えば、その条件で評価し直す（種族ごとの値が付く）。同じ盤面はキャッシュから", () => {
    const cache: MapEvalCache = new Map();
    const c = candidate({ byColor: { red: 1 } });
    const ev = evaluationOfCandidate(c, profile("eval_v8"), TID, cache);
    expect(ev.reevaluated).toBe(true);
    const direct = evaluatePlacement(TID, placement)!;
    expect(ev.score).toBeCloseTo(direct.score, 9);
    const mv = mapValueByFaction(ev.breakdown);
    expect(mv.terrans).toBeGreaterThan(0);
    // 同じ色の 2 種族でも値が違う（eval_v5 以降は種族ごと）
    expect(mv.terrans).not.toBeCloseTo(mv.lantids, 6);
    expect(cache.size).toBe(1);
    expect(evaluationOfCandidate(c, profile("eval_v8"), TID, cache)).toBe(ev);
  });

  it("プロファイルの soft（端の罰点）が評価し直しに効く", () => {
    const a = evaluationOfCandidate(candidate(null), profile("eval_v8", { wRimGap: 0.5 }), TID, new Map());
    const b = evaluationOfCandidate(candidate(null), profile("eval_v8", { wRimGap: 0 }), TID, new Map());
    expect(a.reevaluated && b.reevaluated).toBe(true);
    expect(a.score).not.toBeCloseTo(b.score, 6);
  });

  it("配置だけの行（順位表・保存した組）も同じ関数で評価できる。壊れた入力は null", () => {
    const ev = evaluationOfPlacement(TID, placement, hash, undefined, new Map());
    expect(ev?.reevaluated).toBe(true);
    expect(mapValueByFaction(ev?.breakdown).terrans).toBeGreaterThan(0);
    expect(evaluationOfPlacement("", placement, hash, undefined, new Map())).toBeNull();
  });
});
