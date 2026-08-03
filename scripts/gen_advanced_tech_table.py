# scripts/gen_advanced_tech_table.py
#
# 上級技術の重みテーブル（ADVANCED_TECH_WEIGHTS_BASE / _LF）を CSV から生成する。
# 通常版 15タイル×6列×14種族＝1260セル、拡張版 21×6×18＝2268セル。
# 手で写すと必ず取り違えるため（gen_tech_position_table.py と同じ作り）。
#
#   python scripts/gen_advanced_tech_table.py --template [--lf]
#       雛形 CSV を標準出力へ出す（下の「雛形の作り方」参照）。--lf で拡張版。
#
#   python scripts/gen_advanced_tech_table.py <csv>
#       生成した TypeScript のブロックを標準出力へ出すので、
#       src/gaia/eval/factionWeights.ts の該当テーブルの中身と差し替える
#       （このスクリプトはソースを書き換えない。CLAUDE.md「作業上の注意」参照）。
#
#   python scripts/gen_advanced_tech_table.py <csv> --check
#       生成せずに「いまの factionWeights.ts の値が CSV と一致しているか」を
#       全セル突き合わせで確認する（両方向。TS 側にだけあるセルも検出する）。
#
# 値の意味（2026-08-03 ユーザー確定）: **VP 換算**。
#   「その上級技術を適切なタイミングで取れたら何点分の価値があるか」。
#   純粋な点数として 20〜30 程度が上限、0 はほぼ無く、5 以下も殆ど無い。
#   相性の良い研究列に置かれていれば、その列のセルを上げる（列ごとに直接書く）。
#
# 雛形の作り方: 既存の相性値（TILE_FACTION_WEIGHTS の AT 行、-2..+2）を
#     素点 = TEMPLATE_BASE + TEMPLATE_STEP × 相性値   （-2→18 / 0→24 / +2→30）
#   で VP レンジへ写像し、6列すべてへ複製する。**列ごとの差はゼロの状態**から
#   始めて、「この列にあるとこの種族は取りやすい/取りにくい」を入れていく。
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

# 雛形の作り方（2026-08-04 にタイルごとの素点へ変えた）。
#
# 全タイル共通の中央値を使うと、相性値が0のセル（＝大半）が同じ値に張り付き、
# 「適切なタイミングで取れたら何点か」がまったく入らない状態になっていた
# （実測で 72% のセルが 18 点）。そこで**タイルごとに素点を持つ**ようにし、
# 種族差はそこへ相性値ぶんを足す形にした:
#     値 = TILE_VP[タイル] + TEMPLATE_STEP × 相性値(-2..+2)
#
# 種族差は素点に**比例**させる（一律の加算にすると、素点5のタイルで ±6 動いて
# 0 を割ってしまう一方、素点18のタイルでは差が足りない）。相性1につき素点の
# TEMPLATE_RATIO ぶんを上乗せする。
#
# 素点は「**R4 前後で取得した場合**にそのタイルが生む VP」の見込み。上級技術は
# 取得に同盟タイル1枚を払うので、実際に取れるのは中盤以降になる。
# 盤面の見込みは4人戦の標準的な進行（鉱山7・交易所3・研究所2・宙域4・
# ガイア惑星3・同盟2〜3・残り3ラウンド）を基準にした。資源はおよそ 1個 ≒ 1VP、
# 知識だけは研究に直結するぶん少し高く見ている。
TEMPLATE_RATIO = 0.25
# 2026-08-04: 別モデル（Fable）に**同じ前提でゼロから独立に見積もらせ**、
# 突き合わせて確定した値。取得時・パス時系はほぼ一致したが、**誘発（〜するたび）系は
# こちらが一貫して楽観的**だった —— R4 前後に取ると残りは3ラウンドしかないので、
# 「取得後に何回起きるか」は思ったより少ない（AT02 は 16 → 8）。
TILE_VP = {
    # --- 取得時（即時）: 取得した瞬間の盤面で決まる ---
    "AT04": 14,  # 鉱山×2VP … 鉱山7個
    "AT06": 4,   # 宙域×鉱石1 … 宙域4 → 鉱石4（資源なのでVPは低め）
    "AT08": 6,   # ガイア惑星×2VP … ガイア3個
    "AT09": 12,  # 交易所×4VP … 交易所3個
    "AT10": 8,   # 宙域×2VP … 宙域4
    "AT12": 11,  # 同盟タイル×5VP … 同盟2〜3枚
    "AT16": 11,  # 首府・学院×6VP … 首府1＋学院0〜1（LF）
    "AT17": 8,   # 深宇宙宙域×4VP … 深宇宙2（LF）
    # --- アクション: 取得後およそ3ラウンド、毎ラウンド1回。
    #     アクションを1つ消費するぶんは割り引く ---
    "AT03": 10,  # QIC1＋クレ5 … 3回で QIC3＋クレ15
    "AT07": 8,   # 鉱石3 … 3回で鉱石9
    "AT13": 12,  # 知識3 … 3回で知識9（研究に直結するぶん高め）
    # --- パス時: 取得後およそ3回パスする。建造物は回を追って増える ---
    "AT01": 17,  # 同盟タイル×3VP … 同盟が 1.5→2→2.5 枚と増える×3VP
    "AT05": 16,  # 研究所×3VP … 研究所1.5〜2個×3回
    "AT15": 14,  # 惑星種類×1VP … 種類4→4.5→5×3回
    "AT18": 9,   # 小惑星×2VP … 小惑星1.5個×3回（LF。数が限られる）
    "AT21": 11,  # 深宇宙宙域×2VP … 深宇宙 1.5→2→2.5×3回（LF）
    # --- 誘発（〜するたび）: 取得後の残り3ラウンドで何回起きるか ---
    "AT02": 8,   # 研究を進めるたび+2VP … 取得後4回前後
    "AT11": 5,   # 交易所を建設するたび+3VP … 取得後1.5個（終盤は建て替えが主）
    "AT14": 7,   # 鉱山を建設するたび+3VP … 取得後2個
    "AT19": 7,   # 惑星改造1段階ごと+2VP … 取得後3段階（LF）
    "AT20": 7,   # QICアクションのたび+4VP … 取得後1.5回（LF。取り合いになる）
}

