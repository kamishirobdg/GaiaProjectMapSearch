// src/components/TotalTable.tsx
"use client";

// 種族別の合計表（旧 Total タブの表。段階 2「Pair」で Pair の「詳細」へ移した。2026-10-17）。
// マップ 1 枚 × セットアップ 1 つで、種族ごとに Map の値（内訳表のその種族の行）＋ Setup の値（船の相互作用込み）を
// 合算比で足して並べる。合算比の入力欄（旧 Total タブ）は BlendInputs として分け、Pair の「条件」に置く。

import React from "react";
import { factionHomeBg, SharedHelp } from "@/components/FactionEvalPanel";
import { type FactionScores } from "@/gaia/eval/factionEval";
import { factionsForMode, type FactionId } from "@/gaia/eval/factionWeights";
import type { ShipInteraction } from "@/gaia/eval/shipInteraction";
import { SHIP_LABEL, type ShipId } from "@/gaia/setup/types";
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
    reevaluated: "Map の値は保存された候補をいまの評価（eval_v10）で評価し直したもの（Map タブで開いた値と同じ基準）",
    footnote: "Map ぶんは Map タブの内訳表のその種族の行の合計（船接触・船星系込み）。Setup ぶんは評価指数を掛けた種族スコアで、LF では船に乗るタイルの値をその種族の船接触の比で再配分した値（Setup タブの総合と数点の差）。点線の付いた Setup の値にカーソルを合わせると、船ごとの船接触と加点が出る。",
    blendTitle: "合算比",
    blendNote: "合計 ＝ Map × 倍率 ＋ Setup × 倍率。基準 1・2 の採点、種族優遇の掛け先、「合計の上位」にも同じ比が効く",
    blendReset: "1:1 に戻す",
    blendDefault: "1:1（既定）",
  },
  en: {
    rank: "#",
    faction: "Faction",
    mapScore: "Map",
    setupScore: "Setup",
    total: "Total",
    noBreakdown: "This map has no stored evaluation breakdown, so its map score is 0 (older candidate).",
    reevaluated: "Map values are the stored candidate re-evaluated with the current evaluation (eval_v10), the same basis as the Map tab",
    footnote: "The map part is that faction's row total in Map's breakdown (ship contact and ship systems included). The setup part is the weighted faction score; in LF the values of tiles on ships are redistributed by the faction's ship-contact ratio (a few points off the Setup tab total). Hover a dotted Setup value for the per-ship contact and bonus.",
    blendTitle: "Blend",
    blendNote: "Total = Map × weight + Setup × weight. Criteria 1 / 2, the faction preference and the top-by-total line use the same ratio",
    blendReset: "Reset to 1:1",
    blendDefault: "1:1 (default)",
  },
} as const;

function fmt(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export type TotalRow = { id: FactionId; name: string; color: string; map: number; setup: number; total: number };

/**
 * Setup のセルのホバー（2026-10-27 ユーザー「簡単にできそうなら」）: 種族ごとの船接触と船の相互作用の加点。
 * 船ごとに 船接触 C_{s,f}（平均 C̄_f との比）・その船に乗るタイルの値 T_{s,f}・加点 α × rel × T。
 * tiles は shipTileValuesByShip。相互作用が無い（基本版・内訳の無い盤面）ときは空。
 */
export function shipInteractionTitles(
  si: ShipInteraction | null,
  tiles: Partial<Record<ShipId, FactionScores>>,
  lang: Lang
): Partial<Record<FactionId, string>> {
  const out: Partial<Record<FactionId, string>> = {};
  if (!si) return out;
  const ja = lang === "ja";
  const pct = (r: number) => `${r >= 0 ? "+" : "−"}${Math.round(Math.abs(r) * 100)}%`;
  const sgn = (n: number) => `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}`;
  for (const f of Object.keys(si.bonus) as FactionId[]) {
    const own = si.byFaction?.[f];
    const perFaction = si.mode === "faction" && !!own && own.mean > 0;
    const lines = [
      ja
        ? `船の相互作用 ${sgn(si.bonus[f] ?? 0)}（${perFaction ? "この種族の船接触" : "全種族共通の船接触"}、平均 ${fmt(perFaction ? own!.mean : si.mean)}）`
        : `Ship interaction ${sgn(si.bonus[f] ?? 0)} (${perFaction ? "this faction's ship contact" : "ship contact shared by all factions"}, mean ${fmt(perFaction ? own!.mean : si.mean)})`,
    ];
    for (const row of si.ships) {
      const c = perFaction ? own!.contact[row.ship] ?? 0 : row.contact;
      const rel = perFaction ? own!.rel[row.ship] ?? 0 : row.rel;
      const t = tiles[row.ship]?.[f] ?? 0;
      const label = ja ? SHIP_LABEL[row.ship].ja : SHIP_LABEL[row.ship].en;
      lines.push(
        ja
          ? `${label}: 船接触 ${fmt(c)}（平均比 ${pct(rel)}）× タイル ${fmt(t)} → ${sgn(si.alpha * rel * t)}`
          : `${label}: contact ${fmt(c)} (${pct(rel)} vs mean) × tiles ${fmt(t)} → ${sgn(si.alpha * rel * t)}`
      );
    }
    out[f] = lines.join("\n");
  }
  return out;
}

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
  reevaluated,
  setupTitles,
}: {
  rows: TotalRow[];
  blend: ScoreBlend;
  lang: Lang;
  /** false なら「内訳が無いので Map ぶんが 0」の注記を出す */
  mapHasBreakdown: boolean;
  /** true なら「いまの評価で評価し直した」の注記を出す */
  reevaluated?: boolean;
  /** Setup のセルのホバー（種族ごとの船接触。shipInteractionTitles） */
  setupTitles?: Partial<Record<FactionId, string>>;
}) {
  const t = UI[lang];
  const th: React.CSSProperties = { textAlign: "right", padding: "4px 8px", borderBottom: "2px solid #ddd", fontSize: 12, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { textAlign: "right", padding: "3px 8px", borderBottom: "1px solid #eee", fontSize: 13, whiteSpace: "nowrap" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {!mapHasBreakdown ? <div style={{ fontSize: 11, color: "#a15" }}>{t.noBreakdown}</div> : null}
      {reevaluated ? <div style={{ fontSize: 11, opacity: 0.6 }}>{t.reevaluated}</div> : null}
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
                {setupTitles?.[r.id] ? (
                  <td style={{ ...td, cursor: "help", textDecoration: "underline dotted", textUnderlineOffset: 3 }} title={setupTitles[r.id]}>
                    {fmt(r.setup)}
                  </td>
                ) : (
                  <td style={td}>{fmt(r.setup)}</td>
                )}
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
