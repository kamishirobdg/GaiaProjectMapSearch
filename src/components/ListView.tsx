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
  writeSharedExpansion,
  writeSharedPlayers,
  type Expansion,
} from "@/lib/sharedSettings";
import {
  criterionScore,
  recommendSetup,
  scoreSetupFactions,
  topFactions,
  type FactionScores,
  type RecommendCriterion,
  type Recommendation,
} from "@/gaia/eval/factionEval";
import { mapFactionScores } from "@/gaia/eval/mapFaction";
import { FACTIONS, type FactionId } from "@/gaia/eval/factionWeights";
import { buildSetupFromSeed, type BuildSetupInput } from "@/gaia/setup/buildSetup";
import { SetupBoard } from "@/components/SetupView";

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
    pairNote: "ピン留めマップを選ぶと、基準に沿った推奨セットアップを1件提示します（種族重みはDRAFT）",
    pairMap: "マップ",
    pairNoMap: "（マップなし）",
    pairCriterion: "基準",
    crit1: "1: 逆優位（マップ上位種族が弱い）",
    crit2: "2: 上位バランス（人数+2種族が拮抗）",
    crit3: "3: マップ非依存の全体バランス",
    generate: "提案を生成",
    regenerate: "再生成",
    needMap: "基準1にはマップの選択が必要です",
    pairDirLabel: "探索の向き",
    dirMapToSetup: "マップ → セットアップ",
    dirSetupToMap: "セットアップ → マップ",
    setupSourceLabel: "セットアップの探し方",
    srcRandom: "ランダム生成",
    srcSaved: "保存済みから選ぶ",
    pairSetup: "セットアップ",
    needSetup: "起点にするセットアップを選んでください",
    needSetupPool: "条件に合う保存済みセットアップがありません",
    needMapPool: "条件に合うマップがありません（ピン留めかランキングが必要）",
    mapIndependentNote: "※基準2・3はマップに依存しないため、マップは条件が合う先頭のものになります",
    mapStrong: "マップ優位",
    setupStrong: "セットアップ優位（上位5）",
    trialsNote: "200シードから最良1件",
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
    pairNote: "Pick a pinned map to get one recommended setup per criterion (faction weights are DRAFT)",
    pairMap: "Map",
    pairNoMap: "(no map)",
    pairCriterion: "Criterion",
    crit1: "1: Oppose map (map's top factions weak)",
    crit2: "2: Top balance (players+2 factions close)",
    crit3: "3: Map-independent overall balance",
    generate: "Generate",
    regenerate: "Regenerate",
    needMap: "Criterion 1 requires a selected map",
    pairDirLabel: "Direction",
    dirMapToSetup: "Map → Setup",
    dirSetupToMap: "Setup → Map",
    setupSourceLabel: "Setup source",
    srcRandom: "Random rolls",
    srcSaved: "From saved",
    pairSetup: "Setup",
    needSetup: "Pick a setup to start from",
    needSetupPool: "No saved setup matches the current players/expansion",
    needMapPool: "No map matches (pin one or run a search first)",
    mapIndependentNote: "Note: criteria 2 and 3 do not depend on the map, so the first matching map is used",
    mapStrong: "Map favors",
    setupStrong: "Setup favors (top 5)",
    trialsNote: "best of 200 seeds",
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

/** 種族の表示名。 */
function factionLabel(id: FactionId, lang: Lang): string {
  const f = FACTIONS.find((x) => x.id === id);
  return f ? (lang === "ja" ? f.labelJa : f.labelEn) : id;
}

/** セットアップスコア上位N件を [ラベル +n] で並べる。 */
function topFactionText(scores: FactionScores, n: number, lang: Lang): string {
  const ids = topFactions(scores, n);
  return ids
    .map((f) => `${factionLabel(f, lang)} ${scores[f] >= 0 ? "+" : ""}${Math.round(scores[f] * 10) / 10}`)
    .join(" / ");
}

/**
 * ペア提案のセットアップ条件はマップのテンプレートから導出する
 * （マップと拡張・人数が食い違う提案を出さないため）。マップなしのときは
 * 共有設定（人数・拡張）に従う。
 */
