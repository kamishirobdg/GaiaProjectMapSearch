// src/lib/mapSearchSave.ts
//
// Map の検索結果を Map の結果バケツ（candidates / profiles）へ保存する（段階 3「両方を探索」、2026-10-17）。
// /board の persistResults と同じ手順（incoming を作る → 既存の active / used とマージ → saveMergeToDb → upsertProfileToDb）。
// Pair から検索したときも Map タブと同じバケツに貯まり、Map タブでそのまま見える。

import { computePlacementHash } from "@/gaia/ssot/placementHash";
import {
  EVAL_VERSION,
  loadFromDb,
  mergeCandidates,
  saveMergeToDb,
  slimEvaluation,
  SEARCH_ALGO_VERSION,
  stableStringify,
  upsertProfileToDb,
  type PersistedCandidate,
} from "@/app/board/persistence";

/** ワーカーが返す 1 件（runSearch の RankedResult）を結果バケツの行に */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toIncomingCandidates(searchKey: string, list: any[]): PersistedCandidate[] {
  const now = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return list.map((x: any) => {
    const placement = x.placement ?? [];
    const placementHash = String(x.placementHash ?? computePlacementHash(placement));
    const score = Number(x.score ?? 0);
    return {
      id: `${searchKey}:${placementHash}`,
      searchKey,
      placementHash,
      seed: String(x.seed),
      score,
      rankValue: -score,
      placement,
      evaluation: slimEvaluation(x.evaluation ?? { total: score, breakdown: x.breakdown, audit: x.audit }),
      used: false,
      usedKey: 0,
      createdAt: now,
      updatedAt: now,
    };
  });
}

/**
 * 結果バケツへマージして保存し、保存後の active（スコア降順）を返す。
 * searchKeyParams は Map の検索キーの params（templateId / placementMethod / algoVersion / evalVersion / hard / soft）。
 */
export async function saveMapSearchResults(args: {
  searchKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchKeyParams: any;
  templateId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: any[];
  capacityActive: number;
  keepTop: number;
}): Promise<PersistedCandidate[]> {
  const { searchKey, searchKeyParams, templateId, results, capacityActive, keepTop } = args;
  const existing = await loadFromDb(searchKey, capacityActive);
  const merged = mergeCandidates(searchKey, existing.active, existing.used, toIncomingCandidates(searchKey, results), capacityActive);
  await saveMergeToDb(searchKey, merged);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { algoVersion: _a, evalVersion: _e, ...baseKeyParams } = searchKeyParams ?? {};
  await upsertProfileToDb(searchKey, {
    baseKeyRaw: stableStringify(baseKeyParams),
    algoVersion: SEARCH_ALGO_VERSION,
    evalVersion: EVAL_VERSION,
    templateId,
    paramsRaw: stableStringify(searchKeyParams),
    params: searchKeyParams,
    activeCount: merged.active.length,
    usedCount: merged.used.length,
    lastTopK: keepTop,
    updatedAt: Date.now(),
  });
  return merged.active.slice().sort((a, b) => Number(b.score) - Number(a.score));
}
