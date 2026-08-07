// src/gaia/eval/weightEdits.ts
//
// 重み編集ページの状態と、そこから作る差分テキスト（2026-08-06）。
//
// 入力の形は「マトリクス一括 ＋ タイル個別の上書き」（ユーザー確定）:
//   - **基準値** … そのタイルをその種族が素直に取れたときの VP。既定は現在の表の
//     軸横断の最大値（列差ゼロの状態ならその値そのもの、列差が入っていれば
//     「いちばん取りに行ける列」の値）。
//   - **マトリクス** … 種族 × 軸の倍率(%)。「バルタック人は航法を進められない」は
//     ここに 0 を1回入れれば全タイルへ効く。
//   - **セル個別** … タイル固有の事情で倍率を上書きする。マトリクスより優先。
//   最終値 = round(基準値 × 倍率 / 100)。軸の無い表は基準値がそのまま最終値。
//
// 出力は**変わったセルだけ**の差分テキスト。CSV 全文を組み立てないのは、
// 列順やエンコーディングの正本を Python 側（data/weights/README.md の手順）に
// 残したまま、スマホから短いテキストだけを持ち帰れるようにするため。

import type { FactionId } from "./factionWeights";
import {
  WEIGHT_TABLES,
  factionsFor,
  weightTableOf,
  type WeightTableId,
  type WeightTableMeta,
} from "./weightTables";

export type WeightEdits = {
  /** `${table}:${exp}:${faction}:${axis}` → 倍率(%) */
  matrix: Record<string, number>;
  /** `${table}:${exp}:${tile}:${faction}` → 基準値(VP) */
  base: Record<string, number>;
  /** `${table}:${exp}:${tile}:${axis}:${faction}` → 倍率(%) */
  cell: Record<string, number>;
};

export const EMPTY_EDITS: WeightEdits = { matrix: {}, base: {}, cell: {} };

/** 倍率のボタン。100=素直に取れる / 0=その列では取れない。 */
export const MULTIPLIERS = [100, 75, 50, 25, 0] as const;

const expOf = (lf: boolean) => (lf ? "lf" : "base");

export const matrixKey = (
  table: WeightTableId,
  lf: boolean,
  faction: FactionId,
  axis: string,
) => `${table}:${expOf(lf)}:${faction}:${axis}`;

export const baseKey = (
  table: WeightTableId,
  lf: boolean,
  tile: string,
  faction: FactionId,
) => `${table}:${expOf(lf)}:${tile}:${faction}`;

export const cellKey = (
  table: WeightTableId,
  lf: boolean,
  tile: string,
  axis: string,
  faction: FactionId,
) => `${table}:${expOf(lf)}:${tile}:${axis}:${faction}`;

/** 表そのものが持っている値（0 は表から落ちているので undefined → 0）。 */
export function storedValue(
  meta: WeightTableMeta,
  lf: boolean,
  tile: string,
  axis: string,
  faction: FactionId,
): number {
  return meta.cell(tile, axis, faction, lf) ?? 0;
}

/**
 * 表そのものが持っている基準値（軸横断の最大値）。編集は見ない。
 * 最大値を採るのは「素直に取れたら何点か」という値の定義
 * （data/weights/README.md）に沿うため —— 列差が入った表を読み直しても
 * 基準値が目減りしない。
 */
export function storedBaseOf(
  meta: WeightTableMeta,
  lf: boolean,
  tile: string,
  faction: FactionId,
): number {
  const axes = meta.axes(lf);
  if (axes.length === 0) return storedValue(meta, lf, tile, "", faction);
  let max = 0;
  for (const a of axes) {
    const v = storedValue(meta, lf, tile, a.key, faction);
    if (v > max) max = v;
  }
  return max;
}

/** 基準値。編集があればそれ、無ければ表の値。 */
export function baseValueOf(
  meta: WeightTableMeta,
  edits: WeightEdits,
  lf: boolean,
  tile: string,
  faction: FactionId,
): number {
  return (
    edits.base[baseKey(meta.id, lf, tile, faction)] ?? storedBaseOf(meta, lf, tile, faction)
  );
}

/**
 * **明示的に指定された**倍率。セル個別 → マトリクスの順に見て、
 * どちらも無ければ undefined（＝この列は触っていない）。
 */
export function rawMultiplierOf(
  edits: WeightEdits,
  table: WeightTableId,
  lf: boolean,
  tile: string,
  axis: string,
  faction: FactionId,
): number | undefined {
  const c = edits.cell[cellKey(table, lf, tile, axis, faction)];
  if (c !== undefined) return c;
  return edits.matrix[matrixKey(table, lf, faction, axis)];
}

