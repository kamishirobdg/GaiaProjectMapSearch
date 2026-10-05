// scripts/_probe_multicolor.ts
//
// 「周辺の多色の惑星」の軸の検討（2026-10-05。eval_v4 の上で）。
//
//   npx tsx scripts/_probe_multicolor.ts [件数=60] [基本版の H2 上限=3]
//
// 問い: 開始地点の周り（通常の到達範囲＝距離2以内）に他色の通常惑星がどれだけあるかを
// 評価に入れる価値があるか。入れるならどの形か。
//
// 実装と同じ評価（既定の評価指数、wRimGap 0.5）で惑星ごとの値を取り出し、候補の加点だけを
// 足して色の値を作り直す（開始地点の選び直しも含む。_probe_rim.ts と同じ作法）。
//
// 候補（惑星 p の加点。他色＝基本7色のうち p の色以外の通常惑星。ガイア・次元横断・原始・小惑星は数えない）
//   A  距離2以内の他色の「色数」× w        （0〜6。ユーザーの当初の測り方）
//   B  距離2以内の他色の「惑星数」× w
//   C  距離2以内の他色の惑星を改造の歩数で重み付け（1歩=1 / 2歩=0.5 / 3歩=0.25）× w
//      （「自分が入植しやすい他色」。改造の輪は reachCost.ts の TERRAFORM_WHEEL）
//   D  距離3以内の他色の「色数」× w
// それぞれ w を 2 / 4 / 6 で比べる。NONE は加点なし（現行）。
//
// 見るもの: 分布（内側／外周／最外周ごとの色数・惑星数）、既存の軸（星系・ガイア・欠けマス）との
// 相関（二重取りになっていないか）、色の値への影響、並びの相関、最上位色が変わる盤面。

import { makeSearchPlacementFromSeed } from "../src/gaia/ssot/searchPlacementConfig";
import { buildLogicalMapFromPlacement } from "../src/gaia/logicalMap/buildLogicalMap";
import { extractForEval } from "../src/gaia/eval/extractForEval";
import { evaluateSoft } from "../src/gaia/eval/evaluateSoft";
import { checkHardConstraints } from "../src/gaia/constraints";
import { axialDistance } from "../src/gaia/hex";
import {
  planStarts,
  stoneCostForColor,
  terraformSteps,
  START_COUNT_STANDARD,
  type PlanetNode,
} from "../src/gaia/eval/reachCost";

const N = Number(process.argv[2] ?? 60) || 60;
const BASE_OUTER_CAP = Number(process.argv[3] ?? 3) || 3;

const soft = {
  wRimGap: 0.5, wScout: 10, wScoutCore: 4, scoutRadius: 3,
  wScoutByScoutKey: { twilight: 10, eclipse: 10, rebellion: 10, tfmars: 10 },
  wScoutCoreByScoutKey: { twilight: 3, eclipse: 3, rebellion: 3, tfmars: 3 },
  scoutCoreAttributionMode: "all",
  wGaiaDist1: 5, wGaiaDist2: 8, wGaiaDist3: 3, wClusterSize: 1, wImbalance: 1,
} as any;

const BASIC = ["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW"];

type Planet = {
  key: string;
  color: string;
  /** 実装の惑星の値（欠けマス罰点込み） */
  value: number;
  pos: "内側" | "外周" | "最外周";
  missing: number;
  cluster: number;
  gaia: number;
  /** 距離2以内の他色: 色数 / 惑星数 / 改造歩数で重み付けした和 */
  colors2: number;
  count2: number;
  steps2: number;
  /** 距離3以内の他色の色数 */
  colors3: number;
};
type Board = { planets: Planet[]; nodes: PlanetNode[] };

