// scripts/measure_extra_best.ts
//
// 原始・小惑星の「最良の1つ」に掛ける補正値を実測で決めるための計測
// （TODO 残タスク1、2026-07-31）。
//
//   npx tsx scripts/measure_extra_best.ts [件数]
//
// 出す数字:
//   - 最良値(raw)   : 種別ごとに「4軸合計がいちばん大きい惑星」のその合計（補正前）
//   - 基本7色の平均 : planetTypeTotals の7色平均（内訳表の「評価」列と同じ物差し）
//   - 単純合算      : 従来の extraByKind の合計（何を置き換えたのかの比較用）
//
// 補正値は「最良値 × C ≒ 基本7色の平均」になる C を目安にする。

import { makeSearchPlacementFromSeed } from "../src/gaia/ssot/searchPlacementConfig";
import { buildLogicalMapFromPlacement } from "../src/gaia/logicalMap/buildLogicalMap";
import { extractForEval } from "../src/gaia/eval/extractForEval";
import { evaluateSoft } from "../src/gaia/eval/evaluateSoft";
const N = Number(process.argv[2] ?? 24) || 24;

// src/app/board/page.tsx の DEFAULT_CONDITIONS と同じ既定値（"use client" なので
// スクリプトから import できない。値を変えたら両方直す）。
const D = {
  centerMode: "NONE",
  maxConnectedPlanets: 0,
  h5IncludeScouts: false,
  wOuter: 3,
  wTouch: 1,
  wScout: 10,
  wScoutCore: 4,
  wScoutShips: [10, 10, 10, 10],
  wScoutCoreShips: [3, 3, 3, 3],
  scoutCoreAttribBest: false,
  scoutRadius: 3,
  wGaiaDist1: 5,
  wGaiaDist2: 8,
  wGaiaDist3: 3,
  wClusterSize: 1,
};

const hard = {
  outerSameColorMax: 1,
  centerMode: D.centerMode,
  maxConnectedPlanets: D.maxConnectedPlanets,
  h5IncludeScouts: D.h5IncludeScouts,
} as any;

const soft = {
  wOuter: D.wOuter,
  wTouch: D.wTouch,
  wScout: D.wScout,
  wScoutCore: D.wScoutCore,
  scoutRadius: D.scoutRadius,
  wScoutByScoutKey: {
    twilight: D.wScoutShips[0],
    eclipse: D.wScoutShips[1],
    rebellion: D.wScoutShips[2],
    tfmars: D.wScoutShips[3],
  },
  wScoutCoreByScoutKey: {
    twilight: D.wScoutCoreShips[0],
    eclipse: D.wScoutCoreShips[1],
    rebellion: D.wScoutCoreShips[2],
    tfmars: D.wScoutCoreShips[3],
  },
  scoutCoreAttributionMode: D.scoutCoreAttribBest ? "best" : "all",
  wGaiaDist1: D.wGaiaDist1,
  wGaiaDist2: D.wGaiaDist2,
  wGaiaDist3: D.wGaiaDist3,
  wClusterSize: D.wClusterSize,
} as any;

type Row = { kind: string; raw: number; sum: number; base: number };
const rows: Row[] = [];

for (const templateId of ["4p_lostFleet", "3p_lostFleet"]) {
  for (let seed = 1; seed <= N; seed++) {
    const { placement } = makeSearchPlacementFromSeed({ templateId, seed });
    const lm = buildLogicalMapFromPlacement({ templateId, placement });
    const extracted = extractForEval(lm as any, hard);
    const { breakdown } = evaluateSoft(extracted, soft);
    const a: any = breakdown.audit;

    const totals = breakdown.planetTypeTotals as Record<string, number>;
    const baseAvg =
      Object.values(totals).reduce((s, v) => s + (Number(v) || 0), 0) / Object.keys(totals).length;

    const ex = (o: any, k: string) => Number(o?.[k] ?? 0) || 0;
    for (const kind of ["PROTO", "ASTEROID"]) {
      const best = a.extraBest?.[kind];
      if (!best) continue;
      const sum =
        ex(a.scout?.extraByKind, kind) +
        ex(a.scoutCore?.extraByKind, kind) +
        ex(a.gaiaProximity?.extraByKind, kind) +
        ex(a.cluster?.extraByKind, kind);
      rows.push({ kind, raw: best.raw, sum, base: baseAvg });
    }
  }
}

function stat(xs: number[]) {
  const s = xs.slice().sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return { n: s.length, mean, med: s[Math.floor(s.length / 2)], min: s[0], max: s[s.length - 1] };
}

console.log(`盤面 ${N}件 × 2テンプレ（既定の評価指数）`);
for (const kind of ["PROTO", "ASTEROID"]) {
  const mine = rows.filter((r) => r.kind === kind);
  if (mine.length === 0) {
    console.log(`\n${kind}: 該当なし`);
    continue;
  }
  const raw = stat(mine.map((r) => r.raw));
  const sum = stat(mine.map((r) => r.sum));
  const base = stat(mine.map((r) => r.base));
  console.log(`\n=== ${kind} (${raw.n}盤面) ===`);
  console.log(`  最良値(raw)   平均 ${raw.mean.toFixed(2)}  中央 ${raw.med.toFixed(2)}  範囲 ${raw.min.toFixed(2)}〜${raw.max.toFixed(2)}`);
  console.log(`  単純合算      平均 ${sum.mean.toFixed(2)}  中央 ${sum.med.toFixed(2)}  範囲 ${sum.min.toFixed(2)}〜${sum.max.toFixed(2)}`);
  console.log(`  基本7色の平均 平均 ${base.mean.toFixed(2)}  中央 ${base.med.toFixed(2)}  範囲 ${base.min.toFixed(2)}〜${base.max.toFixed(2)}`);
  console.log(`  → 補正値 C = 基本7色の平均 / 最良値 = ${(base.mean / raw.mean).toFixed(3)} (中央値どうしなら ${(base.med / raw.med).toFixed(3)})`);
  console.log(`     参考: 単純合算は最良値の ${(sum.mean / raw.mean).toFixed(2)} 倍`);
}
