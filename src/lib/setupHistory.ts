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
// setup_v2: terra-no-fedPass の対象を AT01+AT12 のセットに拡張（回避の意味が変化）
export const SETUP_ALGO_VERSION = "setup_v2";

/** 未ピン・未使用の保存上限（2026-07-23 ユーザー確定: 100件）。 */
export const SETUP_HISTORY_CAP = 100;

export type SavedSetup = {
  /** `${conditionKey}:${seed}`。同一条件＋同一シードの重複記録はこの id でスキップ。 */
  id: string;
  /** 所属する条件バケツ（conditionKeyOf(条件) の文字列）。2026-07-30 追加。 */
  conditionKey: string;
  seed: string;
  input: BuildSetupInput;
  algoVersion: string;
  pinned: boolean;
  used: boolean;
  createdAt: number;
  updatedAt: number;
  usedAt?: number;
};

/** 条件（シード以外）だけを取り出す。これが条件バケツのキーの材料になる。 */
export function setupConditionOf(input: BuildSetupInput): Omit<BuildSetupInput, "seed"> {
  const rest = { ...input } as any;
  delete rest.seed;
  return rest;
}

export function setupConditionKey(input: BuildSetupInput): string {
  return stableStringify(setupConditionOf(input));
}

export function setupHistoryId(input: BuildSetupInput): string {
  return `${setupConditionKey(input)}:${String(input.seed)}`;
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
  // 上限は条件バケツごとに効かせる（Map の searchKey ごとの capacityActive と同型）。
  const byKey = new Map<string, SavedSetup[]>();
  for (const r of rows) {
    if (r.pinned || r.used) continue;
    const k = String(r.conditionKey ?? "");
    const arr = byKey.get(k);
    if (arr) arr.push(r);
    else byKey.set(k, [r]);
  }
  const out: string[] = [];
  for (const arr of byKey.values()) {
    arr.sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1));
    for (const r of arr.slice(cap)) out.push(r.id);
  }
  return out;
}

/**
 * 保存リストを返す。conditionKey を渡すとその条件バケツだけに絞る
 * （渡さなければ全件。List タブの選択肢づくりなどで使う）。
 */
export async function listSavedSetups(conditionKey?: string): Promise<SavedSetup[]> {
  try {
    const db = await openDb();
    const rows = await idbGetAllFromStore<SavedSetup>(db, STORE_SETUPS);
    const filtered = conditionKey == null ? rows : rows.filter((r) => r.conditionKey === conditionKey);
    return sortSaved(filtered);
  } catch {
    return [];
  }
}

/** 条件バケツごとの件数（条件プロファイル一覧の resultCount 用）。 */
export async function countSetupsByCondition(): Promise<Record<string, number>> {
  const rows = await listSavedSetups();
  const out: Record<string, number> = {};
  for (const r of rows) out[r.conditionKey] = (out[r.conditionKey] ?? 0) + 1;
  return out;
}

/** その条件バケツの結果をまとめて消す（条件プロファイルの「結果ごと削除」）。 */
export async function deleteSetupsByCondition(conditionKey: string): Promise<void> {
  const db = await openDb();
  const rows = await idbGetAllFromStore<SavedSetup>(db, STORE_SETUPS);
  const ids = rows.filter((r) => r.conditionKey === conditionKey).map((r) => r.id);
  if (ids.length > 0) await idbDeleteByIds(db, STORE_SETUPS, ids);
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
      conditionKey: setupConditionKey(input),
      seed: String(input.seed),
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
