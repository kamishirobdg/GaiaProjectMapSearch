// scripts/_probe_map_values.ts
//
// Map 評価値の桁の実測（2026-10-03、「開始地点＋到達加重」の実装後）。
//
//   npx tsx scripts/_probe_map_values.ts [件数=60] [基本版の H2 上限=3]
//
// 既定の評価指数（src/app/board/page.tsx の DEFAULT_CONDITIONS と同じ）で、ハード制約を通った
// 盤面だけを集め、色ごとの値・盤面ごとの最上位・3位以下の寄与・原始/小惑星の種族ごとの値を出す。
// 基本版は H2 の上限1だとほぼ通らないので既定で上限3にしてある。
// Map と Setup の桁合わせ（合算比）を決めるときの材料。

import { makeSearchPlacementFromSeed } from "../src/gaia/ssot/searchPlacementConfig";
import { buildLogicalMapFromPlacement } from "../src/gaia/logicalMap/buildLogicalMap";
import { extractForEval } from "../src/gaia/eval/extractForEval";
import { evaluateSoft } from "../src/gaia/eval/evaluateSoft";
import { checkHardConstraints } from "../src/gaia/constraints";
import { LF_FACTION_ORDER } from "../src/gaia/eval/reachCost";

const N = Number(process.argv[2] ?? 60) || 60;
const BASE_OUTER_CAP = Number(process.argv[3] ?? 3) || 3;

const soft = {
  // 端の罰点は 2026-10-04（eval_v4）から「欠けマス × wRimGap」（それまでは wOuter 3 / wTouch 1）
  wRimGap: 0.5,
  wScout: 10,
  wScoutCore: 4,
  scoutRadius: 3,
  wScoutByScoutKey: { twilight: 10, eclipse: 10, rebellion: 10, tfmars: 10 },
  wScoutCoreByScoutKey: { twilight: 3, eclipse: 3, rebellion: 3, tfmars: 3 },
  scoutCoreAttributionMode: "all",
  wGaiaDist1: 5,
  wGaiaDist2: 8,
  wGaiaDist3: 3,
  wClusterSize: 1,
  wImbalance: 1,
} as any;

const BASIC = ["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW"];

function stat(xs: number[]) {
  const s = xs.slice().sort((a, b) => a - b);
  const q = (f: number) => s[Math.min(s.length - 1, Math.floor(s.length * f))];
  return { n: s.length, mean: s.reduce((a, b) => a + b, 0) / Math.max(1, s.length), med: q(0.5), p10: q(0.1), p90: q(0.9) };
}
const f1 = (v: number) => v.toFixed(1);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

for (const [templateId, outerCap] of [["4p_lostFleet", 1], ["3p_lostFleet", 1], ["base_34p", BASE_OUTER_CAP]] as Array<[string, number]>) {
  const hard = {
    minSameColorDist: 3,
    outerSameColorMax: outerCap,
    centerMode: "NONE",
    maxConnectedPlanets: 0,
    h5IncludeScouts: false,
    ...(templateId === "base_34p" ? { banSameKindAdjacency: true } : {}),
  } as any;
  const vals: number[] = [];
  const tops: number[] = [];
  const restShare: number[] = [];
  const lfVals: Record<string, number[]> = {};
  let seed = 0;
  let boards = 0;
  const t0 = Date.now();
  while (boards < N && seed < N * 800) {
    seed++;
    const { placement } = makeSearchPlacementFromSeed({ templateId, seed });
    const lm = buildLogicalMapFromPlacement({ templateId, placement });
    const extracted = extractForEval(lm as any, hard);
    if (!checkHardConstraints(extracted, placement as any, hard).pass) continue;
    boards++;
    const { breakdown } = evaluateSoft(extracted, soft);
    const totals = breakdown.planetTypeTotals as Record<string, number>;
    const arr = BASIC.map((c) => totals[c] ?? 0);
    vals.push(...arr);
    tops.push(Math.max(...arr));
    const sa: any = (breakdown.audit as any).startAccess;
    for (const c of BASIC) {
      const col = sa?.byColor?.[c];
      if (!col || !(totals[c] > 0)) continue;
      let rest = 0;
      for (const p of col.planets) if (p.weight < 1) rest += p.weight * p.value;
      restShare.push(rest / totals[c]);
    }
    for (const f of LF_FACTION_ORDER) {
      const v = sa?.lf?.[f]?.total;
      if (typeof v === "number") (lfVals[f] ??= []).push(v);
    }
  }
  const ms = Date.now() - t0;
  console.log(`\n################ ${templateId}  盤面 ${boards}件（${seed} シード中、${ms}ms。H2 上限 ${outerCap}。既定の評価指数）`);
  if (boards === 0) continue;
  const vs = stat(vals), ts = stat(tops);
  console.log(`  色の値: 平均 ${f1(vs.mean)}  10%〜90% ${f1(vs.p10)}〜${f1(vs.p90)}`);
  console.log(`  盤面ごとの最上位: 中央値 ${f1(ts.med)}  10%〜90% ${f1(ts.p10)}〜${f1(ts.p90)}`);
  console.log(`  色の値のうち3位以下（到達加重）の寄与: 平均 ${pct(stat(restShare).mean)}`);
  for (const f of LF_FACTION_ORDER) {
    const xs = lfVals[f];
    if (!xs || xs.length === 0) continue;
    const s = stat(xs);
    console.log(`  ${f.padEnd(12)} 平均 ${f1(s.mean).padStart(5)}  中央 ${f1(s.med).padStart(5)}  標準色の平均との比 ${(s.mean / vs.mean).toFixed(2)}`);
  }
}
