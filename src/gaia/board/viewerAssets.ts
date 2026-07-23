// src/gaia/board/viewerAssets.ts
//
// MapBoardViewer 用のアセット参照とキャリブレーション定数。
// /board の page.tsx から抽出（2026-07-24、一覧タブ /list と共用するため。
// 挙動不変・値は「確定済み」の手動調整値をそのまま移設）。

import { BASE_SECTORS } from "@/gaia/sectorTiles_base";
import { EXPANSION_MIDDLE, EXPANSION_LITTLE, EXPANSION_SCOUT } from "@/gaia/sectorTiles_lostfleet";
import { TEMPLATE_3P_LOSTFLEET } from "@/gaia/data/templates/3p_lostFleet";
import { TEMPLATE_4P_LOSTFLEET } from "@/gaia/data/templates/4p_lostFleet";
import { TEMPLATE_BASE_34P } from "@/gaia/data/templates/base_34p";
import type { TemplateDef } from "@/gaia/data/templates/types";

/** templateId -> 定義（検索キー・プロファイルの templateId と同じ語彙）。 */
export const TEMPLATE_BY_ID: Record<string, TemplateDef> = {
  "3p_lostFleet": TEMPLATE_3P_LOSTFLEET,
  "4p_lostFleet": TEMPLATE_4P_LOSTFLEET,
  base_34p: TEMPLATE_BASE_34P,
};

export function normalizeSectorId(id: string) {
  const s = String(id ?? "").trim();
  const t = s.replace(/^0+/, "");
  return t === "" ? "0" : t;
}

export function getSectorIdFromAny(obj: any): string | null {
  if (!obj || typeof obj !== "object") return null;

  const cands = [
    (obj as any).sectorId,
    (obj as any).id,
    (obj as any).tileId,
    (obj as any).sector_id,
    (obj as any).tile_id,
    (obj as any).code,
    (obj as any).name,
  ];

  for (const v of cands) {
    const s = String(v ?? "").trim();
    if (s && s !== "undefined" && s !== "null") return s;
  }
  return null;
}

/** 全セクタータイル定義（基本＋LF中/小/探査船）。 */
export function getAllSectors(): any[] {
  const base = Array.isArray(BASE_SECTORS) ? (BASE_SECTORS as any[]) : [];
  const mid = Array.isArray(EXPANSION_MIDDLE) ? (EXPANSION_MIDDLE as any[]) : [];
  const lit = Array.isArray(EXPANSION_LITTLE) ? (EXPANSION_LITTLE as any[]) : [];
  const sc = Array.isArray(EXPANSION_SCOUT) ? (EXPANSION_SCOUT as any[]) : [];
  return [...base, ...mid, ...lit, ...sc];
}

export function buildSectorImgById(): Record<string, string> {
  const map: Record<string, string> = {};

  const put = (arr: any[]) => {
    for (const s of arr) {
      const id = getSectorIdFromAny(s);
      if (!id) continue;
      const img = String((s as any).img ?? (s as any).image ?? (s as any).src ?? "");
      if (img) map[id] = img;
    }
  };
  put(getAllSectors());

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) out[normalizeSectorId(k)] = v;
  return out;
}

// UI: offsets (確定済み)
export const IMG_OFFSET_BY_SLOT = {
  M1: { dx: 14, dy: -118 },
  M2: { dx: 14, dy: -118 },
  M3: { dx: 14, dy: -118 },
  M4: { dx: 14, dy: -118 },
  M5: { dx: 44, dy: -74 },
  M6: { dx: 44, dy: -74 },
  M7: { dx: 44, dy: -74 },
  M8: { dx: 46, dy: -72 },
  S1: { dx: 18, dy: -60 },
  S2: { dx: 18, dy: -60 },
  S3: { dx: 18, dy: -60 },
  S4: { dx: 18, dy: -60 },
  S5: { dx: 18, dy: -60 },
  S6: { dx: 18, dy: -60 },
  S7: { dx: 18, dy: -60 },
  S8: { dx: 18, dy: -60 },
  S9: { dx: 18, dy: -60 },
  S10: { dx: 18, dy: -60 },
} as const;

export const ROT_OFFSETS_BY_SLOT = {
  M1: { 0: { dx: 0, dy: 0 }, 2: { dx: 74, dy: 176 }, 4: { dx: -114, dy: 150 } },
  M2: { 0: { dx: 0, dy: 0 }, 2: { dx: 74, dy: 176 }, 4: { dx: -114, dy: 150 } },
  M3: { 0: { dx: 0, dy: 0 }, 2: { dx: 74, dy: 176 }, 4: { dx: -114, dy: 150 } },
  M4: { 0: { dx: 0, dy: 0 }, 2: { dx: 74, dy: 176 }, 4: { dx: -114, dy: 150 } },
  M5: { 1: { dx: 0, dy: 0 }, 3: { dx: -26, dy: 70 }, 5: { dx: 48, dy: 58 } },
  M6: { 1: { dx: 0, dy: 0 }, 3: { dx: -26, dy: 70 }, 5: { dx: 48, dy: 58 } },
  M7: { 1: { dx: 0, dy: 0 }, 3: { dx: -26, dy: 70 }, 5: { dx: 48, dy: 58 } },
  M8: { 1: { dx: 0, dy: 0 }, 3: { dx: -26, dy: 70 }, 5: { dx: 48, dy: 58 } },
} as const;
