#!/usr/bin/env python3
"""整合性レビューの資料 → src/gaia/eval/weightReview.ts（自動生成）

docs/weights-review-<日付>.md の提案表（P01〜）と要判断表（L01〜）、同名の
.edits.txt（/weights の差分形式。提案ごとに `# --- Pxx` で区切ってある）を読んで、
/weights ページが提案を出せる形の TypeScript を書き出す。値そのものは変えない。

  python scripts/gen_weight_review.py                 # 既定の2ファイルから生成して書き出す
  python scripts/gen_weight_review.py --print         # 書き出さずに標準出力へ
  python scripts/gen_weight_review.py <md> <edits> [--emit-file <out.ts>]

タイル id は data/weights/*.csv にある id だけを拾う（本文の C3 / P06 などは無視）。
未知の表・種族・タイルがあれば何も書かずに止まる。
"""
import csv
import glob
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_MD = os.path.join(ROOT, "docs", "weights-review-2026-09-19.md")
DEFAULT_EDITS = os.path.join(ROOT, "docs", "weights-review-2026-09-19.edits.txt")
DEFAULT_OUT = os.path.join(ROOT, "src", "gaia", "eval", "weightReview.ts")

FACTIONS = [
    "terrans", "lantids", "xenos", "gleens", "taklons", "ambas", "hadschHallas",
    "ivits", "geodens", "balTaks", "firaks", "bescods", "nevlas", "itars",
    "moweyds", "spaceGiants", "tinkerroids", "darkanians",
]
TABLES = ("advanced_tech", "tech_position", "round_scoring", "tile_weights")
TILE_RE = re.compile(r"\b(?:FEDG|FED|TSL|TS|ART|AT|RS|RB|FS)[0-9]+[A-Z]*\b")


def known_tile_ids():
    ids = set()
    for path in glob.glob(os.path.join(ROOT, "data", "weights", "*_base.csv")) + glob.glob(
        os.path.join(ROOT, "data", "weights", "*_lf.csv")
    ):
        is_tile = os.path.basename(path).startswith("tile_weights_")
        with io.open(path, encoding="utf-8-sig", newline="") as f:
            for row in csv.reader(f):
                if not row or not row[0].strip():
                    continue
                tid = (row[1] if is_tile else row[0]).strip()
                if re.match(r"^[A-Z]+[0-9]", tid):
                    ids.add(tid)
    return ids


def tiles_in(text, known):
    out = []
    for m in TILE_RE.findall(text):
        if m in known and m not in out:
            out.append(m)
    return out


def split_row(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]


def parse_md(text, known):
    items = []
    for line in text.splitlines():
        if line.startswith("| P"):
            cols = split_row(line)
            if len(cols) != 7:
                sys.exit("提案の行の列数が7ではありません: %s" % line[:40])
            no, conf, target, reason, change, refs, _cells = cols
            items.append(dict(id=no, kind="proposal", confidence=conf, target=target,
                              reason=reason, change=change, refs=refs))
        elif line.startswith("| L"):
            cols = split_row(line)
            if len(cols) != 5:
                sys.exit("要判断の行の列数が5ではありません: %s" % line[:40])
            no, target, reason, change, refs = cols
            items.append(dict(id=no, kind="judgment", confidence="低", target=target,
                              reason=reason, change=change, refs=refs))
    if not items:
        sys.exit("提案の行が見つかりません")
    for it in items:
        if it["confidence"] not in ("高", "中", "低"):
            sys.exit("%s: 確信度が不正です: %s" % (it["id"], it["confidence"]))
    return items


def parse_edits(text, known):
    """id -> [cell]. cell = dict(table, lf, tile, axis, faction, value)"""
    cells = {}
    table = lf = cur = None
    for lineno, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line:
            continue
        m = re.match(r"^# --- (P\d+)\s*$", line)
        if m:
            cur = m.group(1)
            cells.setdefault(cur, [])
            continue
        if line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            parts = line[1:-1].split()
            if len(parts) != 2 or parts[0] not in TABLES or parts[1] not in ("base", "lf"):
                sys.exit("%d行目: 見出しが不正です: %s" % (lineno, line))
            table, lf = parts[0], parts[1] == "lf"
            continue
        if table is None or cur is None:
            sys.exit("%d行目: 表の見出しか提案の区切りより前に値の行があります" % lineno)
        cols = [c.strip() for c in line.split(",")]
        if len(cols) != 4:
            sys.exit("%d行目: 4項目（タイル,軸,種族,値）が要ります: %s" % (lineno, line))
        tile, axis, faction, value = cols
        if tile not in known:
            sys.exit("%d行目: 未知のタイル: %s" % (lineno, tile))
        if faction not in FACTIONS:
            sys.exit("%d行目: 未知の種族: %s" % (lineno, faction))
        try:
            value = int(value)
        except ValueError:
            sys.exit("%d行目: 値が整数ではありません: %s" % (lineno, value))
        cells[cur].append(dict(table=table, lf=lf, tile=tile, axis="" if axis == "-" else axis,
                               faction=faction, value=value))
    return cells


def ts_str(s):
    return json.dumps(s, ensure_ascii=False)


