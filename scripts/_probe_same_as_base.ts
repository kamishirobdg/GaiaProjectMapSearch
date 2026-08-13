import { EMPTY_EDITS, sameAsBase, baseSameAsBase } from "../src/gaia/eval/weightEdits";
import { WEIGHT_TABLES, factionsFor } from "../src/gaia/eval/weightTables";

for (const meta of WEIGHT_TABLES) {
  const baseIds = new Set(meta.tiles(false).map((t) => t.id));
  const axes = meta.axes(true);
  const keys = axes.length ? axes.map((a) => a.key) : [""];
  let same = 0, diff = 0, noSrc = 0, baseSame = 0, baseDiff = 0;
  for (const t of meta.tiles(true)) {
    for (const f of factionsFor(true)) {
      if (baseIds.has(t.id) && !factionsFor(false).some((x) => x.id === f.id)) { /* 拡張種族 */ }
      for (const k of keys) {
        const hasSrc =
          baseIds.has(t.id) &&
          factionsFor(false).some((x) => x.id === f.id) &&
          (k === "" || meta.axes(false).some((a) => a.key === k));
        if (!hasSrc) { noSrc++; continue; }
        sameAsBase(meta, EMPTY_EDITS, t.id, k, f.id) ? same++ : diff++;
      }
      if (baseIds.has(t.id) && factionsFor(false).some((x) => x.id === f.id)) {
        baseSameAsBase(meta, EMPTY_EDITS, t.id, f.id) ? baseSame++ : baseDiff++;
      }
    }
  }
  console.log(
    `${meta.ja.padEnd(6)} セル: 通常版と同値 ${same} / 相違 ${diff} / コピー元なし ${noSrc}` +
      `   基準値: 同値 ${baseSame} / 相違 ${baseDiff}`,
  );
}
