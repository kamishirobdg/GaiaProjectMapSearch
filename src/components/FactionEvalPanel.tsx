// src/components/FactionEvalPanel.tsx
//
// Setup/List 左ペインの評価表示（2026-07-30）。Map の「色別内訳＋評価指数」に
// 対応する Setup 側の部品:
//   - 種族14行の評価表（行背景＝母星色。Map の惑星色テーブルと同じ配色）
//   - カテゴリ別の内訳列と総合列（最大=青／最小=赤、Map と同じ強調規則）
//   - 総合スコアのサマリ（平均・上位K平均・散らばり）
//   - 評価指数（カテゴリ別係数）の入力。localStorage で Setup/List が共有し、
//     List の「セット提案」の選定にも同じ値が効く。
"use client";

import React from "react";
import { PLANET_INPUT_BG, PLANET_LABEL_JA, type PlanetTypeKey } from "@/app/board/BreakdownTable";
import { setupFactionBreakdown, type FactionScores } from "@/gaia/eval/factionEval";
import { FACTIONS, type FactionId } from "@/gaia/eval/factionWeights";
import {
  DEFAULT_SETUP_WEIGHTS,
  LF_ONLY_WEIGHT_KEYS,
  SETUP_WEIGHT_KEYS,
  isDefaultWeights,
  readSetupWeights,
  writeSetupWeights,
  type SetupWeightKey,
  type SetupWeights,
} from "@/gaia/eval/setupWeights";
import type { SetupResult } from "@/gaia/setup/types";
import { T } from "@/components/ui/layout";

type Lang = "ja" | "en";

const CAT_LABEL: Record<SetupWeightKey, { ja: string; en: string }> = {
  advanced: { ja: "上級", en: "adv" },
  booster: { ja: "ブースター", en: "boost" },
  roundScoring: { ja: "ラウンド", en: "round" },
  finalScoring: { ja: "最終", en: "final" },
  federation: { ja: "同盟", en: "fed" },
  stdTrack: { ja: "標準(列)", en: "std/track" },
  stdFree: { ja: "標準(自由)", en: "std/free" },
  lfShip: { ja: "LF船", en: "LF ship" },
};

const UI = {
  ja: {
    evalTitle: "評価（種族別）",
    evalNote: "行の背景＝母星色。列は評価指数を掛けた後の値",
    weightsTitle: "評価指数",
    weightsNote: "カテゴリ別の係数。一覧タブの「セット提案」の選定にも効く",
    reset: "既定に戻す",
    isDefault: "既定値",
    colFaction: "種族",
    colTotal: "総合",
    summary: "総合スコア",
    mean: "平均",
    topK: "上位",
    spread: "散らばり",
    best: "最強",
    empty: "セットアップがありません（提案を生成すると表示されます）",
  },
  en: {
    evalTitle: "Evaluation (by faction)",
    evalNote: "Row background = home color. Columns are post-weight values",
    weightsTitle: "Eval weights",
    weightsNote: "Per-category coefficients; also used by the List tab's pair suggestions",
    reset: "Reset",
    isDefault: "defaults",
    colFaction: "Faction",
    colTotal: "total",
    summary: "Overall",
    mean: "mean",
    topK: "top",
    spread: "spread",
    best: "best",
    empty: "No setup yet (generate a suggestion to see this)",
  },
} as const;

/** 1桁までの丸め（末尾の .0 は落とす）。 */
function fmt1(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}
function stdev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) * (x - m))));
}

/**
 * 評価指数の状態。復元は読み取りのみの effect、書込みはユーザー操作ハンドラ
 * だけ（localStorage の規律。Strict Mode の二重実行で既定が上書きされるのを防ぐ）。
 */
export function useSetupWeights(): [SetupWeights, (k: SetupWeightKey, v: number) => void, () => void] {
  const [weights, setWeights] = React.useState<SetupWeights>(DEFAULT_SETUP_WEIGHTS);
  React.useEffect(() => {
    setWeights(readSetupWeights());
  }, []);
  const change = React.useCallback((k: SetupWeightKey, v: number) => {
    setWeights((prev) => {
      const next = { ...prev, [k]: Number.isFinite(v) ? v : DEFAULT_SETUP_WEIGHTS[k] };
      writeSetupWeights(next);
      return next;
    });
  }, []);
  const reset = React.useCallback(() => {
    const next = { ...DEFAULT_SETUP_WEIGHTS };
    writeSetupWeights(next);
    setWeights(next);
  }, []);
  return [weights, change, reset];
}

