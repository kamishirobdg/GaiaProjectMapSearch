// src/gaia/templates/baseVariants.ts
//
// 基本版のテンプレートの種類（2026-10-27。3 人用の縮小盤を追加）。
// - base_34p : 10 枚（3・4 人共用。最初のゲームの配置図 上段[10,01,05] / 中段[09,02,03,06] / 下段[08,04,07]）
// - base_3p_9: 09 を除いた 9 枚（3 人。位置 L9 を抜く → 上段[10,01,05] / 中段[02,03,06] / 下段[08,04,07] の 3 × 3）
// - base_3p_8: 09・10 を除いた 8 枚（3 人。位置 L9・L10 を抜く → 上段[01,05] / 中段[02,03,06] / 下段[08,04,07]）
// ルールブック p19「3 人時に 09/10 を除いた縮小盤も可」。どの位置を抜くかは最初のゲームの配置図でその番号のタイルが
// 置かれている位置（docs/map-base-spec.md §7）。スロットの座標は base_34p と同じ（SLOT_CENTERS_BASE_34P の部分集合）。
// 内側 4（01〜04 の位置、方法 1 で固定）は 3 種類とも同じ。外側だけが減る。

import { BASE_34P_INNER_SLOTS, BASE_34P_OUTER_SLOTS } from "./base_34p_slotCenters";

export type BaseTemplateId = "base_34p" | "base_3p_9" | "base_3p_8";

export type BaseVariant = {
  templateId: BaseTemplateId;
  /** 3 人専用か（base_34p は 3・4 人共用） */
  playersOnly3: boolean;
  innerSlots: readonly string[];
  outerSlots: readonly string[];
  innerSectors: readonly string[];
  outerSectors: readonly string[];
};

const INNER_SECTORS = ["01", "02", "03", "04"] as const;

export const BASE_VARIANTS: Record<BaseTemplateId, BaseVariant> = {
  base_34p: {
    templateId: "base_34p",
    playersOnly3: false,
    innerSlots: BASE_34P_INNER_SLOTS,
    outerSlots: BASE_34P_OUTER_SLOTS,
    innerSectors: INNER_SECTORS,
    outerSectors: ["05", "06", "07", "08", "09", "10"],
  },
  base_3p_9: {
    templateId: "base_3p_9",
    playersOnly3: true,
    innerSlots: BASE_34P_INNER_SLOTS,
    // L9 ＝ 09 の位置を抜く
    outerSlots: ["L5", "L6", "L7", "L8", "L10"],
    innerSectors: INNER_SECTORS,
    outerSectors: ["05", "06", "07", "08", "10"],
  },
  base_3p_8: {
    templateId: "base_3p_8",
    playersOnly3: true,
    innerSlots: BASE_34P_INNER_SLOTS,
    // L9 ＝ 09、L10 ＝ 10 の位置を抜く
    outerSlots: ["L5", "L6", "L7", "L8"],
    innerSectors: INNER_SECTORS,
    outerSectors: ["05", "06", "07", "08"],
  },
};

export const BASE_TEMPLATE_IDS: readonly BaseTemplateId[] = ["base_34p", "base_3p_9", "base_3p_8"];

export function isBaseTemplateId(templateId: string | null | undefined): templateId is BaseTemplateId {
  return templateId === "base_34p" || templateId === "base_3p_9" || templateId === "base_3p_8";
}

/** 基本版のテンプレートなら定義、それ以外（LF）は null */
export function baseVariantOf(templateId: string | null | undefined): BaseVariant | null {
  return isBaseTemplateId(templateId) ? BASE_VARIANTS[templateId] : null;
}

/** 共有設定（人数・拡張・盤面の大きさ）から基本版のテンプレート id を決める。縮小盤は 3 人のときだけ */
export function baseTemplateIdFor(players: number, mapSize: "full" | "9" | "8"): BaseTemplateId {
  if (players === 3 && mapSize === "9") return "base_3p_9";
  if (players === 3 && mapSize === "8") return "base_3p_8";
  return "base_34p";
}

/** テンプレート id → 共有設定の盤面の大きさ */
export function mapSizeOfTemplateId(templateId: string | null | undefined): "full" | "9" | "8" {
  return templateId === "base_3p_9" ? "9" : templateId === "base_3p_8" ? "8" : "full";
}

/** 画面に出す名前（Map / Setup / Pair の条件・候補の表記で共用） */
export function templateLabel(templateId: string | null | undefined, lang: "ja" | "en"): string {
  const ja = lang === "ja";
  switch (templateId) {
    case "base_34p":
      return ja ? "基本版 3〜4人" : "Base 3–4p";
    case "base_3p_9":
      return ja ? "基本版 3人 9枚（09なし）" : "Base 3p 9 tiles (no 09)";
    case "base_3p_8":
      return ja ? "基本版 3人 8枚（09・10なし）" : "Base 3p 8 tiles (no 09/10)";
    case "3p_lostFleet":
      return ja ? "LF 3人" : "LF 3p";
    case "4p_lostFleet":
      return ja ? "LF 4人" : "LF 4p";
    default:
      return String(templateId ?? "-");
  }
}
