// src/components/PairView.tsx
"use client";

// Pair タブ（段階 2、2026-10-17。ユーザー確定 A-(a)。旧 List ＋ Total を 1 つに）。
//
// 画面は Map / Setup と同じ「候補 / 詳細 / 条件」の型（狭い幅はタブ、gaia_pair_narrow_tab）:
//   候補 … 組の提案（向き・探し方・基準・起点・生成）と候補一覧（今回の提案 ＋ 保存した組を 1 つの表に）
//   詳細 … 選んだ組（盤面・配置・種族別の合計表＝旧 Total の表）と操作（Map / Setup で開く・共有 URL・保存・記録）
//   条件 … 保存済み条件・評価指数・合算比（旧 Total の入力欄）・盤面表示
// 基準 2・3 はマップの内訳があれば合計 T_f で測る（pairPlan.ts）。種族優遇は共通バー直下の帯（探索プロファイル）。
// 旧 List の提案ログは廃止（保存した組に一本化）。保存した組は旧 List と同じ localStorage（gaia_list_proposals_v2）を読む。
// 起点の選択（gaia_list_pair_map / gaia_list_pair_setup）も旧 List / Total と同じキー。
// 段階 3（v2.0、2026-10-17）: トップ `/` が Pair。「両方を探索」＝ 探索プロファイルに登録した Map / Setup の条件で両方の検索
// （ワーカー）を順に実行して各結果バケツへ保存し、Map 上位 K × Setup 上位 L の総当たりを基準で採点して上位 10 組を候補に並べる
// （pairSearch.ts）。旧 List のピン留め一覧は削除（Map / Setup の候補に含まれる。ユーザー確定 3-(a)）。

