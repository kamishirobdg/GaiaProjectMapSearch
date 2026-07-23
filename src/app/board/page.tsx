"use client";

import * as React from "react";
import { MapBoardViewer, type PlacementItem as ViewerPlacementItem } from "@/components/MapBoardViewer";
import TabNav from "@/components/TabNav";
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

import { BASE_SECTORS } from "@/gaia/sectorTiles_base";
import { EXPANSION_MIDDLE, EXPANSION_LITTLE, EXPANSION_SCOUT } from "@/gaia/sectorTiles_lostfleet";

import { buildSectorLookup } from "@/gaia/board/previewBoard";
import { runSearch as runLogicalSearch } from "@/gaia/search";
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

type RankedResult = {
  seed: string;
  score: number;
  placement: any[];
  placementHash?: string;
  evaluation: any; // { total, breakdown, audit }
};

import { UI_TEXT, type Lang, type UiKey } from "./uiText";

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

// -----------------------------
// Persisted search results (local, IndexedDB)
// Spec:
// - Per searchKey (templateId + hard/soft + algo/eval versions)
// - Active candidates are capped by capacityActive = max(TopK, 100)
// - Used candidates are stored in a separate bucket (not counted toward capacityActive)
// - used=true candidates stay excluded from Top-K views; score info may still be updated on merge
// - TopK itself is NOT part of searchKey
// -----------------------------

const SEARCH_ALGO_VERSION = "search_v1";
// eval_v2: fixed 4p_lostFleet M2/M5 slotCenters (src/gaia/templates/4p_lostfleet_slotCenters.ts),
// which were copy-pasted from the 3p file and did not match the display-side
// positions, causing cell collisions in the evaluated 4p board. Placement
// generation (seed -> placement) is unaffected; only evaluation results change.
const EVAL_VERSION = "eval_v2";

type PersistedCandidate = {
  id: string; // `${searchKey}:${placementHash}`
  searchKey: string;
  baseKeyRaw?: string | null;
  placementHash: string;
  seed: string;
  score: number;
  rankValue: number; // for ascending sort (best first). We use -score.
  placement: any[];
  evaluation: any;
  used: boolean;
  usedKey: 0 | 1;
  usedAt?: number;
  createdAt: number;
  updatedAt: number;
};

type PersistedProfile = {
  searchKey: string;
  baseKeyRaw?: string | null;
  algoVersion?: string | null;
  evalVersion?: string | null;
  name?: string | null;
  templateId?: string | null;
  paramsRaw?: string | null; // stableStringify(searchKeyParams)
  params?: any | null;
  activeCount: number;
  usedCount: number;
  lastTopK?: number | null;
  createdAt: number;
  updatedAt: number;
  // searchKeys of older-version profiles whose candidates have already been
  // copied into this profile via handleCopyFromOldVersion. Used to suppress
  // the "old data available" banner for versions already merged in.
  copiedFromKeys?: string[] | null;
};

const IDB_NAME = "gaia_map_cache";
const IDB_VERSION = 4;
const STORE_CANDIDATES = "candidates";
const STORE_PROFILES = "profiles";
const LAST_APPLIED_SEARCHKEY = "gaia_last_applied_searchKey_v1";


let _dbPromise: Promise<IDBDatabase> | null = null;


function openDb(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      const tx = req.transaction as IDBTransaction;

      // ----- candidates -----
      const candidates =
        db.objectStoreNames.contains(STORE_CANDIDATES)
          ? tx.objectStore(STORE_CANDIDATES)
          : db.createObjectStore(STORE_CANDIDATES, { keyPath: "id" });

      if (!candidates.indexNames.contains("bySearchKey")) {
        candidates.createIndex("bySearchKey", "searchKey", { unique: false });
      }

      // v2+ uses usedKey(0/1) instead of boolean used in compound index.
      if (candidates.indexNames.contains("bySearchKeyUsedKeyRank")) {
        try {
          candidates.deleteIndex("bySearchKeyUsedKeyRank");
        } catch {}
      }
      candidates.createIndex("bySearchKeyUsedKeyRank", ["searchKey", "usedKey", "rankValue"], { unique: false });

      if (!candidates.indexNames.contains("bySearchKeyHash")) {
        candidates.createIndex("bySearchKeyHash", ["searchKey", "placementHash"], { unique: true });
      }

      // ----- profiles -----
      const profiles =
        db.objectStoreNames.contains(STORE_PROFILES)
          ? tx.objectStore(STORE_PROFILES)
          : db.createObjectStore(STORE_PROFILES, { keyPath: "searchKey" });

      if (!profiles.indexNames.contains("byUpdatedAt")) {
        profiles.createIndex("byUpdatedAt", "updatedAt", { unique: false });
      }
      if (!profiles.indexNames.contains("byBaseKeyRaw")) {
        profiles.createIndex("byBaseKeyRaw", "baseKeyRaw", { unique: false });
      }

      // ----- migrations / backfills -----
      // Backfill usedKey from legacy boolean used.
      try {
        const curReq = candidates.openCursor();
        curReq.onsuccess = () => {
          const cur = curReq.result;
          if (!cur) return;
          const v: any = cur.value ?? {};
          const used = Boolean(v.used);
          const usedKey: 0 | 1 = used ? 1 : 0;
          if (v.usedKey !== usedKey) {
            v.usedKey = usedKey;
            try {
              cur.update(v);
            } catch {}
          }
          cur.continue();
        };
      } catch {}

      // v4: backfill baseKeyRaw / versions for profiles when paramsRaw is available.
      try {
        const pcurReq = profiles.openCursor();
        pcurReq.onsuccess = () => {
          const pcur = pcurReq.result;
          if (!pcur) return;
          const row: any = pcur.value ?? {};
          if (!row.baseKeyRaw && row.paramsRaw) {
            try {
              const obj = JSON.parse(String(row.paramsRaw));
              const algoV = obj?.algoVersion;
              const evalV = obj?.evalVersion;
              if (algoV != null && row.algoVersion == null) row.algoVersion = String(algoV);
              if (evalV != null && row.evalVersion == null) row.evalVersion = String(evalV);
              if (obj && typeof obj === "object") {
                try {
                  delete obj.algoVersion;
                  delete obj.evalVersion;
                } catch {}
                row.baseKeyRaw = stableStringify(obj);
              }
              pcur.update(row);
            } catch {}
          }
          pcur.continue();
        };
      } catch {}
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return _dbPromise;
}


async function idbGetAllByIndex<T>(
  db: IDBDatabase,
  storeName: string,
  indexName: string,
  range?: IDBKeyRange,
  limit?: number
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const idx = store.index(indexName);
    const out: T[] = [];
    const req = idx.openCursor(range);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return resolve(out);
      out.push(cur.value as T);
      if (limit && out.length >= limit) return resolve(out);
      cur.continue();
    };
  });
}

async function idbGetAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  // getAll() は現行ブラウザでは基本OK。型安全にラップします。
  return await new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);

    const req = store.getAll();
    req.onsuccess = () => resolve((req.result ?? []) as T[]);
    req.onerror = () => reject(req.error ?? new Error("idbGetAll failed"));
  });
}


async function idbPutAll<T>(db: IDBDatabase, storeName: string, rows: T[]): Promise<void> {
  if (rows.length === 0) return;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    for (const r of rows) store.put(r as any);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function idbDeleteByIds(db: IDBDatabase, storeName: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    for (const id of ids) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}


async function idbGetAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return await new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const out: T[] = [];
    const req = store.openCursor();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return resolve(out);
      out.push(cur.value as T);
      cur.continue();
    };
  });
}

async function idbGetByKey<T>(db: IDBDatabase, storeName: string, key: any): Promise<T | undefined> {
  return await new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result as any);
  });
}

