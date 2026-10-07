// scripts/_probe_unified.ts
//
// 「全惑星を同一の式で」の一本化（2026-10-07 ユーザー確定、eval_v7。docs/design-notes.md 2.10）の自己検算。
// 2026-10-07 の調査（6 通りの係数の比較）はこのスクリプトの前身で行い、結果は設計ノート 2.10 の表に記録済み。
// 本実装後は、机上の式（監査のヒットから惑星ごとの状況の値を作り直して planStarts で合計）と
// 実装（evaluateSoft の startAccess.byFaction）が一致することを確かめる役目（`_probe_rim.ts` と同じ）。
// 定数の比較は `_probe_map_values.ts`（環境変数で差し替え）で行う。
//
//   npx tsx scripts/_probe_unified.ts [件数=60] [基本版の H2 上限=3]
//
// 式: 種族の値 ＝ Σ_{盤面の全惑星 p} 係数_f(種別) × (固有値 ＋ 状況の値(p)) × 到達係数_f(開始地点 → p)
//   状況の値: 船接触 ＋ 船星系 ＋ 端の罰点（監査の scoutHits / coreHits / outerHits / touchHits から再構成）
//   係数: destinationCoef（reachCost.ts）。開始地点: 母星色（LF は母星種別）から k 個（planStarts の startKeys）
// 環境変数で定数を差し替えると実装側（UNIFIED_VALUE）も同じ値になるので、検算は常に同じ定数で行われる:
//   BASE=10 OTHER=0.25 GAIA=0.5 TRANS=0.25 EXTRA=0.1 GAIA_FACTION_TRANS=0.5 TERRA_BOOST=1.2 TERRA=geodens,taklons,nevlas

import { makeSearchPlacementFromSeed } from "../src/gaia/ssot/searchPlacementConfig";
import { buildLogicalMapFromPlacement } from "../src/gaia/logicalMap/buildLogicalMap";
import { extractForEval } from "../src/gaia/eval/extractForEval";
import { evaluateSoft } from "../src/gaia/eval/evaluateSoft";
import { checkHardConstraints } from "../src/gaia/constraints";
import {
  BASIC_FACTION_ORDER,
  BASIC_REACH_PROFILES,
  DESTINATION_KINDS,
  LF_FACTION_ORDER,
  LF_REACH_PROFILES,
  START_COUNT_LF,
  TERRAFORM_FACTIONS,
  UNIFIED_VALUE,
  destinationCoef,
  destinationKind,
  hopCostForBasicFaction,
  hopCostForLfFaction,
  planStarts,
  stoneCostForBasicFaction,
  stoneCostForLfFaction,
  type DestinationKind,
  type PlanetNode,
} from "../src/gaia/eval/reachCost";

const N = Number(process.argv[2] ?? 60) || 60;
const BASE_OUTER_CAP = Number(process.argv[3] ?? 3) || 3;

const ENV_KEYS: Record<string, keyof typeof UNIFIED_VALUE> = {
  BASE: "BASE", OTHER: "OTHER", GAIA: "GAIA", TRANS: "TRANSDIM", EXTRA: "EXTRA", GAIA_FACTION_TRANS: "GAIA_FACTION_TRANSDIM", TERRA_BOOST: "TERRA_BOOST",
};
for (const [env, key] of Object.entries(ENV_KEYS)) {
  const v = process.env[env];
  if (v != null && v !== "") UNIFIED_VALUE[key] = Number(v);
}
if (process.env.TERRA) {
  const s = TERRAFORM_FACTIONS as Set<string>;
  s.clear();
  for (const id of process.env.TERRA.split(",").map((x) => x.trim()).filter(Boolean)) s.add(id);
}

const soft = {
  wRimGap: 0.5,
  wScout: 10,
  wScoutCore: 4,
  scoutRadius: 3,
  wScoutByScoutKey: { twilight: 10, eclipse: 10, rebellion: 10, tfmars: 10 },
  wScoutCoreByScoutKey: { twilight: 3, eclipse: 3, rebellion: 3, tfmars: 3 },
  scoutCoreAttributionMode: "all",
  wImbalance: 1,
} as any;

const ALL_FACTIONS = [...BASIC_FACTION_ORDER, ...LF_FACTION_ORDER] as string[];
const f1 = (v: number) => v.toFixed(1);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

