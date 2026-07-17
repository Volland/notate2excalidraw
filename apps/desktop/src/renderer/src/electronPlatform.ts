import type {
  AiModel,
  OpenedFile,
  Platform,
  RecognizedItem,
  SaveRequest,
} from '@notate/ui';

function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

/** Electron implementation of the shared {@link Platform}: native dialogs + fs. */
export const electronPlatform: Platform = {
  async openFile(): Promise<OpenedFile | null> {
    const res = await window.notateAPI.openDialog();
    if (!res) return null;
    return { data: res.data, name: basename(res.path), location: res.path };
  },

  async saveFile(req: SaveRequest): Promise<{ location: string } | null> {
    // Reuse the current path for a plain Save; prompt for Save As / exports.
    let path =
      !req.forceDialog &&
      req.currentLocation &&
      req.currentLocation.toLowerCase().endsWith(`.${req.ext}`)
        ? req.currentLocation
        : null;
    if (!path) {
      path = await window.notateAPI.saveDialog({
        defaultName: req.suggestedName,
        filters: [{ name: req.ext.toUpperCase(), extensions: [req.ext] }],
      });
    }
    if (!path) return null;
    await window.notateAPI.writeFile(path, req.data);
    return { location: path };
  },

  async recognizeDrawing(
    imageBytes: Uint8Array,
    model: string,
  ): Promise<RecognizedItem[]> {
    return (await window.notateAPI.recognizeDrawing(imageBytes, model)) as RecognizedItem[];
  },

  async listModels(): Promise<AiModel[]> {
    return (await window.notateAPI.listModels()) as AiModel[];
  },

  async visionText(
    imageBytes: Uint8Array,
    model: string,
    prompt: string,
  ): Promise<string> {
    return window.notateAPI.visionText(imageBytes, model, prompt);
  },
};
