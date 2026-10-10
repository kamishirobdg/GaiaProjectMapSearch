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
import { APP_VERSION_LABEL } from "@/lib/appVersion";

type Lang = "ja" | "en";

/** 押し込み式の 2 択（ラジオの代わり。幅を取らない）。選択中は TabNav と同じ青 */
function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} style={{ display: "inline-flex", border: "1px solid #ccc", borderRadius: 8, overflow: "hidden" }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            style={{
              padding: "3px 9px",
              fontSize: 12,
              fontWeight: 700,
              border: "none",
              borderLeft: o === options[0] ? "none" : "1px solid #ccc",
              background: on ? "#eef0ff" : "#fff",
              color: on ? "#2733cc" : "#555",
              cursor: on ? "default" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const L = {
  ja: {
    players: "人数",
    base: "基本版",
    lf: "LF",
    versionTip: "アプリの版と、Map 評価のバージョン（評価の意味が変わると上がる。検索結果はバージョンごとに別に貯まる）",
  },
  en: {
    players: "Players",
    base: "Base game",
    lf: "LF",
    versionTip: "App version and the map-evaluation version (bumped whenever the meaning of the evaluation changes; results are stored per version)",
  },
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
        gap: 12,
        rowGap: 6,
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

      {/* 拡張と言語は押し込み式の 2 択ボタン（2026-10-10。ラジオ 2 組だと 375px で 2 行に割れていた）。
          版と合わせて 1 つのグループにし、狭い幅ではグループごと 2 行目へ折り返す */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginLeft: "auto", flexWrap: "nowrap" }}>
        <Segmented
          name="globalExpansion"
          value={expansion}
          options={[
            { value: "base", label: t.base },
            { value: "lostFleet", label: t.lf },
          ]}
          onChange={(v) => onSelect(players, v)}
        />
        <Segmented
          name="globalLang"
          value={lang}
          options={[
            { value: "ja", label: "日本語" },
            { value: "en", label: "EN" },
          ]}
          onChange={(v) => onLang(v)}
        />
        {/* 版の表示（2026-10-05）。本番にどの版が出ているかを画面で判定できるようにする */}
        <span
          data-app-version={APP_VERSION_LABEL}
          title={t.versionTip}
          style={{ fontSize: 11, opacity: 0.55, whiteSpace: "nowrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
        >
          {APP_VERSION_LABEL}
        </span>
      </div>
    </div>
  );
}