async function idbClearStore(db: IDBDatabase, storeName: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function stableStringify(x: any): string {
  if (x === null || typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(stableStringify).join(",") + "]";
  const keys = Object.keys(x).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(x[k])).join(",") + "}";
}

async function sha256Hex(s: string): Promise<string> {
  // Prefer WebCrypto SHA-256 when available (requires secure context for subtle in many browsers).
  try {
    const c: any = (globalThis as any).crypto;
    const subtle = c?.subtle;
    if (subtle && typeof subtle.digest === "function") {
      const enc = new TextEncoder();
      const buf = enc.encode(s);
      const digest = await subtle.digest("SHA-256", buf);
      const bytes = Array.from(new Uint8Array(digest));
      return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {}
  // Fallback: FNV-1a 32-bit (not cryptographic, but stable for cache keys).
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Unsigned 32-bit hex
  return (h >>> 0).toString(16).padStart(8, "0");
}

function seedTieKey(seed: string): number {
  // Supports "123_0" and plain numeric.
  const n = parseInt(seed.split("_")[0] ?? seed, 10);
  return Number.isFinite(n) ? n : 0;
}

function toRankedResult(c: PersistedCandidate): RankedResult {
  return {
    seed: String(c.seed),
    score: Number(c.score),
    placement: c.placement ?? [],
    placementHash: c.placementHash,
    evaluation: c.evaluation,
  } as any;
}

function betterThan(a: PersistedCandidate, b: PersistedCandidate): boolean {
  // Higher score is better; tie-break by numeric seed.
  if (a.score !== b.score) return a.score > b.score;
  return seedTieKey(a.seed) < seedTieKey(b.seed);
}

type MergeResult = {
  active: PersistedCandidate[];
  used: PersistedCandidate[];
  deletedActiveIds: string[];
};

function mergeCandidates(
  searchKey: string,
  existingActive: PersistedCandidate[],
  existingUsed: PersistedCandidate[],
  incoming: PersistedCandidate[],
  capacityActive: number
): MergeResult {
  const map = new Map<string, PersistedCandidate>();

  const addOrMerge = (cand: PersistedCandidate) => {
    const key = cand.placementHash;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, cand);
      return;
    }
    const used = prev.used || cand.used;
    const usedAt = prev.usedAt ?? cand.usedAt;
    const base = betterThan(cand, prev) ? cand : prev;
    map.set(key, {
      ...base,
      used,
      usedKey: used ? 1 : 0,
      usedAt,
      createdAt: prev.createdAt ?? base.createdAt,
      updatedAt: Math.max(prev.updatedAt ?? 0, cand.updatedAt ?? 0, base.updatedAt ?? 0),
      id: `${searchKey}:${key}`,
      searchKey,
      placementHash: key,
    });
  };

  for (const c of existingActive) addOrMerge(c);
  for (const c of existingUsed) addOrMerge(c);
  for (const c of incoming) addOrMerge(c);

  const all = Array.from(map.values());
  const used = all.filter((c) => c.used);
  const activeAll = all.filter((c) => !c.used);

  activeAll.sort((a, b) => b.score - a.score || seedTieKey(a.seed) - seedTieKey(b.seed));
  const keptActive = activeAll.slice(0, capacityActive);

  // Active deletions: any previously-active id not in kept set (e.g., capacity shrunk)
  const keptIds = new Set(keptActive.map((c) => c.id));
  const deletedActiveIds = existingActive.map((c) => c.id).filter((id) => !keptIds.has(id));

  return { active: keptActive, used, deletedActiveIds };
}

async function loadFromDb(searchKey: string, capacityActive: number): Promise<{ active: PersistedCandidate[]; used: PersistedCandidate[] }> {
  const db = await openDb();
  // NOTE: IndexedDB keys must be finite (Infinity/-Infinity are invalid).
  const MIN_RANK = -9_007_199_254_740_991; // Number.MIN_SAFE_INTEGER
  const MAX_RANK =  9_007_199_254_740_991; // Number.MAX_SAFE_INTEGER
  const rngActive = IDBKeyRange.bound([searchKey, 0, MIN_RANK], [searchKey, 0, MAX_RANK]);
  const rngUsed = IDBKeyRange.bound([searchKey, 1, MIN_RANK], [searchKey, 1, MAX_RANK]);

  const active = await idbGetAllByIndex<PersistedCandidate>(db, STORE_CANDIDATES, "bySearchKeyUsedKeyRank", rngActive);
  const used = await idbGetAllByIndex<PersistedCandidate>(db, STORE_CANDIDATES, "bySearchKeyUsedKeyRank", rngUsed);

  // Ensure active is capped (in case of older versions)
  const activeSorted = active
    .slice()
    .sort((a, b) => b.score - a.score || seedTieKey(a.seed) - seedTieKey(b.seed))
    .slice(0, capacityActive);

  // If we trimmed, delete extras to keep DB consistent
  const keepIds = new Set(activeSorted.map((c) => c.id));
  const toDelete = active.map((c) => c.id).filter((id) => !keepIds.has(id));
  if (toDelete.length > 0) await idbDeleteByIds(db, STORE_CANDIDATES, toDelete);

  return { active: activeSorted, used };
}

async function saveMergeToDb(searchKey: string, merged: MergeResult): Promise<void> {
  const db = await openDb();
  // Ensure ids are correct
  const now = Date.now();
  const rows = [...merged.active, ...merged.used].map((c) => ({
    ...c,
    id: `${searchKey}:${c.placementHash}`,
    searchKey,
    updatedAt: c.updatedAt || now,
  }));
  await idbPutAll(db, STORE_CANDIDATES, rows);
  if (merged.deletedActiveIds.length > 0) {
    await idbDeleteByIds(db, STORE_CANDIDATES, merged.deletedActiveIds);
  }
}
async function loadProfilesFromDb(limit: number = 200): Promise<PersistedProfile[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_PROFILES, "readonly");
      const store = tx.objectStore(STORE_PROFILES);
      const idx = store.index("byUpdatedAt");
      const out: PersistedProfile[] = [];
      const req = idx.openCursor(null, "prev");
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return resolve(out);
        out.push(cur.value as any);
        if (limit && out.length >= limit) return resolve(out);
        cur.continue();
      };
    } catch {
      resolve([]);
    }
  });
}
async function loadProfilesByBaseKeyRaw(baseKeyRaw: string): Promise<PersistedProfile[]> {
  const db = await openDb();
  if (!baseKeyRaw) return [];
  try {
    const rng = IDBKeyRange.only(baseKeyRaw);
    // Prefer index if present; else fallback to full scan.
    const rows = await idbGetAllByIndex<PersistedProfile>(db, STORE_PROFILES, "byBaseKeyRaw", rng);
    return (rows ?? []).sort((a, b) => (Number(b.updatedAt ?? 0) || 0) - (Number(a.updatedAt ?? 0) || 0));
  } catch {
    const rows = await idbGetAll<PersistedProfile>(db, STORE_PROFILES);
    return (rows ?? []).filter((r) => String((r as any).baseKeyRaw ?? "") === baseKeyRaw).sort((a, b) => (Number(b.updatedAt ?? 0) || 0) - (Number(a.updatedAt ?? 0) || 0));
  }
}



async function upsertProfileToDb(searchKey: string, patch: Partial<PersistedProfile>): Promise<PersistedProfile | null> {
  const db = await openDb();
  const now = Date.now();
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE_PROFILES, "readwrite");
    } catch {
      resolve(null);
      return;
    }
    const store = tx.objectStore(STORE_PROFILES);
    const getReq = store.get(searchKey);
    getReq.onerror = () => reject(getReq.error);
    getReq.onsuccess = () => {
      const prev = (getReq.result as PersistedProfile | undefined) ?? null;
      const base: PersistedProfile =
        prev ??
        ({
          searchKey,
          algoVersion: null,
          evalVersion: null,
          templateId: null,
          name: null,
          paramsRaw: null,
          params: null,
          activeCount: 0,
          usedCount: 0,
          lastTopK: null,
          createdAt: now,
          updatedAt: now,
        } as PersistedProfile);

      const next: PersistedProfile = {
        ...base,
        ...patch,
        searchKey,
        createdAt: base.createdAt || now,
        updatedAt: Math.max(base.updatedAt || 0, (patch as any).updatedAt || 0, now),
      };

      const putReq = store.put(next as any);
      putReq.onerror = () => reject(putReq.error);
      putReq.onsuccess = () => resolve(next);
    };
  });
}



