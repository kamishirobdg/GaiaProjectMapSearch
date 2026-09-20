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
  axesOfTile,
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
  /**
   * `${table}:${exp}:${tile}:${axis}:${faction}` → 値そのもの(VP)。倍率より優先する。
   * 整合性レビューの提案を「採用」したときに使う（2026-09-20）。倍率だと基準値の
   * 丸めで提案どおりの値にならないことがあるため、セルには値で書く。
   */
  value: Record<string, number>;
};

export const EMPTY_EDITS: WeightEdits = { matrix: {}, base: {}, cell: {}, value: {} };

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
 * 画面に「いまの値」として出す表の値（2026-09-19）。
 * 船のように「上書き＋フォールバック」で持つ表（baseFromAxisless）は、上書きの無い
 * 船セル（表では 0）を**基準値そのもの**として見せる。実行時の `shipTileCell` と同じ
 * 見え方にしておかないと、触っていない船セルが 0 と出て、基準値と同じにするためだけに
 * 100% を押して回ることになる（2026-09-19 の差分で実際に起きた）。
 */
export function effectiveStoredValue(
  meta: WeightTableMeta,
  lf: boolean,
  tile: string,
  axis: string,
  faction: FactionId,
): number {
  const raw = storedValue(meta, lf, tile, axis, faction);
  if (axis !== "" && meta.baseFromAxisless && raw === 0) {
    return storedValue(meta, lf, tile, "", faction);
  }
  return raw;
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
  // 船のように「上書き＋フォールバック」で持つ表は、軸なしのセルが基準値そのもの
  // （最大を採ると上書きが1つ入っただけで基準値が引きずられる）。
  if (meta.baseFromAxisless) return storedValue(meta, lf, tile, "", faction);
  const axes = axesOfTile(meta, tile, lf);
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
  // 軸を持たないタイルは基準値そのもの。**タイルごとの軸**で判定するのが要点で、
  // tile_weights は表としては船の軸を持つが、軸が付くのは FEDG/TSL だけ
  // （ブースターや遺物まで軸ありとして扱うと倍率の経路へ落ちてしまう）。
  if (axesOfTile(meta, tile, lf).length === 0) return base;
  // 軸なしのセル（＝基準値の行）は基準値をそのまま返す。
  if (axis === "" && meta.baseFromAxisless) return base;

  // 値そのものの指定（レビューの採用）は倍率より優先。
  const exact = edits.value[cellKey(meta.id, lf, tile, axis, faction)];
  if (exact !== undefined) return exact;

  const mul = rawMultiplierOf(edits, meta.id, lf, tile, axis, faction);
  if (mul !== undefined) return Math.round((base * mul) / 100);

  // 倍率を触っていない列: いまの列差を保ったまま、基準値を変えたぶんだけ比例させる。
  const stored = storedValue(meta, lf, tile, axis, faction);
  // 上書き方式の表で上書きの無い船セルは、基準値（編集後）にそのまま追随する
  // （2026-09-19）。ここで 0 を返すと、画面に 0 が出て「100% を押して回る」ことになる。
  if (meta.baseFromAxisless && stored === 0) return base;
  const storedBase = storedBaseOf(meta, lf, tile, faction);
  if (storedBase === 0 || base === storedBase) return stored;
  return Math.round((stored * base) / storedBase);
}

/**
 * 通常版の値を拡張版へ持っていくときの換算。素点が版で違うタイルだけ比を掛ける
 * （`scripts/copy_base_to_lf.py` と同じ。**0 は 0 のまま** —— 0 は
 * 「その列では取りに行けない」であって、丸めで 1 に化けてはいけない）。
 */
export function scaleToLf(meta: WeightTableMeta, tile: string, value: number): number {
  const ratio = meta.lfVpRatio?.(tile) ?? 1;
  return value === 0 || ratio === 1 ? value : Math.max(1, Math.round(value * ratio));
}

