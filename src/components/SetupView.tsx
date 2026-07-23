// src/components/SetupView.tsx
"use client";

import React from "react";
import { buildSetupFromSeed, AVOID_RULES, type BuildSetupInput } from "@/gaia/setup/buildSetup";
import {
  SETUP_HISTORY_CAP,
  deleteSavedSetup,
  listSavedSetups,
  recordSetup,
  setSetupPinned,
  setSetupUsed,
  setupHistoryId,
  type SavedSetup,
} from "@/lib/setupHistory";
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
    ruleOff: "設定なし",
    ruleAvoid: "回避",
    ruleForce: "強制",
    fedTag: "同盟タイル",
    econTag: "調整タイル",
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
    savedList: "保存リスト",
    savedListNote: `生成ごとに自動記録。ピン留め→新しい順。未ピン・未使用は${SETUP_HISTORY_CAP}件まで`,
    savedViewActive: "一覧",
    savedViewUsed: "使用済み",
    savedEmpty: "まだ記録がありません（「ランダム」を押すと自動で追加されます）",
    savedEmptyUsed: "使用済みはありません",
    recordCurrent: "この内容を記録",
    pin: "ピン留め",
    unpin: "ピン解除",
    markUsed: "使用済み",
    unmarkUsed: "使用済み解除",
    deleteRow: "削除",
    restoreHint: "クリックで表示",
    avoidShort: "回避",
    forceShort: "強制",
    currentBadge: "表示中",
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
    ruleOff: "Off",
    ruleAvoid: "Avoid",
    ruleForce: "Force",
    fedTag: "Federation",
    econTag: "Econ tile",
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
    savedList: "Saved setups",
    savedListNote: `Auto-recorded per roll. Pinned first, then newest. Unpinned/unused capped at ${SETUP_HISTORY_CAP}`,
    savedViewActive: "List",
    savedViewUsed: "Used",
    savedEmpty: "Nothing recorded yet (press Random to add)",
    savedEmptyUsed: "No used entries",
    recordCurrent: "Record current",
    pin: "Pin",
    unpin: "Unpin",
    markUsed: "Mark used",
    unmarkUsed: "Unmark used",
    deleteRow: "Delete",
    restoreHint: "Click to view",
    avoidShort: "avoid",
    forceShort: "force",
    currentBadge: "Shown",
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
      // alignSelf: flex 親の align-items:stretch で横に引き伸ばされて縦横比が
      // 崩れるのを防ぐ（経済調整タイル 212x349 が横長に見えていた不具合）
      style={{ maxWidth: 110, maxHeight: 110, width: "auto", height: "auto", display: "block", borderRadius: 4, alignSelf: "flex-start" }}
    />
  );
}

/**
 * タイル1枚のセル。説明文・IDは表示せず（ユーザー要望 2026-07-23）、
 * title 属性のネイティブツールチップでホバー時のみ「ID ラベル — 効果」を出す。
 * 画像が無い ID のみテキストにフォールバックする。
 */
