// src/app/board/BreakdownTable.tsx
// 種族別内訳表（種別ごとの列）と惑星色の共有定数。page.tsx から抽出（2026-07-23）。
// 2026-10-07（eval_v7）に列を軸ごと（船接触・船星系・ガイア・星系・最外周・外周）から種別ごと
// （母星色・他色・ガイア・次元横断・原始・小惑星）へ変えた。docs/design-notes.md 2.10。
"use client";

import React from "react";
import type { Lang } from "./uiText";
import { FACTIONS } from "@/gaia/eval/factionWeights";

export const PLANET_ORDER = ["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW"] as const;
export type PlanetTypeKey = (typeof PLANET_ORDER)[number];

export const PLANET_LABEL_JA: Record<PlanetTypeKey, string> = {
  BLACK: "黒",
  BLUE: "青",
  BROWN: "茶",
  ORANGE: "橙",
  RED: "赤",
  WHITE: "白",
  YELLOW: "黄",
};

// 色優遇/冷遇の入力欄背景（内訳テーブルの ROW_BG と同じ配色）
export const PLANET_INPUT_BG: Record<PlanetTypeKey, string> = {
  BLACK: "#adadad",
  BLUE: "#cfe8ff",
  BROWN: "#e7d3b1",
  ORANGE: "#ffe0b2",
  RED: "#ffd2d2",
  WHITE: "#ffffff",
  YELLOW: "#fff9c4",
};

/**
 * 基本7色に入らない惑星種別（LFの原始惑星・小惑星）の背景。
 * 内訳表の行・種族評価表の行・色優遇の入力欄で共用する（2026-07-31）。
 *
 * 小惑星はマーカー色 #9c4a8f を薄めた色。原始はマーカー色 #3d8cb5 を薄めると
 * 青（#cfe8ff）と見分けづらかったので、色相を水色側へ振ってある。
 * **マーカーのリング色（RING_COLOR）は変えていない** —— 盤面ではタイル画像と
 * 対応することが大事で、表では他の行と見分けられることが大事、と目的が違う。
 * どちらも黒文字のまま読める明度（コントラスト比 12.4:1 / 8.2:1）。
 */
export const EXTRA_INPUT_BG: Record<string, string> = {
  PROTO: "#7fd4e0",
  ASTEROID: "#c492bc",
};

// --- #9 マーカー連動: 詳細表クリック→地図リング -----------------------------
export type BreakdownMarker = { key: string; color: string; label?: string };
// "rim" は最外周＋外周（評価指数の「欠けマス罰点」の入力欄用。eval_v4）。
// own / other / gaia / transdim / extra は内訳表の種別の列（eval_v7。種族の行の planets から作る）。
export type MarkAxis = "total" | "scout" | "scoutCore" | "outer" | "touch" | "rim" | "own" | "other" | "gaia" | "transdim" | "extra";

// 地図リング用の彩度高めの惑星色（ストロークとして視認できる濃さ）。
//
// PROTO/ASTEROID はタイル画像から採った（2026-07-30）。惑星ディスクの彩度上位20%の
// 平均色相が PROTO=201度（暗い青）／ASTEROID=318度（黒っぽい紫）。そのままだと
// 暗すぎて宇宙背景のストロークとして見えないので、色相は保ったまま明度だけ上げてある。
// PROTO は BLUE と色相が近い（201 vs 211度）が、彩度を落として暗めにすることで
// 区別できる（CIE Lab の色差 34.7。ひと目で別色と分かる水準）。
const RING_COLOR: Record<string, string> = {
  BLACK: "#444444",
  BLUE: "#2b7fe0",
  BROWN: "#9c6b34",
  ORANGE: "#f0951f",
  RED: "#e23b3b",
  WHITE: "#d9d9d9",
  YELLOW: "#e8c400",
  PROTO: "#3d8cb5",
  ASTEROID: "#9c4a8f",
  // ガイア/次元横断も入植先としてマークするので色を持つ。
  // 同じくタイル画像から採色（GAIA 色相102度の緑 / TRANSDIM 色相294度の紫）。
  // TRANSDIM は ASTEROID と色相が近いので明るめの紫にして分けた（色差 34.8）。
  GAIA: "#3fae2a",
  TRANSDIM: "#b25ce0",
};

