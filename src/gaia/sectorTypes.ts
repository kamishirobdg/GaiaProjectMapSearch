// src/gaia/sectorTypes.ts
// Minimal shared type definitions for sector tiles.
// Note: `radius` is optional for backward compatibility with older tile datasets.

export type PlanetType =
  | "BLUE" 
  | "BROWN" 
  | "RED" 
  | "BLACK" 
  | "ORANGE" 
  | "WHITE"
  | "YELLOW" 
  | "TERRA"
  | "DESERT"
  | "OXIDE"
  | "VOLCANIC"
  | "ICE"
  | "TITANIUM"
  | "SWAMP"
  | "GAIA"
  | "TRANSDIM"
  | "PROTO"
  | "ASTEROID";

export type SectorCellKind = "planet" | "empty" | "scout";

export type SectorCellDef =
  | {
      kind: "planet";
      planet: PlanetType;
      tags: string[];
    }
  | {
      kind: "empty";
      tags: string[];
    }
  | {
      kind: "scout";
      tags: string[];
    };

export type AxialKey = `${number},${number}`;

export type SectorCellsDef = Record<AxialKey, SectorCellDef>;

export type SectorTileDef = {
  id: string;
  // Optional to avoid forcing radius updates across all tile datasets.
  radius?: number;
  cells: SectorCellsDef;
};

// Backward-compat alias used by some legacy files
export type SectorTileLf = SectorTileDef;
