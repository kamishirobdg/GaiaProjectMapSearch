// scripts/_probe_rim.ts
//
// 最外周・外周の扱いの比較（2026-10-03。「開始地点＋到達加重」の実装後）。
//
//   npx tsx scripts/_probe_rim.ts [件数=60] [基本版の H2 上限=3]
//
// 実装と同じ評価（evaluateSoft の既定の評価指数）で惑星ごとの値を取り出し、最外周・外周の
// 扱いだけを差し替えて色の値を作り直す（開始地点の選び直しも含む）。比べるのは
//   V0 現行: 加算 −3 / −1
//   V1 加算 −6 / −2       V2 加算 −8 / −3
//   V3 乗算 ×0.5 / ×0.8   V4 乗算 ×0.7 / ×0.9（正の値に掛ける）
//   V5 周囲の欠け: 距離2以内の盤面セル数/18 を c として 正の値 × (0.5 + 0.5c)
//   V6 周囲の欠け: 距離1以内の盤面セル数/6  を c として 正の値 × (0.5 + 0.5c)
//   NONE 罰点なし（参考）
// 原始・小惑星には最外周・外周を効かせない（2026-07-30 確定）ので対象外。

import { makeSearchPlacementFromSeed } from "../src/gaia/ssot/searchPlacementConfig";
import { buildLogicalMapFromPlacement } from "../src/gaia/logicalMap/buildLogicalMap";
import { extractForEval } from "../src/gaia/eval/extractForEval";
import { evaluateSoft } from "../src/gaia/eval/evaluateSoft";
import { checkHardConstraints } from "../src/gaia/constraints";
import { axialDistance } from "../src/gaia/hex";
import { planStarts, stoneCostForColor, START_COUNT_STANDARD, type PlanetNode } from "../src/gaia/eval/reachCost";

const N = Number(process.argv[2] ?? 60) || 60;
const BASE_OUTER_CAP = Number(process.argv[3] ?? 3) || 3;
const W_OUTER = 3;
const W_TOUCH = 1;

const soft = {
  wOuter: W_OUTER, wTouch: W_TOUCH, wScout: 10, wScoutCore: 4, scoutRadius: 3,
  wScoutByScoutKey: { twilight: 10, eclipse: 10, rebellion: 10, tfmars: 10 },
  wScoutCoreByScoutKey: { twilight: 3, eclipse: 3, rebellion: 3, tfmars: 3 },
  scoutCoreAttributionMode: "all",
  wGaiaDist1: 5, wGaiaDist2: 8, wGaiaDist3: 3, wClusterSize: 1, wImbalance: 1,
} as any;

const BASIC = ["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW"];

type Planet = { key: string; color: string; pos: number; outer: boolean; touch: boolean; cov2: number; cov1: number };
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
    const sa: any = (breakdown.audit as any).startAccess;
    // 盤面上の全セル（空セルも）。周囲の欠け具合の計算に使う
    const cells = (extracted.cells ?? []) as any[];
    const onBoard = new Set(cells.map((c) => `${c.q},${c.r}`));
    const cov = (q: number, r: number, R: number) => {
      let n = 0, total = 0;
      for (let dq = -R; dq <= R; dq++) for (let dr = -R; dr <= R; dr++) {
        if (dq === 0 && dr === 0) continue;
        if (axialDistance(0, 0, dq, dr) > R) continue;
        total++;
        if (onBoard.has(`${q + dq},${r + dr}`)) n++;
      }
      return n / total;
    };
    const byKey = new Map(cells.map((c) => [String(c.key), c]));
    const planets: Planet[] = [];
    for (const c of BASIC) {
      for (const p of sa?.byColor?.[c]?.planets ?? []) {
        const cell = byKey.get(String(p.cellKey));
        if (!cell) continue;
        const outer = extracted.outerCells.has(p.cellKey);
        const touch = extracted.touchCells.has(p.cellKey);
        // 実装の value は現行の加算（−3/−1）込み。正の値へ戻す
        const pos = Number(p.value) + (outer ? W_OUTER : 0) + (touch ? W_TOUCH : 0);
        planets.push({ key: String(p.cellKey), color: c, pos, outer, touch, cov2: cov(cell.q, cell.r, 2), cov1: cov(cell.q, cell.r, 1) });
      }
    }
    const nodes: PlanetNode[] = cells
      .filter((c) => c.isPlanet)
      .map((c) => ({ key: String(c.key), q: c.q, r: c.r, kind: String(c.colorKey ?? c.planetKind ?? "").toUpperCase() }));
    out.push({ planets, nodes });
  }
  return out;
}

