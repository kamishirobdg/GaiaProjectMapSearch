// src/gaia/board/types.ts
import type { Axial } from "./axial";

export type Accepts = "LARGE" | "MIDDLE" | "SMALL";

export type SlotPos = Axial;

export type SlotDef = {
  slotId: string;          // "L1" "M5" "S3" 等
  accepts: Accepts[];
  pos: SlotPos;            // 盤面上の中心（Axial）
};

export type TemplateDef = {
  templateId: string;      // "LF_3P" 等
  slots: SlotDef[];
};

export type SlotPlacement = {
  slotId: string;
  sectorId: string;
  rot: number;    // 0..5
  rot30: number;  // 30deg steps, + is CW
};

