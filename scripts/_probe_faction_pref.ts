// scripts/_probe_faction_pref.ts
//
// 種族優遇の係数の実測（2026-10-22。ユーザー「優遇を設定した種族が使う気も起きないようなバランスではない、程度でよい」）。
//
//   npx tsx scripts/_probe_faction_pref.ts [盤面数=30] [セットアップ数=1500] [Map 用の盤面数=120]
//   MODE=pair|setup|map で絞る。SHAPE=shortfall（既定。Pair / Setup は 2026-10-22、Map は 2026-10-27 の eval_v10 から）| linear（それまでの形）
//
// 3 か所の優遇（Pair: w × p × 合計 T_f、Setup の検索: w × p × Setup の値、Map の検索: w × p × 種族の盤面の値）について、
// 係数 w と優遇 p を振り、順位の上位 5 件（Pair はマップごとの最良の組を並べた上位 5 行）で
//   - 優遇した種族が上位 K（人数＋2。種族で数える）に入る割合
//   - 優遇した種族の順位の平均（1 ＝ 最強）
//   - バランスの損失（優遇なしの上位 5 件の基準値の平均 − 優遇ありの上位 5 件の基準値の平均）
// を、全種族を 1 つずつ優遇した平均で出す。

import { makeSearchPlacementFromSeed } from "../src/gaia/ssot/searchPlacementConfig";
import { buildLogicalMapFromPlacement } from "../src/gaia/logicalMap/buildLogicalMap";
import { extractForEval } from "../src/gaia/eval/extractForEval";
import { evaluateSoft } from "../src/gaia/eval/evaluateSoft";
import { checkHardConstraints } from "../src/gaia/constraints";
import { buildSetupFromSeed } from "../src/gaia/setup/buildSetup";
import { criterionScore, scoreSetupFactions, type FactionScores } from "../src/gaia/eval/factionEval";
import { mapValueByFaction } from "../src/gaia/eval/mapFaction";
import { factionIdsForMode, type FactionId } from "../src/gaia/eval/factionWeights";
import { applyShipInteraction, shipInteractionOf } from "../src/gaia/eval/shipInteraction";
import { totalScoresOf } from "../src/lib/pairScore";

const N_MAPS = Number(process.argv[2] ?? 30) || 30;
const N_SETUPS = Number(process.argv[3] ?? 1500) || 1500;
const N_MAP_SEARCH = Number(process.argv[4] ?? 120) || 120;
const TOP = 5;
const PS = [0, 1, 2, 5];

const soft = {
  wRimGap: 0.5,
  wScout: 10,
  wScoutCore: 4,
  scoutRadius: 3,
  wScoutByScoutKey: { twilight: 10, eclipse: 10, rebellion: 10, tfmars: 10 },
  wScoutCoreByScoutKey: { twilight: 3, eclipse: 3, rebellion: 3, tfmars: 3 },
  scoutCoreAttributionMode: "all",
  wImbalance: 100,
  imbalanceMetric: "std",
} as any;

function rankOf(scores: FactionScores, f: FactionId, ids: FactionId[]): number {
  const v = scores[f] ?? 0;
  return 1 + ids.filter((x) => x !== f && (scores[x] ?? 0) > v).length;
}

type Cand = { base: number; values: FactionScores };

/** 優遇の加点。linear ＝ w × p × 値（いまの形）、shortfall ＝ w × p × min(0, 値 − 上位 K の境目)（届かない分だけ減点） */
const SHAPE = process.env.SHAPE ?? "shortfall";
function bonusOf(c: Cand, f: FactionId, ids: FactionId[], K: number, w: number, p: number): number {
  if (w === 0 || p === 0) return 0;
  const v = c.values[f] ?? 0;
  if (SHAPE === "linear") return w * p * v;
  const others = ids.filter((x) => x !== f).map((x) => c.values[x] ?? 0).sort((a, b) => b - a);
  const thr = others[K - 1] ?? -Infinity;
  return w * p * Math.min(0, v - thr);
}

/** 候補の集合（グループ＝マップ。Setup / Map の検索は 1 グループ 1 候補の集合を 1 つ）から、優遇ありの上位 TOP を選んで測る */
function measure(groups: Cand[][], ids: FactionId[], K: number, w: number, p: number) {
  let inTop = 0, rankSum = 0, n = 0, lossSum = 0, lossN = 0;
  for (const f of ids) {
    const sc = (c: Cand, ww: number) => c.base + bonusOf(c, f, ids, K, ww, p);
    const pick = (ww: number) => {
      const bests: Cand[] = [];
      for (const g of groups) {
        let best: Cand | null = null, bestS = -Infinity;
        for (const c of g) {
          const s = sc(c, ww);
          if (s > bestS) { bestS = s; best = c; }
        }
        if (best) bests.push(best);
      }
      return bests;
    };
    const flat = groups.length === 1;
    const sel = (flat ? groups[0].slice() : pick(w)).sort((a, b) => sc(b, w) - sc(a, w)).slice(0, TOP);
    const ref = (flat ? groups[0].slice() : pick(0)).sort((a, b) => b.base - a.base).slice(0, TOP);
    for (const c of sel) {
      const r = rankOf(c.values, f, ids);
      rankSum += r;
      if (r <= K) inTop++;
      n++;
    }
    const mean = (xs: Cand[]) => xs.reduce((a, c) => a + c.base, 0) / Math.max(1, xs.length);
    lossSum += mean(ref) - mean(sel);
    lossN++;
  }
  return { inTop: inTop / n, rank: rankSum / n, loss: lossSum / lossN };
}