function loadBoards(templateId: string, outerCap: number): Board[] {
  const hard = {
    minSameColorDist: 3, outerSameColorMax: outerCap, centerMode: "NONE", maxConnectedPlanets: 0, h5IncludeScouts: false,
    ...(templateId === "base_34p" ? { banSameKindAdjacency: true } : {}),
  } as any;
  const out: Board[] = [];
  let seed = 0;
  while (out.length < N && seed < N * 800) {
    seed++;
    const { placement } = makeSearchPlacementFromSeed({ templateId, seed });
    const lm = buildLogicalMapFromPlacement({ templateId, placement });
    const extracted = extractForEval(lm as any, hard);
    if (!checkHardConstraints(extracted, placement as any, hard).pass) continue;
    const { breakdown } = evaluateSoft(extracted, soft);
    const a: any = breakdown.audit;
    const sa: any = a.startAccess;
    const cells = (extracted.cells ?? []) as any[];
    const byKey = new Map(cells.map((c) => [String(c.key), c]));
    const normals = (extracted.normalPlanetCells as any[]).map((c) => ({ q: c.q, r: c.r, color: String(c.colorKey) }));
    const clusterOf = new Map<string, number>();
    for (const h of a.cluster?.clusterHits ?? []) clusterOf.set(String(h.cellKey), Number(h.size) || 0);
    const gaiaOf = new Map<string, number>();
    for (const h of a.gaiaProximity?.gaiaHits ?? []) gaiaOf.set(String(h.cellKey), (gaiaOf.get(String(h.cellKey)) ?? 0) + Number(h.value));
    const planets: Planet[] = [];
    for (const c of BASIC) {
      for (const p of sa?.byColor?.[c]?.planets ?? []) {
        const cell = byKey.get(String(p.cellKey));
        if (!cell) continue;
        const near2 = normals.filter((n) => n.color !== c && axialDistance(cell.q, cell.r, n.q, n.r) <= 2);
        const near3 = normals.filter((n) => n.color !== c && axialDistance(cell.q, cell.r, n.q, n.r) <= 3);
        planets.push({
          key: String(p.cellKey),
          color: c,
          value: Number(p.value),
          pos: extracted.outerCells.has(p.cellKey) ? "最外周" : extracted.touchCells.has(p.cellKey) ? "外周" : "内側",
          missing: Number(a.rimGap?.missingByCell?.[p.cellKey] ?? 0),
          cluster: clusterOf.get(String(p.cellKey)) ?? 0,
          gaia: gaiaOf.get(String(p.cellKey)) ?? 0,
          colors2: new Set(near2.map((n) => n.color)).size,
          count2: near2.length,
          steps2: near2.reduce((s, n) => s + [0, 1, 0.5, 0.25][terraformSteps(c, n.color)], 0),
          colors3: new Set(near3.map((n) => n.color)).size,
        });
      }
    }
    const nodes: PlanetNode[] = cells
      .filter((c) => c.isPlanet)
      .map((c) => ({ key: String(c.key), q: c.q, r: c.r, kind: String(c.colorKey ?? c.planetKind ?? "").toUpperCase() }));
    out.push({ planets, nodes });
  }
  return out;
}

type Variant = { id: string; label: string; bonus: (p: Planet) => number };
const VARIANTS: Variant[] = [
  { id: "NONE", label: "加点なし（現行）", bonus: () => 0 },
  ...[2, 4, 6].map((w) => ({ id: `A${w}`, label: `色数(距離2)×${w}`, bonus: (p: Planet) => w * p.colors2 })),
  ...[1, 2, 3].map((w) => ({ id: `B${w}`, label: `惑星数(距離2)×${w}`, bonus: (p: Planet) => w * p.count2 })),
  ...[2, 4, 6].map((w) => ({ id: `C${w}`, label: `改造歩数重み(距離2)×${w}`, bonus: (p: Planet) => w * p.steps2 })),
  ...[2, 4].map((w) => ({ id: `D${w}`, label: `色数(距離3)×${w}`, bonus: (p: Planet) => w * p.colors3 })),
];

function colorValues(b: Board, v: Variant) {
  const values: Record<string, number> = {};
  const starts: Record<string, string[]> = {};
  for (const c of BASIC) {
    const mine = b.planets.filter((p) => p.color === c);
    if (mine.length === 0) { values[c] = 0; starts[c] = []; continue; }
    const plan = planStarts({
      nodes: b.nodes,
      candidates: mine.map((p) => ({ key: p.key, value: p.value + v.bonus(p) })),
      stoneCost: stoneCostForColor(c),
      startCount: START_COUNT_STANDARD,
    })!;
    values[c] = plan.total;
    starts[c] = plan.starts;
  }
  return { values, starts };
}

function stat(xs: number[]) {
  const s = xs.slice().sort((a, b) => a - b);
  const q = (f: number) => s[Math.min(s.length - 1, Math.floor(s.length * f))];
  return { n: s.length, mean: s.reduce((a, b) => a + b, 0) / Math.max(1, s.length), med: q(0.5), p10: q(0.1), p90: q(0.9) };
}
function std(xs: number[]) { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); }
function pearson(a: number[], b: number[]) {
  const ma = a.reduce((x, y) => x + y, 0) / a.length, mb = b.reduce((x, y) => x + y, 0) / b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}
function ranks(xs: number[]): number[] {
  const idx = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length).fill(0);
  for (let i = 0; i < idx.length; ) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; }
  return r;
}
const spearman = (a: number[], b: number[]) => pearson(ranks(a), ranks(b));
const f1 = (v: number) => v.toFixed(1);
const f2 = (v: number) => v.toFixed(2);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

