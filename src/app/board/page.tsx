"use client";

import * as React from "react";
import { MapBoardViewer, type PlacementItem as ViewerPlacementItem } from "@/components/MapBoardViewer";
import GlobalBar from "@/components/GlobalBar";
import {
  readSharedExpansion,
  readSharedPlayers,
  writeSharedExpansion,
  writeSharedPlayers,
  type Expansion,
} from "@/lib/sharedSettings";

import { TEMPLATE_3P_LOSTFLEET } from "@/gaia/data/templates/3p_lostFleet";
import { TEMPLATE_4P_LOSTFLEET } from "@/gaia/data/templates/4p_lostFleet";
import { TEMPLATE_BASE_34P } from "@/gaia/data/templates/base_34p";

import {
  buildSectorImgById,
  getAllSectors,
  IMG_OFFSET_BY_SLOT,
  ROT_OFFSETS_BY_SLOT,
} from "@/gaia/board/viewerAssets";

import { buildSectorLookup } from "@/gaia/board/previewBoard";
import { buildLogicalMapFromPlacement } from "@/gaia/logicalMap/buildLogicalMap";
import { extractForEval } from "@/gaia/eval/extractForEval";
import { evaluateSoft } from "@/gaia/eval/evaluateSoft";

import { makeSearchPlacementFromSeed } from "@/gaia/ssot/searchPlacementConfig";
import { computePlacementHash, encodePlacementToken, decodePlacementToken } from "@/gaia/ssot/placementHash";


// Clipboard helper (safe fallback)
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for older browsers / non-secure contexts
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(ta);
    }
  }
}

import {
  type RankedResult,
  type PersistedCandidate,
  type PersistedProfile,
  type MergeResult,
  SEARCH_ALGO_VERSION,
  EVAL_VERSION,
  LAST_APPLIED_SEARCHKEY,
  stableStringify,
  sha256Hex,
  toRankedResult,
  mergeCandidates,
  loadFromDb,
  saveMergeToDb,
  loadProfilesFromDb,
  loadProfilesByBaseKeyRaw,
  upsertProfileToDb,
  deleteProfileOnlyFromDb,
  deleteProfileAndAllMapsFromDb,
  openDb,
  idbGetByKey,
  idbGetAllByIndex,
  idbPutAll,
  idbGetAllFromStore,
  idbClearStore,
  idbDeleteByIds,
  STORE_CANDIDATES,
  STORE_PROFILES,
} from "./persistence";

import { UI_TEXT, type Lang, type UiKey } from "./uiText";
import { ColorBreakdownTable, PLANET_ORDER, PLANET_LABEL_JA, PLANET_INPUT_BG, fmt0, axisMarkers, type BreakdownMarker, type MarkAxis } from "./BreakdownTable";