function report(label: string, groups: Cand[][], ids: FactionId[], K: number, ws: number[], baseSpread: number) {
  console.log(`\n### ${label}（上位 ${TOP} 件、全 ${ids.length} 種族を 1 つずつ優遇した平均。上位 K ＝ ${K}。基準値の上位 10%〜下位 10% の差 ${baseSpread.toFixed(2)}）`);
  console.log(`| 係数 w | p | 上位 K 入り | 順位の平均 | バランスの損失 |`);
  console.log(`| --- | --- | --- | --- | --- |`);
  const r0 = measure(groups, ids, K, 0, 0);
  console.log(`| （優遇なし） | 0 | ${(r0.inTop * 100).toFixed(0)}% | ${r0.rank.toFixed(1)} | 0 |`);
  for (const w of ws) for (const p of PS.filter((x) => x > 0)) {
    const r = measure(groups, ids, K, w, p);
    console.log(`| ${w} | ${p} | ${(r.inTop * 100).toFixed(0)}% | ${r.rank.toFixed(1)} | ${r.loss.toFixed(2)} |`);
  }
}

function spreadOf(xs: number[]) {
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.9)] - s[Math.floor(s.length * 0.1)];
}

const MODE = process.env.MODE ?? "all";
for (const [templateId, players, lf] of [["4p_lostFleet", 4, true], ["3p_lostFleet", 3, true], ["base_34p", 4, false]] as Array<[string, number, boolean]>) {
  const hard = { minSameColorDist: 3, outerSameColorMax: lf ? 1 : 3, centerMode: "NONE", maxConnectedPlanets: 0, h5IncludeScouts: false } as any;
  const ids = factionIdsForMode(lf) as FactionId[];
  const K = players + 2;
  const need = Math.max(N_MAPS, MODE === "all" || MODE === "map" ? N_MAP_SEARCH : 0);
  const maps: Array<{ bd: any; score: number }> = [];
  let seed = 0;
  while (maps.length < need && seed < need * 3000) {
    seed++;
    const { placement } = makeSearchPlacementFromSeed({ templateId, seed });
    const lm = buildLogicalMapFromPlacement({ templateId, placement });
    const extracted = extractForEval(lm as any, hard);
    if (!checkHardConstraints(extracted, placement as any, templateId === "base_34p" ? { ...hard, banSameKindAdjacency: true } : hard).pass) continue;
    const ev = evaluateSoft(extracted, soft);
    maps.push({ bd: ev.breakdown, score: ev.score });
  }
  console.log(`\n## ${templateId}（${players} 人）: 制約を通った盤面 ${maps.length}（${seed} シード）`);
  const setups = Array.from({ length: N_SETUPS }, (_, i) => buildSetupFromSeed({ seed: `pref-${i + 1}`, playerCount: players, mode: lf ? "lostFleet" : "base" } as any));
  const raws = setups.map((s) => scoreSetupFactions(s));

  if (MODE === "all" || MODE === "pair") {
    const groups: Cand[][] = [];
    const bases: number[] = [];
    for (const m of maps.slice(0, N_MAPS)) {
      const g: Cand[] = [];
      for (let i = 0; i < setups.length; i++) {
        const ss = applyShipInteraction(raws[i], shipInteractionOf(setups[i], m.bd));
        const T = totalScoresOf(ss, m.bd);
        const base = criterionScore("topBalance", T, { playerCount: players, lostFleet: lf });
        g.push({ base, values: T });
        bases.push(base);
      }
      groups.push(g);
    }
    report(`Pair（マップ → セットアップ、基準 2、掛け先 合計 T_f、${SHAPE}）`, groups, ids, K, SHAPE === "linear" ? [0.15, 0.05, 0.03, 0.02, 0.01] : [0.05, 0.1, 0.2, 0.5], spreadOf(bases));
  }
  if (MODE === "all" || MODE === "setup") {
    const cands: Cand[] = raws.map((r) => ({ base: criterionScore("topBalance", r, { playerCount: players, lostFleet: lf }), values: r }));
    report(`Setup の検索（基準 2、掛け先 Setup の値、${SHAPE}）`, [cands], ids, K, SHAPE === "linear" ? [0.15, 0.05, 0.03, 0.02, 0.01] : [0.02, 0.05, 0.1, 0.2], spreadOf(cands.map((c) => c.base)));
  }
  if (MODE === "all" || MODE === "map") {
    const cands: Cand[] = maps.map((m) => ({ base: m.score, values: mapValueByFaction(m.bd) }));
    report(`Map の検索（偏り項、掛け先 種族の盤面の値、${SHAPE}）`, [cands], ids, K, SHAPE === "linear" ? [25, 10, 5, 3, 2] : [25, 50], spreadOf(cands.map((c) => c.base)));
  }
}
