#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
タイルの**素点（TILE_VP）を変えたとき**に、既に CSV へ入っている
列ごと・種族ごとの差を保ったまま値を掛け直す。

    python scripts/rescale_weight_csv.py data/weights/tech_position_base.csv --vp TS1=11 TS9=12
    python scripts/rescale_weight_csv.py data/weights/advanced_tech_lf.csv --add-vp 4
    ... --dry-run   # 書かずに新しい分布だけ見る

なぜ専用の道具が要るか: `gen_*_table.py --template` は
**2026-08-03 の雛形の写像（中央値12＋刻み2）から相性値を逆算する**作りなので、
2026-08-04 に素点ベースへ移したいまの CSV に対しては使えない（逆算がずれる）。
素点だけを差し替えるなら、値は `新素点 / 旧素点` の比例で動かすのが正しい ——
CSV の値は `素点 × (1 + 0.25 × 相性値)` なので、比を掛ければ相性値は保たれる。

旧素点は `scripts/gen_*_table.py` の TILE_VP から読む。**このスクリプトを走らせて
から** gen 側の TILE_VP を新しい値に書き換えること（先に書き換えると比が 1 になる）。
"""

import csv
import io
import os
import statistics
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO, "scripts"))

# CSV のファイル名（stem）→ (素点を持つモジュール, タイル id の列)
SOURCES = {
    "advanced_tech": ("gen_advanced_tech_table", 0),
    "tech_position": ("gen_tech_position_table", 0),
    "round_scoring": ("gen_round_scoring_table", 0),
    "tile_weights": ("gen_tile_weights_table", 1),
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


def source_of(path):
    stem = os.path.basename(path)
    for key, (mod, tile_col) in SOURCES.items():
        if stem.startswith(key):
            return __import__(mod).TILE_VP, tile_col
    sys.exit("素点の出どころが分かりません: %s" % stem)


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)

    path = args[0]
    if not os.path.exists(path):
        path = os.path.join(REPO, args[0])
    if not os.path.exists(path):
        sys.exit("CSV がありません: %s" % args[0])

    dry_run = "--dry-run" in args
    vp_table, tile_col = source_of(path)

    # 新しい素点を決める。--add-vp は全タイル一律、--vp は個別指定。
    # `--vp AT03=15` は旧素点を TILE_VP から読む。gen 側を先に書き換えてしまったときは
    # `--vp AT03=14:15` のように旧素点を明示できる。
    new_vp, old_vp = {}, {}
    mode = None
    for a in args[1:]:
        if a == "--dry-run":
            continue
        if a in ("--vp", "--add-vp"):
            mode = a
            continue
        if mode == "--add-vp":
            shift = int(a)
            for tid, v in vp_table.items():
                new_vp[tid] = v + shift
            mode = None
        elif mode == "--vp":
            tid, _, val = a.partition("=")
            if tid not in vp_table:
                sys.exit("素点表にないタイル: %s" % tid)
            if ":" in val:
                old_s, _, new_s = val.partition(":")
                old_vp[tid], new_vp[tid] = int(old_s), int(new_s)
            else:
                new_vp[tid] = int(val)
        else:
            sys.exit("読めない引数: %s" % a)

    if not new_vp:
        sys.exit("--vp か --add-vp で新しい素点を指定してください")

    rows = read_csv(path)
    if rows and rows[0] and rows[0][0].startswith(chr(0xFEFF)):
        rows[0][0] = rows[0][0][1:]

    changed = 0
    before, after = {}, {}
    for row in rows[1:]:
        if len(row) <= tile_col:
            continue
        tid = row[tile_col]
        if tid not in new_vp:
            continue
        old, new = old_vp.get(tid, vp_table[tid]), new_vp[tid]
        if old == new:
            continue
        for c in range(FIRST_FACTION_COL, len(row)):
            try:
                v = int(row[c])
            except ValueError:
                continue
            scaled = max(1, round(v * new / old))
            before.setdefault(tid, []).append(v)
            after.setdefault(tid, []).append(scaled)
            if scaled != v:
                changed += 1
            row[c] = str(scaled)

    for tid in sorted(before):
        b, a = before[tid], after[tid]
        sys.stderr.write(
            "%-6s 素点 %2d → %2d   平均 %.1f → %.1f   最大 %d → %d\n"
            % (tid, old_vp.get(tid, vp_table[tid]), new_vp[tid], statistics.mean(b), statistics.mean(a),
               max(b), max(a))
        )

    if changed and not dry_run:
        write_csv(path, rows)
    sys.stderr.write(
        "%s: %d セル変更%s\n"
        % (os.path.basename(path), changed, "（--dry-run のため書いていない）" if dry_run else "")
    )
    if changed and not dry_run:
        sys.stderr.write("gen 側の TILE_VP も新しい値へ直し、TS を生成し直すこと\n")


if __name__ == "__main__":
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
    main()
