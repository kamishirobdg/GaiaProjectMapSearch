// src/lib/pairScore.ts
//
// 組（マップ × セットアップ）の採点に使う純粋な補助（2026-10-17）。pairPlan.ts から分けたのは、Setup の検索ワーカー
// （src/workers/setupSearch.worker.ts → setupSearchCore.ts）からも使うため。ワーカーには localStorage が無いので、
// sharedSettings を読む pairPlan.ts はワーカーから import しない。

import { criterionScore, LIST_FACTION_PREF_W, type FactionPref, type FactionScores, type RecommendCriterion } from "@/gaia/eval/factionEval";
import { FACTION_IDS, type FactionId } from "@/gaia/eval/factionWeights";
import { mapValueByFaction } from "@/gaia/eval/mapFaction";
import { blendScores, isDefaultScoreBlend, type ScoreBlend } from "@/gaia/eval/scoreBlend";
import type { FactionPrefByFaction } from "@/gaia/eval/setupWeights";

/**
 * 基準 1（上位バランス）・2（全体バランス）は、マップの評価内訳があれば **合計 T_f ＝ blend(Map_f, Setup_f)** で測る
 * （段階 2「Pair」、2026-10-17。それまでは Setup の値だけで測り、マップに依存しなかった）。
 * 3（逆優位）・4（優位）はマップの上位種族を使う式のまま（2026-10-27 から廃止予定）。内訳を持たない古い候補は従来どおり Setup の値で測る。
 */
export function usesTotalBasis(criterion: RecommendCriterion): boolean {
  return criterion === "topBalance" || criterion === "neutralBalance";
}

/** 合計 T_f（Pair の合計表と同じ合算比）。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function totalScoresOf(setupScores: FactionScores, mapBreakdown: any, blend?: ScoreBlend): FactionScores {
  const mv = mapValueByFaction(mapBreakdown);
  const out = {} as FactionScores;
  for (const f of FACTION_IDS) out[f] = blendScores(mv[f] ?? 0, setupScores[f] ?? 0, blend);
  return out;
}

/**
 * criterionScore へ渡す種族優遇（Setup の値で測るとき）。Map ぶんはマップ 1 枚で決まるのでここで作り、
 * Setup ぶんは criterionScore が採点中のスコアから足す。指定が無ければ undefined＝素通り。
 */
export function factionPrefArgOf(
  factionPref: FactionPrefByFaction,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapBreakdown: any,
  blend?: ScoreBlend
): FactionPref | undefined {
  return Object.keys(factionPref).length > 0
    ? {
        w: LIST_FACTION_PREF_W,
        byFaction: factionPref as Partial<Record<FactionId, number>>,
        mapValueByFaction: mapValueByFaction(mapBreakdown),
        // 既定（1:1）なら省略＝従来どおり（無効時フィールド省略）
        ...(blend && !isDefaultScoreBlend(blend) ? { blend } : {}),
      }
    : undefined;
}

/**
 * 組（マップ × セットアップ）の基準値。planPair / scorePairs / 候補一覧の順位 / 連続探索（セットアップ → マップ）で同じ式
 * （2026-10-17 v2.2.0 で一本化）。setupScores は船の相互作用を掛けた後の Setup の値。基準 1・2 は内訳があれば合計 T_f で、
 * 3・4 はマップの上位種族で測る。
 */
export function scorePairOf(a: {
  criterion: RecommendCriterion;
  setupScores: FactionScores;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapBreakdown: any;
  blend?: ScoreBlend;
  factionPref: FactionPrefByFaction;
  players: number;
  lf: boolean;
  mapTop?: { top3: FactionId[]; topK: FactionId[] } | null;
  /** 上位 K（共有設定。省略時 人数＋2） */
  topK?: number | null;
}): number {
  const useTotal = usesTotalBasis(a.criterion) && !!a.mapBreakdown;
  return criterionScore(a.criterion, useTotal ? totalScoresOf(a.setupScores, a.mapBreakdown, a.blend) : a.setupScores, {
    playerCount: a.players,
    lostFleet: a.lf,
    ...(a.mapTop ? { mapTop3: a.mapTop.top3, mapTopK: a.mapTop.topK } : {}),
    factionPref: useTotal ? prefOnTotal(a.factionPref) : factionPrefArgOf(a.factionPref, a.mapBreakdown, a.blend),
    topK: a.topK,
  });
}

/**
 * 合計 T_f で測るときの種族優遇。Map ぶんは T_f に入っているので mapValueByFaction も合算比も付けない。
 * 減点の形（上位 K に届かない分だけ）は factionEval.factionPrefBonus（2026-10-22）。
 */
export function prefOnTotal(factionPref: FactionPrefByFaction): FactionPref | undefined {
  return Object.keys(factionPref).length > 0
    ? { w: LIST_FACTION_PREF_W, byFaction: factionPref as Partial<Record<FactionId, number>> }
    : undefined;
}
