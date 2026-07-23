import React from "react";
import ListView from "@/components/ListView";

// タブナビ・人数・拡張・言語は ListView 内の GlobalBar が担う（全タブ共通の
// 固定位置に置くため、ページ側では TabNav を出さない）。
export default function ListPage() {
  return (
    <div style={{ width: "100%", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <ListView />
    </div>
  );
}
