// scripts/_probe_rim.ts
//
// 最外周・外周の扱いの比較（2026-10-03。「開始地点＋到達加重」の実装後）。
// 2026-10-04 に「欠けマス × w」（w = 0.5、eval_v4）で実装した。このスクリプトは
// 実装の判定基準「端のマイナスは基本版で大きく効き、LF ではほぼ効かない」の確認と、
// 実装（IMPL）と机上の案 G5 が一致することの自己検算に使う。
//
//   npx tsx scripts/_probe_rim.ts [件数=60] [基本版の H2 上限=3]
//
// 実装と同じ評価（evaluateSoft の既定の評価指数、ただし端の罰点なし）で惑星ごとの正の値を
// 取り出し、端の罰点だけを差し替えて色の値を作り直す（開始地点の選び直しも含む）。比べるのは
//   V0 eval_v3 まで: 加算 −3 / −1
//   V1 加算 −6 / −2       V2 加算 −8 / −3
//   V3 乗算 ×0.5 / ×0.8   V4 乗算 ×0.7 / ×0.9（正の値に掛ける）
//   V5 周囲の欠け: 距離2以内の盤面セル数/18 を c として 正の値 × (0.5 + 0.5c)
//   V6 周囲の欠け: 距離1以内の盤面セル数/6  を c として 正の値 × (0.5 + 0.5c)
//   V7 / V8 同じく ×(0.25+0.75c) / ×c
//   G4 / G5 / G10 欠けマス1つにつき 0.4 / 0.5 / 1.0 点（G5 が eval_v4 の実装）
//   NONE 罰点なし（参考）
// 原始・小惑星（LF4種族）にも同じ罰点を掛けたときの効果を末尾に出す（eval_v4 から掛けている）。

import { makeSearchPlacementFromSeed } from "../src/gaia/ssot/searchPlacementConfig";
import { buildLogicalMapFromPlacement } from "../src/gaia/logicalMap/buildLogicalMap";
import { extractForEval } from "../src/gaia/eval/extractForEval";
import { evaluateSoft } from "../src/gaia/eval/evaluateSoft";
import { checkHardConstraints } from "../src/gaia/constraints";
import { axialDistance } from "../src/gaia/hex";
import {
  planStarts,
  stoneCostForColor,
  stoneCostForLfFaction,
  START_COUNT_LF,
  START_COUNT_STANDARD,
  type LfFactionId,
  type PlanetNode,
} from "../src/gaia/eval/reachCost";

const N = Number(process.argv[2] ?? 60) || 60;
const BASE_OUTER_CAP = Number(process.argv[3] ?? 3) || 3;
/** 実装の既定（src/app/board/page.tsx の DEFAULT_CONDITIONS.wRimGap） */
const W_RIM_GAP = 0.5;

// 端の罰点なし（wRimGap 0）で評価して「正の値」を取る。罰点は下の VARIANTS で掛ける。
const soft = {
  wRimGap: 0, wScout: 10, wScoutCore: 4, scoutRadius: 3,
  wScoutByScoutKey: { twilight: 10, eclipse: 10, rebellion: 10, tfmars: 10 },
  wScoutCoreByScoutKey: { twilight: 3, eclipse: 3, rebellion: 3, tfmars: 3 },
  scoutCoreAttributionMode: "all",
  wGaiaDist1: 5, wGaiaDist2: 8, wGaiaDist3: 3, wClusterSize: 1, wImbalance: 1,
} as any;

const BASIC = ["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW"];

