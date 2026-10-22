# GaiaProjectMapSearch 作業ルール

詳細は README.md（仕組み・座標系・スナップショット運用）と docs/ の各仕様書、
残タスクは TODO.md を参照。**評価値の調整は `docs/tuning-guide.md`**（第一候補の定数・今の値の意味・測り方・
過去の試行錯誤の教訓。値を変えたらここも更新する）。

## 進めかた

- 機能ブランチ → 1修正=1コミット → `release/v1.01` へ FFマージ。
- **ブランチ作成前に必ず `cd /c/work/GaiaProjectMapSearch && pwd` でCWD確認**
  （シェルCWDが C:\work に戻り、外側リポジトリに迷いブランチを作る事故が複数回発生）。
- 毎コミット: `npm run typecheck`（0件）/ `npm run lint`（エラー0）/ `npm test`（全緑）。
- `git push` は Vercelデプロイを意味する。**2026-10-17 から: 実装が終わったものは検証（typecheck / lint / test ＋ ヘッドレス）のうえ
  本番へ FF push してよい**（ユーザー確認。設計ノート 1.6「運用」）。評価の意味が変わる変更（`EVAL_VERSION`）と挙動が変わる仕様の
  選択肢の提示は従来どおり。
- 挙動が変わる仕様は、実装前に選択肢を提示して確定してから着手。
- **版**（2026-10-05 ユーザー確定、案B）: 本番へ出すときは `package.json` の version を上げる
  （評価の意味が変わる・機能追加は2桁目、表示やドキュメントだけなら3桁目）。版の目印は「chore: vX.Y.Z」の
  コミット（**git タグは打たない**。2026-10-10 ユーザー決定。アプリもビルドもタグを読まず、クラウド環境からは
  push できなかった）。画面の共通バー右端に「vX.Y.Z · eval_vN」が出る（`src/lib/appVersion.ts`）。
  本番のビルド完了はこの表示で判定できる。
  ブランチ名 `release/v1.01` は版とは独立（変えない）。

## 重みテーブル（2026-08-04）

- 種族別評価の重みは **`data/weights/*.csv` が正本**。`src/gaia/eval/` の
  `advancedTechWeights.ts` / `techPositionWeights.ts` / `roundScoringWeights.ts` /
  `tileWeights.ts` は**自動生成物なので手で編集しない**（CSV を直して
  `scripts/gen_*_table.py --emit-file` で作り直す）。手順は `data/weights/README.md`。
- 値は **VP 換算**（そのタイルを取れたら何点分か）。合計は最後に
  `SETUP_SCORE_DIVISOR`（`src/gaia/eval/setupWeights.ts`。いまは28）で割られ、
  種族あたり100前後になる。
- **値の入力は 2026-09-19 に全表で一巡完了**（ユーザー確認）。以後は `/weights` の差分で
  直すだけ。CSV に雛形は残っていない（同値の列があっても意図どおり。HANDOFF.md 参照）。
- **値を変えたら影響力を測り直す**（`_probe_category_influence.ts`）。
  目安の順は 技術 > LF船 > 上級 > ブースター > ラウンド > 最終 > 追加上級 > 同盟。
  ただし **この順を厳密に守るために係数を微調整することはしない**（2026-08-04 判断）。
  素点が実態に寄っているぶん前後するのは正常 —— たとえば最終得点は全員の順位で
  大きく差が付くので、4〜6位のどこに来ても違和感はない。

## Map 評価の集計（2026-10-03、端の罰点は 2026-10-04、ガイア・次元横断の計上は 2026-10-06）

- 種族ごとの値は「開始地点（母星色）＋残りの同色惑星とガイア・次元横断の惑星 × 到達係数」
  （`src/gaia/eval/reachCost.ts`）。跳躍コスト・入植コスト・改造の輪・減衰 0.5^(コスト−1)・LF4種族の表・
  **基本14種族のプロファイル（`BASIC_REACH_PROFILES`。開始建物の数、航行・改造・ガイアの初期研究の差。
  2026-10-05、eval_v5）**は**ユーザーが決めた定数**。変えるときは選択肢を提示して確定してから。
  `reachCost.test.ts` が値を固定している。色の値はその色の2種族のうち大きい方（代表値、案A）で、
  検索の偏り項は代表値で7色のばらつきを測る（種族優遇は eval_v9 から種族ごとの値に掛ける）。内訳表は種族の行（色でまとめない）。画面の列名は
  母星 / 他色 / 緑 / 紫 / 拡張星（2026-10-10 ユーザー指定）だが、コードとドキュメントの種別名は own / other / gaia /
  transdim / extra（母星色 / 他色 / ガイア / 次元横断 / 原始・小惑星）のまま。
