// src/gaia/eval/weightEdits.test.ts
//
// 重み編集ページの計算（基準値 → 倍率 → 最終値 → 差分）を固定する。
// 個々の重みの値は見直しで動くので固定しない。ここで守るのは、
// 差分テキストが CSV へ正しく戻せる形になっていること:
//   - 編集が無ければ差分は空
//   - **触っていないセルは差分に出ない**（列差の入った表でも）
//   - マトリクスは指定した列だけに効き、他の列は表の値のまま
//   - セル個別の上書きがマトリクスより優先される
//   - 基準値を変えると列差を比率で保ったまま追随する
//   - 軸の無い表（tile_weights）は基準値がそのまま最終値になる
//
// 3つめが 2026-08-06 の回帰テスト。基準値は「軸横断の最大」なので、触っていない列にも
// 一律で「基準値 × 100%」を掛けていた版では、列差の入った標準技術・通常版を開いた
// だけで触っていない列が最大値へ持ち上がり、大量の差分が出ていた。

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
  storedBaseOf,
  storedValue,
  type WeightEdits,
} from "./weightEdits";
import { factionsFor, weightTableOf } from "./weightTables";

const advanced = weightTableOf("advanced_tech");
const standard = weightTableOf("tech_position");
const tileValues = weightTableOf("tile_weights");

function edits(patch: Partial<WeightEdits>): WeightEdits {
  return { ...EMPTY_EDITS, matrix: {}, base: {}, cell: {}, ...patch };
}

/** 列ごとに値が違う（＝列差が入っている）タイル×種族を1つ返す。 */
function findColumnDiff(meta: typeof standard, lf: boolean) {
  for (const tile of meta.tiles(lf)) {
    for (const f of factionsFor(lf)) {
      const vals = meta.axes.map((a) => storedValue(meta, lf, tile.id, a.key, f.id));
      if (new Set(vals).size > 1) return { tile: tile.id, faction: f.id, vals };
    }
  }
  return null;
}

describe("weightEdits", () => {
  it("編集が無ければ差分は出ない", () => {
    expect(collectDiffs(EMPTY_EDITS)).toEqual([]);
    expect(formatDiffs([])).toBe("");
  });

  it("列差の入った表でも、触っていないセルは差分に出ない", () => {
    // 先に「列差が実在すること」を確かめる。無ければこのテストは何も守れない。
    const found = findColumnDiff(standard, false);
    expect(found, "標準技術・通常版に列差が無い（テストの前提が崩れている）").not.toBeNull();

    const tile = standard.tiles(false)[0];
    const f = factionsFor(false)[0];
    const before = storedValue(standard, false, tile.id, "nav", f.id);
    expect(before).toBeGreaterThan(0); // 0 だと「0 にする」編集が差分にならない

    const e = edits({ cell: { [cellKey("tech_position", false, tile.id, "nav", f.id)]: 0 } });
    const diffs = collectDiffs(e);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({ tile: tile.id, axis: "nav", faction: f.id, to: 0 });
  });

  it("マトリクスの 0% は指定した列だけを 0 にし、他の列は表の値のまま", () => {
    const f = factionsFor(false)[0];
    const e = edits({ matrix: { [matrixKey("advanced_tech", false, f.id, "nav")]: 0 } });

    for (const tile of advanced.tiles(false)) {
      expect(finalValueOf(advanced, e, false, tile.id, "nav", f.id)).toBe(0);
      for (const a of advanced.axes) {
        if (a.key === "nav") continue;
        expect(finalValueOf(advanced, e, false, tile.id, a.key, f.id)).toBe(
          storedValue(advanced, false, tile.id, a.key, f.id),
        );
      }
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

    expect(finalValueOf(advanced, e, false, tile.id, "nav", f.id)).toBe(
      baseValueOf(advanced, e, false, tile.id, f.id),
    );
    // 同じ列でも別タイルはマトリクスのまま
    const other = advanced.tiles(false)[1];
    expect(finalValueOf(advanced, e, false, other.id, "nav", f.id)).toBe(0);
  });

  it("基準値を変えると、列差を比率で保ったまま追随する", () => {
    const found = findColumnDiff(standard, false);
    expect(found).not.toBeNull();
    const { tile, faction } = found!;

    const storedBase = storedBaseOf(standard, false, tile, faction);
    const e = edits({ base: { [baseKey("tech_position", false, tile, faction)]: storedBase * 2 } });

    for (const a of standard.axes) {
      const stored = storedValue(standard, false, tile, a.key, faction);
      expect(finalValueOf(standard, e, false, tile, a.key, faction)).toBe(
        Math.round((stored * storedBase * 2) / storedBase),
      );
    }
  });

  it("倍率を指定した列は 基準値×倍率 を四捨五入する", () => {
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
    expect(lines).toHaveLength(3);
  });

  it("拡張版の編集は通常版に混ざらない", () => {
    const e = edits({ matrix: { [matrixKey("advanced_tech", true, "moweyds", "nav")]: 0 } });
    const diffs = collectDiffs(e);
    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs.every((d) => d.lf)).toBe(true);
  });
});
