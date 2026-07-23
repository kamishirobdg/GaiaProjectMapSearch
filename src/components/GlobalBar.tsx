// src/components/GlobalBar.tsx
"use client";

// Map / Setup / List 共通の最上部バー（2026-07-24）。
// タブ切替・人数・拡張有無・言語を「常に同じ位置」に置くことで、タブを
// 移動しても検索に効く設定（人数/拡張）の表示位置がズレないようにする。
// 各ページは自分の状態と副作用を onSelect / onLang で受け取る（共有 localStorage
// への書き込みは各ページのハンドラ側で行う。ここは表示と入力のみ）。

import React from "react";
import TabNav, { type TabKey } from "@/components/TabNav";
import type { Expansion } from "@/lib/sharedSettings";

type Lang = "ja" | "en";

const L = {
  ja: { players: "人数", base: "基本版", lf: "Lost Fleet" },
  en: { players: "Players", base: "Base game", lf: "Lost Fleet" },
} as const;

export default function GlobalBar({
  active,
  players,
  expansion,
  onSelect,
  lang,
  onLang,
}: {
  active: TabKey;
  players: number;
  expansion: Expansion;
  onSelect: (players: number, expansion: Expansion) => void;
  lang: Lang;
  onLang: (l: Lang) => void;
}) {
  const t = L[lang];
  return (
    <div
      style={{
        padding: "8px 12px",
        display: "flex",
        gap: 16,
        alignItems: "center",
        flexWrap: "wrap",
        borderBottom: "1px solid #eee",
      }}
    >
      <TabNav active={active} />

      <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
        <span>{t.players}</span>
        <select value={players} onChange={(e) => onSelect(Number(e.target.value), expansion)}>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
        <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            type="radio"
            name="globalExpansion"
            checked={expansion === "base"}
            onChange={() => onSelect(players, "base")}
          />
          <span>{t.base}</span>
        </label>
        <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            type="radio"
            name="globalExpansion"
            checked={expansion === "lostFleet"}
            onChange={() => onSelect(players, "lostFleet")}
          />
          <span>{t.lf}</span>
        </label>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto", fontSize: 12 }}>
        <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input type="radio" name="globalLang" checked={lang === "en"} onChange={() => onLang("en")} />
          EN
        </label>
        <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input type="radio" name="globalLang" checked={lang === "ja"} onChange={() => onLang("ja")} />
          日本語
        </label>
      </div>
    </div>
  );
}
