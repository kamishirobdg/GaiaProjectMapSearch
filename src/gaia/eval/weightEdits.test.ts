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
  sameAsBase,
  scaleToLf,
  storedBaseOf,
  storedValue,
  type WeightEdits,
} from "./weightEdits";
import {
  LF_REVIEW_HINTS,
  WEIGHT_TABLES,
  axesOfTile,
  factionsFor,
  weightTableOf,
} from "./weightTables";
import { shipTileCell, tileValueCell } from "./tileWeights";
import { SHIP_IDS } from "@/gaia/setup/types";

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
      const vals = meta.axes(lf).map((a) => storedValue(meta, lf, tile.id, a.key, f.id));
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
      for (const a of advanced.axes(false)) {
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

    for (const a of standard.axes(false)) {
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
    expect(tileValues.axes(false)).toHaveLength(0);

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

  it("edits を渡すと、指定内容が # コメントで添う（値だけでは由来を追えないため）", () => {
    const f = factionsFor(false)[0];
    const tile = advanced.tiles(false)[0];
    const e = edits({
      base: { [baseKey("advanced_tech", false, tile.id, f.id)]: 20 },
      matrix: { [matrixKey("advanced_tech", false, f.id, "nav")]: 50 },
    });

    const text = formatDiffs(collectDiffs(e), e);
    expect(text).toContain(`# base advanced_tech:base:${tile.id}:${f.id} = 20`);
    expect(text).toContain(`# matrix advanced_tech:base:${f.id}:nav = 50`);
    // 反映側は # 行を読み飛ばすので、値の行はコメントより前にまとまっている
    const lines = text.trimEnd().split("\n");
    const firstComment = lines.findIndex((l, i) => i > 0 && l.startsWith("#"));
    expect(lines.slice(1, firstComment).some((l) => l.startsWith("["))).toBe(true);
  });

  it("拡張版の編集は通常版に混ざらない", () => {
    const e = edits({ matrix: { [matrixKey("advanced_tech", true, "moweyds", "nav")]: 0 } });
    const diffs = collectDiffs(e);
    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs.every((d) => d.lf)).toBe(true);
  });
});

// 「通常版と同じ値」の印（2026-08-14）。拡張版を通常版で上書きしたセルを
// 見分けるためのもので、拡張版として見直したら外れることが要点。
describe("sameAsBase", () => {
  it("0 は 0 のまま拡張版へ渡る（素点比を掛けるタイルでも）", () => {
    // 0 は「その列では取りに行けない」。max(1,..) を通して 1 に化けてはいけない。
    expect(scaleToLf(standard, "TS3", 0)).toBe(0);
    expect(standard.lfVpRatio?.("TS3")).toBeGreaterThan(1);
  });

  it("素点が版で違うタイルは比を掛けた値が「通常版と同じ」の基準になる", () => {
    const ratio = standard.lfVpRatio?.("TS3") ?? 1;
    expect(scaleToLf(standard, "TS3", 12)).toBe(Math.round(12 * ratio));
    // 比を持たないタイルは素通し
    expect(scaleToLf(standard, "TS1", 12)).toBe(12);
  });

  it("拡張だけのタイル・種族・軸は判定しない（コピー元が無いため）", () => {
    const f = factionsFor(false)[0];
    // 拡張だけの種族
    expect(sameAsBase(advanced, EMPTY_EDITS, "AT01", "nav", "moweyds")).toBe(false);
    // 拡張だけの軸（得点ボード拡張部の面）
    expect(sameAsBase(advanced, EMPTY_EDITS, "AT01", "vp25", f.id)).toBe(false);
    // 拡張だけのタイル
    const baseIds = new Set(advanced.tiles(false).map((t) => t.id));
    const lfOnly = advanced.tiles(true).find((t) => !baseIds.has(t.id));
    expect(lfOnly).toBeDefined();
    expect(sameAsBase(advanced, EMPTY_EDITS, lfOnly!.id, "nav", f.id)).toBe(false);
  });

  it("LF_REVIEW_HINTS のタイルは通常版・拡張版の両方に実在する", () => {
    // 実在しない id を書いても画面は無反応になるだけなので、ここで落とす。
    // 色が点くのは「通常版からコピーしたセル」なので、両方の版にある必要がある。
    for (const tileId of Object.keys(LF_REVIEW_HINTS)) {
      const found = WEIGHT_TABLES.some(
        (m) =>
          m.tiles(false).some((t) => t.id === tileId) &&
          m.tiles(true).some((t) => t.id === tileId),
      );
      expect(found, `${tileId} がどの表にも無い`).toBe(true);
    }
  });

  it("拡張版の値を動かすと「通常版と同じ」ではなくなる", () => {
    const f = factionsFor(false)[0];
    const tile = advanced.tiles(false)[0];
    const before = sameAsBase(advanced, EMPTY_EDITS, tile.id, "nav", f.id);
    const e = edits({
      cell: { [cellKey("advanced_tech", true, tile.id, "nav", f.id)]: 0 },
      base: { [baseKey("advanced_tech", true, tile.id, f.id)]: 30 },
    });
    // 通常版側が 0 でなければ、拡張版を 0 にすれば必ず外れる
    if (finalValueOf(advanced, EMPTY_EDITS, false, tile.id, "nav", f.id) > 0) {
      expect(sameAsBase(advanced, e, tile.id, "nav", f.id)).toBe(false);
    }
    expect(typeof before).toBe("boolean");
  });
});