function deriveSetupSettings(templateId: string | null): { players: number; lf: boolean } {
  if (templateId === "3p_lostFleet") return { players: 3, lf: true };
  if (templateId === "4p_lostFleet") return { players: 4, lf: true };
  const p = readSharedPlayers() ?? 4;
  if (templateId === "base_34p") return { players: Math.min(4, Math.max(3, p)), lf: false };
  return { players: p, lf: (readSharedExpansion() ?? "base") === "lostFleet" };
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

/** 探索の向き（2026-07-25 要望）。 */
type PairDir = "mapToSetup" | "setupToMap";
/** マップ→セットアップ時の相手の探し方。 */
type SetupSource = "random" | "saved";

const LS_LIST_DIR = "gaia_list_pair_dir";
const LS_LIST_SRC = "gaia_list_setup_source";
const LS_LIST_SETUP = "gaia_list_pair_setup";
const LS_LIST_MAP = "gaia_list_pair_map";
const LS_LIST_MAP_LABEL = "gaia_list_pair_map_label";
const LS_LIST_CRITERION = "gaia_list_criterion";

// 保存した提案（マップ配置＋基準＋セットアップ入力の自己完結スナップショット）。
// DBマイグレーションを避け localStorage に保持し、画面上から即再表示する。2026-07-24。
const LS_LIST_PROPOSALS = "gaia_list_proposals";
const PROPOSALS_CAP = 50;
type SavedProposal = {
  id: string;
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
  const [pairResultMapId, setPairResultMapId] = React.useState<string>("");
  const [rec, setRec] = React.useState<Recommendation | null>(null);
  const [recMapTop, setRecMapTop] = React.useState<Array<{ id: FactionId; score: number }> | null>(null);
  const [recSettings, setRecSettings] = React.useState<{ players: number; lf: boolean } | null>(null);
  const [savedProposals, setSavedProposals] = React.useState<SavedProposal[]>([]);
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
      if (savedCrit === "opposeMap" || savedCrit === "topBalance" || savedCrit === "neutralBalance") {
        setCriterion(savedCrit as RecommendCriterion);
      }
      const savedDir = localStorage.getItem(LS_LIST_DIR);
      if (savedDir === "mapToSetup" || savedDir === "setupToMap") setPairDir(savedDir);
      const savedSrc = localStorage.getItem(LS_LIST_SRC);
      if (savedSrc === "random" || savedSrc === "saved") setSetupSource(savedSrc);
      const savedSetupId = localStorage.getItem(LS_LIST_SETUP);
      if (savedSetupId) setPairSetupId(savedSetupId);
    } catch {}

    // 保存した提案を復元（読取のみ）。
    setSavedProposals(loadProposals());

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
  const selectableMaps = React.useMemo<PersistedCandidate[]>(() => {
    const pins = pinnedMaps.slice().sort((a, b) => Number(b.score) - Number(a.score));
    const seen = new Set(pins.map((c) => c.id));
    const rest = rankedMaps.filter((c) => !seen.has(c.id));
    const merged = [...pins, ...rest];
    if (merged.length > 0) return merged;
    return topOverallMap ? [topOverallMap] : [];
  }, [pinnedMaps, rankedMaps, topOverallMap]);

  // セットアップ候補: ピン留めを先頭に、続けて保存リスト（新しい順）。
  const selectableSetups = React.useMemo<SavedSetup[]>(() => {
    const pins = allSetups.filter((r) => r.pinned);
    const seen = new Set(pins.map((r) => r.id));
    return [...pins, ...allSetups.filter((r) => !seen.has(r.id))];
  }, [allSetups]);

  /** セットアップ保存レコードの人数/拡張。 */
  const setupSettingsOf = React.useCallback(
    (r: SavedSetup) => ({
      players: r.input.playerCount ?? 4,
      lf: r.input.mode === "lostFleet",
    }),
    []
  );

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

  // セット提案の生成（1件のみ提示。要望 2026-07-24）
  const handleGenerate = React.useCallback(() => {
    setRecorded(false);
    // マップの上位種族を出す小ヘルパ（テンプレ不整合は null）。
    const mapTopOf = (c: PersistedCandidate) => {
      const tid = templateIdBySearchKey[c.searchKey] ?? null;
      if (!tid) return null;
      try {
        const ms = mapFactionScores(tid, c.placement ?? []);
        const top3 = topFactions(ms, 3);
        return { tid, top3, detail: top3.map((f) => ({ id: f, score: ms[f] })) };
      } catch {
        return null;
      }
    };

    // --- セットアップ→マップ: 起点のセットアップに最も合うマップを探す ---
    if (pairDir === "setupToMap") {
      const src = selectableSetups.find((r) => r.id === pairSetupId) ?? null;
      if (!src) {
        setPairMsg(UI[lang].needSetup);
        setRec(null);
        return;
      }
      const settings = setupSettingsOf(src);
      const result = buildSetupFromSeed(src.input);
      const setupScores = scoreSetupFactions(result);
      // 人数/拡張が一致するマップだけを対象にする。
      const cands = selectableMaps.filter((c) => {
        const tid = templateIdBySearchKey[c.searchKey] ?? "";
        if (!tid) return false;
        const s = deriveSetupSettings(tid);
        return s.lf === settings.lf && (s.lf ? s.players === settings.players : true);
      });
      let best: { c: PersistedCandidate; score: number; top: ReturnType<typeof mapTopOf> } | null = null;
      for (const c of cands) {
        const top = mapTopOf(c);
        if (!top) continue;
        const score = criterionScore(criterion, setupScores, {
          playerCount: settings.players,
          mapTop3: top.top3,
        });
        if (!best || score > best.score) best = { c, score, top };
      }
      if (!best) {
        setPairMsg(UI[lang].needMapPool);
        setRec(null);
        return;
      }
      setPairMsg(criterion === "opposeMap" ? null : UI[lang].mapIndependentNote);
      setPairResultMapId(best.c.id);
      setRec({
        input: src.input,
        result,
        setupScores,
        criterion,
        score: best.score,
        trials: cands.length,
      });
      setRecMapTop(best.top?.detail ?? null);
      setRecSettings(settings);
      return;
    }

    // --- マップ→セットアップ ---
    const selected = selectableMaps.find((c) => c.id === pairMapId) ?? null;
    const tid = selected ? (templateIdBySearchKey[selected.searchKey] ?? null) : null;
    if (criterion === "opposeMap" && (!selected || !tid)) {
      setPairMsg(UI[lang].needMap);
      setRec(null);
      return;
    }
    setPairMsg(null);
    setPairResultMapId(pairMapId);
    let mapTop3: FactionId[] | undefined;
    let mapTopDetail: Array<{ id: FactionId; score: number }> | null = null;
    if (selected && tid) {
      const top = mapTopOf(selected);
      if (top) {
        mapTop3 = top.top3;
        mapTopDetail = top.detail;
      } else if (criterion === "opposeMap") {
        setPairMsg(UI[lang].needMap);
        setRec(null);
        return;
      }
    }
    const settings = deriveSetupSettings(tid);

    // 保存済みセットアップから選ぶ（2026-07-25 要望）。
    if (setupSource === "saved") {
      const cands = selectableSetups.filter((r) => {
        const s = setupSettingsOf(r);
        return s.lf === settings.lf && s.players === settings.players;
      });
      let best: { r: SavedSetup; score: number; scores: FactionScores } | null = null;
      for (const r of cands) {
        const res = buildSetupFromSeed(r.input);
        const scores = scoreSetupFactions(res);
        const score = criterionScore(criterion, scores, {
          playerCount: settings.players,
          ...(mapTop3 ? { mapTop3 } : {}),
        });
        if (!best || score > best.score) best = { r, score, scores };
      }
      if (!best) {
        setPairMsg(UI[lang].needSetupPool);
        setRec(null);
        return;
      }
      setRec({
        input: best.r.input,
        result: buildSetupFromSeed(best.r.input),
        setupScores: best.scores,
        criterion,
        score: best.score,
        trials: cands.length,
      });
      setRecMapTop(mapTopDetail);
      setRecSettings(settings);
      return;
    }

    // ランダム生成（従来動作）。
    const seeds = Array.from({ length: 200 }, () =>
      String(Math.floor(Math.random() * 2147483647) + 1)
    );
    const r = recommendSetup({
      criterion,
      seeds,
      playerCount: settings.players,
      lostFleet: settings.lf,
      ...(mapTop3 ? { mapTop3 } : {}),
    });
    setRec(r);
    setRecMapTop(mapTopDetail);
    setRecSettings(settings);
  }, [
    selectableMaps,
    selectableSetups,
    pairMapId,
    pairSetupId,
    pairDir,
    setupSource,
    setupSettingsOf,
    criterion,
    templateIdBySearchKey,
    lang,
  ]);

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
  }, [rec, recSettings, selectableMaps, pairResultMapId, criterion, templateIdBySearchKey]);

  const handleDeleteProposal = React.useCallback((id: string) => {
    setSavedProposals((prev) => {
      const next = prev.filter((p) => p.id !== id);
      writeProposals(next);
      return next;
    });
  }, []);

  const criterionLabel = React.useCallback(
    (c: RecommendCriterion) => (c === "opposeMap" ? t.crit1 : c === "topBalance" ? t.crit2 : t.crit3),
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
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 14, maxWidth: 1100 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{t.title}</div>
        <div style={{ fontSize: 11, opacity: 0.6 }}>{t.note}</div>
      </div>

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
            const scores = scoreSetupFactions(buildSetupFromSeed(pairShared.input));
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
                      <span style={{ opacity: 0.7 }}>{t.setupStrong}:</span> {topFactionText(scores, 5, lang)}
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

      {/* Pair proposal (map -> recommended setup) */}
      <section>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>{t.pairTitle}</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>{t.pairNote}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
          {/* 探索の向き（2026-07-25 要望） */}
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span>{t.pairDirLabel}</span>
            <select
              value={pairDir}
              onChange={(e) => {
                const v = e.target.value as PairDir;
                setPairDir(v);
                try { localStorage.setItem(LS_LIST_DIR, v); } catch {}
                setRec(null);
                setPairMsg(null);
              }}
              style={{ maxWidth: 200 }}
            >
              <option value="mapToSetup">{t.dirMapToSetup}</option>
              <option value="setupToMap">{t.dirSetupToMap}</option>
            </select>
          </label>

          {/* マップ→セットアップ時のみ: 相手の探し方 */}
          {pairDir === "mapToSetup" ? (
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span>{t.setupSourceLabel}</span>
              <select
                value={setupSource}
                onChange={(e) => {
                  const v = e.target.value as SetupSource;
                  setSetupSource(v);
                  try { localStorage.setItem(LS_LIST_SRC, v); } catch {}
                  setRec(null);
                  setPairMsg(null);
                }}
                style={{ maxWidth: 170 }}
              >
                <option value="random">{t.srcRandom}</option>
                <option value="saved">{t.srcSaved}</option>
              </select>
            </label>
          ) : null}

          {/* セットアップ→マップ時のみ: 起点セットアップ */}
          {pairDir === "setupToMap" ? (
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span>{t.pairSetup}</span>
              <select
                value={pairSetupId}
                onChange={(e) => {
                  setPairSetupId(e.target.value);
                  try { localStorage.setItem(LS_LIST_SETUP, e.target.value); } catch {}
                  setRec(null);
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
                setRec(null);
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
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span>{t.pairCriterion}</span>
            <select
              value={criterion}
              onChange={(e) => {
                setCriterion(e.target.value as RecommendCriterion);
                try { localStorage.setItem(LS_LIST_CRITERION, e.target.value); } catch {}
                setRec(null);
                setPairMsg(null);
              }}
              style={{ maxWidth: 280 }}
            >
              <option value="opposeMap">{t.crit1}</option>
              <option value="topBalance">{t.crit2}</option>
              <option value="neutralBalance">{t.crit3}</option>
            </select>
          </label>
          <button onClick={handleGenerate} style={{ padding: "3px 12px", fontWeight: 700 }}>
            {rec ? t.regenerate : t.generate}
          </button>
          {pairMsg ? <span style={{ color: "#b3261e" }}>{pairMsg}</span> : null}
        </div>
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
                        .map((x) => `${factionLabel(x.id, lang)} ${Math.round(x.score * 10) / 10}`)
                        .join(" / ")}
                    </div>
                  ) : null}
                  <div>
                    <span style={{ opacity: 0.7 }}>{t.setupStrong}:</span>{" "}
                    {topFactionText(rec.setupScores, 5, lang)}
                  </div>

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
      {savedProposals.length > 0 ? (
        <section>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            {t.savedProposals} ({savedProposals.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {savedProposals.map((p) => {
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
    </div>
    </>
  );
}
