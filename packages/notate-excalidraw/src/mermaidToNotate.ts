/**
 * Mermaid -> notate. The conversion runs through Excalidraw:
 *   mermaid text -> Excalidraw element skeletons -> full elements -> notate.
 *
 * The two Excalidraw functions are dependency-injected so this module stays
 * framework-free and unit-testable. The desktop app supplies the real
 * implementations from `@excalidraw/mermaid-to-excalidraw` and
 * `@excalidraw/excalidraw`.
 */
import type { NotateDoc } from '@notate/codec';
import type { AnyExcalidrawElement, BinaryFiles } from './excalidraw-types.js';
import { sceneToNotate, type ConversionWarning } from './fromExcalidraw.js';

export interface MermaidDeps {
  /** From `@excalidraw/mermaid-to-excalidraw`. */
  parseMermaidToExcalidraw: (
    definition: string,
    config?: Record<string, unknown>,
  ) => Promise<{ elements: unknown[]; files?: BinaryFiles | null }>;
  /** From `@excalidraw/excalidraw`. */
  convertToExcalidrawElements: (
    skeletons: unknown[],
    opts?: Record<string, unknown>,
  ) => AnyExcalidrawElement[];
}

/** Parse mermaid into a full Excalidraw scene (elements + files). */
export async function mermaidToScene(
  definition: string,
  deps: MermaidDeps,
  config?: Record<string, unknown>,
): Promise<{ elements: AnyExcalidrawElement[]; files: BinaryFiles }> {
  const { elements: skeletons, files } = await deps.parseMermaidToExcalidraw(
    definition,
    config,
  );
  const elements = deps.convertToExcalidrawElements(skeletons);
  return { elements, files: files ?? {} };
}

/** Parse mermaid and convert it directly to a notate document. */
export async function mermaidToNotateDoc(
  definition: string,
  deps: MermaidDeps,
  baseDoc?: Partial<NotateDoc>,
  config?: Record<string, unknown>,
): Promise<{ doc: NotateDoc; warnings: ConversionWarning[] }> {
  const { elements, files } = await mermaidToScene(definition, deps, config);
  return sceneToNotate(elements, files, baseDoc);
}
