// src/gaia/setup/buildSetup.ts
//
// Deterministic seed -> setup roll, mirroring the map side's philosophy:
// the same seed always yields the same setup, so results are snapshot-testable
// and shareable. Evaluation is out of scope here.
//
// Randomization rules (Gaia Project base):
//   - standard tech: shuffle the 9 types; first 6 go one-per-track, next 3 free.
//   - advanced tech: shuffle the 15 tiles; first 6 go one-per-track (rest unseen).
//   - boosters: shuffle the 10; first (players + 3) are available, rest unused.
//   - round scoring: shuffle the physical 10-tile pool (9 entries, the
//     federation tile twice via `copies`); first 6 become rounds 1..6 in
//     order, so the x2 tile can score in up to two rounds.
//   - final scoring: shuffle the 6 tiles; first 2 are used.
//   - federation Lv5: 1 random tile goes to Terraforming research level 5.
//     All 6 types have 3 copies, so drawing a tile uniformly = drawing a type
//     uniformly; the catalog's type list is shuffled directly.
//
// Lost Fleet mode (docs/setup-lostfleet-spec.md):
//   - mixed pools grow (boosters 14, physical scoring 13, final scoring 9,
//     advanced 21). The SAME stream names shuffle the larger id lists, and the
//     7th advanced draw goes to the scoring-board extension.
//   - LF-only elements use NEW streams (shipTech / artifacts / goldFederations
//     / econTileFace / extensionFace), so base-mode output stays byte-identical
//     to the pre-expansion behavior.
//   - at 2 players Rebellion is boxed: 3 ships, 2 ship-tech spaces, 3 gold
//     federations.
//
// Each component draws from an independent RNG stream derived from the seed, so
// adding/removing one component's logic never shifts another's output.

import { mulberry32, hashSeed, shuffleSeeded } from "../board/rng";
import {
  RESEARCH_TRACK_IDS,
  SHIP_IDS,
  TECH_SHIP_IDS,
  type ResearchTrackId,
  type SetupMode,
  type SetupResult,
  type ShipId,
} from "./types";
import { SETUP_CATALOG } from "./data";

export type BuildSetupInput = {
  seed: string;
  /** base: 1..4 / lostFleet: 2..4; controls boosters, artifacts, ships. */
  playerCount?: number;
  /** Omitted = "base". Base-mode output is unchanged by the expansion. */
  mode?: SetupMode;
  /**
   * Lost Fleet only: roll the scoring-board extension face randomly (allowed
   * from the second game on) instead of the player-count default.
   */
  randomExtensionFace?: boolean;
};

/** Derive an independent RNG stream for a named component of one seed. */
function streamFor(seed: string, stream: string) {
  return mulberry32(hashSeed(`${seed}::${stream}`));
}

function idsOf(tiles: { id: string }[]): string[] {
  return tiles.map((t) => t.id);
}

/** Expand tile types into the physical pool (one entry per copy). */
function physicalPoolOf(tiles: { id: string; copies?: number }[]): string[] {
  const out: string[] = [];
  for (const t of tiles) {
    const n = Math.max(1, Math.floor(t.copies ?? 1));
    for (let i = 0; i < n; i++) out.push(t.id);
  }
  return out;
}

function assignByTrack(ids: string[]): Record<ResearchTrackId, string> {
  const out = {} as Record<ResearchTrackId, string>;
  RESEARCH_TRACK_IDS.forEach((track, i) => {
    out[track] = ids[i];
  });
  return out;
}

