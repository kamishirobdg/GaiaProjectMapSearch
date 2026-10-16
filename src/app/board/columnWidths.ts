// src/app/board/columnWidths.ts
//
// 狭い幅の内訳表で、枠の余りを数値の列に配る計算（2026-10-16 ユーザー確定）。
//
// 方針: 種族名の列（先頭）は内容幅のまま。余りは数値の列に「水を注ぐ」ように配る。
//   1. いちばん狭い列を、次に狭い列の幅まで上げる（同じ幅の列はまとめて上げる）。余りが尽きるまで繰り返す。
//      余りが足りず等しくならない場合も、狭い列から順に上げるので均等に近づく。
//   2. 全数値列が等しくなってまだ余りがあれば、残りを数値の列に均等に足す。
// 経緯: v1.6.4 で狭い幅を内容幅にしたら、412px の端末で枠の右に 83px の余りが出て違和感（設計ノート 2.5）。

/**
 * @param content 各列の内容幅（先頭が種族名の列）
 * @param avail   枠の幅
 * @param fixedCols 余りを配らない先頭の列数（既定 1 ＝ 種族名）
 * @returns 列幅の配列（合計 ＝ avail）。余りが無い（内容幅が枠以上）か列が足りないときは null
 */
export function distributeSurplus(content: readonly number[], avail: number, fixedCols = 1): number[] | null {
  const n = content.length;
  if (n <= fixedCols) return null;
  const total = content.reduce((a, b) => a + b, 0);
  let surplus = avail - total;
  if (!(surplus > 0.5)) return null;

  const widths = content.slice();
  // 数値列の添字を幅の昇順に
  const idx = [...Array(n - fixedCols)].map((_, i) => i + fixedCols).sort((a, b) => widths[a] - widths[b]);

  // 1. 水を注ぐ: 現在の最小の群（同じ幅）を次の水位まで上げる
  let k = 1; // 最小の群の列数（idx の先頭 k 個）
  while (surplus > 1e-9) {
    const level = widths[idx[0]];
    while (k < idx.length && Math.abs(widths[idx[k]] - level) < 1e-9) k++;
    if (k >= idx.length) break; // 全列が等しい
    const next = widths[idx[k]];
    const cost = (next - level) * k;
    if (surplus >= cost) {
      for (let i = 0; i < k; i++) widths[idx[i]] = next;
      surplus -= cost;
    } else {
      const add = surplus / k;
      for (let i = 0; i < k; i++) widths[idx[i]] = level + add;
      surplus = 0;
    }
  }
  // 2. 全列が等しくなってもまだ余れば均等に
  if (surplus > 1e-9) {
    const add = surplus / idx.length;
    for (const i of idx) widths[i] += add;
  }
  return widths;
}
