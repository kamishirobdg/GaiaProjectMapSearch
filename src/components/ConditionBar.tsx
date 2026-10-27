// src/components/ConditionBar.tsx
"use client";

// 共通バー（GlobalBar）の直下に置く「探索条件」の帯（段階 1「条件の統一」。2026-10-16 ユーザー確定 A-(a) / B-(a)）。
//
// 役割:
//   1. 探索プロファイル（src/lib/searchProfiles.ts）の選択・新規・名前・削除。
//   2. 種族優遇／冷遇の編集（1 つの表を Map / Setup / Pair が共有する。色の近道は同色 2 種族へ同じ値）。
//   3. Map 部・Setup 部の登録状態（一致 / 差分あり / 未登録）と「登録」「適用」。
//      Map ページでは Map 部、Setup ページでは Setup 部が操作でき、他方は状態だけ出す
//      （「Setup へ移動して同一の条件であることを目視確認しながら探索」の目印）。
//
// 書き込みはすべてユーザー操作のハンドラから（localStorage の規律）。プロファイルが 1 つも無いときに
// 優遇を編集したり登録したりすると、その操作の中で「既定」プロファイルを作る。

import React from "react";
import Link from "next/link";
import {
  applyColorToFactionPref,
  colorValueOfFactionPref,
  createSearchProfile,
  DEFAULT_PROFILE_NAME,
  PREF_COLORS,
  PREF_EXTRA_COLORS,
  useSearchProfiles,
  type SearchProfile,
  type SearchProfileMap,
  type SearchProfileSetup,
} from "@/lib/searchProfiles";
import { factionsForMode, type FactionDef } from "@/gaia/eval/factionWeights";
import { COLOR_PREF_MAX, COLOR_PREF_MIN } from "@/gaia/eval/setupWeights";
import { EXTRA_INPUT_BG, EXTRA_LABEL_JA, PLANET_INPUT_BG, PLANET_LABEL_JA, type PlanetTypeKey } from "@/app/board/BreakdownTable";
import { SharedHelp } from "@/components/FactionEvalPanel";
import { TOP_K_MAX, TOP_K_MIN } from "@/gaia/eval/factionEval";
import { writeSharedTopK } from "@/lib/sharedSettings";
import { useSharedTopK } from "@/lib/useSharedTopK";

type Lang = "ja" | "en";
export type ConditionBarPage = "map" | "setup" | "pair";

const UI = {
  ja: {
    title: "探索条件",
    none: "（プロファイル無し）",
    newProfile: "新規",
    rename: "名前",
    remove: "削除",
    removeConfirm: "このプロファイルを削除しますか？（Map / Setup の結果は残ります）",
    newName: "プロファイル名",
    pref: "種族優遇",
    prefNone: "指定なし",
    topK: "上位 K",
    topKDefault: "人数+2",
    topKReset: "既定に戻す",
    edit: "編集",
    close: "閉じる",
    byColor: "色でまとめて",
    byFaction: "種族ごと",
    clear: "全て 0",
    mixed: "色の 2 種族で値が違う",
    map: "Map",
    setup: "Setup",
    stMatch: "一致",
    stDiff: "差分あり",
    stNone: "未登録",
    stBound: "登録済み",
    stNoProfile: "—",
    register: "いまの条件を登録",
    update: "いまの条件で更新",
    apply: "登録した条件を適用",
    goMap: "Map へ",
    goSetup: "Setup へ",
    tipMatch: "この画面の条件はプロファイルに登録した条件と同じ",
    tipDiff: "この画面の条件はプロファイルに登録した条件と違う（登録し直すか、登録した条件を適用する）",
    tipNone: "このプロファイルにはまだこの側の条件が登録されていない（検索を実行すると登録される）",
  },
  en: {
    title: "Search profile",
    none: "(no profile)",
    newProfile: "New",
    rename: "Rename",
    remove: "Delete",
    removeConfirm: "Delete this profile? (Map / Setup results are kept)",
    newName: "Profile name",
    pref: "Faction pref.",
    prefNone: "none",
    topK: "Top K",
    topKDefault: "players+2",
    topKReset: "Reset",
    edit: "Edit",
    close: "Close",
    byColor: "By colour",
    byFaction: "By faction",
    clear: "All 0",
    mixed: "the two factions of this colour differ",
    map: "Map",
    setup: "Setup",
    stMatch: "match",
    stDiff: "differs",
    stNone: "not set",
    stBound: "set",
    stNoProfile: "—",
    register: "Register current",
    update: "Update with current",
    apply: "Apply registered",
    goMap: "Go to Map",
    goSetup: "Go to Setup",
    tipMatch: "This page's conditions equal the ones registered in the profile",
    tipDiff: "This page's conditions differ from the registered ones (re-register, or apply the registered ones)",
    tipNone: "This side has no registered conditions yet (running a search registers them)",
  },
} as const;

