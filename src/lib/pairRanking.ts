// src/lib/pairRanking.ts
//
// Pair の順位表・探索済み・保存した組の保存（2026-10-17 v2.3.0、ユーザー確定「どちらも推奨」: IndexedDB へ、保存した組も）。
//
// v2.1〜v2.2 は localStorage（gaia_pair_ranking_v1 / gaia_pair_explored_v1 / gaia_list_proposals_v2）に、1 行ごとに配置の写し
// （4p LF で 1.4KB）を持っていた。双方向 500 組ずつで約 1.9MB になり、localStorage の上限（5MB、他の鍵と共用）に近い。
// ここでは IndexedDB（gaia_map_cache v11。Map の結果バケツ・Setup の候補と同じ所）に次の 4 ストアで持つ:
//   pair_maps     盤面。鍵 `${tid}|${hash}`、配置は共有 URL と同じトークン（163 バイト）で 1 回だけ。played（プレイ済み）の印
//   pair_rows     順位表の行。鍵 `${rankKey}|${mapKey}|${seed}`。盤面は mapKey で参照、セットアップは入力（60 バイト前後）
//   pair_explored 探索済みの件数。鍵 `${rankKey}|${mapKey}`
//   pair_saved    保存した組。鍵 id、盤面は mapKey で参照
// rankKey ＝ hashString(stableStringify({ players, lf, criterion, evalWeights, dir }))（8 桁。探索の向きごとに別の順位表）。
// 1 行 200 バイト前後、盤面 330 バイト前後。双方向 500 組 ＋ 盤面 100 枚で 0.25MB ほど。
//
// 順位表の形（ユーザー確定 2026-10-17）: 「主」（マップ → セットアップならマップ、セットアップ → マップならセットアップ）ごとに
// 上位 PAIR_PER_PRIMARY（10）組、主は PAIR_PRIMARIES（50）件まで。候補一覧は主ごとに 1 行（最良の相手）で、詳細で別の相手を選べる。

import type { BuildSetupInput } from "@/gaia/setup/buildSetup";
import type { RecommendCriterion } from "@/gaia/eval/factionEval";
import type { SetupWeights } from "@/gaia/eval/setupWeights";
import { decodePlacementToken, encodePlacementToken, hashString } from "@/gaia/ssot/placementHash";
import {
  idbDeleteByIds,
  idbGetAllFromStore,
  idbPutAll,
  openDb,
  stableStringify,
  STORE_PAIR_EXPLORED,
  STORE_PAIR_MAPS,
  STORE_PAIR_ROWS,
  STORE_PAIR_SAVED,
} from "@/app/board/persistence";

export type PairDirKey = "mapToSetup" | "setupToMap";
/** 主ごとに残す組の数 */
export const PAIR_PER_PRIMARY = 10;
/** 残す主の数 */
export const PAIR_PRIMARIES = 50;

export type PairMapRow = {
  /** `${tid}|${hash}` */
  key: string;
  tid: string;
  hash: string;
  /** 配置のトークン（encodePlacementToken） */
  token: string;
  /** 評価し直すときの条件プロファイル（Map の検索キー） */
  searchKey: string;
  score: number;
  /** プレイ済み（Pair の「プレイ済みにする」。結果バケツに無い盤面のための印） */
  played?: boolean;
  updatedAt: number;
};

export type PairRow = {
  /** `${rankKey}|${mapKey}|${seed}` */
  id: string;
  rankKey: string;
  mapKey: string;
  seed: string;
  input: BuildSetupInput;
  score: number;
  criterion: RecommendCriterion;
  players: number;
  lf: boolean;
  createdAt: number;
  round: number;
};

export type PairExploredRow = { key: string; rankKey: string; mapKey: string; trials: number };

export type PairSavedRow = {
  id: string;
  /** Pair の条件バケツ（conditionKeyOf(conditionParams)） */
  conditionKey: string;
  mapKey: string;
  seed: string;
  input: BuildSetupInput;
  criterion: RecommendCriterion;
  players: number;
  lf: boolean;
  createdAt: number;
};

export type PairData = {
  maps: Record<string, PairMapRow>;
  rows: PairRow[];
  explored: PairExploredRow[];
  saved: PairSavedRow[];
};

