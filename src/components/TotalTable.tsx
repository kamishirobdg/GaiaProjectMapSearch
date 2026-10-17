// src/components/TotalTable.tsx
"use client";

// 種族別の合計表（旧 Total タブの表。段階 2「Pair」で Pair の「詳細」へ移した。2026-10-17）。
// マップ 1 枚 × セットアップ 1 つで、種族ごとに Map の値（内訳表のその種族の行）＋ Setup の値（船の相互作用込み）を
// 合算比で足して並べる。合算比の入力欄（旧 Total タブ）は BlendInputs として分け、Pair の「条件」に置く。

import React from "react";
import { factionHomeBg, SharedHelp } from "@/components/FactionEvalPanel";
import { type FactionScores } from "@/gaia/eval/factionEval";
import { factionsForMode, type FactionId } from "@/gaia/eval/factionWeights";
import {
  blendScores,
  isDefaultScoreBlend,
  SCORE_BLEND_MAX,
  SCORE_BLEND_MIN,
  SCORE_BLEND_STEP,
  type ScoreBlend,
  type ScoreBlendKey,
} from "@/gaia/eval/scoreBlend";

type Lang = "ja" | "en";

const UI = {
  ja: {
    rank: "順",
    faction: "種族",
    mapScore: "Map",
    setupScore: "Setup",
    total: "合計",
    noBreakdown: "このマップは評価の内訳を持っていないため Map ぶんが 0 になる（古い候補。Map タブで検索し直すと付く）",
    blendTitle: "合算比",
    blendNote: "合計 ＝ Map × 倍率 ＋ Setup × 倍率。基準 2・3 の採点、種族優遇の掛け先、「合計の上位」にも同じ比が効く",
    blendReset: "1:1 に戻す",
    blendDefault: "1:1（既定）",
    footnote: "Map ぶんは Map タブの内訳表のその種族の行の合計。Setup ぶんは評価指数を掛けた種族スコア（LF は船の相互作用込み）で、Setup タブと同じ値。",
  },
  en: {
    rank: "#",
    faction: "Faction",
    mapScore: "Map",
    setupScore: "Setup",
    total: "Total",
    noBreakdown: "This map has no stored evaluation breakdown, so its map score is 0 (older candidate).",
    blendTitle: "Blend",
    blendNote: "Total = Map × weight + Setup × weight. Criteria 2 / 3, the faction preference and the top-by-total line use the same ratio",
    blendReset: "Reset to 1:1",
    blendDefault: "1:1 (default)",
    footnote: "The map part is that faction's row total in Map's breakdown; the setup part is the weighted faction score (ship interaction included in LF), the same value as on the Setup tab.",
  },
} as const;

function fmt(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export type TotalRow = { id: FactionId; name: string; color: string; map: number; setup: number; total: number };

/** 表の行（合計の降順）。 */
export function totalRowsOf(mapScores: FactionScores, setupScores: FactionScores, blend: ScoreBlend, lf: boolean, lang: Lang): TotalRow[] {
  return factionsForMode(lf)
    .map((f) => ({
      id: f.id as FactionId,
      name: lang === "ja" ? f.labelJa : f.labelEn,
      color: f.color,
      map: mapScores[f.id] ?? 0,
      setup: setupScores[f.id] ?? 0,
      total: blendScores(mapScores[f.id] ?? 0, setupScores[f.id] ?? 0, blend),
    }))
    .sort((a, b) => b.total - a.total);
}

export function TotalTable({
  rows,
  blend,
  lang,
  mapHasBreakdown,
}: {
  rows: TotalRow[];
  blend: ScoreBlend;
  lang: Lang;
  /** false なら「内訳が無いので Map ぶんが 0」の注記を出す */
  mapHasBreakdown: boolean;
}) {
  const t = UI[lang];
  const th: React.CSSProperties = { textAlign: "right", padding: "4px 8px", borderBottom: "2px solid #ddd", fontSize: 12, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { textAlign: "right", padding: "3px 8px", borderBottom: "1px solid #eee", fontSize: 13, whiteSpace: "nowrap" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {!mapHasBreakdown ? <div style={{ fontSize: 11, color: "#a15" }}>{t.noBreakdown}</div> : null}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: 360 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "right" }}>{t.rank}</th>
              <th style={{ ...th, textAlign: "left" }}>{t.faction}</th>
              <th style={th}>
                {t.mapScore}
                {blend.map !== 1 ? ` ×${blend.map}` : ""}
              </th>
              <th style={th}>
                {t.setupScore}
                {blend.setup !== 1 ? ` ×${blend.setup}` : ""}
              </th>
              <th style={{ ...th, borderLeft: "1px solid #ddd" }}>{t.total}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} style={{ background: factionHomeBg(r.color) }}>
                <td style={{ ...td, opacity: 0.6 }}>{i + 1}</td>
                <td style={{ ...td, textAlign: "left" }}>{r.name}</td>
                <td style={td}>{fmt(r.map)}</td>
                <td style={td}>{fmt(r.setup)}</td>
                <td style={{ ...td, fontWeight: 800, borderLeft: "1px solid #ddd" }}>{fmt(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, opacity: 0.5 }}>{t.footnote}</div>
    </div>
  );
}

/** 合算比の入力欄（旧 Total タブ。既定 1:1。書き込みは onChange のときだけ）。 */
export function BlendInputs({
  blend,
  onChange,
  onReset,
  lang,
}: {
  blend: ScoreBlend;
  onChange: (k: ScoreBlendKey, v: number) => void;
  onReset: () => void;
  lang: Lang;
}) {
  const t = UI[lang];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
        <span style={{ fontWeight: 700 }}>
          {t.blendTitle}
          <SharedHelp k="pairBlend" lang={lang} />
        </span>
        {(["map", "setup"] as ScoreBlendKey[]).map((k) => (
          <label
            key={k}
            style={{ display: "flex", gap: 4, alignItems: "center", border: "1px solid #eee", borderRadius: 6, padding: "3px 6px", background: blend[k] === 1 ? "#fafafa" : "#eef6ff" }}
          >
            <span>{k === "map" ? t.mapScore : t.setupScore} ×</span>
            <input
              type="number"
              step={SCORE_BLEND_STEP}
              min={SCORE_BLEND_MIN}
              max={SCORE_BLEND_MAX}
              value={blend[k]}
              onChange={(e) => onChange(k, Number(e.target.value))}
              style={{ width: 60, padding: "2px 4px", fontSize: 12 }}
            />
          </label>
        ))}
        <button onClick={onReset} disabled={isDefaultScoreBlend(blend)} style={{ fontSize: 11 }}>
          {isDefaultScoreBlend(blend) ? t.blendDefault : t.blendReset}
        </button>
      </div>
      <div style={{ fontSize: 11, opacity: 0.6 }}>{t.blendNote}</div>
    </div>
  );
}
