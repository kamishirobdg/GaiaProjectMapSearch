// scripts/_probe_h5.ts
//
// H5 (max connected planet cluster) probe:
// - For 3p/4p templates, over many seeds, compute the max connected-planet
//   cluster size distribution.
// - For a few candidate caps (N=5,8,10), report the rejection rate.
// - Assert the boundary: maxClusterSize === N passes, N+1 fails.
//
// Usage: npx tsx scripts/_probe_h5.ts

import { buildLogicalMap } from "../src/gaia/logicalMap/buildLogicalMap";
import { extractForEval, type HardParams } from "../src/gaia/eval/extractForEval";
import { checkH5ConnectedCap } from "../src/gaia/constraints";

const TEMPLATE_IDS: string[] = ["3p_lostFleet", "4p_lostFleet"];
const SEED_COUNT = 300;
const CANDIDATE_CAPS = [5, 8, 10];

const BASE_HARD: HardParams = {
  minSameColorDist: 0,
  outerSameColorMax: 999,
  centerMode: "NONE",
};

function maxClusterSizeForSeed(templateId: string, seed: number): number {
  const logicalMap = buildLogicalMap({ seed, templateId });
  const extracted = extractForEval(logicalMap, BASE_HARD);

  // Reuse the same extraction the constraint uses, but compute the max size
  // directly here (checkH5ConnectedCap only tells pass/fail + a detail string).
  // We derive maxSize from the detail string parsed out of a deliberately
  // "always fail" probe cap of 0... but cap<=0 short-circuits to pass, so
  // instead binary-search via checkH5ConnectedCap with an increasing cap.
  // NOTE: cap=0 is special-cased in checkH5ConnectedCap to mean "disabled"
  // (always pass), which breaks the monotonic pass/fail assumption a plain
  // binary search relies on. Start the search domain at 1 so every candidate
  // cap actually enables the check.
  let lo = 1;
  let hi = extracted.cells.filter((c) => c.kind === "planet").length;
  // hi is guaranteed to pass (cap == total cell count >= max cluster size)
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const res = checkH5ConnectedCap(extracted, mid);
    if (res.pass) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo; // smallest cap that passes == maxClusterSize
}

function main() {
  for (const templateId of TEMPLATE_IDS) {
    console.log(`\n=== ${templateId} ===`);

    // sizes[i] MUST stay aligned with seed = 1 + i (the boundary-check loop
    // below re-derives the seed from the index), so keep a separate sorted
    // copy for stats/histogram instead of sorting sizes itself.
    const sizes: number[] = [];
    for (let i = 0; i < SEED_COUNT; i++) {
      const seed = 1 + i;
      const maxSize = maxClusterSizeForSeed(templateId, seed);
      sizes.push(maxSize);
    }

    const sorted = [...sizes].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const median = sorted[Math.floor(sorted.length / 2)];

    // Histogram
    const hist: Record<number, number> = {};
    for (const s of sorted) hist[s] = (hist[s] ?? 0) + 1;

    console.log(`  seeds=${SEED_COUNT} min=${min} max=${max} mean=${mean.toFixed(2)} median=${median}`);
    console.log(`  histogram:`);
    for (const k of Object.keys(hist).map(Number).sort((a, b) => a - b)) {
      console.log(`    size=${k}: count=${hist[k]}`);
    }

    for (const cap of CANDIDATE_CAPS) {
      const rejected = sorted.filter((s) => s > cap).length;
      const rate = ((rejected / sorted.length) * 100).toFixed(1);
      console.log(`  cap=${cap}: rejected=${rejected}/${sorted.length} (${rate}%)`);
    }

    // Boundary assertion: find a seed where maxSize is known, verify
    // maxSize -> pass, maxSize+1 -> fail (unless maxSize == 0, i.e. no planets).
    let boundaryChecked = 0;
    for (let i = 0; i < SEED_COUNT; i++) {
      const seed = 1 + i;
      const logicalMap = buildLogicalMap({ seed, templateId });
      const extracted = extractForEval(logicalMap, BASE_HARD);
      const maxSize = sizes[i];
      if (maxSize <= 0) continue;

      const passAtExact = checkH5ConnectedCap(extracted, maxSize);
      const failAtExactPlus1 = checkH5ConnectedCap(extracted, maxSize + 1);

      if (!passAtExact.pass) {
        throw new Error(
          `[BOUNDARY FAIL] templateId=${templateId} seed=${seed} maxSize=${maxSize} expected pass at cap=maxSize but got fail: ${JSON.stringify(passAtExact)}`
        );
      }
      if (!failAtExactPlus1.pass) {
        // cap=maxSize+1 should ALSO pass (maxSize <= cap), so this branch
        // should never trigger; kept as a sanity guard.
        throw new Error(
          `[BOUNDARY FAIL] templateId=${templateId} seed=${seed} maxSize=${maxSize} expected pass at cap=maxSize+1 but got fail: ${JSON.stringify(failAtExactPlus1)}`
        );
      }

      // Now verify cap = maxSize - 1 fails (if maxSize >= 1, maxSize-1 could be 0 -> disabled).
      if (maxSize - 1 > 0) {
        const failAtExactMinus1 = checkH5ConnectedCap(extracted, maxSize - 1);
        if (failAtExactMinus1.pass) {
          throw new Error(
            `[BOUNDARY FAIL] templateId=${templateId} seed=${seed} maxSize=${maxSize} expected FAIL at cap=maxSize-1 but got pass`
          );
        }
        boundaryChecked++;
      }
    }
    console.log(`  boundary assertions checked (cap=maxSize-1 fails, cap=maxSize passes): ${boundaryChecked} seeds OK`);
  }

  console.log("\nAll boundary assertions passed.");
}

main();
