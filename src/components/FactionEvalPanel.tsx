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
import {
  EXTRA_INPUT_BG,
  EXTRA_LABEL_JA,
  PLANET_INPUT_BG,
  PLANET_LABEL_JA,
  type PlanetTypeKey,
} from "@/app/board/BreakdownTable";
import { setupFactionBreakdown, setupFactionTileHits, type FactionScores } from "@/gaia/eval/factionEval";
import { factionsForMode, type FactionId } from "@/gaia/eval/factionWeights";
import {
  COLOR_PREF_KEYS,
  COLOR_PREF_MAX,
  COLOR_PREF_MIN,
  DEFAULT_SETUP_WEIGHTS,
  LF_ONLY_WEIGHT_KEYS,
  SETUP_WEIGHT_DISPLAY_ORDER,
  SETUP_WEIGHT_MAX,
  SETUP_WEIGHT_MIN,
  SETUP_WEIGHT_STEP,
  isDefaultWeights,
  readColorPref,
  readFactionPref,
  readSetupWeights,
  sanitizeColorPref,
  writeColorPref,
  writeFactionPref,
  writeSetupWeights,
  type ColorPrefByColor,
  type ColorPrefKey,
  type FactionPrefByFaction,
  type SetupWeightKey,
  type SetupWeights,
} from "@/gaia/eval/setupWeights";
import type { SetupResult } from "@/gaia/setup/types";
import { T } from "@/components/ui/layout";

type Lang = "ja" | "en";

/**
 * 種族の母星色の背景。評価表の行・保存リストの「上位4種族」チップ・
 * Map の色優遇の入力欄で共用する（2026-07-31）。配色の正本は BreakdownTable。
 */
export function factionHomeBg(color: string): string | undefined {
  return EXTRA_INPUT_BG[color] ?? PLANET_INPUT_BG[color as PlanetTypeKey];
}

/** 種族の母星色（タイルを縁取るので、背景色ではなく濃い方を使う）。 */
const HOME_COLOR_VIVID: Record<string, string> = {
  BLACK: "#444444",
  BLUE: "#2b7fe0",
  BROWN: "#9c6b34",
  ORANGE: "#f0951f",
  RED: "#e23b3b",
  WHITE: "#8d8d8d",
  YELLOW: "#e8c400",
  PROTO: "#3d8cb5",
  ASTEROID: "#9c4a8f",
};
/** 種族に紐づかない選択（列まるごと）のときの色。 */
const NEUTRAL_MARK_COLOR = "#2b7fe0";

/** マーカー指定: どのタイルを何色で光らせるか。 */
export type SetupMarkRequest = { tileIds: string[]; color: string };

