/* eslint-disable no-restricted-globals */
/**
 * WebWorker for board logical search.
 * Robust stop support via SharedArrayBuffer + Atomics.
 *
 * NOTE: Import path matches the main page.tsx:
 *   import { runSearch as runLogicalSearch } from "@/gaia/search";
 */

import { runSearch as runLogicalSearch } from "@/gaia/search";

type StartMsg = {
  type: "start";
  runId: string;
  templateId: string;
  searchOptions: any;
  /** 停止フラグ。cross-origin isolation が無く SharedArrayBuffer を作れない端末では null（停止は terminate で） */
  stopSAB: SharedArrayBuffer | null;
};

type StopMsg = { type: "stop"; runId: string };

let currentRunId: string | null = null;
let stopFlag: Int32Array | null = null;

function setStopRequested(v: 0 | 1) {
  if (stopFlag) Atomics.store(stopFlag, 0, v);
}
function isStopRequested(): boolean {
  return stopFlag ? Atomics.load(stopFlag, 0) === 1 : false;
}

self.onmessage = async (ev: MessageEvent<StartMsg | StopMsg>) => {
  const msg = ev.data as any;

  if (msg?.type === "stop") {
    if (currentRunId === msg.runId) setStopRequested(1);
    return;
  }

  if (msg?.type !== "start") return;

  const { runId, templateId, searchOptions, stopSAB } = msg as StartMsg;

  currentRunId = runId;
  stopFlag = stopSAB ? new Int32Array(stopSAB) : null;
  setStopRequested(0);
  let progressCount = 0;

  // 停止時に返す途中結果（進捗ごとの best を控えておく。2026-10-10 即時停止＝案 (a)）
  let lastBest: any[] = [];
  try {
    const { results: best, diagnostics } = await runLogicalSearch(
      templateId,
      searchOptions,
      (done: number, bestNow: any[]) => {
        lastBest = Array.isArray(bestNow) ? bestNow : lastBest;
        if (isStopRequested()) throw new Error("__STOP__");

        const bestScore =
          bestNow && bestNow.length > 0
            ? Number((bestNow[0] as any).score ?? (bestNow[0] as any).total ?? 0)
            : null;

        (self as any).postMessage({ type: "progress", runId, done, bestScore });
        // 10 回に 1 回（yieldEvery 50 なら 500 件ごと）途中結果の写しを送る。停止フラグが使えない端末では
        // 呼び出し側がワーカーを terminate して、この写しを途中結果として使う（2026-10-11）
        if (++progressCount % 10 === 0) (self as any).postMessage({ type: "snapshot", runId, done, best: lastBest });

        // Stop can also be respected right after posting progress.
        if (isStopRequested()) throw new Error("__STOP__");
      }
    );

    if (isStopRequested()) {
      (self as any).postMessage({ type: "stopped", runId, best: lastBest });
      return;
    }

    (self as any).postMessage({ type: "done", runId, best, diagnostics });
  } catch (e: any) {
    if (String(e?.message) === "__STOP__") {
      // 途中結果（そこまでに評価した候補）を返す
      (self as any).postMessage({ type: "stopped", runId, best: lastBest });
      return;
    }
    (self as any).postMessage({
      type: "error",
      runId,
      message: String(e?.message ?? e),
      stack: String(e?.stack ?? ""),
    });
  } finally {
    currentRunId = null;
    stopFlag = null;
  }
};
