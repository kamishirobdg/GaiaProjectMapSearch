/* eslint-disable no-restricted-globals */
/**
 * Setup の検索（旧 一括探索）のワーカー（段階 1「条件の統一」2026-10-16。Map の boardSearch.worker と同じ作法）。
 *
 * いまの条件で seeds を生成・採点し、基準の良い順に上位 topN 件を返す。チャンク（250 件）ごとに progress を送り、
 * 4 チャンク（1000 件）ごとに途中の上位の写し（snapshot）を送る。停止は SharedArrayBuffer のフラグ
 * （cross-origin isolation が無い端末では null。そのときは呼び出し側が terminate して直近の snapshot を使う）。
 *
 * 採点は src/lib/setupSearchCore の searchChunk（メインスレッドの fallback と同じ関数）なので、
 * 同じ seeds・条件なら経路によらず同じ結果になる。
 */

import { searchChunk, SETUP_SEARCH_CHUNK, type SetupSearchArgs, type SetupSearchHit } from "@/lib/setupSearchCore";

type StartMsg = { type: "start"; runId: string; args: SetupSearchArgs; stopSAB: SharedArrayBuffer | null };
type StopMsg = { type: "stop"; runId: string };

let currentRunId: string | null = null;
let stopFlag: Int32Array | null = null;

function isStopRequested(): boolean {
  return stopFlag ? Atomics.load(stopFlag, 0) === 1 : false;
}


self.onmessage = (ev: MessageEvent<StartMsg | StopMsg>) => {
  const msg = ev.data as any;
  if (msg?.type === "stop") {
    if (currentRunId === msg.runId && stopFlag) Atomics.store(stopFlag, 0, 1);
    return;
  }
  if (msg?.type !== "start") return;
  const { runId, args, stopSAB } = msg as StartMsg;
  currentRunId = runId;
  stopFlag = stopSAB ? new Int32Array(stopSAB) : null;
  if (stopFlag) Atomics.store(stopFlag, 0, 0);

  let acc: SetupSearchHit[] = [];
  let chunks = 0;
  try {
    for (let from = 0; from < args.seeds.length; from += SETUP_SEARCH_CHUNK) {
      if (isStopRequested()) {
        (self as any).postMessage({ type: "stopped", runId, best: acc, done: from });
        return;
      }
      acc = searchChunk(args, args.seeds.slice(from, from + SETUP_SEARCH_CHUNK), acc);
      const done = Math.min(args.seeds.length, from + SETUP_SEARCH_CHUNK);
      (self as any).postMessage({ type: "progress", runId, done, bestScore: acc[0]?.score ?? null });
      if (++chunks % 4 === 0) (self as any).postMessage({ type: "snapshot", runId, done, best: acc });
    }
    (self as any).postMessage({ type: "done", runId, best: acc });
  } catch (e) {
    (self as any).postMessage({ type: "error", runId, message: String((e as any)?.message ?? e) });
  }
};
