// src/gaia/eval/weightReviewEdits.test.ts
//
// 整合性レビューの提案（自動生成の weightReview.ts）と、その採否の計算を固定する。
//   - 資料の件数どおりに読めている（提案30 / 要判断13 / セル443）
//   - すべてのセルが実在するタイル・種族・軸を指す（反映で止まらない）
//   - 採用すると最終値になり差分に出る／見送ると外れる／手で直した値は残る
//   - 根拠のタイルへ飛ぶ位置が引ける

import { describe, expect, it } from "vitest";
import { WEIGHT_REVIEW } from "./weightReview";
import {
  applyReviewDecisions,
  cellsForTile,
  itemsForTile,
  locateTile,
  reviewCellSlot,
  reviewCounts,
  reviewNotes,
} from "./weightReviewEdits";
import { EMPTY_EDITS, collectDiffs, finalValueOf, formatDiffs, storedValue } from "./weightEdits";
import { axesOfTile, factionsFor, weightTableOf } from "./weightTables";

const P30 = WEIGHT_REVIEW.find((i) => i.id === "P30")!;

describe("整合性レビューの資料", () => {
  it("提案30件・要判断13件・セル443を読めている", () => {
    expect(WEIGHT_REVIEW.filter((i) => i.kind === "proposal")).toHaveLength(30);
    expect(WEIGHT_REVIEW.filter((i) => i.kind === "judgment")).toHaveLength(13);
    expect(WEIGHT_REVIEW.reduce((n, i) => n + i.cells.length, 0)).toBe(443);
    // 提案にはセルがあり（＝対象のタイルもある）、要判断には無い。要判断は対象が
    // 「列」や「種族」のこともあるので、タイルが無い項目があってよい（一覧で開く）。
    for (const i of WEIGHT_REVIEW) {
      expect(i.cells.length > 0).toBe(i.kind === "proposal");
      if (i.kind === "proposal") expect(i.targetTiles.length).toBeGreaterThan(0);
    }
  });

  it("すべてのセルが実在するタイル・種族・軸を指す", () => {
    for (const i of WEIGHT_REVIEW) {
      for (const c of i.cells) {
        const meta = weightTableOf(c.table);
        expect(meta.tiles(c.lf).some((t) => t.id === c.tile), `${i.id} ${c.tile}`).toBe(true);
        expect(factionsFor(c.lf).some((f) => f.id === c.faction), `${i.id} ${c.faction}`).toBe(true);
        const axes = axesOfTile(meta, c.tile, c.lf).map((a) => a.key);
        if (c.axis === "") expect(axes.length === 0 || meta.baseFromAxisless === true).toBe(true);
        else expect(axes, `${i.id} ${c.tile} ${c.axis}`).toContain(c.axis);
        expect(Number.isInteger(c.value) && c.value >= 0).toBe(true);
      }
    }
  });

  it("タイルを開いたときに出す提案は、その版にセルがあるものだけ", () => {
    // P30 は RS12 フィラク族 R1（拡張）。
    expect(itemsForTile("RS12", true).map((i) => i.id)).toContain("P30");
    expect(itemsForTile("RS12", false).map((i) => i.id)).not.toContain("P30");
    expect(cellsForTile(P30, "RS12", true)).toHaveLength(1);
    // 要判断はセルが無いので対象のタイルで出す。
    const L10 = WEIGHT_REVIEW.find((i) => i.id === "L10")!;
    expect(itemsForTile("RS04", true).map((i) => i.id)).toContain(L10.id);
  });
});

describe("採否の反映", () => {
  const cell = P30.cells[0];
  const meta = weightTableOf(cell.table);

  it("採用すると提案の値が最終値になり、差分に出る", () => {
    const e = applyReviewDecisions(EMPTY_EDITS, { P30: "adopt" });
    expect(reviewCellSlot(cell).kind).toBe("value");
    expect(finalValueOf(meta, e, cell.lf, cell.tile, cell.axis, cell.faction)).toBe(cell.value);
    const rows = collectDiffs(e).filter(
      (d) => d.tile === cell.tile && d.axis === cell.axis && d.faction === cell.faction,
    );
    const stored = storedValue(meta, cell.lf, cell.tile, cell.axis, cell.faction);
    if (stored !== cell.value) expect(rows.map((d) => d.to)).toEqual([cell.value]);
    else expect(rows).toHaveLength(0);
    // 差分テキストに指定内容と採否の記録が付く。
    const text = formatDiffs(collectDiffs(e), e, reviewNotes({ P30: "adopt" }));
    expect(text).toContain("# value ");
    expect(text).toContain("# review P30 = adopt");
  });

  it("見送ると採用で書いた値が外れる。手で直した値は残る", () => {
    const adopted = applyReviewDecisions(EMPTY_EDITS, { P30: "adopt" });
    const rejected = applyReviewDecisions(adopted, { P30: "reject" });
    expect(Object.keys(rejected.value)).toHaveLength(0);
    // 同じセルを手で別の値にしてあれば、見送っても消えない。
    const key = reviewCellSlot(cell).key;
    const manual = { ...EMPTY_EDITS, value: { [key]: cell.value + 100 } };
    const kept = applyReviewDecisions(manual, { P30: "reject" });
    expect(kept.value[key]).toBe(cell.value + 100);
  });

  it("軸なしの行は基準値へ書く", () => {
    const P04 = WEIGHT_REVIEW.find((i) => i.id === "P04")!; // FS08 イタル人（拡張）0 → 4
    const c = P04.cells[0];
    expect(c.axis).toBe("");
    expect(reviewCellSlot(c).kind).toBe("base");
    const e = applyReviewDecisions(EMPTY_EDITS, { P04: "adopt" });
    expect(finalValueOf(weightTableOf(c.table), e, c.lf, c.tile, "", c.faction)).toBe(c.value);
  });

  it("件数と記録", () => {
    const counts = reviewCounts({ P30: "adopt", P04: "reject", L10: "done" });
    expect(counts).toEqual({ adopt: 1, reject: 1, done: 1, pending: 40, total: 43 });
    expect(reviewNotes({ P30: "adopt", L10: "done" })).toEqual([
      "# review L10 = done",
      "# review P30 = adopt",
    ]);
  });

  it("根拠のタイルの位置を引ける（版はいまの版を優先、無ければもう一方）", () => {
    expect(locateTile("RS12", true)).toEqual({ table: "round_scoring", lf: true, index: expect.any(Number) });
    // RS12 は拡張専用なので通常版を優先しても拡張版で見つかる。
    expect(locateTile("RS12", false)?.lf).toBe(true);
    expect(locateTile("FEDG2", false)?.table).toBe("tile_weights");
    expect(locateTile("AT01", false)).toEqual({ table: "advanced_tech", lf: false, index: expect.any(Number) });
    expect(locateTile("XX99", true)).toBeNull();
  });
});
