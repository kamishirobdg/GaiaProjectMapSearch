// src/app/board/BreakdownTable.tsx
// 色別内訳/詳細表と惑星色の共有定数。page.tsx から抽出（2026-07-23、挙動不変）。
"use client";

import React from "react";
import type { Lang } from "./uiText";

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

// --- #9 マーカー連動: 詳細表クリック→地図リング -----------------------------
export type BreakdownMarker = { key: string; color: string; label?: string };
export type MarkAxis = "total" | "scout" | "scoutCore" | "outer" | "touch";

// 地図リング用の彩度高めの惑星色（ストロークとして視認できる濃さ）。
const RING_COLOR: Record<string, string> = {
  BLACK: "#444444",
  BLUE: "#2b7fe0",
  BROWN: "#9c6b34",
  ORANGE: "#f0951f",
  RED: "#e23b3b",
  WHITE: "#d9d9d9",
  YELLOW: "#e8c400",
};

// クリック対象にする軸（gaia/cluster は座標付きヒットが audit に無いので除外）。
export const MARKABLE_AXES = new Set<string>(["total", "scout", "scoutCore", "outer", "touch"]);

function markerColorLabel(pt: string, lang: Lang): string {
  return lang === "ja" ? (PLANET_LABEL_JA[pt as PlanetTypeKey] ?? pt) : pt;
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
  lang: Lang
): BreakdownMarker[] {
  if (!audit) return [];
  const out: BreakdownMarker[] = [];
  const push = (key: any, pt: any, extra: string) => {
    const k = String(key ?? "");
    const p = String(pt ?? "");
    if (!k || (colorKey && p !== colorKey)) return;
    out.push({ key: k, color: RING_COLOR[p] ?? "#666666", label: `${markerColorLabel(p, lang)}${extra}` });
  };
  const dist = (d: any) => (d ? (lang === "ja" ? ` / 距離${d}` : ` / dist ${d}`) : "");
  const doOuter = () =>
    (audit.outerHits ?? []).forEach((h: any) => push(h.cellKey, h.planetType, lang === "ja" ? " / 最外周" : " / outer"));
  const doTouch = () =>
    (audit.touchHits ?? []).forEach((h: any) => push(h.cellKey, h.planetType, lang === "ja" ? " / 外周" : " / touch"));
  const doScout = () =>
    (audit.scout?.scoutHits ?? []).forEach((h: any) =>
      push(h.planetKey, h.planetType, (lang === "ja" ? ` / 船接触 +${h.value}` : ` / scout +${h.value}`) + dist(h.distance))
    );
  const doScoutCore = () =>
    (audit.scoutCore?.coreHits ?? []).forEach((h: any) =>
      push(h.corePlanetKey, h.corePlanetType, (lang === "ja" ? ` / 船星系 +${h.value}` : ` / core +${h.value}`) + dist(h.distance))
    );
  if (axis === "outer") doOuter();
  else if (axis === "touch") doTouch();
  else if (axis === "scout") doScout();
  else if (axis === "scoutCore") doScoutCore();
  else {
    doOuter();
    doTouch();
    doScout();
    doScoutCore();
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
// (色, 軸) セル用のクリック属性＋アクティブ枠。
const cellMark = (axis: MarkAxis, k: string): React.HTMLAttributes<HTMLTableCellElement> => {
  if (!onMark) return {};
  const id = `${axis}:${k}`;
  return {
    onClick: (e) => onMark(id, axisMarkers(audit, axis, k, lang), e.ctrlKey || e.metaKey),
    title: lang === "ja" ? "地図にマーク（Ctrlで複数選択）" : "Mark on map (Ctrl = multi-select)",
    style: {
      cursor: "pointer",
      boxShadow: isActiveSource(id) ? "inset 0 0 0 2px #2b7fe0" : undefined,
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
  PROTO: "#cdeffd",
  ASTEROID: "#e6d1ff",
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

const renderCell = (colKey: keyof typeof cols, k: string) => {
  if (!cols[colKey]) return null;

  if (colKey === "total") {
    const m = cellMark("total", k);
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
    return <td style={{ ...tdStyle, color: colorFor(exGaia.maxKeys, exGaia.minKeys, k) }}>{axisGet(gaia, k as any)}</td>;
  }
  if (colKey === "cluster") {
    return <td style={{ ...tdStyle, color: colorFor(exCluster.maxKeys, exCluster.minKeys, k) }}>{axisGet(cluster, k as any)}</td>;
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
            return (
              <th key={String(ck)} style={thStyle}>
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
        {sortedKeys.map((k) => {
          const colorLabel = lang === "ja" ? `${PLANET_LABEL_JA[k]}` : k;

          return (
            <tr key={k} style={rowStyleFor(k)}>
              <td style={tdLeftStyle}>{colorLabel}</td>
              {COL_ORDER.map((ck) => (
                <React.Fragment key={`${k}_${String(ck)}`}>{renderCell(ck, k)}</React.Fragment>
              ))}
            </tr>
          );
        })}

        {/* Extras (PROTO/ASTEROID): keep at the end, and follow the same column toggles */}
        {(() => {
          const scoutExtra = breakdown?.audit?.scout?.extraByKind ?? null;
          const scoutCoreExtra = breakdown?.audit?.scoutCore?.extraByKind ?? null;
          const kinds = ["PROTO", "ASTEROID"] as const;

          const hasAny =
            (scoutExtra && (scoutExtra.PROTO || scoutExtra.ASTEROID)) ||
            (scoutCoreExtra && (scoutCoreExtra.PROTO || scoutCoreExtra.ASTEROID));

          if (!hasAny) return null;

          const labelJa: Record<string, string> = { PROTO: "原始", ASTEROID: "小惑星" };

          return kinds.map((k) => {
            const vScout = Number((scoutExtra as any)?.[k] ?? 0) || 0;
            const vCore = Number((scoutCoreExtra as any)?.[k] ?? 0) || 0;
            const vOuter = 0;
            const vTouch = 0;
            const vTotal = vScout + vCore;

            const label = lang === "ja" ? labelJa[k] : k;

            const cellForExtra = (colKey: keyof typeof cols) => {
              if (!cols[colKey]) return null;
              if (colKey === "total") return <td style={{ ...tdStyle, fontWeight: 800 }}>{vTotal}</td>;
              if (colKey === "scout") return <td style={tdStyle}>{vScout}</td>;
              if (colKey === "scoutCore") return <td style={tdStyle}>{vCore}</td>;
              if (colKey === "gaia" || colKey === "cluster") return <td style={tdStyle}>-</td>;
              if (colKey === "outer") return <td style={tdStyle}>{vOuter}</td>;
              if (colKey === "touch") return <td style={tdStyle}>{vTouch}</td>;
              if (colKey === "cntOuter") return hasCounts ? <td style={tdStyle}>-</td> : null;
              if (colKey === "cntTouch") return hasCounts ? <td style={tdStyle}>-</td> : null;
              return null;
            };

            return (
              <tr key={`EXTRA_${k}`} style={rowStyleFor(k)}>
                <td style={tdLeftStyle}>{label}</td>
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
