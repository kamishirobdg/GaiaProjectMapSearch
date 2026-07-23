// src/gaia/templates/base_34p_slotCenters.ts
// SSOT: slotId -> logical board center (axial q,r) for the base-game 3/4p map.
//
// 採寸根拠（docs/map-base-spec.md §2.1）:
// - 基本版ルールブック p4「最初のゲーム」配置図（3・4人）を採寸。
//   図の行構成: 上段[10,01,05] / 中段[09,02,03,06] / 下段[08,04,07]。
// - radius-2 のセクタタイルが平面充填する超タイル格子は (5,-2) の60°回転族
//   {(5,-2),(2,3),(-3,5),(-5,2),(-2,-3),(3,-5)} を隣接ベクトルに持つ。
//   p4図の格子ベクトル: 行内隣接 = (5,-2)、右上対角 = (3,-5)、右下対角 = (2,3)。
// - 09 を (2,11) に置く平行移動で全セル座標を非負域に収めた。
// - スロット命名: L1..L4 = 最初のゲームの 01..04 の位置（内側4・方法1で固定）、
//   L5..L10 = 05..10 の位置（外側6）。プレフィクス L = accepts LARGE。
//
// 隣接グラフ（p4図と一致することを scripts/_probe_base_34p.ts で機械検証済み）:
//   行内: L9-L2-L3-L6 / L10-L1-L5 / L8-L4-L7
//   対角: L10:{L9,L2} L1:{L2,L3} L5:{L3,L6} L8:{L9,L2} L4:{L2,L3} L7:{L3,L6}

export const SLOT_CENTERS_BASE_34P: Record<string, { q: number; r: number }> = {
  // inner 4 (最初のゲームの 01..04 の位置)
  L1: { q: 10, r: 4 },
  L2: { q: 7, r: 9 },
  L3: { q: 12, r: 7 },
  L4: { q: 9, r: 12 },

  // outer 6 (最初のゲームの 05..10 の位置)
  L5: { q: 15, r: 2 },
  L6: { q: 17, r: 5 },
  L7: { q: 14, r: 10 },
  L8: { q: 4, r: 14 },
  L9: { q: 2, r: 11 },
  L10: { q: 5, r: 6 },
} as const;

/** 方法1/2 の置換範囲（SSOT）: 内側4スロット / 外側6スロット */
export const BASE_34P_INNER_SLOTS = ["L1", "L2", "L3", "L4"] as const;
export const BASE_34P_OUTER_SLOTS = ["L5", "L6", "L7", "L8", "L9", "L10"] as const;
