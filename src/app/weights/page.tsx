import React from "react";
import WeightsEditor from "@/components/WeightsEditor";

// 重み CSV の編集ページ（2026-08-06）。値の入力を Android から進めるための道具で、
// 評価ツール本体の画面ではないので TabNav には出さない（/weights を直接開く）。
export default function WeightsPage() {
  return <WeightsEditor />;
}
