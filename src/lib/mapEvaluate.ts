// src/lib/mapEvaluate.ts
//
// 保存済みのマップ候補を **いまの評価コード** で評価し直す（2026-10-17。ユーザー報告「Pair の値と Map で開いた値が一致しない」）。
//
// Map の結果バケツに貯まった候補は、検索した時点の評価（evaluation.breakdown）を持っている。評価バージョンが上がる
// （eval_v9 など）と Map タブは盤面を開いたときに新しいコードで評価し直すが、Pair は保存された古い内訳をそのまま読んでいた
// （eval_v4 以前の内訳には種族ごとの値が無く、色の値で代用される）。ここでは候補の条件プロファイルの evalVersion が
// いまと違うときに、その候補の条件（hard / soft）で評価し直す。評価は 1 盤面 0.5ms 前後なので候補 200 件でも 0.1 秒。

import { buildLogicalMapFromPlacement } from "@/gaia/logicalMap/buildLogicalMap";
import { extractForEval } from "@/gaia/eval/extractForEval";
import { evaluateSoft } from "@/gaia/eval/evaluateSoft";
import { EVAL_VERSION, type PersistedCandidate, type PersistedProfile } from "@/app/board/persistence";

/** 条件プロファイルを持たない候補（古い保存）の評価に使う既定（/board の DEFAULT_CONDITIONS と同じ値） */
export const DEFAULT_MAP_HARD = { minSameColorDist: 3, outerSameColorMax: 1, centerMode: "NONE" } as const;
export const DEFAULT_MAP_SOFT = {
  wRimGap: 0.5,
  wScout: 10,
  wScoutCore: 4,
  scoutRadius: 3,
  wScoutByScoutKey: { twilight: 10, eclipse: 10, rebellion: 10, tfmars: 10 },
  wScoutCoreByScoutKey: { twilight: 3, eclipse: 3, rebellion: 3, tfmars: 3 },
  scoutCoreAttributionMode: "all",
  wImbalance: 100,
  imbalanceMetric: "std",
  wFactionPref: 25,
} as const;

export type MapEvaluation = { score: number; breakdown: any; reevaluated: boolean }; // eslint-disable-line @typescript-eslint/no-explicit-any
export type MapEvalCache = Map<string, MapEvaluation | null>;

/** 盤面をいまのコードで評価する（失敗したら null） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function evaluatePlacement(templateId: string, placement: any[], hard?: any, soft?: any): MapEvaluation | null {
  try {
    const lm = buildLogicalMapFromPlacement({ templateId, placement });
    const extracted = extractForEval(lm as any, { ...DEFAULT_MAP_HARD, ...(hard ?? {}) } as any);
    const r = evaluateSoft(extracted, { ...DEFAULT_MAP_SOFT, ...(soft ?? {}) } as any);
    return { score: r.score, breakdown: r.breakdown, reevaluated: true };
  } catch {
    return null;
  }
}

/**
 * 候補の評価（score と breakdown）。条件プロファイルの evalVersion がいまと同じなら保存された評価をそのまま、
 * 違う（または無い）ならその条件で評価し直す。評価し直せないときは保存された評価にフォールバック。
 */
export function evaluationOfCandidate(c: PersistedCandidate, profile: PersistedProfile | undefined, templateId: string, cache: MapEvalCache): MapEvaluation {
  const stored: MapEvaluation = { score: Number(c.score ?? 0), breakdown: c.evaluation?.breakdown ?? null, reevaluated: false };
  if (profile?.evalVersion === EVAL_VERSION && stored.breakdown) return stored;
  const key = `${templateId}|${String(c.placementHash ?? c.id)}`;
  if (cache.has(key)) return cache.get(key) ?? stored;
  const params = (profile?.params ?? null) as { hard?: unknown; soft?: unknown } | null;
  const ev = templateId ? evaluatePlacement(templateId, c.placement ?? [], params?.hard, params?.soft) : null;
  cache.set(key, ev);
  return ev ?? stored;
}

/** 配置だけを持つ行（保存した組・連続探索の順位表）の評価。条件は searchKey のプロファイルから（無ければ既定） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function evaluationOfPlacement(templateId: string, placement: any[], hash: string, profile: PersistedProfile | undefined, cache: MapEvalCache): MapEvaluation | null {
  const key = `${templateId}|${hash}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const params = (profile?.params ?? null) as { hard?: unknown; soft?: unknown } | null;
  const ev = templateId ? evaluatePlacement(templateId, placement, params?.hard, params?.soft) : null;
  cache.set(key, ev);
  return ev;
}
