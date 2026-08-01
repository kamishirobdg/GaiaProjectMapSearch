// scripts/_probe_score_range.ts
// 種族スコアの桁を確かめる（狙い: 最大100前後、小数なし）。
//   npx tsx scripts/_probe_score_range.ts [件数] [人数]

import { buildSetupFromSeed, defaultAdvancedTileRules } from "../src/gaia/setup/buildSetup";
import { scoreSetupFactions } from "../src/gaia/eval/factionEval";
import { factionIdsForMode } from "../src/gaia/eval/factionWeights";

const N = Number(process.argv[2] ?? 300) || 300;
const PLAYERS = Number(process.argv[3] ?? 4) || 4;
/** 既定は拡張版。--base で通常版。 */
const LF = !process.argv.includes("--base");
const ids = factionIdsForMode(LF);

let max = -Infinity;
let min = Infinity;
let fractional = 0;
const tops: number[] = [];

for (let s = 1; s <= N; s++) {
  const r = buildSetupFromSeed({
    seed: String(s),
    ...(LF ? { mode: "lostFleet" as const } : {}),
    playerCount: PLAYERS,
    tileRules: defaultAdvancedTileRules(),
  } as never);
  const sc = scoreSetupFactions(r);
  const vals = ids.map((f) => sc[f]);
  for (const v of vals) if (!Number.isInteger(v)) fractional++;
  const hi = Math.max(...vals);
  tops.push(hi);
  max = Math.max(max, hi);
  min = Math.min(min, Math.min(...vals));
}

tops.sort((a, b) => a - b);
const mean = tops.reduce((a, b) => a + b, 0) / tops.length;
console.log(`${N}件（${PLAYERS}人 ${LF ? "拡張版LF" : "通常版"}・既定の評価指数）`);
console.log(`種族スコア: 全体の最大 ${max} / 全体の最小 ${min}`);
console.log(`盤面ごとの最高値: 中央値 ${tops[Math.floor(N / 2)]} / 平均 ${mean.toFixed(1)}`);
console.log(`小数になった値: ${fractional} 件`);
