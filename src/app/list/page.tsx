import React from "react";
import TabNav from "@/components/TabNav";
import ListView from "@/components/ListView";

export default function ListPage() {
  return (
    <div style={{ width: "100%", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 12 }}>
        <TabNav active="list" />
      </div>
      <ListView />
    </div>
  );
}
