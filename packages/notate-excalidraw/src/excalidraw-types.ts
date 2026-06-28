/**
 * Minimal structural types for the subset of the Excalidraw scene format we
 * produce and consume. We intentionally avoid importing `@excalidraw/excalidraw`
 * at runtime (it is a heavy browser/React bundle) — Excalidraw's `restore()`
 * fills in any defaults we omit when the scene is loaded into the editor.
 */

export type FillStyle = 'hachure' | 'cross-hatch' | 'solid' | 'zigzag';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type Arrowhead = 'arrow' | 'bar' | 'dot' | 'triangle' | null;

export interface ExcalidrawElementBase {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: string | null;
  roundness: { type: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: unknown[] | null;
  updated: number;
  link: string | null;
  locked: boolean;
  index?: string;
  [extra: string]: unknown;
}

export interface ExcalidrawFreedrawElement extends ExcalidrawElementBase {
  type: 'freedraw';
  points: [number, number][];
  pressures: number[];
  simulatePressure: boolean;
  lastCommittedPoint: [number, number] | null;
}

export interface ExcalidrawTextElement extends ExcalidrawElementBase {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: number;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  containerId: string | null;
  originalText: string;
  lineHeight: number;
  autoResize: boolean;
}

export interface ExcalidrawImageElement extends ExcalidrawElementBase {
  type: 'image';
  fileId: string;
  status: 'pending' | 'saved' | 'error';
  scale: [number, number];
}

export interface ExcalidrawLinearElement extends ExcalidrawElementBase {
  type: 'line' | 'arrow';
  points: [number, number][];
  lastCommittedPoint: [number, number] | null;
  startBinding: unknown | null;
  endBinding: unknown | null;
  startArrowhead: Arrowhead;
  endArrowhead: Arrowhead;
}

/**
 * A loose element type carrying every field any of the concrete elements may
 * have. We can't intersect the concrete element types because their `type`
 * literals conflict (the intersection would reduce to `never`), so we list the
 * union of their optional fields here.
 */
export interface AnyExcalidrawElement extends ExcalidrawElementBase {
  // freedraw
  points?: [number, number][];
  pressures?: number[];
  simulatePressure?: boolean;
  lastCommittedPoint?: [number, number] | null;
  // text
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  containerId?: string | null;
  originalText?: string;
  lineHeight?: number;
  autoResize?: boolean;
  // image
  fileId?: string;
  status?: 'pending' | 'saved' | 'error';
  scale?: [number, number];
  // linear (line / arrow)
  startBinding?: unknown | null;
  endBinding?: unknown | null;
  startArrowhead?: Arrowhead;
  endArrowhead?: Arrowhead;
}

export interface BinaryFileData {
  mimeType: string;
  id: string;
  dataURL: string;
  created: number;
  lastRetrieved?: number;
}

export type BinaryFiles = Record<string, BinaryFileData>;

export interface ExcalidrawScene {
  type: 'excalidraw';
  version: 2;
  source: string;
  elements: AnyExcalidrawElement[];
  appState: Record<string, unknown>;
  files: BinaryFiles;
}
