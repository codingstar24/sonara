import type { PlatformAdapter } from './adapter';
import type { Source, Track, ScannedFile, SourceRef } from '@/db/types';
import type { PermissionState } from './adapter';
import { AUDIO_EXTENSIONS } from '@/config/app';

/**
 * Browser PlatformAdapter using the File System Access API.
 * Falls back to <input> pickers when the API is unavailable.
 */
export class BrowserAdapter implements PlatformAdapter {
  kind = 'browser' as const;

  private supportsFileSystemAccess =
    typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  private fallbackFiles: File[] = [];
  private fileMap = new Map<string, File>();

  public registerFiles(files: File[]) {
    for (const f of files) {
      this.fileMap.set(f.name, f);
      this.fileMap.set(f.name.toLowerCase(), f);
      if (f.webkitRelativePath) {
        this.fileMap.set(f.webkitRelativePath, f);
        this.fileMap.set(f.webkitRelativePath.toLowerCase(), f);
      }
    }
  }

  async pickFiles(): Promise<SourceRef[]> {
    if (this.supportsFileSystemAccess) {
      try {
        const handles = await window.showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: 'Audio files',
              accept: {
                'audio/*': [
                  '.mp3', '.m4a', '.aac', '.flac', '.wav',
                  '.ogg', '.oga', '.opus', '.webm',
                  '.wma', '.aiff', '.aif', '.ape',
                ],
              },
            },
          ],
          startIn: 'music',
        });
        return handles.map((h: FileSystemFileHandle) => ({
          kind: 'file-handle' as const,
          handle: h,
          name: h.name,
        }));
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return [];
        throw e;
      }
    }

    // Fallback: <input type="file">
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'audio/*';
      input.onchange = () => {
        const files = Array.from(input.files ?? []);
        resolve(
          files.map((f) => ({
            kind: 'file-handle' as const,
            name: f.name,
          }))
        );
      };
      input.click();
    });
  }

  async pickFolder(): Promise<SourceRef | null> {
    if (this.supportsFileSystemAccess) {
      try {
        const handle = await window.showDirectoryPicker({
          mode: 'read',
          startIn: 'music',
        });
        return {
          kind: 'directory-handle' as const,
          handle,
          name: handle.name,
        };
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return null;
        throw e;
      }
    }

    // Fallback: <input webkitdirectory>
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.setAttribute('webkitdirectory', '');
      input.onchange = () => {
        const files = Array.from(input.files ?? []);
        if (files.length === 0) {
          resolve(null);
          return;
        }
        this.fallbackFiles = files;
        const firstPath = files[0]?.webkitRelativePath ?? '';
        const folderName = firstPath.split('/')[0] ?? 'Folder';
        resolve({
          kind: 'directory-handle' as const,
          name: folderName,
        });
      };
      input.click();
    });
  }

  async *scan(source: Source, signal: AbortSignal): AsyncGenerator<ScannedFile> {
    if (source.kind === 'directory-handle' && source.handle) {
      yield* this.scanDirectoryHandle(
        source.handle as FileSystemDirectoryHandle,
        '',
        signal
      );
    } else if (this.fallbackFiles.length > 0) {
      const files = [...this.fallbackFiles];
      for (const file of files) {
        if (signal.aborted) return;
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        if (AUDIO_EXTENSIONS.has(ext)) {
          const relPath = file.webkitRelativePath
            ? file.webkitRelativePath.split('/').slice(1).join('/') || file.name
            : file.name;
          yield {
            name: file.name,
            relPath,
            size: file.size,
            lastModified: file.lastModified,
            file,
          };
        }
      }
    }
  }

  private async *scanDirectoryHandle(
    dirHandle: FileSystemDirectoryHandle,
    prefix: string,
    signal: AbortSignal
  ): AsyncGenerator<ScannedFile> {
    for await (const entry of dirHandle.values()) {
      if (signal.aborted) return;

      if (entry.kind === 'file') {
        const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
        if (AUDIO_EXTENSIONS.has(ext)) {
          try {
            const fileHandle = entry as FileSystemFileHandle;
            const file = await fileHandle.getFile();
            const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
            yield {
              name: entry.name,
              relPath,
              size: file.size,
              lastModified: file.lastModified,
              file,
            };
          } catch {
            // Skip files we can't read
          }
        }
      } else if (entry.kind === 'directory') {
        const subDir = entry as FileSystemDirectoryHandle;
        const subPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
        yield* this.scanDirectoryHandle(subDir, subPrefix, signal);
      }
    }
  }

  async ensurePermission(source: Source, interactive: boolean): Promise<PermissionState> {
    if (!source.handle) return 'denied';

    try {
      const handle = source.handle as FileSystemDirectoryHandle;
      const opts = { mode: 'read' as const };

      let state = await handle.queryPermission(opts);
      if (state === 'granted') return 'granted';

      if (interactive) {
        state = await handle.requestPermission(opts);
        return state as PermissionState;
      }

      return 'prompt';
    } catch {
      return 'denied';
    }
  }

  async getPlayableUrl(
    track: Track,
    source: Source
  ): Promise<{ url: string; dispose(): void }> {
    if (source.kind === 'directory-handle' && source.handle) {
      const dirHandle = source.handle as FileSystemDirectoryHandle;
      const file = await this.resolveFile(dirHandle, track.relPath);
      if (file) {
        const url = URL.createObjectURL(file);
        return { url, dispose: () => URL.revokeObjectURL(url) };
      }
    }

    // Check direct / registered files map
    const mapped =
      this.fileMap.get(track.relPath) ||
      this.fileMap.get(track.relPath.toLowerCase()) ||
      this.fileMap.get(track.title) ||
      this.fileMap.get(track.title.toLowerCase());
    if (mapped) {
      const url = URL.createObjectURL(mapped);
      return { url, dispose: () => URL.revokeObjectURL(url) };
    }

    // Check fallback files if handle is unavailable
    if (this.fallbackFiles.length > 0) {
      const match = this.fallbackFiles.find(
        (f) =>
          f.name === track.title ||
          f.name.includes(track.title) ||
          f.webkitRelativePath.endsWith(track.relPath)
      );
      if (match) {
        const url = URL.createObjectURL(match);
        return { url, dispose: () => URL.revokeObjectURL(url) };
      }
    }

    throw new Error(`Cannot get playable URL for track: ${track.title}`);
  }

  async readSidecarText(
    track: Track,
    source: Source,
    ext: string
  ): Promise<string | null> {
    if (source.kind !== 'directory-handle' || !source.handle) return null;

    try {
      const dirHandle = source.handle as FileSystemDirectoryHandle;
      const baseName = track.relPath.replace(/\.[^.]+$/, '');
      const sidecarPath = baseName + ext;
      const file = await this.resolveFile(dirHandle, sidecarPath);
      if (file) return await file.text();
    } catch {
      // Sidecar doesn't exist
    }
    return null;
  }

  async readImageNextTo(
    track: Track,
    source: Source,
    names: string[]
  ): Promise<Blob | null> {
    if (source.kind !== 'directory-handle' || !source.handle) return null;

    try {
      const dirHandle = source.handle as FileSystemDirectoryHandle;
      const parts = track.relPath.split('/');
      parts.pop(); // remove filename
      const folderPath = parts.join('/');

      let folderHandle: FileSystemDirectoryHandle = dirHandle;
      if (folderPath) {
        for (const segment of folderPath.split('/')) {
          folderHandle = await folderHandle.getDirectoryHandle(segment);
        }
      }

      for (const name of names) {
        for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
          try {
            const fileHandle = await folderHandle.getFileHandle(`${name}.${ext}`);
            return await fileHandle.getFile();
          } catch {
            // Try next
          }
        }
      }
    } catch {
      // Folder not accessible
    }
    return null;
  }

  private async resolveFile(
    dirHandle: FileSystemDirectoryHandle,
    relPath: string
  ): Promise<File | null> {
    const segments = relPath.split('/');
    const fileName = segments.pop();
    if (!fileName) return null;

    let current: FileSystemDirectoryHandle = dirHandle;
    for (const segment of segments) {
      try {
        current = await current.getDirectoryHandle(segment);
      } catch {
        return null;
      }
    }

    try {
      const fileHandle = await current.getFileHandle(fileName);
      return await fileHandle.getFile();
    } catch {
      return null;
    }
  }
}
