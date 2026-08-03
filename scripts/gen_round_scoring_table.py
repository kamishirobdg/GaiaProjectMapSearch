# scripts/gen_round_scoring_table.py
#
# ラウンド得点の重みテーブル（ROUND_SCORING_WEIGHTS_BASE / _LF）を CSV から生成する。
# 通常版 9タイル×6ラウンド×14種族＝756セル、拡張版 12×6×18＝1296セルあり、
# 手で写すと必ず取り違えるため（gen_tech_position_table.py と同じ作り）。
#
#   python scripts/gen_round_scoring_table.py --template [--lf]
#       いまの共通評価値（TILE_FACTION_WEIGHTS の RS 行）を**全ラウンドへ複製**した
#       雛形 CSV を標準出力へ出す（2026-08-02 ユーザー確定・案1）。
#       これを編集して、変えたいセルだけ直す。--lf で拡張版（12タイル×18種族）。
#
#   python scripts/gen_round_scoring_table.py <csv>
#       生成した TypeScript のブロックを標準出力へ出すので、
#       src/gaia/eval/factionWeights.ts の該当テーブルの中身と差し替える
#       （このスクリプトはソースを書き換えない。CLAUDE.md「作業上の注意」参照）。
#
#   python scripts/gen_round_scoring_table.py <csv> --check
#       生成せずに「いまの factionWeights.ts の値が CSV と一致しているか」を
#       全セル突き合わせで確認する（両方向。TS 側にだけあるセルも検出する）。
#
# CSV の形（1行目がヘッダ）:
#   対応表, タイル, ラウンド, <種族名を人数分>
# タイル名・ラウンド名・種族名は下の対応表のとおり。未知の名前があれば止まる。

import csv
import io
import json
import os
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 雛形の写像（2026-08-03 に VP 換算へ移行）。相性 -2..+2 → 6..14。
# 中央値10＝「そのラウンドで狙って取れば10点ぶん」。刻み2で種族差を出す。
TEMPLATE_BASE = 10
TEMPLATE_STEP = 2

# タイル名（data.ts の label と同じ）→ (id, 表示用の短いラベル)
TILE = {
    "鉱山建設 +2VP": ("RS01", "鉱山建設 +2VP"),
    "交易所建設 +3VP": ("RS02", "交易所建設 +3VP"),
    "交易所建設 +4VP": ("RS03", "交易所建設 +4VP"),
    "学院・惑星首府建設 +5VP": ("RS04", "学院・惑星首府建設 +5VP ×2"),
    "ガイア惑星に鉱山建設 +3VP": ("RS05", "ガイア惑星に鉱山建設 +3VP"),
    "ガイア惑星に鉱山建設 +4VP": ("RS06", "ガイア惑星に鉱山建設 +4VP"),
    "研究1レベル +2VP": ("RS07", "研究1レベル +2VP"),
    "同盟タイル獲得 +5VP": ("RS08", "同盟タイル獲得 +5VP"),
    "惑星改造1段階 +2VP": ("RS09", "惑星改造1段階 +2VP"),
    # Lost Fleet で混ざる3枚（拡張版の CSV だけに出る）
    "未入植の宙域で鉱山建設 +3VP": ("RS10", "未入植の宙域で鉱山建設 +3VP"),
    "未入植の種類の惑星に鉱山建設 +3VP": ("RS11", "未入植の種類の惑星に鉱山建設 +3VP"),
    "研究所建設 +4VP": ("RS12", "研究所建設 +4VP"),
}
LABEL_BY_ID = {v[0]: v[1] for v in TILE.values()}
NAME_BY_ID = {v[0]: k for k, v in TILE.items()}

TILE_ORDER_BASE = ["RS01", "RS02", "RS03", "RS04", "RS05", "RS06", "RS07", "RS08", "RS09"]
TILE_ORDER_LF = TILE_ORDER_BASE + ["RS10", "RS11", "RS12"]

ROUNDS = ["R1", "R2", "R3", "R4", "R5", "R6"]

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


