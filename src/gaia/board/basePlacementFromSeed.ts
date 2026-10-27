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
import { BASE_VARIANTS, type BaseTemplateId } from "../templates/baseVariants";

export type BasePlacementMethod = 1 | 2 | 3;

/** 基本版で使う宙域タイル（3・4人: 05/06/07 は実線面）。縮小盤の外側は baseVariants.ts */
export const BASE_34P_INNER_SECTORS = BASE_VARIANTS.base_34p.innerSectors;
export const BASE_34P_OUTER_SECTORS = BASE_VARIANTS.base_34p.outerSectors;

export function basePlacementFromSeed(args: {
  seed: string | number;
  placementMethod: BasePlacementMethod;
  /** 省略時 base_34p（10 枚）。縮小盤（2026-10-27）は外側のスロットとタイルが減るだけで RNG の消費順は同じ */
  templateId?: BaseTemplateId;
}): SlotPlacement[] {
  const { seed, placementMethod } = args;
  const v = BASE_VARIANTS[args.templateId ?? "base_34p"];

  const seedNum = typeof seed === "number" ? seed >>> 0 : hashSeed(String(seed));
  const rng = mulberry32(seedNum);

  // 1) 配置（スロット順に対応するセクタ列を構築）
  let innerSectors: string[];
  let outerSectors: string[];

  if (placementMethod === 1) {
    innerSectors = [...v.innerSectors];
    outerSectors = shuffleSeeded(v.outerSectors, rng);
  } else if (placementMethod === 2) {
    innerSectors = shuffleSeeded(v.innerSectors, rng);
    outerSectors = shuffleSeeded(v.outerSectors, rng);
  } else if (placementMethod === 3) {
    const all = shuffleSeeded([...v.innerSectors, ...v.outerSectors], rng);
    innerSectors = all.slice(0, v.innerSlots.length);
    outerSectors = all.slice(v.innerSlots.length);
  } else {
    throw new Error(`basePlacementFromSeed: invalid placementMethod=${placementMethod}`);
  }

  const sectorBySlot = new Map<string, string>();
  v.innerSlots.forEach((slotId, i) => sectorBySlot.set(slotId, innerSectors[i]));
  v.outerSlots.forEach((slotId, i) => sectorBySlot.set(slotId, outerSectors[i]));

  // 2) 回転（スロット順 L1..L10 に固定して消費）
  return [...v.innerSlots, ...v.outerSlots].map((slotId) => ({
    slotId,
    sectorId: sectorBySlot.get(slotId)!,
    rot: Math.floor(rng() * 6) % 6,
    rot30: 0,
  }));
}
