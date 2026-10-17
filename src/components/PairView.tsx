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
// v2.1（2026-10-17）: (1) Map の値は候補の条件プロファイルの evalVersion がいまと違えば表示時に評価し直す（mapEvaluate.ts。
// Map タブで開いた値と同じ基準になる）。合計表に「船」列（Setup タブの総合との差）。(2)「連続で両方を探索」＝ Map の検索 →
// 上位 K 枚それぞれに対して Setup を 1 マップあたり N 件（既定 10 万）マップに合わせて採点（ワーカー、pairWith）→ 上位 L 件を
// 順位表（pairRanking.ts、条件ごと上位 50 組、localStorage）へマージ、を停止まで繰り返す。
// v2.2（2026-10-17 ユーザー確定「すべて推奨」）: 候補一覧は全行をいまの基準・評価指数・合算比で採点し直して順位で並べる（#＝順位、由来の列は無し）。
// 連続探索（マップ → セットアップ）は Map の結果バケツの上位 K 枚のうち未探索のものだけに Setup を探索 → Map の検索 → 上位の更新 → 新たに
// 入った未探索のマップだけ探索、の繰り返し（探索済みは gaia_pair_explored_v1）。セットアップ → マップは起点のセットアップを固定して Map を
// 探索し続け、制約を通った盤面ごとに組の基準値を計算して順位表へ。結果バケツは配置とスコアだけ（persistence.slimEvaluation）、容量 1000。
// v2.3（2026-10-17 ユーザー確定「推奨」）: 候補一覧は「主」（マップ → セットアップならマップ、セットアップ → マップならセットアップ）ごとに
// 1 行（最良の相手）、詳細で別の相手を選べる。順位表は向きごと・主ごとに上位 10 組・主 50 件で IndexedDB（pairRanking.ts、保存した組も）。
// プレイ済み: 詳細の「プレイ済みにする」でマップは結果バケツの使用済み（＋ pair_maps の印）、セットアップは Setup の候補の使用済みにし、
// Pair の選択肢・一覧・提案・連続探索から除く（「プレイ済みも表示」で見られる。戻すのは Map / Setup タブの使用済み一覧）。

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
  loadFromDb,
  readMapCapacity,
  SEARCH_RESULT_KEEP_MAX,
  setCandidatesUsedByHash,
  type PersistedCandidate,
  type PersistedProfile,
} from "@/app/board/persistence";
import {
  buildSectorImgById,
  getAllSectors,
  IMG_OFFSET_BY_SLOT,
  ROT_OFFSETS_BY_SLOT,
  TEMPLATE_BY_ID,
} from "@/gaia/board/viewerAssets";
import { buildSectorLookup } from "@/gaia/board/previewBoard";
import { computePlacementHash, encodePlacementToken, decodePlacementToken } from "@/gaia/ssot/placementHash";
import { primaryOf } from "@/lib/pairRanking";
import { listSavedSetups, recordSetup, setSetupUsed, setupHistoryId, type SavedSetup } from "@/lib/setupHistory";
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
import { deriveSetupSettings, mapTopOfPlacement, planPair, setupSettingsOf, usesTotalBasis, type PairDir, type PairOption, type SetupSource } from "@/lib/pairPlan";
import { scorePairOf } from "@/lib/pairScore";
import { evaluatePlacement, evaluationOfCandidate, evaluationOfPlacement, type MapEvalCache, type MapEvaluation } from "@/lib/mapEvaluate";
import {
  addPairSaved,
  clearPairRanking,
  deletePairSaved,
  deletePairSavedByCondition,
  exploredMapOf,
  groupPairRows,
  loadPairData,
  markPairMapPlayed,
  migratePairLocalStorage,
  pairMapKey,
  pairMapRowOf,
  pairRankKeyOf,
  pairRowId,
  placementOfMapRow,
  savePairRows,
  setPairExplored,
  unexploredOf,
  type PairData,
  type PairMapRow,
  type PairRow as PairRankRow,
  type PairSavedRow,
} from "@/lib/pairRanking";
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
    savedNote: "主（マップ → セットアップならマップ、逆ならセットアップ）ごとに 1 行。基準値はいまの基準・評価指数・合算比で採点し直した値。保存した組は条件ごとに貯まる",
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
    klNote: "両方を探索: Map 上位 K × Setup 上位 L を採点して上位 10 組を候補に並べる（既定 20 × 20、上限 50）。連続で探索: 1 周ごとに Map 上位 K 枚、各マップの上位 L 件を順位表へ",
    searchCont: "連続で探索",
    searchContStop: "停止",
    searchContNote: "停止するまで繰り返す。マップ → セットアップ: Map の候補の上位 K 枚のうち未探索のマップに Setup を 1 マップあたりの件数ぶん採点 → Map の検索 → 上位に新たに入ったマップだけ探索。セットアップ → マップ: 起点のセットアップを固定して Map を探索し続け、制約を通った盤面を組として採点",
    contRound: (n: number) => `${n} 周目`,
    contSetupOf: (i: number, n: number) => `Setup ${i}/${n}`,
    contNoneUnexplored: "未探索なし",
    altSetups: (n: number) => `別の候補 Setup（${n} 件）`,
    altMaps: (n: number) => `別の候補 Map（${n} 件）`,
    altCount: (n: number) => `+${n}`,
    markPlayed: "プレイ済みにする",
    playedDone: "プレイ済み",
    markPlayedTip: "マップは Map タブの使用済みに、セットアップは Setup タブの候補に記録して使用済みにする。以後 Pair には出ない（戻すのは各タブの使用済み一覧）",
    showPlayed: "プレイ済みも表示",
    playedBadge: "済",
    contDirMismatch: "起点のセットアップの拡張・人数が探索プロファイルの Map の条件（テンプレート）と合いません",
    kindRanked: "連続",
    rankedRowTip: (round: number) => `連続で探索の順位表（${round} 周目に発見）`,
    rankingClear: (n: number) => `順位表を消す（${n} 組）`,
    rankingNote: "連続で探索の順位表（この条件の人数・拡張・基準・評価指数で上位 50 組）。一覧の順位と基準値はいまの基準・評価指数・合算比で採点し直した値",
    perMapLabel: "連続で探索: 1 マップあたりの Setup 件数",
    perMapNote: "Map の候補の上位 K 枚それぞれに対して探索する件数（既定 100000、1000〜1000000）。探索済みの件数はマップごとに記録し、足りないぶんだけ探索する。0.5ms/件 なので 10 万件 ≒ 50 秒 / マップ",
    contBusyHint: "連続で探索の実行中",
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
    savedNote: "One row per primary item (the map in Map → Setup, the setup in Setup → Map). Scores are recomputed with the current criterion, weights and blend. Saved pairs are kept per condition",
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
    klNote: "Search both: scores top K maps × top L setups and lists the best 10 pairs (default 20 × 20, max 50). Continuous: each round takes the top K maps and keeps the top L setups per map in the ranking",
    searchCont: "Search continuously",
    searchContStop: "Stop",
    searchContNote: "Repeats until stopped. Map → Setup: score setups (setups per map) for the unexplored maps among the top K Map candidates → Map search → explore only maps newly entering the top. Setup → Map: keep the chosen setup fixed, search maps and score every board that passes the constraints as a pair",
    contRound: (n: number) => `round ${n}`,
    contSetupOf: (i: number, n: number) => `Setup ${i}/${n}`,
    contNoneUnexplored: "nothing unexplored",
    altSetups: (n: number) => `Other setups (${n})`,
    altMaps: (n: number) => `Other maps (${n})`,
    altCount: (n: number) => `+${n}`,
    markPlayed: "Mark as played",
    playedDone: "Played",
    markPlayedTip: "Marks the map used on the Map tab and records the setup as used on the Setup tab. It no longer appears in Pair (undo from each tab's used list)",
    showPlayed: "Show played",
    playedBadge: "played",
    contDirMismatch: "The chosen setup's expansion / player count does not match the Map conditions (template) of the search profile",
    kindRanked: "ranked",
    rankedRowTip: (round: number) => `Continuous-search ranking (found in round ${round})`,
    rankingClear: (n: number) => `Clear ranking (${n} pairs)`,
    rankingNote: "Continuous-search ranking (top 50 pairs for this condition's players, expansion, criterion and weights). List rank and scores are recomputed with the current criterion, weights and blend",
    perMapLabel: "Continuous: setups per map",
    perMapNote: "Trials per map for each of the top K Map candidates (default 100000, 1000–1000000). Explored counts are kept per map and only the shortfall is searched. 0.5 ms each, so 100k ≈ 50 s per map",
    contBusyHint: "Continuous search is running",
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
/** 連続で探索: 1 マップあたりの Setup 件数（v2.1） */
const LS_SETUP_PER_MAP = "gaia_pair_setup_per_map";
const SETUP_PER_MAP_DEFAULT = 100000;
const SETUP_PER_MAP_MIN = 1000;
const SETUP_PER_MAP_MAX = 1000000;
/** ワーカーへ 1 回に渡すシードの数（10 万件のシード配列を 1 度に構造化クローンしないため。停止の粒度にもなる） */
const SETUP_BATCH = 25000;

