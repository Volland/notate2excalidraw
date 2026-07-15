import React, { useRef, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import {
  Banner,
  type BannerState,
  type ExcalidrawAPILike,
  MermaidDialog,
  useNotateActions,
} from '@notate/ui';
import { capacitorPlatform } from './capacitorPlatform.js';

export default function App(): React.JSX.Element {
  const apiRef = useRef<ExcalidrawAPILike | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [mermaidOpen, setMermaidOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [banner, setBanner] = useState<BannerState | null>(null);

  const actions = useNotateActions({
    apiRef,
    platform: capacitorPlatform,
    notify: setBanner,
  });

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={toolbarStyle}>
        <strong style={{ fontSize: 14, marginRight: 4 }}>Notate</strong>
        <button style={tbBtn} onClick={() => void actions.open()}>
          Open
        </button>
        <button style={tbBtn} onClick={() => void actions.saveNotate(false)}>
          Save
        </button>
        <button style={tbBtn} onClick={() => setMermaidOpen(true)}>
          Mermaid
        </button>
        <div style={{ position: 'relative' }}>
          <button style={tbBtn} onClick={() => setExportOpen((o) => !o)}>
            Export ▾
          </button>
          {exportOpen && (
            <div style={menuStyle} onMouseLeave={() => setExportOpen(false)}>
              <MenuItem
                label="Excalidraw"
                onClick={() => {
                  setExportOpen(false);
                  void actions.exportExcalidraw();
                }}
              />
              <MenuItem
                label="PNG"
                onClick={() => {
                  setExportOpen(false);
                  void actions.exportImage('png');
                }}
              />
              <MenuItem
                label="SVG"
                onClick={() => {
                  setExportOpen(false);
                  void actions.exportImage('svg');
                }}
              />
            </div>
          )}
        </div>
        <span style={{ flex: 1 }} />
        <button
          style={{ ...tbBtn, background: viewMode ? '#1971c2' : '#fff', color: viewMode ? '#fff' : '#333' }}
          onClick={() => setViewMode((v) => !v)}
        >
          {viewMode ? 'View' : 'Edit'}
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
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
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }): React.JSX.Element {
  return (
    <button style={menuItemStyle} onClick={onClick}>
      {label}
    </button>
  );
}

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 10px',
  paddingTop: 'max(8px, env(safe-area-inset-top))',
  background: '#f1f3f5',
  borderBottom: '1px solid #dee2e6',
  flexShrink: 0,
};

const tbBtn: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #ced4da',
  background: '#fff',
  color: '#333',
  fontSize: 13,
  cursor: 'pointer',
};

const menuStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 4,
  background: '#fff',
  border: '1px solid #dee2e6',
  borderRadius: 8,
  boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
  zIndex: 1500,
  overflow: 'hidden',
  minWidth: 130,
};

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '10px 14px',
  border: 'none',
  background: '#fff',
  fontSize: 14,
  cursor: 'pointer',
};
