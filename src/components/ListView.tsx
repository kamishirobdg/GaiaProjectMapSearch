// src/components/ListView.tsx
"use client";

// 一覧タブ（TODO ③、2026-07-24）: ピン留めしたマップとセットアップを
// 横断で並べ、共有リンク（マップ=/board?h= / セットアップ=/setup?s=）と
// ピン解除を提供する。並びはピン留めの新しい順。
// マップは MapBoardViewer のミニ描画（追加素材不要）。

import React from "react";
import Link from "next/link";
import { MapBoardViewer, type PlacementItem } from "@/components/MapBoardViewer";
import {
  openDb,
  idbGetAllFromStore,
  idbPutAll,
  loadProfilesFromDb,
  STORE_CANDIDATES,
  type PersistedCandidate,
} from "@/app/board/persistence";
import {
  buildSectorImgById,
  getAllSectors,
  IMG_OFFSET_BY_SLOT,
  ROT_OFFSETS_BY_SLOT,
  TEMPLATE_BY_ID,
} from "@/gaia/board/viewerAssets";
import { buildSectorLookup } from "@/gaia/board/previewBoard";
import { encodePlacementToken, decodePlacementToken } from "@/gaia/ssot/placementHash";
import { listSavedSetups, recordSetup, setSetupPinned, type SavedSetup } from "@/lib/setupHistory";
import { copyText, decodeSetupToken, encodeSetupToken } from "@/lib/setupShare";
import GlobalBar from "@/components/GlobalBar";
import {
  readSharedExpansion,
  readSharedPlayers,
  resetStaleEvalScaleStorage,
  writeSharedExpansion,
  writeSharedPlayers,
  type Expansion,
} from "@/lib/sharedSettings";
import {
  scoreSetupFactions,
  topFactions,
  type FactionScores,
  type RecommendCriterion,
} from "@/gaia/eval/factionEval";
import { FACTIONS, FACTION_IDS, type FactionId } from "@/gaia/eval/factionWeights";
import { mapValueByFaction } from "@/gaia/eval/mapFaction";
import { buildSetupFromSeed, type BuildSetupInput } from "@/gaia/setup/buildSetup";
import { SetupBoard } from "@/components/SetupView";
import FactionEvalPanel, {
  FactionPrefInputs,
  useFactionPref,
  useSetupWeights,
} from "@/components/FactionEvalPanel";
import ConditionProfilesPanel from "@/components/ConditionProfilesPanel";
import {
  conditionKeyOf,
  deleteConditionProfile,
  listConditionProfiles,
  upsertConditionProfile,
  type ConditionProfile,
} from "@/lib/conditionProfiles";
import { STORE_LIST_PROFILES, isDbUpgradeBlocked } from "@/app/board/persistence";
import { DEFAULT_SETUP_WEIGHTS, isDefaultWeights, type SetupWeights } from "@/gaia/eval/setupWeights";
import { PageBody, Panel, TwoCol } from "@/components/ui/layout";
import { buildMapPool } from "@/lib/mapCandidates";
// セット提案の選定ロジックは純粋関数として切り出してある（React Compiler が
// handleGenerate のメモ化を保てるようにするため。2026-08-02）。
import {
  mapTopOf,
  planPair,
  setupSettingsOf,
  type PairDir,
  type PairLogEntry,
  type PairLogPayload,
  type PairOption,
  type SetupSource,
} from "@/lib/pairPlan";

type Lang = "ja" | "en";

const UI = {
  ja: {
    title: "ピン留め一覧",
    note: "マップ（/board）とセットアップ（/setup）でピン留めしたものが集まります",
    maps: "マップ",
    setups: "セットアップ",
    emptyMaps: "ピン留めしたマップはありません（Mapタブの結果行で「ピン留め」）",
    emptySetups: "ピン留めしたセットアップはありません（Setupタブの保存リストで「ピン留め」）",
    open: "開く",
    share: "共有",
    shareCopied: "コピーしました",
    unpin: "ピン解除",
    score: "スコア",
    seed: "シード",
    used: "使用済み",
    modeBase: "基本版",
    modeLF: "Lost Fleet",
    players: "人数",
    unknownTemplate: "テンプレート不明（プレビューなし）",
    pairTitle: "セット提案（マップ＋セットアップ）",
    pairNote: "探索の向きと基準を選ぶと、条件に合う候補を上位5件まで提示します（種族重みはDRAFT）",
    pairMap: "マップ",
    pairNoMap: "（マップなし）",
    toTotal: "→ この組を Total タブ（種族別総合評価）で見る",
    totalStrong: "合計の上位4種族",
    pairCriterion: "基準",
    crit1: "1: 逆優位（マップ上位種族が弱い）",
    crit2: "2: 上位バランス（人数+2種族が拮抗）",
    crit3: "3: マップ非依存の全体バランス",
    crit4: "4: 優位（マップ上位の人数+2種族が強い）",
    generate: "提案を生成",
    regenerate: "再生成",
    needMap: "基準1にはマップの選択が必要です",
    candidates: "候補:",
    pairLog: "提案ログ",
    clearLog: "ログを消去",
    tileModeLabel: "盤面表示",
    tileImage: "画像",
    tileSchematic: "番号＋向き",
    logRestoreHint: "クリックでこの提案を再表示",
    logNoRestore: "この行は再表示できません（旧形式のログ）",
    logMapMissing: "このログのマップは候補に見つかりません（ピン解除/削除済み）。セットアップのみ再表示しました",
    pairDirLabel: "探索の向き",
    dirMapToSetup: "マップ → セットアップ",
    dirSetupToMap: "セットアップ → マップ",
    setupSourceLabel: "セットアップの探し方",
    srcRandom: "ランダム生成",
    srcSaved: "保存済みから選ぶ",
    srcDisabledHint: "セットアップ→マップの向きでは使いません",
    pairSetup: "セットアップ",
    needSetup: "起点にするセットアップを選んでください",
    needSetupPool: "条件に合う保存済みセットアップがありません",
    needMapPool: "条件に合うマップがありません（ピン留めかランキングが必要）",
    mapIndependentNote: "※基準2・3はマップに依存しないため、マップは条件が合う先頭のものになります（マップで選びたいときは基準1か4）",
    mapStrong: "マップ優位",
    setupStrong: "セットアップ優位（上位5）",
    trialsNote: "候補から上位5件",
    openSetup: "Setupで開く",
    openMap: "Mapで開く",
    openBoard: "ボードで開く",
    sharePair: "セット共有URL",
    recordToList: "保存リストに記録",
    recorded: "記録しました",
    savedProposals: "保存した提案",
    saveProposal: "提案を保存",
    deleteProposal: "削除",
    sharedPairTitle: "共有されたセット",
  },
  en: {
    title: "Pinned items",
    note: "Everything pinned on the Map (/board) and Setup (/setup) tabs gathers here",
    maps: "Maps",
    setups: "Setups",
    emptyMaps: "No pinned maps yet (use \"Pin\" on a result row in the Map tab)",
    emptySetups: "No pinned setups yet (use \"Pin\" in the Setup tab's saved list)",
    open: "Open",
    share: "Share",
    shareCopied: "Copied",
    unpin: "Unpin",
    score: "Score",
    seed: "Seed",
    used: "Used",
    modeBase: "Base game",
    modeLF: "Lost Fleet",
    players: "Players",
    unknownTemplate: "Unknown template (no preview)",
    pairTitle: "Pair proposal (map + setup)",
    pairNote: "Pick a direction and criterion to get up to 5 ranked candidates (faction weights are DRAFT)",
    pairMap: "Map",
    pairNoMap: "(no map)",
    toTotal: "→ See this pair on the Total tab (faction totals)",
    totalStrong: "Top 4 by total",
    pairCriterion: "Criterion",
    crit1: "1: Oppose map (map's top factions weak)",
    crit2: "2: Top balance (players+2 factions close)",
    crit3: "3: Map-independent overall balance",
    crit4: "4: Align (map top players+2 factions are strong)",
    generate: "Generate",
    regenerate: "Regenerate",
    needMap: "Criterion 1 requires a selected map",
    candidates: "Candidates:",
    pairLog: "Proposal log",
    clearLog: "Clear log",
    tileModeLabel: "Board view",
    tileImage: "Images",
    tileSchematic: "Number + rotation",
    logRestoreHint: "Click to re-display this proposal",
    logNoRestore: "This row cannot be restored (older log format)",
    logMapMissing: "The map for this log entry is no longer among the candidates; showing the setup only",
    pairDirLabel: "Direction",
    dirMapToSetup: "Map → Setup",
    dirSetupToMap: "Setup → Map",
    setupSourceLabel: "Setup source",
    srcRandom: "Random rolls",
    srcSaved: "From saved",
    srcDisabledHint: "Not used in the Setup → Map direction",
    pairSetup: "Setup",
    needSetup: "Pick a setup to start from",
    needSetupPool: "No saved setup matches the current players/expansion",
    needMapPool: "No map matches (pin one or run a search first)",
    mapIndependentNote: "Note: criteria 2 and 3 do not depend on the map, so the first matching map is used (use criterion 1 or 4 to rank maps)",
    mapStrong: "Map favors",
    setupStrong: "Setup favors (top 5)",
    trialsNote: "top 5 of candidates",
    openSetup: "Open in Setup",
    openMap: "Open in Map",
    openBoard: "Open board",
    sharePair: "Share pair URL",
    recordToList: "Record to saved list",
    recorded: "Recorded",
    savedProposals: "Saved proposals",
    saveProposal: "Save proposal",
    deleteProposal: "Delete",
    sharedPairTitle: "Shared pair",
  },
} as const;