export function pairMapKey(tid: string, hash: string): string {
  return `${tid}|${hash}`;
}
export function pairRowId(rankKey: string, mapKey: string, seed: string): string {
  return `${rankKey}|${mapKey}|${seed}`;
}
export function pairExploredKey(rankKey: string, mapKey: string): string {
  return `${rankKey}|${mapKey}`;
}
export function pairRankKeyOf(p: { players: number; lf: boolean; criterion: RecommendCriterion; evalWeights: SetupWeights; dir: PairDirKey }): string {
  return hashString(stableStringify(p));
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pairMapRowOf(tid: string, hash: string, placement: any[], searchKey: string, score: number): PairMapRow {
  return { key: pairMapKey(tid, hash), tid, hash, token: encodePlacementToken(placement), searchKey, score, updatedAt: Date.now() };
}

/** 主（マップ → セットアップならマップ、セットアップ → マップならセットアップ） */
export function primaryOf(row: { mapKey: string; seed: string }, dir: PairDirKey): string {
  return dir === "mapToSetup" ? row.mapKey : row.seed;
}

export type PairGroup<T> = { primary: string; rows: T[] };

/** 純粋: 主ごとにまとめ、主の中は基準値の降順、主どうしは最良の基準値の降順 */
export function groupPairRows<T extends { mapKey: string; seed: string; score: number }>(rows: T[], dir: PairDirKey): Array<PairGroup<T>> {
  const by = new Map<string, T[]>();
  for (const r of rows) {
    const k = primaryOf(r, dir);
    const a = by.get(k);
    if (a) a.push(r);
    else by.set(k, [r]);
  }
  const out: Array<PairGroup<T>> = [];
  for (const [primary, list] of by) out.push({ primary, rows: list.slice().sort((a, b) => b.score - a.score) });
  return out.sort((a, b) => b.rows[0].score - a.rows[0].score || (a.primary < b.primary ? -1 : 1));
}

/**
 * 純粋: 既存の行と新しい行をマージして、主ごとに上位 perPrimary 組、主を primaries 件まで残す。
 * 同じ組（id）は新しい方の score、古い方の createdAt。戻り値は残す行と消す id。
 */
export function mergePairRows(existing: PairRow[], fresh: PairRow[], dir: PairDirKey, perPrimary: number = PAIR_PER_PRIMARY, primaries: number = PAIR_PRIMARIES): { keep: PairRow[]; dropIds: string[] } {
  const byId = new Map<string, PairRow>();
  for (const r of existing) byId.set(r.id, r);
  for (const r of fresh) {
    const prev = byId.get(r.id);
    byId.set(r.id, prev ? { ...r, createdAt: prev.createdAt } : r);
  }
  const groups = groupPairRows([...byId.values()], dir).slice(0, primaries);
  const keep: PairRow[] = [];
  for (const g of groups) keep.push(...g.rows.slice(0, perPrimary));
  const keepIds = new Set(keep.map((r) => r.id));
  const dropIds = existing.map((r) => r.id).filter((id) => !keepIds.has(id));
  return { keep, dropIds };
}

/** 純粋: 上位のマップのうち、まだ N 件に届いていないもの（残りの件数つき）。入力順を保つ */
export function unexploredOf<T>(maps: T[], keyOf: (m: T) => string, explored: Record<string, number>, n: number): Array<{ map: T; remaining: number }> {
  const out: Array<{ map: T; remaining: number }> = [];
  for (const map of maps) {
    const done = Number(explored[keyOf(map)] ?? 0) || 0;
    if (done < n) out.push({ map, remaining: n - done });
  }
  return out;
}

// ---------------- IndexedDB ----------------

export async function loadPairData(): Promise<PairData> {
  const db = await openDb();
  const [maps, rows, explored, saved] = await Promise.all([
    idbGetAllFromStore<PairMapRow>(db, STORE_PAIR_MAPS),
    idbGetAllFromStore<PairRow>(db, STORE_PAIR_ROWS),
    idbGetAllFromStore<PairExploredRow>(db, STORE_PAIR_EXPLORED),
    idbGetAllFromStore<PairSavedRow>(db, STORE_PAIR_SAVED),
  ]);
  const m: Record<string, PairMapRow> = {};
  for (const r of maps) m[r.key] = r;
  return { maps: m, rows, explored, saved };
}

/** 盤面の配置（トークンを戻す。壊れていれば null） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function placementOfMapRow(m: PairMapRow | undefined): any[] | null {
  if (!m) return null;
  try {
    return decodePlacementToken(m.token);
  } catch {
    return null;
  }
}

/** 盤面を登録（既存なら score / searchKey だけ更新、played は保つ） */
export async function upsertPairMaps(maps: PairMapRow[]): Promise<void> {
  if (maps.length === 0) return;
  const db = await openDb();
  const existing = await idbGetAllFromStore<PairMapRow>(db, STORE_PAIR_MAPS);
  const prev = new Map(existing.map((m) => [m.key, m]));
  const rows = maps.map((m) => {
    const p = prev.get(m.key);
    return p ? { ...p, score: m.score, searchKey: m.searchKey, updatedAt: m.updatedAt } : m;
  });
  await idbPutAll(db, STORE_PAIR_MAPS, rows);
}

/** 順位表へマージ（主ごと上位 perPrimary、主 primaries 件）。盤面も登録する */
export async function savePairRows(rankKey: string, dir: PairDirKey, fresh: PairRow[], maps: PairMapRow[]): Promise<void> {
  await upsertPairMaps(maps);
  const db = await openDb();
  const all = await idbGetAllFromStore<PairRow>(db, STORE_PAIR_ROWS);
  const mine = all.filter((r) => r.rankKey === rankKey);
  const { keep, dropIds } = mergePairRows(mine, fresh, dir);
  await idbDeleteByIds(db, STORE_PAIR_ROWS, dropIds);
  await idbPutAll(db, STORE_PAIR_ROWS, keep);
  await pruneUnreferencedMaps(db);
}

export async function clearPairRanking(rankKey: string): Promise<void> {
  const db = await openDb();
  const all = await idbGetAllFromStore<PairRow>(db, STORE_PAIR_ROWS);
  await idbDeleteByIds(db, STORE_PAIR_ROWS, all.filter((r) => r.rankKey === rankKey).map((r) => r.id));
  const ex = await idbGetAllFromStore<PairExploredRow>(db, STORE_PAIR_EXPLORED);
  await idbDeleteByIds(db, STORE_PAIR_EXPLORED, ex.filter((r) => r.rankKey === rankKey).map((r) => r.key));
  await pruneUnreferencedMaps(db);
}

/** どの行からも参照されず、プレイ済みの印も無い盤面を消す（容量の節約） */
async function pruneUnreferencedMaps(db: IDBDatabase): Promise<void> {
  const [maps, rows, saved] = await Promise.all([
    idbGetAllFromStore<PairMapRow>(db, STORE_PAIR_MAPS),
    idbGetAllFromStore<PairRow>(db, STORE_PAIR_ROWS),
    idbGetAllFromStore<PairSavedRow>(db, STORE_PAIR_SAVED),
  ]);
  const used = new Set<string>([...rows.map((r) => r.mapKey), ...saved.map((r) => r.mapKey)]);
  await idbDeleteByIds(db, STORE_PAIR_MAPS, maps.filter((m) => !used.has(m.key) && !m.played).map((m) => m.key));
}

export async function setPairExplored(rankKey: string, mapKey: string, trials: number): Promise<void> {
  const db = await openDb();
  const key = pairExploredKey(rankKey, mapKey);
  const all = await idbGetAllFromStore<PairExploredRow>(db, STORE_PAIR_EXPLORED);
  const prev = all.find((r) => r.key === key);
  await idbPutAll(db, STORE_PAIR_EXPLORED, [{ key, rankKey, mapKey, trials: Math.max(prev?.trials ?? 0, trials) }]);
}

export function exploredMapOf(explored: PairExploredRow[], rankKey: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of explored) if (r.rankKey === rankKey) out[r.mapKey] = r.trials;
  return out;
}

