// src/components/ui/layout.tsx
// 3ページ（Map/Setup/List）で共通のデザイントークンとレイアウト部品（2026-07-25）。
//
// 統一方針:
//   - どのページも「左=操作・条件（狭いカラム）／右=結果（広いカラム）」の2カラム。
//   - セクションの枠・見出し・余白・角丸はここのトークンに集約し、各ページで
//     個別に style を書かない（見た目のばらつきの発生源を1箇所にする）。
//   - 狭い画面では flexWrap で縦積みに落ちる（Map の全画面レイアウトのみ例外的に
//     内部スクロールを持つので、そちらは既存の isNarrow 分岐を維持する）。
"use client";

import React from "react";

/** 共通トークン。色・余白・角丸・文字サイズはここだけを見る。 */
export const T = {
  gap: 12,
  gapSm: 8,
  pad: 12,
  radius: 8,
  border: "1px solid #ddd",
  borderSoft: "1px solid #eee",
  bgPanel: "#fafafa",
  bgAccent: "#eef6ff",
  borderAccent: "2px solid #4a90d9",
  accent: "#4a90d9",
  fgMuted: "#666",
  fontHead: 14,
  fontBody: 12,
  fontNote: 11,
  /** 左（操作・条件）カラムの基準幅。 */
  leftBasis: 360,
  leftMin: 280,
  leftMax: 460,
  /** ページ全体の最大幅（Map は全画面なので使わない）。 */
  pageMax: 1400,
} as const;

/** セクション見出し（全ページ共通の体裁）。 */
export function SectionTitle({
  children,
  note,
}: {
  children: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 6 }}>
      <div style={{ fontWeight: 700, fontSize: T.fontHead }}>{children}</div>
      {note ? <div style={{ fontSize: T.fontNote, color: T.fgMuted }}>{note}</div> : null}
    </div>
  );
}

/** カード風セクション。枠・角丸・内側余白を統一する。 */
export function Panel({
  children,
  title,
  note,
  style,
}: {
  children: React.ReactNode;
  title?: React.ReactNode;
  note?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section
      style={{
        border: T.border,
        borderRadius: T.radius,
        padding: T.pad,
        background: "white",
        ...style,
      }}
    >
      {title ? <SectionTitle note={note}>{title}</SectionTitle> : null}
      {children}
    </section>
  );
}

/**
 * 2カラムの外枠。row-reverse なので子は「右カラム → 左カラム」の順に渡す
 * （Map の既存実装と同じ並びに合わせてある）。
 */
export function TwoCol({
  right,
  left,
  style,
}: {
  right: React.ReactNode;
  left: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row-reverse",
        gap: T.gap * 1.3,
        alignItems: "flex-start",
        flexWrap: "wrap",
        ...style,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: T.gap, flex: "3 1 560px", minWidth: 340 }}>
        {right}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: T.gap,
          flex: `1 1 ${T.leftBasis}px`,
          minWidth: T.leftMin,
          maxWidth: T.leftMax,
        }}
      >
        {left}
      </div>
    </div>
  );
}

/** ページ本体の枠（Map 以外）。共通の余白と最大幅。 */
export function PageBody({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        padding: T.pad,
        display: "flex",
        flexDirection: "column",
        gap: T.gap,
        maxWidth: T.pageMax,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
