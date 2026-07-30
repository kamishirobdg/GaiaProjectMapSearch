"use client";

// Middle tiles whose visual centering must be stable across SEED (rot) changes.
const MIDDLE_STABLE_BBOX_SLOTS = new Set(["M1", "M2", "M3", "M4"] as const);
const MIDDLE_SLOTS_PER_ROT = new Set(["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8"] as const);

function fmtNum(n: number, dp: number = 6): number {
  if (!Number.isFinite(n)) return 0;
  const m = Math.pow(10, dp);
  return Math.round(n * m) / m;
}

function rotateOffset(dx: number, dy: number, deg: number) {
  if (!dx && !dy) return { dx: 0, dy: 0 };
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { dx: dx * cos - dy * sin, dy: dx * sin + dy * cos };
}

function rotatePoint(x: number, y: number, deg: number) {
  if (!x && !y) return { x: 0, y: 0 };
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

import * as React from "react";
import type { TemplateDef } from "@/gaia/data/templates/types";

type Axial = { q: number; r: number };

// rot30（30度単位の追加回転）
export type PlacementItem = { slotId: string; sectorId: string; rot: number; rot30?: number };

/**
 * 模式表示（tileMode="schematic"）用の船タイルの略称（2文字）。
 * 正式名（トワイライト等）は六角枠に収まらないため（2026-07-25 要望）。
 */
const SHIP_SHORT: Record<string, string> = {
  twilight: "トワ",
  eclipse: "エク",
  rebellion: "リベ",
  tfmars: "TFM",
};

/**
 * 模式表示で「向き（回転）を出さない」タイルか。
 * 小さいタイル（19以降）と船は向きを設定する必要がないため、回転表示を省いて
 * 番号/略称を大きく出す（2026-07-25 要望）。
 */
function isRotationlessTile(sectorId: string): boolean {
  if (SHIP_SHORT[sectorId]) return true;
  const n = parseInt(String(sectorId), 10);
  return Number.isFinite(n) && n >= 19;
}

function parseKey(key: string): Axial {
  const [q, r] = key.split(",").map((v) => Number(v));
  return { q, r };
}

function axialRotateCCW(pos: Axial, rot60: number): Axial {
  let x = pos.q;
  let z = pos.r;
  let y = -x - z;

  const r = ((rot60 % 6) + 6) % 6;
  for (let i = 0; i < r; i++) {
    // (x,y,z) -> (-z, -x, -y)
    const nx = -z;
    const ny = -x;
    const nz = -y;
    x = nx;
    y = ny;
    z = nz;
  }
  return { q: x, r: z };
}

function axialToPixelPointy(pos: Axial, size: number) {
  const x = size * Math.sqrt(3) * (pos.q + pos.r / 2);
  const y = size * (3 / 2) * pos.r;
  return { x, y };
}

function computeBounds(points: Array<{ x: number; y: number }>, pad: number) {
  if (points.length === 0) return { minX: -100, minY: -100, maxX: 100, maxY: 100 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

/**
 * Base(LARGE)の行シフト補正（確定仕様）
 * shift = floor((r + R)/2), q' = q - shift
 */
function fixBaseLocalCoord(sector: any, local: Axial): Axial {
  const R = typeof sector?.radius === "number" ? sector.radius : null;
  if (R === null) return local;
  const shift = Math.floor((local.r + R) / 2);
  return { q: local.q - shift, r: local.r };
}

type InflateByAccepts = Partial<Record<"LARGE" | "MIDDLE" | "SMALL", number>>;
type RotateOffsetByAccepts = Partial<Record<"LARGE" | "MIDDLE" | "SMALL", number>>;
type ScaleByAccepts = Partial<Record<"LARGE" | "MIDDLE" | "SMALL", number>>;
type ImgOffsetByAccepts = Partial<Record<"LARGE" | "MIDDLE" | "SMALL", { dx: number; dy: number }>>;

type ImgOffsetBySlotId = Record<string, { dx: number; dy: number }>;
type RotOffsetsBySlotId = Record<string, Partial<Record<0 | 1 | 2 | 3 | 4 | 5, { dx: number; dy: number }>>>;

function normalizeAccepts0(raw: any): "LARGE" | "MIDDLE" | "SMALL" {
  const a = String(raw ?? "").toUpperCase();
  if (a === "LARGE") return "LARGE";
  if (a === "MIDDLE") return "MIDDLE";
  return "SMALL";
}

// Map/Record どちらでも参照できるようにする（page側の実装差異を吸収）
function dictGet<T>(dict: Map<string, T> | Record<string, T>, key: string): T | undefined {
  if (dict && typeof (dict as any).get === "function") {
    return (dict as Map<string, T>).get(key);
  }
  return (dict as Record<string, T>)?.[key];
}

/**
 * sector.cells のローカル座標から「外接サイズ」と「中心補正オフセット」を算出する。
 * - w/h: cellsの外接 + hex外形
 * - offsetX/Y: “形状中心” を (0,0) に寄せるための補正
 */
function calcTilePixelBox(sector: any, hexSize: number, inflate: number, rotationDeg: number) {
  const cells = sector?.cells ?? {};
  const keys = Object.keys(cells);

  const hexW = Math.sqrt(3) * hexSize;
  const hexH = 2 * hexSize;

  if (keys.length === 0) {
    const baseW = 6 * hexW;
    const baseH = 6 * hexH;
    return { w: baseW * inflate, h: baseH * inflate, offsetX: 0, offsetY: 0 };
  }

  const pts = keys.map((k) => {
    const local0 = parseKey(k);
    const local = fixBaseLocalCoord(sector, local0);
    const pt0 = axialToPixelPointy(local, hexSize);
    return rotatePoint(pt0.x, pt0.y, rotationDeg);
  });

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  const minX2 = minX - hexW / 2;
  const maxX2 = maxX + hexW / 2;
  const minY2 = minY - hexH / 2;
  const maxY2 = maxY + hexH / 2;

  const baseW = maxX2 - minX2;
  const baseH = maxY2 - minY2;

  const centerX = (minX2 + maxX2) / 2;
  const centerY = (minY2 + maxY2) / 2;

  const offsetX = -centerX;
  const offsetY = -centerY;

  return { w: baseW * inflate, h: baseH * inflate, offsetX, offsetY };
}

export function MapBoardViewer(props: {
  template: TemplateDef;
  placement?: PlacementItem[];
  placements?: PlacementItem[];

  // If true, disables pointer-drag panning (viewBox move)
  disablePan?: boolean;

  sectorById: Map<string, any> | Record<string, any>;
  sectorImgById: Map<string, string> | Record<string, string>;

  viewRot?: number;
  viewAngleDeg?: number;
  hexSize?: number;

  showLabels?: boolean;

  inflateByAccepts?: InflateByAccepts;
  rotateOffsetDegByAccepts?: RotateOffsetByAccepts;

  // ★タイル種別ごとの縮小率（1.0=等倍）
  scaleByAccepts?: ScaleByAccepts;

  imgOffsetByAccepts?: ImgOffsetByAccepts;
  imgOffsetBySlotId?: ImgOffsetBySlotId;
  rotOffsetsBySlotId?: RotOffsetsBySlotId;

  // fit用のpad調整（既存）
  zoom?: number;
  boundsPad?: number;

  // 画像同士の微妙な“被り”を避けるための縮小率（1.0=等倍）
  imageShrink?: number;

  // 固定ピクセルサイズでSVGをレンダリング（画像出力のサイズ安定化用）
  svgPixelSize?: { width: number; height: number };

  // ★UI（上部ツールバー）表示
  showToolbar?: boolean;

  // ★初期ズーム（操作用）
  initialUiZoom?: number;

  // 詳細表/評価指数クリックから連動するマーカー（#9）。key は audit の
  // セル座標 "q,r"（extractForEval と同じグローバル軸座標）。color はリング色、
  // label はホバー時に出す帰属テキスト。
  markers?: Array<{ key: string; color: string; label?: string }>;

  // SVG背景色（既定 white）。ミニ盤面では "transparent" にして、-30°回転で
  // はみ出す白い矩形が隣接要素へ被らないようにする（List プレビュー）。
  bgColor?: string;

  // 描画を下へずらすピクセル数。CSS回転で上端が切れるミニ盤面で、
  // 縮小せずに上側を見せるために使う（縮小すると小さくなりすぎるため）。
  nudgeYpx?: number;

  // "schematic" はタイル画像の代わりに「セクタ番号＋向き」だけを描く簡易表示。
  // 小さい盤面でタイルが判別しづらいとき用（2026-07-25 要望）。
  tileMode?: "image" | "schematic";
}) {
  const {
    template,
    placement,
    placements,
    disablePan = false,
    sectorById,
    sectorImgById,
    viewRot = 4,
    viewAngleDeg = -30, // (現状はタイル側で扱うのでSVG全体は回さない)
    hexSize = 40,
    showLabels = false,

    inflateByAccepts = { LARGE: 1.06, MIDDLE: 1.06, SMALL: 1.06 },
    rotateOffsetDegByAccepts = { LARGE: -30, MIDDLE: 0, SMALL: 0 },

    // ★Largeは等倍、Middle/Smallのみ縮小
    scaleByAccepts = { LARGE: 1.0, MIDDLE: 0.92, SMALL: 0.88 },

    imgOffsetByAccepts = { LARGE: { dx: 0, dy: 0 }, MIDDLE: { dx: 0, dy: 0 }, SMALL: { dx: 0, dy: 0 } },
    imgOffsetBySlotId = {},
    rotOffsetsBySlotId = {},

    zoom: zoomProp,
    boundsPad: boundsPadProp,

    showToolbar = true,
    initialUiZoom = 1,
    svgPixelSize,
    markers = [],
    bgColor = "white",
    nudgeYpx = 0,
    tileMode = "image",
  } = props;

  // ホバー中マーカーのポップアップ（帰属テキスト）。SVGはCSS回転が絡むため
  // 座標計算は避け、ビューポート座標（clientX/Y）で固定配置する。
  const [hoverMarker, setHoverMarker] = React.useState<
    { label: string; x: number; y: number } | null
  >(null);

  // Backward/forward compatible placement list
  const placementList = (placement ?? placements ?? []) as PlacementItem[];

  // fit-to-bounds zoom (existing): reduces surrounding pad, does not clip
  const zoomFit = Number.isFinite(zoomProp as number) && (zoomProp as number) > 0 ? (zoomProp as number) : 1;
  const boundsPad = Number.isFinite(boundsPadProp as number) && (boundsPadProp as number) >= 0 ? (boundsPadProp as number) : 40;

  // Slightly shrink each tile image to avoid border overlap artifacts on some DPIs.
  const imageShrinkRaw = Number.isFinite(props.imageShrink as number) ? (props.imageShrink as number) : 0.985;
  const imageShrink = Math.max(0.9, Math.min(1.0, imageShrinkRaw));
  const effectivePad = boundsPad / zoomFit;

  // ===== Offset editor (existing) =====
  const [editMode, setEditMode] = React.useState(false);
  const [editAcceptsOffsets, setEditAcceptsOffsets] = React.useState<any>({});
  const [editSlotOffsets, setEditSlotOffsets] = React.useState<any>({});
  const [editSlotRotOffsets, setEditSlotRotOffsets] = React.useState<any>({});

  const [importJson, setImportJson] = React.useState<string>("");
  const [importError, setImportError] = React.useState<string | null>(null);
  const [exportJson, setExportJson] = React.useState<string>("");

  const applyImportJson = React.useCallback(() => {
    const raw = (importJson || "").trim();
    if (!raw) return;
    try {
      const obj = JSON.parse(raw);
      const nextAccepts = (obj?.imgOffsetByAccepts ?? obj?.accepts ?? obj?.byAccepts) as any;
      const nextSlots = (obj?.imgOffsetBySlotId ?? obj?.slots ?? obj?.bySlotId) as any;
      const nextSlotRot = (obj?.rotOffsetsBySlotId ?? obj?.bySlotIdRot) as any;

      if (nextAccepts && typeof nextAccepts === "object") setEditAcceptsOffsets((prev: any) => ({ ...prev, ...nextAccepts }));
      if (nextSlots && typeof nextSlots === "object") setEditSlotOffsets((prev: any) => ({ ...prev, ...nextSlots }));
      if (nextSlotRot && typeof nextSlotRot === "object") setEditSlotRotOffsets((prev: any) => ({ ...prev, ...nextSlotRot }));

      setImportError(null);
    } catch (e: any) {
      setImportError(e?.message ? String(e.message) : "Invalid JSON");
    }
  }, [importJson]);

  const slotById = React.useMemo(() => new Map(template.slots.map((s) => [s.slotId, s])), [template.slots]);

  const effectiveAcceptsOffsets = React.useMemo(() => {
    return editMode ? { ...imgOffsetByAccepts, ...editAcceptsOffsets } : imgOffsetByAccepts;
  }, [editMode, imgOffsetByAccepts, editAcceptsOffsets]);

  const effectiveSlotOffsets = React.useMemo(() => {
    return editMode ? { ...imgOffsetBySlotId, ...editSlotOffsets } : imgOffsetBySlotId;
  }, [editMode, imgOffsetBySlotId, editSlotOffsets]);

  const effectiveSlotRotOffsets = React.useMemo(() => {
    return editMode ? { ...rotOffsetsBySlotId, ...editSlotRotOffsets } : rotOffsetsBySlotId;
  }, [editMode, rotOffsetsBySlotId, editSlotRotOffsets]);

  React.useEffect(() => {
    const payload = {
      imgOffsetByAccepts: effectiveAcceptsOffsets,
      imgOffsetBySlotId: effectiveSlotOffsets,
      rotOffsetsBySlotId: effectiveSlotRotOffsets,
    };
    setExportJson(JSON.stringify(payload, null, 2));
  }, [effectiveAcceptsOffsets, effectiveSlotOffsets, effectiveSlotRotOffsets]);

  // ===== Tile bbox cache =====
  const boxByKey = React.useMemo(() => {
    const m = new Map<string, { w: number; h: number; offsetX: number; offsetY: number }>();
    for (const p of placementList) {
      const slot = slotById.get(p.slotId);
      const accepts0 = normalizeAccepts0(slot?.accepts?.[0]);
      const inflate = inflateByAccepts[accepts0] ?? 1.06;

      const offsetDeg = rotateOffsetDegByAccepts[accepts0] ?? 0;
      const extra30 = (p.rot30 ?? 0) * 30;
      const tileDeg = -(p.rot * 60) + offsetDeg + extra30;

      const slotId = String(p.slotId);
      const isStableMiddle =
        slotId === "M1" || slotId === "M2" || slotId === "M3" || slotId === "M4";
      
      const bboxRotDeg =
        accepts0 === "MIDDLE"
          ? (isStableMiddle && MIDDLE_STABLE_BBOX_SLOTS.has(slotId) ? 0 : tileDeg)
          : 0;
      const key = `${p.sectorId}@@${accepts0}@@${inflate}@@${bboxRotDeg}`;
      if (m.has(key)) continue;

      const sector = dictGet(sectorById, p.sectorId);
      m.set(key, calcTilePixelBox(sector, hexSize, inflate, bboxRotDeg));
    }
    return m;
  }, [placementList, sectorById, slotById, hexSize, inflateByAccepts, rotateOffsetDegByAccepts]);

  // ===== Placement -> drawable items =====
  const tileItems = React.useMemo(() => {
    return placementList
      .map((p) => {
        const slot = slotById.get(p.slotId);
        if (!slot) return null;

        const accepts0 = normalizeAccepts0(slot.accepts?.[0]);
        const img = dictGet(sectorImgById, p.sectorId) || `/sectors/${p.sectorId}.png`;
        const inflate = inflateByAccepts[accepts0] ?? 1.06;

        const offsetDeg = rotateOffsetDegByAccepts[accepts0] ?? 0;
        const extra30 = (p.rot30 ?? 0) * 30;
        const tileDeg = -(p.rot * 60) + offsetDeg + extra30;

        const slotId = String(p.slotId);
        const isStableMiddle =
          slotId === "M1" || slotId === "M2" || slotId === "M3" || slotId === "M4";
        
        const bboxRotDeg =
          accepts0 === "MIDDLE"
            ? (isStableMiddle && MIDDLE_STABLE_BBOX_SLOTS.has(slotId) ? 0 : tileDeg)
            : 0;
        const key = `${p.sectorId}@@${accepts0}@@${inflate}@@${bboxRotDeg}`;
        const box = boxByKey.get(key) ?? { w: 240, h: 210, offsetX: 0, offsetY: 0 };

        // ★縮小率（Largeは1.0、Middle/Smallのみ縮小）
        const scale = scaleByAccepts[accepts0] ?? 1.0;
        const w = box.w * scale;
        const h = box.h * scale;
        const offsetX = box.offsetX * scale;
        const offsetY = box.offsetY * scale;

        const pr = axialRotateCCW(slot.pos as any, viewRot);
        const { x, y } = axialToPixelPointy(pr, hexSize);

        const manualByAccepts = (effectiveAcceptsOffsets as any)[accepts0] ?? { dx: 0, dy: 0 };
        const manualBySlot = (effectiveSlotOffsets as any)?.[p.slotId] ?? { dx: 0, dy: 0 };

        const rot6 = (((Number((p as any).rot) || 0) % 6) + 6) % 6 as 0 | 1 | 2 | 3 | 4 | 5;
        const manualBySlotRot = MIDDLE_SLOTS_PER_ROT.has(p.slotId as any)
          ? ((effectiveSlotRotOffsets as any)?.[p.slotId]?.[rot6] ?? { dx: 0, dy: 0 })
          : { dx: 0, dy: 0 };

        // Slot offset strategy:
        // - Default: template-space tweak (no rotation)
        // - M1..M4 (Middle): rotate with tile orientation so the correction stays attached as rot changes by SEED.
        const slot0Dx = (manualBySlot.dx ?? 0) + (manualBySlotRot.dx ?? 0);
        const slot0Dy = (manualBySlot.dy ?? 0) + (manualBySlotRot.dy ?? 0);
        const isMiddleSlotRotOffset = accepts0 === "MIDDLE" && MIDDLE_STABLE_BBOX_SLOTS.has(p.slotId as any);
        const slotOffset = isMiddleSlotRotOffset ? rotateOffset(slot0Dx, slot0Dy, tileDeg) : { dx: slot0Dx, dy: slot0Dy };

        const dx = (manualByAccepts.dx ?? 0) + slotOffset.dx;
        const dy = (manualByAccepts.dy ?? 0) + slotOffset.dy;

        const imgX = x + offsetX - w / 2 + dx;
        const imgY = y + offsetY - h / 2 + dy;

        return {
          key: `${p.slotId}_${p.sectorId}_${p.rot}_${p.rot30 ?? 0}`,
          slotId: p.slotId,
          sectorId: p.sectorId,
          accepts0,
          img,
          imgX,
          imgY,
          w,
          h,
          tileDeg,
          rot6,
        };
      })
      .filter(Boolean) as Array<{
      key: string;
      slotId: string;
      sectorId: string;
      accepts0: "LARGE" | "MIDDLE" | "SMALL";
      img: string;
      imgX: number;
      imgY: number;
      w: number;
      h: number;
      tileDeg: number;
      rot6: number;
    }>;
  }, [placementList,
    slotById,
    viewRot,
    hexSize,
    sectorImgById,
    inflateByAccepts,
    rotateOffsetDegByAccepts,
    scaleByAccepts,
    boxByKey,
    effectiveAcceptsOffsets,
    effectiveSlotOffsets,
    effectiveSlotRotOffsets,
  ]);

  // ===== Base bounds (fit) =====
  const basePoints = React.useMemo(() => {
    const pts: Array<{ x: number; y: number }> = [];

    // slot点（ラベル領域確保）
    for (const s of template.slots) {
      const pr = axialRotateCCW(s.pos as any, viewRot);
      const p = axialToPixelPointy(pr, hexSize);
      pts.push(p);
    }

    // tile外接（回転は image 内 transform）
    for (const t of tileItems) {
      pts.push({ x: t.imgX, y: t.imgY });
      pts.push({ x: t.imgX + t.w, y: t.imgY });
      pts.push({ x: t.imgX, y: t.imgY + t.h });
      pts.push({ x: t.imgX + t.w, y: t.imgY + t.h });
    }

    return pts;
  }, [template.slots, tileItems, viewRot, hexSize]);

  const baseBounds = React.useMemo(() => computeBounds(basePoints, effectivePad), [basePoints, effectivePad]);

  // ===== UI Zoom/Pan via viewBox manipulation =====
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  const [uiZoom, setUiZoom] = React.useState(() => {
    const z = Number(initialUiZoom);
    return Number.isFinite(z) && z > 0 ? z : 1;
  });
  const [vbX, setVbX] = React.useState(baseBounds.minX);
  const [vbY, setVbY] = React.useState(baseBounds.minY);

  // when base bounds change (seed/template etc), reset pan
  React.useEffect(() => {
    setVbX(baseBounds.minX);
    setVbY(baseBounds.minY);
  }, [baseBounds.minX, baseBounds.minY]);

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  const baseW = baseBounds.maxX - baseBounds.minX;
  const baseH = baseBounds.maxY - baseBounds.minY;

  const curW = baseW / uiZoom;
  const curH = baseH / uiZoom;

  const viewBox = `${fmtNum(vbX)} ${fmtNum(vbY)} ${fmtNum(curW)} ${fmtNum(curH)}`;

  // Export: avoid letterboxing without cropping/distortion by matching SVG pixel aspect to viewBox aspect.
  const exportSvgSize = React.useMemo(() => {
    if (!svgPixelSize) return null;

    const maxW = Number(svgPixelSize.width);
    const maxH = Number(svgPixelSize.height);

    const vbW = curW;
    const vbH = curH;

    if (!(maxW > 0 && maxH > 0 && vbW > 0 && vbH > 0)) {
      return { width: maxW || 720, height: maxH || 720 };
    }

    const scale = Math.min(maxW / vbW, maxH / vbH);
    return {
      width: Math.max(1, Math.round(vbW * scale)),
      height: Math.max(1, Math.round(vbH * scale)),
    };
  }, [svgPixelSize, curW, curH]);

  // wheel zoom around cursor
  const onWheel = React.useCallback(
    (e: React.WheelEvent) => {
      if (!svgRef.current) return;
      e.preventDefault();

      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();

      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const rx = rect.width > 0 ? px / rect.width : 0.5;
      const ry = rect.height > 0 ? py / rect.height : 0.5;

      const oldZoom = uiZoom;
      const factor = e.deltaY > 0 ? 1 / 1.12 : 1.12;
      const newZoom = clamp(oldZoom * factor, 0.35, 6);

      if (newZoom === oldZoom) return;

      const oldW = baseW / oldZoom;
      const oldH = baseH / oldZoom;
      const newW = baseW / newZoom;
      const newH = baseH / newZoom;

      const cursorSvgX = vbX + rx * oldW;
      const cursorSvgY = vbY + ry * oldH;

      const newVbX = cursorSvgX - rx * newW;
      const newVbY = cursorSvgY - ry * newH;

      setUiZoom(newZoom);
      setVbX(newVbX);
      setVbY(newVbY);
    },
    [uiZoom, vbX, vbY, baseW, baseH]
  );

  // drag pan
  const panStateRef = React.useRef<null | {
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startVbX: number;
    startVbY: number;
    rectW: number;
    rectH: number;
    vbW: number;
    vbH: number;
  }>(null);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (disablePan) return;
      if (!svgRef.current) return;
      if (e.button !== 0) return;
      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();
      panStateRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startVbX: vbX,
        startVbY: vbY,
        rectW: rect.width || 1,
        rectH: rect.height || 1,
        vbW: curW,
        vbH: curH,
      };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [disablePan, vbX, vbY, curW, curH]
  );

  const onPointerMove = React.useCallback((e: React.PointerEvent) => {
    const st = panStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;

    const dxPx = e.clientX - st.startClientX;
    const dyPx = e.clientY - st.startClientY;

    const dxSvg = (dxPx * st.vbW) / st.rectW;
    const dySvg = (dyPx * st.vbH) / st.rectH;

    setVbX(st.startVbX - dxSvg);
    setVbY(st.startVbY - dySvg);
  }, []);

  const onPointerUp = React.useCallback((e: React.PointerEvent) => {
    const st = panStateRef.current;
    if (!st || st.pointerId !== e.pointerId) return;
    panStateRef.current = null;
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch {}
  }, []);

  const resetView = React.useCallback(() => {
    setUiZoom(1);
    setVbX(baseBounds.minX);
    setVbY(baseBounds.minY);
  }, [baseBounds.minX, baseBounds.minY]);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {showToolbar && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
            <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
            <span>Edit offsets</span>
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span>Zoom</span>
            <input
              type="range"
              min={0.35}
              max={6}
              step={0.01}
              value={uiZoom}
              onChange={(e) => setUiZoom(clamp(Number(e.target.value), 0.35, 6))}
              style={{ width: 160 }}
            />
            <span style={{ width: 44, textAlign: "right" }}>{Math.round(uiZoom * 100)}%</span>
            <button onClick={resetView} style={{ padding: "4px 8px", fontSize: 12 }}>
              Reset
            </button>
          </div>

          {editMode && (
            <button
              onClick={() => {
                navigator.clipboard?.writeText(exportJson);
              }}
              style={{ padding: "4px 8px", fontSize: 12 }}
            >
              Copy JSON
            </button>
          )}
        </div>
      )}

      {showToolbar && editMode && (
        <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 420 }}>
            <div style={{ fontWeight: 700, fontSize: 12 }}>Import JSON</div>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              rows={6}
              style={{ width: "100%", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
              <button onClick={applyImportJson} style={{ padding: "4px 8px", fontSize: 12 }}>
                Apply
              </button>
              {importError ? <div style={{ color: "crimson", fontSize: 12 }}>{importError}</div> : null}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 420 }}>
            <div style={{ fontWeight: 700, fontSize: 12 }}>Export JSON</div>
            <textarea
              value={exportJson}
              readOnly
              rows={6}
              style={{ width: "100%", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}
            />
          </div>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: "visible" }}>
        <svg
          ref={svgRef}
          width={exportSvgSize ? exportSvgSize.width : "100%"}
          height={exportSvgSize ? exportSvgSize.height : "100%"}
          viewBox={viewBox}
          preserveAspectRatio="xMinYMin meet"
          style={{ background: bgColor, border: "none", borderRadius: 8, touchAction: "none",
    // 下へずらす分は rotate より先に適用する（画面座標でそのまま下方向に動く）。
    transform: `${nudgeYpx ? `translateY(${fmtNum(nudgeYpx, 2)}px) ` : ""}rotate(${viewAngleDeg}deg)`,
    transformOrigin: "50% 50%", }}
