import React from "react";
import TotalView from "@/components/TotalView";

// タブナビ・人数・拡張・言語は TotalView 内の GlobalBar が担う（全タブ共通の
// 固定位置に置くため、ページ側では TabNav を出さない）。
export default function TotalPage() {
  return (
    <div style={{ width: "100%", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <TotalView />
    </div>
  );
}