// ラベルは短く、意味はツールチップ（title）で引けるようにする（2026-07-30 要望）。
const CAT_LABEL: Record<SetupWeightKey, { ja: string; en: string; tipJa: string; tipEn: string }> = {
  advanced: {
    ja: "上級",
    en: "adv",
    tipJa: "上級技術タイル（研究トラックの下に付く6枚）",
    tipEn: "Advanced tech (the six under the research tracks)",
  },
  advExtension: {
    // 列幅は1文字あたり約16px。影響力がいちばん小さい列なので短くする
    // （意味はツールチップが持つ。得点ボード「拡張部」の追加上級。2026-07-31）。
    ja: "拡張",
    en: "adv+",
    tipJa: "得点ボード拡張部の追加上級技術（取得条件が通常の上級と異なるため別枠）",
    tipEn: "Extra advanced tech on the scoring-board extension (different acquisition rule)",
  },
  // 2026-08-01: 列幅を揃えるため2文字に短縮（ラベルが長い列だけ幅が広がって
  // 数値の並びが不揃いになるため）。意味はツールチップで補う。
  booster: {
    ja: "RB",
    en: "boost",
    tipJa: "ラウンドブースター（使用する分のみ）",
    tipEn: "Round boosters in play",
  },
  roundScoring: {
    ja: "R点",
    en: "round",
    tipJa: "ラウンド得点タイル（同じタイルが2枚出れば枚数分加算）",
    tipEn: "Round scoring tiles (duplicates count twice)",
  },
  finalScoring: {
    ja: "最終",
    en: "final",
    tipJa: "最終得点計算タイル2枚",
    tipEn: "The two final scoring tiles",
  },
  federation: {
    ja: "同盟",
    en: "fed",
    tipJa: "同盟タイル（惑星改造 研究レベル5）",
    tipEn: "Federation tile (Terraforming level 5)",
  },
  standardTech: {
    ja: "技術",
    en: "tech",
    tipJa:
      "標準技術タイル9枚。どこに置かれたか（研究列6つ／フリー枠）で価値が変わる。\n" +
      "フリー枠はどの列も登らずに取れるので、そのタイル自体の有用度だけで見る。",
    tipEn:
      "The 9 standard tech tiles. Value depends on where each one sits (6 research tracks / free row).",
  },
  lfShip: {
    ja: "LF船",
    en: "LF ship",
    tipJa: "失われた艦隊の船関連（船の基本技術・金枠同盟・アーティファクト）",
    tipEn: "Lost Fleet ships (ship tech, gold federations, artifacts)",
  },
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
    tipFaction: "行の背景色＝その種族の母星色",
    tipTotal: "各カテゴリに評価指数を掛けた合計",
    summary: "総合スコア",
    mean: "平均",
    topK: "上位",
    spread: "散らばり",
    best: "最強",
    empty: "セットアップがありません（提案を生成すると表示されます）",
    colorPrefTitle: "色優遇/冷遇",
    colorPrefNote: "母星色ごとの ±。一括探索の並びに効く（評価表の値は変わらない）",
    tipColorPrefScale: [
      "その母星色の種族をどれだけ優遇（+）／冷遇（-）するか。",
      "掛け先は「その色でいちばん強い種族のスコア」。",
      "盤面が実際にどれだけ違うかを実測して目盛りを合わせてある（300件・4人LF）:",
      "  0 = 効かない",
      "  1 = 基準（バランス）とほぼ互角。同程度ならこの色が強い方を選ぶ",
      "  2 = 優遇が主導。選ばれるセットアップはほぼこの色が強い",
      "  3 = さらに強く寄る",
      "  5 = 実質この色だけで決まる（基準はほぼ無視される）",
      "マイナスは逆向きに同じだけ効く（この色が弱いセットアップを選ぶ）。",
    ].join("\n"),
    factionPrefTitle: "種族優遇/冷遇",
    factionPrefNote: "種族ごとの ±。掛け先は「Mapの評価値＋Setupの評価値」の合計",
    tipFactionPrefScale: [
      "その種族をどれだけ優遇（+）／冷遇（-）するか。",
      "掛け先は Map の評価値（母星色ぶん）と Setup の評価値の合計（200前後）。",
      "同じ母星色の2種族は Map ぶんが同じで、Setup ぶんで差がつく。",
      "  0 = 効かない",
      "  1 = 基準（バランス）とほぼ互角。同程度ならこの種族に向く方を選ぶ",
      "  2 = 優遇が主導。選ばれる組み合わせはほぼこの種族に向いている",
      "  3 = さらに強く寄る",
      "  5 = 実質この種族だけで決まる（基準はほぼ無視される）",
      "マイナスは逆向きに同じだけ効く。",
    ].join("\n"),
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
    tipFaction: "Row background = the faction's home planet color",
    tipTotal: "Sum of every category after its eval weight",
    summary: "Overall",
    mean: "mean",
    topK: "top",
    spread: "spread",
    best: "best",
    empty: "No setup yet (generate a suggestion to see this)",
    colorPrefTitle: "Colour preference",
    colorPrefNote: "Per home colour; affects bulk-search ranking (not the table values)",
    tipColorPrefScale: [
      "How strongly factions of this home colour are favoured (+) or avoided (-).",
      "Applied to the best faction of that colour.",
      "Measured against how much setups actually differ (300 setups, 4p Lost Fleet):",
      "  0 = off",
      "  1 = about even with the criterion; breaks ties toward this colour",
      "  2 = preference leads; the chosen setup almost always has this colour strong",
      "  3 = stronger still",
      "  5 = practically decided by this colour alone (criterion ignored)",
      "Negative values do the same in reverse.",
    ].join("\n"),
    factionPrefTitle: "Faction preference",
    factionPrefNote: "Per faction; applied to (map value + setup value)",
    tipFactionPrefScale: [
      "How strongly this faction is favoured (+) or avoided (-).",
      "Applied to the map value of its home colour plus its setup value (~200).",
      "Two factions of the same home colour share the map part and differ in the setup part.",
      "  0 = off",
      "  1 = about even with the criterion; breaks ties toward this faction",
      "  2 = preference leads; the chosen pair almost always suits this faction",
      "  3 = stronger still",
      "  5 = practically decided by this faction alone (criterion ignored)",
      "Negative values do the same in reverse.",
    ].join("\n"),
  },
} as const;

