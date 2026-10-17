// src/lib/setupSearchCore.ts
//
// Setup の検索（旧 一括探索）の純粋部分（段階 1「条件の統一」2026-10-16）。ワーカー（src/workers/setupSearch.worker.ts）と
// メインスレッドの fallback（src/lib/setupSearchRunner.ts）が同じ関数を使うので、経路によらず同じ結果になる。
// ワーカーのモジュールは読み込むと self.onmessage を設定するので、メインスレッドからはこちらだけを import する。

import { recommendSetups, type FactionPref, type RecommendCriterion } from "@/gaia/eval/factionEval";
import type { FactionId } from "@/gaia/eval/factionWeights";
import { applyShipInteraction, shipInteractionOf } from "@/gaia/eval/shipInteraction";
import type { ScoreBlend } from "@/gaia/eval/scoreBlend";
import type { BuildSetupInput } from "@/gaia/setup/buildSetup";
import type { FactionPrefByFaction, SetupWeights } from "@/gaia/eval/setupWeights";
import { factionPrefArgOf, prefOnTotal, totalScoresOf, usesTotalBasis } from "@/lib/pairScore";

/**
 * マップに合わせた採点（「連続で両方を探索」、2026-10-17）。渡すと、各セットアップを **そのマップとの組** として採点する:
 * 船の相互作用を掛け、基準 2・3 は合計 T_f、1・4 はマップの上位種族、種族優遇は planPair と同じ。
 * 採点の値は組の基準値（Pair の順位表にそのまま入る）。0.5ms/件（マップ無しの 2 倍）。
 */
export type PairWith = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapBreakdown: any;
  blend?: ScoreBlend;
  mapTop3?: FactionId[];
  mapTopK?: FactionId[];
  /** 種族ごとの優遇（探索プロファイルの表）。係数の付け方は pairScore.ts */
  factionPrefByFaction?: FactionPrefByFaction;
};

export type SetupSearchArgs = {
  seeds: string[];
  criterion: RecommendCriterion;
  playerCount: number;
  lostFleet: boolean;
  weights?: SetupWeights;
  /** マップ無しの検索（Setup タブ）の種族優遇。pairWith があるときは使わない */
  factionPref?: FactionPref;
  topN: number;
  baseInput: Omit<BuildSetupInput, "seed">;
  pairWith?: PairWith;
};

/** ワーカーが返す 1 件（Recommendation から入力とスコアだけ。result は表示側で再構築する） */
export type SetupSearchHit = { seed: string; input: BuildSetupInput; score: number };

export const SETUP_SEARCH_CHUNK = 250;

/** 1 チャンクを採点して、これまでの上位とマージする（純粋。メインスレッドの fallback も同じ関数を使う） */
export function searchChunk(args: SetupSearchArgs, slice: string[], acc: SetupSearchHit[]): SetupSearchHit[] {
  const pw = args.pairWith;
  const totalBasis = !!pw && usesTotalBasis(args.criterion) && !!pw.mapBreakdown;
  const pref = pw?.factionPrefByFaction ?? {};
  const rs = recommendSetups({
    criterion: args.criterion,
    seeds: slice,
    playerCount: args.playerCount,
    lostFleet: args.lostFleet,
    weights: args.weights,
    factionPref: pw ? (totalBasis ? prefOnTotal(pref) : factionPrefArgOf(pref, pw.mapBreakdown, pw.blend)) : args.factionPref,
    topN: args.topN,
    baseInput: args.baseInput,
    ...(pw
      ? {
          ...(pw.mapTop3 ? { mapTop3: pw.mapTop3 } : {}),
          ...(pw.mapTopK ? { mapTopK: pw.mapTopK } : {}),
          // 船の相互作用（組にするマップの船接触で船のタイルの値を増減）
          adjustSetupScores: (res, scores) => applyShipInteraction(scores, shipInteractionOf(res, pw.mapBreakdown, args.weights)),
          ...(totalBasis ? { criterionScores: (_res: unknown, scores: Parameters<typeof totalScoresOf>[0]) => totalScoresOf(scores, pw.mapBreakdown, pw.blend) } : {}),
        }
      : {}),
  });
  const fresh: SetupSearchHit[] = rs.map((r) => ({ seed: String(r.input.seed), input: r.input, score: r.score }));
  return [...acc, ...fresh].sort((a, b) => b.score - a.score).slice(0, args.topN);
}
