// src/components/WeightsEditor.tsx
"use client";

// 重み CSV をスマホ（Android）から編集するためのページ（2026-08-06）。
//
// 値の正本は data/weights/*.csv。この画面は**アプリに焼き込まれた表を初期値として
// 読み、変わったセルだけを差分テキストで出す**。CSV そのものは書き換えない
// （持ち帰った差分を scripts/apply_weight_edits.py で反映する）。
//
// レイアウトは幅 375px を前提にしている。行見出し＋6列がぎりぎり収まる寸法なので、
// セル幅（CELL_W）を広げるときは実機幅で確かめること。

import React from "react";
import Link from "next/link";
import {
  FACTION_SHORT_JA,
  WEIGHT_TABLES,
  factionsFor,
  weightTableOf,
  type WeightTableId,
  type WeightTile,
} from "@/gaia/eval/weightTables";
import {
  EMPTY_EDITS,
  MULTIPLIERS,
  baseKey,
  baseValueOf,
  cellKey,
  collectDiffs,
  finalValueOf,
  formatDiffs,
  matrixKey,
  rawMultiplierOf,
  storedValue,
  type WeightEdits,
} from "@/gaia/eval/weightEdits";
import type { FactionId } from "@/gaia/eval/factionWeights";

const LS_KEY = "gaia_weight_edits";
// 「このタイルは見た」の記録。編集とは別キーにしてあるので、差分を CSV へ反映して
// 「全消去」を押してもチェックは残る（どこまで進んだかの記録は消したくないため）。
const LS_REVIEWED = "gaia_weight_reviewed";

const HEAD_W = 68;
const CELL_W = 44;

/** 行の左端に出す母星色（SetupView の色帯と同じ系統）。 */
const HOME_BG: Record<string, string> = {
  BLACK: "#7a7a7a",
  BLUE: "#2b7fe0",
  BROWN: "#9c6b34",
  ORANGE: "#f0951f",
  RED: "#e23b3b",
  WHITE: "#c8c8c8",
  YELLOW: "#e8c400",
  PROTO: "#3d8cb5",
  ASTEROID: "#9c4a8f",
};

type Mode = "matrix" | "tile";

type Sel =
  | { kind: "matrix"; faction: FactionId; axis: string }
  | { kind: "cell"; tile: string; axis: string; faction: FactionId }
  | { kind: "base"; tile: string; faction: FactionId }
  | null;

