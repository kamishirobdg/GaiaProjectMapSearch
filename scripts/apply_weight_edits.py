#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
重み編集ページ（/weights）が出した差分テキストを data/weights/*.csv へ反映する。

    python scripts/apply_weight_edits.py edits.txt
    python scripts/apply_weight_edits.py < edits.txt          # 標準入力でもよい
    python scripts/apply_weight_edits.py edits.txt --dry-run  # 書かずに内容だけ見る

差分テキストの形（src/gaia/eval/weightEdits.ts の formatDiffs が出すもの）:

    # gaia-weights v1
    [advanced_tech lf]
    AT04,nav,balTaks,8
    [tile_weights base]
    RB01,-,terrans,4

各行は `タイル,軸,種族,値`。軸は TS 側のキー（研究列は terra/nav/ai/gaia/eco/sci、
ラウンド得点は R1..R6、軸の無い tile_weights は "-"）。CSV の見出しは日本語なので
ここで対応を取る。未知のタイル・軸・種族があれば**何も書かずに終了する**
（部分的に当たった状態を残さないため）。

反映したあとは data/weights/README.md の手順どおり TS を生成し直すこと。
"""

import csv
import io
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEIGHTS_DIR = os.path.join(REPO, "data", "weights")

# 研究列: TS のキー → CSV の3列目に出ている日本語（gen_*_table.py の TRACK と同じ）
TRACK_JA = {
    "terra": "惑星",
    "nav": "航法",
    "ai": "人工知能",
    "gaia": "ガイア",
    "eco": "経済",
    "sci": "科学",
}

ROUND_JA = {"R%d" % n: "R%d" % n for n in range(1, 7)}

# 種族: TS の id → CSV のヘッダに出ている日本語（並びは FACTIONS と同じ）
FACTION_JA = {
    "terrans": "地球人", "lantids": "ランティダ人", "xenos": "ゼノ族",
    "gleens": "グリーン人", "taklons": "タクロン族", "ambas": "アンバス人",
    "hadschHallas": "ハッシュ・ホラ人", "ivits": "ダー・シュワーム人",
    "geodens": "ジオデン人", "balTaks": "バルタック人", "firaks": "フィラク族",
    "bescods": "マッドアンドロイド", "nevlas": "ネヴラ人", "itars": "イタル人",
    "moweyds": "モウェイド人", "spaceGiants": "スペースジャイアント",
    "tinkerroids": "ティンカーロイド", "darkanians": "ダルカニア人",
}

# 表ごとの CSV の形。tile_weights だけ先頭に「カテゴリ」列があるぶんズレる。
TABLES = {
    "advanced_tech": dict(stem="advanced_tech", tile_col=0, axis_col=2, axis="track"),
    "tech_position": dict(stem="tech_position", tile_col=0, axis_col=2, axis="track"),
    "round_scoring": dict(stem="round_scoring", tile_col=0, axis_col=2, axis="round"),
    "tile_weights": dict(stem="tile_weights", tile_col=1, axis_col=None, axis=None),
}


def read_csv(path):
    for enc in ("utf-8-sig", "cp932", "utf-8"):
        try:
            with io.open(path, encoding=enc) as f:
                return list(csv.reader(f))
        except UnicodeDecodeError:
            continue
    sys.exit("CSV のエンコーディングを判別できません: %s" % path)


def write_csv(path, rows):
    # 読み込み側と同じく BOM 付き UTF-8・改行 LF で書き戻す（Excel 対策）。
    out = io.StringIO()
    out.write(chr(0xFEFF))
    w = csv.writer(out, lineterminator="\n")
    for row in rows:
        w.writerow(row)
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(out.getvalue())


def parse_edits(text):
    """差分テキスト -> [(table, lf, tile, axis, faction, value)]"""
    edits = []
    table, lf = None, None
    for lineno, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            parts = line[1:-1].split()
            if len(parts) != 2 or parts[0] not in TABLES or parts[1] not in ("base", "lf"):
                sys.exit("%d行目: 見出しが読めません: %s" % (lineno, line))
            table, lf = parts[0], parts[1] == "lf"
            continue
        if table is None:
            sys.exit("%d行目: [表 版] の見出しより前に値の行があります" % lineno)
        cols = [c.strip() for c in line.split(",")]
        if len(cols) != 4:
            sys.exit("%d行目: 4項目（タイル,軸,種族,値）が要ります: %s" % (lineno, line))
        tile, axis, faction, value = cols
        try:
            value = int(value)
        except ValueError:
            sys.exit("%d行目: 値が整数ではありません: %s" % (lineno, value))
        edits.append((table, lf, tile, axis, faction, value))
    return edits


def apply_table(table, lf, items, dry_run):
    """1つの CSV へまとめて反映する。戻り値は (変更セル数, 変更なし数)。"""
    spec = TABLES[table]
    path = os.path.join(WEIGHTS_DIR, "%s_%s.csv" % (spec["stem"], "lf" if lf else "base"))
    if not os.path.exists(path):
        sys.exit("CSV がありません: %s" % path)
    rows = read_csv(path)
    header = rows[0]
    if header and header[0].startswith(chr(0xFEFF)):
        header[0] = header[0][1:]

    col_of = {name: i for i, name in enumerate(header)}
    tile_col, axis_col = spec["tile_col"], spec["axis_col"]

    # 行の索引: (タイル, 軸の日本語) -> 行番号。軸なしの表は軸を "" にする。
    index = {}
    for i, row in enumerate(rows[1:], 1):
        if len(row) <= tile_col:
            continue
        key = (row[tile_col], row[axis_col] if axis_col is not None else "")
        index.setdefault(key, i)

    changed, same = 0, 0
    for _, _, tile, axis, faction, value in items:
        if axis_col is None:
            axis_ja = ""
        elif spec["axis"] == "track":
            if axis not in TRACK_JA:
                sys.exit("未知の研究列: %s（%s）" % (axis, table))
            axis_ja = TRACK_JA[axis]
        else:
            if axis not in ROUND_JA:
                sys.exit("未知のラウンド: %s（%s）" % (axis, table))
            axis_ja = ROUND_JA[axis]

        if faction not in FACTION_JA:
            sys.exit("未知の種族: %s" % faction)
        fname = FACTION_JA[faction]
        if fname not in col_of:
            sys.exit("%s に種族列がありません: %s（拡張版と通常版を取り違えていませんか）"
                     % (os.path.basename(path), fname))

        r = index.get((tile, axis_ja))
        if r is None:
            sys.exit("%s に行がありません: %s / %s" % (os.path.basename(path), tile, axis_ja or "-"))
        c = col_of[fname]
        if rows[r][c] == str(value):
            same += 1
            continue
        rows[r][c] = str(value)
        changed += 1

    if changed and not dry_run:
        write_csv(path, rows)
    return path, changed, same


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry_run = "--dry-run" in sys.argv[1:]

    if args:
        with io.open(args[0], encoding="utf-8-sig") as f:
            text = f.read()
    else:
        if sys.stdin.isatty():
            sys.exit(__doc__)
        text = sys.stdin.read()

    edits = parse_edits(text)
    if not edits:
        sys.exit("差分がありません")

    # 表・版ごとにまとめる（CSV は1本ずつ読み書きする）。
    groups = {}
    for e in edits:
        groups.setdefault((e[0], e[1]), []).append(e)

    total_changed, total_same = 0, 0
    for (table, lf), items in groups.items():
        path, changed, same = apply_table(table, lf, items, dry_run)
        total_changed += changed
        total_same += same
        sys.stderr.write("%s: %d セル変更%s（既に同値 %d）\n"
                         % (os.path.basename(path), changed,
                            "（--dry-run のため書いていない）" if dry_run else "", same))

    sys.stderr.write("合計 %d セル変更 / %d セルは元から同値\n" % (total_changed, total_same))
    if total_changed and not dry_run:
        sys.stderr.write("TS を生成し直すこと（data/weights/README.md）\n")


if __name__ == "__main__":
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
    main()
