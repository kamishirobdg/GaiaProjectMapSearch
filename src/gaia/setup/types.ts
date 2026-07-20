// src/gaia/setup/types.ts
//
// Types for the randomized *setup* side of the tool (research/tech tiles,
// round boosters, round scoring), kept separate from the map pipeline.
//
// Design mirrors the map side: a fixed data catalog (data.ts) + a deterministic
// seed -> setup builder (buildSetup.ts), verified by a snapshot test. Evaluation
// is intentionally out of scope for this first skeleton.

/** The six research tracks of Gaia Project (stable ids; labels in data.ts). */
export type ResearchTrackId =
  | "terra" // Terraforming
  | "nav" // Navigation
  | "ai" // Artificial Intelligence
  | "gaia" // Gaia Project
  | "eco" // Economy
  | "sci"; // Science

export const RESEARCH_TRACK_IDS: readonly ResearchTrackId[] = [
  "terra",
  "nav",
  "ai",
  "gaia",
  "eco",
  "sci",
] as const;

/**
 * A catalog entry for any randomized setup component. `effect`/`effectEn` are
 * DRAFT descriptions pending the user's verification; the id and the slot
 * counts are the authoritative part the randomizer relies on.
 */
export type SetupTile = {
  id: string;
  /** Japanese display label (DRAFT). */
  label: string;
  /** English display label (DRAFT). */
  labelEn: string;
  /** Longer effect text, Japanese (DRAFT — verify). */
  effect?: string;
  /** Longer effect text, English (DRAFT — verify). */
  effectEn?: string;
};

/**
 * Round scoring tiles can be restricted from certain rounds in Gaia Project.
 * Captured here as data (DRAFT) but not yet enforced by the builder.
 */
export type RoundScoringTile = SetupTile & {
  /** Rounds (1..6) this tile may NOT occupy. Empty/undefined = no restriction. */
  forbiddenRounds?: number[];
};

/** The full static catalog the randomizer draws from. */
export type SetupCatalog = {
  /** 9 standard tech tiles: 6 land under the research tracks, 3 in the free row. */
  standardTech: SetupTile[];
  /** 6 advanced tech tiles: one on top of each research track. */
  advancedTech: SetupTile[];
  /** Round booster pool (10). A subset of (players + 3) is used each game. */
  boosters: SetupTile[];
  /** Round scoring pool (10). Six are drawn, one per round. */
  roundScoring: RoundScoringTile[];
};

/** Output of a single deterministic setup roll. */
export type SetupResult = {
  seed: string;
  playerCount: number;

  standardTech: {
    /** One standard tech tile id per research track. */
    byTrack: Record<ResearchTrackId, string>;
    /** The three tiles placed in the free row. */
    free: string[];
  };

  advancedTech: {
    /** One advanced tech tile id per research track. */
    byTrack: Record<ResearchTrackId, string>;
  };

  boosters: {
    /** (playerCount + 3) booster ids available this game. */
    available: string[];
    /** The remaining booster ids, returned to the box. */
    unused: string[];
  };

  /** Round scoring tile id for each round, index 0 = round 1 .. index 5 = round 6. */
  roundScoring: string[];
};
