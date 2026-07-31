// src/lib/conditionProfiles.ts
//
// Setup / List の「条件プロファイル」。Map（/board）の保存済み条件と同じ考え方を
// 共通化したもの（2026-07-30 ユーザー確定）。
//
// 3層に分ける:
//   1. 条件      … 条件そのものから決まるキー（conditionKey）でまとまり、名前を付けられる
//   2. 結果      … conditionKey ごとのバケツに入る（保存セットアップ / セット提案）
//   3. 直近の条件 … 次回起動でどの条件から始めるかのポインタ（localStorage）
//
// これまで Setup/List は条件を個別の localStorage キーに1組だけ持っていて、
// しかも保存セットアップは1行の中に条件とシードが同居していた。そのため
// 「条件Aで貯めた結果」と「条件Bで貯めた結果」を分けられなかった。

import {
  idbGetAllFromStore,
  idbPutAll,
  openDb,
  stableStringify,
} from "@/app/board/persistence";

export type ConditionProfile<P = any> = {
  /** stableStringify(params)。条件が同じなら必ず同じキーになる。 */
  key: string;
  /** ユーザーが付けた名前（未設定は null）。 */
  name?: string | null;
  params: P;
  /** この条件に紐づく結果の件数（一覧の表示用。保存時に更新する）。 */
  resultCount: number;
  createdAt: number;
  updatedAt: number;
};

/**
 * 条件からキーを作る。互換の鉄則どおり、呼び出し側が「無効時フィールド省略」で
 * params を組み立てていれば、無効な設定がキーに影響しない。
 */
export function conditionKeyOf(params: unknown): string {
  return stableStringify(params);
}

export async function listConditionProfiles<P>(store: string): Promise<Array<ConditionProfile<P>>> {
  try {
    const db = await openDb();
    const rows = await idbGetAllFromStore<ConditionProfile<P>>(db, store);
    return rows.sort((a, b) => b.updatedAt - a.updatedAt || (a.key < b.key ? -1 : 1));
  } catch {
    return [];
  }
}

/**
 * 条件プロファイルを作る/更新する。既にあれば name は保持し、
 * params と件数・更新時刻だけを更新する（名前を消さないため）。
 */
export async function upsertConditionProfile<P>(
  store: string,
  params: P,
  patch?: { name?: string | null; resultCount?: number }
): Promise<ConditionProfile<P>> {
  const key = conditionKeyOf(params);
  const now = Date.now();
  const db = await openDb();
  const rows = await idbGetAllFromStore<ConditionProfile<P>>(db, store);
  const prev = rows.find((r) => r.key === key) ?? null;
  const next: ConditionProfile<P> = {
    key,
    name: patch?.name !== undefined ? patch.name : (prev?.name ?? null),
    params,
    resultCount: patch?.resultCount ?? prev?.resultCount ?? 0,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
  await idbPutAll(db, store, [next]);
  return next;
}

/** プロファイル本体だけ消す（結果は残る）。Map の「メタ削除」と同じ。 */
export async function deleteConditionProfile(store: string, key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

/**
 * 「次回どの条件から始めるか」のポインタ。Map の LAST_APPLIED_SEARCHKEY と同型。
 * 保存済み条件を自動適用する仕組みなので、既定値へ戻すときは消す。
 */
export function lastConditionKey(ns: string): string | null {
  try {
    return localStorage.getItem(`gaia_${ns}_last_condition`);
  } catch {
    return null;
  }
}
export function writeLastConditionKey(ns: string, key: string | null): void {
  try {
    if (key === null) localStorage.removeItem(`gaia_${ns}_last_condition`);
    else localStorage.setItem(`gaia_${ns}_last_condition`, key);
  } catch {
    // ignore
  }
}