/**
 * 画面に出す（＝CSV へ書き戻す）最終値。
 *
 * **触っていない列は表の値をそのまま残す**のが要点。基準値は軸横断の最大なので、
 * ここで一律に「基準値 × 100%」を掛けると、列差の入った表（標準技術・通常版など）で
 * 触っていない列まで最大値へ持ち上がり、編集していないセルが差分に出てしまう
 * （2026-08-06 に実際に起きた）。基準値を変えたときも、列差は比率で保つ。
 */
export function finalValueOf(
  meta: WeightTableMeta,
  edits: WeightEdits,
  lf: boolean,
  tile: string,
  axis: string,
  faction: FactionId,
): number {
  const base = baseValueOf(meta, edits, lf, tile, faction);
  if (meta.axes(lf).length === 0) return base;

  const mul = rawMultiplierOf(edits, meta.id, lf, tile, axis, faction);
  if (mul !== undefined) return Math.round((base * mul) / 100);

  // 倍率を触っていない列: いまの列差を保ったまま、基準値を変えたぶんだけ比例させる。
  const stored = storedValue(meta, lf, tile, axis, faction);
  const storedBase = storedBaseOf(meta, lf, tile, faction);
  if (storedBase === 0 || base === storedBase) return stored;
  return Math.round((stored * base) / storedBase);
}

export type WeightDiff = {
  table: WeightTableId;
  lf: boolean;
  tile: string;
  /** 軸なしの表は "-"。 */
  axis: string;
  faction: FactionId;
  from: number;
  to: number;
};

/** どの表・どの版に編集が入っているかを、キーの頭から拾う。 */
function touchedScopes(edits: WeightEdits): Array<{ table: WeightTableId; lf: boolean }> {
  const seen = new Set<string>();
  for (const key of [
    ...Object.keys(edits.matrix),
    ...Object.keys(edits.base),
    ...Object.keys(edits.cell),
  ]) {
    const [table, exp] = key.split(":");
    seen.add(`${table}:${exp}`);
  }
  const out: Array<{ table: WeightTableId; lf: boolean }> = [];
  for (const s of seen) {
    const [table, exp] = s.split(":");
    if (!WEIGHT_TABLES.some((t) => t.id === table)) continue;
    out.push({ table: table as WeightTableId, lf: exp === "lf" });
  }
  return out;
}

/** 現在の表と最終値がずれているセルを全部集める。 */
export function collectDiffs(edits: WeightEdits): WeightDiff[] {
  const out: WeightDiff[] = [];
  for (const { table, lf } of touchedScopes(edits)) {
    const meta = weightTableOf(table);
    const factions = factionsFor(lf);
    const metaAxes = meta.axes(lf);
    const axes = metaAxes.length > 0 ? metaAxes.map((a) => a.key) : ["-"];
    for (const tile of meta.tiles(lf)) {
      for (const axis of axes) {
        for (const f of factions) {
          const from = storedValue(meta, lf, tile.id, axis === "-" ? "" : axis, f.id);
          const to = finalValueOf(meta, edits, lf, tile.id, axis === "-" ? "" : axis, f.id);
          if (from !== to) {
            out.push({ table, lf, tile: tile.id, axis, faction: f.id, from, to });
          }
        }
      }
    }
  }
  return out;
}

/**
 * 差分テキスト。`scripts/apply_weight_edits.py` が読む形。
 * 表と版が変わるところで `[advanced_tech lf]` の見出しを挟み、
 * 各行は `タイル,軸,種族,値`（軸なしの表は `-`）。
 *
 * `edits` を渡すと**指定内容そのもの**（どの倍率・基準値を入れたか）を末尾に
 * `#` コメントで添える。値だけでは「基準値を変えたのか倍率を指定したのか」を
 * 後から区別できず、2026-08-06 に差分の由来を追えなくなったため。
 * apply スクリプトは `#` 行を読み飛ばすので、付けても反映には影響しない。
 */
export function formatDiffs(diffs: WeightDiff[], edits?: WeightEdits): string {
  const lines: string[] = ["# gaia-weights v1"];
  let scope = "";
  for (const d of diffs) {
    const s = `${d.table} ${d.lf ? "lf" : "base"}`;
    if (s !== scope) {
      lines.push(`[${s}]`);
      scope = s;
    }
    lines.push(`${d.tile},${d.axis},${d.faction},${d.to}`);
  }

  const spec: string[] = [];
  if (edits) {
    for (const [k, v] of Object.entries(edits.matrix)) spec.push(`# matrix ${k} = ${v}`);
    for (const [k, v] of Object.entries(edits.base)) spec.push(`# base ${k} = ${v}`);
    for (const [k, v] of Object.entries(edits.cell)) spec.push(`# cell ${k} = ${v}`);
  }
  if (diffs.length === 0 && spec.length === 0) return "";
  if (spec.length > 0) {
    lines.push("#", `# --- 指定内容 ${spec.length} 件（反映には使わない記録） ---`, ...spec);
  }
  return lines.join("\n") + "\n";
}
