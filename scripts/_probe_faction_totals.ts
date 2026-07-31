// scripts/_probe_faction_totals.ts
//
// 「どの種族が強く出ているか」を**テーブルだけ**から見る（2026-08-01）。
// セットアップを引かずに TILE_FACTION_WEIGHTS / TECH_POSITION_WEIGHTS を素で数えるので、
// factionWeights.ts を編集しながら「入れすぎ／入れなさすぎ」を確かめられる。
//
//   npx tsx scripts/_probe_faction_totals.ts [--by-category]
//
// 見かた:
//   枚数  … その種族に非ゼロの値が入っているタイルの数（正の枚数 / 負の枚数）
//   素点  … 値の単純合計（正の合計 + 負の合計）
//   期待値… 「1ゲームで実際に場に出る枚数」で割り引いた値。カテゴリごとに
//           出る枚数が違う（上級は21枚中6枚、ラウンド得点は13枚中6枚…）ので、
//           素点の大小はそのままでは比べられない。**強さの目安はこちら**。
// 正規化しない方針（案C）なので差が出ること自体は設計どおり。見るのは差の「幅」。

import {
  FACTIONS,
  TECH_POSITION_WEIGHTS,
  TILE_FACTION_WEIGHTS,
  type FactionId,
} from "../src/gaia/eval/factionWeights";
import { SETUP_CATALOG } from "../src/gaia/setup/data";
import {
  DEFAULT_SETUP_WEIGHTS,
  type SetupWeightKey,
} from "../src/gaia/eval/setupWeights";

const BY_CATEGORY = process.argv.includes("--by-category");

/** カテゴリ → そのカテゴリのタイルID群と「プールの何枚が場に出るか」（4人LF）。 */
const POOL: Array<{
  key: SetupWeightKey;
  label: string;
  ids: string[];
  drawn: number;
}> = [
  {
    key: "advanced",
    label: "上級",
    ids: [...SETUP_CATALOG.advancedTech, ...(SETUP_CATALOG.advancedTechLF ?? [])].map((t) => t.id),
    drawn: 6,
  },
  {
    key: "advExtension",
    label: "追加上級",
    ids: [...SETUP_CATALOG.advancedTech, ...(SETUP_CATALOG.advancedTechLF ?? [])].map((t) => t.id),
    drawn: 1,
  },
  {
    key: "booster",
    label: "ブースター",
    ids: [...SETUP_CATALOG.boosters, ...(SETUP_CATALOG.boostersLF ?? [])].map((t) => t.id),
    drawn: 7, // 4人 = players + 3
  },
  {
    key: "roundScoring",
    label: "ラウンド",
    ids: [...SETUP_CATALOG.roundScoring, ...(SETUP_CATALOG.roundScoringLF ?? [])].map((t) => t.id),
    drawn: 6,
  },
  {
    key: "finalScoring",
    label: "最終",
    ids: [...SETUP_CATALOG.finalScoring, ...(SETUP_CATALOG.finalScoringLF ?? [])].map((t) => t.id),
    drawn: 2,
  },
  {
    key: "federation",
    label: "同盟",
    ids: SETUP_CATALOG.federations.map((t) => t.id),
    drawn: 1,
  },
  {
    key: "lfShip",
    label: "LF船",
    // 船の基本技術3種のうち3ヶ所 + 金枠同盟8枚から4枚 + アーティファクト13枚から4枚
    ids: [
      ...(SETUP_CATALOG.standardTechLF ?? []).map((t) => t.id),
      ...(SETUP_CATALOG.federationsGold ?? []).map((t) => t.id),
      ...(SETUP_CATALOG.artifacts ?? []).map((t) => t.id),
    ],
    drawn: 3 + 4 + 4,
  },
];

type Row = {
  id: FactionId;
  label: string;
  color: string;
  posCount: number;
  negCount: number;
  posSum: number;
  negSum: number;
  expected: number;
  byCat: Partial<Record<SetupWeightKey, number>>;
};

