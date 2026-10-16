// src/lib/setupSearchRunner.ts
//
// Setup の検索（旧 一括探索）の実行ランナー（段階 1「条件の統一」2026-10-16）。Map の searchRunner と同じ作法:
// ワーカー優先（SharedArrayBuffer があれば停止はフラグ、無ければ terminate ＋ 直近の snapshot）、ワーカーが
// 使えない環境ではメインスレッドで 250 件ごとに明け渡しながら回す。どの経路でも採点は同じ関数（searchChunk）。
//
// NOTE: ワーカーの URL は new URL("../workers/...", import.meta.url) 規約（Turbopack がこの形で見つける）。
// このファイルの深さ（src/lib/）を変えるときは相対パスも直す。

import { searchChunk, SETUP_SEARCH_CHUNK, type SetupSearchArgs, type SetupSearchHit } from "@/lib/setupSearchCore";

export type { SetupSearchArgs, SetupSearchHit } from "@/lib/setupSearchCore";

export type SetupSearchRunMode = "worker" | "worker-nosab" | "main";

export type SetupSearchRunResult = {
  results: SetupSearchHit[];
  /** 停止ボタンで中断した（results は途中の上位） */
  stopped: boolean;
  mode: SetupSearchRunMode;
};

export type SetupSearchHandlers = {
  onProgress: (done: number, total: number, bestScore: number | null) => void;
  onMode?: (mode: SetupSearchRunMode) => void;
  /** 停止関数を受け取る（停止ボタン用） */
  onStopHandle?: (stop: () => void) => void;
};

function runInWorker(args: SetupSearchArgs, h: SetupSearchHandlers): Promise<SetupSearchRunResult> {
  return new Promise((resolve, reject) => {
    if (typeof Worker === "undefined") {
      reject(new Error("Worker is not available in this environment"));
      return;
    }
    let stopSAB: SharedArrayBuffer | null = null;
    let worker: Worker;
    try {
      if (typeof SharedArrayBuffer !== "undefined") {
        try {
          stopSAB = new SharedArrayBuffer(4);
        } catch {
          stopSAB = null;
        }
      }
      worker = new Worker(new URL("../workers/setupSearch.worker.ts", import.meta.url), { type: "module" });
    } catch (e) {
      reject(e);
      return;
    }
    const mode: SetupSearchRunMode = stopSAB ? "worker" : "worker-nosab";
    h.onMode?.(mode);
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let settled = false;
    let lastSnapshot: SetupSearchHit[] = [];
    const stopFlag = stopSAB ? new Int32Array(stopSAB) : null;
    const cleanup = () => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    };
    h.onStopHandle?.(() => {
      if (settled) return;
      if (stopFlag) {
        Atomics.store(stopFlag, 0, 1);
        try {
          worker.postMessage({ type: "stop", runId });
        } catch {}
        return;
      }
      settled = true;
      cleanup();
      resolve({ results: lastSnapshot, stopped: true, mode });
    });
    worker.onmessage = (ev: MessageEvent<any>) => {
      const msg = ev.data;
      if (!msg || msg.runId !== runId || settled) return;
      if (msg.type === "progress") {
        h.onProgress(Number(msg.done ?? 0), args.seeds.length, msg.bestScore == null ? null : Number(msg.bestScore));
        return;
      }
      if (msg.type === "snapshot") {
        if (Array.isArray(msg.best)) lastSnapshot = msg.best;
        return;
      }
      if (msg.type === "done" || msg.type === "stopped") {
        settled = true;
        cleanup();
        resolve({ results: Array.isArray(msg.best) ? msg.best : [], stopped: msg.type === "stopped", mode });
        return;
      }
      if (msg.type === "error") {
        settled = true;
        cleanup();
        reject(new Error(String(msg.message ?? "setup search worker error")));
      }
    };
    worker.onerror = (e) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(e instanceof ErrorEvent ? e.error ?? new Error(e.message) : new Error("setup search worker failed"));
    };
    worker.postMessage({ type: "start", runId, args, stopSAB });
  });
}

function runOnMainThread(args: SetupSearchArgs, h: SetupSearchHandlers): Promise<SetupSearchRunResult> {
  h.onMode?.("main");
  return new Promise((resolve) => {
    let stopRequested = false;
    h.onStopHandle?.(() => {
      stopRequested = true;
    });
    const step = (from: number, acc: SetupSearchHit[]) => {
      if (stopRequested || from >= args.seeds.length) {
        resolve({ results: acc, stopped: stopRequested && from < args.seeds.length, mode: "main" });
        return;
      }
      const next = searchChunk(args, args.seeds.slice(from, from + SETUP_SEARCH_CHUNK), acc);
      const done = Math.min(args.seeds.length, from + SETUP_SEARCH_CHUNK);
      h.onProgress(done, args.seeds.length, next[0]?.score ?? null);
      setTimeout(() => step(done, next), 0);
    };
    step(0, []);
  });
}

/** ワーカー優先、駄目ならメインスレッド。 */
export async function runSetupSearch(args: SetupSearchArgs, h: SetupSearchHandlers): Promise<SetupSearchRunResult> {
  try {
    return await runInWorker(args, h);
  } catch {
    return runOnMainThread(args, h);
  }
}
