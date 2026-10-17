import React from "react";
import PairView from "@/components/PairView";

// Pair タブ（段階 2、2026-10-17。旧 List ＋ Total）。タブナビ・人数・拡張・言語は PairView 内の GlobalBar が担う。
export default function PairPage() {
  return (
    <div style={{ width: "100%", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <PairView />
    </div>
  );
}
