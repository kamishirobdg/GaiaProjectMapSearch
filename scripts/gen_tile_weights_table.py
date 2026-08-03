# scripts/gen_tile_weights_table.py
#
# 「タイル1枚 → 種族 → 値」で足りるカテゴリの重みテーブル
# （TILE_VALUE_WEIGHTS_BASE / _LF）を CSV から生成する。対象は4カテゴリ:
#   ブースター / 最終得点 / 同盟タイル(惑星改造Lv5) / LF船（基本技術・金枠同盟・遺物）
# 研究列やラウンドで値が変わらないので、他の3本（上級技術・標準技術・ラウンド得点）と
# 違って2次元で足りる。
#
#   python scripts/gen_tile_weights_table.py --template [--lf]
#       雛形 CSV を標準出力へ出す（下の「雛形の作り方」参照）。--lf で拡張版。
#
#   python scripts/gen_tile_weights_table.py --emit-file <out.ts> <base.csv> <lf.csv>
#       TypeScript ファイルを丸ごと書き出す（src/gaia/eval/tileWeights.ts）。
#
#   python scripts/gen_tile_weights_table.py <csv> --check
#       いまの tileWeights.ts と CSV を全セル突き合わせる（両方向）。
#
# 値は **VP 換算**（2026-08-03 ユーザー確定）。「そのタイルが場に出ていて、この種族が
# 使えたら何点分の価値があるか」。カテゴリごとに中央値が違う（下の CATEGORY 参照）——
# ブースターは1ラウンドぶんの収入とパス得点、最終得点は順位点の期待値、というように
# 1枚の重みがそもそも違うため。
#
# 雛形の作り方: 既存の相性値（TILE_FACTION_WEIGHTS、-2..+2）を
#     素点 = カテゴリの中央値 + 刻み × 相性値
#   で写像する。
#
# CSV の形（1行目がヘッダ）:
#   カテゴリ, 対応表, タイル, <種族名を人数分>

import csv
import io
import json
import os
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# カテゴリ名 → (SETUP_CATALOG のキー群, 中央値, 刻み, 拡張専用か)
CATEGORY = {
    "ブースター": (["boosters", "boostersLF"], 6, 2, False),
    "最終得点": (["finalScoring", "finalScoringLF"], 9, 2, False),
    "同盟タイル": (["federations"], 8, 2, False),
    "LF船": (["standardTechLF", "federationsGold", "artifacts"], 10, 2, True),
}
# 通常版に出ないカタログ（拡張版の CSV にだけ載せる）
LF_ONLY_GROUPS = {"boostersLF", "finalScoringLF", "standardTechLF", "federationsGold", "artifacts"}

# 並び順は FACTIONS と同じ（基本14 → LF4）
FACTION_ORDER = [
    ("地球人", "terrans"), ("ランティダ人", "lantids"), ("ゼノ族", "xenos"),
    ("グリーン人", "gleens"), ("タクロン族", "taklons"), ("アンバス人", "ambas"),
    ("ハッシュ・ホラ人", "hadschHallas"), ("ダー・シュワーム人", "ivits"),
    ("ジオデン人", "geodens"), ("バルタック人", "balTaks"), ("フィラク族", "firaks"),
    ("マッドアンドロイド", "bescods"), ("ネヴラ人", "nevlas"), ("イタル人", "itars"),
    ("モウェイド人", "moweyds"), ("スペースジャイアント", "spaceGiants"),
    ("ティンカーロイド", "tinkerroids"), ("ダルカニア人", "darkanians"),
]
FACTION = dict(FACTION_ORDER)
LF_FACTIONS = ["moweyds", "spaceGiants", "tinkerroids", "darkanians"]


def read_csv(path):
    for enc in ("utf-8-sig", "cp932", "utf-8"):
        try:
            with io.open(path, encoding=enc) as f:
                return list(csv.reader(f))
        except UnicodeDecodeError:
            continue
    sys.exit("CSV のエンコーディングを判別できません: %s" % path)


def run_tsx(body, tmp_name):
    tmp = os.path.join(REPO, "scripts", tmp_name)
    with io.open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write(body)
    try:
        res = subprocess.run(
            ["npx", "tsx", "scripts/%s" % tmp_name],
            cwd=REPO, capture_output=True, text=True, encoding="utf-8", shell=True,
        )
    finally:
        os.remove(tmp)
    if res.returncode != 0:
        sys.exit("ダンプに失敗しました:\n" + (res.stderr or ""))
    return json.loads(res.stdout.strip().splitlines()[-1])


