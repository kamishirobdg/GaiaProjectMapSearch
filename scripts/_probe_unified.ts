// scripts/_probe_unified.ts
//
// 「全惑星を同一の式で」の一本化（2026-10-07 ユーザー方針。docs/design-notes.md 2.10）の調査。
//
//   npx tsx scripts/_probe_unified.ts [件数=60] [基本版の H2 上限=3]
//
// 種族の値 ＝ Σ_{盤面の全惑星 p} 係数_f(種別) × (固有値 ＋ 状況の値(p)) × 到達係数_f(開始地点 → p)
//   固有値: 惑星が1つあること自体の値（種別によらず一定。BASE）
//   状況の値: 船接触 ＋ 船星系 ＋ 端の罰点（現行の惑星ごとの値から、ガイア近接と星系を外したもの）
//   係数: 母星色 1 / 他色 OTHER / ガイア GAIA / 次元横断 TRANS / 原始・小惑星 EXTRA。
//         ガイア種族（地球人・バルタック人・イタル人・モウェイド人）は次元横断 GAIA_FACTION_TRANS、
//         改造種族（暫定: ジオデン人・タクロン族・ネヴラ人）は他色 × TERRA_BOOST
//   到達係数: 現行どおり 0.5^(コスト−1)。コスト ＝ 跳躍 ＋ 到着した惑星の入植コスト（種族の表）
//   開始地点: 母星色（LF は母星種別）の惑星から、合計が最大になる k 個（総当たり。現行の planStarts）
//
// 環境変数で値を差し替えて比べる（既定値は下の DEFAULTS）:
//   BASE=10 OWN=1 OTHER=0.5 GAIA=0.5 TRANS=0.25 EXTRA=0.25 GAIA_FACTION_TRANS=0.5 TERRA_BOOST=1.5 npx tsx ...
//
// 出力: 桁（色の代表値の平均・最上位の中央値）、種別ごとの寄与、固有値と状況の値の比、同色2種族の差、
//       現行 eval_v6 との相関（色の値・検索の偏り項・開始地点の一致）、開始地点の中心性との相関。

import { makeSearchPlacementFromSeed } from "../src/gaia/ssot/searchPlacementConfig";
import { buildLogicalMapFromPlacement } from "../src/gaia/logicalMap/buildLogicalMap";
import { extractForEval } from "../src/gaia/eval/extractForEval";
import { evaluateSoft } from "../src/gaia/eval/evaluateSoft";
import { checkHardConstraints } from "../src/gaia/constraints";
import {
  BASIC_FACTION_ORDER,
  BASIC_REACH_PROFILES,
  LF_FACTION_ORDER,
  LF_REACH_PROFILES,
  START_COUNT_LF,
  hopCostForBasicFaction,
  hopCostForLfFaction,
  planStarts,
  stoneCostForBasicFaction,
  stoneCostForLfFaction,
  type PlanetNode,
} from "../src/gaia/eval/reachCost";

const N = Number(process.argv[2] ?? 60) || 60;
const BASE_OUTER_CAP = Number(process.argv[3] ?? 3) || 3;

const DEFAULTS = { BASE: 10, OWN: 1, OTHER: 0.5, GAIA: 0.5, TRANS: 0.25, EXTRA: 0.25, GAIA_FACTION_TRANS: 0.5, TERRA_BOOST: 1.5 };
const P: Record<keyof typeof DEFAULTS, number> = { ...DEFAULTS };
for (const k of Object.keys(DEFAULTS) as Array<keyof typeof DEFAULTS>) {
  if (process.env[k] != null && process.env[k] !== "") P[k] = Number(process.env[k]);
}
/** ガイア種族（次元横断の係数を上げる）と改造種族（他色の係数を上げる。暫定の分類、ユーザー判断） */
const GAIA_FACTIONS = new Set(["terrans", "balTaks", "itars", "moweyds"]);
const TERRA_FACTIONS = new Set(["geodens", "taklons", "nevlas"]);

const soft = {
  wRimGap: 0.5,
  wScout: 10,
  wScoutCore: 4,
  scoutRadius: 3,
  wScoutByScoutKey: { twilight: 10, eclipse: 10, rebellion: 10, tfmars: 10 },
  wScoutCoreByScoutKey: { twilight: 3, eclipse: 3, rebellion: 3, tfmars: 3 },
  scoutCoreAttributionMode: "all",
  wGaiaDist1: 5,
  wGaiaDist2: 8,
  wGaiaDist3: 3,
  wClusterSize: 1,
  wImbalance: 1,
} as any;

