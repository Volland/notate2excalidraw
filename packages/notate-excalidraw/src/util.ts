/** Shared helpers: id/seed generation, base64, geometry, mime types. */
import type { ExcalidrawElementBase } from './excalidraw-types.js';

let idCounter = 0;

export function genId(prefix = 'el'): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}-${Math.floor(
    Math.random() * 1e9,
  ).toString(36)}`;
}

export function randInt(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/** Common defaults for every Excalidraw element we emit. */
export function baseElement(
  partial: Partial<ExcalidrawElementBase> & { type: string },
): ExcalidrawElementBase {
  const defaults: ExcalidrawElementBase = {
    id: genId(),
    type: partial.type,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: randInt(),
    version: 1,
    versionNonce: randInt(),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
  };
  // Caller-provided fields win; extra fields (points, text, fileId, …) pass through.
  return { ...defaults, ...partial };
}

// --- base64 (works in Node and browsers) ---

export function bytesToBase64(bytes: Uint8Array): string {
  const g = globalThis as { Buffer?: { from(b: Uint8Array): { toString(e: string): string } } };
  if (g.Buffer) return g.Buffer.from(bytes).toString('base64');
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const g = globalThis as { Buffer?: { from(s: string, e: string): Uint8Array } };
  if (g.Buffer) return new Uint8Array(g.Buffer.from(b64, 'base64'));
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

export function parseDataUrl(
  dataUrl: string,
): { mimeType: string; bytes: Uint8Array } | null {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const mimeType = m[1] || 'application/octet-stream';
  const isBase64 = !!m[2];
  const data = m[3];
  const bytes = isBase64
    ? base64ToBytes(data)
    : new TextEncoder().encode(decodeURIComponent(data));
  return { mimeType, bytes };
}

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
};

export function extForMime(mimeType: string): string {
  return EXT_BY_MIME[mimeType.toLowerCase()] ?? 'png';
}

export function mimeForExt(ext: string): string {
  const e = ext.toLowerCase().replace(/^\./, '');
  for (const [mime, x] of Object.entries(EXT_BY_MIME)) {
    if (x === e) return mime;
  }
  if (e === 'jpeg') return 'image/jpeg';
  return 'image/png';
}

// --- geometry ---

/** Rotate (px,py) around (cx,cy) by `angle` radians. */
export function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angle: number,
): [number, number] {
  if (!angle) return [px, py];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = px - cx;
  const dy = py - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}
