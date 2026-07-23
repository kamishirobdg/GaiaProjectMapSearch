// scripts/_probe_base34p_rates.ts
// base_34p の H0/H1/H2 棄却率の実測（docs/map-base-spec.md §4 の宿題）
// Usage: npx tsx scripts/_probe_base34p_rates.ts
import { buildLogicalMap } from "../src/gaia/logicalMap/buildLogicalMap";
import { extractForEval, type HardParams } from "../src/gaia/eval/extractForEval";
import { checkH0SameKindAdjacency, checkH1MinDist, checkH2OuterColorCap } from "../src/gaia/constraints";

const N = 2000;
for (const method of [1, 2, 3] as const) {
  let h0pass = 0, h1pass3 = 0;
  const h2pass: Record<number, number> = {1:0,2:0,3:0};
  let h0h1 = 0;
  const hard: HardParams = { minSameColorDist: 0, outerSameColorMax: 99, centerMode: "NONE" };
  for (let seed = 1; seed <= N; seed++) {
    const lm = buildLogicalMap({ seed, templateId: "base_34p", placementMethod: method });
    const ex = extractForEval(lm, hard);
    const h0 = checkH0SameKindAdjacency(ex, true).pass;
    const h1 = checkH1MinDist(ex, 3).pass;
    if (h0) h0pass++;
    if (h1) h1pass3++;
    if (h0 && h1) h0h1++;
    for (const cap of [1, 2, 3]) if (checkH2OuterColorCap(ex, cap).pass) h2pass[cap]++;
  }
  console.log(`method=${method}: H0 pass=${(100*h0pass/N).toFixed(1)}% | H1(3) pass=${(100*h1pass3/N).toFixed(1)}% | H0&H1(3)=${(100*h0h1/N).toFixed(1)}% | H2 cap1=${(100*h2pass[1]/N).toFixed(1)}% cap2=${(100*h2pass[2]/N).toFixed(1)}% cap3=${(100*h2pass[3]/N).toFixed(1)}%`);
}

// 複合通過率（H0∧H1∧H2の組合せ）
{
  const N = 5000;
  const hard: HardParams = { minSameColorDist: 0, outerSameColorMax: 99, centerMode: "NONE" };
  for (const method of [1, 3] as const) {
    const combos: Record<string, number> = {};
    for (let seed = 1; seed <= N; seed++) {
      const lm = buildLogicalMap({ seed, templateId: "base_34p", placementMethod: method });
      const ex = extractForEval(lm, hard);
      const h0 = checkH0SameKindAdjacency(ex, true).pass;
      if (!h0) continue;
      for (const d of [0, 3]) {
        if (d > 0 && !checkH1MinDist(ex, d).pass) continue;
        for (const cap of [1, 2, 3]) {
          if (!checkH2OuterColorCap(ex, cap).pass) continue;
          const k = `H0&H1(${d})&H2(${cap})`;
          combos[k] = (combos[k] ?? 0) + 1;
        }
      }
    }
    console.log(`method=${method} (N=${N}):`, Object.fromEntries(Object.entries(combos).map(([k,v])=>[k,(100*v/N).toFixed(2)+"%"])));
  }
}
