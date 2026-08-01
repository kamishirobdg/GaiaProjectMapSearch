// scripts/_probe_extra_best_bias.ts
//
// 原始・小惑星の補正値（EXTRA_BEST_FACTOR）を決め直すための調査
// （TODO 残タスク1、2026-08-02）。
//
//   npx tsx scripts/_probe_extra_best_bias.ts [件数]
//
// measure_extra_best.ts は「最良値の平均」と「基本7色の平均」の比だけを出すが、
// PROTO と ASTEROID で最良値に差が出る理由（質の差か、個数が多いことによる
// 最大値の上振れか）が分からない。ここでは次を出す:
//
//   1. 種別ごとの惑星個数の分布
//   2. 個数で層別した最良値 → 同じ個数どうしで PROTO と ASTEROID に差があるか
//   3. 基本7色の「1色あたりの合計 / 個数 / 1惑星あたり」
//   4. 基本7色の「最良の1惑星」相当（色ごとの合計を個数で割った値の最大ではなく、
//      色ごとの合計そのものの分布）と、合算/最良比

import { makeSearchPlacementFromSeed } from "../src/gaia/ssot/searchPlacementConfig";
import { buildLogicalMapFromPlacement } from "../src/gaia/logicalMap/buildLogicalMap";
import { extractForEval } from "../src/gaia/eval/extractForEval";
import { evaluateSoft } from "../src/gaia/eval/evaluateSoft";

const N = Number(process.argv[2] ?? 60) || 60;

// src/app/board/page.tsx の DEFAULT_CONDITIONS と同じ既定値
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

type ExtraRow = { kind: string; count: number; raw: number; sum: number };
type ColorRow = { color: string; count: number; total: number; best4: number; sum4: number };

const extraRows: ExtraRow[] = [];
const colorRows: ColorRow[] = [];
const baseAvgs: number[] = [];

const BASIC = new Set(["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW"]);

for (const templateId of ["4p_lostFleet", "3p_lostFleet"]) {
  for (let seed = 1; seed <= N; seed++) {
    const { placement } = makeSearchPlacementFromSeed({ templateId, seed });
    const lm = buildLogicalMapFromPlacement({ templateId, placement });
    const extracted = extractForEval(lm as any, hard);
    const { breakdown } = evaluateSoft(extracted, soft);
    const a: any = breakdown.audit;

    // 種別ごとの惑星個数
    const kindCount: Record<string, number> = { PROTO: 0, ASTEROID: 0 };
    for (const p of extracted.planetCells) {
      const k = String((p as any).planetKind ?? "").toUpperCase();
      if (k in kindCount) kindCount[k] += 1;
    }

    const totals = breakdown.planetTypeTotals as Record<string, number>;
    const baseAvg =
      Object.values(totals).reduce((s, v) => s + (Number(v) || 0), 0) / Object.keys(totals).length;
    baseAvgs.push(baseAvg);

    // 基本7色も「惑星ごとの4軸値」を組み直して、色ごとの最良1惑星を出す。
    // 原始・小惑星の extraByPlanet と同じ4軸（船接触・船星系・ガイア・星系）だけを見る。
    const per = new Map<string, { color: string; v: number }>();
    const addPer = (cellKey: string, planetType: string, v: number) => {
      if (!BASIC.has(String(planetType))) return;
      const e = per.get(cellKey) ?? { color: String(planetType), v: 0 };
      e.v += v;
      per.set(cellKey, e);
    };
    for (const h of a.scout?.scoutHits ?? []) addPer(h.planetKey, h.planetType, Number(h.value) || 0);
    for (const h of a.scoutCore?.coreHits ?? []) addPer(h.corePlanetKey, h.corePlanetType, Number(h.value) || 0);
    for (const h of a.gaiaProximity?.gaiaHits ?? []) addPer(h.cellKey, h.planetType, Number(h.value) || 0);
    for (const h of a.cluster?.clusterHits ?? [])
      addPer(h.cellKey, h.planetType, (Number(h.size) || 0) * (Number(a.cluster?.weight) || 0));

    const best4ByColor: Record<string, number> = {};
    const sum4ByColor: Record<string, number> = {};
    for (const { color, v } of per.values()) {
      best4ByColor[color] = Math.max(best4ByColor[color] ?? 0, v);
      sum4ByColor[color] = (sum4ByColor[color] ?? 0) + v;
    }

    for (const [color, cells] of Object.entries(extracted.normalPlanetsByColor)) {
      colorRows.push({
        color,
        count: (cells as any[]).length,
        total: Number(totals[color] ?? 0),
        best4: best4ByColor[color] ?? 0,
        sum4: sum4ByColor[color] ?? 0,
      });
    }

    const ex = (o: any, k: string) => Number(o?.[k] ?? 0) || 0;
    for (const kind of ["PROTO", "ASTEROID"]) {
      const best = a.extraBest?.[kind];
      if (!best) continue;
      const sum =
        ex(a.scout?.extraByKind, kind) +
        ex(a.scoutCore?.extraByKind, kind) +
        ex(a.gaiaProximity?.extraByKind, kind) +
        ex(a.cluster?.extraByKind, kind);
      extraRows.push({ kind, count: kindCount[kind], raw: best.raw, sum });
    }
  }
}

function stat(xs: number[]) {
  const s = xs.slice().sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return { n: s.length, mean, med: s[Math.floor(s.length / 2)], min: s[0], max: s[s.length - 1] };
}
const f2 = (v: number) => v.toFixed(2);

console.log(`盤面 ${N}件 × 2テンプレ（既定の評価指数）\n`);

