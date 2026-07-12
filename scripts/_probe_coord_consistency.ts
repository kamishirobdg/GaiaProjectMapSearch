// scripts/_probe_coord_consistency.ts
//
// READ-ONLY numerical probe (no src/ changes).
//
// Question: does the "slot relabeling" between the eval-side slotCenters
// (src/gaia/templates/3p_lostfleet_slotCenters.ts / 4p_...) and the
// display-side TemplateDef.pos (src/gaia/data/templates/3p_lostFleet.ts /
// 4p_lostFleet.ts) actually change which physical board is represented, or
// is it fully explained by the global axialRotateCCW(pos, viewRot=4) that
// MapBoardViewer.tsx already applies to every slot position at render time?
//
// Method:
//  1. For a given seed+templateId, get the ground-truth evaluated board via
//     buildLogicalMapFromPlacement() (src/gaia/logicalMap/buildLogicalMap.ts).
//     This gives, per placement item, a set of LogicalCell { slotId,
//     sectorId, localKey, pos(absolute axial), planetType, ... }.
//  2. Independently reconstruct what MapBoardViewer.tsx would compute for
//     every one of those same cells, using ONLY the formulas that actually
//     appear in that file (copied verbatim below, not re-derived): the slot
//     anchor via axialRotateCCW(slot.pos, viewRot) -> axialToPixelPointy,
//     and the per-cell offset via fixBaseLocalCoord -> axialToPixelPointy ->
//     rotatePoint(tileDeg). This is the same math MapBoardViewer.tsx uses in
//     calcTilePixelBox(), just evaluated per-cell instead of only for the
//     bounding box.
//  3. Convert the eval-side absolute axial cell position to pixel space with
//     the same axialToPixelPointy, and test whether
//         displayPixel == rotatePoint(evalPixel, ANGLE) + TRANSLATION
//     for a single (ANGLE, TRANSLATION) fit per (templateId, seed) board.
//     ANGLE's sign/step correspondence is determined empirically in step 0
//     (not assumed) by comparing axialRotateCCW/rotate60 against
//     rotatePoint/axialToPixelPointy on a known asymmetric test point.
//
// Output: per (templateId, seed) match statistics, broken out by accepts
// class (LARGE / MIDDLE / SMALL), plus the full slotCenters vs
// TemplateDef.pos correspondence table.

import { buildLogicalMapFromPlacement, type LogicalMap } from "../src/gaia/logicalMap/buildLogicalMap";
import { makeSearchPlacementFromSeed } from "../src/gaia/ssot/searchPlacementConfig";
import { BASE_SECTORS } from "../src/gaia/sectorTiles_base";
import { EXPANSION_MIDDLE, EXPANSION_LITTLE, EXPANSION_SCOUT } from "../src/gaia/sectorTiles_lostfleet";
import { TEMPLATE_3P_LOSTFLEET } from "../src/gaia/data/templates/3p_lostFleet";
import { TEMPLATE_4P_LOSTFLEET } from "../src/gaia/data/templates/4p_lostFleet";
import * as SlotCenters3p from "../src/gaia/templates/3p_lostfleet_slotCenters";
import * as SlotCenters4p from "../src/gaia/templates/4p_lostfleet_slotCenters";
import { parseKey } from "../src/gaia/board/axial";

type Axial = { q: number; r: number };

// ---------------------------------------------------------------------------
// Verbatim copies of the private helpers from src/components/MapBoardViewer.tsx
// (not exported there, so duplicated here read-only for the probe).
// ---------------------------------------------------------------------------

