// src/gaia/ssot/searchPlacementConfig.ts
//
// Search placement SSOT (移行用):
// - 検索（Ranking）の seed -> placement を生成するための唯一の設定点
// - 4p / 基本版など拡張時は、このファイルに templateId ごとの設定を追加する
//
// IMPORTANT:
// - UI(Board) の見た目のための値ではなく「検索で評価した placement を再現する」ためのSSOT
// - Board 側で seed から再生成することは禁止（RankedResult.placement をそのまま描画する）
//

import type { SlotDef, SlotPlacement } from "../board/types";
import { placementFromSeed } from "../board/placementFromSeed";
import {
  basePlacementFromSeed,
  type BasePlacementMethod,
} from "../board/basePlacementFromSeed";
import {
  BASE_34P_INNER_SLOTS,
  BASE_34P_OUTER_SLOTS,
} from "../templates/base_34p_slotCenters";

import { EXPANSION_MIDDLE_IDS, EXPANSION_SCOUT_IDS, EXPANSION_LITTLE_IDS } from "../sectorTiles_lostfleet";

export type SearchPlacementConfig = {
  templateId: string;

  /** slot order is SSOT. ordering mismatch => same seed produces different placement */
  slotOrder: string[];

  /** fixed Large set for this template (SSOT) */
  fixedLargeIds: string[];

  /** middle/scout ids are usually whole expansion sets */
  middleIds: string[];
  scoutIds: string[];

  /** little ids pool used for placementFromSeed (SSOT). can be whole set or restricted pool */
  littleIds: string[];

  /** fixed counts constraints for little tiles (SSOT) */
  littleFixedCounts: Record<string, number>;

  /** fixed scout count (SSOT) */
  scoutCount: number;
};

function buildSlotsFromOrder(order: string[]): SlotDef[] {
  return order.map((slotId) => {
    const prefix = slotId[0];
    const accepts =
      prefix === "L" ? (["LARGE"] as const) : prefix === "M" ? (["MIDDLE"] as const) : (["SMALL"] as const);

    // placementFromSeed uses slotId/accepts; pos is irrelevant here
    return { slotId, accepts: [...accepts], pos: { q: 0, r: 0 } } as any;
  });
}

/**
 * ===== SSOT: 3p_lostFleet（検索用固定値）=====
 *
 * 4p_lostFleet / base などを作成する場合：
 * - slotOrder（スロット数・順序）
 * - fixedLargeIds（固定Largeセット）
 * - littleIds / littleFixedCounts / scoutCount
 * を templateId ごとに追加すること。
 */
const CONFIG_3P_LOSTFLEET: SearchPlacementConfig = {
  templateId: "3p_lostFleet",

  slotOrder: [
    "L1","L2","L3","L4","L5","L6","L7","L8","L9",
    "M1","M2","M3","M4","M5","M6","M7","M8",
    "S1","S2","S3","S4","S5","S6","S7","S8",
  ],

  // Board page.tsx の FIXED_LARGE_3P と一致させること（同一 seed => 同一 placement を保証）
  fixedLargeIds: ["01", "02", "03", "04", "05b", "06b", "07b", "09", "10"],

  // Middle/Scout は expansion ids 全量（順序は配列化で固定化）
  middleIds: [...EXPANSION_MIDDLE_IDS],
  scoutIds: [...EXPANSION_SCOUT_IDS],

  // Little は 3p の運用でプールを絞る（必要なら将来ここを変更）
  littleIds: ["19", "20", "21", "22"],

  // Board のデフォルトと一致（必要なら将来ここを変更）
  littleFixedCounts: { "19": 2, "20": 1, "21": 1 },

  // Board のデフォルトと一致（必要なら将来ここを変更）
  scoutCount: 4,
};

const CONFIG_4P_LOSTFLEET: SearchPlacementConfig = {
  templateId: "4p_lostFleet",

  slotOrder: [
    "L1","L2","L3","L4","L5","L6","L7","L8","L9","L10",
    "M1","M2","M3","M4","M5","M6","M7","M8",
    "S1","S2","S3","S4","S5","S6","S7","S8","S9","S10",
  ],

  // 4人用標準セット
  fixedLargeIds: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"],

  middleIds: [...EXPANSION_MIDDLE_IDS],
  scoutIds: [...EXPANSION_SCOUT_IDS],
  littleIds: ["19", "20", "21", "22", "23", "24"],
  littleFixedCounts: { "19": 4, "20": 1, "21": 1 },
  scoutCount: 4, 
};

// getSearchPlacementConfig に条件分岐を追加
export function getSearchPlacementConfig(templateId: string): SearchPlacementConfig {
  if (templateId === "3p_lostFleet") return CONFIG_3P_LOSTFLEET;
  if (templateId === "4p_lostFleet") return CONFIG_4P_LOSTFLEET; // 追加

  throw new Error(`getSearchPlacementConfig: unsupported templateId="${templateId}"`);
}

/**
 * seed -> placement (SSOT)
 * - 検索は必ずこの関数で placement を生成し、その placement を評価・返却する
 * - base_34p は placementMethod（1/2/3、省略時=1）で分岐する専用ストリーム
 *   （LF側のRNG消費順は不変＝既存キー・goldenに影響しない）
 */
export function makeSearchPlacementFromSeed(args: {
  templateId: string;
  seed: number | string;
  /** base_34p のみ有効（p19の方法1/2/3）。LFテンプレでは無視される */
  placementMethod?: BasePlacementMethod;
}): { slots: SlotDef[]; placement: SlotPlacement[]; config: SearchPlacementConfig } {
  const { templateId, seed } = args;

  if (templateId === "base_34p") {
    const placement = basePlacementFromSeed({
      seed,
      placementMethod: args.placementMethod ?? 1,
    });
    const slots = buildSlotsFromOrder([
      ...BASE_34P_INNER_SLOTS,
      ...BASE_34P_OUTER_SLOTS,
    ]);
    // LF用フィールドは空のダミー（base では placement 生成に使わない）
    const config: SearchPlacementConfig = {
      templateId: "base_34p",
      slotOrder: [...BASE_34P_INNER_SLOTS, ...BASE_34P_OUTER_SLOTS],
      fixedLargeIds: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"],
      middleIds: [],
      scoutIds: [],
      littleIds: [],
      littleFixedCounts: {},
      scoutCount: 0,
    };
    return { slots, placement, config };
  }

  const config = getSearchPlacementConfig(templateId);

  // littleIds 健全性チェック（壊れていたら即 fail）
  const littleSet = new Set<string>(EXPANSION_LITTLE_IDS as readonly string[]);
  const missingLittle = config.littleIds.filter((x) => !littleSet.has(x));
  if (missingLittle.length) {
    throw new Error(`SearchPlacementConfig.littleIds not found in EXPANSION_LITTLE_IDS: ${missingLittle.join(", ")}`);
  }

  const slots = buildSlotsFromOrder(config.slotOrder);

  const placement = placementFromSeed({
    slots,
    largeIds: [...config.fixedLargeIds],
    middleIds: [...config.middleIds],
    scoutIds: [...config.scoutIds],
    littleIds: [...config.littleIds],
    seed,
    scoutCount: config.scoutCount,
    littleFixedCounts: { ...config.littleFixedCounts },
  });

  return { slots, placement, config };
}
