// scripts/dump_sector_cells.ts
//
// 全セクター（基本＋Lost Fleet）のセルを JSON で吐く。
// scripts/measure_sector_artwork.py の入力で、アートワーク較正値
// （src/gaia/viewer/artworkCalib.ts）を測り直すときに使う。
//
//   npx tsx scripts/dump_sector_cells.ts > /tmp/sectors.json
//   python scripts/measure_sector_artwork.py /tmp/sectors.json

import { existsSync } from "node:fs";
import path from "node:path";
import { BASE_SECTORS } from "../src/gaia/sectorTiles_base";
import {
  EXPANSION_LITTLE,
  EXPANSION_MIDDLE,
  EXPANSION_SCOUT,
} from "../src/gaia/sectorTiles_lostfleet";

const ALL = [
  ...BASE_SECTORS,
  ...EXPANSION_MIDDLE,
  ...EXPANSION_LITTLE,
  ...EXPANSION_SCOUT,
] as any[];

const out: Array<{
  id: string;
  path: string;
  cells: Array<[number, number, string]>;
}> = [];

for (const s of ALL) {
  const id = String(s.id);
  if (out.some((o) => o.id === id)) continue;
  const p = path.resolve(process.cwd(), "public", "sectors", `${id}.png`);
  if (!existsSync(p)) continue;
  const cells: Array<[number, number, string]> = [];
  for (const [key, cell] of Object.entries(s.cells as Record<string, any>)) {
    const [q, r] = key.split(",").map(Number);
    // 惑星は種別、それ以外は kind（EMPTY / SCOUT）を大文字で入れる
    cells.push([q, r, cell.kind === "planet" ? String(cell.planet) : String(cell.kind).toUpperCase()]);
  }
  out.push({ id, path: p.replace(/\\/g, "/"), cells });
}

console.log(JSON.stringify(out));