function homeBg(color: string): string | undefined {
  return EXTRA_INPUT_BG[color] ?? PLANET_INPUT_BG[color as PlanetTypeKey];
}
function colorLabel(color: string, lang: Lang): string {
  if (lang === "ja") return PLANET_LABEL_JA[color as PlanetTypeKey] ?? EXTRA_LABEL_JA[color] ?? color;
  return color.charAt(0) + color.slice(1).toLowerCase();
}
function fmtSigned(v: number): string {
  return v > 0 ? `+${v}` : String(v);
}

const chip: React.CSSProperties = {
  display: "inline-flex",
  gap: 3,
  alignItems: "center",
  border: "1px solid rgba(0,0,0,0.15)",
  borderRadius: 6,
  padding: "1px 6px",
  fontSize: 11,
  whiteSpace: "nowrap",
};
const smallBtn: React.CSSProperties = { fontSize: 11, padding: "2px 8px" };

type Status = "match" | "diff" | "none" | "bound" | "noProfile";

function statusStyle(s: Status): React.CSSProperties {
  switch (s) {
    case "match":
      return { background: "#e8f5e9", border: "1px solid #8fc79f", color: "#1b6b2f" };
    case "diff":
      return { background: "#fff4e5", border: "1px solid #f0b36b", color: "#8a4b00" };
    case "bound":
      return { background: "#eef0ff", border: "1px solid #b7bdf5", color: "#2733cc" };
    case "none":
      return { background: "#f5f5f5", border: "1px solid #ddd", color: "#666" };
    default:
      return { background: "transparent", border: "1px solid transparent", color: "#999" };
  }
}

/**
 * 種族優遇の編集欄。色の行（同色 2 種族へ同じ値。値が違う色は空欄）と種族の行。
 * 入力の目盛りは従来の色優遇と同じ ±20。
 */