# タイル名（data.ts の label と同じ）→ id。並びは SETUP_CATALOG と同じ挙動順。
TILE = {
    # --- 基本版15枚 ---
    "取得時：鉱山×2VP": "AT04",
    "取得時：宙域×鉱石1": "AT06",
    "取得時：ガイア惑星×2VP": "AT08",
    "取得時：交易所×4VP": "AT09",
    "取得時：宙域×2VP": "AT10",
    "取得時：同盟タイル×5VP": "AT12",
    "アクション：QIC1＋クレジット5": "AT03",
    "アクション：鉱石3": "AT07",
    "アクション：知識3": "AT13",
    "パス時：同盟タイル×3VP": "AT01",
    "パス時：研究所×3VP": "AT05",
    "パス時：惑星種類×1VP": "AT15",
    "研究を進めるたび＋2VP": "AT02",
    "交易所を建設するたび＋3VP": "AT11",
    "鉱山を建設するたび＋3VP": "AT14",
    # --- Lost Fleet で混ざる6枚（拡張版の CSV だけに出る）---
    "取得時：首府・学院×6VP": "AT16",
    "取得時：深宇宙宙域×4VP": "AT17",
    "パス時：小惑星×2VP": "AT18",
    "パス時：深宇宙宙域×2VP": "AT21",
    "惑星改造1段階ごと＋2VP": "AT19",
    "QICアクションのたび＋4VP": "AT20",
}
NAME_BY_ID = {v: k for k, v in TILE.items()}

TILE_ORDER_BASE = [
    "AT04", "AT06", "AT08", "AT09", "AT10", "AT12",
    "AT03", "AT07", "AT13",
    "AT01", "AT05", "AT15",
    "AT02", "AT11", "AT14",
]
TILE_ORDER_LF = TILE_ORDER_BASE + ["AT16", "AT17", "AT18", "AT21", "AT19", "AT20"]

