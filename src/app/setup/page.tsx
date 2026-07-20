import React from "react";
import TabNav from "@/components/TabNav";
import SetupView from "@/components/SetupView";

export default function SetupPage() {
  return (
    <div style={{ width: "100%", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 12 }}>
        <TabNav active="setup" />
      </div>
      <SetupView />
    </div>
  );
}
