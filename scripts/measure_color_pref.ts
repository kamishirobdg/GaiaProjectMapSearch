// scripts/measure_color_pref.ts
//
// 色優遇/冷遇の値がどれくらい効くかを実測する（2026-07-31）。
// ツールチップの文言を「実際の数値の影響度」と合わせるための計測。
//
//   npx tsx scripts/measure_color_pref.ts [盤面数]
//
// 考え方:
//   スコア = 偏り項(-wImbalance × std) + 色優遇項(wColorPref × pref × その色の評価値)
//   検索はスコア最大の盤面を選ぶので、pref を上げるほど「その色の評価値が高い盤面」が
//   選ばれやすくなる。どこから優遇が偏り項を押し切るかを、盤面ごとの実測値から出す。

import { makeSearchPlacementFromSeed } from "../src/gaia/ssot/searchPlacementConfig";
import { buildLogicalMapFromPlacement } from "../src/gaia/logicalMap/buildLogicalMap";
import { extractForEval } from "../src/gaia/eval/extractForEval";
import { evaluateSoft } from "../src/gaia/eval/evaluateSoft";

const N = Number(process.argv[2] ?? 300) || 300;
const COLORS = ["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW"] as const;
const W_COLOR_PREF = 25; // DEFAULT_CONDITIONS.wColorPref

const hard = { outerSameColorMax: 1, centerMode: "NONE", maxConnectedPlanets: 0, h5IncludeScouts: false } as any;
const soft = {
  wOuter: 3,
  wTouch: 1,
  wScout: 10,
  wScoutCore: 4,
  scoutRadius: 3,
  wScoutByScoutKey: { twilight: 10, eclipse: 10, rebellion: 10, tfmars: 10 },
  wScoutCoreByScoutKey: { twilight: 3, eclipse: 3, rebellion: 3, tfmars: 3 },
  scoutCoreAttributionMode: "all",
  wImbalance: 100,
  imbalanceMetric: "std",
  wGaiaDist1: 5,
  wGaiaDist2: 8,
  wGaiaDist3: 3,
  wClusterSize: 1,
} as any;

type Row = { totals: Record<string, number>; imbalance: number; proto: number; asteroid: number };
const rows: Row[] = [];

for (let seed = 1; seed <= N; seed++) {
  const templateId = "4p_lostFleet";
  const { placement } = makeSearchPlacementFromSeed({ templateId, seed });
  const lm = buildLogicalMapFromPlacement({ templateId, placement });
  const extracted = extractForEval(lm as any, hard);
  const { breakdown } = evaluateSoft(extracted, soft);
  const a: any = breakdown.audit;
  rows.push({
    totals: breakdown.planetTypeTotals as any,
    imbalance: breakdown.imbalance.score,
    proto: a.extraBest?.PROTO?.total ?? 0,
    asteroid: a.extraBest?.ASTEROID?.total ?? 0,
  });
}

function stat(xs: number[]) {
  const s = xs.slice().sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length);
  return { mean, sd, min: s[0], max: s[s.length - 1], p10: s[Math.floor(s.length * 0.1)], p90: s[Math.floor(s.length * 0.9)] };
}

console.log(`盤面 ${N}件（4p_lostFleet・既定の評価指数、wColorPref=${W_COLOR_PREF}）\n`);

// 偏り項のばらつき = 優遇が押し切るべき相手
const imb = stat(rows.map((r) => r.imbalance));
console.log(`偏り項スコア: 平均 ${imb.mean.toFixed(0)} / 幅 ${imb.min.toFixed(0)}〜${imb.max.toFixed(0)} / 標準偏差 ${imb.sd.toFixed(0)}`);
console.log(`  上位10%と下位10%の差 = ${(imb.p90 - imb.p10).toFixed(0)}\n`);

console.log("色ごとの評価値のばらつき（この幅 × pref × wColorPref が優遇項の振れ幅）:");
const spreads: number[] = [];
for (const c of COLORS) {
  const s = stat(rows.map((r) => Number(r.totals[c] ?? 0)));
  const spread = s.p90 - s.p10;
  spreads.push(spread);
  console.log(`  ${c.padEnd(7)} 平均 ${s.mean.toFixed(0)} / 上位10%と下位10%の差 ${spread.toFixed(0)}`);
}
for (const [name, key] of [["PROTO", "proto"], ["ASTEROID", "asteroid"]] as const) {
  const s = stat(rows.map((r) => r[key]));
  const spread = s.p90 - s.p10;
  spreads.push(spread);
  console.log(`  ${name.padEnd(7)} 平均 ${s.mean.toFixed(0)} / 上位10%と下位10%の差 ${spread.toFixed(0)}`);
}

const avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;
const imbSpread = imb.p90 - imb.p10;
console.log(`\n色の評価値の振れ幅（平均） = ${avgSpread.toFixed(0)}`);
console.log(`偏り項の振れ幅 = ${imbSpread.toFixed(0)}`);
console.log(`\npref ごとの「優遇項の振れ幅 ÷ 偏り項の振れ幅」:`);
for (const p of [1, 2, 3, 5, 10, 20]) {
  const ratio = (W_COLOR_PREF * p * avgSpread) / imbSpread;
  const note =
    ratio < 0.5 ? "偏りの方が強い（多少寄る程度）"
    : ratio < 1.5 ? "ほぼ互角（はっきり寄る）"
    : ratio < 4 ? "優遇が主導（ほぼその色で決まる）"
    : "優遇がほぼ全て（他の条件は無視される）";
  console.log(`  pref=${String(p).padStart(2)}  ×${ratio.toFixed(1)}  ${note}`);
}

