// src/app/board/persistence.ts
//
// /board の検索結果・保存条件の永続化層（IndexedDB）。page.tsx から抽出
// （2026-07-23 コンテキスト効率化、挙動不変）。仕様コメントは各宣言に残置。

export type RankedResult = {
  seed: string;
  score: number;
  placement: any[];
  placementHash?: string;
  evaluation: any; // { total, breakdown, audit }
};

// -----------------------------
// Persisted search results (local, IndexedDB)
// Spec:
// - Per searchKey (templateId + hard/soft + algo/eval versions)
// - Active candidates are capped by capacityActive = max(TopK, 100)
// - Used candidates are stored in a separate bucket (not counted toward capacityActive)
// - used=true candidates stay excluded from Top-K views; score info may still be updated on merge
// - TopK itself is NOT part of searchKey
// -----------------------------

export const SEARCH_ALGO_VERSION = "search_v1";
// eval_v2: fixed 4p_lostFleet M2/M5 slotCenters (src/gaia/templates/4p_lostfleet_slotCenters.ts),
// which were copy-pasted from the 3p file and did not match the display-side
// positions, causing cell collisions in the evaluated 4p board. Placement
// generation (seed -> placement) is unaffected; only evaluation results change.
export const EVAL_VERSION = "eval_v2";

export type PersistedCandidate = {
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
  // ピン留め（一覧タブ用、2026-07-24 TODO ③）。ピン留め中の active 行は
  // capacityActive の剪定対象から除外される（used と同様に消えない）。
  pinned?: boolean;
  pinnedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type PersistedProfile = {
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

export const IDB_NAME = "gaia_map_cache";
// v5: setups store added (setup-side saved list; see src/lib/setupHistory.ts).
// v6: Setup/List も Map と同じ「条件プロファイル + 条件ごとの結果バケツ」構造へ
//     （2026-07-30 ユーザー確定）。旧 setups は条件とシードが1行に同居していて
//     移行できないため、アップグレード時に破棄する（旧データ破棄もユーザー確定）。
//     List の結果（提案・ログ）は件数が小さいので localStorage のまま、
//     各行に条件キーを持たせて分ける。
// v7: Setup の一括探索のランキングを条件×基準ごとに貯める setup_ranking を追加
//     （2026-07-31。Map の candidates と同じで、次の探索は前回の上位とマージする）。
export const IDB_VERSION = 7;
export const STORE_CANDIDATES = "candidates";
export const STORE_PROFILES = "profiles";
// Setup-side saved list shares this DB (one DB per origin keeps the version
// handling in a single place). CRUD lives in src/lib/setupHistory.ts.
export const STORE_SETUPS = "setups";
/** Setup の条件プロファイル（Map の profiles と同じ役割）。 */
export const STORE_SETUP_PROFILES = "setup_profiles";
/** List の条件プロファイル。 */
export const STORE_LIST_PROFILES = "list_profiles";
/** Setup の一括探索ランキング（条件×基準ごと）。CRUD は src/lib/setupRanking.ts。 */
export const STORE_SETUP_RANKING = "setup_ranking";
export const LAST_APPLIED_SEARCHKEY = "gaia_last_applied_searchKey_v1";


let _dbPromise: Promise<IDBDatabase> | null = null;


export function openDb(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);

    // 別タブが古いバージョンの接続を握っていると upgrade が始まらず、
    // 何も言わずに固まる（保存・読み出しが全部止まる）。待ち続けずに失敗させ、
    // 呼び出し側の catch で「空扱い」に落とす（2026-07-30）。
    req.onblocked = () => {
      _upgradeBlocked = true;
      _dbPromise = null;
      reject(
        new Error(
          "IndexedDB upgrade blocked: 別のタブでこのアプリを開いたままにすると更新できません。他のタブを閉じて再読み込みしてください。"
        )
      );
    };

    req.onupgradeneeded = (ev) => {
      const db = req.result;
      const tx = req.transaction as IDBTransaction;
      // 新規作成は 0。「この upgrade で初めて通る移行」を判定するのに使う。
      const oldVersion = Number((ev as IDBVersionChangeEvent).oldVersion ?? 0);

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

      // ----- setups (v5) / condition profiles (v6) -----
      // Small rows (~hundreds of bytes each, capped at 100 unpinned/unused);
      // listing does a full getAll + in-JS sort, so no indexes are needed.
      if (!db.objectStoreNames.contains(STORE_SETUPS)) {
        db.createObjectStore(STORE_SETUPS, { keyPath: "id" });
      } else if (oldVersion > 0 && oldVersion < 6) {
        // v6: 行の形（条件込みの入力 -> 条件キー+シード）が変わるので中身を捨てる。
        // 判定は oldVersion で行う。db.version は upgrade 中「新しい方」なので、
        // これを見ると v6 以降のどの upgrade でも保存リストを消してしまう
        // （v7 追加時に発覚。2026-07-31）。
        try {
          tx.objectStore(STORE_SETUPS).clear();
        } catch {}
      }
      for (const name of [STORE_SETUP_PROFILES, STORE_LIST_PROFILES]) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "key" });
        }
      }
      // ----- setup_ranking (v7) -----
      // 条件×基準ごとに上位N件だけを持つ小さなストア（keyPath は candidates/setups と
      // 同じ "id"）。件数が小さいので getAll + JS 側で絞る。
      if (!db.objectStoreNames.contains(STORE_SETUP_RANKING)) {
        db.createObjectStore(STORE_SETUP_RANKING, { keyPath: "id" });
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

    req.onsuccess = () => {
      const db = req.result;
      // 別タブが新しいバージョンで開こうとしたら、こちらの接続を手放す。
      // これをやらないと相手側の upgrade が始まらず、相手のタブで保存・読み出しが
      // 全部止まる（2026-07-30 に実際に踏んだ）。次に使うときは開き直す。
      db.onversionchange = () => {
        try {
          db.close();
        } catch {}
        _dbPromise = null;
      };
      // タブが閉じられた等で接続が切れたら、キャッシュを捨てて次回開き直せるようにする。
      db.onclose = () => {
        _dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      _dbPromise = null; // 失敗を握り続けない（次の呼び出しで再試行できる）
      reject(req.error);
    };
  });

  return _dbPromise;
}

