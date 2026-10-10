// src/app/board/searchRunner.ts
//
// /board の検索実行ランナー（Worker優先＋メインスレッドfallback）。
// page.tsx から抽出（2026-07-23 コンテキスト効率化、挙動不変）。
// NOTE: Worker URL は new URL("../../workers/...", import.meta.url) 規約のため
// このファイルは src/app/board/ 直下に置くこと（相対深度を変えない）。

import { runSearch as runLogicalSearch } from "@/gaia/search";

/**
 * Runs the logical search (src/gaia/search.ts runSearch) inside
 * src/workers/boardSearch.worker.ts so the main thread stays responsive
 * (scrolling, panel toggles, etc. keep working while a search is in flight).
 *
 * The worker's `searchOptions` payload and progress semantics are identical
 * to a direct `runLogicalSearch(templateId, searchOptions, onProgress)` call:
 * the worker imports the very same `runSearch` and forwards its `results`/
 * `diagnostics` back verbatim via the "done" message, so results for a given
 * seedStart + params are bit-for-bit identical whether run in-worker or
 * in-thread.
 *
 * Rejects (instead of resolving) whenever the worker cannot be used at all
 * (Worker/SharedArrayBuffer unavailable, worker script failed to load, or the
 * worker itself reported an "error"/unexpected "stopped" message) so the
 * caller (`runSearchOffThread`) can fall back to the main-thread search.
 */
export type SearchRunResult = {
  results: any[];
  diagnostics: any;
  /** 停止ボタンで中断した（results は途中結果、diagnostics は null）。2026-10-10 */
  stopped?: boolean;
};

export function runSearchInWorker(
  templateId: string,
  searchOptions: any,
  onProgress: (done: number, bestScore: number | null) => void,
  /** 呼び出し側が停止関数を受け取る（停止ボタン用）。省略時は従来どおり止められない */
  onStopHandle?: (stop: () => void) => void
): Promise<SearchRunResult> {
  return new Promise((resolve, reject) => {
    if (typeof Worker === "undefined" || typeof SharedArrayBuffer === "undefined") {
      reject(new Error("Worker or SharedArrayBuffer is not available in this environment"));
      return;
    }

    let worker: Worker;
    let stopSAB: SharedArrayBuffer;
    try {
      stopSAB = new SharedArrayBuffer(4);
      // Next.js/Turbopack worker convention: a `new URL(..., import.meta.url)`
      // argument lets the bundler discover and bundle the worker file.
      worker = new Worker(new URL("../../workers/boardSearch.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch (e) {
      reject(e);
      return;
    }

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let settled = false;
    // 即時停止（2026-10-10 ユーザー確定 案 (a)）: 共有メモリのフラグを立て、念のため stop メッセージも送る。
    // ワーカーは進捗の区切り（yieldEvery 件ごと）で止まり、途中結果を "stopped" で返す
    const stopFlag = new Int32Array(stopSAB);
    onStopHandle?.(() => {
      if (settled) return;
      Atomics.store(stopFlag, 0, 1);
      try {
        worker.postMessage({ type: "stop", runId });
      } catch {}
    });

    const cleanup = () => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    };

    worker.onmessage = (ev: MessageEvent<any>) => {
      const msg = ev.data;
      if (!msg || msg.runId !== runId || settled) return;

      if (msg.type === "progress") {
        const bestScore = msg.bestScore == null ? null : Number(msg.bestScore);
        onProgress(Number(msg.done ?? 0), bestScore);
        return;
      }

      if (msg.type === "done") {
        settled = true;
        cleanup();
        resolve({ results: msg.best ?? [], diagnostics: msg.diagnostics });
        return;
      }

      if (msg.type === "error") {
        settled = true;
        cleanup();
        reject(new Error(String(msg.message ?? "worker search error")));
        return;
      }

      // 停止ボタンによる中断。途中結果を正常終了として返す（diagnostics は無い）
      if (msg.type === "stopped") {
        settled = true;
        cleanup();
        resolve({ results: Array.isArray(msg.best) ? msg.best : [], diagnostics: null, stopped: true });
        return;
      }
    };

    worker.onerror = (ev: ErrorEvent) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(ev?.message || "worker error"));
    };

    worker.postMessage({
      type: "start",
      runId,
      templateId,
      searchOptions,
      stopSAB,
    });
  });
}

/**
 * Preferred entry point for running the logical search: tries the Worker
 * path first, and if that's unavailable or fails for any reason, falls back
 * to the exact same main-thread `runLogicalSearch` call that this codebase
 * used before worker support was wired up. This guarantees search behavior
 * is never worse than before this change, even in environments where Workers
 * or SharedArrayBuffer aren't usable (e.g. missing COOP/COEP isolation).
 */
export async function runSearchOffThread(
  templateId: string,
  searchOptions: any,
  onProgress: (done: number, bestScore: number | null) => void,
  onStopHandle?: (stop: () => void) => void
): Promise<SearchRunResult> {
  try {
    return await runSearchInWorker(templateId, searchOptions, onProgress, onStopHandle);
  } catch (e) {
    console.warn("[board] Worker search unavailable, falling back to main-thread search:", e);
    // メインスレッドの fallback でも停止できるように、進捗の区切りで例外を投げて途中結果を返す
    let stopRequested = false;
    let lastBest: any[] = [];
    onStopHandle?.(() => {
      stopRequested = true;
    });
    try {
      return await runLogicalSearch(templateId, searchOptions, (done: number, bestNow: any[]) => {
        lastBest = Array.isArray(bestNow) ? bestNow : lastBest;
        const bestScore =
          bestNow && bestNow.length > 0 ? Number((bestNow[0] as any).score ?? (bestNow[0] as any).total ?? 0) : null;
        onProgress(done, bestScore);
        if (stopRequested) throw new Error("__STOP__");
      });
    } catch (e2: any) {
      if (String(e2?.message) === "__STOP__") return { results: lastBest, diagnostics: null, stopped: true };
      throw e2;
    }
  }
}
