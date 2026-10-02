// scripts/_probe_map_aggregation.ts
//
// Map の色ごとの評価値を「惑星ごとの値の単純合計」から「最良の1〜2惑星に重く」へ
// 変えたときの実測（2026-09-29 の提案の材料。実装はしていない）。
//
//   npx tsx scripts/_probe_map_aggregation.ts [件数]
//
// 惑星ごとの値 v(p) = 船接触 + 船星系 + ガイア + 星系 + 最外周 + 外周（後2つは負）。
// 色ごとの集計方式:
//   S     現行（Σ v）             B1   最良1惑星
//   B2    最良2惑星の和           B2R  最良2惑星の和 + 0.25 × 残りの和
//   B2H   最良2惑星の和 + 0.5 × 残りの和
//   ACC   開始地点を総当たりで選び、残りは「開始地点からの到達コスト」で重み付け（下の節）
// 最外周/外周の扱い:
//   R0 現行（加算 -3/-1） R1 加算を強める（-8/-3） R2 乗算（正の値 × 0.5 / × 0.8）

import { makeSearchPlacementFromSeed } from "../src/gaia/ssot/searchPlacementConfig";
import { buildLogicalMapFromPlacement, connectedComponents } from "../src/gaia/logicalMap/buildLogicalMap";
import { extractForEval } from "../src/gaia/eval/extractForEval";
import { evaluateSoft } from "../src/gaia/eval/evaluateSoft";
import { checkHardConstraints } from "../src/gaia/constraints";

const N = Number(process.argv[2] ?? 150) || 150;

const D = {
  wOuter: 3, wTouch: 1, wScout: 10, wScoutCore: 4,
  wScoutShips: [10, 10, 10, 10], wScoutCoreShips: [3, 3, 3, 3],
  scoutRadius: 3, wGaiaDist1: 5, wGaiaDist2: 8, wGaiaDist3: 3, wClusterSize: 1,
};
const soft = {
  wOuter: D.wOuter, wTouch: D.wTouch, wScout: D.wScout, wScoutCore: D.wScoutCore, scoutRadius: D.scoutRadius,
  wScoutByScoutKey: { twilight: 10, eclipse: 10, rebellion: 10, tfmars: 10 },
  wScoutCoreByScoutKey: { twilight: 3, eclipse: 3, rebellion: 3, tfmars: 3 },
  scoutCoreAttributionMode: "all",
  wGaiaDist1: D.wGaiaDist1, wGaiaDist2: D.wGaiaDist2, wGaiaDist3: D.wGaiaDist3, wClusterSize: D.wClusterSize,
  wImbalance: 1,
} as any;

const BASIC = ["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW"];
const BASIC_SET = new Set(BASIC);

type Planet = { key: string; color: string; pos: number; scout: number; core: number; gaia: number; cluster: number; outer: boolean; touch: boolean };
/** 到達コストの計算に使う全惑星（ガイア・次元横断も踏み台として含む） */
type Node = { key: string; q: number; r: number; kind: string };
type Board = { planets: Planet[]; nodes: Node[]; totals: Record<string, number> };