/** 基準の短縮表示（提案ログ用）。 */
function criterionShort(c: RecommendCriterion, t: (typeof UI)["ja" | "en"]): string {
  const full =
    c === "opposeMap" ? t.crit1 : c === "alignMap" ? t.crit4 : c === "topBalance" ? t.crit2 : t.crit3;
  return full.split("（")[0].split(" (")[0];
}

/** 種族の表示名。 */
function factionLabel(id: FactionId, lang: Lang): string {
  const f = FACTIONS.find((x) => x.id === id);
  return f ? (lang === "ja" ? f.labelJa : f.labelEn) : id;
}

/** セットアップスコア上位N件を [ラベル +n] で並べる。基本版では LF4種族を除く。 */
function topFactionText(scores: FactionScores, n: number, lang: Lang, lf: boolean): string {
  const ids = topFactions(scores, n, lf);
  return ids
    .map((f) => `${factionLabel(f, lang)} ${scores[f] >= 0 ? "+" : ""}${Math.round(scores[f])}`)
    .join(" / ");
}

/**
 * Map と Setup を足した合計の上位N種族（2026-08-04）。足し方は Total タブと同じ
 * 1:1 で、提案を見た時点で「この組ならどの種族が強いか」が分かるようにするための
 * 要約。詳しい内訳は Total タブで見る。
 *
 * Map ぶんは候補が持つ評価内訳から取るので、**内訳を持たない古い候補では出せない**
 * （呼び出し側で null を返す）。
 */
function topTotalText(
  mapScores: FactionScores,
  setupScores: FactionScores,
  n: number,
  lang: Lang,
  lf: boolean
): string {
  const total = {} as FactionScores;
  for (const f of FACTION_IDS) total[f] = (mapScores[f] ?? 0) + (setupScores[f] ?? 0);
  return topFactions(total, n, lf)
    .map((f) => `${factionLabel(f, lang)} ${Math.round(total[f])}`)
    .join(" / ");
}

/** templateId -> 表示用の 拡張/人数 ラベル。 */
function templateMeta(templateId: string, t: (typeof UI)["ja" | "en"]): string {
  switch (templateId) {
    case "base_34p":
      return `${t.modeBase} 3-4p`;
    case "3p_lostFleet":
      return `${t.modeLF} 3p`;
    case "4p_lostFleet":
      return `${t.modeLF} 4p`;
    default:
      return templateId || "?";
  }
}