async function deleteProfileOnlyFromDb(searchKey: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE_PROFILES, "readwrite");
    } catch {
      resolve();
      return;
    }
    const store = tx.objectStore(STORE_PROFILES);
    const req = store.delete(searchKey);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteProfileAndAllMapsFromDb(searchKey: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction([STORE_PROFILES, STORE_CANDIDATES], "readwrite");
    } catch {
      resolve();
      return;
    }

    const profiles = tx.objectStore(STORE_PROFILES);
    const candidates = tx.objectStore(STORE_CANDIDATES);

    try {
      profiles.delete(searchKey);
    } catch {}

    // delete all candidates for this searchKey
    try {
      const idx = candidates.index("bySearchKey");
      const rng = IDBKeyRange.only(searchKey);
      const curReq = idx.openCursor(rng);
      curReq.onerror = () => reject(curReq.error);
      curReq.onsuccess = () => {
        const cur = curReq.result;
        if (!cur) return;
        try {
          cur.delete();
        } catch {}
        cur.continue();
      };
    } catch {}

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
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

/** ---------- sector image helper (UI only) ---------- */

function normalizeSectorId(id: string) {
  const s = String(id ?? "").trim();
  const t = s.replace(/^0+/, "");
  return t === "" ? "0" : t;
}

function getSectorIdFromAny(obj: any): string | null {
  if (!obj || typeof obj !== "object") return null;

  const cands = [
    (obj as any).sectorId,
    (obj as any).id,
    (obj as any).tileId,
    (obj as any).sector_id,
    (obj as any).tile_id,
    (obj as any).code,
    (obj as any).name,
  ];

  for (const v of cands) {
    const s = String(v ?? "").trim();
    if (s && s !== "undefined" && s !== "null") return s;
  }
  return null;
}

function buildSectorImgById() {
  const map: Record<string, string> = {};

  const put = (arr: any[]) => {
    for (const s of arr) {
      const id = getSectorIdFromAny(s);
      if (!id) continue;
      const img = String((s as any).img ?? (s as any).image ?? (s as any).src ?? "");
      if (img) map[id] = img;
    }
  };

  put(Array.isArray(BASE_SECTORS) ? (BASE_SECTORS as any[]) : []);
  put(Array.isArray(EXPANSION_MIDDLE) ? (EXPANSION_MIDDLE as any[]) : []);
  put(Array.isArray(EXPANSION_LITTLE) ? (EXPANSION_LITTLE as any[]) : []);
  put(Array.isArray(EXPANSION_SCOUT) ? (EXPANSION_SCOUT as any[]) : []);

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) out[normalizeSectorId(k)] = v;
  return out;
}

function getBreakdown(r: any) {
  if (!r) return null;
  return r?.evaluation?.breakdown ?? null;
}

function sumCounts(obj: any): number {
  if (!obj || typeof obj !== "object") return 0;
  return Object.values(obj).reduce((acc: number, v: any) => acc + (Number(v) || 0), 0);
}

/**
 * Runs the logical search (src/gaia/search.ts runSearch) inside
 * src/workers/boardSearch.worker.ts so the main thread stays responsive
 * (scrolling, panel toggles, etc. keep working while a search is in flight).
 *
 * The worker's `searchOptions` payload and progress semantics are identical
 * to a direct `runLogicalSearch(templateId, searchOptions, onProgress)` call:
 * the worker imports the very same `runSearch` and forwards its `results`/
 * `diagnostics` back verbatim via the "done" message, so results for a given
 * seedStart + params are bit-for-bit identical whether run in-worker or
 * in-thread.
 *
 * Rejects (instead of resolving) whenever the worker cannot be used at all
 * (Worker/SharedArrayBuffer unavailable, worker script failed to load, or the
 * worker itself reported an "error"/unexpected "stopped" message) so the
 * caller (`runSearchOffThread`) can fall back to the main-thread search.
 */
function runSearchInWorker(
  templateId: string,
  searchOptions: any,
  onProgress: (done: number, bestScore: number | null) => void
): Promise<{ results: any[]; diagnostics: any }> {
  return new Promise((resolve, reject) => {
    if (typeof Worker === "undefined" || typeof SharedArrayBuffer === "undefined") {
      reject(new Error("Worker or SharedArrayBuffer is not available in this environment"));
      return;
    }

    let worker: Worker;
    let stopSAB: SharedArrayBuffer;
    try {
      stopSAB = new SharedArrayBuffer(4);
      // Next.js/Turbopack worker convention: a `new URL(..., import.meta.url)`
      // argument lets the bundler discover and bundle the worker file.
      worker = new Worker(new URL("../../workers/boardSearch.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch (e) {
      reject(e);
      return;
    }

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let settled = false;

    const cleanup = () => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    };

    worker.onmessage = (ev: MessageEvent<any>) => {
      const msg = ev.data;
      if (!msg || msg.runId !== runId || settled) return;

      if (msg.type === "progress") {
        const bestScore = msg.bestScore == null ? null : Number(msg.bestScore);
        onProgress(Number(msg.done ?? 0), bestScore);
        return;
      }

      if (msg.type === "done") {
        settled = true;
        cleanup();
        resolve({ results: msg.best ?? [], diagnostics: msg.diagnostics });
        return;
      }

      if (msg.type === "error") {
        settled = true;
        cleanup();
        reject(new Error(String(msg.message ?? "worker search error")));
        return;
      }

      // "stopped" is only emitted in response to a StopMsg, which this
      // integration never sends. Treat it as unexpected and fall back.
      if (msg.type === "stopped") {
        settled = true;
        cleanup();
        reject(new Error("worker search stopped unexpectedly"));
        return;
      }
    };

    worker.onerror = (ev: ErrorEvent) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(ev?.message || "worker error"));
    };

    worker.postMessage({
      type: "start",
      runId,
      templateId,
      searchOptions,
      stopSAB,
    });
  });
}

/**
 * Preferred entry point for running the logical search: tries the Worker
 * path first, and if that's unavailable or fails for any reason, falls back
 * to the exact same main-thread `runLogicalSearch` call that this codebase
 * used before worker support was wired up. This guarantees search behavior
 * is never worse than before this change, even in environments where Workers
 * or SharedArrayBuffer aren't usable (e.g. missing COOP/COEP isolation).
 */
async function runSearchOffThread(
  templateId: string,
  searchOptions: any,
  onProgress: (done: number, bestScore: number | null) => void
): Promise<{ results: any[]; diagnostics: any }> {
  try {
    return await runSearchInWorker(templateId, searchOptions, onProgress);
  } catch (e) {
    console.warn("[board] Worker search unavailable, falling back to main-thread search:", e);
    return await runLogicalSearch(templateId, searchOptions, (done: number, bestNow: any[]) => {
      const bestScore =
        bestNow && bestNow.length > 0 ? Number((bestNow[0] as any).score ?? (bestNow[0] as any).total ?? 0) : null;
      onProgress(done, bestScore);
    });
  }
}

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

// Mobile UX: prioritize vertical page scrolling.
// The map viewer tends to capture touch/pointer drags, so we gate map interaction behind an explicit toggle on mobile.
const [mobileMapInteract, setMobileMapInteract] = React.useState(true);

const prevIsNarrowRef = React.useRef<boolean | null>(null);