/** 通常版に同じものがあるか（拡張だけのタイル・種族・軸はコピー元が無い）。 */
function hasBaseCounterpart(
  meta: WeightTableMeta,
  tile: string,
  axis: string | null,
  faction: FactionId,
): boolean {
  if (!meta.tiles(false).some((t) => t.id === tile)) return false;
  if (!factionsFor(false).some((f) => f.id === faction)) return false;
  if (axis !== null && axis !== "" && !meta.axes(false).some((a) => a.key === axis)) return false;
  return true;
}

/**
 * 拡張版のそのセルが「通常版と同じ値」か。通常版で上書きしたまま
 * （`copy_base_to_lf.py` ／ 画面の「全コピー」）のセルを見分けるための印で、
 * **拡張版としてまだ見直していない**ことを意味する。値を動かせば自然に外れる。
 */
export function sameAsBase(
  meta: WeightTableMeta,
  edits: WeightEdits,
  tile: string,
  axis: string,
  faction: FactionId,
): boolean {
  if (!hasBaseCounterpart(meta, tile, axis, faction)) return false;
  return (
    finalValueOf(meta, edits, true, tile, axis, faction) ===
    scaleToLf(meta, tile, finalValueOf(meta, edits, false, tile, axis, faction))
  );
}

/** 基準値（軸横断の最大）についての `sameAsBase`。 */
export function baseSameAsBase(
  meta: WeightTableMeta,
  edits: WeightEdits,
  tile: string,
  faction: FactionId,
): boolean {
  if (!hasBaseCounterpart(meta, tile, null, faction)) return false;
  return (
    baseValueOf(meta, edits, true, tile, faction) ===
    scaleToLf(meta, tile, baseValueOf(meta, edits, false, tile, faction))
  );
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
    ...Object.keys(edits.value),
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
    for (const tile of meta.tiles(lf)) {
      // 軸は**タイルごと**に引く（tile_weights の LF船だけ行で違うため）。
      const tileAxes = axesOfTile(meta, tile.id, lf).map((a) => a.key);
      // 上書き方式の表は、船の行に加えて基準値の行（"-"）も見る。そうしないと
      // 基準値だけ動かしたときに差分がどこにも出ない（船のセルは 0 のまま）。
      const axes =
        tileAxes.length === 0
          ? ["-"]
          : meta.baseFromAxisless
            ? ["-", ...tileAxes]
            : tileAxes;
      for (const axis of axes) {
        for (const f of factions) {
          const key = axis === "-" ? "" : axis;
          const to = finalValueOf(meta, edits, lf, tile.id, key, f.id);
          if (key !== "" && meta.baseFromAxisless) {
            // 船の行に書くのは**基準値と違うところだけ**（上書き）。最終値が基準値
            // （編集後）と同じなら上書きは要らない＝0。表に上書きが残っていれば 0 を
            // 出して消し、元から無ければ何も出さない（2026-09-19）。こうしないと
            // 「基準値と同値」の船セルが明示値で CSV に入り、後で基準値を直しても
            // 追随しない古い値として残る。
            const raw = storedValue(meta, lf, tile.id, key, f.id);
            const toBase = finalValueOf(meta, edits, lf, tile.id, "", f.id);
            const want = to === toBase ? 0 : to;
            if (want !== raw) {
              out.push({ table, lf, tile: tile.id, axis, faction: f.id, from: raw, to: want });
            }
            continue;
          }
          const from = storedValue(meta, lf, tile.id, key, f.id);
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
export function formatDiffs(
  diffs: WeightDiff[],
  edits?: WeightEdits,
  /** さらに末尾へ足す `#` 行（整合性レビューの採否など）。反映には使わない。 */
  notes: string[] = [],
): string {
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
    for (const [k, v] of Object.entries(edits.value)) spec.push(`# value ${k} = ${v}`);
  }
  if (diffs.length === 0 && spec.length === 0 && notes.length === 0) return "";
  if (spec.length > 0) {
    lines.push("#", `# --- 指定内容 ${spec.length} 件（反映には使わない記録） ---`, ...spec);
  }
  if (notes.length > 0) {
    lines.push("#", `# --- 整合性レビューの採否 ${notes.length} 件（反映には使わない記録） ---`, ...notes);
  }
  return lines.join("\n") + "\n";
}