// 惑星以外（LFの原始惑星・小惑星）の表示名。内訳表の追加行とマーカーのホバーで共用。
export const EXTRA_LABEL_JA: Record<string, string> = {
  PROTO: "原始",
  ASTEROID: "小惑星",
  GAIA: "ガイア",
  TRANSDIM: "次元横断",
};

/** 種別の列（内訳表。eval_v7）。評価 total は列の合計。 */
export const KIND_COLUMNS = ["own", "other", "gaia", "transdim", "extra"] as const;
export type KindColumn = (typeof KIND_COLUMNS)[number];

export const KIND_LABEL: Record<KindColumn, { ja: string; en: string }> = {
  own: { ja: "母星色", en: "home" },
  other: { ja: "他色", en: "other" },
  gaia: { ja: "ガイア", en: "gaia" },
  transdim: { ja: "次元横断", en: "transdim" },
  extra: { ja: "原始・小惑星", en: "proto/asteroid" },
};

// 列ヘッダの ◎（全種族まとめてマーク）を出す列。種別がどの種族から見ても同じもの
// （ガイア・次元横断・原始・小惑星）だけ。母星色・他色は種族で中身が違うので行のセルからマークする。
export const MARKABLE_AXES = new Set<string>(["total", "scout", "scoutCore", "outer", "touch", "gaia", "transdim", "extra"]);

