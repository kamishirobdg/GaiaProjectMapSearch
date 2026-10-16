import React from "react";
import ManualView from "@/components/ManualView";

// アプリ内マニュアル（2026-10-16）。タブナビ・人数・拡張・言語は ManualView 内の GlobalBar が担う。
export default function ManualPage() {
  return (
    <div style={{ width: "100%", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <ManualView />
    </div>
  );
}