def parse(rows):
    """CSV -> ({tileId: [{factionId: value} × 6]}, 拡張版か)（0 は落とす）"""
    header = rows[0]
    cols = header[3:]
    unknown = [c for c in cols if c not in FACTION]
    if unknown:
        sys.exit("未知の種族列: %r" % unknown)
    # 拡張版かどうかは**ヘッダの列**で決める。値の非ゼロで判定すると、LF4種族の値が
    # たまたま全部 0 の表を通常版と読み違えて、別のテーブルへ突き合わせてしまう。
    lf = any(FACTION[c] in LF_FACTIONS for c in cols)

    data = {}
    for row in rows[1:]:
        if not row or not row[0].strip():
            continue
        tile, rnd = row[1].strip(), row[2].strip()
        if tile not in TILE:
            sys.exit("未知のタイル: %r" % tile)
        if rnd not in ROUNDS:
            sys.exit("未知のラウンド: %r" % rnd)
        cells = {}
        for name, v in zip(cols, row[3:]):
            n = int(v.strip())
            if n != 0:
                cells[FACTION[name]] = n
        tid = TILE[tile][0]
        data.setdefault(tid, [None] * 6)[ROUNDS.index(rnd)] = cells

    # 列と行の食い違いはここで止める（通常版の表に LF 種族の値が混ざるのを防ぐ）。
    has_lf_tiles = any(t in data for t in ("RS10", "RS11", "RS12"))
    if lf != has_lf_tiles:
        sys.exit(
            "拡張版の判定が食い違います（LF4種族の列=%s / RS10-12 の行=%s）。"
            "通常版は14種族×9タイル、拡張版は18種族×12タイルで揃えてください。"
            % (lf, has_lf_tiles)
        )
    order = TILE_ORDER_LF if lf else TILE_ORDER_BASE
    missing = [t for t in order if t not in data]
    if missing:
        sys.exit("CSV に無いタイル: %r" % missing)
    for tid, per_round in data.items():
        gap = [ROUNDS[i] for i, c in enumerate(per_round) if c is None]
        if gap:
            sys.exit("%s に無いラウンド: %r" % (tid, gap))
    return data, lf


def emit(data, lf):
    order = TILE_ORDER_LF if lf else TILE_ORDER_BASE
    out = []
    for tid in order:
        out.append("  // %s %s" % (tid, LABEL_BY_ID[tid]))
        out.append("  %s: [" % tid)
        for i, cells in enumerate(data[tid]):
            body = ", ".join("%s: %d" % (k, v) for k, v in cells.items())
            inner = "{ %s }" % body if body else "{}"
            out.append("    %s, // R%d" % (inner, i + 1))
        out.append("  ],")
    return "\n".join(out)


def dump_from_ts(export_name, module="roundScoringWeights"):
    """src/gaia/eval/<module>.ts の実体を JSON で取り出す（tsx 経由）。"""
    tmp = os.path.join(REPO, "scripts", "_dump_round_table.ts")
    with io.open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write('import { %s } from "../src/gaia/eval/%s";\n' % (export_name, module))
        f.write("console.log(JSON.stringify(%s));\n" % export_name)
    try:
        res = subprocess.run(
            ["npx", "tsx", "scripts/_dump_round_table.ts"],
            cwd=REPO, capture_output=True, text=True, encoding="utf-8", shell=True,
        )
    finally:
        os.remove(tmp)
    if res.returncode != 0:
        sys.exit("ダンプに失敗しました:\n" + (res.stderr or ""))
    return json.loads(res.stdout.strip().splitlines()[-1])


def template(lf):
    """
    いまの共通評価値（TILE_FACTION_WEIGHTS の RS 行）を全ラウンドへ複製した雛形 CSV。

    ラウンド差を持たない状態から始めて、変えたいセルだけ直す（案1）。
    曲線（旧 ROUND_SCORING_TIMING）は掛けない —— 曲線は廃止したので、出発点に
    混ぜると「どこまでが曲線由来か」が分からなくなるため。
    """
    weights = dump_from_ts("TILE_FACTION_WEIGHTS", "factionWeights")
    order = TILE_ORDER_LF if lf else TILE_ORDER_BASE
    names = [n for n, fid in FACTION_ORDER if lf or fid not in LF_FACTIONS]
    ids = [fid for _, fid in FACTION_ORDER if lf or fid not in LF_FACTIONS]

    # BOM を付ける。Windows の Excel は BOM 無しの UTF-8 を cp932 と解釈して
    # 種族名が化ける（読み込み側は utf-8-sig を最初に試すので往復できる）。
    out = io.StringIO()
    out.write(chr(0xFEFF))
    w = csv.writer(out, lineterminator="\n")
    w.writerow(["対応表", "タイル", "ラウンド"] + names)
    for tid in order:
        src = weights.get(tid, {})
        for rnd in ROUNDS:
            row = [TEMPLATE_BASE + TEMPLATE_STEP * int(src.get(fid, 0)) for fid in ids]
            w.writerow([tid, NAME_BY_ID[tid], rnd] + row)
    return out.getvalue()


