// src/app/board/BreakdownTable.tsx
// 色別内訳/詳細表と惑星色の共有定数。page.tsx から抽出（2026-07-23、挙動不変）。
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
// "rim" は最外周＋外周（評価指数の「欠けマス罰点」の入力欄用。eval_v4）
export type MarkAxis = "total" | "scout" | "scoutCore" | "gaia" | "cluster" | "outer" | "touch" | "rim";

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
  // 星系マーカーはクラスタ構成セルすべてを出すので、ガイア/次元横断も色を持つ。
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

// クリック対象にする軸。gaia/cluster も evaluateSoft が座標付きヒットを
// 出すようになったので対象に含める（2026-07-30）。
export const MARKABLE_AXES = new Set<string>([
  "total",
  "scout",
  "scoutCore",
  "gaia",
  "cluster",
  "outer",
  "touch",
]);

function markerColorLabel(pt: string, lang: Lang): string {
  if (lang !== "ja") return pt;
  return PLANET_LABEL_JA[pt as PlanetTypeKey] ?? EXTRA_LABEL_JA[pt] ?? pt;
}

/**
 * audit から (軸, 色) に対応する地図セルのマーカー群を作る。key は audit の
 * セル座標 "q,r"（extractForEval のグローバル軸座標）。color は惑星色のリング、
 * label はホバー時の帰属テキスト（色 / 軸 / 点数 / 距離）。colorKey=null は全色。
 */
