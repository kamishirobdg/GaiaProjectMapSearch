// src/lib/useSharedTopK.ts
//
// 上位 K（共有設定、2026-10-27）を React から読む。復元は mount 時の 1 回と、帯の入力欄が投げるイベント
// （同じタブ）・storage イベント（別タブ）。書き込みは writeSharedTopK（ユーザー操作のハンドラ）だけ。
"use client";

import React from "react";
import { readSharedTopK, SHARED_TOP_K_EVENT } from "@/lib/sharedSettings";

export function useSharedTopK(): number | null {
  const [topK, setTopK] = React.useState<number | null>(null);
  React.useEffect(() => {
    const sync = () => setTopK(readSharedTopK());
    sync();
    window.addEventListener(SHARED_TOP_K_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SHARED_TOP_K_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return topK;
}