def dump_catalog():
    """SETUP_CATALOG のグループ → [{id, label}]。タイルの並びと表示名の出どころ。"""
    return run_tsx(
        'import { SETUP_CATALOG } from "../src/gaia/setup/data";\n'
        "const out: Record<string, Array<{ id: string; label: string }>> = {};\n"
        "for (const [k, v] of Object.entries(SETUP_CATALOG)) {\n"
        "  out[k] = (v as Array<{ id: string; label: string }>).map((t) => ({ id: t.id, label: t.label }));\n"
        "}\n"
        "console.log(JSON.stringify(out));\n",
        "_dump_catalog.ts",
    )


def dump_from_ts(export_name, module):
    return run_tsx(
        'import { %s } from "../src/gaia/eval/%s";\n' % (export_name, module)
        + "console.log(JSON.stringify(%s));\n" % export_name,
        "_dump_tile_table.ts",
    )


def rows_for(lf):
    """CSV に出す行の並び: [(カテゴリ, id, ラベル, 中央値, 刻み)]"""
    catalog = dump_catalog()
    out = []
    for cat, (groups, base, step, lf_only) in CATEGORY.items():
        if lf_only and not lf:
            continue
        for g in groups:
            if g in LF_ONLY_GROUPS and not lf:
                continue
            for t in catalog.get(g, []):
                out.append((cat, t["id"], t["label"], base, step))
    return out


def template(lf):
    weights = dump_from_ts("TILE_FACTION_WEIGHTS", "factionWeights")
    names = [n for n, fid in FACTION_ORDER if lf or fid not in LF_FACTIONS]
    ids = [fid for _, fid in FACTION_ORDER if lf or fid not in LF_FACTIONS]

    # BOM を付ける（Excel が cp932 と誤読しないように）。
    out = io.StringIO()
    out.write(chr(0xFEFF))
    w = csv.writer(out, lineterminator="\n")
    w.writerow(["カテゴリ", "対応表", "タイル"] + names)
    for cat, tid, label, base, step in rows_for(lf):
        src = weights.get(tid, {})
        w.writerow([cat, tid, label] + [base + step * int(src.get(fid, 0)) for fid in ids])
    return out.getvalue()


def parse(rows):
    """CSV -> ({tileId: {factionId: value}}, 拡張版か)（0 は落とす）"""
    header = rows[0]
    cols = header[3:]
    unknown = [c for c in cols if c not in FACTION]
    if unknown:
        sys.exit("未知の種族列: %r" % unknown)
    lf = any(FACTION[c] in LF_FACTIONS for c in cols)

    data, order, cats = {}, [], {}
    for row in rows[1:]:
        if not row or not row[0].strip():
            continue
        cat, tid = row[0].strip(), row[1].strip()
        if cat not in CATEGORY:
            sys.exit("未知のカテゴリ: %r" % cat)
        if tid in data:
            sys.exit("タイルが重複しています: %r" % tid)
        cells = {}
        for name, v in zip(cols, row[3:]):
            n = int(v.strip())
            if n != 0:
                cells[FACTION[name]] = n
        data[tid] = cells
        order.append(tid)
        cats[tid] = (cat, row[2].strip())

    want = [t[1] for t in rows_for(lf)]
    missing = [t for t in want if t not in data]
    extra = [t for t in order if t not in want]
    if missing or extra:
        sys.exit("タイルが CSV と合いません（不足=%r / 余り=%r）。"
                 "通常版と拡張版で行が違うので、--template で作り直してください。"
                 % (missing[:8], extra[:8]))
    return (data, order, cats), lf


def emit(parsed):
    data, order, cats = parsed
    out, cur = [], None
    for tid in order:
        cat, label = cats[tid]
        if cat != cur:
            out.append("  // ===== %s =====" % cat)
            cur = cat
        body = ", ".join("%s: %d" % (k, v) for k, v in data[tid].items())
        out.append("  %s: { %s }, // %s" % (tid, body, label))
    return "\n".join(out)