type Planet = { key: string; color: string; pos: number; outer: boolean; touch: boolean; cov2: number; cov1: number };
/** LF4種族の候補（原始・小惑星）。罰点なしで評価しているので pos ＝ 実装の value */
type LfPlanet = { key: string; pos: number; outer: boolean; touch: boolean; cov2: number };
type Board = {
  planets: Planet[];
  nodes: PlanetNode[];
  lf: Record<string, LfPlanet[]>;
  /** 実装（wRimGap = W_RIM_GAP）の色ごとの値と開始地点（自己検算用） */
  impl: { totals: Record<string, number>; starts: Record<string, string[]> };
};

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
    const implEval = evaluateSoft(extracted, { ...soft, wRimGap: W_RIM_GAP });
    const implSa: any = (implEval.breakdown.audit as any).startAccess;
    const impl = {
      totals: Object.fromEntries(BASIC.map((c) => [c, Number((implEval.breakdown.planetTypeTotals as any)[c] ?? 0)])),
      starts: Object.fromEntries(BASIC.map((c) => [c, (implSa?.byColor?.[c]?.starts ?? []) as string[]])),
    };
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
        // 罰点なしで評価しているので value がそのまま正の値
        const pos = Number(p.value);
        planets.push({ key: String(p.cellKey), color: c, pos, outer, touch, cov2: cov(cell.q, cell.r, 2), cov1: cov(cell.q, cell.r, 1) });
      }
    }
    const nodes: PlanetNode[] = cells
      .filter((c) => c.isPlanet)
      .map((c) => ({ key: String(c.key), q: c.q, r: c.r, kind: String(c.colorKey ?? c.planetKind ?? "").toUpperCase() }));
    const lf: Record<string, LfPlanet[]> = {};
    for (const [f, entry] of Object.entries((sa?.lf ?? {}) as Record<string, any>)) {
      lf[f] = (entry.planets ?? []).map((p: any) => {
        const cell = byKey.get(String(p.cellKey));
        return {
          key: String(p.cellKey),
          pos: Number(p.value),
          outer: extracted.outerCells.has(p.cellKey),
          touch: extracted.touchCells.has(p.cellKey),
          cov2: cell ? cov(cell.q, cell.r, 2) : 1,
        };
      });
    }
    out.push({ planets, nodes, lf, impl });
  }
  return out;
}

