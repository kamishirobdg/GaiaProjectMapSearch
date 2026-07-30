// src/gaia/viewer/artworkCalib.test.ts
//
// アートワーク較正値の検算。実測は scripts/measure-sector-artwork.ts で出したが、
// その数値が「セクター定義の形」と辻褄が合っているかはここで固定する。
// 画像はセル群の外接矩形でぴったり切り出されているので、
//   セル形状から出した外接サイズ（hex単位） × pitch == PNG の実寸
// が成り立つ。これが崩れたら較正値かセクター定義のどちらかが変わっている。

import { describe, expect, it } from "vitest";
import {
  ARTWORK_CALIB_BY_ACCEPTS,
  artworkBoxUnit,
  artworkCellOffsetUnit,
  artworkLatticeCenter,
  unitPosPointy,
} from "./artworkCalib";
import { BASE_SECTORS } from "@/gaia/sectorTiles_base";
import {
  EXPANSION_LITTLE,
  EXPANSION_MIDDLE,
  EXPANSION_SCOUT,
} from "@/gaia/sectorTiles_lostfleet";

const SQRT3 = Math.sqrt(3);

/** 実際に画像がある（＝計測対象の）セクターを accepts クラスごとに集める。 */
const GROUPS = {
  // 19セル（半径2）の基本セクター
  LARGE: BASE_SECTORS.map((s) => Object.keys(s.cells)).filter((k) => k.length === 19),
  // 3セルの LF 中タイル
  MIDDLE: (EXPANSION_MIDDLE as any[]).map((s) => Object.keys(s.cells)).filter((k) => k.length === 3),
  // 1セルの LF 小タイル・探査船
  SMALL: [...(EXPANSION_LITTLE as any[]), ...(EXPANSION_SCOUT as any[])]
    .map((s) => Object.keys(s.cells))
    .filter((k) => k.length === 1),
} as const;

describe("セクター定義とクラス分け", () => {
  it("3クラスとも計測対象のセクターが存在する", () => {
    expect(GROUPS.LARGE.length).toBeGreaterThan(0);
    expect(GROUPS.MIDDLE.length).toBeGreaterThan(0);
    expect(GROUPS.SMALL.length).toBeGreaterThan(0);
  });

  it("同じクラスのセクターはすべて同じセル形状（＝画像1枚ぶんの較正で足りる）", () => {
    for (const keys of Object.values(GROUPS)) {
      const shape = (k: readonly string[]) => [...k].sort().join("|");
      const first = shape(keys[0]);
      for (const k of keys) expect(shape(k)).toBe(first);
    }
  });
});

describe("較正値の検算（外接サイズ × pitch == PNG実寸）", () => {
  for (const accepts of ["LARGE", "MIDDLE", "SMALL"] as const) {
    it(`${accepts}: 実測 pitch/向きから PNG 実寸が再現できる`, () => {
      const cal = ARTWORK_CALIB_BY_ACCEPTS[accepts];
      const box = artworkBoxUnit(GROUPS[accepts][0], cal.deg);
      const w = box.w * cal.pitch;
      const h = box.h * cal.pitch;
      // 画像の切り出しは 1% 程度の余白差があるのでそこまでは許容する
      expect(Math.abs(w - cal.imgW) / cal.imgW).toBeLessThan(0.01);
      expect(Math.abs(h - cal.imgH) / cal.imgH).toBeLessThan(0.01);
    });
  }
});

describe("artworkCellOffsetUnit", () => {
  it("対称な19セルタイルでは格子中心が原点（＝画像中心がセル(0,0)）", () => {
    const c = artworkLatticeCenter(GROUPS.LARGE[0], ARTWORK_CALIB_BY_ACCEPTS.LARGE.deg);
    expect(Math.abs(c.x)).toBeLessThan(1e-9);
    expect(Math.abs(c.y)).toBeLessThan(1e-9);
    const o = artworkCellOffsetUnit(GROUPS.LARGE[0], "0,0", ARTWORK_CALIB_BY_ACCEPTS.LARGE.deg);
    expect(o).not.toBeNull();
    expect(Math.hypot(o!.x, o!.y)).toBeLessThan(1e-9);
  });

  it("隣接セルは必ず hex 1つ分（√3）離れる＝回転しても格子が保たれる", () => {
    const keys = GROUPS.LARGE[0];
    for (const deg of [0, 30, 120, 210]) {
      for (const a of keys) {
        for (const b of keys) {
          const [aq, ar] = a.split(",").map(Number);
          const [bq, br] = b.split(",").map(Number);
          // 軸座標での距離が1のペアだけ見る
          const dist = (Math.abs(aq - bq) + Math.abs(ar - br) + Math.abs(aq + ar - bq - br)) / 2;
          if (dist !== 1) continue;
          const pa = artworkCellOffsetUnit(keys, a, deg)!;
          const pb = artworkCellOffsetUnit(keys, b, deg)!;
          expect(Math.hypot(pa.x - pb.x, pa.y - pb.y)).toBeCloseTo(SQRT3, 9);
        }
      }
    }
  });

  it("全セルが相異なる位置へ写る", () => {
    for (const accepts of ["LARGE", "MIDDLE", "SMALL"] as const) {
      const keys = GROUPS[accepts][0];
      const seen = new Set<string>();
      for (const k of keys) {
        const o = artworkCellOffsetUnit(keys, k, ARTWORK_CALIB_BY_ACCEPTS[accepts].deg)!;
        seen.add(`${o.x.toFixed(6)},${o.y.toFixed(6)}`);
      }
      expect(seen.size).toBe(keys.length);
    }
  });

  it("不正なキーは null", () => {
    expect(artworkCellOffsetUnit(GROUPS.LARGE[0], "x,y", 30)).toBeNull();
  });

  it("単セルタイルは常に画像中心", () => {
    const o = artworkCellOffsetUnit(GROUPS.SMALL[0], "0,0", ARTWORK_CALIB_BY_ACCEPTS.SMALL.deg)!;
    expect(Math.hypot(o.x, o.y)).toBeLessThan(1e-9);
  });
});

describe("unitPosPointy", () => {
  it("pointy-top の隣接は √3 離れる", () => {
    const a = unitPosPointy(0, 0);
    for (const [dq, dr] of [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]]) {
      const b = unitPosPointy(dq, dr);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(SQRT3, 9);
    }
  });
});