//          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* Tiles */}
          {tileItems.map((t) => {
            // 模式表示: 画像の代わりに「セクタ番号＋向き」を描く（小さい盤面で
            // タイルが判別しづらいとき用）。文字は SVG 全体の回転を打ち消して
            // 水平に読めるようにし、向きは打ち消さない矢印で示す。
            if (tileMode === "schematic") {
              const cx = t.imgX + t.w / 2;
              const cy = t.imgY + t.h / 2;
              const r = Math.min(t.w, t.h) * 0.46;
              const pts = [0, 1, 2, 3, 4, 5]
                .map((k) => {
                  const a = (Math.PI / 180) * (60 * k + 30);
                  return `${fmtNum(cx + r * Math.cos(a), 3)},${fmtNum(cy + r * Math.sin(a), 3)}`;
                })
                .join(" ");
              // 小さいタイル（19以降）と船は向きの設定が不要なので、回転表示（矢印と
              // ↻n）を省いて番号/略称を大きく1行で出す（2026-07-25 要望）。
              const noRot = isRotationlessTile(t.sectorId);
              const label = SHIP_SHORT[t.sectorId] ?? t.sectorId;
              // 六角形の内幅に収まる字面に合わせる。全角（カタカナ）は半角の約2倍
              // 幅を食うので、字種と文字数で係数を分ける。
              const isWide = /[^ -]/.test(label);
              const labelSize = noRot
                ? r * (isWide ? 0.7 : label.length >= 3 ? 0.66 : 0.95)
                : r * 0.55;
              return (
                <g key={t.key}>
                  <polygon
                    points={pts}
                    fill="#ffffff"
                    stroke="#555"
                    strokeWidth={fmtNum(Math.max(1, r * 0.045), 3)}
                  />
                  {/* 向き: タイルの実際の回転（画面上の向き）を矢印で示す */}
                  {noRot ? null : (
                    <g transform={`translate(${fmtNum(cx)},${fmtNum(cy)}) rotate(${fmtNum(t.tileDeg)})`}>
                      <path
                        d={`M 0 ${fmtNum(-r * 0.82)} l ${fmtNum(-r * 0.15)} ${fmtNum(r * 0.26)} l ${fmtNum(r * 0.3)} 0 Z`}
                        fill="#d0021b"
                      />
                    </g>
                  )}
                  {/* 番号（と回転量）: 全体回転を打ち消して水平に表示 */}
                  <g transform={`translate(${fmtNum(cx)},${fmtNum(cy)}) rotate(${fmtNum(-viewAngleDeg)})`}>
                    <text
                      y={fmtNum(noRot ? 0 : -r * 0.08)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={fmtNum(labelSize, 3)}
                      fontWeight={700}
                      fill="#111"
                    >
                      {label}
                    </text>
                    {noRot ? null : (
                      <text
                        y={fmtNum(r * 0.45)}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={fmtNum(r * 0.3, 3)}
                        fill="#555"
                      >
                        {`↻${t.rot6}`}
                      </text>
                    )}
                  </g>
                </g>
              );
            }
            const iw = t.w * imageShrink;
            const ih = t.h * imageShrink;
            const ox = (t.w - iw) / 2;
            const oy = (t.h - ih) / 2;
            return (
              <g key={t.key} transform={`translate(${fmtNum(t.imgX)},${fmtNum(t.imgY)})`}>
                {t.img ? (
                  <image
                    href={t.img}
                    x={fmtNum(ox)}
                    y={fmtNum(oy)}
                    width={fmtNum(iw)}
                    height={fmtNum(ih)}
                    preserveAspectRatio="xMidYMid meet"
                    transform={`translate(${fmtNum(t.w / 2)},${fmtNum(t.h / 2)}) rotate(${fmtNum(t.tileDeg)}) translate(${fmtNum(-t.w / 2)},${fmtNum(-t.h / 2)})`}
                    style={{ opacity: 1 }}
                  />
                ) : null}
              </g>
            );
          })}

          {/* Slot labels */}
          {showLabels &&
            template.slots.map((s) => {
              const pr = axialRotateCCW(s.pos as any, viewRot);
              const { x, y } = axialToPixelPointy(pr, hexSize);
              return (
                <text
                  key={s.slotId}
                  x={fmtNum(x)}
                  y={fmtNum(y)}
                  fontSize={fmtNum(hexSize * 0.5)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#111"
                >
                  {s.slotId}
                </text>
              );
            })}

          {/* Markers (#9 詳細表/評価指数クリック連動): セル座標にリングを点滅表示 */}
          {markers.length > 0 ? (
            <>
              <style>{`@keyframes mbvBlink{0%,100%{opacity:1}50%{opacity:.32}} .mbv-marker{animation:mbvBlink 1.1s ease-in-out infinite}`}</style>
              {markers.map((m, i) => {
                const { q, r } = parseKey(m.key);
                if (!Number.isFinite(q) || !Number.isFinite(r)) return null;
                const pr = axialRotateCCW({ q, r } as any, viewRot);
                const { x, y } = axialToPixelPointy(pr, hexSize);
                return (
                  <circle
                    key={`mk_${m.key}_${i}`}
                    className="mbv-marker"
                    cx={fmtNum(x)}
                    cy={fmtNum(y)}
                    r={fmtNum(hexSize * 0.82)}
                    fill="none"
                    stroke={m.color}
                    strokeWidth={fmtNum(hexSize * 0.16)}
                    style={{
                      pointerEvents: "stroke",
                      cursor: m.label ? "help" : undefined,
                      filter: "drop-shadow(0 0 1.2px rgba(0,0,0,0.85))",
                    }}
                    onMouseEnter={
                      m.label
                        ? (e) => setHoverMarker({ label: m.label!, x: e.clientX, y: e.clientY })
                        : undefined
                    }
                    onMouseMove={
                      m.label
                        ? (e) => setHoverMarker({ label: m.label!, x: e.clientX, y: e.clientY })
                        : undefined
                    }
                    onMouseLeave={m.label ? () => setHoverMarker(null) : undefined}
                  />
                );
              })}
            </>
          ) : null}
        </svg>
        {hoverMarker ? (
          <div
            style={{
              position: "fixed",
              left: hoverMarker.x + 14,
              top: hoverMarker.y + 14,
              zIndex: 50,
              pointerEvents: "none",
              background: "rgba(20,20,20,0.92)",
              color: "#fff",
              fontSize: 12,
              lineHeight: 1.4,
              padding: "6px 9px",
              borderRadius: 6,
              maxWidth: 260,
              whiteSpace: "pre-line",
              boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
            }}
          >
            {hoverMarker.label}
          </div>
        ) : null}
      </div>
    </div>
  );
}