// Auto-disable map interaction after a short window on mobile (prevents "stuck" non-scroll feeling).
React.useEffect(() => {
  const prev = prevIsNarrowRef.current;
  prevIsNarrowRef.current = isNarrow;

  if (!isNarrow) {
    // Desktop: always allow interaction.
    setMobileMapInteract(true);
    return;
  }
  // When entering mobile layout, default to scroll-first.
  if (prev === null || prev === false) setMobileMapInteract(false);
  if (!mobileMapInteract) return;
  const id = window.setTimeout(() => setMobileMapInteract(false), 8000);
  return () => window.clearTimeout(id);
}, [isNarrow, mobileMapInteract]);

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
  React.useEffect(() => {
    try {
      const v = Number(localStorage.getItem("gaia_search_placement_method"));
      if (v === 1 || v === 2 || v === 3) setPlacementMethod(v);
    } catch {}
  }, []);

  const resetResultsForTemplateChange = React.useCallback(() => {
    setSelectedPlacement(null);
    setSelectedSeedLabel(null);
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
  // no reset side effects matter).
  React.useEffect(() => {
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
  const [showMapToolbar, setShowMapToolbar] = React.useState(false);
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
  const [wScout, setWScout] = React.useState(6);
  const [wScoutCore, setWScoutCore] = React.useState(4);

  const [wScoutS1, setWScoutS1] = React.useState(6);
  const [wScoutS2, setWScoutS2] = React.useState(6);
  const [wScoutS3, setWScoutS3] = React.useState(6);
  const [wScoutS4, setWScoutS4] = React.useState(6);

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
  const [wGaiaD2, setWGaiaD2] = React.useState(3);
  const [wGaiaD3, setWGaiaD3] = React.useState(1);
  const [wClusterSize, setWClusterSize] = React.useState(1);

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

  const [showGlossary, setShowGlossary] = React.useState(false);

  const templateId = React.useMemo(() => {
    return String((template as any).templateId ?? (template as any).id ?? (which === "3p" ? "3p_lostFleet" : "4p_lostFleet"));
  }, [template, which]);

  // Active (unused) persistence capacity per spec: max(TopK, 100).
  const capacityActive = React.useMemo(() => Math.max(keepTop, 100), [keepTop]);

  const didAutoApplyRef = React.useRef(false);

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
        // 基本版の新評価軸（フィールド不在の旧/LFプロファイルは既定値のまま）
        if (params?.soft?.wGaiaDist1 != null) setWGaiaD1(Number(params.soft.wGaiaDist1) || 0);
        if (params?.soft?.wGaiaDist2 != null) setWGaiaD2(Number(params.soft.wGaiaDist2) || 0);
        if (params?.soft?.wGaiaDist3 != null) setWGaiaD3(Number(params.soft.wGaiaDist3) || 0);
        if (params?.soft?.wClusterSize != null) setWClusterSize(Number(params.soft.wClusterSize) || 0);
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
    [setWhich, setOuterSameColorMax, setCenterMode, setMaxConnectedPlanets, setH5IncludeScouts, setWOuter, setWTouch, setWScout, setWScoutCore, setScoutRadius, setWColorPref, setPrefBLACK, setPrefBLUE, setPrefBROWN, setPrefORANGE, setPrefRED, setPrefWHITE, setPrefYELLOW, setKeepTop, setShowSavedConditions]
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
    return isBase
      ? {
          wOuter,
          wTouch,
          wImbalance,
          imbalanceMetric,
          wGaiaDist1: wGaiaD1,
          wGaiaDist2: wGaiaD2,
          wGaiaDist3: wGaiaD3,
          wClusterSize,
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
          wColorPref,
          colorPrefByType: { BLACK: prefBLACK, BLUE: prefBLUE, BROWN: prefBROWN, ORANGE: prefORANGE, RED: prefRED, WHITE: prefWHITE, YELLOW: prefYELLOW },
        };
  }, [isBase, wOuter, wTouch, wScout, wScoutCore, wScoutS1, wScoutS2, wScoutS3, wScoutS4, wScoutCoreS1, wScoutCoreS2, wScoutCoreS3, wScoutCoreS4, scoutCoreAttribBest, scoutRadius, wImbalance, imbalanceMetric, wGaiaD1, wGaiaD2, wGaiaD3, wClusterSize, wColorPref, prefBLACK, prefBLUE, prefBROWN, prefORANGE, prefRED, prefWHITE, prefYELLOW]);

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
  const allSectors = React.useMemo<any[]>(() => {
    const base = Array.isArray(BASE_SECTORS) ? (BASE_SECTORS as any[]) : [];
    const mid = Array.isArray(EXPANSION_MIDDLE) ? (EXPANSION_MIDDLE as any[]) : [];
    const lit = Array.isArray(EXPANSION_LITTLE) ? (EXPANSION_LITTLE as any[]) : [];
    const sc = Array.isArray(EXPANSION_SCOUT) ? (EXPANSION_SCOUT as any[]) : [];
    return [...base, ...mid, ...lit, ...sc];
  }, []);

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

  // UI: offsets (確定済み)
  const imgOffsetBySlotId = React.useMemo(() => {
    return {
      M1: { dx: 14, dy: -118 },
      M2: { dx: 14, dy: -118 },
      M3: { dx: 14, dy: -118 },
      M4: { dx: 14, dy: -118 },
      M5: { dx: 44, dy: -74 },
      M6: { dx: 44, dy: -74 },
      M7: { dx: 44, dy: -74 },
      M8: { dx: 46, dy: -72 },
      S1: { dx: 18, dy: -60 },
      S2: { dx: 18, dy: -60 },
      S3: { dx: 18, dy: -60 },
      S4: { dx: 18, dy: -60 },
      S5: { dx: 18, dy: -60 },
      S6: { dx: 18, dy: -60 },
      S7: { dx: 18, dy: -60 },
      S8: { dx: 18, dy: -60 },
      S9: { dx: 18, dy: -60 },
      S10: { dx: 18, dy: -60 },
    } as const;
  }, []);

  const rotOffsetsBySlotId = React.useMemo(() => {
    return {
      M1: { 0: { dx: 0, dy: 0 }, 2: { dx: 74, dy: 176 }, 4: { dx: -114, dy: 150 } },
      M2: { 0: { dx: 0, dy: 0 }, 2: { dx: 74, dy: 176 }, 4: { dx: -114, dy: 150 } },
      M3: { 0: { dx: 0, dy: 0 }, 2: { dx: 74, dy: 176 }, 4: { dx: -114, dy: 150 } },
      M4: { 0: { dx: 0, dy: 0 }, 2: { dx: 74, dy: 176 }, 4: { dx: -114, dy: 150 } },
      M5: { 1: { dx: 0, dy: 0 }, 3: { dx: -26, dy: 70 }, 5: { dx: 48, dy: 58 } },
      M6: { 1: { dx: 0, dy: 0 }, 3: { dx: -26, dy: 70 }, 5: { dx: 48, dy: 58 } },
      M7: { 1: { dx: 0, dy: 0 }, 3: { dx: -26, dy: 70 }, 5: { dx: 48, dy: 58 } },
      M8: { 1: { dx: 0, dy: 0 }, 3: { dx: -26, dy: 70 }, 5: { dx: 48, dy: 58 } },
    } as const;
  }, []);

  
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

  const PLANET_ORDER = ["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW"] as const;
  type PlanetTypeKey = (typeof PLANET_ORDER)[number];

  const PLANET_LABEL_JA: Record<PlanetTypeKey, string> = {
    BLACK: "黒",
    BLUE: "青",
    BROWN: "茶",
    ORANGE: "橙",
    RED: "赤",
    WHITE: "白",
    YELLOW: "黄",
  };

  // 色優遇/冷遇の入力欄背景（内訳テーブルの ROW_BG と同じ配色）
  const PLANET_INPUT_BG: Record<PlanetTypeKey, string> = {
    BLACK: "#adadad",
    BLUE: "#cfe8ff",
    BROWN: "#e7d3b1",
    ORANGE: "#ffe0b2",
    RED: "#ffd2d2",
    WHITE: "#ffffff",
    YELLOW: "#fff9c4",
  };

  function axisGet(axis: any, k: PlanetTypeKey): number {
    const v = axis?.[k];
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function fmt0(n: number): string {
    return (Math.round(n * 1000) / 1000).toFixed(0);
  }

  function renderColorBreakdownTable(breakdown: any, opts?: { cols?: any }) {
  if (!breakdown) return null;

  const outer = breakdown?.axesByType?.outer ?? null;
  const touch = breakdown?.axesByType?.touch ?? null;
  const scout = breakdown?.axesByType?.scout ?? null;
  const scoutCore = breakdown?.axesByType?.scoutCore ?? null;
  const gaia = breakdown?.axesByType?.gaia ?? null;
  const cluster = breakdown?.axesByType?.cluster ?? null;
  const totals = breakdown?.planetTypeTotals ?? null;

  const outerCnt = breakdown?.audit?.outerCountByType ?? null;
  const touchCnt = breakdown?.audit?.touchCountByType ?? null;

  const hasCounts = !!outerCnt || !!touchCnt;

  const colsIn = opts?.cols ?? {
    // NOTE: column order is controlled below. These booleans only control visibility.
    total: true,
    scout: true,
    scoutCore: true,
    gaia: true,
    cluster: true,
    outer: true,
    touch: true,
    cntOuter: hasCounts,
    cntTouch: hasCounts,
  };

  // 出し分け: base では scout/scoutCore を出さず、新軸（gaia/cluster）は
  // データがある場合のみ。LF では新軸を出さない（従来表示のまま）。
  const cols = {
    ...colsIn,
    ...(isBase
      ? { scout: false, scoutCore: false, gaia: !!gaia && (colsIn as any).gaia !== false, cluster: !!cluster && (colsIn as any).cluster !== false }
      : { gaia: false, cluster: false }),
  };

  // --- order: total -> scout -> scoutCore -> gaia -> cluster -> outer -> touch (counts at the end) ---
  const COL_ORDER: Array<keyof typeof cols> = ["total", "scout", "scoutCore", "gaia", "cluster", "outer", "touch", "cntOuter", "cntTouch"];

  const COL_LABEL: Record<string, { ja: string; en: string }> = {
    total: { ja: "評価", en: "total" },
    scout: { ja: "船接触", en: "scout" },
    scoutCore: { ja: "船星系", en: "scoutCore" },
    gaia: { ja: "ガイア近接", en: "gaia" },
    cluster: { ja: "星系", en: "cluster" },
    outer: { ja: "最外周", en: "outer" },
    touch: { ja: "辺境", en: "touch" },
    cntOuter: { ja: "外周数", en: "outerCnt" },
    cntTouch: { ja: "隣接数", en: "touchCnt" },
  };

  const ROW_BG: Record<string, string> = {
    BLACK: "#adadad", // black => light gray
    BLUE: "#cfe8ff",
    BROWN: "#e7d3b1",
    ORANGE: "#ffe0b2",
    RED: "#ffd2d2",
    WHITE: "#ffffff",
    YELLOW: "#fff9c4",
    PROTO: "#cdeffd",
    ASTEROID: "#e6d1ff",
  };

  const thStyle: React.CSSProperties = {
    borderBottom: "1px solid #ddd",
    padding: "6px 8px",
    textAlign: "right",
    fontSize: 12,
    background: "#fafafa",
    position: "sticky",
    top: 0,
    zIndex: 1,
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    padding: "6px 8px",
    textAlign: "right",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    whiteSpace: "nowrap",
  };

  const tdLeftStyle: React.CSSProperties = {
    ...tdStyle,
    textAlign: "left",
    fontFamily: "inherit",
    fontWeight: 700,
  };

  const rowStyleFor = (key: string): React.CSSProperties => ({
    background: ROW_BG[key] ?? "transparent",
  });

// --- extremes coloring among base 7 (max=blue, min=red; ties apply to all) ---
const EPS = 1e-9;
const computeExtremes = (keys: string[], getValue: (k: string) => number) => {
  let maxV = -Infinity;
  let minV = Infinity;
  for (const k of keys) {
    const v = getValue(k);
    if (!Number.isFinite(v)) continue;
    if (v > maxV) maxV = v;
    if (v < minV) minV = v;
  }
  const maxKeys = new Set<string>();
  const minKeys = new Set<string>();
  for (const k of keys) {
    const v = getValue(k);
    if (!Number.isFinite(v)) continue;
    if (Math.abs(v - maxV) <= EPS) maxKeys.add(k);
    if (Math.abs(v - minV) <= EPS) minKeys.add(k);
  }
  return { maxKeys, minKeys };
};

const baseKeysForExtreme = [...PLANET_ORDER]; // fixed base-7
const exTotal = computeExtremes(baseKeysForExtreme, (k) => axisGet(totals, k as any));
const exScout = computeExtremes(baseKeysForExtreme, (k) => axisGet(scout, k as any));
const exScoutCore = computeExtremes(baseKeysForExtreme, (k) => axisGet(scoutCore, k as any));
const exGaia = computeExtremes(baseKeysForExtreme, (k) => axisGet(gaia, k as any));
const exCluster = computeExtremes(baseKeysForExtreme, (k) => axisGet(cluster, k as any));
// outer/touch are colored by (outer + touch) combined, applied to both columns
const exOuterTouch = computeExtremes(baseKeysForExtreme, (k) => axisGet(outer, k as any) + axisGet(touch, k as any));

const colorFor = (maxKeys: Set<string>, minKeys: Set<string>, k: string): string | undefined => {
  if (maxKeys.has(k)) return "#0b5fff"; // blue
  if (minKeys.has(k)) return "#d0021b"; // red
  return undefined;
};

  // sort base 7 colors by total desc (PROTO/ASTEROID stay at the end)
  const sortedKeys = [...PLANET_ORDER].sort((a, b) => axisGet(totals, b) - axisGet(totals, a));

  const renderCell = (colKey: keyof typeof cols, k: string) => {
    if (!cols[colKey]) return null;

    if (colKey === "total") {
      return <td style={{ ...tdStyle, fontWeight: 800, color: colorFor(exTotal.maxKeys, exTotal.minKeys, k) }}>{axisGet(totals, k as any)}</td>;
    }
    if (colKey === "scout") {
      return <td style={{ ...tdStyle, color: colorFor(exScout.maxKeys, exScout.minKeys, k) }}>{axisGet(scout, k as any)}</td>;
    }
    if (colKey === "scoutCore") {
      return <td style={{ ...tdStyle, color: colorFor(exScoutCore.maxKeys, exScoutCore.minKeys, k) }}>{axisGet(scoutCore, k as any)}</td>;
    }
    if (colKey === "gaia") {
      return <td style={{ ...tdStyle, color: colorFor(exGaia.maxKeys, exGaia.minKeys, k) }}>{axisGet(gaia, k as any)}</td>;
    }
    if (colKey === "cluster") {
      return <td style={{ ...tdStyle, color: colorFor(exCluster.maxKeys, exCluster.minKeys, k) }}>{axisGet(cluster, k as any)}</td>;
    }
    if (colKey === "outer") {
      return <td style={{ ...tdStyle, color: colorFor(exOuterTouch.maxKeys, exOuterTouch.minKeys, k) }}>{axisGet(outer, k as any)}</td>;
    }
    if (colKey === "touch") {
      return <td style={{ ...tdStyle, color: colorFor(exOuterTouch.maxKeys, exOuterTouch.minKeys, k) }}>{axisGet(touch, k as any)}</td>;
    }
    if (colKey === "cntOuter") {
      return <td style={tdStyle}>{outerCnt ? axisGet(outerCnt, k as any) : "-"}</td>;
    }
    if (colKey === "cntTouch") {
      return <td style={tdStyle}>{touchCnt ? axisGet(touchCnt, k as any) : "-"}</td>;
    }
    return null;
  };

  return (
    <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 8 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: hasCounts ? 760 : 620 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: "left" }}>{lang === "ja" ? "色" : "Color"}</th>
            {COL_ORDER.map((ck) => {
              if (!cols[ck]) return null;
              // counts only appear if hasCounts is true
              if ((ck === "cntOuter" || ck === "cntTouch") && !hasCounts) return null;
              const label = lang === "ja" ? COL_LABEL[String(ck)].ja : COL_LABEL[String(ck)].en;
              return (
                <th key={String(ck)} style={thStyle}>
                  {label}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {sortedKeys.map((k) => {
            const colorLabel = lang === "ja" ? `${PLANET_LABEL_JA[k]}` : k;

            return (
              <tr key={k} style={rowStyleFor(k)}>
                <td style={tdLeftStyle}>{colorLabel}</td>
                {COL_ORDER.map((ck) => (
                  <React.Fragment key={`${k}_${String(ck)}`}>{renderCell(ck, k)}</React.Fragment>
                ))}
              </tr>
            );
          })}

          {/* Extras (PROTO/ASTEROID): keep at the end, and follow the same column toggles */}
          {(() => {
            const scoutExtra = breakdown?.audit?.scout?.extraByKind ?? null;
            const scoutCoreExtra = breakdown?.audit?.scoutCore?.extraByKind ?? null;
            const kinds = ["PROTO", "ASTEROID"] as const;

            const hasAny =
              (scoutExtra && (scoutExtra.PROTO || scoutExtra.ASTEROID)) ||
              (scoutCoreExtra && (scoutCoreExtra.PROTO || scoutCoreExtra.ASTEROID));

            if (!hasAny) return null;

            const labelJa: Record<string, string> = { PROTO: "原始", ASTEROID: "小惑星" };

            return kinds.map((k) => {
              const vScout = Number((scoutExtra as any)?.[k] ?? 0) || 0;
              const vCore = Number((scoutCoreExtra as any)?.[k] ?? 0) || 0;
              const vOuter = 0;
              const vTouch = 0;
              const vTotal = vScout + vCore;

              const label = lang === "ja" ? labelJa[k] : k;

              const cellForExtra = (colKey: keyof typeof cols) => {
                if (!cols[colKey]) return null;
                if (colKey === "total") return <td style={{ ...tdStyle, fontWeight: 800 }}>{vTotal}</td>;
                if (colKey === "scout") return <td style={tdStyle}>{vScout}</td>;
                if (colKey === "scoutCore") return <td style={tdStyle}>{vCore}</td>;
                if (colKey === "gaia" || colKey === "cluster") return <td style={tdStyle}>-</td>;
                if (colKey === "outer") return <td style={tdStyle}>{vOuter}</td>;
                if (colKey === "touch") return <td style={tdStyle}>{vTouch}</td>;
                if (colKey === "cntOuter") return hasCounts ? <td style={tdStyle}>-</td> : null;
                if (colKey === "cntTouch") return hasCounts ? <td style={tdStyle}>-</td> : null;
                return null;
              };

              return (
                <tr key={`EXTRA_${k}`} style={rowStyleFor(k)}>
                  <td style={tdLeftStyle}>{label}</td>
                  {COL_ORDER.map((ck) => (
                    <React.Fragment key={`EXTRA_${k}_${String(ck)}`}>{cellForExtra(ck)}</React.Fragment>
                  ))}
                </tr>
              );
            });
          })()}
        </tbody>
      </table>
    </div>
  );
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
        // 基本版専用の新評価軸（LFではフィールドごと省略=evaluateSoftが完全スキップ）
        ...(isBase
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


  const curHashFromResult = getPlacementHashForResult(currentResult);
  const curImb = getImbalanceSummary(currentResult);
  const curOT = getOuterTouchCounts(currentResult);
  const curScout = getScoutSummary(currentResult);
  const curScoutCore = getScoutCoreSummary(currentResult);

  // 用語集（英→日＋意味）
  const glossary = React.useMemo(
    () => [
      { term: "score", ja: "スコア", desc: "色毎の強さが近い程高くなります（惑星種別ごとの評価値が乖離していない程高くなります）", en: "score", descEn: "Higher when planet-type totals are balanced (colors are close in strength)." },
      { term: "outer", ja: "最外周", desc: "マップの最も外に配置されている惑星", en: "outer", descEn: "Planets on the outermost ring of the map." },
      { term: "touch", ja: "外周", desc: "最外周の一つ内側に配置されている惑星", en: "touch", descEn: "Planets one ring inside the outermost." },
      { term: "scout", ja: "船接触", desc: "船に近い程惑星種別の評価が高くなります", en: "scout", descEn: "The closer to a scout ship, the higher the planet type is valued." },
      { term: "scoutCore", ja: "船星系", desc: "船に接触している惑星が近くに多い程評価が高くなります", en: "scoutCore", descEn: "Higher when more scout-touching planets are clustered nearby." },
      { term: "radius", ja: "船接触半径", desc: "船に接触しているとみなす距離", en: "radius", descEn: "Distance within which a planet counts as touching a scout." },
      { term: "std", ja: "標準偏差", desc: "惑星種別別 totals の分散（ばらつき）指標。", en: "std", descEn: "Spread (variance) metric across planet-type totals." },
      { term: "range", ja: "範囲", desc: "惑星種別別 totals の最大−最小（ばらつき）指標。", en: "range", descEn: "Max − min spread across planet-type totals." },
      { term: "Top-K", ja: "上位ランク", desc: "スコア上位からK件保持するランキング結果。", en: "Top-K", descEn: "Ranking that keeps the top K results by score." },
      { term: "Hard", ja: "制約条件", desc: "満たさない候補は即棄却する制約", en: "Hard", descEn: "Constraints that immediately reject any board that fails them." },
      { term: "Soft", ja: "評価指数", desc: "満たした候補を順位付けする評価", en: "Soft", descEn: "Weighted scoring that ranks the boards that passed." },
      { term: "colorPreference", ja: "色優遇/冷遇", desc: "＋なら該当色が強い程全体スコアが上がります", en: "colorPreference", descEn: "Positive raises the overall score as that color gets stronger." },
          ],
    []
  );

  // Mobile: show Top-K early; PC order remains unchanged.
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
        {t("resultsModeActive")}
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
        <input type="radio" checked={resultsMode === "used"} onChange={() => setResultsMode("used")} />
        {t("resultsModeUsed")}
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
                border: "1px solid #e5e5e5",
                borderRadius: 8,
                background: "white",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800, fontSize: 12 }}>{idx + 1}.</span>
                <span style={{ fontSize: 12 }}>
                  <span style={{ opacity: 0.7 }}>{t("rankScore")}:</span> {fmt0(rawScore)}
                </span>
                <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
                  {hash}
                </span>
  
                <span style={{ marginLeft: "auto" }} />
  
                {resultsMode === "active" ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkUsed(String(hashFull));
                    }}
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
      {/* --- header --- */}
      <div style={{ padding: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <TabNav active="map" />
        <div style={{ fontWeight: 700 }}>{t("title")}</div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{t("language")}</div>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
            <input type="radio" name="lang" checked={lang === "en"} onChange={() => setLang("en")} />
            <span>{t("en")}</span>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
            <input type="radio" name="lang" checked={lang === "ja"} onChange={() => setLang("ja")} />
            <span>{t("ja")}</span>
          </label>
        </div>

        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span>{t("players")}</span>
          <select value={players} onChange={(e) => applySharedSelection(Number(e.target.value), expansion)}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="radio"
              name="mapExpansion"
              checked={expansion === "base"}
              onChange={() => applySharedSelection(players, "base")}
            />
            <span>{t("expansionBase")}</span>
          </label>
          <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="radio"
              name="mapExpansion"
              checked={expansion === "lostFleet"}
              onChange={() => applySharedSelection(players, "lostFleet")}
            />
            <span>{t("expansionLF")}</span>
          </label>
        </div>

        {isBase ? (
          <label
            style={{ display: "flex", gap: 6, alignItems: "center" }}
            title={t("placementMethodTip")}
          >
            <span>{t("placementMethod")}</span>
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


        <button onClick={handleGenerateRank} disabled={busy || !mapSupported} style={{ padding: "6px 10px", fontWeight: 700 }}>
          {busy ? t("searching") : t("runSearch")}
        </button>

        <button
          onClick={handleToggleContinuous}
          disabled={(busy && !continuousMode) || !mapSupported}
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
          <span>Export/Import</span>
        </label>

<label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
  <input type="checkbox" checked={showSavedConditions} onChange={(e) => setShowSavedConditions(e.target.checked)} />
  <span>{t("savedConditions")}</span>
</label>

<label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
  <input type="checkbox" checked={showMapToolbar} onChange={(e) => setShowMapToolbar(e.target.checked)} />
  <span>{t("mapTools")}</span>
</label>

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
                      {tid}
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
                const title = hasParams ? `${tid}` : `${p.templateId ?? ""}`;

                const hardSummary = hasParams
                  ? `${t("hard")}: ${t("outerSameColorMax")}=${String(params?.hard?.outerSameColorMax ?? "-")}, ${t("centerMode")}=${String(
                      params?.hard?.centerMode ?? "-"
                    )}, ${t("maxConnectedPlanets")}=${String(params?.hard?.maxConnectedPlanets ?? 0)}, ${t("h5IncludeScouts")}=${String(
                      !!params?.hard?.h5IncludeScouts
                    )}`
                  : `${t("legacyUnknown")}`;

                const softSummary = hasParams
                  ? `${t("soft")}: ${t("wOuter")}=${String(params?.soft?.wOuter ?? "-")}, ${t("wTouch")}=${String(params?.soft?.wTouch ?? "-")}, ${t(
                      "wScout"
                    )}=${String(params?.soft?.wScout ?? "-")}, ${t("wScoutCore")}=${String(params?.soft?.wScoutCore ?? "-")}, wScoutByKey{twilight=${String(params?.soft?.wScoutByScoutKey?.twilight ?? params?.soft?.wScoutByScoutKey?.S1 ?? "-")},eclipse=${String(params?.soft?.wScoutByScoutKey?.eclipse ?? params?.soft?.wScoutByScoutKey?.S2 ?? "-")},rebellion=${String(params?.soft?.wScoutByScoutKey?.rebellion ?? params?.soft?.wScoutByScoutKey?.S3 ?? "-")},tfmars=${String(params?.soft?.wScoutByScoutKey?.tfmars ?? params?.soft?.wScoutByScoutKey?.S4 ?? "-")}}, wScoutCoreByKey{twilight=${String(params?.soft?.wScoutCoreByScoutKey?.twilight ?? params?.soft?.wScoutCoreByScoutKey?.S1 ?? "-")},eclipse=${String(params?.soft?.wScoutCoreByScoutKey?.eclipse ?? params?.soft?.wScoutCoreByScoutKey?.S2 ?? "-")},rebellion=${String(params?.soft?.wScoutCoreByScoutKey?.rebellion ?? params?.soft?.wScoutCoreByScoutKey?.S3 ?? "-")},tfmars=${String(params?.soft?.wScoutCoreByScoutKey?.tfmars ?? params?.soft?.wScoutCoreByScoutKey?.S4 ?? "-")}}, scoutCoreAttrib=${String(params?.soft?.scoutCoreAttributionMode ?? "-")}, ${t(
                      "scoutRadiusLabel"
                    )}=${String(params?.soft?.scoutRadius ?? "-")}, ${t("metric")}=${String(params?.soft?.imbalanceMetric ?? "-")}`
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
                      <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2, fontFamily: "monospace" }}>{p.searchKey}</div>
                      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                        active={p.activeCount} / used={p.usedCount}
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
            overflow: isNarrow ? "hidden" : "auto",
            WebkitOverflowScrolling: isNarrow ? undefined : "touch",
            // Mobile: allow the browser to handle vertical pan gestures for page scrolling.
            touchAction: isNarrow ? "pan-y" : undefined,
            height: isNarrow ? "60dvh" : "auto",
            minHeight: isNarrow ? 320 : 0,
          }}
        >
          {/* Mobile: keep scrolling natural by disabling map drag by default.
              Tap the overlay to temporarily enable map interaction. */}
          {isNarrow && !mobileMapInteract ? (
            <div
              onClick={() => setMobileMapInteract(true)}
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 5,
                // Fully transparent overlay that still allows native scrolling.
                background: "transparent",
                touchAction: "pan-y",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 10,
                  top: 10,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid #ddd",
                  background: "rgba(255,255,255,0.9)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {lang === "ja" ? "スクロール優先（タップでマップ操作）" : "Scroll first (tap to interact with map)"}
              </div>
            </div>
          ) : null}

          {isNarrow && mobileMapInteract ? (
            <button
              onClick={() => setMobileMapInteract(false)}
              style={{
                position: "absolute",
                right: 10,
                top: 10,
                zIndex: 6,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #ddd",
                background: "rgba(255,255,255,0.92)",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {lang === "ja" ? "スクロールに戻す" : "Back to scroll"}
            </button>
          ) : null}

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
              showToolbar={showMapToolbar}
              // Mobile: disable drag/pan by default so vertical page scrolling is not hijacked.
              // Desktop: keep original behavior.
              disablePan={isNarrow ? !mobileMapInteract : false}
            />
          </div>

          {errorMsg ? <div style={{ padding: 10, color: "crimson", fontSize: 13, whiteSpace: "pre-wrap" }}>{errorMsg}</div> : null}
        </div>

        {/* Right: Results */}
        <div
          style={{
            width: isNarrow ? "100%" : 1080,
            flexGrow: isNarrow ? 1 : 0,
            // Allow this pane to shrink below its preferred 1080px once the map's
            // 480px floor (above) needs the room; it still won't go below 640px,
            // which keeps the results readable. 480 + 640 = 1120 <= the 1180px
            // narrow-layout breakpoint, so wide layouts never fight for space.
            flexShrink: isNarrow ? 0 : 1,
            flexBasis: isNarrow ? "auto" : 1080,
            minWidth: isNarrow ? undefined : 640,
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
                <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.75 }}>System</summary>
                <div style={{ fontFamily: "monospace", fontSize: 11, opacity: 0.85, marginTop: 4 }}>
                  {t("seed")}={String(selectedSeedLabel ?? seed ?? "-")}  /  {t("placementHashResult")}={curHashFromResult}  /  {t("placementHashView")}={currentHash}
                </div>

                <div style={{ marginTop: 8, fontSize: 12 }}>
                  {t("score")}={currentResult ? Number(currentResult.score ?? 0 ).toFixed(3) : "-"}
                </div>

                <div style={{ marginTop: 4, fontSize: 12 }}>
                  {t("imbalance")} ({curImb.metric})={currentResult ? (Math.round(curImb.value * 1000) / 1000).toFixed(3) : "-"}
                </div>

                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.9 }}>
                  {t("outerCnt")}={currentResult ? curOT.outerSum : "-"} / {t("touchCnt")}={currentResult ? curOT.touchSum : "-"}
                </div>

                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.9 }}>
                  {t("scoutRadius")}={curScout.radius ?? "-"} / {t("scoutTotal")}={currentResult ? curScout.scoutTotal : "-"}
                </div>

                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.9 }}>
                  {t("scoutCoreRadius")}={curScoutCore.radius ?? "-"} / {t("scoutCoreTotal")}={currentResult ? curScoutCore.totalCore : "-"}
                  {currentResult ? <span> / {t("extra")}={curScoutCore.totalExtra}</span> : null}
                </div>
              </details>

              {currentResult ? (
                <details open suppressHydrationWarning style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.85 }}>
                    {isBase
                      ? lang === "ja"
                        ? "色別の内訳（outer/touch/gaia/cluster/total）"
                        : "By color (outer/touch/gaia/cluster/total)"
                      : lang === "ja"
                        ? "色別の内訳（outer/touch/scout/total）"
                        : "By color (outer/touch/scout/total)"}
                  </summary>
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>
                        {lang === "ja" ? "詳細表表示" : "Table columns"}
                      </span>

                      {(isBase
                        ? ([
                            ["total", "評価", "total"],
                            ["gaia", "ガイア近接", "gaia"],
                            ["cluster", "星系", "cluster"],
                            ["outer", "最外周", "outer"],
                            ["touch", "辺境", "touch"],
                          ] as const)
                        : ([
                            ["total", "評価", "total"],
                            ["scout", "船接触", "scout"],
                            ["scoutCore", "船星系", "scoutCore"],
                            ["outer", "最外周", "outer"],
                            ["touch", "辺境", "touch"],
                          ] as const)
                      ).map(([k, ja, en]) => (
                        <label key={k} style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={(breakdownCols as any)[k]}
                            onChange={(e) =>
                              setBreakdownCols((prev) => ({ ...prev, [k]: e.target.checked }))
                            }
                          />
                          <span>{lang === "ja" ? ja : en}</span>
                        </label>
                      ))}
                    </div>

                    <div style={{ marginTop: 8 }}>{renderColorBreakdownTable(getBreakdown(currentResult), { cols: breakdownCols })}</div>
                </details>
              ) : null}

