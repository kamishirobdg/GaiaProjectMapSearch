// scripts/_probe_expected_score.ts
//
// 「実プレイで実際に取れる枚数」を考慮した期待得点の試算（2026-08-04 ユーザー指示）。
//
// いまの評価は**場に出ている全タイルの値を足している**ので、種族あたり1300〜1500に
// なる。実際に取れるのは一部なので、カテゴリごとに「値の高い順にN枚」だけを合計すると
// 何点になるかを測る。N はユーザーの実プレイ感覚（2026-08-04）:
//   標準技術   9枚出て 6〜8枚（→7）
//   上級技術   6枚出て 2枚前後
//   ラウンド得点 6ラウンドのうち、中盤と終盤で2回大きく取れれば十分（→2）
//   ブースター 毎ラウンド必ず1枚を持つ（6R → 6）
//   同盟タイル 3〜5枚取得する（→ ただし評価対象は惑星改造Lv5の1枚だけなので1）
// 残り（追加上級・最終得点・LF船）は仮置き。下の TAKE を直して試せる。
//
//   npx tsx scripts/_probe_expected_score.ts [件数] [人数] [--base] [--scaled]
//
// 既定は**係数1**（VP をそのまま足す）。--scaled で既定の評価指数を掛けた値も出す。

import { buildSetupFromSeed, defaultAdvancedTileRules } from "../src/gaia/setup/buildSetup";
import { setupFactionTileHits } from "../src/gaia/eval/factionEval";
import {
  DEFAULT_SETUP_WEIGHTS,
  SETUP_WEIGHT_DISPLAY_ORDER,
  type SetupWeightKey,
  type SetupWeights,
} from "../src/gaia/eval/setupWeights";
import { factionIdsForMode } from "../src/gaia/eval/factionWeights";

const N = Number(process.argv[2] ?? 200) || 200;
const PLAYERS = Number(process.argv[3] ?? 4) || 4;
const LF = !process.argv.includes("--base");
const SCALED = process.argv.includes("--scaled");

/** 実プレイで取れる枚数（場に出ている枚数ではない）。 */
const TAKE: Record<SetupWeightKey, number> = {
  standardTech: 7, // 9枚出て6〜8枚
  advanced: 2, // 6枚出て2枚前後
  advExtension: 1, // 拡張部の1枚（出れば狙える想定・仮）
  roundScoring: 2, // 6ラウンドのうち大きく取れるのは2回
  booster: 6, // 毎ラウンド1枚 × 6ラウンド
  finalScoring: 2, // 2枚とも最後まで競う
  federation: 1, // 惑星改造Lv5の1枚
  lfShip: 3, // 船へ到達して取れるぶん（仮）
};

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

const ONES: SetupWeights = {
  advanced: 1,
  advExtension: 1,
  booster: 1,
  roundScoring: 1,
  finalScoring: 1,
  federation: 1,
  standardTech: 1,
  lfShip: 1,
};
const weights = SCALED ? DEFAULT_SETUP_WEIGHTS : ONES;

function mean(xs: number[]) {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

const ids = factionIdsForMode(LF);
/** perCat[cat] = 盤面ごとの「上位N枚の合計」を種族ぶん集めたもの */
const perCat: Record<string, number[]> = {};
for (const k of SETUP_WEIGHT_DISPLAY_ORDER) perCat[k] = [];
const totals: number[] = [];
const bestOfBoard: number[] = [];

for (let i = 0; i < N; i++) {
  const result = buildSetupFromSeed({
    seed: `exp-${i}`,
    playerCount: PLAYERS,
    ...(LF ? { mode: "lostFleet" as const } : {}),
    tileRules: defaultAdvancedTileRules(),
  });
  const hits = setupFactionTileHits(result, weights);

  // カテゴリ×種族 → そのセットアップで得られる値のリスト
  const pool: Record<string, Record<string, number[]>> = {};
  for (const k of SETUP_WEIGHT_DISPLAY_ORDER) {
    pool[k] = {};
    for (const f of ids) pool[k][f] = [];
  }
  for (const h of hits) {
    for (const [f, v] of Object.entries(h.byFaction)) {
      if (pool[h.category]?.[f]) pool[h.category][f].push(v as number);
    }
  }

  const byFaction: Record<string, number> = {};
  for (const f of ids) byFaction[f] = 0;
  for (const k of SETUP_WEIGHT_DISPLAY_ORDER) {
    for (const f of ids) {
      // 値の高い順に TAKE[k] 枚（＝噛み合うタイルから取る）
      const top = pool[k][f].slice().sort((a, b) => b - a).slice(0, TAKE[k]);
      const s = top.reduce((a, b) => a + b, 0);
      perCat[k].push(s);
      byFaction[f] += s;
    }
  }
  for (const f of ids) totals.push(byFaction[f]);
  bestOfBoard.push(Math.max(...ids.map((f) => byFaction[f])));
}

console.log(
  `セットアップ ${N}件（${PLAYERS}人 ${LF ? "拡張版LF" : "通常版"}・` +
    `${SCALED ? "既定の評価指数" : "係数1（VP そのまま）"}・既定の除外）\n`
);
console.log("カテゴリ      取る枚数   1種族あたりの平均");
console.log("------------------------------------------------");
for (const k of SETUP_WEIGHT_DISPLAY_ORDER) {
  const label = LABEL[k].padEnd(8, "　");
  console.log(
    `${label}  ${String(TAKE[k]).padStart(4)}枚 ${mean(perCat[k]).toFixed(1).padStart(14)}`
  );
}
console.log("------------------------------------------------");
console.log(`合計（1種族あたりの平均）: ${mean(totals).toFixed(1)}`);
console.log(`盤面ごとの最強種族の平均 : ${mean(bestOfBoard).toFixed(1)}`);
console.log(`最小 ${Math.min(...totals).toFixed(0)} / 最大 ${Math.max(...totals).toFixed(0)}`);
