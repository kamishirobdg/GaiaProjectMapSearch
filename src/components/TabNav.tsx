// src/components/TabNav.tsx
"use client";

import React from "react";
import Link from "next/link";

/**
 * Top-level tab switcher shared by the tool's pages. Each tab is its own route
 * so the heavy map page and the setup page stay independent; a future combined
 * "Total" tab slots in here as another route.
 */
export type TabKey = "map" | "setup";

const TABS: Array<{ key: TabKey; href: string; label: string }> = [
  { key: "map", href: "/board", label: "Map" },
  { key: "setup", href: "/setup", label: "Setup" },
];

export default function TabNav({ active }: { active: TabKey }) {
  return (
    <nav style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            style={{
              padding: "4px 12px",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 8,
              textDecoration: "none",
              border: "1px solid " + (isActive ? "#4453ff" : "#ccc"),
              background: isActive ? "#eef0ff" : "#fff",
              color: isActive ? "#2733cc" : "#333",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
