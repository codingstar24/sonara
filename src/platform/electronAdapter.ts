import type { PlatformAdapter } from './adapter';
import type { Source, Track, ScannedFile, SourceRef } from '@/db/types';
import type { PermissionState } from './adapter';

interface ElectronBridge {
  isElectron: boolean;
  platform: string;
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    onStateChange: (callback: (isMaximized: boolean) => void) => () => void;
  };
  dialog: {
    selectFolders: () => Promise<string[] | null>;
    selectFiles: () => Promise<string[] | null>;
  };
  fs: {
    scanDirectory: (dirPath: string) => Promise<Array<{
      name: string;
      relPath: string;
      fullPath: string;
      size: number;
      lastModified: number;
    }>>;
    dirExists: (dirPath: string) => Promise<boolean>;
    readFile: (filePath: string) => Promise<Uint8Array>;
    readText: (filePath: string) => Promise<string | null>;
    showInFolder: (filePath: string) => Promise<void>;
  };
  media: {
    onCommand: (callback: (command: 'toggle-play' | 'next' | 'previous') => void) => () => void;
    toMediaUrl: (absolutePath: string) => string;
  };
}

declare global {
  interface Window {
    sonara?: ElectronBridge;
    electronAPI?: ElectronBridge;
  }
}

function getBridge(): ElectronBridge | null {
  if (typeof window === 'undefined') return null;
  return window.sonara || window.electronAPI || null;
}

export class ElectronAdapter implements PlatformAdapter {
  kind = 'electron' as const;

  /** Pick audio files via Electron's dialog.showOpenDialog */
  async pickFiles(): Promise<SourceRef[]> {
    const bridge = getBridge();
    if (!bridge) return [];

    const filePaths = await bridge.dialog.selectFiles();
    if (!filePaths || filePaths.length === 0) return [];

    return filePaths.map((fp) => {
      const normalized = fp.replace(/\\/g, '/');
      const name = normalized.split('/').pop() || 'Track';
      return {
        kind: 'path',
        path: normalized,
        name,
      };
    });
  }

  /** Pick a folder via Electron's dialog.showOpenDialog */
  async pickFolder(): Promise<SourceRef | null> {
    const bridge = getBridge();
    if (!bridge) return null;

    const folderPaths = await bridge.dialog.selectFolders();
    if (!folderPaths || folderPaths.length === 0) return null;

    const normalized = folderPaths[0]!.replace(/\\/g, '/');
    const name = normalized.split('/').filter(Boolean).pop() || 'Music';

    return {
      kind: 'path',
      path: normalized,
      name,
    };
  }

  /** Scan a source directory recursively using Node.js fs via IPC */
  async *scan(source: Source, signal: AbortSignal): AsyncGenerator<ScannedFile> {
    const bridge = getBridge();
    if (!bridge || !source.path) return;

    try {
      const scannedItems = await bridge.fs.scanDirectory(source.path);
      if (!scannedItems || !Array.isArray(scannedItems)) return;

      for (const item of scannedItems) {
        if (signal.aborted) return;

        try {
          const buffer = await bridge.fs.readFile(item.fullPath);
          const file = new File([buffer as unknown as BlobPart], item.name, { lastModified: item.lastModified });

          yield {
            name: item.name,
            relPath: item.fullPath,
            size: item.size,
            lastModified: item.lastModified,
            file,
          };
        } catch (readErr) {
          console.warn('ElectronAdapter: Failed to read file', item.fullPath, readErr);
        }
      }
    } catch (err) {
      console.warn('ElectronAdapter: Directory scan failed', source.path, err);
    }
  }

  /** Always granted in Electron since we have direct OS file access */
  async ensurePermission(_source: Source, _interactive: boolean): Promise<PermissionState> {
    return 'granted';
  }

  /** Get a playable URL via the local-media:// custom protocol */
  async getPlayableUrl(
    track: Track,
    source: Source
  ): Promise<{ url: string; dispose(): void }> {
    const bridge = getBridge();
    const rel = track.relPath.replace(/\\/g, '/');
    let fullPath = rel;

    if (!/^[a-zA-Z]:\//.test(fullPath) && !fullPath.startsWith('/')) {
      const root = source?.path ? source.path.replace(/\\/g, '/') : '';
      if (root) {
        fullPath = `${root.replace(/\/$/, '')}/${rel.replace(/^\//, '')}`;
      }
    }

    const url = bridge
      ? bridge.media.toMediaUrl(fullPath)
      : `local-media://${fullPath.startsWith('/') ? fullPath : `/${fullPath}`}`;

    return {
      url,
      dispose: () => {},
    };
  }

  /** Read sidecar text file (e.g. .lrc) using Node.js fs */
  async readSidecarText(
    track: Track,
    source: Source,
    ext: string
  ): Promise<string | null> {
    const bridge = getBridge();
    if (!bridge) return null;

    const root = source.path ? source.path.replace(/\\/g, '/') : '';
    const rel = track.relPath.replace(/\\/g, '/');
    const fullPath = root ? `${root.replace(/\/$/, '')}/${rel.replace(/^\//, '')}` : rel;
    const sidecarPath = fullPath.replace(/\.[^/.]+$/, `.${ext}`);

    try {
      return await bridge.fs.readText(sidecarPath);
    } catch {
      return null;
    }
  }

  /** Read image file next to the track using Node.js fs */
  async readImageNextTo(
    track: Track,
    source: Source,
    names: string[]
  ): Promise<Blob | null> {
    const bridge = getBridge();
    if (!bridge) return null;

    const root = source.path ? source.path.replace(/\\/g, '/') : '';
    const rel = track.relPath.replace(/\\/g, '/');
    const fullPath = root ? `${root.replace(/\/$/, '')}/${rel.replace(/^\//, '')}` : rel;
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));

    for (const name of names) {
      for (const imgExt of ['jpg', 'jpeg', 'png', 'webp']) {
        const imgPath = `${dir}/${name}.${imgExt}`;
        try {
          const buffer = await bridge.fs.readFile(imgPath);
          if (buffer && buffer.byteLength > 0) {
            return new Blob([buffer as unknown as BlobPart], { type: `image/${imgExt === 'jpg' ? 'jpeg' : imgExt}` });
          }
        } catch {
          // File does not exist, check next candidate
        }
      }
    }

    return null;
  }

  /** Show a file in the OS file manager */
  showInFolder(track: Track, source: Source): void {
    const bridge = getBridge();
    if (!bridge) return;

    const root = source.path ? source.path.replace(/\\/g, '/') : '';
    const rel = track.relPath.replace(/\\/g, '/');
    const fullPath = root ? `${root.replace(/\/$/, '')}/${rel.replace(/^\//, '')}` : rel;

    void bridge.fs.showInFolder(fullPath);
  }

  watchSource(_source: Source, _onChange: () => void): () => void {
    return () => {};
  }

  onExternalOpen(cb: (paths: string[]) => void): void {
    void cb;
  }

  onMediaKey(cb: (k: 'play' | 'pause' | 'next' | 'prev' | 'stop') => void): void {
    const bridge = getBridge();
    if (!bridge) return;

    bridge.media.onCommand((cmd) => {
      if (cmd === 'toggle-play') cb('play');
      else if (cmd === 'next') cb('next');
      else if (cmd === 'previous') cb('prev');
    });
  }

  setTaskbarProgress(fraction: number | null): void {
    void fraction;
  }

  onSleepTimerEnd(action: 'pause' | 'quit' | 'sleep-pc' | 'shutdown-pc'): void {
    void action;
  }
}
