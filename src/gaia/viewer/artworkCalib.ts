// src/gaia/viewer/artworkCalib.ts
//
// セクター画像（アートワーク）内のセル格子の実測値。2026-07-30。
//
// これがあるとタイル画像の上に「セル単位」でマーカーを置ける。過去に
// 「セル単位は無理」と結論したのは *グローバルなセル格子の再構成* の話で
// （テンプレのスロット格子とセクタのセル格子が別系なのは事実）、
// 「タイル画像の中のどこにセルがあるか」は別問題であり、こちらは測れる。
//
// 測り方（scripts/measure-sector-artwork.ts で再現できる）:
//   全39セクターの PNG について、各セルの予測位置の色をサンプルし、
//   「惑星セルは背景でない／空セルは背景である」を満たす向きを総当たりで選んだ。
//   結果、3つの画像クラスすべてで矛盾なく一致した（下表）。裏付けとして、
//   確定した向きでサンプルした惑星色は種別ごとに標準偏差 sd=(1,1,1) 程度に
//   収束する＝予測位置が惑星の中心に当たっている。
//
// 画像は「セル群の外接矩形でぴったり切り出されている」ので、
// pitch と向きだけで画像内の座標が決まる（アスペクト誤差 0.02〜0.63%）。

export type Accepts0 = "LARGE" | "MIDDLE" | "SMALL";

export type ArtworkCalib = {
  /** PNG の実寸（この寸法に対して pitch を測った） */
  imgW: number;
  imgH: number;
  /** 画像内のセル格子の間隔（画像ピクセル / hex 1つ分） */
  pitch: number;
  /**
   * モデル（pointy-top の軸座標）に対する、アートワーク格子の回転（度）。
   * LARGE/SMALL は flat-top で描かれているので +30、
   * MIDDLE（3セルの三角）は +120（三角は120°対称なので形だけでは決まらず、
   * どのセルがどこに来るかで確定した）。
   */
  deg: number;
};

export const ARTWORK_CALIB_BY_ACCEPTS: Record<Accepts0, ArtworkCalib> = {
  // 19セル（半径2）: 01..10 / 05b / 06b / 07b。アスペクト誤差 0.19%
  LARGE: { imgW: 650, imgH: 705, pitch: 81.33, deg: 30 },
  // 3セル（三角）: 11a..18b。アスペクト誤差 0.02%
  MIDDLE: { imgW: 283, imgH: 286, pitch: 81.7, deg: 120 },
  // 1セル: 19..24 / 探査船4種。アスペクト誤差 0.63%（単セルなので向きは効かない）
  SMALL: { imgW: 165, imgH: 142, pitch: 82.24, deg: 30 },
};

const SQRT3 = Math.sqrt(3);

/** pointy-top の軸座標 → hex 1つ分を単位とする平面座標。 */
export function unitPosPointy(q: number, r: number): { x: number; y: number } {
  return { x: SQRT3 * (q + r / 2), y: 1.5 * r };
}

export function rotUnit(p: { x: number; y: number }, deg: number): { x: number; y: number } {
  const a = (Math.PI / 180) * deg;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

function parseLocalKey(key: string): { q: number; r: number } | null {
  const [qs, rs] = String(key).split(",");
  const q = Number(qs);
  const r = Number(rs);
  return Number.isFinite(q) && Number.isFinite(r) ? { q, r } : null;
}

/**
 * アートワーク格子の中心（＝画像の中心）を、セル集合の外接矩形の中心として求める。
 * 画像はセル群でぴったり切り出されているので、この点が画像中心に対応する。
 * 単位は hex（pitch を掛ければ画像ピクセルになる）。
 */
export function artworkLatticeCenter(
  cellKeys: readonly string[],
  deg: number
): { x: number; y: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const key of cellKeys) {
    const c = parseLocalKey(key);
    if (!c) continue;
    const p = rotUnit(unitPosPointy(c.q, c.r), deg);
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0 };
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

/**
 * セル群が占める外接矩形の大きさ（hex 単位、アートワークの向きで測る）。
 * pitch を掛けると PNG の実寸になるはずで、テストで較正値を検算するのに使う。
 */
export function artworkBoxUnit(
  cellKeys: readonly string[],
  deg: number
): { w: number; h: number } {
  // pointy-top の六角の頂点（外接半径1）を deg だけ回し、外形の張り出しを取る
  let hx = 0;
  let hy = 0;
  for (let k = 0; k < 6; k += 1) {
    const a = (Math.PI / 180) * (90 + 60 * k);
    const v = rotUnit({ x: Math.cos(a), y: Math.sin(a) }, deg);
    hx = Math.max(hx, Math.abs(v.x));
    hy = Math.max(hy, Math.abs(v.y));
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const key of cellKeys) {
    const c = parseLocalKey(key);
    if (!c) continue;
    const p = rotUnit(unitPosPointy(c.q, c.r), deg);
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return { w: 2 * hx, h: 2 * hy };
  return { w: maxX - minX + 2 * hx, h: maxY - minY + 2 * hy };
}

/**
 * セル1つの「画像中心からのずれ」を hex 単位で返す（アートワークの向きのまま）。
 * 呼び出し側は `pitch × 画像の実描画倍率` を掛け、タイル画像の回転を適用して
 * タイル中心へ足せば、画面上のセル中心になる。
 *
 * localKey は sector.cells のキーそのまま（fixBaseLocalCoord は掛けない。
 * セクタ定義のローカル座標は既に正しい軸座標で、実測もこの座標で合わせてある）。
 */
export function artworkCellOffsetUnit(
  cellKeys: readonly string[],
  localKey: string,
  deg: number
): { x: number; y: number } | null {
  const c = parseLocalKey(localKey);
  if (!c) return null;
  const center = artworkLatticeCenter(cellKeys, deg);
  const p = rotUnit(unitPosPointy(c.q, c.r), deg);
  return { x: p.x - center.x, y: p.y - center.y };
}
