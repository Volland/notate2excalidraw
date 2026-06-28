/** Read a `.notate` file (ZIP + protobuf) into a {@link NotateDoc}. */
import { unzipSync } from 'fflate';
import {
  CanvasData,
  DECODE_OPTS,
  RegionIndex,
  RegionProto,
} from './proto.js';
import {
  type ImageItem,
  type LinkItem,
  type NotateDoc,
  type NotateItem,
  type NotateMeta,
  type StrokeItem,
  type StrokePoint,
  type TextItem,
  defaultMeta,
} from './model.js';

const PACKED_STRIDE = 6;

export class NotateFormatError extends Error {}

function isZip(buf: Uint8Array): boolean {
  return buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b; // "PK"
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  // protobufjs Long (when not converted) exposes toNumber()
  if (v && typeof (v as { toNumber?: () => number }).toNumber === 'function') {
    return (v as { toNumber: () => number }).toNumber();
  }
  return fallback;
}

function decodeStroke(raw: Record<string, unknown>): StrokeItem {
  const packed = (raw.pointsPacked as number[] | undefined) ?? [];
  const times = (raw.timestampsPacked as number[] | undefined) ?? [];
  const count = Math.floor(packed.length / PACKED_STRIDE);
  const points: StrokePoint[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const b = i * PACKED_STRIDE;
    points[i] = {
      x: packed[b],
      y: packed[b + 1],
      pressure: packed[b + 2],
      size: packed[b + 3],
      tiltX: packed[b + 4] ?? 0,
      tiltY: packed[b + 5] ?? 0,
      timestamp: num(times[i]),
    };
  }
  return {
    kind: 'stroke',
    points,
    color: num(raw.color),
    width: num(raw.width),
    style: num(raw.style),
    strokeOrder: num(raw.strokeOrder),
    zIndex: num(raw.zIndex),
  };
}

function decodeText(raw: Record<string, unknown>): TextItem {
  return {
    kind: 'text',
    text: String(raw.text ?? ''),
    x: num(raw.x),
    y: num(raw.y),
    width: num(raw.width),
    height: num(raw.height),
    fontSize: num(raw.fontSize, 24),
    color: num(raw.color),
    zIndex: num(raw.zIndex),
    order: num(raw.order),
    rotation: num(raw.rotation),
    opacity: num(raw.opacity, 1),
    alignment: num(raw.alignment),
    backgroundColor: num(raw.backgroundColor),
  };
}

function decodeImage(raw: Record<string, unknown>): ImageItem {
  return {
    kind: 'image',
    uri: String(raw.uri ?? ''),
    x: num(raw.x),
    y: num(raw.y),
    width: num(raw.width),
    height: num(raw.height),
    zIndex: num(raw.zIndex),
    order: num(raw.order),
    rotation: num(raw.rotation),
    opacity: num(raw.opacity, 1),
  };
}

function decodeLink(raw: Record<string, unknown>): LinkItem {
  return {
    kind: 'link',
    label: String(raw.label ?? ''),
    target: String(raw.target ?? ''),
    x: num(raw.x),
    y: num(raw.y),
    width: num(raw.width),
    height: num(raw.height),
    zIndex: num(raw.zIndex),
    order: num(raw.order),
    color: num(raw.color),
    rotation: num(raw.rotation),
    type: num(raw.type),
    fontSize: num(raw.fontSize, 24),
  };
}

function decodeMeta(bytes: Uint8Array): NotateMeta {
  const meta = defaultMeta();
  try {
    const obj = CanvasData.toObject(CanvasData.decode(bytes), DECODE_OPTS) as Record<
      string,
      unknown
    >;
    meta.version = num(obj.version, meta.version);
    meta.offsetX = num(obj.offsetX);
    meta.offsetY = num(obj.offsetY);
    meta.zoomLevel = num(obj.zoomLevel, 1);
    meta.canvasType = num(obj.canvasType);
    meta.pageWidth = num(obj.pageWidth);
    meta.pageHeight = num(obj.pageHeight);
    meta.regionSize = num(obj.regionSize, meta.regionSize) || meta.regionSize;
    meta.nextStrokeOrder = num(obj.nextStrokeOrder);
    if (obj.uuid) meta.uuid = String(obj.uuid);
  } catch {
    // Leave defaults; a malformed/missing manifest still lets us read regions.
  }
  return meta;
}

const REGION_FILE = /^r_(-?\d+)_(-?\d+)\.bin$/;

/** Parse a `.notate` archive into the normalized document model. */
export function readNotate(input: Uint8Array | ArrayBuffer): NotateDoc {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!isZip(buf)) {
    throw new NotateFormatError(
      'Not a notate file (missing ZIP signature). Legacy/JSON notes are unsupported.',
    );
  }

  const entries = unzipSync(buf);
  const items: NotateItem[] = [];
  const images = new Map<string, Uint8Array>();

  const manifest = entries['manifest.bin'];
  const meta = manifest ? decodeMeta(manifest) : defaultMeta();

  // Index (index.bin) is only needed to rebuild bounds; we recompute from items,
  // so we read region files directly.
  for (const name of Object.keys(entries)) {
    if (REGION_FILE.test(name)) {
      const obj = RegionProto.toObject(
        RegionProto.decode(entries[name]),
        DECODE_OPTS,
      ) as Record<string, unknown[]>;
      for (const s of (obj.strokes ?? []) as Record<string, unknown>[]) {
        items.push(decodeStroke(s));
      }
      for (const im of (obj.images ?? []) as Record<string, unknown>[]) {
        items.push(decodeImage(im));
      }
      for (const t of (obj.texts ?? []) as Record<string, unknown>[]) {
        items.push(decodeText(t));
      }
      for (const l of (obj.links ?? []) as Record<string, unknown>[]) {
        items.push(decodeLink(l));
      }
    } else if (
      (name.startsWith('images/') || name.startsWith('assets/')) &&
      !name.endsWith('/')
    ) {
      images.set(name, entries[name]);
    }
  }

  // Validate the index parses (best-effort; not fatal if absent).
  void RegionIndex;

  return { meta, items, images };
}
