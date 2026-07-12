// scripts/_probe_4p_m2m5.ts
//
// READ-ONLY numerical probe (no src/ changes).
//
// Purpose: additional evidence for the M2/M5 bug found in
// src/gaia/templates/4p_lostfleet_slotCenters.ts (their (q,r) values are a
// verbatim copy of the 3p file, unrelated to the 4p display-side positions
// in src/gaia/data/templates/4p_lostFleet.ts).
//
// 1. Runs the real 4p buildLogicalMapFromPlacement() pipeline for several
//    seeds and reports cell collisions (LogicalMap.collisions), specifically
//    whether M2/M5 participate in any collision.
// 2. Derives, from the verified relation
//        display.pos[X] == axialRotateCCW(slotCenters[X], 3) + C_group
//    (axialRotateCCW(.,3) is the 180-degree rotation, which is a pure
//    negation (q,r) -> (-q,-r) and therefore self-inverse), the "correct"
//    slotCenters value for every MIDDLE slot:
//        slotCenters_correct[X] = axialRotateCCW(display.pos[X] - C_group, 3)
//                                = (C_group.q - display.pos[X].q, C_group.r - display.pos[X].r)
//    and prints current vs. correct for every M slot (not just M2/M5), so the
//    "only M2/M5 are broken" claim is verified rather than assumed.

import { buildLogicalMapFromPlacement } from "../src/gaia/logicalMap/buildLogicalMap";
import { makeSearchPlacementFromSeed } from "../src/gaia/ssot/searchPlacementConfig";
import { TEMPLATE_4P_LOSTFLEET } from "../src/gaia/data/templates/4p_lostFleet";
import * as SlotCenters4p from "../src/gaia/templates/4p_lostfleet_slotCenters";

type Axial = { q: number; r: number };

// C_group per MIDDLE sub-group, empirically confirmed for M1/M3/M4/M6/M7/M8
// (the 6 slots whose current slotCenters value is already consistent with
// display.pos through this relation).
const C_GROUP: Record<string, Axial> = {
  M1: { q: 17, r: 14 },
  M2: { q: 17, r: 14 },
  M3: { q: 17, r: 14 },
  M4: { q: 17, r: 14 },
  M5: { q: 18, r: 14 },
  M6: { q: 18, r: 14 },
  M7: { q: 18, r: 14 },
  M8: { q: 18, r: 14 },
};

function correctSlotCenter(displayPos: Axial, c: Axial): Axial {
  // axialRotateCCW(pos,3) == (-pos.q,-pos.r) (verified: 3 steps of the 60deg
  // cube rotation used elsewhere in this codebase negates all three cube
  // coords, and axial (q,r) is just the (x,z) pair of that cube coord).
  // display.pos == (-slotCenters.q, -slotCenters.r) + C
  // => slotCenters == (C.q - display.pos.q, C.r - display.pos.r)
  return { q: c.q - displayPos.q, r: c.r - displayPos.r };
}

// ---------------------------------------------------------------------------
// Part 1: current vs. correct slotCenters for all MIDDLE slots
// ---------------------------------------------------------------------------

const slotCenters4p = (SlotCenters4p as any).SLOT_CENTERS_4P_LOSTFLEET as Record<string, Axial>;
const displayById = new Map(TEMPLATE_4P_LOSTFLEET.slots.map((s) => [s.slotId, s.pos as Axial]));

console.log("=== 4p MIDDLE slots: current slotCenters vs. relation-derived correct value ===");
for (const slotId of ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8"]) {
  const current = slotCenters4p[slotId];
  const disp = displayById.get(slotId)!;
  const correct = correctSlotCenter(disp, C_GROUP[slotId]);
  const matches = current.q === correct.q && current.r === correct.r;
  console.log(
    `  ${slotId}  display.pos=(${disp.q},${disp.r})  current=(${current.q},${current.r})  ` +
      `correct=(${correct.q},${correct.r})  ${matches ? "OK" : "MISMATCH <-- BUG"}`
  );
}

// ---------------------------------------------------------------------------
// Part 2: real pipeline collision check across multiple seeds
// ---------------------------------------------------------------------------

const SEEDS: Array<number | string> = [
  "snap-0001",
  "snap-0002",
  "snap-0003",
  "snap-0004",
  "snap-0005",
  "snap-0006",
  "snap-0007",
  "snap-0008",
];

console.log("\n=== 4p buildLogicalMapFromPlacement: collision check across seeds ===");
for (const seed of SEEDS) {
  const { placement } = makeSearchPlacementFromSeed({ templateId: "4p_lostFleet", seed });
  const logicalMap = buildLogicalMapFromPlacement({ templateId: "4p_lostFleet", placement, seed });

  const m2m5Collisions = logicalMap.collisions.filter(
    (c) => c.a.slotId === "M2" || c.a.slotId === "M5" || c.b.slotId === "M2" || c.b.slotId === "M5"
  );

  console.log(
    `  seed=${String(seed).padEnd(10)} totalCollisions=${logicalMap.collisionCount}` +
      `  collisionsBySlot=${JSON.stringify(logicalMap.collisionsBySlot)}` +
      `  m2OrM5Collisions=${m2m5Collisions.length}`
  );
  for (const c of m2m5Collisions) {
    console.log(
      `      collide @ (${c.pos.q},${c.pos.r}): ` +
        `a=${c.a.slotId}/${c.a.sectorId}/local=${c.a.localKey}  vs  b=${c.b.slotId}/${c.b.sectorId}/local=${c.b.localKey}`
    );
  }
}

// ---------------------------------------------------------------------------
// Part 3: proximity check — minimum distance from M2/M5 cells to any other
// sector's cells, using the CURRENT (buggy) slotCenters vs. what it would be
// with the CORRECT slotCenters, for one representative seed. This shows the
// "abnormal near/far" placement even in seeds where no exact-key collision
// happens to occur.
// ---------------------------------------------------------------------------

function axialDistance(a: Axial, b: Axial): number {
  const x1 = a.q, z1 = a.r, y1 = -x1 - z1;
  const x2 = b.q, z2 = b.r, y2 = -x2 - z2;
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
}

console.log("\n=== 4p M2/M5 min-distance-to-other-sector-cells (current slotCenters), seed=snap-0001 ===");
{
  const seed = "snap-0001";
  const { placement } = makeSearchPlacementFromSeed({ templateId: "4p_lostFleet", seed });
  const logicalMap = buildLogicalMapFromPlacement({ templateId: "4p_lostFleet", placement, seed });

  const cells = Array.from(logicalMap.cellsByKey.values());
  for (const target of ["M2", "M5"]) {
    const mine = cells.filter((c) => c.slotId === target);
    const others = cells.filter((c) => c.slotId !== target);
    let minDist = Infinity;
    let nearest: (typeof others)[number] | null = null;
    for (const m of mine) {
      for (const o of others) {
        const d = axialDistance(m.pos, o.pos);
        if (d < minDist) {
          minDist = d;
          nearest = o;
        }
      }
    }
    console.log(
      `  ${target}: cells=${mine.length} minDistToOtherSector=${minDist}` +
        (nearest ? ` (nearest: slot=${nearest.slotId} sector=${nearest.sectorId})` : "")
    );
  }
}
