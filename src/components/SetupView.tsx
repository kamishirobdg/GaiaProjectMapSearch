// src/components/SetupView.tsx
"use client";

import React from "react";
import {
  buildSetupFromSeed,
  defaultAdvancedTileRules,
  SHIP_DISTANCE_TECH,
  REBELLION_GOLD_TECH_FED,
  type BuildSetupInput,
} from "@/gaia/setup/buildSetup";
import {
  SETUP_HISTORY_CAP,
  countSetupsByCondition,
  deleteSavedSetup,
  deleteSetupsByCondition,
  listSavedSetups,
  recordSetup,
  setSetupPinned,
  setSetupUsed,
  setupConditionKey,
  setupHistoryId,
  type SavedSetup,
} from "@/lib/setupHistory";
import ConditionProfilesPanel from "@/components/ConditionProfilesPanel";
import {
  conditionKeyOf,
  deleteConditionProfile,
  listConditionProfiles,
  upsertConditionProfile,
  type ConditionProfile,
} from "@/lib/conditionProfiles";
import { STORE_SETUP_PROFILES, isDbUpgradeBlocked } from "@/app/board/persistence";
import { DEFAULT_SETUP_WEIGHTS, isDefaultWeights, type SetupWeights } from "@/gaia/eval/setupWeights";
import { copyText, decodeSetupToken, setupShareUrl } from "@/lib/setupShare";
import GlobalBar from "@/components/GlobalBar";
import FactionEvalPanel, {
  factionHomeBg,
  useColorPref,
  useSetupWeights,
  type SetupMarkRequest,
} from "@/components/FactionEvalPanel";
import {
  recommendSetups,
  scoreSetupFactions,
  topFactions,
  SETUP_COLOR_PREF_W,
  type Recommendation,
} from "@/gaia/eval/factionEval";
import { factionsForMode, type FactionDef } from "@/gaia/eval/factionWeights";
import {
  clearRanking,
  deleteRankingByCondition,
  listRanking,
  mergeRanking,
  SETUP_RANKING_CAP,
  type ScoredSetup,
} from "@/lib/setupRanking";
import { PageBody, SectionTitle, T, TwoCol } from "@/components/ui/layout";
import {
  readSharedExpansion,
  readSharedPlayers,
  resetStaleEvalScaleStorage,
  writeSharedExpansion,
  writeSharedPlayers,
  type Expansion,
} from "@/lib/sharedSettings";
import { SETUP_CATALOG } from "@/gaia/setup/data";
import { hasRule, setTileRule, type TileRuleMode, type TileRules } from "@/gaia/setup/tileRules";
import {
  RESEARCH_TRACK_IDS,
  TECH_SHIP_IDS,
  type PlanetColorKey,
  type ResearchTrackId,
  type SetupMode,
  type SetupResult,
  type ShipId,
} from "@/gaia/setup/types";

type Lang = "ja" | "en";

// Muaked/Tinkerroid satellite colors: swatch + label per base planet color.
// Swatches mirror the map side's palette (BreakdownTable PLANET_INPUT_BG); a
// darker ink keeps light swatches (white/yellow) readable.
const PLANET_COLOR_STYLE: Record<PlanetColorKey, { bg: string; ja: string; en: string }> = {
  BLACK: { bg: "#adadad", ja: "黒", en: "Black" },
  BLUE: { bg: "#cfe8ff", ja: "青", en: "Blue" },
  BROWN: { bg: "#e7d3b1", ja: "茶", en: "Brown" },
  ORANGE: { bg: "#ffe0b2", ja: "橙", en: "Orange" },
  RED: { bg: "#ffd2d2", ja: "赤", en: "Red" },
  WHITE: { bg: "#ffffff", ja: "白", en: "White" },
  YELLOW: { bg: "#fff9c4", ja: "黄", en: "Yellow" },
};

/**
 * 一括探索（2026-07-31）。いまの条件で大量に生成して基準の良い順に並べる。
 * 基準はマップ非依存のものだけ（マップ依存の逆優位・優位は List タブの担当）。
 */
