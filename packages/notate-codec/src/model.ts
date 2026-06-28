/**
 * Normalized, framework-free representation of a notate document.
 *
 * This is the in-memory model that {@link readNotate} produces and
 * {@link writeNotate} consumes. It is intentionally decoupled from both the
 * on-disk protobuf shapes and from Excalidraw, so the converter package can map
 * to/from it without depending on the wire format.
 *
 * Field semantics mirror notate's Kotlin source (`SerializationModels.kt`).
 * Coordinates are in world units (px). Colors are Android ARGB ints
 * (`0xAARRGGBB`) exactly as stored on disk.
 */

/** notate stroke styles. The numeric value is the on-disk enum ordinal. */
export enum StrokeType {
  FOUNTAIN = 0,
  BALLPOINT = 1,
  FINELINER = 2,
  HIGHLIGHTER = 3,
  BRUSH = 4,
  CHARCOAL = 5,
  DASH = 6,
}

/** notate link target kinds. Numeric value is the on-disk enum ordinal. */
export enum LinkType {
  INTERNAL_NOTE = 0,
  EXTERNAL_URL = 1,
  LOCAL_FILE = 2,
}

/** A single sampled point of a stroke. Mirrors the stride-6 packed layout. */
export interface StrokePoint {
  x: number;
  y: number;
  /** Raw device pressure. May be 0/NaN in source; consumers should default. */
  pressure: number;
  /** Per-point size hint (px). */
  size: number;
  tiltX: number;
  tiltY: number;
  /** Epoch millis. 0 when unknown (e.g. synthesized strokes). */
  timestamp: number;
}

export interface StrokeItem {
  kind: 'stroke';
  points: StrokePoint[];
  /** Android ARGB int (0xAARRGGBB). */
  color: number;
  width: number;
  style: StrokeType;
  strokeOrder: number;
  zIndex: number;
}

export interface TextItem {
  kind: 'text';
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  /** Android ARGB int. */
  color: number;
  zIndex: number;
  order: number;
  rotation: number;
  opacity: number;
  /** 0 normal, 1 opposite (right), 2 center. */
  alignment: number;
  /** Android ARGB int; 0 = none. */
  backgroundColor: number;
}

export interface ImageItem {
  kind: 'image';
  /** Relative path inside the archive, e.g. "images/uuid.png". */
  uri: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  order: number;
  rotation: number;
  opacity: number;
}

export interface LinkItem {
  kind: 'link';
  label: string;
  /** UUID (internal), URI (external) or file path (local). */
  target: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  order: number;
  /** Android ARGB int. */
  color: number;
  rotation: number;
  type: LinkType;
  fontSize: number;
}

export type NotateItem = StrokeItem | TextItem | ImageItem | LinkItem;

/** Subset of `CanvasData` we round-trip. Unknown fields use notate defaults. */
export interface NotateMeta {
  version: number;
  offsetX: number;
  offsetY: number;
  zoomLevel: number;
  /** 0 = INFINITE, 1 = FIXED_PAGES. */
  canvasType: number;
  pageWidth: number;
  pageHeight: number;
  regionSize: number;
  nextStrokeOrder: number;
  uuid?: string;
}

export const DEFAULT_REGION_SIZE = 4096;

export function defaultMeta(): NotateMeta {
  return {
    version: 3,
    offsetX: 0,
    offsetY: 0,
    zoomLevel: 1,
    canvasType: 0,
    pageWidth: 0,
    pageHeight: 0,
    regionSize: DEFAULT_REGION_SIZE,
    nextStrokeOrder: 0,
  };
}

export interface NotateDoc {
  meta: NotateMeta;
  items: NotateItem[];
  /** Binary contents of `images/*` (and any asset) keyed by relative path. */
  images: Map<string, Uint8Array>;
}

/** Axis-aligned bounds of an item in world units, used to build `index.bin`. */
export function itemBounds(item: NotateItem): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  if (item.kind === 'stroke') {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const p of item.points) {
      if (p.x < left) left = p.x;
      if (p.y < top) top = p.y;
      if (p.x > right) right = p.x;
      if (p.y > bottom) bottom = p.y;
    }
    if (!isFinite(left)) return { left: 0, top: 0, right: 0, bottom: 0 };
    return { left, top, right, bottom };
  }
  return {
    left: item.x,
    top: item.y,
    right: item.x + item.width,
    bottom: item.y + item.height,
  };
}

/** Center of an item, used to assign it to a region bucket. */
export function itemCenter(item: NotateItem): { cx: number; cy: number } {
  const b = itemBounds(item);
  return { cx: (b.left + b.right) / 2, cy: (b.top + b.bottom) / 2 };
}