FILE_HEADER = '''// src/gaia/eval/roundScoringWeights.ts
//
// ラウンド得点の重みテーブル（タイル → ラウンド(0始まり) → 種族 → 値）。
// **自動生成ファイル**:
//   python scripts/gen_round_scoring_table.py --emit-file <このパス> <base.csv> <lf.csv>
// 手で直さず、CSV を直して生成し直すこと（検算は `<csv> --check`）。
//
// 値は **VP 換算**（2026-08-03 ユーザー確定。全カテゴリを同じ物差しへ移す途中）。
// 「そのラウンドにこのタイルが出たとき、この種族が狙って取れば何点分か」。
// 中央値は10で、噛み合う種族ほど高い。
//
// 曲線（旧 ROUND_SCORING_TIMING）は 2026-08-02 に廃止した。「何ラウンド目に出たか」
// の差はこの表がラウンドごとの値として直に持つので、倍率の掛け算も丸めも要らない。
// 曲線では表せなかった種族差（R1 に同盟を作れるのはダー・シュワーム人だけ、など）を
// 入れられるのが狙い。
//
// 通常版 9タイル×6ラウンド×14種族＝756セル / 拡張版 12×6×18＝1296セル。
// RS04 は物理2枚なので2枠に出ることがあり、その場合は枠ごとに引いて両方を足す。

import type { FactionId } from "./factionWeights";

export type RoundScoringTable = Record<
  string,
  ReadonlyArray<Partial<Record<FactionId, number>>>
>;

'''

FILE_FOOTER = '''
/**
 * そのタイルが n ラウンド目（0始まり）に出たときの種族別の値。
 * 表に無いタイル（通常版の RS10-12 など）は undefined ＝寄与なし。
 */
export function roundScoringCell(
  tileId: string,
  roundIndex: number,
  lostFleet: boolean
): Partial<Record<FactionId, number>> | undefined {
  const table = lostFleet ? ROUND_SCORING_WEIGHTS_LF : ROUND_SCORING_WEIGHTS_BASE;
  return table[tileId]?.[roundIndex];
}
'''


def emit_file(path, base_csv, lf_csv):
    base, base_is_lf = parse(read_csv(base_csv))
    lf, lf_is_lf = parse(read_csv(lf_csv))
    if base_is_lf or not lf_is_lf:
        sys.exit("引数は「通常版の CSV」「拡張版の CSV」の順で渡してください")
    body = (
        FILE_HEADER
        + "/** ★通常版（基本14種族×9枚）。CSV から生成。 */\n"
        + "export const ROUND_SCORING_WEIGHTS_BASE: RoundScoringTable = {\n"
        + emit(base, False)
        + "\n};\n\n"
        + "/** ★拡張版（18種族×12枚）。CSV から生成。 */\n"
        + "export const ROUND_SCORING_WEIGHTS_LF: RoundScoringTable = {\n"
        + emit(lf, True)
        + "\n};\n"
        + FILE_FOOTER
    )
    with io.open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(body)
    sys.stderr.write("書き出しました: %s（通常版%dタイル / 拡張版%dタイル）\n"
                     % (path, len(base), len(lf)))


def check(data, export_name):
    actual = dump_from_ts(export_name)
    bad, checked = [], 0
    seen = set()
    for tid, per_round in data.items():
        for i, cells in enumerate(per_round):
            for fid, want in cells.items():
                seen.add((tid, i, fid))
                got = (actual.get(tid) or [{}] * 6)[i].get(fid, 0)
                checked += 1
                if want != got:
                    bad.append("%s/R%d/%s: csv=%d ts=%s" % (tid, i + 1, fid, want, got))
    for tid, per_round in actual.items():
        for i, cells in enumerate(per_round):
            for fid in cells:
                if (tid, i, fid) not in seen:
                    bad.append("TS 側にだけある: %s/R%d/%s" % (tid, i + 1, fid))
    print("突き合わせ %d セル（非ゼロぶん）" % checked)
    if bad:
        print("不一致 %d 件:" % len(bad))
        for b in bad[:40]:
            print("  " + b)
        sys.exit(1)
    print("全一致")


def main():
    # Windows のコンソール既定は cp932 なので、BOM(﻿) を書こうとすると
    # UnicodeEncodeError で落ちる（`> foo.csv` のリダイレクトでも同じ）。
    # エラー文の日本語も化けるので、stderr も含めて UTF-8 に固定する。
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
            sys.exit("usage: gen_round_scoring_table.py --emit-file <out.ts> <base.csv> <lf.csv>")
        emit_file(args[0], args[1], args[2])
        return
    if not args:
        sys.exit(
            "usage: gen_round_scoring_table.py [--template [--lf]] | <csv> [--check]\n"
            "       gen_round_scoring_table.py --emit-file <out.ts> <base.csv> <lf.csv>"
        )
    data, lf = parse(read_csv(args[0]))
    name = "ROUND_SCORING_WEIGHTS_LF" if lf else "ROUND_SCORING_WEIGHTS_BASE"
    if "--check" in sys.argv:
        check(data, name)
    else:
        # どちらのテーブル向けかは標準エラーへ（標準出力は貼り付ける中身だけにする）
        sys.stderr.write("→ %s の中身と差し替えてください\n" % name)
        sys.stdout.write(emit(data, lf) + "\n")


if __name__ == "__main__":
    main()
