// src/gaia/setup/types.ts
//
// Types for the randomized *setup* side of the tool (research/tech tiles,
// round boosters, round scoring), kept separate from the map pipeline.
//
// Design mirrors the map side: a fixed data catalog (data.ts) + a deterministic
// seed -> setup builder (buildSetup.ts), verified by a snapshot test. Evaluation
// is intentionally out of scope for this first skeleton.

/** Which rule set the randomizer rolls for. Omitted input = "base". */
export type SetupMode = "base" | "lostFleet";

/**
 * The four Lost Fleet ships. Same vocabulary as the map side's scout keys.
 * At 2 players, Rebellion is returned to the box.
 */
export type ShipId = "twilight" | "eclipse" | "rebellion" | "tfmars";

export const SHIP_IDS: readonly ShipId[] = ["twilight", "eclipse", "rebellion", "tfmars"] as const;

/**
 * Ships carrying a standard-tech space (one each; Twilight instead holds the
 * artifact spaces). Confirmed against the physical boards (2026-07-23).
 */
export const TECH_SHIP_IDS: readonly ShipId[] = ["eclipse", "rebellion", "tfmars"] as const;

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
  /**
   * Physical copies of this tile in the box (default 1). Matters for draws
   * from a physical pool: round scoring has 3 types with 2 copies each, so the
   * same type can occupy up to two rounds.
   */
  copies?: number;
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
  /**
   * 9 standard tech tile TYPES (4 identical copies each in the box). Setup
   * assigns one type per slot: 6 under the research tracks + 3 in the free
   * row, so copies never matter for the draw.
   */
  standardTech: SetupTile[];
  /** 15 advanced tech tiles (1 copy each): 6 are drawn, one per research track. */
  advancedTech: SetupTile[];
  /** Round booster pool (10). A subset of (players + 3) is used each game. */
  boosters: SetupTile[];
  /**
   * 7 round scoring TYPES forming a physical pool of 10 tiles
   * (4 types x1 + 3 types x2, via `copies`). Six tiles are drawn, one per
   * round, so a x2 type can occupy up to two rounds.
   */
  roundScoring: RoundScoringTile[];
  /** 6 final scoring tiles: 2 are drawn per game. */
  finalScoring: SetupTile[];
  /**
   * 6 federation tile TYPES (x3 identical copies each; the Gleens-only tile is
   * excluded). Setup draws 1 random tile and places it on Terraforming
   * research level 5 — copies are equal so the draw is type-uniform.
   */
  federations: SetupTile[];

  // --- Lost Fleet expansion groups (only drawn in "lostFleet" mode) ---------

  /** 4 new round boosters, mixed into the base pool (-> 14). */
  boostersLF: SetupTile[];
  /** 3 new round scoring tiles, mixed into the physical pool (-> 13). */
  roundScoringLF: RoundScoringTile[];
  /** 6 new advanced tech tiles, mixed into the base 15 (-> 21). */
  advancedTechLF: SetupTile[];
  /**
   * 3 new standard tech TYPES (x4 copies), NOT mixed with the base 9: they are
   * assigned to the ship tech spaces (one per ship except Twilight).
   */
  standardTechLF: SetupTile[];
  /** 3 new final scoring tiles, mixed into the base 6 (-> 9). */
  finalScoringLF: SetupTile[];
  /** 8 gold-frame federation tiles: one per ship (4, or 3 at 2 players). */
  federationsGold: SetupTile[];
  /** 13 artifact tokens: playerCount of them go onto Twilight's spaces. */
  artifacts: SetupTile[];
};

/**
 * Output of a single deterministic setup roll.
 *
 * Lost Fleet fields (`mode`, `ships`, `advancedTech.extension`, `shipTech`,
 * `artifacts`, `goldFederations`, `econTileFace`, `extensionFace`) are present
 * ONLY when rolled in "lostFleet" mode — base-mode output stays byte-identical
 * to the pre-expansion shape (same spread-omit rule as the map search keys).
 */
export type SetupResult = {
  seed: string;
  playerCount: number;

  /** Present (= "lostFleet") only in Lost Fleet mode. */
  mode?: "lostFleet";
  /** Ships in play (Rebellion is excluded at 2 players). LF mode only. */
  ships?: ShipId[];

  standardTech: {
    /** One standard tech tile id per research track. */
    byTrack: Record<ResearchTrackId, string>;
    /** The three tiles placed in the free row. */
    free: string[];
  };

  advancedTech: {
    /** One advanced tech tile id per research track (6 of 15, or 6 of 21 in LF). */
    byTrack: Record<ResearchTrackId, string>;
    /** LF mode only: the 7th draw, placed on the scoring-board extension. */
    extension?: string;
  };

  boosters: {
    /** (playerCount + 3) booster ids available this game. */
    available: string[];
    /** The remaining booster ids, returned to the box. */
    unused: string[];
  };

  /**
   * Round scoring tile TYPE id for each round, index 0 = round 1 .. 5 = round 6.
   * Drawn from the physical 10-tile pool, so a x2 type may appear twice.
   */
  roundScoring: string[];

  /** Two final scoring tile ids (out of 6), order as drawn. */
  finalScoring: string[];

  /** Federation tile type id placed on Terraforming research level 5. */
  federationLv5: string;

  // --- Lost Fleet mode only -------------------------------------------------

  /** New standard tech type per tech-carrying ship (2 entries at 2 players). */
  shipTech?: Partial<Record<ShipId, string>>;
  /** playerCount artifact ids, in draw order, placed on Twilight. */
  artifacts?: string[];
  /** One gold federation tile per ship in play. */
  goldFederations?: Partial<Record<ShipId, string>>;
  /** Random face of the economy-research adjustment tile. */
  econTileFace?: "A" | "B";
  /**
   * Scoring-board extension face: player-count default (2p = "vp25",
   * 3/4p = "shuttle") unless the random-face option is enabled.
   */
  extensionFace?: "vp25" | "shuttle";
};
