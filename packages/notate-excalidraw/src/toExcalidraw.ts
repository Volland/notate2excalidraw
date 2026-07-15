/** Convert a notate document into an Excalidraw scene (elements + files). */
import {
  argbAlpha,
  argbToHex,
  type ImageItem,
  type LinkItem,
  type NotateDoc,
  type StrokeItem,
  StrokeType,
  type TextItem,
} from '@notate/codec';
import type {
  AnyExcalidrawElement,
  BinaryFiles,
  ExcalidrawScene,
} from './excalidraw-types.js';
import {
  baseElement,
  bytesToDataUrl,
  extForMime,
  genId,
  mimeForExt,
} from './util.js';
import { DEVICE_MAX_PRESSURE, FREEDRAW_SIZE_FACTOR } from './constants.js';

const SOURCE = 'notate-excalidraw';

function strokeToFreedraw(s: StrokeItem): AnyExcalidrawElement {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxP = 0;
  for (const p of s.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.pressure > maxP) maxP = p.pressure;
  }
  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  const points: [number, number][] = s.points.map((p) => [p.x - minX, p.y - minY]);
  // Normalize raw device pressure (~0..4096) into Excalidraw's 0..1 range.
  // Use the fixed device scale (not per-stroke max) so a light stroke stays
  // light instead of being stretched to full pressure.
  const norm = maxP > DEVICE_MAX_PRESSURE ? maxP : DEVICE_MAX_PRESSURE;
  const pressures = s.points.map((p) => {
    const v = p.pressure > 0 ? p.pressure / norm : 0.5;
    return v < 0 ? 0 : v > 1 ? 1 : v;
  });

  const isHighlighter = s.style === StrokeType.HIGHLIGHTER;
  const opacity = isHighlighter ? 50 : Math.round(argbAlpha(s.color) * 100) || 100;

  return baseElement({
    type: 'freedraw',
    id: genId('stroke'),
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
    strokeColor: argbToHex(s.color),
    // notate stores the actual pixel width; Excalidraw multiplies strokeWidth by
    // FREEDRAW_SIZE_FACTOR when rendering, so divide to match the real thickness.
    strokeWidth: Math.max(0.25, s.width / FREEDRAW_SIZE_FACTOR),
    strokeStyle: s.style === StrokeType.DASH ? 'dashed' : 'solid',
    opacity,
    points,
    pressures,
    simulatePressure: false,
    lastCommittedPoint: points.length ? points[points.length - 1] : null,
    roughness: 0,
  }) as AnyExcalidrawElement;
}

function textToElement(t: TextItem): AnyExcalidrawElement {
  const align = t.alignment === 1 ? 'right' : t.alignment === 2 ? 'center' : 'left';
  const fontSize = t.fontSize || 20;
  return baseElement({
    type: 'text',
    id: genId('text'),
    x: t.x,
    y: t.y,
    width: t.width || fontSize * Math.max(1, t.text.length) * 0.5,
    height: t.height || fontSize * 1.25,
    angle: t.rotation || 0,
    strokeColor: argbToHex(t.color),
    opacity: Math.round((t.opacity ?? 1) * 100),
    text: t.text,
    originalText: t.text,
    fontSize,
    fontFamily: 1,
    textAlign: align,
    verticalAlign: 'top',
    containerId: null,
    lineHeight: 1.25,
    autoResize: true,
  }) as AnyExcalidrawElement;
}

function linkToElement(l: LinkItem): AnyExcalidrawElement {
  const fontSize = l.fontSize || 20;
  return baseElement({
    type: 'text',
    id: genId('link'),
    x: l.x,
    y: l.y,
    width: l.width || fontSize * Math.max(1, l.label.length) * 0.5,
    height: l.height || fontSize * 1.25,
    angle: l.rotation || 0,
    strokeColor: argbToHex(l.color),
    text: l.label || l.target,
    originalText: l.label || l.target,
    fontSize,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    lineHeight: 1.25,
    autoResize: true,
    link: l.target,
  }) as AnyExcalidrawElement;
}

function imageToElement(
  im: ImageItem,
  doc: NotateDoc,
  files: BinaryFiles,
): AnyExcalidrawElement | null {
  const bytes = doc.images.get(im.uri) ?? doc.images.get(im.uri.replace(/^\/+/, ''));
  if (!bytes) return null;
  const ext = im.uri.split('.').pop() ?? 'png';
  const mimeType = mimeForExt(ext);
  const fileId = genId('file');
  files[fileId] = {
    id: fileId,
    mimeType,
    dataURL: bytesToDataUrl(bytes, mimeType),
    created: Date.now(),
  };
  void extForMime;
  return baseElement({
    type: 'image',
    id: genId('image'),
    x: im.x,
    y: im.y,
    width: im.width,
    height: im.height,
    angle: im.rotation || 0,
    opacity: Math.round((im.opacity ?? 1) * 100),
    fileId,
    status: 'saved',
    scale: [1, 1],
  }) as AnyExcalidrawElement;
}

/** Map a {@link NotateDoc} to Excalidraw elements + binary files. */
export function notateToScene(doc: NotateDoc): {
  elements: AnyExcalidrawElement[];
  files: BinaryFiles;
} {
  const elements: AnyExcalidrawElement[] = [];
  const files: BinaryFiles = {};

  // notate draws by (zIndex, order); preserve that paint order.
  const ordered = [...doc.items].sort((a, b) => {
    const za = a.kind === 'stroke' ? a.zIndex : a.zIndex;
    const zb = b.kind === 'stroke' ? b.zIndex : b.zIndex;
    if (za !== zb) return za - zb;
    const oa = a.kind === 'stroke' ? a.strokeOrder : a.order;
    const ob = b.kind === 'stroke' ? b.strokeOrder : b.order;
    return oa - ob;
  });

  for (const item of ordered) {
    switch (item.kind) {
      case 'stroke':
        if (item.points.length > 0) elements.push(strokeToFreedraw(item));
        break;
      case 'text':
        elements.push(textToElement(item));
        break;
      case 'link':
        elements.push(linkToElement(item));
        break;
      case 'image': {
        const el = imageToElement(item, doc, files);
        if (el) elements.push(el);
        break;
      }
    }
  }

  return { elements, files };
}

/** Produce a full `.excalidraw` scene object (ready to JSON.stringify). */
export function notateToExcalidrawScene(doc: NotateDoc): ExcalidrawScene {
  const { elements, files } = notateToScene(doc);
  return {
    type: 'excalidraw',
    version: 2,
    source: SOURCE,
    elements,
    appState: { viewBackgroundColor: '#ffffff', gridSize: null },
    files,
  };
}