function markerColorLabel(pt: string, lang: Lang): string {
  if (lang !== "ja") return pt;
  return PLANET_LABEL_JA[pt as PlanetTypeKey] ?? EXTRA_LABEL_JA[pt] ?? pt;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * audit から (軸, 色) に対応する地図セルのマーカー群を作る。key は audit の
 * セル座標 "q,r"（extractForEval のグローバル軸座標）。color は惑星色のリング、
 * label はホバー時の帰属テキスト（色 / 軸 / 点数 / 距離）。colorKey=null は全色。
 * 対象は状況の値のヒット（船接触・船星系・最外周・外周）。種別の列は factionKindMarkers。
 */
export function axisMarkers(
  audit: any,
  axis: MarkAxis,
  colorKey: string | null,
  lang: Lang,
  opts?: {
    /**
     * scout/scoutCore のみ: この船だけに絞る（評価指数の船別セル用）。
     * 監査の scoutKey は探査船セルの座標なので、船の識別は scoutId で行う。
     */
    scoutId?: string;
    /** この1セルだけに絞る（原始・小惑星の行の開始地点用、2026-07-31） */
    onlyCellKey?: string;
    /** これらのセルだけに絞る（評価セル＝開始地点の惑星、2026-10-03） */
    onlyCellKeys?: ReadonlySet<string>;
  }
): BreakdownMarker[] {
  if (!audit) return [];
  const out: BreakdownMarker[] = [];
  const push = (key: any, pt: any, extra: string) => {
    const k = String(key ?? "");
    const p = String(pt ?? "");
    if (!k || (colorKey && p !== colorKey)) return;
    if (opts?.onlyCellKey != null && k !== opts.onlyCellKey) return;
    if (opts?.onlyCellKeys && !opts.onlyCellKeys.has(k)) return;
    out.push({ key: k, color: RING_COLOR[p] ?? "#666666", label: `${markerColorLabel(p, lang)}${extra}` });
  };
  const dist = (d: any) => (d ? (lang === "ja" ? ` / 距離${d}` : ` / dist ${d}`) : "");
  // 端の罰点（eval_v4）: ヒットに罰点と欠けマス数が付いていれば添える（例「最外周 −3.5（欠け7）」）
  const rim = (h: any) =>
    typeof h?.value === "number"
      ? ` ${round1(h.value)}` + (typeof h?.missing === "number" ? (lang === "ja" ? `（欠け${h.missing}）` : ` (${h.missing} missing)`) : "")
      : "";
  const doOuter = () =>
    (audit.outerHits ?? []).forEach((h: any) => push(h.cellKey, h.planetType, (lang === "ja" ? " / 最外周" : " / outer") + rim(h)));
  const doTouch = () =>
    (audit.touchHits ?? []).forEach((h: any) => push(h.cellKey, h.planetType, (lang === "ja" ? " / 外周" : " / touch") + rim(h)));
  const byShip = (h: any) => opts?.scoutId == null || String(h.scoutId ?? "") === opts.scoutId;
  const doScout = () =>
    (audit.scout?.scoutHits ?? [])
      .filter(byShip)
      .forEach((h: any) =>
        push(h.planetKey, h.planetType, (lang === "ja" ? ` / 船接触 +${h.value}` : ` / scout +${h.value}`) + dist(h.distance))
      );
  const doScoutCore = () =>
    (audit.scoutCore?.coreHits ?? [])
      .filter(byShip)
      .forEach((h: any) =>
        push(h.corePlanetKey, h.corePlanetType, (lang === "ja" ? ` / 船星系 +${h.value}` : ` / core +${h.value}`) + dist(h.distance))
      );
  if (axis === "outer") doOuter();
  else if (axis === "touch") doTouch();
  else if (axis === "rim") {
    doOuter();
    doTouch();
  } else if (axis === "scout") doScout();
  else if (axis === "scoutCore") doScoutCore();
  else if (axis === "total") {
    doOuter();
    doTouch();
    doScout();
    doScoutCore();
  }
  return out;
}

/**
 * 種族の行の planets（全惑星の到達コスト・重み・値。eval_v7）から、種別 dest の列のマーカーを作る。
 * 到達できる惑星（重み > 0）だけ。ラベルは「種別 / 列 値 × 到達係数 ＝ 寄与（コスト c）」。
 * dest=null は全種別（開始地点も含む）。
 */
export function factionKindMarkers(entry: any, dest: KindColumn | null, lang: Lang): BreakdownMarker[] {
  const planets: any[] = Array.isArray(entry?.planets) ? entry.planets : [];
  const out: BreakdownMarker[] = [];
  for (const p of planets) {
    if (dest && p?.dest !== dest) continue;
    const w = Number(p?.weight) || 0;
    if (w <= 0) continue;
    const k = String(p?.cellKey ?? "");
    if (!k) return [];
    const kind = String(p?.kind ?? "");
    const value = Number(p?.value) || 0;
    const cost = Number(p?.cost);
    const col = p?.dest ? (lang === "ja" ? KIND_LABEL[p.dest as KindColumn]?.ja : KIND_LABEL[p.dest as KindColumn]?.en) ?? String(p.dest) : "";
    const isStart = w === 1 && cost === 0;
    const label =
      lang === "ja"
        ? `${markerColorLabel(kind, lang)} / ${col} ${round2(value)} × ${round2(w)} ＝ ${round2(value * w)}` +
          (isStart ? "（開始地点）" : Number.isFinite(cost) ? `（コスト ${round2(cost)}）` : "")
        : `${kind} / ${col} ${round2(value)} × ${round2(w)} = ${round2(value * w)}` +
          (isStart ? " (start)" : Number.isFinite(cost) ? ` (cost ${round2(cost)})` : "");
    out.push({ key: k, color: RING_COLOR[kind] ?? "#666666", label });
  }
  return out;
}

export function axisGet(axis: any, k: PlanetTypeKey): number {
  const v = axis?.[k];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function fmt0(n: number): string {
  return (Math.round(n * 1000) / 1000).toFixed(0);
}

/** 種族の行の総計ホバー: 固有値と状況の値の内訳（丸める前）。eval_v7 の byFaction にだけある */
function factionBreakdownNote(e: any, lang: Lang): string {
  if (typeof e?.base !== "number") return "";
  const parts: string[] = [];
  const add = (ja: string, en: string, v: number) => {
    if (Math.abs(v) < 0.05) return;
    parts.push(`${lang === "ja" ? ja : en} ${round1(v)}`);
  };
  add("固有値", "base", Number(e.base) || 0);
  add("船接触", "scout", Number(e.scout) || 0);
  add("船星系", "core", Number(e.core) || 0);
  add("最外周", "outer", Number(e.outer) || 0);
  add("外周", "touch", Number(e.touch) || 0);
  return parts.length ? (lang === "ja" ? `内訳（係数・到達係数込み、丸める前）: ` : `Breakdown (with coefficients, unrounded): `) + parts.join(" / ") : "";
}

export function ColorBreakdownTable({
  breakdown,
  cols: colsProp,
  lang,
  isBase,
  onMark,
  activeSources,
}: {
  breakdown: any;
  /** 列の表示 ON/OFF（own / other / gaia / transdim / extra / total / cntOuter / cntTouch）。省略時は全部 */
  cols?: Partial<Record<KindColumn | "total" | "cntOuter" | "cntTouch", boolean>>;
  lang: Lang;
  isBase: boolean;
  /** セル/ヘッダクリック時に呼ぶ。sourceId=`${axis}:${factionId|color|*}`、additive=Ctrl。 */
  onMark?: (sourceId: string, markers: BreakdownMarker[], additive: boolean) => void;
  /** 現在アクティブな sourceId 集合（枠のハイライト用）。 */
  activeSources?: Set<string>;
}) {
  if (!breakdown) return null;

  const audit = breakdown?.audit ?? null;
  const totals = breakdown?.planetTypeTotals ?? null;
  const isActiveSource = (id: string) => !!activeSources && activeSources.has(id);

  const outerCnt = audit?.outerCountByType ?? null;
  const touchCnt = audit?.touchCountByType ?? null;
  const hasCounts = !!outerCnt || !!touchCnt;

  const colsIn = colsProp ?? {};
  const on = (k: string) => (colsIn as any)[k] !== false;
  // 原始・小惑星の列は基本版の盤面には無い（値が全部 0）ので基本版では出さない。
  const cols: Record<string, boolean> = {
    total: on("total"),
    own: on("own"),
    other: on("other"),
    gaia: on("gaia"),
    transdim: on("transdim"),
    extra: on("extra") && !isBase,
    cntOuter: on("cntOuter") && hasCounts && (colsIn as any).cntOuter === true,
    cntTouch: on("cntTouch") && hasCounts && (colsIn as any).cntTouch === true,
  };
  const COL_ORDER = ["total", "own", "other", "gaia", "transdim", "extra", "cntOuter", "cntTouch"] as const;
  const COL_LABEL: Record<string, { ja: string; en: string }> = {
    total: { ja: "評価", en: "total" },
    ...KIND_LABEL,
    cntOuter: { ja: "外周数", en: "outerCnt" },
    cntTouch: { ja: "隣接数", en: "touchCnt" },
  };

  const ring = "#2b7fe0";
  const outlineFor = (join?: "left" | "right") =>
    join === "left"
      ? // 右辺だけ描かない（右隣のセルと地続きに見せる）
        `inset 2px 0 0 0 ${ring}, inset 0 2px 0 0 ${ring}, inset 0 -2px 0 0 ${ring}`
      : join === "right"
        ? `inset -2px 0 0 0 ${ring}, inset 0 2px 0 0 ${ring}, inset 0 -2px 0 0 ${ring}`
        : `inset 0 0 0 2px ${ring}`;
  /**
   * クリックでマークするセルの属性＋アクティブ枠。
   * join="left"/"right" は「行名セル＋評価セル」を1つの範囲として見せるための指定で、
   * 内側の辺だけ枠線を描かない（間に縦線が出ないようにする。2026-07-30 要望）。
   */
  const markCell = (id: string, markers: () => BreakdownMarker[], title: string, join?: "left" | "right"): React.HTMLAttributes<HTMLTableCellElement> => {
    if (!onMark) return {};
    return {
      onClick: (e) => onMark(id, markers(), e.ctrlKey || e.metaKey),
      title,
      style: { cursor: "pointer", boxShadow: isActiveSource(id) ? outlineFor(join) : undefined },
    };
  };

  const ROW_BG: Record<string, string> = {
    BLACK: "#adadad", // black => light gray
    BLUE: "#cfe8ff",
    BROWN: "#e7d3b1",
    ORANGE: "#ffe0b2",
    RED: "#ffd2d2",
    WHITE: "#ffffff",
    YELLOW: "#fff9c4",
    // 追加行の背景はリング色と同じ色相の薄い版に揃える（PROTO 201度 / ASTEROID 310度）
    PROTO: "#cdeffd",
    ASTEROID: "#f2d7ec",
  };

  const thStyle: React.CSSProperties = {
    borderBottom: "1px solid #ddd",
    padding: "6px 8px",
    textAlign: "right",
    fontSize: 12,
    background: "#fafafa",
    position: "sticky",
    top: 0,
    zIndex: 1,
    whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    padding: "6px 8px",
    textAlign: "right",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    whiteSpace: "nowrap",
  };
  const tdLeftStyle: React.CSSProperties = { ...tdStyle, textAlign: "left", fontFamily: "inherit", fontWeight: 700 };
  const rowStyleFor = (key: string): React.CSSProperties => ({ background: ROW_BG[key] ?? "transparent" });

  // --- extremes coloring among basic factions (max=blue, min=red; ties apply to all) ---
  const EPS = 1e-9;
  const computeExtremes = (keys: string[], getValue: (k: string) => number) => {
    let maxV = -Infinity;
    let minV = Infinity;
    for (const k of keys) {
      const v = getValue(k);
      if (!Number.isFinite(v)) continue;
      if (v > maxV) maxV = v;
      if (v < minV) minV = v;
    }
    const maxKeys = new Set<string>();
    const minKeys = new Set<string>();
    for (const k of keys) {
      const v = getValue(k);
      if (!Number.isFinite(v)) continue;
      if (Math.abs(v - maxV) <= EPS) maxKeys.add(k);
      if (Math.abs(v - minV) <= EPS) minKeys.add(k);
    }
    return { maxKeys, minKeys };
  };
  const colorFor = (ex: { maxKeys: Set<string>; minKeys: Set<string> } | undefined, k: string): string | undefined => {
    if (!ex) return undefined;
    if (ex.maxKeys.has(k)) return "#0b5fff"; // blue
    if (ex.minKeys.has(k)) return "#d0021b"; // red
    return undefined;
  };

  /**
   * 種族の行（2026-10-05、eval_v5。eval_v7 から種別ごとの列）。audit.startAccess.byFaction の
   * 種族ごと（基本版 14 / LF 18）の行を評価の降順で出す。同じ色の2種族は性能が違うので色では
   * まとめない（ユーザー確定）。母星色はマーカーのリング色と対応する薄い地色で示すだけ。
   * byKind を持たない古い保存結果（eval_v6 まで）は page.tsx が再評価して渡す。それも無ければ
   * 色ごとの評価だけの行にフォールバックする。
   */
  const byFaction: Record<string, any> | null = audit?.startAccess?.byFaction ?? null;
  const hasKinds = !!byFaction && Object.values(byFaction).some((e: any) => e && typeof e.byKind === "object");
  const factionRows = hasKinds
    ? FACTIONS.filter((f) => byFaction![f.id])
        .map((f) => ({ id: f.id, color: f.color as string, label: lang === "ja" ? f.labelJa : f.labelEn, e: byFaction![f.id] }))
        .sort((a, b) => (Number(b.e.total) || 0) - (Number(a.e.total) || 0))
    : [];
  const basicFactionIds = factionRows.filter((r) => (PLANET_ORDER as readonly string[]).includes(r.color)).map((r) => r.id);
  const fKind = (id: string, k: KindColumn): number => Number(byFaction?.[id]?.byKind?.[k] ?? 0) || 0;
  const fx: Record<string, { maxKeys: Set<string>; minKeys: Set<string> }> = {
    total: computeExtremes(basicFactionIds, (id) => Number(byFaction?.[id]?.total ?? 0) || 0),
  };
  for (const k of KIND_COLUMNS) fx[k] = computeExtremes(basicFactionIds, (id) => fKind(id, k));

  const unified = audit?.startAccess?.unified ?? null;
  const factionNote = (row: { label: string; color: string; e: any }): string => {
    const n = Array.isArray(row.e.starts) ? row.e.starts.length : 0;
    const isExtra = row.color === "PROTO" || row.color === "ASTEROID";
    const base = unified?.base ?? 10;
    const head =
      lang === "ja"
        ? `${row.label}: 盤面の全惑星について 係数（種別）× (固有値 ${base} ＋ 船接触 ＋ 船星系 ＋ 端の罰点) × 到達係数 を合計。` +
          `開始地点は母星${isExtra ? "種別" : "色"}から ${n} ヶ所（到達係数 1）、残りは 0.5^(到達コスト−1)。` +
          `到達コストは種族ごと（開始建物の数・航行・改造・ガイアの初期研究。到着した惑星の入植コスト込み）。`
        : `${row.label}: sum over every planet of coefficient(kind) × (base ${base} + scout + core + rim penalty) × reach factor. ` +
          `${n} starting planet(s) of the home ${isExtra ? "kind" : "colour"} (factor 1), the rest 0.5^(cost−1); ` +
          `reach cost is per faction (starting structures, navigation / terraforming / gaia research, settlement cost on arrival).`;
    const bd = factionBreakdownNote(row.e, lang);
    return bd ? `${head}\n${bd}` : head;
  };

  const kindCellTitle = (k: KindColumn, row: { label: string }): string => {
    const coef = unified?.coef ?? null;
    const c = (key: string) => (coef && typeof coef[key] === "number" ? String(coef[key]) : "?");
    if (lang === "ja") {
      const what =
        k === "own"
          ? `母星色の惑星（係数 ${c("OWN")}）`
          : k === "other"
            ? `他の基本色の惑星（係数 ${c("OTHER")}。改造種族は × ${c("TERRA_BOOST")}。改造の歩数は到達コストに入る）`
            : k === "gaia"
              ? `ガイア惑星（係数 ${c("GAIA")}。入植コスト 1、グリーン人 0.5、LF の3種族 2）`
              : k === "transdim"
                ? `次元横断惑星（係数 ${c("TRANSDIM")}、ガイア種族 ${c("GAIA_FACTION_TRANSDIM")}。入植コスト 2、ガイア Lv1 開始 1、イタル人 1.5）`
                : `原始・小惑星（係数 ${c("EXTRA")}。入植コスト 原始 3 / 小惑星 2）`;
      return `${row.label} の ${what} の寄与の合計。クリックで到達できる惑星を地図にマーク（Ctrlで複数選択）`;
    }
    const what =
      k === "own"
        ? `home-colour planets (coef ${c("OWN")})`
        : k === "other"
          ? `other basic colours (coef ${c("OTHER")}, terraforming factions × ${c("TERRA_BOOST")}; terraform steps go into the reach cost)`
          : k === "gaia"
            ? `gaia planets (coef ${c("GAIA")}; settlement cost 1, Gleens 0.5, three LF factions 2)`
            : k === "transdim"
              ? `transdim planets (coef ${c("TRANSDIM")}, gaia factions ${c("GAIA_FACTION_TRANSDIM")}; settlement cost 2, gaia Lv1 1, Itars 1.5)`
              : `proto / asteroid planets (coef ${c("EXTRA")}; settlement cost 3 / 2)`;
    return `${row.label}: contribution of ${what}. Click to mark the reachable planets (Ctrl = multi-select)`;
  };

  const renderFactionCell = (colKey: (typeof COL_ORDER)[number], row: { id: string; color: string; label: string; e: any }) => {
    if (!cols[colKey]) return null;
    const isExtra = row.color === "PROTO" || row.color === "ASTEROID";
    if (colKey === "total") {
      const starts = new Set<string>((row.e.starts ?? []).map((x: any) => String(x)));
      const m = markCell(
        `total:${row.id}`,
        () => factionKindMarkers(row.e, null, lang).filter((mk) => starts.has(mk.key)),
        lang === "ja" ? "この種族の開始地点を地図にマーク（Ctrlで複数選択）" : "Mark this faction's starting planets (Ctrl = multi-select)",
        "right"
      );
      return (
        <td onClick={m.onClick} title={m.title} style={{ ...tdStyle, fontWeight: 800, color: colorFor(fx.total, row.id), ...m.style }}>
          {Number(row.e.total) || 0}
        </td>
      );
    }
    if (colKey === "cntOuter")
      return <td style={tdStyle}>{isExtra ? Number(audit?.outerCountExtraByKind?.[row.color] ?? 0) : axisGet(outerCnt, row.color as any)}</td>;
    if (colKey === "cntTouch")
      return <td style={tdStyle}>{isExtra ? Number(audit?.touchCountExtraByKind?.[row.color] ?? 0) : axisGet(touchCnt, row.color as any)}</td>;
    const k = colKey as KindColumn;
    const m = markCell(`${k}:${row.id}`, () => factionKindMarkers(row.e, k, lang), kindCellTitle(k, row));
    return (
      <td onClick={m.onClick} title={m.title} style={{ ...tdStyle, color: colorFor(fx[k], row.id), ...m.style }}>
        {fKind(row.id, k)}
      </td>
    );
  };

  // 列ヘッダの ◎: 種別がどの種族から見ても同じ列（ガイア・次元横断・原始・小惑星）は、最初の行の planets から
  // その種別の惑星を全部マークする（到達できるかは種族で違うので、ここでは重みを見ない）。
  const headerMarkers = (ck: string): BreakdownMarker[] => {
    const first = factionRows[0]?.e;
    const planets: any[] = Array.isArray(first?.planets) ? first.planets : [];
    const kinds = ck === "gaia" ? ["GAIA"] : ck === "transdim" ? ["TRANSDIM"] : ck === "extra" ? ["PROTO", "ASTEROID"] : null;
    if (!kinds) return [];
    return planets
      .filter((p) => kinds.includes(String(p?.kind ?? "")))
      .map((p) => ({
        key: String(p.cellKey),
        color: RING_COLOR[String(p.kind)] ?? "#666666",
        label: `${markerColorLabel(String(p.kind), lang)}`,
      }));
  };

  // 評価の列には集計の仕組みをホバーで出す（設計意図を画面でも読めるようにする。2026-10-03、eval_v7 で式を更新）
  const headTip = (ck: string): string | undefined => {
    if (ck !== "total") return undefined;
    const base = unified?.base ?? 10;
    return lang === "ja"
      ? `種族の値 ＝ Σ 盤面の全惑星 係数（種別）× (固有値 ${base} ＋ 船接触 ＋ 船星系 ＋ 端の罰点) × 到達係数。` +
          `係数は 母星色 1 / 他色 0.25（改造種族 × 1.2）/ ガイア 0.5 / 次元横断 0.25（ガイア種族 0.5）/ 原始・小惑星 0.1。` +
          `到達係数は 0.5 の（到達コスト−1）乗で、到達コストは跳躍（距離2=1 / 3=1.5 / 4=2 / 5=3）と、踏み台と到着した惑星の入植の歩数の和` +
          `（改造の輪、ガイア 1、次元横断 2 / ガイア Lv1 開始 1 / イタル人 1.5、原始 3、小惑星 2）。` +
          `開始地点は母星色から 2 ヶ所（ゼノ族 3、ダー・シュワーム人と LF の種族は 1）で、合計が最大になる組を総当たりで選ぶ。` +
          `各列は種別ごとに丸めてあり、評価はその合計。検索の偏り項は色ごとに2種族の大きい方で測る。`
      : `Faction value = sum over every planet of coefficient(kind) × (base ${base} + scout + core + rim penalty) × reach factor. ` +
          `Coefficients: home 1 / other 0.25 (terraforming factions × 1.2) / gaia 0.5 / transdim 0.25 (gaia factions 0.5) / proto・asteroid 0.1. ` +
          `Reach factor 0.5^(cost−1); cost = hop cost by distance (2=1 / 3=1.5 / 4=2 / 5=3) plus settlement steps of stepping stones and of the destination. ` +
          `Starts: 2 home-colour planets (Xenos 3, Ivits and Lost Fleet factions 1), chosen by brute force. ` +
          `Columns are rounded per kind; the balance term uses the larger of the two factions per colour.`;
  };

  // 古い保存結果（byKind 無し）のフォールバック: 色ごとの評価だけ
  const sortedColors = [...PLANET_ORDER].sort((a, b) => axisGet(totals, b) - axisGet(totals, a));
  const exTotal = computeExtremes([...PLANET_ORDER], (k) => axisGet(totals, k as any));

  return (
    <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 8 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: hasCounts && (cols.cntOuter || cols.cntTouch) ? 760 : 620 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: "left" }}>{lang === "ja" ? "種族" : "Faction"}</th>
            {COL_ORDER.map((ck) => {
              if (!cols[ck]) return null;
              const label = lang === "ja" ? COL_LABEL[ck].ja : COL_LABEL[ck].en;
              const axisId = `${ck}:*`;
              const canMark = !!onMark && hasKinds && (ck === "gaia" || ck === "transdim" || ck === "extra");
              return (
                <th key={ck} style={thStyle} title={headTip(ck)}>
                  {label}
                  {canMark ? (
                    <span
                      role="button"
                      title={lang === "ja" ? "この種別の惑星を全部マーク（Ctrlで追加）" : "Mark every planet of this kind (Ctrl = add)"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMark!(axisId, headerMarkers(ck), e.ctrlKey || e.metaKey);
                      }}
                      style={{ cursor: "pointer", marginLeft: 4, fontSize: 12, color: isActiveSource(axisId) ? "#2b7fe0" : "#aaa" }}
                    >
                      ◎
                    </span>
                  ) : null}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {factionRows.map((row) => {
            const starts = new Set<string>((row.e.starts ?? []).map((x: any) => String(x)));
            const m = markCell(
              `total:${row.id}`,
              () => factionKindMarkers(row.e, null, lang).filter((mk) => starts.has(mk.key)),
              lang === "ja" ? "この種族の開始地点を地図にマーク（Ctrlで複数選択）" : "Mark this faction's starting planets (Ctrl = multi-select)",
              "left"
            );
            const title = [factionNote(row), m.title].filter(Boolean).join("\n");
            return (
              <tr key={`F_${row.id}`} style={rowStyleFor(row.color)}>
                <td onClick={m.onClick} title={title || undefined} style={{ ...tdLeftStyle, ...m.style }}>
                  {row.label}
                </td>
                {COL_ORDER.map((ck) => (
                  <React.Fragment key={`F_${row.id}_${ck}`}>{renderFactionCell(ck, row)}</React.Fragment>
                ))}
              </tr>
            );
          })}
          {!hasKinds &&
            sortedColors.map((k) => (
              <tr key={k} style={rowStyleFor(k)}>
                <td style={tdLeftStyle}>{lang === "ja" ? PLANET_LABEL_JA[k] : k}</td>
                {COL_ORDER.map((ck) => {
                  if (!cols[ck]) return null;
                  if (ck === "total")
                    return (
                      <td key={`${k}_${ck}`} style={{ ...tdStyle, fontWeight: 800, color: colorFor(exTotal, k) }}>
                        {axisGet(totals, k)}
                      </td>
                    );
                  if (ck === "cntOuter") return <td key={`${k}_${ck}`} style={tdStyle}>{outerCnt ? axisGet(outerCnt, k) : "-"}</td>;
                  if (ck === "cntTouch") return <td key={`${k}_${ck}`} style={tdStyle}>{touchCnt ? axisGet(touchCnt, k) : "-"}</td>;
                  return <td key={`${k}_${ck}`} style={tdStyle}>-</td>;
                })}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
