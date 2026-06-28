import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { readNotate } from './decode.js';
import { writeNotate } from './encode.js';
import { argbToHex, hexToArgb } from './color.js';
import {
  type NotateDoc,
  StrokeType,
  LinkType,
  defaultMeta,
} from './model.js';

function sampleDoc(): NotateDoc {
  return {
    meta: { ...defaultMeta(), uuid: 'test-uuid-1234' },
    items: [
      {
        kind: 'stroke',
        points: [
          { x: 10, y: 20, pressure: 0.5, size: 3, tiltX: 0, tiltY: 0, timestamp: 1000 },
          { x: 15, y: 25, pressure: 0.6, size: 3, tiltX: 1, tiltY: 2, timestamp: 1010 },
          { x: 30, y: 40, pressure: 0.7, size: 3, tiltX: 0, tiltY: 0, timestamp: 1020 },
        ],
        color: hexToArgb('#1971c2'),
        width: 4,
        style: StrokeType.FINELINER,
        strokeOrder: 1,
        zIndex: 0,
      },
      // A stroke far away, to exercise multi-region bucketing.
      {
        kind: 'stroke',
        points: [
          { x: 9000, y: 9000, pressure: 0.5, size: 2, tiltX: 0, tiltY: 0, timestamp: 0 },
          { x: 9100, y: 9100, pressure: 0.5, size: 2, tiltX: 0, tiltY: 0, timestamp: 0 },
        ],
        color: hexToArgb('#e03131'),
        width: 2,
        style: StrokeType.HIGHLIGHTER,
        strokeOrder: 2,
        zIndex: -1,
      },
      {
        kind: 'text',
        text: 'Hello notate',
        x: 100,
        y: 200,
        width: 180,
        height: 30,
        fontSize: 24,
        color: hexToArgb('#000000'),
        zIndex: 0,
        order: 3,
        rotation: 0,
        opacity: 1,
        alignment: 2,
        backgroundColor: 0,
      },
      {
        kind: 'link',
        label: 'open',
        target: 'https://example.com',
        x: 50,
        y: 50,
        width: 80,
        height: 24,
        zIndex: 0,
        order: 4,
        color: hexToArgb('#1971c2'),
        rotation: 0,
        type: LinkType.EXTERNAL_URL,
        fontSize: 20,
      },
      {
        kind: 'image',
        uri: 'images/pic.png',
        x: 300,
        y: 300,
        width: 120,
        height: 90,
        zIndex: 0,
        order: 5,
        rotation: 0,
        opacity: 1,
      },
    ],
    images: new Map([['images/pic.png', new Uint8Array([1, 2, 3, 4, 5])]]),
  };
}

describe('notate codec round-trip', () => {
  it('produces a valid ZIP with the expected entries', () => {
    const bytes = writeNotate(sampleDoc());
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4b); // K
    const entries = unzipSync(bytes);
    const names = Object.keys(entries);
    expect(names).toContain('manifest.bin');
    expect(names).toContain('index.bin');
    expect(names).toContain('images/pic.png');
    // Two strokes in different regions -> two region files.
    expect(names.filter((n) => /^r_-?\d+_-?\d+\.bin$/.test(n)).length).toBe(2);
  });

  it('round-trips items through write -> read', () => {
    const original = sampleDoc();
    const restored = readNotate(writeNotate(original));

    expect(restored.meta.uuid).toBe('test-uuid-1234');
    expect(restored.items.length).toBe(original.items.length);

    const strokes = restored.items.filter((i) => i.kind === 'stroke');
    expect(strokes.length).toBe(2);
    const s0 = strokes.find((s) => s.strokeOrder === 1)!;
    expect(s0.kind).toBe('stroke');
    if (s0.kind === 'stroke') {
      expect(s0.points.length).toBe(3);
      expect(s0.points[1].x).toBeCloseTo(15, 3);
      expect(s0.points[1].y).toBeCloseTo(25, 3);
      expect(s0.points[1].tiltY).toBeCloseTo(2, 3);
      expect(argbToHex(s0.color)).toBe('#1971c2');
      expect(s0.style).toBe(StrokeType.FINELINER);
    }

    const text = restored.items.find((i) => i.kind === 'text');
    expect(text?.kind).toBe('text');
    if (text?.kind === 'text') {
      expect(text.text).toBe('Hello notate');
      expect(text.alignment).toBe(2);
      expect(text.x).toBeCloseTo(100, 3);
    }

    const link = restored.items.find((i) => i.kind === 'link');
    if (link?.kind === 'link') {
      expect(link.target).toBe('https://example.com');
      expect(link.type).toBe(LinkType.EXTERNAL_URL);
    }

    const image = restored.items.find((i) => i.kind === 'image');
    if (image?.kind === 'image') {
      expect(image.uri).toBe('images/pic.png');
    }
    expect(Array.from(restored.images.get('images/pic.png')!)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it('rejects non-zip input', () => {
    expect(() => readNotate(new Uint8Array([1, 2, 3, 4]))).toThrow();
  });
});

describe('color conversion', () => {
  it('round-trips hex -> argb -> hex', () => {
    for (const hex of ['#000000', '#ffffff', '#1971c2', '#e03131']) {
      expect(argbToHex(hexToArgb(hex))).toBe(hex);
    }
  });
});