{currentResult ? (
  <>
  </>
) : null}

              {currentResult ? (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.85 }}>{t("breakdown")}</summary>
                  <pre style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap", overflowX: "auto" }}>
                    {JSON.stringify(getBreakdown(currentResult), null, 2)}
                  </pre>
                </details>
              ) : (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>{t("noCurrentResult")}</div>
              )}
            </div>

            {/* Glossary */}
            <div style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 700 }}>{t("glossary")}</div>
                <button onClick={() => setShowGlossary((v) => !v)} style={{ padding: "2px 8px", fontSize: 12 }}>
                  {showGlossary ? t("hide") : t("show")}
                </button>
              </div>

              {showGlossary ? (
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  {glossary.map((g) => (
                    <div key={g.term} style={{ padding: "6px 0", borderTop: "1px dashed #eee" }}>
                      <div style={{ fontFamily: "monospace" }}>
                        {g.term}
                        {lang === "ja" ? (
                          <span style={{ opacity: 0.75 }}>
                            {" "}
                            / {g.ja}
                          </span>
                        ) : null}
                      </div>
                      <div style={{ marginTop: 2, opacity: 0.85 }}>{lang === "ja" ? g.desc : g.descEn}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Controls */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span>{t("trials")}</span>
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
                <span>{t("topK")}</span>
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
              <div style={{ fontWeight: 700, fontSize: 12 }}>{t("hard")}</div>

              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span>{t("outerSameColorMax")}</span>
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
                <span>{t("maxConnectedPlanets")}</span>
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
                  <span>{t("h5IncludeScouts")}</span>
                </label>
              ) : null}

              {!isBase ? (
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span>{t("centerMode")}</span>
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
              <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.9 }}>
                {t("soft")}
              </summary>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 12 }}>{t("soft")}</div>

              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span>{t("wOuter")}</span>
                <input type="number" value={wOuter} min={0} max={10} onChange={(e) => setWOuter(Number(e.target.value) || 0)} style={{ width: 60 }} />
              </label>

              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span>{t("wTouch")}</span>
                <input type="number" value={wTouch} min={0} max={10} onChange={(e) => setWTouch(Number(e.target.value) || 0)} style={{ width: 60 }} />
              </label>

              {isBase ? (
                <>
                  <label style={{ display: "flex", gap: 6, alignItems: "center" }} title={t("wGaiaTip")}>
                    <span>{t("wGaiaD1")}</span>
                    <input type="number" value={wGaiaD1} min={0} max={20} onChange={(e) => setWGaiaD1(Number(e.target.value) || 0)} style={{ width: 60 }} />
                  </label>
                  <label style={{ display: "flex", gap: 6, alignItems: "center" }} title={t("wGaiaTip")}>
                    <span>{t("wGaiaD2")}</span>
                    <input type="number" value={wGaiaD2} min={0} max={20} onChange={(e) => setWGaiaD2(Number(e.target.value) || 0)} style={{ width: 60 }} />
                  </label>
                  <label style={{ display: "flex", gap: 6, alignItems: "center" }} title={t("wGaiaTip")}>
                    <span>{t("wGaiaD3")}</span>
                    <input type="number" value={wGaiaD3} min={0} max={20} onChange={(e) => setWGaiaD3(Number(e.target.value) || 0)} style={{ width: 60 }} />
                  </label>
                  <label style={{ display: "flex", gap: 6, alignItems: "center" }} title={t("wClusterTip")}>
                    <span>{t("wClusterSize")}</span>
                    <input type="number" value={wClusterSize} min={0} max={20} onChange={(e) => setWClusterSize(Number(e.target.value) || 0)} style={{ width: 60 }} />
                  </label>
                </>
              ) : null}

              {!isBase ? (
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span>{t("radius")}</span>
                <input
                  type="number"
                  value={scoutRadius}
                  min={1}
                  max={12}
                  onChange={(e) => setScoutRadius(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                  style={{ width: 60 }}
                />

<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10, alignItems: "start" }}>
  <label style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
    <span>{t("wScoutS1")}</span>
    <input type="number" value={wScoutS1} min={0} max={20} onChange={(e) => setWScoutS1(Number(e.target.value) || 0)} style={{ width: 110, maxWidth: "100%", flex: "0 0 auto" }} />
  </label>
  <label style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
    <span>{t("wScoutS2")}</span>
    <input type="number" value={wScoutS2} min={0} max={20} onChange={(e) => setWScoutS2(Number(e.target.value) || 0)} style={{ width: 110, maxWidth: "100%", flex: "0 0 auto" }} />
  </label>
  <label style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
    <span>{t("wScoutS3")}</span>
    <input type="number" value={wScoutS3} min={0} max={20} onChange={(e) => setWScoutS3(Number(e.target.value) || 0)} style={{ width: 110, maxWidth: "100%", flex: "0 0 auto" }} />
  </label>
  <label style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
    <span>{t("wScoutS4")}</span>
    <input type="number" value={wScoutS4} min={0} max={20} onChange={(e) => setWScoutS4(Number(e.target.value) || 0)} style={{ width: 110, maxWidth: "100%", flex: "0 0 auto" }} />
  </label>

  <label style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
    <span>{t("wScoutCoreS1")}</span>
    <input type="number" value={wScoutCoreS1} min={0} max={20} onChange={(e) => setWScoutCoreS1(Number(e.target.value) || 0)} style={{ width: 110, maxWidth: "100%", flex: "0 0 auto" }} />
  </label>
  <label style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
    <span>{t("wScoutCoreS2")}</span>
    <input type="number" value={wScoutCoreS2} min={0} max={20} onChange={(e) => setWScoutCoreS2(Number(e.target.value) || 0)} style={{ width: 110, maxWidth: "100%", flex: "0 0 auto" }} />
  </label>
  <label style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
    <span>{t("wScoutCoreS3")}</span>
    <input type="number" value={wScoutCoreS3} min={0} max={20} onChange={(e) => setWScoutCoreS3(Number(e.target.value) || 0)} style={{ width: 110, maxWidth: "100%", flex: "0 0 auto" }} />
  </label>
  <label style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
    <span>{t("wScoutCoreS4")}</span>
    <input type="number" value={wScoutCoreS4} min={0} max={20} onChange={(e) => setWScoutCoreS4(Number(e.target.value) || 0)} style={{ width: 110, maxWidth: "100%", flex: "0 0 auto" }} />
  </label>

  <label style={{ display: "flex", gap: 8, alignItems: "center", gridColumn: "1 / -1", flexWrap: "wrap" }}>
    <input type="checkbox" checked={scoutCoreAttribBest} onChange={(e) => setScoutCoreAttribBest(e.target.checked)} />
    <span>{t("scoutCoreAttribBest")}</span>
  </label>
</div>


              </label>
              ) : null}

              <div style={{ width: "100%", borderTop: "1px dashed #ddd", marginTop: 8, paddingTop: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{t("colorPreference")}</div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
                  <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span>{t("wColorPref")}</span>
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