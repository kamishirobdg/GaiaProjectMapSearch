// src/lib/pairScore.ts
//
// 組（マップ × セットアップ）の採点に使う純粋な補助（2026-10-17）。pairPlan.ts から分けたのは、Setup の検索ワーカー
// （src/workers/setupSearch.worker.ts → setupSearchCore.ts）からも使うため。ワーカーには localStorage が無いので、
// sharedSettings を読む pairPlan.ts はワーカーから import しない。

import { LIST_FACTION_PREF_W, type FactionPref, type FactionScores, type RecommendCriterion } from "@/gaia/eval/factionEval";
import { FACTION_IDS, type FactionId } from "@/gaia/eval/factionWeights";
import { mapValueByFaction } from "@/gaia/eval/mapFaction";
import { blendScores, isDefaultScoreBlend, type ScoreBlend } from "@/gaia/eval/scoreBlend";
import type { FactionPrefByFaction } from "@/gaia/eval/setupWeights";

/**
 * 基準 2（上位バランス）・3（全体バランス）は、マップの評価内訳があれば **合計 T_f ＝ blend(Map_f, Setup_f)** で測る
 * （段階 2「Pair」、2026-10-17。それまでは Setup の値だけで測り、マップに依存しなかった）。
 * 1（逆優位）・4（優位）はマップの上位種族を使う式のまま。内訳を持たない古い候補は従来どおり Setup の値で測る。
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
 * 合計 T_f で測るときの種族優遇。Map ぶんは T_f に入っているので mapValueByFaction も合算比も付けず、
 * w × 優遇 × T_f になる（従来の「Map ＋ Setup の合計に掛ける」と同じ大きさ）。
 */
export function prefOnTotal(factionPref: FactionPrefByFaction): FactionPref | undefined {
  return Object.keys(factionPref).length > 0
    ? { w: LIST_FACTION_PREF_W, byFaction: factionPref as Partial<Record<FactionId, number>> }
    : undefined;
}
