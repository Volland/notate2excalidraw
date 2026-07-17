/**
 * Shared canvas orchestration: load a `.notate`, save back, export
 * (excalidraw/png/svg) and import Mermaid. UI-framework-agnostic beyond React
 * hooks; the host app supplies a {@link Platform} and an Excalidraw API ref and
 * wires these callbacks to whatever UI it has (a native menu on desktop, an
 * on-screen toolbar on mobile).
 */
import { type MutableRefObject, useCallback, useRef } from 'react';
import { exportToBlob, exportToSvg } from '@excalidraw/excalidraw';
import type { NotateMeta } from '@notate/codec';
import type { ExcalidrawAPILike, Platform } from './platform.js';
import type { BannerState } from './Banner.js';
import {
  mermaidToExcalidraw,
  notateBytesToScene,
  sceneToExcalidrawJSON,
  sceneToNotateBytes,
} from './scene.js';
import {
  DEFAULT_AI_MODEL,
  contentBounds,
  recognizedToElements,
} from './aiRecognize.js';
import {
  TEXT_TILE_PROMPT,
  type PlacedText,
  analyzeStrokes,
  assembleTiled,
  dedupeTexts,
  parseTextItems,
  planTiles,
  renderTile,
  snapToInk,
  strokesFromElements,
} from './hybrid.js';

function stripExt(name: string): string {
  return name.replace(/\.[^./\\]+$/, '');
}

/** Longest image side sent to the vision model (keeps it fast + in-distribution). */
const AI_IMAGE_MAX_PX = 1400;
const AI_EXPORT_PAD = 16;

export interface NotateActions {
  loadBytes: (data: Uint8Array, name?: string, location?: string) => void;
  open: () => Promise<void>;
  saveNotate: (forceDialog?: boolean) => Promise<void>;
  exportExcalidraw: () => Promise<void>;
  exportImage: (format: 'png' | 'svg') => Promise<void>;
  importMermaid: (definition: string) => Promise<void>;
  /** Whole-image recognition (model returns boxes + text). */
  recognize: (model?: string) => Promise<void>;
  /** Hybrid: geometry for shapes, model OCR only for text, snapped to ink. */
  recognizeHybrid: (model?: string) => Promise<void>;
  aiAvailable: boolean;
}

