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
LF_FACTIONS = ["moweyds", "spaceGiants", "tinkerroids", "darkanians"]
NAME_BY_ID = {v[0]: k for k, v in TILE.items()}
LABEL_BY_ID = {v[0]: v[1] for v in TILE.values()}

# 雛形の写像（2026-08-03 に VP 換算へ移行）。既存の相性値 → 12 + 2×v。
# 中央値12＝「この列の下に置かれたこのタイルを取れれば12点ぶん」。上級技術（24）の
# 半分にしてある —— 9枚すべてが場に出て取りやすい代わり、1枚の効果は上級より小さい。
TEMPLATE_BASE = 12
TEMPLATE_STEP = 2


def read_csv(path):
    for enc in ("utf-8-sig", "cp932", "utf-8"):
        try:
            with io.open(path, encoding=enc) as f:
                return list(csv.reader(f))
        except UnicodeDecodeError:
            continue
    sys.exit("CSV のエンコーディングを判別できません: %s" % path)


def parse(rows):
    """CSV -> ({tileId: {trackId: {factionId: value}}}, 拡張版か)（0 は落とす）"""
    header = rows[0]
    cols = header[3:]
    unknown = [c for c in cols if c not in FACTION]
    if unknown:
        sys.exit("未知の種族列: %r" % unknown)
    # 拡張版かどうかは**ヘッダの列**で決める。値の非ゼロで判定すると、LF4種族の値が
    # たまたま全部 0 の表を通常版と読み違えて、別のテーブルへ突き合わせてしまう
    # （タイル数は BASE/LF とも9枚なので、行では見分けが付かない）。
    lf = any(FACTION[c] in LF_FACTIONS for c in cols)
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
    return data, lf


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


def weights_module():
    """
    テーブルの置き場。2026-08-03 に factionWeights.ts から techPositionWeights.ts へ
    分離したので、**分離前（＝移行の初回に雛形を作るとき）だけ**旧置き場から読む。
    """
    p = os.path.join(REPO, "src", "gaia", "eval", "techPositionWeights.ts")
    return "techPositionWeights" if os.path.exists(p) else "factionWeights"


def dump_from_ts(export_name, module=None):
    """src/gaia/eval/<module>.ts の実体を JSON で取り出す（tsx 経由）。"""
    module = module or weights_module()
    tmp = os.path.join(REPO, "scripts", "_dump_tech_table.ts")
    with io.open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write('import { %s } from "../src/gaia/eval/%s";\n' % (export_name, module))
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


def template(lf):
    """いまの TECH_POSITION_WEIGHTS を VP レンジへ写像した雛形 CSV。"""
    src = dump_from_ts("TECH_POSITION_WEIGHTS_LF" if lf else "TECH_POSITION_WEIGHTS_BASE")
    names = [n for n in FACTION if lf or FACTION[n] not in LF_FACTIONS]
    ids = [FACTION[n] for n in names]

    # BOM を付ける（Excel が cp932 と誤読しないように）。
    out = io.StringIO()
    out.write(chr(0xFEFF))
    w = csv.writer(out, lineterminator="\n")
    w.writerow(["対応表", "タイル", "研究"] + names)
    for tid in TILE_ORDER:
        for ja, trk, _ in TRACK:
            cells = src.get(tid, {}).get(trk, {})
            row = [TEMPLATE_BASE + TEMPLATE_STEP * int(cells.get(fid, 0)) for fid in ids]
            w.writerow([tid, NAME_BY_ID[tid], ja] + row)
    return out.getvalue()


FILE_HEADER = '''// src/gaia/eval/techPositionWeights.ts
//
// 標準技術の重みテーブル（タイル → 研究列 → 種族 → 値）。**自動生成ファイル**:
//   python scripts/gen_tech_position_table.py --emit-file <このパス> <base.csv> <lf.csv>
// 手で直さず、CSV を直して生成し直すこと（検算は `<csv> --check`）。
//
// 値は **VP 換算**（2026-08-03 ユーザー確定。全カテゴリを同じ物差しへ移す途中）。
// 「その列の下に置かれたこのタイルを取れたら何点分か」。中央値は12で、上級技術（24）の
// 半分 —— 9枚すべてが場に出て取りやすい代わり、1枚の効果は上級より小さい。
//
// **研究列6つだけを書く。フリー枠は書かない**。ルールブック p13「技術タイルの獲得」:
// 研究エリアの真下の6枚はその研究エリアでのみマーカーを進められ、進められない場合は
// 進展分が失われる。フリー枠の3枚は任意の研究エリア1つを進められる。つまりフリー枠は
// 常にトラック配置の完全な上位互換で、利益は「登りたい列を選べる」ことに尽きる。だから
//   free = そのタイルの研究列6つのうち最大値
// が正しく、techPositionCell() がそれを計算する（データには持たない）。
//
// 通常版 9タイル×6列×14種族＝756セル / 拡張版 9×6×18＝972セル。
// 拡張の有無で場に出るタイルの母集団が変わるので表を分ける。

import type { ResearchTrackId } from "@/gaia/setup/types";
import type { FactionId } from "./factionWeights";

/** 標準技術の置き場所: 研究列6つ、または列に紐付かないフリー枠。 */
export type TechPosition = ResearchTrackId | "free";

export type TechPositionTable = Record<
  string,
  Partial<Record<ResearchTrackId, Partial<Record<FactionId, number>>>>
>;

'''