/**
 * 数値の表示。**小数第1位まで**出し、割り切れるときは整数で見せる。
 *
 * 2026-08-04 まで整数へ丸めていた（評価値そのものが整数で、小数が出るのは
 * 平均・散らばりだけだったため）。VP 換算＋最終スケール（SETUP_SCORE_DIVISOR）で
 * 評価値自体に小数が出るようになり、整数へ丸めると 1枚しか出ないカテゴリ
 * （追加上級・同盟）で種族差が消えてしまうので、桁を1つ増やした。
 */
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
export function useSetupWeights(): [
  SetupWeights,
  (k: SetupWeightKey, v: number) => void,
  () => void,
  (w: SetupWeights) => void,
] {
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
  /** 条件プロファイルの適用など、一括で差し替えるとき用（2026-07-30）。 */
  const setAll = React.useCallback((w: SetupWeights) => {
    const next = { ...DEFAULT_SETUP_WEIGHTS, ...w };
    writeSetupWeights(next);
    setWeights(next);
  }, []);
  return [weights, change, reset, setAll];
}

/**
 * 色優遇/冷遇（母星色ごと）の状態。useSetupWeights と同じ作法で、
 * 書き込みはユーザー操作のハンドラだけ（復元effectと書込みeffectを併用しない）。
 */