export async function addPairSaved(row: PairSavedRow, map: PairMapRow | null): Promise<void> {
  if (map) await upsertPairMaps([map]);
  const db = await openDb();
  await idbPutAll(db, STORE_PAIR_SAVED, [row]);
}

export async function deletePairSaved(id: string): Promise<void> {
  const db = await openDb();
  await idbDeleteByIds(db, STORE_PAIR_SAVED, [id]);
  await pruneUnreferencedMaps(db);
}

export async function deletePairSavedByCondition(conditionKey: string): Promise<void> {
  const db = await openDb();
  const all = await idbGetAllFromStore<PairSavedRow>(db, STORE_PAIR_SAVED);
  await idbDeleteByIds(db, STORE_PAIR_SAVED, all.filter((r) => r.conditionKey === conditionKey).map((r) => r.id));
  await pruneUnreferencedMaps(db);
}

/** 盤面にプレイ済みの印（結果バケツに無い盤面でも Pair から除外できるように） */
export async function markPairMapPlayed(map: PairMapRow, played: boolean): Promise<void> {
  const db = await openDb();
  const all = await idbGetAllFromStore<PairMapRow>(db, STORE_PAIR_MAPS);
  const prev = all.find((m) => m.key === map.key) ?? map;
  await idbPutAll(db, STORE_PAIR_MAPS, [{ ...prev, played, updatedAt: Date.now() }]);
}

// ---------------- localStorage からの移行（v2.3.0。1 回だけ） ----------------

