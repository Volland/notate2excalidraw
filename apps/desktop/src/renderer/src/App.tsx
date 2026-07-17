import React, { useEffect, useRef, useState } from 'react';
import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import {
  type AiModel,
  Banner,
  type BannerState,
  DEFAULT_AI_MODEL,
  type ExcalidrawAPILike,
  MermaidDialog,
  SettingsDialog,
  useNotateActions,
} from '@notate/ui';
import { electronPlatform } from './electronPlatform.js';

const AI_MODEL_KEY = 'notate.aiModel';

function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

export default function App(): React.JSX.Element {
  const apiRef = useRef<ExcalidrawAPILike | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [mermaidOpen, setMermaidOpen] = useState(false);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [models, setModels] = useState<AiModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [aiModel, setAiModelState] = useState<string>(
    () => localStorage.getItem(AI_MODEL_KEY) || DEFAULT_AI_MODEL,
  );
  const setAiModel = (m: string) => {
    setAiModelState(m);
    try {
      localStorage.setItem(AI_MODEL_KEY, m);
    } catch {
      /* ignore */
    }
  };

  const actions = useNotateActions({
    apiRef,
    platform: electronPlatform,
    notify: setBanner,
  });

  // Load the installed model list whenever the settings dialog opens.
  useEffect(() => {
    if (!settingsOpen || !electronPlatform.listModels) return;
    setModelsLoading(true);
    setModelsError(null);
    electronPlatform
      .listModels()
      .then(setModels)
      .catch((e) => setModelsError(String(e)))
      .finally(() => setModelsLoading(false));
  }, [settingsOpen]);

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
        case 'recognize':
          void actions.recognizeHybrid(aiModel);
          break;
        case 'settings':
          setSettingsOpen(true);
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
  }, [actions, aiModel]);

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
      >
        {/*
          Replace Excalidraw's default menu (whose built-in "Open" loads
          .excalidraw files and does nothing with a .notate) with our own
          working notate actions. These mirror the native macOS menu bar.
        */}
        <MainMenu>
          <MainMenu.Item onSelect={() => void actions.open()} shortcut="⌘O">
            Open .notate…
          </MainMenu.Item>
          <MainMenu.Item onSelect={() => void actions.saveNotate(false)} shortcut="⌘S">
            Save .notate
          </MainMenu.Item>
          <MainMenu.Item onSelect={() => void actions.saveNotate(true)}>
            Save As…
          </MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.Item onSelect={() => void actions.exportExcalidraw()}>
            Export Excalidraw…
          </MainMenu.Item>
          <MainMenu.Item onSelect={() => void actions.exportImage('png')}>
            Export PNG…
          </MainMenu.Item>
          <MainMenu.Item onSelect={() => void actions.exportImage('svg')}>
            Export SVG…
          </MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.Item onSelect={() => setMermaidOpen(true)} shortcut="⌘M">
            Import Mermaid…
          </MainMenu.Item>
          {actions.aiAvailable && (
            <>
              <MainMenu.Item
                onSelect={() => void actions.recognizeHybrid(aiModel)}
                shortcut="⌘R"
              >
                Recognize with local AI
              </MainMenu.Item>
              <MainMenu.Item onSelect={() => setSettingsOpen(true)}>
                AI model… ({aiModel})
              </MainMenu.Item>
            </>
          )}
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ToggleTheme />
          <MainMenu.DefaultItems.ClearCanvas />
        </MainMenu>
      </Excalidraw>
      {mermaidOpen && (
        <MermaidDialog
          onCancel={() => setMermaidOpen(false)}
          onSubmit={(def) => {
            void actions.importMermaid(def);
            setMermaidOpen(false);
          }}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          models={models}
          current={aiModel}
          loading={modelsLoading}
          error={modelsError}
          onCancel={() => setSettingsOpen(false)}
          onSave={(m) => {
            setAiModel(m);
            setSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}
