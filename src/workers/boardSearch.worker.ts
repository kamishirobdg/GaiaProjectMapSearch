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
  stopSAB: SharedArrayBuffer;
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
  stopFlag = new Int32Array(stopSAB);
  setStopRequested(0);

  try {
    const { results: best, diagnostics } = await runLogicalSearch(
      templateId,
      searchOptions,
      (done: number, bestNow: any[]) => {
        if (isStopRequested()) throw new Error("__STOP__");

        const bestScore =
          bestNow && bestNow.length > 0
            ? Number((bestNow[0] as any).score ?? (bestNow[0] as any).total ?? 0)
            : null;

        (self as any).postMessage({ type: "progress", runId, done, bestScore });

        // Stop can also be respected right after posting progress.
        if (isStopRequested()) throw new Error("__STOP__");
      }
    );

    if (isStopRequested()) {
      (self as any).postMessage({ type: "stopped", runId });
      return;
    }

    (self as any).postMessage({ type: "done", runId, best, diagnostics });
  } catch (e: any) {
    if (String(e?.message) === "__STOP__") {
      (self as any).postMessage({ type: "stopped", runId });
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