for (const [templateId, outerCap] of [["4p_lostFleet", 1], ["3p_lostFleet", 1], ["base_34p", BASE_OUTER_CAP]] as Array<[string, number]>) {
  const boards = loadBoards(templateId, outerCap);
  console.log(`\n################ ${templateId}  盤面 ${boards.length}件（H2 上限 ${outerCap}。既定の評価指数、wRimGap 0.5）`);
  if (boards.length === 0) continue;
  const all = boards.flatMap((b) => b.planets);

  console.log(`  距離2以内の他色（基本7色の通常惑星）。位置ごとの 個数 / 色数の平均（10〜90%） / 惑星数の平均 / 改造歩数重みの平均 / 色数0の割合 / 距離3以内の色数の平均`);
  for (const k of ["内側", "外周", "最外周"] as const) {
    const ps = all.filter((p) => p.pos === k);
    if (ps.length === 0) continue;
    const c2 = stat(ps.map((p) => p.colors2));
    console.log(`    ${k.padEnd(4)} ${String(ps.length).padStart(5)}個  色数 ${f2(c2.mean)} (${c2.p10}〜${c2.p90})  惑星数 ${f2(stat(ps.map((p) => p.count2)).mean)}  歩数重み ${f2(stat(ps.map((p) => p.steps2)).mean)}  色数0 ${pct(ps.filter((p) => p.colors2 === 0).length / ps.length)}  距離3の色数 ${f2(stat(ps.map((p) => p.colors3)).mean)}`);
  }
  const hist: Record<number, number> = {};
  for (const p of all) hist[p.colors2] = (hist[p.colors2] ?? 0) + 1;
  console.log(`  色数(距離2)の分布: ${Object.keys(hist).sort((a, b) => Number(a) - Number(b)).map((k) => `${k}色 ${pct(hist[Number(k)] / all.length)}`).join(" / ")}`);

  // 現行の開始地点での色数
  const base = boards.map((b) => colorValues(b, VARIANTS[0]));
  const startColors: number[] = [];
  boards.forEach((b, i) => { for (const c of BASIC) for (const k of base[i].starts[c]) startColors.push(b.planets.find((p) => p.key === k)!.colors2); });
  const sc = stat(startColors);
  console.log(`  現行の開始地点の色数(距離2): 平均 ${f2(sc.mean)}（10〜90%: ${sc.p10}〜${sc.p90}）。全惑星の平均 ${f2(stat(all.map((p) => p.colors2)).mean)}`);

  // 既存の軸との相関（惑星単位）
  console.log(`  惑星単位の相関: 色数(距離2) と 欠けマス数 ${f2(pearson(all.map((p) => p.colors2), all.map((p) => p.missing)))} / 星系の大きさ ${f2(pearson(all.map((p) => p.colors2), all.map((p) => p.cluster)))} / ガイア加点 ${f2(pearson(all.map((p) => p.colors2), all.map((p) => p.gaia)))} / 惑星の値 ${f2(pearson(all.map((p) => p.colors2), all.map((p) => p.value)))}`);
  console.log(`                  惑星数(距離2) と 欠けマス数 ${f2(pearson(all.map((p) => p.count2), all.map((p) => p.missing)))} / 星系の大きさ ${f2(pearson(all.map((p) => p.count2), all.map((p) => p.cluster)))}`);

  const baseImb = base.map((r) => std(BASIC.map((c) => r.values[c])));
  const baseTop = base.map((r) => BASIC.reduce((m, c) => (r.values[c] > r.values[m] ? c : m), BASIC[0]));
  const baseMean = stat(base.flatMap((r) => BASIC.map((c) => r.values[c]))).mean;
  console.log(`\n  案                        色の値の平均  最上位 中央値  加点の影響(全体)  開始地点が変わる色  並びの相関(現行比)  最上位色が変わる盤面`);
  for (const v of VARIANTS) {
    const res = v.id === "NONE" ? base : boards.map((b) => colorValues(b, v));
    const vals: number[] = [], tops: number[] = [], imb: number[] = [], delta: number[] = [];
    let topChanged = 0, startChanged = 0, colorsN = 0;
    boards.forEach((b, i) => {
      const arr = BASIC.map((c) => res[i].values[c]);
      vals.push(...arr); tops.push(Math.max(...arr)); imb.push(std(arr));
      for (const c of BASIC) {
        delta.push(Math.abs(res[i].values[c] - base[i].values[c]));
        if (base[i].starts[c].length) { colorsN++; if (res[i].starts[c].slice().sort().join("|") !== base[i].starts[c].slice().sort().join("|")) startChanged++; }
      }
      const top = BASIC.reduce((m, c) => (res[i].values[c] > res[i].values[m] ? c : m), BASIC[0]);
      if (top !== baseTop[i]) topChanged++;
    });
    const vs = stat(vals), ts = stat(tops);
    console.log(`  ${v.id.padEnd(5)} ${v.label.padEnd(20)}  ${f1(vs.mean).padStart(7)}      ${f1(ts.med).padStart(6)}        ${pct(stat(delta).mean / baseMean).padStart(6)}          ${pct(startChanged / colorsN).padStart(6)}            ${spearman(baseImb, imb).toFixed(3)}            ${pct(topChanged / boards.length)}`);
  }
}