import React from "react";
import Link from "next/link";
import { MapBoardViewer, type PlacementItem } from "@/components/MapBoardViewer";
import {
  openDb,
  idbGetAllFromStore,
  loadProfilesFromDb,
  STORE_CANDIDATES,
  STORE_LIST_PROFILES,
  isDbUpgradeBlocked,
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
import { listSavedSetups, recordSetup, type SavedSetup } from "@/lib/setupHistory";
import { copyText, decodeSetupToken, encodeSetupToken } from "@/lib/setupShare";
import GlobalBar from "@/components/GlobalBar";
import ConditionBar from "@/components/ConditionBar";
import { useSearchProfiles } from "@/lib/searchProfiles";
import {
  readSharedExpansion,
  readSharedPlayers,
  resetStaleEvalScaleStorage,
  writeSharedExpansion,
  writeSharedPlayers,
  type Expansion,
} from "@/lib/sharedSettings";
import { scoreSetupFactions, topFactions, topFactionsByColor, type FactionScores, type RecommendCriterion } from "@/gaia/eval/factionEval";
import { applyShipInteraction, shipInteractionOf } from "@/gaia/eval/shipInteraction";
import { FACTIONS, FACTION_IDS, type FactionId } from "@/gaia/eval/factionWeights";
import { mapValueByFaction } from "@/gaia/eval/mapFaction";
import { blendScores, type ScoreBlend } from "@/gaia/eval/scoreBlend";
import { buildSetupFromSeed, type BuildSetupInput } from "@/gaia/setup/buildSetup";
import { SetupBoard } from "@/components/SetupView";
import { SetupWeightInputs, SharedHelp, useScoreBlend, useSetupWeights } from "@/components/FactionEvalPanel";
import { BlendInputs, TotalTable, totalRowsOf } from "@/components/TotalTable";
import ConditionProfilesPanel from "@/components/ConditionProfilesPanel";
import { conditionKeyOf, deleteConditionProfile, listConditionProfiles, upsertConditionProfile, type ConditionProfile } from "@/lib/conditionProfiles";
import { DEFAULT_SETUP_WEIGHTS, isDefaultWeights, type SetupWeights } from "@/gaia/eval/setupWeights";
import { PageBody, Panel, SectionTitle, T, TwoCol, useIsNarrow } from "@/components/ui/layout";
import { buildMapPool } from "@/lib/mapCandidates";
import { mapTopOf, planPair, setupSettingsOf, usesTotalBasis, type PairDir, type PairOption, type SetupSource } from "@/lib/pairPlan";
import { runSearchOffThread, type SearchRunMode } from "@/app/board/searchRunner";
import { runSetupSearch, type SetupSearchRunMode } from "@/lib/setupSearchRunner";
import { saveMapSearchResults } from "@/lib/mapSearchSave";
import { mergeRanking, SETUP_RANKING_CAP } from "@/lib/setupRanking";
import { setupConditionKey } from "@/lib/setupHistory";
import { SETUP_FACTION_PREF_W } from "@/gaia/eval/factionEval";
import { PAIR_SEARCH_K_DEFAULT, PAIR_SEARCH_KL_MAX, PAIR_SEARCH_L_DEFAULT, PAIR_SEARCH_TOP_N, scorePairs } from "@/lib/pairSearch";

type Lang = "ja" | "en";

const UI = {
  ja: {
    title: "Pair（マップとセットアップの組）",
    note: "条件に合う組を提案し、種族ごとの合計で見比べる",
    tabCandidates: "候補",
    tabDetail: "詳細",
    tabConditions: "条件",
    candidatesTitle: "候補",
    detailTitle: "詳細",
    conditionsTitle: "条件",
    pairTitle: "組の提案",
    pairNote: "探索の向きと基準を選んで「提案を生成」。上位 5 件が候補に並ぶ",
    pairMap: "マップ",
    pairNoMap: "（マップなし）",
    pairSetup: "セットアップ",
    pairDirLabel: "探索の向き",
    dirMapToSetup: "マップ → セットアップ",
    dirSetupToMap: "セットアップ → マップ",
    setupSourceLabel: "セットアップの探し方",
    srcRandom: "ランダム生成",
    srcSaved: "保存済みから選ぶ",
    srcDisabledHint: "セットアップ→マップの向きでは使いません",
    pairCriterion: "基準",
    crit1: "1: 逆優位（マップ上位種族が弱い）",
    crit2: "2: 上位バランス（合計で人数+2種族が拮抗）",
    crit3: "3: 全体バランス（合計で全種族が拮抗）",
    crit4: "4: 優位（マップ上位の人数+2種族が強い）",
    generate: "提案を生成",
    regenerate: "再生成",
    needMap: "基準1・4にはマップの選択が必要です",
    needSetup: "起点にするセットアップを選んでください",
    needSetupPool: "条件に合う保存済みセットアップがありません",
    needMapPool: "条件に合うマップがありません（Map タブで検索するかピン留めが必要）",
    mapIndependentNote: "※このマップは評価の内訳を持たないため、基準2・3はセットアップの値だけで測りました（Map タブで検索し直すと内訳が付く）",
    tileModeLabel: "盤面表示",
    tileImage: "画像",
    tileSchematic: "番号＋向き",
    listEmpty: "まだ候補がありません（「提案を生成」で探す）",
    colKind: "由来",
    kindProposal: "提案",
    kindSaved: "保存",
    kindShared: "共有",
    colMap: "マップ",
    colSetup: "シード",
    colScore: "基準値",
    colTop: "合計の上位",
    colCriterion: "基準",
    rowHint: "クリックで詳細に表示",
    save: "保存",
    saved: "保存済み",
    deleteSaved: "削除",
    savedNote: "保存した組は条件ごとに貯まり、マップがピン解除されても再表示できる",
    seed: "シード",
    score: "スコア",
    modeBase: "基本版",
    modeLF: "Lost Fleet",
    players: "人数",
    unknownTemplate: "テンプレート不明（プレビューなし）",
    mapStrong: "マップ優位",
    setupStrong: "セットアップ優位（上位5）",
    totalStrong: (k: number) => `合計の上位${k}色（人数+2。同色は強い方）`,
    totalTable: "種族別の合計",
    openSetup: "Setupで開く",
    openMap: "Mapで開く",
    sharePair: "セット共有URL",
    shareCopied: "コピーしました",
    recordToSetup: "Setup の候補に記録",
    recorded: "記録しました",
    detailEmpty: "候補の行を選ぶと、盤面・配置・種族別の合計がここに出ます",
    sharedPairTitle: "共有されたセット",
    pinnedTitle: "ピン留め一覧",
    maps: "マップ",
    setups: "セットアップ",
    emptyMaps: "ピン留めしたマップはありません（Map タブの候補で「ピン留め」）",
    emptySetups: "ピン留めしたセットアップはありません（Setup タブの候補で「ピン留め」）",
    open: "開く",
    share: "共有",
    unpin: "ピン解除",
    used: "使用済み",
    savedConds: "保存済み条件",
    weightsTitle: "評価指数",
    searchBoth: "両方を探索",
    searchBothStop: "停止",
    searchBothNote: "探索プロファイルに登録した Map / Setup の条件で両方の検索を実行し、上位 K × L の組を基準で採点する",
    phaseMap: "Map",
    phaseSetup: "Setup",
    phasePair: "組を採点",
    needMapCond: "探索プロファイルに Map の条件が未登録です（Map タブで検索を 1 回実行すると登録されます）",
    needSetupCond: "探索プロファイルに Setup の条件が未登録です（Setup タブで検索を 1 回実行すると登録されます）",
    bothNoMaps: "Map の検索で制約を満たす盤面が 1 つもありませんでした（件数を増やすか制約を緩めてください）",
    klLabel: "両方を探索の総当たり",
    kLabel: "Map 上位",
    lLabel: "Setup 上位",
    klNote: "Map 上位 K × Setup 上位 L を採点して上位 10 組を候補に並べる（既定 20 × 20、上限 50）",
  },
  en: {
    title: "Pair (map + setup)",
    note: "Suggests pairs that fit the criterion and compares them by faction totals",
    tabCandidates: "Candidates",
    tabDetail: "Detail",
    tabConditions: "Conditions",
    candidatesTitle: "Candidates",
    detailTitle: "Detail",
    conditionsTitle: "Conditions",
    pairTitle: "Pair suggestion",
    pairNote: "Pick a direction and a criterion, then Generate; the top 5 appear as candidates",
    pairMap: "Map",
    pairNoMap: "(no map)",
    pairSetup: "Setup",
    pairDirLabel: "Direction",
    dirMapToSetup: "Map → Setup",
    dirSetupToMap: "Setup → Map",
    setupSourceLabel: "Setup source",
    srcRandom: "Random rolls",
    srcSaved: "From saved",
    srcDisabledHint: "Not used in the Setup → Map direction",
    pairCriterion: "Criterion",
    crit1: "1: Oppose map (map's top factions weak)",
    crit2: "2: Top balance (players+2 factions close by total)",
    crit3: "3: Overall balance (all factions close by total)",
    crit4: "4: Align (map top players+2 factions are strong)",
    generate: "Generate",
    regenerate: "Regenerate",
    needMap: "Criteria 1 and 4 require a selected map",
    needSetup: "Pick a setup to start from",
    needSetupPool: "No saved setup matches the current players/expansion",
    needMapPool: "No map matches (search on the Map tab or pin one first)",
    mapIndependentNote: "Note: this map has no evaluation breakdown, so criteria 2 / 3 used the setup values only (re-search on the Map tab to add it)",
    tileModeLabel: "Board view",
    tileImage: "Images",
    tileSchematic: "Number + rotation",
    listEmpty: "No candidates yet (press Generate)",
    colKind: "Kind",
    kindProposal: "proposal",
    kindSaved: "saved",
    kindShared: "shared",
    colMap: "Map",
    colSetup: "Seed",
    colScore: "Score",
    colTop: "Top by total",
    colCriterion: "Criterion",
    rowHint: "Click to show in Detail",
    save: "Save",
    saved: "Saved",
    deleteSaved: "Delete",
    savedNote: "Saved pairs are kept per condition and can be shown even after the map is unpinned",
    seed: "Seed",
    score: "Score",
    modeBase: "Base game",
    modeLF: "Lost Fleet",
    players: "Players",
    unknownTemplate: "Unknown template (no preview)",
    mapStrong: "Map favors",
    setupStrong: "Setup favors (top 5)",
    totalStrong: (k: number) => `Top ${k} colors by total (players+2, stronger of each pair)`,
    totalTable: "Totals by faction",
    openSetup: "Open in Setup",
    openMap: "Open in Map",
    sharePair: "Share pair URL",
    shareCopied: "Copied",
    recordToSetup: "Record to Setup candidates",
    recorded: "Recorded",
    detailEmpty: "Select a candidate row to see the board, the layout and the faction totals here",
    sharedPairTitle: "Shared pair",
    pinnedTitle: "Pinned items",
    maps: "Maps",
    setups: "Setups",
    emptyMaps: "No pinned maps yet (use \"Pin\" on a candidate row in the Map tab)",
    emptySetups: "No pinned setups yet (use \"Pin\" on a candidate row in the Setup tab)",
    open: "Open",
    share: "Share",
    unpin: "Unpin",
    used: "Used",
    savedConds: "Saved conditions",
    weightsTitle: "Weights",
    searchBoth: "Search both",
    searchBothStop: "Stop",
    searchBothNote: "Runs the Map and Setup searches with the conditions registered in the search profile, then scores the top K × L pairs",
    phaseMap: "Map",
    phaseSetup: "Setup",
    phasePair: "Scoring pairs",
    needMapCond: "The search profile has no Map conditions yet (run one search on the Map tab to register them)",
    needSetupCond: "The search profile has no Setup conditions yet (run one search on the Setup tab to register them)",
    bothNoMaps: "The Map search found no board that satisfies the constraints (raise the trial count or relax the constraints)",
    klLabel: "Search-both grid",
    kLabel: "Top maps",
    lLabel: "Top setups",
    klNote: "Scores top K maps × top L setups and lists the best 10 pairs (default 20 × 20, max 50)",
  },
} as const;

type TextOf = (typeof UI)["ja" | "en"];

function criterionShort(c: RecommendCriterion, t: TextOf): string {
  const full = c === "opposeMap" ? t.crit1 : c === "alignMap" ? t.crit4 : c === "topBalance" ? t.crit2 : t.crit3;
  return full.split("（")[0].split(" (")[0];
}

function factionLabel(id: FactionId, lang: Lang): string {
  const f = FACTIONS.find((x) => x.id === id);
  return f ? (lang === "ja" ? f.labelJa : f.labelEn) : id;
}

/** セットアップスコア上位N件を [ラベル +n] で並べる。基本版では LF4種族を除く。 */
function topFactionText(scores: FactionScores, n: number, lang: Lang, lf: boolean): string {
  return topFactions(scores, n, lf)
    .map((f) => `${factionLabel(f, lang)} ${scores[f] >= 0 ? "+" : ""}${Math.round(scores[f])}`)
    .join(" / ");
}

/** Map ＋ Setup の合計の上位N色（人数+2。同じ色は強い方だけ。2026-09-20）。合算比は合計表と同じ。 */
function totalScoresOfPair(mapScores: FactionScores, setupScores: FactionScores, blend: ScoreBlend): FactionScores {
  const total = {} as FactionScores;
  for (const f of FACTION_IDS) total[f] = blendScores(mapScores[f] ?? 0, setupScores[f] ?? 0, blend);
  return total;
}
function topTotalText(total: FactionScores, n: number, lang: Lang, lf: boolean): string {
  return topFactionsByColor(total, n, lf)
    .map((f) => `${factionLabel(f, lang)} ${Math.round(total[f])}`)
    .join(" / ");
}

function templateMeta(templateId: string, t: TextOf): string {
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


const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/** 探索候補に載せるランキングマップの上限（描画とスコア計算のコスト抑制）。 */
const RANKED_MAP_CAP = 200;

// 旧 List / Total と同じ localStorage キー（起点の選択・向き・探し方・基準・盤面表示）
const LS_DIR = "gaia_list_pair_dir";
const LS_SRC = "gaia_list_setup_source";
const LS_SETUP = "gaia_list_pair_setup";
const LS_TILE_MODE = "gaia_tile_mode";
const LS_MAP = "gaia_list_pair_map";
const LS_MAP_LABEL = "gaia_list_pair_map_label";
const LS_CRITERION = "gaia_list_criterion";
/** 狭い幅のタブ（Map の gaia_board_narrow_tab と同型） */
const LS_NARROW_TAB = "gaia_pair_narrow_tab";
/** 両方を探索の総当たり K / L（段階 3） */
const LS_K = "gaia_pair_k";
const LS_L = "gaia_pair_l";
/** Map / Setup の検索件数は各タブの設定を読む（Pair で別に持たない） */
const LS_MAP_TRIALS = "gaia_search_trials";
const LS_SETUP_TRIALS = "gaia_setup_bulk_trials";

/**
 * 保存した組（マップ配置＋基準＋セットアップ入力の自己完結スナップショット。旧 List の「保存した提案」と同じ形・同じキー）。
 * 条件バケツ（conditionKey）で分かれる。
 */
const LS_PROPOSALS = "gaia_list_proposals_v2";
const PROPOSALS_CAP = 50;
type SavedProposal = {
  id: string;
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
  /** 保存時の基準値（表示用。旧データには無い） */
  score?: number;
};
function loadProposals(): SavedProposal[] {
  try {
    const raw = localStorage.getItem(LS_PROPOSALS);
    if (!raw) return [];
    const a = JSON.parse(raw);
    return Array.isArray(a) ? (a as SavedProposal[]) : [];
  } catch {
    return [];
  }
}
function writeProposals(list: SavedProposal[]): void {
  try {
    localStorage.setItem(LS_PROPOSALS, JSON.stringify(list));
  } catch {}
}

/** 候補一覧の 1 行（提案・保存した組・共有された組を同じ形に揃える） */
type PairRow = {
  key: string;
  kind: "proposal" | "saved" | "shared";
  /** 盤面（候補にあるマップならその候補、無ければ配置だけ） */
  map: PersistedCandidate | null;
  mapPlacement: PlacementItem[];
  tid: string;
  mapHash: string;
  mapScore: number;
  setupInput: BuildSetupInput;
  criterion: RecommendCriterion | null;
  score: number | null;
  players: number;
  lf: boolean;
  savedId?: string;
};

const linkStyle: React.CSSProperties = { fontSize: 11, padding: "2px 8px", border: "1px solid #ccc", borderRadius: 6, background: "white", textDecoration: "none", color: "#333" };
const th: React.CSSProperties = { border: "1px solid #eee", padding: "3px 6px", background: "#f7f7f7", fontWeight: 700, whiteSpace: "nowrap", fontSize: 12 };
const td: React.CSSProperties = { border: "1px solid #eee", padding: "3px 6px", fontSize: 12 };

export default function PairView() {
  const [lang, setLang] = React.useState<Lang>("ja");
  const [players, setPlayers] = React.useState<number>(4);
  const [expansion, setExpansion] = React.useState<Expansion>("base");
  const [pinnedMaps, setPinnedMaps] = React.useState<PersistedCandidate[]>([]);
  const [topOverallMap, setTopOverallMap] = React.useState<PersistedCandidate | null>(null);
  const [templateIdBySearchKey, setTemplateIdBySearchKey] = React.useState<Record<string, string>>({});
  const [rankedMaps, setRankedMaps] = React.useState<PersistedCandidate[]>([]);
  const [allSetups, setAllSetups] = React.useState<SavedSetup[]>([]);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  // --- 組の提案 ---
  const [pairMapId, setPairMapId] = React.useState<string>("");
  const [pendingMapLabel, setPendingMapLabel] = React.useState<string>("");
  const [criterion, setCriterion] = React.useState<RecommendCriterion>("topBalance");
  const [pairDir, setPairDir] = React.useState<PairDir>("mapToSetup");
  const [setupSource, setSetupSource] = React.useState<SetupSource>("random");
  const [pairSetupId, setPairSetupId] = React.useState<string>("");
  const [pairOptions, setPairOptions] = React.useState<PairOption[]>([]);
  const [recSettings, setRecSettings] = React.useState<{ players: number; lf: boolean } | null>(null);
  const [evalWeights, changeEvalWeight, resetEvalWeights, setAllEvalWeights] = useSetupWeights();
  const { active: activeSearchProfile } = useSearchProfiles();
  const factionPref = React.useMemo(() => activeSearchProfile?.factionPref ?? {}, [activeSearchProfile]);
  const [scoreBlend, changeBlend, resetBlend] = useScoreBlend();
  /** 候補一覧で選んだ行（詳細に出す）。null は未選択 */
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [narrowTab, setNarrowTab] = React.useState<"candidates" | "detail" | "conditions">("candidates");
  const isNarrow = useIsNarrow();
  // ---- 両方を探索（段階 3）----
  const [bothBusy, setBothBusy] = React.useState(false);
  const [bothPhase, setBothPhase] = React.useState<"map" | "setup" | "pair" | null>(null);
  const [bothDone, setBothDone] = React.useState(0);
  const [bothTotal, setBothTotal] = React.useState(0);
  const [bothMode, setBothMode] = React.useState<SearchRunMode | SetupSearchRunMode | null>(null);
  const bothStopRef = React.useRef<(() => void) | null>(null);
  const [pairK, setPairK] = React.useState(PAIR_SEARCH_K_DEFAULT);
  const [pairL, setPairL] = React.useState(PAIR_SEARCH_L_DEFAULT);

  const conditionParams = React.useMemo(
    () => ({ players, lf: expansion === "lostFleet", pairDir, setupSource, criterion, evalWeights }),
    [players, expansion, pairDir, setupSource, criterion, evalWeights]
  );
  const conditionKey = React.useMemo(() => conditionKeyOf(conditionParams), [conditionParams]);
  const [profiles, setProfiles] = React.useState<Array<ConditionProfile<typeof conditionParams>>>([]);
  const clearPair = React.useCallback(() => {
    setPairOptions([]);
    setSelectedKey((k) => (k && k.startsWith("p:") ? null : k));
  }, []);

  const [dbBlocked, setDbBlocked] = React.useState(false);
  const refreshProfiles = React.useCallback(async () => {
    const rows = await listConditionProfiles<typeof conditionParams>(STORE_LIST_PROFILES);
    setDbBlocked(isDbUpgradeBlocked());
    setProfiles(rows);
  }, []);
  const isDefaultParams = React.useCallback((params: typeof conditionParams) => {
    const q: any = params ?? {};
    const w = q.evalWeights;
    return q.pairDir === "mapToSetup" && q.setupSource === "random" && q.criterion === "topBalance" && (!w || isDefaultWeights({ ...DEFAULT_SETUP_WEIGHTS, ...w }));
  }, []);
  React.useEffect(() => {
    void refreshProfiles();
  }, [refreshProfiles]);

  const applyProfile = React.useCallback(
    (p: ConditionProfile<typeof conditionParams>) => {
      const q: any = p.params ?? {};
      if (q.pairDir === "mapToSetup" || q.pairDir === "setupToMap") {
        setPairDir(q.pairDir);
        try { localStorage.setItem(LS_DIR, q.pairDir); } catch {}
      }
      if (q.setupSource === "random" || q.setupSource === "saved") {
        setSetupSource(q.setupSource);
        try { localStorage.setItem(LS_SRC, q.setupSource); } catch {}
      }
      if (typeof q.criterion === "string") {
        setCriterion(q.criterion as RecommendCriterion);
        try { localStorage.setItem(LS_CRITERION, q.criterion); } catch {}
      }
      setAllEvalWeights({ ...DEFAULT_SETUP_WEIGHTS, ...((q.evalWeights ?? {}) as SetupWeights) });
      clearPair();
    },
    [setAllEvalWeights, clearPair]
  );
  const resetConditions = React.useCallback(() => {
    setPairDir("mapToSetup");
    try { localStorage.setItem(LS_DIR, "mapToSetup"); } catch {}
    setSetupSource("random");
    try { localStorage.setItem(LS_SRC, "random"); } catch {}
    setCriterion("topBalance");
    try { localStorage.setItem(LS_CRITERION, "topBalance"); } catch {}
    resetEvalWeights();
    resetBlend();
    clearPair();
  }, [resetEvalWeights, resetBlend, clearPair]);

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
  const proposalsHere = React.useMemo(() => savedProposals.filter((p) => p.conditionKey === conditionKey), [savedProposals, conditionKey]);

  // 条件プロファイルの件数の追従（結果が 0 件のうちは作らない）
  React.useEffect(() => {
    const n = proposalsHere.length;
    if (n === 0) return;
    void upsertConditionProfile(STORE_LIST_PROFILES, conditionParams, { resultCount: n }).then(refreshProfiles);
  }, [proposalsHere.length, conditionParams, refreshProfiles]);

  const [tileMode, setTileMode] = React.useState<"image" | "schematic">("image");
  const [pairMsg, setPairMsg] = React.useState<string | null>(null);
  const [recordedSeed, setRecordedSeed] = React.useState<string | null>(null);
  const pairCapturedRef = React.useRef(false);
  const [pairShared, setPairShared] = React.useState<{ placement: PlacementItem[]; templateId: string; input: BuildSetupInput } | null>(null);

  /** マップ候補（ピン留め＋ランキング）とセットアップの保存リストを読み直す（起動時と「両方を探索」の保存後） */
  const reloadPools = React.useCallback(async () => {
    try {
      const db = await openDb();
      const all = await idbGetAllFromStore<PersistedCandidate>(db, STORE_CANDIDATES);
      const pins = all.filter((c) => c.pinned).sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0));
      const top = all.slice().sort((a, b) => Number(b.score) - Number(a.score))[0] ?? null;
      const profilesDb = await loadProfilesFromDb(500);
      const tmap: Record<string, string> = {};
      for (const p of profilesDb) {
        const tid = String(p.templateId ?? (p.params as any)?.templateId ?? "");
        if (tid) tmap[p.searchKey] = tid;
      }
      setPinnedMaps(pins);
      setTopOverallMap(top);
      setTemplateIdBySearchKey(tmap);
      setRankedMaps(all.slice().sort((a, b) => Number(b.score) - Number(a.score)).slice(0, RANKED_MAP_CAP));
    } catch {
      // ignore
    }
    try {
      setAllSetups(await listSavedSetups());
    } catch {
      // ignore
    }
  }, []);

  useIsoLayoutEffect(() => {
    resetStaleEvalScaleStorage();
    const v = (() => {
      try {
        return localStorage.getItem("gaia_ui_lang");
      } catch {
        return null;
      }
    })();
    if (v === "ja" || v === "en") setLang(v);
    const sp = readSharedPlayers();
    const se = readSharedExpansion();
    if (sp) setPlayers(sp);
    if (se) setExpansion(se);
    try {
      const savedMap = localStorage.getItem(LS_MAP);
      if (savedMap) setPairMapId(savedMap);
      const savedMapLabel = localStorage.getItem(LS_MAP_LABEL);
      if (savedMapLabel) setPendingMapLabel(savedMapLabel);
      const savedCrit = localStorage.getItem(LS_CRITERION);
      if (savedCrit === "opposeMap" || savedCrit === "alignMap" || savedCrit === "topBalance" || savedCrit === "neutralBalance") setCriterion(savedCrit);
      const savedDir = localStorage.getItem(LS_DIR);
      if (savedDir === "mapToSetup" || savedDir === "setupToMap") setPairDir(savedDir);
      const savedSrc = localStorage.getItem(LS_SRC);
      if (savedSrc === "random" || savedSrc === "saved") setSetupSource(savedSrc);
      const savedSetupId = localStorage.getItem(LS_SETUP);
      if (savedSetupId) setPairSetupId(savedSetupId);
      const savedTileMode = localStorage.getItem(LS_TILE_MODE);
      if (savedTileMode === "image" || savedTileMode === "schematic") setTileMode(savedTileMode);
      const nt = localStorage.getItem(LS_NARROW_TAB);
      if (nt === "candidates" || nt === "detail" || nt === "conditions") setNarrowTab(nt);
      const k = Number(localStorage.getItem(LS_K));
      if (Number.isFinite(k) && k >= 1) setPairK(Math.min(PAIR_SEARCH_KL_MAX, Math.floor(k)));
      const l = Number(localStorage.getItem(LS_L));
      if (Number.isFinite(l) && l >= 1) setPairL(Math.min(PAIR_SEARCH_KL_MAX, Math.floor(l)));
    } catch {}
    setSavedProposals(loadProposals());
    void reloadPools();
    // 共有されたセット（?h=&t=&s=）を捕捉して URL を浄化
    try {
      if (!pairCapturedRef.current) {
        pairCapturedRef.current = true;
        const q = new URLSearchParams(window.location.search);
        const h = q.get("h");
        const tid = q.get("t");
        const s = q.get("s");
        if (h !== null || s !== null || tid !== null) {
          q.delete("h");
          q.delete("t");
          q.delete("s");
          const qs = q.toString();
          window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
          const placement = h ? decodePlacementToken(h) : null;
          const input = s ? decodeSetupToken(s) : null;
          if (placement && tid && input && TEMPLATE_BY_ID[tid]) {
            setPairShared({ placement: placement as PlacementItem[], templateId: tid, input });
            setSelectedKey("shared");
            setNarrowTab("detail");
          }
        }
      }
    } catch {
      // ignore
    }
  }, [reloadPools]);

  const sectorById = React.useMemo(() => buildSectorLookup(getAllSectors() as any), []);
  const sectorImgById = React.useMemo(() => buildSectorImgById(), []);

  const selectableMaps = React.useMemo<PersistedCandidate[]>(
    () => buildMapPool({ pinned: pinnedMaps, ranked: rankedMaps, templateIdBySearchKey, topOverall: topOverallMap }),
    [pinnedMaps, rankedMaps, topOverallMap, templateIdBySearchKey]
  );
  const selectableSetups = React.useMemo<SavedSetup[]>(() => {
    const pins = allSetups.filter((r) => r.pinned);
    const seen = new Set(pins.map((r) => r.id));
    return [...pins, ...allSetups.filter((r) => !seen.has(r.id))];
  }, [allSetups]);

  React.useEffect(() => {
    if (selectableMaps.length > 0 && !selectableMaps.some((m) => m.id === pairMapId)) setPairMapId(selectableMaps[0].id);
  }, [selectableMaps, pairMapId]);
  React.useEffect(() => {
    if (selectableSetups.length > 0 && !selectableSetups.some((r) => r.id === pairSetupId)) setPairSetupId(selectableSetups[0].id);
  }, [selectableSetups, pairSetupId]);

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
    } catch {}
  }, []);
  const selectNarrowTab = React.useCallback((tab: "candidates" | "detail" | "conditions") => {
    setNarrowTab(tab);
    try {
      localStorage.setItem(LS_NARROW_TAB, tab);
    } catch {}
  }, []);

  const flashCopied = React.useCallback((key: string, text: string) => {
    copyText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((v) => (v === key ? null : v)), 2000);
  }, []);

  const mapToken = React.useCallback((placement: PlacementItem[]): string => {
    try {
      return encodePlacementToken(placement as any);
    } catch {
      return "";
    }
  }, []);

  /** 提案の生成（上位 PAIR_TOP_N 件を候補に並べ、先頭を詳細に出す）。選定は pairPlan.ts の純粋関数。 */
  const handleGenerate = React.useCallback(() => {
    const plan = planPair({ pairDir, setupSource, criterion, pairMapId, pairSetupId, selectableMaps, selectableSetups, templateIdBySearchKey, evalWeights, factionPref, blend: scoreBlend });
    if (!plan.ok) {
      setPairMsg(UI[lang][plan.failure]);
      clearPair();
      return;
    }
    setPairMsg(plan.note === "mapIndependent" ? UI[lang].mapIndependentNote : null);
    setPairOptions(plan.options);
    setRecSettings(plan.settings);
    setSelectedKey(plan.options.length > 0 ? `p:${plan.options[0].key}` : null);
  }, [selectableMaps, selectableSetups, pairMapId, pairSetupId, pairDir, setupSource, criterion, templateIdBySearchKey, clearPair, lang, evalWeights, factionPref, scoreBlend]);

  // ---------- 候補一覧（提案 ＋ 保存した組 ＋ 共有された組） ----------
  const rows = React.useMemo<PairRow[]>(() => {
    const out: PairRow[] = [];
    if (pairShared) {
      out.push({
        key: "shared",
        kind: "shared",
        map: selectableMaps.find((c) => String(c.placementHash ?? "") && templateIdBySearchKey[c.searchKey] === pairShared.templateId && mapToken((c.placement ?? []) as PlacementItem[]) === mapToken(pairShared.placement)) ?? null,
        mapPlacement: pairShared.placement,
        tid: pairShared.templateId,
        mapHash: "",
        mapScore: 0,
        setupInput: pairShared.input,
        criterion: null,
        score: null,
        players: pairShared.input.playerCount ?? 4,
        lf: pairShared.input.mode === "lostFleet",
      });
    }
    for (const o of pairOptions) {
      const m = selectableMaps.find((c) => c.id === o.mapId) ?? null;
      out.push({
        key: `p:${o.key}`,
        kind: "proposal",
        map: m,
        mapPlacement: (m?.placement ?? []) as PlacementItem[],
        tid: m ? (templateIdBySearchKey[m.searchKey] ?? "") : "",
        mapHash: String(m?.placementHash ?? ""),
        mapScore: Number(m?.score ?? 0),
        setupInput: o.rec.input,
        criterion: o.rec.criterion,
        score: o.rec.score,
        players: recSettings?.players ?? players,
        lf: recSettings?.lf ?? expansion === "lostFleet",
      });
    }
    for (const p of proposalsHere) {
      const m = p.mapHash ? (selectableMaps.find((c) => String(c.placementHash ?? "") === p.mapHash) ?? null) : null;
      out.push({
        key: `s:${p.id}`,
        kind: "saved",
        map: m,
        mapPlacement: p.mapPlacement,
        tid: p.tid,
        mapHash: p.mapHash,
        mapScore: p.mapScore,
        setupInput: p.setupInput,
        criterion: p.criterion,
        score: p.score ?? null,
        players: p.players,
        lf: p.lf,
        savedId: p.id,
      });
    }
    return out;
  }, [pairShared, pairOptions, proposalsHere, selectableMaps, templateIdBySearchKey, recSettings, players, expansion, mapToken]);

  const selectedRow = React.useMemo(() => rows.find((r) => r.key === selectedKey) ?? null, [rows, selectedKey]);

  /** 詳細の材料: Setup の値（船の相互作用込み）・Map の値・合計 */
  const detail = React.useMemo(() => {
    if (!selectedRow) return null;
    const bd = (selectedRow.map as any)?.evaluation?.breakdown ?? null;
    const setupResult = buildSetupFromSeed(selectedRow.setupInput);
    const setupScores = applyShipInteraction(scoreSetupFactions(setupResult, evalWeights), shipInteractionOf(setupResult, bd, evalWeights));
    const mapScores = mapValueByFaction(bd);
    const total = totalScoresOfPair(mapScores, setupScores, scoreBlend);
    const mapTop = selectedRow.map ? (mapTopOf(selectedRow.map, templateIdBySearchKey, selectedRow.players)?.detail ?? null) : null;
    return {
      bd,
      setupResult,
      setupScores,
      mapScores,
      total,
      mapTop,
      rows: totalRowsOf(mapScores, setupScores, scoreBlend, selectedRow.lf, lang),
      hasBreakdown: !!bd,
    };
  }, [selectedRow, evalWeights, scoreBlend, templateIdBySearchKey, lang]);

  /** 行の「合計の上位」（人数+2 色。内訳の無いマップは Setup だけの合計） */
  const topTotalOfRow = React.useCallback(
    (r: PairRow): string => {
      const bd = (r.map as any)?.evaluation?.breakdown ?? null;
      const res = buildSetupFromSeed(r.setupInput);
      const ss = applyShipInteraction(scoreSetupFactions(res, evalWeights), shipInteractionOf(res, bd, evalWeights));
      return topTotalText(totalScoresOfPair(mapValueByFaction(bd), ss, scoreBlend), r.players + 2, lang, r.lf);
    },
    [evalWeights, scoreBlend, lang]
  );

  const handleSaveRow = React.useCallback(
    (r: PairRow) => {
      const prop: SavedProposal = {
        id: `${r.map?.id ?? r.mapHash ?? "m"}|${r.criterion ?? "-"}|${r.setupInput.seed}|${Date.now()}`,
        conditionKey,
        createdAt: Date.now(),
        criterion: r.criterion ?? criterion,
        tid: r.tid,
        mapPlacement: r.mapPlacement,
        mapScore: r.mapScore,
        mapHash: r.mapHash,
        setupInput: r.setupInput,
        players: r.players,
        lf: r.lf,
        ...(r.score != null ? { score: r.score } : {}),
      };
      setSavedProposals((prev) => {
        const next = [prop, ...prev].slice(0, PROPOSALS_CAP);
        writeProposals(next);
        return next;
      });
      setSelectedKey(`s:${prop.id}`);
    },
    [conditionKey, criterion]
  );
  const handleDeleteSaved = React.useCallback((id: string) => {
    setSavedProposals((prev) => {
      const next = prev.filter((p) => p.id !== id);
      writeProposals(next);
      return next;
    });
    setSelectedKey((k) => (k === `s:${id}` ? null : k));
  }, []);
  const handleRecordSetup = React.useCallback((input: BuildSetupInput) => {
    void recordSetup(input).then((rows2) => {
      setAllSetups(rows2);
      setRecordedSeed(String(input.seed));
    });
  }, []);

  /**
   * 両方を探索（段階 3）。探索プロファイルの Map 部 / Setup 部の条件で、Map の検索 → 結果バケツへ保存 → Setup の検索 →
   * 候補（ランキング）へ保存 → 上位 K × L の総当たりを採点、の順に走らせる。件数は各タブの設定（localStorage）を読む。
   */
  const handleSearchBoth = React.useCallback(() => {
    if (bothBusy) {
      bothStopRef.current?.();
      return;
    }
    const prof = activeSearchProfile;
    if (!prof?.map) {
      setPairMsg(UI[lang].needMapCond);
      return;
    }
    if (!prof?.setup) {
      setPairMsg(UI[lang].needSetupCond);
      return;
    }
    let mapParams: any = null;
    try {
      mapParams = prof.map.paramsRaw ? JSON.parse(prof.map.paramsRaw) : null;
    } catch {
      mapParams = null;
    }
    const setupParams: any = prof.setup.params ?? null;
    if (!mapParams?.templateId || !setupParams?.setup) {
      setPairMsg(UI[lang].needMapCond);
      return;
    }
    const mapKey = prof.map.searchKey;
    const templateId = String(mapParams.templateId);
    const lsNum = (key: string, dflt: number, max: number) => {
      try {
        const v = Number(localStorage.getItem(key));
        return Number.isFinite(v) && v >= 1 ? Math.min(max, Math.floor(v)) : dflt;
      } catch {
        return dflt;
      }
    };
    const mapTrials = lsNum(LS_MAP_TRIALS, 30000, 200000);
    const setupTrials = lsNum(LS_SETUP_TRIALS, 5000, 20000);
    const keepTop = 20;
    const capacity = Math.max(keepTop, 100);
    const setupBase = { ...(setupParams.setup as Omit<BuildSetupInput, "seed">) };
    const sPlayers = Number((setupBase as any).playerCount ?? 4);
    const sLf = (setupBase as any).mode === "lostFleet";
    const setupCriterion: RecommendCriterion = usesTotalBasis(criterion) ? criterion : "topBalance";
    const randSeed = () => String(Math.floor(Math.random() * 2147483647) + 1);
    const forCriterion = criterion;
    const forK = pairK;
    const forL = pairL;
    const forPref = factionPref;
    const forBlend = scoreBlend;
    const forWeights = evalWeights;

    setBothBusy(true);
    setPairMsg(null);
    setBothPhase("map");
    setBothDone(0);
    setBothTotal(mapTrials);
    setBothMode(null);
    void (async () => {
      try {
        // 1) Map の検索（Map タブと同じワーカー・同じ options の形）
        const searchOptions = {
          trials: mapTrials,
          keepTop: capacity,
          seedStart: Number(randSeed()),
          yieldEvery: 50,
          ...(mapParams.placementMethod != null ? { placementMethod: mapParams.placementMethod } : {}),
          hard: mapParams.hard ?? {},
          soft: mapParams.soft ?? {},
        };
        const mr = await runSearchOffThread(
          templateId,
          searchOptions,
          (done) => setBothDone(done),
          (stop) => {
            bothStopRef.current = stop;
          },
          (m) => setBothMode(m)
        );
        bothStopRef.current = null;
        const maps = await saveMapSearchResults({ searchKey: mapKey, searchKeyParams: mapParams, templateId, results: mr.results, capacityActive: capacity, keepTop });
        if (maps.length === 0) {
          setPairMsg(UI[lang].bothNoMaps);
          return;
        }
        // 2) Setup の検索（Setup タブと同じワーカー）→ 候補（ランキング）へ保存
        setBothPhase("setup");
        setBothDone(0);
        setBothTotal(setupTrials);
        setBothMode(null);
        const prefArg = Object.keys(forPref).length > 0 ? { w: SETUP_FACTION_PREF_W, byFaction: forPref as Partial<Record<FactionId, number>> } : undefined;
        const sr = await runSetupSearch(
          { seeds: Array.from({ length: setupTrials }, randSeed), criterion: setupCriterion, playerCount: sPlayers, lostFleet: sLf, weights: forWeights, factionPref: prefArg, topN: SETUP_RANKING_CAP, baseInput: setupBase },
          {
            onProgress: (done) => setBothDone(done),
            onMode: (m) => setBothMode(m),
            onStopHandle: (stop) => {
              bothStopRef.current = stop;
            },
          }
        );
        bothStopRef.current = null;
        const setupKey = setupConditionKey({ ...setupBase, seed: "" } as BuildSetupInput);
        let setupRows: Array<{ seed: string; input: BuildSetupInput }> = sr.results.map((r) => ({ seed: r.seed, input: r.input }));
        try {
          const merged = await mergeRanking({ conditionKey: setupKey, criterion: setupCriterion, playerCount: sPlayers, lostFleet: sLf, weights: forWeights, factionPref: prefArg, fresh: sr.results.map((r) => ({ seed: r.seed, input: r.input, score: r.score })), cap: SETUP_RANKING_CAP });
          setupRows = merged.map((r) => ({ seed: r.seed, input: r.input }));
        } catch {
          // DB が使えないときは今回ぶんだけで組む
        }
        // 3) 上位 K × L の総当たり
        setBothPhase("pair");
        const tmap = { ...templateIdBySearchKey, [mapKey]: templateId };
        const options = scorePairs({ maps: maps.filter((m) => !!(m as any)?.evaluation?.breakdown), setups: setupRows, templateIdBySearchKey: tmap, criterion: forCriterion, players: sPlayers, lf: sLf, evalWeights: forWeights, factionPref: forPref, blend: forBlend, k: forK, l: forL, topN: PAIR_SEARCH_TOP_N });
        await reloadPools();
        setTemplateIdBySearchKey((prev) => ({ ...prev, [mapKey]: templateId }));
        setAllSetups(await listSavedSetups());
        setPairOptions(options);
        setRecSettings({ players: sPlayers, lf: sLf });
        setSelectedKey(options.length > 0 ? `p:${options[0].key}` : null);
        if (isNarrow && options.length > 0) selectNarrowTab("detail");
      } catch (e: any) {
        setPairMsg(String(e?.message ?? e));
      } finally {
        bothStopRef.current = null;
        setBothBusy(false);
        setBothPhase(null);
      }
    })();
  }, [bothBusy, activeSearchProfile, lang, criterion, pairK, pairL, factionPref, scoreBlend, evalWeights, templateIdBySearchKey, reloadPools, isNarrow, selectNarrowTab]);

  const isSavedAlready = React.useCallback(
    (r: PairRow) => r.kind === "saved" || proposalsHere.some((p) => p.mapHash === r.mapHash && String(p.setupInput.seed) === String(r.setupInput.seed)),
    [proposalsHere]
  );

  const tabButton = (tab: "candidates" | "detail" | "conditions", label: string) => {
    const on = narrowTab === tab;
    return (
      <button
        key={tab}
        type="button"
        onClick={() => selectNarrowTab(tab)}
        style={{ padding: "4px 12px", fontSize: 13, fontWeight: 700, borderRadius: 8, border: "1px solid " + (on ? "#4453ff" : "#ccc"), background: on ? "#eef0ff" : "#fff", color: on ? "#2733cc" : "#333" }}
      >
        {label}
      </button>
    );
  };

  const miniBoard = (tid: string, placement: PlacementItem[]) => {
    const template = TEMPLATE_BY_ID[tid];
    if (!template) return <div style={{ fontSize: 12, opacity: 0.6 }}>{t.unknownTemplate}</div>;
    return (
      <div style={{ width: 300, pointerEvents: "none", overflow: "hidden", borderRadius: 8 }}>
        <MapBoardViewer
          template={template as any}
          placement={placement}
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
    );
  };

  return (
    <>
      <GlobalBar active="pair" players={players} expansion={expansion} onSelect={onGlobalSelect} lang={lang} onLang={setLangPersist} />
      <ConditionBar page="pair" lang={lang} lf={expansion === "lostFleet"} />
      <PageBody>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {t.title}
            <SharedHelp k="pairSuggest" lang={lang} />
          </div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>{t.note}</div>
          {isNarrow ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", width: "100%" }}>
              {tabButton("candidates", t.tabCandidates)}
              {tabButton("detail", t.tabDetail)}
              {tabButton("conditions", t.tabConditions)}
            </div>
          ) : null}
        </div>

        <TwoCol
          right={
            <section style={{ display: isNarrow && narrowTab !== "detail" ? "none" : undefined }}>
              <SectionTitle>{t.detailTitle}</SectionTitle>
              {!selectedRow || !detail ? (
                <div style={{ fontSize: 12, opacity: 0.6 }}>{t.detailEmpty}</div>
              ) : (
                (() => {
                  const r = selectedRow;
                  const sToken = encodeSetupToken(r.setupInput);
                  const bToken = mapToken(r.mapPlacement);
                  const pairPath = bToken && r.tid ? `/?h=${bToken}&t=${r.tid}&s=${sToken}` : `/setup?s=${sToken}`;
                  const topColors = r.players + 2;
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
                      {r.kind === "shared" ? <div style={{ fontWeight: 700, color: "#2733cc" }}>{t.sharedPairTitle}</div> : null}
                      <div>
                        <span style={{ opacity: 0.7 }}>{t.seed}:</span>{" "}
                        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{r.setupInput.seed}</span>
                        {" ・ "}
                        {r.lf ? t.modeLF : t.modeBase}
                        {" ・ "}
                        {t.players}: {r.players}
                        {r.tid ? (
                          <>
                            {" ・ "}
                            {templateMeta(r.tid, t)}
                            {r.mapHash ? ` / ${r.mapHash.slice(0, 8)}` : ""}
                            {r.mapScore ? ` / ${Math.round(r.mapScore)}` : ""}
                          </>
                        ) : null}
                        {r.criterion ? (
                          <>
                            {" ・ "}
                            {criterionShort(r.criterion, t)}
                            {r.score != null ? ` ${Math.round(r.score * 100) / 100}` : ""}
                          </>
                        ) : null}
                      </div>
                      {detail.mapTop ? (
                        <div>
                          <span style={{ opacity: 0.7 }}>{t.mapStrong}:</span> {detail.mapTop.map((x) => `${factionLabel(x.id, lang)} ${Math.round(x.score)}`).join(" / ")}
                        </div>
                      ) : null}
                      <div>
                        <span style={{ opacity: 0.7 }}>{t.setupStrong}:</span> {topFactionText(detail.setupScores, 5, lang, r.lf)}
                      </div>
                      {detail.hasBreakdown ? (
                        <div>
                          <span style={{ opacity: 0.7 }}>
                            {t.totalStrong(topColors)}
                            <SharedHelp k="pairTopColors" lang={lang} />:
                          </span>{" "}
                          {topTotalText(detail.total, topColors, lang, r.lf)}
                        </div>
                      ) : null}
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
                        {miniBoard(r.tid, r.mapPlacement)}
                        <div style={{ transformOrigin: "top left" }}>
                          <SetupBoard result={detail.setupResult} lang={lang} compact />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {bToken && r.tid ? (
                          <Link href={`/board?h=${bToken}&t=${r.tid}`} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                            {t.openMap}
                          </Link>
                        ) : null}
                        <Link href={`/setup?s=${sToken}`} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                          {t.openSetup}
                        </Link>
                        <button onClick={() => flashCopied("pair", `${window.location.origin}${pairPath}`)} style={{ fontSize: 11 }}>
                          {copiedKey === "pair" ? t.shareCopied : t.sharePair}
                        </button>
                        <button onClick={() => handleRecordSetup(r.setupInput)} style={{ fontSize: 11 }} disabled={recordedSeed === String(r.setupInput.seed)}>
                          {recordedSeed === String(r.setupInput.seed) ? t.recorded : t.recordToSetup}
                        </button>
                        {r.kind === "saved" ? (
                          <button onClick={() => handleDeleteSaved(r.savedId!)} style={{ fontSize: 11 }}>
                            {t.deleteSaved}
                          </button>
                        ) : (
                          <button onClick={() => handleSaveRow(r)} style={{ fontSize: 11 }} disabled={isSavedAlready(r)}>
                            {isSavedAlready(r) ? t.saved : t.save}
                          </button>
                        )}
                      </div>
                      <div style={{ fontWeight: 700, marginTop: 4 }}>
                        {t.totalTable}
                        <SharedHelp k="pairTotal" lang={lang} />
                      </div>
                      <TotalTable rows={detail.rows} blend={scoreBlend} lang={lang} mapHasBreakdown={detail.hasBreakdown} />
                    </div>
                  );
                })()
              )}
            </section>
          }
          left={
            <>
              {/* ---------- 候補 ---------- */}
              <section style={{ display: isNarrow && narrowTab !== "candidates" ? "none" : "flex", flexDirection: "column", gap: T.gap }}>
                <Panel
                  title={
                    <>
                      {t.pairTitle}
                      <SharedHelp k="pairSuggest" lang={lang} />
                    </>
                  }
                  note={t.pairNote}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span>{t.pairDirLabel}</span>
                        <select
                          value={pairDir}
                          onChange={(e) => {
                            const v = e.target.value as PairDir;
                            setPairDir(v);
                            try { localStorage.setItem(LS_DIR, v); } catch {}
                            clearPair();
                            setPairMsg(null);
                          }}
                          style={{ width: 190 }}
                        >
                          <option value="mapToSetup">{t.dirMapToSetup}</option>
                          <option value="setupToMap">{t.dirSetupToMap}</option>
                        </select>
                      </label>
                      <label style={{ display: "flex", gap: 6, alignItems: "center", opacity: pairDir === "mapToSetup" ? 1 : 0.45 }} title={pairDir === "mapToSetup" ? undefined : t.srcDisabledHint}>
                        <span>{t.setupSourceLabel}</span>
                        <select
                          value={setupSource}
                          disabled={pairDir !== "mapToSetup"}
                          onChange={(e) => {
                            const v = e.target.value as SetupSource;
                            setSetupSource(v);
                            try { localStorage.setItem(LS_SRC, v); } catch {}
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
                        <SharedHelp k="pairCriterion" lang={lang} />
                        <select
                          value={criterion}
                          onChange={(e) => {
                            setCriterion(e.target.value as RecommendCriterion);
                            try { localStorage.setItem(LS_CRITERION, e.target.value); } catch {}
                            clearPair();
                            setPairMsg(null);
                          }}
                          style={{ width: 280 }}
                        >
                          <option value="topBalance">{t.crit2}</option>
                          <option value="neutralBalance">{t.crit3}</option>
                          <option value="opposeMap">{t.crit1}</option>
                          <option value="alignMap">{t.crit4}</option>
                        </select>
                      </label>
                      <button onClick={handleGenerate} disabled={bothBusy} style={{ padding: "3px 12px", fontWeight: 700 }}>
                        {pairOptions.length > 0 ? t.regenerate : t.generate}
                      </button>
                      <button
                        onClick={handleSearchBoth}
                        title={t.searchBothNote}
                        style={{ padding: "3px 12px", fontWeight: 700, ...(bothBusy ? { background: "#eef0ff", border: "1px solid #4453ff", color: "#2733cc" } : {}) }}
                      >
                        {bothBusy ? t.searchBothStop : t.searchBoth}
                      </button>
                      <SharedHelp k="pairSearchBoth" lang={lang} />
                      {bothBusy ? (
                        <span style={{ opacity: 0.7 }}>
                          {bothPhase === "map" ? t.phaseMap : bothPhase === "setup" ? t.phaseSetup : t.phasePair}
                          {bothPhase === "pair" ? "" : ` ${bothDone}/${bothTotal}`}
                          {bothMode ? ` [${bothMode}]` : ""}
                        </span>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      {pairDir === "setupToMap" ? (
                        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span>{t.pairSetup}</span>
                          <select
                            value={pairSetupId}
                            onChange={(e) => {
                              setPairSetupId(e.target.value);
                              try { localStorage.setItem(LS_SETUP, e.target.value); } catch {}
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
                      ) : (
                        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span>{t.pairMap}</span>
                          <select
                            value={pairMapId}
                            onChange={(e) => {
                              setPairMapId(e.target.value);
                              const label = e.target.options[e.target.selectedIndex]?.text ?? "";
                              setPendingMapLabel(label);
                              try {
                                localStorage.setItem(LS_MAP, e.target.value);
                                localStorage.setItem(LS_MAP_LABEL, label);
                              } catch {}
                              clearPair();
                              setPairMsg(null);
                            }}
                            style={{ maxWidth: 260 }}
                          >
                            <option value="">{t.pairNoMap}</option>
                            {pairMapId && pendingMapLabel && !selectableMaps.some((m) => m.id === pairMapId) ? <option value={pairMapId}>{pendingMapLabel}</option> : null}
                            {selectableMaps.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.pinned ? "📌 " : ""}
                                {templateMeta(templateIdBySearchKey[c.searchKey] ?? "", t)} / {Math.round(Number(c.score))} / {String(c.placementHash ?? "").slice(0, 8)}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    {pairMsg ? <span style={{ color: "#b3261e" }}>{pairMsg}</span> : null}
                  </div>
                </Panel>

                {/* 候補一覧（提案 ＋ 保存した組 ＋ 共有された組） */}
                <div>
                  <SectionTitle note={t.savedNote}>{t.candidatesTitle}</SectionTitle>
                  {rows.length === 0 ? (
                    <div style={{ fontSize: 12, opacity: 0.6 }}>{t.listEmpty}</div>
                  ) : (
                    <div style={{ overflowX: "auto", border: T.borderSoft, borderRadius: T.radius }}>
                      <table style={{ borderCollapse: "collapse", width: "100%" }}>
                        <thead>
                          <tr>
                            <th style={th}>#</th>
                            <th style={th}>{t.colKind}</th>
                            <th style={{ ...th, textAlign: "left" }}>{t.colMap}</th>
                            <th style={{ ...th, textAlign: "left" }}>{t.colSetup}</th>
                            <th style={th}>{t.colScore}</th>
                            <th style={{ ...th, textAlign: "left" }}>{t.colTop}</th>
                            <th style={th}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => {
                            const on = r.key === selectedKey;
                            return (
                              <tr
                                key={r.key}
                                onClick={() => {
                                  setSelectedKey(r.key);
                                  if (isNarrow) selectNarrowTab("detail");
                                }}
                                title={t.rowHint}
                                style={{ cursor: "pointer", background: on ? "#eef6ff" : undefined, borderTop: "1px solid #eee" }}
                              >
                                <td style={{ ...td, textAlign: "center", opacity: 0.6 }}>{i + 1}</td>
                                <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                                  {r.kind === "proposal" ? t.kindProposal : r.kind === "saved" ? t.kindSaved : t.kindShared}
                                </td>
                                <td style={{ ...td, whiteSpace: "nowrap" }}>
                                  {r.tid ? templateMeta(r.tid, t) : "—"}
                                  {r.mapHash ? <span style={{ fontFamily: "monospace", opacity: 0.8 }}> {r.mapHash.slice(0, 6)}</span> : null}
                                  {r.mapScore ? <span style={{ opacity: 0.7 }}> / {Math.round(r.mapScore)}</span> : null}
                                </td>
                                <td style={{ ...td, fontFamily: "monospace", fontWeight: on ? 700 : 400, whiteSpace: "nowrap" }}>{String(r.setupInput.seed)}</td>
                                <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }} title={r.criterion ? criterionShort(r.criterion, t) : undefined}>
                                  {r.score != null ? Math.round(r.score * 100) / 100 : "—"}
                                </td>
                                <td style={td}>{topTotalOfRow(r)}</td>
                                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                                  {r.kind === "saved" ? (
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteSaved(r.savedId!); }} style={{ fontSize: 11 }}>
                                      {t.deleteSaved}
                                    </button>
                                  ) : (
                                    <button onClick={(e) => { e.stopPropagation(); handleSaveRow(r); }} style={{ fontSize: 11 }} disabled={isSavedAlready(r)}>
                                      {isSavedAlready(r) ? t.saved : t.save}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </section>

              {/* ---------- 条件 ---------- */}
              <section style={{ display: isNarrow && narrowTab !== "conditions" ? "none" : "flex", flexDirection: "column", gap: T.gap }}>
                <SectionTitle>{t.conditionsTitle}</SectionTitle>
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
                    setSavedProposals((prev) => {
                      const next = prev.filter((p) => p.conditionKey !== key);
                      writeProposals(next);
                      return next;
                    });
                    void deleteConditionProfile(STORE_LIST_PROFILES, key).then(refreshProfiles);
                  }}
                  onResetDefaults={resetConditions}
                />
                <SetupWeightInputs weights={evalWeights} onChange={changeEvalWeight} onReset={resetEvalWeights} lang={lang} lf={expansion === "lostFleet"} />
                <BlendInputs blend={scoreBlend} onChange={changeBlend} onReset={resetBlend} lang={lang} />
                <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700 }}>{t.klLabel}</span>
                    {([
                      ["k", t.kLabel, pairK, setPairK, LS_K],
                      ["l", t.lLabel, pairL, setPairL, LS_L],
                    ] as const).map(([key, label, value, setter, ls]) => (
                      <label key={key} style={{ display: "flex", gap: 4, alignItems: "center", border: "1px solid #eee", borderRadius: 6, padding: "3px 6px" }}>
                        <span>{label}</span>
                        <input
                          type="number"
                          min={1}
                          max={PAIR_SEARCH_KL_MAX}
                          value={value}
                          onChange={(e) => {
                            const v = Math.max(1, Math.min(PAIR_SEARCH_KL_MAX, Math.floor(Number(e.target.value)) || 1));
                            setter(v);
                            try { localStorage.setItem(ls, String(v)); } catch {}
                          }}
                          style={{ width: 56, padding: "2px 4px", fontSize: 12 }}
                        />
                      </label>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>{t.klNote}</div>
                </div>
                <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
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
              </section>
            </>
          }
        />
      </PageBody>
    </>
  );
}
