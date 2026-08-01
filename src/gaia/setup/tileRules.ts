// src/gaia/setup/tileRules.ts
//
// 全スロット共通のタイル指定（2026-07-30 ユーザー確定）。
//
// スロットごとに、そのスロットに入りうるタイルへ4モードのいずれかを付けられる:
//   固定 (fix)       … そのタイルにする（順不同の枠では「必ず含む」）
//   除外 (exclude)   … そのタイルにはしない
//   候補 (candidate) … 候補に指定したタイル群の中から選ぶ
//   デフォルト       … 指定なし（キーに入れない＝互換の鉄則）
//
// 満たし方は既存の applyForceRules と同じ「シャッフル済み配列の入れ替え」。
// シードを引き直して当たりを待つ探索はしないので、どのシードでも指定は満たされる
// （物理的に不可能な指定＝プールに無い等のときだけ据え置きになる）。

export type TileRuleMode = "fix" | "exclude" | "candidate";

/** slotId -> tileId -> モード。デフォルトのタイルはキーごと持たない。 */
export type TileRules = Record<string, Record<string, TileRuleMode>>;

/** そのスロットの制約。must は必ず入れるタイル、allowed は選んでよい集合。 */
export type SlotConstraint = { must: string[]; allowed: Set<string> | null };

/**
 * スロットの指定を「必ず入れるもの」と「選んでよい集合」に畳む。
 * 指定が無い（or 実質無効）なら null を返し、呼び出し側は何もしない。
 */
export function slotConstraint(
  rules: TileRules | undefined,
  slotId: string,
  pool: readonly string[]
): SlotConstraint | null {
  const r = rules?.[slotId];
  if (!r) return null;
  const must: string[] = [];
  const candidates: string[] = [];
  const excluded = new Set<string>();
  for (const [tileId, mode] of Object.entries(r)) {
    if (mode === "fix") must.push(tileId);
    else if (mode === "candidate") candidates.push(tileId);
    else if (mode === "exclude") excluded.add(tileId);
  }
  if (must.length === 0 && candidates.length === 0 && excluded.size === 0) return null;
  const base = candidates.length > 0 ? candidates : [...pool];
  const allowed = new Set(base.filter((t) => !excluded.has(t)));
  // 固定したタイルは候補指定や除外に関わらず入れる（意図が最も強い指定なので）
  for (const t of must) allowed.add(t);
  return { must, allowed };
}

/**
 * 位置が意味を持つスロット（研究トラック、ラウンド得点のR番号など）。
 * arr[idx] を許される値にする。交換相手はスペア（spareStart 以降）を優先し、
 * 次に「自分で指定を持っていない」他スロットを使う。見つからなければ据え置く。
 */
export function enforcePositional(
  arr: string[],
  idx: number,
  c: SlotConstraint | null,
  opts: { spareStart: number; lockedIndices?: ReadonlySet<number> }
): void {
  if (!c) return;
  const want = c.must.length > 0 ? new Set(c.must) : c.allowed;
  if (!want || want.size === 0) return;
  if (want.has(arr[idx])) return;
  for (let j = opts.spareStart; j < arr.length; j += 1) {
    if (want.has(arr[j])) {
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return;
    }
  }
  for (let j = 0; j < opts.spareStart; j += 1) {
    if (j === idx || opts.lockedIndices?.has(j)) continue;
    if (want.has(arr[j])) {
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return;
    }
  }
}

/**
 * 順番が意味を持たない枠（ブースター、標準技術のフリー枠、アーティファクト）。
 * 先頭 count 枚が「場に出る」集合。must を含め、allowed の外を追い出す。
 */
