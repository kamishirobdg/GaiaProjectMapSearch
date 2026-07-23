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