function rotatePoint(x: number, y: number, deg: number) {
  if (!x && !y) return { x: 0, y: 0 };
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function axialRotateCCW(pos: Axial, rot60: number): Axial {
  let x = pos.q;
  let z = pos.r;
  let y = -x - z;

  const r = ((rot60 % 6) + 6) % 6;
  for (let i = 0; i < r; i++) {
    const nx = -z;
    const ny = -x;
    const nz = -y;
    x = nx;
    y = ny;
    z = nz;
  }
  return { q: x, r: z };
}

function axialToPixelPointy(pos: Axial, size: number) {
  const x = size * Math.sqrt(3) * (pos.q + pos.r / 2);
  const y = size * (3 / 2) * pos.r;
  return { x, y };
}

function fixBaseLocalCoord(sector: any, local: Axial): Axial {
  const R = typeof sector?.radius === "number" ? sector.radius : null;
  if (R === null) return local;
  const shift = Math.floor((local.r + R) / 2);
  return { q: local.q - shift, r: local.r };
}

// ---------------------------------------------------------------------------
// Sector lookup (mirrors buildSectorById() in buildLogicalMap.ts)
// ---------------------------------------------------------------------------

function buildSectorById(): Map<string, { def: any; isLostFleet: boolean }> {
  const m = new Map<string, { def: any; isLostFleet: boolean }>();
  for (const s of BASE_SECTORS as any[]) m.set(String(s.id), { def: s, isLostFleet: false });
  for (const s of EXPANSION_MIDDLE as any[]) m.set(String(s.id), { def: s, isLostFleet: true });
  for (const s of EXPANSION_LITTLE as any[]) m.set(String(s.id), { def: s, isLostFleet: true });
  for (const s of EXPANSION_SCOUT as any[]) m.set(String(s.id), { def: s, isLostFleet: true });
  return m;
}
const sectorById = buildSectorById();

// ---------------------------------------------------------------------------
// Step 0: empirically determine the rotatePoint(deg) <-> axialRotateCCW(steps)
// correspondence (sign/direction), using a test point with no symmetry.
// ---------------------------------------------------------------------------

function deriveAngleForSteps(size: number): { degPerStepCCW: number; note: string } {
  const probe: Axial = { q: 2, r: 1 }; // asymmetric point
  const p0 = axialToPixelPointy(probe, size);

  let foundDeg: number | null = null;
  for (let steps = 1; steps <= 5; steps++) {
    const rotated = axialRotateCCW(probe, steps);
    const target = axialToPixelPointy(rotated, size);

    // search which multiple of 60 (positive or negative) reproduces "target"
    // when applied via rotatePoint to p0
    for (let k = -5; k <= 5; k++) {
      const deg = k * 60;
      const cand = rotatePoint(p0.x, p0.y, deg);
      if (Math.abs(cand.x - target.x) < 1e-6 && Math.abs(cand.y - target.y) < 1e-6) {
        if (steps === 1) foundDeg = deg;
      }
    }
  }
  if (foundDeg === null) {
    throw new Error("Could not determine rotatePoint<->axialRotateCCW correspondence");
  }
  return {
    degPerStepCCW: foundDeg,
    note: `axialRotateCCW(pos,1) corresponds to rotatePoint(pixel, ${foundDeg} deg)`,
  };
}

const HEX_SIZE = 40;
const CORRESPONDENCE = deriveAngleForSteps(HEX_SIZE);
console.log("[step0] " + CORRESPONDENCE.note);

// ---------------------------------------------------------------------------
// Step A: slotCenters vs TemplateDef.pos correspondence table
// ---------------------------------------------------------------------------

type SlotCentersRec = Record<string, { q: number; r: number }>;

function printCorrespondenceTable(
  label: string,
  slotCenters: SlotCentersRec,
  template: { slots: Array<{ slotId: string; pos: Axial }> },
  viewRot: number
) {
  console.log(`\n=== ${label}: slotCenters vs axialRotateCCW(TemplateDef.pos, viewRot=${viewRot}) ===`);
  const posToLabel = new Map<string, string>();
  for (const [id, p] of Object.entries(slotCenters)) posToLabel.set(`${p.q},${p.r}`, id);

  const rows: string[] = [];
  let exactSelfMatches = 0;
  let total = 0;
  for (const s of template.slots) {
    total++;
    const rotated = axialRotateCCW(s.pos, viewRot);
    const key = `${rotated.q},${rotated.r}`;
    const matchLabel = posToLabel.get(key) ?? "(none)";
    const evalPos = slotCenters[s.slotId];
    const selfMatch = evalPos && evalPos.q === rotated.q && evalPos.r === rotated.r;
    if (selfMatch) exactSelfMatches++;
    rows.push(
      `${s.slotId.padEnd(4)} display.pos=(${s.pos.q},${s.pos.r})  ->rotCCW${viewRot}=(${rotated.q},${rotated.r})  ` +
        `eval.slotCenters[${s.slotId}]=(${evalPos ? evalPos.q : "?"},${evalPos ? evalPos.r : "?"})  ` +
        `${selfMatch ? "MATCH(self)" : `matches label=${matchLabel}`}`
    );
  }
  for (const r of rows) console.log("  " + r);
  console.log(`  => self-label exact matches: ${exactSelfMatches}/${total}`);
}

printCorrespondenceTable(
  "3p",
  (SlotCenters3p as any).SLOT_CENTERS_3P_LOSTFLEET,
  TEMPLATE_3P_LOSTFLEET as any,
  4
);
printCorrespondenceTable(
  "4p",
  (SlotCenters4p as any).SLOT_CENTERS_4P_LOSTFLEET,
  TEMPLATE_4P_LOSTFLEET as any,
  4
);

// ---------------------------------------------------------------------------
// Step A2: anchor-level (slot-center-only) rigid-transform fit across ALL
// labels. This is the part that IS fully code-verifiable for every accepts
// class (LARGE/MIDDLE/SMALL alike), since the slot anchor position is an
// explicit formula in MapBoardViewer.tsx regardless of how many hex cells a
// sector's artwork contains internally.
// ---------------------------------------------------------------------------
function bestFitAngleAndTranslationGeneric(
  evalPixels: Array<{ x: number; y: number }>,
  displayPixels: Array<{ x: number; y: number }>,
  candidateAngles: number[],
  tol = 1e-3
) {
  let best: { angle: number; tx: number; ty: number; matches: number; total: number } | null = null;
  for (const angle of candidateAngles) {
    if (evalPixels.length === 0) continue;
    const rotatedFirst = rotatePoint(evalPixels[0].x, evalPixels[0].y, angle);
    const tx = displayPixels[0].x - rotatedFirst.x;
    const ty = displayPixels[0].y - rotatedFirst.y;
    let matches = 0;
    for (let i = 0; i < evalPixels.length; i++) {
      const r = rotatePoint(evalPixels[i].x, evalPixels[i].y, angle);
      const dx = r.x + tx - displayPixels[i].x;
      const dy = r.y + ty - displayPixels[i].y;
      if (Math.abs(dx) < tol && Math.abs(dy) < tol) matches++;
    }
    if (!best || matches > best.matches) best = { angle, tx, ty, matches, total: evalPixels.length };
  }
  return best;
}

function runAnchorProbe(
  label: string,
  slotCenters: SlotCentersRec,
  template: { slots: Array<{ slotId: string; pos: Axial; accepts: string[] }> },
  viewRot: number
) {
  const evalPixels: Array<{ x: number; y: number }> = [];
  const dispPixels: Array<{ x: number; y: number }> = [];
  const labels: string[] = [];
  const classes: Accepts0[] = [];
  for (const s of template.slots) {
    const ev = slotCenters[s.slotId];
    if (!ev) continue;
    evalPixels.push(axialToPixelPointy(ev, HEX_SIZE));
    const rotated = axialRotateCCW(s.pos, viewRot);
    dispPixels.push(axialToPixelPointy(rotated, HEX_SIZE));
    labels.push(s.slotId);
    classes.push(accepts0Of(s.slotId));
  }
  const candidateAngles = [0, 60, 120, 180, 240, 300, -60, -120, -180, -240, -300];
  const fit = bestFitAngleAndTranslationGeneric(evalPixels, dispPixels, candidateAngles);
  console.log(`\n=== ${label} ANCHOR-ONLY rigid-fit (all ${evalPixels.length} slot labels) ===`);
  if (!fit) {
    console.log("  no fit found");
    return;
  }
  console.log(
    `  best: angle=${fit.angle}deg translation=(${fit.tx.toFixed(3)},${fit.ty.toFixed(3)}) matches=${fit.matches}/${fit.total} (${(
      (100 * fit.matches) /
      fit.total
    ).toFixed(1)}%)`
  );
  const byClass: Record<Accepts0, { m: number; t: number }> = {
    LARGE: { m: 0, t: 0 },
    MIDDLE: { m: 0, t: 0 },
    SMALL: { m: 0, t: 0 },
  };
  const mismatches: string[] = [];
  for (let i = 0; i < evalPixels.length; i++) {
    byClass[classes[i]].t++;
    const r = rotatePoint(evalPixels[i].x, evalPixels[i].y, fit.angle);
    const dx = r.x + fit.tx - dispPixels[i].x;
    const dy = r.y + fit.ty - dispPixels[i].y;
    const ok = Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3;
    if (ok) byClass[classes[i]].m++;
    else mismatches.push(`${labels[i]}(${classes[i]}) dx=${dx.toFixed(2)} dy=${dy.toFixed(2)}`);
  }
  for (const cls of ["LARGE", "MIDDLE", "SMALL"] as Accepts0[]) {
    const c = byClass[cls];
    console.log(`    ${cls}: ${c.m}/${c.t}`);
  }
  if (mismatches.length) console.log("    mismatches: " + mismatches.join(" | "));
}

runAnchorProbe("3p", (SlotCenters3p as any).SLOT_CENTERS_3P_LOSTFLEET, TEMPLATE_3P_LOSTFLEET as any, 4);
runAnchorProbe("4p", (SlotCenters4p as any).SLOT_CENTERS_4P_LOSTFLEET, TEMPLATE_4P_LOSTFLEET as any, 4);

// ---------------------------------------------------------------------------
// Step A3: exact integer-axial verification of the hypothesis
//   display.pos[X] == axialRotateCCW(slotCenters[X], 3) + CONST
// (180-degree axial rotation + a fixed per-class integer translation),
// with NO floating point / pixel space involved at all.
// ---------------------------------------------------------------------------
function exactAffineCheck(
  label: string,
  slotCenters: SlotCentersRec,
  template: { slots: Array<{ slotId: string; pos: Axial }> }
) {
  console.log(`\n=== ${label} EXACT integer check: display.pos == axialRotateCCW(slotCenters,3) + CONST ===`);
  const results: string[] = [];
  for (const s of template.slots) {
    const ev = slotCenters[s.slotId];
    if (!ev) continue;
    const rotated = axialRotateCCW(ev, 3);
    const constNeeded = { q: s.pos.q - rotated.q, r: s.pos.r - rotated.r };
    results.push(`${s.slotId.padEnd(4)} CONST=(${constNeeded.q},${constNeeded.r})`);
  }
  for (const r of results) console.log("  " + r);
}

exactAffineCheck("3p", (SlotCenters3p as any).SLOT_CENTERS_3P_LOSTFLEET, TEMPLATE_3P_LOSTFLEET as any);
exactAffineCheck("4p", (SlotCenters4p as any).SLOT_CENTERS_4P_LOSTFLEET, TEMPLATE_4P_LOSTFLEET as any);

// ---------------------------------------------------------------------------
// Step B: full per-cell rigid-transform probe
// ---------------------------------------------------------------------------

type Accepts0 = "LARGE" | "MIDDLE" | "SMALL";
function accepts0Of(slotId: string): Accepts0 {
  if (slotId[0] === "L") return "LARGE";
  if (slotId[0] === "M") return "MIDDLE";
  return "SMALL";
}

function computeDisplayPixelsForPlacement(
  templateId: string,
  logicalMap: LogicalMap,
  template: { slots: Array<{ slotId: string; pos: Axial; accepts: string[] }> },
  viewRot: number
): Map<string, { x: number; y: number; accepts0: Accepts0 }> {
  const slotById = new Map(template.slots.map((s) => [s.slotId, s]));
  const out = new Map<string, { x: number; y: number; accepts0: Accepts0 }>();

  for (const p of logicalMap.placement) {
    const slotId = String((p as any).slotId);
    const sectorId = String((p as any).sectorId);
    const rot = Number((p as any).rot ?? 0);
    const rot30 = Number((p as any).rot30 ?? 0);

    const slot = slotById.get(slotId);
    if (!slot) continue;
    const accepts0 = accepts0Of(slotId);

    const offsetDeg = accepts0 === "LARGE" ? -30 : 0;
    const extra30 = rot30 * 30;
    const tileDeg = -(rot * 60) + offsetDeg + extra30;

    const pr = axialRotateCCW(slot.pos, viewRot);
    const anchor = axialToPixelPointy(pr, HEX_SIZE);

    const sec = sectorById.get(sectorId);
    if (!sec) continue;
    const cellsObj = sec.def?.cells ?? {};
    for (const localKey of Object.keys(cellsObj)) {
      const local = parseKey(localKey);
      const fixed = fixBaseLocalCoord(sec.def, local);
      const pt0 = axialToPixelPointy(fixed, HEX_SIZE);
      const ptR = rotatePoint(pt0.x, pt0.y, tileDeg);
      const px = anchor.x + ptR.x;
      const py = anchor.y + ptR.y;
      out.set(`${slotId}__${localKey}`, { x: px, y: py, accepts0 });
    }
  }
  return out;
}

function bestFitAngleAndTranslation(
  evalPixels: Array<{ x: number; y: number }>,
  displayPixels: Array<{ x: number; y: number }>,
  candidateAngles: number[]
): { angle: number; tx: number; ty: number; matches: number; total: number } | null {
  let best: { angle: number; tx: number; ty: number; matches: number; total: number } | null = null;

  for (const angle of candidateAngles) {
    // fit translation using the first pair, then count matches at tolerance
    if (evalPixels.length === 0) continue;
    const rotatedFirst = rotatePoint(evalPixels[0].x, evalPixels[0].y, angle);
    const tx = displayPixels[0].x - rotatedFirst.x;
    const ty = displayPixels[0].y - rotatedFirst.y;

    let matches = 0;
    for (let i = 0; i < evalPixels.length; i++) {
      const r = rotatePoint(evalPixels[i].x, evalPixels[i].y, angle);
      const dx = r.x + tx - displayPixels[i].x;
      const dy = r.y + ty - displayPixels[i].y;
      if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) matches++;
    }

    if (!best || matches > best.matches) {
      best = { angle, tx, ty, matches, total: evalPixels.length };
    }
  }
  return best;
}

