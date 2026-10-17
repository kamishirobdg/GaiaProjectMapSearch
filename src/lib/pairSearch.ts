// src/lib/pairSearch.ts
//
// Pair の「両方を探索」の組み立て（段階 3、2026-10-17 ユーザー確定 6「推奨でよい」）。
// Map の検索結果の上位 K 件 × Setup の検索結果の上位 L 件の総当たりを Pair の基準で採点し、上位 topN 組を返す純粋関数。
// 採点は planPair と同じ（船の相互作用、基準 2・3 は合計 T_f、種族優遇）。
// 検索そのもの（ワーカーの実行と結果バケツへの保存）は画面側（PairView）が行う。

import type { PersistedCandidate } from "@/app/board/persistence";
import { criterionScore, scoreSetupFactions, type FactionScores, type RecommendCriterion } from "@/gaia/eval/factionEval";
import { applyShipInteraction, shipInteractionOf } from "@/gaia/eval/shipInteraction";
import type { ScoreBlend } from "@/gaia/eval/scoreBlend";
import type { FactionPrefByFaction, SetupWeights } from "@/gaia/eval/setupWeights";
import { buildSetupFromSeed, type BuildSetupInput } from "@/gaia/setup/buildSetup";
import { factionPrefArgOf, mapTopOf, prefOnTotal, totalScoresOf, usesTotalBasis, type PairOption } from "@/lib/pairPlan";

/** 総当たりの上限（既定 20 × 20。Pair の「条件」で変えられる） */
export const PAIR_SEARCH_K_DEFAULT = 20;
export const PAIR_SEARCH_L_DEFAULT = 20;
export const PAIR_SEARCH_KL_MAX = 50;
/** 候補に並べる組の数 */
export const PAIR_SEARCH_TOP_N = 10;

export type PairSearchArgs = {
  /** Map の検索結果（スコア降順。評価内訳を持つもの） */
  maps: PersistedCandidate[];
  /** Setup の検索結果（基準値降順） */
  setups: Array<{ seed: string; input: BuildSetupInput }>;
  templateIdBySearchKey: Record<string, string>;
  criterion: RecommendCriterion;
  players: number;
  lf: boolean;
  evalWeights: SetupWeights;
  factionPref: FactionPrefByFaction;
  blend?: ScoreBlend;
  k?: number;
  l?: number;
  topN?: number;
};

/** 上位 K × L の総当たりを採点して上位 topN 組（PairOption の形。候補一覧と詳細がそのまま使える） */
export function scorePairs(a: PairSearchArgs): PairOption[] {
  const k = Math.max(1, Math.min(PAIR_SEARCH_KL_MAX, a.k ?? PAIR_SEARCH_K_DEFAULT));
  const l = Math.max(1, Math.min(PAIR_SEARCH_KL_MAX, a.l ?? PAIR_SEARCH_L_DEFAULT));
  const topN = a.topN ?? PAIR_SEARCH_TOP_N;
  const maps = a.maps.slice(0, k);
  const setups = a.setups.slice(0, l);
  const totalBasis = usesTotalBasis(a.criterion);
  // セットアップは組ごとに作り直さない（決定論なので 1 回）
  const built = setups.map((s) => {
    const result = buildSetupFromSeed(s.input);
    return { s, result, raw: scoreSetupFactions(result, a.evalWeights) };
  });
  const out: PairOption[] = [];
  for (const m of maps) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bd = (m as any)?.evaluation?.breakdown ?? null;
    const top = mapTopOf(m, a.templateIdBySearchKey, a.players);
    for (const b of built) {
      const setupScores: FactionScores = applyShipInteraction(b.raw, shipInteractionOf(b.result, bd, a.evalWeights));
      const useTotal = totalBasis && !!bd;
      const score = criterionScore(a.criterion, useTotal ? totalScoresOf(setupScores, bd, a.blend) : setupScores, {
        playerCount: a.players,
        lostFleet: a.lf,
        ...(top ? { mapTop3: top.top3, mapTopK: top.topK } : {}),
        factionPref: useTotal ? prefOnTotal(a.factionPref) : factionPrefArgOf(a.factionPref, bd, a.blend),
      });
      out.push({
        key: `b:${m.id}:${b.s.seed}`,
        mapId: m.id,
        mapTop: top?.detail ?? null,
        rec: { input: b.s.input, result: b.result, setupScores, criterion: a.criterion, score, trials: maps.length * built.length },
      });
    }
  }
  // 同点は マップの順 → セットアップの順（入力順）で安定
  return out.sort((x, y) => y.rec.score - x.rec.score).slice(0, topN);
}
