// src/lib/searchProfiles.ts
//
// 探索プロファイル（2026-10-16 ユーザー確定 A-(a) / B-(a)。段階 1「条件の統一」）。
//
// 1 つのプロファイル ＝ 共通部（種族優遇）＋ Map 部（検索キー＝テンプレート・制約・評価指数）＋ Setup 部（条件キー＝
// タイル指定・面・評価指数）。Map と Setup はそれぞれ自分の部分を「登録」し、同じプロファイル名の下にぶら下がる。
// 結果バケツの鍵（Map の searchKey、Setup の conditionKey）は変えない。プロファイルはその 2 つの鍵を束ねる索引で、
// 貯めた結果はそのまま見える（互換の鉄則）。
//
// 人数・拡張は従来どおり sharedSettings（共通バー）が持つ。プロファイルには Map 部のテンプレート / Setup 部の人数として
// 入っているので、「このプロファイルの Map 条件は 4人 LF」のように表示で照合できる。
//
// 保存は localStorage（JSON 1 本）。書き込みはユーザー操作のハンドラからだけ（CLAUDE.md「復元 effect ＋ 書込み effect を
// 併用しない」）。同じページ内の複数コンポーネントは window のイベントで同期する。

import React from "react";
import { FACTIONS, type FactionId } from "@/gaia/eval/factionWeights";

export type SearchProfileMap = {
  searchKey: string;
  /** stableStringify(searchKeyParams)。Map ページがこれを state に戻せる */
  paramsRaw: string;
  templateId: string;
};

export type SearchProfileSetup = {
  conditionKey: string;
  /** Setup の条件プロファイルの params（{ setup, evalWeights }）。Setup ページがこれを state に戻せる */
  params: unknown;
};

export type SearchProfile = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** 種族優遇／冷遇（種族 id → ±。0 はキーごと落とす） */
  factionPref: Record<string, number>;
  map?: SearchProfileMap | null;
  setup?: SearchProfileSetup | null;
};

export const LS_SEARCH_PROFILES = "gaia_search_profiles_v1";
export const LS_SEARCH_PROFILE_ACTIVE = "gaia_search_profile_active_v1";
const EVENT = "gaia-search-profiles";

export const DEFAULT_PROFILE_NAME = { ja: "既定", en: "Default" } as const;

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function sanitizeFactionPref(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  const ids = new Set<string>(FACTIONS.map((f) => f.id));
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (!ids.has(k) || !Number.isFinite(n) || n === 0) continue;
    out[k] = n;
  }
  return out;
}

function sanitizeProfile(raw: unknown): SearchProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  const map = r.map && typeof r.map === "object" ? (r.map as SearchProfileMap) : null;
  const setup = r.setup && typeof r.setup === "object" ? (r.setup as SearchProfileSetup) : null;
  return {
    id: r.id,
    name: typeof r.name === "string" ? r.name : "",
    createdAt: Number(r.createdAt) || 0,
    updatedAt: Number(r.updatedAt) || 0,
    factionPref: sanitizeFactionPref(r.factionPref),
    map: map && typeof map.searchKey === "string" ? { searchKey: map.searchKey, paramsRaw: String(map.paramsRaw ?? ""), templateId: String(map.templateId ?? "") } : null,
    setup: setup && typeof setup.conditionKey === "string" ? { conditionKey: setup.conditionKey, params: setup.params ?? null } : null,
  };
}

export function readSearchProfiles(): SearchProfile[] {
  const raw = lsGet(LS_SEARCH_PROFILES);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(sanitizeProfile).filter((p): p is SearchProfile => !!p);
  } catch {
    return [];
  }
}

function writeSearchProfiles(list: SearchProfile[]): void {
  lsSet(LS_SEARCH_PROFILES, JSON.stringify(list));
  notify();
}

export function readActiveProfileId(): string | null {
  return lsGet(LS_SEARCH_PROFILE_ACTIVE);
}

export function writeActiveProfileId(id: string | null): void {
  lsSet(LS_SEARCH_PROFILE_ACTIVE, id);
  notify();
}

function notify(): void {
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // SSR など
  }
}

function newId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** プロファイルを 1 つも持たないときに「既定」を作って返す（復元時の便宜。書き込みは呼び出し側の操作に限る） */
export function createSearchProfile(name: string, patch?: Partial<Omit<SearchProfile, "id" | "createdAt" | "updatedAt">>): SearchProfile {
  const now = Date.now();
  const p: SearchProfile = {
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    factionPref: sanitizeFactionPref(patch?.factionPref),
    map: patch?.map ?? null,
    setup: patch?.setup ?? null,
  };
  writeSearchProfiles([...readSearchProfiles(), p]);
  writeActiveProfileId(p.id);
  return p;
}

export function updateSearchProfile(id: string, patch: Partial<Omit<SearchProfile, "id" | "createdAt">>): SearchProfile | null {
  const list = readSearchProfiles();
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return null;
  const next: SearchProfile = {
    ...list[i],
    ...patch,
    factionPref: patch.factionPref !== undefined ? sanitizeFactionPref(patch.factionPref) : list[i].factionPref,
    updatedAt: Date.now(),
  };
  list[i] = next;
  writeSearchProfiles(list);
  return next;
}