let seedsTried = 0;
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

    // 星系: 惑星ごとに「属するクラスタの重み付き大きさ」（次元横断 0.5）
    const planetPts = (extracted.cells ?? []).filter((c: any) => c.isPlanet);
    const kindByKey = new Map(planetPts.map((c: any) => [`${c.q},${c.r}`, String(c.planetKind ?? "").toUpperCase()]));
    const clusterByKey = new Map<string, number>();
    for (const comp of connectedComponents(planetPts.map((c: any) => ({ q: c.q, r: c.r })))) {
      if (comp.length < 2) continue;
      let ws = 0;
      for (const pos of comp) ws += kindByKey.get(`${pos.q},${pos.r}`) === "TRANSDIM" ? 0.5 : 1;
      for (const pos of comp) clusterByKey.set(`${pos.q},${pos.r}`, D.wClusterSize * ws);
    }
    const sumBy = (rows: any[], keyField: string) => {
      const m = new Map<string, number>();
      for (const h of rows ?? []) m.set(h[keyField], (m.get(h[keyField]) ?? 0) + (Number(h.value) || 0));
      return m;
    };
    const scoutBy = sumBy(a.scout?.scoutHits, "planetKey");
    const coreBy = sumBy(a.scoutCore?.coreHits, "corePlanetKey");
    const gaiaBy = sumBy(a.gaiaProximity?.gaiaHits, "cellKey");

    const planets: Planet[] = [];
    for (const p of extracted.planetCells as any[]) {
      const ck = String(p.colorKey ?? "").toUpperCase();
      const kind = String(p.planetKind ?? "").toUpperCase();
      const color = BASIC_SET.has(ck) ? ck : kind;
      if (!BASIC_SET.has(color) && color !== "PROTO" && color !== "ASTEROID") continue;
      const scout = scoutBy.get(p.key) ?? 0;
      const core = coreBy.get(p.key) ?? 0;
      const gaia = gaiaBy.get(p.key) ?? 0;
      const cluster = clusterByKey.get(`${p.q},${p.r}`) ?? 0;
      planets.push({
        key: p.key, color, scout, core, gaia, cluster, pos: scout + core + gaia + cluster,
        outer: extracted.outerCells.has(p.key), touch: extracted.touchCells.has(p.key),
      });
    }
    const nodes: Node[] = planetPts.map((c: any) => {
      const ck = String(c.colorKey ?? "").toUpperCase();
      const kind = String(c.planetKind ?? "").toUpperCase();
      return { key: String(c.key), q: c.q, r: c.r, kind: BASIC_SET.has(ck) ? ck : kind };
    });
    out.push({ planets, nodes, totals: breakdown.planetTypeTotals as any });
  }
  seedsTried = seed;
  return out;
}

type Rim = "R0" | "R1" | "R2" | "NONE";
function valueOf(p: Planet, rim: Rim): number {
  if (rim === "NONE") return p.pos;
  if (rim === "R0") return p.pos + (p.outer ? -3 : 0) + (p.touch ? -1 : 0);
  if (rim === "R1") return p.pos + (p.outer ? -8 : 0) + (p.touch ? -3 : 0);
  return p.pos * (p.outer ? 0.5 : p.touch ? 0.8 : 1);
}
type Scheme = "S" | "B1" | "B2" | "B2R" | "B2H";
const SCHEMES: Scheme[] = ["S", "B1", "B2", "B2R", "B2H"];
function aggregate(vs: number[], s: Scheme): number {
  const v = vs.slice().sort((a, b) => b - a);
  if (v.length === 0) return 0;
  const sum = v.reduce((a, b) => a + b, 0);
  const top2 = v[0] + (v[1] ?? 0);
  const rest = sum - top2;
  switch (s) {
    case "S": return sum;
    case "B1": return v[0];
    case "B2": return top2;
    case "B2R": return top2 + 0.25 * rest;
    case "B2H": return top2 + 0.5 * rest;
  }
}
function colorValues(b: Board, s: Scheme, rim: Rim): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of BASIC) out[c] = aggregate(b.planets.filter((p) => p.color === c).map((p) => valueOf(p, rim)), s);
  return out;
}

// ===== アクセス（到達しやすさ）モデル =====
// 開始地点から各同色惑星へ、惑星を踏み台にして進む最小コスト（定数は 2026-10-02 のユーザー指定）。
//   跳躍コスト: 距離1=0 / 2=1 / 3〜4=2（QIC で届く）/ 5=3（+3射程のブースター・船アクション）/
//               それ以上は不可。
//   踏み台コスト: その惑星に入植するのに要する改造の歩数。同色0、改造の輪で隣1・2つ先2・反対3、
//                 ガイア1、次元横断1、原始3、小惑星2。踏み台のコストは「そこから次へ跳ぶとき」に
//                 払うので、目的の惑星そのものには掛からない。
//   2つ目以降の踏み台には時間の補正 surcharge を足す（0 なら単純な和）。
//   到達係数 = decay ^ コスト。
const WHEEL = ["BLUE", "RED", "ORANGE", "YELLOW", "BROWN", "BLACK", "WHITE"]; // テラ→酸化→火山→砂漠→沼沢→チタン→氷→テラ
function wheelSteps(a: string, b: string): number {
  const i = WHEEL.indexOf(a), j = WHEEL.indexOf(b);
  if (i < 0 || j < 0) return 3;
  const d = Math.abs(i - j);
  return Math.min(d, 7 - d);
}
type CostFn = (kind: string) => number;
/** 基本色 c の種族の視点 */
function baseColorCost(c: string): CostFn {
  return (kind) => {
    if (kind === c) return 0;
    if (BASIC_SET.has(kind)) return wheelSteps(kind, c);
    if (kind === "GAIA" || kind === "TRANSDIM") return 1;
    if (kind === "PROTO") return 3;
    if (kind === "ASTEROID") return 2;
    return 3;
  };
}
/** LF4種族の視点（母星種別なし。LF ルール p7・p13。std=標準惑星の歩数、gaia=ガイア/次元横断） */
const LF_FACTION_COST: Record<string, { home: string; std: number; gaia: number; note: string }> = {
  darkanians: { home: "ASTEROID", std: 1, gaia: 2, note: "標準1歩・ガイア QIC2" },
  tinkerroids: { home: "ASTEROID", std: 2, gaia: 2, note: "標準は相手次第で1か3（仮に2）・ガイア QIC2" },
  moweyds: { home: "PROTO", std: 2, gaia: 1, note: "標準は相手次第で1か3（仮に2）" },
  spaceGiants: { home: "PROTO", std: 2, gaia: 2, note: "標準2歩" },
};
function lfFactionCost(f: string): CostFn {
  const t = LF_FACTION_COST[f];
  return (kind) => {
    if (BASIC_SET.has(kind)) return t.std;
    if (kind === "GAIA" || kind === "TRANSDIM") return t.gaia;
    if (kind === "PROTO") return 3;
    if (kind === "ASTEROID") return 2;
    return 3;
  };
}
function hopCost(d: number): number {
  return d <= 1 ? 0 : d === 2 ? 1 : d <= 4 ? 2 : d === 5 ? 3 : Infinity;
}
function hexDist(a: Node, b: Node): number {
  const dq = a.q - b.q, dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}