export function buildSetupFromSeed(input: BuildSetupInput): SetupResult {
  const seed = String(input.seed ?? "").trim() || "default";
  const lf = input.mode === "lostFleet";
  const playerCount = clampPlayers(input.playerCount, lf);

  // 1) Standard tech: 6 under tracks + 3 free. (LF's new types are NOT mixed.)
  const std = shuffleSeeded(idsOf(SETUP_CATALOG.standardTech), streamFor(seed, "standardTech"));
  const stdByTrack = assignByTrack(std.slice(0, RESEARCH_TRACK_IDS.length));
  const stdFree = std.slice(RESEARCH_TRACK_IDS.length, RESEARCH_TRACK_IDS.length + 3);

  // 2) Advanced tech: draw 6 of 15 (LF: 6 of 21 + a 7th for the extension).
  const advPool = lf
    ? [...idsOf(SETUP_CATALOG.advancedTech), ...idsOf(SETUP_CATALOG.advancedTechLF)]
    : idsOf(SETUP_CATALOG.advancedTech);
  const adv = shuffleSeeded(advPool, streamFor(seed, "advancedTech"));
  const advByTrack = assignByTrack(adv.slice(0, RESEARCH_TRACK_IDS.length));
  const advExtension = adv[RESEARCH_TRACK_IDS.length]; // used only in LF mode

  // 3) Boosters: (players + 3) available. (LF: pool of 14.)
  const boosterPool = lf
    ? [...idsOf(SETUP_CATALOG.boosters), ...idsOf(SETUP_CATALOG.boostersLF)]
    : idsOf(SETUP_CATALOG.boosters);
  const boosters = shuffleSeeded(boosterPool, streamFor(seed, "boosters"));
  const availableCount = Math.min(playerCount + 3, boosters.length);
  const available = boosters.slice(0, availableCount);
  const unused = boosters.slice(availableCount);

  // 4) Round scoring: draw 6 from the physical pool (10, LF: 13).
  const scoringTiles = lf
    ? [...SETUP_CATALOG.roundScoring, ...SETUP_CATALOG.roundScoringLF]
    : SETUP_CATALOG.roundScoring;
  const scoringPool = shuffleSeeded(physicalPoolOf(scoringTiles), streamFor(seed, "roundScoring"));
  const roundScoring = scoringPool.slice(0, 6);

  // 5) Final scoring: draw 2 (of 6, LF: of 9).
  const finalPool = lf
    ? [...idsOf(SETUP_CATALOG.finalScoring), ...idsOf(SETUP_CATALOG.finalScoringLF)]
    : idsOf(SETUP_CATALOG.finalScoring);
  const finals = shuffleSeeded(finalPool, streamFor(seed, "finalScoring"));
  const finalScoring = finals.slice(0, 2);

  // 6) Federation for Terraforming research level 5: draw 1 of 6 types.
  const feds = shuffleSeeded(idsOf(SETUP_CATALOG.federations), streamFor(seed, "federationLv5"));
  const federationLv5 = feds[0];

  const base: SetupResult = {
    seed,
    playerCount,
    standardTech: { byTrack: stdByTrack, free: stdFree },
    advancedTech: { byTrack: advByTrack, ...(lf ? { extension: advExtension } : {}) },
    boosters: { available, unused },
    roundScoring,
    finalScoring,
    federationLv5,
  };

  if (!lf) return base;

  // --- Lost Fleet only draws (independent streams) --------------------------

  // Ships in play; Rebellion is boxed at 2 players.
  const ships: ShipId[] = SHIP_IDS.filter((s) => !(playerCount === 2 && s === "rebellion"));
  const techShips = TECH_SHIP_IDS.filter((s) => ships.includes(s));

  // New standard tech types onto the ship tech spaces (leftover boxed at 2p).
  const shipTechDraw = shuffleSeeded(idsOf(SETUP_CATALOG.standardTechLF), streamFor(seed, "shipTech"));
  const shipTech: Partial<Record<ShipId, string>> = {};
  techShips.forEach((ship, i) => {
    shipTech[ship] = shipTechDraw[i];
  });

  // playerCount artifacts onto Twilight.
  const artifactsDraw = shuffleSeeded(idsOf(SETUP_CATALOG.artifacts), streamFor(seed, "artifacts"));
  const artifacts = artifactsDraw.slice(0, playerCount);

  // One gold federation tile per ship in play.
  const goldDraw = shuffleSeeded(idsOf(SETUP_CATALOG.federationsGold), streamFor(seed, "goldFederations"));
  const goldFederations: Partial<Record<ShipId, string>> = {};
  ships.forEach((ship, i) => {
    goldFederations[ship] = goldDraw[i];
  });

  // Random face of the economy-research adjustment tile.
  const econTileFace = shuffleSeeded(["A", "B"] as const, streamFor(seed, "econTileFace"))[0];

  // Scoring-board extension face: player-count default, or random if opted in.
  const extensionFace = input.randomExtensionFace
    ? shuffleSeeded(["vp25", "shuttle"] as const, streamFor(seed, "extensionFace"))[0]
    : playerCount === 2
      ? ("vp25" as const)
      : ("shuttle" as const);

  return {
    ...base,
    mode: "lostFleet",
    ships,
    shipTech,
    artifacts,
    goldFederations,
    econTileFace,
    extensionFace,
  };
}

function clampPlayers(n: number | undefined, lf: boolean): number {
  const v = Math.floor(Number(n));
  const min = lf ? 2 : 1;
  if (!Number.isFinite(v)) return 4;
  return Math.max(min, Math.min(4, v));
}
