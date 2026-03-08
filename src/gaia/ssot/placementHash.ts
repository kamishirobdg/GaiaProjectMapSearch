// src/gaia/ssot/placementHash.ts
//
// placementHash SSOT
// - placement(slotId, sectorId, rot, rot30) を正規化して安定ハッシュ化する
// - 「評価した盤面」と「表示した盤面」が同一であることを機械的に保証するためのキー
//
// token短縮方針:
// - 旧: <hash8>.<base64url(JSON(normalizedPlacement))>
// - v1: <hash8>.<base64url(binary-packed with dynamic string dictionaries)>
// - v2: <hash8>.<base64url(binary-packed with FIXED dictionaries; no strings)>
//   - binary先頭: 'P'(0x50), version=2
//   - slotId/sectorId は固定辞書の index を varint で保持
//   - rot/rot30 は u8
// - decode は (1) v2 → (2) v1 → (3) 旧JSON の順にフォールバック
//

import type { SlotPlacement } from "../board/types";

// =========================
// FIXED DICTIONARIES (v2)
// =========================

const SLOT_IDS = [
  "L1","L2","L3","L4","L5","L6","L7","L8","L9","L10",
  "M1","M2","M3","M4","M5","M6","M7","M8",
  "S1","S2","S3","S4","S5","S6","S7","S8","S9","S10",
] as const;

const SECTOR_IDS = [
  "01","02","03","04","05","05b","06","06b","07","07b","08","09","10",
  "11a","11b","12a","12b","13a","13b","14a","14b","15a","15b","16a","16b",
  "17a","17b","18a","18b","19","20","21","22","23","24",
  "eclipse","rebellion","tfmars","twilight",
] as const;

const SLOT_TO_INDEX: Record<string, number> = Object.fromEntries(SLOT_IDS.map((s, i) => [s, i]));
const SECTOR_TO_INDEX: Record<string, number> = Object.fromEntries(SECTOR_IDS.map((s, i) => [s, i]));

function normalizePlacement(p: SlotPlacement[]) {
  return [...(p ?? [])]
    .map((x: any) => ({
      slotId: String(x?.slotId ?? ""),
      sectorId: String(x?.sectorId ?? ""),
      rot: Number.isFinite(Number(x?.rot)) ? Number(x.rot) : 0,
      rot30: Number.isFinite(Number(x?.rot30)) ? Number(x.rot30) : 0,
    }))
    .sort((a, b) => {
      if (a.slotId !== b.slotId) return a.slotId < b.slotId ? -1 : 1;
      if (a.sectorId !== b.sectorId) return a.sectorId < b.sectorId ? -1 : 1;
      if (a.rot !== b.rot) return a.rot - b.rot;
      return a.rot30 - b.rot30;
    });
}

/**
 * 軽量・高速 FNV-1a (32bit)
 * - 32bit hex 8桁で返す
 */