const baseAvgStat = stat(baseAvgs);
console.log(`基本7色の平均（内訳表の「評価」列の7色平均）: 平均 ${f2(baseAvgStat.mean)} / 中央 ${f2(baseAvgStat.med)}\n`);

console.log("=== 1. 種別ごとの惑星個数 ===");
for (const kind of ["PROTO", "ASTEROID"]) {
  const mine = extraRows.filter((r) => r.kind === kind);
  const c = stat(mine.map((r) => r.count));
  const hist = new Map<number, number>();
  for (const r of mine) hist.set(r.count, (hist.get(r.count) ?? 0) + 1);
  const histStr = [...hist.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, v]) => `${k}個:${v}`)
    .join(" / ");
  console.log(`  ${kind.padEnd(8)} 平均 ${f2(c.mean)} 個  範囲 ${c.min}〜${c.max}   ${histStr}`);
}

console.log("\n=== 2. 個数で層別した最良値(raw) ===");
console.log("   同じ個数どうしで差が無ければ、種別間の差は「個数が多いほど最良値が上振れする」だけ");
const counts = [...new Set(extraRows.map((r) => r.count))].sort((a, b) => a - b);
console.log(`   ${"個数".padEnd(6)} ${"PROTO".padEnd(22)} ASTEROID`);
for (const c of counts) {
  const cell = (kind: string) => {
    const mine = extraRows.filter((r) => r.kind === kind && r.count === c);
    if (mine.length === 0) return "-".padEnd(22);
    const s = stat(mine.map((r) => r.raw));
    return `${f2(s.mean)} (n=${s.n})`.padEnd(22);
  };
  console.log(`   ${String(c).padEnd(6)} ${cell("PROTO")} ${cell("ASTEROID")}`);
}

console.log("\n=== 3. 基本7色の1色あたり ===");
const colorAll = stat(colorRows.map((r) => r.total));
const colorCnt = stat(colorRows.map((r) => r.count));
const perPlanet = stat(colorRows.filter((r) => r.count > 0).map((r) => r.total / r.count));
console.log(`  色ごとの合計   平均 ${f2(colorAll.mean)}  範囲 ${f2(colorAll.min)}〜${f2(colorAll.max)}`);
console.log(`  色ごとの個数   平均 ${f2(colorCnt.mean)} 個  範囲 ${colorCnt.min}〜${colorCnt.max}`);
console.log(`  1惑星あたり    平均 ${f2(perPlanet.mean)}  範囲 ${f2(perPlanet.min)}〜${f2(perPlanet.max)}`);
console.log(`  ※ 上の「合計」は最外周・外周も入る（内訳表の評価列そのもの）`);
const best4 = stat(colorRows.map((r) => r.best4));
const sum4 = stat(colorRows.map((r) => r.sum4));
console.log(`  4軸だけの合計  平均 ${f2(sum4.mean)}  範囲 ${f2(sum4.min)}〜${f2(sum4.max)}`);
console.log(`  4軸の最良1惑星 平均 ${f2(best4.mean)}  範囲 ${f2(best4.min)}〜${f2(best4.max)}`);
console.log(`  → 基本色の「色合計 / 最良1惑星」比 R = ${(colorAll.mean / best4.mean).toFixed(3)}`);
console.log(`     （4軸どうしなら ${(sum4.mean / best4.mean).toFixed(3)}）`);

console.log("\n=== 4. 補正値の候補 ===");
const protoRaw = stat(extraRows.filter((r) => r.kind === "PROTO").map((r) => r.raw));
const astRaw = stat(extraRows.filter((r) => r.kind === "ASTEROID").map((r) => r.raw));
const allRaw = stat(extraRows.map((r) => r.raw));
const B = baseAvgStat.mean;
console.log(`  最良値(raw) 平均: PROTO ${f2(protoRaw.mean)} / ASTEROID ${f2(astRaw.mean)} / まとめて ${f2(allRaw.mean)}`);
console.log(`  A. 共通・全体平均合わせ（現行 2.75）: C=${(B / allRaw.mean).toFixed(3)}`);
console.log(`     → PROTO ${f2(protoRaw.mean * 2.75)} (${((protoRaw.mean * 2.75) / B * 100 - 100).toFixed(1)}%) / ASTEROID ${f2(astRaw.mean * 2.75)} (${((astRaw.mean * 2.75) / B * 100 - 100).toFixed(1)}%)`);
console.log(`  B. 種別ごとに合わせる: PROTO C=${(B / protoRaw.mean).toFixed(3)} / ASTEROID C=${(B / astRaw.mean).toFixed(3)}`);
console.log(`     → 0.25刻みに丸めると PROTO ${(Math.round((B / protoRaw.mean) * 4) / 4).toFixed(2)} / ASTEROID ${(Math.round((B / astRaw.mean) * 4) / 4).toFixed(2)}`);
const protoSum = stat(extraRows.filter((r) => r.kind === "PROTO").map((r) => r.sum));
const astSum = stat(extraRows.filter((r) => r.kind === "ASTEROID").map((r) => r.sum));
console.log(`  C. 単純合算に戻す（C=1）: PROTO ${f2(protoSum.mean)} / ASTEROID ${f2(astSum.mean)} ← 参考`);
const R = colorAll.mean / best4.mean;
console.log(`  D. 基本色と同じ「最良1惑星→色合計」の換算率: C=${R.toFixed(3)}（0.25刻みで ${(Math.round(R * 4) / 4).toFixed(2)}）`);
console.log(`     → PROTO ${f2(protoRaw.mean * R)} (${((protoRaw.mean * R) / B * 100 - 100).toFixed(1)}%) / ASTEROID ${f2(astRaw.mean * R)} (${((astRaw.mean * R) / B * 100 - 100).toFixed(1)}%)`);
