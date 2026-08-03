// src/gaia/eval/techPositionBase.test.ts
//
// 通常版の標準技術テーブル（TECH_POSITION_WEIGHTS_BASE）の性質を固定する。
// 中身は 2026-08-01 にユーザー作成の CSV から機械生成したもので、
// 9タイル×6列×14種族＝756セルある。個々の値は見直しで動くので固定しない。
// ここで守るのは「取り違えたら黙って壊れる」構造の方:
//   - 9タイルすべてが揃っていて、各タイルに研究列6つが揃っている
//   - 通常版に LF4種族が混ざっていない（通常版では選べない）
//   - フリー枠はデータに持たない（研究列の最大値として計算される）
//   - 拡張版と通常版が別テーブルとして引かれる

import { describe, expect, it } from "vitest";
import { RESEARCH_TRACK_IDS, type ResearchTrackId } from "@/gaia/setup/types";
import {
  FACTION_IDS,
  LF_FACTION_IDS,
} from "./factionWeights";
import {
  TECH_POSITION_WEIGHTS_BASE,
  TECH_POSITION_WEIGHTS_LF,
  techPositionCell,
  techPositionTable,
} from "./techPositionWeights";

const TILE_IDS = ["TS1", "TS2", "TS3", "TS4", "TS5", "TS6", "TS7", "TS8", "TS9"] as const;
const TRACKS = RESEARCH_TRACK_IDS as readonly ResearchTrackId[];

describe("TECH_POSITION_WEIGHTS_BASE（通常版）", () => {
  it("標準技術9種すべてに研究列6つが揃っている", () => {
    expect(Object.keys(TECH_POSITION_WEIGHTS_BASE).sort()).toEqual([...TILE_IDS].sort());
    for (const id of TILE_IDS) {
      const tile = TECH_POSITION_WEIGHTS_BASE[id];
      expect(Object.keys(tile).sort()).toEqual([...TRACKS].sort());
    }
  });

  it("LF4種族は入っていない（通常版では選べない）", () => {
    for (const id of TILE_IDS) {
      for (const track of TRACKS) {
        const cell = TECH_POSITION_WEIGHTS_BASE[id]?.[track] ?? {};
        for (const f of LF_FACTION_IDS) {
          expect(`${id}/${track}/${f}`).toBe(
            cell[f] === undefined ? `${id}/${track}/${f}` : "LF種族が通常版に混入"
          );
        }
      }
    }
  });

  it("フリー枠はデータに持たず、研究列の最大値として計算される", () => {
    for (const lf of [false, true]) {
      const table = techPositionTable(lf);
      for (const id of Object.keys(table)) {
        // データ側に "free" キーが無いこと（型でも禁じているが実体でも確認）
        expect(Object.keys(table[id])).not.toContain("free");
        const free = techPositionCell(id, "free", lf) ?? {};
        for (const f of FACTION_IDS) {
          const max = Math.max(0, ...TRACKS.map((t) => table[id]?.[t]?.[f] ?? 0));
          expect(`${id}/${f}=${free[f] ?? 0}`).toBe(`${id}/${f}=${max}`);
        }
      }
    }
  });

  it("値はすべて整数（評価値から小数を出さないため）", () => {
    for (const table of [TECH_POSITION_WEIGHTS_BASE, TECH_POSITION_WEIGHTS_LF]) {
      for (const [id, tile] of Object.entries(table)) {
        for (const [track, cell] of Object.entries(tile)) {
          for (const [f, v] of Object.entries(cell ?? {})) {
            expect(`${id}/${track}/${f}: ${Number.isInteger(v)}`).toBe(`${id}/${track}/${f}: true`);
          }
        }
      }
    }
  });

  it("通常版と拡張版は別のテーブル", () => {
    expect(techPositionTable(false)).toBe(TECH_POSITION_WEIGHTS_BASE);
    expect(techPositionTable(true)).toBe(TECH_POSITION_WEIGHTS_LF);
    expect(TECH_POSITION_WEIGHTS_BASE).not.toBe(TECH_POSITION_WEIGHTS_LF);
  });
});
