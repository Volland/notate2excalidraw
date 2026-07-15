/** Convert an Excalidraw scene back into a notate document. */
import {
  defaultMeta,
  hexToArgb,
  type ImageItem,
  type LinkItem,
  type NotateDoc,
  type NotateItem,
  type StrokeItem,
  type StrokePoint,
  StrokeType,
  LinkType,
  type TextItem,
} from '@notate/codec';
import type {
  AnyExcalidrawElement,
  BinaryFiles,
} from './excalidraw-types.js';
import { rasterizeShape, RASTERIZABLE } from './rasterize.js';
import { extForMime, genId, parseDataUrl } from './util.js';
import { DEVICE_MAX_PRESSURE, FREEDRAW_SIZE_FACTOR } from './constants.js';

const DEFAULT_PRESSURE = 0.5;

function alignmentFromText(a: string | undefined): number {
  if (a === 'right') return 1;
  if (a === 'center') return 2;
  return 0;
}

function freedrawToStroke(el: AnyExcalidrawElement, order: number): StrokeItem {
  const pts = (el.points as [number, number][] | undefined) ?? [];
  const pressures = (el.pressures as number[] | undefined) ?? [];
  // Invert the notate->Excalidraw width mapping so edits round-trip to the
  // real notate pixel width.
  const width = Math.max(1, (el.strokeWidth || 1) * FREEDRAW_SIZE_FACTOR);
  const points: StrokePoint[] = pts.map((p, i) => ({
    x: el.x + p[0],
    y: el.y + p[1],
    // Restore raw device pressure scale for notate/Onyx.
    pressure: (pressures[i] ?? DEFAULT_PRESSURE) * DEVICE_MAX_PRESSURE,
    size: width,
    tiltX: 0,
    tiltY: 0,
    timestamp: 0,
  }));
  const opacityAlpha = (el.opacity ?? 100) / 100;
  return {
    kind: 'stroke',
    points,
    color: hexToArgb(el.strokeColor, opacityAlpha),
    width,
    style: el.opacity != null && el.opacity < 70 ? StrokeType.HIGHLIGHTER : StrokeType.FINELINER,
    strokeOrder: order,
    zIndex: 0,
  };
}

function polylineToStroke(
  points: [number, number][],
  el: AnyExcalidrawElement,
  order: number,
): StrokeItem {
  const width = Math.max(1, (el.strokeWidth || 1) * FREEDRAW_SIZE_FACTOR);
  const opacityAlpha = (el.opacity ?? 100) / 100;
  return {
    kind: 'stroke',
    points: points.map(([x, y]) => ({
      x,
      y,
      pressure: DEFAULT_PRESSURE * DEVICE_MAX_PRESSURE,
      size: width,
      tiltX: 0,
      tiltY: 0,
      timestamp: 0,
    })),
    color: hexToArgb(el.strokeColor, opacityAlpha),
    width,
    style: el.strokeStyle === 'dashed' || el.strokeStyle === 'dotted' ? StrokeType.DASH : StrokeType.FINELINER,
    strokeOrder: order,
    zIndex: 0,
  };
}

function textToItem(el: AnyExcalidrawElement, order: number): TextItem {
  return {
    kind: 'text',
    text: String(el.text ?? ''),
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    fontSize: (el.fontSize as number) ?? 20,
    color: hexToArgb(el.strokeColor),
    zIndex: 0,
    order,
    rotation: el.angle || 0,
    opacity: (el.opacity ?? 100) / 100,
    alignment: alignmentFromText(el.textAlign as string | undefined),
    backgroundColor: 0,
  };
}

function textToLink(el: AnyExcalidrawElement, order: number): LinkItem {
  const target = String(el.link ?? '');
  return {
    kind: 'link',
    label: String(el.text ?? target),
    target,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    zIndex: 0,
    order,
    color: hexToArgb(el.strokeColor),
    rotation: el.angle || 0,
    type: /^https?:/i.test(target)
      ? LinkType.EXTERNAL_URL
      : target.startsWith('file:') || target.startsWith('/')
        ? LinkType.LOCAL_FILE
        : LinkType.INTERNAL_NOTE,
    fontSize: (el.fontSize as number) ?? 20,
  };
}

function imageToItem(
  el: AnyExcalidrawElement,
  files: BinaryFiles,
  images: Map<string, Uint8Array>,
  order: number,
): ImageItem | null {
  const fileId = el.fileId as string | undefined;
  if (!fileId) return null;
  const file = files[fileId];
  if (!file) return null;
  const parsed = parseDataUrl(file.dataURL);
  if (!parsed) return null;
  const ext = extForMime(file.mimeType || parsed.mimeType);
  const uri = `images/${fileId}.${ext}`;
  images.set(uri, parsed.bytes);
  return {
    kind: 'image',
    uri,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    zIndex: 0,
    order,
    rotation: el.angle || 0,
    opacity: (el.opacity ?? 100) / 100,
  };
}

export interface ConversionWarning {
  type: string;
  reason: string;
}

/**
 * Convert Excalidraw elements + files to a {@link NotateDoc}. Vector shapes are
 * rasterized into pen strokes; unsupported element types are skipped and
 * reported in `warnings`.
 */
export function sceneToNotate(
  elements: AnyExcalidrawElement[],
  files: BinaryFiles = {},
  baseDoc?: Partial<NotateDoc>,
): { doc: NotateDoc; warnings: ConversionWarning[] } {
  const items: NotateItem[] = [];
  const images = new Map<string, Uint8Array>(baseDoc?.images ?? []);
  const warnings: ConversionWarning[] = [];
  let order = 1;

  for (const el of elements) {
    if (el.isDeleted) continue;
    switch (el.type) {
      case 'freedraw':
        items.push(freedrawToStroke(el, order++));
        break;
      case 'text':
        if (el.link) items.push(textToLink(el, order++));
        else items.push(textToItem(el, order++));
        break;
      case 'image': {
        const im = imageToItem(el, files, images, order++);
        if (im) items.push(im);
        else warnings.push({ type: 'image', reason: 'missing file data' });
        break;
      }
      default:
        if (RASTERIZABLE.has(el.type)) {
          for (const poly of rasterizeShape(el)) {
            if (poly.length >= 2) items.push(polylineToStroke(poly, el, order++));
          }
          // A shape may carry a bound text label as a separate text element,
          // which is handled when that element is iterated.
        } else {
          warnings.push({ type: el.type, reason: 'unsupported element type' });
        }
    }
  }

  return {
    doc: {
      meta: { ...defaultMeta(), ...baseDoc?.meta },
      items,
      images,
    },
    warnings,
  };
}
