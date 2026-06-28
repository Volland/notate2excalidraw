import { contextBridge, ipcRenderer } from 'electron';

export interface OpenResult {
  path: string;
  data: Uint8Array;
}

export interface SaveDialogOptions {
  defaultName?: string;
  filters?: { name: string; extensions: string[] }[];
}

const api = {
  /** Show the OS open dialog; returns the chosen file's path + bytes. */
  openDialog: (): Promise<OpenResult | null> => ipcRenderer.invoke('dialog:open'),

  /** Show the OS save dialog; returns the chosen path (no write yet). */
  saveDialog: (opts: SaveDialogOptions): Promise<string | null> =>
    ipcRenderer.invoke('dialog:save', opts),

  /** Write bytes to a path. */
  writeFile: (path: string, data: Uint8Array): Promise<void> =>
    ipcRenderer.invoke('file:write', path, data),

  /** Read bytes from a path. */
  readFile: (path: string): Promise<Uint8Array> =>
    ipcRenderer.invoke('file:read', path),

  /** Any file the OS asked us to open before the UI was ready. */
  getPendingOpen: (): Promise<string | null> =>
    ipcRenderer.invoke('app:get-pending-open'),

  /** Application-menu actions (open, save, export-*, import-mermaid, …). */
  onMenu: (cb: (action: string) => void): (() => void) => {
    const handler = (_e: unknown, action: string) => cb(action);
    ipcRenderer.on('menu', handler);
    return () => ipcRenderer.removeListener('menu', handler);
  },

  /** A file opened via OS association (Finder / argv / second-instance). */
  onOpenPath: (cb: (res: OpenResult) => void): (() => void) => {
    const handler = (_e: unknown, res: OpenResult) => cb(res);
    ipcRenderer.on('open-path', handler);
    return () => ipcRenderer.removeListener('open-path', handler);
  },
};

contextBridge.exposeInMainWorld('notateAPI', api);

export type NotateAPI = typeof api;
