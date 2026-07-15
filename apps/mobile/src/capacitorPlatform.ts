import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { base64ToBytes, bytesToBase64 } from '@notate/excalidraw';
import type { OpenedFile, Platform, SaveRequest } from '@notate/ui';

/**
 * Capacitor/Android implementation of the shared {@link Platform}.
 * - open: Storage Access Framework file picker (no runtime permission needed)
 * - save: write to the app's Documents dir, then offer a Share sheet so the user
 *   can place the file anywhere (Drive, Files, another app, …).
 */
export const capacitorPlatform: Platform = {
  async openFile(): Promise<OpenedFile | null> {
    const res = await FilePicker.pickFiles({ readData: true });
    const file = res.files[0];
    if (!file) return null;

    let data: Uint8Array;
    if (file.data) {
      data = base64ToBytes(file.data);
    } else if (file.path) {
      const read = await Filesystem.readFile({ path: file.path });
      data = base64ToBytes(read.data as string);
    } else {
      throw new Error('Picker returned no file data');
    }
    return { data, name: file.name ?? 'note.notate' };
  },

  async saveFile(req: SaveRequest): Promise<{ location: string } | null> {
    const base64 = bytesToBase64(req.data);
    // Binary-safe write: omitting `encoding` makes Filesystem treat data as base64.
    await Filesystem.writeFile({
      path: req.suggestedName,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });
    const { uri } = await Filesystem.getUri({
      path: req.suggestedName,
      directory: Directory.Documents,
    });

    // Offer a share sheet (best-effort; ignore if the user dismisses it).
    try {
      const canShare = await Share.canShare();
      if (canShare.value) {
        await Share.share({ title: req.suggestedName, url: uri });
      }
    } catch {
      /* user dismissed or sharing unavailable */
    }

    return { location: `Documents/${req.suggestedName}` };
  },
};
