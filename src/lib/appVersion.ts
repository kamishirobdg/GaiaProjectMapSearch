// src/lib/appVersion.ts
//
// アプリの版（2026-10-05 ユーザー確定: 案B）。正本は package.json の version で、本番へ出すたびに
// 同じ番号の git タグ（v1.2.1 など）を main に打つ。画面の共通バー（GlobalBar）の右端に
// 「v1.2.1 · eval_v4」の形で出す —— 本番にどの版が配備されているかを DOM で判定できるようにし
// （HANDOFF「Vercel のビルド完了は Etag では判定できない」）、評価バージョンとの対応も一目で付ける。
//
// 番号の付け方: 評価の意味が変わる変更（EVAL_VERSION が上がる）や機能追加で2桁目を上げ、
// 表示やドキュメントだけなら3桁目を上げる。ブランチ名 release/v1.01 は「リリース用の線」の名前で、
// 版とは独立に使い続ける。

import pkg from "../../package.json";
import { EVAL_VERSION } from "@/app/board/persistence";

export const APP_VERSION: string = String(pkg.version ?? "");

/** 画面に出す1行（例「v1.2.1 · eval_v4」） */
export const APP_VERSION_LABEL = `v${APP_VERSION} · ${EVAL_VERSION}`;
