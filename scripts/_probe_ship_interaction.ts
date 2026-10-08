// scripts/_probe_ship_interaction.ts
//
// LF 船の中身とスカウトの位置の相互作用・段階 1（2026-10-08、案 (ii) 加重和）の実測。
//
//   npx tsx scripts/_probe_ship_interaction.ts [盤面数=40] [セットアップ数=20]
//   ALPHA=1 npx tsx ...   で α を差し替え（既定はコードの SHIP_INTERACTION_ALPHA）
//
// ハード制約を通った LF の盤面 × ランダムなセットアップの組について、
//   - 船ごとの船接触 C_s の相対値 (C_s − C̄) / C̄ の分布
//   - 加点の桁（種族ごとの |加点| の平均・最大、Setup の値・lfShip の列に対する比）
//   - Map ＋ Setup（1:1）の合計で、人数＋2 色の上位（List の「合計の上位」）が組ごとに変わる割合、
//     Setup 単独の上位 5 種族が変わる割合
// を出す。Map の桁や α を決めるときの材料。

import { makeSearchPlacementFromSeed } from "../src/gaia/ssot/searchPlacementConfig";
import { buildLogicalMapFromPlacement } from "../src/gaia/logicalMap/buildLogicalMap";
import { extractForEval } from "../src/gaia/eval/extractForEval";
import { evaluateSoft } from "../src/gaia/eval/evaluateSoft";
import { checkHardConstraints } from "../src/gaia/constraints";
import { buildSetupFromSeed } from "../src/gaia/setup/buildSetup";
import { scoreSetupFactions, setupFactionBreakdown, topFactions, topFactionsByColor, type FactionScores } from "../src/gaia/eval/factionEval";
import { mapValueByFaction } from "../src/gaia/eval/mapFaction";
import { factionIdsForMode } from "../src/gaia/eval/factionWeights";
import { SHIP_INTERACTION_ALPHA, applyShipInteraction, shipInteractionOf } from "../src/gaia/eval/shipInteraction";

const N_MAPS = Number(process.argv[2] ?? 40) || 40;
const N_SETUPS = Number(process.argv[3] ?? 20) || 20;
const ALPHA = process.env.ALPHA != null && process.env.ALPHA !== "" ? Number(process.env.ALPHA) : SHIP_INTERACTION_ALPHA;

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

function stat(xs: number[]) {
  const s = xs.slice().sort((a, b) => a - b);
  const q = (f: number) => s[Math.min(s.length - 1, Math.floor(s.length * f))] ?? 0;
  return { n: s.length, mean: s.reduce((a, b) => a + b, 0) / Math.max(1, s.length), med: q(0.5), p10: q(0.1), p90: q(0.9), min: s[0] ?? 0, max: s[s.length - 1] ?? 0 };
}
const f1 = (v: number) => v.toFixed(1);
const f2 = (v: number) => v.toFixed(2);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

console.log(`α ${ALPHA}（コードの既定 ${SHIP_INTERACTION_ALPHA}）。盤面 ${N_MAPS} × セットアップ ${N_SETUPS}`);

