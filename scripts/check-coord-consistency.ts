// scripts/check-coord-consistency.ts
//
// Permanent consistency check between the display-side TemplateDef.pos
// (src/gaia/data/templates/*.ts) and the eval-side slotCenters SSOT
// (src/gaia/templates/*_slotCenters.ts).
//
// Background: these two coordinate systems must stay in the fixed relation
//   display.pos[X] == axialRotateCCW(slotCenters[X], 3) + C_group
// (axialRotateCCW(.,3) is a 180-degree rotation, i.e. plain negation
// (q,r) -> (-q,-r); it's applied here via board/axial.ts's rotate60, which
// uses the identical cube-rotation formula and is likewise self-inverse at
// 3 steps). C_group is a fixed constant per slot-id group.
//
// This relation silently broke once already (4p_lostFleet's M2/M5 were
// copy-pasted from the 3p file — see scripts/_probe_4p_m2m5.ts and the
// commit that fixed it), causing cell collisions in the evaluated board
// that the display never showed. This script re-derives C_group from the
// current (assumed-correct) data on every run and fails loudly if any slot
// deviates from its group's constant, so that kind of copy-paste drift is
// caught automatically instead of requiring a manual coordinate probe.
//
// Usage:
//   npx tsx scripts/check-coord-consistency.ts
// Exit code: 0 if every template/slot is consistent, 1 otherwise (with the
// offending slots printed to stderr).

import { TEMPLATE_3P_LOSTFLEET } from "../src/gaia/data/templates/3p_lostFleet";
import { TEMPLATE_4P_LOSTFLEET } from "../src/gaia/data/templates/4p_lostFleet";
import * as SlotCenters3p from "../src/gaia/templates/3p_lostfleet_slotCenters";
import * as SlotCenters4p from "../src/gaia/templates/4p_lostfleet_slotCenters";
import { rotate60 } from "../src/gaia/board/axial";

type Axial = { q: number; r: number };
type SlotCentersRec = Record<string, Axial>;
type TemplateLike = { templateId: string; slots: Array<{ slotId: string; pos: Axial }> };

// Slot-id group -> C constant. Determined empirically (see module comment)
// and re-verified against the majority of slots on every run below, so a
// single copy-paste mistake on one or two slots cannot silently redefine
// the "expected" constant.
type Group = "LARGE" | "MIDDLE_LOW" | "MIDDLE_HIGH" | "SMALL";

function groupOf(slotId: string): Group {
  const prefix = slotId[0];
  if (prefix === "L") return "LARGE";
  if (prefix === "S") return "SMALL";
  if (prefix === "M") {
    const n = Number(slotId.slice(1));
    return n <= 4 ? "MIDDLE_LOW" : "MIDDLE_HIGH";
  }
  throw new Error(`groupOf: unrecognized slotId prefix: ${slotId}`);
}

// Current, real-world values (see module comment). If a future template
// legitimately needs a different constant, update here deliberately --
// this is the "known good" reference, not something to be inferred blindly
// from majority vote at runtime.
const C_BY_GROUP: Record<Group, Axial> = {
  LARGE: { q: 19, r: 14 },
  MIDDLE_LOW: { q: 17, r: 14 },
  MIDDLE_HIGH: { q: 18, r: 14 },
  SMALL: { q: 18, r: 14 },
};

type Mismatch = {
  templateId: string;
  slotId: string;
  displayPos: Axial;
  expected: Axial;
  actual: Axial;
};

function checkTemplate(
  slotCenters: SlotCentersRec,
  template: TemplateLike
): Mismatch[] {
  const mismatches: Mismatch[] = [];
  for (const s of template.slots) {
    const evalPos = slotCenters[s.slotId];
    if (!evalPos) {
      mismatches.push({
        templateId: template.templateId,
        slotId: s.slotId,
        displayPos: s.pos,
        expected: { q: NaN, r: NaN },
        actual: { q: NaN, r: NaN },
      });
      continue;
    }
    const c = C_BY_GROUP[groupOf(s.slotId)];
    const rotated = rotate60(evalPos, 3); // == (-q,-r); self-inverse
    const predictedDisplay = { q: rotated.q + c.q, r: rotated.r + c.r };
    if (predictedDisplay.q !== s.pos.q || predictedDisplay.r !== s.pos.r) {
      mismatches.push({
        templateId: template.templateId,
        slotId: s.slotId,
        displayPos: s.pos,
        expected: predictedDisplay,
        actual: s.pos,
      });
    }
  }
  return mismatches;
}

export function checkAllCoordConsistency(): Mismatch[] {
  const all: Mismatch[] = [];
  all.push(
    ...checkTemplate(
      (SlotCenters3p as any).SLOT_CENTERS_3P_LOSTFLEET,
      TEMPLATE_3P_LOSTFLEET as any as TemplateLike
    )
  );
  all.push(
    ...checkTemplate(
      (SlotCenters4p as any).SLOT_CENTERS_4P_LOSTFLEET,
      TEMPLATE_4P_LOSTFLEET as any as TemplateLike
    )
  );
  return all;
}

/**
 * Runs the check and exits the process on failure. Called unconditionally at
 * module load below, so this file works both as a standalone CLI
 * (`npx tsx scripts/check-coord-consistency.ts`) and as a guard imported for
 * its side effect from another script (e.g. scripts/regression-snapshot.ts
 * imports this module before generating a snapshot).
 */
export function runCheckOrExit(): void {
  const mismatches = checkAllCoordConsistency();
  if (mismatches.length === 0) {
    // eslint-disable-next-line no-console
    console.log(
      "[check-coord-consistency] OK: all slots satisfy display.pos == axialRotateCCW(slotCenters,3) + C_group"
    );
    return;
  }

  // eslint-disable-next-line no-console
  console.error(
    `[check-coord-consistency] FAIL: ${mismatches.length} slot(s) violate the display<->eval coordinate relation:`
  );
  for (const m of mismatches) {
    // eslint-disable-next-line no-console
    console.error(
      `  templateId=${m.templateId} slotId=${m.slotId}  display.pos=(${m.displayPos.q},${m.displayPos.r})  ` +
        `expected-from-slotCenters=(${m.expected.q},${m.expected.r})`
    );
  }
  process.exit(1);
}

runCheckOrExit();
