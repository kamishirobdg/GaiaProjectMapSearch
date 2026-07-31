// scripts/measure_setup_color_pref.ts
//
// Setup の色優遇/冷遇の係数を実測で決める（2026-07-31）。
// Map 側（measure_color_pref.ts）と同じ考え方で、
// 「基準値の振れ幅」に対して「色の値 × pref × 係数」がどれくらいかを見る。
//
//   npx tsx scripts/measure_setup_color_pref.ts [件数]

import { buildSetupFromSeed, defaultAdvancedTileRules } from "../src/gaia/setup/buildSetup";
import { criterionScore, colorValueOf, scoreSetupFactions } from "../src/gaia/eval/factionEval";

const N = Number(process.argv[2] ?? 300) || 300;
const CRITERIA = ["topBalance", "neutralBalance"] as const;

type Row = { crit: Record<string, number>; colors: Record<string, number> };
const rows: Row[] = [];

for (let seed = 1; seed <= N; seed++) {
  const result = buildSetupFromSeed({
    seed: String(seed),
    mode: "lostFleet",
    playerCount: 4,
    tileRules: defaultAdvancedTileRules(),
  } as any);
  const scores = scoreSetupFactions(result);
  const crit: Record<string, number> = {};
  for (const c of CRITERIA) {
    crit[c] = criterionScore(c, scores, { playerCount: 4, lostFleet: true });
  }
  rows.push({ crit, colors: colorValueOf(scores, true) });
}

function spread(xs: number[]) {
  const s = xs.slice().sort((a, b) => a - b);
  const p10 = s[Math.floor(s.length * 0.1)];
  const p90 = s[Math.floor(s.length * 0.9)];
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return { mean, p10, p90, spread: p90 - p10 };
}

console.log(`セットアップ ${N}件（4人LF・既定の評価指数）\n`);

const critSpread: Record<string, number> = {};
for (const c of CRITERIA) {
  const s = spread(rows.map((r) => r.crit[c]));
  critSpread[c] = s.spread;
  console.log(`基準「${c}」: 平均 ${s.mean.toFixed(1)} / 上位10%と下位10%の差 ${s.spread.toFixed(1)}`);
}

const colorKeys = Object.keys(rows[0].colors);
const colorSpreads: number[] = [];
console.log(`\n母星色ごとの値（その色でいちばん強い種族のスコア）:`);
for (const k of colorKeys) {
  const s = spread(rows.map((r) => r.colors[k] ?? 0));
  colorSpreads.push(s.spread);
  console.log(`  ${k.padEnd(9)} 平均 ${s.mean.toFixed(0)} / 上位10%と下位10%の差 ${s.spread.toFixed(0)}`);
}
const avgColorSpread = colorSpreads.reduce((a, b) => a + b, 0) / colorSpreads.length;
console.log(`\n色の値の振れ幅（平均） = ${avgColorSpread.toFixed(1)}`);

// Map と同じ目盛り（pref=1 でほぼ互角、2 で主導、5 でほぼ全て）にするための係数
console.log(`\npref=1 で基準の振れ幅と互角になる係数:`);
for (const c of CRITERIA) {
  const w = critSpread[c] / avgColorSpread;
  console.log(`  ${c}: ${w.toFixed(3)}`);
}
const wSuggest = Math.min(...CRITERIA.map((c) => critSpread[c])) / avgColorSpread;
console.log(`\n→ 厳しい方（基準の振れ幅が小さい方）に合わせると ${wSuggest.toFixed(3)}`);
for (const w of [0.1, 0.2, 0.25, 0.3, 0.5]) {
  const line = CRITERIA.map((c) => `${c}=×${((w * avgColorSpread) / critSpread[c]).toFixed(1)}`).join("  ");
  console.log(`  係数 ${w}: pref=1 のとき ${line}`);
}
