# HANDOFF

最終更新: 2026-08-09。次セッションはここから読む（詳細はTODO.md）。

## 現在地

- ブランチ: `release/v1.01`。未コミット変更なし。
- 直近コミット: `ed3a3bf`（拡張版の上級技術に「25点」「3船」軸を追加）。
- **origin/release/v1.01 へは push 済み**。ただし**origin/main へは未反映
  （4コミット遅れ）**。本番Vercelはmainブランチなので、**まだ本番には出ていない**。
  本番へ出すには `git push origin release/v1.01:main`（FFで通る）。
  実行前に必ずユーザーへ確認すること。

## このセッションでやったこと

1. `/weights`ページでスマホから入力した差分403件（advanced_tech base/lf、
   tech_position base）をCSVへ反映（`apply_weight_edits.py`）。
2. 上級技術のアクション3枚（AT03/07/13）を「起動4回・資源レート倍(知識除く)」で
   再計算（AT03: 15→32 / AT07: 13→28 / AT13: 18→22）。影響力は上級24.3%が
   LF船15.2%を上回ったが、CLAUDE.mdの方針どおり係数調整はしていない。
3. `WeightsEditor.tsx`の「全消去」を2段階確認（アーム→4秒以内に再タップ）に変更。
   「全コピー」ボタンを新設（拡張版タブで、通常版の値を共通種族へ複製。拡張種族は対象外）。
4. 拡張版の上級技術21タイルに「25点」「3船」軸を追加（得点ボード拡張部の面ごとの
   評価。`ExtensionFace`型、`advancedTechExtensionCell`が面を受け取れるように）。
   **初期値は暫定で旧来の「6列最大値」と同じ**なので、この変更単体では評価点は
   変わっていない。実際の面ごとの見直しは未着手。
5. `GaiaSetupScanner`という**別リポジトリ**（`C:\work\GaiaSetupScanner`、
   ローカル専用・非公開）を切り出した。盤面写真からタイル配置を読み取って評価する
   機能の実験用。**このリポジトリの作業には影響しない**（評価ロジックをvendorで
   コピーしているだけ）。詳細はそちら側の`docs/SPEC.md`を参照（このリポジトリの
   TODO.md/HANDOFF.mdでは追跡しない）。

各コミットで typecheck 0件 / lint 0エラー / test 302件全緑を確認済み。

## 残タスク（優先順）

1. **origin/main への反映をどうするか、ユーザーに確認**（上記「現在地」参照）。
2. 「25点」「3船」の実際の値のレビュー（現状は6列最大値のコピーで仮置き）。
   `data/weights/advanced_tech_lf.csv`の`vp25`/`shuttle`行、または`/weights`
   ページから入力できる。
3. TODO.mdの「要フィードバック」にある他の値入力待ち項目（`TECH_POSITION_WEIGHTS_LF`
   の拡張種族ぶん、`TS7`のlantids、ラウンド得点表のラウンド差など）は今回未着手。

## 環境の注意

- 起動: `npm run dev`（port 3000）。検証は `npm run typecheck` / `npm run lint`
  / `npm test`。
- **CWD確認を毎回**: `cd /c/work/GaiaProjectMapSearch && pwd`。似た名前の
  `C:\work\GaiaSetupScanner`が新設されたので、なおさら取り違えに注意。
- `data/weights/*.csv`が正本、`src/gaia/eval/*.ts`は自動生成物（手で編集しない）。
  手順は`data/weights/README.md`。
- `git push`は指示があるまでしない（`release/v1.01`単独pushは既に許可されているが、
  **`:main`へのFFマージ＝本番デプロイは別途都度確認**）。
