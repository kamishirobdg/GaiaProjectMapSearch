// src/components/TabNav.tsx
"use client";

import React from "react";
import Link from "next/link";

/**
 * Top-level tab switcher shared by the tool's pages. Each tab is its own route
 * so the heavy map page and the setup page stay independent.
 * "Total" は 2026-08-04 に追加した種族別総合評価（Map と Setup の合算）。
 */
export type TabKey = "map" | "setup" | "list" | "total";

const TABS: Array<{ key: TabKey; href: string; label: string }> = [
  { key: "map", href: "/board", label: "Map" },
  { key: "setup", href: "/setup", label: "Setup" },
  { key: "list", href: "/list", label: "List" },
  { key: "total", href: "/total", label: "Total" },
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