const thStyle: React.CSSProperties = {
  borderBottom: "1px solid #ddd",
  padding: "5px 7px",
  textAlign: "right",
  fontSize: 12,
  background: "#fafafa",
  whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid rgba(0,0,0,0.06)",
  padding: "5px 7px",
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

const EPS = 1e-9;
/** 最大=青／最小=赤（同値は全部に付く）。Map の内訳表と同じ規則。 */
function extremesOf(values: number[]): { max: number; min: number } {
  let max = -Infinity;
  let min = Infinity;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v > max) max = v;
    if (v < min) min = v;
  }
  return { max, min };
}
function extremeColor(v: number, ex: { max: number; min: number }): string | undefined {
  if (Math.abs(ex.max - ex.min) <= EPS) return undefined; // 全部同値なら色を付けない
  if (Math.abs(v - ex.max) <= EPS) return "#0b5fff";
  if (Math.abs(v - ex.min) <= EPS) return "#d0021b";
  return undefined;
}

/** 種族14行の評価表（内訳＋総合）。 */
export function FactionScoreTable({
  result,
  weights,
  lang,
  lf,
}: {
  result: SetupResult;
  weights: SetupWeights;
  lang: Lang;
  lf: boolean;
}) {
  const t = UI[lang];
  const { byCategory, total } = React.useMemo(
    () => setupFactionBreakdown(result, weights),
    [result, weights]
  );

  const cols = SETUP_WEIGHT_KEYS.filter((k) => lf || !LF_ONLY_WEIGHT_KEYS.has(k));
  const rows = [...FACTIONS].sort((a, b) => total[b.id] - total[a.id]);

  const exTotal = extremesOf(FACTIONS.map((f) => total[f.id]));
  const exByCat = {} as Record<SetupWeightKey, { max: number; min: number }>;
  for (const k of cols) exByCat[k] = extremesOf(FACTIONS.map((f) => byCategory[k][f.id]));

  return (
    <div style={{ overflowX: "auto", border: T.borderSoft, borderRadius: T.radius }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: "left" }}>{t.colFaction}</th>
            <th style={thStyle}>{t.colTotal}</th>
            {cols.map((k) => (
              <th key={k} style={thStyle}>
                {lang === "ja" ? CAT_LABEL[k].ja : CAT_LABEL[k].en}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => {
            const colorKey = f.color as PlanetTypeKey;
            const colorName = lang === "ja" ? PLANET_LABEL_JA[colorKey] : colorKey;
            return (
              <tr key={f.id} style={{ background: PLANET_INPUT_BG[colorKey] }}>
                <td style={tdLeftStyle} title={`${colorName} / ${f.labelEn}`}>
                  {lang === "ja" ? f.labelJa : f.labelEn}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    fontWeight: 800,
                    color: extremeColor(total[f.id], exTotal),
                  }}
                >
                  {fmt1(total[f.id])}
                </td>
                {cols.map((k) => (
                  <td key={k} style={{ ...tdStyle, color: extremeColor(byCategory[k][f.id], exByCat[k]) }}>
                    {fmt1(byCategory[k][f.id])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 総合スコアのサマリ（平均・上位K平均・散らばり・最強種族）。 */
function ScoreSummary({
  total,
  players,
  lang,
}: {
  total: FactionScores;
  players: number;
  lang: Lang;
}) {
  const t = UI[lang];
  const ids = [...FACTIONS].map((f) => f.id) as FactionId[];
  const values = ids.map((id) => total[id]);
  const k = Math.min(values.length, Math.max(2, players + 2));
  const desc = [...values].sort((a, b) => b - a);
  const bestId = ids.reduce((a, b) => (total[b] > total[a] ? b : a), ids[0]);
  const best = FACTIONS.find((f) => f.id === bestId);
  const chip: React.CSSProperties = {
    border: T.borderSoft,
    borderRadius: 6,
    padding: "2px 8px",
    background: T.bgPanel,
  };
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: T.fontBody, alignItems: "center" }}>
      <span style={{ fontWeight: 700 }}>{t.summary}</span>
      <span style={chip}>
        {t.mean} {fmt1(mean(values))}
      </span>
      <span style={chip}>
        {t.topK}{k} {fmt1(mean(desc.slice(0, k)))}
      </span>
      <span style={chip}>
        {t.spread} {fmt1(stdev(values))}
      </span>
      {best ? (
        <span style={chip}>
          {t.best} {lang === "ja" ? best.labelJa : best.labelEn} {fmt1(total[bestId])}
        </span>
      ) : null}
    </div>
  );
}

/** 評価指数（カテゴリ別係数）の入力欄。 */
export function SetupWeightInputs({
  weights,
  onChange,
  onReset,
  lang,
  lf,
}: {
  weights: SetupWeights;
  onChange: (k: SetupWeightKey, v: number) => void;
  onReset: () => void;
  lang: Lang;
  lf: boolean;
}) {
  const t = UI[lang];
  const keys = SETUP_WEIGHT_KEYS.filter((k) => lf || !LF_ONLY_WEIGHT_KEYS.has(k));
  const atDefault = isDefaultWeights(weights);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: T.fontBody }}>{t.weightsTitle}</span>
        <span style={{ fontSize: T.fontNote, color: T.fgMuted }}>{t.weightsNote}</span>
        <button onClick={onReset} disabled={atDefault} style={{ marginLeft: "auto", fontSize: 11 }}>
          {atDefault ? t.isDefault : t.reset}
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {keys.map((k) => (
          <label
            key={k}
            style={{
              display: "flex",
              gap: 4,
              alignItems: "center",
              fontSize: T.fontNote,
              border: T.borderSoft,
              borderRadius: 6,
              padding: "3px 6px",
              background: weights[k] === DEFAULT_SETUP_WEIGHTS[k] ? T.bgPanel : T.bgAccent,
            }}
          >
            <span>{lang === "ja" ? CAT_LABEL[k].ja : CAT_LABEL[k].en}</span>
            <input
              type="number"
              step={0.25}
              min={-9}
              max={9}
              value={weights[k]}
              onChange={(e) => {
                const v = Number(e.target.value);
                onChange(k, Number.isFinite(v) ? Math.max(-9, Math.min(9, v)) : DEFAULT_SETUP_WEIGHTS[k]);
              }}
              style={{ width: 58, padding: "2px 4px", fontSize: T.fontNote }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * 左ペインに載せる評価パネル一式。result が null（List で提案未生成）のときは
 * 評価指数だけ出して表は空状態にする（幅と位置を動かさないため枠は残す）。
 */
export default function FactionEvalPanel({
  result,
  weights,
  onChangeWeight,
  onResetWeights,
  lang,
  lf,
  players,
}: {
  result: SetupResult | null;
  weights: SetupWeights;
  onChangeWeight: (k: SetupWeightKey, v: number) => void;
  onResetWeights: () => void;
  lang: Lang;
  lf: boolean;
  players: number;
}) {
  const t = UI[lang];
  const total = React.useMemo(
    () => (result ? setupFactionBreakdown(result, weights).total : null),
    [result, weights]
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: T.gapSm }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: T.fontHead }}>{t.evalTitle}</span>
        <span style={{ fontSize: T.fontNote, color: T.fgMuted }}>{t.evalNote}</span>
      </div>
      {result && total ? (
        <>
          <ScoreSummary total={total} players={players} lang={lang} />
          <FactionScoreTable result={result} weights={weights} lang={lang} lf={lf} />
        </>
      ) : (
        <div style={{ fontSize: T.fontBody, color: T.fgMuted }}>{t.empty}</div>
      )}
      <SetupWeightInputs
        weights={weights}
        onChange={onChangeWeight}
        onReset={onResetWeights}
        lang={lang}
        lf={lf}
      />
    </div>
  );
}
