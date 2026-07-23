// src/lib/setupHistory.ts
//
// /setup の保存リスト（ランキング骨組み、TODO ⑧）。
// 生成のたびに BuildSetupInput（シード＋条件のみ）を自動記録し、
// ピン留め最優先→生成の新しい順で並べる。使用済みは別ビュー。
// 未ピン・未使用は SETUP_HISTORY_CAP 件を超えると古い順に削除される
// （ピン留め・使用済みは上限にカウントしない — マップ側 active/used と同型）。
//
// 保存内容は入力のみ: buildSetupFromSeed は決定論的（regression snapshot で
// 保証）なので、表示時に再構築すれば完全に再現できる。id はキー互換の鉄則
// どおり「無効時フィールド省略」で構築済みの入力を stableStringify した文字列。
// 永続化は gaia_map_cache（IndexedDB, src/app/board/persistence.ts）の
// setups ストアに同居する。

import type { BuildSetupInput } from "@/gaia/setup/buildSetup";
import {
  openDb,
  STORE_SETUPS,
  idbDeleteByIds,
  idbGetAllFromStore,
  idbPutAll,
  stableStringify,
} from "@/app/board/persistence";

/** buildSetup 側の出力が変わったら上げる（骨組みでは表示区別に未使用、記録のみ）。 */
export const SETUP_ALGO_VERSION = "setup_v1";

/** 未ピン・未使用の保存上限（2026-07-23 ユーザー確定: 100件）。 */
export const SETUP_HISTORY_CAP = 100;

export type SavedSetup = {
  /** stableStringify(input)。同一シード＋条件の重複記録はこの id でスキップ。 */
  id: string;
  input: BuildSetupInput;
  algoVersion: string;
  pinned: boolean;
  used: boolean;
  createdAt: number;
  updatedAt: number;
  usedAt?: number;
};

export function setupHistoryId(input: BuildSetupInput): string {
  return stableStringify(input);
}

/** ピン留め最優先→生成の新しい順（同時刻は id で安定化）。 */
export function sortSaved(rows: SavedSetup[]): SavedSetup[] {
  return rows.slice().sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * 上限超過時に削除すべき id（未ピン・未使用のみ対象、古い createdAt から）。
 * ピン留め・使用済みは対象外かつ上限にカウントしない。
 */
export function overflowIds(rows: SavedSetup[], cap: number = SETUP_HISTORY_CAP): string[] {
  const plain = rows
    .filter((r) => !r.pinned && !r.used)
    .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1));
  return plain.slice(cap).map((r) => r.id);
}

export async function listSavedSetups(): Promise<SavedSetup[]> {
  try {
    const db = await openDb();
    const rows = await idbGetAllFromStore<SavedSetup>(db, STORE_SETUPS);
    return sortSaved(rows);
  } catch {
    return [];
  }
}

/**
 * 生成された setup を記録する。既存 id は createdAt（＝生成順）を保つため
 * 何も変更しない（重複スキップ）。記録後に上限超過分を剪定する。
 * 呼び出しはユーザー操作ハンドラのみ（localStorage 規律と同じ扱い）。
 */
export async function recordSetup(input: BuildSetupInput): Promise<SavedSetup[]> {
  const db = await openDb();
  const rows = await idbGetAllFromStore<SavedSetup>(db, STORE_SETUPS);
  const id = setupHistoryId(input);
  if (!rows.some((r) => r.id === id)) {
    const now = Date.now();
    const row: SavedSetup = {
      id,
      input,
      algoVersion: SETUP_ALGO_VERSION,
      pinned: false,
      used: false,
      createdAt: now,
      updatedAt: now,
    };
    rows.push(row);
    await idbPutAll(db, STORE_SETUPS, [row]);
    const drop = overflowIds(rows);
    if (drop.length > 0) await idbDeleteByIds(db, STORE_SETUPS, drop);
    if (drop.length > 0) {
      const dropSet = new Set(drop);
      return sortSaved(rows.filter((r) => !dropSet.has(r.id)));
    }
  }
  return sortSaved(rows);
}

async function patchSetup(
  id: string,
  patch: (row: SavedSetup) => SavedSetup
): Promise<SavedSetup[]> {
  const db = await openDb();
  const rows = await idbGetAllFromStore<SavedSetup>(db, STORE_SETUPS);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx >= 0) {
    const next = patch(rows[idx]);
    rows[idx] = next;
    await idbPutAll(db, STORE_SETUPS, [next]);
    // ピン/使用済み解除で通常枠に戻った分の超過を剪定
    const drop = overflowIds(rows);
    if (drop.length > 0) {
      await idbDeleteByIds(db, STORE_SETUPS, drop);
      const dropSet = new Set(drop);
      return sortSaved(rows.filter((r) => !dropSet.has(r.id)));
    }
  }
  return sortSaved(rows);
}

export function setSetupPinned(id: string, pinned: boolean): Promise<SavedSetup[]> {
  return patchSetup(id, (r) => ({ ...r, pinned, updatedAt: Date.now() }));
}

export function setSetupUsed(id: string, used: boolean): Promise<SavedSetup[]> {
  const now = Date.now();
  return patchSetup(id, (r) => ({
    ...r,
    used,
    updatedAt: now,
    ...(used ? { usedAt: now } : {}),
  }));
}

export async function deleteSavedSetup(id: string): Promise<SavedSetup[]> {
  const db = await openDb();
  await idbDeleteByIds(db, STORE_SETUPS, [id]);
  const rows = await idbGetAllFromStore<SavedSetup>(db, STORE_SETUPS);
  return sortSaved(rows);
}