function fmtWhen(ts: number | undefined, lang: Lang): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString(lang === "ja" ? "ja-JP" : "en-US", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// タブ遷移時の「デフォルト→復元」ちらつきを消すため、復元は paint 前に走る
// layout effect で行う（SSRでは useEffect にフォールバック）。2026-07-24。
const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

// List のマップ/基準の選択を記憶する localStorage キー（人数/拡張と同様に永続）。
/** 探索候補に載せるランキングマップの上限（描画とスコア計算のコスト抑制）。 */
const RANKED_MAP_CAP = 200;

const LS_LIST_DIR = "gaia_list_pair_dir";
const LS_LIST_SRC = "gaia_list_setup_source";
const LS_LIST_SETUP = "gaia_list_pair_setup";
/**
 * 「この組を Total で見る」で Total タブへ渡す提案そのもの（2026-08-04）。
 * 上の LS_LIST_MAP / LS_LIST_SETUP は探索の**起点**なので、提案された結果とは別。
 * mapToSetup で出たセットアップは保存リストに無く id が無いため、入力ごと渡す。
 */
const LS_TOTAL_PENDING = "gaia_total_pending";
const LS_TILE_MODE = "gaia_tile_mode";
const LS_LIST_MAP = "gaia_list_pair_map";
const LS_LIST_MAP_LABEL = "gaia_list_pair_map_label";
const LS_LIST_CRITERION = "gaia_list_criterion";

// 保存した提案（マップ配置＋基準＋セットアップ入力の自己完結スナップショット）。
// DBマイグレーションを避け localStorage に保持し、画面上から即再表示する。2026-07-24。
// v2: 条件バケツ（conditionKey）で分けるため形が変わった。旧キーは読まない
// ＝旧データ破棄（2026-07-30 ユーザー確定）。
const LS_LIST_PROPOSALS = "gaia_list_proposals_v2";
const PROPOSALS_CAP = 50;
type SavedProposal = {
  id: string;
  /** どの条件で作った提案か（条件バケツのキー） */
  conditionKey: string;
  createdAt: number;
  criterion: RecommendCriterion;
  tid: string;
  mapPlacement: PlacementItem[];
  mapScore: number;
  mapHash: string;
  setupInput: BuildSetupInput;
  players: number;
  lf: boolean;
};
function loadProposals(): SavedProposal[] {
  try {
    const raw = localStorage.getItem(LS_LIST_PROPOSALS);
    if (!raw) return [];
    const a = JSON.parse(raw);
    return Array.isArray(a) ? (a as SavedProposal[]) : [];
  } catch {
    return [];
  }
}
function writeProposals(list: SavedProposal[]): void {
  try {
    localStorage.setItem(LS_LIST_PROPOSALS, JSON.stringify(list));
  } catch {}
}

// --- 提案ログ（生成のたびに自動で残す履歴、2026-07-25 要望） -----------------
// 「保存した提案」（明示保存・スナップショット）とは別物で、こちらは
// 何をどの条件で提案したかの記録。左ペインの空きスペースに出す。
const LS_LIST_PAIRLOG = "gaia_list_pair_log_v2";
const PAIRLOG_CAP = 30;
function loadPairLog(): PairLogEntry[] {
  try {
    const raw = localStorage.getItem(LS_LIST_PAIRLOG);
    if (!raw) return [];
    const a = JSON.parse(raw);
    return Array.isArray(a) ? (a as PairLogEntry[]) : [];
  } catch {
    return [];
  }
}
function writePairLog(list: PairLogEntry[]): void {
  try {
    localStorage.setItem(LS_LIST_PAIRLOG, JSON.stringify(list));
  } catch {}
}

export default function ListView() {
  const [lang, setLang] = React.useState<Lang>("ja");
  const [players, setPlayers] = React.useState<number>(4);
  const [expansion, setExpansion] = React.useState<Expansion>("base");
  const [pinnedMaps, setPinnedMaps] = React.useState<PersistedCandidate[]>([]);
  // ピン留めが無いとき用: 全保存マップ中スコア最上位（要望のデフォルト選択）
  const [topOverallMap, setTopOverallMap] = React.useState<PersistedCandidate | null>(null);
  const [templateIdBySearchKey, setTemplateIdBySearchKey] = React.useState<Record<string, string>>({});
  const [pinnedSetups, setPinnedSetups] = React.useState<SavedSetup[]>([]);
  // 探索用の全候補（2026-07-25 要望）。マップは「ピン留め＋ランキング」、
  // セットアップは「ピン留め＋保存リスト」から相手を探せるようにする。
  const [rankedMaps, setRankedMaps] = React.useState<PersistedCandidate[]>([]);
  const [allSetups, setAllSetups] = React.useState<SavedSetup[]>([]);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  // --- セット提案（マップ＋セットアップ、2026-07-24） ---
  const [pairMapId, setPairMapId] = React.useState<string>("");
  // 選択中マップの表示ラベルをキャッシュ。ピン留めは IndexedDB から非同期で
  // 読むので、ロード前は options が空になり select が「選択なし」→保存マップへ
  // 一拍遅れて切り替わる（ちらつき）。キャッシュしたラベルの合成 option を先に
  // 出して初回描画から正しい表示にする（#4/#6 List選択のちらつき解消）。
  const [pendingMapLabel, setPendingMapLabel] = React.useState<string>("");
  const [criterion, setCriterion] = React.useState<RecommendCriterion>("opposeMap");
  // 探索の向き / 相手の探し方 / セットアップ起点の選択（2026-07-25 要望）。
  const [pairDir, setPairDir] = React.useState<PairDir>("mapToSetup");
  const [setupSource, setSetupSource] = React.useState<SetupSource>("random");
  const [pairSetupId, setPairSetupId] = React.useState<string>("");
  // 提案結果のマップ。mapToSetup では起点の選択、setupToMap では探索結果。
  // 提案は上位 PAIR_TOP_N 件を出し、クリックで見比べる（2026-07-25 要望）。
  // 表示中の1件（rec / recMapTop / pairResultMapId）はここから導出する。
  const [pairOptions, setPairOptions] = React.useState<PairOption[]>([]);
  const [pairIndex, setPairIndex] = React.useState(0);
  const [recSettings, setRecSettings] = React.useState<{ players: number; lf: boolean } | null>(null);
  // 評価指数（カテゴリ別係数）。Setup タブと localStorage を共有し、
  // 表示だけでなくセット提案の選定（criterionScore に渡すスコア）にも効かせる。
  const [evalWeights, changeEvalWeight, resetEvalWeights, setAllEvalWeights] = useSetupWeights();
  // 種族優遇/冷遇（2026-07-31）。掛け先は「Mapの評価値＋Setupの評価値」の合計。
  const [factionPref, changeFactionPref, resetFactionPref] = useFactionPref();

  /**
   * いまの「条件」（2026-07-30）。Map の searchKey と同じ考え方で、この内容から
   * 決まるキーごとに提案・提案ログが分かれて貯まる。
   */
  const conditionParams = React.useMemo(
    () => ({ players, lf: expansion === "lostFleet", pairDir, setupSource, criterion, evalWeights }),
    [players, expansion, pairDir, setupSource, criterion, evalWeights]
  );
  const conditionKey = React.useMemo(() => conditionKeyOf(conditionParams), [conditionParams]);
  const [profiles, setProfiles] = React.useState<Array<ConditionProfile<typeof conditionParams>>>([]);
  const current = pairOptions[pairIndex] ?? null;
  const rec = current?.rec ?? null;
  const recMapTop = current?.mapTop ?? null;
  const pairResultMapId = current?.mapId ?? "";
  /** 生成し直し・条件変更で提案をクリアする。 */
  const clearPair = React.useCallback(() => {
    setPairOptions([]);
    setPairIndex(0);
  }, []);

  const [dbBlocked, setDbBlocked] = React.useState(false);
  const refreshProfiles = React.useCallback(async () => {
    const rows = await listConditionProfiles<typeof conditionParams>(STORE_LIST_PROFILES);
    setDbBlocked(isDbUpgradeBlocked());
    setProfiles(rows);
  }, []);

  /**
   * 「既定値のままの条件」か。人数・拡張は使う人の選択なので判定に含めない。
   * 既定値を変えたら自動的に追随する（2026-07-30 要望）。
   */
  const isDefaultParams = React.useCallback((params: typeof conditionParams) => {
    const q: any = params ?? {};
    const w = q.evalWeights;
    return (
      q.pairDir === "mapToSetup" &&
      q.setupSource === "random" &&
      q.criterion === "opposeMap" &&
      (!w || isDefaultWeights({ ...DEFAULT_SETUP_WEIGHTS, ...w }))
    );
  }, []);
  React.useEffect(() => {
    void refreshProfiles();
  }, [refreshProfiles]);

  /** 条件プロファイルを画面へ戻す。 */
  const applyProfile = React.useCallback(
    (p: ConditionProfile<typeof conditionParams>) => {
      const q: any = p.params ?? {};
      if (q.pairDir === "mapToSetup" || q.pairDir === "setupToMap") {
        setPairDir(q.pairDir);
        try { localStorage.setItem(LS_LIST_DIR, q.pairDir); } catch {}
      }
      if (q.setupSource === "random" || q.setupSource === "saved") {
        setSetupSource(q.setupSource);
        try { localStorage.setItem(LS_LIST_SRC, q.setupSource); } catch {}
      }
      if (typeof q.criterion === "string") {
        setCriterion(q.criterion as RecommendCriterion);
        try { localStorage.setItem(LS_LIST_CRITERION, q.criterion); } catch {}
      }
      setAllEvalWeights({ ...DEFAULT_SETUP_WEIGHTS, ...((q.evalWeights ?? {}) as SetupWeights) });
      clearPair();
    },
    [setAllEvalWeights, clearPair]
  );

  /** 条件を既定値へ戻す（結果は消さない）。 */
  const resetConditions = React.useCallback(() => {
    setPairDir("mapToSetup");
    try { localStorage.setItem(LS_LIST_DIR, "mapToSetup"); } catch {}
    setSetupSource("random");
    try { localStorage.setItem(LS_LIST_SRC, "random"); } catch {}
    setCriterion("opposeMap");
    try { localStorage.setItem(LS_LIST_CRITERION, "opposeMap"); } catch {}
    resetEvalWeights();
    clearPair();
  }, [resetEvalWeights, clearPair]);

  const summarizeCondition = React.useCallback(
    (params: typeof conditionParams) => {
      const q: any = params ?? {};
      const t2 = UI[lang];
      const parts: string[] = [];
      parts.push(q.lf ? t2.modeLF : t2.modeBase);
      parts.push(`${q.players ?? 4}p`);
      parts.push(q.pairDir === "setupToMap" ? t2.dirSetupToMap : t2.dirMapToSetup);
      if (q.pairDir === "mapToSetup") parts.push(q.setupSource === "saved" ? t2.srcSaved : t2.srcRandom);
      parts.push(criterionShort(q.criterion, t2));
      const w = q.evalWeights ?? {};
      const diff = Object.keys(w).filter((k) => (w as any)[k] !== (DEFAULT_SETUP_WEIGHTS as any)[k]).length;
      if (diff > 0) parts.push(`指数${diff}`);
      return parts.join(" / ");
    },
    [lang]
  );

  const [savedProposals, setSavedProposals] = React.useState<SavedProposal[]>([]);
  const [pairLog, setPairLog] = React.useState<PairLogEntry[]>([]);

  /** いまの条件バケツの提案ログ／保存提案だけを見せる。 */
  const pairLogHere = React.useMemo(
    () => pairLog.filter((e) => e.conditionKey === conditionKey),
    [pairLog, conditionKey]
  );
  const proposalsHere = React.useMemo(
    () => savedProposals.filter((p) => p.conditionKey === conditionKey),
    [savedProposals, conditionKey]
  );

  /**
   * 条件プロファイルの作成／件数の追従。結果が増えたあとに走らせたいので
   * effect にしてある（生成ハンドラ内で呼ぶと1回ぶん古い件数が入る）。
   * 結果が0件のうちは作らない＝空の条件が並ばない。
   */
  React.useEffect(() => {
    const n = pairLogHere.length + proposalsHere.length;
    if (n === 0) return;
    void upsertConditionProfile(STORE_LIST_PROFILES, conditionParams, { resultCount: n }).then(
      refreshProfiles
    );
  }, [pairLogHere.length, proposalsHere.length, conditionParams, refreshProfiles]);

  // 盤面の表示モード（画像／番号+向きの模式表示）。2026-07-25 要望。
  const [tileMode, setTileMode] = React.useState<"image" | "schematic">("image");
  const [pairMsg, setPairMsg] = React.useState<string | null>(null);
  const [recorded, setRecorded] = React.useState(false);
  // 共有されたセット（/list?h=&t=&s=）。捕捉は初回のみ（Strict Mode二重実行対応）。
  const pairCapturedRef = React.useRef(false);
  const [pairShared, setPairShared] = React.useState<{
    placement: any[];
    templateId: string;
    input: BuildSetupInput;
  } | null>(null);

  // 復元は読み取りのみ（書込みはユーザー操作ハンドラのみの規律）。
  // paint 前に走らせてタブ遷移時のちらつきを防ぐ。
  useIsoLayoutEffect(() => {
    // 旧スケールの評価指数・結果を捨てる（読む前に1回。2026-07-31）
    resetStaleEvalScaleStorage();
    const v = (() => {
      try {
        return localStorage.getItem("gaia_ui_lang");
      } catch {
        return null;
      }
    })();
    if (v === "ja" || v === "en") setLang(v);

    // 共有設定（人数・拡張）を復元（読取のみ）。
    const sp = readSharedPlayers();
    const se = readSharedExpansion();
    if (sp) setPlayers(sp);
    if (se) setExpansion(se);

    // マップ/基準の選択を復元（読取のみ）。paint 前に効くので DB ロード前でも
    // 正しい選択が即座に表示され、遷移後に一拍置いて切り替わるのを防ぐ。
    try {
      const savedMap = localStorage.getItem(LS_LIST_MAP);
      if (savedMap) setPairMapId(savedMap);
      const savedMapLabel = localStorage.getItem(LS_LIST_MAP_LABEL);
      if (savedMapLabel) setPendingMapLabel(savedMapLabel);
      const savedCrit = localStorage.getItem(LS_LIST_CRITERION);
      if (
        savedCrit === "opposeMap" ||
        savedCrit === "alignMap" ||
        savedCrit === "topBalance" ||
        savedCrit === "neutralBalance"
      ) {
        setCriterion(savedCrit as RecommendCriterion);
      }
      const savedDir = localStorage.getItem(LS_LIST_DIR);
      if (savedDir === "mapToSetup" || savedDir === "setupToMap") setPairDir(savedDir);
      const savedSrc = localStorage.getItem(LS_LIST_SRC);
      if (savedSrc === "random" || savedSrc === "saved") setSetupSource(savedSrc);
      const savedSetupId = localStorage.getItem(LS_LIST_SETUP);
      if (savedSetupId) setPairSetupId(savedSetupId);
      const savedTileMode = localStorage.getItem(LS_TILE_MODE);
      if (savedTileMode === "image" || savedTileMode === "schematic") setTileMode(savedTileMode);
    } catch {}

    // 保存した提案・提案ログを復元（読取のみ）。
    setSavedProposals(loadProposals());
    setPairLog(loadPairLog());

    let alive = true;
    void (async () => {
      try {
        const db = await openDb();
        const all = await idbGetAllFromStore<PersistedCandidate>(db, STORE_CANDIDATES);
        const pins = all
          .filter((c) => c.pinned)
          .sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0));
        // スコア最上位（高いほど上位）。ピン留めが無いときのデフォルト選択に使う。
        const top = all.slice().sort((a, b) => Number(b.score) - Number(a.score))[0] ?? null;
        const profiles = await loadProfilesFromDb(500);
        const tmap: Record<string, string> = {};
        for (const p of profiles) {
          const tid = String(p.templateId ?? (p.params as any)?.templateId ?? "");
          if (tid) tmap[p.searchKey] = tid;
        }
        if (alive) {
          setPinnedMaps(pins);
          setTopOverallMap(top);
          setTemplateIdBySearchKey(tmap);
          // ランキング（全保存マップのスコア降順）。探索の候補プールに使う。
          setRankedMaps(all.slice().sort((a, b) => Number(b.score) - Number(a.score)).slice(0, RANKED_MAP_CAP));
        }
      } catch {
        // ignore
      }
      try {
        const rows = await listSavedSetups();
        if (alive) {
          setPinnedSetups(rows.filter((r) => r.pinned));
          setAllSetups(rows);
        }
      } catch {
        // ignore
      }
    })();
    // 共有されたセット（?h=&t=&s=）を捕捉してURLを浄化（?h=/?s=と同じ作法）
    try {
      if (!pairCapturedRef.current) {
        pairCapturedRef.current = true;
        const sp = new URLSearchParams(window.location.search);
        const h = sp.get("h");
        const tid = sp.get("t");
        const s = sp.get("s");
        if (h !== null || s !== null || tid !== null) {
          sp.delete("h");
          sp.delete("t");
          sp.delete("s");
          const qs = sp.toString();
          window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
          const placement = h ? decodePlacementToken(h) : null;
          const input = s ? decodeSetupToken(s) : null;
          if (placement && tid && input && TEMPLATE_BY_ID[tid]) {
            setPairShared({ placement, templateId: tid, input });
          }
        }
      }
    } catch {
      // ignore
    }

    return () => {
      alive = false;
    };
  }, []);

  const sectorById = React.useMemo(() => buildSectorLookup(getAllSectors() as any), []);
  const sectorImgById = React.useMemo(() => buildSectorImgById(), []);

  // ペア提案のマップ候補: ピン留め（スコア降順）を先頭に、続けてランキング
  // （全保存マップのスコア降順、重複除去）。ピン留めが無くてもランキングから
  // 選べる／探せるようにする（2026-07-25 要望）。
  // 重複除去は「盤面」単位（テンプレ＋placementHash）。同じ盤面が別の検索条件
  // （searchKey）で保存されていると id は別なので、id 単位では同一マップが候補に
  // 複数並んでしまう（2026-07-25 報告）。ロジックは mapCandidates.ts（テスト済み）。
  const selectableMaps = React.useMemo<PersistedCandidate[]>(
    () =>
      buildMapPool({
        pinned: pinnedMaps,
        ranked: rankedMaps,
        templateIdBySearchKey,
        topOverall: topOverallMap,
      }),
    [pinnedMaps, rankedMaps, topOverallMap, templateIdBySearchKey]
  );

  // セットアップ候補: ピン留めを先頭に、続けて保存リスト（新しい順）。
  const selectableSetups = React.useMemo<SavedSetup[]>(() => {
    const pins = allSetups.filter((r) => r.pinned);
    const seen = new Set(pins.map((r) => r.id));
    return [...pins, ...allSetups.filter((r) => !seen.has(r.id))];
  }, [allSetups]);

  // List を開いた時点のデフォルト選択（最優先=ピン留め最上位→無ければ全体最上位）。
  // 復元した pairMapId が選択候補に無い場合（ピン解除後など）もデフォルトへフォールバック。
  React.useEffect(() => {
    if (selectableMaps.length > 0 && !selectableMaps.some((m) => m.id === pairMapId)) {
      setPairMapId(selectableMaps[0].id);
    }
  }, [selectableMaps, pairMapId]);

  // セットアップ起点も同様に、候補に無ければ先頭へフォールバック。
  React.useEffect(() => {
    if (selectableSetups.length > 0 && !selectableSetups.some((r) => r.id === pairSetupId)) {
      setPairSetupId(selectableSetups[0].id);
    }
  }, [selectableSetups, pairSetupId]);

  // 共通バーからの人数/拡張選択（共有localStorageへ書込＋ローカル状態更新）。
  const onGlobalSelect = React.useCallback((p: number, e: Expansion) => {
    const np = e === "lostFleet" ? Math.max(2, p) : p;
    setPlayers(np);
    setExpansion(e);
    writeSharedPlayers(np);
    writeSharedExpansion(e);
  }, []);

  const t = UI[lang];

  const setLangPersist = React.useCallback((l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem("gaia_ui_lang", l);
    } catch {
      // ignore
    }
  }, []);

  const flashCopied = React.useCallback((key: string, text: string) => {
    copyText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((v) => (v === key ? null : v)), 2000);
  }, []);

  const unpinMap = React.useCallback(async (c: PersistedCandidate) => {
    try {
      const db = await openDb();
      await idbPutAll(db, STORE_CANDIDATES, [
        { ...c, pinned: false, pinnedAt: undefined, updatedAt: Date.now() },
      ]);
      setPinnedMaps((prev) => prev.filter((x) => x.id !== c.id));
    } catch {
      // ignore
    }
  }, []);

  const unpinSetup = React.useCallback(async (id: string) => {
    const rows = await setSetupPinned(id, false);
    setPinnedSetups(rows.filter((r) => r.pinned));
  }, []);

  const mapToken = React.useCallback((c: PersistedCandidate): string => {
    try {
      return encodePlacementToken(c.placement as any);
    } catch {
      return "";
    }
  }, []);

  /** 生成のたびに提案ログへ1件積む（先頭候補の内容を記録）。 */
  const pushPairLog = React.useCallback(
    (e: PairLogPayload) => {
      const at = Date.now();
      const entry: PairLogEntry = { ...e, conditionKey, at, id: `${at}-${e.seed}-${e.mapHash}` };
      setPairLog((prev) => {
        const next = [entry, ...prev].slice(0, PAIRLOG_CAP);
        writePairLog(next);
        return next;
      });
    },
    [conditionKey]
  );

  // セット提案の生成（上位 PAIR_TOP_N 件を提示。要望 2026-07-25）。
  // 選定そのものは pairPlan.ts の純粋関数に任せ、ここは結果を画面へ反映するだけ。
  const handleGenerate = React.useCallback(() => {
    setRecorded(false);
    const plan = planPair({
      pairDir,
      setupSource,
      criterion,
      pairMapId,
      pairSetupId,
      selectableMaps,
      selectableSetups,
      templateIdBySearchKey,
      evalWeights,
      factionPref,
    });
    if (!plan.ok) {
      setPairMsg(UI[lang][plan.failure]);
      clearPair();
      return;
    }
    setPairMsg(plan.note === "mapIndependent" ? UI[lang].mapIndependentNote : null);
    setPairOptions(plan.options);
    setPairIndex(0);
    setRecSettings(plan.settings);
    if (plan.log) pushPairLog(plan.log);
  }, [
    pushPairLog,
    selectableMaps,
    selectableSetups,
    pairMapId,
    pairSetupId,
    pairDir,
    setupSource,
    criterion,
    templateIdBySearchKey,
    clearPair,
    lang,
    evalWeights,
    factionPref,
  ]);

  /**
   * 提案ログのクリックで、その時の候補一覧を再表示する。
   * セットアップは保存した入力から決定論的に再構築、マップは盤面ハッシュで
   * 現在の候補から引き当てる（ピン解除やDB整理で失われていればマップなし表示）。
   */
  const restoreFromLog = React.useCallback(
    (e: PairLogEntry) => {
      if (!e.opts || e.opts.length === 0) return;
      const opts: PairOption[] = e.opts.map((o, i) => {
        const map = o.mapHash
          ? (selectableMaps.find((c) => String(c.placementHash ?? "") === o.mapHash) ?? null)
          : null;
        const result = buildSetupFromSeed(o.input);
        return {
          key: `log:${e.id}:${i}`,
          mapId: map?.id ?? "",
          mapTop: map ? (mapTopOf(map, templateIdBySearchKey)?.detail ?? null) : null,
          rec: {
            input: o.input,
            result,
            setupScores: scoreSetupFactions(result, evalWeights),
            criterion: e.criterion,
            score: o.score,
            trials: e.count,
          },
        };
      });
      // 操作側の選択もログの条件に合わせる（表示と条件がズレないように）。
      setPairDir(e.dir);
      setSetupSource(e.source);
      setCriterion(e.criterion);
      setPairOptions(opts);
      setPairIndex(0);
      setRecSettings({ players: e.players, lf: e.lf });
      setRecorded(false);
      const lostMap = !!e.mapHash && !opts.some((o) => o.mapId);
      setPairMsg(lostMap ? UI[lang].logMapMissing : null);
    },
    [selectableMaps, templateIdBySearchKey, lang, evalWeights]
  );

  const handleRecordRec = React.useCallback(() => {
    if (!rec) return;
    void recordSetup(rec.input).then((rows) => {
      setPinnedSetups(rows.filter((r) => r.pinned));
      setRecorded(true);
    });
  }, [rec]);

  // 提案（マップ＋基準＋セットアップ）を自己完結スナップショットとして保存。
  const handleSaveProposal = React.useCallback(() => {
    if (!rec || !recSettings) return;
    const selected = selectableMaps.find((c) => c.id === pairResultMapId) ?? null;
    const tid = selected ? (templateIdBySearchKey[selected.searchKey] ?? "") : "";
    const prop: SavedProposal = {
      id: `${pairResultMapId}|${criterion}|${rec.input.seed}|${Date.now()}`,
      conditionKey,
      createdAt: Date.now(),
      criterion,
      tid,
      mapPlacement: (selected?.placement ?? []) as PlacementItem[],
      mapScore: Number(selected?.score ?? 0),
      mapHash: String(selected?.placementHash ?? ""),
      setupInput: rec.input,
      players: recSettings.players,
      lf: recSettings.lf,
    };
    setSavedProposals((prev) => {
      const next = [prop, ...prev].slice(0, PROPOSALS_CAP);
      writeProposals(next);
      return next;
    });
  }, [rec, recSettings, selectableMaps, pairResultMapId, criterion, templateIdBySearchKey, conditionKey]);

  const handleDeleteProposal = React.useCallback((id: string) => {
    setSavedProposals((prev) => {
      const next = prev.filter((p) => p.id !== id);
      writeProposals(next);
      return next;
    });
  }, []);

  const criterionLabel = React.useCallback(
    (c: RecommendCriterion) =>
      c === "opposeMap" ? t.crit1 : c === "alignMap" ? t.crit4 : c === "topBalance" ? t.crit2 : t.crit3,
    [t]
  );

  return (
    <>
      <GlobalBar
        active="list"
        players={players}
        expansion={expansion}
        onSelect={onGlobalSelect}
        lang={lang}
        onLang={setLangPersist}
      />
    <PageBody>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{t.title}</div>
        <div style={{ fontSize: 11, opacity: 0.6 }}>{t.note}</div>
      </div>

      {/* 統一レイアウト: 左=探索条件（操作）／右=結果（共有セット・候補・保存・ピン留め） */}
      <TwoCol
        left={
          <>
          <Panel title={t.pairTitle} note={t.pairNote}>
            {/* コントロールは「幅が変わらないもの」を1行目に固定順で置き、選択肢の
                ラベル長で幅が変わる起点セレクトは最後の行に単独で置く（探索の向きで
                並びや位置がズレないようにする。2026-07-25 要望）。探し方は向きに
                関わらず常に同じ位置に出し、使えないときは無効化する。 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span>{t.pairDirLabel}</span>
                <select
                  value={pairDir}
                  onChange={(e) => {
                    const v = e.target.value as PairDir;
                    setPairDir(v);
                    try { localStorage.setItem(LS_LIST_DIR, v); } catch {}
                    clearPair();
                    setPairMsg(null);
                  }}
                  style={{ width: 190 }}
                >
                  <option value="mapToSetup">{t.dirMapToSetup}</option>
                  <option value="setupToMap">{t.dirSetupToMap}</option>
                </select>
              </label>

                <label
                  style={{ display: "flex", gap: 6, alignItems: "center", opacity: pairDir === "mapToSetup" ? 1 : 0.45 }}
                  title={pairDir === "mapToSetup" ? undefined : t.srcDisabledHint}
                >
                  <span>{t.setupSourceLabel}</span>
                  <select
                    value={setupSource}
                    disabled={pairDir !== "mapToSetup"}
                    onChange={(e) => {
                      const v = e.target.value as SetupSource;
                      setSetupSource(v);
                      try { localStorage.setItem(LS_LIST_SRC, v); } catch {}
                      clearPair();
                      setPairMsg(null);
                    }}
                    style={{ width: 150 }}
                  >
                    <option value="random">{t.srcRandom}</option>
                    <option value="saved">{t.srcSaved}</option>
                  </select>
                </label>

              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span>{t.pairCriterion}</span>
                <select
                  value={criterion}
                  onChange={(e) => {
                    setCriterion(e.target.value as RecommendCriterion);
                    try { localStorage.setItem(LS_LIST_CRITERION, e.target.value); } catch {}
                    clearPair();
                    setPairMsg(null);
                  }}
                  style={{ width: 260 }}
                >
                  <option value="opposeMap">{t.crit1}</option>
                  <option value="topBalance">{t.crit2}</option>
                  <option value="neutralBalance">{t.crit3}</option>
                  <option value="alignMap">{t.crit4}</option>
                </select>
              </label>
              {/* 盤面の表示モード。ミニ盤面は小さくタイルが判別しづらいため、
                  番号＋向きだけの模式表示に切り替えられる（2026-07-25 要望）。 */}
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span>{t.tileModeLabel}</span>
                <select
                  value={tileMode}
                  onChange={(e) => {
                    const v = e.target.value as "image" | "schematic";
                    setTileMode(v);
                    try { localStorage.setItem(LS_TILE_MODE, v); } catch {}
                  }}
                  style={{ width: 130 }}
                >
                  <option value="image">{t.tileImage}</option>
                  <option value="schematic">{t.tileSchematic}</option>
                </select>
              </label>
              <button onClick={handleGenerate} style={{ padding: "3px 12px", fontWeight: 700 }}>
                {rec ? t.regenerate : t.generate}
              </button>
              </div>

              {/* 可変長の起点セレクト。この行の後ろには何も置かない（幅が変わっても
                  他のコントロールの位置がズレないようにするため）。 */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {pairDir === "setupToMap" ? (
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span>{t.pairSetup}</span>
                  <select
                    value={pairSetupId}
                    onChange={(e) => {
                      setPairSetupId(e.target.value);
                      try { localStorage.setItem(LS_LIST_SETUP, e.target.value); } catch {}
                      clearPair();
                      setPairMsg(null);
                    }}
                    style={{ maxWidth: 300 }}
                  >
                    {selectableSetups.map((r) => {
                      const s = setupSettingsOf(r);
                      return (
                        <option key={r.id} value={r.id}>
                          {r.pinned ? "📌 " : ""}
                          {r.input.seed} / {s.lf ? t.modeLF : t.modeBase} {s.players}p
                        </option>
                      );
                    })}
                  </select>
                </label>
              ) : null}
    
              {pairDir === "mapToSetup" ? (
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span>{t.pairMap}</span>
                <select
                  value={pairMapId}
                  onChange={(e) => {
                    setPairMapId(e.target.value);
                    const label = e.target.options[e.target.selectedIndex]?.text ?? "";
                    setPendingMapLabel(label);
                    try {
                      localStorage.setItem(LS_LIST_MAP, e.target.value);
                      localStorage.setItem(LS_LIST_MAP_LABEL, label);
                    } catch {}
                    clearPair();
                    setPairMsg(null);
                  }}
                  style={{ maxWidth: 260 }}
                >
                  <option value="">{t.pairNoMap}</option>
                  {/* ロード前は候補が空。保存マップの合成 option を先に出してちらつき防止。 */}
                  {pairMapId && pendingMapLabel && !selectableMaps.some((m) => m.id === pairMapId) ? (
                    <option value={pairMapId}>{pendingMapLabel}</option>
                  ) : null}
                  {selectableMaps.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.pinned ? "📌 " : ""}
                      {templateMeta(templateIdBySearchKey[c.searchKey] ?? "", t)} / {Math.round(Number(c.score))} /{" "}
                      {String(c.placementHash ?? "").slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              ) : null}
              </div>
              {pairMsg ? <span style={{ color: "#b3261e" }}>{pairMsg}</span> : null}
            </div>
          </Panel>
          {/* 保存済み条件（Map/Setup と同じ操作。条件ごとに提案・ログが分かれる） */}
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
              void upsertConditionProfile(STORE_LIST_PROFILES, p.params, { name }).then(refreshProfiles);
            }}
            onDeleteMeta={(key) => {
              void deleteConditionProfile(STORE_LIST_PROFILES, key).then(refreshProfiles);
            }}
            onDeleteAll={(key) => {
              setPairLog((prev) => {
                const next = prev.filter((e) => e.conditionKey !== key);
                writePairLog(next);
                return next;
              });
              setSavedProposals((prev) => {
                const next = prev.filter((p) => p.conditionKey !== key);
                writeProposals(next);
                return next;
              });
              void deleteConditionProfile(STORE_LIST_PROFILES, key).then(refreshProfiles);
            }}
            onResetDefaults={resetConditions}
          />

          {/* 評価（種族別）＋評価指数。表示中の提案セットアップを評価する。
              提案未生成のときは表を空にして評価指数だけ出す（先に指数を決めて
              から生成する使い方ができるように）。 */}
          <Panel>
            <FactionEvalPanel
              result={rec?.result ?? null}
              weights={evalWeights}
              onChangeWeight={changeEvalWeight}
              onResetWeights={resetEvalWeights}
              lang={lang}
              lf={recSettings?.lf ?? expansion === "lostFleet"}
              players={recSettings?.players ?? players}
            />
            {/* 種族優遇/冷遇（2026-07-31）。List は色ではなく種族ごとで、
                掛け先は「Map の評価値＋Setup の評価値」の合計。 */}
            <div style={{ marginTop: 10 }}>
              <FactionPrefInputs
                pref={factionPref}
                onChange={changeFactionPref}
                onReset={resetFactionPref}
                lang={lang}
                lf={recSettings?.lf ?? expansion === "lostFleet"}
              />
            </div>
          </Panel>
          {/* 提案ログ: 生成のたびに自動で積む履歴（左ペインの空きスペース）。 */}
          {pairLogHere.length > 0 ? (
            <Panel
              title={`${t.pairLog} (${pairLogHere.length})`}
              note={
                <button
                  onClick={() => {
                    setPairLog([]);
                    writePairLog([]);
                  }}
                  style={{ fontSize: 11 }}
                >
                  {t.clearLog}
                </button>
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {pairLogHere.map((e) => {
                  const canRestore = !!e.opts && e.opts.length > 0;
                  return (
                  <div
                    key={e.id}
                    onClick={canRestore ? () => restoreFromLog(e) : undefined}
                    title={canRestore ? t.logRestoreHint : t.logNoRestore}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "baseline",
                      flexWrap: "wrap",
                      fontSize: 11,
                      borderBottom: "1px solid rgba(0,0,0,0.06)",
                      padding: "3px 0",
                      cursor: canRestore ? "pointer" : "default",
                      opacity: canRestore ? 1 : 0.55,
                    }}
                  >
                    <span style={{ opacity: 0.55, minWidth: 74 }}>{fmtWhen(e.at, lang)}</span>
                    <span style={{ fontWeight: 700 }}>
                      {e.dir === "setupToMap" ? t.dirSetupToMap : t.dirMapToSetup}
                    </span>
                    <span style={{ opacity: 0.75 }}>
                      {e.dir === "mapToSetup" ? (e.source === "saved" ? t.srcSaved : t.srcRandom) : ""}
                    </span>
                    <span style={{ opacity: 0.75 }}>{criterionShort(e.criterion, t)}</span>
                    <span>{e.lf ? t.modeLF : t.modeBase} {e.players}p</span>
                    {e.mapHash ? (
                      <span style={{ fontFamily: "monospace" }}>
                        M:{e.mapHash.slice(0, 6)}
                        {e.mapScore ? `/${Math.round(e.mapScore)}` : ""}
                      </span>
                    ) : null}
                    <span style={{ fontFamily: "monospace" }}>S:{e.seed}</span>
                    <span style={{ marginLeft: "auto", opacity: 0.6 }}>
                      {t.candidates}
                      {e.count}
                    </span>
                  </div>
                  );
                })}
              </div>
            </Panel>
          ) : null}
          </>
        }
        right={
          <>
      {/* Shared pair (?h=&t=&s=) */}
      {pairShared
        ? (() => {
            const template = TEMPLATE_BY_ID[pairShared.templateId];
            const bToken = (() => {
              try {
                return encodePlacementToken(pairShared.placement as any);
              } catch {
                return "";
              }
            })();
            const sToken = encodeSetupToken(pairShared.input);
            const scores = scoreSetupFactions(buildSetupFromSeed(pairShared.input), evalWeights);
            const lfShared = pairShared.input.mode === "lostFleet";
            return (
              <section
                style={{ border: "1px solid #7aa7e8", background: "#f2f7ff", borderRadius: 8, padding: 10 }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.sharedPairTitle}</div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 6 }}>
                    {template ? (
                      <div style={{ pointerEvents: "none", overflow: "hidden", borderRadius: 8 }}>
                        <MapBoardViewer
                          template={template as any}
                          placement={pairShared.placement as PlacementItem[]}
                          sectorById={sectorById as any}
                          sectorImgById={sectorImgById}
                          imgOffsetBySlotId={IMG_OFFSET_BY_SLOT as any}
                          rotOffsetsBySlotId={ROT_OFFSETS_BY_SLOT as any}
                          scaleByAccepts={{ LARGE: 1.02, MIDDLE: 0.93, SMALL: 1.1 }}
                          boundsPad={40}
                          zoom={1.0}
                          showToolbar={false}
                          disablePan
                          bgColor="transparent"
                          nudgeYpx={10}
                          tileMode={tileMode}
                        />
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, opacity: 0.6 }}>{t.unknownTemplate}</div>
                    )}
                    {bToken ? (
                      <Link href={`/board?h=${bToken}${pairShared.templateId ? `&t=${pairShared.templateId}` : ""}`} style={{ fontSize: 12 }}>
                        {t.openBoard}
                      </Link>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, minWidth: 260 }}>
                    <div>
                      <span style={{ opacity: 0.7 }}>{t.seed}:</span>{" "}
                      <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{pairShared.input.seed}</span>
                      {" ・ "}
                      {lfShared ? t.modeLF : t.modeBase}
                      {" ・ "}
                      {t.players}: {pairShared.input.playerCount ?? 4}
                    </div>
                    <div>
                      <span style={{ opacity: 0.7 }}>{t.setupStrong}:</span>{" "}
                      {topFactionText(scores, 5, lang, lfShared)}
                    </div>
                    <Link href={`/setup?s=${sToken}`} style={{ fontSize: 12 }}>
                      {t.openSetup}
                    </Link>
                  </div>
                </div>
              </section>
            );
          })()
        : null}

      <section>

        {/* 候補（上位 PAIR_TOP_N）。クリックで下の詳細を切り替えて見比べる。 */}
        {pairOptions.length > 1 ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, opacity: 0.6 }}>{t.candidates}</span>
            {pairOptions.map((o, i) => {
              const active = i === pairIndex;
              const m = selectableMaps.find((c) => c.id === o.mapId) ?? null;
              // 向きで見出しを変える: マップ探索なら盤面、セットアップ探索ならシード。
              const label =
                pairDir === "setupToMap"
                  ? `${String(m?.placementHash ?? "").slice(0, 6) || "?"} / ${Math.round(Number(m?.score ?? 0))}`
                  : String(o.rec.input.seed);
              return (
                <button
                  key={o.key}
                  onClick={() => setPairIndex(i)}
                  title={`${t.score}: ${Math.round(o.rec.score * 100) / 100}`}
                  style={{
                    fontSize: 11,
                    padding: "3px 9px",
                    borderRadius: 6,
                    cursor: "pointer",
                    border: active ? "2px solid #4a90d9" : "1px solid #ccc",
                    background: active ? "#eef6ff" : "white",
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {i + 1}. {label}
                </button>
              );
            })}
          </div>
        ) : null}

        {rec && recSettings
          ? (() => {
              const selected = selectableMaps.find((c) => c.id === pairResultMapId) ?? null;
              const tid = selected ? (templateIdBySearchKey[selected.searchKey] ?? null) : null;
              const sToken = encodeSetupToken(rec.input);
              const pairPath =
                selected && tid
                  ? `/list?h=${mapToken(selected)}&t=${tid}&s=${sToken}`
                  : `/setup?s=${sToken}`;
              return (
                <div
                  style={{
                    marginTop: 8,
                    border: "1px solid #ddd",
                    background: "#fafafa",
                    borderRadius: 8,
                    padding: "8px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <div>
                    <span style={{ opacity: 0.7 }}>{t.seed}:</span>{" "}
                    <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{rec.input.seed}</span>
                    {" ・ "}
                    {recSettings.lf ? t.modeLF : t.modeBase}
                    {" ・ "}
                    {t.players}: {recSettings.players}
                    {" ・ "}
                    <span style={{ opacity: 0.55 }}>{t.trialsNote}</span>
                  </div>
                  {recMapTop ? (
                    <div>
                      <span style={{ opacity: 0.7 }}>{t.mapStrong}:</span>{" "}
                      {recMapTop
                        .map((x) => `${factionLabel(x.id, lang)} ${Math.round(x.score)}`)
                        .join(" / ")}
                    </div>
                  ) : null}
                  <div>
                    <span style={{ opacity: 0.7 }}>{t.setupStrong}:</span>{" "}
                    {topFactionText(rec.setupScores, 5, lang, recSettings.lf)}
                  </div>
                  {/* Map と Setup を足した合計の上位4種族（2026-08-04 要望）。提案を見た
                      時点で「この組ならどの種族が強いか」が分かるようにする。内訳は
                      Total タブで見る。評価内訳を持たない古い候補では出さない。 */}
                  {(() => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const bd = (selected as any)?.evaluation?.breakdown ?? null;
                    if (!bd) return null;
                    return (
                      <div>
                        <span style={{ opacity: 0.7 }}>{t.totalStrong}:</span>{" "}
                        {topTotalText(
                          mapValueByFaction(bd),
                          rec.setupScores,
                          4,
                          lang,
                          recSettings.lf
                        )}
                        {"　"}
                        {/* この提案そのものを Total タブへ渡す（2026-08-04）。提案の
                            セットアップは保存リストに無いので、入力ごと localStorage
                            へ置いてから遷移する。 */}
                        <Link
                          href="/total"
                          onClick={() => {
                            try {
                              localStorage.setItem(
                                LS_TOTAL_PENDING,
                                JSON.stringify({ mapId: pairResultMapId, setupInput: rec.input })
                              );
                            } catch {}
                          }}
                          style={{ color: "#2733cc" }}
                        >
                          {t.toTotal}
                        </Link>
                      </div>
                    );
                  })()}

                  {/* 提案中のマップとセットアップを画像で表示（ミニ盤面＋縮小セットアップ）。2026-07-24 */}
                  {(() => {
                    const template = tid ? TEMPLATE_BY_ID[tid] : null;
                    const setupResult = buildSetupFromSeed(rec.input);
                    return (
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start", marginTop: 2 }}>
                        {template && selected ? (
                          <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ pointerEvents: "none", overflow: "hidden", borderRadius: 8 }}>
                              <MapBoardViewer
                                template={template as any}
                                placement={(selected.placement ?? []) as PlacementItem[]}
                                sectorById={sectorById as any}
                                sectorImgById={sectorImgById}
                                imgOffsetBySlotId={IMG_OFFSET_BY_SLOT as any}
                                rotOffsetsBySlotId={ROT_OFFSETS_BY_SLOT as any}
                                scaleByAccepts={{ LARGE: 1.02, MIDDLE: 0.93, SMALL: 1.1 }}
                                boundsPad={40}
                                zoom={1.0}
                                showToolbar={false}
                                disablePan
                                bgColor="transparent"
                          nudgeYpx={10}
                          tileMode={tileMode}
                              />
                            </div>
                          </div>
                        ) : null}
                        <div style={{ transformOrigin: "top left" }}>
                          <SetupBoard result={setupResult} lang={lang} compact />
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {selected && tid ? (
                      <Link
                        href={`/board?h=${mapToken(selected)}${tid ? `&t=${tid}` : ""}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          border: "1px solid #ccc",
                          borderRadius: 6,
                          background: "white",
                          textDecoration: "none",
                          color: "#333",
                        }}
                      >
                        {t.openMap}
                      </Link>
                    ) : null}
                    <Link
                      href={`/setup?s=${sToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        border: "1px solid #ccc",
                        borderRadius: 6,
                        background: "white",
                        textDecoration: "none",
                        color: "#333",
                      }}
                    >
                      {t.openSetup}
                    </Link>
                    <button
                      onClick={() => flashCopied("pair", `${window.location.origin}${pairPath}`)}
                      style={{ fontSize: 11 }}
                    >
                      {copiedKey === "pair" ? t.shareCopied : t.sharePair}
                    </button>
                    <button onClick={handleRecordRec} style={{ fontSize: 11 }} disabled={recorded}>
                      {recorded ? t.recorded : t.recordToList}
                    </button>
                    <button onClick={handleSaveProposal} style={{ fontSize: 11 }}>
                      {t.saveProposal}
                    </button>
                  </div>
                </div>
              );
            })()
          : null}
      </section>

      {/* 保存した提案（自己完結スナップショット。マップが後でピン解除されても再表示可能）。2026-07-24 */}
      {proposalsHere.length > 0 ? (
        <section>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            {t.savedProposals} ({proposalsHere.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {proposalsHere.map((p) => {
              const template = TEMPLATE_BY_ID[p.tid];
              const setupResult = buildSetupFromSeed(p.setupInput);
              let bToken = "";
              try {
                bToken = encodePlacementToken(p.mapPlacement as any);
              } catch {}
              const sToken = encodeSetupToken(p.setupInput);
              const linkStyle: React.CSSProperties = {
                fontSize: 11,
                padding: "2px 8px",
                border: "1px solid #ccc",
                borderRadius: 6,
                background: "white",
                textDecoration: "none",
                color: "#333",
              };
              return (
                <div
                  key={p.id}
                  style={{ border: "1px solid #ddd", borderRadius: 8, background: "#fafafa", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ opacity: 0.75 }}>
                      {criterionLabel(p.criterion)} ・ {p.lf ? t.modeLF : t.modeBase} ・ {t.players}: {p.players} ・{" "}
                      <span style={{ fontFamily: "monospace" }}>seed {p.setupInput.seed}</span> ・ {Math.round(p.mapScore)} ・{" "}
                      <span style={{ fontFamily: "monospace" }}>{String(p.mapHash).slice(0, 8)}</span>
                    </span>
                    <span style={{ marginLeft: "auto" }} />
                    <button onClick={() => handleDeleteProposal(p.id)} style={{ fontSize: 11 }}>
                      {t.deleteProposal}
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
                    {template ? (
                      <div style={{ width: 300, pointerEvents: "none", overflow: "hidden", borderRadius: 8 }}>
                        <MapBoardViewer
                          template={template as any}
                          placement={p.mapPlacement}
                          sectorById={sectorById as any}
                          sectorImgById={sectorImgById}
                          imgOffsetBySlotId={IMG_OFFSET_BY_SLOT as any}
                          rotOffsetsBySlotId={ROT_OFFSETS_BY_SLOT as any}
                          scaleByAccepts={{ LARGE: 1.02, MIDDLE: 0.93, SMALL: 1.1 }}
                          boundsPad={40}
                          zoom={1.0}
                          showToolbar={false}
                          disablePan
                          bgColor="transparent"
                          nudgeYpx={10}
                          tileMode={tileMode}
                        />
                      </div>
                    ) : null}
                    <SetupBoard result={setupResult} lang={lang} compact />
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {bToken ? (
                      <Link href={`/board?h=${bToken}${p.tid ? `&t=${p.tid}` : ""}`} style={linkStyle}>
                        {t.openMap}
                      </Link>
                    ) : null}
                    <Link href={`/setup?s=${sToken}`} style={linkStyle}>
                      {t.openSetup}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Pinned maps */}
      <section>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>
          {t.maps} ({pinnedMaps.length})
        </div>
        {pinnedMaps.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.6 }}>{t.emptyMaps}</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
            {pinnedMaps.map((c) => {
              const tid = templateIdBySearchKey[c.searchKey] ?? "";
              const template = TEMPLATE_BY_ID[tid];
              const token = mapToken(c);
              const href = token ? `/board?h=${token}${tid ? `&t=${tid}` : ""}` : "/board";
              const key = `map:${c.id}`;
              return (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: 8,
                    width: 300,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    background: "#fafafa",
                  }}
                >
                  {template ? (
                    <Link href={href} title={t.open} style={{ display: "block", pointerEvents: "auto" }}>
                      {/* ミニ描画: 操作不要のため pan 無効・ツールバー非表示 */}
                      <div style={{ width: "100%", pointerEvents: "none", overflow: "hidden", borderRadius: 8 }}>
                        <MapBoardViewer
                          template={template as any}
                          placement={(c.placement ?? []) as PlacementItem[]}
                          sectorById={sectorById as any}
                          sectorImgById={sectorImgById}
                          imgOffsetBySlotId={IMG_OFFSET_BY_SLOT as any}
                          rotOffsetsBySlotId={ROT_OFFSETS_BY_SLOT as any}
                          scaleByAccepts={{ LARGE: 1.02, MIDDLE: 0.93, SMALL: 1.1 }}
                          boundsPad={40}
                          zoom={1.0}
                          showToolbar={false}
                          disablePan
                          bgColor="transparent"
                          nudgeYpx={10}
                          tileMode={tileMode}
                        />
                      </div>
                    </Link>
                  ) : (
                    <div style={{ fontSize: 12, opacity: 0.6 }}>{t.unknownTemplate}</div>
                  )}
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", fontSize: 12 }}>
                    <span>📌</span>
                    <span>{templateMeta(tid, t)}</span>
                    <span>
                      <span style={{ opacity: 0.7 }}>{t.score}:</span> {Math.round(Number(c.score))}
                    </span>
                    <span style={{ fontFamily: "monospace", opacity: 0.8 }}>
                      {String(c.placementHash ?? "").slice(0, 8)}
                    </span>
                    {c.used ? <span style={{ opacity: 0.7 }}>{t.used}</span> : null}
                    <span style={{ opacity: 0.55, marginLeft: "auto" }}>{fmtWhen(c.pinnedAt, lang)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Link
                      href={href}
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        border: "1px solid #ccc",
                        borderRadius: 6,
                        background: "white",
                        textDecoration: "none",
                        color: "#333",
                      }}
                    >
                      {t.open}
                    </Link>
                    <button
                      onClick={() => flashCopied(key, `${window.location.origin}${href}`)}
                      style={{ fontSize: 11 }}
                      disabled={!token}
                    >
                      {copiedKey === key ? t.shareCopied : t.share}
                    </button>
                    <button onClick={() => void unpinMap(c)} style={{ fontSize: 11, marginLeft: "auto" }}>
                      {t.unpin}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Pinned setups */}
      <section>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>
          {t.setups} ({pinnedSetups.length})
        </div>
        {pinnedSetups.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.6 }}>{t.emptySetups}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {pinnedSetups.map((r) => {
              const path = `/setup?s=${encodeSetupToken(r.input)}`;
              const key = `setup:${r.id}`;
              const nAvoid = r.input.avoidRules?.length ?? 0;
              const nForce =
                (r.input.forceRules?.length ?? 0) + Object.keys(r.input.forceTileRules ?? {}).length;
              return (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    border: "1px solid #ddd",
                    background: "#fafafa",
                    borderRadius: 8,
                    padding: "4px 8px",
                    fontSize: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span>📌</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{r.input.seed}</span>
                  <span>{r.input.mode === "lostFleet" ? t.modeLF : t.modeBase}</span>
                  <span>
                    {t.players}: {r.input.playerCount ?? 4}
                  </span>
                  {nAvoid + nForce > 0 ? (
                    <span style={{ opacity: 0.7 }}>⚙{nAvoid + nForce}</span>
                  ) : null}
                  {r.used ? <span style={{ opacity: 0.7 }}>{t.used}</span> : null}
                  <span style={{ opacity: 0.55 }}>{fmtWhen(r.createdAt, lang)}</span>
                  <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                    <Link
                      href={path}
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        border: "1px solid #ccc",
                        borderRadius: 6,
                        background: "white",
                        textDecoration: "none",
                        color: "#333",
                      }}
                    >
                      {t.open}
                    </Link>
                    <button
                      onClick={() => flashCopied(key, `${window.location.origin}${path}`)}
                      style={{ fontSize: 11 }}
                    >
                      {copiedKey === key ? t.shareCopied : t.share}
                    </button>
                    <button onClick={() => void unpinSetup(r.id)} style={{ fontSize: 11 }}>
                      {t.unpin}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
          </>
        }
      />
    </PageBody>
    </>
  );
}