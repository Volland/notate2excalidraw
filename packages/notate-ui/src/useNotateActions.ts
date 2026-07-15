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

function stripExt(name: string): string {
  return name.replace(/\.[^./\\]+$/, '');
}

export interface NotateActions {
  loadBytes: (data: Uint8Array, name?: string, location?: string) => void;
  open: () => Promise<void>;
  saveNotate: (forceDialog?: boolean) => Promise<void>;
  exportExcalidraw: () => Promise<void>;
  exportImage: (format: 'png' | 'svg') => Promise<void>;
  importMermaid: (definition: string) => Promise<void>;
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

  return { loadBytes, open, saveNotate, exportExcalidraw, exportImage, importMermaid };
}
