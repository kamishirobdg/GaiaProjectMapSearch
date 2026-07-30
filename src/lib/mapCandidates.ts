// src/lib/mapCandidates.ts
//
// 一覧タブのマップ候補プールを作るための純関数（2026-07-25）。
// UI から切り離してあるのはテストのため（ListView は "use client" で
// IndexedDB や描画コンポーネントを引き込むので単体テストしづらい）。

/** 候補の最小形。PersistedCandidate の必要部分だけを要求する。 */
export type BoardLike = {
  id: string;
  searchKey: string;
  placementHash?: string | number | null;
  pinned?: boolean;
  score?: number | string;
};

/**
 * 「同じ盤面」を1件に潰す。
 *
 * 同一の配置でも検索条件（searchKey）が違えば別レコードとして保存されるため、
 * id 単位の除去では同じマップが候補に複数並ぶ（実機で重複提示を確認）。
 * 盤面の同一性は「テンプレート＋placementHash」で判定する。
 *
 * 入力の並び順を優先度として扱い、先に現れたものを残す（呼び出し側で
 * 「ピン留め→スコア降順」に並べてあるので、ピン留め/高スコア側が残る）。
 * placementHash を持たない古いレコードは潰さず id で区別する。
 */
export function uniqueByBoard<T extends BoardLike>(
  list: readonly T[],
  templateIdBySearchKey: Record<string, string>
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const c of list) {
    const hash = c.placementHash == null ? "" : String(c.placementHash);
    const tid = templateIdBySearchKey[c.searchKey] ?? "";
    const key = hash ? `${tid}|${hash}` : `id:${c.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/**
 * マップ候補プール: ピン留め（スコア降順）を先頭に、続けてランキング。
 * 盤面単位で重複除去し、1件も無ければ全体最上位1件にフォールバックする。
 */
export function buildMapPool<T extends BoardLike>(args: {
  pinned: readonly T[];
  ranked: readonly T[];
  templateIdBySearchKey: Record<string, string>;
  topOverall?: T | null;
}): T[] {
  const { pinned, ranked, templateIdBySearchKey, topOverall } = args;
  const pins = pinned.slice().sort((a, b) => Number(b.score) - Number(a.score));
  const uniq = uniqueByBoard([...pins, ...ranked], templateIdBySearchKey);
  if (uniq.length > 0) return uniq;
  return topOverall ? [topOverall] : [];
}
