// scripts/_probe_lf_slotcenters.ts
//
// Phase B 調査用プローブ（2026-07-25）:
// 現行 LF slotCenters を (a) uiqoo randomizer(collision.js) の mapposition と
// (b) LFルールブック p4-5「可変的なゲームボードの配置」の構造記述 と突き合わせる。
//
// uiqoo 側の座標系: mapposition[player+"_lostfleet"] は各タイルの
// 「5行パターンの先頭行 左端セル」の axial 座標 [x,y]。タイル中心は (x, y+2)。
// （collision.js の construct() が row2 中央に [y+2][x] を置くことから導出）
//
// ★結論（2026-07-25、当初の見立てを訂正）:
//   uiqoo と現行では周辺タイルの座標が 3人1枚・4人2枚ぶん違うが、これは
//   **バグではない**。ルールブックは「残りの宙域タイルを…ランダムに置く」と
//   しており、どちらも合法な配置のバリエーション。実際、構造判定では両者とも
//   3人=中央1枚が6近傍 / 4人=隣接する中央2枚がそれぞれ6近傍 を満たす。
//   さらに現行の SMALL は中央から距離3に6枚（＝中央周りの6つの穴）＋距離6に2枚、
//   MIDDLE は距離6〜8（外周沿い）で、ルールブックの
//   「宙間タイル8枚／深宇宙宙域タイル8枚」の記述と完全に整合する。
//   → **評価側(logical)のジオメトリは正しい**。「見た目のズレ」の原因は
//     表示側（グループ別 C_group と viewerAssets の手動ピクセル補正）を疑うべき。
//
// 実行: npx tsx scripts/_probe_lf_slotcenters.ts

import { SLOT_CENTERS_3P_LOSTFLEET } from "../src/gaia/templates/3p_lostfleet_slotCenters";
import { SLOT_CENTERS_4P_LOSTFLEET } from "../src/gaia/templates/4p_lostfleet_slotCenters";
import { TEMPLATE_3P_LOSTFLEET } from "../src/gaia/data/templates/3p_lostFleet";
import { TEMPLATE_4P_LOSTFLEET } from "../src/gaia/data/templates/4p_lostFleet";

type Ax = { q: number; r: number };

// uiqoo collision.js より取得（2026-07-25）
const UIQOO_MAPPOS: Record<string, Array<[number, number]>> = {
  "3_lostfleet": [[8, 0], [12, 1], [16, 2], [3, 4], [7, 5], [11, 6], [2, 9], [6, 10], [10, 11]],
  "4_lostfleet": [[8, 0], [12, 1], [16, 2], [3, 4], [7, 5], [11, 6], [15, 7], [2, 9], [6, 10], [10, 11]],
};

const axDist = (a: Ax, b: Ax) => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -(dq + dr);
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
};

const key = (a: Ax) => `${a.q},${a.r}`;

function uiqooCenters(k: string): Ax[] {
  return UIQOO_MAPPOS[k].map(([x, y]) => ({ q: x, r: y + 2 }));
}

function largeCenters(centers: Record<string, { q: number; r: number }>): Array<{ id: string; c: Ax }> {
  return Object.entries(centers)
    .filter(([id]) => id.startsWith("L"))
    .map(([id, c]) => ({ id, c }));
}