type Costs = { cost: number[]; stones: number[] };
/**
 * 起点 src から全ノードへの最小コストと、その経路で踏む踏み台の数（0 / 1 / 2以上）。
 * 状態 = (ノード, これまでに踏んだ踏み台の数)。踏み台のコストは「そのノードから次へ跳ぶとき」に
 * 払い、2つ目以降の踏み台には surcharge を足す。Dijkstra、状態数が小さいので O(状態^2)。
 */
function costsFrom(nodes: Node[], src: number, costOf: CostFn, surcharge: number): Costs {
  const n = nodes.length, K = 3;
  const dist = new Array(n * K).fill(Infinity);
  const done = new Array(n * K).fill(false);
  const id = (i: number, k: number) => i * K + k;
  dist[id(src, 0)] = 0;
  for (let it = 0; it < n * K; it++) {
    let u = -1;
    for (let s = 0; s < n * K; s++) if (!done[s] && (u < 0 || dist[s] < dist[u])) u = s;
    if (u < 0 || dist[u] === Infinity) break;
    done[u] = true;
    const ui = Math.floor(u / K), uk = u % K;
    const depart = ui === src ? 0 : costOf(nodes[ui].kind) + (uk >= 1 ? surcharge : 0);
    const nk = ui === src ? 0 : Math.min(K - 1, uk + 1);
    for (let w = 0; w < n; w++) {
      if (w === ui) continue;
      const h = hopCost(hexDist(nodes[ui], nodes[w]));
      if (h === Infinity) continue;
      const nd = dist[u] + depart + h;
      if (nd < dist[id(w, nk)]) dist[id(w, nk)] = nd;
    }
  }
  const cost = new Array(n).fill(Infinity), stones = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let k = 0; k < K; k++) if (dist[id(i, k)] < cost[i]) { cost[i] = dist[id(i, k)]; stones[i] = k; }
  return { cost, stones };
}
/** 同色（同種別）惑星ごとの起点コスト表。盤面 × 視点 × surcharge で1回だけ計算する */
const costCache = new Map<string, Map<string, Costs>>();
function costTable(b: Board, bi: number, home: string, costOf: CostFn, costKey: string, surcharge: number): Map<string, Costs> {
  const key = `${bi}|${home}|${costKey}|${surcharge}`;
  let m = costCache.get(key);
  if (m) return m;
  m = new Map();
  const idx = new Map(b.nodes.map((n, i) => [n.key, i]));
  for (const p of b.planets) if (p.color === home) m.set(p.key, costsFrom(b.nodes, idx.get(p.key)!, costOf, surcharge));
  costCache.set(key, m);
  return m;
}
/** 到達係数 = decay^(コスト − shift)。コストが shift 以下なら 1、到達不能なら 0 */
function factor(cost: number, decay: number, shift: number): number {
  return cost === Infinity ? 0 : Math.pow(decay, Math.max(0, cost - shift));
}
type AccessResult = { value: number; start: string[]; rest: Array<{ key: string; v: number; cost: number; stones: number }>; top2ByValue: boolean };
/** 値: 開始地点（標準種族2つ／LF種族1つ）を総当たりし、残りの同種別惑星は到達係数で重み付け */
function accessValue(b: Board, home: string, costBy: Map<string, Costs>, decay: number, shift: number, rim: Rim, starts: number): AccessResult {
  const mine = b.planets.filter((p) => p.color === home);
  if (mine.length === 0) return { value: 0, start: [], rest: [], top2ByValue: true };
  const idx = new Map(b.nodes.map((n, i) => [n.key, i]));
  const v = (p: Planet) => valueOf(p, rim);
  let best: AccessResult | null = null;
  const evalSet = (S: Planet[]) => {
    let value = 0;
    const rest: AccessResult["rest"] = [];
    for (const s of S) value += v(s);
    for (const p of mine) {
      if (S.includes(p)) continue;
      let cost = Infinity, stones = 0;
      for (const s of S) {
        const t = costBy.get(s.key)!;
        const c = t.cost[idx.get(p.key)!];
        if (c < cost) { cost = c; stones = t.stones[idx.get(p.key)!]; }
      }
      value += v(p) * factor(cost, decay, shift);
      rest.push({ key: p.key, v: v(p), cost, stones });
    }
    if (!best || value > best.value) best = { value, start: S.map((s) => s.key), rest, top2ByValue: false };
  };
  if (starts === 1 || mine.length === 1) for (const a of mine) evalSet([a]);
  else for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) evalSet([mine[i], mine[j]]);
  const byValue = mine.slice().sort((x, y) => v(y) - v(x)).slice(0, starts).map((p) => p.key).sort();
  best!.top2ByValue = JSON.stringify(byValue) === JSON.stringify(best!.start.slice().sort());
  return best!;
}

