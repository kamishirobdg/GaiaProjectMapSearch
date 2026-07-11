// src/gaia/board/axial.ts
export type Axial = { q: number; r: number };

export const AXIAL_DIRS: ReadonlyArray<Axial> = Object.freeze([
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]);

/**
 * "q,r" key string.
 *
 * Historically this module took two number args while the local
 * reimplementations in board/previewBoard.ts and logicalMap/buildLogicalMap.ts
 * took a single Axial point. Both produced the identical "q,r" string, so a
 * single overloaded function covers both call conventions without changing
 * behavior at either call site.
 */
export function keyOf(q: number, r: number): string;
export function keyOf(p: Axial): string;
export function keyOf(qOrP: number | Axial, r?: number): string {
  if (typeof qOrP === "number") return `${qOrP},${r}`;
  return `${qOrP.q},${qOrP.r}`;
}

/** Parse a "q,r" key string back into an Axial point. */
export function parseKey(key: string): Axial {
  const [q, r] = key.split(",").map((v) => Number(v));
  return { q, r };
}

export function add(a: Axial, b: Axial): Axial {
  return { q: a.q + b.q, r: a.r + b.r };
}

/** Alias of add() — matches the historical call sites in previewBoard.ts / buildLogicalMap.ts */
export function axialAdd(a: Axial, b: Axial): Axial {
  return add(a, b);
}

/**
 * Axial distance (hex grid). Uses cube conversion: (x=q, z=r, y=-x-z)
 */
export function axialDistance(a: Axial, b: Axial): number {
  const x1 = a.q;
  const z1 = a.r;
  const y1 = -x1 - z1;

  const x2 = b.q;
  const z2 = b.r;
  const y2 = -x2 - z2;

  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
}

/** Rotate axial(q,r) by 60° steps (CW) using cube rotation. */
export function rotate60(ax: Axial, stepsCW: number): Axial {
  let q = ax.q;
  let r = ax.r;
  const s = ((stepsCW % 6) + 6) % 6;

  for (let i = 0; i < s; i++) {
    const x = q;
    const z = r;
    const y = -x - z;

    // cube CW: (x,y,z) -> (-z, -x, -y)
    const nx = -z;
    const ny = -x;
    const nz = -y;

    q = nx;
    r = nz;
  }
  return { q, r };
}