export default function WeightsEditor() {
  const [tableId, setTableId] = React.useState<WeightTableId>("advanced_tech");
  const [lf, setLf] = React.useState(true);
  const [mode, setMode] = React.useState<Mode>("matrix");
  const [tileIdx, setTileIdx] = React.useState(0);
  const [edits, setEdits] = React.useState<WeightEdits>(EMPTY_EDITS);
  const [sel, setSel] = React.useState<Sel>(null);
  const [showDiff, setShowDiff] = React.useState(false);
  /** `${table}:${exp}:${tile}` → 確認済み。 */
  const [reviewed, setReviewed] = React.useState<Record<string, true>>({});

  // 復元は起動時の1回だけ。書き込みは操作ハンドラ側で行う（Strict Mode の
  // 二重実行で復元前の既定値が保存を上書きしないようにするため）。
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WeightEdits>;
        setEdits({
          matrix: parsed.matrix ?? {},
          base: parsed.base ?? {},
          cell: parsed.cell ?? {},
        });
      }
      const rawReviewed = localStorage.getItem(LS_REVIEWED);
      if (rawReviewed) setReviewed(JSON.parse(rawReviewed) as Record<string, true>);
    } catch {
      /* 壊れていたら既定のまま始める */
    }
  }, []);

  const meta = weightTableOf(tableId);
  const factions = React.useMemo(() => factionsFor(lf), [lf]);
  const tiles = React.useMemo(() => meta.tiles(lf), [meta, lf]);
  const hasAxis = meta.axes.length > 0;
  const tile: WeightTile | undefined = tiles[Math.min(tileIdx, tiles.length - 1)];

  const commit = React.useCallback((next: WeightEdits) => {
    setEdits(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* 保存できなくても編集は続けられる */
    }
  }, []);

  const diffs = React.useMemo(() => collectDiffs(edits), [edits]);
  // 指定内容も添える（差分の値だけでは、基準値を変えたのか倍率を指定したのかを
  // 後から区別できないため）。
  const diffText = React.useMemo(() => formatDiffs(diffs, edits), [diffs, edits]);

  // 表・版を変えたらタイル選択と選択セルを戻す（並びが変わるため）。
  const switchTable = (id: WeightTableId) => {
    setTableId(id);
    setTileIdx(0);
    setSel(null);
    if (weightTableOf(id).axes.length === 0) setMode("tile");
  };
  const switchLf = (v: boolean) => {
    setLf(v);
    setTileIdx(0);
    setSel(null);
  };

  // ---- 値の書き込み --------------------------------------------------

  const setMatrix = (faction: FactionId, axis: string, mul: number) => {
    const key = matrixKey(tableId, lf, faction, axis);
    const next = { ...edits, matrix: { ...edits.matrix } };
    if (mul === 100) delete next.matrix[key];
    else next.matrix[key] = mul;
    commit(next);
  };

  const setCell = (tileId: string, axis: string, faction: FactionId, mul: number | null) => {
    const key = cellKey(tableId, lf, tileId, axis, faction);
    const next = { ...edits, cell: { ...edits.cell } };
    if (mul === null) delete next.cell[key];
    else next.cell[key] = mul;
    commit(next);
  };

  const setBase = (tileId: string, faction: FactionId, value: number | null) => {
    const key = baseKey(tableId, lf, tileId, faction);
    const next = { ...edits, base: { ...edits.base } };
    if (value === null) delete next.base[key];
    else next.base[key] = value;
    commit(next);
  };

  const clearAll = () => {
    if (!window.confirm("編集をすべて消します。よろしいですか？")) return;
    commit({ matrix: {}, base: {}, cell: {} });
    setSel(null);
  };

  // ---- 確認済みチェック ------------------------------------------------

  const reviewKey = (tileId: string) => `${tableId}:${lf ? "lf" : "base"}:${tileId}`;
  const isReviewed = (tileId: string) => reviewed[reviewKey(tileId)] === true;
  const reviewedCount = tiles.filter((t) => isReviewed(t.id)).length;

  /** 表の選択ボタンに出す進捗（いま選んでいる版のぶん）。 */
  const progress = React.useMemo(() => {
    const exp = lf ? "lf" : "base";
    const out: Record<string, { done: number; total: number }> = {};
    for (const t of WEIGHT_TABLES) {
      const list = t.tiles(lf);
      out[t.id] = {
        done: list.filter((x) => reviewed[`${t.id}:${exp}:${x.id}`]).length,
        total: list.length,
      };
    }
    return out;
  }, [lf, reviewed]);

  const toggleReviewed = (tileId: string) => {
    const key = reviewKey(tileId);
    const next = { ...reviewed };
    if (next[key]) delete next[key];
    else next[key] = true;
    setReviewed(next);
    try {
      localStorage.setItem(LS_REVIEWED, JSON.stringify(next));
    } catch {
      /* 保存できなくてもチェック自体は画面に残る */
    }
  };

  // ---- 見た目の部品 --------------------------------------------------

  const factionCell = (f: (typeof factions)[number]) => (
    <div
      style={{
        width: HEAD_W,
        minWidth: HEAD_W,
        display: "flex",
        alignItems: "center",
        gap: 3,
        fontSize: 10,
        padding: "0 2px",
        borderRight: "1px solid #eee",
        position: "sticky",
        left: 0,
        background: "#fff",
        zIndex: 1,
      }}
    >
      <span
        style={{
          width: 4,
          height: 14,
          borderRadius: 2,
          background: HOME_BG[f.color] ?? "#ccc",
          flex: "0 0 auto",
        }}
      />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {FACTION_SHORT_JA[f.id] ?? f.labelJa}
      </span>
    </div>
  );

  const headerRow = (extra?: React.ReactNode) => (
    <div style={{ display: "flex", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>
      <div
        style={{
          width: HEAD_W,
          minWidth: HEAD_W,
          position: "sticky",
          left: 0,
          background: "#fff",
          borderRight: "1px solid #eee",
          zIndex: 1,
        }}
      />
      {extra}
      {meta.axes.map((a) => (
        <div
          key={a.key}
          style={{
            width: CELL_W,
            minWidth: CELL_W,
            textAlign: "center",
            fontSize: 10,
            fontWeight: 700,
            padding: "3px 0",
            borderBottom: "1px solid #ddd",
          }}
        >
          {a.ja}
        </div>
      ))}
    </div>
  );

  const isSel = (s: Sel, want: Sel) => JSON.stringify(s) === JSON.stringify(want);

  const cellBox = (
    content: React.ReactNode,
    selected: boolean,
    changed: boolean,
    onClick: () => void,
    dim?: boolean,
  ) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: CELL_W,
        minWidth: CELL_W,
        height: 26,
        fontSize: 11,
        fontWeight: changed ? 700 : 400,
        color: dim ? "#aaa" : changed ? "#1a7f37" : "#222",
        background: selected ? "#dfe4ff" : changed ? "#eefaf0" : "#fff",
        border: "1px solid " + (selected ? "#4453ff" : "#eee"),
        padding: 0,
        cursor: "pointer",
      }}
    >
      {content}
    </button>
  );

  // ---- マトリクス ----------------------------------------------------

  const matrixGrid = (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: HEAD_W + meta.axes.length * CELL_W }}>
        {headerRow()}
        {factions.map((f) => (
          <div key={f.id} style={{ display: "flex", height: 26 }}>
            {factionCell(f)}
            {meta.axes.map((a) => {
              const mul = edits.matrix[matrixKey(tableId, lf, f.id, a.key)];
              const want: Sel = { kind: "matrix", faction: f.id, axis: a.key };
              return (
                <React.Fragment key={a.key}>
                  {/* 未指定は「−」。100 と出すと「基準値に揃える」の意味に見えるため。 */}
                  {cellBox(
                    mul === undefined ? "−" : String(mul),
                    isSel(sel, want),
                    mul !== undefined,
                    () => setSel(isSel(sel, want) ? null : want),
                    mul === undefined,
                  )}
                </React.Fragment>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  // ---- タイル --------------------------------------------------------

  const tileGrid = tile ? (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: HEAD_W + 34 + meta.axes.length * CELL_W }}>
        {headerRow(
          <div
            style={{
              width: 34,
              minWidth: 34,
              textAlign: "center",
              fontSize: 9,
              fontWeight: 700,
              padding: "3px 0",
              borderBottom: "1px solid #ddd",
            }}
          >
            基準
          </div>,
        )}
        {factions.map((f) => {
          const base = baseValueOf(meta, edits, lf, tile.id, f.id);
          const baseEdited = edits.base[baseKey(tableId, lf, tile.id, f.id)] !== undefined;
          const baseWant: Sel = { kind: "base", tile: tile.id, faction: f.id };
          return (
            <div key={f.id} style={{ display: "flex", height: 26 }}>
              {factionCell(f)}
              <button
                type="button"
                onClick={() => setSel(isSel(sel, baseWant) ? null : baseWant)}
                style={{
                  width: 34,
                  minWidth: 34,
                  height: 26,
                  fontSize: 11,
                  fontWeight: baseEdited ? 700 : 400,
                  color: baseEdited ? "#1a7f37" : "#666",
                  background: isSel(sel, baseWant) ? "#dfe4ff" : "#fafafa",
                  border: "1px solid " + (isSel(sel, baseWant) ? "#4453ff" : "#eee"),
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                {base}
              </button>
              {meta.axes.map((a) => {
                const now = storedValue(meta, lf, tile.id, a.key, f.id);
                const next = finalValueOf(meta, edits, lf, tile.id, a.key, f.id);
                const want: Sel = { kind: "cell", tile: tile.id, axis: a.key, faction: f.id };
                const overridden =
                  edits.cell[cellKey(tableId, lf, tile.id, a.key, f.id)] !== undefined;
                return (
                  <React.Fragment key={a.key}>
                    {cellBox(
                      <span style={{ textDecoration: overridden ? "underline" : "none" }}>
                        {next}
                      </span>,
                      isSel(sel, want),
                      now !== next,
                      () => setSel(isSel(sel, want) ? null : want),
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  /** 軸の無い表（ブースター他）は「タイル × 種族」を1枚のグリッドで出す。 */
  const flatGrid = (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: HEAD_W + 60 }}>
        {factions.map((f) => {
          const want: Sel = { kind: "base", tile: tile?.id ?? "", faction: f.id };
          const base = tile ? baseValueOf(meta, edits, lf, tile.id, f.id) : 0;
          const now = tile ? storedValue(meta, lf, tile.id, "", f.id) : 0;
          return (
            <div key={f.id} style={{ display: "flex", height: 26 }}>
              {factionCell(f)}
              {cellBox(base, isSel(sel, want), base !== now, () =>
                setSel(isSel(sel, want) ? null : want),
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ---- 下部の操作バー -------------------------------------------------

  const selLabel = (() => {
    if (!sel) return null;
    const fname = (id: FactionId) =>
      factions.find((f) => f.id === id)?.labelJa ?? FACTION_SHORT_JA[id] ?? id;
    if (sel.kind === "matrix") {
      const axis = meta.axes.find((a) => a.key === sel.axis)?.ja ?? sel.axis;
      return `${fname(sel.faction)} × ${axis}（全タイル）`;
    }
    if (sel.kind === "base") return `${fname(sel.faction)} の基準値`;
    const axis = meta.axes.find((a) => a.key === sel.axis)?.ja ?? sel.axis;
    return `${fname(sel.faction)} × ${axis}（このタイルだけ）`;
  })();

  const bar = sel ? (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        background: "#f7f8ff",
        borderTop: "1px solid #ccd",
        padding: "6px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700 }}>{selLabel}</div>

      {sel.kind === "base" ? (
        <BaseInput
          value={baseValueOf(meta, edits, lf, sel.tile, sel.faction)}
          edited={edits.base[baseKey(tableId, lf, sel.tile, sel.faction)] !== undefined}
          onChange={(v) => setBase(sel.tile, sel.faction, v)}
        />
      ) : (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {MULTIPLIERS.map((m) => {
            // 未指定のときはどのボタンも点けない（「触っていない＝いまの列差のまま」と
            // 「100% を指定した＝基準値に揃える」は別なので、100 を既定にはしない）。
            const cur =
              sel.kind === "matrix"
                ? edits.matrix[matrixKey(tableId, lf, sel.faction, sel.axis)]
                : rawMultiplierOf(edits, tableId, lf, sel.tile, sel.axis, sel.faction);
            return (
              <button
                key={m}
                type="button"
                onClick={() =>
                  sel.kind === "matrix"
                    ? setMatrix(sel.faction, sel.axis, m)
                    : setCell(sel.tile, sel.axis, sel.faction, m)
                }
                style={{
                  flex: "1 1 0",
                  minWidth: 52,
                  padding: "8px 0",
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: "1px solid " + (cur === m ? "#4453ff" : "#ccc"),
                  background: cur === m ? "#dfe4ff" : "#fff",
                  cursor: "pointer",
                }}
              >
                {m}%
              </button>
            );
          })}
          {sel.kind === "cell" ? (
            <button
              type="button"
              onClick={() => setCell(sel.tile, sel.axis, sel.faction, null)}
              style={{
                flex: "1 1 0",
                minWidth: 52,
                padding: "8px 0",
                fontSize: 11,
                borderRadius: 6,
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              一括に戻す
            </button>
          ) : null}
        </div>
      )}
    </div>
  ) : null;

  // ---- 画面 -----------------------------------------------------------

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh", fontSize: 13 }}>
      <div
        style={{
          padding: "6px 8px",
          borderBottom: "1px solid #eee",
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Link href="/setup" style={{ fontSize: 12, color: "#2733cc" }}>
          ← Setup
        </Link>
        <strong style={{ fontSize: 13 }}>重み編集</strong>
        <span style={{ fontSize: 11, color: "#666" }}>変更 {diffs.length} セル</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: reviewedCount === tiles.length ? "#1a7f37" : "#666",
          }}
        >
          確認 {reviewedCount}/{tiles.length}
        </span>
      </div>

      <div style={{ padding: "6px 8px", display: "flex", gap: 4, flexWrap: "wrap" }}>
        {WEIGHT_TABLES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTable(t.id)}
            style={{
              padding: "5px 8px",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              border: "1px solid " + (t.id === tableId ? "#4453ff" : "#ccc"),
              background: t.id === tableId ? "#eef0ff" : "#fff",
              cursor: "pointer",
            }}
          >
            {t.ja}
            <span
              style={{
                fontSize: 9,
                marginLeft: 3,
                fontWeight: 400,
                color:
                  progress[t.id].done === progress[t.id].total ? "#1a7f37" : "#999",
              }}
            >
              {progress[t.id].done}/{progress[t.id].total}
            </span>
          </button>
        ))}
      </div>

      <div style={{ padding: "0 8px 6px", display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { v: false, ja: "通常版" },
            { v: true, ja: "拡張版" },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => switchLf(o.v)}
              style={{
                padding: "4px 8px",
                fontSize: 11,
                borderRadius: 6,
                border: "1px solid " + (o.v === lf ? "#4453ff" : "#ccc"),
                background: o.v === lf ? "#eef0ff" : "#fff",
                cursor: "pointer",
              }}
            >
              {o.ja}
            </button>
          ))}
        </div>
        {hasAxis ? (
          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            {[
              { v: "matrix" as Mode, ja: "一括" },
              { v: "tile" as Mode, ja: "タイル" },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => {
                  setMode(o.v);
                  setSel(null);
                }}
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: "1px solid " + (o.v === mode ? "#4453ff" : "#ccc"),
                  background: o.v === mode ? "#eef0ff" : "#fff",
                  cursor: "pointer",
                }}
              >
                {o.ja}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {mode === "tile" || !hasAxis ? (
        <div style={{ padding: "0 8px 6px", display: "flex", gap: 4, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setTileIdx((i) => (i - 1 + tiles.length) % tiles.length)}
            style={navBtn}
          >
            ◀
          </button>
          <select
            value={tile?.id ?? ""}
            onChange={(e) => {
              setTileIdx(tiles.findIndex((t) => t.id === e.target.value));
              setSel(null);
            }}
            style={{ flex: 1, fontSize: 12, padding: "4px 2px", minWidth: 0 }}
          >
            {tiles.map((t) => (
              <option key={t.id} value={t.id}>
                {isReviewed(t.id) ? "✓ " : ""}
                {t.group ? `[${t.group}] ` : ""}
                {t.id} {t.ja}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setTileIdx((i) => (i + 1) % tiles.length)}
            style={navBtn}
          >
            ▶
          </button>
          <button
            type="button"
            onClick={() => tile && toggleReviewed(tile.id)}
            title={tile && isReviewed(tile.id) ? "確認済みを外す" : "確認済みにする"}
            style={{
              ...navBtn,
              fontWeight: 700,
              color: tile && isReviewed(tile.id) ? "#fff" : "#bbb",
              background: tile && isReviewed(tile.id) ? "#1a7f37" : "#fff",
              borderColor: tile && isReviewed(tile.id) ? "#1a7f37" : "#ccc",
            }}
          >
            ✓
          </button>
        </div>
      ) : null}

      {(mode === "tile" || !hasAxis) && tile?.effectJa ? (
        <div
          style={{
            margin: "0 8px 6px",
            padding: "5px 7px",
            fontSize: 11,
            lineHeight: 1.45,
            background: "#fbfbf6",
            border: "1px solid #eee",
            borderRadius: 6,
            color: "#444",
          }}
        >
          {tile.effectJa}
        </div>
      ) : null}

      {mode === "matrix" && hasAxis ? (
        <div style={{ padding: "0 8px 4px", fontSize: 10, color: "#666" }}>
          種族がその列を登れるか。ここで入れた倍率は{meta.ja}の全タイルに効く。
        </div>
      ) : null}

      <div style={{ padding: "0 8px", flex: 1 }}>
        {!hasAxis ? flatGrid : mode === "matrix" ? matrixGrid : tileGrid}
      </div>

      {meta.noteJa ? (
        <div style={{ padding: "6px 8px", fontSize: 10, color: "#888" }}>{meta.noteJa}</div>
      ) : null}

      <div style={{ padding: "6px 8px", display: "flex", gap: 6, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setShowDiff((v) => !v)}
          style={{ ...navBtn, padding: "6px 10px", fontSize: 12 }}
        >
          {showDiff ? "差分を隠す" : "差分を出す"}
        </button>
        <button
          type="button"
          onClick={clearAll}
          style={{ ...navBtn, padding: "6px 10px", fontSize: 12, marginLeft: "auto" }}
        >
          全消去
        </button>
      </div>

      {showDiff ? (
        <div style={{ padding: "0 8px 8px" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(diffText);
              }}
              style={{ ...navBtn, padding: "6px 10px", fontSize: 12 }}
            >
              コピー
            </button>
            <span style={{ fontSize: 11, color: "#666", alignSelf: "center" }}>
              {diffs.length} 行
            </span>
          </div>
          <textarea
            readOnly
            value={diffText}
            onFocus={(e) => e.currentTarget.select()}
            style={{
              width: "100%",
              height: 160,
              fontSize: 11,
              fontFamily: "ui-monospace, monospace",
              boxSizing: "border-box",
            }}
          />
        </div>
      ) : null}

      {bar}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  padding: "4px 9px",
  fontSize: 13,
  borderRadius: 6,
  border: "1px solid #ccc",
  background: "#fff",
  cursor: "pointer",
};

/** 基準値（VP）の直接入力。倍率と違って刻みが決まらないので数値で持つ。 */
function BaseInput({
  value,
  edited,
  onChange,
}: {
  value: number;
  edited: boolean;
  onChange: (v: number | null) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {[-3, -1].map((d) => (
        <button key={d} type="button" onClick={() => onChange(Math.max(0, value + d))} style={navBtn}>
          {d}
        </button>
      ))}
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange(Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
        }}
        style={{ width: 62, fontSize: 14, padding: "5px 4px", textAlign: "center" }}
      />
      {[1, 3].map((d) => (
        <button key={d} type="button" onClick={() => onChange(value + d)} style={navBtn}>
          +{d}
        </button>
      ))}
      {edited ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          style={{ ...navBtn, fontSize: 11, marginLeft: "auto" }}
        >
          戻す
        </button>
      ) : null}
    </div>
  );
}
