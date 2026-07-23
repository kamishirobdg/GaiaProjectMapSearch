// src/components/SetupView.tsx
"use client";

import React from "react";
import { buildSetupFromSeed } from "@/gaia/setup/buildSetup";
import { SETUP_CATALOG } from "@/gaia/setup/data";
import { RESEARCH_TRACK_IDS, type ResearchTrackId, type SetupMode, type ShipId } from "@/gaia/setup/types";

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

const SHIP_LABEL: Record<ShipId, { ja: string; en: string }> = {
  twilight: { ja: "トワイライト", en: "Twilight" },
  eclipse: { ja: "エクリプス", en: "Eclipse" },
  rebellion: { ja: "リベリオン", en: "Rebellion" },
  tfmars: { ja: "T.F.マーズ", en: "T.F. Mars" },
};

const UI = {
  ja: {
    title: "セットアップ（研究/ブースター/得点）",
    draftNote:
      "※ 全タイル（基本版・Lost Fleet）はルールブック・実物確認済み。評価機能は未実装。",
    seed: "シード",
    randomSeed: "ランダム",
    players: "人数",
    roll: "生成",
    modeBase: "基本版",
    modeLF: "Lost Fleet",
    randomExtFace: "拡張部の面をランダムにする（2ゲーム目以降ルール）",
    scoringExtension: "得点ボード拡張部",
    extensionAdv: "追加の上級技術",
    extensionFaceLabel: "面",
    faceVp25: "25勝利点面",
    faceShuttle: "探査シャトル面",
    econFace: "経済研究エリア調整タイル（ランダム面）",
    faceA: "面A",
    faceB: "面B",
    ships: "失われた艦隊の宇宙船",
    shipTechLabel: "基本技術",
    goldFed: "金枠同盟",
    artifactsLabel: "アーティファクト（トワイライト）",
    researchTracks: "研究トラック（上：上級 / 下：標準）",
    advanced: "上級",
    standard: "標準",
    freeStandard: "標準タイル（フリー枠）",
    boosters: "ラウンドブースター",
    available: "使用",
    unused: "未使用",
    roundScoring: "ラウンド得点",
    finalScoring: "最終得点計算",
    federationLv5: "同盟タイル（惑星改造 研究レベル5）",
    round: "R",
  },
  en: {
    title: "Setup (research / boosters / scoring)",
    draftNote:
      "Note: all tiles (base game & Lost Fleet) verified against the rulebook and physical components. Evaluation not implemented.",
    seed: "Seed",
    randomSeed: "Random",
    players: "Players",
    roll: "Roll",
    modeBase: "Base game",
    modeLF: "Lost Fleet",
    randomExtFace: "Randomize extension face (2nd-game-on rule)",
    scoringExtension: "Scoring board extension",
    extensionAdv: "Extra advanced tech",
    extensionFaceLabel: "Face",
    faceVp25: "25 VP face",
    faceShuttle: "Explorer shuttle face",
    econFace: "Economy adjustment tile (random face)",
    faceA: "Face A",
    faceB: "Face B",
    ships: "Lost Fleet ships",
    shipTechLabel: "Standard tech",
    goldFed: "Gold federation",
    artifactsLabel: "Artifacts (Twilight)",
    researchTracks: "Research tracks (top: advanced / bottom: standard)",
    advanced: "Adv",
    standard: "Std",
    freeStandard: "Standard tiles (free row)",
    boosters: "Round boosters",
    available: "Available",
    unused: "Unused",
    roundScoring: "Round scoring",
    finalScoring: "Final scoring",
    federationLv5: "Federation tile (Terraforming level 5)",
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
  SETUP_CATALOG.federations,
  SETUP_CATALOG.boostersLF,
  SETUP_CATALOG.roundScoringLF,
  SETUP_CATALOG.advancedTechLF,
  SETUP_CATALOG.standardTechLF,
  SETUP_CATALOG.finalScoringLF,
  SETUP_CATALOG.federationsGold,
  SETUP_CATALOG.artifacts,
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
  const [mode, setMode] = React.useState<SetupMode>("base");
  const [randomExtFace, setRandomExtFace] = React.useState<boolean>(false);

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

  const lf = mode === "lostFleet";

  const result = React.useMemo(
    () =>
      buildSetupFromSeed({
        seed,
        playerCount: players,
        ...(lf ? { mode: "lostFleet" as const } : {}),
        ...(lf && randomExtFace ? { randomExtensionFace: true } : {}),
      }),
    [seed, players, lf, randomExtFace]
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
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input type="radio" name="setupMode" checked={!lf} onChange={() => setMode("base")} />
            <span>{t.modeBase}</span>
          </label>
          <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="radio"
              name="setupMode"
              checked={lf}
              onChange={() => {
                setMode("lostFleet");
                setPlayers((p) => Math.max(2, p)); // LF is 2..4 players
              }}
            />
            <span>{t.modeLF}</span>
          </label>
        </div>
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
            {(lf ? [2, 3, 4] : [1, 2, 3, 4]).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {lf ? (
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
            <input type="checkbox" checked={randomExtFace} onChange={(e) => setRandomExtFace(e.target.checked)} />
            <span>{t.randomExtFace}</span>
          </label>
        ) : null}
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

      {/* Federation for Terraforming level 5, 1 of 6 types */}
      <section>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.federationLv5}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, maxWidth: 320 }}>
          {tileCell(result.federationLv5)}
        </div>
      </section>

      {/* Final scoring, 2 of 6 */}
      <section>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.finalScoring}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
          {result.finalScoring.map((id) => tileCell(id))}
        </div>
      </section>

      {/* Lost Fleet: scoring-board extension + ships + econ tile face */}
      {lf && result.mode === "lostFleet" ? (
        <>
          <section>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.scoringExtension}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {tileCell(result.advancedTech.extension!, t.extensionAdv)}
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {t.extensionFaceLabel}: {result.extensionFace === "vp25" ? t.faceVp25 : t.faceShuttle}
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {t.econFace}: {result.econTileFace === "A" ? t.faceA : t.faceB}
              </div>
            </div>
          </section>

          <section>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.ships}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 }}>
              {result.ships!.map((ship) => (
                <div key={ship} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>
                    {lang === "ja" ? SHIP_LABEL[ship].ja : SHIP_LABEL[ship].en}
                  </div>
                  {tileCell(result.goldFederations![ship]!, t.goldFed)}
                  {result.shipTech![ship] ? tileCell(result.shipTech![ship]!, t.shipTechLabel) : null}
                  {ship === "twilight" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontSize: 11, opacity: 0.65 }}>{t.artifactsLabel}</div>
                      {result.artifacts!.map((id) => tileCell(id))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

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
