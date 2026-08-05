// src/gaia/eval/weightEdits.test.ts
//
// 重み編集ページの計算（基準値 → 倍率 → 最終値 → 差分）を固定する。
// 個々の重みの値は見直しで動くので固定しない。ここで守るのは、
// 差分テキストが CSV へ正しく戻せる形になっていること:
//   - 編集が無ければ差分は空（初期値が現在の表と一致している）
//   - マトリクスは同じ種族×軸の全タイルへ効く
//   - セル個別の上書きがマトリクスより優先される
//   - 軸の無い表（tile_weights）は基準値がそのまま最終値になる

import { describe, expect, it } from "vitest";
import {
  EMPTY_EDITS,
  baseKey,
  baseValueOf,
  cellKey,
  collectDiffs,
  finalValueOf,
  formatDiffs,
  matrixKey,
  storedValue,
  type WeightEdits,
} from "./weightEdits";
import { factionsFor, weightTableOf } from "./weightTables";

const advanced = weightTableOf("advanced_tech");
const tileValues = weightTableOf("tile_weights");

/** 編集を1つだけ持つ状態を作る。 */
function edits(patch: Partial<WeightEdits>): WeightEdits {
  return { ...EMPTY_EDITS, matrix: {}, base: {}, cell: {}, ...patch };
}

describe("weightEdits", () => {
  it("編集が無ければ差分は出ない", () => {
    expect(collectDiffs(EMPTY_EDITS)).toEqual([]);
    expect(formatDiffs([])).toBe("");
  });

  it("列差がゼロの表では、基準値が現在値と一致する", () => {
    // 雛形の状態（列差ゼロ）なら、軸横断の最大＝各列の値。
    const tile = advanced.tiles(false)[0];
    const f = factionsFor(false)[0];
    const base = baseValueOf(advanced, EMPTY_EDITS, false, tile.id, f.id);
    for (const a of advanced.axes) {
      expect(base).toBeGreaterThanOrEqual(storedValue(advanced, false, tile.id, a.key, f.id));
    }
    expect(finalValueOf(advanced, EMPTY_EDITS, false, tile.id, advanced.axes[0].key, f.id)).toBe(
      storedValue(advanced, false, tile.id, advanced.axes[0].key, f.id),
    );
  });

  it("マトリクスの 0% は、その種族×列の全タイルを 0 にする", () => {
    const f = factionsFor(false)[0];
    const e = edits({ matrix: { [matrixKey("advanced_tech", false, f.id, "nav")]: 0 } });

    for (const tile of advanced.tiles(false)) {
      expect(finalValueOf(advanced, e, false, tile.id, "nav", f.id)).toBe(0);
      // 他の列は動かない
      expect(finalValueOf(advanced, e, false, tile.id, "terra", f.id)).toBe(
        storedValue(advanced, false, tile.id, "terra", f.id),
      );
    }

    const diffs = collectDiffs(e);
    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs.every((d) => d.axis === "nav" && d.faction === f.id && d.to === 0)).toBe(true);
  });

  it("セル個別の上書きはマトリクスより優先される", () => {
    const f = factionsFor(false)[0];
    const tile = advanced.tiles(false)[0];
    const e = edits({
      matrix: { [matrixKey("advanced_tech", false, f.id, "nav")]: 0 },
      cell: { [cellKey("advanced_tech", false, tile.id, "nav", f.id)]: 100 },
    });

    const base = baseValueOf(advanced, e, false, tile.id, f.id);
    expect(finalValueOf(advanced, e, false, tile.id, "nav", f.id)).toBe(base);
    // 同じ列でも別タイルはマトリクスのまま
    const other = advanced.tiles(false)[1];
    expect(finalValueOf(advanced, e, false, other.id, "nav", f.id)).toBe(0);
  });

  it("基準値を変えると、その種族×タイルの全列が追随する", () => {
    const f = factionsFor(false)[0];
    const tile = advanced.tiles(false)[0];
    const e = edits({ base: { [baseKey("advanced_tech", false, tile.id, f.id)]: 30 } });

    for (const a of advanced.axes) {
      expect(finalValueOf(advanced, e, false, tile.id, a.key, f.id)).toBe(30);
    }
  });

  it("倍率は四捨五入して整数にする", () => {
    const f = factionsFor(false)[0];
    const tile = advanced.tiles(false)[0];
    const e = edits({
      base: { [baseKey("advanced_tech", false, tile.id, f.id)]: 10 },
      matrix: { [matrixKey("advanced_tech", false, f.id, "nav")]: 25 },
    });
    expect(finalValueOf(advanced, e, false, tile.id, "nav", f.id)).toBe(3); // 2.5 → 3
  });

  it("軸の無い表は基準値がそのまま最終値になる", () => {
    const f = factionsFor(false)[0];
    const tile = tileValues.tiles(false)[0];
    expect(tileValues.axes).toHaveLength(0);

    const e = edits({ base: { [baseKey("tile_weights", false, tile.id, f.id)]: 7 } });
    expect(finalValueOf(tileValues, e, false, tile.id, "", f.id)).toBe(7);

    const diffs = collectDiffs(e);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({ table: "tile_weights", tile: tile.id, axis: "-", to: 7 });
  });

  it("差分テキストは表・版ごとの見出しと 4項目の行で出る", () => {
    const f = factionsFor(false)[0];
    const tile = advanced.tiles(false)[0];
    const e = edits({ cell: { [cellKey("advanced_tech", false, tile.id, "nav", f.id)]: 0 } });

    const text = formatDiffs(collectDiffs(e));
    const lines = text.trimEnd().split("\n");
    expect(lines[0]).toBe("# gaia-weights v1");
    expect(lines[1]).toBe("[advanced_tech base]");
    expect(lines[2]).toBe(`${tile.id},nav,${f.id},0`);
  });

  it("拡張版の編集は通常版に混ざらない", () => {
    const f = factionsFor(true).find((x) => x.id === "moweyds");
    expect(f).toBeDefined();
    const e = edits({ matrix: { [matrixKey("advanced_tech", true, "moweyds", "nav")]: 0 } });
    const diffs = collectDiffs(e);
    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs.every((d) => d.lf)).toBe(true);
  });
});