/** プレイ済みも表示（localStorage。既定オフ） */
const LS_SHOW_PLAYED = "gaia_pair_show_played";

/** 候補一覧の 1 行（提案・保存した組・共有された組を同じ形に揃える） */
type PairRow = {
  key: string;
  kind: "proposal" | "saved" | "shared" | "ranked";
  /** 盤面の鍵（pairRanking.pairMapKey） */
  mapKey: string;
  /** セットアップのシード（主の鍵に使う） */
  seed: string;
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
  /** マップの検索キー（評価し直すときの条件プロファイル。連続探索の行が持つ） */
  mapSearchKey?: string;
  /** 連続探索で見つけた周 */
  round?: number;
  /** 「合計の上位」の文字列（採点のついでに作る） */
  topTotal?: string;
  /** 同じ主の組の数（一覧の行＝主の最良の相手） */
  alts?: number;
  /** プレイ済み（「プレイ済みも表示」のときだけ一覧に出る） */
  played?: boolean;
};

/** 候補のマップ（条件プロファイルの evalVersion が古ければ、いまのコードで評価し直した値に差し替えたもの） */
type EvaluatedCandidate = PersistedCandidate & { reevaluated?: boolean };

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
  const [profilesBySearchKey, setProfilesBySearchKey] = React.useState<Record<string, PersistedProfile>>({});
  /** 評価し直した盤面のキャッシュ（テンプレ | 配置ハッシュ → 評価。画面の寿命のあいだ持つ） */
  const evalCacheRef = React.useRef<MapEvalCache>(new Map());
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
  // ---- 連続で両方を探索（v2.1）----
  const [contBusy, setContBusy] = React.useState(false);
  const [contRound, setContRound] = React.useState(0);
  const [contPhase, setContPhase] = React.useState<"map" | "setup" | null>(null);
  const [contMapIdx, setContMapIdx] = React.useState(0);
  const [contMapCount, setContMapCount] = React.useState(0);
  const [contDone, setContDone] = React.useState(0);
  const [contTotal, setContTotal] = React.useState(0);
  const [contMode, setContMode] = React.useState<SearchRunMode | SetupSearchRunMode | null>(null);
  const contStopRef = React.useRef<(() => void) | null>(null);
  const contActiveRef = React.useRef(false);
  const [setupPerMap, setSetupPerMap] = React.useState(SETUP_PER_MAP_DEFAULT);
  const [pairData, setPairData] = React.useState<PairData>({ maps: {}, rows: [], explored: [], saved: [] });
  /** 結果バケツで使用済みのマップ（配置ハッシュ） */
  const [usedHashes, setUsedHashes] = React.useState<Set<string>>(() => new Set());
  const [showPlayed, setShowPlayed] = React.useState(false);
  /** 主ごとに選んだ相手（候補の行の key） */
  const [partnerByGroup, setPartnerByGroup] = React.useState<Record<string, string>>({});
  const [playedKeys, setPlayedKeys] = React.useState<Set<string>>(() => new Set());
  const reloadPairData = React.useCallback(async () => {
    try {
      setPairData(await loadPairData());
    } catch {
      // ignore
    }
  }, []);

  const conditionParams = React.useMemo(
    () => ({ players, lf: expansion === "lostFleet", pairDir, setupSource, criterion, evalWeights }),
    [players, expansion, pairDir, setupSource, criterion, evalWeights]
  );
  const conditionKey = React.useMemo(() => conditionKeyOf(conditionParams), [conditionParams]);
  const [profiles, setProfiles] = React.useState<Array<ConditionProfile<typeof conditionParams>>>([]);
  const clearPair = React.useCallback(() => {
    setPairOptions([]);
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

  const proposalsHere = React.useMemo(() => pairData.saved.filter((p) => p.conditionKey === conditionKey), [pairData.saved, conditionKey]);
  /** 順位表の鍵: 人数・拡張・基準・評価指数・探索の向き（向きごとに別の順位表。v2.3.0） */
  const rankingKey = React.useMemo(() => pairRankKeyOf({ players, lf: expansion === "lostFleet", criterion, evalWeights, dir: pairDir }), [players, expansion, criterion, evalWeights, pairDir]);
  const rankingHere = React.useMemo(() => pairData.rows.filter((r) => r.rankKey === rankingKey), [pairData.rows, rankingKey]);
  /** 盤面の配置（トークンを戻したもの。盤面ごとに 1 回） */
  const mapPlacements = React.useMemo(() => {
    const out: Record<string, PlacementItem[] | null> = {};
    for (const k of Object.keys(pairData.maps)) out[k] = placementOfMapRow(pairData.maps[k]) as PlacementItem[] | null;
    return out;
  }, [pairData.maps]);
  const usedSetupIds = React.useMemo(() => new Set(allSetups.filter((r) => r.used).map((r) => r.id)), [allSetups]);
  const isMapPlayed = React.useCallback((tid: string, hash: string) => (!!hash && usedHashes.has(hash)) || !!pairData.maps[pairMapKey(tid, hash)]?.played, [usedHashes, pairData.maps]);
  const isSetupPlayed = React.useCallback((input: BuildSetupInput) => usedSetupIds.has(setupHistoryId(input)), [usedSetupIds]);

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
      const pmap: Record<string, PersistedProfile> = {};
      for (const p of profilesDb) {
        const tid = String(p.templateId ?? (p.params as any)?.templateId ?? "");
        if (tid) tmap[p.searchKey] = tid;
        pmap[p.searchKey] = p;
      }
      setPinnedMaps(pins);
      setTopOverallMap(top);
      setTemplateIdBySearchKey(tmap);
      setProfilesBySearchKey(pmap);
      setUsedHashes(new Set(all.filter((c) => c.used).map((c) => String(c.placementHash ?? ""))));
      setRankedMaps(all.slice().sort((a, b) => Number(b.score) - Number(a.score)).slice(0, RANKED_MAP_CAP));
    } catch {
      // ignore
    }
    try {
      setAllSetups(await listSavedSetups());
    } catch {
      // ignore
    }
    await reloadPairData();
  }, [reloadPairData]);

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
      const pm = Number(localStorage.getItem(LS_SETUP_PER_MAP));
      if (Number.isFinite(pm) && pm >= SETUP_PER_MAP_MIN) setSetupPerMap(Math.min(SETUP_PER_MAP_MAX, Math.floor(pm)));
    } catch {}
    try {
      if (localStorage.getItem(LS_SHOW_PLAYED) === "1") setShowPlayed(true);
    } catch {}
    void migratePairLocalStorage().then(() => reloadPools());
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

  const selectableMapsRaw = React.useMemo<PersistedCandidate[]>(() => {
    const pool = buildMapPool({ pinned: pinnedMaps, ranked: rankedMaps, templateIdBySearchKey, topOverall: topOverallMap });
    // プレイ済み（結果バケツの使用済み、または pair_maps の印）は既定で出さない（v2.3.0）
    return showPlayed ? pool : pool.filter((c) => !c.used && !isMapPlayed(templateIdBySearchKey[c.searchKey] ?? "", String(c.placementHash ?? "")));
  }, [pinnedMaps, rankedMaps, topOverallMap, templateIdBySearchKey, showPlayed, isMapPlayed]);
  /**
   * 候補のマップを **いまの評価コード** に揃える（2026-10-17。ユーザー報告「Pair の値と Map で開いた値が一致しない」）。
   * 条件プロファイルの evalVersion がいまと違う候補（eval_v8 以前の結果バケツ）は、その条件で評価し直した score / breakdown に
   * 差し替える。Map タブで「開く」と同じ基準になる。1 盤面 0.5ms 前後、キャッシュ付き。
   */
  const selectableMaps = React.useMemo<EvaluatedCandidate[]>(
    () =>
      selectableMapsRaw.map((c) => {
        const ev = evaluationOfCandidate(c, profilesBySearchKey[c.searchKey], templateIdBySearchKey[c.searchKey] ?? "", evalCacheRef.current);
        if (!ev.reevaluated) return c;
        return { ...c, score: ev.score, evaluation: { ...((c as any).evaluation ?? {}), total: ev.score, breakdown: ev.breakdown }, reevaluated: true };
      }),
    [selectableMapsRaw, profilesBySearchKey, templateIdBySearchKey]
  );
  const selectableSetups = React.useMemo<SavedSetup[]>(() => {
    const src = showPlayed ? allSetups : allSetups.filter((r) => !r.used);
    const pins = src.filter((r) => r.pinned);
    const seen = new Set(pins.map((r) => r.id));
    return [...pins, ...src.filter((r) => !seen.has(r.id))];
  }, [allSetups, showPlayed]);

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
    setSelectedKey(null);
  }, [selectableMaps, selectableSetups, pairMapId, pairSetupId, pairDir, setupSource, criterion, templateIdBySearchKey, clearPair, lang, evalWeights, factionPref, scoreBlend]);

  // ---------- 候補一覧（提案 ＋ 保存した組 ＋ 共有された組） ----------
  const baseRows = React.useMemo<PairRow[]>(() => {
    const out: PairRow[] = [];
    const push = (r: PairRow) => {
      const played = isMapPlayed(r.tid, r.mapHash) || isSetupPlayed(r.setupInput);
      if (played && !showPlayed) return;
      out.push(played ? { ...r, played: true } : r);
    };
    if (pairShared) {
      const hash = computePlacementHash(pairShared.placement as any);
      push({
        key: "shared",
        kind: "shared",
        map: selectableMaps.find((c) => String(c.placementHash ?? "") === hash && templateIdBySearchKey[c.searchKey] === pairShared.templateId) ?? null,
        mapPlacement: pairShared.placement,
        tid: pairShared.templateId,
        mapHash: hash,
        mapKey: pairMapKey(pairShared.templateId, hash),
        mapScore: 0,
        setupInput: pairShared.input,
        seed: String(pairShared.input.seed),
        criterion: null,
        score: null,
        players: pairShared.input.playerCount ?? 4,
        lf: pairShared.input.mode === "lostFleet",
      });
    }
    for (const o of pairOptions) {
      const m = selectableMaps.find((c) => c.id === o.mapId) ?? null;
      const tid = m ? (templateIdBySearchKey[m.searchKey] ?? "") : "";
      const hash = String(m?.placementHash ?? "");
      push({
        key: `p:${o.key}`,
        kind: "proposal",
        map: m,
        mapPlacement: (m?.placement ?? []) as PlacementItem[],
        tid,
        mapHash: hash,
        mapKey: pairMapKey(tid, hash),
        mapScore: Number(m?.score ?? 0),
        setupInput: o.rec.input,
        seed: String(o.rec.input.seed),
        criterion: o.rec.criterion,
        score: o.rec.score,
        players: recSettings?.players ?? players,
        lf: recSettings?.lf ?? expansion === "lostFleet",
      });
    }
    for (const r of rankingHere) {
      const mr = pairData.maps[r.mapKey];
      const placement = mapPlacements[r.mapKey];
      if (!mr || !placement) continue;
      const m = selectableMaps.find((c) => String(c.placementHash ?? "") === mr.hash) ?? null;
      push({
        key: `r:${r.id}`,
        kind: "ranked",
        map: m,
        mapPlacement: placement,
        tid: mr.tid,
        mapHash: mr.hash,
        mapKey: r.mapKey,
        mapScore: m ? Number(m.score ?? 0) : mr.score,
        setupInput: r.input,
        seed: r.seed,
        criterion: r.criterion,
        score: r.score,
        players: r.players,
        lf: r.lf,
        mapSearchKey: mr.searchKey,
        round: r.round,
      });
    }
    for (const p of proposalsHere) {
      const mr = pairData.maps[p.mapKey];
      const placement = (p.mapKey ? mapPlacements[p.mapKey] : null) ?? [];
      const m = mr ? (selectableMaps.find((c) => String(c.placementHash ?? "") === mr.hash) ?? null) : null;
      push({
        key: `s:${p.id}`,
        kind: "saved",
        map: m,
        mapPlacement: placement,
        tid: mr?.tid ?? "",
        mapHash: mr?.hash ?? "",
        mapKey: p.mapKey,
        mapScore: m ? Number(m.score ?? 0) : (mr?.score ?? 0),
        setupInput: p.input,
        seed: p.seed,
        criterion: p.criterion,
        score: null,
        players: p.players,
        lf: p.lf,
        savedId: p.id,
        mapSearchKey: mr?.searchKey,
      });
    }
    return out;
  }, [pairShared, pairOptions, rankingHere, proposalsHere, selectableMaps, templateIdBySearchKey, recSettings, players, expansion, pairData.maps, mapPlacements, isMapPlayed, isSetupPlayed, showPlayed]);

  /**
   * 行のマップの評価（いまのコードの値）。候補にあるマップはその評価（古い結果バケツなら評価し直し済み）、候補に無い盤面
   * （保存した組・共有された組・順位表の行）は配置からその場で評価する（条件は mapSearchKey のプロファイル、無ければ既定）。
   */
  const mapEvalOfRow = React.useCallback(
    (r: PairRow): MapEvaluation | null => {
      if (r.map) {
        const bd = (r.map as any)?.evaluation?.breakdown ?? null;
        if (bd) return { score: Number(r.map.score ?? 0), breakdown: bd, reevaluated: !!(r.map as EvaluatedCandidate).reevaluated };
      }
      if (!r.tid || r.mapPlacement.length === 0) return null;
      const hash = r.mapHash || computePlacementHash(r.mapPlacement as any);
      return evaluationOfPlacement(r.tid, r.mapPlacement, hash, r.mapSearchKey ? profilesBySearchKey[r.mapSearchKey] : undefined, evalCacheRef.current);
    },
    [profilesBySearchKey]
  );


  /**
   * 候補の全行をいまの基準・評価指数・合算比・種族優遇で採点し直す（v2.2.0）。保存時の基準値や探索時の値は使わない。
   * 1 行 ＝ セットアップの構築 ＋ 採点（0.5ms 前後）。マップの評価はキャッシュ。
   */
  const scoredRows = React.useMemo<PairRow[]>(() => {
    return baseRows.map((r) => {
      const bd = mapEvalOfRow(r)?.breakdown ?? null;
      const res = buildSetupFromSeed(r.setupInput);
      const ss = applyShipInteraction(scoreSetupFactions(res, evalWeights), shipInteractionOf(res, bd, evalWeights));
      const top = mapTopOfPlacement(r.tid, r.mapPlacement, r.players);
      const score = scorePairOf({ criterion, setupScores: ss, mapBreakdown: bd, blend: scoreBlend, factionPref, players: r.players, lf: r.lf, mapTop: top });
      const topTotal = topTotalText(totalScoresOfPair(mapValueByFaction(bd), ss, scoreBlend), r.players + 2, lang, r.lf);
      return { ...r, criterion, score, topTotal };
    });
  }, [baseRows, mapEvalOfRow, evalWeights, criterion, scoreBlend, factionPref, lang]);

  /** 主（探索の向きで マップ か セットアップ）ごとにまとめ、主の中は基準値の降順、主どうしは最良の降順（v2.3.0） */
  const groups = React.useMemo(
    () => groupPairRows(scoredRows.map((r) => ({ ...r, score: r.score ?? 0 })), pairDir),
    [scoredRows, pairDir]
  );
  /** 候補一覧の行 ＝ 主ごとの最良の相手（# ＝ 順位） */
  const rows = React.useMemo<PairRow[]>(() => groups.map((g) => ({ ...g.rows[0], alts: g.rows.length })), [groups]);

  // 選択は主の鍵。選択が無い／消えたら先頭（最良）の主、共有された組はその主
  React.useEffect(() => {
    if (groups.length === 0) {
      if (selectedKey !== null) setSelectedKey(null);
      return;
    }
    if (selectedKey === "shared") {
      const g = groups.find((x) => x.rows.some((r) => r.kind === "shared"));
      setSelectedKey(g ? g.primary : groups[0].primary);
      return;
    }
    if (!groups.some((g) => g.primary === selectedKey)) setSelectedKey(groups[0].primary);
  }, [groups, selectedKey]);

  const selectedGroup = React.useMemo(() => groups.find((g) => g.primary === selectedKey) ?? null, [groups, selectedKey]);
  const selectedRow = React.useMemo<PairRow | null>(() => {
    if (!selectedGroup) return null;
    const want = partnerByGroup[selectedGroup.primary];
    return (want ? selectedGroup.rows.find((r) => r.key === want) : undefined) ?? selectedGroup.rows[0];
  }, [selectedGroup, partnerByGroup]);

  /** 詳細の材料: Setup の値（船の相互作用込み）・Map の値・合計 */
  const detail = React.useMemo(() => {
    if (!selectedRow) return null;
    const ev = mapEvalOfRow(selectedRow);
    const bd = ev?.breakdown ?? null;
    const setupResult = buildSetupFromSeed(selectedRow.setupInput);
    const setupScores = applyShipInteraction(scoreSetupFactions(setupResult, evalWeights), shipInteractionOf(setupResult, bd, evalWeights));
    const mapScores = mapValueByFaction(bd);
    const total = totalScoresOfPair(mapScores, setupScores, scoreBlend);
    const mapTop = mapTopOfPlacement(selectedRow.tid, selectedRow.mapPlacement, selectedRow.players)?.detail ?? null;
    return {
      bd,
      setupResult,
      setupScores,
      mapScores,
      total,
      mapTop,
      rows: totalRowsOf(mapScores, setupScores, scoreBlend, selectedRow.lf, lang),
      hasBreakdown: !!bd,
      reevaluated: !!ev?.reevaluated,
    };
  }, [selectedRow, mapEvalOfRow, evalWeights, scoreBlend, lang]);

  const mapRowOfPairRow = React.useCallback(
    (r: PairRow): PairMapRow | null =>
      r.tid && r.mapHash && r.mapPlacement.length > 0 ? pairMapRowOf(r.tid, r.mapHash, r.mapPlacement, r.mapSearchKey ?? r.map?.searchKey ?? "", r.mapScore) : null,
    []
  );
  const handleSaveRow = React.useCallback(
    (r: PairRow) => {
      const map = mapRowOfPairRow(r);
      const row: PairSavedRow = {
        id: `${map?.key ?? "m"}|${r.seed}|${Date.now()}`,
        conditionKey,
        mapKey: map?.key ?? "",
        seed: r.seed,
        input: r.setupInput,
        criterion: r.criterion ?? criterion,
        players: r.players,
        lf: r.lf,
        createdAt: Date.now(),
      };
      void addPairSaved(row, map).then(reloadPairData);
    },
    [conditionKey, criterion, mapRowOfPairRow, reloadPairData]
  );
  const handleDeleteSaved = React.useCallback(
    (id: string) => {
      void deletePairSaved(id).then(reloadPairData);
    },
    [reloadPairData]
  );
  /**
   * プレイ済みにする（v2.3.0）: マップは全バケツで使用済み（Map タブの使用済み一覧に出る）＋ pair_maps の印、セットアップは Setup の
   * 候補に記録して使用済み（Setup タブの使用済み表示に出る）。以後 Pair の選択肢・一覧・提案・連続探索から除く。
   */
  const handleMarkPlayed = React.useCallback(
    (r: PairRow) => {
      void (async () => {
        try {
          if (r.mapHash) await setCandidatesUsedByHash(r.mapHash, true);
          const map = mapRowOfPairRow(r);
          if (map) await markPairMapPlayed(map, true);
          await recordSetup(r.setupInput);
          await setSetupUsed(setupHistoryId(r.setupInput), true);
        } catch (e: any) {
          setPairMsg(String(e?.message ?? e));
        }
        setPlayedKeys((prev) => new Set([...prev, r.key]));
        await reloadPools();
      })();
    },
    [mapRowOfPairRow, reloadPools]
  );
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
    const capacity = Math.max(keepTop, readMapCapacity());
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
          keepTop: Math.min(capacity, SEARCH_RESULT_KEEP_MAX),
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
        const topMaps = maps.slice(0, forK).map((m) => {
          const ev = evaluatePlacement(templateId, m.placement ?? [], mapParams.hard, mapParams.soft);
          return ev ? { ...m, score: ev.score, evaluation: { total: ev.score, breakdown: ev.breakdown } } : m;
        });
        const options = scorePairs({ maps: topMaps.filter((m) => !!(m as any)?.evaluation?.breakdown), setups: setupRows, templateIdBySearchKey: tmap, criterion: forCriterion, players: sPlayers, lf: sLf, evalWeights: forWeights, factionPref: forPref, blend: forBlend, k: forK, l: forL, topN: PAIR_SEARCH_TOP_N });
        await reloadPools();
        setTemplateIdBySearchKey((prev) => ({ ...prev, [mapKey]: templateId }));
        setAllSetups(await listSavedSetups());
        setPairOptions(options);
        setRecSettings({ players: sPlayers, lf: sLf });
        setSelectedKey(null);
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

  /**
   * 連続で探索（v2.2.0、2026-10-17 ユーザー確定の手順）。停止するまで繰り返す。
   *
   * マップ → セットアップ:
   *   1. 探索プロファイルの Map の結果バケツ（Map タブの候補）の上位 K 枚を読む
   *   2. そのうち未探索（1 マップあたりの件数 N に届いていない）のマップごとに、Setup を残りの件数ぶん **そのマップとの組として** 採点
   *      （ワーカー、pairWith: 船の相互作用・基準 2・3 は合計 T_f・1・4 はマップの上位種族・種族優遇）→ 上位 L 件を順位表へ
   *   3. Map の検索（件数は Map タブの設定）→ 結果バケツへ保存（上位の更新）
   *   4. 1 へ（新たに上位 K に入った未探索のマップだけ 2 を行う）
   * セットアップ → マップ:
   *   起点のセットアップを固定し、Map の検索 → 結果バケツへ保存 → 制約を通った盤面ごとに組の基準値を計算 → 順位表へ、の繰り返し
   *   （制約を通る盤面は 0.1〜0.2% なので採点の負荷はほぼ無い）。
   * どちらも Setup の候補（マップに依らない順位）には入れない。順位表は条件ごと上位 50 組（pairRanking.ts）。
   */
  const handleSearchContinuous = React.useCallback(() => {
    if (contBusy) {
      contActiveRef.current = false;
      contStopRef.current?.();
      return;
    }
    const prof = activeSearchProfile;
    if (!prof?.map) {
      setPairMsg(UI[lang].needMapCond);
      return;
    }
    let mapParams: any = null;
    try {
      mapParams = prof.map.paramsRaw ? JSON.parse(prof.map.paramsRaw) : null;
    } catch {
      mapParams = null;
    }
    if (!mapParams?.templateId) {
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
    const perMap = Math.max(SETUP_PER_MAP_MIN, Math.min(SETUP_PER_MAP_MAX, setupPerMap));
    const keepTop = 20;
    const capacity = Math.max(keepTop, readMapCapacity());
    const randSeed = () => String(Math.floor(Math.random() * 2147483647) + 1);
    const forCriterion = criterion;
    const forK = pairK;
    const forL = pairL;
    const forPref = factionPref;
    const forBlend = scoreBlend;
    const forWeights = evalWeights;
    const forRankKey = rankingKey;
    const dir = pairDir;

    // セットアップ → マップ: 起点のセットアップ（人数・拡張はそのセットアップから。Map の条件のテンプレートと合うこと）
    let fixedSetup: SavedSetup | null = null;
    let sPlayers: number;
    let sLf: boolean;
    let setupBase: Omit<BuildSetupInput, "seed"> | null = null;
    if (dir === "setupToMap") {
      fixedSetup = selectableSetups.find((r) => r.id === pairSetupId) ?? null;
      if (!fixedSetup) {
        setPairMsg(UI[lang].needSetup);
        return;
      }
      const st = setupSettingsOf(fixedSetup);
      sPlayers = st.players;
      sLf = st.lf;
      const derived = deriveSetupSettings(templateId);
      if (derived.lf !== sLf || (sLf && derived.players !== sPlayers)) {
        setPairMsg(UI[lang].contDirMismatch);
        return;
      }
    } else {
      const setupParams: any = prof.setup?.params ?? null;
      if (!prof.setup || !setupParams?.setup) {
        setPairMsg(UI[lang].needSetupCond);
        return;
      }
      setupBase = { ...(setupParams.setup as Omit<BuildSetupInput, "seed">) };
      sPlayers = Number((setupBase as any).playerCount ?? 4);
      sLf = (setupBase as any).mode === "lostFleet";
    }

    const mergeFresh = async (fresh: PairRankRow[], maps: PairMapRow[]) => {
      if (fresh.length === 0) return;
      await savePairRows(forRankKey, dir, fresh, maps);
      await reloadPairData();
    };
    const runMapSearch = async () => {
      setContPhase("map");
      setContDone(0);
      setContTotal(mapTrials);
      setContMode(null);
      const searchOptions = {
        trials: mapTrials,
        keepTop: Math.min(capacity, SEARCH_RESULT_KEEP_MAX),
        seedStart: Number(randSeed()),
        yieldEvery: 50,
        ...(mapParams.placementMethod != null ? { placementMethod: mapParams.placementMethod } : {}),
        hard: mapParams.hard ?? {},
        soft: mapParams.soft ?? {},
      };
      const mr = await runSearchOffThread(
        templateId,
        searchOptions,
        (done) => setContDone(done),
        (stop) => {
          contStopRef.current = stop;
        },
        (m) => setContMode(m)
      );
      contStopRef.current = null;
      await saveMapSearchResults({ searchKey: mapKey, searchKeyParams: mapParams, templateId, results: mr.results, capacityActive: capacity, keepTop });
      setTemplateIdBySearchKey((prev) => ({ ...prev, [mapKey]: templateId }));
      await reloadPools();
      return mr.results as any[];
    };

    contActiveRef.current = true;
    setContBusy(true);
    setPairMsg(null);
    setContRound(0);
    setContPhase(null);
    setContMode(null);
    void (async () => {
      let round = 0;
      try {
        if (dir === "setupToMap" && fixedSetup) {
          // ---- セットアップ → マップ ----
          const setupResult = buildSetupFromSeed(fixedSetup.input);
          const raw = scoreSetupFactions(setupResult, forWeights);
          const seed = String(fixedSetup.input.seed);
          while (contActiveRef.current) {
            round++;
            setContRound(round);
            const results = await runMapSearch();
            const now = Date.now();
            const fresh: PairRankRow[] = [];
            const maps: PairMapRow[] = [];
            for (const r of results) {
              const bd = r.breakdown ?? r.evaluation?.breakdown ?? null;
              const placement = (r.placement ?? []) as PlacementItem[];
              if (!bd || placement.length === 0) continue;
              const mapHash = String(r.placementHash ?? computePlacementHash(placement as any));
              const mk = pairMapKey(templateId, mapHash);
              const top = mapTopOfPlacement(templateId, placement, sPlayers);
              const ss = applyShipInteraction(raw, shipInteractionOf(setupResult, bd, forWeights));
              const score = scorePairOf({ criterion: forCriterion, setupScores: ss, mapBreakdown: bd, blend: forBlend, factionPref: forPref, players: sPlayers, lf: sLf, mapTop: top });
              maps.push(pairMapRowOf(templateId, mapHash, placement, mapKey, Number(r.score ?? 0)));
              fresh.push({ id: pairRowId(forRankKey, mk, seed), rankKey: forRankKey, mapKey: mk, seed, input: fixedSetup.input, score, criterion: forCriterion, players: sPlayers, lf: sLf, createdAt: now, round });
            }
            await mergeFresh(fresh, maps);
          }
          return;
        }
        // ---- マップ → セットアップ ----
        while (contActiveRef.current) {
          round++;
          setContRound(round);
          // 1) 結果バケツ（使用済みを除く active）の上位 K 枚のうち、プレイ済みでなく未探索のもの
          const pd = await loadPairData();
          const explored = exploredMapOf(pd.explored, forRankKey);
          const loaded = await loadFromDb(mapKey, capacity);
          const topK = loaded.active
            .slice()
            .sort((a, b) => Number(b.score) - Number(a.score))
            .slice(0, forK)
            .filter((m) => !pd.maps[pairMapKey(templateId, String(m.placementHash ?? ""))]?.played);
          const todo = unexploredOf(topK, (m) => pairMapKey(templateId, String(m.placementHash ?? "")), explored, perMap);
          // 2) 未探索のマップごとに Setup をそのマップとの組として採点
          for (let i = 0; i < todo.length && contActiveRef.current; i++) {
            const m = todo[i].map;
            const placement = (m.placement ?? []) as PlacementItem[];
            const ev = evaluatePlacement(templateId, placement, mapParams.hard, mapParams.soft);
            if (!ev) continue;
            const bd = ev.breakdown;
            const mapHash = String(m.placementHash ?? computePlacementHash(placement as any));
            const top = mapTopOfPlacement(templateId, placement, sPlayers);
            const want = todo[i].remaining;
            setContPhase("setup");
            setContMapIdx(i + 1);
            setContMapCount(todo.length);
            setContDone(0);
            setContTotal(want);
            setContMode(null);
            let acc: Array<{ seed: string; input: BuildSetupInput; score: number }> = [];
            let didTrials = 0;
            let stopped = false;
            for (let from = 0; from < want && contActiveRef.current; from += SETUP_BATCH) {
              const n = Math.min(SETUP_BATCH, want - from);
              const sr = await runSetupSearch(
                {
                  seeds: Array.from({ length: n }, randSeed),
                  criterion: forCriterion,
                  playerCount: sPlayers,
                  lostFleet: sLf,
                  weights: forWeights,
                  topN: forL,
                  baseInput: setupBase!,
                  pairWith: { mapBreakdown: bd, blend: forBlend, ...(top ? { mapTop3: top.top3, mapTopK: top.topK } : {}), factionPrefByFaction: forPref },
                },
                {
                  onProgress: (done) => setContDone(from + done),
                  onMode: (mode) => setContMode(mode),
                  onStopHandle: (stop) => {
                    contStopRef.current = stop;
                  },
                }
              );
              contStopRef.current = null;
              acc = [...acc, ...sr.results].sort((a, b) => b.score - a.score).slice(0, forL);
              if (sr.stopped) {
                stopped = true;
                break;
              }
              didTrials += n;
            }
            const now = Date.now();
            const mk = pairMapKey(templateId, mapHash);
            await mergeFresh(
              acc.map((r) => ({ id: pairRowId(forRankKey, mk, r.seed), rankKey: forRankKey, mapKey: mk, seed: r.seed, input: r.input, score: r.score, criterion: forCriterion, players: sPlayers, lf: sLf, createdAt: now, round })),
              [pairMapRowOf(templateId, mapHash, placement, mapKey, Number(m.score ?? 0))]
            );
            // 探索済みの記録（途中で止めた分は数えない）
            if (!stopped && didTrials > 0) await setPairExplored(forRankKey, mk, perMap - want + didTrials);
          }
          if (!contActiveRef.current) break;
          // 3) Map の検索 → 上位の更新 → 4) 次の周で新たに入った未探索のマップだけ探索
          await runMapSearch();
        }
      } catch (e: any) {
        setPairMsg(String(e?.message ?? e));
      } finally {
        contActiveRef.current = false;
        contStopRef.current = null;
        setContBusy(false);
        setContPhase(null);
      }
    })();
  }, [contBusy, activeSearchProfile, lang, criterion, pairK, pairL, factionPref, scoreBlend, evalWeights, setupPerMap, rankingKey, reloadPools, reloadPairData, pairDir, selectableSetups, pairSetupId]);

  const handleClearRanking = React.useCallback(() => {
    void clearPairRanking(rankingKey).then(reloadPairData);
  }, [rankingKey, reloadPairData]);

  // 探索中にページを離れたら停める（ワーカーを残さない）
  React.useEffect(
    () => () => {
      contActiveRef.current = false;
      contStopRef.current?.();
      bothStopRef.current?.();
    },
    []
  );

  const isSavedAlready = React.useCallback(
    (r: PairRow) => r.kind === "saved" || proposalsHere.some((p) => p.mapKey === r.mapKey && p.seed === r.seed),
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
                      {selectedGroup && selectedGroup.rows.length > 1 ? (
                        <label style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ opacity: 0.7 }}>{pairDir === "mapToSetup" ? t.altSetups(selectedGroup.rows.length) : t.altMaps(selectedGroup.rows.length)}</span>
                          <select
                            value={r.key}
                            onChange={(e) => setPartnerByGroup((prev) => ({ ...prev, [selectedGroup.primary]: e.target.value }))}
                            style={{ maxWidth: 320 }}
                          >
                            {selectedGroup.rows.map((x, i) => (
                              <option key={x.key} value={x.key}>
                                {i + 1}. {pairDir === "mapToSetup" ? x.seed : `${x.mapHash.slice(0, 8)} / ${Math.round(x.mapScore)}`} ・ {Math.round((x.score ?? 0) * 100) / 100}
                                {x.played ? ` (${t.playedBadge})` : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
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
                        <button onClick={() => handleMarkPlayed(r)} style={{ fontSize: 11 }} disabled={!!r.played || playedKeys.has(r.key)} title={t.markPlayedTip}>
                          {r.played || playedKeys.has(r.key) ? t.playedDone : t.markPlayed}
                        </button>
                      </div>
                      <div style={{ fontWeight: 700, marginTop: 4 }}>
                        {t.totalTable}
                        <SharedHelp k="pairTotal" lang={lang} />
                      </div>
                      <TotalTable rows={detail.rows} blend={scoreBlend} lang={lang} mapHasBreakdown={detail.hasBreakdown} reevaluated={detail.reevaluated} />
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
                      <button onClick={handleGenerate} disabled={bothBusy || contBusy} style={{ padding: "3px 12px", fontWeight: 700 }}>
                        {pairOptions.length > 0 ? t.regenerate : t.generate}
                      </button>
                      <button
                        onClick={handleSearchBoth}
                        disabled={contBusy}
                        title={contBusy ? t.contBusyHint : t.searchBothNote}
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
                      <button
                        onClick={handleSearchContinuous}
                        disabled={bothBusy}
                        title={t.searchContNote}
                        style={{ padding: "3px 12px", fontWeight: 700, ...(contBusy ? { background: "#eef0ff", border: "1px solid #4453ff", color: "#2733cc" } : {}) }}
                      >
                        {contBusy ? t.searchContStop : t.searchCont}
                      </button>
                      <SharedHelp k="pairSearchContinuous" lang={lang} />
                      {contBusy ? (
                        <span style={{ opacity: 0.7 }}>
                          {t.contRound(contRound)}
                          {contPhase === "map" ? ` ・ ${t.phaseMap} ${contDone}/${contTotal}` : contPhase === "setup" ? ` ・ ${t.contSetupOf(contMapIdx, contMapCount)} ${contDone}/${contTotal}` : ""}
                          {contMode ? ` [${contMode}]` : ""}
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
                  {rankingHere.length > 0 ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 11, marginBottom: 4 }}>
                      <span style={{ opacity: 0.6 }}>{t.rankingNote}</span>
                      <button onClick={handleClearRanking} disabled={contBusy} style={{ fontSize: 11 }}>
                        {t.rankingClear(rankingHere.length)}
                      </button>
                    </div>
                  ) : null}
                  {rows.length === 0 ? (
                    <div style={{ fontSize: 12, opacity: 0.6 }}>{t.listEmpty}</div>
                  ) : (
                    <div style={{ overflowX: "auto", border: T.borderSoft, borderRadius: T.radius }}>
                      <table style={{ borderCollapse: "collapse", width: "100%" }}>
                        <thead>
                          <tr>
                            <th style={th}>#</th>
                            <th style={{ ...th, textAlign: "left" }}>{t.colMap}</th>
                            <th style={{ ...th, textAlign: "left" }}>{t.colSetup}</th>
                            <th style={th}>{t.colScore}</th>
                            <th style={{ ...th, textAlign: "left" }}>{t.colTop}</th>
                            <th style={th}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => {
                            const primary = primaryOf(r, pairDir);
                            const on = primary === selectedKey;
                            return (
                              <tr
                                key={r.key}
                                onClick={() => {
                                  setSelectedKey(primary);
                                  if (isNarrow) selectNarrowTab("detail");
                                }}
                                title={`${t.rowHint} ・ ${r.kind === "proposal" ? t.kindProposal : r.kind === "saved" ? t.kindSaved : r.kind === "ranked" ? t.rankedRowTip(r.round ?? 0) : t.kindShared}`}
                                style={{ cursor: "pointer", background: on ? "#eef6ff" : undefined, borderTop: "1px solid #eee" }}
                              >
                                <td style={{ ...td, textAlign: "center", opacity: 0.6 }}>{i + 1}</td>
                                <td style={{ ...td, whiteSpace: "nowrap" }}>
                                  {r.tid ? templateMeta(r.tid, t) : "—"}
                                  {r.mapHash ? <span style={{ fontFamily: "monospace", opacity: 0.8 }}> {r.mapHash.slice(0, 6)}</span> : null}
                                  {r.mapScore ? <span style={{ opacity: 0.7 }}> / {Math.round(r.mapScore)}</span> : null}
                                  {pairDir === "setupToMap" && (r.alts ?? 1) > 1 ? <span style={{ opacity: 0.6 }}> {t.altCount((r.alts ?? 1) - 1)}</span> : null}
                                </td>
                                <td style={{ ...td, fontFamily: "monospace", fontWeight: on ? 700 : 400, whiteSpace: "nowrap" }}>
                                  {String(r.setupInput.seed)}
                                  {pairDir === "mapToSetup" && (r.alts ?? 1) > 1 ? <span style={{ opacity: 0.6, fontFamily: "inherit" }}> {t.altCount((r.alts ?? 1) - 1)}</span> : null}
                                  {r.played ? <span style={{ opacity: 0.6, fontFamily: "inherit" }}> ({t.playedBadge})</span> : null}
                                </td>
                                <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }} title={r.criterion ? criterionShort(r.criterion, t) : undefined}>
                                  {r.score != null ? Math.round(r.score * 100) / 100 : "—"}
                                </td>
                                <td style={td}>{r.topTotal ?? ""}</td>
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
                    void deletePairSavedByCondition(key).then(reloadPairData);
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
                <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                  <label style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700 }}>{t.perMapLabel}</span>
                    <input
                      type="number"
                      min={SETUP_PER_MAP_MIN}
                      max={SETUP_PER_MAP_MAX}
                      step={1000}
                      value={setupPerMap}
                      disabled={contBusy}
                      onChange={(e) => {
                        const v = Math.max(SETUP_PER_MAP_MIN, Math.min(SETUP_PER_MAP_MAX, Math.floor(Number(e.target.value)) || SETUP_PER_MAP_MIN));
                        setSetupPerMap(v);
                        try { localStorage.setItem(LS_SETUP_PER_MAP, String(v)); } catch {}
                      }}
                      style={{ width: 90, padding: "2px 4px", fontSize: 12 }}
                    />
                  </label>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>{t.perMapNote}</div>
                </div>
                <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={showPlayed}
                    onChange={(e) => {
                      setShowPlayed(e.target.checked);
                      try { localStorage.setItem(LS_SHOW_PLAYED, e.target.checked ? "1" : "0"); } catch {}
                    }}
                  />
                  <span>{t.showPlayed}</span>
                </label>
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
