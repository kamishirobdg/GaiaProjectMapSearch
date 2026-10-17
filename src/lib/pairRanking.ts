// src/lib/pairRanking.ts
//
// 「連続で両方を探索」の順位表（2026-10-17 ユーザー要望「時間が掛かって良いので大量に探査し、Ranking 上位を更新し続ける」）。
// 1 行 ＝ マップ（配置の写し。候補から消えても再表示できる）× セットアップ（入力）とその組の基準値。
// 条件バケツ（Pair の conditionKey）ごとに上位 PAIR_RANKING_CAP 行を localStorage に持ち、探索のたびにマージする。
// マップの評価は表示時にいまのコードで評価し直す（mapEvaluate.ts）ので、内訳は保存しない。

import type { BuildSetupInput } from "@/gaia/setup/buildSetup";
import type { RecommendCriterion } from "@/gaia/eval/factionEval";

export const LS_PAIR_RANKING = "gaia_pair_ranking_v1";
/** 条件ごとに残す組の数 */
export const PAIR_RANKING_CAP = 50;

export type PairRankRow = {
  /** `${mapHash}:${seed}` */
  id: string;
  conditionKey: string;
  /** マップの検索キー（評価し直すときの条件プロファイルの参照） */
  mapSearchKey: string;
  mapHash: string;
  tid: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapPlacement: any[];
  mapScore: number;
  seed: string;
  setupInput: BuildSetupInput;
  criterion: RecommendCriterion;
  score: number;
  players: number;
  lf: boolean;
  createdAt: number;
  /** 何周目の探索で見つけたか */
  round: number;
};

export function pairRankId(mapHash: string, seed: string): string {
  return `${mapHash}:${seed}`;
}

/** 純粋なマージ: 同じ組は 1 行（createdAt は古い方を保つ、score は新しい方）。基準値の降順で上位 cap 行。 */
export function mergePairRanking(existing: PairRankRow[], fresh: PairRankRow[], cap: number = PAIR_RANKING_CAP): PairRankRow[] {
  const byId = new Map<string, PairRankRow>();
  for (const r of existing) byId.set(r.id, r);
  for (const r of fresh) {
    const prev = byId.get(r.id);
    byId.set(r.id, prev ? { ...r, createdAt: prev.createdAt } : r);
  }
  return [...byId.values()]
    .sort((a, b) => b.score - a.score || a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))
    .slice(0, cap);
}

export function loadPairRanking(): PairRankRow[] {
  try {
    const raw = localStorage.getItem(LS_PAIR_RANKING);
    if (!raw) return [];
    const a = JSON.parse(raw);
    return Array.isArray(a) ? (a as PairRankRow[]) : [];
  } catch {
    return [];
  }
}

export function writePairRanking(rows: PairRankRow[]): void {
  try {
    localStorage.setItem(LS_PAIR_RANKING, JSON.stringify(rows));
  } catch {
    // ignore
  }
}

/** 条件バケツの行だけをマージして全体を書き戻す（他の条件の行は触らない） */
export function mergeIntoPairRanking(all: PairRankRow[], conditionKey: string, fresh: PairRankRow[], cap: number = PAIR_RANKING_CAP): PairRankRow[] {
  const mine = all.filter((r) => r.conditionKey === conditionKey);
  const others = all.filter((r) => r.conditionKey !== conditionKey);
  return [...others, ...mergePairRanking(mine, fresh, cap)];
}
