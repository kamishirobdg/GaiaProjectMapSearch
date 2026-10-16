// src/lib/setupSearchCore.ts
//
// Setup の検索（旧 一括探索）の純粋部分（段階 1「条件の統一」2026-10-16）。ワーカー（src/workers/setupSearch.worker.ts）と
// メインスレッドの fallback（src/lib/setupSearchRunner.ts）が同じ関数を使うので、経路によらず同じ結果になる。
// ワーカーのモジュールは読み込むと self.onmessage を設定するので、メインスレッドからはこちらだけを import する。

import { recommendSetups, type FactionPref, type RecommendCriterion } from "@/gaia/eval/factionEval";
import type { BuildSetupInput } from "@/gaia/setup/buildSetup";
import type { SetupWeights } from "@/gaia/eval/setupWeights";

export type SetupSearchArgs = {
  seeds: string[];
  criterion: RecommendCriterion;
  playerCount: number;
  lostFleet: boolean;
  weights?: SetupWeights;
  factionPref?: FactionPref;
  topN: number;
  baseInput: Omit<BuildSetupInput, "seed">;
};

/** ワーカーが返す 1 件（Recommendation から入力とスコアだけ。result は表示側で再構築する） */
export type SetupSearchHit = { seed: string; input: BuildSetupInput; score: number };

export const SETUP_SEARCH_CHUNK = 250;

/** 1 チャンクを採点して、これまでの上位とマージする（純粋。メインスレッドの fallback も同じ関数を使う） */
export function searchChunk(args: SetupSearchArgs, slice: string[], acc: SetupSearchHit[]): SetupSearchHit[] {
  const rs = recommendSetups({
    criterion: args.criterion,
    seeds: slice,
    playerCount: args.playerCount,
    lostFleet: args.lostFleet,
    weights: args.weights,
    factionPref: args.factionPref,
    topN: args.topN,
    baseInput: args.baseInput,
  });
  const fresh: SetupSearchHit[] = rs.map((r) => ({ seed: String(r.input.seed), input: r.input, score: r.score }));
  return [...acc, ...fresh].sort((a, b) => b.score - a.score).slice(0, args.topN);
}
