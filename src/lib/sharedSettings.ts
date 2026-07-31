// src/lib/sharedSettings.ts
//
// Settings shared between the Map (/board) and Setup (/setup) tabs via
// localStorage: player count and which rule set (expansion) is in play.
// Language already shares "gaia_ui_lang" the same way.
//
// Each page reads these on mount and writes on change, so switching tabs
// keeps the same players/expansion without a global store.

export type Expansion = "base" | "lostFleet";

const KEY_PLAYERS = "gaia_shared_players";
const KEY_EXPANSION = "gaia_shared_expansion";

// Pre-sharing keys used by the Setup tab; read once as a migration fallback.
const LEGACY_SETUP_PLAYERS = "gaia_setup_players";
const LEGACY_SETUP_MODE = "gaia_setup_mode";

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

/** 1..4, or null when nothing stored. */
export function readSharedPlayers(): number | null {
  const v = Number(lsGet(KEY_PLAYERS) ?? lsGet(LEGACY_SETUP_PLAYERS));
  return Number.isInteger(v) && v >= 1 && v <= 4 ? v : null;
}

export function readSharedExpansion(): Expansion | null {
  const v = lsGet(KEY_EXPANSION) ?? lsGet(LEGACY_SETUP_MODE);
  return v === "base" || v === "lostFleet" ? v : null;
}

export function writeSharedPlayers(players: number): void {
  lsSet(KEY_PLAYERS, String(players));
}

export function writeSharedExpansion(expansion: Expansion): void {
  lsSet(KEY_EXPANSION, expansion);
}

// --- 重みのスケール変更にともなう localStorage の一度きりの掃除（2026-07-31）---
//
// 評価値の重みを Map 10倍 / Setup 100倍にしたので、localStorage に残っている
// 古いスケールの値は捨てる。IndexedDB 側は persistence.ts の v8 upgrade が消す。
// 対象は「評価値そのもの、または評価値から作った結果」だけ。人数・拡張・言語・
// タイル指定など、スケールと関係のない設定は残す。
// v3: 桁をゲームの得点へ揃えるため、Map/Setup とも 1/10 にした（2026-07-31）。
// v4: Setup の種族別重みを全タイル見直し、評価指数の既定値も変えた（2026-08-01）。
//     **Map 側の重みは触っていないので、Map のポインタ
//     （gaia_last_applied_searchKey_v1）は消さない**。消すのは Setup/List 側だけ。
//     gaia_setup_eval_weights は「既定値との差分」しか持たないので、既定値が動くと
//     残っている値の意味が変わってしまう＝捨てる必要がある。
// スケールや既定値を変えるたびにこのキーを上げる（＝もう一度だけ掃除が走る）。
const KEY_SCALE_MIGRATION = "gaia_eval_scale_v4";
const STALE_ON_SCALE_CHANGE = [
  // Setup/List 共有の評価指数（既定値との差分だけを持つので、既定が動くと意味が変わる）
  "gaia_setup_eval_weights",
  // List のセット提案とログ（旧スケールの評価値を持っている）
  "gaia_list_proposals_v2",
  "gaia_list_pair_log_v2",
];

/**
 * 各ページの復元処理の先頭で1回呼ぶ。すでに掃除済みなら何もしない。
 * 冪等なので複数タブ・複数ページから呼ばれても問題ない。
 */
export function resetStaleEvalScaleStorage(): void {
  try {
    if (localStorage.getItem(KEY_SCALE_MIGRATION)) return;
    for (const k of STALE_ON_SCALE_CHANGE) localStorage.removeItem(k);
    localStorage.setItem(KEY_SCALE_MIGRATION, "1");
  } catch {
    // ignore
  }
}