export function axisMarkers(
  audit: any,
  axis: MarkAxis,
  colorKey: string | null,
  lang: Lang,
  opts?: {
    /** ガイア軸のみ: この距離のヒットだけに絞る（評価指数のガイア距離1/2/3 用） */
    gaiaDistance?: number;
    /**
     * scout/scoutCore のみ: この船だけに絞る（評価指数の船別セル用）。
     * 監査の scoutKey は探査船セルの座標なので、船の識別は scoutId で行う。
     */
    scoutId?: string;
    /**
     * この1セルだけに絞る（原始・小惑星の追加行用、2026-07-31）。
     * 追加行の値は「最良の1惑星」のものなので、マークもその惑星だけにする
     * —— 全部の原始惑星を光らせると、数字とマークが食い違って見える。
     */
    onlyCellKey?: string;
    /**
     * これらのセルだけに絞る（基本色の評価セル用、2026-10-03）。
     * 評価は「開始地点2ヶ所＋到達加重」なので、評価セルのマークは開始地点の惑星にする。
     */
    onlyCellKeys?: ReadonlySet<string>;
    /**
     * 色が違ってもマークするセル（種族の行用、eval_v6）。種族の値にはガイア・次元横断の惑星が
     * 到達加重で入るので、その種族が到達できるガイア・次元横断は母星色でなくてもマークに含める。
     */
    alsoCellKeys?: ReadonlySet<string>;
  }
): BreakdownMarker[] {
  if (!audit) return [];
  const out: BreakdownMarker[] = [];
  const push = (key: any, pt: any, extra: string) => {
    const k = String(key ?? "");
    const p = String(pt ?? "");
    if (!k || (colorKey && p !== colorKey && !opts?.alsoCellKeys?.has(k))) return;
    if (opts?.onlyCellKey != null && k !== opts.onlyCellKey) return;
    if (opts?.onlyCellKeys && !opts.onlyCellKeys.has(k)) return;
    out.push({ key: k, color: RING_COLOR[p] ?? "#666666", label: `${markerColorLabel(p, lang)}${extra}` });
  };
  const dist = (d: any) => (d ? (lang === "ja" ? ` / 距離${d}` : ` / dist ${d}`) : "");
  // 端の罰点（eval_v4）: ヒットに罰点と欠けマス数が付いていれば添える（例「最外周 −3.5（欠け7）」）
  const rim = (h: any) =>
    typeof h?.value === "number"
      ? ` ${Math.round(h.value * 10) / 10}` + (typeof h?.missing === "number" ? (lang === "ja" ? `（欠け${h.missing}）` : ` (${h.missing} missing)`) : "")
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
  const doGaia = () =>
    (audit.gaiaProximity?.gaiaHits ?? [])
      .filter((h: any) => opts?.gaiaDistance == null || Number(h.distance) === opts.gaiaDistance)
      .forEach((h: any) =>
        push(h.cellKey, h.planetType, (lang === "ja" ? ` / ガイア +${h.value}` : ` / gaia +${h.value}`) + dist(h.distance))
      );
  const doCluster = () =>
    (audit.cluster?.clusterHits ?? []).forEach((h: any) =>
      push(h.cellKey, h.planetType, lang === "ja" ? ` / 星系 ${h.size}個` : ` / cluster of ${h.size}`)
    );
  if (axis === "outer") doOuter();
  else if (axis === "touch") doTouch();
  else if (axis === "rim") {
    doOuter();
    doTouch();
  } else if (axis === "scout") doScout();
  else if (axis === "scoutCore") doScoutCore();
  else if (axis === "gaia") doGaia();
  else if (axis === "cluster") doCluster();
  else {
    doOuter();
    doTouch();
    doScout();
    doScoutCore();
    doGaia();
    doCluster();
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

export function ColorBreakdownTable({
  breakdown,
  cols: colsProp,
  lang,
  isBase,
  onMark,
  activeSources,
}: {
  breakdown: any;
  cols?: any;
  lang: Lang;
  isBase: boolean;
  /** セル/ヘッダクリック時に呼ぶ。sourceId=`${axis}:${color|*}`、additive=Ctrl。 */
  onMark?: (sourceId: string, markers: BreakdownMarker[], additive: boolean) => void;
  /** 現在アクティブな sourceId 集合（枠のハイライト用）。 */
  activeSources?: Set<string>;
}) {
if (!breakdown) return null;

const audit = breakdown?.audit ?? null;
const isActiveSource = (id: string) => !!activeSources && activeSources.has(id);
/**
 * (色, 軸) セル用のクリック属性＋アクティブ枠。
 * join="left"/"right" は「色名セル＋評価セル」を1つの範囲として見せるための指定で、
 * 内側の辺だけ枠線を描かない（間に縦線が出ないようにする。2026-07-30 要望）。
 */
/**
 * 基本色の開始地点（評価セルのマーク用）。「開始地点＋到達加重」の集計を持たない
 * 古い保存結果では undefined ＝ 従来どおり色の全惑星をマークする。
 */
const startKeysOf = (k: string): ReadonlySet<string> | undefined => {
  const s = audit?.startAccess?.byColor?.[k]?.starts;
  return Array.isArray(s) && s.length > 0 ? new Set(s.map((x: any) => String(x))) : undefined;
};
const cellMark = (
  axis: MarkAxis,
  k: string,
  join?: "left" | "right",
  /** 原始・小惑星の追加行だけ: 開始地点の1惑星に絞る（2026-07-31） */
  onlyCellKey?: string,
  /** 基本色の評価セルだけ: 開始地点の惑星に絞る（2026-10-03） */
  onlyCellKeys?: ReadonlySet<string>,
  /** マーカーを絞る色（省略時は k）。種族の行では k＝種族ID、色＝母星色（2026-10-05） */
  colorKey: string = k,
  /** 種族の行だけ: 母星色でなくてもマークするセル（到達できるガイア・次元横断。eval_v6） */
  alsoCellKeys?: ReadonlySet<string>
): React.HTMLAttributes<HTMLTableCellElement> => {
  if (!onMark) return {};
  const id = `${axis}:${k}`;
  const ring = "#2b7fe0";
  const outline =
    join === "left"
      ? // 右辺だけ描かない（右隣のセルと地続きに見せる）
        `inset 2px 0 0 0 ${ring}, inset 0 2px 0 0 ${ring}, inset 0 -2px 0 0 ${ring}`
      : join === "right"
        ? `inset -2px 0 0 0 ${ring}, inset 0 2px 0 0 ${ring}, inset 0 -2px 0 0 ${ring}`
        : `inset 0 0 0 2px ${ring}`;
  return {
    onClick: (e) =>
      onMark(
        id,
        axisMarkers(
          audit,
          axis,
          colorKey,
          lang,
          onlyCellKey || onlyCellKeys || alsoCellKeys
            ? {
                ...(onlyCellKey ? { onlyCellKey } : {}),
                ...(onlyCellKeys ? { onlyCellKeys } : {}),
                ...(alsoCellKeys && alsoCellKeys.size > 0 ? { alsoCellKeys } : {}),
              }
            : undefined
        ),
        e.ctrlKey || e.metaKey
      ),
    title: onlyCellKeys
      ? lang === "ja"
        ? "この色の開始地点を地図にマーク（Ctrlで複数選択）"
        : "Mark this colour's starting planets (Ctrl = multi-select)"
      : lang === "ja"
        ? "地図にマーク（Ctrlで複数選択）"
        : "Mark on map (Ctrl = multi-select)",
    style: {
      cursor: "pointer",
      boxShadow: isActiveSource(id) ? outline : undefined,
    },
  };
};

const outer = breakdown?.axesByType?.outer ?? null;
const touch = breakdown?.axesByType?.touch ?? null;
const scout = breakdown?.axesByType?.scout ?? null;
const scoutCore = breakdown?.axesByType?.scoutCore ?? null;
const gaia = breakdown?.axesByType?.gaia ?? null;
const cluster = breakdown?.axesByType?.cluster ?? null;
const totals = breakdown?.planetTypeTotals ?? null;

const outerCnt = breakdown?.audit?.outerCountByType ?? null;
const touchCnt = breakdown?.audit?.touchCountByType ?? null;

const hasCounts = !!outerCnt || !!touchCnt;

const colsIn = colsProp ?? {
  // NOTE: column order is controlled below. These booleans only control visibility.
  total: true,
  scout: true,
  scoutCore: true,
  gaia: true,
  cluster: true,
  outer: true,
  touch: true,
  cntOuter: hasCounts,
  cntTouch: hasCounts,
};

// 出し分け: base では scout/scoutCore を出さない。新軸（gaia/cluster）は
// base・LF ともデータがある場合のみ表示（LF はガイア近接・星系を有効化した
// ときだけ breakdown に軸が入るので、データ有無で自動的に出し分く。2026-07-24）。
const cols = {
  ...colsIn,
  ...(isBase ? { scout: false, scoutCore: false } : {}),
  gaia: !!gaia && (colsIn as any).gaia !== false,
  cluster: !!cluster && (colsIn as any).cluster !== false,
};

// --- order: total -> scout -> scoutCore -> gaia -> cluster -> outer -> touch (counts at the end) ---
const COL_ORDER: Array<keyof typeof cols> = ["total", "scout", "scoutCore", "gaia", "cluster", "outer", "touch", "cntOuter", "cntTouch"];

const COL_LABEL: Record<string, { ja: string; en: string }> = {
  total: { ja: "評価", en: "total" },
  scout: { ja: "船接触", en: "scout" },
  scoutCore: { ja: "船星系", en: "scoutCore" },
  gaia: { ja: "ガイア", en: "gaia" },
  cluster: { ja: "星系", en: "cluster" },
  outer: { ja: "最外周", en: "outer" },
  // 「辺境」→「外周」（用語を uiText の touchCnt と統一、⑤ 2026-07-24）
  touch: { ja: "外周", en: "touch" },
  cntOuter: { ja: "外周数", en: "outerCnt" },
  cntTouch: { ja: "隣接数", en: "touchCnt" },
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

const tdLeftStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "left",
  fontFamily: "inherit",
  fontWeight: 700,
};

const rowStyleFor = (key: string): React.CSSProperties => ({
  background: ROW_BG[key] ?? "transparent",
});

// --- extremes coloring among base 7 (max=blue, min=red; ties apply to all) ---
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

const baseKeysForExtreme = [...PLANET_ORDER]; // fixed base-7
const exTotal = computeExtremes(baseKeysForExtreme, (k) => axisGet(totals, k as any));
const exScout = computeExtremes(baseKeysForExtreme, (k) => axisGet(scout, k as any));
const exScoutCore = computeExtremes(baseKeysForExtreme, (k) => axisGet(scoutCore, k as any));
const exGaia = computeExtremes(baseKeysForExtreme, (k) => axisGet(gaia, k as any));
const exCluster = computeExtremes(baseKeysForExtreme, (k) => axisGet(cluster, k as any));
// outer/touch are colored by (outer + touch) combined, applied to both columns
const exOuterTouch = computeExtremes(baseKeysForExtreme, (k) => axisGet(outer, k as any) + axisGet(touch, k as any));

const colorFor = (maxKeys: Set<string>, minKeys: Set<string>, k: string): string | undefined => {
if (maxKeys.has(k)) return "#0b5fff"; // blue
if (minKeys.has(k)) return "#d0021b"; // red
return undefined;
};

// sort base 7 colors by total desc (PROTO/ASTEROID stay at the end)
const sortedKeys = [...PLANET_ORDER].sort((a, b) => axisGet(totals, b) - axisGet(totals, a));

/**
 * 種族の行（2026-10-05、eval_v5）。audit.startAccess.byFaction があれば、7色の行の代わりに
 * 種族ごと（基本版 14 / LF 18）の行を評価の降順で出す。同じ色の2種族は性能が違うので色では
 * まとめない（ユーザー確定）。母星色はマーカーのリング色と対応する薄い地色で示すだけ。
 * 古い保存結果（byFaction が無い）は従来どおり色の行＋原始・小惑星の行。
 */
const byFaction: Record<string, any> | null = audit?.startAccess?.byFaction ?? null;
const factionRows = byFaction
  ? FACTIONS.filter((f) => byFaction[f.id])
      .map((f) => ({ id: f.id, color: f.color, label: lang === "ja" ? f.labelJa : f.labelEn, e: byFaction[f.id] }))
      .sort((a, b) => (Number(b.e.total) || 0) - (Number(a.e.total) || 0))
  : [];
const basicFactionIds = factionRows.filter((r) => (PLANET_ORDER as readonly string[]).includes(r.color)).map((r) => r.id);
const fAxis = (id: string, ax: string): number => Number(byFaction?.[id]?.[ax] ?? 0) || 0;
const fx = {
  total: computeExtremes(basicFactionIds, (id) => fAxis(id, "total")),
  scout: computeExtremes(basicFactionIds, (id) => fAxis(id, "scout")),
  scoutCore: computeExtremes(basicFactionIds, (id) => fAxis(id, "core")),
  gaia: computeExtremes(basicFactionIds, (id) => fAxis(id, "gaia")),
  cluster: computeExtremes(basicFactionIds, (id) => fAxis(id, "cluster")),
  rim: computeExtremes(basicFactionIds, (id) => fAxis(id, "outer") + fAxis(id, "touch")),
};
const factionNote = (row: { label: string; color: string; e: any }): string => {
  const n = Array.isArray(row.e.starts) ? row.e.starts.length : 0;
  const isExtra = row.color === "PROTO" || row.color === "ASTEROID";
  return lang === "ja"
    ? `${row.label}: 開始地点 ${n} ヶ所の値 ＋ 残りの同${isExtra ? "種別" : "色"}の惑星とガイア・次元横断の惑星の値 × 到達係数。` +
        `到達コストは種族ごと（開始建物の数・航行・改造・ガイアの初期研究。到着した惑星の入植コスト込み）。` +
        (isExtra ? `原始・小惑星は LF の種族ごとに開始1ヶ所。` : ``)
    : `${row.label}: value of the ${n} starting planet(s) + remaining same-${isExtra ? "kind" : "colour"} planets and gaia / transdim planets weighted by reachability ` +
        `(reach cost is per faction: starting structures, navigation / terraforming / gaia research, settlement cost on arrival).`;
};
/** その種族が到達できるガイア・次元横断のセル（軸のセルのマークに含める。eval_v6） */
const reachableExtrasOf = (e: any): ReadonlySet<string> =>
  new Set<string>(
    (Array.isArray(e?.planets) ? e.planets : [])
      .filter((p: any) => (p?.kind === "GAIA" || p?.kind === "TRANSDIM") && Number(p?.weight) > 0)
      .map((p: any) => String(p.cellKey))
  );
const renderFactionCell = (colKey: keyof typeof cols, row: { id: string; color: string; e: any }) => {
  if (!cols[colKey]) return null;
  const starts = new Set<string>((row.e.starts ?? []).map((x: any) => String(x)));
  const isExtra = row.color === "PROTO" || row.color === "ASTEROID";
  const extras = reachableExtrasOf(row.e);
  const cell = (axis: MarkAxis, v: number, ex?: { maxKeys: Set<string>; minKeys: Set<string> }, bold?: boolean, join?: "left" | "right", only?: ReadonlySet<string>) => {
    // 評価セル（only＝開始地点）はガイア・次元横断を含めない。軸のセルは到達できるガイア・次元横断も光らせる
    const m = cellMark(axis, row.id, join, undefined, only, row.color, only ? undefined : extras);
    return (
      <td onClick={m.onClick} title={m.title} style={{ ...tdStyle, ...(bold ? { fontWeight: 800 } : {}), color: ex ? colorFor(ex.maxKeys, ex.minKeys, row.id) : undefined, ...m.style }}>
        {v}
      </td>
    );
  };
  if (colKey === "total") return cell("total", fAxis(row.id, "total"), fx.total, true, "right", starts);
  if (colKey === "scout") return cell("scout", fAxis(row.id, "scout"), fx.scout);
  if (colKey === "scoutCore") return cell("scoutCore", fAxis(row.id, "core"), fx.scoutCore);
  if (colKey === "gaia") return cell("gaia", fAxis(row.id, "gaia"), fx.gaia);
  if (colKey === "cluster") return cell("cluster", fAxis(row.id, "cluster"), fx.cluster);
  if (colKey === "outer") return cell("outer", fAxis(row.id, "outer"), fx.rim);
  if (colKey === "touch") return cell("touch", fAxis(row.id, "touch"), fx.rim);
  if (colKey === "cntOuter")
    return hasCounts ? <td style={tdStyle}>{isExtra ? Number(audit?.outerCountExtraByKind?.[row.color] ?? 0) : axisGet(outerCnt, row.color as any)}</td> : null;
  if (colKey === "cntTouch")
    return hasCounts ? <td style={tdStyle}>{isExtra ? Number(audit?.touchCountExtraByKind?.[row.color] ?? 0) : axisGet(touchCnt, row.color as any)}</td> : null;
  return null;
};

const renderCell = (colKey: keyof typeof cols, k: string) => {
  if (!cols[colKey]) return null;

  if (colKey === "total") {
    const m = cellMark("total", k, "right", undefined, startKeysOf(k));
    return <td onClick={m.onClick} title={m.title} style={{ ...tdStyle, fontWeight: 800, color: colorFor(exTotal.maxKeys, exTotal.minKeys, k), ...m.style }}>{axisGet(totals, k as any)}</td>;
  }
  if (colKey === "scout") {
    const m = cellMark("scout", k);
    return <td onClick={m.onClick} title={m.title} style={{ ...tdStyle, color: colorFor(exScout.maxKeys, exScout.minKeys, k), ...m.style }}>{axisGet(scout, k as any)}</td>;
  }
  if (colKey === "scoutCore") {
    const m = cellMark("scoutCore", k);
    return <td onClick={m.onClick} title={m.title} style={{ ...tdStyle, color: colorFor(exScoutCore.maxKeys, exScoutCore.minKeys, k), ...m.style }}>{axisGet(scoutCore, k as any)}</td>;
  }
  if (colKey === "gaia") {
    const m = cellMark("gaia", k);
    return <td onClick={m.onClick} title={m.title} style={{ ...tdStyle, color: colorFor(exGaia.maxKeys, exGaia.minKeys, k), ...m.style }}>{axisGet(gaia, k as any)}</td>;
  }
  if (colKey === "cluster") {
    const m = cellMark("cluster", k);
    return <td onClick={m.onClick} title={m.title} style={{ ...tdStyle, color: colorFor(exCluster.maxKeys, exCluster.minKeys, k), ...m.style }}>{axisGet(cluster, k as any)}</td>;
  }
  if (colKey === "outer") {
    const m = cellMark("outer", k);
    return <td onClick={m.onClick} title={m.title} style={{ ...tdStyle, color: colorFor(exOuterTouch.maxKeys, exOuterTouch.minKeys, k), ...m.style }}>{axisGet(outer, k as any)}</td>;
  }
  if (colKey === "touch") {
    const m = cellMark("touch", k);
    return <td onClick={m.onClick} title={m.title} style={{ ...tdStyle, color: colorFor(exOuterTouch.maxKeys, exOuterTouch.minKeys, k), ...m.style }}>{axisGet(touch, k as any)}</td>;
  }
  if (colKey === "cntOuter") {
    return <td style={tdStyle}>{outerCnt ? axisGet(outerCnt, k as any) : "-"}</td>;
  }
  if (colKey === "cntTouch") {
    return <td style={tdStyle}>{touchCnt ? axisGet(touchCnt, k as any) : "-"}</td>;
  }
  return null;
};

return (
  <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 8 }}>
    <table style={{ borderCollapse: "collapse", width: "100%", minWidth: hasCounts ? 760 : 620 }}>
      <thead>
        <tr>
          <th style={{ ...thStyle, textAlign: "left" }}>{lang === "ja" ? "色" : "Color"}</th>
          {COL_ORDER.map((ck) => {
            if (!cols[ck]) return null;
            // counts only appear if hasCounts is true
            if ((ck === "cntOuter" || ck === "cntTouch") && !hasCounts) return null;
            const label = lang === "ja" ? COL_LABEL[String(ck)].ja : COL_LABEL[String(ck)].en;
            const axisId = `${String(ck)}:*`;
            const canMark = !!onMark && MARKABLE_AXES.has(String(ck));
            // 評価の列には集計の仕組みをホバーで出す（設計意図を画面でも読めるようにする。2026-10-03）
            const headTip =
              String(ck) === "total"
                ? lang === "ja"
                  ? "種族の値 ＝ 開始地点の値 ＋ 残りの同色惑星とガイア・次元横断の惑星の値 × 到達係数（開始地点は母星色から 2 ヶ所。ゼノ族 3、ダー・シュワーム人と LF の種族は 1）。" +
                    "到達係数は 0.5 の（到達コスト−1）乗で、到達コストは跳躍（距離2=1 / 3=1.5 / 4=2 / 5=3）と、踏み台と到着した惑星の入植の歩数の和" +
                    "（ガイア 1、次元横断 2。ガイア Lv1 開始は 1、イタル人 1.5）。" +
                    "種族の性質（航行・改造・ガイアの初期研究）で跳躍と入植の一部が変わる。開始地点は合計が最大になる組を総当たりで選ぶ。" +
                    "各列は同じ重みで足して軸ごとに丸めてある。検索の偏り項は色ごとに2種族の大きい方で測る。"
                  : "Faction value = starting planets + the remaining same-colour planets and gaia / transdim planets weighted by reachability " +
                    "(0.5^(cost−1); cost = hop cost by distance 2=1 / 3=1.5 / 4=2 / 5=3 plus settlement steps of stepping stones and of the destination: " +
                    "gaia 1, transdim 2 (1 with gaia research Lv1, Itars 1.5); some hops/steps differ per faction). " +
                    "Starts: 2 home-colour planets (Xenos 3, Ivits and Lost Fleet factions 1), chosen by brute force. " +
                    "The search balance term uses the larger of the two factions per colour."
                : undefined;
            return (
              <th key={String(ck)} style={thStyle} title={headTip}>
                {label}
                {canMark ? (
                  <span
                    role="button"
                    title={lang === "ja" ? "この軸を全色まとめてマーク（Ctrlで追加）" : "Mark this whole axis (Ctrl = add)"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMark!(axisId, axisMarkers(audit, ck as MarkAxis, null, lang), e.ctrlKey || e.metaKey);
                    }}
                    style={{
                      cursor: "pointer",
                      marginLeft: 4,
                      fontSize: 12,
                      color: isActiveSource(axisId) ? "#2b7fe0" : "#aaa",
                    }}
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
          const m = cellMark("total", row.id, "left", undefined, new Set<string>((row.e.starts ?? []).map((x: any) => String(x))), row.color);
          const title = [factionNote(row), m.title].filter(Boolean).join("\n");
          return (
            <tr key={`F_${row.id}`} style={rowStyleFor(row.color)}>
              <td onClick={m.onClick} title={title || undefined} style={{ ...tdLeftStyle, ...m.style }}>
                {row.label}
              </td>
              {COL_ORDER.map((ck) => (
                <React.Fragment key={`F_${row.id}_${String(ck)}`}>{renderFactionCell(ck, row)}</React.Fragment>
              ))}
            </tr>
          );
        })}
        {!byFaction && sortedKeys.map((k) => {
          const colorLabel = lang === "ja" ? `${PLANET_LABEL_JA[k]}` : k;

          return (
            <tr key={k} style={rowStyleFor(k)}>
              {/* 色名も「評価」セルと同じクリック範囲にする（色名〜評価値までを
                  ひとつの当たり判定として扱う。2026-07-30 要望）。 */}
              {(() => {
                const m = cellMark("total", k, "left", undefined, startKeysOf(k));
                return (
                  <td onClick={m.onClick} title={m.title} style={{ ...tdLeftStyle, ...m.style }}>
                    {colorLabel}
                  </td>
                );
              })()}
              {COL_ORDER.map((ck) => (
                <React.Fragment key={`${k}_${String(ck)}`}>{renderCell(ck, k)}</React.Fragment>
              ))}
            </tr>
          );
        })}

        {/* Extras (PROTO/ASTEROID): keep at the end, and follow the same column toggles.
            軸（planetTypeTotals）には入らない表示専用の行だが、値の意味と
            マーカーのクリックは基本7色の行とまったく同じにしてある（2026-07-30）。
            eval_v5 からは種族の行（上）に含まれるので、byFaction が無い古い結果だけ出す。 */}
        {!byFaction && (() => {
          const a = breakdown?.audit ?? null;
          const ex = (o: any, k: string) => Number(o?.[k] ?? 0) || 0;
          const kinds = ["PROTO", "ASTEROID"] as const;

          const sources = [
            a?.scout?.extraByKind,
            a?.scoutCore?.extraByKind,
            a?.gaiaProximity?.extraByKind,
            a?.cluster?.extraByKind,
          ];
          const hasAny = kinds.some((k) => sources.some((s) => ex(s, k) !== 0));
          if (!hasAny) return null;

          return kinds.map((k) => {
            /**
             * 「開始地点1ヶ所＋到達加重」（2026-10-03。LF4種族は開始建物が1つ）。行の値は
             * その種別を母星にする2種族のうち大きい方で、係数は掛けない。
             * 2026-07-31〜10-02 は「最良の1惑星 × 2.75」（extraBest）だった。どちらも持たない
             * 古い保存結果は従来の合算にフォールバックする（page.tsx の displayBreakdown が
             * 再評価すれば新しい値になる）。
             */
            const best = a?.extraStart?.[k] ?? a?.extraBest?.[k] ?? null;
            const vScout = best ? Number(best.scout) || 0 : ex(a?.scout?.extraByKind, k);
            const vCore = best ? Number(best.core) || 0 : ex(a?.scoutCore?.extraByKind, k);
            const vGaia = best ? Number(best.gaia) || 0 : ex(a?.gaiaProximity?.extraByKind, k);
            const vCluster = best ? Number(best.cluster) || 0 : ex(a?.cluster?.extraByKind, k);
            // 最外周/外周（端の罰点）は eval_v4 から原始・小惑星にも掛かる（extraStart に outer/touch が
            // 入る）。eval_v3 までの保存結果（outer/touch が無い）は従来どおり評価に入れず「-」。
            const hasRim = !!best && typeof best.outer === "number";
            const vOuter = hasRim ? Number(best.outer) || 0 : 0;
            const vTouch = hasRim ? Number(best.touch) || 0 : 0;
            const vTotal = vScout + vCore + vGaia + vCluster + vOuter + vTouch;

            const label = lang === "ja" ? EXTRA_LABEL_JA[k] : k;

            // 基本7色の行と同じクリック挙動（sourceId も同形式 `${axis}:${kind}`）。
            // ただし値が最良の1惑星のものなので、マークもその惑星だけに絞る。
            const onlyCell = best ? String(best.cellKey ?? "") || undefined : undefined;
            const markExtra = (axis: MarkAxis, join?: "left" | "right") =>
              cellMark(axis, k, join, onlyCell);

            const cellForExtra = (colKey: keyof typeof cols) => {
              if (!cols[colKey]) return null;
              const val = (axis: MarkAxis, v: number, bold?: boolean, join?: "left" | "right") => {
                const m = markExtra(axis, join);
                return (
                  <td
                    onClick={m.onClick}
                    title={m.title}
                    style={{ ...tdStyle, ...(bold ? { fontWeight: 800 } : {}), ...m.style }}
                  >
                    {v}
                  </td>
                );
              };
              if (colKey === "total") return val("total", vTotal, true, "right");
              if (colKey === "scout") return val("scout", vScout);
              if (colKey === "scoutCore") return val("scoutCore", vCore);
              if (colKey === "gaia") return val("gaia", vGaia);
              if (colKey === "cluster") return val("cluster", vCluster);
              // 最外周/外周: eval_v4 からは開始地点の惑星の罰点（マークもその惑星）。古い結果は「-」
              if (colKey === "outer") return hasRim ? val("outer", vOuter) : <td style={tdStyle}>-</td>;
              if (colKey === "touch") return hasRim ? val("touch", vTouch) : <td style={tdStyle}>-</td>;
              if (colKey === "cntOuter")
                return hasCounts ? <td style={tdStyle}>{hasRim ? ex(a?.outerCountExtraByKind, k) : "-"}</td> : null;
              if (colKey === "cntTouch")
                return hasCounts ? <td style={tdStyle}>{hasRim ? ex(a?.touchCountExtraByKind, k) : "-"}</td> : null;
              return null;
            };

            // 行の値が「開始地点1ヶ所ぶん＋到達加重」であることは数字だけでは分からないので、
            // 行名にホバーで出す（2026-07-31 要望、2026-10-03 に集計の変更へ追随）。
            // 古い保存結果（extraBest。補正値あり）は当時の説明を出す。
            const factionLabel = (id: string) =>
              lang === "ja"
                ? ({ moweyds: "モウェイド人", spaceGiants: "スペースジャイアント", tinkerroids: "ティンカーロイド", darkanians: "ダルカニア人" } as Record<string, string>)[id] ?? id
                : id;
            const bestNote = best
              ? typeof best.factor === "number"
                ? lang === "ja"
                  ? `${label}は最高スコアの惑星1つだけを表示しています` +
                    `（船接触＋船星系＋ガイア＋星系の合計が最大のもの。補正値×${best.factor}）。` +
                    `\n最外周・外周は評価に使いません。`
                  : `Shows only the single best ${k} planet (highest scout+core+gaia+cluster total, ` +
                    `scaled by ${best.factor}). Outer/touch are not counted.`
                : lang === "ja"
                  ? `${label}は「開始地点1ヶ所の値 ＋ 残りの同じ種別の惑星の値 × 到達係数」です` +
                    `（LF の種族は開始建物が1つ。係数は掛けません）。` +
                    (best.factionId ? `\n値は ${factionLabel(String(best.factionId))} の視点（この種別を母星にする2種族のうち大きい方）。` : "") +
                    (hasRim ? `\n最外周・外周（欠けマス罰点）も基本色と同じように引きます。` : `\n最外周・外周は評価に使いません。`)
                  : `${k}: the single starting planet plus the remaining ${k} planets weighted by reachability ` +
                    `(Lost Fleet factions start with one structure; no scaling factor).` +
                    (best.factionId ? ` Shown for ${String(best.factionId)} (the stronger of the two factions).` : "") +
                    (hasRim ? ` Outer/touch (rim gap penalty) are counted like the basic colours.` : ` Outer/touch are not counted.`)
              : "";

            return (
              <tr key={`EXTRA_${k}`} style={rowStyleFor(k)}>
                {(() => {
                  const m = markExtra("total", "left");
                  const title = [bestNote, m.title].filter(Boolean).join("\n");
                  return (
                    <td onClick={m.onClick} title={title || undefined} style={{ ...tdLeftStyle, ...m.style }}>
                      {label}
                    </td>
                  );
                })()}
                {COL_ORDER.map((ck) => (
                  <React.Fragment key={`EXTRA_${k}_${String(ck)}`}>{cellForExtra(ck)}</React.Fragment>
                ))}
              </tr>
            );
          });
        })()}
      </tbody>
    </table>
  </div>
);
}
