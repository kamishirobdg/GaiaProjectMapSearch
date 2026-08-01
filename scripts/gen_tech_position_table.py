# scripts/gen_tech_position_table.py
#
# 標準技術の重みテーブル（TECH_POSITION_WEIGHTS_BASE / _LF）を CSV から生成する。
# 9タイル×6列×14〜18種族＝756〜972セルあり、手で写すと必ず取り違えるため。
#
#   python scripts/gen_tech_position_table.py <csv> [--check]
#
# 既定は生成した TypeScript のブロックを標準出力へ出すので、
# src/gaia/eval/factionWeights.ts の該当テーブルの中身と差し替える
# （このスクリプトはソースを書き換えない。CLAUDE.md「作業上の注意」参照）。
#
# --check を付けると、生成せずに「いまの factionWeights.ts の値が CSV と
# 一致しているか」を全セル突き合わせで確認する（両方向。TS 側にだけある
# セルも検出する）。値を直したあとの検算に使う。
#
# CSV の形（1行目がヘッダ）:
#   対応表, タイル, 研究, <種族名を人数分>
# タイル名・研究列名・種族名は下の対応表のとおり。未知の名前があれば止まる。

import csv
import io
import json
import os
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TILE = {
    "鉱石1+QIC1": ("TS1", "即時:鉱石1+QIC1"),
    "惑星種類×知識1": ("TS2", "即時:惑星種類×知識1"),
    "パワー値4": ("TS3", "首府学院のパワー値4"),
    "7VP": ("TS4", "即時:7VP"),
    "鉱石1+パワー1": ("TS5", "収入:鉱石1+パワー1"),
    "知識1+クレ1": ("TS6", "収入:知識1+クレ1"),
    "Ga3VP": ("TS7", "ガイア鉱山+3VP"),
    "クレ4": ("TS8", "収入:クレ4"),
    "パワー4": ("TS9", "アクション:パワー4"),
}
# 並び順は RESEARCH_TRACK_IDS と同じ（惑星改造 / 航法 / 人工知能 / ガイア / 経済 / 科学）
TRACK = [
    ("惑星", "terra", "惑星改造"),
    ("航法", "nav", "航行"),
    ("人工知能", "ai", "人工知能"),
    ("ガイア", "gaia", "ガイア計画"),
    ("経済", "eco", "経済"),
    ("科学", "sci", "科学"),
]
FACTION = {
    "地球人": "terrans", "ランティダ人": "lantids", "ゼノ族": "xenos",
    "グリーン人": "gleens", "タクロン族": "taklons", "アンバス人": "ambas",
    "ハッシュ・ホラ人": "hadschHallas", "ダー・シュワーム人": "ivits",
    "ジオデン人": "geodens", "バルタック人": "balTaks", "フィラク族": "firaks",
    "マッドアンドロイド": "bescods", "ネヴラ人": "nevlas", "イタル人": "itars",
    # Lost Fleet の4種族（拡張版の CSV で使う）
    "モウェイド人": "moweyds", "スペースジャイアント": "spaceGiants",
    "ティンカーロイド": "tinkerroids", "ダルカニア人": "darkanians",
}
TILE_ORDER = ["TS1", "TS2", "TS3", "TS4", "TS5", "TS6", "TS7", "TS8", "TS9"]


def read_csv(path):
    for enc in ("utf-8-sig", "cp932", "utf-8"):
        try:
            with io.open(path, encoding=enc) as f:
                return list(csv.reader(f))
        except UnicodeDecodeError:
            continue
    sys.exit("CSV のエンコーディングを判別できません: %s" % path)