type Variant = { id: string; label: string; value: (p: Planet) => number };
const VARIANTS: Variant[] = [
  { id: "V0", label: "現行 加算 −3/−1", value: (p) => p.pos - (p.outer ? 3 : 0) - (p.touch ? 1 : 0) },
  { id: "V1", label: "加算 −6/−2", value: (p) => p.pos - (p.outer ? 6 : 0) - (p.touch ? 2 : 0) },
  { id: "V2", label: "加算 −8/−3", value: (p) => p.pos - (p.outer ? 8 : 0) - (p.touch ? 3 : 0) },
  { id: "V3", label: "乗算 ×0.5/×0.8", value: (p) => p.pos * (p.outer ? 0.5 : p.touch ? 0.8 : 1) },
  { id: "V4", label: "乗算 ×0.7/×0.9", value: (p) => p.pos * (p.outer ? 0.7 : p.touch ? 0.9 : 1) },
  { id: "V5", label: "欠け 距離2 ×(0.5+0.5c)", value: (p) => p.pos * (0.5 + 0.5 * p.cov2) },
  { id: "V6", label: "欠け 距離1 ×(0.5+0.5c)", value: (p) => p.pos * (0.5 + 0.5 * p.cov1) },
  { id: "V7", label: "欠け 距離2 ×(0.25+0.75c)", value: (p) => p.pos * (0.25 + 0.75 * p.cov2) },
  { id: "V8", label: "欠け 距離2 ×c", value: (p) => p.pos * p.cov2 },
  { id: "NONE", label: "罰点なし", value: (p) => p.pos },
];