# 並び順は RESEARCH_TRACK_IDS と同じ（惑星改造 / 航法 / 人工知能 / ガイア / 経済 / 科学）
TRACK = [
    ("惑星", "terra", "惑星改造"),
    ("航法", "nav", "航行"),
    ("人工知能", "ai", "人工知能"),
    ("ガイア", "gaia", "ガイア計画"),
    ("経済", "eco", "経済"),
    ("科学", "sci", "科学"),
]

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
LF_TILES = ["AT16", "AT17", "AT18", "AT21", "AT19", "AT20"]


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
    # 拡張版かどうかは**ヘッダの列**で決める（gen_round_scoring_table.py と同じ理由）。
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
        data.setdefault(TILE[tile], {})[track_by_ja[track]] = cells

    # 列と行の食い違いはここで止める（通常版の表に LF のタイルや種族が混ざるのを防ぐ）。
    has_lf_tiles = any(t in data for t in LF_TILES)
    if lf != has_lf_tiles:
        sys.exit(
            "拡張版の判定が食い違います（LF4種族の列=%s / LF6枚の行=%s）。"
            "通常版は14種族×15タイル、拡張版は18種族×21タイルで揃えてください。"
            % (lf, has_lf_tiles)
        )
    order = TILE_ORDER_LF if lf else TILE_ORDER_BASE
    missing = [t for t in order if t not in data]
    if missing:
        sys.exit("CSV に無いタイル: %r" % missing)
    for tid, tile in data.items():
        gap = [tid_ for _, tid_, _ in TRACK if tid_ not in tile]
        if gap:
            sys.exit("%s に無い研究列: %r" % (tid, gap))
    return data, lf


def emit(data, lf):
    order = TILE_ORDER_LF if lf else TILE_ORDER_BASE
    out = []
    for tid in order:
        out.append("  // %s %s" % (tid, NAME_BY_ID[tid]))
        out.append("  %s: {" % tid)
        for _, trk, trk_label in TRACK:
            cells = data[tid][trk]
            body = ", ".join("%s: %d" % (k, v) for k, v in cells.items())
            pad = " " * (5 - len(trk))
            inner = "{ %s }" % body if body else "{}"
            out.append("    %s:%s %s, // %s" % (trk, pad, inner, trk_label))
        out.append("  },")
    return "\n".join(out)


def dump_from_ts(export_name, module="advancedTechWeights"):
    """src/gaia/eval/<module>.ts の実体を JSON で取り出す（tsx 経由）。"""
    tmp = os.path.join(REPO, "scripts", "_dump_adv_table.ts")
    with io.open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write('import { %s } from "../src/gaia/eval/%s";\n' % (export_name, module))
        f.write("console.log(JSON.stringify(%s));\n" % export_name)
    try:
        res = subprocess.run(
            ["npx", "tsx", "scripts/_dump_adv_table.ts"],
            cwd=REPO, capture_output=True, text=True, encoding="utf-8", shell=True,
        )
    finally:
        os.remove(tmp)
    if res.returncode != 0:
        sys.exit("ダンプに失敗しました:\n" + (res.stderr or ""))
    return json.loads(res.stdout.strip().splitlines()[-1])


