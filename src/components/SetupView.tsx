// src/components/SetupView.tsx
"use client";

import React from "react";
import { buildSetupFromSeed, AVOID_RULES } from "@/gaia/setup/buildSetup";
import {
  readSharedExpansion,
  readSharedPlayers,
  writeSharedExpansion,
  writeSharedPlayers,
} from "@/lib/sharedSettings";
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
    extFaceModeLabel: "拡張部の面",
    extFaceAuto: "自動（人数で固定）",
    extFaceRandom: "ランダム",
    econFaceModeLabel: "経済調整タイル",
    econFaceRandom: "ランダム",
    avoidTitle: "配置回避（上級技術）",
    econFaceA: "面A（Lv3:鉱1クレ2パワー3／Lv4:鉱2クレ2パワー2）",
    econFaceB: "面B（Lv3:鉱1クレ3VP1／Lv4:鉱2クレ4VP1）",
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
    extFaceModeLabel: "Extension face",
    extFaceAuto: "Auto (by player count)",
    extFaceRandom: "Random",
    econFaceModeLabel: "Econ adjustment tile",
    econFaceRandom: "Random",
    avoidTitle: "Placement avoidance (advanced tech)",
    econFaceA: "Face A (L3: 1o 2c 3pw / L4: 2o 2c 2pw)",
    econFaceB: "Face B (L3: 1o 3c 1VP / L4: 2o 4c 1VP)",
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

/**
 * Ids whose physical tile is replaced by a Lost Fleet revision (the
 * planet-type symbol now includes the new planet kinds). The catalog keeps
 * one id per tile; only the image swaps to <id>_LF.png in LF mode.
 */
const LF_REVISED_IDS = new Set(["TS2", "AT15", "FS03"]);

/**
 * Tile image (public/setup-tiles/<imageId>.png). Falls back to nothing when
 * the id has no image, leaving the text caption to carry the cell.
 */