export function useColorPref(): [
  ColorPrefByColor,
  (k: ColorPrefKey, v: number) => void,
  () => void,
  (p: ColorPrefByColor) => void,
] {
  const [pref, setPref] = React.useState<ColorPrefByColor>({});
  React.useEffect(() => {
    setPref(readColorPref());
  }, []);
  const change = React.useCallback((k: ColorPrefKey, v: number) => {
    setPref((prev) => {
      const next: ColorPrefByColor = { ...prev };
      // 0 はキーごと落とす（未指定と同じ扱い＝キーをバイト不変に保つ）
      if (!Number.isFinite(v) || v === 0) delete next[k];
      else next[k] = v;
      writeColorPref(next);
      return next;
    });
  }, []);
  const reset = React.useCallback(() => {
    writeColorPref({});
    setPref({});
  }, []);
  const setAll = React.useCallback((p: ColorPrefByColor) => {
    const next = sanitizeColorPref(p);
    writeColorPref(next);
    setPref(next);
  }, []);
  return [pref, change, reset, setAll];
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
  onMark,
  activeSources,
}: {
  result: SetupResult;
  weights: SetupWeights;
  lang: Lang;
  lf: boolean;
  /** セル/種族名/列ヘッダのクリック。sourceId は `${軸}:${種族|*}` 形式。 */
  onMark?: (sourceId: string, req: SetupMarkRequest, additive: boolean) => void;
  activeSources?: Set<string>;
}) {
  const t = UI[lang];
  const hits = React.useMemo(() => setupFactionTileHits(result, weights), [result, weights]);
  const isActive = (id: string) => !!activeSources && activeSources.has(id);

  /**
   * クリック用の属性。faction=null は列まるごと、category=null は種族の全カテゴリ。
   * 光らせるのは「その数値を動かしているタイル」だけ（寄与0は入らない）。
   */
  const markProps = (
    sourceId: string,
    faction: FactionId | null,
    category: SetupWeightKey | null,
    color: string,
    join?: "left" | "right"
  ): React.HTMLAttributes<HTMLTableCellElement> => {
    if (!onMark) return {};
    const ring = "#2b7fe0";
    const outline =
      join === "left"
        ? `inset 2px 0 0 0 ${ring}, inset 0 2px 0 0 ${ring}, inset 0 -2px 0 0 ${ring}`
        : join === "right"
          ? `inset -2px 0 0 0 ${ring}, inset 0 2px 0 0 ${ring}, inset 0 -2px 0 0 ${ring}`
          : `inset 0 0 0 2px ${ring}`;
    return {
      onClick: (e) => {
        const ids = hits
          .filter((h) => (category == null || h.category === category))
          .filter((h) => (faction == null ? true : (h.byFaction[faction] ?? 0) !== 0))
          .map((h) => h.tileId);
        onMark(sourceId, { tileIds: [...new Set(ids)], color }, e.ctrlKey || e.metaKey);
      },
      title:
        lang === "ja"
          ? "この数値を動かしているタイルを光らせる（Ctrlで複数選択）"
          : "Highlight the tiles behind this number (Ctrl = multi-select)",
      style: { cursor: "pointer", boxShadow: isActive(sourceId) ? outline : undefined },
    };
  };
  const { byCategory, total } = React.useMemo(
    () => setupFactionBreakdown(result, weights),
    [result, weights]
  );

  const cols = SETUP_WEIGHT_DISPLAY_ORDER.filter((k) => lf || !LF_ONLY_WEIGHT_KEYS.has(k));
  // 基本版では LF の4種族は選べないので行に出さない（2026-07-31 ユーザー確定）。
  const shown = factionsForMode(lf);
  const rows = [...shown].sort((a, b) => total[b.id] - total[a.id]);

  const exTotal = extremesOf(shown.map((f) => total[f.id]));
  const exByCat = {} as Record<SetupWeightKey, { max: number; min: number }>;
  for (const k of cols) exByCat[k] = extremesOf(shown.map((f) => byCategory[k][f.id]));

  return (
    <div style={{ overflowX: "auto", border: T.borderSoft, borderRadius: T.radius }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: "left" }} title={t.tipFaction}>
              {t.colFaction}
            </th>
            <th style={thStyle} title={t.tipTotal}>
              {t.colTotal}
            </th>
            {cols.map((k) => {
              const m = markProps(`${k}:*`, null, k, NEUTRAL_MARK_COLOR);
              return (
                <th
                  key={k}
                  style={{ ...thStyle, ...(m.style ?? {}) }}
                  onClick={m.onClick as any}
                  title={
                    (lang === "ja" ? CAT_LABEL[k].tipJa : CAT_LABEL[k].tipEn) +
                    (m.title ? `
${m.title}` : "")
                  }
                >
                  {lang === "ja" ? CAT_LABEL[k].ja : CAT_LABEL[k].en}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => {
            const colorKey = f.color as PlanetTypeKey;
            const colorName =
              lang === "ja" ? (PLANET_LABEL_JA[colorKey] ?? EXTRA_LABEL_JA[f.color] ?? f.color) : f.color;
            return (
              <tr key={f.id} style={{ background: factionHomeBg(f.color) }}>
                {(() => {
                  const c = HOME_COLOR_VIVID[f.color] ?? NEUTRAL_MARK_COLOR;
                  const m = markProps(`total:${f.id}`, f.id, null, c, "left");
                  return (
                    <td
                      style={{ ...tdLeftStyle, ...(m.style ?? {}) }}
                      onClick={m.onClick}
                      title={`${colorName} / ${f.labelEn}` + (m.title ? `
${m.title}` : "")}
                    >
                      {lang === "ja" ? f.labelJa : f.labelEn}
                    </td>
                  );
                })()}
                {(() => {
                  const c = HOME_COLOR_VIVID[f.color] ?? NEUTRAL_MARK_COLOR;
                  const m = markProps(`total:${f.id}`, f.id, null, c, "right");
                  return (
                    <td
                      onClick={m.onClick}
                      title={m.title}
                      style={{
                        ...tdStyle,
                        fontWeight: 800,
                        color: extremeColor(total[f.id], exTotal),
                        ...(m.style ?? {}),
                      }}
                    >
                      {fmt1(total[f.id])}
                    </td>
                  );
                })()}
                {cols.map((k) => {
                  const c = HOME_COLOR_VIVID[f.color] ?? NEUTRAL_MARK_COLOR;
                  const m = markProps(`${k}:${f.id}`, f.id, k, c);
                  return (
                    <td
                      key={k}
                      onClick={m.onClick}
                      title={m.title}
                      style={{
                        ...tdStyle,
                        color: extremeColor(byCategory[k][f.id], exByCat[k]),
                        ...(m.style ?? {}),
                      }}
                    >
                      {fmt1(byCategory[k][f.id])}
                    </td>
                  );
                })}
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
  lf,
}: {
  total: FactionScores;
  players: number;
  lang: Lang;
  lf: boolean;
}) {
  const t = UI[lang];
  // 表と同じ母集団で集計する（基本版は14種族）。
  const shown = factionsForMode(lf);
  const ids = shown.map((f) => f.id) as FactionId[];
  const values = ids.map((id) => total[id]);
  const k = Math.min(values.length, Math.max(2, players + 2));
  const desc = [...values].sort((a, b) => b - a);
  const bestId = ids.reduce((a, b) => (total[b] > total[a] ? b : a), ids[0]);
  const best = shown.find((f) => f.id === bestId);
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
  const keys = SETUP_WEIGHT_DISPLAY_ORDER.filter((k) => lf || !LF_ONLY_WEIGHT_KEYS.has(k));
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
            title={lang === "ja" ? CAT_LABEL[k].tipJa : CAT_LABEL[k].tipEn}
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
              step={SETUP_WEIGHT_STEP}
              min={SETUP_WEIGHT_MIN}
              max={SETUP_WEIGHT_MAX}
              value={weights[k]}
              onChange={(e) => {
                const v = Number(e.target.value);
                onChange(
                  k,
                  Number.isFinite(v)
                    ? Math.max(SETUP_WEIGHT_MIN, Math.min(SETUP_WEIGHT_MAX, v))
                    : DEFAULT_SETUP_WEIGHTS[k]
                );
              }}
              style={{ width: 66, padding: "2px 4px", fontSize: T.fontNote }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * 色優遇/冷遇の入力欄（母星色ごと。2026-07-31）。Map の同名の入力と同じ見た目・
 * 同じ目盛りで、掛け先だけ違う（Map=その色の惑星の評価値／Setup=その色でいちばん
 * 強い種族のスコア）。原始・小惑星は LF のときだけ出す。
 */
export function ColorPrefInputs({
  pref,
  onChange,
  onReset,
  lang,
  lf,
}: {
  pref: ColorPrefByColor;
  onChange: (k: ColorPrefKey, v: number) => void;
  onReset: () => void;
  lang: Lang;
  lf: boolean;
}) {
  const t = UI[lang];
  const keys = COLOR_PREF_KEYS.filter((k) => lf || (k !== "PROTO" && k !== "ASTEROID"));
  const atDefault = keys.every((k) => !pref[k]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: T.fontBody }}>{t.colorPrefTitle}</span>
        <span style={{ fontSize: T.fontNote, color: T.fgMuted }}>{t.colorPrefNote}</span>
        <button onClick={onReset} disabled={atDefault} style={{ marginLeft: "auto", fontSize: 11 }}>
          {atDefault ? t.isDefault : t.reset}
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {keys.map((k) => (
          <label
            key={k}
            title={t.tipColorPrefScale}
            style={{
              display: "flex",
              gap: 4,
              alignItems: "center",
              fontSize: T.fontNote,
              border: "1px solid rgba(0,0,0,0.15)",
              borderRadius: 6,
              padding: "3px 6px",
              background: factionHomeBg(k),
            }}
          >
            <span style={{ fontWeight: 700 }}>
              {lang === "ja" ? (PLANET_LABEL_JA[k as PlanetTypeKey] ?? EXTRA_LABEL_JA[k] ?? k) : k}
            </span>
            <input
              type="number"
              min={COLOR_PREF_MIN}
              max={COLOR_PREF_MAX}
              value={pref[k] ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                onChange(k, Number.isFinite(v) ? Math.max(COLOR_PREF_MIN, Math.min(COLOR_PREF_MAX, v)) : 0);
              }}
              style={{ width: 52, padding: "2px 4px", fontSize: T.fontNote }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * 種族ごとの優遇/冷遇の入力欄（List 専用。2026-07-31）。
 * 色ではなく種族単位で、掛け先は「Map の評価値＋Setup の評価値」。
 */
export function FactionPrefInputs({
  pref,
  onChange,
  onReset,
  lang,
  lf,
}: {
  pref: FactionPrefByFaction;
  onChange: (id: string, v: number) => void;
  onReset: () => void;
  lang: Lang;
  lf: boolean;
}) {
  const t = UI[lang];
  const defs = factionsForMode(lf);
  const atDefault = defs.every((f) => !pref[f.id]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: T.fontBody }}>{t.factionPrefTitle}</span>
        <span style={{ fontSize: T.fontNote, color: T.fgMuted }}>{t.factionPrefNote}</span>
        <button onClick={onReset} disabled={atDefault} style={{ marginLeft: "auto", fontSize: 11 }}>
          {atDefault ? t.isDefault : t.reset}
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {defs.map((f) => (
          <label
            key={f.id}
            title={t.tipFactionPrefScale}
            style={{
              display: "flex",
              gap: 4,
              alignItems: "center",
              fontSize: T.fontNote,
              border: "1px solid rgba(0,0,0,0.15)",
              borderRadius: 6,
              padding: "2px 5px",
              background: factionHomeBg(f.color),
            }}
          >
            <span style={{ fontWeight: 700 }}>{lang === "ja" ? f.labelJa : f.labelEn}</span>
            <input
              type="number"
              min={COLOR_PREF_MIN}
              max={COLOR_PREF_MAX}
              value={pref[f.id] ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                onChange(f.id, Number.isFinite(v) ? Math.max(COLOR_PREF_MIN, Math.min(COLOR_PREF_MAX, v)) : 0);
              }}
              style={{ width: 46, padding: "2px 4px", fontSize: T.fontNote }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

/** 種族優遇の状態（List 専用）。useColorPref と同じ作法。 */
export function useFactionPref(): [
  FactionPrefByFaction,
  (id: string, v: number) => void,
  () => void,
] {
  const [pref, setPref] = React.useState<FactionPrefByFaction>({});
  React.useEffect(() => {
    setPref(readFactionPref());
  }, []);
  const change = React.useCallback((id: string, v: number) => {
    setPref((prev) => {
      const next = { ...prev };
      if (!Number.isFinite(v) || v === 0) delete next[id];
      else next[id] = v;
      writeFactionPref(next);
      return next;
    });
  }, []);
  const reset = React.useCallback(() => {
    writeFactionPref({});
    setPref({});
  }, []);
  return [pref, change, reset];
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
  onMark,
  activeSources,
  colorPref,
  onChangeColorPref,
  onResetColorPref,
}: {
  result: SetupResult | null;
  weights: SetupWeights;
  onChangeWeight: (k: SetupWeightKey, v: number) => void;
  onResetWeights: () => void;
  lang: Lang;
  lf: boolean;
  players: number;
  onMark?: (sourceId: string, req: SetupMarkRequest, additive: boolean) => void;
  activeSources?: Set<string>;
  /** 色優遇/冷遇。渡されたときだけ入力欄を出す（2026-07-31）。 */
  colorPref?: ColorPrefByColor;
  onChangeColorPref?: (k: ColorPrefKey, v: number) => void;
  onResetColorPref?: () => void;
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
          <ScoreSummary total={total} players={players} lang={lang} lf={lf} />
          <FactionScoreTable
            result={result}
            weights={weights}
            lang={lang}
            lf={lf}
            onMark={onMark}
            activeSources={activeSources}
          />
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
      {colorPref && onChangeColorPref && onResetColorPref ? (
        <ColorPrefInputs
          pref={colorPref}
          onChange={onChangeColorPref}
          onReset={onResetColorPref}
          lang={lang}
          lf={lf}
        />
      ) : null}
    </div>
  );
}
