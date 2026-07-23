// src/gaia/board/basePlacementFromSeed.ts
//
// 基本版（base_34p）の seed -> placement 生成（docs/map-base-spec.md §2.2）。
// ルールブック p19「可変的なゲームボード / 3・4人プレイ」の3方法:
// - 方法1: 01〜04 は最初のゲームの位置（L1..L4）に固定、05〜10 を外側6スロットへランダム配置
// - 方法2: 方法1に加えて 01〜04 も内側4スロット内で入替
// - 方法3: 全10タイルを全10スロットでランダム入替
// 回転: 全方法で各タイル 0..5 を独立抽選（p19「気に入るまで自由に回転」= 探索変数）。
//
// RNGストリーム（SSOT・キー再現性の根拠）:
//   mulberry32(seed) から (1)配置シャッフル（方法2はinner→outerの順に2回） (2)回転を
//   スロット順 L1..L10 で消費。placementMethod が異なれば別ストリーム＝別検索空間
//   （placementMethod は検索キーに必ず含める）。

import { mulberry32, hashSeed, shuffleSeeded } from "./rng";
import type { SlotPlacement } from "./types";
import {
  BASE_34P_INNER_SLOTS,
  BASE_34P_OUTER_SLOTS,
} from "../templates/base_34p_slotCenters";

export type BasePlacementMethod = 1 | 2 | 3;

/** 基本版で使う宙域タイル（3・4人: 05/06/07 は実線面） */
export const BASE_34P_INNER_SECTORS = ["01", "02", "03", "04"] as const;
export const BASE_34P_OUTER_SECTORS = ["05", "06", "07", "08", "09", "10"] as const;

const SLOT_ORDER_BASE_34P: readonly string[] = [
  ...BASE_34P_INNER_SLOTS,
  ...BASE_34P_OUTER_SLOTS,
];

export function basePlacementFromSeed(args: {
  seed: string | number;
  placementMethod: BasePlacementMethod;
}): SlotPlacement[] {
  const { seed, placementMethod } = args;

  const seedNum = typeof seed === "number" ? seed >>> 0 : hashSeed(String(seed));
  const rng = mulberry32(seedNum);

  // 1) 配置（スロット順に対応するセクタ列を構築）
  let innerSectors: string[];
  let outerSectors: string[];

  if (placementMethod === 1) {
    innerSectors = [...BASE_34P_INNER_SECTORS];
    outerSectors = shuffleSeeded(BASE_34P_OUTER_SECTORS, rng);
  } else if (placementMethod === 2) {
    innerSectors = shuffleSeeded(BASE_34P_INNER_SECTORS, rng);
    outerSectors = shuffleSeeded(BASE_34P_OUTER_SECTORS, rng);
  } else if (placementMethod === 3) {
    const all = shuffleSeeded(
      [...BASE_34P_INNER_SECTORS, ...BASE_34P_OUTER_SECTORS],
      rng
    );
    innerSectors = all.slice(0, 4);
    outerSectors = all.slice(4);
  } else {
    throw new Error(`basePlacementFromSeed: invalid placementMethod=${placementMethod}`);
  }

  const sectorBySlot = new Map<string, string>();
  BASE_34P_INNER_SLOTS.forEach((slotId, i) => sectorBySlot.set(slotId, innerSectors[i]));
  BASE_34P_OUTER_SLOTS.forEach((slotId, i) => sectorBySlot.set(slotId, outerSectors[i]));

  // 2) 回転（スロット順 L1..L10 に固定して消費）
  return SLOT_ORDER_BASE_34P.map((slotId) => ({
    slotId,
    sectorId: sectorBySlot.get(slotId)!,
    rot: Math.floor(rng() * 6) % 6,
    rot30: 0,
  }));
}