function runProbe(templateId: string, seed: number | string) {
  const { placement } = makeSearchPlacementFromSeed({ templateId, seed });
  const logicalMap = buildLogicalMapFromPlacement({ templateId, placement, seed });

  const template = templateId === "4p_lostFleet" ? TEMPLATE_4P_LOSTFLEET : TEMPLATE_3P_LOSTFLEET;
  const viewRot = 4;

  const displayPixels = computeDisplayPixelsForPlacement(templateId, logicalMap, template as any, viewRot);

  // Build eval-side pixel list, aligned by slotId__localKey with display list
  type Row = { key: string; slotId: string; accepts0: Accepts0; evalPixel: { x: number; y: number }; dispPixel: { x: number; y: number } };
  const rows: Row[] = [];
  for (const cell of logicalMap.cellsByKey.values()) {
    const k = `${cell.slotId}__${cell.localKey}`;
    const disp = displayPixels.get(k);
    if (!disp) continue; // shouldn't happen
    const evalPixel = axialToPixelPointy(cell.pos, HEX_SIZE);
    rows.push({ key: k, slotId: cell.slotId, accepts0: accepts0Of(cell.slotId), evalPixel, dispPixel: disp });
  }

  const candidateAngles = [0, 60, 120, 180, 240, 300, -60, -120, -180, -240, -300];
  const fit = bestFitAngleAndTranslation(
    rows.map((r) => r.evalPixel),
    rows.map((r) => r.dispPixel),
    candidateAngles
  );

  // per-class breakdown at the SAME globally-fit angle/translation
  const byClass: Record<Accepts0, { matches: number; total: number }> = {
    LARGE: { matches: 0, total: 0 },
    MIDDLE: { matches: 0, total: 0 },
    SMALL: { matches: 0, total: 0 },
  };
  if (fit) {
    for (const r of rows) {
      byClass[r.accepts0].total++;
      const rp = rotatePoint(r.evalPixel.x, r.evalPixel.y, fit.angle);
      const dx = rp.x + fit.tx - r.dispPixel.x;
      const dy = rp.y + fit.ty - r.dispPixel.y;
      if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) byClass[r.accepts0].matches++;
    }
  }

  console.log(
    `\n[probe] templateId=${templateId} seed=${seed} totalCells=${rows.length} collisions=${logicalMap.collisionCount}`
  );
  if (!fit) {
    console.log("  no fit found (empty board?)");
    return;
  }
  console.log(
    `  best single rigid transform: angle=${fit.angle}deg  translation=(${fit.tx.toFixed(3)},${fit.ty.toFixed(3)})  ` +
      `matches=${fit.matches}/${fit.total} (${((100 * fit.matches) / fit.total).toFixed(1)}%)`
  );
  for (const cls of ["LARGE", "MIDDLE", "SMALL"] as Accepts0[]) {
    const c = byClass[cls];
    console.log(`    ${cls}: ${c.matches}/${c.total} (${c.total ? ((100 * c.matches) / c.total).toFixed(1) : "0.0"}%)`);
  }

  // Also try per-class BEST fit independently (in case each class needs its own transform)
  for (const cls of ["LARGE", "MIDDLE", "SMALL"] as Accepts0[]) {
    const subset = rows.filter((r) => r.accepts0 === cls);
    if (subset.length === 0) continue;
    const clsFit = bestFitAngleAndTranslation(
      subset.map((r) => r.evalPixel),
      subset.map((r) => r.dispPixel),
      candidateAngles
    );
    if (clsFit) {
      console.log(
        `    [${cls} own-best-fit] angle=${clsFit.angle}deg translation=(${clsFit.tx.toFixed(3)},${clsFit.ty.toFixed(3)}) ` +
          `matches=${clsFit.matches}/${clsFit.total} (${((100 * clsFit.matches) / clsFit.total).toFixed(1)}%)`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const SEEDS: Array<number | string> = [11, 12345, "probe-seed-A", "probe-seed-B"];

for (const templateId of ["3p_lostFleet", "4p_lostFleet"]) {
  for (const seed of SEEDS) {
    runProbe(templateId, seed);
  }
}
