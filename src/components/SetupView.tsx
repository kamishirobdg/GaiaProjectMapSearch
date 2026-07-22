// src/components/SetupView.tsx
"use client";

import React from "react";
import { buildSetupFromSeed } from "@/gaia/setup/buildSetup";
import { SETUP_CATALOG } from "@/gaia/setup/data";
import { RESEARCH_TRACK_IDS, type ResearchTrackId } from "@/gaia/setup/types";

type Lang = "ja" | "en";

// Research track display names (labels only; ids are the source of truth).
const TRACK_LABEL: Record<ResearchTrackId, { ja: string; en: string }> = {
  terra: { ja: "テラフォーミング", en: "Terraforming" },
  nav: { ja: "航行", en: "Navigation" },
  ai: { ja: "人工知能", en: "Artificial Intelligence" },
  gaia: { ja: "ガイアプロジェクト", en: "Gaia Project" },
  eco: { ja: "経済", en: "Economy" },
  sci: { ja: "科学", en: "Science" },
};

const UI = {
  ja: {
    title: "セットアップ（研究/ブースター/得点）",
    draftNote:
      "※ タイルの効果テキストは暫定（要検証）。枚数とスロット構成は確定です。評価機能は未実装。",
    seed: "シード",
    randomSeed: "ランダム",
    players: "人数",
    roll: "生成",
    researchTracks: "研究トラック（上：上級 / 下：標準）",
    advanced: "上級",
    standard: "標準",
    freeStandard: "標準タイル（フリー枠）",
    boosters: "ラウンドブースター",
    available: "使用",
    unused: "未使用",
    roundScoring: "ラウンド得点",
    finalScoring: "最終得点計算",
    round: "R",
  },
  en: {
    title: "Setup (research / boosters / scoring)",
    draftNote:
      "Note: tile effect text is provisional (needs verification). Counts and slots are final. Evaluation is not implemented yet.",
    seed: "Seed",
    randomSeed: "Random",
    players: "Players",
    roll: "Roll",
    researchTracks: "Research tracks (top: advanced / bottom: standard)",
    advanced: "Adv",
    standard: "Std",
    freeStandard: "Standard tiles (free row)",
    boosters: "Round boosters",
    available: "Available",
    unused: "Unused",
    roundScoring: "Round scoring",
    finalScoring: "Final scoring",
    round: "R",
  },
} as const;

// id -> tile lookups for label rendering.
const BY_ID = new Map<string, { label: string; labelEn: string; effect?: string; effectEn?: string }>();
for (const group of [
  SETUP_CATALOG.standardTech,
  SETUP_CATALOG.advancedTech,
  SETUP_CATALOG.boosters,
  SETUP_CATALOG.roundScoring,
  SETUP_CATALOG.finalScoring,
]) {
  for (const t of group) BY_ID.set(t.id, t);
}

function labelOf(id: string, lang: Lang): string {
  const t = BY_ID.get(id);
  if (!t) return id;
  return lang === "ja" ? t.label : t.labelEn;
}
function effectOf(id: string, lang: Lang): string | undefined {
  const t = BY_ID.get(id);
  if (!t) return undefined;
  return lang === "ja" ? t.effect : t.effectEn;
}

function randomSeedString(): string {
  return Math.floor(Math.random() * 2147483647 + 1).toString();
}

export default function SetupView() {
  const [lang, setLang] = React.useState<Lang>("ja");
  const [seed, setSeed] = React.useState<string>("1");
  const [players, setPlayers] = React.useState<number>(4);

  // Match the map page's language preference.
  React.useEffect(() => {
    try {
      const v = localStorage.getItem("gaia_ui_lang");
      if (v === "ja" || v === "en") setLang(v);
    } catch {
      // ignore
    }
  }, []);

  const setLangPersist = React.useCallback((l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem("gaia_ui_lang", l);
    } catch {
      // ignore
    }
  }, []);

  const result = React.useMemo(
    () => buildSetupFromSeed({ seed, playerCount: players }),
    [seed, players]
  );

  const t = UI[lang];

  const tileCell = (id: string, tag?: string) => (
    <div
      key={id + (tag ?? "")}
      title={effectOf(id, lang) ?? ""}
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: "6px 8px",
        fontSize: 12,
        background: "#fafafa",
        minWidth: 0,
      }}
    >
      {tag ? <span style={{ opacity: 0.6, marginRight: 6 }}>{tag}</span> : null}
      <span style={{ fontFamily: "monospace", opacity: 0.7, marginRight: 6 }}>{id}</span>
      {labelOf(id, lang)}
    </div>
  );

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 14, maxWidth: 1100 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{t.title}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto", fontSize: 12 }}>
          <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input type="radio" name="setupLang" checked={lang === "en"} onChange={() => setLangPersist("en")} />
            EN
          </label>
          <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input type="radio" name="setupLang" checked={lang === "ja"} onChange={() => setLangPersist("ja")} />
            日本語
          </label>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#b26b00", background: "#fff8ec", border: "1px solid #f0dcae", borderRadius: 8, padding: "6px 10px" }}>
        {t.draftNote}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span>{t.seed}</span>
          <input value={seed} onChange={(e) => setSeed(e.target.value)} style={{ width: 140, padding: "4px 6px" }} />
        </label>
        <button onClick={() => setSeed(randomSeedString())} style={{ padding: "4px 10px", fontWeight: 700 }}>
          {t.randomSeed}
        </button>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span>{t.players}</span>
          <select value={players} onChange={(e) => setPlayers(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Research tracks: advanced (top) + standard (bottom) per track */}
      <section>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.researchTracks}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
          {RESEARCH_TRACK_IDS.map((track) => (
            <div key={track} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>
                {lang === "ja" ? TRACK_LABEL[track].ja : TRACK_LABEL[track].en}
              </div>
              {tileCell(result.advancedTech.byTrack[track], t.advanced)}
              {tileCell(result.standardTech.byTrack[track], t.standard)}
            </div>
          ))}
        </div>
      </section>

      {/* Free-row standard tiles */}
      <section>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.freeStandard}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
          {result.standardTech.free.map((id) => tileCell(id))}
        </div>
      </section>

      {/* Round scoring, rounds 1..6 */}
      <section>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.roundScoring}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
          {result.roundScoring.map((id, i) => tileCell(id, `${t.round}${i + 1}`))}
        </div>
      </section>

      {/* Final scoring, 2 of 6 */}
      <section>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.finalScoring}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
          {result.finalScoring.map((id) => tileCell(id))}
        </div>
      </section>

      {/* Boosters */}
      <section>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.boosters}</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>{t.available}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
          {result.boosters.available.map((id) => tileCell(id))}
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, margin: "10px 0 4px" }}>{t.unused}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, opacity: 0.55 }}>
          {result.boosters.unused.map((id) => tileCell(id))}
        </div>
      </section>
    </div>
  );
}
