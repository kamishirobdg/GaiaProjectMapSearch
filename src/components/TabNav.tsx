// src/components/TabNav.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useIsNarrow } from "@/components/ui/layout";

/**
 * Top-level tab switcher shared by the tool's pages. Each tab is its own route
 * so the heavy map page and the setup page stay independent.
 * "Total" は 2026-08-04 に追加した種族別総合評価（Map と Setup の合算）。
 */
export type TabKey = "map" | "setup" | "pair" | "manual";

// "Manual" はアプリ内マニュアル（2026-10-16 ユーザー決定: 入口は共通バーのタブ）。
// "Pair" は旧 List ＋ Total（段階 2、2026-10-17）。段階 3（v2.0、同日）で先頭に移し、トップ `/` を Pair にした（ユーザー確定 D-(a)）。
const TABS: Array<{ key: TabKey; href: string; label: string }> = [
  { key: "pair", href: "/", label: "Pair" },
  { key: "map", href: "/board", label: "Map" },
  { key: "setup", href: "/setup", label: "Setup" },
  { key: "manual", href: "/manual", label: "Manual" },
];

export default function TabNav({ active }: { active: TabKey }) {
  // 狭い幅（480px 未満）はタブの余白 12 → 6px・文字 13 → 12px に詰める（2026-10-16 ユーザー確定 (a)）。
  // Manual を足して 5 タブになり、375px で「人数」が 2 行目へ落ちて共通バーが 3 行になっていたのを 2 行に戻す。
  const compact = useIsNarrow(480);
  return (
    <nav style={{ display: "flex", gap: compact ? 3 : 4, alignItems: "center" }}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            style={{
              padding: compact ? "4px 6px" : "4px 12px",
              fontSize: compact ? 12 : 13,
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
