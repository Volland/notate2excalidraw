import { describe, expect, it } from 'vitest';
import {
  type NotateDoc,
  StrokeType,
  defaultMeta,
  hexToArgb,
  writeNotate,
  readNotate,
} from '@notate/codec';
import { notateToScene } from './toExcalidraw.js';
import { sceneToNotate } from './fromExcalidraw.js';
import { rasterizeShape } from './rasterize.js';
import { baseElement } from './util.js';
import type { AnyExcalidrawElement } from './excalidraw-types.js';
import { mermaidToNotateDoc, type MermaidDeps } from './mermaidToNotate.js';

function strokeDoc(): NotateDoc {
  return {
    meta: defaultMeta(),
    items: [
      {
        kind: 'stroke',
        points: [
          { x: 10, y: 10, pressure: 2048, size: 3, tiltX: 0, tiltY: 0, timestamp: 0 },
          { x: 20, y: 30, pressure: 4096, size: 3, tiltX: 0, tiltY: 0, timestamp: 0 },
          { x: 40, y: 10, pressure: 1024, size: 3, tiltX: 0, tiltY: 0, timestamp: 0 },
        ],
        color: hexToArgb('#e03131'),
        width: 3,
        style: StrokeType.FINELINER,
        strokeOrder: 1,
        zIndex: 0,
      },
      {
        kind: 'text',
        text: 'hi',
        x: 5,
        y: 5,
        width: 40,
        height: 24,
        fontSize: 20,
        color: hexToArgb('#000000'),
        zIndex: 0,
        order: 2,
        rotation: 0,
        opacity: 1,
        alignment: 0,
        backgroundColor: 0,
      },
    ],
    images: new Map(),
  };
}

describe('notate -> excalidraw', () => {
  it('maps strokes to freedraw with relative points and normalized pressure', () => {
    const { elements } = notateToScene(strokeDoc());
    const fd = elements.find((e) => e.type === 'freedraw')!;
    expect(fd).toBeTruthy();
    // x/y is the min corner; points are relative.
    expect(fd.x).toBeCloseTo(10, 3);
    expect(fd.y).toBeCloseTo(10, 3);
    expect((fd.points as number[][])[0]).toEqual([0, 0]);
    expect((fd.points as number[][])[1]).toEqual([10, 20]);
    // pressures normalized into 0..1
    for (const p of fd.pressures as number[]) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
    expect(fd.strokeColor).toBe('#e03131');

    const text = elements.find((e) => e.type === 'text')!;
    expect(text.text).toBe('hi');
  });
});

describe('excalidraw -> notate', () => {
  it('round-trips a freedraw stroke back to absolute coords', () => {
    const { elements } = notateToScene(strokeDoc());
    const { doc } = sceneToNotate(elements, {});
    const stroke = doc.items.find((i) => i.kind === 'stroke');
    expect(stroke?.kind).toBe('stroke');
    if (stroke?.kind === 'stroke') {
      expect(stroke.points[0].x).toBeCloseTo(10, 2);
      expect(stroke.points[1].x).toBeCloseTo(20, 2);
      expect(stroke.points[1].y).toBeCloseTo(30, 2);
    }
  });

  it('rasterizes a rectangle into a closed 5-point stroke', () => {
    const rect = baseElement({
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 50,
      height: 20,
    }) as AnyExcalidrawElement;
    const polys = rasterizeShape(rect);
    expect(polys.length).toBe(1);
    expect(polys[0].length).toBe(5);
    expect(polys[0][0]).toEqual([100, 100]);
    expect(polys[0][2]).toEqual([150, 120]);
    expect(polys[0][4]).toEqual([100, 100]); // closed

    const { doc } = sceneToNotate([rect], {});
    const s = doc.items.find((i) => i.kind === 'stroke');
    expect(s?.kind).toBe('stroke');
  });

  it('produces an arrow polyline plus arrowhead barbs', () => {
    const arrow = baseElement({
      type: 'arrow',
      x: 0,
      y: 0,
      width: 100,
      height: 0,
      points: [
        [0, 0],
        [100, 0],
      ],
      endArrowhead: 'arrow',
      startArrowhead: null,
    }) as AnyExcalidrawElement;
    const polys = rasterizeShape(arrow);
    // main line + 2 barbs
    expect(polys.length).toBe(3);
  });
});

describe('mermaid -> notate (injected deps)', () => {
  it('runs the pipeline and rasterizes shapes to strokes', async () => {
    // Fake the two Excalidraw functions: a node + an arrow.
    const deps: MermaidDeps = {
      parseMermaidToExcalidraw: async () => ({
        elements: [
          { type: 'rectangle', x: 0, y: 0, width: 80, height: 40 },
          { type: 'arrow', x: 80, y: 20, width: 60, height: 0, points: [[0, 0], [60, 0]], endArrowhead: 'arrow' },
          { type: 'text', x: 10, y: 10, text: 'A' },
        ],
        files: null,
      }),
      convertToExcalidrawElements: (skeletons) =>
        (skeletons as Record<string, unknown>[]).map(
          (s) => baseElement(s as { type: string }) as AnyExcalidrawElement,
        ),
    };

    const { doc } = await mermaidToNotateDoc('graph TD; A-->B', deps);
    const strokes = doc.items.filter((i) => i.kind === 'stroke');
    const texts = doc.items.filter((i) => i.kind === 'text');
    expect(strokes.length).toBeGreaterThanOrEqual(2); // rect + arrow line
    expect(texts.length).toBe(1);

    // And the doc encodes to a valid .notate that reads back.
    const restored = readNotate(writeNotate(doc));
    expect(restored.items.length).toBe(doc.items.length);
  });
});