FILE_FOOTER = '''
const TECH_TRACK_POSITIONS: readonly ResearchTrackId[] = [
  "terra",
  "nav",
  "ai",
  "gaia",
  "eco",
  "sci",
];

/** その拡張で使う標準技術のテーブル。 */
export function techPositionTable(lostFleet: boolean): TechPositionTable {
  return lostFleet ? TECH_POSITION_WEIGHTS_LF : TECH_POSITION_WEIGHTS_BASE;
}

/** `${base|lf}:${tileId}` → 計算した free 枠のセル（初回だけ作る）。 */
const freeCellCache = new Map<string, Partial<Record<FactionId, number>>>();

function computeFreeCell(tileId: string, lostFleet: boolean): Partial<Record<FactionId, number>> {
  const tile = techPositionTable(lostFleet)[tileId];
  const out: Partial<Record<FactionId, number>> = {};
  if (!tile) return out;
  const seen = new Set<FactionId>();
  for (const pos of TECH_TRACK_POSITIONS) {
    for (const f of Object.keys(tile[pos] ?? {}) as FactionId[]) seen.add(f);
  }
  for (const f of seen) {
    // 6列すべての最大値を取る（記載のない列は0）。
    let best = 0;
    for (const pos of TECH_TRACK_POSITIONS) {
      const v = tile[pos]?.[f] ?? 0;
      if (v > best) best = v;
    }
    if (best !== 0) out[f] = best;
  }
  return out;
}

/**
 * 標準技術1枚ぶんの重み（配置ごと）。**参照はここを通すこと。**
 * フリー枠はデータに持たず、研究列6つの最大値として計算する（上の設計メモ参照）。
 * 副作用として、**編集するのは研究列だけでよい**（フリー枠は自動で追随する）。
 */
export function techPositionCell(
  tileId: string,
  pos: TechPosition,
  lostFleet: boolean
): Partial<Record<FactionId, number>> | undefined {
  const table = techPositionTable(lostFleet);
  if (pos !== "free") return table[tileId]?.[pos];
  if (!table[tileId]) return undefined;
  const key = `${lostFleet ? "lf" : "base"}:${tileId}`;
  let cell = freeCellCache.get(key);
  if (!cell) {
    cell = computeFreeCell(tileId, lostFleet);
    freeCellCache.set(key, cell);
  }
  return cell;
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
        + "export const TECH_POSITION_WEIGHTS_BASE: TechPositionTable = {\n"
        + emit(base)
        + "\n};\n\n"
        + "/** ★拡張版（18種族×9枚）。CSV から生成。 */\n"
        + "export const TECH_POSITION_WEIGHTS_LF: TechPositionTable = {\n"
        + emit(lf)
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
    # Windows のコンソール既定は cp932 で、日本語のエラー文やタイル名が化ける
    # （gen_round_scoring_table.py と同じ理由）。出力は UTF-8 に固定する。
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
            sys.exit("usage: gen_tech_position_table.py --emit-file <out.ts> <base.csv> <lf.csv>")
        emit_file(args[0], args[1], args[2])
        return
    if not args:
        sys.exit(
            "usage: gen_tech_position_table.py [--template [--lf]] | <csv> [--check]\n"
            "       gen_tech_position_table.py --emit-file <out.ts> <base.csv> <lf.csv>"
        )
    data, lf = parse(read_csv(args[0]))
    name = "TECH_POSITION_WEIGHTS_LF" if lf else "TECH_POSITION_WEIGHTS_BASE"
    if "--check" in sys.argv:
        check(data, name)
    else:
        # どちらのテーブル向けかは標準エラーへ（標準出力は貼り付ける中身だけにする）
        sys.stderr.write("→ %s の中身と差し替えてください\n" % name)
        sys.stdout.write(emit(data) + "\n")


if __name__ == "__main__":
    main()
