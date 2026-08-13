#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
通常版（`*_base.csv`）で入力した値を拡張版（`*_lf.csv`）へ上書きコピーする。
`/weights` ページの「全コピー」ボタンと同じことを CSV に対して行う道具。

    python scripts/copy_base_to_lf.py                 # 4本ぜんぶ
    python scripts/copy_base_to_lf.py round_scoring   # 表を絞る
    python scripts/copy_base_to_lf.py --dry-run       # 件数だけ見る

コピーするのは**両方の版にある行 × 両方の版にある種族列**だけ。
拡張専用の種族（モウェイド人・スペースジャイアント・ティンカーロイド・ダルカニア人）と
拡張専用の行（`advanced_tech_lf` の 25点/3船、拡張だけのタイル）は触らない。

素点が版で違うタイル（`gen_*_table.py` の `TILE_VP_LF`。いまは標準技術の TS3 だけ）は、
`TILE_VP_LF / TILE_VP` を掛けてから書き込む。通常版で入れた列ごと・種族ごとの差は
比例なのでそのまま保たれる。
"""

import csv
import io
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEIGHTS_DIR = os.path.join(REPO, "data", "weights")
sys.path.insert(0, os.path.join(REPO, "scripts"))

# 表 -> 行を特定する列の並び。tile_weights だけ先頭に「カテゴリ」列があるぶんズレる。
KEY_COLS = {
    "advanced_tech": (0, 2),   # 対応表, 研究列
    "tech_position": (0, 2),   # 対応表, 研究列
    "round_scoring": (0, 2),   # 対応表, ラウンド
    "tile_weights": (1,),      # 対応表
}

FIRST_FACTION_COL = 3  # どの表も種族列は4列目から


def read_csv(path):
    for enc in ("utf-8-sig", "cp932", "utf-8"):
        try:
            with io.open(path, encoding=enc) as f:
                return list(csv.reader(f))
        except UnicodeDecodeError:
            continue
    sys.exit("CSV のエンコーディングを判別できません: %s" % path)


def write_csv(path, rows):
    out = io.StringIO()
    out.write(chr(0xFEFF))
    w = csv.writer(out, lineterminator="\n")
    for row in rows:
        w.writerow(row)
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(out.getvalue())


def strip_bom(rows):
    if rows and rows[0] and rows[0][0].startswith(chr(0xFEFF)):
        rows[0][0] = rows[0][0][1:]
    return rows


def vp_ratios(table):
    """素点が版で違うタイル -> 拡張版/通常版 の比。無ければ空。"""
    gen = __import__("gen_%s_table" % table)
    lf_vp = getattr(gen, "TILE_VP_LF", None) or {}
    return {tid: v / gen.TILE_VP[tid] for tid, v in lf_vp.items() if v != gen.TILE_VP[tid]}


def copy_table(table, dry_run):
    key_cols = KEY_COLS[table]
    ratios = vp_ratios(table)
    base_path = os.path.join(WEIGHTS_DIR, "%s_base.csv" % table)
    lf_path = os.path.join(WEIGHTS_DIR, "%s_lf.csv" % table)
    base_rows = strip_bom(read_csv(base_path))
    lf_rows = strip_bom(read_csv(lf_path))

    # 種族列の対応（拡張だけにある種族は None のまま＝コピーしない）
    base_col_of = {n: i for i, n in enumerate(base_rows[0])}
    pairs = [
        (base_col_of[name], i)
        for i, name in enumerate(lf_rows[0])
        if i >= FIRST_FACTION_COL and name in base_col_of
    ]

    def key(row):
        return tuple(row[c] for c in key_cols)

    base_by_key = {key(r): r for r in base_rows[1:] if len(r) > max(key_cols)}

    changed, skipped, scaled_tiles = 0, 0, set()
    for row in lf_rows[1:]:
        if len(row) <= max(key_cols):
            continue
        src = base_by_key.get(key(row))
        if src is None:
            skipped += 1  # 拡張だけの行（25点/3船、拡張タイル）
            continue
        ratio = ratios.get(row[key_cols[0]])
        if ratio:
            scaled_tiles.add(row[key_cols[0]])
        for bc, lc in pairs:
            v = src[bc]
            # 0（その列では取りに行けない）は 0 のまま。max(1,..) を通すと 1 に化ける。
            if ratio and v != "0":
                v = str(max(1, int(int(v) * ratio + 0.5)))
            if row[lc] != v:
                row[lc] = v
                changed += 1

    if changed and not dry_run:
        write_csv(lf_path, lf_rows)
    sys.stderr.write(
        "%s_lf.csv: %d セル上書き%s（拡張だけの行 %d は対象外 / 共通種族 %d列%s）\n"
        % (table, changed, "（--dry-run のため書いていない）" if dry_run else "",
           skipped, len(pairs),
           " / 素点を掛け直したタイル %s" % ",".join(sorted(scaled_tiles)) if scaled_tiles else "")
    )
    return changed


def main():
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    tables = [a for a in args if not a.startswith("--")] or list(KEY_COLS)
    for t in tables:
        if t not in KEY_COLS:
            sys.exit("未知の表: %s（%s）" % (t, " / ".join(KEY_COLS)))
    total = sum(copy_table(t, dry_run) for t in tables)
    sys.stderr.write("合計 %d セル上書き\n" % total)
    if total and not dry_run:
        sys.stderr.write("TS を生成し直すこと（data/weights/README.md）\n")


if __name__ == "__main__":
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
    main()
