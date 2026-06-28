import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Excalidraw,
  exportToBlob,
  exportToSvg,
} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { NotateMeta } from '@notate/codec';
import type { AnyExcalidrawElement, BinaryFiles } from '@notate/excalidraw';
import {
  mermaidToScene2,
  notateBytesToScene,
  sceneToExcalidrawJSON,
  sceneToNotateBytes,
} from './scene.js';
import { MermaidDialog } from './MermaidDialog.js';
import { Banner, type BannerState } from './Banner.js';

/** Minimal surface of Excalidraw's imperative API that we use. */
interface ExAPI {
  updateScene: (scene: { elements?: readonly unknown[]; appState?: Record<string, unknown> }) => void;
  getSceneElements: () => readonly AnyExcalidrawElement[];
  getFiles: () => BinaryFiles;
  addFiles: (files: unknown[]) => void;
  getAppState: () => Record<string, unknown>;
  scrollToContent: (target?: unknown, opts?: Record<string, unknown>) => void;
  resetScene: () => void;
}

const NOTATE_FILTERS = [{ name: 'Notate Notes', extensions: ['notate'] }];

function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

export default function App(): React.JSX.Element {
  const apiRef = useRef<ExAPI | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const metaRef = useRef<Partial<NotateMeta> | undefined>(undefined);
  const [viewMode, setViewMode] = useState(false);
  const [mermaidOpen, setMermaidOpen] = useState(false);
  const [banner, setBanner] = useState<BannerState | null>(null);

  const notify = useCallback((b: BannerState | null) => setBanner(b), []);

  const loadScene = useCallback(
    (bytes: Uint8Array, path: string | null) => {
      const api = apiRef.current;
      if (!api) return;
      try {
        const { elements, files, meta } = notateBytesToScene(bytes);
        metaRef.current = meta;
        api.resetScene();
        if (Object.keys(files).length) api.addFiles(Object.values(files));
        api.updateScene({ elements });
        if (elements.length) {
          api.scrollToContent(elements as unknown[], { fitToContent: true });
        }
        setCurrentPath(path);
        notify({
          kind: 'info',
          message: `Opened ${path ? basename(path) : 'note'} — ${elements.length} elements.`,
        });
      } catch (err) {
        notify({ kind: 'error', message: `Could not open file: ${String(err)}` });
      }
    },
    [notify],
  );

  const handleOpen = useCallback(async () => {
    const res = await window.notateAPI.openDialog();
    if (res) loadScene(res.data, res.path);
  }, [loadScene]);

  const doSaveNotate = useCallback(
    async (forceDialog: boolean) => {
      const api = apiRef.current;
      if (!api) return;
      const elements = api.getSceneElements();
      const files = api.getFiles();
      const { bytes, warnings } = sceneToNotateBytes(elements, files, metaRef.current);

      let path = currentPath;
      if (forceDialog || !path || !path.toLowerCase().endsWith('.notate')) {
        path = await window.notateAPI.saveDialog({
          defaultName: path ? basename(path) : 'note.notate',
          filters: NOTATE_FILTERS,
        });
      }
      if (!path) return;
      try {
        await window.notateAPI.writeFile(path, bytes);
        setCurrentPath(path);
        const warn =
          warnings.length > 0
            ? ` (${warnings.length} unsupported element(s) skipped)`
            : '';
        notify({ kind: 'info', message: `Saved ${basename(path)}${warn}.` });
      } catch (err) {
        notify({ kind: 'error', message: `Save failed: ${String(err)}` });
      }
    },
    [currentPath, notify],
  );

  const exportExcalidraw = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    const json = sceneToExcalidrawJSON(api.getSceneElements(), api.getAppState(), api.getFiles());
    const path = await window.notateAPI.saveDialog({
      defaultName: (currentPath ? basename(currentPath).replace(/\.notate$/i, '') : 'note') + '.excalidraw',
      filters: [{ name: 'Excalidraw', extensions: ['excalidraw'] }],
    });
    if (!path) return;
    await window.notateAPI.writeFile(path, new TextEncoder().encode(json));
    notify({ kind: 'info', message: `Exported ${basename(path)}.` });
  }, [currentPath, notify]);

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
      let bytes: Uint8Array;
      if (format === 'png') {
        const blob = await exportToBlob({
          elements: elements as never,
          files: files as never,
          appState: appState as never,
          mimeType: 'image/png',
        });
        bytes = new Uint8Array(await blob.arrayBuffer());
      } else {
        const svg = await exportToSvg({
          elements: elements as never,
          files: files as never,
          appState: appState as never,
          exportPadding: 16,
        });
        bytes = new TextEncoder().encode(svg.outerHTML);
      }
      const base = currentPath ? basename(currentPath).replace(/\.notate$/i, '') : 'note';
      const path = await window.notateAPI.saveDialog({
        defaultName: `${base}.${format}`,
        filters: [{ name: format.toUpperCase(), extensions: [format] }],
      });
      if (!path) return;
      await window.notateAPI.writeFile(path, bytes);
      notify({ kind: 'info', message: `Exported ${basename(path)}.` });
    },
    [currentPath, notify],
  );

  const importMermaid = useCallback(
    async (definition: string) => {
      const api = apiRef.current;
      if (!api) return;
      try {
        const { elements: newEls, files } = await mermaidToScene2(definition);
        if (Object.keys(files).length) api.addFiles(Object.values(files));
        const existing = api.getSceneElements();
        api.updateScene({ elements: [...existing, ...newEls] });
        api.scrollToContent(newEls as unknown[], { fitToContent: true });
        setMermaidOpen(false);
        notify({
          kind: 'info',
          message: `Added ${newEls.length} elements from Mermaid. Save as .notate to convert to strokes.`,
        });
      } catch (err) {
        notify({ kind: 'error', message: `Mermaid parse failed: ${String(err)}` });
      }
    },
    [notify],
  );

  // Wire menu actions and OS file-open events.
  useEffect(() => {
    const offMenu = window.notateAPI.onMenu((action) => {
      switch (action) {
        case 'open':
          void handleOpen();
          break;
        case 'save':
          void doSaveNotate(false);
          break;
        case 'save-as':
          void doSaveNotate(true);
          break;
        case 'export-excalidraw':
          void exportExcalidraw();
          break;
        case 'export-png':
          void exportImage('png');
          break;
        case 'export-svg':
          void exportImage('svg');
          break;
        case 'import-mermaid':
          setMermaidOpen(true);
          break;
        case 'toggle-view-mode':
          setViewMode((v) => !v);
          break;
      }
    });
    const offOpen = window.notateAPI.onOpenPath((res) => loadScene(res.data, res.path));
    return () => {
      offMenu();
      offOpen();
    };
  }, [handleOpen, doSaveNotate, exportExcalidraw, exportImage, loadScene]);

  // Pull any file the OS asked us to open before the UI mounted.
  useEffect(() => {
    void (async () => {
      const path = await window.notateAPI.getPendingOpen();
      if (path) {
        const data = await window.notateAPI.readFile(path);
        loadScene(data, path);
      }
    })();
  }, [loadScene]);

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      {banner && <Banner state={banner} onClose={() => setBanner(null)} />}
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api as unknown as ExAPI;
        }}
        viewModeEnabled={viewMode}
        initialData={{
          appState: { viewBackgroundColor: '#ffffff' },
          scrollToContent: true,
        }}
      />
      {mermaidOpen && (
        <MermaidDialog
          onCancel={() => setMermaidOpen(false)}
          onSubmit={(def) => void importMermaid(def)}
        />
      )}
    </div>
  );
}