- **eval_v7（2026-10-07、「全惑星を同一の式で」。v1.5.0 で本番へ）**: 種族の値 ＝
  Σ 全惑星 係数(種別) × (固有値 10 ＋ 船接触 ＋ 船星系 ＋ 端の罰点) × 到達係数。係数は `reachCost.ts` の
  `UNIFIED_VALUE`（母星色 1 / 他色 0.25（改造種族 ×1.2）/ ガイア 0.5 / 次元横断 0.25（ガイア種族 0.5）/
  原始・小惑星 0.1）で、**すべて調整必須のマジックナンバー**（設計ノート 2.10 の表。変えるときはユーザー判断＋
  `_probe_map_values.ts` で実測＋`EVAL_VERSION`）。ガイア種族 `GAIA_FACTIONS`、改造種族 `TERRAFORM_FACTIONS`
  （**暫定** ジオデン人・タクロン族・ネヴラ人。ユーザーが決め直す）。ガイア近接の軸（5 / 8 / 3 の距離 2 最大は
  2026-07-30 の割合合わせの副産物）・星系の軸・eval_v6 の `DESTINATION_VALUE_SCALE` は廃止。内訳表は種別ごとの列
  （母星色 / 他色 / ガイア / 次元横断 / 原始・小惑星）。次元横断の入植コストは 通常 2 / ガイア Lv1 開始 1 /
  イタル人 1.5（eval_v6 から）。**eval_v5 / v6 は本番に出さない**（経緯は設計ノート 2.7。「大きく掛ける」＝
  「大きく削る」の取り違えが一度起きた箇所）。端の罰点 w は 0.5 のまま（「基本版で端が有利」は測り方の誤り
  だった。種族の平均を引いて欠けマス数で測ると端は一貫して不利。設計ノート 2.10）。改造種族の分類は暫定のまま
  リリースし、将来は種族ごとの倍率表にする（ユーザー決定）。
- **eval_v8（2026-10-08、v1.6.0 で本番へ）**: ダー・シュワーム人の開始地点（惑星首府 1 つ）の
  値 × 1.5（`BASIC_REACH_PROFILES.ivits.startValueScale`、`planStarts` の開始地点の重みに入る。調整必須の
  マジックナンバー）。内訳表の種別セルのマーカーは到達コスト ≦ 3 の惑星だけ（`MARKER_MAX_REACH_COST`。2026-10-09 に 2 → 3）。
  **船の相互作用**（`src/gaia/eval/shipInteraction.ts`、α 1 ＝ 掛け算、**種族ごとの船接触 (ii-f)**。2026-10-09）: Pair（旧 List ＋ Total）の組の提案の
  採点と合計表の Setup 列で、船 s に乗るタイルの種族別の値を、その種族の船接触 C_{s,f}（船の近くの惑星の到達係数 × 船接触）の
  相対値で増減する。検索には入れない。加点は Setup の値の 2.5%、合計の上位の顔ぶれが変わる組 23%。α と尺度は本番の体感で
  調整する第一候補（`docs/tuning-guide.md`）。
- **画面と検索の実行（2026-10-10〜11、v1.6.1〜v1.6.7。評価値は不変）**: 狭い幅（1180px 未満）は盤面の下が「候補 / 詳細 / 条件」の
  タブ、内訳表は内容幅（`compact`）、列名は 母星 / 他色 / 緑 / 紫 / 拡張星（既定オフ）。検索は `searchRunner.ts` → ワーカー
  （SharedArrayBuffer 無しでも使う。停止は SAB のフラグか terminate ＋ 500 件ごとの snapshot）→ 駄目ならメインスレッド
  （50 件ごとに譲歩）。進捗の行の末尾に経路 `[worker]` / `[worker-nosab]` / `[main]`。Wake Lock は既定オン。
  **検索中の定期保存はしない**（v1.6.6 で入れて遅くなった。背景に回った瞬間と停止時だけ保存）。
  FF push 後は GitHub の deployments API で Production の有無と成功を確認する（Vercel が 1 回取りこぼした）。