def parse(rows):
    """CSV -> {tileId: {trackId: {factionId: value}}}（0 は落とす）"""
    header = rows[0]
    cols = header[3:]
    unknown = [c for c in cols if c not in FACTION]
    if unknown:
        sys.exit("未知の種族列: %r" % unknown)
    track_by_ja = {ja: tid for ja, tid, _ in TRACK}

    data = {}
    for row in rows[1:]:
        if not row or not row[0].strip():
            continue
        tile, track = row[1].strip(), row[2].strip()
        if tile not in TILE:
            sys.exit("未知のタイル: %r" % tile)
        if track not in track_by_ja:
            sys.exit("未知の研究列: %r" % track)
        cells = {}
        for name, v in zip(cols, row[3:]):
            n = int(v.strip())
            if n != 0:
                cells[FACTION[name]] = n
        data.setdefault(TILE[tile][0], {})[track_by_ja[track]] = cells

    missing = [t for t in TILE_ORDER if t not in data]
    if missing:
        sys.exit("CSV に無いタイル: %r" % missing)
    for tid, tile in data.items():
        gap = [tid_ for _, tid_, _ in TRACK if tid_ not in tile]
        if gap:
            sys.exit("%s に無い研究列: %r" % (tid, gap))
    return data


def emit(data):
    label_of = {v[0]: v[1] for v in TILE.values()}
    out = []
    for tid in TILE_ORDER:
        out.append("  // %s %s" % (tid, label_of[tid]))
        out.append("  %s: {" % tid)
        for _, trk, trk_label in TRACK:
            cells = data[tid][trk]
            body = ", ".join("%s: %d" % (k, v) for k, v in cells.items())
            pad = " " * (5 - len(trk))
            inner = "{ %s }" % body if body else "{}"
            out.append("    %s:%s %s, // %s" % (trk, pad, inner, trk_label))
        out.append("  },")
    return "\n".join(out)


def dump_from_ts(export_name):
    """factionWeights.ts の実体を JSON で取り出す（tsx 経由）。"""
    tmp = os.path.join(REPO, "scripts", "_dump_tech_table.ts")
    with io.open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write('import { %s } from "../src/gaia/eval/factionWeights";\n' % export_name)
        f.write("console.log(JSON.stringify(%s));\n" % export_name)
    try:
        res = subprocess.run(
            ["npx", "tsx", "scripts/_dump_tech_table.ts"],
            cwd=REPO, capture_output=True, text=True, encoding="utf-8", shell=True,
        )
    finally:
        os.remove(tmp)
    if res.returncode != 0:
        sys.exit("ダンプに失敗しました:\n" + (res.stderr or ""))
    return json.loads(res.stdout.strip().splitlines()[-1])


def check(data, export_name):
    actual = dump_from_ts(export_name)
    bad, checked = [], 0
    seen = set()
    for tid, tile in data.items():
        for trk, cells in tile.items():
            for fid, want in cells.items():
                seen.add((tid, trk, fid))
                got = actual.get(tid, {}).get(trk, {}).get(fid, 0)
                checked += 1
                if want != got:
                    bad.append("%s/%s/%s: csv=%d ts=%s" % (tid, trk, fid, want, got))
    for tid, tile in actual.items():
        for trk, cells in tile.items():
            for fid in cells:
                if (tid, trk, fid) not in seen:
                    bad.append("TS 側にだけある: %s/%s/%s" % (tid, trk, fid))
    print("突き合わせ %d セル（非ゼロぶん）" % checked)
    if bad:
        print("不一致 %d 件:" % len(bad))
        for b in bad[:40]:
            print("  " + b)
        sys.exit(1)
    print("全一致")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__ or "usage: gen_tech_position_table.py <csv> [--check]")
    data = parse(read_csv(args[0]))
    if "--check" in sys.argv:
        # 種族列に LF4 が含まれていれば拡張版のテーブルと突き合わせる
        lf = any(
            f in ("moweyds", "spaceGiants", "tinkerroids", "darkanians")
            for tile in data.values() for cells in tile.values() for f in cells
        )
        check(data, "TECH_POSITION_WEIGHTS_LF" if lf else "TECH_POSITION_WEIGHTS_BASE")
    else:
        sys.stdout.write(emit(data) + "\n")


if __name__ == "__main__":
    main()
