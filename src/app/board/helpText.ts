// src/app/board/helpText.ts
//
// /board（Map）の各項目のポップアップ文言（2026-10-15 ユーザー確定 2-(a)）。
// 「何を測るか」1 行＋「既定値の根拠」1〜2 行＋設計ノート（docs/design-notes.md）の節番号。
// 既定値や係数の数字はここに直書きしてある（定数から自動で埋めない。2-(b) は見送り）ので、
// 値を変えたら `docs/tuning-guide.md` と一緒にここも直す。
// 旧 title ツールチップ（uiText の tip*）はここへ移した。

import type { Lang } from "./uiText";
import type { HelpContent } from "@/components/ui/HelpPopover";

type Entry = { ja: HelpContent; en: HelpContent };

const ENTRIES = {
  // ---------- 検索の設定 ----------
  trials: {
    ja: {
      title: "試行回数",
      what: "1 回の検索で生成して評価する盤面の数。",
      why:
        "ハード制約を通る盤面は少ない（既定条件で LF 4人 0.2%、3人 0.7%。2026-09-29 実測）ので、上位を安定して得るには数万件が要る。" +
        "既定 30000。評価は通った盤面にしか走らないので、件数を増やしても評価の計算量はあまり増えない。",
      ref: "2.1",
    },
    en: {
      title: "Trials",
      what: "Boards generated and evaluated per search run.",
      why:
        "Few boards pass the hard constraints (LF 4p 0.2%, 3p 0.7% with the defaults), so tens of thousands are needed for a stable top list. " +
        "Default 30000. Soft evaluation only runs on boards that pass, so more trials cost little evaluation time.",
      ref: "2.1",
    },
  },
  topK: {
    ja: {
      title: "表示件数",
      what: "スコア上位から保持・表示する件数。",
      why: "既定 20。結果は条件ごとのバケツに貯まり、容量を超えた下位から整理される。ピン留めしたマップは整理の対象外。",
    },
    en: {
      title: "Top K",
      what: "How many top results are kept and shown.",
      why: "Default 20. Results accumulate per condition; the lowest are trimmed beyond capacity. Pinned maps are never trimmed.",
    },
  },
  keepAwake: {
    ja: {
      title: "検索中は画面を消さない",
      what: "検索中はブラウザに画面の自動消灯を抑止させる（Screen Wake Lock。このページが前面にある間だけ効く）。",
      why:
        "既定オン。他のアプリに切り替えると検索は止まるが、その瞬間に直前までの途中結果が保存される。" +
        "連続検索は検索件数を小さくして回すと失う分が減る。",
      ref: "2.5",
    },
    en: {
      title: "Keep screen on",
      what: "Asks the browser not to turn the screen off while a search runs (Screen Wake Lock; works while this page is in front).",
      why:
        "Default on. Switching to another app still pauses the search; the partial results so far are saved at that moment. " +
        "For continuous search, smaller trial counts lose less.",
      ref: "2.5",
    },
  },
  placementMethod: {
    ja: {
      title: "配置方法",
      what: "セクタータイルの並べ替え方。",
      why:
        "ルールブック p.19: 方法 1 は 01-04 を最初のゲームの位置に固定し 05-10 を入替。方法 2 は 01-04 も内側 4 スロット内で入替。" +
        "方法 3 は全 10 タイルを入替。回転はどの方法でも全タイル自由。",
    },
    en: {
      title: "Placement method",
      what: "How the sector tiles are shuffled.",
      why:
        "Rulebook p.19: Method 1 keeps sectors 01-04 in their first-game positions and shuffles 05-10; Method 2 also shuffles 01-04 within the inner slots; " +
        "Method 3 shuffles all 10 tiles. All tiles rotate freely in every method.",
    },
  },

  // ---------- 制約条件（ハード制約） ----------
  hard: {
    ja: {
      title: "制約条件",
      what: "満たさない盤面をその場で却下する条件。評価指数はこれを通った盤面にだけ掛かる。",
      why:
        "入力欄に無い常時の制約: 同種惑星の直接隣接禁止（基本版のルール。基本版で常時）、同色の通常惑星が距離 3 未満に近づかない（固定）。" +
        "既定条件での通過率は LF 4人 0.2% / 3人 0.7%。基本版は最外周の同色上限 1 だとほぼ通らず、上限 3 で 2%（2026-09-29 実測）。",
      ref: "2.1",
    },
    en: {
      title: "Hard constraints",
      what: "Conditions that reject a board immediately. The soft weights only apply to boards that pass.",
      why:
        "Always-on constraints without an input: no direct adjacency of same-type planets (base-game rule; always on for the base game), and same-colour planets never closer than distance 3 (fixed). " +
        "Pass rate with the defaults: LF 4p 0.2% / 3p 0.7%. The base game barely passes with outer same-colour max 1; 2% with max 3 (measured 2026-09-29).",
      ref: "2.1",
    },
  },
  outerSameColorMax: {
    ja: {
      title: "最外周の同色上限",
      what: "最外周（盤面の一番外の列）に置ける同色の通常惑星の上限。超える色が 1 つでもあれば却下。",
      why:
        "既定 1。端の惑星は広がり先が少なく、同じ色が端に固まると その色の価値が下がるため。" +
        "基本版では上限 1 だとほぼ通らないので 3 程度に緩める（上限 3 で通過率 2%）。",
      ref: "2.1",
    },
    en: {
      title: "Outer same-colour max",
      what: "Max planets of the same colour allowed on the outermost ring. Any colour above it rejects the board.",
      why:
        "Default 1. Edge planets have little room to expand, so a colour crowded on the edge loses value. " +
        "The base game barely passes with 1; relax to about 3 (2% pass rate).",
      ref: "2.1",
    },
  },
  maxConnectedPlanets: {
    ja: {
      title: "星系の最大サイズ",
      what: "隣接でつながった惑星のかたまりが N+1 個以上ある盤面を却下する（ガイア・次元横断も連結に含む）。0 で無効。",
      why: "既定 0（無効）。大きな星系を避けたいときだけ使う任意の制約で、既定の評価には入れていない。",
      ref: "2.1",
    },
    en: {
      title: "Max connected planets",
      what: "Rejects boards containing a connected planet cluster larger than N (gaia / transdim count as connected). 0 = off.",
      why: "Default 0 (off). An optional constraint for avoiding large clusters; not part of the default evaluation.",
      ref: "2.1",
    },
  },
  h5IncludeScouts: {
    ja: {
      title: "探査船セルも連結に含める",
      what: "上の星系の判定で、探査船（LF の船）のセルも惑星と同じように連結に数える。",
      why: "既定オフ。船のセルは惑星ではないが、同盟の経路としてはつながるので、必要なときだけ含められるようにしてある。",
      ref: "2.1",
    },
    en: {
      title: "Include scout cells",
      what: "Scout (Lost Fleet ship) cells also join clusters in the check above.",
      why: "Default off. Ship cells are not planets but do connect federations, so they can be included when needed.",
      ref: "2.1",
    },
  },
  centerMode: {
    ja: {
      title: "中央スロット",
      what: "中央スロットに入るタイルを制限する（LF のみ）。",
      why:
        "既定なし。基本版は配置方法 1 / 2 が内側の配置を保証し、方法 3 は自由が仕様なので欄を出さない。" +
        "LF は中央に大型セクターを置く組み方があるため、必要なときだけ制限できるようにしてある。",
      ref: "2.1",
    },
    en: {
      title: "Centre slot",
      what: "Restricts which tile may occupy the centre slot (Lost Fleet only).",
      why:
        "Default none. The base game needs no option: methods 1 / 2 fix the inner placement and method 3 is free by rule. " +
        "Lost Fleet layouts may put a large sector in the centre, so the restriction is available when wanted.",
      ref: "2.1",
    },
  },
} as const satisfies Record<string, Entry>;

export type HelpKey = keyof typeof ENTRIES;

export function helpContent(key: HelpKey, lang: Lang): HelpContent {
  return ENTRIES[key][lang];
}
