// src/components/manualContent.ts
//
// アプリ内マニュアル（/manual）の本文。
// 2026-10-16 ユーザー指示で「本ページの使い方」に作り直した: 画面（タブ）ごとに「使い方の手順」と
// 「設定項目（既定値・意味・変えるときの注意）」だけを載せる。設計の経緯・廃止した軸・実測・設計ノートの節番号は
// 載せない（docs/design-notes.md と docs/tuning-guide.md に残す）。項目ごとの根拠は画面の「?」が持つ。
// 既定値の数字は直書きなので、既定値を変えたら helpText と一緒にここも直す。
//
// 構造: 章（id / title / blocks）。ブロックは 小見出し h3 / 段落 p / 箇条書き ul / 表 table。

export type ManualBlock =
  | { h3: string }
  | { p: string }
  | { ul: string[] }
  | { table: { head: string[]; rows: string[][] } };

export type ManualChapter = { id: string; title: string; blocks: ManualBlock[] };

export type ManualText = { title: string; intro: string; toc: string; chapters: ManualChapter[] };

const ja: ManualText = {
  title: "マニュアル",
  intro:
    "各タブの使い方と、画面にある設定項目の意味をまとめたものです。項目の横の「?」をタップすると、その項目の詳しい説明が開きます。",
  toc: "目次",
  chapters: [
    {
      id: "common",
      title: "1. 共通の操作",
      blocks: [
        {
          table: {
            head: ["タブ", "何をする画面か"],
            rows: [
              ["Map", "盤面（セクターの配置）をシードから大量に作り、条件で絞って評価の良い順に並べる"],
              ["Setup", "タイル配置をシードから作り、種族ごとの価値を出す"],
              ["List", "ピン留めした盤面とタイル配置の組み合わせを提案する"],
              ["Total", "盤面 1 つとタイル配置 1 つを選び、種族ごとに値を合算して並べる"],
            ],
          },
        },
        {
          ul: [
            "共通バーの「人数」「基本版 / LF」「日本語 / EN」は全タブで共有されます。人数と拡張は検索・生成の条件に入ります。",
            "共通バー右端の「vX.Y.Z · eval_vN」はアプリの版と Map の評価バージョンです。評価の意味が変わると eval_vN が上がり、Map の検索結果は新しいバージョンのものとして別に貯まります（古い結果は「コピー」で引き継げます）。",
            "検索・生成の結果は条件ごとに自動で保存され、同じ条件で再開すると前回の上位と合流します。ピン留めした盤面とタイル配置は List に集まり、容量の整理からも守られます。",
            "共通バーの下の「探索条件」の帯は探索プロファイルです。種族優遇 / 冷遇（「編集」。色でまとめて入れることもできます）と、Map・Setup それぞれの検索条件を 1 つの名前で束ねます。検索を実行するとその側の条件が自動で登録され、帯の Map / Setup に「一致」「差分あり」「未登録」が出ます。Map で検索したあと Setup へ移り、「一致」を確かめてから検索する、という流れで使います。",
          ],
        },
      ],
    },
    {
      id: "map",
      title: "2. Map（盤面を探す）",
      blocks: [
        { h3: "使い方" },
        {
          ul: [
            "「条件」で検索件数と制約条件・評価指数を決め、「検索実行」を押します。「連続検索」は停止するまで繰り返し、上位を貯めます。",
            "「ランク」（狭い画面では「候補」タブ）に上位の盤面が並びます。行をタップすると盤面が表示され、「詳細」に種族別の内訳が出ます。",
            "気に入った盤面は「ピン留め」（List へ）、遊んだ盤面は「使用済み」（一覧から外す）。「共有URL」で盤面をそのまま共有できます。",
            "狭い画面では盤面の下が「候補 / 詳細 / 条件」のタブになります。",
          ],
        },
        { h3: "検索の設定" },
        {
          table: {
            head: ["項目", "既定", "意味", "変えるときの注意"],
            rows: [
              ["検索件数", "30000", "1 回の検索で生成して評価する盤面の数", "制約を通る盤面は数百に 1 つ程度なので、少なすぎると候補が出ません"],
              ["表示件数", "20", "保持・表示する上位の件数", "超えた分は下位から整理されます（ピン留めは残る）"],
              ["検索中は画面を消さない", "オン", "検索中の画面の自動消灯を抑える", "他のアプリに切り替えると検索は止まり、その時点の途中結果が保存されます"],
            ],
          },
        },
        { h3: "制約条件（満たさない盤面を却下する）" },
        {
          table: {
            head: ["項目", "既定", "意味", "変えるときの注意"],
            rows: [
              ["最外周の同色上限", "1", "一番外の列に置ける同色の惑星の上限", "基本版は 1 だとほぼ通らないので 3 程度に緩めます"],
              ["星系の最大サイズ", "0（無効）", "隣接でつながった惑星の塊がこの数を超える盤面を却下", "大きな星系を避けたいときだけ"],
              ["探査船セルも連結に含める", "オフ", "上の判定で船のセルも惑星と同じ扱いにする（LF）", "—"],
              ["中央スロット", "なし", "中央に入るタイルを制限する（LF）", "—"],
            ],
          },
        },
        { h3: "評価指数（通った盤面を順位付けする重み）" },
        {
          p: "良い盤面は「どの色にも同じくらいの価値がある盤面」です。評価指数は種族ごとの値の出し方を決め、7 色の値のばらつきが小さい盤面ほど上位になります。",
        },
        {
          table: {
            head: ["項目", "既定", "意味", "変えるときの注意"],
            rows: [
              ["欠けマス罰点", "5", "端の惑星の減点。5 ＝ 角の惑星 1 つの減点で、辺・内側ほど小さい", "基本版で大きく効き、LF ではほぼ効きません。0 で無効"],
              ["船接触半径（LF）", "3", "船から何マス以内の惑星を「船の近く」と見るか", "広げると船の価値が薄く広く配られます"],
              ["船接触（LF、船ごと）", "10", "船の近くの惑星 1 つあたりの加点", "惑星の基本の値が 10 なので、10 で「船の近くは約 2 倍」"],
              ["船星系（LF、船ごと）", "3", "船の星系の中にある惑星への加点", "船接触より小さく保つのが目安"],
              ["船星系: 最大寄与に帰属", "オフ", "複数の船の圏内の惑星を 1 隻だけに数える", "船どうしが近い盤面で加点が膨らむときに"],
              ["種族優遇 / 冷遇", "指定なし", "種族ごとの ＋ / −（帯で編集）。＋ でその種族が強い盤面を優遇", "1 でバランスとほぼ互角、2 で優遇が主導、5 でその種族だけで決まります。同じ色の 2 種族に入れると約 2 倍。変えると結果は別に貯まります"],
              ["種族優遇 / 冷遇の強さ", "25", "優遇 1 あたりの強さ", "通常は変えません"],
            ],
          },
        },
        {
          p: "評価指数を変えると別の条件として結果が貯まります（元の条件の結果は残ります）。",
        },
        { h3: "詳細（種族別の内訳）の読み方" },
        {
          table: {
            head: ["列", "意味"],
            rows: [
              ["評価", "その種族の値。右の列の合計"],
              ["母星", "母星色の惑星から得られる値（開始地点を含む）"],
              ["他色", "改造して入植する他の色の惑星の値"],
              ["緑 / 紫", "ガイア惑星 / 次元横断惑星の値"],
              ["拡張星", "原始・小惑星の値（LF のみ。「列を選ぶ」で表示）"],
            ],
          },
        },
        {
          ul: [
            "列の値は「開始地点から届きやすく入植しやすい惑星ほど大きい」ように数えています。列のセルをタップすると、その種族が届く惑星が地図に光ります（評価のセルは開始地点）。",
            "同じ色の 2 種族は盤面上の立場が近いので値も近くなります。LF の 4 種族は開始地点が 1 つなので値が低めに出ます。",
          ],
        },
      ],
    },
    {
      id: "setup",
      title: "3. Setup（タイル配置を作る）",
      blocks: [
        { h3: "使い方" },
        {
          ul: [
            "画面は Map と同じ「候補 / 詳細 / 条件」の並びです（狭い幅ではタブ）。",
            "候補: 「検索」は現在の条件で大量に生成し、基準の良い順に上位 20 件を候補に残します。結果は条件と基準ごとに貯まり、次の検索は前回の上位と合流します。候補一覧には検索の上位と保存した配置が 1 つの表に並びます（ピン留めが先、次に基準値の順）。行をタップすると表示が切り替わります。",
            "候補の行の「保存」で容量の整理から守り、「ピン留め」で List へ送ります（未保存の行をピン留めすると自動で保存されます）。「使用済み」にすると一覧から使用済みへ移ります。",
            "詳細: 表示中の配置の種族別の評価表です。",
            "条件: シードの指定とランダム、保存済み条件、評価指数です。タイルや面の固定 / 除外 / 候補は盤面のタイルをタップして指定します。",
          ],
        },
        { h3: "評価（種族別）と評価指数" },
        {
          p: "各タイルを「その種族がちょうど良いときに取れたら何点分か」で数え、カテゴリごとの評価指数を掛けて合計します（種族あたり 100 前後）。",
        },
        {
          table: {
            head: ["カテゴリ", "既定", "何を数えるか"],
            rows: [
              ["技術", "9", "標準技術タイル 9 枚（置かれた研究列で価値が変わる）"],
              ["LF船", "9", "船に乗る基本技術・金枠同盟・アーティファクト（LF）"],
              ["上級", "6", "研究トラック下の上級技術 6 枚"],
              ["RB", "9", "場に出るラウンドブースター"],
              ["R点", "6", "ラウンド得点タイル（何ラウンド目かで価値が変わる）"],
              ["最終", "9", "最終得点タイル 2 枚"],
              ["同盟", "9", "惑星改造レベル 5 の同盟タイル"],
              ["拡張", "2", "得点ボード拡張部の追加上級技術（1 枚を奪い合うので小さめ）"],
            ],
          },
        },
        {
          ul: [
            "評価指数はカテゴリ全体の効き方を変える係数で、List の提案にも同じ値が使われます。変えても貯めた結果は消えません。",
            "種族優遇 / 冷遇（帯で編集。種族ごとの ±）は検索と提案の並びに効き、評価表の値は変えません。目盛りは Map の色優遇と同じで、係数は色優遇の半分です（同じ色の 2 種族に入れると従来の色優遇とほぼ同じ大きさ）。",
          ],
        },
      ],
    },
    {
      id: "list",
      title: "4. List（組み合わせを提案する）",
      blocks: [
        { h3: "使い方" },
        {
          ul: [
            "Map と Setup でピン留めしたものがここに集まります。",
            "「探索の向き」（盤面から配置を探す / 配置から盤面を探す）と「基準」を選んで「提案を生成」すると、候補が上位 5 件まで出ます。",
            "候補の「この組を Total タブで見る」で合算の内訳へ、「保存リストに記録」で Setup の保存リストへ送れます。",
          ],
        },
        { h3: "基準" },
        {
          table: {
            head: ["基準", "どんな組み合わせを選ぶか"],
            rows: [
              ["1 逆優位", "盤面で強い種族ほど配置では弱くなる組（打ち消し合い）"],
              ["2 上位バランス", "上位（人数＋2）の種族が拮抗している配置"],
              ["3 全体バランス", "全種族の値の散らばりが小さい配置"],
              ["4 優位", "盤面で強い種族が配置でも強い組（相乗）"],
            ],
          },
        },
        {
          ul: [
            "基準 2・3 は盤面に依存しないので、盤面は条件に合う先頭のものになります。盤面で選びたいときは 1 か 4 を使います。",
            "種族優遇 / 冷遇（帯で編集。種族ごとの ±）は盤面と配置の合計に掛かります。目盛りは色優遇と同じです。",
            "「合計の上位」は盤面＋配置の合計が高い順に人数＋2 色（同じ色は強い方の種族だけ）です。",
          ],
        },
      ],
    },
    {
      id: "total",
      title: "5. Total（合算して並べる）",
      blocks: [
        { h3: "使い方" },
        {
          ul: [
            "盤面とタイル配置を 1 つずつ選ぶと、種族ごとに Map の値と Setup の値、その合計が並びます。選択は List と共有です。",
            "Map の値は Map の詳細（種族別の内訳）の「評価」と同じ、Setup の値は Setup の「総合」と同じです。LF では、船に乗るタイルの値をその種族が船に届きやすいかで増減してから足します。",
          ],
        },
        { h3: "合算比" },
        {
          table: {
            head: ["項目", "既定", "意味", "変えるときの注意"],
            rows: [["Map × / Setup ×", "1 : 1", "合計を出すときの倍率", "List の種族優遇と「合計の上位」にも同じ比が使われます"]],
          },
        },
        {
          p: "内訳を持たない古い盤面の候補は Map の値が 0 になります。Map タブで検索し直すと付きます。",
        },
      ],
    },
  ],
};