export function enforceMembership(
  arr: string[],
  region: { start: number; count: number },
  c: SlotConstraint | null,
  opts?: { lockedIndices?: ReadonlySet<number> }
): void {
  if (!c) return;
  const { start, count } = region;
  const end = Math.min(start + count, arr.length);
  const inRegion = (i: number) => i >= start && i < end;
  const donors: number[] = [];
  for (let i = 0; i < arr.length; i += 1) {
    if (!inRegion(i) && !opts?.lockedIndices?.has(i)) donors.push(i);
  }
  const allowed = c.allowed;
  const mustSet = new Set(c.must);

  // 1) 許されないタイルを区間の外へ出す（交換相手は許される控えを優先）
  if (allowed) {
    for (let i = start; i < end; i += 1) {
      if (allowed.has(arr[i])) continue;
      const k = donors.findIndex((j) => allowed.has(arr[j]));
      if (k < 0) continue; // 交換できる相手がいない＝満たせないので据え置き
      const j = donors[k];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      donors.splice(k, 1);
    }
  }

  // 2) 必ず入れるタイルを区間の中へ入れる（既に入っているものは触らない）
  for (const t of c.must) {
    let already = false;
    for (let i = start; i < end; i += 1) if (arr[i] === t) already = true;
    if (already) continue;
    const k = donors.findIndex((j) => arr[j] === t);
    if (k < 0) continue; // プールに無い＝満たせないので据え置き
    const j = donors[k];
    let target = -1;
    for (let i = start; i < end; i += 1) {
      if (mustSet.has(arr[i])) continue; // 他の固定を押し出さない
      target = i;
      break;
    }
    if (target < 0) continue;
    [arr[target], arr[j]] = [arr[j], arr[target]];
    donors.splice(k, 1);
  }
}

/** そのスロットに指定が1つでも入っているか（UI の鍵マーク用）。 */
export function hasRule(rules: TileRules | undefined, slotId: string): boolean {
  const r = rules?.[slotId];
  return !!r && Object.keys(r).length > 0;
}

/**
 * 条件サマリに出す件数（2026-08-02）。
 *
 * 固定・候補はそのまま数える。**除外だけは既定（`defaultAdvancedTileRules()`）との差**
 * を数える —— 既定の除外はどの条件にも同じだけ入っているので、素の件数を出しても
 * 条件の見分けに使えないため。既定に無い除外を足したぶんも、既定の除外を解除した
 * ぶんも「1件の違い」として数える。
 *
 * 既定値を引数で受けるのは、この module が buildSetup.ts へ依存しないようにするため
 * （buildSetup 側がこの module を読んでいるので、import すると循環する）。
 * rules が undefined＝保存時に指定が空だった条件なので、既定とみなして差0にする。
 */
export function countTileRules(
  rules: TileRules | undefined,
  defaults: TileRules
): { fix: number; candidate: number; exclude: number } {
  const tr = rules ?? defaults;
  let fix = 0;
  let candidate = 0;
  let exclude = 0;
  for (const [slotId, byTile] of Object.entries(tr)) {
    for (const [tileId, mode] of Object.entries(byTile)) {
      if (mode === "fix") fix += 1;
      else if (mode === "candidate") candidate += 1;
      else if (defaults[slotId]?.[tileId] !== "exclude") exclude += 1;
    }
  }
  for (const [slotId, byTile] of Object.entries(defaults)) {
    for (const tileId of Object.keys(byTile)) {
      if (tr[slotId]?.[tileId] !== "exclude") exclude += 1;
    }
  }
  return { fix, candidate, exclude };
}

/**
 * 1タイルのモードを設定して新しい TileRules を返す（不変更新）。
 * mode=null でデフォルトへ戻す。空になったスロットはキーごと消す
 * （無効時フィールド省略＝指定が無い状態のキーを変えないため）。
 */
export function setTileRule(
  rules: TileRules | undefined,
  slotId: string,
  tileId: string,
  mode: TileRuleMode | null,
  opts?: { singleFix?: boolean }
): TileRules {
  const next: TileRules = {};
  for (const [k, v] of Object.entries(rules ?? {})) next[k] = { ...v };
  const slot = { ...(next[slotId] ?? {}) };
  if (mode === null) delete slot[tileId];
  else {
    // 位置スロットは固定を1枚だけにする（順不同の枠は複数固定＝複数「含む」を許す）
    if (mode === "fix" && opts?.singleFix) {
      for (const [t, m] of Object.entries(slot)) if (m === "fix" && t !== tileId) delete slot[t];
    }
    slot[tileId] = mode;
  }
  if (Object.keys(slot).length === 0) delete next[slotId];
  else next[slotId] = slot;
  return next;
}
