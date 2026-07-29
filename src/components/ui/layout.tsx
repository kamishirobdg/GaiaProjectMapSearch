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
  /**
   * 左（操作・条件）カラムの幅。Map の結果ペインと同じ値に揃えてある
   * （タブを切り替えても左ペインの幅が変わらないようにするため。2026-07-25）。
   * Setup/List も今後ここに色別評価・スコア・評価指数の入力を載せる前提。
   */
  leftBasis: 880,
  leftMin: 600,
  leftMax: 880,
  /** 右（結果）カラムの基準幅。Map の地図ペインと同じ 480。 */
  rightBasis: 480,
  rightMin: 340,
  /** ページ全体の最大幅。Map が全画面なので他ページも上限を設けない。 */
  pageMax: "none",
  /**
   * 1カラム（縦積み）へ切り替える閾値。Map の isNarrow と同じ 1180px。
   * 左880が最小600まで縮んでも 600+480=1080 なので、1180 以上なら必ず横に
   * 並ぶ。スマホ（Android の一般的な幅 360-430、横向きでも ~900）やタブレット
   * 縦（768-834）は下回るので確実に縦積みになる。
   */
  narrowPx: 1180,
} as const;

/**
 * 画面幅が px 未満かを返す（Map の同名フックと同じ作法）。
 * SSR とハイドレーション直後は false（＝広い）から始まり、mount 後に確定する。
 */
export function useIsNarrow(px: number = T.narrowPx) {
  const [narrow, setNarrow] = React.useState(false);
  React.useEffect(() => {
    const on = () => setNarrow(window.innerWidth < px);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [px]);
  return narrow;
}

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
 *
 * 折り返しは flexWrap ではなく閾値（T.narrowPx）で明示的に切り替える。
 * flexWrap だと「基準幅の合計に届かない＝縮めば入る幅」でも折り返してしまい、
 * 1280px 級の画面で Map だけ横並び・他は縦積み、という不一致が出るため
 * （Map の isNarrow と同じ作法に統一。2026-07-25）。
 * 縦積み時は「操作・条件（左）を上、結果（右）を下」にする。
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
  const isNarrow = useIsNarrow();
  return (
    <div
      style={{
        display: "flex",
        // 縦積みは column-reverse: ソース順（右→左）のまま「左＝操作」が上に来る。
        flexDirection: isNarrow ? "column-reverse" : "row-reverse",
        gap: T.gap * 1.3,
        alignItems: "stretch",
        ...style,
      }}
    >
      {/* 右（結果）: Map の地図ペインと同じく伸びる側。縮むのは左に任せる。 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: T.gap,
          flex: isNarrow ? "0 0 auto" : `1 0 ${T.rightBasis}px`,
          minWidth: isNarrow ? 0 : T.rightMin,
        }}
      >
        {right}
      </div>
      {/* 左（操作・条件）: Map の結果ペインと同じ 880px 基準で、狭いときだけ縮む。 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: T.gap,
          flex: isNarrow ? "0 0 auto" : `0 1 ${T.leftBasis}px`,
          minWidth: isNarrow ? 0 : T.leftMin,
          maxWidth: isNarrow ? "100%" : T.leftMax,
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
