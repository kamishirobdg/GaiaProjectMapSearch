// scripts/_gen_base34p_outer.ts
// 1) 3p_lostFleet の OUTER/TOUCH が「境界セル（union内隣接<6）/その内側リング」規則で
//    再現できることを検証（規則のリバースエンジニアリング確認）
// 2) 同じ規則で base_34p の OUTER/TOUCH を生成して出力
import { buildLogicalMap, buildLogicalMapFromPlacement } from "../src/gaia/logicalMap/buildLogicalMap";
import { basePlacementFromSeed } from "../src/gaia/board/basePlacementFromSeed";
import { getTemplateOuterTouchSets } from "../src/gaia/templates/templateSets";
import { AXIAL_DIRS, keyOf, axialAdd, parseKey } from "../src/gaia/board/axial";

function ringSets(cellKeys: Set<string>) {
  const outer = new Set<string>();
  for (const k of cellKeys) {
    const p = parseKey(k);
    let n = 0;
    for (const d of AXIAL_DIRS) if (cellKeys.has(keyOf(axialAdd(p, d)))) n++;
    if (n < 6) outer.add(k);
  }
  const touch = new Set<string>();
  for (const k of cellKeys) {
    if (outer.has(k)) continue;
    const p = parseKey(k);
    if (AXIAL_DIRS.some((d) => outer.has(keyOf(axialAdd(p, d))))) touch.add(k);
  }
  return { outer, touch };
}

function cmp(name: string, got: Set<string>, want: Set<string>) {
  const miss = [...want].filter((x) => !got.has(x));
  const extra = [...got].filter((x) => !want.has(x));
  console.log(`${name}: got=${got.size} want=${want.size} missing=${miss.length} extra=${extra.length}`);
  if (miss.length) console.log("  missing:", miss.slice(0, 10));
  if (extra.length) console.log("  extra:", extra.slice(0, 10));
  return miss.length === 0 && extra.length === 0;
}

// --- 1) verify rule against LF 3p ---
{
  const lm = buildLogicalMap({ seed: 1, templateId: "3p_lostFleet" });
  const keys = new Set<string>([...lm.cellsByKey.keys()]);
  const { outer, touch } = ringSets(keys);
  const want = getTemplateOuterTouchSets("3p_lostFleet");
  const ok1 = cmp("3p outer", outer, new Set([...want.outerCells] as string[]));
  const ok2 = cmp("3p touch", touch, new Set([...want.touchCells] as string[]));
  console.log("3p rule reproduced:", ok1 && ok2);
}
{
  const lm = buildLogicalMap({ seed: 1, templateId: "4p_lostFleet" });
  const keys = new Set<string>([...lm.cellsByKey.keys()]);
  const { outer, touch } = ringSets(keys);
  const want = getTemplateOuterTouchSets("4p_lostFleet");
  const ok1 = cmp("4p outer", outer, new Set([...want.outerCells] as string[]));
  const ok2 = cmp("4p touch", touch, new Set([...want.touchCells] as string[]));
  console.log("4p rule reproduced:", ok1 && ok2);
}

// --- 2) generate for base_34p ---
{
  const placement = basePlacementFromSeed({ seed: 1, placementMethod: 1 });
  const lm = buildLogicalMapFromPlacement({ templateId: "base_34p", placement });
  const keys = new Set<string>([...lm.cellsByKey.keys()]);
  const { outer, touch } = ringSets(keys);
  const sortKeys = (s: Set<string>) => [...s].sort();
  console.log("base_34p OUTER (" + outer.size + "):");
  console.log(JSON.stringify(sortKeys(outer)));
  console.log("base_34p TOUCH (" + touch.size + "):");
  console.log(JSON.stringify(sortKeys(touch)));
}
