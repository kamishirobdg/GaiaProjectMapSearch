// scripts/regression-snapshot.ts
//
// Deterministic regression snapshot for the Gaia map-search core pipeline:
//   seed -> buildLogicalMap -> extractForEval -> checkHardConstraints / evaluateSoft
//
// This intentionally bypasses the UI and the Web Worker: it imports the core
// pipeline modules directly (the same modules used by src/gaia/search.ts) and
// runs them for a fixed, deterministic set of string seeds against every
// templateId supported by src/gaia/ssot/searchPlacementConfig.ts.
//
// Usage:
//   npx tsx scripts/regression-snapshot.ts [outputPath]
//   (outputPath defaults to scripts/__snapshots__/baseline.json)
//
// The output is written as deterministic JSON: object keys are sorted and
// indentation is 2 spaces, so two runs against the same source produce a
// byte-identical file (verified by running this script twice and diffing).

// Catches display<->eval slotCenters drift (see scripts/check-coord-consistency.ts)
// before generating a snapshot from potentially-inconsistent data. Called from
// main() rather than run as an import side effect, so that importing this
// module (scripts/regression-snapshot.test.ts) cannot exit the process.
import { runCheckOrExit } from "./check-coord-consistency";
import { isMainModule } from "./isMainModule";

import { buildLogicalMap } from "../src/gaia/logicalMap/buildLogicalMap";
import { extractForEval, type HardParams } from "../src/gaia/eval/extractForEval";
import { checkHardConstraints, type HardFailReason } from "../src/gaia/constraints";
import { evaluateSoft, type SoftParams } from "../src/gaia/eval/evaluateSoft";
import { computePlacementHash } from "../src/gaia/ssot/placementHash";

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Fixed inputs (must stay stable across runs; DO NOT randomize)
// ---------------------------------------------------------------------------

// Every templateId currently recognized by src/gaia/ssot/searchPlacementConfig.ts
// (CONFIG_3P_LOSTFLEET.templateId / CONFIG_4P_LOSTFLEET.templateId).
const TEMPLATE_IDS: string[] = ["3p_lostFleet", "4p_lostFleet"];

// base_34p は placementMethod (1/2/3) ごとに別の検索空間なので方法別にスナップショットする。
// LF テンプレのエントリ（placementMethod フィールドなし）はバイト不変を維持すること。
export const RUNS: Array<{ templateId: string; placementMethod?: 1 | 2 | 3 }> = [
  ...TEMPLATE_IDS.map((templateId) => ({ templateId })),
  { templateId: "base_34p", placementMethod: 1 },
  { templateId: "base_34p", placementMethod: 2 },
  { templateId: "base_34p", placementMethod: 3 },
];

// 30 fixed, deterministic seed strings shared by every template.
const SEED_COUNT = 30;
const SEEDS: string[] = Array.from({ length: SEED_COUNT }, (_, i) =>
  `snap-${String(i + 1).padStart(4, "0")}`
);

// Hard/soft params mirror the default values wired up in src/app/board/page.tsx
// so the snapshot exercises realistic constraint/weight settings.
const HARD_PARAMS: HardParams = {
  minSameColorDist: 3,
  outerSameColorMax: 1,
  centerMode: "NONE",
};

const SOFT_PARAMS: SoftParams = {
  wOuter: 3,
  wTouch: 1,
  wScout: 6,
  scoutRadius: 3,
  wScoutByScoutKey: { twilight: 6, eclipse: 6, rebellion: 6, tfmars: 6 },
  wScoutCore: 4,
  wScoutCoreByScoutKey: { twilight: 3, eclipse: 3, rebellion: 3, tfmars: 3 },
  scoutCoreAttributionMode: "all",
  wImbalance: 100,
  imbalanceMetric: "std",
};

// ---------------------------------------------------------------------------
// Types for the recorded snapshot entry
// ---------------------------------------------------------------------------

export type SnapshotEntry = {
  seed: string;
  templateId: string;
  /** base_34p のみ（LFエントリはフィールド省略でバイト不変を維持） */
  placementMethod?: 1 | 2 | 3;

  status: "ok" | "buildLogicalMapFailed" | "extractForEvalFailed";
  errorMessage?: string;

  placementHash?: string;
  placement?: Array<{ slotId: string; sectorId: string; rot: number }>;

  hard?: {
    pass: boolean;
    failReasons: HardFailReason[];
    reasonDetails: Array<{ reason: HardFailReason; detail: string }>;
  };

  soft?: {
    score: number;
    outerCountByType: Record<string, number>;
    touchCountByType: Record<string, number>;
    scoutByType: Record<string, number>;
    scoutCoreByType: Record<string, number>;
    planetTypeTotals: Record<string, number>;
    imbalance: { metric: string; value: number; score: number };

    // Explicitly tracked because a follow-up bug fix is expected to change
    // these values: counts and summed `value` for scout / scoutCore hits.
    scoutHitsCount: number;
    scoutHitsValueSum: number;
    scoutCoreHitsCount: number;
    scoutCoreHitsValueSum: number;
  };
};

// ---------------------------------------------------------------------------
// Deterministic JSON stringify: sorts all object keys recursively.
// ---------------------------------------------------------------------------

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeysDeep(obj[key]);
    }
    return sorted;
  }
  return value;
}

function round(n: number): number {
  // Keep floating point noise out of the diff without losing precision that
  // actually matters (weights/scores in this pipeline are integers or
  // simple decimals).
  return Math.round(n * 1e6) / 1e6;
}

function sum(values: number[]): number {
  return round(values.reduce((a, b) => a + b, 0));
}

// ---------------------------------------------------------------------------
// Core: run one (templateId, seed) pair through the pipeline.
// ---------------------------------------------------------------------------

