import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const isMac = process.platform === 'darwin';
let mainWindow: BrowserWindow | null = null;

/** A file path queued before the renderer is ready (OS "open with" / argv). */
let pendingOpenPath: string | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    backgroundColor: '#ffffff',
    title: 'Notate Viewer',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function sendMenu(action: string): void {
  mainWindow?.webContents.send('menu', action);
}

async function openPathInRenderer(path: string): Promise<void> {
  try {
    const data = await readFile(path);
    mainWindow?.webContents.send('open-path', {
      path,
      data: new Uint8Array(data),
    });
  } catch (err) {
    dialog.showErrorBox('Failed to open file', String(err));
  }
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{ role: 'appMenu' as const }]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open…',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenu('open'),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenu('save'),
        },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenu('save-as'),
        },
        { type: 'separator' },
        {
          label: 'Export',
          submenu: [
            { label: 'Excalidraw (.excalidraw)…', click: () => sendMenu('export-excalidraw') },
            { label: 'PNG…', click: () => sendMenu('export-png') },
            { label: 'SVG…', click: () => sendMenu('export-svg') },
          ],
        },
        { type: 'separator' },
        {
          label: 'Import Mermaid…',
          accelerator: 'CmdOrCtrl+M',
          click: () => sendMenu('import-mermaid'),
        },
        { type: 'separator' },
        {
          label: 'Recognize with local AI',
          accelerator: 'CmdOrCtrl+R',
          click: () => sendMenu('recognize'),
        },
        {
          label: 'AI Model…',
          accelerator: 'CmdOrCtrl+,',
          click: () => sendMenu('settings'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Edit / Read-only',
          accelerator: 'CmdOrCtrl+E',
          click: () => sendMenu('toggle-view-mode'),
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---- IPC: file dialogs and disk I/O (renderer does all conversion) ----

const NOTATE_FILTERS = [
  { name: 'Notate Notes', extensions: ['notate'] },
  { name: 'All Files', extensions: ['*'] },
];

ipcMain.handle('dialog:open', async () => {
  if (!mainWindow) return null;
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: NOTATE_FILTERS,
  });
  if (res.canceled || !res.filePaths[0]) {
    return null;
  }
  const path = res.filePaths[0];
  const data = await readFile(path);
  return { path, data: new Uint8Array(data) };
});

ipcMain.handle(
  'dialog:save',
  async (
    _e,
    opts: { defaultName?: string; filters?: Electron.FileFilter[] },
  ): Promise<string | null> => {
    if (!mainWindow) return null;
    const res = await dialog.showSaveDialog(mainWindow, {
      defaultPath: opts.defaultName,
      filters: opts.filters ?? NOTATE_FILTERS,
    });
    return res.canceled || !res.filePath ? null : res.filePath;
  },
);

ipcMain.handle(
  'file:write',
  async (_e, path: string, data: Uint8Array): Promise<void> => {
    await writeFile(path, Buffer.from(data));
  },
);

ipcMain.handle('file:read', async (_e, path: string): Promise<Uint8Array> => {
  return new Uint8Array(await readFile(path));
});

ipcMain.handle('app:get-pending-open', async (): Promise<string | null> => {
  const p = pendingOpenPath;
  pendingOpenPath = null;
  return p;
});

// ---- Local vision model (Ollama) recognition ----

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

const RECOGNIZE_PROMPT = `You convert a hand-drawn diagram / handwritten notes image into structured elements.
Return ONLY a JSON array (no markdown fences, no prose). Each element is:
{"type":"rectangle"|"ellipse"|"diamond"|"arrow"|"line"|"text","text":<string or null>,"x":<0..1>,"y":<0..1>,"w":<0..1>,"h":<0..1>}
- x,y,w,h are fractions of the image size; x,y is the element's top-left corner; origin is the image top-left.
- Use "text" for handwritten words/labels and transcribe them accurately.
- Use shape types for drawn boxes, circles/ellipses, diamonds, arrows and lines.
- If a drawn box contains a label, return the shape with its "text" set to the label.
Output the JSON array and nothing else.`;

interface RecognizedItem {
  type: string;
  text?: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
}

function extractJsonArray(text: string): RecognizedItem[] {
  let t = text.trim();
  // Strip ```json ... ``` fences if present.
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const parsed = JSON.parse(t.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) => e && typeof e.type === 'string' && typeof e.x === 'number',
    ) as RecognizedItem[];
  } catch {
    return [];
  }
}

ipcMain.handle('ai:list-models', async (): Promise<
  { name: string; sizeBytes?: number; vision: boolean }[]
> => {
  const res = await fetch(`${OLLAMA_HOST}/api/tags`);
  if (!res.ok) throw new Error(`Ollama ${res.status} listing models`);
  const data = (await res.json()) as {
    models?: { name: string; size?: number }[];
  };
  const models = data.models ?? [];
  return Promise.all(
    models.map(async (m) => {
      let vision = false;
      try {
        const show = await fetch(`${OLLAMA_HOST}/api/show`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: m.name }),
        });
        if (show.ok) {
          const d = (await show.json()) as { capabilities?: string[] };
          vision = (d.capabilities ?? []).includes('vision');
        }
      } catch {
        /* leave vision=false */
      }
      return { name: m.name, sizeBytes: m.size, vision };
    }),
  );
});

async function ollamaVision(
  imageBytes: Uint8Array,
  model: string,
  prompt: string,
): Promise<string> {
  const base64 = Buffer.from(imageBytes).toString('base64');
  const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      images: [base64],
      stream: false,
      think: false,
      options: { temperature: 0 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { response?: string };
  return data.response ?? '';
}

ipcMain.handle(
  'ai:recognize',
  async (_e, imageBytes: Uint8Array, model: string): Promise<RecognizedItem[]> =>
    extractJsonArray(await ollamaVision(imageBytes, model, RECOGNIZE_PROMPT)),
);

ipcMain.handle(
  'ai:vision-text',
  async (_e, imageBytes: Uint8Array, model: string, prompt: string): Promise<string> =>
    ollamaVision(imageBytes, model, prompt),
);

// ---- OS file association handling ----

// macOS: files opened via Finder fire 'open-file'.
app.on('open-file', (event, path) => {
  event.preventDefault();
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    void openPathInRenderer(path);
  } else {
    pendingOpenPath = path;
  }
});

// Windows/Linux: file path arrives in argv.
function pathFromArgv(argv: string[]): string | null {
  const arg = argv.find((a) => a.toLowerCase().endsWith('.notate'));
  return arg ?? null;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const p = pathFromArgv(argv);
    if (p) void openPathInRenderer(p);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  if (!isMac) {
    pendingOpenPath = pathFromArgv(process.argv);
  }

  app.whenReady().then(() => {
    buildMenu();
    createWindow();

    // Once the renderer signals readiness it pulls any pending path.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });
}