function report(label: string, ours: Array<{ id: string; c: Ax }>, theirs: Ax[]) {
  console.log(`\n===== ${label} =====`);
  console.log(`ours=${ours.length} slots / uiqoo=${theirs.length} tiles`);

  // 1) 一様オフセットの推定（ours - uiqoo が一定か）: 最頻オフセットを取る
  const offCount = new Map<string, number>();
  for (const o of ours) {
    for (const t of theirs) {
      const k = `${o.c.q - t.q},${o.c.r - t.r}`;
      offCount.set(k, (offCount.get(k) ?? 0) + 1);
    }
  }
  const [bestOff, bestN] = [...offCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const [oq, or_] = bestOff.split(",").map(Number);
  console.log(`最頻オフセット ours-uiqoo = (${oq}, ${or_}) で ${bestN}/${ours.length} 枚一致`);

  // 2) オフセット適用後にどれが一致し、どれが外れるか
  const shifted = new Set(theirs.map((t) => key({ q: t.q + oq, r: t.r + or_ })));
  const matchedIds = ours.filter((o) => shifted.has(key(o.c))).map((o) => o.id);
  const mismatchedOurs = ours.filter((o) => !shifted.has(key(o.c)));
  const coveredByOurs = new Set(ours.map((o) => key(o.c)));
  const mismatchedTheirs = theirs
    .map((t) => ({ q: t.q + oq, r: t.r + or_ }))
    .filter((t) => !coveredByOurs.has(key(t)));
  console.log(`一致: ${matchedIds.join(",")}`);
  for (const m of mismatchedOurs) console.log(`  ✗ ours ${m.id} = (${m.c.q},${m.c.r})`);
  for (const t of mismatchedTheirs) console.log(`  → uiqoo では (${t.q},${t.r}) が期待される`);

  // 3) 格子整合: 各中心から最近傍中心までの距離（LARGE同士は距離5が正常）
  const bad: string[] = [];
  for (const o of ours) {
    const dists = ours.filter((x) => x.id !== o.id).map((x) => axDist(o.c, x.c));
    const min = Math.min(...dists);
    if (min !== 5) bad.push(`${o.id}(min=${min})`);
  }
  console.log(bad.length === 0 ? "格子整合: 全スロットの最近傍距離=5 ✓" : `格子整合の異常: ${bad.join(", ")}`);
}

/**
 * タイル中心を axial のまま「行(r)ごとに q でインデント」して描画する。
 * collision.js の print() と同じ見せ方で、盤面の形が目で比較できる。
 */
function draw(label: string, pts: Array<{ id: string; c: Ax }>) {
  console.log(`\n--- ${label} ---`);
  const minR = Math.min(...pts.map((p) => p.c.r));
  const maxR = Math.max(...pts.map((p) => p.c.r));
  const minQ = Math.min(...pts.map((p) => p.c.q));
  for (let r = minR; r <= maxR; r++) {
    const row = pts.filter((p) => p.c.r === r).sort((a, b) => a.c.q - b.c.q);
    if (row.length === 0) continue;
    let line = " ".repeat(Math.max(0, r - minR)); // 行ごとのインデント（axial描画）
    let cursor = minQ;
    for (const p of row) {
      line += "   ".repeat(Math.max(0, p.c.q - cursor));
      line += p.id.padEnd(3, " ");
      cursor = p.c.q + 1;
    }
    console.log(`r=${String(r).padStart(3)} |${line}`);
  }
}

/**
 * ルールブック（LF「可変的なゲームボードの配置」p4-5）の構造判定。
 *   3人: 中央1枚 + それを囲む6枚 + 残り2枚
 *   4人: 中央に並べた2枚 + 周囲8枚（中央2枚はそれぞれ6枚に囲まれ、互いに隣接）
 * LFは各タイルを1スペースずらして置くため、隣接タイル中心間距離は 5 だが
 * 格子方向が基本版(密充填)とは異なる（(4,1)/(5,-4)/(1,-5) 系）。
 */
function structureCheck(label: string, pts: Array<{ id: string; c: Ax }>, expectCenters: number) {
  const deg = pts.map((p) => ({
    id: p.id,
    c: p.c,
    n: pts.filter((x) => x.id !== p.id && axDist(p.c, x.c) === 5).length,
  }));
  const centers = deg.filter((d) => d.n === 6);
  const ok = centers.length === expectCenters;
  console.log(
    `\n[ルールブック構造] ${label}: 6近傍を持つ中央タイル=${centers.length}枚 ` +
      `(期待${expectCenters}枚) ${ok ? "✓ 一致" : "✗ 不一致"}`
  );
  console.log(
    "  近傍数: " + deg.map((d) => `${d.id}:${d.n}`).join(" ")
  );
  if (centers.length === 2) {
    const adj = axDist(centers[0].c, centers[1].c) === 5;
    console.log(`  中央2枚が隣接: ${adj ? "✓" : "✗"}`);
  }
}

report("3p Lost Fleet", largeCenters(SLOT_CENTERS_3P_LOSTFLEET), uiqooCenters("3_lostfleet"));
structureCheck("3p ours", largeCenters(SLOT_CENTERS_3P_LOSTFLEET), 1);
structureCheck(
  "3p uiqoo",
  uiqooCenters("3_lostfleet").map((c, i) => ({ id: `T${i + 1}`, c })),
  1
);
draw("3p ours (現行 slotCenters)", largeCenters(SLOT_CENTERS_3P_LOSTFLEET));
draw(
  "3p uiqoo (+ours基準へオフセット)",
  uiqooCenters("3_lostfleet").map((c, i) => ({ id: `T${i + 1}`, c: { q: c.q, r: c.r + 2 } }))
);

// 表示側テンプレートの形（display.pos）も描く。評価側と同じ形のはず
// （display == rotate180(slotCenters)+C の恒久関係）。ここがズレていれば
// 「表示だけ正しい/評価だけ正しい」の切り分けができる。
const displayLarge = (tpl: { slots: Array<{ slotId: string; pos: Ax; accepts: string[] }> }) =>
  tpl.slots.filter((s) => s.slotId.startsWith("L")).map((s) => ({ id: s.slotId, c: s.pos }));
draw("3p ours (表示テンプレ display.pos)", displayLarge(TEMPLATE_3P_LOSTFLEET as any));

report("4p Lost Fleet", largeCenters(SLOT_CENTERS_4P_LOSTFLEET), uiqooCenters("4_lostfleet"));
structureCheck("4p ours", largeCenters(SLOT_CENTERS_4P_LOSTFLEET), 2);
structureCheck(
  "4p uiqoo",
  uiqooCenters("4_lostfleet").map((c, i) => ({ id: `T${i + 1}`, c })),
  2
);
draw("4p ours (現行 slotCenters)", largeCenters(SLOT_CENTERS_4P_LOSTFLEET));
draw("4p ours (表示テンプレ display.pos)", displayLarge(TEMPLATE_4P_LOSTFLEET as any));
draw(
  "4p uiqoo (+ours基準へオフセット)",
  uiqooCenters("4_lostfleet").map((c, i) => ({ id: `T${i + 1}`, c: { q: c.q, r: c.r + 2 } }))
);