- **項目の説明は「?」の小窓（2026-10-15、v1.6.8）**: `src/components/ui/HelpPopover.tsx`（共通部品）＋ Map の文言
  `src/app/board/helpText.ts`（何を測るか／既定値の根拠／設計ノートの節。ja / en）。**title ツールチップはタッチ端末で出ない**ので
  項目の説明には使わない（操作のヒントとセルのホバーは title のまま）。内訳表の列見出しは「?」を足さず文字をトリガーに
  （狭い幅で表を広げない）。**定数や既定値を変えたら helpText の数字も直す**（自動では埋めていない）。Setup / Pair の文言は
  `src/components/helpText.ts`（「?」は `FactionEvalPanel.tsx` の `SharedHelp`。v1.6.9）。評価表の列見出しはクリックでマークするので
  title のまま。**アプリ内マニュアル `/manual`**（2026-10-16、v1.7.0 → v1.7.2。共通バーの「Manual」タブ、日英、5 章）は
  `src/components/manualContent.ts` が本文、`ManualView.tsx` が描画。**マニュアルは「使い方と設定項目（既定値・意味・注意）」だけ。
  設計の経緯・廃止した軸・実測・設計ノートの参照は載せない**（ユーザー方針。根拠は「?」と docs/ が持つ）。
  **定数や既定値を変えたら helpText と manualContent の数字も直す**。
- 端の罰点は「欠けマス × w」（距離2以内の18マスのうち盤面に無いマス1つにつき w、既定 0.5、
  `wRimGap`。eval_v4）。最外周セル→「最外周」列、外周セル→「外周」列、原始・小惑星にも掛ける。
  **入力欄は10倍の整数**（既定 5 ＝ 角の惑星1つの罰点。`RIM_GAP_INPUT_SCALE`）。内部値と
  保存キーは 0.5 のままなので、表示の単位を変えても結果バケツは割れない。
  判定基準は「端のマイナスは基本版で大きく効き、LF ではほぼ効かない」（`_probe_rim.ts` で
  基本版 9.9% ≫ LF 1%）。w を変えるときも選択肢を提示して確定してから。
- **評価の意味が変わる変更は `EVAL_VERSION`（`src/app/board/persistence.ts`）を上げる**。
  検索結果は別バケツに貯まり、旧バージョンの候補は「コピー」で再評価して引き継げる。
  回帰スナップショットは `npm run snapshot:update` → 差分が意図どおり（placement / hard 不変）か
  確かめて同一コミット。
- 設計判断や実測をしたら `docs/design-notes.md` に追記する（マニュアルとポップアップの材料）。

## 互換の鉄則

- 検索条件キー・保存データのキーは「**無効時フィールド省略**」のスプレッド構築
  （`...(x > 0 ? { x } : {})`）。新設定も同じ形にし、既存キーをバイト不変に保つ。
- LFテンプレの regression snapshot（`scripts/__snapshots__/baseline.json`）は
  意図した差分以外を出さない。更新は `npm run snapshot:update` → 差分目視 → 同一コミット。
- localStorage は「復元effect＋書込みeffect」を併用しない（Strict Mode二重実行で
  復元前デフォルトが上書きされる）。**書込みはユーザー操作ハンドラのみ**。

## 検証環境

- devサーバは launch.json の `gaia-map-search`（port 3000）。`/`=Pair、/board=マップ、/setup=セットアップ、/manual=マニュアル。
- クラウドの作業環境では `npm run dev -- --port 3000` をバックグラウンドで起動し、Playwright（`node_modules` の `playwright`、
  実行ファイル `/opt/pw-browsers/chromium`）でヘッドレス確認する。スクリプトはリポジトリ直下に一時ファイルで置く
  （scratchpad からは `playwright` を解決できない）。
- 埋め込みブラウザで検索を動かすには rAFシム注入が必要:
  `window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16)`
  スクリーンショットはタイムアウトするため read_page / JS評価で検証する。
- **ユーザーに確認を依頼するときは、回答する前に devサーバを起動しておく**（毎回）。
- 埋め込みブラウザには**ピン留めマップ・保存セットアップが無い**。Pair の組の提案や
  Setup の保存リストは空状態しか再現できないので、実データ確認はユーザーに依頼する。
