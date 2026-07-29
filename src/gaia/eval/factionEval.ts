// src/gaia/eval/factionEval.ts
//
// セットアップの種族別評価と推奨基準（一覧タブ「セット提案」用、2026-07-24）。
// 重みは factionWeights.ts の DRAFT 行列（レビューで数値だけ差し替え可能）。
//
// スコアの意味: scoreSetupFactions は「そのセットアップで各種族がどれだけ
// 有利か」の相対値（タイル重みの単純合計、ラウンド得点は枚数分加算）。
// 標準技術9種は「どのトラックの下に付くか」で価値が変わるため、
// TRACK_AFFINITY × TECH_PREF の積で別途加算する（2026-07-25、scoreStandardTech）。

import type { SetupResult } from "@/gaia/setup/types";
import { buildSetupFromSeed, type BuildSetupInput } from "@/gaia/setup/buildSetup";
import {
  FACTION_IDS,
  STD_TECH_FREE_SCALE,
  STD_TECH_TRACK_SCALE,
  TECH_PREF,
  TILE_FACTION_WEIGHTS,
  TRACK_AFFINITY,
  type FactionId,
} from "./factionWeights";
import { RESEARCH_TRACK_IDS, type ResearchTrackId } from "@/gaia/setup/types";

export type FactionScores = Record<FactionId, number>;

function zeroScores(): FactionScores {
  const out = {} as FactionScores;
  for (const f of FACTION_IDS) out[f] = 0;
  return out;
}

/**
 * 標準技術の寄与（2026-07-25 案1）。トラック下の6枚は
 * 「そのトラックを登りたいか × そのタイルが有用か」の積、自由列3枚は
 * タイル有用度のみ（低係数）。非ゼロのみ返す差分オブジェクト。
 */
export function scoreStandardTech(result: SetupResult): FactionScores {
  const out = zeroScores();
  for (const track of RESEARCH_TRACK_IDS as readonly ResearchTrackId[]) {
    const pref = TECH_PREF[result.standardTech.byTrack[track]];
    if (!pref) continue;
    for (const f of FACTION_IDS) {
      const aff = TRACK_AFFINITY[f]?.[track] ?? 0;
      const p = pref[f] ?? 0;
      if (aff && p) out[f] += aff * p * STD_TECH_TRACK_SCALE;
    }
  }
  for (const id of result.standardTech.free) {
    const pref = TECH_PREF[id];
    if (!pref) continue;
    for (const [f, v] of Object.entries(pref)) out[f as FactionId] += (v ?? 0) * STD_TECH_FREE_SCALE;
  }
  return out;
}

/** セットアップに出ているタイル群から種族別スコアを合算する。 */
export function scoreSetupFactions(result: SetupResult): FactionScores {
  const scores = zeroScores();
  const add = (tileId: string | undefined) => {
    if (!tileId) return;
    const w = TILE_FACTION_WEIGHTS[tileId];
    if (!w) return;
    for (const [f, v] of Object.entries(w)) scores[f as FactionId] += v ?? 0;
  };

  for (const id of Object.values(result.advancedTech.byTrack)) add(id);
  add(result.advancedTech.extension);
  for (const id of result.boosters.available) add(id);
  for (const id of result.roundScoring) add(id); // ×2タイルは2回出るので枚数分加算
  for (const id of result.finalScoring) add(id);
  add(result.federationLv5); // 現行DRAFTでは全0
  if (result.mode === "lostFleet") {
    for (const id of Object.values(result.shipTech ?? {})) add(id);
    for (const id of Object.values(result.goldFederations ?? {})) add(id);
    for (const id of result.artifacts ?? []) add(id);
  }
  // 標準技術はトラック配置で価値が変わるので別式で加算（2026-07-25）。
  const std = scoreStandardTech(result);
  for (const f of FACTION_IDS) scores[f] += std[f];
  return scores;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}
function std(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) * (x - m))));
}
function sortedDesc(scores: FactionScores): number[] {
  return Object.values(scores).sort((a, b) => b - a);
}

/** マップ側スコア上位N種族（同点はFACTION_IDS順で安定）。 */
export function topFactions(scores: FactionScores, n: number): FactionId[] {
  return [...FACTION_IDS].sort((a, b) => scores[b] - scores[a]).slice(0, n);
}

export type RecommendCriterion = "opposeMap" | "topBalance" | "neutralBalance";

/**
 * 基準ごとの「このセットアップの良さ」（大きいほど良い）。DRAFT の式:
 * - opposeMap: マップ上位3種族のセットアップスコア合計が小さいほど良い
 *   （タイブレークに全体バランス）。
 * - topBalance: 上位 K=プレイ人数+2 種族が拮抗して強いほど良い
 *   （上位Kの散らばりを罰し、上位Kと残りの差を少し好む）。
 * - neutralBalance: 全14種族の散らばりが小さいほど良い（マップ非依存）。
 */
export function criterionScore(
  criterion: RecommendCriterion,
  setupScores: FactionScores,
  opts: { playerCount: number; mapTop3?: FactionId[] }
): number {
  const all = sortedDesc(setupScores);
  switch (criterion) {
    case "opposeMap": {
      const top3 = opts.mapTop3 ?? [];
      const sum = top3.reduce((a, f) => a + setupScores[f], 0);
      return -sum - 0.2 * std(all);
    }
    case "topBalance": {
      const k = Math.min(all.length, Math.max(2, opts.playerCount + 2));
      const topK = all.slice(0, k);
      const rest = all.slice(k);
      return -std(topK) + 0.3 * (mean(topK) - mean(rest));
    }
    case "neutralBalance":
      return -std(all);
  }
}

export type Recommendation = {
  input: BuildSetupInput;
  result: SetupResult;
  setupScores: FactionScores;
  criterion: RecommendCriterion;
  score: number;
  trials: number;
};

/**
 * シードを trials 件生成して基準スコア最良の1件を返す（要望: 出力は1件のみ）。
 * seeds は呼び出し側が生成する（決定論: 同じ seeds → 同じ結果）。
 * 条件（人数・拡張）以外のルール設定は付けない素のセットアップを対象とする。
 */
export function recommendSetup(args: {
  criterion: RecommendCriterion;
  seeds: string[];
  playerCount: number;
  lostFleet: boolean;
  mapTop3?: FactionId[];
}): Recommendation | null {
  const { criterion, seeds, playerCount, lostFleet, mapTop3 } = args;
  let best: Recommendation | null = null;
  for (const seed of seeds) {
    const input: BuildSetupInput = {
      seed,
      playerCount,
      ...(lostFleet ? { mode: "lostFleet" as const } : {}),
    };
    const result = buildSetupFromSeed(input);
    const setupScores = scoreSetupFactions(result);
    const score = criterionScore(criterion, setupScores, { playerCount, mapTop3 });
    if (!best || score > best.score) {
      best = { input, result, setupScores, criterion, score, trials: seeds.length };
    }
  }
  return best;
}