const BASIC = ["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW"];
const BASIC_SET = new Set(BASIC);
const ALL_FACTIONS = [...BASIC_FACTION_ORDER, ...LF_FACTION_ORDER] as string[];

function stat(xs: number[]) {
  const s = xs.slice().sort((a, b) => a - b);
  const q = (f: number) => s[Math.min(s.length - 1, Math.floor(s.length * f))] ?? 0;
  return { n: s.length, mean: s.reduce((a, b) => a + b, 0) / Math.max(1, s.length), med: q(0.5), p10: q(0.1), p90: q(0.9) };
}
function ranks(xs: number[]): number[] {
  const idx = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}
function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}
const spearman = (xs: number[], ys: number[]) => pearson(ranks(xs), ranks(ys));
function std(xs: number[]) { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); }
const f1 = (v: number) => v.toFixed(1);
const f2 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : "  nan");
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

type Cat = "own" | "other" | "gaia" | "transdim" | "extra";
function catOf(kind: string, home: string): Cat {
  if (kind === home) return "own";
  if (BASIC_SET.has(kind)) return "other";
  if (kind === "GAIA") return "gaia";
  if (kind === "TRANSDIM") return "transdim";
  return "extra";
}
function coefOf(faction: string, kind: string, home: string): number {
  const cat = catOf(kind, home);
  if (cat === "own") return P.OWN;
  if (cat === "other") return P.OTHER * (TERRA_FACTIONS.has(faction) ? P.TERRA_BOOST : 1);
  if (cat === "gaia") return P.GAIA;
  if (cat === "transdim") return GAIA_FACTIONS.has(faction) ? P.GAIA_FACTION_TRANS : P.TRANS;
  // 原始・小惑星。LF 種族どうしの他方の種別も同じ扱い
  return P.EXTRA;
}

console.log(`係数: 固有値 ${P.BASE} / 母星色 ${P.OWN} / 他色 ${P.OTHER}（改造種族 ×${P.TERRA_BOOST}）/ ガイア ${P.GAIA} / 次元横断 ${P.TRANS}（ガイア種族 ${P.GAIA_FACTION_TRANS}）/ 原始・小惑星 ${P.EXTRA}`);
console.log(`ガイア種族: ${[...GAIA_FACTIONS].join(", ")} / 改造種族（暫定）: ${[...TERRA_FACTIONS].join(", ")}`);

