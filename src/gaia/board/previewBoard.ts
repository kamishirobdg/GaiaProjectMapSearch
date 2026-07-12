// src/gaia/board/previewBoard.ts
//
// Preview expansion: (slotId, sectorId, rot) placements -> absolute board cells.
// Used by UI/Debug rendering, so keep it deterministic.
//
// Coordinate policy (CONFIRMED for TEMPLATE_3P_LOSTFLEET):
// - template.slots[].pos is written in an "offset-like" board coordinate (col,row).
// - We convert slot.pos -> axial by odd-r offset conversion:
//     axialQ = col - floor(row/2), axialR = row
// - Sector local cell keys are treated as axial as-authored (NO extra shift).
//   (Both base and lostfleet sector definitions in current repo form valid radius=2 axial layouts.)

export type { Axial } from "./axial";
import type { Axial } from "./axial";
import { axialAdd } from "./axial";

export type SlotAccept = "LARGE" | "MIDDLE" | "SMALL";
export type Slot = { slotId: string; pos: Axial; accepts: SlotAccept[] };

type AnySector = any;

export type PlacementItem = {
  slotId: string;
  sectorId: string;
  rot: number; // 0..5 (60deg steps)
};

export type BoardCell = {
  pos: Axial; // board absolute (axial)
  kind: "planet" | "space" | "special";
  planetType?: string;
  tags: string[];
  slotId: string;
  sectorId: string;
  localKey?: string; // raw key from sector.cells (or derived)
};

// re-export for external callers that previously imported axialAdd from this module
export { axialAdd };

export function buildSectorLookup(sectors: AnySector[]): Map<string, AnySector> {
  const m = new Map<string, AnySector>();
  for (const s of sectors) {
    const id = (s?.sectorId ?? s?.id) as string | undefined;
    if (!id) continue;
    m.set(id, { ...s, sectorId: id });
  }
  return m;
}

