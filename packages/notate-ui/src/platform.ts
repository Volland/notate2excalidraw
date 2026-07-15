/**
 * Platform abstraction so the shared canvas logic can run on Electron (native
 * dialogs + fs) and Capacitor/Android (file picker + Filesystem/Share) without
 * caring which.
 */
import type { AnyExcalidrawElement, BinaryFiles } from '@notate/excalidraw';

/** The subset of Excalidraw's imperative API the shared logic uses. */
export interface ExcalidrawAPILike {
  updateScene: (scene: {
    elements?: readonly unknown[];
    appState?: Record<string, unknown>;
  }) => void;
  getSceneElements: () => readonly AnyExcalidrawElement[];
  getFiles: () => BinaryFiles;
  addFiles: (files: unknown[]) => void;
  getAppState: () => Record<string, unknown>;
  scrollToContent: (target?: unknown, opts?: Record<string, unknown>) => void;
  resetScene: () => void;
}

export interface OpenedFile {
  data: Uint8Array;
  /** Display name (with extension) if known. */
  name?: string;
  /** Opaque location used to silently re-save (a path on desktop). */
  location?: string;
}

export interface SaveRequest {
  data: Uint8Array;
  suggestedName: string;
  mimeType: string;
  ext: string;
  /** Previous save/open location, for silent overwrite (desktop). */
  currentLocation?: string | null;
  /** Force a fresh location chooser (Save As / export). */
  forceDialog?: boolean;
}

export interface Platform {
  /** Pick a `.notate` file and return its bytes, or null if cancelled. */
  openFile(): Promise<OpenedFile | null>;
  /** Persist bytes; return the location label written to, or null if cancelled. */
  saveFile(req: SaveRequest): Promise<{ location: string } | null>;
}