export function useNotateActions(opts: {
  apiRef: MutableRefObject<ExcalidrawAPILike | null>;
  platform: Platform;
  notify: (b: BannerState) => void;
}): NotateActions {
  const { apiRef, platform, notify } = opts;
  const metaRef = useRef<Partial<NotateMeta> | undefined>(undefined);
  const locationRef = useRef<string | null>(null);
  const nameRef = useRef<string>('note.notate');

  const loadBytes = useCallback(
    (data: Uint8Array, name?: string, location?: string) => {
      const api = apiRef.current;
      if (!api) return;
      try {
        const { elements, files, meta } = notateBytesToScene(data);
        metaRef.current = meta;
        if (name) nameRef.current = name;
        locationRef.current = location ?? null;
        api.resetScene();
        if (Object.keys(files).length) api.addFiles(Object.values(files));
        api.updateScene({ elements });
        if (elements.length) {
          // Defer the fit until Excalidraw has committed the new scene and knows
          // the viewport size; otherwise the zoom-to-fit is computed against a
          // stale/zero viewport and the (often very large) canvas appears empty.
          const fit = () =>
            api.scrollToContent(elements as unknown[], {
              fitToContent: true,
              animate: false,
            });
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => requestAnimationFrame(fit));
          } else {
            fit();
          }
        }
        notify({
          kind: 'info',
          message: `Opened ${name ?? 'note'} — ${elements.length} elements.`,
        });
      } catch (err) {
        notify({ kind: 'error', message: `Could not open file: ${String(err)}` });
      }
    },
    [apiRef, notify],
  );

  const open = useCallback(async () => {
    try {
      const res = await platform.openFile();
      if (res) loadBytes(res.data, res.name, res.location);
    } catch (err) {
      notify({ kind: 'error', message: `Open failed: ${String(err)}` });
    }
  }, [platform, loadBytes, notify]);

  const saveNotate = useCallback(
    async (forceDialog = false) => {
      const api = apiRef.current;
      if (!api) return;
      const { bytes, warnings } = sceneToNotateBytes(
        api.getSceneElements(),
        api.getFiles(),
        metaRef.current,
      );
      try {
        const res = await platform.saveFile({
          data: bytes,
          suggestedName: nameRef.current.endsWith('.notate')
            ? nameRef.current
            : `${stripExt(nameRef.current)}.notate`,
          mimeType: 'application/zip',
          ext: 'notate',
          currentLocation: locationRef.current,
          forceDialog,
        });
        if (!res) return;
        locationRef.current = res.location;
        const warn =
          warnings.length > 0
            ? ` (${warnings.length} unsupported element(s) skipped)`
            : '';
        notify({ kind: 'info', message: `Saved to ${res.location}${warn}.` });
      } catch (err) {
        notify({ kind: 'error', message: `Save failed: ${String(err)}` });
      }
    },
    [apiRef, platform, notify],
  );

  const exportExcalidraw = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    const json = sceneToExcalidrawJSON(
      api.getSceneElements(),
      api.getAppState(),
      api.getFiles(),
    );
    try {
      const res = await platform.saveFile({
        data: new TextEncoder().encode(json),
        suggestedName: `${stripExt(nameRef.current)}.excalidraw`,
        mimeType: 'application/json',
        ext: 'excalidraw',
        forceDialog: true,
      });
      if (res) notify({ kind: 'info', message: `Exported to ${res.location}.` });
    } catch (err) {
      notify({ kind: 'error', message: `Export failed: ${String(err)}` });
    }
  }, [apiRef, platform, notify]);

  const exportImage = useCallback(
    async (format: 'png' | 'svg') => {
      const api = apiRef.current;
      if (!api) return;
      const elements = api.getSceneElements();
      if (!elements.length) {
        notify({ kind: 'error', message: 'Nothing to export.' });
        return;
      }
      const files = api.getFiles();
      const appState = { exportBackground: true, viewBackgroundColor: '#ffffff' };
      let data: Uint8Array;
      let mimeType: string;
      if (format === 'png') {
        const blob = await exportToBlob({
          elements: elements as never,
          files: files as never,
          appState: appState as never,
          mimeType: 'image/png',
        });
        data = new Uint8Array(await blob.arrayBuffer());
        mimeType = 'image/png';
      } else {
        const svg = await exportToSvg({
          elements: elements as never,
          files: files as never,
          appState: appState as never,
          exportPadding: 16,
        });
        data = new TextEncoder().encode(svg.outerHTML);
        mimeType = 'image/svg+xml';
      }
      try {
        const res = await platform.saveFile({
          data,
          suggestedName: `${stripExt(nameRef.current)}.${format}`,
          mimeType,
          ext: format,
          forceDialog: true,
        });
        if (res) notify({ kind: 'info', message: `Exported to ${res.location}.` });
      } catch (err) {
        notify({ kind: 'error', message: `Export failed: ${String(err)}` });
      }
    },
    [apiRef, platform, notify],
  );

  const importMermaid = useCallback(
    async (definition: string) => {
      const api = apiRef.current;
      if (!api) return;
      try {
        const { elements: newEls, files } = await mermaidToExcalidraw(definition);
        if (Object.keys(files).length) api.addFiles(Object.values(files));
        const existing = api.getSceneElements();
        api.updateScene({ elements: [...existing, ...newEls] });
        api.scrollToContent(newEls as unknown[], { fitToContent: true });
        notify({
          kind: 'info',
          message: `Added ${newEls.length} elements from Mermaid. Save as .notate to convert to strokes.`,
        });
      } catch (err) {
        notify({ kind: 'error', message: `Mermaid parse failed: ${String(err)}` });
      }
    },
    [apiRef, notify],
  );

  const recognize = useCallback(
    async (model: string = DEFAULT_AI_MODEL) => {
      const api = apiRef.current;
      if (!api) return;
      if (!platform.recognizeDrawing) {
        notify({ kind: 'error', message: 'Local AI recognition is not available here.' });
        return;
      }
      const elements = api.getSceneElements();
      if (!elements.length) {
        notify({ kind: 'error', message: 'Nothing to recognize — open a drawing first.' });
        return;
      }
      try {
        const bounds = contentBounds(elements, AI_EXPORT_PAD);
        const files = api.getFiles();
        const blob = await exportToBlob({
          elements: elements as never,
          files: files as never,
          appState: { exportBackground: true, viewBackgroundColor: '#ffffff' } as never,
          mimeType: 'image/png',
          exportPadding: AI_EXPORT_PAD,
          getDimensions: (w: number, h: number) => {
            const scale = Math.min(1, AI_IMAGE_MAX_PX / Math.max(w, h));
            return { width: Math.round(w * scale), height: Math.round(h * scale), scale };
          },
        } as never);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        notify({
          kind: 'info',
          message: `Recognizing with ${model}… local AI, this can take up to a minute.`,
        });
        const items = await platform.recognizeDrawing(bytes, model);
        // Place the cleaned copy to the right of the original ink.
        const gap = Math.max(120, bounds.w * 0.12);
        const newEls = recognizedToElements(items, bounds, bounds.w + gap);
        if (!newEls.length) {
          notify({ kind: 'error', message: 'The model returned no usable elements.' });
          return;
        }
        api.updateScene({ elements: [...elements, ...newEls] });
        api.scrollToContent(newEls as unknown[], { fitToContent: true });
        notify({
          kind: 'info',
          message: `Added ${newEls.length} recognized element(s) beside the drawing.`,
        });
      } catch (err) {
        notify({ kind: 'error', message: `Recognition failed: ${String(err)}` });
      }
    },
    [apiRef, platform, notify],
  );

  const recognizeHybrid = useCallback(
    async (model: string = DEFAULT_AI_MODEL) => {
      const api = apiRef.current;
      if (!api) return;
      if (!platform.visionText) {
        notify({ kind: 'error', message: 'Local AI recognition is not available here.' });
        return;
      }
      const all = api.getSceneElements();
      const strokes = strokesFromElements(all);
      if (!strokes.length) {
        notify({ kind: 'error', message: 'No pen strokes to recognize.' });
        return;
      }
      try {
        const { shapes, textStrokes, doodles, bounds, medianH } = analyzeStrokes(strokes);
        const tiles = planTiles(bounds, medianH);
        const placed: PlacedText[] = [];
        for (let i = 0; i < tiles.length; i++) {
          const bytes = renderTile(strokes, tiles[i]);
          if (!bytes) continue;
          notify({
            kind: 'info',
            message: `Reading handwriting with ${model}… tile ${i + 1}/${tiles.length}.`,
          });
          const raw = await platform.visionText(bytes, model, TEXT_TILE_PROMPT);
          for (const it of parseTextItems(raw)) {
            placed.push(snapToInk(it, tiles[i], textStrokes));
          }
        }
        const texts = dedupeTexts(placed);
        const gap = Math.max(120, bounds.w * 0.12);
        const newEls = assembleTiled({
          shapes,
          texts,
          doodles,
          offsetX: bounds.w + gap,
        });
        if (!newEls.length) {
          notify({ kind: 'error', message: 'Nothing could be recognized.' });
          return;
        }
        api.updateScene({ elements: [...all, ...newEls] });
        api.scrollToContent(newEls as unknown[], { fitToContent: true });
        notify({
          kind: 'info',
          message: `Cleaned copy added: ${shapes.length} shape(s), ${texts.length} text label(s).`,
        });
      } catch (err) {
        notify({ kind: 'error', message: `Recognition failed: ${String(err)}` });
      }
    },
    [apiRef, platform, notify],
  );

  return {
    loadBytes,
    open,
    saveNotate,
    exportExcalidraw,
    exportImage,
    importMermaid,
    recognize,
    recognizeHybrid,
    aiAvailable:
      typeof platform.visionText === 'function' ||
      typeof platform.recognizeDrawing === 'function',
  };
}