const rows: Row[] = FACTIONS.map((f) => {
  let posCount = 0;
  let negCount = 0;
  let posSum = 0;
  let negSum = 0;
  let expected = 0;
  const byCat: Partial<Record<SetupWeightKey, number>> = {};

  for (const cat of POOL) {
    let sum = 0;
    for (const id of cat.ids) {
      const v = TILE_FACTION_WEIGHTS[id]?.[f.id] ?? 0;
      if (v === 0) continue;
      sum += v;
      if (v > 0) {
        posCount++;
        posSum += v;
      } else {
        negCount++;
        negSum += v;
      }
    }
    // 期待値: プール平均 × 出る枚数 × 評価指数
    const e = (sum / cat.ids.length) * cat.drawn * DEFAULT_SETUP_WEIGHTS[cat.key];
    byCat[cat.key] = e;
    expected += e;
  }

  // 標準技術は9種が必ず全部出る。どの列に置かれるかは等確率とみなして
  // 7通り（研究列6 + フリー）の平均を取る。
  let techSum = 0;
  for (const tile of Object.values(TECH_POSITION_WEIGHTS)) {
    const cells = Object.values(tile);
    let s = 0;
    for (const cell of cells) {
      const v = cell?.[f.id] ?? 0;
      if (v === 0) continue;
      s += v;
      if (v > 0) {
        posCount++;
        posSum += v;
      } else {
        negCount++;
        negSum += v;
      }
    }
    techSum += s / cells.length;
  }
  const techExpected = techSum * DEFAULT_SETUP_WEIGHTS.standardTech;
  byCat.standardTech = techExpected;
  expected += techExpected;

  return {
    id: f.id,
    label: f.labelJa,
    color: f.color,
    posCount,
    negCount,
    posSum,
    negSum,
    expected,
    byCat,
  };
});

rows.sort((a, b) => b.expected - a.expected);

const pad = (s: string, n: number) => s + "　".repeat(Math.max(0, n - [...s].length));

console.log("テーブルだけから見た種族の強さ（セットアップは引いていない）\n");
console.log("種族　　　　　　　　 母星色    枚数(+/-)   素点(+/-)     期待値");
console.log("".padEnd(68, "-"));
for (const r of rows) {
  console.log(
    `${pad(r.label, 10)} ${r.color.padEnd(9)} ${String(r.posCount).padStart(3)}/${String(
      r.negCount
    ).padStart(2)}   ${String(r.posSum).padStart(4)}/${String(r.negSum).padStart(3)}   ${r.expected
      .toFixed(1)
      .padStart(8)}`
  );
}

const exp = rows.map((r) => r.expected);
const top = exp[0];
const bottom = exp[exp.length - 1];
console.log("".padEnd(68, "-"));
console.log(`最大 ${top.toFixed(1)} / 最小 ${bottom.toFixed(1)} / 比 ${(top / bottom).toFixed(2)}倍`);

// 母星色ごと（同じ色の2種族のうち強い方＝Setup の色優遇の掛け先と同じ見かた）
const byColor = new Map<string, number>();
for (const r of rows) {
  const cur = byColor.get(r.color);
  if (cur == null || r.expected > cur) byColor.set(r.color, r.expected);
}
console.log(`\n母星色ごと（その色でいちばん強い種族）:`);
for (const [c, v] of [...byColor.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${c.padEnd(9)} ${v.toFixed(1)}`);
}

if (BY_CATEGORY) {
  const cats: SetupWeightKey[] = [
    "standardTech",
    "lfShip",
    "advanced",
    "booster",
    "roundScoring",
    "finalScoring",
    "advExtension",
    "federation",
  ];
  console.log(`\nカテゴリ別の期待値:`);
  console.log(`種族　　　　　　　　 ${cats.map((c) => c.slice(0, 8).padStart(9)).join("")}`);
  for (const r of rows) {
    console.log(
      `${pad(r.label, 10)} ${cats.map((c) => (r.byCat[c] ?? 0).toFixed(1).padStart(9)).join("")}`
    );
  }
}
