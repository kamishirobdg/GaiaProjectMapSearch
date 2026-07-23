import type { TemplateDef } from "./types";

// 表示側テンプレート。pos は eval 側 SSOT（base_34p_slotCenters.ts）と
//   display.pos == rotate60(slotCenters, 3) + C_LARGE(19,14)
// の恒久関係で結ばれる（scripts/check-coord-consistency.ts が監視）。
export const TEMPLATE_BASE_34P: TemplateDef = {
  templateId: "base_34p",
  label: "3・4人 基本版",
  playerCount: 4, // 3・4人共用（人数差は初期配置のみでマップ生成には無関係）
  expansion: "base",
  radius: 10,
  slots: [
    // inner 4
    { slotId: "L1", pos: { q: 9, r: 10 }, accepts: ["LARGE"] },
    { slotId: "L2", pos: { q: 12, r: 5 }, accepts: ["LARGE"] },
    { slotId: "L3", pos: { q: 7, r: 7 }, accepts: ["LARGE"] },
    { slotId: "L4", pos: { q: 10, r: 2 }, accepts: ["LARGE"] },

    // outer 6
    { slotId: "L5", pos: { q: 4, r: 12 }, accepts: ["LARGE"] },
    { slotId: "L6", pos: { q: 2, r: 9 }, accepts: ["LARGE"] },
    { slotId: "L7", pos: { q: 5, r: 4 }, accepts: ["LARGE"] },
    { slotId: "L8", pos: { q: 15, r: 0 }, accepts: ["LARGE"] },
    { slotId: "L9", pos: { q: 17, r: 3 }, accepts: ["LARGE"] },
    { slotId: "L10", pos: { q: 14, r: 8 }, accepts: ["LARGE"] },
  ],
};
