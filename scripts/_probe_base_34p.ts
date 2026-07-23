// scripts/_probe_base_34p.ts
//
// base_34p slotCenters の機械検証プローブ（docs/map-base-spec.md §3-1）:
//   1. 隣接グラフ: スロット中心の差が超タイル隣接ベクトル {(5,-2)の60°回転族}
//      になっている対を列挙し、p4図の期待グラフと完全一致することを確認。
//   2. 充填: 全回転組合せ（rot 0..5 独立×10タイル、ランダム200組＋全0/全1..全5）で
//      buildLogicalMapFromPlacement が collision 0・総セル数 190（19×10）を返すこと。
//   3. 連結: 190セルが AXIAL_DIRS で単一連結成分になること（穴・飛び地なし）。
//
// Usage: npx tsx scripts/_probe_base_34p.ts

import {
  SLOT_CENTERS_BASE_34P,
  BASE_34P_INNER_SLOTS,
  BASE_34P_OUTER_SLOTS,
} from "../src/gaia/templates/base_34p_slotCenters";
import {
  buildLogicalMapFromPlacement,
  connectedComponents,
} from "../src/gaia/logicalMap/buildLogicalMap";

// --- 1. adjacency graph ---------------------------------------------------

const NEIGHBOR_VECS = [
  { q: 5, r: -2 },
  { q: 2, r: 3 },
  { q: -3, r: 5 },
  { q: -5, r: 2 },
  { q: -2, r: -3 },
  { q: 3, r: -5 },
];

const EXPECTED_EDGES = new Set(
  [
    // 中段行内: L9-L2-L3-L6
    ["L9", "L2"], ["L2", "L3"], ["L3", "L6"],
    // 上段行内: L10-L1-L5
    ["L10", "L1"], ["L1", "L5"],
    // 下段行内: L8-L4-L7
    ["L8", "L4"], ["L4", "L7"],
    // 対角
    ["L10", "L9"], ["L10", "L2"],
    ["L1", "L2"], ["L1", "L3"],
    ["L5", "L3"], ["L5", "L6"],
    ["L8", "L9"], ["L8", "L2"],
    ["L4", "L2"], ["L4", "L3"],
    ["L7", "L3"], ["L7", "L6"],
  ].map(([a, b]) => (a < b ? `${a}|${b}` : `${b}|${a}`))
);

const slotIds = Object.keys(SLOT_CENTERS_BASE_34P);
const actualEdges = new Set<string>();
for (let i = 0; i < slotIds.length; i++) {
  for (let j = i + 1; j < slotIds.length; j++) {
    const a = SLOT_CENTERS_BASE_34P[slotIds[i]];
    const b = SLOT_CENTERS_BASE_34P[slotIds[j]];
    const d = { q: b.q - a.q, r: b.r - a.r };
    if (NEIGHBOR_VECS.some((v) => v.q === d.q && v.r === d.r) ||
        NEIGHBOR_VECS.some((v) => v.q === -d.q && v.r === -d.r)) {
      const [x, y] = [slotIds[i], slotIds[j]].sort();
      actualEdges.add(`${x}|${y}`);
    }
  }
}

const missing = [...EXPECTED_EDGES].filter((e) => !actualEdges.has(e));
const extra = [...actualEdges].filter((e) => !EXPECTED_EDGES.has(e));
if (missing.length || extra.length) {
  console.error(`[probe_base_34p] adjacency FAIL missing=${missing} extra=${extra}`);
  process.exit(1);
}
console.log(`[probe_base_34p] adjacency OK (${actualEdges.size} edges match p4 figure)`);

// inner/outer slot naming sanity
const allSlots = [...BASE_34P_INNER_SLOTS, ...BASE_34P_OUTER_SLOTS];
if (allSlots.length !== 10 || new Set(allSlots).size !== 10 ||
    !allSlots.every((s) => s in SLOT_CENTERS_BASE_34P)) {
  console.error(`[probe_base_34p] inner/outer slot lists inconsistent with SLOT_CENTERS`);
  process.exit(1);
}

// --- 2/3. tiling + connectivity over rotations ----------------------------

const SECTOR_IDS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"];
const SLOT_ORDER = ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10"];

// deterministic LCG for reproducibility
let s = 123456789;
const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

const rotCombos: number[][] = [];
for (let r = 0; r < 6; r++) rotCombos.push(Array(10).fill(r));
for (let t = 0; t < 200; t++) rotCombos.push(SLOT_ORDER.map(() => Math.floor(rnd() * 6)));

let checked = 0;
for (const rots of rotCombos) {
  const placement = SLOT_ORDER.map((slotId, i) => ({
    slotId,
    sectorId: SECTOR_IDS[i],
    rot: rots[i],
  }));
  const lm = buildLogicalMapFromPlacement({ templateId: "base_34p", placement: placement as any });

  if (lm.collisionCount !== 0) {
    console.error(`[probe_base_34p] tiling FAIL rots=${rots} collisions=${lm.collisionCount}`);
    console.error(lm.collisions.slice(0, 5));
    process.exit(1);
  }
  if (lm.cellsByKey.size !== 190) {
    console.error(`[probe_base_34p] cell count FAIL rots=${rots} got=${lm.cellsByKey.size} want=190`);
    process.exit(1);
  }
  const comps = connectedComponents([...lm.cellsByKey.values()].map((c) => c.pos));
  if (comps.length !== 1) {
    console.error(`[probe_base_34p] connectivity FAIL rots=${rots} components=${comps.length}`);
    process.exit(1);
  }
  checked++;
}
console.log(`[probe_base_34p] tiling OK (${checked} rotation combos: 0 collisions, 190 cells, 1 component)`);

// bounds report
{
  const placement = SLOT_ORDER.map((slotId, i) => ({ slotId, sectorId: SECTOR_IDS[i], rot: 0 }));
  const lm = buildLogicalMapFromPlacement({ templateId: "base_34p", placement: placement as any });
  console.log(`[probe_base_34p] bounds:`, lm.bounds);
}
