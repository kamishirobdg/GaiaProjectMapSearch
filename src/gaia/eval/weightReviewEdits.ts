// src/gaia/eval/weightReviewEdits.ts
//
// 整合性レビュー（weightReview.ts、自動生成）を /weights で採否するための計算（2026-09-20）。
//
//   - **採用** … 提案のセルを編集へ書く。軸なしの行（基準値）は `edits.base`、軸のある
//     行は**値そのもの**の上書き `edits.value`（倍率より優先）。差分には普段どおり出る。
//   - **見送り／未定** … 採用で書いた値を外す。**いまの編集がその提案の値と同じときだけ**
//     外すので、手で直した値は残る。
//   - 採否は localStorage の別キー（REVIEW_LS_KEY）に持ち、「全消去」では消えない
//     （どの提案を採ったかの記録は、差分を反映したあとも残したい）。
//   - 差分テキストの末尾には `# review P01 = adopt` の形で採否を添える（反映には使わない）。

import { WEIGHT_REVIEW, type ReviewCell, type ReviewItem } from "./weightReview";
import { baseKey, cellKey, type WeightEdits } from "./weightEdits";
import { WEIGHT_TABLES, type WeightTableId } from "./weightTables";

export type ReviewDecision = "adopt" | "reject" | "done";
/** 提案 id → 採否。無ければ未定。 */
export type ReviewDecisions = Record<string, ReviewDecision>;

export const REVIEW_LS_KEY = "gaia_weight_review";

export const REVIEW_DECISION_JA: Record<ReviewDecision, string> = {
  adopt: "採用",
  reject: "見送り",
  done: "対応済み",
};

/** 提案のセルを編集のどこへ書くか。軸なしの行は基準値、軸のある行は値そのもの。 */
export function reviewCellSlot(c: ReviewCell): { kind: "base" | "value"; key: string } {
  return c.axis === ""
    ? { kind: "base", key: baseKey(c.table, c.lf, c.tile, c.faction) }
    : { kind: "value", key: cellKey(c.table, c.lf, c.tile, c.axis, c.faction) };
}

/**
 * そのタイル（その版）を開いたときに出す提案。提案はセルがその版にあるものだけ、
 * 要判断（セルなし）は対象にタイルが挙がっているもの。
 */
export function itemsForTile(
  tileId: string,
  lf: boolean,
  items: readonly ReviewItem[] = WEIGHT_REVIEW,
): ReviewItem[] {
  return items.filter((it) =>
    it.cells.length > 0
      ? it.cells.some((c) => c.tile === tileId && c.lf === lf)
      : it.targetTiles.includes(tileId),
  );
}

/** 提案のうち、そのタイル・その版に書くセル。 */
export function cellsForTile(item: ReviewItem, tileId: string, lf: boolean): ReviewCell[] {
  return item.cells.filter((c) => c.tile === tileId && c.lf === lf);
}

/**
 * 採否を編集へ反映した新しい編集を返す。
 * 1. 採用でない提案の値は、いまの編集がその値と同じときだけ外す（手で直した値は残す）。
 * 2. 採用の提案の値を順番に書く（同じセルに複数あれば後の提案が勝つ）。
 */
export function applyReviewDecisions(
  edits: WeightEdits,
  decisions: ReviewDecisions,
  items: readonly ReviewItem[] = WEIGHT_REVIEW,
): WeightEdits {
  const base = { ...edits.base };
  const value = { ...edits.value };
  for (const it of items) {
    if (decisions[it.id] === "adopt") continue;
    for (const c of it.cells) {
      const s = reviewCellSlot(c);
      const store = s.kind === "base" ? base : value;
      if (store[s.key] === c.value) delete store[s.key];
    }
  }
  for (const it of items) {
    if (decisions[it.id] !== "adopt") continue;
    for (const c of it.cells) {
      const s = reviewCellSlot(c);
      (s.kind === "base" ? base : value)[s.key] = c.value;
    }
  }
  return { ...edits, base, value };
}

export function reviewCounts(
  decisions: ReviewDecisions,
  items: readonly ReviewItem[] = WEIGHT_REVIEW,
): { adopt: number; reject: number; done: number; pending: number; total: number } {
  const out = { adopt: 0, reject: 0, done: 0, pending: 0, total: items.length };
  for (const it of items) {
    const d = decisions[it.id];
    if (d === "adopt") out.adopt += 1;
    else if (d === "reject") out.reject += 1;
    else if (d === "done") out.done += 1;
    else out.pending += 1;
  }
  return out;
}

/** 差分テキストの末尾に添える採否の記録（反映には使わない）。 */
export function reviewNotes(decisions: ReviewDecisions): string[] {
  return Object.keys(decisions)
    .sort()
    .map((id) => `# review ${id} = ${decisions[id]}`);
}

/**
 * タイル id から表・版・並びの位置を引く（根拠のタイルへ飛ぶため）。
 * いま見ている版を優先し、無ければもう一方の版で探す（拡張専用タイルなど）。
 */
export function locateTile(
  tileId: string,
  preferLf: boolean,
): { table: WeightTableId; lf: boolean; index: number } | null {
  for (const lf of [preferLf, !preferLf]) {
    for (const t of WEIGHT_TABLES) {
      const index = t.tiles(lf).findIndex((x) => x.id === tileId);
      if (index >= 0) return { table: t.id, lf, index };
    }
  }
  return null;
}