FILE_HEADER = '''// src/gaia/eval/tileWeights.ts
//
// 「タイル1枚 → 種族 → 値」で足りるカテゴリの重みテーブル。**自動生成ファイル**:
//   python scripts/gen_tile_weights_table.py --emit-file <このパス> <base.csv> <lf.csv>
// 手で直さず、CSV を直して生成し直すこと（検算は `<csv> --check`）。
//
// 対象は ブースター / 最終得点 / 同盟タイル(惑星改造Lv5) / LF船（基本技術・金枠同盟・
// 遺物）の4カテゴリ。研究列やラウンドで値が変わらないので2次元で足りる
// （上級技術・標準技術・ラウンド得点はそれぞれ専用の3次元テーブルを持つ）。
//
// 値は **VP 換算**（2026-08-03 ユーザー確定）。「そのタイルが場に出ていて、この種族が
// 使えたら何点分の価値があるか」。カテゴリごとに中央値が違う ——
//   ブースター6 / 最終得点9 / 同盟タイル8 / LF船10。
// 1枚の重みがそもそも違うため（ブースターは1ラウンドぶんの収入とパス得点、
// 最終得点は1位18/2位12/3位6 の期待値、というように）。

import type { FactionId } from "./factionWeights";

export type TileValueTable = Record<string, Partial<Record<FactionId, number>>>;

'''

FILE_FOOTER = '''
/**
 * そのタイルの種族別の値。**参照はここを通すこと。**
 * 表に無いタイル（通常版での LF 専用タイルなど）は undefined ＝寄与なし。
 */
export function tileValueCell(
  tileId: string,
  lostFleet: boolean
): Partial<Record<FactionId, number>> | undefined {
  return (lostFleet ? TILE_VALUE_WEIGHTS_LF : TILE_VALUE_WEIGHTS_BASE)[tileId];
}
'''


def emit_file(path, base_csv, lf_csv):
    base, base_is_lf = parse(read_csv(base_csv))
    lf, lf_is_lf = parse(read_csv(lf_csv))
    if base_is_lf or not lf_is_lf:
        sys.exit("引数は「通常版の CSV」「拡張版の CSV」の順で渡してください")
    body = (
        FILE_HEADER
        + "/** ★通常版（基本14種族）。CSV から生成。 */\n"
        + "export const TILE_VALUE_WEIGHTS_BASE: TileValueTable = {\n"
        + emit(base)
        + "\n};\n\n"
        + "/** ★拡張版（18種族）。CSV から生成。 */\n"
        + "export const TILE_VALUE_WEIGHTS_LF: TileValueTable = {\n"
        + emit(lf)
        + "\n};\n"
        + FILE_FOOTER
    )
    with io.open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(body)
    sys.stderr.write("書き出しました: %s（通常版%d枚 / 拡張版%d枚）\n"
                     % (path, len(base[1]), len(lf[1])))


def check(parsed, export_name):
    data = parsed[0]
    actual = dump_from_ts(export_name, "tileWeights")
    bad, checked, seen = [], 0, set()
    for tid, cells in data.items():
        for fid, want in cells.items():
            seen.add((tid, fid))
            got = actual.get(tid, {}).get(fid, 0)
            checked += 1
            if want != got:
                bad.append("%s/%s: csv=%d ts=%s" % (tid, fid, want, got))
    for tid, cells in actual.items():
        for fid in cells:
            if (tid, fid) not in seen:
                bad.append("TS 側にだけある: %s/%s" % (tid, fid))
    print("突き合わせ %d セル（非ゼロぶん）" % checked)
    if bad:
        print("不一致 %d 件:" % len(bad))
        for b in bad[:40]:
            print("  " + b)
        sys.exit(1)
    print("全一致")


def main():
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8")
        except AttributeError:  # Python 3.6 以前
            pass
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--template" in sys.argv:
        sys.stdout.write(template("--lf" in sys.argv))
        return
    if "--emit-file" in sys.argv:
        if len(args) != 3:
            sys.exit("usage: gen_tile_weights_table.py --emit-file <out.ts> <base.csv> <lf.csv>")
        emit_file(args[0], args[1], args[2])
        return
    if not args:
        sys.exit(
            "usage: gen_tile_weights_table.py [--template [--lf]] | <csv> --check\n"
            "       gen_tile_weights_table.py --emit-file <out.ts> <base.csv> <lf.csv>"
        )
    parsed, lf = parse(read_csv(args[0]))
    name = "TILE_VALUE_WEIGHTS_LF" if lf else "TILE_VALUE_WEIGHTS_BASE"
    if "--check" in sys.argv:
        check(parsed, name)
    else:
        sys.stderr.write("→ %s の中身と差し替えてください\n" % name)
        sys.stdout.write(emit(parsed) + "\n")


if __name__ == "__main__":
    main()