// ---------------------------------------------------------------- 船ごとの上書き

// 金枠同盟(FEDG)と拡張の基本技術(TSL)は「どの船に乗ったか」で値が変わる（2026-08-29）。
// tile_weights は表としては船4隻の軸を持つが、**軸が付くのは この11枚だけ**で、
// ブースター・最終得点・同盟・遺物は従来どおり軸なし。ここで守るのは:
//   - 軸の本数が行で違う（FEDG=4隻 / TSL=3隻 / それ以外=0）
//   - 上書きが無いセルは基準値へフォールバックする
//   - **基準値だけ動かしても船のセルは 0 のまま**（上書きが勝手に生えない）
//   - 差分には基準値の行("-")と船の行の両方が出る
describe("LF船の船ごとの上書き", () => {
  it("軸が付くのは FEDG(4隻) と TSL(3隻) だけ", () => {
    expect(axesOfTile(tileValues, "FEDG1", true).map((a) => a.key)).toEqual([
      "twilight",
      "eclipse",
      "rebellion",
      "tfmars",
    ]);
    // TSL は技術スロットのある3隻だけ（Twilight はアーティファクト置き場）。
    expect(axesOfTile(tileValues, "TSL1", true).map((a) => a.key)).toEqual([
      "eclipse",
      "rebellion",
      "tfmars",
    ]);
    // 遺物は Twilight 固定なので船で変わらない。ブースターも軸なし。
    expect(axesOfTile(tileValues, "ART01", true)).toHaveLength(0);
    expect(axesOfTile(tileValues, "RB01", true)).toHaveLength(0);
    // 通常版に船は無い。
    expect(axesOfTile(tileValues, "FEDG1", false)).toHaveLength(0);
  });

  it("上書きが無ければ基準値へフォールバックする", () => {
    const base = tileValueCell("FEDG1", true)!;
    for (const ship of SHIP_IDS) {
      expect(shipTileCell("FEDG1", ship, true)).toEqual(base);
    }
    // 通常版（船なし）は基準値をそのまま返す。
    expect(shipTileCell("RB01", undefined, false)).toEqual(tileValueCell("RB01", false));
  });

  it("基準値だけ動かしても船のセルは 0 のまま", () => {
    const f = factionsFor(true)[0];
    const stored = storedBaseOf(tileValues, true, "FEDG1", f.id);
    const e = edits({ base: { [baseKey("tile_weights", true, "FEDG1", f.id)]: stored + 5 } });
    // 基準値の行は動く。
    expect(finalValueOf(tileValues, e, true, "FEDG1", "", f.id)).toBe(stored + 5);
    // 船の行は触っていないので 0（＝実行時に基準値へフォールバック）のまま。
    for (const ship of SHIP_IDS) {
      expect(finalValueOf(tileValues, e, true, "FEDG1", ship, f.id)).toBe(0);
    }
  });

  it("基準値は軸横断の最大ではなく軸なしのセルから採る", () => {
    const f = factionsFor(true)[0];
    // 船の上書きが1つ入っても基準値は引きずられない（baseFromAxisless）。
    expect(storedBaseOf(tileValues, true, "FEDG1", f.id)).toBe(
      storedValue(tileValues, true, "FEDG1", "", f.id),
    );
  });

  it("差分には基準値の行と船の行が出る／軸なしのタイルは基準値の行だけ", () => {
    const f = factionsFor(true)[0];
    const e = edits({
      cell: { [cellKey("tile_weights", true, "FEDG1", "eclipse", f.id)]: 50 },
    });
    const rows = collectDiffs(e).filter((d) => d.tile === "FEDG1" && d.faction === f.id);
    expect(rows.map((d) => d.axis)).toEqual(["eclipse"]);

    // 基準値を動かすと "-" の行が出る（船の行は 0 のままなので出ない）。
    const stored = storedBaseOf(tileValues, true, "RB01", f.id);
    const e2 = edits({ base: { [baseKey("tile_weights", true, "RB01", f.id)]: stored + 1 } });
    const rows2 = collectDiffs(e2).filter((d) => d.tile === "RB01" && d.faction === f.id);
    expect(rows2.map((d) => d.axis)).toEqual(["-"]);
  });
});
