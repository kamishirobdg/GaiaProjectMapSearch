# GaiaProjectMapSearch 作業ルール

詳細は README.md（仕組み・座標系・スナップショット運用）と docs/ の各仕様書、
残タスクは TODO.md を参照。

## 進めかた

- 機能ブランチ → 1修正=1コミット → `release/v1.01` へ FFマージ。
- **ブランチ作成前に必ず `cd /c/work/GaiaProjectMapSearch && pwd` でCWD確認**
  （シェルCWDが C:\work に戻り、外側リポジトリに迷いブランチを作る事故が複数回発生）。
- 毎コミット: `npm run typecheck`（0件）/ `npm run lint`（エラー0）/ `npm test`（全緑）。
- `git push` は Vercelデプロイを意味する。**指示があるまで push しない**。
- 挙動が変わる仕様は、実装前に選択肢を提示して確定してから着手。

## 互換の鉄則

- 検索条件キー・保存データのキーは「**無効時フィールド省略**」のスプレッド構築
  （`...(x > 0 ? { x } : {})`）。新設定も同じ形にし、既存キーをバイト不変に保つ。
- LFテンプレの regression snapshot（`scripts/__snapshots__/baseline.json`）は
  意図した差分以外を出さない。更新は `npm run snapshot:update` → 差分目視 → 同一コミット。
- localStorage は「復元effect＋書込みeffect」を併用しない（Strict Mode二重実行で
  復元前デフォルトが上書きされる）。**書込みはユーザー操作ハンドラのみ**。

## 検証環境

- devサーバは launch.json の `gaia-map-search`（port 3000）。/board=マップ、/setup=セットアップ。
- 埋め込みブラウザで検索を動かすには rAFシム注入が必要:
  `window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16)`
  スクリーンショットはタイムアウトするため read_page / JS評価で検証する。
- **ユーザーに確認を依頼するときは、回答する前に devサーバを起動しておく**（毎回）。
- 埋め込みブラウザには**ピン留めマップ・保存セットアップが無い**。List のセット提案や
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

## Setup/List の構造（2026-07-30 に整理）

- **3タブとも「条件プロファイル ＋ 条件ごとの結果バケツ」**で揃えてある。
  Map=`profiles`/`candidates`、Setup=`setup_profiles`/`setups`、
  List=`list_profiles`＋localStorage。共通部品は `src/lib/conditionProfiles.ts` と
  `src/components/ConditionProfilesPanel.tsx`。
- **条件プロファイルのキーは評価指数まで含む**が、**結果バケツのキーは
  セットアップの設定だけ**。生成される中身は評価指数に依存しないので、
  指数をいじっただけで貯めた結果が見えなくならないようにしてある。
- **Setup の条件指定はタイル/面のクリックに一本化**（`src/gaia/setup/tileRules.ts`）。
  固定/除外/候補/デフォルト。満たし方は「シャッフル済み配列の入れ替え」で構成的
  （シードを引き直す探索はしない）。既定の除外は `defaultAdvancedTileRules()`。
- **SETUP_CATALOG の配列順はシャッフルの入力**。並べ替えると全シードの出目が変わり、
  `buildSetup.test` の golden 値も変わる。順番は「似た挙動」でまとめてある。
- IndexedDB は v6。**別タブが古い接続を握ると upgrade が止まる**ので、
  `openDb` に `onversionchange`（接続を手放す）と `onblocked`（即失敗）を入れてある。

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
