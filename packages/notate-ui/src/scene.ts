/**
 * Glue between the notate codec, the notate<->excalidraw converter and the
 * Excalidraw runtime. Platform-agnostic: used by both the desktop (Electron) and
 * mobile (Capacitor) apps. All conversion happens in the renderer/WebView.
 */
import { convertToExcalidrawElements, serializeAsJSON } from '@excalidraw/excalidraw';
import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw';
import {
  type NotateDoc,
  type NotateMeta,
  readNotate,
  writeNotate,
} from '@notate/codec';
import {
  type AnyExcalidrawElement,
  type BinaryFiles,
  type ConversionWarning,
  mermaidToScene,
  notateToScene,
  sceneToNotate,
} from '@notate/excalidraw';

export interface LoadedScene {
  elements: AnyExcalidrawElement[];
  files: BinaryFiles;
  meta: NotateMeta;
}

/** Decode `.notate` bytes into an Excalidraw scene. */
export function notateBytesToScene(bytes: Uint8Array): LoadedScene {
  const doc = readNotate(bytes);
  const { elements, files } = notateToScene(doc);
  return { elements, files, meta: doc.meta };
}

/** Encode the current Excalidraw scene back into `.notate` bytes. */
export function sceneToNotateBytes(
  elements: readonly AnyExcalidrawElement[],
  files: BinaryFiles,
  meta?: Partial<NotateMeta>,
): { bytes: Uint8Array; warnings: ConversionWarning[] } {
  const base: Partial<NotateDoc> | undefined = meta
    ? { meta: meta as NotateMeta }
    : undefined;
  const { doc, warnings } = sceneToNotate(elements as AnyExcalidrawElement[], files, base);
  return { bytes: writeNotate(doc), warnings };
}

/** Serialize the scene as a `.excalidraw` JSON string. */
export function sceneToExcalidrawJSON(
  elements: readonly AnyExcalidrawElement[],
  appState: Record<string, unknown>,
  files: BinaryFiles,
): string {
  return serializeAsJSON(
    elements as never,
    appState as never,
    files as never,
    'local',
  );
}

/** Parse a mermaid definition into Excalidraw elements + files. */
export async function mermaidToExcalidraw(
  definition: string,
): Promise<{ elements: AnyExcalidrawElement[]; files: BinaryFiles }> {
  return mermaidToScene(definition, {
    parseMermaidToExcalidraw: parseMermaidToExcalidraw as never,
    convertToExcalidrawElements: convertToExcalidrawElements as never,
  });
}
