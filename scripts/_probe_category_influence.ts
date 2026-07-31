// scripts/_probe_category_influence.ts
//
// 「評価指数のカテゴリごとに、種族の優劣をどれだけ動かしているか」の実測（2026-08-01）。
// TODO.md「Setup の評価値を1つずつ精査」の出発点。狙いの順序は
//   技術 > LF船 > 上級 > ブースター > ラウンド > 最終 > 追加上級 > 同盟
//
//   npx tsx scripts/_probe_category_influence.ts [件数] [人数]
//
// 指標は3つ:
//   A 種族間SD  … 1セットアップ内で種族ごとの値がどれだけ散らばるか（＝順位を作る力）
//   B 幅        … 同上の max-min
//   C 盤面間SD  … 同じ種族の値がセットアップごとにどれだけ動くか（＝セット間の差を作る力）
// 順位付けに効くのは A。C は「探索して良いセットを選ぶ」ときの効き具合。

import { buildSetupFromSeed, defaultAdvancedTileRules } from "../src/gaia/setup/buildSetup";
import { setupFactionBreakdown } from "../src/gaia/eval/factionEval";
import { SETUP_WEIGHT_DISPLAY_ORDER, type SetupWeightKey } from "../src/gaia/eval/setupWeights";
import { factionIdsForMode } from "../src/gaia/eval/factionWeights";

const N = Number(process.argv[2] ?? 300) || 300;
const PLAYERS = Number(process.argv[3] ?? 4) || 4;

const LABEL: Record<SetupWeightKey, string> = {
  standardTech: "技術",
  lfShip: "LF船",
  advanced: "上級",
  booster: "ブースター",
  roundScoring: "ラウンド",
  finalScoring: "最終",
  advExtension: "追加上級",
  federation: "同盟",
};

function mean(xs: number[]) {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}
function sd(xs: number[]) {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) * (x - m))));
}

const ids = factionIdsForMode(true);

// perSetup[cat] = そのセットアップでの種族間SD / 幅
const withinSd: Record<string, number[]> = {};
const withinRange: Record<string, number[]> = {};
// byFaction[cat][faction] = セットアップごとの値（盤面間SDを取るため）
const byFaction: Record<string, Record<string, number[]>> = {};
const totalWithinSd: number[] = [];

for (const k of SETUP_WEIGHT_DISPLAY_ORDER) {
  withinSd[k] = [];
  withinRange[k] = [];
  byFaction[k] = {};
  for (const f of ids) byFaction[k][f] = [];
}

for (let seed = 1; seed <= N; seed++) {
  const result = buildSetupFromSeed({
    seed: String(seed),
    mode: "lostFleet",
    playerCount: PLAYERS,
    tileRules: defaultAdvancedTileRules(),
  } as never);
  const b = setupFactionBreakdown(result);
  for (const k of SETUP_WEIGHT_DISPLAY_ORDER) {
    const vals = ids.map((f) => b.byCategory[k][f]);
    withinSd[k].push(sd(vals));
    withinRange[k].push(Math.max(...vals) - Math.min(...vals));
    ids.forEach((f, i) => byFaction[k][f].push(vals[i]));
  }
  totalWithinSd.push(sd(ids.map((f) => b.total[f])));
}

console.log(`セットアップ ${N}件（${PLAYERS}人 LF・既定の評価指数・既定の除外）\n`);
console.log("カテゴリ      A:種族間SD    B:幅     C:盤面間SD   A の占有率");
console.log("".padEnd(60, "-"));

const aVals = SETUP_WEIGHT_DISPLAY_ORDER.map((k) => mean(withinSd[k]));
const aSum = aVals.reduce((a, b) => a + b, 0);

SETUP_WEIGHT_DISPLAY_ORDER.forEach((k, i) => {
  const a = aVals[i];
  const bR = mean(withinRange[k]);
  const c = mean(ids.map((f) => sd(byFaction[k][f])));
  const share = aSum === 0 ? 0 : (100 * a) / aSum;
  console.log(
    `${LABEL[k].padEnd(10, "　")}  ${a.toFixed(1).padStart(7)}  ${bR.toFixed(1).padStart(7)}  ${c
      .toFixed(1)
      .padStart(9)}  ${share.toFixed(1).padStart(7)}%`
  );
});

console.log("".padEnd(60, "-"));
console.log(`合計スコアの種族間SD（参考）: ${mean(totalWithinSd).toFixed(1)}`);

// 狙いの順序と実測の順序を並べて出す
const want = SETUP_WEIGHT_DISPLAY_ORDER.map((k) => LABEL[k]);
const got = SETUP_WEIGHT_DISPLAY_ORDER.map((k, i) => ({ k, a: aVals[i] }))
  .sort((x, y) => y.a - x.a)
  .map((x) => LABEL[x.k]);
console.log(`\n狙い: ${want.join(" > ")}`);
console.log(`実測: ${got.join(" > ")}`);