function TileImage({ imageId, alt }: { imageId: string; alt: string }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/setup-tiles/${imageId}.png`}
      alt={alt}
      onError={() => setFailed(true)}
      style={{ maxWidth: 110, maxHeight: 110, width: "auto", height: "auto", display: "block", borderRadius: 4 }}
    />
  );
}

type ExtFaceMode = "auto" | "random" | "vp25" | "shuttle";
type EconFaceMode = "random" | "A" | "B";

// Setup-only settings persisted across visits (the seed is deliberately NOT
// remembered, same as the map page's fixed-seed field). Players and expansion
// live in the shared keys (src/lib/sharedSettings.ts) used by both tabs.
const LS = {
  extFace: "gaia_setup_extface",
  econFace: "gaia_setup_econface",
  avoid: "gaia_setup_avoid",
} as const;

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export default function SetupView() {
  const [lang, setLang] = React.useState<Lang>("ja");
  const [seed, setSeed] = React.useState<string>("1");
  const [players, setPlayers] = React.useState<number>(4);
  const [mode, setMode] = React.useState<SetupMode>("base");
  const [extFaceMode, setExtFaceMode] = React.useState<ExtFaceMode>("auto");
  const [econFaceMode, setEconFaceMode] = React.useState<EconFaceMode>("random");
  const [avoid, setAvoid] = React.useState<string[]>([]);

  // Restore language (shared with the map page) and remembered settings.
  React.useEffect(() => {
    const v = lsGet("gaia_ui_lang");
    if (v === "ja" || v === "en") setLang(v);

    const m = readSharedExpansion();
    if (m) setMode(m);
    const p = readSharedPlayers();
    if (p) setPlayers(m === "lostFleet" ? Math.max(2, p) : p);
    const ef = lsGet(LS.extFace);
    if (ef === "auto" || ef === "random" || ef === "vp25" || ef === "shuttle") setExtFaceMode(ef);
    const ec = lsGet(LS.econFace);
    if (ec === "random" || ec === "A" || ec === "B") setEconFaceMode(ec);
    try {
      const raw = lsGet(LS.avoid);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setAvoid(arr.filter((x) => AVOID_RULES.some((r) => r.id === x)));
      }
    } catch {
      // ignore
    }
  }, []);

  // Remember settings (not the seed). Players/expansion go to the shared keys.
  React.useEffect(() => writeSharedExpansion(mode), [mode]);
  React.useEffect(() => writeSharedPlayers(players), [players]);
  React.useEffect(() => lsSet(LS.extFace, extFaceMode), [extFaceMode]);
  React.useEffect(() => lsSet(LS.econFace, econFaceMode), [econFaceMode]);
  React.useEffect(() => lsSet(LS.avoid, JSON.stringify(avoid)), [avoid]);

  const setLangPersist = React.useCallback((l: Lang) => {
    setLang(l);
    lsSet("gaia_ui_lang", l);
  }, []);

  const lf = mode === "lostFleet";

  const result = React.useMemo(
    () =>
      buildSetupFromSeed({
        seed,
        playerCount: players,
        ...(lf ? { mode: "lostFleet" as const } : {}),
        ...(lf && extFaceMode !== "auto" ? { extensionFaceMode: extFaceMode } : {}),
        ...(lf && econFaceMode !== "random" ? { econFaceMode } : {}),
        ...(avoid.length > 0 ? { avoidRules: avoid } : {}),
      }),
    [seed, players, lf, extFaceMode, econFaceMode, avoid]
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
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 4,
      }}
    >
      <TileImage imageId={lf && LF_REVISED_IDS.has(id) ? `${id}_LF` : id} alt={id} />
      <div>
        {tag ? <span style={{ opacity: 0.6, marginRight: 6 }}>{tag}</span> : null}
        <span style={{ fontFamily: "monospace", opacity: 0.7, marginRight: 6 }}>{id}</span>
        {labelOf(id, lang)}
      </div>
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
          <>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
              <span>{t.extFaceModeLabel}</span>
              <select value={extFaceMode} onChange={(e) => setExtFaceMode(e.target.value as ExtFaceMode)}>
                <option value="auto">{t.extFaceAuto}</option>
                <option value="random">{t.extFaceRandom}</option>
                <option value="vp25">{t.faceVp25}</option>
                <option value="shuttle">{t.faceShuttle}</option>
              </select>
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
              <span>{t.econFaceModeLabel}</span>
              <select value={econFaceMode} onChange={(e) => setEconFaceMode(e.target.value as EconFaceMode)}>
                <option value="random">{t.econFaceRandom}</option>
                <option value="A">{t.econFaceA}</option>
                <option value="B">{t.econFaceB}</option>
              </select>
            </label>
          </>
        ) : null}
      </div>

      {/* Placement avoidance (advanced tech; applies in both modes) */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
        <span style={{ fontWeight: 700 }}>{t.avoidTitle}</span>
        {AVOID_RULES.map((rule) => (
          <label key={rule.id} style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={avoid.includes(rule.id)}
              onChange={(e) =>
                setAvoid((prev) => (e.target.checked ? [...prev, rule.id] : prev.filter((x) => x !== rule.id)))
              }
            />
            <span>{lang === "ja" ? rule.label : rule.labelEn}</span>
          </label>
        ))}
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
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
              {tileCell(result.advancedTech.extension!, t.extensionAdv)}
              <div style={{ fontSize: 12, opacity: 0.85, display: "flex", flexDirection: "column", gap: 4 }}>
                <TileImage
                  imageId={result.extensionFace === "vp25" ? "FACE_EXT_VP25" : "FACE_EXT_SHUTTLE"}
                  alt="extension face"
                />
                {t.extensionFaceLabel}: {result.extensionFace === "vp25" ? t.faceVp25 : t.faceShuttle}
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, display: "flex", flexDirection: "column", gap: 4 }}>
                <TileImage imageId={result.econTileFace === "A" ? "FACE_ECON_A" : "FACE_ECON_B"} alt="econ face" />
                {t.econFace}: {result.econTileFace === "A" ? t.econFaceA : t.econFaceB}
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

      {/* Boosters (only the ones in play; unused ones go back to the box) */}
      <section>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.boosters}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
          {result.boosters.available.map((id) => tileCell(id))}
        </div>
      </section>
    </div>
  );
}