for (const [templateId, players] of [["4p_lostFleet", 4], ["3p_lostFleet", 3]] as Array<[string, number]>) {
  const hard = { minSameColorDist: 3, outerSameColorMax: 1, centerMode: "NONE", maxConnectedPlanets: 0, h5IncludeScouts: false } as any;
  const maps: any[] = [];
  let seed = 0;
  while (maps.length < N_MAPS && seed < N_MAPS * 800) {
    seed++;
    const { placement } = makeSearchPlacementFromSeed({ templateId, seed });
    const lm = buildLogicalMapFromPlacement({ templateId, placement });
    const extracted = extractForEval(lm as any, hard);
    if (!checkHardConstraints(extracted, placement as any, hard).pass) continue;
    maps.push(evaluateSoft(extracted, soft).breakdown);
  }
  const setups = Array.from({ length: N_SETUPS }, (_, i) => buildSetupFromSeed({ seed: `ship-${i + 1}`, playerCount: players, mode: "lostFleet" }));
  const ids = factionIdsForMode(true);

  const rels: number[] = [];
  const absBonus: number[] = [];
  const bonusOverSetup: number[] = [];
  const bonusOverShip: number[] = [];
  const maxAbsBonusPerPair: number[] = [];
  let pairs = 0, noInteraction = 0, totalTopChanged = 0, setupTopChanged = 0, totalTopColorSetChanged = 0;
  for (const bd of maps) {
    const mapScores = mapValueByFaction(bd);
    for (const s of setups) {
      pairs++;
      const raw = scoreSetupFactions(s);
      const lfShip = setupFactionBreakdown(s).byCategory.lfShip;
      const si = shipInteractionOf(s, bd, undefined, ALPHA);
      if (!si) { noInteraction++; continue; }
      for (const r of si.ships) rels.push(r.rel);
      const adj = applyShipInteraction(raw, si);
      let maxAbs = 0;
      for (const f of ids) {
        const b = adj[f] - raw[f];
        absBonus.push(Math.abs(b));
        maxAbs = Math.max(maxAbs, Math.abs(b));
        if (raw[f] > 0) bonusOverSetup.push(Math.abs(b) / raw[f]);
        if (lfShip[f] > 0) bonusOverShip.push(Math.abs(b) / lfShip[f]);
      }
      maxAbsBonusPerPair.push(maxAbs);
      // Setup 単独の上位 5
      const top5 = (sc: FactionScores) => topFactions(sc, 5, true).join(",");
      if (top5(raw) !== top5(adj)) setupTopChanged++;
      // Map ＋ Setup（1:1）の合計で人数＋2 色の上位（List の「合計の上位」）
      const total = (sc: FactionScores) => {
        const t = {} as FactionScores;
        for (const f of ids) t[f] = (mapScores[f] ?? 0) + (sc[f] ?? 0);
        return t;
      };
      const a = topFactionsByColor(total(raw), players + 2, true), b = topFactionsByColor(total(adj), players + 2, true);
      if (a.join(",") !== b.join(",")) totalTopChanged++;
      if (a.slice().sort().join(",") !== b.slice().sort().join(",")) totalTopColorSetChanged++;
    }
  }
  const r = stat(rels), ab = stat(absBonus), mx = stat(maxAbsBonusPerPair), bs = stat(bonusOverSetup), bh = stat(bonusOverShip);
  console.log(`\n################ ${templateId}  盤面 ${maps.length} × セットアップ ${setups.length} ＝ ${pairs} 組（相互作用なし ${noInteraction}）`);
  console.log(`  船接触の相対値 (C_s − C̄)/C̄: 平均 ${f2(r.mean)}  10%〜90% ${f2(r.p10)}〜${f2(r.p90)}  最小 ${f2(r.min)} / 最大 ${f2(r.max)}`);
  console.log(`  加点 |b_f|: 平均 ${f1(ab.mean)}  中央 ${f1(ab.med)}  90% ${f1(ab.p90)}  最大 ${f1(ab.max)}   組ごとの最大 |b|: 平均 ${f1(mx.mean)}  90% ${f1(mx.p90)}`);
  console.log(`  |b_f| / Setup の値: 平均 ${pct(bs.mean)}  90% ${pct(bs.p90)}   |b_f| / lfShip の列: 平均 ${pct(bh.mean)}  90% ${pct(bh.p90)}`);
  console.log(`  Setup 単独の上位 5 種族の並びが変わる組 ${pct(setupTopChanged / Math.max(1, pairs - noInteraction))}`);
  console.log(`  Map ＋ Setup の「合計の上位 ${players + 2} 色」: 並びが変わる組 ${pct(totalTopChanged / Math.max(1, pairs - noInteraction))} / 顔ぶれが変わる組 ${pct(totalTopColorSetChanged / Math.max(1, pairs - noInteraction))}`);
}
