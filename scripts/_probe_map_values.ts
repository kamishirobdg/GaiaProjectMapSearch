// scripts/_probe_map_values.ts
//
// Map 評価値の実測（2026-10-03 に「開始地点＋到達加重」で作成、2026-10-05 に種族ごと、
// 2026-10-07 に「全惑星を同一の式で」（eval_v7、docs/design-notes.md 2.10）に合わせて作り直し）。
//
//   npx tsx scripts/_probe_map_values.ts [件数=60] [基本版の H2 上限=3]
//
// 既定の評価指数（src/app/board/page.tsx の DEFAULT_CONDITIONS と同じ）で、ハード制約を通った盤面だけを
// 集め、実装そのもの（evaluateSoft）の出力から次を出す:
//   色の代表値・盤面ごとの最上位（桁）、種別ごとの寄与（母星色 / 他色 / ガイア / 次元横断 / 原始・小惑星）、
//   固有値の寄与、開始地点以外（到達加重）の寄与、種族ごとの平均、同色2種族の差、
//   開始地点の中心性との相関（負ほど中心が有利）、開始地点が最外周 / 外周にある割合。
// 端の罰点 w を複数与えると（W=0.5,1,2）、w ごとの比較表も出す（基本版の w を決め直すための材料。設計ノート 2.10）。
//
// 環境変数で定数を差し替えて比べる（既定は reachCost.ts の UNIFIED_VALUE / 種族の型）:
//   W=0.5,1,2                       端の罰点 w の候補（先頭が主。既定 0.5）
//   BASE=10 OTHER=0.25 GAIA=0.5 TRANS=0.25 EXTRA=0.1 GAIA_FACTION_TRANS=0.5 TERRA_BOOST=1.2
//   TERRA=geodens,taklons,nevlas    改造種族の分類（他色 × TERRA_BOOST）
//   GAIA_FACTIONS=terrans,balTaks,itars,moweyds
// 基本版は H2 の上限1だとほぼ通らないので既定で上限3にしてある。

import { makeSearchPlacementFromSeed } from "../src/gaia/ssot/searchPlacementConfig";
import { buildLogicalMapFromPlacement } from "../src/gaia/logicalMap/buildLogicalMap";
import { extractForEval } from "../src/gaia/eval/extractForEval";
import { evaluateSoft } from "../src/gaia/eval/evaluateSoft";
import { checkHardConstraints } from "../src/gaia/constraints";
import {
  BASIC_FACTION_ORDER,
  BASIC_REACH_PROFILES,
  DESTINATION_KINDS,
  GAIA_FACTIONS,
  LF_FACTION_ORDER,
  TERRAFORM_FACTIONS,
  UNIFIED_VALUE,
  type DestinationKind,
} from "../src/gaia/eval/reachCost";

const N = Number(process.argv[2] ?? 60) || 60;
const BASE_OUTER_CAP = Number(process.argv[3] ?? 3) || 3;
const W_LIST = String(process.env.W ?? "0.5").split(",").map((x) => Number(x)).filter((x) => Number.isFinite(x));
const W_MAIN = W_LIST[0] ?? 0.5;

const ENV_KEYS: Record<string, keyof typeof UNIFIED_VALUE> = {
  BASE: "BASE", OTHER: "OTHER", GAIA: "GAIA", TRANS: "TRANSDIM", EXTRA: "EXTRA", GAIA_FACTION_TRANS: "GAIA_FACTION_TRANSDIM", TERRA_BOOST: "TERRA_BOOST",
};
for (const [env, key] of Object.entries(ENV_KEYS)) {
  const v = process.env[env];
  if (v != null && v !== "") UNIFIED_VALUE[key] = Number(v);
}
const overrideSet = (set: ReadonlySet<string>, env: string | undefined) => {
  if (env == null || env === "") return;
  const s = set as Set<string>;
  s.clear();
  for (const id of env.split(",").map((x) => x.trim()).filter(Boolean)) s.add(id);
};
overrideSet(TERRAFORM_FACTIONS, process.env.TERRA);
overrideSet(GAIA_FACTIONS, process.env.GAIA_FACTIONS);

console.log(
  `定数: 固有値 ${UNIFIED_VALUE.BASE} / 母星色 ${UNIFIED_VALUE.OWN} / 他色 ${UNIFIED_VALUE.OTHER}（改造種族 ×${UNIFIED_VALUE.TERRA_BOOST}）/ ガイア ${UNIFIED_VALUE.GAIA} / ` +
    `次元横断 ${UNIFIED_VALUE.TRANSDIM}（ガイア種族 ${UNIFIED_VALUE.GAIA_FACTION_TRANSDIM}）/ 原始・小惑星 ${UNIFIED_VALUE.EXTRA}。端の罰点 w ${W_LIST.join(" / ")}（主 ${W_MAIN}）`
);
console.log(`ガイア種族: ${[...GAIA_FACTIONS].join(", ")} / 改造種族: ${[...TERRAFORM_FACTIONS].join(", ")}`);