const en: ManualText = {
  title: "Manual",
  intro: "How to use each tab and what the settings on the screens mean. Tap the \"?\" next to an item for its detailed explanation.",
  toc: "Contents",
  chapters: [
    {
      id: "common",
      title: "1. Common controls",
      blocks: [
        {
          table: {
            head: ["Tab", "What it does"],
            rows: [
              ["Map", "Generates boards (sector layouts) from seeds in bulk, filters them by constraints and ranks them"],
              ["Setup", "Builds a tile layout from a seed and values it per faction"],
              ["List", "Suggests pairs of pinned boards and tile layouts"],
              ["Total", "Adds the map value and the setup value per faction for one board and one layout"],
            ],
          },
        },
        {
          ul: [
            "Players, Base game / LF and the language in the top bar are shared by all tabs. Players and expansion are part of the search and generation conditions.",
            "The right end of the top bar shows the app version and the map evaluation version (\"vX.Y.Z · eval_vN\"). When the meaning of the evaluation changes, eval_vN goes up and map results are stored separately per version (older results can be carried over with \"Copy\").",
            "Search and generation results are saved automatically per condition and merge with the previous top results when you resume. Pinned boards and layouts gather on the List tab and are protected from trimming.",
            "The \"Search profile\" strip under the top bar bundles the faction preference (\"Edit\"; values can be set per colour too) with the Map and Setup search conditions under one name. Running a search registers that side's conditions, and the Map / Setup badges show \"match\", \"differs\" or \"not set\". Typical flow: search on Map, move to Setup, confirm \"match\", then search.",
          ],
        },
      ],
    },
    {
      id: "map",
      title: "2. Map (finding a board)",
      blocks: [
        { h3: "How to use" },
        {
          ul: [
            "Set the trial count, constraints and weights under Conditions and press Search. Continuous search repeats until stopped, accumulating the top results.",
            "The top boards appear under Rank (the Results tab on narrow screens). Tap a row to show the board; Detail shows the per-faction breakdown.",
            "Pin a board you like (it goes to List), mark a played one as Used (removed from the list). Share URL shares the exact board.",
            "On narrow screens the area below the board becomes Results / Detail / Conditions tabs.",
          ],
        },
        { h3: "Search settings" },
        {
          table: {
            head: ["Item", "Default", "Meaning", "When changing"],
            rows: [
              ["Trials", "30000", "Boards generated and evaluated per run", "Only about one board in several hundred passes the constraints, so too few trials yield no results"],
              ["Top K", "20", "How many top results are kept and shown", "Lower results beyond K are trimmed (pinned ones stay)"],
              ["Keep screen on", "On", "Prevents the screen from turning off during a search", "Switching to another app pauses the search; partial results are saved at that moment"],
            ],
          },
        },
        { h3: "Hard constraints (boards that fail are rejected)" },
        {
          table: {
            head: ["Item", "Default", "Meaning", "When changing"],
            rows: [
              ["Outer same-colour max", "1", "Max planets of one colour on the outermost ring", "The base game barely passes with 1; relax to about 3"],
              ["Max connected planets", "0 (off)", "Rejects boards with a connected cluster larger than this", "Only when you want to avoid large clusters"],
              ["Include scout cells", "Off", "Ship cells count like planets in the check above (LF)", "—"],
              ["Centre slot", "None", "Restricts the tile in the centre slot (LF)", "—"],
            ],
          },
        },
        { h3: "Soft weights (ranking the boards that pass)" },
        {
          p: "A good board is one where every colour is worth about the same. The weights decide how each faction's value is computed; boards with a smaller spread across the seven colours rank higher.",
        },
        {
          table: {
            head: ["Item", "Default", "Meaning", "When changing"],
            rows: [
              ["Rim gap penalty", "5", "Deduction for edge planets. 5 = one corner planet; sides and inner rings less", "Strong in the base game, almost nil in LF. 0 = off"],
              ["Scout radius (LF)", "3", "How many cells from a ship count as \"near the ship\"", "A larger radius spreads the ship's value thinner"],
              ["Scout (LF, per ship)", "10", "Bonus per planet near the ship", "The base value of a planet is 10, so 10 means \"about double near a ship\""],
              ["Scout core (LF, per ship)", "3", "Bonus for planets inside the ship's cluster", "Keep it below scout"],
              ["Scout core: best ship only", "Off", "Credit a planet in several ships' range to one ship only", "When ships sit close together and the bonus inflates"],
              ["Faction preference", "none", "± per faction (edited in the strip); + favours boards where that faction is strong", "1 is about even with balance, 2 lets preference lead, 5 decides by that faction alone. Both factions of a colour give about double. Changing it starts a new result bucket"],
              ["Preference weight", "25", "Strength per unit of preference", "Usually left as is"],
            ],
          },
        },
        { p: "Changing a weight stores results under a new condition (the original condition's results remain)." },
        { h3: "Reading the Detail (breakdown by faction)" },
        {
          table: {
            head: ["Column", "Meaning"],
            rows: [
              ["Total", "The faction's value; sum of the columns to the right"],
              ["Home", "Value from home-colour planets (starts included)"],
              ["Other", "Value from other colours settled by terraforming"],
              ["Gaia / Transdim", "Value from gaia / transdimensional planets"],
              ["Ext.", "Proto and asteroid planets (LF only; shown via \"Columns\")"],
            ],
          },
        },
        {
          ul: [
            "Values count planets that are easier to reach and settle from the starts as larger. Tap a cell to light up the planets that faction reaches (the total cell shows the starts).",
            "Two factions of one colour sit in similar positions, so their values are close. The four LF factions start from a single planet, so their values come out lower.",
          ],
        },
      ],
    },
    {
      id: "setup",
      title: "3. Setup (building a tile layout)",
      blocks: [
        { h3: "How to use" },
        {
          ul: [
            "The page follows the Map layout: Candidates / Detail / Conditions (tabs at narrow widths).",
            "Candidates: Search generates many layouts under the current conditions and keeps the best 20 as candidates; results are stored per condition and criterion and the next search merges with them. The candidate table lists search results and saved layouts together (pinned first, then by score). Tap a row to show it.",
            "Save a row to protect it from trimming, Pin it to send it to List (pinning an unsaved row saves it), and mark it Used to move it to the used view.",
            "Detail: the per-faction evaluation table of the displayed layout.",
            "Conditions: seed and random, saved conditions, and the weights. Fix / exclude / shortlist tiles and faces by tapping them on the board.",
          ],
        },
        { h3: "Evaluation by faction and weights" },
        { p: "Each tile is counted as the VP it is worth to that faction when taken at the right time; category weights are applied and summed (about 100 per faction)." },
        {
          table: {
            head: ["Category", "Default", "What it counts"],
            rows: [
              ["Tech", "9", "The 9 standard tech tiles (value depends on the track)"],
              ["LF ships", "9", "Ship tech, gold federations and artifacts on the ships (LF)"],
              ["Advanced", "6", "The 6 advanced tech tiles under the tracks"],
              ["Boosters", "9", "Round boosters in play"],
              ["Round", "6", "Round scoring tiles (value depends on the round)"],
              ["Final", "9", "The two final scoring tiles"],
              ["Federation", "9", "The federation tile at Terraforming level 5"],
              ["Ext.", "2", "Extra advanced tech on the scoring-board extension (one tile contested, so small)"],
            ],
          },
        },
        {
          ul: [
            "Weights scale whole categories and are shared with List suggestions. Changing them does not discard stored results.",
            "Faction preference (edited in the strip; ± per faction) affects search and suggestion ranking, not the table values. Same scale as Map's colour preference, with half the coefficient (setting both factions of a colour gives about the old colour bonus).",
          ],
        },
      ],
    },
    {
      id: "list",
      title: "4. List (suggesting pairs)",
      blocks: [
        { h3: "How to use" },
        {
          ul: [
            "Everything pinned on Map and Setup gathers here.",
            "Choose a direction (board → layout / layout → board) and a criterion, then Generate to get up to 5 candidates.",
            "\"See this pair on the Total tab\" shows the sum per faction; \"Record to saved list\" sends the layout to Setup's saved list.",
          ],
        },
        { h3: "Criteria" },
        {
          table: {
            head: ["Criterion", "What it picks"],
            rows: [
              ["1 Oppose map", "Pairs where factions strong on the board are weak in the layout (cancelling out)"],
              ["2 Top balance", "Layouts where the top (players + 2) factions are close"],
              ["3 Overall balance", "Layouts with a small spread across all factions"],
              ["4 Align map", "Pairs where factions strong on the board are strong in the layout too"],
            ],
          },
        },
        {
          ul: [
            "Criteria 2 and 3 do not depend on the board, so the first matching board is used. Use 1 or 4 to choose by board.",
            "Faction preference (edited in the strip; ± per faction) applies to board + layout. Same scale as colour preference.",
            "\"Top by total\" lists players + 2 colours by board + layout (only the stronger faction per colour).",
          ],
        },
      ],
    },
    {
      id: "total",
      title: "5. Total (adding up)",
      blocks: [
        { h3: "How to use" },
        {
          ul: [
            "Pick one board and one layout to see the map value, the setup value and their sum per faction. The selection is shared with List.",
            "The map value equals Total in Map's Detail; the setup value equals Setup's total. In LF, tiles on ships are scaled by how easily the faction reaches the ship before adding.",
          ],
        },
        { h3: "Blend" },
        {
          table: {
            head: ["Item", "Default", "Meaning", "When changing"],
            rows: [["Map × / Setup ×", "1 : 1", "Multipliers used for the sum", "List's faction preference and \"Top by total\" use the same ratio"]],
          },
        },
        { p: "Old board candidates without a breakdown get 0 for the map value. Re-search on the Map tab to add it." },
      ],
    },
  ],
};

export const MANUAL: Record<"ja" | "en", ManualText> = { ja, en };