- 検索は件数を絞らないと埋め込みブラウザでは終わらない（30000→400程度）。ただし件数を
  絞ると制約を満たす結果が0件になることがある。結果が要るときは
  `/board?h=<placementToken>&t=<templateId>` で盤面を直接復元するのが速い
  （トークンは `encodePlacementToken(makeSearchPlacementFromSeed(...).placement)` で作れる）。
- 埋め込みブラウザのコンソールは**過去のビルドエラーを再生し続ける**ことがある。
  行番号が現在のファイルと合わない場合は無視してよい（tscが通っていれば実体は正常）。
- **狭い幅の見た目は本番で測る**。埋め込みブラウザを 375px にしても左ペインが 480px
  取れてしまい、本番の 375px とは別物になる（研究トラックの列幅が 73px と 52px で
  食い違った実績あり）。本番は https://gaia-project-map-search.vercel.app 。
- **「揃っているか」を測るときは、揃わない条件が実際に含まれているか先に確かめる**。
  手元のシードに「指定」バッジ付きのタイルが1枚も無く、高さのズレを見逃した実績あり。
- **Vercel のビルド完了は HTML の Etag では判定できない**。SSR の出力が同じだと6分
  待っても Etag が変わらないのに、バンドルは差し替わっている。ブラウザで実際の DOM を
  見て判定すること。

## Setup / Pair の構造（2026-07-30 に整理。List ＋ Total は 2026-10-17 に Pair へ。2026-10-22 に最新化）

- **画面**: `/` ＝ Pair（`src/components/PairView.tsx`）、`/board` ＝ Map、`/setup` ＝ Setup、`/manual` ＝ マニュアル。
  タブ順 Pair / Map / Setup / Manual。`/pair` `/list` `/total` は `/` へリダイレクト（共有 URL の引数は保持）。
- **3タブとも「条件プロファイル ＋ 条件ごとの結果バケツ」**で揃えてある。
  Map=`profiles`/`candidates`、Setup=`setup_profiles`/`setups`（＋順位 `setup_ranking`）、
  Pair=`list_profiles`＋ `pair_maps` / `pair_rows` / `pair_explored` / `pair_saved`（v2.3.0 で localStorage から移した）。
  共通部品は `src/lib/conditionProfiles.ts` と `src/components/ConditionProfilesPanel.tsx`。
- **条件プロファイルのキーは評価指数まで含む**が、**結果バケツのキーは
  セットアップの設定だけ**。生成される中身は評価指数に依存しないので、
  指数をいじっただけで貯めた結果が見えなくならないようにしてある。
- **Setup の条件指定はタイル/面のクリックに一本化**（`src/gaia/setup/tileRules.ts`）。
  固定/除外/候補/デフォルト。満たし方は「シャッフル済み配列の入れ替え」で構成的
  （シードを引き直す探索はしない）。既定の除外は `defaultAdvancedTileRules()`。
- **SETUP_CATALOG の配列順はシャッフルの入力**。並べ替えると全シードの出目が変わり、
  `buildSetup.test` の golden 値も変わる。順番は「似た挙動」でまとめてある。
- IndexedDB（`gaia_map_cache`）は **v11**（v11 で Pair の 4 ストアを追加）。**別タブが古い接続を握ると upgrade が止まる**ので、
  `openDb` に `onversionchange`（接続を手放す）と `onblocked`（即失敗）を入れてある。版を上げるときは移行の判定を必ず
  `oldVersion` で行う（`db.version` は upgrade 中「新しい方」を返す）。
- **探索プロファイル（2026-10-16、v1.8.0。段階 1「条件の統一」、設計ノート 1.4）**: `src/lib/searchProfiles.ts`（localStorage）が
  種族優遇＋Map の searchKey＋Setup の conditionKey を束ねる索引。**結果バケツの鍵は変えない**。共通バー直下の帯は
  `src/components/ConditionBar.tsx`（Map / Setup / Pair）。検索の実行でその側の条件を自動登録（`bindMapToActiveProfile` /
  `bindSetupToActiveProfile`）。優遇は種族優遇 1 つ: **Map は eval_v9（2026-10-17 ユーザー確定 3-(b)）から種族ごとの値に掛ける**
  （検索キーは `soft.wFactionPref` / `soft.factionPref`。eval_v8 までの色ごと `wColorPref` / `colorPrefByType` は廃止、既存の結果は
  保持しない）。Setup の検索と Pair は **2026-10-22（v2.4.0）から「上位 K（人数＋2、種族で数える）に届かない分だけ減点」**、
  係数 `FACTION_PREF_W` 0.2（`SETUP_FACTION_PREF_W` / `LIST_FACTION_PREF_W` は同じ値。`factionEval.factionPrefBonus`、実測は
  `scripts/_probe_faction_pref.ts`、設計ノート 1.10）。Map の検索は比例のまま（`wFactionPref` 25。同じ形にすると `EVAL_VERSION`）。旧 `gaia_setup_color_pref` / `gaia_list_faction_pref` は読まない。Setup の左ペインは Map と同じ 候補 / 詳細 / 条件（`gaia_setup_narrow_tab`）で、検索は
  `src/workers/setupSearch.worker.ts` ＋ `src/lib/setupSearchRunner.ts`（採点は `setupSearchCore.searchChunk` で共通）。
  確認事項 7 件は 2026-10-17 に全件確定（設計ノート 1.4 末尾）。