type Variant = { id: string; label: string; value: (p: Planet) => number };
const VARIANTS: Variant[] = [
  { id: "V0", label: "eval_v3 加算 −3/−1", value: (p) => p.pos - (p.outer ? 3 : 0) - (p.touch ? 1 : 0) },
  { id: "V1", label: "加算 −6/−2", value: (p) => p.pos - (p.outer ? 6 : 0) - (p.touch ? 2 : 0) },
  { id: "V2", label: "加算 −8/−3", value: (p) => p.pos - (p.outer ? 8 : 0) - (p.touch ? 3 : 0) },
  { id: "V3", label: "乗算 ×0.5/×0.8", value: (p) => p.pos * (p.outer ? 0.5 : p.touch ? 0.8 : 1) },
  { id: "V4", label: "乗算 ×0.7/×0.9", value: (p) => p.pos * (p.outer ? 0.7 : p.touch ? 0.9 : 1) },
  { id: "V5", label: "欠け 距離2 ×(0.5+0.5c)", value: (p) => p.pos * (0.5 + 0.5 * p.cov2) },
  { id: "V6", label: "欠け 距離1 ×(0.5+0.5c)", value: (p) => p.pos * (0.5 + 0.5 * p.cov1) },
  { id: "V7", label: "欠け 距離2 ×(0.25+0.75c)", value: (p) => p.pos * (0.25 + 0.75 * p.cov2) },
  { id: "V8", label: "欠け 距離2 ×c", value: (p) => p.pos * p.cov2 },
  // 「通常の到達範囲（距離2以内の18マス）のうち盤面が無いマス1つにつき w 点引く」（加算・段階つき）
  { id: "G4", label: "欠けマス×0.4点", value: (p) => p.pos - 0.4 * 18 * (1 - p.cov2) },
  { id: "G5", label: "欠けマス×0.5点 (実装)", value: (p) => p.pos - 0.5 * 18 * (1 - p.cov2) },
  { id: "G10", label: "欠けマス×1点", value: (p) => p.pos - 1.0 * 18 * (1 - p.cov2) },
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

  // eval_v3（V0）での開始地点に最外周/外周が入る割合
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
  console.log(`  eval_v3 の開始地点のうち最外周/外周にあるもの: ${pct(rimStarts / startsN)}。開始地点に最外周/外周を含む色: ${pct(colorsWithRimStart / colorsN)}`);
  const negative = all.filter((p) => VARIANTS[0].value(p) < 0).length;
  console.log(`  eval_v3 の加算で惑星の値が負になるもの: ${negative}個 (${pct(negative / all.length)})。乗算なら 0 止まり`);

  const none = boards.map((b) => colorValues(b, VARIANTS[VARIANTS.length - 1]));
  const baseImb = base.map((r) => std(BASIC.map((c) => r.values[c])));
  const baseTop = base.map((r) => BASIC.reduce((m, c) => (r.values[c] > r.values[m] ? c : m), BASIC[0]));
  console.log(`\n  案                        色の値の平均  最上位 中央値   罰点の影響(全体)  開始地点に最外周/外周を含む色での影響  開始地点が最外周/外周  並びの相関(V0比)  最上位色が変わる盤面`);
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

  // 自己検算: 実装（wRimGap = 0.5）の色の値と開始地点が G5 と一致するか。
  // 実装は軸ごとに丸めてから足すので、値は丸め誤差（最大 ±3）の範囲で一致すればよい。
  {
    const g5 = VARIANTS.find((v) => v.id === "G5")!;
    let maxDiff = 0, startsDiff = 0, n = 0;
    boards.forEach((b) => {
      const res = colorValues(b, g5);
      for (const c of BASIC) {
        if (res.starts[c].length === 0) continue;
        n++;
        maxDiff = Math.max(maxDiff, Math.abs(res.values[c] - b.impl.totals[c]));
        if (res.starts[c].slice().sort().join("|") !== b.impl.starts[c].slice().sort().join("|")) startsDiff++;
      }
    });
    console.log(`\n  自己検算: 実装（wRimGap ${W_RIM_GAP}）と G5 の差の最大 ${f1(maxDiff)}（軸ごとの丸めぶん）、開始地点が違う色 ${startsDiff}/${n}`);
  }

  // 原始・小惑星（LF4種族）に同じ罰点を掛けたとき（eval_v4 から掛けている）
  if (templateId !== "base_34p") {
    console.log(`\n  原始・小惑星に同じ罰点を掛けたとき（開始1ヶ所、種族ごとの入植コスト。eval_v4 は G5）`);
    const factions = ["moweyds", "spaceGiants", "tinkerroids", "darkanians"] as LfFactionId[];
    const lfValue = (b: Board, f: LfFactionId, v: Variant) => {
      const mine = b.lf[f] ?? [];
      if (mine.length === 0) return null;
      const plan = planStarts({
        nodes: b.nodes,
        candidates: mine.map((p) => ({ key: p.key, value: v.value(p as any) })),
        stoneCost: stoneCostForLfFaction(f),
        startCount: START_COUNT_LF,
      });
      return plan ? { total: plan.total, startRim: mine.find((p) => p.key === plan.starts[0])!.outer || mine.find((p) => p.key === plan.starts[0])!.touch } : null;
    };
    const noneV = VARIANTS[VARIANTS.length - 1];
    for (const f of factions) {
      const base = boards.map((b) => lfValue(b, f, noneV)).filter(Boolean) as Array<{ total: number; startRim: boolean }>;
      const rimStart = base.filter((x) => x.startRim).length;
      const parts: string[] = [];
      for (const id of ["V0", "V4", "G4", "G5", "G10"]) {
        const v = VARIANTS.find((x) => x.id === id)!;
        const res = boards.map((b) => lfValue(b, f, v)).filter(Boolean) as Array<{ total: number; startRim: boolean }>;
        const rel = stat(res.map((x, i) => (base[i].total > 0 ? (x.total - base[i].total) / base[i].total : 0))).mean;
        parts.push(`${id} ${pct(rel).padStart(6)}`);
      }
      console.log(`    ${f.padEnd(12)} 罰点なしの開始地点が最外周/外周: ${pct(rimStart / base.length).padStart(6)}   値の変化: ${parts.join(" / ")}`);
    }
  }
}