/**
 * 「他のタブが握っていて更新できない」状態になったかどうか。
 * 画面側で案内を出すために使う（openDb は待ち続けずに失敗する）。
 */
let _upgradeBlocked = false;
export function isDbUpgradeBlocked(): boolean {
  return _upgradeBlocked;
}
export function markDbUpgradeBlocked(): void {
  _upgradeBlocked = true;
}


export async function idbGetAllByIndex<T>(
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

export async function idbGetAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  // getAll() は現行ブラウザでは基本OK。型安全にラップします。
  return await new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);

    const req = store.getAll();
    req.onsuccess = () => resolve((req.result ?? []) as T[]);
    req.onerror = () => reject(req.error ?? new Error("idbGetAll failed"));
  });
}


export async function idbPutAll<T>(db: IDBDatabase, storeName: string, rows: T[]): Promise<void> {
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

export async function idbDeleteByIds(db: IDBDatabase, storeName: string, ids: string[]): Promise<void> {
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


export async function idbGetAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
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

export async function idbGetByKey<T>(db: IDBDatabase, storeName: string, key: any): Promise<T | undefined> {
  return await new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result as any);
  });
}

export async function idbClearStore(db: IDBDatabase, storeName: string): Promise<void> {
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

export function stableStringify(x: any): string {
  if (x === null || typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(stableStringify).join(",") + "]";
  const keys = Object.keys(x).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(x[k])).join(",") + "}";
}

export async function sha256Hex(s: string): Promise<string> {
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

export function seedTieKey(seed: string): number {
  // Supports "123_0" and plain numeric.
  const n = parseInt(seed.split("_")[0] ?? seed, 10);
  return Number.isFinite(n) ? n : 0;
}

export function toRankedResult(c: PersistedCandidate): RankedResult {
  return {
    seed: String(c.seed),
    score: Number(c.score),
    placement: c.placement ?? [],
    placementHash: c.placementHash,
    evaluation: c.evaluation,
  } as any;
}

export function betterThan(a: PersistedCandidate, b: PersistedCandidate): boolean {
  // Higher score is better; tie-break by numeric seed.
  if (a.score !== b.score) return a.score > b.score;
  return seedTieKey(a.seed) < seedTieKey(b.seed);
}

export type MergeResult = {
  active: PersistedCandidate[];
  used: PersistedCandidate[];
  deletedActiveIds: string[];
};

export function mergeCandidates(
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
    const pinned = Boolean(prev.pinned) || Boolean(cand.pinned);
    const pinnedAt = prev.pinnedAt ?? cand.pinnedAt;
    const base = betterThan(cand, prev) ? cand : prev;
    map.set(key, {
      ...base,
      used,
      usedKey: used ? 1 : 0,
      usedAt,
      pinned,
      ...(pinnedAt !== undefined ? { pinnedAt } : {}),
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
  // ピン留め行は容量あふれでも消さない（used と同じく保護される）
  const keptActive = [
    ...activeAll.slice(0, capacityActive),
    ...activeAll.slice(capacityActive).filter((c) => c.pinned),
  ];

  // Active deletions: any previously-active id not in kept set (e.g., capacity shrunk)
  const keptIds = new Set(keptActive.map((c) => c.id));
  const deletedActiveIds = existingActive.map((c) => c.id).filter((id) => !keptIds.has(id));

  return { active: keptActive, used, deletedActiveIds };
}

export async function loadFromDb(searchKey: string, capacityActive: number): Promise<{ active: PersistedCandidate[]; used: PersistedCandidate[] }> {
  const db = await openDb();
  // NOTE: IndexedDB keys must be finite (Infinity/-Infinity are invalid).
  const MIN_RANK = -9_007_199_254_740_991; // Number.MIN_SAFE_INTEGER
  const MAX_RANK =  9_007_199_254_740_991; // Number.MAX_SAFE_INTEGER
  const rngActive = IDBKeyRange.bound([searchKey, 0, MIN_RANK], [searchKey, 0, MAX_RANK]);
  const rngUsed = IDBKeyRange.bound([searchKey, 1, MIN_RANK], [searchKey, 1, MAX_RANK]);

  const active = await idbGetAllByIndex<PersistedCandidate>(db, STORE_CANDIDATES, "bySearchKeyUsedKeyRank", rngActive);
  const used = await idbGetAllByIndex<PersistedCandidate>(db, STORE_CANDIDATES, "bySearchKeyUsedKeyRank", rngUsed);

  // Ensure active is capped (in case of older versions); pinned rows survive the trim.
  const sorted = active
    .slice()
    .sort((a, b) => b.score - a.score || seedTieKey(a.seed) - seedTieKey(b.seed));
  const activeSorted = [
    ...sorted.slice(0, capacityActive),
    ...sorted.slice(capacityActive).filter((c) => c.pinned),
  ];

  // If we trimmed, delete extras to keep DB consistent
  const keepIds = new Set(activeSorted.map((c) => c.id));
  const toDelete = active.map((c) => c.id).filter((id) => !keepIds.has(id));
  if (toDelete.length > 0) await idbDeleteByIds(db, STORE_CANDIDATES, toDelete);

  return { active: activeSorted, used };
}

export async function saveMergeToDb(searchKey: string, merged: MergeResult): Promise<void> {
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
export async function loadProfilesFromDb(limit: number = 200): Promise<PersistedProfile[]> {
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
export async function loadProfilesByBaseKeyRaw(baseKeyRaw: string): Promise<PersistedProfile[]> {
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



export async function upsertProfileToDb(searchKey: string, patch: Partial<PersistedProfile>): Promise<PersistedProfile | null> {
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



export async function deleteProfileOnlyFromDb(searchKey: string): Promise<void> {
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

export async function deleteProfileAndAllMapsFromDb(searchKey: string): Promise<void> {
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