- **Pair タブ（2026-10-17、v1.9.0。段階 2、設計ノート 1.5）**: `src/components/PairView.tsx`（`/pair`）が旧 List ＋ Total。
  候補（組の提案＋候補一覧: 提案・保存した組・共有された組を 1 表に）/ 詳細（盤面・配置・`TotalTable.tsx` の種族別合計表）/ 条件
  （保存済み条件・評価指数・合算比）。狭い幅はタブ `gaia_pair_narrow_tab`。**基準 2・3 はマップの内訳があれば合計 T_f で測る**
  （`pairPlan.ts` `usesTotalBasis` / `totalScoresOf`、`recommendSetups` の `criterionScores`。内訳の無い旧候補は Setup の値）。既定の
  基準は 2 上位バランス。旧 List の提案ログは廃止、保存した組は旧キー `gaia_list_proposals_v2` を継承（v2.3.0 で IndexedDB へ移行）。
- **Pair がトップ、「両方を探索」（2026-10-17、v2.0.0。段階 3、設計ノート 1.6）**: `/` が Pair（`/pair` `/list` `/total` は `/` へ）。タブ順
  Pair / Map / Setup / Manual。「両方を探索」は探索プロファイルの Map 部 / Setup 部の条件で Map の検索（`runSearchOffThread`、件数は
  Map タブの `gaia_search_trials`）→ `src/lib/mapSearchSave.ts` で Map の結果バケツへ → Setup の検索（`runSetupSearch`、件数は
  `gaia_setup_bulk_trials`、既定 5000 / 上限 20000）→ `mergeRanking` → `src/lib/pairSearch.ts` `scorePairs`（Map 上位 K × Setup 上位 L、
  既定 20 × 20、上限 50、上位 10 組）。Map の件数は 30000 のまま（制約を通る盤面が 0.1〜0.2%。5000 では材料不足）。
  **運用**: 実装が終わったものは typecheck / lint / test ＋ ヘッドレス確認のうえ、プレビュー確認を待たずに本番へ FF push してよい
  （2026-10-17 ユーザー確認。作業ブランチの push と下書き PR は記録のために続ける）。
- **Pair の値の評価し直し、「連続で両方を探索」（2026-10-17、v2.1.0、設計ノート 1.7）**: Pair の Map の値は候補の条件プロファイルの
  `evalVersion` がいまと違えば **表示時にその候補の条件で評価し直す**（`src/lib/mapEvaluate.ts`。保存データは変えない）。候補に無い盤面も
  配置から評価する。合計表の「船」列（Setup タブの総合との差）は v2.2.0 で廃止。「連続で探索」は Map の検索 → 上位 K 枚ごとに Setup を 1 マップあたり
  N 件（既定 100000、`gaia_pair_setup_per_map`）**マップに合わせて採点**（`setupSearchCore.searchChunk` の `pairWith`。planPair と同じ式）
  → 上位 L 件を順位表（`src/lib/pairRanking.ts`）へ、を停止まで繰り返す（手順は v2.2.0 で作り直し、保存は v2.3.0 で IndexedDB へ。下）。
  Setup の候補には入れない。
