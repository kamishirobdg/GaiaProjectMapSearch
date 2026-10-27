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
              ["Pair（トップ）", "盤面とタイル配置の組を提案し、種族ごとに値を合算して見比べる。「両方を探索」で Map と Setup の検索を一括で実行できる"],
              ["Map", "盤面（セクターの配置）をシードから大量に作り、条件で絞って評価の良い順に並べる"],
              ["Setup", "タイル配置をシードから作り、種族ごとの価値を出す"],
            ],
          },
        },
        {
          ul: [
            "共通バーの「人数」「基本版 / LF」「日本語 / EN」は全タブで共有されます。人数と拡張は検索・生成の条件に入ります。基本版で 3 人のときは Map / Pair の人数の隣に「盤面」が出て、10枚（通常）/ 9枚（09 を除く）/ 8枚（09・10 を除く）の縮小盤を選べます（ルールブック p19。Map の検索条件に入り、結果は盤面ごとに別に貯まります）。",
            "共通バー右端の「vX.Y.Z · eval_vN」はアプリの版と Map の評価バージョンです。評価の意味が変わると eval_vN が上がり、Map の検索結果は新しいバージョンのものとして別に貯まります（古い結果は「コピー」で引き継げます）。",
            "検索・生成の結果は条件ごとに自動で保存され、同じ条件で再開すると前回の上位と合流します。ピン留めした盤面とタイル配置は Pair の起点に使え、容量の整理からも守られます。",
            "共通バーの下の「探索条件」の帯は探索プロファイルです。種族優遇 / 冷遇（「編集」。色でまとめて入れることもできます）と、Map・Setup それぞれの検索条件を 1 つの名前で束ねます。検索を実行するとその側の条件が自動で登録され、帯の Map / Setup に「一致」「差分あり」「未登録」が出ます。Map で検索したあと Setup へ移り、「一致」を確かめてから検索する、という流れで使います。帯の「上位 K」は「上位」と数える種族の数で、空欄なら人数＋2 です（基準 1 上位バランス、種族優遇の境目、Pair の「合計の上位」が使います）。",
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
            "気に入った盤面は「ピン留め」（Pair の起点に）、遊んだ盤面は「使用済み」（一覧から外す）。「共有URL」で盤面をそのまま共有できます。",
            "狭い画面では盤面の下が「候補 / 詳細 / 条件」のタブになります。",
          ],
        },
        { h3: "検索の設定" },
        {
          table: {
            head: ["項目", "既定", "意味", "変えるときの注意"],
            rows: [
              ["検索件数", "30000", "1 回の検索で生成して評価する盤面の数", "制約を通る盤面は数百に 1 つ程度なので、少なすぎると候補が出ません"],
              ["表示件数", "20", "表示する上位の件数", ""],
              ["保存数", "1000", "条件ごとに残す盤面の数（100〜5000）。検索のたびに積み上がる", "超えた分は下位から整理されます（ピン留めは残る）。保存するのは配置とスコアだけで、内訳は盤面を開いたときに評価し直します"],
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
              ["種族優遇 / 冷遇", "指定なし", "種族ごとの ＋ / −（帯で編集）。優遇した種族が上位（上位 K、既定 人数＋2 種族）に届かない盤面ほど下げます。すでに上位にいれば何もしません", "1 で優遇した種族が上位に入る盤面が LF で約 3 割から約 6 割に（基本版は約 5 割から約 7 割に）、2 で約 7 割（基本版は約 8 割）になります。冷遇は上位に入っている盤面ほど下げます。変えると結果は別に貯まります"],
              ["種族優遇 / 冷遇の強さ", "50", "優遇 1 あたりの強さ", "通常は変えません。優遇を付けていないときは効かず、変えても結果は分かれません"],
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
            "候補の行の「保存」で容量の整理から守り、「ピン留め」で Pair の起点にします（未保存の行をピン留めすると自動で保存されます）。「使用済み」にすると一覧から使用済みへ移ります。",
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
            "評価指数はカテゴリ全体の効き方を変える係数で、Pair の提案にも同じ値が使われます。変えても貯めた結果は消えません。",
            "種族優遇 / 冷遇（帯で編集。種族ごとの ±）は検索の並びに効き、評価表の値は変えません。優遇した種族が上位（上位 K、既定 人数＋2 種族）に届かないセットアップほど下がります。すでに上位にいれば何もしません。1 で優遇した種族が上位に入る割合が約 3 割から約 6〜7 割に、2 で約 8 割になります。冷遇は上位に入っているセットアップほど下がります。",
          ],
        },
      ],
    },
    {
      id: "pair",
      title: "4. Pair（組を提案して合算する）",
      blocks: [
        { h3: "使い方" },
        {
          ul: [
            "画面は Map / Setup と同じ「候補 / 詳細 / 条件」の並びです（狭い幅ではタブ）。",
            "候補: 「探索の向き」（盤面から配置を探す / 配置から盤面を探す）、セットアップの探し方（ランダム生成 / 保存済み）、「基準」を選んで「提案を生成」すると、上位 5 件が候補一覧に並びます。保存した組も同じ一覧に出ます。",
            "「両方を探索」は、探索プロファイルに登録した Map と Setup の条件で両方の検索を順に実行し（件数はそれぞれのタブの設定）、結果を各タブの候補に貯めたうえで、Map 上位 K × Setup 上位 L の組を基準で採点して上位 10 組を候補に並べます。条件が未登録の側は、そのタブで検索を 1 回実行すると登録されます。",
            "「連続で探索」は停止するまで繰り返します。探索の向きが マップ → セットアップ のとき: Map の候補の上位 K 枚のうち未探索のマップごとに Setup を「1 マップあたりの件数」（既定 100000）ぶん、そのマップとの組として採点 → 上位 L 件を順位表へ → Map の検索 → 新たに上位 K に入ったマップだけ探索。セットアップ → マップ のとき: 起点のセットアップを固定して Map の検索を繰り返し、制約を通った盤面を組として採点して順位表へ。順位表は条件（人数・拡張・基準・評価指数）ごとに上位 50 組を端末に残します（「順位表を消す」で消去）。Map の結果は Map タブの候補にも貯まりますが、Setup の候補には入れません（組の基準値はマップごとに違うため）。",
            "候補一覧は、提案・順位表・保存した組・共有された組をすべて、いまの基準・評価指数・合算比で採点し直し、主（探索の向きが マップ → セットアップ ならマップ、逆ならセットアップ）ごとに 1 行、最良の相手と並べます（# が順位。「+n」は同じ主の別の組の数）。行をタップすると「詳細」に盤面・配置・種族別の合計（Map の値、Setup の値、その合計）が出て、「別の候補」で同じ主の別の相手に切り替えられます。Setup の値は LF では船に乗るタイルの値をその種族の船接触の比で再配分するので、Setup タブの総合と数点ずれます。「保存」で組を残し、「Map で開く」「Setup で開く」で各タブへ、「セット共有URL」で組をそのまま共有できます。",
            "「プレイ済みにする」を押すと、マップは Map タブの使用済みに、セットアップは Setup タブの候補に記録して使用済みになり、以後 Pair の選択肢・一覧・提案・連続探索に出ません。戻すのは各タブの使用済み一覧からです。条件の「プレイ済みも表示」で一覧に含められます（「済」の印）。",
            "Map の値は候補の条件でいまの評価に評価し直した値です（Map タブで開いた値と同じ基準）。",
            "LF では合計表の Setup の値に点線が付き、カーソルを合わせると船ごとの船接触（その種族から見た船の近さ。平均との比）と、船に乗るタイルの値・船の相互作用の加点が出ます（タッチ端末では出ません）。",
            "条件: 保存済み条件、評価指数、合算比、「両方を探索」の K・L（既定 20 × 20、上限 50）、「連続で探索」の 1 マップあたりの Setup 件数（既定 100000、1000〜1000000）です。",
          ],
        },
        { h3: "基準" },
        {
          table: {
            head: ["基準", "どんな組み合わせを選ぶか"],
            rows: [
              ["1 上位バランス", "合計（Map ＋ Setup）で上位 K（既定 人数＋2）の種族が拮抗している組（既定）。残りの種族は見ません"],
              ["2 全体バランス", "合計で全種族の値の散らばりが小さい組"],
              ["3 逆優位（廃止予定）", "盤面で強い種族ほど配置では弱くなる組（打ち消し合い）。合計のバランスは測りません。使わないことが確定したら消します"],
              ["4 優位（廃止予定）", "盤面で強い種族が配置でも強い組（相乗）。合計のバランスは測りません。使わないことが確定したら消します"],
            ],
          },
        },
        {
          ul: [
            "基準 1・2 は盤面の評価の内訳を使って合計で測ります。内訳を持たない古い盤面では配置の値だけで測り、その旨の注記が出ます。",
            "種族優遇 / 冷遇（帯で編集。種族ごとの ±）は、優遇した種族が合計で上位（上位 K、既定 人数＋2 種族）に届かない組ほど下げます。すでに上位にいれば何もせず、バランスの基準がそのまま並びを決めます。1 で優遇した種族が上位に入る組が約 3 割から約 6 割（基本版は約 8 割）に、2 で約 7 割（基本版は約 9 割）になります。冷遇は上位に入っている組ほど下げます。",
            "「合計の上位」は合計が高い順に上位 K 種族（既定 人数＋2）です。基準 1 上位バランスが測る上位と同じ種族で、同じ色の 2 種族が並ぶこともあります。",
          ],
        },
        { h3: "合算比" },
        {
          table: {
            head: ["項目", "既定", "意味", "変えるときの注意"],
            rows: [["Map × / Setup ×", "1 : 1", "合計を出すときの倍率", "基準 1・2 の採点、種族優遇の掛け先、「合計の上位」にも同じ比が使われます"]],
          },
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
              ["Pair (home)", "Suggests board + layout pairs and compares them by per-faction totals. \"Search both\" runs the Map and Setup searches in one go"],
              ["Map", "Generates boards (sector layouts) from seeds in bulk, filters them by constraints and ranks them"],
              ["Setup", "Builds a tile layout from a seed and values it per faction"],
            ],
          },
        },
        {
          ul: [
            "Players, Base game / LF and the language in the top bar are shared by all tabs. Players and expansion are part of the search and generation conditions. With the base game and 3 players, Map / Pair show a \"Board\" choice next to the player count: 10 tiles (standard), 9 (without 09) or 8 (without 09 and 10), the smaller boards from rulebook p19. It is part of the Map search conditions and results are stored per board.",
            "The right end of the top bar shows the app version and the map evaluation version (\"vX.Y.Z · eval_vN\"). When the meaning of the evaluation changes, eval_vN goes up and map results are stored separately per version (older results can be carried over with \"Copy\").",
            "Search and generation results are saved automatically per condition and merge with the previous top results when you resume. Pinned boards and layouts can be used as starting points on the Pair tab and are protected from trimming.",
            "The \"Search profile\" strip under the top bar bundles the faction preference (\"Edit\"; values can be set per colour too) with the Map and Setup search conditions under one name. Running a search registers that side's conditions, and the Map / Setup badges show \"match\", \"differs\" or \"not set\". Typical flow: search on Map, move to Setup, confirm \"match\", then search. The strip's \"Top K\" is how many factions count as the top; blank means players + 2 (used by criterion 1 top balance, the faction preference threshold and Pair's \"top by total\").",
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
            "Pin a board you like (usable on Pair), mark a played one as Used (removed from the list). Share URL shares the exact board.",
            "On narrow screens the area below the board becomes Results / Detail / Conditions tabs.",
          ],
        },
        { h3: "Search settings" },
        {
          table: {
            head: ["Item", "Default", "Meaning", "When changing"],
            rows: [
              ["Trials", "30000", "Boards generated and evaluated per run", "Only about one board in several hundred passes the constraints, so too few trials yield no results"],
              ["Top K", "20", "How many top results are shown", ""],
              ["Stored", "1000", "Boards kept per condition (100–5000); each search merges into it", "Lower results beyond it are trimmed (pinned ones stay). Only placement and score are stored; the breakdown is re-evaluated when a board is opened"],
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
              ["Faction preference", "none", "± per faction (edited in the strip). Boards where the preferred faction falls short of the top (top K, default players + 2 factions) rank lower; nothing changes when it is already there", "At 1 the share of boards with the preferred faction in the top rises from about 30% to about 60% on LF (base game from about 50% to about 70%), at 2 to about 70% (base game about 80%). A negative value lowers boards where that faction is in the top. Changing it starts a new result bucket"],
              ["Preference weight", "50", "Strength per unit of preference", "Usually left as is. It has no effect without a preference and changing it then does not split results"],
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
            "Save a row to protect it from trimming, Pin it to use it on Pair (pinning an unsaved row saves it), and mark it Used to move it to the used view.",
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
            "Weights scale whole categories and are shared with Pair suggestions. Changing them does not discard stored results.",
            "Faction preference (edited in the strip; ± per faction) affects the search ranking, not the table values. Setups where the preferred faction falls short of the top (top K, default players + 2 factions) rank lower; nothing changes when it is already there. At 1 the share where the preferred faction makes the top rises from about 30% to 60–70%, at 2 to about 80%. A negative value lowers setups where that faction is in the top.",
          ],
        },
      ],
    },
    {
      id: "pair",
      title: "4. Pair (suggesting and adding up)",
      blocks: [
        { h3: "How to use" },
        {
          ul: [
            "The page follows the Map / Setup layout: Candidates / Detail / Conditions (tabs at narrow widths).",
            "Candidates: choose a direction (board → layout / layout → board), the setup source (random rolls / saved) and a criterion, then Generate; the top 5 appear in the candidate list together with saved pairs.",
            "\"Search both\" runs the Map and Setup searches with the conditions registered in the search profile (trial counts from each tab), stores the results in each tab's candidates, then scores top K maps × top L setups and lists the best 10 pairs. If one side is not registered yet, run one search on that tab.",
            "\"Search continuously\" repeats until stopped. Direction Map → Setup: for each unexplored map among the top K Map candidates, score setups (\"setups per map\", default 100000) as a pair with that map → the top L into the ranking → Map search → explore only maps newly entering the top K. Setup → Map: keep the chosen setup fixed, repeat the Map search and score every board that passes the constraints into the ranking. The ranking keeps the best 50 pairs per condition (players, expansion, criterion, weights) on this device (\"Clear ranking\" removes them). Map results also go to the Map tab's candidates; nothing goes to the Setup candidates (pair scores depend on the map).",
            "The candidate list rescores proposals, the ranking, saved pairs and shared pairs with the current criterion, weights and blend, groups them by the primary item (the map in Map → Setup, the setup in Setup → Map) and shows one row each with its best partner (# is the rank; “+n” counts other pairs of the same item). The detail lets you switch to another partner. Map values are re-evaluated under the candidate's conditions (same basis as the Map tab). In LF the setup value redistributes ship-tile values by the faction's ship-contact ratio, so it differs from the Setup tab total by a few points.",
            "“Mark as played” marks the map used on the Map tab and records the setup as used on the Setup tab; it then disappears from Pair's choices, list, proposals and continuous search. Undo from each tab's used list. “Show played” in Conditions includes them (marked “played”).",
            "Tap a candidate row to see the board, the layout and the per-faction totals (map value, setup value, sum) in Detail. Save keeps the pair; Open in Map / Open in Setup jump to those tabs; Share pair URL shares the exact pair.",
            "On LF the setup values in the total table are dotted; hover one for the per-ship contact (how close each ship is for that faction, relative to its mean), the tile value on that ship and the ship-interaction bonus (not shown on touch devices).",
            "Conditions: saved conditions, weights, the blend, K / L for Search both (default 20 × 20, max 50), and setups per map for Search continuously (default 100000, 1000–1000000).",
          ],
        },
        { h3: "Criteria" },
        {
          table: {
            head: ["Criterion", "What it picks"],
            rows: [
              ["1 Top balance", "Pairs where the top K (default players + 2) factions are close by total (map + setup) (default); the rest are ignored"],
              ["2 Overall balance", "Pairs with a small spread of totals across all factions"],
              ["3 Oppose map (to be removed)", "Pairs where factions strong on the board are weak in the layout (cancelling out). Does not measure the balance of the total; will be deleted once confirmed unused"],
              ["4 Align map (to be removed)", "Pairs where factions strong on the board are strong in the layout too. Does not measure the balance of the total; will be deleted once confirmed unused"],
            ],
          },
        },
        {
          ul: [
            "Criteria 1 and 2 use the board's evaluation breakdown to score by total. Old boards without a breakdown are scored by the layout only, with a note.",
            "Faction preference (edited in the strip; ± per faction) lowers pairs where the preferred faction falls short of the top (top K, default players + 2 factions) by total; nothing changes when it is already there, so the balance criterion decides. At 1 the share of pairs with the preferred faction in the top rises from about 30% to about 60% (base game about 80%), at 2 to about 70% (base game about 90%). A negative value lowers pairs where that faction is in the top.",
            "\"Top by total\" lists the top K factions (default players + 2) by total: the same top that criterion 1 (top balance) measures; both factions of a colour may appear.",
          ],
        },
        { h3: "Blend" },
        {
          table: {
            head: ["Item", "Default", "Meaning", "When changing"],
            rows: [["Map × / Setup ×", "1 : 1", "Multipliers used for the sum", "Criteria 1 / 2, the faction preference and \"Top by total\" use the same ratio"]],
          },
        },
      ],
    },
  ],
};

export const MANUAL: Record<"ja" | "en", ManualText> = { ja, en };