function parseSeedStart(seed: string): number {
  const n = parseInt(seed, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Randomize the search seedStart so that repeated runs explore different neighborhoods. */
function makeRandomSeedStart(): number {
  // 1..(2^31-1) — keep it safe for typical LCG / int32-based generators.
  try {
    const c: any = (globalThis as any).crypto;
    if (c && typeof c.getRandomValues === "function") {
      const a = new Uint32Array(1);
      c.getRandomValues(a);
      const v = a[0] >>> 0;
      return (v % 2147483647) + 1;
    }
  } catch {}
  return Math.floor(Math.random() * 2147483647) + 1;
}


function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function useIsNarrow(px: number) {
  const [narrow, setNarrow] = React.useState(false);
  React.useEffect(() => {
    const on = () => setNarrow(window.innerWidth < px);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [px]);
  return narrow;
}

/**
 * ホバーヒント付きラベル（⑤ UI文言改善、2026-07-24）。
 * title のネイティブツールチップ＋点線下線で「ヒントがある」ことを示す。
 * 用語集パネルはこの各所ツールチップに置き換えた（承認済み指摘）。
 */
function Hint({ label, tip }: { label: React.ReactNode; tip: string }) {
  return (
    <span title={tip} style={{ borderBottom: "1px dotted #999", cursor: "help" }}>
      {label}
    </span>
  );
}

/** sector image helper (UI only) は @/gaia/board/viewerAssets へ抽出済み（一覧タブと共用） */

function getBreakdown(r: any) {
  if (!r) return null;
  return r?.evaluation?.breakdown ?? null;
}

function sumCounts(obj: any): number {
  if (!obj || typeof obj !== "object") return 0;
  return Object.values(obj).reduce((acc: number, v: any) => acc + (Number(v) || 0), 0);
}

import { runSearchOffThread } from "./searchRunner";

// タブ遷移時の「デフォルト→復元」ちらつきを消すため、共有選択の復元は
// paint 前に走る layout effect で行う（SSRでは useEffect にフォールバック）。2026-07-24。
const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

// 評価指数の各セル（薄い背景色のテーブル状。ユーザー要望 2026-07-24）。
const EVAL_CELL: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  justifyContent: "space-between",
  background: "#f2f5f9",
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 6,
  padding: "4px 8px",
  fontSize: 12,
};

/** ---------- main ---------- */

export default function BoardPage() {
  // language toggle (persist)
  // language toggle (persist)
// IMPORTANT: avoid hydration mismatch by not reading localStorage in the initial render.
const [lang, setLang] = React.useState<Lang>("ja");

// load persisted language on mount (client only)
React.useEffect(() => {
  try {
    const v = localStorage.getItem("gaia_ui_lang");
    if (v === "ja" || v === "en") setLang(v as Lang);
  } catch {}
}, []);

// persist language
React.useEffect(() => {
  try {
    localStorage.setItem("gaia_ui_lang", lang);
  } catch {}
}, [lang]);

const isNarrow = useIsNarrow(1180);

// マップのドラッグ/パンは常時無効（誤操作のデメリットが上回るため固定表示、
// ユーザー要望 2026-07-24）。ズームは「マップ調整」ツールバーのスライダーで
// 引き続き調整可能。旧モバイル用の「タップで操作/スクロール優先」機構は
// パン無効化に伴い撤去（スクロール横取り自体が起きなくなった）。

// Prevent tiny page scrollbars caused by global margins/viewport rounding.
React.useEffect(() => {
  const docEl = document.documentElement;
  const body = document.body;

  const prev = {
    htmlOverflow: docEl.style.overflow,
    htmlHeight: docEl.style.height,
    bodyOverflow: body.style.overflow,
    bodyHeight: body.style.height,
    bodyMargin: body.style.margin,
    bodyPadding: body.style.padding,
  };

  // Desktop: lock the viewport and rely on internal scroll panes (original behavior).
  // Mobile: allow normal page scrolling (avoid nested scroll areas).
  if (isNarrow) {
    docEl.style.height = "auto";
    docEl.style.overflow = "auto";
    body.style.height = "auto";
    body.style.overflow = "auto";
  } else {
    docEl.style.height = "100%";
    docEl.style.overflow = "hidden";
    body.style.height = "100%";
    body.style.overflow = "hidden";
  }

  body.style.margin = "0";
  body.style.padding = "0";

  return () => {
    docEl.style.overflow = prev.htmlOverflow;
    docEl.style.height = prev.htmlHeight;
    body.style.overflow = prev.bodyOverflow;
    body.style.height = prev.bodyHeight;
    body.style.margin = prev.bodyMargin;
    body.style.padding = prev.bodyPadding;
  };
}, [isNarrow]);


  const t = React.useCallback((k: UiKey) => UI_TEXT[lang][k], [lang]);

  const [which, setWhich] = React.useState<"3p" | "4p" | "base">("3p");
  const template = React.useMemo(
    () => (which === "base" ? TEMPLATE_BASE_34P : which === "3p" ? TEMPLATE_3P_LOSTFLEET : TEMPLATE_4P_LOSTFLEET),
    [which]
  );
  const isBase = which === "base";

  // --- Shared players/expansion (same localStorage keys as the Setup tab) ---
  // The map template is DERIVED from them: Lost Fleet 3p/4p and base 3/4p
  // (base_34p is shared by 3 and 4 players), so any other combination leaves
  // the search disabled (no message, per spec).
  const [players, setPlayers] = React.useState<number>(3);
  const [expansion, setExpansion] = React.useState<Expansion>("lostFleet");
  const mapSupported = (players === 3 || players === 4);

  // 基本版の配置方法（p19 方法1/2/3）。検索キーに含める（base のみ）。
  // localStorage 書込みはハンドラのみ（復元effectとの併用禁止ルール）。
  const [placementMethod, setPlacementMethod] = React.useState<1 | 2 | 3>(1);
  // 盤面の表示モード（画像／番号+向き）。List と localStorage キーを共有する。
  const [tileMode, setTileMode] = React.useState<"image" | "schematic">("image");
  React.useEffect(() => {
    try {
      const v = Number(localStorage.getItem("gaia_search_placement_method"));
      if (v === 1 || v === 2 || v === 3) setPlacementMethod(v);
      const m = localStorage.getItem("gaia_tile_mode");
      if (m === "image" || m === "schematic") setTileMode(m);
    } catch {}
  }, []);

  const resetResultsForTemplateChange = React.useCallback(() => {
    setSelectedPlacement(null);
    setSelectedSeedLabel(null);
    lastShownResultRef.current = null; // テンプレ切替では表示フォールバックもクリア
    setActiveResults([]);
    setUsedResults([]);
    setProgressCurrent(0);
    setProgressBest(null);
    setHardFailBy({});
  }, []);

  const applySharedSelection = React.useCallback(
    (p: number, e: Expansion) => {
      setPlayers(p);
      setExpansion((prevExp) => {
        if (prevExp !== e) {
          // 拡張切替時は H2 既定値をそのテンプレ向けに再設定
          // （base は惑星密度が高く cap=1 だとほぼ全棄却。実測は
          //   scripts/_probe_base34p_rates.ts、既定値=2 はユーザー確定）
          setOuterSameColorMax(e === "base" ? 2 : 1);
        }
        return e;
      });
      writeSharedPlayers(p);
      writeSharedExpansion(e);
      const newWhich = e === "base" ? "base" : p === 4 ? "4p" : "3p";
      setWhich((prev) => {
        if (prev !== newWhich) resetResultsForTemplateChange();
        return newWhich;
      });
    },
    [resetResultsForTemplateChange]
  );

  // Restore the shared selection on mount (results are still empty here, so
  // no reset side effects matter). paint 前に走らせてタブ遷移時のちらつきを防ぐ。
  useIsoLayoutEffect(() => {
    const p = readSharedPlayers();
    const e = readSharedExpansion();
    if (p) setPlayers(p);
    if (e) setExpansion(e);
    const eff = e ?? "lostFleet";
    const pp = p ?? 3;
    if (eff === "base") {
      setWhich("base");
      setOuterSameColorMax(2);
    } else if (eff === "lostFleet" && pp === 4) setWhich("4p");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const centerModeOptions = React.useMemo(() => {
    if (which === "base") {
      // base: H4 は構造的に不要（方法1/2が内側配置を保証、方法3は自由が仕様）。UI非表示。
      return [{ value: "NONE", label: "None" }] as const;
    }
    if (which === "4p") {
      return [
        { value: "NONE", label: "None" },
        { value: "CENTER_7_8", label: "CENTER-2" },
      ] as const;
    }

    return [
      { value: "NONE", label: "None" },
      { value: "CENTER_7_9", label: "CENTER-3" },
      { value: "CENTER_8", label: "CENTER-1" },
    ] as const;
  }, [which]);
  
  const [seed, setSeed] = React.useState("0");

  type SeedMode = "random" | "fixed";

// IMPORTANT: avoid hydration mismatch by not reading localStorage in the initial render.
const [seedMode, setSeedMode] = React.useState<SeedMode>("random");

// load persisted seed mode on mount (client only)
React.useEffect(() => {
  try {
    const v = localStorage.getItem("gaia_search_seed_mode");
    if (v === "fixed" || v === "random") setSeedMode(v as SeedMode);
  } catch {}
}, []);

// persist seed mode
React.useEffect(() => {
  try {
    localStorage.setItem("gaia_search_seed_mode", seedMode);
  } catch {}
}, [seedMode]);



  const [showImportExport, setShowImportExport] = React.useState(false);
  // マップ調整ツールバーは不要になったため常時非表示（2026-07-24 ユーザー要望）。
  const [showSavedConditions, setShowSavedConditions] = React.useState(false);
  const [savedProfiles, setSavedProfiles] = React.useState<PersistedProfile[]>([]);

  // Saved-conditions UI
  const [profileQuery, setProfileQuery] = React.useState("");
  const [profileTemplateFilter, setProfileTemplateFilter] = React.useState<string>("");
  const [editingProfileKey, setEditingProfileKey] = React.useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = React.useState<string>("");

  // ---- Export / Import (replace legacy JSON feature) ----
  type ExportPayloadV1 = {
    format: "gaia_map_cache_export";
    version: 1;
    exportedAt: number;
    profiles: PersistedProfile[];
    candidates: PersistedCandidate[];
  };
  type ImportPreview = {
    ok: boolean;
    exportedAt?: number;
    profiles: number;
    candidates: number;
    searchKeys: number;
    profileConflicts: number; // imported profiles whose searchKey already exists
    candidateConflictsChecked: number; // number of candidates checked for existence
    candidateConflictsFound: number; // how many of checked existed
    fixRankValue: number;
    fixUsedKey: number;
    fixId: number;
    notes?: string[];
    error?: string;
  };



  const [importMode, setImportMode] = React.useState<"merge" | "replace">("merge");
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [expImpMsg, setExpImpMsg] = React.useState<string | null>(null);
  const [expImpErr, setExpImpErr] = React.useState<string | null>(null);
  const [expImpBusy, setExpImpBusy] = React.useState(false);
  const [importPreview, setImportPreview] = React.useState<ImportPreview | null>(null);
  const [importPreviewObj, setImportPreviewObj] = React.useState<ExportPayloadV1 | null>(null);
  const [importPreviewBusy, setImportPreviewBusy] = React.useState(false);
  const [importReplaceConfirm, setImportReplaceConfirm] = React.useState("");


  function normalizeExportPayload(raw: any): { payload: ExportPayloadV1; fix: { rankValue: number; usedKey: number; id: number } } {
    if (!raw || raw.format !== "gaia_map_cache_export" || raw.version !== 1) {
      throw new Error("Invalid export format/version");
    }
    const profilesIn = Array.isArray(raw.profiles) ? raw.profiles : [];
    const candsIn = Array.isArray(raw.candidates) ? raw.candidates : [];

    const fix = { rankValue: 0, usedKey: 0, id: 0 };

    const profiles: PersistedProfile[] = profilesIn
      .filter((p: any) => p && typeof p.searchKey === "string" && p.searchKey.length > 0)
      .map((p: any) => p as PersistedProfile);

    const candidates: PersistedCandidate[] = candsIn
      .filter((c: any) => c && (typeof c.id === "string" || (typeof c.searchKey === "string" && typeof c.placementHash === "string")))
      .map((c: any) => {
        const cc: any = { ...c };

        if (typeof cc.searchKey !== "string" || !cc.searchKey) {
          if (typeof cc.id === "string" && cc.id.includes(":")) cc.searchKey = String(cc.id.split(":")[0]);
        }
        if (typeof cc.placementHash !== "string" || !cc.placementHash) {
          if (typeof cc.id === "string" && cc.id.includes(":")) cc.placementHash = String(cc.id.split(":").slice(1).join(":"));
        }
        if (typeof cc.id !== "string" || !cc.id) {
          cc.id = `${String(cc.searchKey)}:${String(cc.placementHash)}`;
          fix.id += 1;
        }

        if (typeof cc.used === "boolean") {
          // ok
        } else {
          cc.used = Boolean(cc.usedKey === 1);
        }

        if (cc.usedKey !== 0 && cc.usedKey !== 1) {
          cc.usedKey = cc.used ? 1 : 0;
          fix.usedKey += 1;
        }

        if (typeof cc.rankValue !== "number" || !Number.isFinite(cc.rankValue)) {
          const sc = Number(cc.score) || 0;
          cc.rankValue = -sc; // best first (ascending)
          fix.rankValue += 1;
        }

        return cc as PersistedCandidate;
      });

    const payload: ExportPayloadV1 = {
      format: "gaia_map_cache_export",
      version: 1,
      exportedAt: typeof raw.exportedAt === "number" ? raw.exportedAt : Date.now(),
      profiles,
      candidates,
    };
    return { payload, fix };
  }

  async function countExistingCandidateIds(db: IDBDatabase, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_CANDIDATES, "readonly");
      const store = tx.objectStore(STORE_CANDIDATES);
      let found = 0;
      let pending = ids.length;

      for (const id of ids) {
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result) found += 1;
          pending -= 1;
          if (pending === 0) resolve(found);
        };
        req.onerror = () => {
          pending -= 1;
          if (pending === 0) resolve(found);
        };
      }

      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function buildImportPreview(payload: ExportPayloadV1, fix: { rankValue: number; usedKey: number; id: number }): Promise<ImportPreview> {
    const notes: string[] = [];
    const searchKeys = new Set<string>();
    for (const p of payload.profiles) searchKeys.add(p.searchKey);
    for (const c of payload.candidates) if (typeof c.searchKey === "string") searchKeys.add(c.searchKey);

    const db = await openDb();
    const existingProfiles = await idbGetAllFromStore<PersistedProfile>(db, STORE_PROFILES);
    const existingSet = new Set(existingProfiles.map((p) => p.searchKey));
    const profileConflicts = payload.profiles.reduce((acc, p) => acc + (existingSet.has(p.searchKey) ? 1 : 0), 0);

    const MAX_CHECK = 20000;
    let idsToCheck = payload.candidates.map((c) => c.id).filter((id) => typeof id === "string");
    if (idsToCheck.length > MAX_CHECK) {
      idsToCheck = idsToCheck.slice(0, MAX_CHECK);
      notes.push(t("importTooLargeNote"));
    }
    const candidateConflictsFound = await countExistingCandidateIds(db, idsToCheck);

    return {
      ok: true,
      exportedAt: payload.exportedAt,
      profiles: payload.profiles.length,
      candidates: payload.candidates.length,
      searchKeys: searchKeys.size,
      profileConflicts,
      candidateConflictsChecked: idsToCheck.length,
      candidateConflictsFound,
      fixRankValue: fix.rankValue,
      fixUsedKey: fix.usedKey,
      fixId: fix.id,
      notes: notes.length ? notes : undefined,
    };
  }


  async function buildExportPayload(scope: "all" | "current"): Promise<ExportPayloadV1> {
    const db = await openDb();
    let profiles: PersistedProfile[] = [];
    let candidates: PersistedCandidate[] = [];

    if (scope === "all") {
      profiles = await idbGetAllFromStore<PersistedProfile>(db, STORE_PROFILES);
      candidates = await idbGetAllFromStore<PersistedCandidate>(db, STORE_CANDIDATES);
    } else {
      const p = await idbGetByKey<PersistedProfile>(db, STORE_PROFILES, searchKey);
      profiles = p ? [p] : [];
      // candidates by index searchKey (includes active+used)
      const rng = IDBKeyRange.only(searchKey);
      // bySearchKey index exists
      const rows = await idbGetAllByIndex<PersistedCandidate>(db, STORE_CANDIDATES, "bySearchKey", rng);
      candidates = rows ?? [];
    }

    return {
      format: "gaia_map_cache_export",
      version: 1,
      exportedAt: Date.now(),
      profiles,
      candidates,
    };
  }

  function downloadJson(filename: string, obj: any) {
    const s = JSON.stringify(obj, null, 2);
    const blob = new Blob([s], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function normalizeImportedCandidate(row: any): PersistedCandidate | null {
    if (!row) return null;
    const searchKeyIn = String(row.searchKey ?? "");
    const placementHash = String(row.placementHash ?? "");
    if (!searchKeyIn || !placementHash) return null;

    const used = Boolean(row.used ?? false);
    const usedKey = Number.isFinite(row.usedKey) ? Number(row.usedKey) : used ? 1 : 0;

    const score = Number(row.score ?? 0);
    const rankValue = Number.isFinite(row.rankValue) ? Number(row.rankValue) : -score;

    const seed = String(row.seed ?? "");
    const id = String(row.id ?? `${searchKeyIn}:${placementHash}`);

    const now = Date.now();
    return {
      id,
      searchKey: searchKeyIn,
      placementHash,
      seed,
      score,
      rankValue,
      placement: row.placement ?? [],
      evaluation: row.evaluation ?? null,
      used: usedKey === 1,
      usedKey: usedKey === 1 ? 1 : 0,
      usedAt: row.usedAt ? Number(row.usedAt) : undefined,
      createdAt: Number(row.createdAt ?? now),
      updatedAt: Number(row.updatedAt ?? now),
    } as any;
  }

  async function importPayload(payload: ExportPayloadV1, mode: "merge" | "replace") {
    const db = await openDb();

    if (mode === "replace") {
      await idbClearStore(db, STORE_CANDIDATES);
      await idbClearStore(db, STORE_PROFILES);
    }

    // Upsert profiles first (keep existing name if already set)
    const existingProfiles = mode === "replace" ? [] : await idbGetAllFromStore<PersistedProfile>(db, STORE_PROFILES);
    const existingByKey = new Map(existingProfiles.map((p) => [p.searchKey, p]));

    const profilesToPut: PersistedProfile[] = [];
    for (const p of payload.profiles ?? []) {
      const key = String((p as any).searchKey ?? "");
      if (!key) continue;
      const prev = existingByKey.get(key);
      const namePrev = (prev?.name ?? "").trim();
      const nameIn = String((p as any).name ?? "").trim();
      profilesToPut.push({
        ...(prev ?? ({} as any)),
        ...(p as any),
        searchKey: key,
        name: namePrev ? namePrev : nameIn,
        updatedAt: Math.max(Number((p as any).updatedAt ?? 0), Number(prev?.updatedAt ?? 0), Date.now()),
      } as PersistedProfile);
    }
    if (profilesToPut.length) await idbPutAll(db, STORE_PROFILES, profilesToPut);

    // Candidates: merge per searchKey to preserve used / best score and enforce capacityActive per profile.lastTopK
    const bySearch = new Map<string, PersistedCandidate[]>();
    for (const raw of payload.candidates ?? []) {
      const c = normalizeImportedCandidate(raw);
      if (!c) continue;
      // enforce canonical id format
      c.id = `${c.searchKey}:${c.placementHash}`;
      c.searchKey = String(c.searchKey);
      c.placementHash = String(c.placementHash);
      bySearch.set(c.searchKey, (bySearch.get(c.searchKey) ?? []).concat([c]));
    }

    for (const [sk, incoming] of bySearch.entries()) {
      const prof = await idbGetByKey<PersistedProfile>(db, STORE_PROFILES, sk);
      const topKForCap = Number(prof?.lastTopK ?? 0);
      const cap = Math.max(Number.isFinite(topKForCap) && topKForCap > 0 ? topKForCap : 100, 100);

      const existing = mode === "replace" ? { active: [] as PersistedCandidate[], used: [] as PersistedCandidate[] } : await loadFromDb(sk, cap);

      const merged = mergeCandidates(sk, existing.active, existing.used, incoming, cap);
      // Delete evicted active ids (capacity shrink)
      if (merged.deletedActiveIds.length) await idbDeleteByIds(db, STORE_CANDIDATES, merged.deletedActiveIds);

      // Persist merged active + used (used is not capped)
      await idbPutAll(db, STORE_CANDIDATES, [...merged.active, ...merged.used]);

      // Update / upsert profile counts
      const now = Date.now();
      const base = prof ?? ({
        searchKey: sk,
        templateId: "",
        params: null,
        paramsRaw: "",
        baseKeyRaw: null,
        algoVersion: "",
        evalVersion: "",
        name: "",
        activeCount: 0,
        usedCount: 0,
        lastTopK: cap,
        updatedAt: now,
      } as any);

      const updatedProfile: PersistedProfile = {
        ...(base as any),
        searchKey: sk,
        activeCount: merged.active.length,
        usedCount: merged.used.length,
        lastTopK: Math.max(Number(base.lastTopK ?? 0), cap),
        updatedAt: now,
      } as any;

      await idbPutAll(db, STORE_PROFILES, [updatedProfile]);
    }
  }

  function LocalExportImportPanel() {
    return (
      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10, marginTop: 8 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{t("exportImportTitle")}</div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={async () => {
              try {
                setExpImpErr(null);
                setExpImpMsg(null);
                const payload = await buildExportPayload("all");
                const d = new Date();
                const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
                downloadJson(`gaia_map_cache_all_${ymd}.json`, payload);
                setExpImpMsg(t("exportDone"));
              } catch (e: any) {
                setExpImpErr(`${t("importError")}: ${String(e?.message ?? e)}`);
              }
            }}
          >
            {t("exportAll")}
          </button>

          <button
            onClick={async () => {
              try {
                setExpImpErr(null);
                setExpImpMsg(null);
                const payload = await buildExportPayload("current");
                const d = new Date();
                const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
                downloadJson(`gaia_map_cache_${templateId}_${ymd}.json`, payload);
                setExpImpMsg(t("exportDone"));
              } catch (e: any) {
                setExpImpErr(`${t("importError")}: ${String(e?.message ?? e)}`);
              }
            }}
          >
            {t("exportCurrent")}
          </button>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, opacity: 0.85 }}>{t("importMode")}</div>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
            <input type="radio" checked={importMode === "merge"} onChange={() => setImportMode("merge")} />
            {t("importMerge")}
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
            <input type="radio" checked={importMode === "replace"} onChange={() => setImportMode("replace")} />
            {t("importReplace")}
          </label>
          {importMode === "replace" ? (
            <div style={{ fontSize: 12, color: "#b00" }}>{t("importReplaceWarn")}</div>
          ) : null}
        </div>

        
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="file"
            accept="application/json"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setImportFile(f);
              setImportReplaceConfirm("");
              setImportPreview(null);
              setImportPreviewObj(null);
              setExpImpErr(null);
              setExpImpMsg(null);

              if (!f) return;

              void (async () => {
                try {
                  setImportPreviewBusy(true);
                  const txt = await f.text();
                  const raw = JSON.parse(txt);
                  const { payload, fix } = normalizeExportPayload(raw);
                  setImportPreviewObj(payload);
                  const prev = await buildImportPreview(payload, fix);
                  setImportPreview(prev);
                } catch (e: any) {
                  setImportPreview({ ok: false, profiles: 0, candidates: 0, searchKeys: 0, profileConflicts: 0, candidateConflictsChecked: 0, candidateConflictsFound: 0, fixRankValue: 0, fixUsedKey: 0, fixId: 0, error: String(e?.message ?? e) });
                } finally {
                  setImportPreviewBusy(false);
                }
              })();
            }}
          />

          {importMode === "replace" ? (
            <input
              value={importReplaceConfirm}
              onChange={(e) => setImportReplaceConfirm(e.target.value)}
              placeholder="DELETE"
              style={{ width: 210 }}
            />
          ) : null}

          <button
            disabled={
              !importPreviewObj ||
              !importPreview ||
              !importPreview.ok ||
              expImpBusy ||
              importPreviewBusy ||
              (importMode === "replace" && importReplaceConfirm !== "DELETE")
            }
            onClick={async () => {
              if (!importPreviewObj) return;
              try {
                setExpImpBusy(true);
                setExpImpErr(null);
                setExpImpMsg(null);

                if (importMode === "replace") {
                  const ok = window.confirm(t("importReplaceWarn"));
                  if (!ok) return;
                }

                await importPayload(importPreviewObj as ExportPayloadV1, importMode);

                // Reload current key state
                try {
                  if (!searchKey) return; // 追加：null/空ならスキップ
                  const loaded = await loadFromDb(searchKey, capacityActive);
                  setActivePersisted(loaded.active);
                  setUsedPersisted(loaded.used);
                } catch {}
                try {
                  const ps = await loadProfilesFromDb(200);
                  setSavedProfiles(ps);
                } catch {}

                setExpImpMsg(t("importDone"));
              } catch (e: any) {
                setExpImpErr(`${t("importError")}: ${String(e?.message ?? e)}`);
              } finally {
                setExpImpBusy(false);
              }
            }}
          >
            {t("importRun")}
          </button>
        </div>

        {importPreviewBusy ? (
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>...</div>
        ) : null}

        {importPreview ? (
          <div style={{ marginTop: 8, padding: 8, borderRadius: 8, border: "1px solid #ddd", background: importPreview.ok ? "#f8fff8" : "#fff8f8" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontWeight: 800 }}>{t("importPreviewTitle")}</div>
              <div style={{ fontSize: 12, color: importPreview.ok ? "#080" : "#b00" }}>
                {importPreview.ok ? t("importPreviewValid") : t("importPreviewInvalid")}
              </div>
              {typeof importPreview.exportedAt === "number" ? (
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  {t("importPreviewExportedAt")}: <span style={{ fontFamily: "monospace" }}>{new Date(importPreview.exportedAt).toISOString()}</span>
                </div>
              ) : null}
            </div>

            {importPreview.error ? (
              <div style={{ marginTop: 6, fontSize: 12, color: "#b00" }}>{importPreview.error}</div>
            ) : (
              <div style={{ marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, opacity: 0.9 }}>
                <div>
                  {t("importPreviewProfiles")}: <b>{importPreview.profiles}</b>
                </div>
                <div>
                  {t("importPreviewCandidates")}: <b>{importPreview.candidates}</b>
                </div>
                <div>
                  {t("importPreviewSearchKeys")}: <b>{importPreview.searchKeys}</b>
                </div>
                <div>
                  {t("importPreviewProfileConflicts")}: <b>{importPreview.profileConflicts}</b>
                </div>
                <div>
                  {t("importPreviewCandidateConflicts")}: <b>{importPreview.candidateConflictsFound}</b> / {importPreview.candidateConflictsChecked}
                </div>
              </div>
            )}

            {importPreview.ok ? (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
                {t("importPreviewFixups")}: {t("importPreviewFixupsRank")}={importPreview.fixRankValue}, {t("importPreviewFixupsUsedKey")}={importPreview.fixUsedKey},{" "}
                {t("importPreviewFixupsId")}={importPreview.fixId}
              </div>
            ) : null}

            {importMode === "replace" ? (
              <div style={{ marginTop: 6, fontSize: 12, color: "#b00" }}>
                {t("importReplaceConfirmLabel")}
              </div>
            ) : null}

            {importPreview.notes && importPreview.notes.length ? (
              <ul style={{ marginTop: 6, marginBottom: 0, paddingLeft: 18, fontSize: 12, opacity: 0.9 }}>
                {importPreview.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}


        {expImpMsg ? <div style={{ marginTop: 8, fontSize: 12, color: "#060" }}>{expImpMsg}</div> : null}
        {expImpErr ? <div style={{ marginTop: 8, fontSize: 12, color: "#b00" }}>{expImpErr}</div> : null}
      </div>
    );
  }

  const filteredSavedProfiles = React.useMemo(() => {
    const q = profileQuery.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
    
return (savedProfiles ?? []).filter((p) => {
      const params = (p.params ?? null) as any;
      const tid = String(params?.templateId ?? p.templateId ?? "");
      if (profileTemplateFilter && tid !== profileTemplateFilter) return false;
      if (!tokens.length) return true;
      const hard = params?.hard ?? {};
      const soft = params?.soft ?? {};
      const hay = (
        `${p.name ?? ""} ${tid} ` +
        `outerSameColorMax=${String(hard?.outerSameColorMax ?? "")} ` +
        `centerMode=${String(hard?.centerMode ?? "")} ` +
        `maxConnectedPlanets=${String(hard?.maxConnectedPlanets ?? "")} ` +
        `h5IncludeScouts=${String(hard?.h5IncludeScouts ?? false)} ` +
        `wOuter=${String(soft?.wOuter ?? "")} wTouch=${String(soft?.wTouch ?? "")} ` +
        `wScout=${String(soft?.wScout ?? "")} wScoutCore=${String(soft?.wScoutCore ?? "")} ` +
        `wScoutByKey{twilight=${String(soft?.wScoutByScoutKey?.twilight ?? soft?.wScoutByScoutKey?.S1 ?? "")},` +
        `eclipse=${String(soft?.wScoutByScoutKey?.eclipse ?? soft?.wScoutByScoutKey?.S2 ?? "")},` +
        `rebellion=${String(soft?.wScoutByScoutKey?.rebellion ?? soft?.wScoutByScoutKey?.S3 ?? "")},` +
        `tfmars=${String(soft?.wScoutByScoutKey?.tfmars ?? soft?.wScoutByScoutKey?.S4 ?? "")}} ` +
        `wScoutCoreByKey{twilight=${String(soft?.wScoutCoreByScoutKey?.twilight ?? soft?.wScoutCoreByScoutKey?.S1 ?? "")},` +
        `eclipse=${String(soft?.wScoutCoreByScoutKey?.eclipse ?? soft?.wScoutCoreByScoutKey?.S2 ?? "")},` +
        `rebellion=${String(soft?.wScoutCoreByScoutKey?.rebellion ?? soft?.wScoutCoreByScoutKey?.S3 ?? "")},` +
        `tfmars=${String(soft?.wScoutCoreByScoutKey?.tfmars ?? soft?.wScoutCoreByScoutKey?.S4 ?? "")}} ` +
        `scoutCoreAttrib=${String(soft?.scoutCoreAttributionMode ?? "")} ` +
        `scoutRadius=${String(soft?.scoutRadius ?? "")} imbalanceMetric=${String(soft?.imbalanceMetric ?? "")} ` +
        `wColorPref=${String(soft?.wColorPref ?? "")} colorPref{black=${String(soft?.colorPrefByType?.BLACK ?? "")},blue=${String(soft?.colorPrefByType?.BLUE ?? "")},brown=${String(soft?.colorPrefByType?.BROWN ?? "")},orange=${String(soft?.colorPrefByType?.ORANGE ?? "")},red=${String(soft?.colorPrefByType?.RED ?? "")},white=${String(soft?.colorPrefByType?.WHITE ?? "")},yellow=${String(soft?.colorPrefByType?.YELLOW ?? "")}} ` +
        `algoVersion=${String(params?.algoVersion ?? p.algoVersion ?? "")} evalVersion=${String(params?.evalVersion ?? p.evalVersion ?? "")} ` +
        `${p.searchKey}`
      ).toLowerCase();
      return tokens.every((tk) => hay.includes(tk));
    });
  }, [savedProfiles, profileQuery, profileTemplateFilter]);

  // breakdown table view config (render-only)
  const [breakdownCols, setBreakdownCols] = React.useState(() => ({
    outer: true,
    touch: true,
    scout: true,
    scoutCore: true,
    gaia: true,
    cluster: true,
    total: true,
    cntOuter: false,
    cntTouch: false,
  }));

  // Ranking selection: show EXACT evaluated placement
  const [selectedPlacement, setSelectedPlacement] = React.useState<any[] | null>(null);
  const [selectedSeedLabel, setSelectedSeedLabel] = React.useState<string | null>(null);

  // Hard params
  const [outerSameColorMax, setOuterSameColorMax] = React.useState(1);
  const [centerMode, setCenterMode] = React.useState<"NONE" | "CENTER_7_9" | "CENTER_8" | "CENTER_7_8">("NONE");
  // H5: max connected planet cluster cap. 0 = disabled (default).
  const [maxConnectedPlanets, setMaxConnectedPlanets] = React.useState(0);
  // H5: include scout cells as planets for the connected-cluster check. false = disabled (default).
  const [h5IncludeScouts, setH5IncludeScouts] = React.useState(false);
  
    React.useEffect(() => {
    const allowed = new Set(centerModeOptions.map((x) => x.value));
    if (!allowed.has(centerMode)) {
      setCenterMode("NONE");
    }
  }, [centerMode, centerModeOptions]);
  
  // Soft params
  const [wOuter, setWOuter] = React.useState(3);
  const [wTouch, setWTouch] = React.useState(1);
  // 既定値は「各軸が全体に占める割合」を実測して決めた（2026-07-30 ユーザー確定）。
  // 影響力の順を 船接触 > 船星系 > ガイア > 星系 > 最外周 > 外周 にしてある。
  // 実測(3p_lostFleet/24盤面): 31.2% / 27.0% / 23.4% / 13.9% / 3.3% / 1.2%
  const [wScout, setWScout] = React.useState(10);
  const [wScoutCore, setWScoutCore] = React.useState(4);

  const [wScoutS1, setWScoutS1] = React.useState(10);
  const [wScoutS2, setWScoutS2] = React.useState(10);
  const [wScoutS3, setWScoutS3] = React.useState(10);
  const [wScoutS4, setWScoutS4] = React.useState(10);

  const [wScoutCoreS1, setWScoutCoreS1] = React.useState(3);
  const [wScoutCoreS2, setWScoutCoreS2] = React.useState(3);
  const [wScoutCoreS3, setWScoutCoreS3] = React.useState(3);
  const [wScoutCoreS4, setWScoutCoreS4] = React.useState(3);

  const [scoutCoreAttribBest, setScoutCoreAttribBest] = React.useState(false);

  const [scoutRadius, setScoutRadius] = React.useState(3);
  const wImbalance = 100;
  // 指標(std/range)のドロップダウンは廃止し std 固定（ユーザー確定 2026-07-23。
  // キーには従来どおり imbalanceMetric:"std" が入り続けるので既存保存結果は不変。
  // range で保存済みの条件は適用しても std のまま=別バケットになる点は許容済み）。
  const imbalanceMetric = "std" as const;

  // 基本版専用の新評価軸（2026-07-23）: ガイア近接（距離1/2/3の全ガイア合算）と
  // 星系クラスタ（サイズn>=2の各色に+n×重み）。LFではキー・実行時とも
  // フィールドごと省略（evaluateSoft側もフィールド不在で完全スキップ）。
  const [wGaiaD1, setWGaiaD1] = React.useState(5);
  const [wGaiaD2, setWGaiaD2] = React.useState(8);
  const [wGaiaD3, setWGaiaD3] = React.useState(3);
  const [wClusterSize, setWClusterSize] = React.useState(1);

  // LF でガイア近接・星系軸を有効化するオプトイン（Phase A, 2026-07-25）。
  // 既定 OFF。OFF のときはキーからフィールドごと省略＝既存LFキーはバイト不変。
  // ON にすると base と同じ2軸を評価に加える（LFキーが変わり別バケット＝了承済み）。
  // base では常時有効なのでこのフラグは無視される。
  const [applyExtraAxesLF, setApplyExtraAxesLF] = React.useState(false);
  React.useEffect(() => {
    try {
      if (localStorage.getItem("gaia_lf_extra_axes") === "1") setApplyExtraAxesLF(true);
    } catch {}
  }, []);
  const changeApplyExtraAxesLF = React.useCallback((on: boolean) => {
    setApplyExtraAxesLF(on);
    try {
      localStorage.setItem("gaia_lf_extra_axes", on ? "1" : "0");
    } catch {}
  }, []);
  // base か、LFでオプトインしているとき 2軸を評価・キーに含める
  const extraAxesOn = isBase || applyExtraAxesLF;

  // Color preference (by planetTypeTotals)
  const [wColorPref, setWColorPref] = React.useState(3);
  const [prefBLACK, setPrefBLACK] = React.useState(0);
  const [prefBLUE, setPrefBLUE] = React.useState(0);
  const [prefBROWN, setPrefBROWN] = React.useState(0);
  const [prefORANGE, setPrefORANGE] = React.useState(0);
  const [prefRED, setPrefRED] = React.useState(0);
  const [prefWHITE, setPrefWHITE] = React.useState(0);
  const [prefYELLOW, setPrefYELLOW] = React.useState(0);

  const [trials, setTrials] = React.useState(30000);
  const [keepTop, setKeepTop] = React.useState(20);

  // trials is an execution setting (excluded from searchKeyParams / saved profiles),
  // so it needs its own persistence like seedMode. Read on mount to avoid hydration mismatch.
  React.useEffect(() => {
    try {
      const v = parseInt(localStorage.getItem("gaia_search_trials") ?? "", 10);
      if (Number.isFinite(v) && v > 0) setTrials(v);
    } catch {}
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem("gaia_search_trials", String(trials));
    } catch {}
  }, [trials]);

  const [busy, setBusy] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // --- Continuous search (repeat until stopped) ---
  const [continuousMode, setContinuousMode] = React.useState(false);
  const stopContinuousRef = React.useRef(false);
  React.useEffect(() => () => {
    stopContinuousRef.current = true;
  }, []);


  // --- Hash IO / shareable URL (?h=...) ---
  const [hashIo, setHashIo] = React.useState<string>("");
  const hashInputRef = React.useRef<HTMLInputElement | null>(null);
  const prevTokenRef = React.useRef<string>("");

  // Share URL (long, token-carrying link) is generated on demand only; normal
  // browsing keeps the address bar clean.
  const [shareUrl, setShareUrl] = React.useState<string>("");
  const [shareCopied, setShareCopied] = React.useState<boolean>(false);
  // If URL has ?h=..., apply it once results exist.
  const pendingHashRef = React.useRef<string | null>(null);
  const hashAppliedRef = React.useRef<boolean>(false);

  
  const [placementOverride, setPlacementOverride] = React.useState<any[] | null>(null);
const [activeResults, setActiveResults] = React.useState<RankedResult[]>([]);
  const [usedResults, setUsedResults] = React.useState<RankedResult[]>([]);
  const [resultsMode, setResultsMode] = React.useState<"active" | "used">("active");

  const applyHashToSelection = React.useCallback(
    (hashOrToken: string) => {
      const h = (hashOrToken ?? "").trim();
      if (!h) return;

      // 1) Prefer decoding placement directly from token (hash-only restore).
      const decoded = decodePlacementToken(h as any);
      if (decoded && Array.isArray(decoded)) {
        setPlacementOverride(decoded as any);
        setErrorMsg(null);
        return;
      }

      // 2) Fallback: select from existing results by placementHash (legacy 8-hex hash).
      //    This is kept for backward compatibility with old shared links.
      const all = [...activeResults, ...usedResults];
      const found = all.find((x: any) => String(x?.placementHash ?? "") === h);
      if (found) {
        // Clear override so normal selection drives the viewer
        setPlacementOverride(null);
setSelectedSeedLabel(String(found.seed ?? ""));
        return;
      }

      // If neither decode nor found, keep the input but show a lightweight message.
      setErrorMsg(`Hash/Token not found: ${h}`);
    },
    [activeResults, usedResults, setErrorMsg, setSelectedSeedLabel]
  );

  // Read hash from URL once (only present when arriving via a shared link).
  React.useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const h = url.searchParams.get("h");
      if (h && h.trim()) {
        setHashIo(h.trim());
        pendingHashRef.current = h.trim();
        hashAppliedRef.current = false;

        // ?t=<templateId> があれば人数/拡張ラジオをそのマップに合わせる（#9-a）。
        // これが無いと現在の拡張ラジオのテンプレで placement を描画してしまい、
        // List の「Mapで開く」でマップが正しく出なかった。
        const t = url.searchParams.get("t");
        if (t && t.trim()) {
          applyTemplateFromId(t.trim());
          url.searchParams.delete("t");
        }

        // Drop ?h= from the address bar once captured: the board is restored
        // from pendingHashRef, and a shareable link is regenerated on demand
        // via the Share URL button, so normal browsing stays on a clean URL.
        url.searchParams.delete("h");
        window.history.replaceState(null, "", url.toString());
      }
    } catch {
      // ignore
    }
  }, []);

  // If URL hash/token is present, try to restore placement directly.
// If decoding fails (legacy 8-hex hash), fallback to selecting from existing results when available.
  React.useEffect(() => {
    if (hashAppliedRef.current) return;
    const h = pendingHashRef.current;
    if (!h) return;

    // Try decode immediately (works without any search results).
    const decoded = decodePlacementToken(h as any);
    if (decoded && Array.isArray(decoded)) {
      setPlacementOverride(decoded as any);
      hashAppliedRef.current = true;
      setErrorMsg(null);
      return;
    }

    // Legacy: wait until results exist then select by placementHash
    if (activeResults.length === 0 && usedResults.length === 0) return;
    applyHashToSelection(h);
    hashAppliedRef.current = true;
  }, [activeResults.length, usedResults.length, applyHashToSelection, setErrorMsg]);

  const [searchKey, setSearchKey] = React.useState<string | null>(null);
  const [searchKeyRaw, setSearchKeyRaw] = React.useState<string | null>(null);
  const [baseKeyRaw, setBaseKeyRaw] = React.useState<string | null>(null);
  const [oldVersionProfiles, setOldVersionProfiles] = React.useState<PersistedProfile[]>([]);
  const [activePersisted, setActivePersisted] = React.useState<PersistedCandidate[]>([]);
  const [usedPersisted, setUsedPersisted] = React.useState<PersistedCandidate[]>([]);

  const activePersistedRef = React.useRef<PersistedCandidate[]>([]);
  const usedPersistedRef = React.useRef<PersistedCandidate[]>([]);
  React.useEffect(() => {
    activePersistedRef.current = activePersisted;
  }, [activePersisted]);
  React.useEffect(() => {
    usedPersistedRef.current = usedPersisted;
  }, [usedPersisted]);
  const [progressCurrent, setProgressCurrent] = React.useState(0);
  const [progressBest, setProgressBest] = React.useState<number | null>(null);
  const [hardFailBy, setHardFailBy] = React.useState<Record<string, number>>({});


  const templateId = React.useMemo(() => {
    return String((template as any).templateId ?? (template as any).id ?? (which === "3p" ? "3p_lostFleet" : "4p_lostFleet"));
  }, [template, which]);

  // Active (unused) persistence capacity per spec: max(TopK, 100).
  const capacityActive = React.useMemo(() => Math.max(keepTop, 100), [keepTop]);

  const didAutoApplyRef = React.useRef(false);

  // テンプレIDから人数/拡張/which を合わせる（?h= 共有リンクの ?t= 用、#9-a）。
  // applySavedProfile と同じ対応表。base は 3/4 共用なので現人数を保持。
  const applyTemplateFromId = React.useCallback((tid: string) => {
    const id = String(tid ?? "");
    if (id === "base_34p" || id.startsWith("base")) {
      setWhich("base");
      setExpansion("base");
      writeSharedExpansion("base");
      setPlayers((prev) => {
        const p = prev === 3 || prev === 4 ? prev : 4;
        writeSharedPlayers(p);
        return p;
      });
      setOuterSameColorMax(2);
    } else if (id.startsWith("3p")) {
      setWhich("3p");
      setPlayers(3);
      setExpansion("lostFleet");
      writeSharedPlayers(3);
      writeSharedExpansion("lostFleet");
      setOuterSameColorMax(1);
    } else if (id.startsWith("4p")) {
      setWhich("4p");
      setPlayers(4);
      setExpansion("lostFleet");
      writeSharedPlayers(4);
      writeSharedExpansion("lostFleet");
      setOuterSameColorMax(1);
    }
  }, []);

  const applySavedProfile = React.useCallback(
    (p: PersistedProfile, opts?: { closePanel?: boolean }) => {
      const closePanel = opts?.closePanel !== false; // default true
      const params = (p.params ?? null) as any;
      const tid = String(params?.templateId ?? p.templateId ?? "");
      const hasParams = !!params;

      if (!hasParams) return;

      // Keep the shared players/expansion selection in sync with the profile's
      // template (Lost Fleet 3p/4p, or base_34p which is shared by 3/4 players).
      if (tid === "base_34p") {
        setWhich("base");
        setExpansion("base");
        writeSharedExpansion("base");
        // base_34p は3・4人共用: 現在の人数が3/4ならそのまま、それ以外は4に補正
        setPlayers((prev) => {
          const p = prev === 3 || prev === 4 ? prev : 4;
          writeSharedPlayers(p);
          return p;
        });
        const pm = Number((params as any)?.placementMethod);
        if (pm === 1 || pm === 2 || pm === 3) setPlacementMethod(pm as 1 | 2 | 3);
      } else if (tid.startsWith("3p")) {
        setWhich("3p");
        setPlayers(3);
        setExpansion("lostFleet");
        writeSharedPlayers(3);
        writeSharedExpansion("lostFleet");
      } else if (tid.startsWith("4p")) {
        setWhich("4p");
        setPlayers(4);
        setExpansion("lostFleet");
        writeSharedPlayers(4);
        writeSharedExpansion("lostFleet");
      }

      try {
        if (params?.hard?.outerSameColorMax != null) setOuterSameColorMax(Number(params.hard.outerSameColorMax));
        if (params?.hard?.centerMode != null) setCenterMode(String(params.hard.centerMode) as any);
        // H5: field absent (older saved profiles) => restore as 0 (disabled).
        setMaxConnectedPlanets(
          params?.hard?.maxConnectedPlanets != null ? Number(params.hard.maxConnectedPlanets) : 0
        );
        // H5: field absent (older saved profiles) => restore as false (disabled).
        setH5IncludeScouts(!!params?.hard?.h5IncludeScouts);
        if (params?.soft?.wOuter != null) setWOuter(Number(params.soft.wOuter));
        if (params?.soft?.wTouch != null) setWTouch(Number(params.soft.wTouch));
        if (params?.soft?.wScout != null) setWScout(Number(params.soft.wScout));
        if (params?.soft?.wScoutCore != null) setWScoutCore(Number(params.soft.wScoutCore));
        if (params?.soft?.scoutRadius != null) setScoutRadius(Number(params.soft.scoutRadius));
try {
  const sw = (params as any)?.soft?.wScoutByScoutKey;
  if (sw) {
    if ((sw as any).twilight != null) setWScoutS1(Number((sw as any).twilight));
    else if (sw.S1 != null) setWScoutS1(Number(sw.S1));
    if ((sw as any).eclipse != null) setWScoutS2(Number((sw as any).eclipse));
    else if (sw.S2 != null) setWScoutS2(Number(sw.S2));
    if ((sw as any).rebellion != null) setWScoutS3(Number((sw as any).rebellion));
    else if (sw.S3 != null) setWScoutS3(Number(sw.S3));
    if ((sw as any).tfmars != null) setWScoutS4(Number((sw as any).tfmars));
    else if (sw.S4 != null) setWScoutS4(Number(sw.S4));
  }
  const scw = (params as any)?.soft?.wScoutCoreByScoutKey;
  if (scw) {
    if ((scw as any).twilight != null) setWScoutCoreS1(Number((scw as any).twilight));
    else if (scw.S1 != null) setWScoutCoreS1(Number(scw.S1));
    if ((scw as any).eclipse != null) setWScoutCoreS2(Number((scw as any).eclipse));
    else if (scw.S2 != null) setWScoutCoreS2(Number(scw.S2));
    if ((scw as any).rebellion != null) setWScoutCoreS3(Number((scw as any).rebellion));
    else if (scw.S3 != null) setWScoutCoreS3(Number(scw.S3));
    if ((scw as any).tfmars != null) setWScoutCoreS4(Number((scw as any).tfmars));
    else if (scw.S4 != null) setWScoutCoreS4(Number(scw.S4));
  }
  const mode = String((params as any)?.soft?.scoutCoreAttributionMode ?? "all");
  setScoutCoreAttribBest(mode === "best");
} catch {}

        // imbalanceMetric は std 固定（ドロップダウン廃止に伴い復元もしない）
        // ガイア近接・星系軸（フィールド不在の旧/OFFのLFプロファイルは既定値のまま）
        if (params?.soft?.wGaiaDist1 != null) setWGaiaD1(Number(params.soft.wGaiaDist1) || 0);
        if (params?.soft?.wGaiaDist2 != null) setWGaiaD2(Number(params.soft.wGaiaDist2) || 0);
        if (params?.soft?.wGaiaDist3 != null) setWGaiaD3(Number(params.soft.wGaiaDist3) || 0);
        if (params?.soft?.wClusterSize != null) setWClusterSize(Number(params.soft.wClusterSize) || 0);
        // LFプロファイルにこの2軸フィールドがあれば、オプトインを ON にして復元
        {
          const tidR = String((params as any)?.templateId ?? p.templateId ?? "");
          const hasExtra =
            params?.soft?.wGaiaDist1 != null ||
            params?.soft?.wGaiaDist2 != null ||
            params?.soft?.wGaiaDist3 != null ||
            params?.soft?.wClusterSize != null;
          if (tidR !== "base_34p") changeApplyExtraAxesLF(hasExtra);
        }
        if ((params as any)?.soft?.wColorPref != null) setWColorPref(Number((params as any).soft.wColorPref) || 0);
        try {
          const cp = (params as any)?.soft?.colorPrefByType ?? (params as any)?.soft?.colorBiasByType ?? null;
          if (cp) {
            if (cp.BLACK != null) setPrefBLACK(Number(cp.BLACK) || 0);
            if (cp.BLUE != null) setPrefBLUE(Number(cp.BLUE) || 0);
            if (cp.BROWN != null) setPrefBROWN(Number(cp.BROWN) || 0);
            if (cp.ORANGE != null) setPrefORANGE(Number(cp.ORANGE) || 0);
            if (cp.RED != null) setPrefRED(Number(cp.RED) || 0);
            if (cp.WHITE != null) setPrefWHITE(Number(cp.WHITE) || 0);
            if (cp.YELLOW != null) setPrefYELLOW(Number(cp.YELLOW) || 0);
          }
        } catch {}
      } catch {}

      if (typeof p.lastTopK === "number" && Number.isFinite(p.lastTopK) && p.lastTopK > 0) {
        setKeepTop(Math.floor(p.lastTopK));
      }

      try {
        localStorage.setItem(LAST_APPLIED_SEARCHKEY, String(p.searchKey));
      } catch {}

      if (closePanel) setShowSavedConditions(false);
    },
    [setWhich, setOuterSameColorMax, setCenterMode, setMaxConnectedPlanets, setH5IncludeScouts, setWOuter, setWTouch, setWScout, setWScoutCore, setScoutRadius, setWColorPref, setPrefBLACK, setPrefBLUE, setPrefBROWN, setPrefORANGE, setPrefRED, setPrefWHITE, setPrefYELLOW, setKeepTop, setShowSavedConditions, changeApplyExtraAxesLF]
  );


  const refreshProfiles = React.useCallback(async () => {
    try {
      const rows = await loadProfilesFromDb(200);
      setSavedProfiles(rows);
    } catch (e) {
      console.error(e);
      setSavedProfiles([]);
    }
  }, []);

  // Condition-identity objects (searchKey / baseKey).
  // base_34p: scout系・centerMode はフィールドごと省略（スプレッド構築の既存ルール踏襲、
  // LFキーはバイト不変）。placementMethod は base のみトップレベルに含める。
  const keyHard = React.useMemo(() => {
    return isBase
      ? {
          minSameColorDist: 3,
          outerSameColorMax,
          ...(maxConnectedPlanets > 0 ? { maxConnectedPlanets } : {}),
        }
      : {
          minSameColorDist: 3,
          outerSameColorMax,
          centerMode,
          ...(maxConnectedPlanets > 0 ? { maxConnectedPlanets } : {}),
          ...(maxConnectedPlanets > 0 && h5IncludeScouts ? { h5IncludeScouts: true } : {}),
        };
  }, [isBase, outerSameColorMax, centerMode, maxConnectedPlanets, h5IncludeScouts]);

  const keySoft = React.useMemo(() => {
    // ガイア近接・星系軸: base は常時、LF はオプトイン時のみキーに含める
    // （OFF のとき省略＝既存LFキーがバイト不変）。
    const extraAxes = extraAxesOn
      ? { wGaiaDist1: wGaiaD1, wGaiaDist2: wGaiaD2, wGaiaDist3: wGaiaD3, wClusterSize }
      : {};
    return isBase
      ? {
          wOuter,
          wTouch,
          wImbalance,
          imbalanceMetric,
          ...extraAxes,
          wColorPref,
          colorPrefByType: { BLACK: prefBLACK, BLUE: prefBLUE, BROWN: prefBROWN, ORANGE: prefORANGE, RED: prefRED, WHITE: prefWHITE, YELLOW: prefYELLOW },
        }
      : {
          wOuter,
          wTouch,
          wScout,
          wScoutCore,
          scoutRadius,
          wImbalance,
          imbalanceMetric,
          wScoutByScoutKey: { twilight: wScoutS1, eclipse: wScoutS2, rebellion: wScoutS3, tfmars: wScoutS4 },
          wScoutCoreByScoutKey: { twilight: wScoutCoreS1, eclipse: wScoutCoreS2, rebellion: wScoutCoreS3, tfmars: wScoutCoreS4 },
          scoutCoreAttributionMode: scoutCoreAttribBest ? "best" : "all",
          ...extraAxes,
          wColorPref,
          colorPrefByType: { BLACK: prefBLACK, BLUE: prefBLUE, BROWN: prefBROWN, ORANGE: prefORANGE, RED: prefRED, WHITE: prefWHITE, YELLOW: prefYELLOW },
        };
  }, [isBase, extraAxesOn, wOuter, wTouch, wScout, wScoutCore, wScoutS1, wScoutS2, wScoutS3, wScoutS4, wScoutCoreS1, wScoutCoreS2, wScoutCoreS3, wScoutCoreS4, scoutCoreAttribBest, scoutRadius, wImbalance, imbalanceMetric, wGaiaD1, wGaiaD2, wGaiaD3, wClusterSize, wColorPref, prefBLACK, prefBLUE, prefBROWN, prefORANGE, prefRED, prefWHITE, prefYELLOW]);

  const searchKeyParams = React.useMemo(() => {
    return {
      templateId,
      ...(isBase ? { placementMethod } : {}),
      algoVersion: SEARCH_ALGO_VERSION,
      evalVersion: EVAL_VERSION,
      // H5: only include maxConnectedPlanets when > 0, so the default (0=disabled)
      // produces a byte-identical stableStringify to the pre-H5 hard object
      // (keeps existing saved-result search keys stable).
      hard: keyHard,
      soft: keySoft,

      // Note: trials/TopK/seedStart are execution settings, not part of the condition key.
    };
  }, [templateId, isBase, placementMethod, keyHard, keySoft]);
  const baseKeyParams = React.useMemo(() => {
    // Same condition identity excluding version fields. TopK is intentionally excluded per spec.
    return {
      templateId,
      ...(isBase ? { placementMethod } : {}),
      hard: keyHard,
      soft: keySoft,
    };
  }, [templateId, isBase, placementMethod, keyHard, keySoft]);



  React.useEffect(() => {
    refreshProfiles();
  }, [refreshProfiles]);

  // Auto-apply saved condition on first load (if any exist).
  React.useEffect(() => {
    if (didAutoApplyRef.current) return;
    if (!savedProfiles || savedProfiles.length === 0) return;

    const pickLatest = (arr: PersistedProfile[]) =>
      (arr ?? [])
        .slice()
        .sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0))[0] ?? null;

    const withParams = (savedProfiles ?? []).filter((p) => !!p.params);

    let chosen: PersistedProfile | null = null;

    // 1) last applied
    try {
      const last = localStorage.getItem(LAST_APPLIED_SEARCHKEY);
      if (last) {
        chosen = withParams.find((p) => p.searchKey === last) ?? null;
      }
    } catch {}

    // 2) latest named among those with params
    if (!chosen) {
      const named = withParams.filter((p) => String(p.name ?? "").trim().length > 0);
      chosen = pickLatest(named);
    }

    // 3) latest remaining among those with params
    if (!chosen) {
      chosen = pickLatest(withParams);
    }

    if (!chosen) return;

    didAutoApplyRef.current = true;
    applySavedProfile(chosen, { closePanel: false });
  }, [savedProfiles, applySavedProfile]);


  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = stableStringify(searchKeyParams);
        const key = await sha256Hex(raw);
        const baseRaw = stableStringify(baseKeyParams);
        if (cancelled) return;
        setSearchKeyRaw(raw);
        setSearchKey(key);
        setBaseKeyRaw(baseRaw);
        try {
          const sameBase = await loadProfilesByBaseKeyRaw(baseRaw);
          const db = await openDb();
          const currentProfile = await idbGetByKey<PersistedProfile>(db, STORE_PROFILES, key);
          const copiedSet = new Set((currentProfile?.copiedFromKeys ?? []).map((k) => String(k)));
          const olds = (sameBase ?? []).filter(
            (p) =>
              String(p.searchKey) !== String(key) &&
              (p.algoVersion !== SEARCH_ALGO_VERSION || p.evalVersion !== EVAL_VERSION) &&
              !copiedSet.has(String(p.searchKey))
          );
          if (!cancelled) setOldVersionProfiles(olds);
        } catch (e) {
          console.error(e);
          if (!cancelled) setOldVersionProfiles([]);
        }
      } catch (e) {
        console.error(e);
        if (cancelled) return;
        setSearchKeyRaw(null);
        setSearchKey(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchKeyParams, baseKeyParams]);

  React.useEffect(() => {
    if (!searchKey) return;
    let cancelled = false;
    (async () => {
      try {
        // Reset view to active for a new condition key.
        setResultsMode("active");
        setSelectedPlacement(null);
        setSelectedSeedLabel(null);

        const loaded = await loadFromDb(searchKey, capacityActive);
        if (cancelled) return;

        setActivePersisted(loaded.active);
        setUsedPersisted(loaded.used);

        setActiveResults(loaded.active.map(toRankedResult));
        setUsedResults(loaded.used.map(toRankedResult));
await upsertProfileToDb(searchKey, {
  algoVersion: SEARCH_ALGO_VERSION,
  evalVersion: EVAL_VERSION,
  templateId,
  paramsRaw: searchKeyRaw,
  params: searchKeyParams as any,
  activeCount: loaded.active.length,
  usedCount: loaded.used.length,
  lastTopK: keepTop,
  updatedAt: Date.now(),
});
refreshProfiles();
      } catch (e) {
        console.error(e);
        if (cancelled) return;
        setActivePersisted([]);
        setUsedPersisted([]);
        setActiveResults([]);
        setUsedResults([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchKey, capacityActive, templateId, searchKeyRaw, keepTop, searchKeyParams, refreshProfiles]);

  // build sector lookup (MapBoardViewer / previewBoard use)
  const allSectors = React.useMemo<any[]>(() => getAllSectors(), []);

  const sectorById = React.useMemo(() => buildSectorLookup(allSectors as any), [allSectors]);
  const sectorImgById = React.useMemo(() => buildSectorImgById(), []);

  /**
   * placementBase: SSOT（表示用は必ずこれ）
   * - Ranking selection => selectedPlacement (evaluated placement)
   * - Otherwise (manual seed preview) => makeSearchPlacementFromSeed(templateId, seed)
   */
  const placementBaseResult = React.useMemo(() => {
    try {
      if (selectedPlacement && Array.isArray(selectedPlacement) && selectedPlacement.length > 0) {
        return { ok: true as const, placement: selectedPlacement as any[] };
      }
      const made = makeSearchPlacementFromSeed({
        templateId,
        seed,
        ...(isBase ? { placementMethod } : {}),
      });
      return { ok: true as const, placement: made.placement as any[] };
    } catch (e: any) {
      return { ok: false as const, message: e?.message ? String(e.message) : String(e) };
    }
  }, [selectedPlacement, templateId, seed, isBase, placementMethod]);

  React.useEffect(() => {
    if (!placementBaseResult.ok) setErrorMsg(placementBaseResult.message);
    else setErrorMsg(null);
  }, [placementBaseResult]);

  const placementBase = React.useMemo(() => (placementOverride ?? (placementBaseResult.ok ? placementBaseResult.placement : [])), [placementBaseResult, placementOverride]);

  const currentHash = React.useMemo(() => {
    try {
      return computePlacementHash(placementBase as any);
    } catch {
      return "-";
    }
  }, [placementBase]);

  const currentToken = React.useMemo(() => {
    try {
      return encodePlacementToken(placementBase as any);
    } catch {
      return currentHash;
    }
  }, [placementBase, currentHash]);

  // Build the long, shareable link on demand (attaches the placement token as
  // ?h=), copy it to the clipboard, and reveal it so it can also be copied
  // manually. Normal browsing never writes this token to the URL.
  const handleShareUrl = React.useCallback(() => {
    try {
      const token = String(currentToken ?? "").trim();
      const url = new URL(window.location.href);
      if (token) url.searchParams.set("h", token);
      else url.searchParams.delete("h");
      const s = url.toString();
      setShareUrl(s);
      setShareCopied(true);
      copyText(s);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [currentToken]);

  // Keep Hash input in sync with the currently displayed placement token,
  // unless the user is actively editing the field.
  React.useEffect(() => {
    const token = String(currentToken ?? "").trim();
    if (!token) return;

    const prev = prevTokenRef.current;
    const isEditing = document.activeElement === hashInputRef.current;

    // If the user hasn't typed anything yet, or the field was previously showing the prior token,
    // sync it to the new token.
    if (!isEditing && (hashIo.trim() === "" || hashIo.trim() === prev)) {
      setHashIo(token);
    }

    prevTokenRef.current = token;
  }, [currentToken, hashIo]);

  const placementForViewer = React.useMemo(
    () => placementBase.map((p) => ({ ...p })) as any as ViewerPlacementItem[],
    [placementBase]
  );

  // UI: offsets (確定済み) — @/gaia/board/viewerAssets へ抽出済み
  const imgOffsetBySlotId = IMG_OFFSET_BY_SLOT;
  const rotOffsetsBySlotId = ROT_OFFSETS_BY_SLOT;

  
const allResults = React.useMemo(() => {
  return [...activeResults, ...usedResults];
}, [activeResults, usedResults]);

// current result (Logical SSOT) for shown seed
const matchedResult = React.useMemo(() => {
  const target = String(selectedSeedLabel ?? seed ?? "");
  if (!target) return null;
  return allResults.find((r) => String((r as any).seed) === target) ?? null;
}, [allResults, seed, selectedSeedLabel]);

// When a board is shown without a matching evaluated result — notably a shared
// ?h= link, which restores only the placement (the image) and has no Top-K
// entry — evaluate the placement on the fly so the summary and the color
// breakdown table populate too. Uses the viewer's current hard/soft params
// (weighted axes therefore reflect the viewer's settings, not the sender's).
const derivedResult = React.useMemo(() => {
  if (matchedResult) return null; // an authoritative evaluated result exists
  // Only for a board restored from a token/hash (shared ?h= link). Normal
  // browsing keeps its "no current result until you select one" behavior.
  if (!placementOverride) return null;
  if (!Array.isArray(placementBase) || placementBase.length === 0) return null;
  try {
    const lm = buildLogicalMapFromPlacement({ templateId, placement: placementBase as any });
    const extracted = extractForEval(lm as any, searchKeyParams.hard as any);
    const evaluation = evaluateSoft(extracted, searchKeyParams.soft as any);
    return {
      seed: String(selectedSeedLabel ?? seed ?? ""),
      score: evaluation.score,
      placement: placementBase,
      placementHash: currentHash,
      evaluation: { breakdown: evaluation.breakdown },
    } as any;
  } catch {
    return null;
  }
}, [matchedResult, placementOverride, placementBase, templateId, searchKeyParams, currentHash, selectedSeedLabel, seed]);

const currentResult = matchedResult ?? derivedResult;


// 表示用の「直近に表示した結果」を保持する。検索条件（soft重みなど）を変えると
// searchKey が変わり結果バケットが空に載せ替わって currentResult が null になり、
// 「表示Map詳細」の色別内訳テーブルが消えてパネルが縮む（＝下の評価指数がズレる）。
// これを防ぐため、null のときは直近結果を表示にフォールバックする（次の検索や
// テンプレ切替で更新／クリア）。ユーザー要望 2026-07-24。
const lastShownResultRef = React.useRef<RankedResult | null>(null);
React.useEffect(() => {
  if (currentResult) lastShownResultRef.current = currentResult as RankedResult;
}, [currentResult]);
const displayResult = currentResult ?? lastShownResultRef.current;

/**
 * 表示用の breakdown。保存済みの検索結果は「検索したときの監査データ」を
 * そのまま持っているので、あとから増えたマーカー用の座標付きヒット
 * （ガイア/星系/船別）を持っていない。数値は保存されているので表には出るのに
 * マーカーだけ出ない、という状態になる（2026-07-30 報告）。
 * 足りないときだけ、表示中の盤面から評価をやり直して監査データを作り直す。
 * スコアやランキングには触れない（表示用の breakdown だけを差し替える）。
 */
const displayBreakdown = React.useMemo(() => {
  const b: any = getBreakdown(displayResult);
  if (!b) return null;
  const a = b.audit ?? {};
  const needsGaia = !!b.axesByType?.gaia && !a.gaiaProximity?.gaiaHits;
  const needsCluster = !!b.axesByType?.cluster && !a.cluster?.clusterHits;
  const needsShipId =
    (a.scout?.scoutHits?.length ?? 0) > 0 && a.scout.scoutHits[0]?.scoutId === undefined;
  const needsCoreShip =
    (a.scoutCore?.coreHits?.length ?? 0) > 0 && a.scoutCore.coreHits[0]?.scoutId === undefined;
  if (!needsGaia && !needsCluster && !needsShipId && !needsCoreShip) return b;
  const placement = (displayResult as any)?.placement ?? placementBase;
  if (!Array.isArray(placement) || placement.length === 0) return b;
  try {
    const lm = buildLogicalMapFromPlacement({ templateId, placement: placement as any });
    const extracted = extractForEval(lm as any, searchKeyParams.hard as any);
    return evaluateSoft(extracted, searchKeyParams.soft as any).breakdown;
  } catch {
    return b;
  }
}, [displayResult, placementBase, templateId, searchKeyParams]);

// #9 マーカー連動: 詳細表クリックで選んだ (軸,色) ソースごとにマーカー配列を保持。
// 単一選択（再クリック解除）＋Ctrlで複数トグル。表示中の盤面が変わったらクリア。
const [markSources, setMarkSources] = React.useState<Map<string, BreakdownMarker[]>>(new Map());
const onMark = React.useCallback(
  (sourceId: string, markers: BreakdownMarker[], additive: boolean) => {
    setMarkSources((prev) => {
      if (additive) {
        const next = new Map(prev);
        if (next.has(sourceId)) next.delete(sourceId);
        else next.set(sourceId, markers);
        return next;
      }
      // 通常クリック: 単独選択中の同ソース再クリックは解除、それ以外は置換。
      if (prev.has(sourceId) && prev.size === 1) return new Map();
      const single = new Map<string, BreakdownMarker[]>();
      single.set(sourceId, markers);
      return single;
    });
  },
  []
);
const activeSources = React.useMemo(() => new Set(markSources.keys()), [markSources]);

/**
 * 評価指数のセル（ラベル＋入力欄のかたまり）をクリック可能にする（2026-07-30 要望）。
 * 詳細表の列ヘッダ ◎ と同じ sourceId を使うので、どちらから押しても同じ枠が光る。
 * 数値を編集したいときに邪魔をしないよう、input 上のクリックは無視する。
 */
const evalCellMark = React.useCallback(
  (
    sourceId: string,
    axis: MarkAxis,
    opts?: { gaiaDistance?: number; scoutId?: string },
    extraTip?: string
  ): React.HTMLAttributes<HTMLLabelElement> => ({
    onClick: (e) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.closest("input"))) return;
      const audit = (displayBreakdown as any)?.audit ?? null;
      if (!audit) return;
      onMark(sourceId, axisMarkers(audit, axis, null, lang, opts), e.ctrlKey || e.metaKey);
    },
    title:
      (extraTip ? `${extraTip}\n` : "") +
      (lang === "ja"
        ? "クリックでこの指数が効いている惑星を地図にマーク（Ctrlで複数選択）"
        : "Click to mark the planets this weight applies to (Ctrl = multi-select)"),
    style: {
      cursor: "pointer",
      boxShadow: activeSources.has(sourceId) ? "inset 0 0 0 2px #2b7fe0" : undefined,
    },
  }),
  [displayResult, lang, onMark, activeSources]
);

/** EVAL_CELL のスタイルと合成して label へ渡すためのヘルパ。 */
const evalCellProps = React.useCallback(
  (
    sourceId: string,
    axis: MarkAxis,
    opts?: { gaiaDistance?: number; scoutId?: string },
    extraTip?: string
  ) => {
    const p = evalCellMark(sourceId, axis, opts, extraTip);
    return { ...p, style: { ...EVAL_CELL, ...(p.style ?? {}) } };
  },
  [evalCellMark]
);
/**
 * 評価/audit のセル座標（論理マップのフレーム）→ 描画のセル座標（テンプレートの
 * フレーム）の対応表。
 *
 * この2つは別フレームで、スロットごとに向きが反転している（テンプレの slot.pos と
 * SLOT_CENTERS_* が独立に採寸されているため。実測: base_34p は全スロットで
 * slot.pos + logicalCenter = (19,14) の一定値だが、LFテンプレでは 17/18/19 と
 * スロットごとにばらつくので単一の回転では表せない）。
 * そのため audit のキーをそのまま描画座標に使うとマーカーが大きくズレる
 * （2026-07-30 報告）。スロットごとに中心セル（localKey "0,0"）を基準にして
 *   templateCell = templateSlotPos - (logicalCell - logicalCenter)
 * で変換する。全テンプレ・全セルで中心セルが存在し、変換後は必ず自スロット中心の
 * 半径2以内に収まることを確認済み。
 */
const cellKeyToTile = React.useMemo(() => {
  const m = new Map<string, { slotId: string; localKey: string }>();
  try {
    const lm: any = buildLogicalMapFromPlacement({
      templateId,
      placement: placementForViewer as any,
    });
    for (const c of lm.cellsByKey.values()) {
      m.set(`${c.pos.q},${c.pos.r}`, { slotId: c.slotId, localKey: c.localKey });
    }
  } catch {
    // 取れないときは素通し（viewer 側がタイル単位のマーカーにフォールバックする）
  }
  return m;
}, [templateId, placementForViewer]);

/**
 * マーカー配列。(セル, 色) で必ず重複を潰す。
 *
 * 潰さないと同じセルに同じリングが何枚も重なる（中央の惑星は船接触・船星系・
 * ガイア・星系の複数軸に同時に該当するため、実測で1セルに最大12枚）。
 * 重なると点滅（opacity .32）が合成で打ち消され、外周だけ点滅して中央は
 * 点きっぱなしに見える（2026-07-30 報告の原因）。ラベルは束ねて全部出す。
 */
const markers = React.useMemo(() => {
  const byCellColor = new Map<string, BreakdownMarker & { slotId?: string; localKey?: string }>();
  for (const m of [...markSources.values()].flat()) {
    const id = `${m.key}|${m.color}`;
    const prev = byCellColor.get(id);
    if (prev) {
      const label = String(m.label ?? "");
      if (label && !String(prev.label ?? "").split("\n").includes(label)) {
        prev.label = prev.label ? `${prev.label}\n${label}` : label;
      }
      continue;
    }
    const t = cellKeyToTile.get(m.key);
    byCellColor.set(id, t ? { ...m, slotId: t.slotId, localKey: t.localKey } : { ...m });
  }
  return [...byCellColor.values()];
}, [markSources, cellKeyToTile]);
const markHashRef = React.useRef<string>("");
const curMarkHash = getPlacementHashForResult(displayResult);
React.useEffect(() => {
  if (markHashRef.current !== curMarkHash) {
    markHashRef.current = curMarkHash;
    setMarkSources((prev) => (prev.size ? new Map() : prev));
  }
}, [curMarkHash]);

//  function sumCounts(obj: any): number {
//    if (!obj || typeof obj !== "object") return 0;
//    return Object.values(obj).reduce((a: number, x: any) => a + (Number(x) || 0), 0);
//  }

//  function getBreakdown(r: RankedResult | null) {
//    return (r?.evaluation?.breakdown ?? r?.evaluation ?? null) as any;
//  }

  function getPlacementHashForResult(r: RankedResult | null) {
    const b = getBreakdown(r);
    return String(r?.placementHash ?? b?.placementHash ?? b?.audit?.placementHash ?? "-");
  }

  function getImbalanceSummary(r: RankedResult | null) {
    const b = getBreakdown(r);
    const metric = b?.imbalance?.metric ?? "-";
    const value = Number(b?.imbalance?.value ?? 0);
    return { metric, value };
  }

  function getOuterTouchCounts(r: RankedResult | null) {
    const b = getBreakdown(r);
    const outerBy = b?.audit?.outerCountByType ?? null;
    const touchBy = b?.audit?.touchCountByType ?? null;
    return {
      outerBy,
      touchBy,
      outerSum: sumCounts(outerBy),
      touchSum: sumCounts(touchBy),
    };
  }

  function getScoutSummary(r: RankedResult | null) {
    const b = getBreakdown(r);
    const scoutAudit = b?.audit?.scout ?? null;

    const radius = Number(scoutAudit?.radius ?? NaN);
    const distanceHistogram = scoutAudit?.distanceHistogram ?? null;
    const scoutPlanetCount = Number(scoutAudit?.scoutPlanetCount ?? 0) || 0;
    const extraByKind = scoutAudit?.extraByKind ?? null;
    
    const scoutAxis = b?.axesByType?.scout ?? scoutAudit?.byType ?? null;
    const scoutTotal = sumCounts(scoutAxis);

    return {
      radius: Number.isFinite(radius) ? radius : null,
      scoutTotal,
      distanceHistogram,
      scoutPlanetCount,
      extraByKind,
    };
  }


async function handleToggleContinuous() {
  if (continuousMode) {
    // Stop after the current search finishes (runLogicalSearch is not abortable here).
    stopContinuousRef.current = true;
    setContinuousMode(false);
    return;
  }

  stopContinuousRef.current = false;
  setContinuousMode(true);

  try {
    while (!stopContinuousRef.current) {
      await handleGenerateRank();
      await nextFrame();
    }
  } finally {
    stopContinuousRef.current = false;
    setContinuousMode(false);
  }
}


async function handleGenerateRank() {
    if (busy) return;

    setErrorMsg(null);
    setBusy(true);

    // keep current persisted lists while searching
    setProgressCurrent(0);
    setProgressBest(null);
    setHardFailBy({});

    await nextFrame();

    const seedStart = seedMode === "fixed" ? parseSeedStart(seed) : makeRandomSeedStart();

    // Same searchOptions shape/values as the previous direct runLogicalSearch(...)
    // call: trials/keepTop/seedStart/yieldEvery/hard/soft are unchanged, so a
    // given seedStart + params always produces the same results whether this
    // runs in the worker or (via fallback) on the main thread.
    const searchOptions = {
      trials,
      keepTop: capacityActive,
      seedStart,
      yieldEvery: 50,
      // base_34p: 配置方法を渡す（LFでは省略）。H4/H5探査船は base では常に無効
      // （キー上はフィールド省略、実行時は明示的に NONE/false を渡す）。
      ...(isBase ? { placementMethod } : {}),
      hard: {
        minSameColorDist: 3,
        outerSameColorMax,
        centerMode: isBase ? ("NONE" as const) : centerMode,
        ...(maxConnectedPlanets > 0 ? { maxConnectedPlanets } : {}),
        ...(maxConnectedPlanets > 0 && h5IncludeScouts && !isBase ? { h5IncludeScouts: true } : {}),
      },
      soft: {
        wOuter,
        wTouch,
        wScout,
        wScoutCore,
        scoutRadius,
        wImbalance,
        imbalanceMetric,
        wScoutByScoutKey: { twilight: wScoutS1, eclipse: wScoutS2, rebellion: wScoutS3, tfmars: wScoutS4 },
        wScoutCoreByScoutKey: { twilight: wScoutCoreS1, eclipse: wScoutCoreS2, rebellion: wScoutCoreS3, tfmars: wScoutCoreS4 },
        scoutCoreAttributionMode: scoutCoreAttribBest ? "best" : "all",
        wColorPref,
        colorPrefByType: { BLACK: prefBLACK, BLUE: prefBLUE, BROWN: prefBROWN, ORANGE: prefORANGE, RED: prefRED, WHITE: prefWHITE, YELLOW: prefYELLOW },
        // ガイア近接・星系軸: base は常時、LF はオプトイン時のみ（キーと一致）。
        // OFF の LF ではフィールド省略＝evaluateSoft が完全スキップ（既存挙動不変）。
        ...(extraAxesOn
          ? { wGaiaDist1: wGaiaD1, wGaiaDist2: wGaiaD2, wGaiaDist3: wGaiaD3, wClusterSize }
          : {}),
      },
    };

    try {
      const { results: best, diagnostics } = await runSearchOffThread(templateId, searchOptions, (done, bestScore) => {
        setProgressCurrent(done);
        // keep previous lists during searching; progress-only update
        setProgressBest(bestScore);
      });

      const mappedFinal: RankedResult[] = (best as any[]).map((x: any) => ({
        seed: String(x.seed),
        score: Number(x.score ?? 0),
        placement: (x as any).placement ?? [],
        placementHash: (x as any).placementHash,
        evaluation: { total: Number(x.score ?? 0), breakdown: x.breakdown, audit: x.audit },
      }));

{
  const now = Date.now();
  const key = searchKey ?? (await sha256Hex(stableStringify(searchKeyParams)));

  const incoming: PersistedCandidate[] = mappedFinal.map((r) => {
    const placementHash = String((r as any).placementHash ?? computePlacementHash((r as any).placement ?? []));
    return {
      id: `${key}:${placementHash}`,
      searchKey: key,
      placementHash,
      seed: String((r as any).seed),
      score: Number((r as any).score ?? 0),
      rankValue: -Number((r as any).score ?? 0),
      placement: (r as any).placement ?? [],
      evaluation: (r as any).evaluation ?? null,
      used: false,
      usedKey: 0,
      createdAt: now,
      updatedAt: now,
    };
  });

  const merged = mergeCandidates(key, activePersistedRef.current, usedPersistedRef.current, incoming, capacityActive);
  await saveMergeToDb(key, merged);
  await upsertProfileToDb(key, {
    baseKeyRaw: stableStringify(baseKeyParams),
    algoVersion: SEARCH_ALGO_VERSION,
    evalVersion: EVAL_VERSION,
    templateId,
    paramsRaw: stableStringify(searchKeyParams),
    params: searchKeyParams as any,
    activeCount: merged.active.length,
    usedCount: merged.used.length,
    lastTopK: keepTop,
    updatedAt: Date.now(),
  });
  refreshProfiles();

  // Running a search counts as "using" this condition: make it the profile
  // restored on next launch (auto-apply reads LAST_APPLIED_SEARCHKEY first).
  try {
    localStorage.setItem(LAST_APPLIED_SEARCHKEY, String(key));
  } catch {}

  setSearchKey(key);
  setSearchKeyRaw(stableStringify(searchKeyParams));

  setActivePersisted(merged.active);
  setUsedPersisted(merged.used);

  // Keep refs in sync for continuous mode (avoid stale-closure merges).
  activePersistedRef.current = merged.active;
  usedPersistedRef.current = merged.used;

  setActiveResults(merged.active.map(toRankedResult));
  setUsedResults(merged.used.map(toRankedResult));
  setResultsMode("active");

  if (merged.active.length > 0) {
    const top = merged.active[0];
    setSelectedPlacement(top.placement ?? null);
    setSelectedSeedLabel(String(top.seed));
    setSeed(String(top.seed));
  }
}

      if ((diagnostics as any)?.hardFailBy) setHardFailBy((diagnostics as any).hardFailBy);

      setProgressCurrent(trials);
      setProgressBest(mappedFinal.length > 0 ? mappedFinal[0].score : null);

      if (mappedFinal.length > 0) {
        setSelectedPlacement(mappedFinal[0].placement ?? null);
        setSelectedSeedLabel(String(mappedFinal[0].seed));
        setSeed(String(mappedFinal[0].seed));
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message ? String(e.message) : String(e));
    } finally {
      setBusy(false);
    }
  }

  const handleCopyFromOldVersion = React.useCallback(
    async (fromSearchKey: string) => {
      const key = searchKey;
      if (!key || !fromSearchKey) return;
      if (!confirm(t("confirmCopy"))) return;
      try {
        const now = Date.now();
        const db = await openDb();

        // Load all candidates for from/to searchKey (no capacity trimming here).
        const fromAll = await idbGetAllByIndex<PersistedCandidate>(db, STORE_CANDIDATES, "bySearchKey", IDBKeyRange.only(fromSearchKey));
        const toAll = await idbGetAllByIndex<PersistedCandidate>(db, STORE_CANDIDATES, "bySearchKey", IDBKeyRange.only(key));

        const fromActive = (fromAll ?? []).filter((c) => !c.used && Number(c.usedKey ?? 0) === 0);
        const fromUsed = (fromAll ?? []).filter((c) => !!c.used || Number(c.usedKey ?? 0) === 1);

        const toActive = (toAll ?? []).filter((c) => !c.used && Number(c.usedKey ?? 0) === 0);
        const toUsed = (toAll ?? []).filter((c) => !!c.used || Number(c.usedKey ?? 0) === 1);

        const incoming = [...fromActive, ...fromUsed].map((c) => ({
          ...c,
          id: `${key}:${c.placementHash}`,
          searchKey: key,
          updatedAt: now,
        }));

        const merged = mergeCandidates(key, toActive, toUsed, incoming, capacityActive);
        await saveMergeToDb(key, merged);

        // Record that candidates from `fromSearchKey` have been merged into `key`,
        // so the "old data available" banner stops offering this pair again
        // (even after a reload) while leaving the old profile/candidates intact.
        const prevProfile = await idbGetByKey<PersistedProfile>(db, STORE_PROFILES, key);
        const nextCopiedFromKeys = Array.from(
          new Set([...((prevProfile?.copiedFromKeys ?? []) as string[]).map((k) => String(k)), String(fromSearchKey)])
        );

        await upsertProfileToDb(key, {
          baseKeyRaw: stableStringify(baseKeyParams),
          algoVersion: SEARCH_ALGO_VERSION,
          evalVersion: EVAL_VERSION,
          templateId,
          paramsRaw: stableStringify(searchKeyParams),
          params: searchKeyParams as any,
          activeCount: merged.active.length,
          usedCount: merged.used.length,
          lastTopK: keepTop,
          updatedAt: now,
          copiedFromKeys: nextCopiedFromKeys,
        });

        refreshProfiles();

        // Hide the just-copied source from the banner immediately; any other
        // not-yet-copied old-version profiles remain visible.
        setOldVersionProfiles((prev) => prev.filter((p) => String(p.searchKey) !== String(fromSearchKey)));

        setActivePersisted(merged.active);
        setUsedPersisted(merged.used);
        setActiveResults(merged.active.map(toRankedResult));
        setUsedResults(merged.used.map(toRankedResult));

        // Keep selection stable; do not force switch tabs.
      } catch (e) {
        console.error(e);
        alert(String((e as any)?.message ?? e));
      }
    },
    [searchKey, capacityActive, baseKeyParams, templateId, searchKeyParams, keepTop, refreshProfiles, t]
  );

const viewList = React.useMemo(() => {
  return resultsMode === "active" ? activeResults.slice(0, keepTop) : usedResults;
}, [resultsMode, activeResults, usedResults, keepTop]);

const savedActiveCount = activePersisted.length;
const savedUsedCount = usedPersisted.length;

const handleMarkUsed = React.useCallback(
  async (placementHash: string) => {
    if (!searchKey) return;
    const now = Date.now();

    const act = activePersisted.slice();
    const usd = usedPersisted.slice();

    const idx = act.findIndex((c) => c.placementHash === placementHash);
    if (idx < 0) return;

    const moved: PersistedCandidate = { ...act[idx], used: true, usedKey: 1, usedAt: now, updatedAt: now };
    act.splice(idx, 1);
    usd.push(moved);

    const merged = mergeCandidates(searchKey, act, usd, [], capacityActive);
    await saveMergeToDb(searchKey, merged);
    await upsertProfileToDb(searchKey, {
      templateId,
      paramsRaw: searchKeyRaw,
      params: searchKeyParams as any,
      activeCount: merged.active.length,
      usedCount: merged.used.length,
      lastTopK: keepTop,
      updatedAt: Date.now(),
    });
    refreshProfiles();

    setActivePersisted(merged.active);
    setUsedPersisted(merged.used);
    setActiveResults(merged.active.map(toRankedResult));
    setUsedResults(merged.used.map(toRankedResult));

    // If the currently selected item became used, keep selection (it still exists),
    // but switch to Used view so it is visible.
    if (selectedSeedLabel && String(selectedSeedLabel) === String(moved.seed)) {
      setResultsMode("used");
    }
  },
  [searchKey, activePersisted, usedPersisted, capacityActive, selectedSeedLabel, templateId, searchKeyRaw, searchKeyParams, keepTop, refreshProfiles]
);

// ピン留めトグル（一覧タブ用、TODO ③）。バケット移動はせずフラグのみ更新。
// ピン留め中の active 行は容量剪定から保護される（persistence 側）。
const handleTogglePin = React.useCallback(
  async (placementHash: string) => {
    if (!searchKey) return;
    const now = Date.now();

    const act = activePersisted.slice();
    const usd = usedPersisted.slice();

    const flip = (arr: PersistedCandidate[]): boolean => {
      const idx = arr.findIndex((c) => c.placementHash === placementHash);
      if (idx < 0) return false;
      const next = !arr[idx].pinned;
      arr[idx] = {
        ...arr[idx],
        pinned: next,
        ...(next ? { pinnedAt: now } : { pinnedAt: undefined }),
        updatedAt: now,
      };
      return true;
    };
    if (!flip(act) && !flip(usd)) return;

    const merged = mergeCandidates(searchKey, act, usd, [], capacityActive);
    await saveMergeToDb(searchKey, merged);

    setActivePersisted(merged.active);
    setUsedPersisted(merged.used);
    setActiveResults(merged.active.map(toRankedResult));
    setUsedResults(merged.used.map(toRankedResult));
  },
  [searchKey, activePersisted, usedPersisted, capacityActive]
);

const pinnedHashes = React.useMemo(() => {
  const set = new Set<string>();
  for (const c of activePersisted) if (c.pinned) set.add(c.placementHash);
  for (const c of usedPersisted) if (c.pinned) set.add(c.placementHash);
  return set;
}, [activePersisted, usedPersisted]);

const handleRestore = React.useCallback(
  async (placementHash: string) => {
    if (!searchKey) return;
    const now = Date.now();

    const act = activePersisted.slice();
    const usd = usedPersisted.slice();

    const idx = usd.findIndex((c) => c.placementHash === placementHash);
    if (idx < 0) return;

    const moved: PersistedCandidate = { ...usd[idx], used: false, usedKey: 0, usedAt: undefined, updatedAt: now };
    usd.splice(idx, 1);
    act.push(moved);

    const merged = mergeCandidates(searchKey, act, usd, [], capacityActive);
    await saveMergeToDb(searchKey, merged);
    await upsertProfileToDb(searchKey, {
      templateId,
      paramsRaw: searchKeyRaw,
      params: searchKeyParams as any,
      activeCount: merged.active.length,
      usedCount: merged.used.length,
      lastTopK: keepTop,
      updatedAt: Date.now(),
    });
    refreshProfiles();

    setActivePersisted(merged.active);
    setUsedPersisted(merged.used);
    setActiveResults(merged.active.map(toRankedResult));
    setUsedResults(merged.used.map(toRankedResult));
    setResultsMode("active");
  },
  [searchKey, activePersisted, usedPersisted, capacityActive, templateId, searchKeyRaw, searchKeyParams, keepTop, refreshProfiles]
);

const handleDeleteUsed = React.useCallback(
  async (placementHash: string) => {
    if (!searchKey) return;

    const idx = usedPersisted.findIndex((c) => c.placementHash === placementHash);
    if (idx < 0) return;

    const id = usedPersisted[idx].id;

    const nextUsed = usedPersisted.slice();
    nextUsed.splice(idx, 1);

    const db = await openDb();
    await idbDeleteByIds(db, STORE_CANDIDATES, [id]);

    await upsertProfileToDb(searchKey, {
      templateId,
      paramsRaw: searchKeyRaw,
      params: searchKeyParams as any,
      activeCount: activePersisted.length,
      usedCount: nextUsed.length,
      lastTopK: keepTop,
      updatedAt: Date.now(),
    });
    refreshProfiles();

    setUsedPersisted(nextUsed);
    setUsedResults(nextUsed.map(toRankedResult));
  },
  [searchKey, usedPersisted, activePersisted, templateId, searchKeyRaw, searchKeyParams, keepTop, refreshProfiles]
);


  const curHashFromResult = getPlacementHashForResult(displayResult);
  const curImb = getImbalanceSummary(displayResult);
  const curOT = getOuterTouchCounts(displayResult);
  const curScout = getScoutSummary(displayResult);
  const curScoutCore = getScoutCoreSummary(displayResult);

  // 用語集（英→日＋意味）
  // 用語集データは各ラベルの Hint ツールチップ（uiText の tip* キー）へ移行済み。

  // Mobile: show Top-K early; PC order remains unchanged.
  // 現在マップに表示中の結果のハッシュ（ランキング側に「表示中」バッジを出すため）。
  const showingHash = getPlacementHashForResult(displayResult) ?? "";
  const topKSection = (
  <div style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8, overflow: isNarrow ? "visible" : "auto", flex: isNarrow ? "0 0 auto" : 1, minHeight: isNarrow ? "auto" : 0 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
    <div style={{ fontWeight: 700 }}>{t("topKLogical")}</div>
  
    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, opacity: 0.75 }}>
        {t("saved")}: {savedActiveCount} / {savedUsedCount}
      </span>
  
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
        <input type="radio" checked={resultsMode === "active"} onChange={() => setResultsMode("active")} />
        <Hint label={t("resultsModeActive")} tip={t("tipResultsActive")} />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
        <input type="radio" checked={resultsMode === "used"} onChange={() => setResultsMode("used")} />
        <Hint label={t("resultsModeUsed")} tip={t("tipResultsUsed")} />
      </label>
    </div>
  </div>
  
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {busy ? (
        <div style={{ fontSize: 12, opacity: 0.7 }}>{t("searching")}</div>
      ) : null}
      {viewList.map((r, idx) => {
          const b = getBreakdown(r);
          const hashFull = getPlacementHashForResult(r) ?? "";
          const hash = hashFull ? String(hashFull).slice(0, 12) : "-";
          const isShowing = !!showingHash && String(hashFull) === String(showingHash);
  
          // 生スコアをそのまま表示（旧: 1000+rawScore の RankScore 表示。
          // 表示のみの変更でソート順・保存データは不変。ユーザー確定 2026-07-23）
          const rawScore = Number((r as any)?.score ?? 0);
  
          const totals = b?.planetTypeTotals ?? null;
  
          const items = PLANET_ORDER
            .map((k) => ({
              k,
              label: lang === "ja" ? PLANET_LABEL_JA[k] : k,
              v: Number((totals as any)?.[k] ?? 0),
            }))
            .sort((a, b) => b.v - a.v);
  
          const planetLine = items.map((it) => `${it.label}${it.v}`).join(" ");
  
          return (
            <div
              key={`${(r as any)?.seed ?? "seed"}-${idx}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  // Select this result
                  setPlacementOverride(null);
                  setErrorMsg(null);
                  setSelectedPlacement(
    Array.isArray((r as any)?.placement)
      ? ((r as any).placement as any[]).map((p: any) => ({ ...p }))
      : null
  );
                  const s = String((r as any)?.seed ?? "0");
                  setSelectedSeedLabel(s);
                  setSeed(s);
                }
              }}
              onClick={() => {
                // Select this result for both the board view and the "Current Logical Summary".
                setPlacementOverride(null);
                setErrorMsg(null);
                setSelectedPlacement(
    Array.isArray((r as any)?.placement)
      ? ((r as any).placement as any[]).map((p: any) => ({ ...p }))
      : null
  );
                const s = String((r as any)?.seed ?? "0");
                setSelectedSeedLabel(s);
                setSeed(s);
              }}
              style={{
                textAlign: "left",
                padding: "8px 10px",
                border: isShowing ? "2px solid #4a90d9" : "1px solid #e5e5e5",
                borderRadius: 8,
                background: isShowing ? "#eef6ff" : "white",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800, fontSize: 12 }}>
                  {pinnedHashes.has(String(hashFull)) ? "📌" : null}
                  {idx + 1}.
                </span>
                <span style={{ fontSize: 12 }}>
                  <span style={{ opacity: 0.7 }}>{t("rankScore")}:</span> {fmt0(rawScore)}
                </span>
                <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
                  {hash}
                </span>

                <span style={{ marginLeft: "auto" }} />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePin(String(hashFull));
                  }}
                  title={t("tipPin")}
                  style={{ padding: "2px 8px", fontSize: 12, border: "1px solid #ccc", borderRadius: 6, background: "white" }}
                >
                  {pinnedHashes.has(String(hashFull)) ? t("unpin") : t("pin")}
                </button>
                {resultsMode === "active" ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkUsed(String(hashFull));
                    }}
                    title={t("tipMarkUsed")}
                    style={{ padding: "2px 8px", fontSize: 12, border: "1px solid #ccc", borderRadius: 6, background: "white" }}
                  >
                    {t("markUsed")}
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestore(String(hashFull));
                      }}
                      style={{ padding: "2px 8px", fontSize: 12, border: "1px solid #ccc", borderRadius: 6, background: "white" }}
                    >
                      {t("restore")}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteUsed(String(hashFull));
                      }}
                      style={{ padding: "2px 8px", fontSize: 12, border: "1px solid #f0b", borderRadius: 6, background: "white" }}
                    >
                      {t("delete")}
                    </button>
                  </div>
                )}
                {isShowing ? (
                  <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, color: "#fff", background: "#4a90d9", borderRadius: 4, padding: "1px 6px" }}>
                    {t("showing")}
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: 12, marginTop: 2, opacity: 0.9 }}>{planetLine}</div>
            </div>
          );
        })}              </div>
  </div>
  );

  return (
    <>
    <style jsx global>{`
      /* PC: hide scrollbars but keep scroll (mouse wheel / trackpad) */
      @media (hover: hover) and (pointer: fine) {
        .pc-hide-scrollbar {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge Legacy */
        }
        .pc-hide-scrollbar::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none; /* Chrome/Safari */
        }
      }
    `}</style>

    <div style={{ width: "100%", height: isNarrow ? "auto" : "100dvh", display: "flex", flexDirection: "column", overflow: isNarrow ? "visible" : "hidden", minHeight: isNarrow ? "100dvh" : 0 }}>
      {/* 共通バー（タブ・人数・拡張・言語を全タブ共通の固定位置に） */}
      <GlobalBar
        active="map"
        players={players}
        expansion={expansion}
        onSelect={applySharedSelection}
        lang={lang}
        onLang={setLang}
      />

      {/* --- header --- */}
      <div style={{ padding: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700 }}>{t("title")}</div>

        {/* 人数/拡張は共通バー（GlobalBar）へ移動。配置方法は表示設定行の右端。 */}

        <button onClick={handleGenerateRank} disabled={busy || !mapSupported} style={{ padding: "6px 10px", fontWeight: 700 }}>
          {busy ? t("searching") : t("runSearch")}
        </button>

        <button
          onClick={handleToggleContinuous}
          disabled={(busy && !continuousMode) || !mapSupported}
          title={t("tipContinuous")}
          style={{ padding: "6px 10px", fontWeight: 700 }}
        >
          {continuousMode ? t("stopSearch") : t("continuous")}
        </button>

          <button
            onClick={handleShareUrl}
            style={{ padding: "6px 10px", fontWeight: 700 }}
          >
            {t("shareUrl")}
          </button>

          {shareUrl ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                style={{ width: 260, maxWidth: "60vw", fontFamily: "monospace", fontSize: 12, padding: "4px 6px" }}
              />
              {shareCopied ? (
                <span style={{ fontSize: 12, color: "#080" }}>{t("shareUrlCopied")}</span>
              ) : null}
            </span>
          ) : null}

{/*
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          templateId=<span style={{ fontFamily: "monospace" }}>{templateId}</span> / {t("progress")}: {progressCurrent}/{trials} (
          {Math.round(progressPct * 100)}%) / {t("best")}={progressBest ?? "-"}
          {selectedSeedLabel ? <span style={{ marginLeft: 10 }}>({t("selectedSeed")}={selectedSeedLabel})</span> : null}
        </div>
*/}
      </div>

      {/* --- ssot line --- */}
{/*
      <div style={{ padding: "0 12px 10px", fontSize: 12, opacity: 0.9, display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div>
          {t("currentPlacementHash")}=<span style={{ fontFamily: "monospace", marginLeft: 6 }}>{currentHash}</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span>{t("hash")}:</span>
          <input
            ref={hashInputRef}
            value={hashIo}
            onChange={(e) => setHashIo(e.target.value)}
            placeholder={currentToken}
            style={{ width: 260, fontFamily: "monospace", fontSize: 12, padding: "2px 6px" }}
          />
          <button
            onClick={() => {
              const h = (hashIo ?? "").trim();
              if (!h) return;
              setUrlHash(h);
              applyHashToSelection(h);
            }}
            style={{ padding: "2px 8px", fontSize: 12, fontWeight: 700 }}
          >
            {t("apply")}
          </button>
          <button
            onClick={() => {
              setHashIo(String(currentToken));
              copyText(String(currentToken));
            }}
            style={{ padding: "2px 8px", fontSize: 12, fontWeight: 700 }}
          >
            {t("copy")}
          </button>
          <button
            onClick={() => {
              try {
                const url = new URL(window.location.href);
                copyText(url.toString());
              } catch {
                // ignore
              }
            }}
            style={{ padding: "2px 8px", fontSize: 12, fontWeight: 700 }}
          >
            {t("copyUrl")}
          </button>
        </div>
        <div>
          {t("searchSsot")}:
          {searchConfig ? (
            <span style={{ marginLeft: 8, fontFamily: "monospace" }}>
              {t("fixedLarge")}=[{searchConfig.fixedLargeIds.join(", ")}] / {t("littlePool")}=[{searchConfig.littleIds.join(", ")}] /{" "}
              {t("scoutCount")}={searchConfig.scoutCount}
            </span>
          ) : (
            <span style={{ marginLeft: 8, color: "crimson" }}>
              ({t("noSearchConfig")}) templateId=&quot;{templateId}&quot;
            </span>
          )}
        </div>
      </div>
*/}

      {/* 表示設定（表示のみ。検索/評価には影響しない） */}
      <div style={{ display: "flex", gap: 11, alignItems: "center", flexWrap: "wrap", padding: "0px 0" }}>
        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>　{t("displaySettings")}</div>

        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
          <input type="checkbox" checked={showImportExport} onChange={(e) => setShowImportExport(e.target.checked)} />
          <span>{t("exportImportTitle")}</span>
        </label>

<label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
  <input type="checkbox" checked={showSavedConditions} onChange={(e) => setShowSavedConditions(e.target.checked)} />
  <span>{t("savedConditions")}</span>
</label>

        {/* 盤面の表示モード: 画像／セクタ番号＋向きの模式表示（2026-07-25 要望）。
            表示のみで検索・評価には影響しない。List と同じ localStorage キーを共有。 */}
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
          <span>{t("tileModeLabel")}</span>
          <select
            value={tileMode}
            onChange={(e) => {
              const v = e.target.value === "schematic" ? "schematic" : "image";
              setTileMode(v);
              try {
                localStorage.setItem("gaia_tile_mode", v);
              } catch {}
            }}
          >
            <option value="image">{t("tileImage")}</option>
            <option value="schematic">{t("tileSchematic")}</option>
          </select>
        </label>


        {/* 基本版のみ: 配置方法（検索キーに影響する設定。上段からの移動は
            基本版/LF切替でボタン位置がズレないようにするため、2026-07-24） */}
        {isBase ? (
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
            <Hint label={t("placementMethod")} tip={t("placementMethodTip")} />
            <select
              value={placementMethod}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v === 1 || v === 2 || v === 3) {
                  setPlacementMethod(v);
                  try {
                    localStorage.setItem("gaia_search_placement_method", String(v));
                  } catch {}
                }
              }}
            >
              <option value={1}>{t("method1")}</option>
              <option value={2}>{t("method2")}</option>
              <option value={3}>{t("method3")}</option>
            </select>
          </label>
        ) : null}

      </div>

      {/* Export / Import */}
      {showImportExport ? <LocalExportImportPanel /> : null}

      {showSavedConditions ? (
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10, margin: "0 12px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ fontWeight: 800 }}>{t("savedConditions")}</div>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{t("filter")}</div>
              <input
                value={profileQuery}
                onChange={(e) => setProfileQuery(e.target.value)}
                placeholder={t("filterPlaceholder")}
                style={{ width: 320, maxWidth: "70vw" }}
              />

              <select value={profileTemplateFilter} onChange={(e) => setProfileTemplateFilter(e.target.value)} style={{ fontSize: 12 }}>
                <option value="">{t("templateAll")}</option>
                {Array.from(new Set((savedProfiles ?? []).map((p) => String(((p.params as any)?.templateId ?? p.templateId ?? "")).trim()).filter(Boolean))).map(
                  (tid) => (
                    <option key={tid} value={tid}>
                      {tid === "base_34p"
                        ? lang === "ja" ? "基本版 3-4人" : "Base 3-4p"
                        : tid === "3p_lostFleet"
                          ? "Lost Fleet 3p"
                          : tid === "4p_lostFleet"
                            ? "Lost Fleet 4p"
                            : tid}
                    </option>
                  )
                )}
              </select>

              <button
                onClick={() => {
                  setProfileQuery("");
                  setProfileTemplateFilter("");
                }}
                style={{ padding: "4px 8px", fontSize: 12 }}
              >
                {t("clear")}
              </button>
            </div>
          </div>

          {filteredSavedProfiles.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.7 }}>-</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filteredSavedProfiles.map((p) => {
                const params = (p.params ?? null) as any;
                const hasParams = !!params;
                const tid = String(params?.templateId ?? p.templateId ?? "");
                // 内部名（templateId）をそのまま出さず表示名に変換（⑤ 2026-07-24）
                const title =
                  tid === "base_34p"
                    ? lang === "ja" ? "基本版 3-4人" : "Base 3-4p"
                    : tid === "3p_lostFleet"
                      ? "Lost Fleet 3p"
                      : tid === "4p_lostFleet"
                        ? "Lost Fleet 4p"
                        : tid || "-";

                const hardSummary = hasParams
                  ? `${t("hard")}: ${t("outerSameColorMax")}=${String(params?.hard?.outerSameColorMax ?? "-")}, ${t("centerMode")}=${String(
                      params?.hard?.centerMode ?? "-"
                    )}, ${t("maxConnectedPlanets")}=${String(params?.hard?.maxConnectedPlanets ?? 0)}, ${t("h5IncludeScouts")}=${String(
                      !!params?.hard?.h5IncludeScouts
                    )}`
                  : `${t("legacyUnknown")}`;

                const fourShips = (o: any) =>
                  ["twilight", "eclipse", "rebellion", "tfmars"]
                    .map((k, i) => String(o?.[k] ?? o?.[`S${i + 1}`] ?? "-"))
                    .join("/");
                const shipsLegend = lang === "ja" ? "トワ/エク/リベ/TF" : "tw/ec/rb/tf";
                const softSummary = hasParams
                  ? `${t("soft")}: ${t("wOuter")}=${String(params?.soft?.wOuter ?? "-")}, ${t("wTouch")}=${String(params?.soft?.wTouch ?? "-")}, ` +
                    `${t("wScout")}[${shipsLegend}]=${fourShips(params?.soft?.wScoutByScoutKey)}, ` +
                    `${t("wScoutCore")}[${shipsLegend}]=${fourShips(params?.soft?.wScoutCoreByScoutKey)}` +
                    `${params?.soft?.scoutCoreAttributionMode === "best" ? `, ${t("scoutCoreAttribBest")}` : ""}, ` +
                    `${t("scoutRadiusLabel")}=${String(params?.soft?.scoutRadius ?? "-")}`
                  : null;

                const isEditing = editingProfileKey === p.searchKey;
                const displayName = (p as any).name ? String((p as any).name) : t("unnamed");

                return (
                  <div
                    key={p.searchKey}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 10,
                      padding: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: "1 1 520px", minWidth: 280 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 12, fontWeight: 800 }}>{title}</div>
                        <div style={{ fontSize: 12, opacity: 0.85 }}>{t("conditionName")}:</div>

                        {isEditing ? (
                          <>
                            <input
                              value={editingProfileName}
                              onChange={(e) => setEditingProfileName(e.target.value)}
                              placeholder={t("namePlaceholder")}
                              style={{ width: 320, maxWidth: "70vw" }}
                            />
                            <button
                              onClick={async () => {
                                const nextName = editingProfileName.trim();
                                await upsertProfileToDb(p.searchKey, { name: nextName ? nextName : null, updatedAt: Date.now() } as any);
                                await refreshProfiles();
                                setEditingProfileKey(null);
                              }}
                              style={{ padding: "4px 8px", fontSize: 12 }}
                            >
                              {t("saveName")}
                            </button>
                            <button
                              onClick={() => {
                                setEditingProfileKey(null);
                              }}
                              style={{ padding: "4px 8px", fontSize: 12 }}
                            >
                              {t("cancelName")}
                            </button>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{displayName}</div>
                            <button
                              onClick={() => {
                                setEditingProfileKey(p.searchKey);
                                setEditingProfileName((p as any).name ? String((p as any).name) : "");
                              }}
                              style={{ padding: "4px 8px", fontSize: 12 }}
                            >
                              {t("editName")}
                            </button>
                          </>
                        )}
                      </div>

                      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{hardSummary}</div>
                      {softSummary ? <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{softSummary}</div> : null}
                      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{t("algoVersion")}={String(params?.algoVersion ?? p.algoVersion ?? "-")} / {t("evalVersion")}={String(params?.evalVersion ?? p.evalVersion ?? "-")}</div>
                      {/* searchKey（生テキスト）は表示せずホバーで確認（⑤ 2026-07-24） */}
                      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }} title={p.searchKey}>
                        {t("saved")}={p.activeCount} / {t("resultsModeUsed")}={p.usedCount}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
  <button
    disabled={!hasParams}
    onClick={() => applySavedProfile(p)}
    style={{ padding: "6px 10px" }}
  >
    {t("applyCondition")}
  </button>

  <button
    onClick={async () => {
      if (!confirm(t("confirmDeleteMeta"))) return;
      try {
        await deleteProfileOnlyFromDb(p.searchKey);
      } catch {}
      await refreshProfiles();
    }}
    style={{ padding: "6px 10px", fontSize: 12 }}
  >
    {t("deleteMeta")}
  </button>

  <button
    onClick={async () => {
      if (!confirm(t("confirmDeleteAll"))) return;
      try {
        await deleteProfileAndAllMapsFromDb(p.searchKey);
      } catch {}
      if (searchKey === p.searchKey) {
        setActivePersisted([]);
        setUsedPersisted([]);
        setSelectedPlacement(null);
        setSelectedSeedLabel(null);
      }
      await refreshProfiles();
    }}
    style={{ padding: "6px 10px", fontSize: 12 }}
  >
    {t("deleteAll")}
  </button>
</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {oldVersionProfiles.length > 0 ? (
        <div style={{ marginTop: 10, marginBottom: 10, padding: 10, border: "1px solid #dd0", borderRadius: 10, background: "#ffe" }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>{t("oldDataAvailable")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {oldVersionProfiles.map((p) => (
              <div key={p.searchKey} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  {t("copyFrom")}: <span style={{ fontFamily: "monospace" }}>{String(p.algoVersion ?? "-")}</span> /{" "}
                  <span style={{ fontFamily: "monospace" }}>{String(p.evalVersion ?? "-")}</span> &nbsp; (active={p.activeCount}, used={p.usedCount})
                </div>
                <button
                  onClick={() => handleCopyFromOldVersion(p.searchKey)}
                  style={{ padding: "4px 8px", fontSize: 12, fontWeight: 700 }}
                >
                  {t("copy")}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

{/*
        Main split view
        - Left (map): allow overflow/scroll so the board image is never clipped on small screens.
        - Right (results): make the whole panel scrollable so ranked maps are always reachable.
        Layout-only changes; no logic changes.
      */}
      <div style={{ display: "flex", flex: isNarrow ? "0 0 auto" : 1, minHeight: isNarrow ? "auto" : 0, overflow: isNarrow ? "visible" : "hidden", flexDirection: isNarrow ? "column" : "row-reverse", gap: isNarrow ? 12 : 0 }}>
        {/* Left: Map */}
        <div
          className={!isNarrow ? "noScrollbar" : undefined}
          style={{
            position: "relative",
            flexGrow: isNarrow ? 0 : 1,
            flexShrink: 0,
            // Keep the map usable even when the viewport is between the narrow
            // breakpoint (1180px) and ~1500px. flexBasis is set to the same
            // value as minWidth (480, not 0): with flexBasis 0 the combined
            // preferred size (0 + results' 1080) stays below the container
            // width across the whole 1180-1560px range, so flexbox never
            // enters the "shrink" resolution pass and the results pane (whose
            // flexGrow is 0) never actually shrinks - only this minWidth clamp
            // would fire, and the layout would overflow instead of the
            // results pane giving up space. Using 480 as the basis makes the
            // combined preferred size 1560, so shrinking kicks in as soon as
            // the container drops below that, and the results pane (flexShrink: 1)
            // absorbs the deficit down to its own 640 floor.
            flexBasis: isNarrow ? "auto" : 480,
            minWidth: isNarrow ? 0 : 480,
            display: "flex",
            flexDirection: "column",
            // Mobile: do not make the map itself a scroll container; let the page scroll instead.
            // Desktop: the SVG fits-to-container (preserveAspectRatio meet) so vertical
            // scroll is never needed; disable it (2026-07-24 ユーザー要望). 横方向のみ念のため auto。
            overflowX: isNarrow ? "hidden" : "auto",
            overflowY: "hidden",
            WebkitOverflowScrolling: isNarrow ? undefined : "touch",
            // Mobile: allow the browser to handle vertical pan gestures for page scrolling.
            touchAction: isNarrow ? "pan-y" : undefined,
            height: isNarrow ? "60dvh" : "auto",
            minHeight: isNarrow ? 320 : 0,
          }}
        >
          <div style={{ flex: 1, minHeight: 0, overflow: "visible" }}>
            <MapBoardViewer
              template={template as any}
              placement={placementForViewer}
              sectorById={sectorById as any}
              sectorImgById={sectorImgById}
              imgOffsetBySlotId={imgOffsetBySlotId as any}
              rotOffsetsBySlotId={rotOffsetsBySlotId as any}
              scaleByAccepts={{ LARGE: 1.02, MIDDLE: 0.93, SMALL: 1.1 }}
              boundsPad={isNarrow ? 40 : 65}
              zoom={isNarrow ? 0.85 : 1.0}
              showToolbar={false}
              // マップは固定表示（ドラッグ/パン無効、ツールバー廃止、2026-07-24 ユーザー要望）。
              disablePan
              markers={markers}
              tileMode={tileMode}
            />
          </div>

          {errorMsg ? <div style={{ padding: 10, color: "crimson", fontSize: 13, whiteSpace: "pre-wrap" }}>{errorMsg}</div> : null}
        </div>

        {/* Right: Results */}
        <div
          style={{
            width: isNarrow ? "100%" : 880,
            flexGrow: isNarrow ? 1 : 0,
            // Narrowed 1080->880 so the map gets more room (2026-07-25 要望)。
            // 詳細表は overflowX:auto の内包スクロールなのでペインを広げず、
            // 880-24(padding) = 856 >= 詳細表の最大幅 760 で通常は横スクロール無し。
            // 480px の地図フロアが要求すれば minWidth 600 まで縮む。
            flexShrink: isNarrow ? 0 : 1,
            flexBasis: isNarrow ? "auto" : 880,
            minWidth: isNarrow ? undefined : 600,
            minHeight: 0,
            borderRight: isNarrow ? "none" : "1px solid #ddd",
            borderTop: isNarrow ? "1px solid #ddd" : "none",
            // Desktop: outer hidden, inner scroll. Mobile: let the page scroll (no nested scroll).
            overflow: isNarrow ? "visible" : "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              flex: isNarrow ? "0 0 auto" : 1,
              minHeight: isNarrow ? "auto" : 0,
              overflowY: isNarrow ? "visible" : "auto",
              WebkitOverflowScrolling: isNarrow ? undefined : "touch",
            }}
          >
            <div style={{ fontWeight: 700 }}>{t("logicalResults")}</div>

            {isNarrow ? topKSection : null}

            {/* Current logical summary */}
            <div style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{t("currentLogicalSummary")}</div>

              <details style={{ marginTop: 4 }}>
                <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.75 }}>
                  {lang === "ja" ? "詳細情報" : "System"}
                </summary>
                <div style={{ fontFamily: "monospace", fontSize: 11, opacity: 0.85, marginTop: 4 }} title={t("tipHashPair")}>
                  {t("seed")}={String(selectedSeedLabel ?? seed ?? "-")}  /  <Hint label={`${t("placementHashResult")}=${curHashFromResult}`} tip={t("tipHashPair")} />  /  <Hint label={`${t("placementHashView")}=${currentHash}`} tip={t("tipHashPair")} />
                </div>

                <div style={{ marginTop: 8, fontSize: 12 }}>
                  <Hint label={t("score")} tip={t("tipScore")} />={displayResult ? Number(displayResult.score ?? 0 ).toFixed(3) : "-"}
                </div>

                <div style={{ marginTop: 4, fontSize: 12 }}>
                  <Hint label={`${t("imbalance")} (${curImb.metric})`} tip={t("tipScore")} />={displayResult ? (Math.round(curImb.value * 1000) / 1000).toFixed(3) : "-"}
                </div>

                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.9 }}>
                  <Hint label={t("outerCnt")} tip={t("tipOuterCnt")} />={displayResult ? curOT.outerSum : "-"} / <Hint label={t("touchCnt")} tip={t("tipTouchCnt")} />={displayResult ? curOT.touchSum : "-"}
                </div>

                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.9 }}>
                  <Hint label={t("scoutRadius")} tip={t("tipScoutRadius")} />={curScout.radius ?? "-"} / {t("scoutTotal")}={displayResult ? curScout.scoutTotal : "-"}
                </div>

                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.9 }}>
                  {t("scoutCoreRadius")}={curScoutCore.radius ?? "-"} / {t("scoutCoreTotal")}={displayResult ? curScoutCore.totalCore : "-"}
                  {displayResult ? <span> / {t("extra")}={curScoutCore.totalExtra}</span> : null}
                </div>
              </details>

              {displayResult ? (
                // 既定で開く。表示は displayResult に基づき、条件変更で結果バケットが
                // 空になっても直近結果を保持してパネルが縮まない（位置不変）。2026-07-24。
                <details open suppressHydrationWarning style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.85 }}>
                    {isBase
                      ? lang === "ja"
                        ? "色別の内訳（outer/touch/gaia/cluster/total）"
                        : "By color (outer/touch/gaia/cluster/total)"
                      // LF: サマリ文言は固定（拡張軸トグルで幅が変わらないように。2026-07-24）
                      : lang === "ja"
                        ? "色別の内訳（outer/touch/scout/total）"
                        : "By color (outer/touch/scout/total)"}
                  </summary>
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>
                        {lang === "ja" ? "詳細表表示" : "Table columns"}
                      </span>

                      {/* 列セレクタは拡張軸トグルで増減させない（レイアウト不変）。
                          LF では gaia/cluster を常時表示し、無効時は disable する。2026-07-24 */}
                      {(isBase
                        ? ([
                            ["total", "評価", "total", t("tipTotalCol"), false],
                            ["gaia", "ガイア", "gaia", t("wGaiaTip"), false],
                            ["cluster", "星系", "cluster", t("wClusterTip"), false],
                            ["outer", "最外周", "outer", t("tipOuterCnt"), false],
                            ["touch", "外周", "touch", t("tipTouchCnt"), false],
                          ] as const)
                        : ([
                            ["total", "評価", "total", t("tipTotalCol"), false],
                            ["scout", "船接触", "scout", t("tipWScoutShip"), false],
                            ["scoutCore", "船星系", "scoutCore", t("tipWScoutCoreShip"), false],
                            ["gaia", "ガイア", "gaia", t("wGaiaTip"), !applyExtraAxesLF],
                            ["cluster", "星系", "cluster", t("wClusterTip"), !applyExtraAxesLF],
                            ["outer", "最外周", "outer", t("tipOuterCnt"), false],
                            ["touch", "外周", "touch", t("tipTouchCnt"), false],
                          ] as const)
                      ).map(([k, ja, en, tip, disabled]) => (
                        <label key={k} style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12, opacity: disabled ? 0.4 : 1 }}>
                          <input
                            type="checkbox"
                            checked={(breakdownCols as any)[k]}
                            disabled={disabled}
                            onChange={(e) =>
                              setBreakdownCols((prev) => ({ ...prev, [k]: e.target.checked }))
                            }
                          />
                          <Hint label={lang === "ja" ? ja : en} tip={tip} />
                        </label>
                      ))}
                    </div>

                    <div style={{ marginTop: 8 }}><ColorBreakdownTable breakdown={displayBreakdown} cols={breakdownCols} lang={lang} isBase={isBase} onMark={onMark} activeSources={activeSources} /></div>
                </details>
              ) : null}

              {/* 生の breakdown(JSON) 詳細はユーザー向けでないため非表示（2026-07-24 ユーザー要望）。 */}
              {displayResult ? null : (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>{t("noCurrentResult")}</div>
              )}
            </div>

            {/* 用語集パネルは各ラベルのホバーヒント（Hint）へ置換済み（⑤承認済み、2026-07-24） */}

            {/* Controls */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Hint label={t("trials")} tip={t("tipTrials")} />
                <input
                  type="number"
                  value={trials}
                  min={1}
                  max={200000}
                  onChange={(e) => setTrials(Math.max(1, Math.min(200000, Number(e.target.value) || 1)))}
                  style={{ width: 100 }}
                />
              </label>

              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Hint label={t("topK")} tip={t("tipTopK")} />
                <input
                  type="number"
                  value={keepTop}
                  min={1}
                  max={200}
                  onChange={(e) => setKeepTop(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                  style={{ width: 80 }}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 12 }}>
                <Hint label={t("hard")} tip={t("tipHard")} />
              </div>

              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Hint label={t("outerSameColorMax")} tip={t("tipOuterSameColorMax")} />
                <input
                  type="number"
                  value={outerSameColorMax}
                  min={0}
                  max={9}
                  onChange={(e) => setOuterSameColorMax(Math.max(0, Math.min(9, Number(e.target.value) || 0)))}
                  style={{ width: 60 }}
                />
              </label>

              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Hint label={t("maxConnectedPlanets")} tip={t("tipMaxConnectedPlanets")} />
                <input
                  type="number"
                  value={maxConnectedPlanets}
                  min={0}
                  max={999}
                  onChange={(e) => setMaxConnectedPlanets(Math.max(0, Math.min(999, Number(e.target.value) || 0)))}
                  style={{ width: 60 }}
                />
              </label>

              {!isBase ? (
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={h5IncludeScouts}
                    onChange={(e) => setH5IncludeScouts(e.target.checked)}
                  />
                  <Hint label={t("h5IncludeScouts")} tip={t("tipH5IncludeScouts")} />
                </label>
              ) : null}

              {!isBase ? (
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Hint label={t("centerMode")} tip={t("tipCenterMode")} />
                  <select
                    value={centerMode}
                    onChange={(e) =>
                      setCenterMode(
                        e.target.value as "NONE" | "CENTER_7_9" | "CENTER_8" | "CENTER_7_8"
                      )
                    }
                  >
                    {centerModeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.9 }} title={t("tipSoft")}>
                {t("soft")}
              </summary>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* --- 基本軸: outer / touch (+ LF は scout radius)。薄背景のセルで表状に --- */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                  <Hint label={t("soft")} tip={t("tipSoft")} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                  <label {...evalCellProps("outer:*", "outer")}>
                    <Hint label={t("wOuter")} tip={t("tipWOuter")} />
                    <input type="number" value={wOuter} min={0} max={10} onChange={(e) => setWOuter(Number(e.target.value) || 0)} style={{ width: 60 }} />
                  </label>
                  <label {...evalCellProps("touch:*", "touch")}>
                    <Hint label={t("wTouch")} tip={t("tipWTouch")} />
                    <input type="number" value={wTouch} min={0} max={10} onChange={(e) => setWTouch(Number(e.target.value) || 0)} style={{ width: 60 }} />
                  </label>
                  {!isBase ? (
                    <label style={EVAL_CELL}>
                      <Hint label={t("radius")} tip={t("tipScoutRadius")} />
                      <input
                        type="number"
                        value={scoutRadius}
                        min={1}
                        max={12}
                        onChange={(e) => setScoutRadius(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                        style={{ width: 60 }}
                      />
                    </label>
                  ) : null}
                </div>
              </div>

              {/* --- 拡張軸: ガイア・星系。枠を常時確保し、無効時は入力を disable する
                     （チェックのON/OFFでレイアウトが動かない。2026-07-24 ユーザー要望）。 --- */}
              <div style={{ borderTop: "1px dashed #ddd", paddingTop: 8, opacity: extraAxesOn ? 1 : 0.6 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                  {!isBase ? (
                    <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 700, fontSize: 12 }} title={t("tipExtraAxesLF")}>
                      <input
                        type="checkbox"
                        checked={applyExtraAxesLF}
                        onChange={(e) => changeApplyExtraAxesLF(e.target.checked)}
                      />
                      <Hint label={t("extraAxesLF")} tip={t("tipExtraAxesLF")} />
                    </label>
                  ) : (
                    <div style={{ fontWeight: 700, fontSize: 12 }}>
                      <Hint label={t("extraAxesLF")} tip={t("tipExtraAxesLF")} />
                    </div>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                  {/* ガイア距離1 は現行仕様では発生しない（盤面上、惑星どうしは隣接しない）
                      ため入力欄を出さない。将来の拡張で発生し得るので計算・状態は残す
                      （2026-07-30 ユーザー判断）。 */}
                  <label {...evalCellProps("gaia:d2", "gaia", { gaiaDistance: 2 }, t("wGaiaTip"))}>
                    <span>{t("wGaiaD2")}</span>
                    <input type="number" value={wGaiaD2} min={0} max={20} disabled={!extraAxesOn} onChange={(e) => setWGaiaD2(Number(e.target.value) || 0)} style={{ width: 60, background: extraAxesOn ? undefined : "#e6e6e6" }} />
                  </label>
                  <label {...evalCellProps("gaia:d3", "gaia", { gaiaDistance: 3 }, t("wGaiaTip"))}>
                    <span>{t("wGaiaD3")}</span>
                    <input type="number" value={wGaiaD3} min={0} max={20} disabled={!extraAxesOn} onChange={(e) => setWGaiaD3(Number(e.target.value) || 0)} style={{ width: 60, background: extraAxesOn ? undefined : "#e6e6e6" }} />
                  </label>
                  <label {...evalCellProps("cluster:*", "cluster", undefined, t("wClusterTip"))}>
                    <span>{t("wClusterSize")}</span>
                    <input type="number" value={wClusterSize} min={0} max={20} disabled={!extraAxesOn} onChange={(e) => setWClusterSize(Number(e.target.value) || 0)} style={{ width: 60, background: extraAxesOn ? undefined : "#e6e6e6" }} />
                  </label>
                </div>
              </div>

              {/* --- スカウト重み（LFのみ）: 4列×2段。列=船（トワイライト/エクリプス/
                     リベリオン/TFマーズ）、上段=船接触・下段=船星系で同じ船が縦に並ぶ。2026-07-24 --- */}
              {!isBase ? (
                <div style={{ borderTop: "1px dashed #ddd", paddingTop: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                    <Hint label={t("wScout")} tip={t("tipWScoutShip")} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, alignItems: "start" }}>
                    {/* 上段: 船接触（各船） */}
                    <label {...evalCellProps("scout:twilight", "scout", { scoutId: "twilight" })}>
                      <Hint label={t("wScoutS1")} tip={t("tipWScoutShip")} />
                      <input type="number" value={wScoutS1} min={0} max={20} onChange={(e) => setWScoutS1(Number(e.target.value) || 0)} style={{ width: 56, flex: "0 0 auto" }} />
                    </label>
                    <label {...evalCellProps("scout:eclipse", "scout", { scoutId: "eclipse" })}>
                      <Hint label={t("wScoutS2")} tip={t("tipWScoutShip")} />
                      <input type="number" value={wScoutS2} min={0} max={20} onChange={(e) => setWScoutS2(Number(e.target.value) || 0)} style={{ width: 56, flex: "0 0 auto" }} />
                    </label>
                    <label {...evalCellProps("scout:rebellion", "scout", { scoutId: "rebellion" })}>
                      <Hint label={t("wScoutS3")} tip={t("tipWScoutShip")} />
                      <input type="number" value={wScoutS3} min={0} max={20} onChange={(e) => setWScoutS3(Number(e.target.value) || 0)} style={{ width: 56, flex: "0 0 auto" }} />
                    </label>
                    <label {...evalCellProps("scout:tfmars", "scout", { scoutId: "tfmars" })}>
                      <Hint label={t("wScoutS4")} tip={t("tipWScoutShip")} />
                      <input type="number" value={wScoutS4} min={0} max={20} onChange={(e) => setWScoutS4(Number(e.target.value) || 0)} style={{ width: 56, flex: "0 0 auto" }} />
                    </label>

                    {/* 下段: 船星系（各船） */}
                    <label {...evalCellProps("scoutCore:twilight", "scoutCore", { scoutId: "twilight" })}>
                      <Hint label={t("wScoutCoreS1")} tip={t("tipWScoutCoreShip")} />
                      <input type="number" value={wScoutCoreS1} min={0} max={20} onChange={(e) => setWScoutCoreS1(Number(e.target.value) || 0)} style={{ width: 56, flex: "0 0 auto" }} />
                    </label>
                    <label {...evalCellProps("scoutCore:eclipse", "scoutCore", { scoutId: "eclipse" })}>
                      <Hint label={t("wScoutCoreS2")} tip={t("tipWScoutCoreShip")} />
                      <input type="number" value={wScoutCoreS2} min={0} max={20} onChange={(e) => setWScoutCoreS2(Number(e.target.value) || 0)} style={{ width: 56, flex: "0 0 auto" }} />
                    </label>
                    <label {...evalCellProps("scoutCore:rebellion", "scoutCore", { scoutId: "rebellion" })}>
                      <Hint label={t("wScoutCoreS3")} tip={t("tipWScoutCoreShip")} />
                      <input type="number" value={wScoutCoreS3} min={0} max={20} onChange={(e) => setWScoutCoreS3(Number(e.target.value) || 0)} style={{ width: 56, flex: "0 0 auto" }} />
                    </label>
                    <label {...evalCellProps("scoutCore:tfmars", "scoutCore", { scoutId: "tfmars" })}>
                      <Hint label={t("wScoutCoreS4")} tip={t("tipWScoutCoreShip")} />
                      <input type="number" value={wScoutCoreS4} min={0} max={20} onChange={(e) => setWScoutCoreS4(Number(e.target.value) || 0)} style={{ width: 56, flex: "0 0 auto" }} />
                    </label>

                    <label style={{ display: "flex", gap: 8, alignItems: "center", gridColumn: "1 / -1", flexWrap: "wrap", marginTop: 2 }}>
                      <input type="checkbox" checked={scoutCoreAttribBest} onChange={(e) => setScoutCoreAttribBest(e.target.checked)} />
                      <Hint label={t("scoutCoreAttribBest")} tip={t("tipScoutCoreAttrib")} />
                    </label>
                  </div>
                </div>
              ) : null}

              <div style={{ width: "100%", borderTop: "1px dashed #ddd", marginTop: 8, paddingTop: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 12 }}>
                  <Hint label={t("colorPreference")} tip={t("tipColorPref")} />
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
                  <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Hint label={t("wColorPref")} tip={t("tipColorPref")} />
                    <input
                      type="number"
                      value={wColorPref}
                      min={0}
                      max={20}
                      onChange={(e) => setWColorPref(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
                      style={{ width: 60 }}
                    />
                  </label>

                  <span style={{ fontSize: 12, opacity: 0.75 }}>
                    {lang === "ja"
                      ? "prefは「惑星種別合計（planetTypeTotals）」を高く/低くする嗜好（+優遇 / -冷遇）"
                      : "pref: + favors higher planetTypeTotals, - favors lower"}
                  </span>
                </div>

                {/* どの入力欄がどの色か一目で分かるよう、内訳テーブルと同じ色背景を付ける
                    （基本/LF共通。ユーザー要望 2026-07-23） */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginTop: 6 }}>
                  {([
                    ["BLACK", "黒", prefBLACK, setPrefBLACK],
                    ["BLUE", "青", prefBLUE, setPrefBLUE],
                    ["BROWN", "茶", prefBROWN, setPrefBROWN],
                    ["ORANGE", "橙", prefORANGE, setPrefORANGE],
                    ["RED", "赤", prefRED, setPrefRED],
                    ["WHITE", "白", prefWHITE, setPrefWHITE],
                    ["YELLOW", "黄", prefYELLOW, setPrefYELLOW],
                  ] as const).map(([key, ja, value, setter]) => (
                    <label
                      key={key}
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: PLANET_INPUT_BG[key],
                        border: "1px solid rgba(0,0,0,0.15)",
                        borderRadius: 6,
                        padding: "3px 6px",
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{lang === "ja" ? ja : key}</span>
                      <input
                        type="number"
                        value={value}
                        min={-20}
                        max={20}
                        onChange={(e) => setter(Math.max(-20, Math.min(20, Number(e.target.value) || 0)))}
                        style={{ width: 60 }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
            </details>

            {isNarrow ? null : topKSection}

          </div>
        </div>
      </div>
    </div>
    </>
  );
}

  function getScoutCoreSummary(r: RankedResult | null) {
    const b = (r as any)?.evaluation?.breakdown ?? null;
    const a = b?.audit?.scoutCore ?? null;

    const radius = 2;
    const byType = a?.byType ?? null;
    const distanceHistogram = a?.distanceHistogram ?? null;
    const extraByKind = a?.extraByKind ?? null;
    const perScoutPlanet = a?.perScoutPlanet ?? null;
    const coreHits = a?.coreHits ?? null;

    const totalCore = byType ? sumCounts(byType) : 0;
    const totalExtra =
      extraByKind && typeof extraByKind === "object"
        ? Object.values(extraByKind).reduce((acc: number, v: any) => acc + (Number(v) || 0), 0)
        : 0;

    return {
      radius,
      totalCore,
      totalExtra,
      byType,
      distanceHistogram,
      extraByKind,
      perScoutPlanet,
      coreHits,
    };
  }