export function removeSearchProfile(id: string): void {
  const list = readSearchProfiles().filter((p) => p.id !== id);
  writeSearchProfiles(list);
  if (readActiveProfileId() === id) writeActiveProfileId(list[0]?.id ?? null);
}

/** 読み取り専用のスナップショット（useSyncExternalStore 用。同じ内容なら同じ参照を返す） */
let cache: { raw: string | null; active: string | null; profiles: SearchProfile[] } = { raw: null, active: null, profiles: [] };
function snapshot(): { profiles: SearchProfile[]; active: string | null } {
  const raw = lsGet(LS_SEARCH_PROFILES);
  const active = lsGet(LS_SEARCH_PROFILE_ACTIVE);
  if (raw !== cache.raw) cache = { raw, active, profiles: readSearchProfiles() };
  else if (active !== cache.active) cache = { ...cache, active };
  return cache;
}
const SERVER_SNAPSHOT = { profiles: [] as SearchProfile[], active: null as string | null };
function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * 探索プロファイルの購読。SSR とハイドレーション直後は空（プロファイル無し）で始まり、mount 後に確定する。
 * 「既定」プロファイルの自動作成はしない（書き込みは操作ハンドラだけ）。無いときの表示は呼び出し側で扱う。
 */
export function useSearchProfiles(): {
  profiles: SearchProfile[];
  active: SearchProfile | null;
  setActive: (id: string) => void;
  create: (name: string) => SearchProfile;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  setFactionPref: (id: string, pref: Record<string, number>) => void;
  bindMap: (id: string, map: SearchProfileMap | null) => void;
  bindSetup: (id: string, setup: SearchProfileSetup | null) => void;
} {
  const snap = React.useSyncExternalStore(subscribe, snapshot, () => SERVER_SNAPSHOT);
  const active = React.useMemo(() => snap.profiles.find((p) => p.id === snap.active) ?? null, [snap]);
  return {
    profiles: snap.profiles,
    active,
    setActive: React.useCallback((id: string) => writeActiveProfileId(id), []),
    create: React.useCallback((name: string) => createSearchProfile(name), []),
    rename: React.useCallback((id: string, name: string) => {
      updateSearchProfile(id, { name });
    }, []),
    remove: React.useCallback((id: string) => removeSearchProfile(id), []),
    setFactionPref: React.useCallback((id: string, pref: Record<string, number>) => {
      updateSearchProfile(id, { factionPref: pref });
    }, []),
    bindMap: React.useCallback((id: string, map: SearchProfileMap | null) => {
      updateSearchProfile(id, { map });
    }, []),
    bindSetup: React.useCallback((id: string, setup: SearchProfileSetup | null) => {
      updateSearchProfile(id, { setup });
    }, []),
  };
}

// ---------- 種族優遇 → 色優遇（Map の検索条件へ渡す形）----------

export const PREF_COLORS = ["BLACK", "BLUE", "BROWN", "ORANGE", "RED", "WHITE", "YELLOW"] as const;
export const PREF_EXTRA_COLORS = ["PROTO", "ASTEROID"] as const;

/** その色の種族（LF の原始・小惑星も含む） */
export function factionsOfColor(color: string): FactionId[] {
  return FACTIONS.filter((f) => f.color === color).map((f) => f.id);
}

/**
 * 種族優遇から Map の色優遇（colorPrefByType）を導く（2026-10-16 の仮置き。明日ユーザー確認）。
 * 同じ色の 2 種族のうち |値| が大きい方を採る。同じ大きさで符号が逆なら 0。
 * 基本 7 色は常にキーを持ち（0 も入れる）、原始・小惑星は 0 のときキーごと省略する
 * （Map の既存の検索キーとバイト不変に保つため）。
 */
export function colorPrefFromFactionPref(pref: Record<string, number>): Record<string, number> {
  const pick = (color: string): number => {
    let best = 0;
    let tie = false;
    for (const id of factionsOfColor(color)) {
      const v = Number(pref[id] ?? 0);
      if (!v) continue;
      if (Math.abs(v) > Math.abs(best)) {
        best = v;
        tie = false;
      } else if (Math.abs(v) === Math.abs(best) && v !== best) {
        tie = true;
      }
    }
    return tie ? 0 : best;
  };
  const out: Record<string, number> = {};
  for (const c of PREF_COLORS) out[c] = pick(c);
  for (const c of PREF_EXTRA_COLORS) {
    const v = pick(c);
    if (v !== 0) out[c] = v;
  }
  return out;
}

/** 色で指定したときに同じ色の 2 種族へ同じ値を入れる（UI の色の近道用） */
export function applyColorToFactionPref(pref: Record<string, number>, color: string, v: number): Record<string, number> {
  const next = { ...pref };
  for (const id of factionsOfColor(color)) {
    if (!Number.isFinite(v) || v === 0) delete next[id];
    else next[id] = v;
  }
  return next;
}

/** 色の 2 種族が同じ値なら その値、違えば null（色の入力欄の表示用） */
export function colorValueOfFactionPref(pref: Record<string, number>, color: string): number | null {
  const ids = factionsOfColor(color);
  if (ids.length === 0) return null;
  const vals = ids.map((id) => Number(pref[id] ?? 0));
  return vals.every((v) => v === vals[0]) ? vals[0] : null;
}