function FactionPrefEditor({
  pref,
  lf,
  lang,
  onChange,
}: {
  pref: Record<string, number>;
  lf: boolean;
  lang: Lang;
  onChange: (next: Record<string, number>) => void;
}) {
  const t = UI[lang];
  const colors: string[] = [...PREF_COLORS, ...(lf ? PREF_EXTRA_COLORS : [])];
  const defs: FactionDef[] = factionsForMode(lf);
  const clamp = (v: number) => (Number.isFinite(v) ? Math.max(COLOR_PREF_MIN, Math.min(COLOR_PREF_MAX, v)) : 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#555", minWidth: 72 }}>{t.byColor}</span>
        {colors.map((c) => {
          const v = colorValueOfFactionPref(pref, c);
          return (
            <label key={c} style={{ ...chip, background: homeBg(c), padding: "1px 4px 1px 6px" }} title={v === null ? t.mixed : undefined}>
              <span style={{ fontWeight: 700 }}>{colorLabel(c, lang)}</span>
              <input
                type="number"
                min={COLOR_PREF_MIN}
                max={COLOR_PREF_MAX}
                value={v === null ? "" : v}
                placeholder={v === null ? "±" : undefined}
                onChange={(e) => onChange(applyColorToFactionPref(pref, c, clamp(Number(e.target.value))))}
                style={{ width: 44, padding: "1px 3px", fontSize: 11 }}
              />
            </label>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#555", minWidth: 72 }}>{t.byFaction}</span>
        {defs.map((f) => (
          <label key={f.id} style={{ ...chip, background: homeBg(f.color), padding: "1px 4px 1px 6px" }}>
            <span style={{ fontWeight: 700 }}>{lang === "ja" ? f.labelJa : f.labelEn}</span>
            <input
              type="number"
              min={COLOR_PREF_MIN}
              max={COLOR_PREF_MAX}
              value={pref[f.id] ?? 0}
              onChange={(e) => {
                const v = clamp(Number(e.target.value));
                const next = { ...pref };
                if (v === 0) delete next[f.id];
                else next[f.id] = v;
                onChange(next);
              }}
              style={{ width: 44, padding: "1px 3px", fontSize: 11 }}
            />
          </label>
        ))}
        <button type="button" onClick={() => onChange({})} disabled={Object.keys(pref).length === 0} style={{ ...smallBtn, marginLeft: "auto" }}>
          {t.clear}
        </button>
      </div>
    </div>
  );
}

export default function ConditionBar({
  page,
  lang,
  lf,
  currentMap,
  onApplyMap,
  currentSetup,
  onApplySetup,
  describeMap,
  describeSetup,
}: {
  page: ConditionBarPage;
  lang: Lang;
  /** LF を含むか（種族優遇の欄に LF の 4 種族と原始・小惑星を出すか） */
  lf: boolean;
  /** Map ページ: いまの画面の条件（検索キーが決まるまで null） */
  currentMap?: SearchProfileMap | null;
  /** Map ページ: 登録した条件を画面へ戻す */
  onApplyMap?: (m: SearchProfileMap) => void;
  /** Setup ページ: いまの画面の条件 */
  currentSetup?: SearchProfileSetup | null;
  /** Setup ページ: 登録した条件を画面へ戻す */
  onApplySetup?: (s: SearchProfileSetup) => void;
  /** 登録した条件の要約（チップの title に出す） */
  describeMap?: (m: SearchProfileMap) => string;
  describeSetup?: (s: SearchProfileSetup) => string;
}) {
  const t = UI[lang];
  const { profiles, active, setActive, rename, remove, setFactionPref, bindMap, bindSetup } = useSearchProfiles();
  const [editing, setEditing] = React.useState(false);
  // 上位 K（共有設定、2026-10-27）。空欄 ＝ 既定（人数＋2）。書き込みは onChange（ユーザー操作）だけ
  const sharedTopK = useSharedTopK();
  const [topKText, setTopKText] = React.useState<string | null>(null);
  const topKShown = topKText ?? (sharedTopK == null ? "" : String(sharedTopK));
  const commitTopK = React.useCallback((raw: string) => {
    const n = Number(raw);
    if (raw.trim() === "") writeSharedTopK(null);
    else if (Number.isInteger(n) && n >= TOP_K_MIN && n <= TOP_K_MAX) writeSharedTopK(n);
    setTopKText(null);
  }, []);

  /** 操作の中で使う「対象プロファイル」。無ければ「既定」を作る（ユーザー操作のハンドラからだけ呼ぶ） */
  const ensureActive = React.useCallback((): SearchProfile => {
    if (active) return active;
    return createSearchProfile(DEFAULT_PROFILE_NAME[lang]);
  }, [active, lang]);

  const handleNew = React.useCallback(() => {
    const name = window.prompt(t.newName, "");
    if (name === null) return;
    const trimmed = name.trim();
    createSearchProfile(trimmed || DEFAULT_PROFILE_NAME[lang]);
  }, [t, lang]);
  const handleRename = React.useCallback(() => {
    if (!active) return;
    const name = window.prompt(t.newName, active.name);
    if (name === null) return;
    const trimmed = name.trim();
    if (trimmed) rename(active.id, trimmed);
  }, [active, rename, t]);
  const handleRemove = React.useCallback(() => {
    if (!active) return;
    if (!window.confirm(t.removeConfirm)) return;
    remove(active.id);
  }, [active, remove, t]);

  const pref = active?.factionPref ?? {};
  const prefDefs = React.useMemo(() => factionsForMode(true), []);
  const prefChips = prefDefs.filter((f) => pref[f.id]).map((f) => ({ f, v: pref[f.id] }));

  const mapStatus: Status = !active ? "noProfile" : !active.map ? "none" : page === "map" && currentMap ? (currentMap.searchKey === active.map.searchKey ? "match" : "diff") : "bound";
  const setupStatus: Status = !active ? "noProfile" : !active.setup ? "none" : page === "setup" && currentSetup ? (currentSetup.conditionKey === active.setup.conditionKey ? "match" : "diff") : "bound";
  const statusLabel = (s: Status) => (s === "match" ? t.stMatch : s === "diff" ? t.stDiff : s === "none" ? t.stNone : s === "bound" ? t.stBound : t.stNoProfile);
  const statusTip = (s: Status) => (s === "match" ? t.tipMatch : s === "diff" ? t.tipDiff : s === "none" ? t.tipNone : undefined);

  const registerMap = React.useCallback(() => {
    if (!currentMap) return;
    bindMap(ensureActive().id, currentMap);
  }, [currentMap, bindMap, ensureActive]);
  const registerSetup = React.useCallback(() => {
    if (!currentSetup) return;
    bindSetup(ensureActive().id, currentSetup);
  }, [currentSetup, bindSetup, ensureActive]);

  const sideBox = (
    label: string,
    status: Status,
    desc: string | undefined,
    actions: React.ReactNode,
  ) => (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ ...chip, ...statusStyle(status), fontWeight: 700 }} title={[statusTip(status), desc].filter(Boolean).join("\n")}>
        <span>{label}</span>
        <span style={{ fontWeight: 400 }}>{statusLabel(status)}</span>
      </span>
      {actions}
    </span>
  );

  return (
    <div
      data-condition-bar={page}
      style={{
        padding: "6px 12px",
        display: "flex",
        gap: 10,
        rowGap: 6,
        alignItems: "center",
        flexWrap: "wrap",
        borderBottom: "1px solid #eee",
        background: "#fcfcfd",
        fontSize: 12,
      }}
    >
      <span style={{ fontWeight: 700, display: "inline-flex", alignItems: "center" }}>
        {t.title}
        <SharedHelp k="searchProfile" lang={lang} />
      </span>
      <select
        value={active?.id ?? ""}
        onChange={(e) => {
          const id = e.target.value;
          if (!id) return;
          setActive(id);
          const p = profiles.find((x) => x.id === id);
          // 選び直したプロファイルの登録済み条件を、この画面の側だけ画面へ戻す（操作ハンドラの中）
          if (p?.map && page === "map" && onApplyMap) onApplyMap(p.map);
          if (p?.setup && page === "setup" && onApplySetup) onApplySetup(p.setup);
        }}
        style={{ fontSize: 12, maxWidth: 180 }}
      >
        {profiles.length === 0 ? <option value="">{t.none}</option> : null}
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name || DEFAULT_PROFILE_NAME[lang]}
          </option>
        ))}
      </select>
      <button type="button" onClick={handleNew} style={smallBtn}>
        {t.newProfile}
      </button>
      <button type="button" onClick={handleRename} disabled={!active} style={smallBtn}>
        {t.rename}
      </button>
      <button type="button" onClick={handleRemove} disabled={!active} style={smallBtn}>
        {t.remove}
      </button>

      {/* 種族優遇の要約（チップ）＋ 編集の開閉 */}
      <span style={{ display: "inline-flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, display: "inline-flex", alignItems: "center" }}>
          {t.pref}
          <SharedHelp k="factionPref" lang={lang} />
        </span>
        {prefChips.length === 0 ? (
          <span style={{ opacity: 0.6 }}>{t.prefNone}</span>
        ) : (
          prefChips.map(({ f, v }) => (
            <span key={f.id} style={{ ...chip, background: homeBg(f.color) }}>
              <span style={{ fontWeight: 700 }}>{lang === "ja" ? f.labelJa : f.labelEn}</span>
              <span>{fmtSigned(v)}</span>
            </span>
          ))
        )}
        <button type="button" onClick={() => setEditing((v) => !v)} style={smallBtn}>
          {editing ? t.close : t.edit}
        </button>
      </span>

      {/* 上位 K（基準 1 上位バランスの「上位」、種族優遇の境目、「合計の上位」。2026-10-27） */}
      <label style={{ display: "inline-flex", gap: 4, alignItems: "center" }} data-top-k>
        <span style={{ fontWeight: 700, display: "inline-flex", alignItems: "center" }}>
          {t.topK}
          <SharedHelp k="topK" lang={lang} />
        </span>
        <input
          type="number"
          min={TOP_K_MIN}
          max={TOP_K_MAX}
          step={1}
          value={topKShown}
          placeholder={t.topKDefault}
          onChange={(e) => setTopKText(e.target.value)}
          onBlur={(e) => commitTopK(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitTopK((e.target as HTMLInputElement).value);
          }}
          style={{ width: 52, fontSize: 12, padding: "1px 4px" }}
        />
        {sharedTopK != null ? (
          <button type="button" onClick={() => commitTopK("")} style={smallBtn} title={t.topKReset}>
            {t.topKDefault}
          </button>
        ) : null}
      </label>

      {/* Map 部・Setup 部の登録状態 */}
      <span style={{ display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginLeft: "auto" }}>
        {sideBox(
          t.map,
          mapStatus,
          active?.map && describeMap ? describeMap(active.map) : undefined,
          page === "map" ? (
            <>
              {currentMap && mapStatus !== "match" ? (
                <button type="button" onClick={registerMap} style={smallBtn}>
                  {mapStatus === "diff" ? t.update : t.register}
                </button>
              ) : null}
              {mapStatus === "diff" && active?.map && onApplyMap ? (
                <button type="button" onClick={() => onApplyMap(active.map!)} style={smallBtn}>
                  {t.apply}
                </button>
              ) : null}
            </>
          ) : (
            <Link href="/board" style={{ fontSize: 11 }}>
              {t.goMap}
            </Link>
          ),
        )}
        {sideBox(
          t.setup,
          setupStatus,
          active?.setup && describeSetup ? describeSetup(active.setup) : undefined,
          page === "setup" ? (
            <>
              {currentSetup && setupStatus !== "match" ? (
                <button type="button" onClick={registerSetup} style={smallBtn}>
                  {setupStatus === "diff" ? t.update : t.register}
                </button>
              ) : null}
              {setupStatus === "diff" && active?.setup && onApplySetup ? (
                <button type="button" onClick={() => onApplySetup(active.setup!)} style={smallBtn}>
                  {t.apply}
                </button>
              ) : null}
            </>
          ) : (
            <Link href="/setup" style={{ fontSize: 11 }}>
              {t.goSetup}
            </Link>
          ),
        )}
      </span>

      {editing ? (
        <FactionPrefEditor
          pref={pref}
          lf={lf}
          lang={lang}
          onChange={(next) => setFactionPref(ensureActive().id, next)}
        />
      ) : null}
    </div>
  );
}
