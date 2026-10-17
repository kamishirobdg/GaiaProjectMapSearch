import React from "react";
import PairView from "@/components/PairView";

// トップは Pair（段階 3、2026-10-17 ユーザー確定 D-(a)）。タブナビ・人数・拡張・言語は PairView 内の GlobalBar が担う。
export default function HomePage() {
  return (
    <div style={{ width: "100%", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <PairView />
    </div>
  );
}
