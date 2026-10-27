import type { TemplateDef } from "./types";
import { TEMPLATE_BASE_34P } from "./base_34p";
import { BASE_VARIANTS } from "@/gaia/templates/baseVariants";

// 3 人用の縮小盤（2026-10-27）。表示座標は base_34p のスロットの部分集合（同じ位置、同じ恒久関係。
// scripts/check-coord-consistency.ts が監視）。どのスロットを抜くかは baseVariants.ts が正本。
function subset(templateId: "base_3p_9" | "base_3p_8", label: string): TemplateDef {
  const v = BASE_VARIANTS[templateId];
  const keep = new Set<string>([...v.innerSlots, ...v.outerSlots]);
  return {
    templateId,
    label,
    playerCount: 3,
    expansion: "base",
    radius: TEMPLATE_BASE_34P.radius,
    slots: TEMPLATE_BASE_34P.slots.filter((s) => keep.has(s.slotId)),
  };
}

/** 09 を除いた 9 枚（3 × 3） */
export const TEMPLATE_BASE_3P_9: TemplateDef = subset("base_3p_9", "3人 基本版 9枚（09なし）");
/** 09・10 を除いた 8 枚 */
export const TEMPLATE_BASE_3P_8: TemplateDef = subset("base_3p_8", "3人 基本版 8枚（09・10なし）");
