// src/gaia/eval/mapFaction.ts
//
// マップの種族別優位性（一覧タブ「セット提案」用、2026-07-24）。
// DRAFT の式（レビュー対象）:
//   score(種族) = 母星色の惑星数 + 0.5 × (gaia親和 × ガイア数 + transdim親和 × 次元横断数)
// 惑星数は placement から論理マップを構築して数える生カウント
// （evaluateSoft の planetTypeTotals は outer/touch/scout の重み付き値で
//  スケールが異なるため、補正項と混ぜやすい生カウントを採用。要レビュー）。

import { buildLogicalMapFromPlacement } from "@/gaia/logicalMap/buildLogicalMap";
import { FACTIONS, FACTION_IDS, MAP_AFFINITY, type FactionId } from "./factionWeights";
import type { FactionScores } from "./factionEval";

const BASE_COLORS = new Set(["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW"]);
/** LF4種族の母星。基本7色ではないが母星色として数える（2026-07-30）。 */
const LF_HOME_COLORS = new Set(["PROTO", "ASTEROID"]);

export type MapPlanetCounts = {
  byColor: Record<string, number>; // 基本7色のみ（BLACK=チタニウム/灰色）
  gaia: number;
  transdim: number;
};

/**
 * placement から色別・ガイア・次元横断の惑星数を数える。
 * PROTO/ASTEROID は LF4種族の母星色なので数える（2026-07-30 に対象へ追加）。
 */
export function countMapPlanets(templateId: string, placement: any[]): MapPlanetCounts {
  const lm = buildLogicalMapFromPlacement({ templateId, placement });
  const byColor: Record<string, number> = {};
  let gaia = 0;
  let transdim = 0;
  for (const cell of lm.cellsByKey.values()) {
    if (cell?.kind !== "planet") continue;
    const pt = String(cell.planetType ?? "");
    if (pt === "GAIA") gaia += 1;
    else if (pt === "TRANSDIM") transdim += 1;
    else if (BASE_COLORS.has(pt) || LF_HOME_COLORS.has(pt)) byColor[pt] = (byColor[pt] ?? 0) + 1;
  }
  return { byColor, gaia, transdim };
}

/** 惑星数＋親和補正から14種族のマップスコアを出す。 */
export function mapFactionScoresFromCounts(counts: MapPlanetCounts): FactionScores {
  const out = {} as FactionScores;
  for (const f of FACTIONS) {
    const aff = MAP_AFFINITY[f.id] ?? {};
    out[f.id] =
      (counts.byColor[f.color] ?? 0) +
      0.5 * ((aff.gaia ?? 0) * counts.gaia + (aff.transdim ?? 0) * counts.transdim);
  }
  return out;
}

export function mapFactionScores(templateId: string, placement: any[]): FactionScores {
  return mapFactionScoresFromCounts(countMapPlanets(templateId, placement));
}

/**
 * 種族ごとの「Map タブの評価値」（2026-07-31）。母星色の評価値をそのまま割り当てる。
 *
 * 上の mapFactionScores（惑星数ベースの親和スコア、4〜12 程度）とは別物で、こちらは
 * Map の内訳表に出ている評価値（色ごと 100 前後）。List の種族優遇は
 * 「Map と Setup の合計スコア」を掛け先にするので、Setup 側（種族ごと 100 前後）と
 * 桁が揃うこちらを使う。
 *
 * breakdown は保存済み候補が持っている評価内訳。原始・小惑星は軸を持たないので、
 * 内訳表と同じく extraBest（最良の1惑星×補正値）を読む。
 * 内訳が無い／読めないときは全種族0（優遇が効かないだけで壊れない）。
 */
export function mapValueByFaction(breakdown: any): FactionScores {
  const out = {} as FactionScores;
  const totals = breakdown?.planetTypeTotals ?? null;
  const extraBest = breakdown?.audit?.extraBest ?? null;
  for (const f of FACTIONS) {
    const v = LF_HOME_COLORS.has(f.color)
      ? Number(extraBest?.[f.color]?.total ?? 0)
      : Number(totals?.[f.color] ?? 0);
    out[f.id] = Number.isFinite(v) ? v : 0;
  }
  return out;
}

export { FACTION_IDS };
export type { FactionId };