def emit(items, date, md_rel, edits_rel):
    out = []
    out.append("// src/gaia/eval/weightReview.ts")
    out.append("//")
    out.append("// 自動生成物。scripts/gen_weight_review.py が %s と" % md_rel)
    out.append("// %s から作る。**手で編集しない**（資料を直して生成し直す）。" % edits_rel)
    out.append("//")
    out.append("// /weights ページの「整合性レビュー」の提案。値そのものはここでは変えない。")
    out.append("// 採用の計算は weightReviewEdits.ts。")
    out.append("")
    out.append('import type { FactionId } from "./factionWeights";')
    out.append('import type { WeightTableId } from "./weightTables";')
    out.append("")
    out.append('export type ReviewKind = "proposal" | "judgment";')
    out.append('export type ReviewConfidence = "高" | "中" | "低";')
    out.append("")
    out.append("/** 採用で書き込むセル。軸なしの行（基準値）は axis が空。 */")
    out.append("export type ReviewCell = {")
    out.append("  table: WeightTableId;")
    out.append("  lf: boolean;")
    out.append("  tile: string;")
    out.append("  axis: string;")
    out.append("  faction: FactionId;")
    out.append("  value: number;")
    out.append("};")
    out.append("")
    out.append("export type ReviewItem = {")
    out.append('  /** "P01"（提案）/ "L01"（要判断） */')
    out.append("  id: string;")
    out.append("  kind: ReviewKind;")
    out.append("  confidence: ReviewConfidence;")
    out.append("  /** 対象 */")
    out.append("  target: string;")
    out.append("  /** 理由 */")
    out.append("  reason: string;")
    out.append("  /** 修正前 → 修正後（要判断は修正案） */")
    out.append("  change: string;")
    out.append("  /** 参照した似たタイル・根拠 */")
    out.append("  refs: string;")
    out.append("  /** 対象のタイル id（このタイルを開いたときにカードを出す）。提案は cells のタイルも含む。 */")
    out.append("  targetTiles: string[];")
    out.append("  /** 根拠に出てくるタイル id（飛び先）。targetTiles と重複しない。 */")
    out.append("  refTiles: string[];")
    out.append("  /** 採用で書き込むセル（要判断は空） */")
    out.append("  cells: ReviewCell[];")
    out.append("};")
    out.append("")
    out.append("export const WEIGHT_REVIEW_DATE = %s;" % ts_str(date))
    out.append("export const WEIGHT_REVIEW_SOURCE = %s;" % ts_str(md_rel))
    out.append("")
    out.append("export const WEIGHT_REVIEW: readonly ReviewItem[] = [")
    for it in items:
        out.append("  {")
        out.append("    id: %s," % ts_str(it["id"]))
        out.append("    kind: %s," % ts_str(it["kind"]))
        out.append("    confidence: %s," % ts_str(it["confidence"]))
        out.append("    target: %s," % ts_str(it["target"]))
        out.append("    reason: %s," % ts_str(it["reason"]))
        out.append("    change: %s," % ts_str(it["change"]))
        out.append("    refs: %s," % ts_str(it["refs"]))
        out.append("    targetTiles: [%s]," % ", ".join(ts_str(t) for t in it["targetTiles"]))
        out.append("    refTiles: [%s]," % ", ".join(ts_str(t) for t in it["refTiles"]))
        if it["cells"]:
            out.append("    cells: [")
            for c in it["cells"]:
                out.append(
                    "      { table: %s, lf: %s, tile: %s, axis: %s, faction: %s, value: %d },"
                    % (ts_str(c["table"]), "true" if c["lf"] else "false", ts_str(c["tile"]),
                       ts_str(c["axis"]), ts_str(c["faction"]), c["value"])
                )
            out.append("    ],")
        else:
            out.append("    cells: [],")
        out.append("  },")
    out.append("];")
    out.append("")
    return "\n".join(out)


def main():
    argv = sys.argv[1:]
    print_only = "--print" in argv
    out_path = DEFAULT_OUT
    if "--emit-file" in argv:
        i = argv.index("--emit-file")
        out_path = argv[i + 1]
        del argv[i:i + 2]
    args = [a for a in argv if not a.startswith("--")]
    md_path = args[0] if len(args) > 0 else DEFAULT_MD
    edits_path = args[1] if len(args) > 1 else DEFAULT_EDITS

    known = known_tile_ids()
    with io.open(md_path, encoding="utf-8") as f:
        md = f.read()
    with io.open(edits_path, encoding="utf-8") as f:
        edits = f.read()
    items = parse_md(md, known)
    cells = parse_edits(edits, known)

    unknown = sorted(set(cells) - {it["id"] for it in items})
    if unknown:
        sys.exit("edits にあって資料に無い提案: %s" % unknown)
    for it in items:
        it["cells"] = cells.get(it["id"], [])
        if it["kind"] == "proposal" and not it["cells"]:
            sys.exit("%s: edits にセルがありません" % it["id"])
        targets = tiles_in(it["target"], known)
        for c in it["cells"]:
            if c["tile"] not in targets:
                targets.append(c["tile"])
        refs = [t for t in tiles_in(it["refs"] + " " + it["change"], known) if t not in targets]
        it["targetTiles"] = targets
        it["refTiles"] = refs

    m = re.search(r"(\d{4}-\d{2}-\d{2})", os.path.basename(md_path))
    date = m.group(1) if m else ""
    rel = lambda p: os.path.relpath(p, ROOT).replace(os.sep, "/")
    text = emit(items, date, rel(md_path), rel(edits_path))
    n_cells = sum(len(it["cells"]) for it in items)
    if print_only:
        sys.stdout.write(text)
        return
    with io.open(out_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    print("書き出しました: %s（提案%d件 / 要判断%d件 / セル%d）" % (
        rel(out_path),
        sum(1 for it in items if it["kind"] == "proposal"),
        sum(1 for it in items if it["kind"] == "judgment"),
        n_cells,
    ))


if __name__ == "__main__":
    main()