def template(lf):
    """
    既存の相性値（TILE_FACTION_WEIGHTS の AT 行）を VP レンジへ写像し、
    6列すべてへ複製した雛形 CSV。列ごとの差はゼロから始める。
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
    w.writerow(["対応表", "タイル", "研究"] + names)
    for tid in order:
        src = weights.get(tid, {})
        base = TILE_VP[tid]
        for ja, _, _ in TRACK:
            row = [
                max(1, round(base * (1 + TEMPLATE_RATIO * int(src.get(fid, 0))))) for fid in ids
            ]
            w.writerow([tid, NAME_BY_ID[tid], ja] + row)
    return out.getvalue()


FILE_HEADER = '''// src/gaia/eval/advancedTechWeights.ts
//
// 上級技術の重みテーブル（タイル → 研究列 → 種族 → 値）。**自動生成ファイル**:
//   python scripts/gen_advanced_tech_table.py --emit-file <このパス> <base.csv> <lf.csv>
// 手で直さず、CSV を直して生成し直すこと（検算は `<csv> --check`）。
// 中身が大きい（合計3528セル）ので factionWeights.ts とは別ファイルにしてある。
//
// 値は **VP 換算**（2026-08-03 ユーザー確定）。「その上級技術を適切なタイミングで
// 取れたら何点分の価値があるか」で、20〜30 程度が上限、0 はほぼ無く 5 以下も稀。
// 研究列ごとに値が違うのは「その列に置かれたタイルをその種族が取りに行けるか」を
// 織り込むため —— 上級技術はその列をレベル4まで上げないと取れないので、
// 登らない列に置かれた1枚は事実上取れない。
//
// 通常版 15タイル×6列×14種族＝1260セル / 拡張版 21×6×18＝2268セル。
// 拡張の有無で場に出るタイルの母集団が変わるので、標準技術と同じく表を分ける。

import type { ResearchTrackId } from "@/gaia/setup/types";
import type { FactionId } from "./factionWeights";

export type AdvancedTechTable = Record<
  string,
  Partial<Record<ResearchTrackId, Partial<Record<FactionId, number>>>>
>;

'''

FILE_FOOTER = '''
/** その拡張で使う上級技術のテーブル。 */
export function advancedTechTable(lostFleet: boolean): AdvancedTechTable {
  return lostFleet ? ADVANCED_TECH_WEIGHTS_LF : ADVANCED_TECH_WEIGHTS_BASE;
}

/**
 * 上級技術1枚ぶんの重み（研究列ごと）。**参照はここを通すこと。**
 * 表に無いタイル（通常版の AT16-21）は undefined ＝寄与なし。
 */
export function advancedTechCell(
  tileId: string,
  track: ResearchTrackId,
  lostFleet: boolean
): Partial<Record<FactionId, number>> | undefined {
  return advancedTechTable(lostFleet)[tileId]?.[track];
}

const TRACKS: ResearchTrackId[] = ["terra", "nav", "ai", "gaia", "eco", "sci"];
/** `${base|lf}:${tileId}` → 拡張部用のセル（初回だけ作る）。 */
const extensionCellCache = new Map<string, Partial<Record<FactionId, number>>>();

/**
 * 得点ボード拡張部に置かれた1枚の重み（Lost Fleet のみ）。
 *
 * 拡張部の上級技術は研究列に紐付かない＝どの列を登っていても取りに行けるので、
 * **研究列6つの最大値**を使う（標準技術のフリー枠と同じ理屈。techPositionCell 参照）。
 * 取得条件そのものが通常の上級と違う点は、評価指数 advExtension の係数側で見る。
 */
export function advancedTechExtensionCell(
  tileId: string,
  lostFleet: boolean
): Partial<Record<FactionId, number>> | undefined {
  const tile = advancedTechTable(lostFleet)[tileId];
  if (!tile) return undefined;
  const key = `${lostFleet ? "lf" : "base"}:${tileId}`;
  let cell = extensionCellCache.get(key);
  if (cell) return cell;
  cell = {};
  const seen = new Set<FactionId>();
  for (const trk of TRACKS) {
    for (const f of Object.keys(tile[trk] ?? {}) as FactionId[]) seen.add(f);
  }
  for (const f of seen) {
    let best = 0;
    for (const trk of TRACKS) {
      const v = tile[trk]?.[f] ?? 0;
      if (v > best) best = v;
    }
    if (best !== 0) cell[f] = best;
  }
  extensionCellCache.set(key, cell);
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
        + "/** ★通常版（基本14種族×15枚）。CSV から生成。 */\n"
        + "export const ADVANCED_TECH_WEIGHTS_BASE: AdvancedTechTable = {\n"
        + emit(base, False)
        + "\n};\n\n"
        + "/** ★拡張版（18種族×21枚）。CSV から生成。 */\n"
        + "export const ADVANCED_TECH_WEIGHTS_LF: AdvancedTechTable = {\n"
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
    # Windows のコンソール既定は cp932 で、BOM も日本語のタイル名も書けずに落ちる。
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
            sys.exit("usage: gen_advanced_tech_table.py --emit-file <out.ts> <base.csv> <lf.csv>")
        emit_file(args[0], args[1], args[2])
        return
    if not args:
        sys.exit(
            "usage: gen_advanced_tech_table.py [--template [--lf]] | <csv> [--check]\n"
            "       gen_advanced_tech_table.py --emit-file <out.ts> <base.csv> <lf.csv>"
        )
    data, lf = parse(read_csv(args[0]))
    name = "ADVANCED_TECH_WEIGHTS_LF" if lf else "ADVANCED_TECH_WEIGHTS_BASE"
    if "--check" in sys.argv:
        check(data, name)
    else:
        # どちらのテーブル向けかは標準エラーへ（標準出力は貼り付ける中身だけにする）
        sys.stderr.write("→ %s の中身と差し替えてください\n" % name)
        sys.stdout.write(emit(data, lf) + "\n")


if __name__ == "__main__":
    main()
