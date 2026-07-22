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
// Each component draws from an independent RNG stream derived from the seed, so
// adding/removing one component's logic never shifts another's output.

import { mulberry32, hashSeed, shuffleSeeded } from "../board/rng";
import { RESEARCH_TRACK_IDS, type ResearchTrackId, type SetupResult } from "./types";
import { SETUP_CATALOG } from "./data";

export type BuildSetupInput = {
  seed: string;
  /** 1..4 in the base game; controls how many boosters are available. */
  playerCount?: number;
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
  const playerCount = clampPlayers(input.playerCount);

  // 1) Standard tech: 6 under tracks + 3 free.
  const std = shuffleSeeded(idsOf(SETUP_CATALOG.standardTech), streamFor(seed, "standardTech"));
  const stdByTrack = assignByTrack(std.slice(0, RESEARCH_TRACK_IDS.length));
  const stdFree = std.slice(RESEARCH_TRACK_IDS.length, RESEARCH_TRACK_IDS.length + 3);

  // 2) Advanced tech: draw 6 of 15, one per track (the rest stay unseen).
  const adv = shuffleSeeded(idsOf(SETUP_CATALOG.advancedTech), streamFor(seed, "advancedTech"));
  const advByTrack = assignByTrack(adv.slice(0, RESEARCH_TRACK_IDS.length));

  // 3) Boosters: (players + 3) available.
  const boosters = shuffleSeeded(idsOf(SETUP_CATALOG.boosters), streamFor(seed, "boosters"));
  const availableCount = Math.min(playerCount + 3, boosters.length);
  const available = boosters.slice(0, availableCount);
  const unused = boosters.slice(availableCount);

  // 4) Round scoring: draw 6 from the physical 10-tile pool (duplicates via copies).
  const scoringPool = shuffleSeeded(physicalPoolOf(SETUP_CATALOG.roundScoring), streamFor(seed, "roundScoring"));
  const roundScoring = scoringPool.slice(0, 6);

  // 5) Final scoring: draw 2 of 6.
  const finals = shuffleSeeded(idsOf(SETUP_CATALOG.finalScoring), streamFor(seed, "finalScoring"));
  const finalScoring = finals.slice(0, 2);

  // 6) Federation for Terraforming research level 5: draw 1 of 6 types.
  const feds = shuffleSeeded(idsOf(SETUP_CATALOG.federations), streamFor(seed, "federationLv5"));
  const federationLv5 = feds[0];

  return {
    seed,
    playerCount,
    standardTech: { byTrack: stdByTrack, free: stdFree },
    advancedTech: { byTrack: advByTrack },
    boosters: { available, unused },
    roundScoring,
    finalScoring,
    federationLv5,
  };
}

function clampPlayers(n: number | undefined): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return 4;
  return Math.max(1, Math.min(4, v));
}
