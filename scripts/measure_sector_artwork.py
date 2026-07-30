#!/usr/bin/env python
"""セクター画像内のセル格子を実測する（src/gaia/viewer/artworkCalib.ts の根拠）。

必要なもの: Pillow のみ（`pip install pillow`）。numpy は不要。
使い方:
    # 1) セクター定義を JSON に吐く
    npx tsx scripts/dump_sector_cells.ts > /tmp/sectors.json
    # 2) 画像を測る
    python scripts/measure_sector_artwork.py /tmp/sectors.json

やっていること:
  画像は「セル群の外接矩形でぴったり切り出されている」ので、セル形状と
  アートワークの向き（回転）が決まれば、画像内のセル位置は計算で決まる。
  向きだけが未知なので 0..330 度＋鏡像を総当たりし、
  「惑星セルの予測位置が背景でない／空セルの予測位置が背景である」を
  最も満たす向きを採用する。

出力の見かた:
  - 的中率が 95% を超えていれば向きは確定（残りは背景判定のしきい値の問題で、
    装飾のある空セルや暗いチタニウム惑星が引っかかる）。
  - 惑星色の sd が小さい（1〜2程度）ほど、予測位置が惑星の中心に当たっている。
"""
import json
import math
import sys
from collections import defaultdict

from PIL import Image

SQRT3 = math.sqrt(3)


def axial_pointy(q, r):
    return (SQRT3 * (q + r / 2), 1.5 * r)


def xf(p, deg, mirror):
    x, y = p
    if mirror:
        x = -x
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return (x * c - y * s, x * s + y * c)


def geom(cells, W, H, deg, mirror):
    """向きを決め打ちして pitch と格子中心を解く（当てはめではなく連立の解）。"""
    verts = [
        (math.cos(math.radians(90 + 60 * k)), math.sin(math.radians(90 + 60 * k)))
        for k in range(6)
    ]
    vv = [xf(v, deg, mirror) for v in verts]
    hx = max(abs(v[0]) for v in vv)
    hy = max(abs(v[1]) for v in vv)
    pts = [xf(axial_pointy(q, r), deg, mirror) for (q, r, _k) in cells]
    dx = max(p[0] for p in pts) - min(p[0] for p in pts)
    dy = max(p[1] for p in pts) - min(p[1] for p in pts)
    sx = W / (dx + 2 * hx)
    sy = H / (dy + 2 * hy)
    return {
        "deg": deg,
        "mirror": mirror,
        "pitch": (sx + sy) / 2,
        "aspect_err": abs(sx - sy) / max(sx, sy),
        "mx": (max(p[0] for p in pts) + min(p[0] for p in pts)) / 2,
        "my": (max(p[1] for p in pts) + min(p[1] for p in pts)) / 2,
    }


def predict(cell, g, W, H):
    p = xf(axial_pointy(cell[0], cell[1]), g["deg"], g["mirror"])
    return ((p[0] - g["mx"]) * g["pitch"] + W / 2, (p[1] - g["my"]) * g["pitch"] + H / 2)


def sample(px, W, H, cx, cy, rad):
    """予測位置まわりの円内の「背景率」と、背景でない画素の平均色。"""
    n = bg = 0
    tot = [0, 0, 0]
    ri = int(rad)
    for dy in range(-ri, ri + 1):
        for dx in range(-ri, ri + 1):
            if dx * dx + dy * dy > rad * rad:
                continue
            x, y = int(cx + dx), int(cy + dy)
            n += 1
            if not (0 <= x < W and 0 <= y < H):
                bg += 1
                continue
            r, g_, b, a = px[x, y]
            # 背景＝透明、または「暗くて青寄り」の宇宙背景
            if a < 128 or (max(r, g_, b) < 95 and b >= r and b >= g_):
                bg += 1
            else:
                tot[0] += r
                tot[1] += g_
                tot[2] += b
    lit = n - bg
    mean = tuple(round(t / lit) for t in tot) if lit else (0, 0, 0)
    return (bg / n if n else 1.0), mean


def score(sec, deg, mirror, palette=None):
    with Image.open(sec["path"]) as im0:
        im = im0.convert("RGBA")
    W, H = im.size
    px = im.load()
    cells = [tuple(c) for c in sec["cells"]]
    g = geom(cells, W, H, deg, mirror)
    rad = g["pitch"] * 0.32
    ok = 0
    for c in cells:
        cx, cy = predict(c, g, W, H)
        bgr, mean = sample(px, W, H, cx, cy, rad)
        if c[2] == "EMPTY":
            ok += 1 if bgr > 0.55 else 0
        else:
            if bgr < 0.45:
                ok += 1
                if palette is not None:
                    palette[c[2]].append(mean)
    return ok, len(cells), g


def main(spec_path):
    spec = json.load(open(spec_path, encoding="utf-8"))
    groups = defaultdict(list)
    for s in spec:
        with Image.open(s["path"]) as im:
            groups[im.size].append(s)

    chosen = {}
    for size, secs in sorted(groups.items()):
        print(f"\n=== class {size[0]}x{size[1]} ({len(secs)} sectors) ===")
        cand = []
        for deg in range(0, 360, 30):
            for mirror in (False, True):
                ok = tot = 0
                g = None
                for s in secs:
                    o, t, g = score(s, deg, mirror)
                    ok += o
                    tot += t
                cand.append((ok / tot, deg, mirror, g["pitch"], g["aspect_err"]))
        # 的中率が同率ならアスペクト誤差の小さい向き、それも同率なら小さい角度。
        # 単セルのタイルは中心が動かないので的中率だけでは向きが決まらず、
        # さらに六角は60度対称なので 30/90/150... は等価（マーカー位置には影響しない）。
        cand.sort(key=lambda x: (-x[0], round(x[4], 6), x[1]))
        for rate, deg, mirror, pitch, aerr in cand[:3]:
            print(
                f"   deg={deg:>3} mirror={str(mirror):<5} pitch={pitch:7.2f} "
                f"aspectErr={aerr * 100:5.2f}%  的中={rate * 100:6.2f}%"
            )
        chosen[size] = cand[0]

    print("\n=== 採用値（artworkCalib.ts に入れる数値） ===")
    palette = defaultdict(list)
    gok = gtot = 0
    for size, secs in sorted(groups.items()):
        rate, deg, mirror, pitch, aerr = chosen[size]
        ok = tot = 0
        for s in secs:
            o, t, _ = score(s, deg, mirror, palette)
            ok += o
            tot += t
        gok += ok
        gtot += tot
        print(
            f"  imgW={size[0]} imgH={size[1]} pitch={pitch:.2f} deg={deg}"
            f"   （的中 {ok}/{tot}, アスペクト誤差 {aerr * 100:.2f}%）"
        )
    print(f"\n  合計的中 {gok}/{gtot} ({gok / gtot * 100:.1f}%)")

    print("\n=== 予測位置でサンプルした惑星色（sdが小さい＝中心に当たっている） ===")
    for kind, cols in sorted(palette.items()):
        n = len(cols)
        m = tuple(round(sum(c[i] for c in cols) / n) for i in range(3))
        sd = tuple(
            round(math.sqrt(sum((c[i] - m[i]) ** 2 for c in cols) / n)) for i in range(3)
        )
        print(f"  {kind:<9} n={n:<3} mean={m} sd={sd}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        raise SystemExit(1)
    main(sys.argv[1])