for (const [templateId, outerCap] of [["4p_lostFleet", 1], ["3p_lostFleet", 1], ["base_34p", BASE_OUTER_CAP]] as Array<[string, number]>) {
  const hard = {
    minSameColorDist: 3,
    outerSameColorMax: outerCap,
    centerMode: "NONE",
    maxConnectedPlanets: 0,
    h5IncludeScouts: false,
    ...(templateId === "base_34p" ? { banSameKindAdjacency: true } : {}),
  } as any;

  const repVals: number[] = []; // 色の代表値（新）
  const repValsV6: number[] = [];
  const tops: number[] = [];
  const imbNew: number[] = [];
  const imbV6: number[] = [];
  const facVals: Record<string, number[]> = {};
  const facValsV6: Record<string, number[]> = {};
  const catShare: Record<Cat, number[]> = { own: [], other: [], gaia: [], transdim: [], extra: [] };
  const baseShare: number[] = [];
  const startShare: number[] = []; // 開始地点の値（係数込み、到達係数 1）が total に占める割合
  const sameStarts: number[] = [];
  const centrality: number[] = []; // 開始地点の中心性（盤面の重心からの距離の平均。小さいほど中心）
  const centralityV6: number[] = [];
  const totalsForCent: number[] = [];
  const totalsForCentV6: number[] = [];
  const pairDiff: Record<string, number[]> = {};
  let seed = 0, boards = 0;
  const t0 = Date.now();
  while (boards < N && seed < N * 800) {
    seed++;
    const { placement } = makeSearchPlacementFromSeed({ templateId, seed });
    const lm = buildLogicalMapFromPlacement({ templateId, placement });
    const extracted = extractForEval(lm as any, hard);
    if (!checkHardConstraints(extracted, placement as any, hard).pass) continue;
    boards++;
    const { breakdown } = evaluateSoft(extracted, soft);
    const audit: any = breakdown.audit;
    const sa: any = audit.startAccess;

    // 惑星ごとの状況の値（船接触・船星系・端）。ガイア近接・星系は入れない
    const situ = new Map<string, number>();
    const add = (k: string, v: number) => situ.set(k, (situ.get(k) ?? 0) + v);
    for (const h of audit.scout?.scoutHits ?? []) add(String(h.planetKey), Number(h.value) || 0);
    for (const h of audit.scoutCore?.coreHits ?? []) add(String(h.corePlanetKey), Number(h.value) || 0);
    for (const h of audit.outerHits ?? []) add(String(h.cellKey), Number(h.value) || 0);
    for (const h of audit.touchHits ?? []) add(String(h.cellKey), Number(h.value) || 0);

    const cells: any[] = (extracted as any).cells ?? [];
    const nodes: PlanetNode[] = cells
      .filter((c) => c.isPlanet)
      .map((c) => ({ key: String(c.key), q: Number(c.q), r: Number(c.r), kind: String(c.colorKey ?? c.planetKind ?? "").toUpperCase() }));
    const nodeByKey = new Map(nodes.map((n) => [n.key, n]));
    // 盤面の重心（全セル）
    let cx = 0, cy = 0;
    for (const c of cells) { cx += c.q + c.r / 2; cy += (c.r * Math.sqrt(3)) / 2; }
    cx /= Math.max(1, cells.length); cy /= Math.max(1, cells.length);
    const distToCenter = (key: string) => {
      const n = nodeByKey.get(key);
      if (!n) return NaN;
      const x = n.q + n.r / 2, y = (n.r * Math.sqrt(3)) / 2;
      return Math.hypot(x - cx, y - cy);
    };

    const byFaction: Record<string, { total: number; starts: string[]; cat: Record<Cat, number>; base: number; startVal: number }> = {};
    for (const f of ALL_FACTIONS) {
      const isLf = (LF_FACTION_ORDER as readonly string[]).includes(f);
      const home = isLf ? LF_REACH_PROFILES[f as keyof typeof LF_REACH_PROFILES].home : BASIC_REACH_PROFILES[f as keyof typeof BASIC_REACH_PROFILES].color;
      const startCount = isLf ? START_COUNT_LF : BASIC_REACH_PROFILES[f as keyof typeof BASIC_REACH_PROFILES].startCount;
      const stoneCost = isLf ? stoneCostForLfFaction(f as any) : stoneCostForBasicFaction(f as any);
      const hop = isLf ? hopCostForLfFaction(f as any) : hopCostForBasicFaction(f as any);
      const startKeys = new Set(nodes.filter((n) => n.kind === home).map((n) => n.key));
      if (startKeys.size === 0) continue;
      const candidates = nodes.map((n) => ({ key: n.key, value: coefOf(f, n.kind, home) * (P.BASE + (situ.get(n.key) ?? 0)) }));
      const plan = planStarts({ nodes, candidates, stoneCost, startCount, hopCost: hop, startKeys });
      if (!plan) continue;
      const cat: Record<Cat, number> = { own: 0, other: 0, gaia: 0, transdim: 0, extra: 0 };
      let base = 0, startVal = 0;
      for (const n of nodes) {
        const w = plan.weights.get(n.key) ?? 0;
        if (w <= 0) continue;
        const coef = coefOf(f, n.kind, home);
        const v = coef * (P.BASE + (situ.get(n.key) ?? 0)) * w;
        cat[catOf(n.kind, home)] += v;
        base += coef * P.BASE * w;
        if (plan.starts.includes(n.key)) startVal += v;
      }
      byFaction[f] = { total: plan.total, starts: plan.starts, cat, base, startVal };
      (facVals[f] ??= []).push(plan.total);
      const v6 = sa?.byFaction?.[f];
      if (v6) {
        (facValsV6[f] ??= []).push(v6.total);
        const a = plan.starts.slice().sort().join("|"), b = (v6.starts as string[]).slice().sort().join("|");
        sameStarts.push(a === b ? 1 : 0);
        const cNew = plan.starts.map(distToCenter).reduce((x, y) => x + y, 0) / plan.starts.length;
        const cV6 = (v6.starts as string[]).map(distToCenter).reduce((x, y) => x + y, 0) / v6.starts.length;
        centrality.push(cNew); totalsForCent.push(plan.total);
        centralityV6.push(cV6); totalsForCentV6.push(v6.total);
      }
      if (plan.total > 0) {
        for (const k of Object.keys(cat) as Cat[]) catShare[k].push(cat[k] / plan.total);
        baseShare.push(base / plan.total);
        startShare.push(startVal / plan.total);
      }
    }
    // 色の代表値（2種族の大きい方）と検索の偏り項（7色の標準偏差）
    const repNew: number[] = [], repOld: number[] = [];
    for (const c of BASIC) {
      const pair = BASIC_FACTION_ORDER.filter((f) => BASIC_REACH_PROFILES[f].color === c);
      const vn = Math.max(...pair.map((f) => byFaction[f]?.total ?? 0));
      const vo = Math.max(...pair.map((f) => sa?.byFaction?.[f]?.total ?? 0));
      repNew.push(vn); repOld.push(vo);
      const a = byFaction[pair[0]]?.total, b = byFaction[pair[1]]?.total;
      if (a != null && b != null) (pairDiff[c] ??= []).push(a - b);
    }
    repVals.push(...repNew); repValsV6.push(...repOld);
    tops.push(Math.max(...repNew));
    imbNew.push(std(repNew)); imbV6.push(std(repOld));
  }
  const ms = Date.now() - t0;
  console.log(`\n################ ${templateId}  盤面 ${boards}件（${seed} シード中、${ms}ms。H2 上限 ${outerCap}）`);
  if (boards === 0) continue;
  const rs = stat(repVals), ts = stat(tops), r6 = stat(repValsV6);
  console.log(`  色の代表値: 平均 ${f1(rs.mean)}（eval_v6 ${f1(r6.mean)}）  10%〜90% ${f1(rs.p10)}〜${f1(rs.p90)}`);
  console.log(`  盤面ごとの最上位: 中央値 ${f1(ts.med)}  10%〜90% ${f1(ts.p10)}〜${f1(ts.p90)}`);
  console.log(`  固有値の寄与 ${pct(stat(baseShare).mean)} / 開始地点の値の寄与 ${pct(stat(startShare).mean)}`);
  console.log(`  種別ごとの寄与: 母星色 ${pct(stat(catShare.own).mean)} / 他色 ${pct(stat(catShare.other).mean)} / ガイア ${pct(stat(catShare.gaia).mean)} / 次元横断 ${pct(stat(catShare.transdim).mean)} / 原始・小惑星 ${pct(stat(catShare.extra).mean)}`);
  console.log(`  eval_v6 との相関: 色の代表値（盤面×色）Spearman ${f2(spearman(repVals, repValsV6))} / 検索の偏り項（7色の標準偏差）Spearman ${f2(spearman(imbNew, imbV6))} / 開始地点が一致 ${pct(stat(sameStarts).mean)}`);
  console.log(`  開始地点の中心性との相関（種族の値 × 重心からの距離。負ほど中心が有利）: 新 ${f2(pearson(totalsForCent, centrality))} / eval_v6 ${f2(pearson(totalsForCentV6, centralityV6))}`);
  console.log(`  種族ごと: 平均（eval_v6 の平均） / 代表値の平均との比`);
  for (const f of ALL_FACTIONS) {
    const xs = facVals[f];
    if (!xs || xs.length === 0) continue;
    const s = stat(xs), s6 = stat(facValsV6[f] ?? [0]);
    console.log(`    ${f.padEnd(12)} ${f1(s.mean).padStart(6)}（${f1(s6.mean).padStart(5)}）  比 ${(s.mean / rs.mean).toFixed(2)}`);
  }
  console.log(`  同色2種族の差（前者 − 後者）の平均 / 10〜90%:`);
  for (const c of BASIC) {
    const xs = pairDiff[c];
    if (!xs || xs.length === 0) continue;
    const pair = BASIC_FACTION_ORDER.filter((f) => BASIC_REACH_PROFILES[f].color === c);
    const s = stat(xs);
    console.log(`    ${c.padEnd(6)} ${pair[0]} − ${pair[1]}: ${f1(s.mean).padStart(6)}  (${f1(s.p10)}〜${f1(s.p90)})`);
  }
}
