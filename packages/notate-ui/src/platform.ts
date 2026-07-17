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

/** A locally installed model (e.g. from Ollama). */
export interface AiModel {
  name: string;
  sizeBytes?: number;
  /** Whether the model can accept image input (required for recognition). */
  vision: boolean;
}

/** One element recognized from the drawing by a local vision model. */
export interface RecognizedItem {
  type: 'rectangle' | 'ellipse' | 'diamond' | 'arrow' | 'line' | 'text';
  text?: string | null;
  /** Fractions of the source image, origin top-left. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Platform {
  /** Pick a `.notate` file and return its bytes, or null if cancelled. */
  openFile(): Promise<OpenedFile | null>;
  /** Persist bytes; return the location label written to, or null if cancelled. */
  saveFile(req: SaveRequest): Promise<{ location: string } | null>;
  /**
   * Optional: run a local vision model (e.g. Gemma via Ollama) over a PNG of the
   * drawing and return recognized elements. Absent on platforms without a local
   * model bridge.
   */
  recognizeDrawing?(imageBytes: Uint8Array, model: string): Promise<RecognizedItem[]>;
  /** Optional: list locally installed models (e.g. via the Ollama API). */
  listModels?(): Promise<AiModel[]>;
  /**
   * Optional: run a vision model on an image with a custom prompt and return its
   * raw text response. Used by hybrid recognition for batched handwriting OCR.
   */
  visionText?(imageBytes: Uint8Array, model: string, prompt: string): Promise<string>;
}
