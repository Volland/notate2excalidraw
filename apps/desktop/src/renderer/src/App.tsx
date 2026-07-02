import React, { useEffect, useRef, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import {
  Banner,
  type BannerState,
  type ExcalidrawAPILike,
  MermaidDialog,
  useNotateActions,
} from '@notate/ui';
import { electronPlatform } from './electronPlatform.js';

function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

export default function App(): React.JSX.Element {
  const apiRef = useRef<ExcalidrawAPILike | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [mermaidOpen, setMermaidOpen] = useState(false);
  const [banner, setBanner] = useState<BannerState | null>(null);

  const actions = useNotateActions({
    apiRef,
    platform: electronPlatform,
    notify: setBanner,
  });

  // Wire native-menu actions and OS file-open events to the shared actions.
  useEffect(() => {
    const offMenu = window.notateAPI.onMenu((action) => {
      switch (action) {
        case 'open':
          void actions.open();
          break;
        case 'save':
          void actions.saveNotate(false);
          break;
        case 'save-as':
          void actions.saveNotate(true);
          break;
        case 'export-excalidraw':
          void actions.exportExcalidraw();
          break;
        case 'export-png':
          void actions.exportImage('png');
          break;
        case 'export-svg':
          void actions.exportImage('svg');
          break;
        case 'import-mermaid':
          setMermaidOpen(true);
          break;
        case 'toggle-view-mode':
          setViewMode((v) => !v);
          break;
      }
    });
    const offOpen = window.notateAPI.onOpenPath((res) =>
      actions.loadBytes(res.data, basename(res.path), res.path),
    );
    return () => {
      offMenu();
      offOpen();
    };
  }, [actions]);

  // Pull any file the OS asked us to open before the UI mounted.
  useEffect(() => {
    void (async () => {
      const path = await window.notateAPI.getPendingOpen();
      if (path) {
        const data = await window.notateAPI.readFile(path);
        actions.loadBytes(data, basename(path), path);
      }
    })();
  }, [actions]);

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      {banner && <Banner state={banner} onClose={() => setBanner(null)} />}
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api as unknown as ExcalidrawAPILike;
        }}
        viewModeEnabled={viewMode}
        initialData={{ appState: { viewBackgroundColor: '#ffffff' } }}
      />
      {mermaidOpen && (
        <MermaidDialog
          onCancel={() => setMermaidOpen(false)}
          onSubmit={(def) => {
            void actions.importMermaid(def);
            setMermaidOpen(false);
          }}
        />
      )}
    </div>
  );
}