- **v2.2.0（2026-10-17、設計ノート 1.8。ユーザー確定「すべて推奨」）**: 連続探索（マップ → セットアップ）は **既存の Map の候補の上位 K 枚の
  うち未探索のマップだけ** Setup を探索 → Map の検索 → 新たに入った未探索のマップだけ、の繰り返し（探索済みの件数は
  v2.3.0 から IndexedDB の `pair_explored`）。セットアップ → マップは起点のセットアップを固定して Map を探索し続け、制約を通った盤面を組として採点。
  **結果バケツは配置とスコアと小さな集計だけ保存**（`persistence.slimEvaluation`、1 盤面 4KB。内訳表・マーカー・Pair の種族ごとの値は
  盤面から再評価）、容量は Map タブの「保存数」（`gaia_map_capacity`、既定 1000）。ワーカーの返す上位は `SEARCH_RESULT_KEEP_MAX`（200）。
  候補一覧は全行をいまの基準で採点し直して順位で並べる（`pairScore.scorePairOf` が組の基準値の唯一の式）。「船」列は廃止（脚注だけ）。
- **v2.3.0（2026-10-17、設計ノート 1.9。ユーザー確定「推奨」）**: 候補一覧は **主**（マップ → セットアップならマップ、逆ならセットアップ）
  ごとに 1 行（最良の相手、「+n」）、詳細で別の相手を選ぶ（`groupPairRows`）。順位表は向きごと・主ごと上位 10 組・主 50 件。
  **Pair の保存は IndexedDB v11**（`src/lib/pairRanking.ts`: `pair_maps`（配置はトークンで 1 回、`played`）/ `pair_rows` / `pair_explored` /
  `pair_saved`。localStorage の旧鍵は起動時に 1 回だけ移行して消す）。**プレイ済み**: 詳細の「プレイ済みにする」→ マップは全バケツで
  使用済み（`setCandidatesUsedByHash`）＋ `pair_maps.played`、セットアップは Setup の候補に記録して使用済み。Pair は使用済みを
  選択肢・一覧・提案・連続探索から除く（「プレイ済みも表示」`gaia_pair_show_played`）。戻すのは Map / Setup タブの使用済み一覧。
  **v2.3.1**: Pair のマップの選択肢は **いまの `EVAL_VERSION` の結果バケツだけ**（旧バケツのピン留めは出ない）、選択肢の文字の記憶
  `gaia_list_pair_map_label` は廃止、「ピン解除」（`setCandidatesPinnedByHash`）。
- **v2.4.0（2026-10-22、設計ノート 1.10）**: 基準 2 上位バランスで「Map と Setup を合わせて最もバランスの取れた組が 1 位」になることを
  ユーザーが確認。種族優遇（Pair・Setup）を「上位 K に届かない分だけ減点」0.2 に（上の探索プロファイルの項）。**上位 K は種族で数える**
  （ユーザー確定。「合計の上位」の表示も `topFactions` に揃えた。それまでは色ごとに強い方だけ）。

## 描画とセル座標（2026-07-30 に整理）

- **グローバルなセル格子は再構成できない**。テンプレのスロット格子とセクタのセル格子は
  別系で、24通りの回転規則を総当たりしても盤面が成立しない（203セルに対し最良186）。
  したがって「素の軸座標 (q,r) から画面位置を出す」経路は当てにしない。
- **タイル画像の中のセル位置は測定で確定している**（`src/gaia/viewer/artworkCalib.ts`）。
  アートワークは「セル群の外接矩形でぴったり切り出した」画像で、格子の間隔と向きは
  画像クラスごとに一定。マーカーはこれを使ってタイル画像に直接定規を当てて置く。
  モデル側の外接計算（calcTilePixelBox / boxOff / scaleByAccepts）は経由しない。
- 較正値を測り直すときは
  `npx tsx scripts/dump_sector_cells.ts > /tmp/s.json && python scripts/measure_sector_artwork.py /tmp/s.json`
  （Pillow が要る）。出力の数値をそのまま artworkCalib.ts に入れる。
  検算は `src/gaia/viewer/artworkCalib.test.ts`（外接サイズ×pitch が PNG 実寸に一致するか）。
- `fixBaseLocalCoord` は `calcTilePixelBox` 用の旧仕様の補正。セクタ定義のローカル座標は
  既に正しい軸座標なので、**アートワーク基準の計算には掛けない**。

## 作業上の注意

- python でソースを書き換えるときは、絵文字やエスケープ列を新規に埋め込まない
  （`\ud83d` 等でサロゲート事故・NULバイト混入の実績あり）。既存行の移動に留め、
  文字を含む編集は Edit ツールを使う。
