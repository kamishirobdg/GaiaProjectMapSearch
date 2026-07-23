import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildSnapshot,
  serializeSnapshot,
  BASELINE_PATH,
  RUNS,
  type Snapshot,
} from "./regression-snapshot";
import { checkAllCoordConsistency } from "./check-coord-consistency";

// Comparison is on parsed JSON, not raw bytes: the committed baseline is
// checked out with CRLF on Windows (core.autocrlf) while the generator writes
// LF, so a byte-level diff reports a difference on every line even when
// nothing changed.
function readBaseline(): Snapshot {
  const path = resolve(process.cwd(), BASELINE_PATH);
  return JSON.parse(readFileSync(path, "utf8")) as Snapshot;
}

describe("coordinate consistency", () => {
  it("keeps display.pos == rotate60(slotCenters, 3) + C_group for every slot", () => {
    // The 4p M2/M5 slots were once copy-pasted from the 3p template, colliding
    // cells in the evaluated board while the display looked correct.
    expect(checkAllCoordConsistency()).toEqual([]);
  });
});

describe("regression snapshot", () => {
  const built = buildSnapshot();
  const baseline = readBaseline();

  it("matches the committed baseline", () => {
    // A failure means the pipeline's output moved. If the change was intended,
    // confirm the diff is limited to what you meant to change and refresh the
    // baseline in the same commit: `npm run snapshot:update`.
    expect(built).toEqual(baseline);
  });

  it("covers every run and seed the baseline recorded", () => {
    // base_34p は placementMethod 1/2/3 で3ラン、LFはテンプレごとに1ラン。
    expect(built.entries).toHaveLength(RUNS.length * baseline.meta.seedCount);
    expect(built.meta.templateIds).toEqual(baseline.meta.templateIds);
  });

  it("evaluates every seed without the pipeline throwing", () => {
    // buildLogicalMap/extractForEval failures are recorded as a status rather
    // than raised, so they would otherwise sit in the baseline unnoticed.
    const failed = built.entries.filter((e) => e.status !== "ok");
    expect(failed.map((e) => `${e.templateId}/${e.seed}: ${e.errorMessage}`)).toEqual([]);
  });

  it("serializes deterministically", () => {
    // Two runs must produce a byte-identical file, otherwise the baseline
    // churns on every regeneration and stops being a useful diff.
    expect(serializeSnapshot(buildSnapshot())).toBe(serializeSnapshot(built));
  });
});