function runOne(
  templateId: string,
  seed: string,
  placementMethod?: 1 | 2 | 3
): SnapshotEntry {
  // base テンプレでは H0（合法性）を常時有効化（src/gaia/search.ts runSearch と同じ規則）
  const hardParams: HardParams =
    templateId === "base_34p"
      ? { ...HARD_PARAMS, banSameKindAdjacency: true }
      : HARD_PARAMS;
  // base テンプレでは新評価軸（ガイア近接・星系クラスタ）をUI既定値で有効化。
  // LF ランは SOFT_PARAMS のまま（フィールド不在= evaluateSoft が完全スキップ）。
  const softParams: SoftParams =
    templateId === "base_34p"
      ? { ...SOFT_PARAMS, wGaiaDist1: 5, wGaiaDist2: 3, wGaiaDist3: 1, wClusterSize: 1 }
      : SOFT_PARAMS;
  const methodField = placementMethod === undefined ? {} : { placementMethod };

  let logicalMap: ReturnType<typeof buildLogicalMap>;
  try {
    logicalMap = buildLogicalMap({ seed, templateId, placementMethod });
  } catch (e: any) {
    return {
      seed,
      templateId,
      ...methodField,
      status: "buildLogicalMapFailed",
      errorMessage: String(e?.message ?? e),
    };
  }

  const placement = Array.isArray((logicalMap as any)?.placement)
    ? (logicalMap as any).placement
    : [];

  let extracted: ReturnType<typeof extractForEval>;
  try {
    extracted = extractForEval(logicalMap, hardParams);
  } catch (e: any) {
    return {
      seed,
      templateId,
      ...methodField,
      status: "extractForEvalFailed",
      errorMessage: String(e?.message ?? e),
      placementHash: computePlacementHash(placement),
      placement: placement.map((p: any) => ({
        slotId: String(p.slotId),
        sectorId: String(p.sectorId),
        rot: Number(p.rot ?? 0),
      })),
    };
  }

  const hardResult = checkHardConstraints(extracted, placement as any, hardParams);
  const softResult = evaluateSoft(extracted, softParams);

  const scoutHits = softResult.breakdown.audit.scout.scoutHits ?? [];
  const scoutCoreHits = softResult.breakdown.audit.scoutCore.coreHits ?? [];

  return {
    seed,
    templateId,
    ...methodField,
    status: "ok",
    placementHash: extracted.placementHash,
    placement: placement.map((p: any) => ({
      slotId: String(p.slotId),
      sectorId: String(p.sectorId),
      rot: Number(p.rot ?? 0),
    })),
    hard: {
      pass: hardResult.pass,
      failReasons: hardResult.pass ? [] : hardResult.reasons.map((r) => r.reason),
      reasonDetails: hardResult.pass ? [] : hardResult.reasons,
    },
    soft: {
      score: round(softResult.score),
      outerCountByType: softResult.breakdown.audit.outerCountByType,
      touchCountByType: softResult.breakdown.audit.touchCountByType,
      scoutByType: softResult.breakdown.axesByType.scout,
      scoutCoreByType: softResult.breakdown.axesByType.scoutCore,
      planetTypeTotals: softResult.breakdown.planetTypeTotals,
      imbalance: softResult.breakdown.imbalance,
      scoutHitsCount: scoutHits.length,
      scoutHitsValueSum: sum(scoutHits.map((h: any) => Number(h.value ?? 0))),
      scoutCoreHitsCount: scoutCoreHits.length,
      scoutCoreHitsValueSum: sum(scoutCoreHits.map((h: any) => Number(h.value ?? 0))),
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export type Snapshot = {
  meta: {
    templateIds: string[];
    seedCount: number;
    hardParams: HardParams;
    softParams: SoftParams;
  };
  entries: SnapshotEntry[];
};

/** Path of the committed baseline, relative to the repo root. */
export const BASELINE_PATH = "scripts/__snapshots__/baseline.json";

/** Runs every (templateId[, placementMethod], seed) run through the pipeline. Pure: no I/O. */
export function buildSnapshot(): Snapshot {
  const entries: SnapshotEntry[] = [];
  for (const run of RUNS) {
    for (const seed of SEEDS) {
      entries.push(runOne(run.templateId, seed, run.placementMethod));
    }
  }

  // Stable ordering independent of iteration order above.
  entries.sort((a, b) => {
    if (a.templateId !== b.templateId) return a.templateId < b.templateId ? -1 : 1;
    const am = a.placementMethod ?? 0;
    const bm = b.placementMethod ?? 0;
    if (am !== bm) return am - bm;
    return a.seed < b.seed ? -1 : a.seed > b.seed ? 1 : 0;
  });

  return {
    meta: {
      templateIds: [...new Set(RUNS.map((r) => r.templateId))].sort(),
      seedCount: SEEDS.length,
      hardParams: HARD_PARAMS,
      softParams: SOFT_PARAMS,
    },
    entries,
  };
}

/** Deterministic serialization: sorted keys, 2-space indent, trailing newline. */
export function serializeSnapshot(snapshot: Snapshot): string {
  return JSON.stringify(sortKeysDeep(snapshot), null, 2) + "\n";
}

function main() {
  runCheckOrExit();

  const outArg = process.argv[2];
  const outPath = resolve(process.cwd(), outArg ?? BASELINE_PATH);

  const snapshot = buildSnapshot();

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, serializeSnapshot(snapshot), "utf8");

  // eslint-disable-next-line no-console
  console.log(
    `Wrote ${snapshot.entries.length} entries (${RUNS.length} runs x ${SEEDS.length} seeds) to ${outPath}`
  );
}

if (isMainModule(import.meta.url)) {
  main();
}