function colorValues(b: Board, v: Variant): { values: Record<string, number>; starts: Record<string, string[]> } {
  const values: Record<string, number> = {};
  const starts: Record<string, string[]> = {};
  for (const c of BASIC) {
    const mine = b.planets.filter((p) => p.color === c);
    if (mine.length === 0) { values[c] = 0; starts[c] = []; continue; }
    const plan = planStarts({
      nodes: b.nodes,
      candidates: mine.map((p) => ({ key: p.key, value: v.value(p) })),
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
function std(xs: number[]) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length);
}
function ranks(xs: number[]): number[] {
  const idx = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length).fill(0);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}
function spearman(a: number[], b: number[]): number {
  const ra = ranks(a), rb = ranks(b);
  const ma = ra.reduce((x, y) => x + y, 0) / ra.length, mb = rb.reduce((x, y) => x + y, 0) / rb.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < ra.length; i++) { num += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}
const f1 = (v: number) => v.toFixed(1);
const f2 = (v: number) => v.toFixed(2);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

for (const [templateId, outerCap] of [["4p_lostFleet", 1], ["3p_lostFleet", 1], ["base_34p", BASE_OUTER_CAP]] as Array<[string, number]>) {
  const boards = loadBoards(templateId, outerCap);
  console.log(`\n################ ${templateId}  盤面 ${boards.length}件（H2 上限 ${outerCap}。既定の評価指数）`);
  if (boards.length === 0) continue;

  // 惑星の位置と正の値、周囲の欠け具合
  const all = boards.flatMap((b) => b.planets);
  const cls = (p: Planet) => (p.outer ? "最外周" : p.touch ? "外周" : "内側");
  console.log(`  惑星の位置ごとの 個数 / 正の値の平均 / 周囲の欠け c2（距離2以内の盤面セル÷18）の平均と10〜90% / c1（距離1以内÷6）の平均`);
  for (const k of ["内側", "外周", "最外周"]) {
    const ps = all.filter((p) => cls(p) === k);
    if (ps.length === 0) continue;
    const c2 = stat(ps.map((p) => p.cov2)), c1 = stat(ps.map((p) => p.cov1));
    console.log(`    ${k.padEnd(4)} ${String(ps.length).padStart(5)}個 (${pct(ps.length / all.length)})  正の値 ${f1(stat(ps.map((p) => p.pos)).mean).padStart(5)}  c2 ${f2(c2.mean)} (${f2(c2.p10)}〜${f2(c2.p90)})  c1 ${f2(c1.mean)}`);
  }

  // 現行（V0）での開始地点に最外周/外周が入る割合
  const base = boards.map((b) => colorValues(b, VARIANTS[0]));
  let rimStarts = 0, startsN = 0, colorsWithRimStart = 0, colorsN = 0;
  boards.forEach((b, i) => {
    for (const c of BASIC) {
      const ss = base[i].starts[c];
      if (ss.length === 0) continue;
      colorsN++;
      let hit = false;
      for (const k of ss) { startsN++; const p = b.planets.find((x) => x.key === k)!; if (p.outer || p.touch) { rimStarts++; hit = true; } }
      if (hit) colorsWithRimStart++;
    }
  });
  console.log(`  現行の開始地点のうち最外周/外周にあるもの: ${pct(rimStarts / startsN)}。開始地点に最外周/外周を含む色: ${pct(colorsWithRimStart / colorsN)}`);
  const negative = all.filter((p) => VARIANTS[0].value(p) < 0).length;
  console.log(`  現行の加算で惑星の値が負になるもの: ${negative}個 (${pct(negative / all.length)})。乗算なら 0 止まり`);

  const none = boards.map((b) => colorValues(b, VARIANTS[VARIANTS.length - 1]));
  const baseImb = base.map((r) => std(BASIC.map((c) => r.values[c])));
  const baseTop = base.map((r) => BASIC.reduce((m, c) => (r.values[c] > r.values[m] ? c : m), BASIC[0]));
  console.log(`\n  案                        色の値の平均  最上位 中央値   罰点の影響(全体)  開始地点に最外周/外周を含む色での影響  開始地点が最外周/外周  並びの相関(現行比)  最上位色が変わる盤面`);
  for (const v of VARIANTS) {
    const res = v.id === "V0" ? base : v.id === "NONE" ? none : boards.map((b) => colorValues(b, v));
    const vals: number[] = [], tops: number[] = [], imb: number[] = [], delta: number[] = [], condDelta: number[] = [];
    let topChanged = 0, rim = 0, rimN = 0;
    boards.forEach((b, i) => {
      const arr = BASIC.map((c) => res[i].values[c]);
      vals.push(...arr); tops.push(Math.max(...arr)); imb.push(std(arr));
      for (const c of BASIC) {
        const vn = none[i].values[c];
        delta.push(Math.abs(res[i].values[c] - vn));
        // 「罰点なしで選ばれる開始地点」に最外周/外周が入る色だけ
        const nStarts = none[i].starts[c].map((k) => b.planets.find((x) => x.key === k)!);
        if (nStarts.some((p) => p.outer || p.touch) && vn > 0) condDelta.push((res[i].values[c] - vn) / vn);
        for (const k of res[i].starts[c]) { rimN++; const p = b.planets.find((x) => x.key === k)!; if (p.outer || p.touch) rim++; }
      }
      const top = BASIC.reduce((m, c) => (res[i].values[c] > res[i].values[m] ? c : m), BASIC[0]);
      if (top !== baseTop[i]) topChanged++;
    });
    const noneMean = stat(none.flatMap((r) => BASIC.map((c) => r.values[c]))).mean;
    const vs = stat(vals), ts = stat(tops);
    console.log(`  ${v.id.padEnd(4)} ${v.label.padEnd(20)}  ${f1(vs.mean).padStart(7)}      ${f1(ts.med).padStart(6)}        ${pct(stat(delta).mean / noneMean).padStart(6)}            ${pct(stat(condDelta).mean).padStart(7)}                   ${pct(rim / rimN).padStart(6)}          ${spearman(baseImb, imb).toFixed(3)}            ${pct(topChanged / boards.length)}`);
  }
}
