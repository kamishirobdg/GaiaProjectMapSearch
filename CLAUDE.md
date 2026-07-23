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
- /setup の確認を依頼するときは devサーバを起動した状態にしておく。