function fnv1a32(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // h *= 16777619 (shift-add で32bit維持)
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

function fnv1a32Bytes(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i] & 0xff;
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

// ---------- base64url helpers (string) ----------

function base64UrlEncode(str: string): string {
  // UTF-8 safe base64url
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const binary = atob(b64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ---------- base64url helpers (bytes) ----------

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const binary = atob(b64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
  return bytes;
}

// ---------- varint + byte writer/reader ----------

function writeVarint(out: number[], n: number) {
  let v = n >>> 0;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v & 0x7f);
}

function readVarint(bytes: Uint8Array, state: { i: number }): number | null {
  let shift = 0;
  let result = 0;
  while (state.i < bytes.length && shift <= 28) {
    const b = bytes[state.i++]!;
    result |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) return result >>> 0;
    shift += 7;
  }
  return null;
}

// v1用（可変辞書の文字列保持）
function writeString(out: number[], s: string) {
  const b = new TextEncoder().encode(s);
  writeVarint(out, b.length);
  for (let i = 0; i < b.length; i++) out.push(b[i]!);
}

function readString(bytes: Uint8Array, state: { i: number }): string | null {
  const len = readVarint(bytes, state);
  if (len === null) return null;
  if (state.i + len > bytes.length) return null;
  const slice = bytes.slice(state.i, state.i + len);
  state.i += len;
  return new TextDecoder().decode(slice);
}

// ---------- binary encoder/decoder ----------

const MAGIC_P = 0x50; // 'P'
const VERSION_1 = 0x01;
const VERSION_2 = 0x02;

// ========== v2 (FIXED dictionaries; no strings) ==========

function canUseFixedDict(normalized: Array<{ slotId: string; sectorId: string; rot: number; rot30: number }>): boolean {
  for (const p of normalized) {
    if (SLOT_TO_INDEX[p.slotId] === undefined) return false;
    if (SECTOR_TO_INDEX[p.sectorId] === undefined) return false;
  }
  return true;
}

function encodePlacementBinaryV2(normalized: Array<{ slotId: string; sectorId: string; rot: number; rot30: number }>): Uint8Array {
  const out: number[] = [];
  out.push(MAGIC_P, VERSION_2);

  writeVarint(out, normalized.length);

  for (const p of normalized) {
    const si = SLOT_TO_INDEX[p.slotId];
    const ti = SECTOR_TO_INDEX[p.sectorId];

    // ここに来る時点で存在する前提だが念のため
    if (si === undefined || ti === undefined) continue;

    writeVarint(out, si);
    writeVarint(out, ti);

    const rot = Number.isFinite(p.rot) ? Math.max(0, Math.min(255, p.rot | 0)) : 0;
    const rot30 = Number.isFinite(p.rot30) ? Math.max(0, Math.min(255, p.rot30 | 0)) : 0;
    out.push(rot & 0xff, rot30 & 0xff);
  }

  return new Uint8Array(out);
}

function decodePlacementBinaryV2(bytes: Uint8Array): SlotPlacement[] | null {
  if (bytes.length < 3) return null;
  if (bytes[0] !== MAGIC_P || bytes[1] !== VERSION_2) return null;

  const state = { i: 2 };
  const n = readVarint(bytes, state);
  if (n === null) return null;

  const placements: SlotPlacement[] = [];
  for (let k = 0; k < n; k++) {
    const si = readVarint(bytes, state);
    const ti = readVarint(bytes, state);
    if (si === null || ti === null) return null;
    if (state.i + 2 > bytes.length) return null;

    const rot = bytes[state.i++]!;
    const rot30 = bytes[state.i++]!;

    const slotId = SLOT_IDS[si as number];
    const sectorId = SECTOR_IDS[ti as number];
    if (!slotId || !sectorId) return null;

    placements.push({ slotId, sectorId, rot, rot30 } as any);
  }

  return placements as any;
}

// ========== v1 (dynamic dictionaries; strings included) ==========

function encodePlacementBinaryV1(normalized: Array<{ slotId: string; sectorId: string; rot: number; rot30: number }>): Uint8Array {
  // Dictionaries (order: appearance in normalized; normalized is sorted, so stable)
  const slotDict: string[] = [];
  const sectorDict: string[] = [];
  const slotIndex = new Map<string, number>();
  const sectorIndex = new Map<string, number>();

  for (const p of normalized) {
    if (!slotIndex.has(p.slotId)) {
      slotIndex.set(p.slotId, slotDict.length);
      slotDict.push(p.slotId);
    }
    if (!sectorIndex.has(p.sectorId)) {
      sectorIndex.set(p.sectorId, sectorDict.length);
      sectorDict.push(p.sectorId);
    }
  }

  const out: number[] = [];
  // header
  out.push(MAGIC_P, VERSION_1);

  // slot dict
  writeVarint(out, slotDict.length);
  for (const s of slotDict) writeString(out, s);

  // sector dict
  writeVarint(out, sectorDict.length);
  for (const s of sectorDict) writeString(out, s);

  // placements
  writeVarint(out, normalized.length);
  for (const p of normalized) {
    const si = slotIndex.get(p.slotId);
    const ti = sectorIndex.get(p.sectorId);
    if (si === undefined || ti === undefined) continue; // should not happen

    writeVarint(out, si);
    writeVarint(out, ti);

    // rot / rot30 as u8 (clamp for safety)
    const rot = Number.isFinite(p.rot) ? Math.max(0, Math.min(255, p.rot | 0)) : 0;
    const rot30 = Number.isFinite(p.rot30) ? Math.max(0, Math.min(255, p.rot30 | 0)) : 0;
    out.push(rot & 0xff, rot30 & 0xff);
  }

  return new Uint8Array(out);
}

function decodePlacementBinaryV1(bytes: Uint8Array): SlotPlacement[] | null {
  if (bytes.length < 2) return null;
  if (bytes[0] !== MAGIC_P || bytes[1] !== VERSION_1) return null;

  const state = { i: 2 };

  const slotCount = readVarint(bytes, state);
  if (slotCount === null) return null;
  const slotDict: string[] = [];
  for (let i = 0; i < slotCount; i++) {
    const s = readString(bytes, state);
    if (s === null) return null;
    slotDict.push(s);
  }

  const sectorCount = readVarint(bytes, state);
  if (sectorCount === null) return null;
  const sectorDict: string[] = [];
  for (let i = 0; i < sectorCount; i++) {
    const s = readString(bytes, state);
    if (s === null) return null;
    sectorDict.push(s);
  }

  const n = readVarint(bytes, state);
  if (n === null) return null;

  const placements: SlotPlacement[] = [];
  for (let k = 0; k < n; k++) {
    const si = readVarint(bytes, state);
    const ti = readVarint(bytes, state);
    if (si === null || ti === null) return null;
    if (state.i + 2 > bytes.length) return null;
    const rot = bytes[state.i++]!;
    const rot30 = bytes[state.i++]!;

    const slotId = slotDict[si];
    const sectorId = sectorDict[ti];
    if (slotId == null || sectorId == null) return null;

    placements.push({ slotId, sectorId, rot, rot30 } as any);
  }

  return placements.map((x: any) => ({
    slotId: String(x?.slotId ?? ""),
    sectorId: String(x?.sectorId ?? ""),
    rot: Number.isFinite(Number(x?.rot)) ? Number(x.rot) : 0,
    rot30: Number.isFinite(Number(x?.rot30)) ? Number(x.rot30) : 0,
  })) as any;
}

/**
 * 配置を「復元可能なトークン」にエンコードする。
 * 形式: <hash8>.<base64url(payload)>
 * - hash8 は payload の整合性検証用（改ざん/コピー欠落の検知）
 * - payload は原則 v2（固定辞書で最短）
 * - URL共有用に安全な文字のみ使用
 */
export function encodePlacementToken(placement: SlotPlacement[]): string {
  const normalized = normalizePlacement(placement);

  // v2（固定辞書）が使えるときは最短
  let payloadBytes: Uint8Array;
  if (canUseFixedDict(normalized)) {
    payloadBytes = encodePlacementBinaryV2(normalized);
  } else {
    // 想定外IDが混ざっても壊さないための保険（v1へフォールバック）
    payloadBytes = encodePlacementBinaryV1(normalized);
  }

  const hash8 = fnv1a32Bytes(payloadBytes);
  const payload = base64UrlEncodeBytes(payloadBytes);
  return `${hash8}.${payload}`;
}

/**
 * トークンから配置を復元する。
 * - 成功: SlotPlacement[]
 * - 失敗: null
 *
 * decode順:
 * 1) binary v2 (fixed dict)
 * 2) binary v1 (dynamic dict)
 * 3) 旧JSON (payload utf8 string)
 *
 * ※ 旧来の 8桁hash（復元不可）は null を返す。
 */
export function decodePlacementToken(token: string): SlotPlacement[] | null {
  const t = String(token ?? "").trim();
  if (!t) return null;

  const parts = t.split(".");
  if (parts.length !== 2) return null; // legacy 8-hex hash or invalid
  const [hash8, payload] = parts;

  if (!/^[0-9a-fA-F]{8}$/.test(hash8)) return null;

  // bytes として解釈して v2/v1 を試す
  try {
    const bytes = base64UrlDecodeToBytes(payload);
    const check = fnv1a32Bytes(bytes);
    if (check.toLowerCase() !== hash8.toLowerCase()) return null;

    const v2 = decodePlacementBinaryV2(bytes);
    if (v2) return v2;

    const v1 = decodePlacementBinaryV1(bytes);
    if (v1) return v1;

    // fallback: bytes を UTF-8 string とみなして旧JSON decode
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;

    return parsed.map((x: any) => ({
      slotId: String(x?.slotId ?? ""),
      sectorId: String(x?.sectorId ?? ""),
      rot: Number.isFinite(Number(x?.rot)) ? Number(x.rot) : 0,
      rot30: Number.isFinite(Number(x?.rot30)) ? Number(x.rot30) : 0,
    })) as any;
  } catch {
    // 旧実装互換: payload を直接 string decode して JSON を試す（保険）
    try {
      const json = base64UrlDecode(payload);
      const check = fnv1a32(json);
      if (check.toLowerCase() !== hash8.toLowerCase()) return null;
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return null;

      return parsed.map((x: any) => ({
        slotId: String(x?.slotId ?? ""),
        sectorId: String(x?.sectorId ?? ""),
        rot: Number.isFinite(Number(x?.rot)) ? Number(x.rot) : 0,
        rot30: Number.isFinite(Number(x?.rot30)) ? Number(x.rot30) : 0,
      })) as any;
    } catch {
      return null;
    }
  }
}

export function computePlacementHash(placement: SlotPlacement[]): string {
  const normalized = normalizePlacement(placement);
  return fnv1a32(JSON.stringify(normalized));
}