// scripts/_probe_h5.ts
//
// H5 (max connected planet cluster) probe:
// - For 3p/4p templates, over many seeds, compute the max connected-planet
//   cluster size distribution (planets only, i.e. h5IncludeScouts=OFF).
// - For a few candidate caps (N=5,8,10), report the rejection rate.
// - Assert the boundary: maxClusterSize === N passes, N+1 fails.
// - Additionally (h5IncludeScouts=ON): compute the max connected cluster size
//   distribution when scout cells are also included as planets, report a
//   rejection-rate table across the full observed range of N, find the
//   largest N for which the rejection rate is >= 80%, and run the same
//   boundary assertions with includeScouts=true.
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

function maxClusterSizeForSeed(templateId: string, seed: number, includeScouts: boolean): number {
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
  let hi =
    extracted.cells.filter((c) => c.kind === "planet").length +
    (includeScouts ? extracted.scoutCells.length : 0);
  // hi is guaranteed to pass (cap == total cell count >= max cluster size)
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const res = checkH5ConnectedCap(extracted, mid, includeScouts);
    if (res.pass) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo; // smallest cap that passes == maxClusterSize
}

function stats(sorted: number[]) {
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  return { min, max, mean, median };
}

function main() {
  // ===== Part 1: OFF (planets only) — unchanged behavior, existing probe =====
  const offBoundaryByTemplate: Record<string, number> = {};

  for (const templateId of TEMPLATE_IDS) {
    console.log(`\n=== ${templateId} (h5IncludeScouts=OFF) ===`);

    // sizes[i] MUST stay aligned with seed = 1 + i (the boundary-check loop
    // below re-derives the seed from the index), so keep a separate sorted
    // copy for stats/histogram instead of sorting sizes itself.
    const sizes: number[] = [];
    for (let i = 0; i < SEED_COUNT; i++) {
      const seed = 1 + i;
      const maxSize = maxClusterSizeForSeed(templateId, seed, false);
      sizes.push(maxSize);
    }

    const sorted = [...sizes].sort((a, b) => a - b);
    const { min, max, mean, median } = stats(sorted);

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

    // 80% rejection-rate boundary (reference, OFF case): largest N such that
    // rejection rate (fraction of seeds with maxSize > N) is >= 80%.
    let off80Boundary: number | null = null;
    for (let n = min; n <= max; n++) {
      const rejected = sorted.filter((s) => s > n).length;
      const rate = rejected / sorted.length;
      if (rate >= 0.8) off80Boundary = n;
    }
    offBoundaryByTemplate[templateId] = off80Boundary ?? -1;
    console.log(`  80% rejection boundary (OFF, largest N with rejectRate>=80%): ${off80Boundary ?? "none (max<80% even at N=min)"}`);

    // Boundary assertion: find a seed where maxSize is known, verify
    // maxSize -> pass, maxSize+1 -> fail (unless maxSize == 0, i.e. no planets).
    let boundaryChecked = 0;
    for (let i = 0; i < SEED_COUNT; i++) {
      const seed = 1 + i;
      const logicalMap = buildLogicalMap({ seed, templateId });
      const extracted = extractForEval(logicalMap, BASE_HARD);
      const maxSize = sizes[i];
      if (maxSize <= 0) continue;

      const passAtExact = checkH5ConnectedCap(extracted, maxSize, false);
      if (!passAtExact.pass) {
        throw new Error(
          `[BOUNDARY FAIL/OFF] templateId=${templateId} seed=${seed} maxSize=${maxSize} expected pass at cap=maxSize but got fail: ${JSON.stringify(passAtExact)}`
        );
      }

      // Now verify cap = maxSize - 1 fails (if maxSize >= 1, maxSize-1 could be 0 -> disabled).
      if (maxSize - 1 > 0) {
        const failAtExactMinus1 = checkH5ConnectedCap(extracted, maxSize - 1, false);
        if (failAtExactMinus1.pass) {
          throw new Error(
            `[BOUNDARY FAIL/OFF] templateId=${templateId} seed=${seed} maxSize=${maxSize} expected FAIL at cap=maxSize-1 but got pass`
          );
        }
        boundaryChecked++;
      }
    }
    console.log(`  boundary assertions (OFF) checked (cap=maxSize-1 fails, cap=maxSize passes): ${boundaryChecked} seeds OK`);
  }

  // ===== Part 2: ON (h5IncludeScouts=true) =====
  const onBoundaryByTemplate: Record<string, number> = {};

  for (const templateId of TEMPLATE_IDS) {
    console.log(`\n=== ${templateId} (h5IncludeScouts=ON) ===`);

    const sizes: number[] = [];
    for (let i = 0; i < SEED_COUNT; i++) {
      const seed = 1 + i;
      const maxSize = maxClusterSizeForSeed(templateId, seed, true);
      sizes.push(maxSize);
    }

    const sorted = [...sizes].sort((a, b) => a - b);
    const { min, max, mean, median } = stats(sorted);

    const hist: Record<number, number> = {};
    for (const s of sorted) hist[s] = (hist[s] ?? 0) + 1;

    console.log(`  seeds=${SEED_COUNT} min=${min} max=${max} mean=${mean.toFixed(2)} median=${median}`);
    console.log(`  histogram:`);
    for (const k of Object.keys(hist).map(Number).sort((a, b) => a - b)) {
      console.log(`    size=${k}: count=${hist[k]}`);
    }

    // Rejection-rate table across the full observed range of N (ON case).
    console.log(`  rejection-rate table (N=${min}..${max}):`);
    let on80Boundary: number | null = null;
    for (let n = min; n <= max; n++) {
      const rejected = sorted.filter((s) => s > n).length;
      const rate = rejected / sorted.length;
      console.log(`    N=${n}: rejected=${rejected}/${sorted.length} (${(rate * 100).toFixed(1)}%)`);
      if (rate >= 0.8) on80Boundary = n;
    }
    onBoundaryByTemplate[templateId] = on80Boundary ?? -1;
    console.log(`  80% rejection boundary (ON, largest N with rejectRate>=80%): ${on80Boundary ?? "none (max<80% even at N=min)"}`);

    // Boundary assertions with includeScouts=true.
    let boundaryChecked = 0;
    for (let i = 0; i < SEED_COUNT; i++) {
      const seed = 1 + i;
      const logicalMap = buildLogicalMap({ seed, templateId });
      const extracted = extractForEval(logicalMap, BASE_HARD);
      const maxSize = sizes[i];
      if (maxSize <= 0) continue;

      const passAtExact = checkH5ConnectedCap(extracted, maxSize, true);
      if (!passAtExact.pass) {
        throw new Error(
          `[BOUNDARY FAIL/ON] templateId=${templateId} seed=${seed} maxSize=${maxSize} expected pass at cap=maxSize but got fail: ${JSON.stringify(passAtExact)}`
        );
      }

      if (maxSize - 1 > 0) {
        const failAtExactMinus1 = checkH5ConnectedCap(extracted, maxSize - 1, true);
        if (failAtExactMinus1.pass) {
          throw new Error(
            `[BOUNDARY FAIL/ON] templateId=${templateId} seed=${seed} maxSize=${maxSize} expected FAIL at cap=maxSize-1 but got pass`
          );
        }
        boundaryChecked++;
      }
    }
    console.log(`  boundary assertions (ON) checked (cap=maxSize-1 fails, cap=maxSize passes): ${boundaryChecked} seeds OK`);
  }

  console.log("\n=== Summary: 80% rejection-rate boundary (largest N with rejectRate>=80%) ===");
  for (const templateId of TEMPLATE_IDS) {
    console.log(`  ${templateId}: OFF(planets only)=${offBoundaryByTemplate[templateId]}  ON(include scouts)=${onBoundaryByTemplate[templateId]}`);
  }

  console.log("\nAll boundary assertions passed.");
}

main();
