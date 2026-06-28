/**
 * Rasterize Excalidraw vector shapes (rectangle, ellipse, diamond, line, arrow)
 * into polyline point lists in absolute world coordinates. notate has no native
 * vector primitives — only pen strokes — so this is how mermaid diagrams and
 * Excalidraw shapes become editable notate strokes.
 */
import type { AnyExcalidrawElement } from './excalidraw-types.js';
import { rotatePoint } from './util.js';

const ELLIPSE_SEGMENTS = 48;

type Pt = [number, number];

function place(
  local: Pt[],
  el: AnyExcalidrawElement,
): Pt[] {
  const cx = el.width / 2;
  const cy = el.height / 2;
  const angle = el.angle || 0;
  return local.map(([lx, ly]) => {
    const [rx, ry] = rotatePoint(lx, ly, cx, cy, angle);
    return [el.x + rx, el.y + ry];
  });
}

function rectanglePoints(el: AnyExcalidrawElement): Pt[] {
  const { width: w, height: h } = el;
  return place(
    [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
      [0, 0],
    ],
    el,
  );
}

function diamondPoints(el: AnyExcalidrawElement): Pt[] {
  const { width: w, height: h } = el;
  return place(
    [
      [w / 2, 0],
      [w, h / 2],
      [w / 2, h],
      [0, h / 2],
      [w / 2, 0],
    ],
    el,
  );
}

function ellipsePoints(el: AnyExcalidrawElement): Pt[] {
  const rx = el.width / 2;
  const ry = el.height / 2;
  const local: Pt[] = [];
  for (let i = 0; i <= ELLIPSE_SEGMENTS; i++) {
    const t = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
    local.push([rx + rx * Math.cos(t), ry + ry * Math.sin(t)]);
  }
  return place(local, el);
}

function linearPoints(el: AnyExcalidrawElement): Pt[] {
  const pts = (el.points as Pt[] | undefined) ?? [
    [0, 0],
    [el.width, el.height],
  ];
  return place(pts, el);
}

/** Short arrowhead barbs at the final segment of a polyline. */
function arrowHead(points: Pt[], size = 12): Pt[][] {
  if (points.length < 2) return [];
  const [tipX, tipY] = points[points.length - 1];
  const [prevX, prevY] = points[points.length - 2];
  const ang = Math.atan2(tipY - prevY, tipX - prevX);
  const spread = Math.PI / 7;
  const a1 = ang + Math.PI - spread;
  const a2 = ang + Math.PI + spread;
  return [
    [
      [tipX, tipY],
      [tipX + size * Math.cos(a1), tipY + size * Math.sin(a1)],
    ],
    [
      [tipX, tipY],
      [tipX + size * Math.cos(a2), tipY + size * Math.sin(a2)],
    ],
  ];
}

/**
 * Convert a shape element into one or more polylines (absolute coords).
 * Returns an empty array for element types that aren't shapes.
 */
export function rasterizeShape(el: AnyExcalidrawElement): Pt[][] {
  switch (el.type) {
    case 'rectangle':
      return [rectanglePoints(el)];
    case 'diamond':
      return [diamondPoints(el)];
    case 'ellipse':
      return [ellipsePoints(el)];
    case 'line': {
      return [linearPoints(el)];
    }
    case 'arrow': {
      const main = linearPoints(el);
      const polylines = [main];
      if (el.endArrowhead !== null) polylines.push(...arrowHead(main));
      if (el.startArrowhead && el.startArrowhead !== null) {
        polylines.push(...arrowHead([...main].reverse()));
      }
      return polylines;
    }
    default:
      return [];
  }
}

export const RASTERIZABLE = new Set([
  'rectangle',
  'diamond',
  'ellipse',
  'line',
  'arrow',
]);
