#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ラウンド得点の「+4VP 版」を「+3VP 版」から導出する（値を 4/3 倍する）。

    python scripts/derive_round_scoring_4vp.py
    python scripts/derive_round_scoring_4vp.py --dry-run

対象は同じ行動で得点だけ違う2組（2026-08-14 ユーザー指示）:

    RS02 交易所建設 +3VP      → RS03 交易所建設 +4VP
    RS05 ガイア惑星に鉱山 +3VP → RS06 ガイア惑星に鉱山 +4VP

採点は +3VP 側だけ行い、+4VP 側は取りに行く条件が同じで見返りだけ 4/3 になる、
という考えかた。ラウンドごと・種族ごとの差はそのまま引き継がれる。
`_base` / `_lf` の両方を書き換えるので、`copy_base_to_lf.py` の**あとに**流すこと。
"""

import csv
import io
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEIGHTS_DIR = os.path.join(REPO, "data", "weights")

PAIRS = [("RS02", "RS03"), ("RS05", "RS06")]
RATIO = 4.0 / 3.0
FIRST_FACTION_COL = 3


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


def derive(path, dry_run):
    rows = read_csv(path)
    if rows and rows[0] and rows[0][0].startswith(chr(0xFEFF)):
        rows[0][0] = rows[0][0][1:]

    # (対応表, ラウンド) -> 行
    by_key = {(r[0], r[2]): r for r in rows[1:] if len(r) > 2}

    changed = 0
    for src_id, dst_id in PAIRS:
        for rnd in ["R%d" % n for n in range(1, 7)]:
            src, dst = by_key.get((src_id, rnd)), by_key.get((dst_id, rnd))
            if src is None or dst is None:
                sys.exit("%s に行がありません: %s / %s"
                         % (os.path.basename(path), src_id if src is None else dst_id, rnd))
            for c in range(FIRST_FACTION_COL, len(dst)):
                # 端数は四捨五入（0 は 0 のまま＝取りに行けないことを保つ）
                v = str(int(int(src[c]) * RATIO + 0.5))
                if dst[c] != v:
                    dst[c] = v
                    changed += 1

    if changed and not dry_run:
        write_csv(path, rows)
    sys.stderr.write("%s: %d セル変更%s\n"
                     % (os.path.basename(path), changed,
                        "（--dry-run のため書いていない）" if dry_run else ""))
    return changed


def main():
    dry_run = "--dry-run" in sys.argv[1:]
    total = sum(
        derive(os.path.join(WEIGHTS_DIR, "round_scoring_%s.csv" % v), dry_run)
        for v in ("base", "lf")
    )
    sys.stderr.write("合計 %d セル変更\n" % total)
    if total and not dry_run:
        sys.stderr.write("TS を生成し直すこと（data/weights/README.md）\n")


if __name__ == "__main__":
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
    main()