const BULK_CRITERIA = ["topBalance", "neutralBalance"] as const;
type BulkCriterion = (typeof BULK_CRITERIA)[number];
/** 条件×基準ごとに保存・表示する件数（setupRanking の保存上限と揃える）。 */
const BULK_TOP_N = SETUP_RANKING_CAP;
/** 1チャンクの生成数。0.25ms/件なので 250件≒60ms でUIを明け渡せる。 */
const BULK_CHUNK = 250;
const BULK_TRIALS_MAX = 5000;
const BULK_TRIALS_DEFAULT = 1000;

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
    searchConds: "検索条件",
    setupArea: "セットアップ",
    satellites: "衛星駒の順（モウェイド人／ティンカーロイド）",
    satellitesNote: "惑星改造ボードの7スペースに置く色順（番号順）。勢力選択とは独立。",
    draftNote:
      "※ 全タイル（基本版・Lost Fleet）はルールブック・実物確認済み。種族別評価の重みは 仮設定。",
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
    ruleForceRandom: "強制：ランダム",
    ruleAllow: "許容",
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
    researchTracks: "研究トラック",
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
    bulkTitle: "一括探索",
    bulkNote: `いまの条件で大量に生成して基準の良い順に上位${BULK_TOP_N}件を保存。次の探索は前回の上位とマージする。行をクリックすると表示`,
    bulkTrials: "件数",
    bulkCriterion: "基準",
    bulkRun: "探索",
    bulkStop: "中止",
    bulkClear: "消去",
    bulkEmpty: "まだ探索していません",
    bulkResultHead: "上位",
    bulkScore: "基準値",
    bulkTopFactions: "強い種族",
    bulkRecord: "記録",
    bulkRecorded: "記録済み",
    critTopBalance: "上位バランス（人数+2種族が拮抗）",
    critNeutralBalance: "全体バランス（全種族が拮抗）",
    pin: "ピン留め",
    unpin: "ピン解除",
    markUsed: "使用済み",
    unmarkUsed: "使用済み解除",
    deleteRow: "削除",
    restoreHint: "クリックで表示",
    avoidShort: "回避",
    forceShort: "強制",
    currentBadge: "表示中",
    warnDistForceDup: "「基本到達距離＋1」の強制は1隻のみ適用されます（先頭の船が優先）",
    warnDistAvoidAll: "3人以上では3隻すべての回避は満たせません（満たせない分は無視）",
    shareRow: "共有",
    shareCopied: "コピーしました",
    pickNotePositional: "この枠に入れるタイルを指定します（固定は1枚）",
    pickNoteMembership: "この枠は順不同です。固定＝必ず場に出す",
    pickClear: "この枠の指定を全部消す",
    pickClose: "閉じる",
    modeDefault: "指定なし",
    modeFix: "固定",
    modeInclude: "含む",
    modeCandidate: "候補",
    modeExclude: "除外",
  },
  en: {
    title: "Setup (research / boosters / scoring)",
    searchConds: "Search conditions",
    setupArea: "Setup",
    satellites: "Satellite order (Muaked / Tinkerroid)",
    satellitesNote: "Color order for the 7 planet-transform board spaces (by number). Independent of faction choice.",
    draftNote:
      "Note: all tiles (base game & Lost Fleet) verified against the rulebook and physical components. Faction weights are DRAFT (under review).",
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
    ruleForceRandom: "Force: random",
    ruleAllow: "Allow",
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
    researchTracks: "Research tracks",
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
    bulkTitle: "Bulk search",
    bulkNote: `Generates many setups under the current conditions and keeps the best ${BULK_TOP_N}; the next search merges with them. Click a row to show it`,
    bulkTrials: "Trials",
    bulkCriterion: "Criterion",
    bulkRun: "Search",
    bulkStop: "Stop",
    bulkClear: "Clear",
    bulkEmpty: "No search yet",
    bulkResultHead: "Top",
    bulkScore: "Score",
    bulkTopFactions: "Strong factions",
    bulkRecord: "Record",
    bulkRecorded: "Recorded",
    critTopBalance: "Top balance (players+2 factions close)",
    critNeutralBalance: "Overall balance (all factions close)",
    pin: "Pin",
    unpin: "Unpin",
    markUsed: "Mark used",
    unmarkUsed: "Unmark used",
    deleteRow: "Delete",
    restoreHint: "Click to view",
    avoidShort: "avoid",
    forceShort: "force",
    currentBadge: "Shown",
    warnDistForceDup: "Only one ship can force \"Base range +1\" (first ship wins)",
    warnDistAvoidAll: "With 3+ players, avoiding it on all three ships cannot be satisfied (unmet ones are ignored)",
    shareRow: "Share",
    shareCopied: "Copied",
    pickNotePositional: "Constrain which tile lands in this slot (one pin)",
    pickNoteMembership: "This slot is unordered. Pin = always in play",
    pickClear: "Clear this slot",
    pickClose: "Close",
    modeDefault: "Any",
    modeFix: "Pin",
    modeInclude: "Include",
    modeCandidate: "Candidate",
    modeExclude: "Exclude",
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

/**
 * タイルを「似た挙動」でまとめるための並び順（2026-07-30 要望）。
 * カタログの配列そのものは触らない —— 配列順はシャッフルの入力なので、
 * 並べ替えると同じシードの出目が全部変わってしまう。表示だけを並べ替える。
 *
 * 判定はラベル（「収入：」「即時：」など規則的に付いている）を主、
 * 無い場合は効果文のキーワードで補う。
 */
// 並び順: 収入 → 即時獲得 → アクション → パス時 → 条件トリガー → 順位 → その他
function behaviorGroupIndex(tileId: string): number {
  const t = BY_ID.get(tileId);
  const label = (t?.label ?? "").replace(/^(金枠同盟|同盟)：/, "");
  const text = `${label} ${t?.effect ?? ""}`;
  if (/^収入/.test(label) || /各収入フェイズ/.test(text)) return 0;
  if (/^(即時|取得時)/.test(label) || /このタイルを取ったとき|即座に/.test(text)) return 1;
  if (/^アクション/.test(label) || /ラウンドごとに1回/.test(text)) return 2;
  if (/^パス時/.test(label) || /パスしたとき/.test(text)) return 3;
  if (/たび/.test(text)) return 4;
  if (/最大|最低/.test(label)) return 5;
  return 6;
}

/** 挙動グループ順に並べ替える（同グループ内はカタログ順で安定）。 */
function sortTilesByBehavior(ids: string[]): string[] {
  return ids
    .map((id, i) => ({ id, i, g: behaviorGroupIndex(id) }))
    .sort((a, b) => a.g - b.g || a.i - b.i)
    .map((x) => x.id);
}

function randomSeedString(): string {
  return Math.floor(Math.random() * 2147483647 + 1).toString();
}

// ----- 一括探索のランキング表示（2026-07-31）-----
const bulkTh: React.CSSProperties = {
  border: "1px solid #eee",
  padding: "3px 6px",
  background: "#f7f7f7",
  fontWeight: 700,
  whiteSpace: "nowrap",
};
const bulkTd: React.CSSProperties = { border: "1px solid #eee", padding: "3px 6px" };

/**
 * その行で強い種族トップ3。基本版では LF4種族を除く（選べないため）。
 * 保存済みランキングは入力しか持たないので、ここで組み立て直して評価する
 * （生成は 0.25ms/件 なので20行でも数ミリ秒）。
 */
function bulkTopText(
  row: ScoredSetup,
  lf: boolean,
  lang: Lang,
  weights: SetupWeights
): string {
  const defs = factionsForMode(lf);
  const label = (id: string) => {
    const f = defs.find((x) => x.id === id);
    return f ? (lang === "ja" ? f.labelJa : f.labelEn) : id;
  };
  const scores = scoreSetupFactions(buildSetupFromSeed(row.input), weights);
  return topFactions(scores, 3, lf)
    .map((id) => `${label(id)} ${Math.round(scores[id])}`)
    .join(" / ");
}

/**
 * Ids whose physical tile is replaced by a Lost Fleet revision (the
 * planet-type symbol now includes the new planet kinds). The catalog keeps
 * one id per tile; only the image swaps to <id>_LF.png in LF mode.
 */
const LF_REVISED_IDS = new Set(["TS2", "AT15", "FS03"]);

/**
 * タイル1枚ぶんの枠幅（2026-07-31）。TileImage の maxWidth 110 に
 * TileCellView の padding(8+8) と border(1+1) を足した実寸。
 * 研究トラックの列幅と船カードの幅をこれに合わせて、余白いっぱいに
 * 引き伸ばさないようにする。
 */
const TILE_COL_W = 128;
/**
 * 船カードの中身の幅。box-sizing は content-box なので、カード自身の
 * padding(8+8) と border(1+1) は width に含めず外側に付く（外形は 146px）。
 */
const SHIP_CARD_W = TILE_COL_W;

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
 * 枠は fit-content で画像幅にぴったり合わせる（横幅を取りすぎない、2026-07-23）。
 * full=true は原寸表示（ブースター・最終得点。縮小させない）。
 */
function TileCellView({
  id,
  tag,
  lang,
  lf,
  full,
  mark,
  onPick,
  pinned,
  pickLabel,
}: {
  id: string;
  tag?: string;
  lang: Lang;
  lf: boolean;
  full?: boolean;
  /** 光らせる色（未指定なら光らせない）。要素自体を縁取るのでレイアウト非依存。 */
  mark?: string;
  /** クリックでそのスロットの指定パネルを開く */
  onPick?: () => void;
  /** そのスロットに指定が入っているか（バッジ表示用） */
  pinned?: boolean;
  pickLabel?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const label = labelOf(id, lang);
  const effect = effectOf(id, lang);
  const tooltip = `${id} ${label}${effect ? ` — ${effect}` : ""}`;
  const imageId = lf && LF_REVISED_IDS.has(id) ? `${id}_LF` : id;
  return (
    <div
      title={onPick ? `${tooltip}
${pickLabel ?? ""}` : tooltip}
      data-tile-id={id}
      onClick={onPick}
      className={mark ? "setup-tile-marked" : undefined}
      style={{
        cursor: onPick ? "pointer" : undefined,
        border: mark ? `2px solid ${mark}` : pinned ? "1px solid #8fc79f" : "1px solid #ddd",
        borderRadius: 8,
        padding: mark ? "5px 7px" : "6px 8px",
        fontSize: 12,
        // 指定のある枠はひと目で分かるように背景を変える（2026-07-30 要望）
        background: pinned ? "#e7f6ea" : "#fafafa",
        minWidth: 0,
        width: "fit-content",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 4,
        ...(mark ? { boxShadow: `0 0 0 3px ${mark}55`, outline: "none" } : {}),
      }}
    >
      {tag || pinned ? (
        <span style={{ fontSize: 11, opacity: 0.7, display: "flex", gap: 4, alignItems: "center" }}>
          {tag ?? ""}
          {pinned ? <span title={pickLabel} style={{ color: "#1b6b2f", fontWeight: 700 }}>指定</span> : null}
        </span>
      ) : null}
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/setup-tiles/${imageId}.png`}
          alt={id}
          onError={() => setFailed(true)}
          style={{
            ...(full ? {} : { maxWidth: 110, maxHeight: 110 }),
            width: "auto",
            height: "auto",
            display: "block",
            borderRadius: 4,
            alignSelf: "flex-start",
          }}
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

// 既定はランダム。"auto"（人数依存）は面ピッカー導入時に廃止（2026-07-30）。
type ExtFaceMode = "random" | "vp25" | "shuttle";
type EconFaceMode = "random" | "A" | "B";


// Setup-only settings persisted across visits (the seed is deliberately NOT
// remembered, same as the map page's fixed-seed field). Players and expansion
// live in the shared keys (src/lib/sharedSettings.ts) used by both tabs.
const LS = {
  extFace: "gaia_setup_extface",
  econFace: "gaia_setup_econface",
  tileRules: "gaia_setup_tilerules",
  bulkTrials: "gaia_setup_bulk_trials",
  bulkCriterion: "gaia_setup_bulk_criterion",
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

// タブ遷移時の「デフォルト→復元」ちらつきを消すため、復元は paint 前に走る
// layout effect で行う（SSRでは useEffect にフォールバック）。2026-07-24。
const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

// --- 縮小セットアップ盤面（List の提案プレビュー用・読み取り専用）。2026-07-24 ---
function SmallTile({ id, lang, lf, size }: { id: string; lang: Lang; lf: boolean; size: number }) {
  const [failed, setFailed] = React.useState(false);
  if (!id) return null;
  const imageId = lf && LF_REVISED_IDS.has(id) ? `${id}_LF` : id;
  const label = labelOf(id, lang);
  const effect = effectOf(id, lang);
  const tooltip = `${id} ${label}${effect ? ` — ${effect}` : ""}`;
  if (failed) {
    return (
      <span title={tooltip} style={{ fontSize: 9, border: "1px solid #ddd", borderRadius: 3, padding: "1px 3px", background: "#fafafa" }}>
        {id}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/setup-tiles/${imageId}.png`}
      alt={id}
      title={tooltip}
      onError={() => setFailed(true)}
      style={{ maxWidth: size, maxHeight: size, width: "auto", height: "auto", display: "block", borderRadius: 3 }}
    />
  );
}

/** SetupResult を小さなタイル画像でコンパクトに描画する読み取り専用ボード。 */
export function SetupBoard({ result, lang, compact }: { result: SetupResult; lang: Lang; compact?: boolean }) {
  const lf = result.mode === "lostFleet";
  const size = compact ? 54 : 96;
  const row: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 4, alignItems: "flex-start" };
  const head: React.CSSProperties = { fontSize: 10, fontWeight: 700, opacity: 0.6, marginBottom: 2 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 11 }}>
      {/* 研究トラック（各列: 上=Fed Lv5(terra) / 上級 / 標準） */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
        {RESEARCH_TRACK_IDS.map((track) => (
          <div key={track} style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
            <div style={{ fontSize: 9, opacity: 0.6 }}>{lang === "ja" ? TRACK_LABEL[track].ja : TRACK_LABEL[track].en}</div>
            {track === "terra" ? <SmallTile id={result.federationLv5} lang={lang} lf={lf} size={size} /> : null}
            <SmallTile id={result.advancedTech.byTrack[track]} lang={lang} lf={lf} size={size} />
            <SmallTile id={result.standardTech.byTrack[track]} lang={lang} lf={lf} size={size} />
          </div>
        ))}
      </div>

      {result.standardTech.free && result.standardTech.free.length > 0 ? (
        <div>
          <div style={head}>free tech</div>
          <div style={row}>{result.standardTech.free.map((id, i) => <SmallTile key={`f${i}`} id={id} lang={lang} lf={lf} size={size} />)}</div>
        </div>
      ) : null}

      <div>
        <div style={head}>scoring</div>
        <div style={row}>
          {result.roundScoring.map((id, i) => <SmallTile key={`r${i}`} id={id} lang={lang} lf={lf} size={size} />)}
          {result.finalScoring.map((id, i) => <SmallTile key={`fs${i}`} id={id} lang={lang} lf={lf} size={size} />)}
        </div>
      </div>

      <div>
        <div style={head}>boosters</div>
        <div style={row}>{result.boosters.available.map((id, i) => <SmallTile key={`b${i}`} id={id} lang={lang} lf={lf} size={size} />)}</div>
      </div>

      {lf && result.ships ? (
        <div>
          <div style={head}>LF ships</div>
          <div style={row}>
            {result.advancedTech.extension ? <SmallTile id={result.advancedTech.extension} lang={lang} lf={lf} size={size} /> : null}
            {result.ships.map((ship) => (
              <React.Fragment key={ship}>
                {result.goldFederations?.[ship] ? <SmallTile id={result.goldFederations[ship]!} lang={lang} lf={lf} size={size} /> : null}
                {result.shipTech?.[ship] ? <SmallTile id={result.shipTech[ship]!} lang={lang} lf={lf} size={size} /> : null}
              </React.Fragment>
            ))}
            {(result.artifacts ?? []).map((id, i) => <SmallTile key={`a${i}`} id={id} lang={lang} lf={lf} size={size} />)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function SetupView() {
  const [lang, setLang] = React.useState<Lang>("ja");
  const [seed, setSeed] = React.useState<string>("1");
  const [players, setPlayers] = React.useState<number>(4);
  const [mode, setMode] = React.useState<SetupMode>("base");
  const [extFaceMode, setExtFaceMode] = React.useState<ExtFaceMode>("random");
  const [econFaceMode, setEconFaceMode] = React.useState<EconFaceMode>("random");
  // 全スロット共通のタイル指定（固定/除外/候補）。2026-07-30。
  // 既定は「上級技術のキュレーション済み除外」入り（2026-07-30 ユーザー確定）。
  const [tileRules, setTileRules] = React.useState<TileRules>(() => defaultAdvancedTileRules());
  // ----- 一括探索（2026-07-31）-----
  //
  // Map の検索と同じ体験（大量生成 → 上位をランキング）。Map は評価が重いので
  // ワーカーへ出しているが、こちらは 0.25ms/件 と軽いので、UI を止めないための
  // チャンク分割だけで足りる（250件ごとに setTimeout で明け渡す）。
  //
  // チャンクごとの上位N件を集めて最後にN件へ絞る。基準値は1件だけで決まる
  // （他の候補に依存しない）ので、この畳み込みで全体の上位Nと一致する
  // （factionEval.test.ts で固定）。
  // 復元effect（下の useIsoLayoutEffect）から触るので、宣言はそれより前に置く。
  const [bulkTrials, setBulkTrials] = React.useState<number>(BULK_TRIALS_DEFAULT);
  const [bulkCriterion, setBulkCriterion] = React.useState<BulkCriterion>("topBalance");
  const [bulkRows, setBulkRows] = React.useState<ScoredSetup[]>([]);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [bulkDone, setBulkDone] = React.useState(0);
  const [bulkTotal, setBulkTotal] = React.useState(0);
  const [bulkRecordedIds, setBulkRecordedIds] = React.useState<Set<string>>(() => new Set());
  /** 走っているチャンクループを止める（中止ボタン／条件変更）。 */
  const bulkStopRef = React.useRef(false);
  /**
   * 表示コンテキストの世代。条件・基準・評価指数が変わるか「消去」した時点で進める。
   * 走っている探索は結果の保存までは必ずやるが、世代がズレていたら画面は触らない
   * （中止ボタンで止めた場合は世代が同じなので、そこまでの上位が画面に出る）。
   */
  const bulkGenRef = React.useRef(0);
  /** 面（経済調整タイル・得点ボード拡張部）の選択パネル。 */
  const [facePicker, setFacePicker] = React.useState<"econ" | "ext" | null>(null);
  /** どのスロットの指定パネルを開いているか。 */
  const [picker, setPicker] = React.useState<{
    slotId: string;
    title: string;
    pool: string[];
    singleFix: boolean;
  } | null>(null);
  // 共有リンクトークンの捕捉（null=未捕捉、""=なし）。ボードの pendingHashRef と同型。
  const pendingShareRef = React.useRef<string | null>(null);
  // 共有ボタンの「コピーしました」表示対象行
  const [sharedCopiedId, setSharedCopiedId] = React.useState<string | null>(null);

  // 保存/共有された入力を丸ごと画面へ反映（build は決定論的なので完全再現）。
  // persist=false は共有リンク閲覧用: 受け手の記憶設定（localStorage・共有キー）
  // を書き換えずに表示だけ差し替える。
  const applyInput = React.useCallback((input: BuildSetupInput, persist: boolean) => {
    const m: SetupMode = input.mode === "lostFleet" ? "lostFleet" : "base";
    const p = Math.max(m === "lostFleet" ? 2 : 1, Math.min(4, input.playerCount ?? 4));
    setMode(m);
    setPlayers(p);
    setExtFaceMode(input.extensionFaceMode ?? "random");
    setEconFaceMode(input.econFaceMode ?? "random");
    const tr = (input as any).tileRules ?? {};
    setTileRules(tr);
    setSeed(input.seed);
    if (persist) {
      writeSharedExpansion(m);
      writeSharedPlayers(p);
      lsSet(LS.extFace, input.extensionFaceMode ?? "random");
      lsSet(LS.econFace, input.econFaceMode ?? "random");
      lsSet(LS.tileRules, JSON.stringify(tr));
    }
  }, []);

  // Restore language (shared with the map page) and remembered settings.
  useIsoLayoutEffect(() => {
    // 旧スケールの評価指数・結果を捨てる（読む前に1回。2026-07-31）
    resetStaleEvalScaleStorage();
    const v = lsGet("gaia_ui_lang");
    if (v === "ja" || v === "en") setLang(v);

    const m = readSharedExpansion();
    if (m) setMode(m);
    const p = readSharedPlayers();
    if (p) setPlayers(m === "lostFleet" ? Math.max(2, p) : p);
    const ef = lsGet(LS.extFace);
    if (ef === "random" || ef === "vp25" || ef === "shuttle") setExtFaceMode(ef);
    const ec = lsGet(LS.econFace);
    if (ec === "random" || ec === "A" || ec === "B") setEconFaceMode(ec);
    const bt = Number(lsGet(LS.bulkTrials));
    if (Number.isFinite(bt) && bt >= 1) setBulkTrials(Math.min(BULK_TRIALS_MAX, Math.floor(bt)));
    const bc = lsGet(LS.bulkCriterion);
    if (bc === "topBalance" || bc === "neutralBalance") setBulkCriterion(bc);
    // 共有リンク（?s=）: マップの ?h= と同じ作法。初回にトークンを ref へ捕捉して
    // アドレスバーから除去し（Strict Mode の2回目実行でも ref から再適用）、
    // 上の localStorage 復元より後に view-only で上書きする。
    try {
      if (pendingShareRef.current === null) {
        const sp = new URLSearchParams(window.location.search);
        pendingShareRef.current = sp.get("s") ?? "";
        if (sp.get("s") !== null) {
          sp.delete("s");
          const qs = sp.toString();
          window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
        }
      }
      const tok = pendingShareRef.current;
      if (tok) {
        const input = decodeSetupToken(tok);
        if (input) applyInput(input, false);
      }
    } catch {
      // ignore
    }
  }, [applyInput]);

  // Persisting change handlers. Settings are written ONLY on user interaction —
  // a write-on-mount effect would race the restore effect above: under React
  // Strict Mode the mount effects run twice, so the first pass's write (still
  // holding the defaults) clobbers the stored values before the second pass
  // re-reads them, resetting the user's remembered settings. (Seen live as the
  // Setup tab forgetting the Map tab's players/expansion.)
  // 人数/拡張(基本版/LF)の変更は共通バー onGlobalSelect が担当（下部で定義）。
  const changeExtFace = React.useCallback((v: ExtFaceMode) => {
    setExtFaceMode(v);
    lsSet(LS.extFace, v);
  }, []);
  const changeEconFace = React.useCallback((v: EconFaceMode) => {
    setEconFaceMode(v);
    lsSet(LS.econFace, v);
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
      // 船ルールは TECH_SHIP_IDS 順で安定化（キーの一部になるため）
      return {
        seed: s,
        playerCount: players,
        ...(lf ? { mode: "lostFleet" as const } : {}),
        // 既定（どちらも random）はフィールドごと省略する。既定のままの条件が
        // 「推奨条件」と判定されるようにするため（2026-07-30 修正）。
        ...(lf && extFaceMode !== "random" ? { extensionFaceMode: extFaceMode } : {}),
        ...(lf && econFaceMode !== "random" ? { econFaceMode } : {}),
        ...(Object.keys(tileRules).length > 0 ? { tileRules } : {}),
      };
    },
    [players, lf, extFaceMode, econFaceMode, tileRules]
  );

  const result = React.useMemo(() => buildSetupFromSeed(buildInput(seed)), [seed, buildInput]);

  // 評価指数（カテゴリ別係数）。List タブと localStorage を共有する。
  const [evalWeights, changeEvalWeight, resetEvalWeights, setAllEvalWeights] = useSetupWeights();
  // 色優遇/冷遇（母星色ごと。2026-07-31）。一括探索の並びにだけ効く。
  const [colorPref, changeColorPref, resetColorPref, setAllColorPref] = useColorPref();
  /** criterionScore へ渡す形。指定が無ければ undefined＝素通り。 */
  const colorPrefArg = React.useMemo(
    () =>
      Object.keys(colorPref).length > 0
        ? { w: SETUP_COLOR_PREF_W, byColor: colorPref as Record<string, number> }
        : undefined,
    [colorPref]
  );

  /**
   * いまの「条件」。シードだけを除いたビルド入力＋評価指数（2026-07-30）。
   * Map の searchKey と同じ考え方で、この内容から決まるキーで結果が分かれる。
   * 無効時フィールド省略は buildInput 側で守られているので、そのまま使える。
   */
  const conditionParams = React.useMemo(() => {
    const input = buildInput("") as any;
    delete input.seed;
    return { setup: input, evalWeights };
  }, [buildInput, evalWeights]);
  /** 条件プロファイルのキー（評価指数まで含む。同じ設定で指数違いを別名保存できる）。 */
  const conditionKey = React.useMemo(() => conditionKeyOf(conditionParams), [conditionParams]);
  /**
   * 結果バケツのキーは「セットアップの設定だけ」。生成されるセットアップは
   * 評価指数に依存しない（指数は評価・表示にしか効かない）ので、指数を変えても
   * 貯めた結果が見えなくならないようにする。
   */
  const bucketKey = React.useMemo(() => setupConditionKey(buildInput("")), [buildInput]);

  // ----- 保存リスト（ランキング骨組み: ピン留め→新しい順、TODO ⑧） -----
  const [saved, setSaved] = React.useState<SavedSetup[]>([]);
  const [savedView, setSavedView] = React.useState<"active" | "used">("active");
  const [profiles, setProfiles] = React.useState<Array<ConditionProfile<typeof conditionParams>>>([]);

  const [dbBlocked, setDbBlocked] = React.useState(false);

  /**
   * 評価表クリックで光らせるタイル（2026-07-30）。Map の #9 マーカーと同じ操作:
   * 単独クリックで置換、同じ所を再クリックで解除、Ctrl で複数選択。
   * タイルIDで持つので、レイアウトが変わっても該当タイルに付いて回る。
   */
  const [markSources, setMarkSources] = React.useState<Map<string, SetupMarkRequest>>(new Map());
  const onMark = React.useCallback((sourceId: string, req: SetupMarkRequest, additive: boolean) => {
    setMarkSources((prev) => {
      if (additive) {
        const next = new Map(prev);
        if (next.has(sourceId)) next.delete(sourceId);
        else next.set(sourceId, req);
        return next;
      }
      if (prev.has(sourceId) && prev.size === 1) return new Map();
      return new Map([[sourceId, req]]);
    });
  }, []);
  const activeSources = React.useMemo(() => new Set(markSources.keys()), [markSources]);
  /** タイルID -> 色。複数ソースが同じタイルを指したら先に選んだ色を使う。 */
  const markedTiles = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const req of markSources.values()) {
      for (const id of req.tileIds) if (!m.has(id)) m.set(id, req.color);
    }
    return m;
  }, [markSources]);

  /**
   * 「既定値のままの条件」か。人数・拡張は使う人の選択なので判定に含めず、
   * ルール類と評価指数だけを見る。既定値を変えたら自動的に追随する
   * （固定の名前を保存しない＝今の既定と比べる。2026-07-30 要望）。
   */
  const isDefaultParams = React.useCallback((params: typeof conditionParams) => {
    const su: any = (params as any)?.setup ?? {};
    const noRules =
      !su.avoidRules?.length &&
      !su.forceRules?.length &&
      Object.keys(su.forceTileRules ?? {}).length === 0 &&
      Object.keys(su.allowTileRules ?? {}).length === 0 &&
      !su.shipDistanceAvoid?.length &&
      !su.shipDistanceForce?.length &&
      !su.rebellionGoldFed &&
      su.extensionFaceMode === undefined &&
      su.econFaceMode === undefined &&
      JSON.stringify(su.tileRules ?? defaultAdvancedTileRules()) ===
        JSON.stringify(defaultAdvancedTileRules());
    const w = (params as any)?.evalWeights;
    return noRules && (!w || isDefaultWeights({ ...DEFAULT_SETUP_WEIGHTS, ...w }));
  }, []);

  const refreshProfiles = React.useCallback(async () => {
    const [rows, counts] = await Promise.all([
      listConditionProfiles<typeof conditionParams>(STORE_SETUP_PROFILES),
      countSetupsByCondition(),
    ]);
    // 件数は「その条件の設定が指す結果バケツ」から引く（キーの粒度が違うため）。
    setDbBlocked(isDbUpgradeBlocked());
    setProfiles(
      rows.map((r) => {
        const su = (r.params as any)?.setup ?? {};
        const bk = setupConditionKey({ ...su, seed: "" } as BuildSetupInput);
        return { ...r, resultCount: counts[bk] ?? 0 };
      })
    );
  }, []);

  /** 条件プロファイルを適用する（保存された条件を画面へ戻す）。 */
  const applyProfile = React.useCallback(
    (p: ConditionProfile<typeof conditionParams>) => {
      const setup = (p.params as any)?.setup ?? {};
      applyInput({ ...setup, seed } as BuildSetupInput, true);
      const w = (p.params as any)?.evalWeights as SetupWeights | undefined;
      setAllEvalWeights({ ...DEFAULT_SETUP_WEIGHTS, ...(w ?? {}) });
    },
    [applyInput, seed, setAllEvalWeights]
  );

  /** 条件を既定値へ戻す（結果は消さない）。Map の「既定値で新規」と同じ役割。 */
  const resetConditions = React.useCallback(() => {
    setExtFaceMode("random");
    lsSet(LS.extFace, "random");
    setEconFaceMode("random");
    lsSet(LS.econFace, "random");
    const dtr = defaultAdvancedTileRules();
    setTileRules(dtr);
    lsSet(LS.tileRules, JSON.stringify(dtr));
    resetEvalWeights();
  }, [resetEvalWeights]);

  /** 条件の要約（プロファイル一覧の1行に出す）。 */
  const summarizeCondition = React.useCallback(
    (params: typeof conditionParams) => {
      const t = UI[lang];
      const su = (params as any)?.setup ?? {};
      const parts: string[] = [];
      parts.push(su.mode === "lostFleet" ? t.modeLF : t.modeBase);
      parts.push(`${t.players}${su.playerCount ?? 4}`);
      const nAvoid = (su.avoidRules?.length ?? 0) + Object.keys(su.allowTileRules ?? {}).length;
      const nForce = (su.forceRules?.length ?? 0) + Object.keys(su.forceTileRules ?? {}).length;
      if (nAvoid > 0) parts.push(`${t.avoidShort}${nAvoid}`);
      if (nForce > 0) parts.push(`${t.forceShort}${nForce}`);
      if (su.extensionFaceMode) parts.push(`${t.extFaceModeLabel}:${su.extensionFaceMode}`);
      if (su.econFaceMode) parts.push(`${t.econFaceModeLabel}:${su.econFaceMode}`);
      const nShip =
        (su.shipDistanceAvoid?.length ?? 0) + (su.shipDistanceForce?.length ?? 0) + (su.rebellionGoldFed ? 1 : 0);
      if (nShip > 0) parts.push(`船ルール${nShip}`);
      const w = (params as any)?.evalWeights ?? {};
      const diff = Object.keys(w).filter((k) => (w as any)[k] !== (DEFAULT_SETUP_WEIGHTS as any)[k]).length;
      if (diff > 0) parts.push(`指数${diff}`);
      return parts.join(" / ");
    },
    [lang]
  );

  // 復元は読み取りのみ（書込みはユーザー操作ハンドラのみの規律）。
  React.useEffect(() => {
    let alive = true;
    void listSavedSetups().then((rows) => {
      if (alive) setSaved(rows);
    });
    void refreshProfiles();
    return () => {
      alive = false;
    };
  }, [refreshProfiles]);

  // 「生成」＝ランダムシードを引く＋その入力を自動記録。
  /** 記録に合わせて条件プロファイルも作る/更新する（Map が検索時に作るのと同じ）。 */
  const recordAndTrack = React.useCallback(
    (input: BuildSetupInput) => {
      void recordSetup(input).then(async (rows) => {
        setSaved(rows);
        await upsertConditionProfile(STORE_SETUP_PROFILES, conditionParams);
        await refreshProfiles();
      });
    },
    [conditionParams, refreshProfiles]
  );

  const handleRoll = React.useCallback(() => {
    const s = randomSeedString();
    setSeed(s);
    recordAndTrack(buildInput(s));
  }, [buildInput, recordAndTrack]);

  const changeBulkTrials = React.useCallback((v: number) => {
    const n = Math.max(1, Math.min(BULK_TRIALS_MAX, Math.floor(v) || 1));
    setBulkTrials(n);
    lsSet(LS.bulkTrials, String(n));
  }, []);
  const changeBulkCriterion = React.useCallback((v: BulkCriterion) => {
    setBulkCriterion(v);
    lsSet(LS.bulkCriterion, v);
  }, []);

  /**
   * 保存済みランキングを読み直す。条件・基準・評価指数のどれが変わっても引き直す
   * （スコアは保存値ではなく、いまの評価指数で再計算される）。走っている探索は
   * 止める —— 止めないと、次のチャンクが旧条件の結果で表を上書きしてしまう。
   */
  React.useEffect(() => {
    let alive = true;
    bulkGenRef.current += 1;
    bulkStopRef.current = true;
    setBulkRecordedIds(new Set());
    void listRanking({
      conditionKey: bucketKey,
      criterion: bulkCriterion,
      playerCount: players,
      lostFleet: lf,
      weights: evalWeights,
      colorPref: colorPrefArg,
    }).then((rows) => {
      if (alive) setBulkRows(rows);
    });
    return () => {
      alive = false;
    };
  }, [bucketKey, bulkCriterion, players, lf, evalWeights, colorPrefArg]);

  const handleBulkSearch = React.useCallback(() => {
    if (bulkBusy) {
      // 中止。世代は進めないので、そこまでの上位はマージされて画面にも出る。
      bulkStopRef.current = true;
      return;
    }
    const total = Math.max(1, Math.min(BULK_TRIALS_MAX, Math.floor(bulkTrials) || 1));
    const seeds = Array.from({ length: total }, () => randomSeedString());
    const baseInput = buildInput("") as any;
    delete baseInput.seed;
    // 探索中に条件が変わってもこの回の結果は「開始時の条件」のバケツへ入れる。
    const forKey = bucketKey;
    const forCriterion = bulkCriterion;
    const myGen = bulkGenRef.current;

    bulkStopRef.current = false;
    setBulkBusy(true);
    setBulkDone(0);
    setBulkTotal(total);
    setBulkRecordedIds(new Set());

    /** 今回の結果を保存済みランキングへマージして、残った上位を表示する。 */
    const commit = (acc: Recommendation[]) => {
      void mergeRanking({
        conditionKey: forKey,
        criterion: forCriterion,
        playerCount: players,
        lostFleet: lf,
        weights: evalWeights,
        colorPref: colorPrefArg,
        fresh: acc.map((r) => ({ seed: String(r.input.seed), input: r.input, score: r.score })),
        cap: BULK_TOP_N,
      })
        .then((rows) => {
          // マージ中に条件・基準を変えられていたら、その表示を壊さない。
          if (bulkGenRef.current !== myGen) return;
          setBulkRows(rows);
        })
        .catch(() => {
          // DB が使えないときは今回ぶんだけでも見せる（保存はされない）。
          if (bulkGenRef.current !== myGen) return;
          setBulkRows(
            acc.map((r) => ({
              id: `${forKey}:${forCriterion}:${String(r.input.seed)}`,
              conditionKey: forKey,
              criterion: forCriterion,
              seed: String(r.input.seed),
              input: r.input,
              score: r.score,
              createdAt: 0,
            }))
          );
        })
        .finally(() => setBulkBusy(false));
    };

    const step = (from: number, acc: Recommendation[]) => {
      // 中止（ボタン or 条件変更）なら、そこまでの結果を保存してから止める。
      // Map の検索と同じで、途中で止めても見つけた上位は失わない。
      if (bulkStopRef.current || from >= seeds.length) {
        commit(acc);
        return;
      }
      const slice = seeds.slice(from, from + BULK_CHUNK);
      const rs = recommendSetups({
        criterion: forCriterion,
        seeds: slice,
        playerCount: players,
        lostFleet: lf,
        weights: evalWeights,
        colorPref: colorPrefArg,
        topN: BULK_TOP_N,
        baseInput,
      });
      const merged = [...acc, ...rs].sort((a, b) => b.score - a.score).slice(0, BULK_TOP_N);
      setBulkDone(from + slice.length);
      window.setTimeout(() => step(from + BULK_CHUNK, merged), 0);
    };
    step(0, []);
  }, [bulkBusy, bulkTrials, buildInput, bucketKey, bulkCriterion, players, lf, evalWeights, colorPrefArg]);

  const handleBulkClear = React.useCallback(() => {
    bulkGenRef.current += 1;
    bulkStopRef.current = true;
    setBulkRows([]);
    setBulkRecordedIds(new Set());
    void clearRanking(bucketKey, bulkCriterion);
  }, [bucketKey, bulkCriterion]);

  // 手入力シードなど、表示中の内容を明示的に記録する補助ボタン。
  const handleRecordCurrent = React.useCallback(() => {
    recordAndTrack(buildInput(seed));
  }, [buildInput, seed, recordAndTrack]);

  // 行クリックで保存時の入力を復元（自分の操作なので記憶設定にも反映する）。
  const restoreSaved = React.useCallback(
    (input: BuildSetupInput) => applyInput(input, true),
    [applyInput]
  );

  const currentId = React.useMemo(() => setupHistoryId(buildInput(seed)), [buildInput, seed]);

  /**
   * 保存リスト行に出す「評価値の高い種族4つ」（2026-07-31 要望）。
   * 保存しているのは入力だけなので、行ごとに組み立て直して評価する
   * （0.25ms/件。表示するのはいまの条件バケツの行だけなので、上限100件でも数十ms）。
   * 基本版では LF4種族を候補から外す（その拡張で選べる種族だけ）。
   */
  const savedTopFactions = React.useMemo(() => {
    const out = new Map<string, Array<FactionDef & { score: number }>>();
    for (const r of saved) {
      if (r.conditionKey !== bucketKey) continue;
      try {
        const rowLf = r.input.mode === "lostFleet";
        const scores = scoreSetupFactions(buildSetupFromSeed(r.input), evalWeights);
        const defs = factionsForMode(rowLf);
        out.set(
          r.id,
          topFactions(scores, 4, rowLf)
            .map((id) => defs.find((d) => d.id === id))
            .filter((d): d is FactionDef => !!d)
            .map((d) => ({ ...d, score: scores[d.id] }))
        );
      } catch {
        // 壊れた入力は種族チップなしで出す（行自体は復元に使える）
      }
    }
    return out;
  }, [saved, bucketKey, evalWeights]);

  // 表示中のセットアップが変わったらマーカーを消す（別の卓のタイルが光ったままに
  // ならないように。Map の markHashRef と同じ考え方）。
  const markKeyRef = React.useRef<string>("");
  React.useEffect(() => {
    if (markKeyRef.current !== currentId) {
      markKeyRef.current = currentId;
      setMarkSources((prev) => (prev.size ? new Map() : prev));
    }
  }, [currentId]);

  // 船ルールの充足不能な組み合わせはエラーにせず警告表示（2026-07-23 要望）。

  const t = UI[lang];

  // 共通バーからの人数/拡張選択（LFは2人以上へクランプ）。共有localStorageへ書込。
  const onGlobalSelect = React.useCallback((p: number, e: Expansion) => {
    const m: SetupMode = e === "lostFleet" ? "lostFleet" : "base";
    const np = m === "lostFleet" ? Math.max(2, p) : p;
    setMode(m);
    setPlayers(np);
    writeSharedExpansion(m);
    writeSharedPlayers(np);
  }, []);

  /** そのスロットに入りうるタイルの一覧（指定パネルの選択肢）。 */
  const poolFor = React.useCallback(
    (kind: string): string[] => {
      const ids = (g: { id: string }[]) => g.map((t) => t.id);
      switch (kind) {
        case "std":
          return ids(SETUP_CATALOG.standardTech);
        case "adv":
          return lf
            ? [...ids(SETUP_CATALOG.advancedTech), ...ids(SETUP_CATALOG.advancedTechLF)]
            : ids(SETUP_CATALOG.advancedTech);
        case "booster":
          return lf
            ? [...ids(SETUP_CATALOG.boosters), ...ids(SETUP_CATALOG.boostersLF)]
            : ids(SETUP_CATALOG.boosters);
        case "rs":
          return lf
            ? [...ids(SETUP_CATALOG.roundScoring), ...ids(SETUP_CATALOG.roundScoringLF)]
            : ids(SETUP_CATALOG.roundScoring);
        case "fs":
          return lf
            ? [...ids(SETUP_CATALOG.finalScoring), ...ids(SETUP_CATALOG.finalScoringLF)]
            : ids(SETUP_CATALOG.finalScoring);
        case "fed":
          return ids(SETUP_CATALOG.federations);
        case "shipTech":
          return ids(SETUP_CATALOG.standardTechLF);
        case "goldFed":
          return ids(SETUP_CATALOG.federationsGold);
        case "artifacts":
          return ids(SETUP_CATALOG.artifacts);
        default:
          return [];
      }
    },
    [lf]
  );

  const openPicker = React.useCallback(
    (slotId: string, title: string, kind: string, singleFix: boolean) => {
      setPicker({ slotId, title, pool: sortTilesByBehavior(poolFor(kind)), singleFix });
    },
    [poolFor]
  );

  const changeTileRule = React.useCallback(
    (slotId: string, tileId: string, mode: TileRuleMode | null, singleFix: boolean) => {
      setTileRules((prev) => {
        const next = setTileRule(prev, slotId, tileId, mode, { singleFix });
        lsSet(LS.tileRules, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const pickHint = lang === "ja" ? "クリックでこの枠のタイルを指定" : "Click to constrain this slot";

  /**
   * タイル1枚。slot を渡すとクリックで指定パネルが開く。
   * singleFix=false は順不同の枠（複数「含む」を許す）。
   */
  const tileCell = (
    id: string,
    tag?: string,
    full?: boolean,
    slot?: { slotId: string; title: string; kind: string; singleFix?: boolean }
  ) => (
    <TileCellView
      key={id + (tag ?? "")}
      id={id}
      tag={tag}
      lang={lang}
      lf={lf}
      full={full}
      mark={markedTiles.get(id)}
      pinned={slot ? hasRule(tileRules, slot.slotId) : false}
      pickLabel={slot ? `${slot.title} — ${pickHint}` : undefined}
      onPick={
        slot ? () => openPicker(slot.slotId, slot.title, slot.kind, slot.singleFix !== false) : undefined
      }
    />
  );

  return (
    <>
      {/* 面の選択（経済調整タイル・得点ボード拡張部）。既定はどちらもランダム。 */}
      {facePicker ? (
        <div
          onClick={() => setFacePicker(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: T.radius,
              padding: T.pad,
              maxWidth: 420,
              width: "100%",
              boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: T.fontHead, marginBottom: 8 }}>
              {facePicker === "econ" ? t.econFaceModeLabel : t.scoringExtension}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(facePicker === "econ"
                ? ([
                    { v: "random", label: t.econFaceRandom, img: null },
                    { v: "A", label: t.faceA, img: "FACE_ECON_A" },
                    { v: "B", label: t.faceB, img: "FACE_ECON_B" },
                  ] as const)
                : ([
                    { v: "random", label: t.extFaceRandom, img: null },
                    { v: "vp25", label: t.faceVp25, img: "FACE_EXT_VP25" },
                    { v: "shuttle", label: t.faceShuttle, img: "FACE_EXT_SHUTTLE" },
                  ] as const)
              ).map((o) => {
                const cur = facePicker === "econ" ? econFaceMode : extFaceMode;
                const active = cur === o.v;
                return (
                  <button
                    key={o.v}
                    onClick={() => {
                      if (facePicker === "econ") changeEconFace(o.v as EconFaceMode);
                      else changeExtFace(o.v as ExtFaceMode);
                    }}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: active ? "2px solid #1b6b2f" : T.borderSoft,
                      background: active ? "#e7f6ea" : "white",
                      fontWeight: active ? 700 : 400,
                      textAlign: "left",
                    }}
                  >
                    {o.img ? <TileImage imageId={o.img} alt={o.label} /> : null}
                    <span style={{ fontSize: 12 }}>{o.label}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", marginTop: 8 }}>
              <button onClick={() => setFacePicker(null)} style={{ marginLeft: "auto", fontSize: 11, padding: "3px 8px" }}>
                {t.pickClose}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* タイル指定パネル（クリックしたスロットの候補一覧）。2026-07-30。 */}
      {picker ? (
        <div
          onClick={() => setPicker(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: T.radius,
              padding: T.pad,
              maxWidth: 760,
              width: "100%",
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 8, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700, fontSize: T.fontHead }}>{picker.title}</div>
              <div style={{ fontSize: T.fontNote, color: T.fgMuted }}>
                {picker.singleFix ? t.pickNotePositional : t.pickNoteMembership}
              </div>
              <button
                onClick={() => {
                  for (const tid of Object.keys(tileRules[picker.slotId] ?? {})) {
                    changeTileRule(picker.slotId, tid, null, picker.singleFix);
                  }
                }}
                style={{ marginLeft: "auto", fontSize: 11, padding: "3px 8px" }}
              >
                {t.pickClear}
              </button>
              <button onClick={() => setPicker(null)} style={{ fontSize: 11, padding: "3px 8px" }}>
                {t.pickClose}
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {picker.pool.map((tid) => {
                const mode = tileRules[picker.slotId]?.[tid] ?? null;
                const modes: Array<{ v: TileRuleMode | null; label: string; color: string }> = [
                  { v: null, label: t.modeDefault, color: "#888" },
                  { v: "fix", label: picker.singleFix ? t.modeFix : t.modeInclude, color: "#1b6b2f" },
                  { v: "candidate", label: t.modeCandidate, color: "#1f5fa8" },
                  { v: "exclude", label: t.modeExclude, color: "#b3261e" },
                ];
                return (
                  <div
                    key={tid}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                      border: T.borderSoft,
                      borderRadius: 6,
                      padding: "4px 6px",
                      background: mode ? "#f2f7ff" : undefined,
                    }}
                  >
                    <SmallTile id={tid} lang={lang} lf={lf} size={44} />
                    <div style={{ fontSize: 12, flex: "1 1 200px", minWidth: 140 }}>
                      <div style={{ fontWeight: 700 }}>{labelOf(tid, lang)}</div>
                      <div style={{ fontSize: 11, color: T.fgMuted }}>{effectOf(tid, lang) ?? ""}</div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {modes.map((m) => (
                        <button
                          key={String(m.v)}
                          onClick={() => changeTileRule(picker.slotId, tid, m.v, picker.singleFix)}
                          style={{
                            fontSize: 11,
                            padding: "3px 8px",
                            fontWeight: mode === m.v ? 700 : 400,
                            color: mode === m.v ? "#fff" : m.color,
                            background: mode === m.v ? m.color : undefined,
                            border: `1px solid ${m.color}`,
                            borderRadius: 5,
                          }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* マーカーの点滅。要素自体に付けるのでレイアウトが変わっても追従する。 */}
      <style>{`@keyframes setupTileBlink{0%,100%{opacity:1}50%{opacity:.45}} .setup-tile-marked{animation:setupTileBlink 1.1s ease-in-out infinite}`}</style>
      <GlobalBar
        active="setup"
        players={players}
        expansion={lf ? "lostFleet" : "base"}
        onSelect={onGlobalSelect}
        lang={lang}
        onLang={setLangPersist}
      />
    <PageBody>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{t.title}</div>
      </div>

      <div style={{ fontSize: 12, color: "#b26b00", background: "#fff8ec", border: "1px solid #f0dcae", borderRadius: T.radius, padding: "6px 10px" }}>
        {t.draftNote}
      </div>

      {/* 2カラム（共通 TwoCol）。ソース順は右(セットアップ)→左(検索条件)。 */}
      <TwoCol
        right={
          <>
          <SectionTitle>{t.setupArea}</SectionTitle>

      {/* Research tracks: per column, top to bottom —
          [track-top tile (terra=federation Lv5 / eco=econ adjustment face)]
          -> advanced -> standard。
          旧「回避/強制」プルダウンは全スロットのタイル指定へ統合したので廃止
          （キュレーション済みの除外はタイル指定の既定値に入っている。2026-07-30）。 */}
      <section>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.researchTracks}</div>
        {/* 列はタイル幅ちょうど（TILE_COL_W）で、余った幅に広がらないようにする。
            以前は grid の 1fr で引き伸ばしていたので、広い画面だと列間が
            300px 以上空いて読みづらかった（2026-07-31 指摘）。
            6トラックは盤面と同じく必ず横一列に並べたいので折り返さず、
            入りきらない幅ではこの節だけ横スクロールさせる。 */}
        <div
          style={{
            display: "flex",
            flexWrap: "nowrap",
            gap: 8,
            alignItems: "flex-start",
            overflowX: "auto",
            paddingBottom: 4,
          }}
        >
          {RESEARCH_TRACK_IDS.map((track) => {
            const showEconTop = track === "eco" && lf && result.mode === "lostFleet";
            const econFaceLabel =
              showEconTop && result.mode === "lostFleet"
                ? result.econTileFace === "A"
                  ? t.faceA
                  : t.faceB
                : "";
            return (
              <div key={track} style={{ width: TILE_COL_W, flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>
                  {lang === "ja" ? TRACK_LABEL[track].ja : TRACK_LABEL[track].en}
                </div>
                {/* トラック上部スロット（列の縦位置を揃えるため全列で高さを確保） */}
                <div style={{ minHeight: 148, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  {track === "terra" ? tileCell(result.federationLv5, t.fedTag, false, { slotId: "fed", title: t.federationLv5, kind: "fed" }) : null}
                  {showEconTop && result.mode === "lostFleet" ? (
                    <div
                      title={`${result.econTileFace === "A" ? t.econFaceA : t.econFaceB}
${pickHint}`}
                      onClick={() => setFacePicker("econ")}
                      style={{
                        cursor: "pointer",
                        border: econFaceMode !== "random" ? "1px solid #8fc79f" : "1px solid #ddd",
                        borderRadius: 8,
                        padding: "6px 8px",
                        fontSize: 12,
                        background: econFaceMode !== "random" ? "#e7f6ea" : "#fafafa",
                        width: "fit-content",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 11, opacity: 0.7 }}>
                        {`${t.econTag} ${econFaceLabel}`}
                        {econFaceMode !== "random" ? (
                          <span style={{ color: "#1b6b2f", fontWeight: 700, marginLeft: 4 }}>指定</span>
                        ) : null}
                      </span>
                      <TileImage
                        imageId={result.econTileFace === "A" ? "FACE_ECON_A" : "FACE_ECON_B"}
                        alt="econ face"
                      />
                    </div>
                  ) : null}
                </div>
                {tileCell(result.advancedTech.byTrack[track], t.advanced, false, { slotId: `adv:${track}`, title: `${t.advanced} / ${lang === "ja" ? TRACK_LABEL[track].ja : TRACK_LABEL[track].en}`, kind: "adv" })}
                {tileCell(result.standardTech.byTrack[track], t.standard, false, { slotId: `std:${track}`, title: `${t.standard} / ${lang === "ja" ? TRACK_LABEL[track].ja : TRACK_LABEL[track].en}`, kind: "std" })}
              </div>
            );
          })}
        </div>
      </section>

      {/* Free-row standard tiles */}
      <section>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.freeStandard}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
          {result.standardTech.free.map((id) => tileCell(id, undefined, false, { slotId: "stdFree", title: t.freeStandard, kind: "std", singleFix: false }))}
        </div>
      </section>

      {/* Round scoring, rounds 1..6 */}
      <section>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.roundScoring}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
          {result.roundScoring.map((id, i) => tileCell(id, `${t.round}${i + 1}`, false, { slotId: `rs:${i}`, title: `${t.roundScoring} ${t.round}${i + 1}`, kind: "rs" }))}
        </div>
      </section>

      {/* Federation Lv5 は研究トラック（テラフォーミング列上部）へ移動済み */}

      {/* Final scoring, 2 of 6 (原寸表示) */}
      <section>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.finalScoring}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
          {result.finalScoring.map((id, i) => tileCell(id, undefined, true, { slotId: `fs:${i}`, title: `${t.finalScoring} ${i + 1}`, kind: "fs" }))}
        </div>
      </section>

      {/* Lost Fleet: scoring-board extension + ships + econ tile face */}
      {lf && result.mode === "lostFleet" ? (
        <>
          <section>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.scoringExtension}</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
              {tileCell(result.advancedTech.extension!, t.extensionAdv, false, { slotId: "advExt", title: t.extensionAdv, kind: "adv" })}
              <div
                title={pickHint}
                onClick={() => setFacePicker("ext")}
                style={{
                  fontSize: 12,
                  opacity: 0.85,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  cursor: "pointer",
                  border: extFaceMode !== "random" ? "1px solid #8fc79f" : "1px solid transparent",
                  background: extFaceMode !== "random" ? "#e7f6ea" : undefined,
                  borderRadius: 8,
                  padding: "4px 6px",
                }}
              >
                <TileImage
                  imageId={result.extensionFace === "vp25" ? "FACE_EXT_VP25" : "FACE_EXT_SHUTTLE"}
                  alt="extension face"
                />
                {t.extensionFaceLabel}: {result.extensionFace === "vp25" ? t.faceVp25 : t.faceShuttle}
                {extFaceMode !== "random" ? (
                  <span style={{ color: "#1b6b2f", fontWeight: 700 }}>指定</span>
                ) : null}
              </div>
              {/* 経済調整タイルは研究トラック（経済列上部）へ移動済み */}
            </div>
          </section>

          <section>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.ships}</div>
            {/* 船カードはタイル1枚ぶんの幅（SHIP_CARD_W）に固定する。以前は grid の
                1fr で余白いっぱいに広げていたので、110px のタイルを載せた枠が
                500px 近くまで伸びて右ペイン全体を圧迫していた（2026-07-31 指摘）。 */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
              {result.ships!.map((ship) => {
                return (
                  <div key={ship} style={{ width: SHIP_CARD_W, border: "1px solid #ddd", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>
                      {lang === "ja" ? SHIP_LABEL[ship].ja : SHIP_LABEL[ship].en}
                    </div>
                    {tileCell(result.goldFederations![ship]!, t.goldFed, false, { slotId: `goldFed:${ship}`, title: `${t.goldFed} / ${lang === "ja" ? SHIP_LABEL[ship].ja : SHIP_LABEL[ship].en}`, kind: "goldFed" })}
                    {result.shipTech![ship] ? tileCell(result.shipTech![ship]!, t.shipTechLabel, false, { slotId: `shipTech:${ship}`, title: `${t.shipTechLabel} / ${lang === "ja" ? SHIP_LABEL[ship].ja : SHIP_LABEL[ship].en}`, kind: "shipTech" }) : null}
                  </div>
                );
              })}
            </div>
          </section>

          {/* アーティファクトは船カードの中では縦積みになり、トワイライトの列だけが
              他の3倍の高さになっていた（節全体で 982px）。横に流す独立した節へ出す。
              トワイライトのものであることは見出しで示す（2026-07-31）。 */}
          {result.artifacts && result.artifacts.length > 0 ? (
            <section>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.artifactsLabel}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
                {result.artifacts.map((id) =>
                  tileCell(id, undefined, false, {
                    slotId: "artifacts",
                    title: t.artifactsLabel,
                    kind: "artifacts",
                    singleFix: false,
                  })
                )}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {/* Boosters (only the ones in play; unused ones go back to the box; 原寸表示) */}
      <section>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.boosters}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
          {result.boosters.available.map((id) => tileCell(id, undefined, true, { slotId: "booster", title: t.boosters, kind: "booster", singleFix: false }))}
        </div>
      </section>

      {/* Muaked/Tinkerroid planet-transform satellites: 7 colors in board order.
          惑星改造ボードは LF の内容物で、使うのは LF の2種族だけ。基本版では
          その2種族を選べないので出さない（2026-07-31）。 */}
      {lf ? (
      <section>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>{t.satellites}</div>
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>{t.satellitesNote}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
          {result.planetSatellites.map((c, i) => {
            const s = PLANET_COLOR_STYLE[c];
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "6px 8px",
                  minWidth: 44,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.6 }}>{i + 1}</span>
                <span
                  title={lang === "ja" ? s.ja : s.en}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: s.bg,
                    border: "1px solid #999",
                  }}
                />
                <span style={{ fontSize: 11 }}>{lang === "ja" ? s.ja : s.en}</span>
              </div>
            );
          })}
        </div>
      </section>
      ) : null}
          </>
        }
        left={
          <>
          <SectionTitle>{t.searchConds}</SectionTitle>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {/* 人数・拡張(基本版/LF)・言語は共通バー（GlobalBar）へ移動 */}
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
          </div>

      {/* 保存済み条件（Map と同じ操作。条件ごとに保存リストが分かれる） */}
      <ConditionProfilesPanel
        profiles={profiles}
        currentKey={conditionKey}
        lang={lang}
        summarize={summarizeCondition}
        isDefaultParams={isDefaultParams}
        blocked={dbBlocked}
        onApply={applyProfile}
        onRename={(key, name) => {
          const p = profiles.find((x) => x.key === key);
          if (!p) return;
          void upsertConditionProfile(STORE_SETUP_PROFILES, p.params, { name }).then(refreshProfiles);
        }}
        onDeleteMeta={(key) => {
          void deleteConditionProfile(STORE_SETUP_PROFILES, key).then(refreshProfiles);
        }}
        onDeleteAll={(key) => {
          const p = profiles.find((x) => x.key === key);
          const su = (p?.params as any)?.setup ?? null;
          void (async () => {
            if (su) {
              const ck = setupConditionKey({ ...su, seed: "" } as BuildSetupInput);
              await deleteSetupsByCondition(ck);
              // 一括探索のランキングも同じ条件バケツに属するので一緒に消す。
              await deleteRankingByCondition(ck);
              if (ck === bucketKey) setBulkRows([]);
            }
            await deleteConditionProfile(STORE_SETUP_PROFILES, key);
            setSaved(await listSavedSetups());
            await refreshProfiles();
          })();
        }}
        onResetDefaults={resetConditions}
      />

      {/* 評価（種族別）＋評価指数。表示中のセットアップをそのまま評価する。 */}
      <section>
        <FactionEvalPanel
          result={result}
          weights={evalWeights}
          onChangeWeight={changeEvalWeight}
          onResetWeights={resetEvalWeights}
          lang={lang}
          lf={lf}
          players={players}
          onMark={onMark}
          activeSources={activeSources}
          colorPref={colorPref}
          onChangeColorPref={changeColorPref}
          onResetColorPref={resetColorPref}
        />
      </section>

      {/* 一括探索（2026-07-31）: いまの条件で大量生成し、基準の良い順に並べる。
          結果は条件×基準ごとに保存され、次の探索は前回の上位とマージされる。
          置き場所は種族別評価の下（2026-07-31 ユーザー指定）。 */}
      <section>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
          <div style={{ fontWeight: 700 }}>{t.bulkTitle}</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>{t.bulkNote}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span>{t.bulkCriterion}</span>
            <select
              value={bulkCriterion}
              onChange={(e) => changeBulkCriterion(e.target.value as BulkCriterion)}
              style={{ padding: "3px 6px" }}
            >
              {BULK_CRITERIA.map((c) => (
                <option key={c} value={c}>
                  {c === "topBalance" ? t.critTopBalance : t.critNeutralBalance}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span>{t.bulkTrials}</span>
            <input
              type="number"
              min={1}
              max={BULK_TRIALS_MAX}
              value={bulkTrials}
              onChange={(e) => changeBulkTrials(Number(e.target.value))}
              style={{ width: 80, padding: "3px 6px" }}
            />
          </label>
          <button onClick={handleBulkSearch} style={{ padding: "4px 12px", fontWeight: 700 }}>
            {bulkBusy ? t.bulkStop : t.bulkRun}
          </button>
          {bulkBusy ? (
            <span style={{ opacity: 0.7 }}>
              {bulkDone}/{bulkTotal}
            </span>
          ) : bulkRows.length > 0 ? (
            <button onClick={handleBulkClear} style={{ padding: "4px 10px", fontSize: 12 }}>
              {t.bulkClear}
            </button>
          ) : null}
        </div>

        {bulkRows.length > 0 ? (
          <div style={{ marginTop: 6, overflowX: "auto", border: T.borderSoft, borderRadius: T.radius }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={bulkTh}>#</th>
                  <th style={{ ...bulkTh, textAlign: "left" }}>{t.seed}</th>
                  <th style={bulkTh}>{t.bulkScore}</th>
                  <th style={{ ...bulkTh, textAlign: "left" }}>{t.bulkTopFactions}</th>
                  <th style={bulkTh}></th>
                </tr>
              </thead>
              <tbody>
                {bulkRows.map((r, i) => {
                  const s = r.seed;
                  const isCurrent = s === seed;
                  const recorded = bulkRecordedIds.has(s);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSeed(s)}
                      title={t.bulkNote}
                      style={{
                        cursor: "pointer",
                        background: isCurrent ? "#eef6ff" : undefined,
                        borderTop: "1px solid #eee",
                      }}
                    >
                      <td style={{ ...bulkTd, textAlign: "center", opacity: 0.6 }}>{i + 1}</td>
                      <td style={{ ...bulkTd, fontFamily: "monospace", fontWeight: isCurrent ? 700 : 400 }}>
                        {s}
                      </td>
                      <td style={{ ...bulkTd, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {Math.round(r.score)}
                      </td>
                      <td style={bulkTd}>{bulkTopText(r, lf, lang, evalWeights)}</td>
                      <td style={{ ...bulkTd, textAlign: "right" }}>
                        <button
                          disabled={recorded}
                          onClick={(e) => {
                            e.stopPropagation();
                            recordAndTrack(r.input);
                            setBulkRecordedIds((prev) => new Set(prev).add(s));
                          }}
                          style={{ padding: "1px 8px", fontSize: 11 }}
                        >
                          {recorded ? t.bulkRecorded : t.bulkRecord}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : bulkBusy ? null : (
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>{t.bulkEmpty}</div>
        )}
      </section>

      {/* Saved setups (ranking skeleton: pinned first -> newest; used in a separate view) */}
      <section>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>{t.savedList}</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>{t.savedListNote}</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6, fontSize: 12 }}>
            {(["active", "used"] as const).map((v) => {
              // 件数もいまの条件バケツのぶんだけ数える（表示行と食い違わせない）
              const count = saved.filter((r) => (v === "used") === r.used && r.conditionKey === bucketKey).length;
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
          // いまの条件バケツの保存のみ表示（2026-07-30。以前は人数/拡張だけで
          // 絞っていたので、上級ルールや評価指数が違う結果も混ざっていた）。
          const rows = saved.filter((r) => (savedView === "used") === r.used && r.conditionKey === bucketKey);
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
                return (
                  <div
                    key={r.id}
                    onClick={() => restoreSaved(r.input)}
                    title={t.restoreHint}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      cursor: "pointer",
                      border: isCurrent ? "1px solid #7aa7e8" : "1px solid #ddd",
                      background: isCurrent ? "#f2f7ff" : "#fafafa",
                      borderRadius: 8,
                      padding: "4px 8px",
                      fontSize: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        fontSize: 12,
                        textAlign: "left",
                        flex: 1,
                        minWidth: 220,
                      }}
                    >
                      {r.pinned ? <span title={t.pin}>📌</span> : null}
                      <span>{r.input.mode === "lostFleet" ? t.modeLF : t.modeBase}</span>
                      <span>
                        {t.players}: {r.input.playerCount ?? 4}
                      </span>
                      {/* 評価値の高い種族4つ。背景はその種族の母星色（2026-07-31 要望）。
                          キー（シード）と実行時間は表示から外した。 */}
                      {(savedTopFactions.get(r.id) ?? []).map((f) => (
                        <span
                          key={f.id}
                          title={`${lang === "ja" ? f.labelJa : f.labelEn} ${Math.round(f.score)}`}
                          style={{
                            background: factionHomeBg(f.color),
                            border: "1px solid rgba(0,0,0,0.15)",
                            borderRadius: 4,
                            padding: "0 5px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {lang === "ja" ? f.labelJa : f.labelEn}
                        </span>
                      ))}
                      {isCurrent ? (
                        <span style={{ color: "#3467c4", fontWeight: 700 }}>{t.currentBadge}</span>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyText(setupShareUrl(r.input));
                          setSharedCopiedId(r.id);
                          window.setTimeout(() => setSharedCopiedId((v) => (v === r.id ? null : v)), 2000);
                        }}
                        style={{ fontSize: 11 }}
                      >
                        {sharedCopiedId === r.id ? t.shareCopied : t.shareRow}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); void setSetupPinned(r.id, !r.pinned).then(setSaved); }} style={{ fontSize: 11 }}>
                        {r.pinned ? t.unpin : t.pin}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); void setSetupUsed(r.id, !r.used).then(setSaved); }} style={{ fontSize: 11 }}>
                        {r.used ? t.unmarkUsed : t.markUsed}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); void deleteSavedSetup(r.id).then(setSaved); }} style={{ fontSize: 11 }}>
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
          </>
        }
      />
    </PageBody>
    </>
  );
}