function stat(xs: number[]) {
  const s = xs.slice().sort((a, b) => a - b);
  const q = (f: number) => s[Math.min(s.length - 1, Math.floor(s.length * f))];
  return { n: s.length, mean: s.reduce((a, b) => a + b, 0) / Math.max(1, s.length), med: q(0.5), p10: q(0.1), p90: q(0.9), min: s[0], max: s[s.length - 1] };
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
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
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
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

const RUNS: Array<[string, number]> = [["4p_lostFleet", 1], ["3p_lostFleet", 1], ["base_34p", 3]];
for (const [templateId, outerCap] of RUNS) {
  const boards = loadBoards(templateId, outerCap);
  console.log(`\n################ ${templateId}  盤面 ${boards.length}件（${seedsTried} シード中。ハード制約 H2 の上限 ${outerCap}。既定の評価指数）`);
  if (boards.length === 0) continue;

  // 検算: 惑星ごとの値の合計（R0）と planetTypeTotals の差
  const diffs: number[] = [];
  for (const b of boards) {
    const cv = colorValues(b, "S", "R0");
    for (const c of BASIC) diffs.push(Math.abs(cv[c] - (b.totals[c] ?? 0)));
  }
  console.log(`検算: 惑星ごとの値の合計 と 内訳表の評価列 の差  平均 ${diffs.reduce((a, b) => a + b, 0) / diffs.length}  最大 ${Math.max(...diffs)}（星系の「色ごとに1回」ぶん）`);

  // 惑星の個数と位置
  const cnt = stat(boards.flatMap((b) => BASIC.map((c) => b.planets.filter((p) => p.color === c).length)));
  const all = boards.flatMap((b) => b.planets.filter((p) => BASIC_SET.has(p.color)));
  const cls = (p: Planet) => (p.outer ? "最外周" : p.touch ? "外周" : "内側");
  const byCls: Record<string, number[]> = { 最外周: [], 外周: [], 内側: [] };
  for (const p of all) byCls[cls(p)].push(p.pos);
  console.log(`\n色ごとの惑星数: 平均 ${f1(cnt.mean)}  範囲 ${cnt.min}〜${cnt.max}`);
  console.log(`基本色の惑星の位置と、正の値（船接触+船星系+ガイア+星系）の平均:`);
  for (const k of ["内側", "外周", "最外周"]) console.log(`  ${k.padEnd(4)} ${String(byCls[k].length).padStart(5)}個 (${pct(byCls[k].length / all.length)})  正の値の平均 ${f1(stat(byCls[k]).mean)}`);
  // 最良1・2位の惑星の位置
  const topCls: Record<string, number> = { 最外周: 0, 外周: 0, 内側: 0 };
  let topN = 0;
  for (const b of boards) for (const c of BASIC) {
    const ps = b.planets.filter((p) => p.color === c).sort((x, y) => valueOf(y, "R0") - valueOf(x, "R0")).slice(0, 2);
    for (const p of ps) { topCls[cls(p)] += 1; topN += 1; }
  }
  console.log(`色ごとの最良2惑星の位置: 内側 ${pct(topCls.内側 / topN)} / 外周 ${pct(topCls.外周 / topN)} / 最外周 ${pct(topCls.最外周 / topN)}`);

  // 集計方式 × 最外周/外周の扱い
  console.log(`\n集計方式ごとの桁（色の値。「最上位」は盤面ごとの7色の最大値）`);
  console.log(`  方式   rim   色の値の平均   最上位 中央値 (10%〜90%)   rim の影響  盤面順位の相関  最上位色が変わる盤面`);
  const baseS: number[] = boards.map((b) => std(BASIC.map((c) => colorValues(b, "S", "R0")[c])));
  const baseTop: string[] = boards.map((b) => { const cv = colorValues(b, "S", "R0"); return BASIC.reduce((m, c) => (cv[c] > cv[m] ? c : m), BASIC[0]); });
  for (const s of SCHEMES) for (const rim of ["R0", "R1", "R2"] as Rim[]) {
    const vals: number[] = [], tops: number[] = [], imb: number[] = [], rimDelta: number[] = [];
    let topChanged = 0;
    boards.forEach((b, i) => {
      const cv = colorValues(b, s, rim), cvNo = colorValues(b, s, "NONE");
      const arr = BASIC.map((c) => cv[c]);
      vals.push(...arr);
      tops.push(Math.max(...arr));
      imb.push(std(arr));
      for (const c of BASIC) rimDelta.push(Math.abs(cv[c] - cvNo[c]));
      const top = BASIC.reduce((m, c) => (cv[c] > cv[m] ? c : m), BASIC[0]);
      if (top !== baseTop[i]) topChanged += 1;
    });
    const vs = stat(vals), ts = stat(tops);
    const rimShare = rimDelta.reduce((a, b) => a + b, 0) / rimDelta.length / Math.max(1e-9, stat(boards.flatMap((b) => BASIC.map((c) => colorValues(b, s, "NONE")[c]))).mean);
    const rho = spearman(baseS, imb);
    console.log(`  ${s.padEnd(5)}  ${rim}   ${f1(vs.mean).padStart(8)}       ${f1(ts.med).padStart(6)} (${f1(ts.p10)}〜${f1(ts.p90)})   ${pct(rimShare).padStart(7)}      ${rho.toFixed(3).padStart(6)}        ${pct(topChanged / boards.length)}`);
  }

  // 最外周/外周の現行の寄与（S/R0）: 全体に対する割合
  {
    let outerAbs = 0, touchAbs = 0, posSum = 0;
    for (const p of all) { outerAbs += p.outer ? 3 : 0; touchAbs += p.touch ? 1 : 0; posSum += p.pos; }
    console.log(`\n現行（S/R0）の内訳: 正の値の合計に対して 最外周 ${pct(outerAbs / posSum)} / 外周 ${pct(touchAbs / posSum)}`);
    // 色ごとの合計に占める、最良2惑星の割合
    const shares: number[] = [];
    for (const b of boards) for (const c of BASIC) {
      const vs2 = b.planets.filter((p) => p.color === c).map((p) => valueOf(p, "R0")).sort((x, y) => y - x);
      const sum = vs2.reduce((a, b2) => a + b2, 0);
      if (sum > 0) shares.push((vs2[0] + (vs2[1] ?? 0)) / sum);
    }
    console.log(`現行の色の合計のうち最良2惑星が占める割合: 平均 ${pct(stat(shares).mean)}（10%〜90%: ${pct(stat(shares).p10)}〜${pct(stat(shares).p90)}）`);
  }

  // 最良2惑星に最外周/外周が入る色だけを取り出し、rim の扱いで B2R の値がどれだけ動くか
  {
    const rel: Record<string, number[]> = { R0: [], R1: [], R2: [] };
    let hit = 0, total = 0;
    for (const b of boards) for (const c of BASIC) {
      total++;
      const mine = b.planets.filter((p) => p.color === c);
      const top = mine.slice().sort((x, y) => y.pos - x.pos).slice(0, 2);
      if (!top.some((p) => p.outer || p.touch)) continue;
      hit++;
      const base = aggregate(mine.map((p) => p.pos), "B2R");
      for (const rim of ["R0", "R1", "R2"] as Rim[]) {
        const v = aggregate(mine.map((p) => valueOf(p, rim)), "B2R");
        if (base > 0) rel[rim].push((v - base) / base);
      }
    }
    console.log(`最良2惑星に最外周/外周を含む色: ${pct(hit / total)}。その色の B2R の値の変化（rim なし比）: R0 ${pct(stat(rel.R0).mean)} / R1 ${pct(stat(rel.R1).mean)} / R2 ${pct(stat(rel.R2).mean)}`);
  }

  // ===== アクセスモデル ACC =====
  {
    console.log(`\nアクセスモデル ACC（開始2ヶ所を総当たり。残りの同色惑星は decay^到達コスト で重み付け。rim は現行の加算）`);
    // 到達コストと踏み台の数の分布（surcharge=0、decay に依存しない）
    {
      const costHist: Record<string, number> = {}, stoneHist: Record<string, number> = {};
      let pairDiffers = 0, pairN = 0;
      boards.forEach((b, bi) => {
        for (const c of BASIC) {
          const r = accessValue(b, c, costTable(b, bi, c, baseColorCost(c), "base", 0), 0.5, 1, "R0", 2);
          pairN++;
          if (!r.top2ByValue) pairDiffers++;
          for (const x of r.rest) {
            const k = x.cost === Infinity ? "不可" : x.cost >= 5 ? "5+" : String(x.cost);
            costHist[k] = (costHist[k] ?? 0) + 1;
            const sk = x.cost === Infinity ? "不可" : x.stones >= 2 ? "2+" : String(x.stones);
            stoneHist[sk] = (stoneHist[sk] ?? 0) + 1;
          }
        }
      });
      const nRest = Object.values(costHist).reduce((a, b) => a + b, 0);
      console.log(`  3位以下の惑星の到達コスト: ` + ["1", "2", "3", "4", "5+", "不可"].map((k) => `${k}: ${pct((costHist[k] ?? 0) / nRest)}`).join(" / "));
      console.log(`  3位以下の惑星へ最短で行くときの踏み台の数: ` + ["0", "1", "2+"].map((k) => `${k}: ${pct((stoneHist[k] ?? 0) / nRest)}`).join(" / ") + `   開始2ヶ所が「値の上位2」と違う色: ${pct(pairDiffers / pairN)}`);
    }
    // 到達係数の形: decay^(コスト − shift)。shift=1 は「コスト1＝通常の到達範囲＝割引なし」の読み方
    const CONFIGS: Array<{ decay: number; shift: number; surcharge: number }> = [
      { decay: 0.5, shift: 0, surcharge: 0 },
      { decay: 0.6, shift: 0, surcharge: 0 },
      { decay: 0.7, shift: 0, surcharge: 0 },
      { decay: 0.5, shift: 1, surcharge: 0 },
      { decay: 0.5, shift: 1, surcharge: 1 },
    ];
    const label = (cf: { decay: number; shift: number; surcharge: number }) =>
      `${cf.decay.toFixed(1)}^(c${cf.shift ? `-${cf.shift}` : ""}) +${cf.surcharge}`;
    console.log(`  係数                     コスト2/3/4/5 の係数        色の値の平均  最上位 中央値 (10%〜90%)  3位以下の寄与  検索の並びの相関  最上位色が変わる盤面`);
    for (const cf of CONFIGS) {
      const vals: number[] = [], tops: number[] = [], imb: number[] = [], restShare: number[] = [];
      let topChanged = 0;
      boards.forEach((b, bi) => {
        const cv: Record<string, number> = {};
        for (const c of BASIC) {
          const r = accessValue(b, c, costTable(b, bi, c, baseColorCost(c), "base", cf.surcharge), cf.decay, cf.shift, "R0", 2);
          cv[c] = r.value;
          let restV = 0;
          for (const x of r.rest) restV += x.v * factor(x.cost, cf.decay, cf.shift);
          if (r.value > 0) restShare.push(restV / r.value);
        }
        const arr = BASIC.map((c) => cv[c]);
        vals.push(...arr);
        tops.push(Math.max(...arr));
        imb.push(std(arr));
        const top = BASIC.reduce((m, c) => (cv[c] > cv[m] ? c : m), BASIC[0]);
        if (top !== baseTop[bi]) topChanged += 1;
      });
      const vs = stat(vals), ts = stat(tops);
      const fs = [2, 3, 4, 5].map((c) => factor(c, cf.decay, cf.shift).toFixed(2)).join(" / ");
      console.log(`  ${label(cf).padEnd(22)}   ${fs}   ${f1(vs.mean).padStart(7)}      ${f1(ts.med).padStart(6)} (${f1(ts.p10)}〜${f1(ts.p90)})     ${pct(stat(restShare).mean).padStart(6)}        ${spearman(baseS, imb).toFixed(3)}           ${pct(topChanged / boards.length)}`);
    }
    if (templateId !== "base_34p") {
      console.log(`  LF4種族（1ヶ所スタート、係数なし。種族ごとの改造コストで到達加重。追加コスト 0）`);
      for (const cf of [CONFIGS[3], CONFIGS[2]]) {
        const basic = stat(boards.flatMap((b, bi) => BASIC.map((c) => accessValue(b, c, costTable(b, bi, c, baseColorCost(c), "base", 0), cf.decay, cf.shift, "R0", 2).value))).mean;
        for (const f of Object.keys(LF_FACTION_COST)) {
          const t = LF_FACTION_COST[f];
          const vals: number[] = [], v1: number[] = [];
          boards.forEach((b, bi) => {
            const r = accessValue(b, t.home, costTable(b, bi, t.home, lfFactionCost(f), f, 0), cf.decay, cf.shift, "R0", 1);
            if (r.start.length === 0) return;
            vals.push(r.value);
            v1.push(valueOf(b.planets.find((p) => p.key === r.start[0])!, "R0"));
          });
          console.log(`    ${label(cf).padEnd(18)} ${f.padEnd(12)} ${t.home.padEnd(8)} 平均 ${f1(stat(vals).mean).padStart(5)}  うち開始惑星 ${f1(stat(v1).mean).padStart(5)}  標準色の平均 ${f1(basic)} との比 ${(stat(vals).mean / basic).toFixed(2)}   ${t.note}`);
        }
      }
    }
  }

  // 原始・小惑星
  if (templateId !== "base_34p") {
    console.log(`\n原始・小惑星（現行は最良1惑星の正の値 × 2.75。最外周/外周は効かせていない）`);
    for (const kind of ["PROTO", "ASTEROID"]) {
      const e1: number[] = [], e2avg: number[] = [], e2: number[] = [], cntK: number[] = [], e1rim: number[] = [];
      for (const b of boards) {
        const ps = b.planets.filter((p) => p.color === kind);
        const vs2 = ps.map((p) => p.pos).sort((x, y) => y - x);
        if (vs2.length === 0) continue;
        cntK.push(vs2.length);
        e1.push(vs2[0]); e2.push(vs2[0] + (vs2[1] ?? 0)); e2avg.push((vs2[0] + (vs2[1] ?? vs2[0])) / 2);
        e1rim.push(Math.max(...ps.map((p) => valueOf(p, "R2"))));
      }
      console.log(`  ${kind.padEnd(8)} 個数 平均 ${f1(stat(cntK).mean)}  最良1 平均 ${f1(stat(e1).mean)} (中央 ${f1(stat(e1).med)})  ×2.75= ${f1(stat(e1).mean * 2.75)}  最良2の平均 ${f1(stat(e2avg).mean)}  最良2の和 ${f1(stat(e2).mean)}  最良1(乗算rim込み) ${f1(stat(e1rim).mean)}`);
    }
    for (const s of ["B2", "B2R"] as Scheme[]) {
      const basic = stat(boards.flatMap((b) => BASIC.map((c) => colorValues(b, s, "R0")[c]))).mean;
      const e1 = stat(boards.flatMap((b) => ["PROTO", "ASTEROID"].map((k) => Math.max(0, ...b.planets.filter((p) => p.color === k).map((p) => p.pos))))).mean;
      console.log(`  基本色を ${s} にしたとき: 基本色の平均 ${f1(basic)} / 原始・小惑星の最良1 平均 ${f1(e1)} → 揃える係数 ${(basic / e1).toFixed(2)}`);
    }
  }
  costCache.clear();
}