const softFor = (w: number) =>
  ({
    ...(w > 0 ? { wRimGap: w } : {}),
    wScout: 10,
    wScoutCore: 4,
    scoutRadius: 3,
    wScoutByScoutKey: { twilight: 10, eclipse: 10, rebellion: 10, tfmars: 10 },
    wScoutCoreByScoutKey: { twilight: 3, eclipse: 3, rebellion: 3, tfmars: 3 },
    scoutCoreAttributionMode: "all",
    wImbalance: 1,
  }) as any;

const BASIC = ["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW"];
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
const f1 = (v: number) => v.toFixed(1);
const f2 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : "  nan");
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

type Board = { extracted: any; cells: any[]; cx: number; cy: number };

for (const [templateId, outerCap] of [["4p_lostFleet", 1], ["3p_lostFleet", 1], ["base_34p", BASE_OUTER_CAP]] as Array<[string, number]>) {
  const hard = {
    minSameColorDist: 3,
    outerSameColorMax: outerCap,
    centerMode: "NONE",
    maxConnectedPlanets: 0,
    h5IncludeScouts: false,
    ...(templateId === "base_34p" ? { banSameKindAdjacency: true } : {}),
  } as any;

  // ハード制約を通った盤面を集める
  const boards: Board[] = [];
  let seed = 0;
  const t0 = Date.now();
  while (boards.length < N && seed < N * 800) {
    seed++;
    const { placement } = makeSearchPlacementFromSeed({ templateId, seed });
    const lm = buildLogicalMapFromPlacement({ templateId, placement });
    const extracted = extractForEval(lm as any, hard);
    if (!checkHardConstraints(extracted, placement as any, hard).pass) continue;
    const cells: any[] = (extracted as any).cells ?? [];
    let cx = 0, cy = 0;
    for (const c of cells) { cx += c.q + c.r / 2; cy += (c.r * Math.sqrt(3)) / 2; }
    boards.push({ extracted, cells, cx: cx / Math.max(1, cells.length), cy: cy / Math.max(1, cells.length) });
  }
  console.log(`\n################ ${templateId}  盤面 ${boards.length}件（${seed} シード中、${Date.now() - t0}ms。H2 上限 ${outerCap}。既定の評価指数）`);
  if (boards.length === 0) continue;

  type Run = {
    repVals: number[]; tops: number[]; topColor: string[]; imb: number[];
    facVals: Record<string, number[]>; pairDiff: Record<string, number[]>;
    kindShare: Record<DestinationKind, number[]>; baseShare: number[]; restShare: number[];
    cent: number[]; centTotals: number[]; rimStarts: number; startsN: number;
    centBasic: number[]; centBasicTotals: number[];
  };
  const runFor = (w: number): Run => {
    const R: Run = {
      repVals: [], tops: [], topColor: [], imb: [], facVals: {}, pairDiff: {},
      kindShare: { own: [], other: [], gaia: [], transdim: [], extra: [] }, baseShare: [], restShare: [],
      cent: [], centTotals: [], rimStarts: 0, startsN: 0, centBasic: [], centBasicTotals: [],
    };
    const soft = softFor(w);
    for (const b of boards) {
      const { breakdown } = evaluateSoft(b.extracted, soft);
      const sa: any = (breakdown.audit as any).startAccess;
      const totals = breakdown.planetTypeTotals as Record<string, number>;
      const nodeByKey = new Map<string, any>(b.cells.filter((c) => c.isPlanet).map((c) => [String(c.key), c]));
      const distToCenter = (key: string) => {
        const n = nodeByKey.get(key);
        if (!n) return NaN;
        return Math.hypot(n.q + n.r / 2 - b.cx, (n.r * Math.sqrt(3)) / 2 - b.cy);
      };
      for (const f of ALL_FACTIONS) {
        const e = sa?.byFaction?.[f];
        if (!e) continue;
        (R.facVals[f] ??= []).push(e.total);
        if (e.total > 0) {
          for (const k of DESTINATION_KINDS) R.kindShare[k].push((e.byKind?.[k] ?? 0) / e.total);
          R.baseShare.push((e.base ?? 0) / e.total);
          let rest = 0;
          for (const p of e.planets ?? []) if (p.weight > 0 && p.weight < 1) rest += p.weight * p.value;
          R.restShare.push(rest / e.total);
        }
        const starts: string[] = e.starts ?? [];
        for (const s of starts) {
          R.startsN++;
          if (b.extracted.outerCells.has(s) || b.extracted.touchCells.has(s)) R.rimStarts++;
        }
        const c = starts.map(distToCenter).reduce((x, y) => x + y, 0) / Math.max(1, starts.length);
        R.cent.push(c); R.centTotals.push(e.total);
        if ((BASIC_FACTION_ORDER as readonly string[]).includes(f)) { R.centBasic.push(c); R.centBasicTotals.push(e.total); }
      }
      const rep = BASIC.map((c) => totals[c] ?? 0);
      R.repVals.push(...rep);
      const top = Math.max(...rep);
      R.tops.push(top);
      R.topColor.push(BASIC[rep.indexOf(top)]);
      const m = rep.reduce((a, x) => a + x, 0) / rep.length;
      R.imb.push(Math.sqrt(rep.reduce((a, x) => a + (x - m) ** 2, 0) / rep.length));
      for (const c of BASIC) {
        const pair = BASIC_FACTION_ORDER.filter((f) => BASIC_REACH_PROFILES[f].color === c);
        const a = sa?.byFaction?.[pair[0]]?.total, bb = sa?.byFaction?.[pair[1]]?.total;
        if (typeof a === "number" && typeof bb === "number") (R.pairDiff[c] ??= []).push(a - bb);
      }
    }
    return R;
  };

  const main = runFor(W_MAIN);
  const rs = stat(main.repVals), ts = stat(main.tops);
  console.log(`  色の代表値: 平均 ${f1(rs.mean)}  10%〜90% ${f1(rs.p10)}〜${f1(rs.p90)}`);
  console.log(`  盤面ごとの最上位: 中央値 ${f1(ts.med)}  10%〜90% ${f1(ts.p10)}〜${f1(ts.p90)}`);
  console.log(`  種別ごとの寄与（全種族の平均）: 母星色 ${pct(stat(main.kindShare.own).mean)} / 他色 ${pct(stat(main.kindShare.other).mean)} / ガイア ${pct(stat(main.kindShare.gaia).mean)} / 次元横断 ${pct(stat(main.kindShare.transdim).mean)} / 原始・小惑星 ${pct(stat(main.kindShare.extra).mean)}`);
  console.log(`  固有値の寄与 ${pct(stat(main.baseShare).mean)} / 開始地点以外（到達加重）の寄与 ${pct(stat(main.restShare).mean)}`);
  console.log(`  開始地点が最外周 / 外周にある割合 ${pct(main.rimStarts / Math.max(1, main.startsN))} / 開始地点の中心性との相関（種族の値 × 重心からの距離。負ほど中心が有利）: 全種族 ${f2(pearson(main.centTotals, main.cent))} / 基本14種族 ${f2(pearson(main.centBasicTotals, main.centBasic))}`);
  console.log(`  種族ごと: 平均 / 中央 / 色の代表値の平均との比`);
  for (const f of ALL_FACTIONS) {
    const xs = main.facVals[f];
    if (!xs || xs.length === 0) continue;
    const s = stat(xs);
    const color = (BASIC_FACTION_ORDER as readonly string[]).includes(f) ? BASIC_REACH_PROFILES[f as keyof typeof BASIC_REACH_PROFILES].color : "LF";
    console.log(`    ${f.padEnd(12)} ${color.padEnd(6)} ${f1(s.mean).padStart(6)}  ${f1(s.med).padStart(6)}  比 ${(s.mean / rs.mean).toFixed(2)}`);
  }
  console.log(`  同色2種族の差（前者 − 後者）の平均 / 10〜90%:`);
  for (const c of BASIC) {
    const xs = main.pairDiff[c];
    if (!xs || xs.length === 0) continue;
    const pair = BASIC_FACTION_ORDER.filter((f) => BASIC_REACH_PROFILES[f].color === c);
    const s = stat(xs);
    console.log(`    ${c.padEnd(6)} ${pair[0]} − ${pair[1]}: ${f1(s.mean).padStart(6)}  (${f1(s.p10)}〜${f1(s.p90)})`);
  }

  if (W_LIST.length > 1) {
    const none = runFor(0);
    console.log(`\n  端の罰点 w の比較（罰点なしとの差。中心性は基本14種族 / 全種族。並びの相関は主 w ${W_MAIN} の色の代表値との Spearman）`);
    console.log(`    w      最上位中央値  色の代表値平均  罰点の影響(全体)  開始地点が最外周/外周  中心性 基本 / 全   並びの相関   最上位色が変わる盤面`);
    for (const w of W_LIST) {
      const R = w === W_MAIN ? main : runFor(w);
      const delta = R.repVals.map((v, i) => none.repVals[i] - v);
      const noneMean = stat(none.repVals).mean;
      let topChanged = 0;
      for (let i = 0; i < R.topColor.length; i++) if (R.topColor[i] !== main.topColor[i]) topChanged++;
      console.log(
        `    ${String(w).padEnd(6)} ${f1(stat(R.tops).med).padStart(9)}     ${f1(stat(R.repVals).mean).padStart(9)}        ${pct(stat(delta).mean / noneMean).padStart(6)}            ${pct(R.rimStarts / Math.max(1, R.startsN)).padStart(6)}          ` +
          `${f2(pearson(R.centBasicTotals, R.centBasic))} / ${f2(pearson(R.centTotals, R.cent))}      ${f2(spearman(R.repVals, main.repVals))}         ${pct(topChanged / boards.length)}`
      );
    }
  }
}