console.log(`定数: 固有値 ${UNIFIED_VALUE.BASE} / 他色 ${UNIFIED_VALUE.OTHER}（改造種族 ×${UNIFIED_VALUE.TERRA_BOOST}）/ ガイア ${UNIFIED_VALUE.GAIA} / 次元横断 ${UNIFIED_VALUE.TRANSDIM}（ガイア種族 ${UNIFIED_VALUE.GAIA_FACTION_TRANSDIM}）/ 原始・小惑星 ${UNIFIED_VALUE.EXTRA}`);

let worstDiff = 0, startsDiff = 0, kindDiff = 0, rows = 0;
for (const [templateId, outerCap] of [["4p_lostFleet", 1], ["3p_lostFleet", 1], ["base_34p", BASE_OUTER_CAP]] as Array<[string, number]>) {
  const hard = {
    minSameColorDist: 3,
    outerSameColorMax: outerCap,
    centerMode: "NONE",
    maxConnectedPlanets: 0,
    h5IncludeScouts: false,
    ...(templateId === "base_34p" ? { banSameKindAdjacency: true } : {}),
  } as any;
  let seed = 0, boards = 0, tDiff = 0, tStarts = 0, tKind = 0, tRows = 0;
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

    // 惑星ごとの状況の値（船接触・船星系・端）を監査のヒットから再構成
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

    for (const f of ALL_FACTIONS) {
      const isLf = (LF_FACTION_ORDER as readonly string[]).includes(f);
      const home = isLf ? LF_REACH_PROFILES[f as keyof typeof LF_REACH_PROFILES].home : BASIC_REACH_PROFILES[f as keyof typeof BASIC_REACH_PROFILES].color;
      const startCount = isLf ? START_COUNT_LF : BASIC_REACH_PROFILES[f as keyof typeof BASIC_REACH_PROFILES].startCount;
      const stoneCost = isLf ? stoneCostForLfFaction(f as any) : stoneCostForBasicFaction(f as any);
      const hop = isLf ? hopCostForLfFaction(f as any) : hopCostForBasicFaction(f as any);
      const startKeys = new Set(nodes.filter((n) => n.kind === home).map((n) => n.key));
      const impl = sa?.byFaction?.[f];
      if (startKeys.size === 0) {
        if (impl) { console.log(`  !! ${templateId} seed ${seed} ${f}: 母星色が無いのに実装に行がある`); tDiff = Math.max(tDiff, 999); }
        continue;
      }
      const candidates = nodes.map((n) => ({ key: n.key, value: destinationCoef(f, n.kind, home) * (UNIFIED_VALUE.BASE + (situ.get(n.key) ?? 0)) }));
      const plan = planStarts({ nodes, candidates, stoneCost, startCount, hopCost: hop, startKeys });
      if (!plan || !impl) { console.log(`  !! ${templateId} seed ${seed} ${f}: 片方だけ null`); tDiff = Math.max(tDiff, 999); continue; }
      // 種別ごとに丸めて合計（実装と同じ丸め）
      const byKind: Record<DestinationKind, number> = { own: 0, other: 0, gaia: 0, transdim: 0, extra: 0 };
      for (const n of nodes) {
        const w = plan.weights.get(n.key) ?? 0;
        if (w <= 0) continue;
        byKind[destinationKind(n.kind, home)] += destinationCoef(f, n.kind, home) * (UNIFIED_VALUE.BASE + (situ.get(n.key) ?? 0)) * w;
      }
      let total = 0;
      for (const k of DESTINATION_KINDS) { byKind[k] = Math.round(byKind[k]); total += byKind[k]; if (byKind[k] !== impl.byKind?.[k]) tKind++; }
      tRows++;
      tDiff = Math.max(tDiff, Math.abs(total - impl.total));
      const a = plan.starts.slice().sort().join("|"), b = (impl.starts as string[]).slice().sort().join("|");
      if (a !== b) tStarts++;
    }
  }
  console.log(`\n################ ${templateId}  盤面 ${boards}件（${seed} シード中、${Date.now() - t0}ms。H2 上限 ${outerCap}）`);
  console.log(`  自己検算: 種族の行 ${tRows}、評価の差の最大 ${f1(tDiff)}、種別の列が違う ${tKind}、開始地点が違う ${tStarts}（${pct(tStarts / Math.max(1, tRows))}）`);
  worstDiff = Math.max(worstDiff, tDiff); startsDiff += tStarts; kindDiff += tKind; rows += tRows;
}
console.log(`\n合計: 種族の行 ${rows}、評価の差の最大 ${f1(worstDiff)}、種別の列が違う ${kindDiff}、開始地点が違う ${startsDiff} → ${worstDiff === 0 && kindDiff === 0 && startsDiff === 0 ? "一致" : "不一致あり"}`);
