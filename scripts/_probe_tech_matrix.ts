// scripts/_probe_tech_matrix.ts
//
// 標準技術タイルの評価値を眺めるための一覧（2026-08-01）。
//   npx tsx scripts/_probe_tech_matrix.ts [--lf]
//
// 出力:
//   1. タイル×種族（研究列6つの合計）… タイル間の重さの偏りを見る
//   2. タイル×研究列（全種族の合計）… 「どの列に置かれると効くか」の偏りを見る
//   3. 種族ペアの類似度（コサイン類似度）… 似た戦略の種族が似た評価になっているか

import {
  FACTIONS,
  factionIdsForMode,
  techPositionTable,
  type FactionId,
} from "../src/gaia/eval/factionWeights";
import { RESEARCH_TRACK_IDS, type ResearchTrackId } from "../src/gaia/setup/types";

const LF = process.argv.includes("--lf");
const table = techPositionTable(LF);
const ids = factionIdsForMode(LF);
const TRACKS = RESEARCH_TRACK_IDS as readonly ResearchTrackId[];
const TRACK_JA: Record<string, string> = {
  terra: "改造", nav: "航行", ai: "AI", gaia: "ガイア", eco: "経済", sci: "科学",
};
const TILES = Object.keys(table);
const TILE_JA: Record<string, string> = {
  TS1: "鉱石1+QIC1", TS2: "種類×知識", TS3: "PI/学院パワー4", TS4: "7VP",
  TS5: "鉱石1+パワー1", TS6: "知識1+クレ1", TS7: "ガイア鉱山+3VP",
  TS8: "クレ4", TS9: "パワー4",
};
const label = (f: FactionId) => FACTIONS.find((x) => x.id === f)!.labelJa;
const pad = (s: string, n: number) => s + "　".repeat(Math.max(0, n - [...s].length));
const num = (n: number, w = 5) => n.toFixed(0).padStart(w);

const cell = (tile: string, trk: ResearchTrackId, f: FactionId) =>
  table[tile]?.[trk]?.[f] ?? 0;
const tileFaction = (tile: string, f: FactionId) =>
  TRACKS.reduce((a, t) => a + cell(tile, t, f), 0);

console.log(`標準技術の評価値（${LF ? "拡張版" : "通常版"}）\n`);

// --- 1. タイル×種族（研究列6つの合計）------------------------------------
console.log("■ タイル×種族（研究列6つの合計。フリー枠は含まない）\n");
console.log(
  "タイル　　　　　　 " + ids.map((f) => label(f).slice(0, 3).padStart(4, "　")).join("")
);
for (const tile of TILES) {
  const vals = ids.map((f) => tileFaction(tile, f));
  const sum = vals.reduce((a, b) => a + b, 0);
  console.log(
    `${pad(TILE_JA[tile] ?? tile, 9)} ${num(sum, 4)} |` +
      vals.map((v) => num(v, 4)).join("")
  );
}

// --- 2. タイル×研究列（全種族の合計）--------------------------------------
console.log(`\n■ タイル×研究列（その列に置かれたときの全種族合計）\n`);
console.log("タイル　　　　　　 合計 " + TRACKS.map((t) => TRACK_JA[t].padStart(6, "　")).join(""));
for (const tile of TILES) {
  const vals = TRACKS.map((t) => ids.reduce((a, f) => a + cell(tile, t, f), 0));
  const sum = vals.reduce((a, b) => a + b, 0);
  const nz = ids.filter((f) => tileFaction(tile, f) !== 0).length;
  console.log(
    `${pad(TILE_JA[tile] ?? tile, 9)} ${num(sum, 4)} |` +
      vals.map((v) => num(v, 6)).join("") +
      `   (効く種族 ${nz}/${ids.length})`
  );
}

// --- 3. 種族ペアの類似度 ---------------------------------------------------
// 42次元（9タイル×6列… 実際は TILES.length × 6）のベクトルとして見る。
function vec(f: FactionId): number[] {
  const v: number[] = [];
  for (const tile of TILES) for (const t of TRACKS) v.push(cell(tile, t, f));
  return v;
}
function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}
const vecs = new Map(ids.map((f) => [f, vec(f)]));

console.log(`\n■ 種族ペアの類似度（技術タイルの評価ベクトルのコサイン類似度）`);
console.log(`  1.0 に近いほど「同じタイルを同じくらい欲しがる」。\n`);
const pairs: Array<{ a: FactionId; b: FactionId; s: number }> = [];
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    pairs.push({ a: ids[i], b: ids[j], s: cosine(vecs.get(ids[i])!, vecs.get(ids[j])!) });
  }
}
pairs.sort((x, y) => y.s - x.s);
console.log("  最も似ている10組:");
for (const p of pairs.slice(0, 10)) {
  console.log(`    ${pad(label(p.a), 9)} ${pad(label(p.b), 9)} ${p.s.toFixed(3)}`);
}
console.log("  最も似ていない10組:");
for (const p of pairs.slice(-10).reverse()) {
  console.log(`    ${pad(label(p.a), 9)} ${pad(label(p.b), 9)} ${p.s.toFixed(3)}`);
}

// --- 4. 指定ペアの差分（似た戦略のはずの組を明示的に並べる）----------------
const WATCH: Array<[FactionId, FactionId, string]> = [
  ["firaks", "bescods", "研究所/技術タイルを回す"],
  ["nevlas", "itars", "パワー経済"],
  ["terrans", "itars", "ガイア計画"],
  ["terrans", "gleens", "ガイア惑星"],
  ["gleens", "itars", "ガイア惑星"],
  ["taklons", "nevlas", "パワー総量"],
  ["lantids", "xenos", "建造物を増やす"],
  ["geodens", "gleens", "惑星の種類/改造"],
  ["ivits", "ambas", "同盟を作る"],
  ["hadschHallas", "taklons", "資源を回す経済"],
];
console.log(`\n■ 似た戦略のはずのペア（タイルごとの差。|差|>=3 は ★）\n`);
for (const [a, b, why] of WATCH) {
  if (!ids.includes(a) || !ids.includes(b)) continue;
  const diffs = TILES.map((tile) => ({
    tile,
    d: tileFaction(tile, a) - tileFaction(tile, b),
  }));
  const big = diffs.filter((d) => Math.abs(d.d) >= 3);
  console.log(
    `  ${label(a)} vs ${label(b)}（${why}） 類似度 ${cosine(vecs.get(a)!, vecs.get(b)!).toFixed(3)}`
  );
  if (big.length === 0) {
    console.log(`    大きな差なし`);
  } else {
    for (const d of big) {
      const mark = Math.abs(d.d) >= 6 ? "★★" : "★";
      console.log(
        `    ${mark} ${pad(TILE_JA[d.tile] ?? d.tile, 9)} ${label(a)} ${num(
          tileFaction(d.tile, a), 3
        )} / ${label(b)} ${num(tileFaction(d.tile, b), 3)}  (差 ${d.d > 0 ? "+" : ""}${d.d})`
      );
    }
  }
  console.log("");
}