const LS_OLD_RANKING = "gaia_pair_ranking_v1";
const LS_OLD_EXPLORED = "gaia_pair_explored_v1";
const LS_OLD_PROPOSALS = "gaia_list_proposals_v2";

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 旧の条件の鍵（stableStringify({players, lf, criterion, evalWeights})）→ 新しい rankKey（向きは マップ → セットアップ とみなす） */
function rankKeyOfOldConditionKey(conditionKey: string): string | null {
  const o = parseJson<{ players: number; lf: boolean; criterion: RecommendCriterion; evalWeights: SetupWeights }>(conditionKey);
  if (!o || typeof o !== "object") return null;
  return pairRankKeyOf({ players: o.players, lf: o.lf, criterion: o.criterion, evalWeights: o.evalWeights, dir: "mapToSetup" });
}

/**
 * localStorage の順位表・探索済み・保存した組を IndexedDB へ移し、鍵を消す。何か移したら true。
 * 旧の順位表の行は向きを持たないので マップ → セットアップ の順位表として入れる。
 */
export async function migratePairLocalStorage(): Promise<boolean> {
  let moved = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oldRows = parseJson<any[]>(localStorage.getItem(LS_OLD_RANKING));
    if (Array.isArray(oldRows) && oldRows.length > 0) {
      const byRank = new Map<string, PairRow[]>();
      const maps: PairMapRow[] = [];
      for (const r of oldRows) {
        const rankKey = rankKeyOfOldConditionKey(String(r.conditionKey ?? ""));
        if (!rankKey || !r.tid || !r.mapHash || !Array.isArray(r.mapPlacement)) continue;
        const mapKey = pairMapKey(String(r.tid), String(r.mapHash));
        maps.push(pairMapRowOf(String(r.tid), String(r.mapHash), r.mapPlacement, String(r.mapSearchKey ?? ""), Number(r.mapScore ?? 0)));
        const row: PairRow = { id: pairRowId(rankKey, mapKey, String(r.seed)), rankKey, mapKey, seed: String(r.seed), input: r.setupInput, score: Number(r.score ?? 0), criterion: r.criterion, players: Number(r.players ?? 4), lf: !!r.lf, createdAt: Number(r.createdAt ?? Date.now()), round: Number(r.round ?? 0) };
        const a = byRank.get(rankKey);
        if (a) a.push(row);
        else byRank.set(rankKey, [row]);
      }
      for (const [rankKey, rows] of byRank) await savePairRows(rankKey, "mapToSetup", rows, maps);
      moved = true;
    }
    const oldExplored = parseJson<Record<string, Record<string, number>>>(localStorage.getItem(LS_OLD_EXPLORED));
    if (oldExplored && typeof oldExplored === "object") {
      const db = await openDb();
      const maps = await idbGetAllFromStore<PairMapRow>(db, STORE_PAIR_MAPS);
      const byHash = new Map(maps.map((m) => [m.hash, m.key]));
      const rows: PairExploredRow[] = [];
      for (const [ck, byMap] of Object.entries(oldExplored)) {
        const rankKey = rankKeyOfOldConditionKey(ck);
        if (!rankKey) continue;
        for (const [hash, trials] of Object.entries(byMap ?? {})) {
          const mapKey = byHash.get(hash);
          if (!mapKey) continue;
          rows.push({ key: pairExploredKey(rankKey, mapKey), rankKey, mapKey, trials: Number(trials) || 0 });
        }
      }
      await idbPutAll(db, STORE_PAIR_EXPLORED, rows);
      moved = true;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oldSaved = parseJson<any[]>(localStorage.getItem(LS_OLD_PROPOSALS));
    if (Array.isArray(oldSaved) && oldSaved.length > 0) {
      for (const p of oldSaved) {
        if (!p?.tid || !Array.isArray(p.mapPlacement) || !p.setupInput) continue;
        const hash = String(p.mapHash ?? "");
        const map = hash ? pairMapRowOf(String(p.tid), hash, p.mapPlacement, "", Number(p.mapScore ?? 0)) : null;
        await addPairSaved(
          { id: String(p.id), conditionKey: String(p.conditionKey ?? ""), mapKey: map ? map.key : "", seed: String(p.setupInput.seed), input: p.setupInput, criterion: p.criterion ?? "topBalance", players: Number(p.players ?? 4), lf: !!p.lf, createdAt: Number(p.createdAt ?? Date.now()) },
          map
        );
      }
      moved = true;
    }
    localStorage.removeItem(LS_OLD_RANKING);
    localStorage.removeItem(LS_OLD_EXPLORED);
    localStorage.removeItem(LS_OLD_PROPOSALS);
  } catch {
    // 移行できなければそのまま（次回また試す）
  }
  return moved;
}