function TileCellView({
  id,
  tag,
  lang,
  lf,
}: {
  id: string;
  tag?: string;
  lang: Lang;
  lf: boolean;
}) {
  const [failed, setFailed] = React.useState(false);
  const label = labelOf(id, lang);
  const effect = effectOf(id, lang);
  const tooltip = `${id} ${label}${effect ? ` — ${effect}` : ""}`;
  const imageId = lf && LF_REVISED_IDS.has(id) ? `${id}_LF` : id;
  return (
    <div
      title={tooltip}
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
      {tag ? <span style={{ fontSize: 11, opacity: 0.6 }}>{tag}</span> : null}
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/setup-tiles/${imageId}.png`}
          alt={id}
          onError={() => setFailed(true)}
          style={{ maxWidth: 110, maxHeight: 110, width: "auto", height: "auto", display: "block", borderRadius: 4, alignSelf: "flex-start" }}
        />
      ) : (
        <div>
          <span style={{ fontFamily: "monospace", opacity: 0.7, marginRight: 6 }}>{id}</span>
          {label}
        </div>
      )}
    </div>
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
  // ルールごとの三択（off はキー省略）。旧形式（回避IDの配列）は読み込み時に移行。
  const [ruleModes, setRuleModes] = React.useState<Record<string, "avoid" | "force">>({});

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
        const parsed = JSON.parse(raw);
        const valid = (x: unknown) => AVOID_RULES.some((r) => r.id === x);
        if (Array.isArray(parsed)) {
          // 旧形式（チェックボックス時代の回避ID配列）→ avoid として移行
          const modes: Record<string, "avoid" | "force"> = {};
          for (const id of parsed) if (valid(id)) modes[String(id)] = "avoid";
          setRuleModes(modes);
        } else if (parsed && typeof parsed === "object") {
          const modes: Record<string, "avoid" | "force"> = {};
          for (const [id, m] of Object.entries(parsed)) {
            if (valid(id) && (m === "avoid" || m === "force")) modes[id] = m;
          }
          setRuleModes(modes);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Persisting change handlers. Settings are written ONLY on user interaction —
  // a write-on-mount effect would race the restore effect above: under React
  // Strict Mode the mount effects run twice, so the first pass's write (still
  // holding the defaults) clobbers the stored values before the second pass
  // re-reads them, resetting the user's remembered settings. (Seen live as the
  // Setup tab forgetting the Map tab's players/expansion.)
  const changePlayers = React.useCallback((n: number) => {
    setPlayers(n);
    writeSharedPlayers(n);
  }, []);
  const changeMode = React.useCallback((m: SetupMode) => {
    setMode(m);
    writeSharedExpansion(m);
    if (m === "lostFleet") {
      setPlayers((p) => {
        const np = Math.max(2, p); // LF is 2..4 players
        writeSharedPlayers(np);
        return np;
      });
    }
  }, []);
  const changeExtFace = React.useCallback((v: ExtFaceMode) => {
    setExtFaceMode(v);
    lsSet(LS.extFace, v);
  }, []);
  const changeEconFace = React.useCallback((v: EconFaceMode) => {
    setEconFaceMode(v);
    lsSet(LS.econFace, v);
  }, []);
  const changeRuleMode = React.useCallback((ruleId: string, mode: "off" | "avoid" | "force") => {
    setRuleModes((prev) => {
      const next = { ...prev };
      if (mode === "off") delete next[ruleId];
      else next[ruleId] = mode;
      lsSet(LS.avoid, JSON.stringify(next));
      return next;
    });
  }, []);

  const setLangPersist = React.useCallback((l: Lang) => {
    setLang(l);
    lsSet("gaia_ui_lang", l);
  }, []);

  const lf = mode === "lostFleet";

  // 現在の条件からビルド入力を構築（無効時フィールド省略の鉄則）。
  // 表示用 useMemo と保存リストへの記録（同じ入力を保存する）で共用する。
  const buildInput = React.useCallback(
    (s: string): BuildSetupInput => {
      const avoidIds = Object.entries(ruleModes).filter(([, m]) => m === "avoid").map(([id]) => id);
      const forceIds = Object.entries(ruleModes).filter(([, m]) => m === "force").map(([id]) => id);
      return {
        seed: s,
        playerCount: players,
        ...(lf ? { mode: "lostFleet" as const } : {}),
        ...(lf && extFaceMode !== "auto" ? { extensionFaceMode: extFaceMode } : {}),
        ...(lf && econFaceMode !== "random" ? { econFaceMode } : {}),
        ...(avoidIds.length > 0 ? { avoidRules: avoidIds } : {}),
        ...(forceIds.length > 0 ? { forceRules: forceIds } : {}),
      };
    },
    [players, lf, extFaceMode, econFaceMode, ruleModes]
  );

  const result = React.useMemo(() => buildSetupFromSeed(buildInput(seed)), [seed, buildInput]);

  // ----- 保存リスト（ランキング骨組み: ピン留め→新しい順、TODO ⑧） -----
  const [saved, setSaved] = React.useState<SavedSetup[]>([]);
  const [savedView, setSavedView] = React.useState<"active" | "used">("active");

  // 復元は読み取りのみ（書込みはユーザー操作ハンドラのみの規律）。
  React.useEffect(() => {
    let alive = true;
    void listSavedSetups().then((rows) => {
      if (alive) setSaved(rows);
    });
    return () => {
      alive = false;
    };
  }, []);

  // 「生成」＝ランダムシードを引く＋その入力を自動記録。
  const handleRoll = React.useCallback(() => {
    const s = randomSeedString();
    setSeed(s);
    void recordSetup(buildInput(s)).then(setSaved);
  }, [buildInput]);

  // 手入力シードなど、表示中の内容を明示的に記録する補助ボタン。
  const handleRecordCurrent = React.useCallback(() => {
    void recordSetup(buildInput(seed)).then(setSaved);
  }, [buildInput, seed]);

  // 行クリックで保存時の入力を丸ごと復元（build は決定論的なので完全再現）。
  const restoreSaved = React.useCallback(
    (input: BuildSetupInput) => {
      changeMode(input.mode === "lostFleet" ? "lostFleet" : "base");
      changePlayers(input.playerCount ?? 4);
      changeExtFace(input.extensionFaceMode ?? "auto");
      changeEconFace(input.econFaceMode ?? "random");
      const modes: Record<string, "avoid" | "force"> = {};
      for (const id of input.avoidRules ?? []) modes[id] = "avoid";
      for (const id of input.forceRules ?? []) modes[id] = "force";
      setRuleModes(modes);
      lsSet(LS.avoid, JSON.stringify(modes));
      setSeed(input.seed);
    },
    [changeMode, changePlayers, changeExtFace, changeEconFace]
  );

  const currentId = React.useMemo(() => setupHistoryId(buildInput(seed)), [buildInput, seed]);

  const t = UI[lang];

  const tileCell = (id: string, tag?: string) => (
    <TileCellView key={id + (tag ?? "")} id={id} tag={tag} lang={lang} lf={lf} />
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
            <input type="radio" name="setupMode" checked={!lf} onChange={() => changeMode("base")} />
            <span>{t.modeBase}</span>
          </label>
          <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input type="radio" name="setupMode" checked={lf} onChange={() => changeMode("lostFleet")} />
            <span>{t.modeLF}</span>
          </label>
        </div>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span>{t.seed}</span>
          <input value={seed} onChange={(e) => setSeed(e.target.value)} style={{ width: 140, padding: "4px 6px" }} />
        </label>
        <button onClick={handleRoll} style={{ padding: "4px 10px", fontWeight: 700 }}>
          {t.randomSeed}
        </button>
        <button onClick={handleRecordCurrent} style={{ padding: "4px 10px", fontSize: 12 }}>
          {t.recordCurrent}
        </button>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span>{t.players}</span>
          <select value={players} onChange={(e) => changePlayers(Number(e.target.value))}>
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
              <select value={extFaceMode} onChange={(e) => changeExtFace(e.target.value as ExtFaceMode)}>
                <option value="auto">{t.extFaceAuto}</option>
                <option value="random">{t.extFaceRandom}</option>
                <option value="vp25">{t.faceVp25}</option>
                <option value="shuttle">{t.faceShuttle}</option>
              </select>
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
              <span>{t.econFaceModeLabel}</span>
              <select value={econFaceMode} onChange={(e) => changeEconFace(e.target.value as EconFaceMode)}>
                <option value="random">{t.econFaceRandom}</option>
                <option value="A">{t.econFaceA}</option>
                <option value="B">{t.econFaceB}</option>
              </select>
            </label>
          </>
        ) : null}
      </div>

      {/* Research tracks: per column, top to bottom —
          [track-top tile (terra=federation Lv5 / eco=econ adjustment face)]
          -> advanced -> standard -> placement rule pulldown (off/avoid/force) */}
      <section>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.researchTracks}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
          {RESEARCH_TRACK_IDS.map((track) => {
            const rule = AVOID_RULES.find((r) => r.track === track);
            const showEconTop = track === "eco" && lf && result.mode === "lostFleet";
            const econFaceLabel =
              showEconTop && result.mode === "lostFleet"
                ? result.econTileFace === "A"
                  ? t.faceA
                  : t.faceB
                : "";
            return (
              <div key={track} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>
                  {lang === "ja" ? TRACK_LABEL[track].ja : TRACK_LABEL[track].en}
                </div>
                {/* トラック上部スロット（列の縦位置を揃えるため全列で高さを確保） */}
                <div style={{ minHeight: 148, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  {track === "terra" ? tileCell(result.federationLv5, t.fedTag) : null}
                  {showEconTop && result.mode === "lostFleet" ? (
                    <div
                      title={result.econTileFace === "A" ? t.econFaceA : t.econFaceB}
                      style={{
                        border: "1px solid #ddd",
                        borderRadius: 8,
                        padding: "6px 8px",
                        fontSize: 12,
                        background: "#fafafa",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 11, opacity: 0.6 }}>{`${t.econTag} ${econFaceLabel}`}</span>
                      <TileImage
                        imageId={result.econTileFace === "A" ? "FACE_ECON_A" : "FACE_ECON_B"}
                        alt="econ face"
                      />
                    </div>
                  ) : null}
                </div>
                {tileCell(result.advancedTech.byTrack[track], t.advanced)}
                {tileCell(result.standardTech.byTrack[track], t.standard)}
                {rule ? (
                  <div
                    title={lang === "ja" ? rule.label : rule.labelEn}
                    style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    <span style={{ opacity: 0.7 }}>{lang === "ja" ? rule.shortLabel : rule.shortLabelEn}</span>
                    <select
                      value={ruleModes[rule.id] ?? "off"}
                      onChange={(e) => changeRuleMode(rule.id, e.target.value as "off" | "avoid" | "force")}
                      style={{ maxWidth: 150 }}
                    >
                      <option value="off">{t.ruleOff}</option>
                      <option value="avoid">{t.ruleAvoid}</option>
                      <option value="force">{t.ruleForce}</option>
                    </select>
                  </div>
                ) : null}
              </div>
            );
          })}
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

      {/* Federation Lv5 は研究トラック（テラフォーミング列上部）へ移動済み */}

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
              {/* 経済調整タイルは研究トラック（経済列上部）へ移動済み */}
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

      {/* Saved setups (ranking skeleton: pinned first -> newest; used in a separate view) */}
      <section>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>{t.savedList}</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>{t.savedListNote}</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6, fontSize: 12 }}>
            {(["active", "used"] as const).map((v) => {
              const count = saved.filter((r) => (v === "used") === r.used).length;
              return (
                <button
                  key={v}
                  onClick={() => setSavedView(v)}
                  style={{
                    padding: "3px 10px",
                    fontWeight: savedView === v ? 700 : 400,
                    background: savedView === v ? "#e8f0fe" : undefined,
                  }}
                >
                  {v === "active" ? t.savedViewActive : t.savedViewUsed} ({count})
                </button>
              );
            })}
          </div>
        </div>
        {(() => {
          const rows = saved.filter((r) => (savedView === "used") === r.used);
          if (rows.length === 0) {
            return (
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                {savedView === "used" ? t.savedEmptyUsed : t.savedEmpty}
              </div>
            );
          }
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {rows.map((r) => {
                const isCurrent = r.id === currentId;
                const nAvoid = r.input.avoidRules?.length ?? 0;
                const nForce = r.input.forceRules?.length ?? 0;
                const when = new Date(r.createdAt).toLocaleString(lang === "ja" ? "ja-JP" : "en-US", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      border: isCurrent ? "1px solid #7aa7e8" : "1px solid #ddd",
                      background: isCurrent ? "#f2f7ff" : "#fafafa",
                      borderRadius: 8,
                      padding: "4px 8px",
                      fontSize: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={() => restoreSaved(r.input)}
                      title={t.restoreHint}
                      style={{
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        padding: 0,
                        fontSize: 12,
                        textAlign: "left",
                        flex: 1,
                        minWidth: 220,
                      }}
                    >
                      {r.pinned ? <span title={t.pin}>📌</span> : null}
                      <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{r.input.seed}</span>
                      <span>{r.input.mode === "lostFleet" ? t.modeLF : t.modeBase}</span>
                      <span>
                        {t.players}: {r.input.playerCount ?? 4}
                      </span>
                      {nAvoid > 0 ? (
                        <span style={{ opacity: 0.7 }}>
                          {t.avoidShort}{nAvoid}
                        </span>
                      ) : null}
                      {nForce > 0 ? (
                        <span style={{ opacity: 0.7 }}>
                          {t.forceShort}{nForce}
                        </span>
                      ) : null}
                      <span style={{ opacity: 0.55 }}>{when}</span>
                      {isCurrent ? (
                        <span style={{ color: "#3467c4", fontWeight: 700 }}>{t.currentBadge}</span>
                      ) : null}
                    </button>
                    <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                      <button onClick={() => void setSetupPinned(r.id, !r.pinned).then(setSaved)} style={{ fontSize: 11 }}>
                        {r.pinned ? t.unpin : t.pin}
                      </button>
                      <button onClick={() => void setSetupUsed(r.id, !r.used).then(setSaved)} style={{ fontSize: 11 }}>
                        {r.used ? t.unmarkUsed : t.markUsed}
                      </button>
                      <button onClick={() => void deleteSavedSetup(r.id).then(setSaved)} style={{ fontSize: 11 }}>
                        {t.deleteRow}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </section>
    </div>
  );
}
