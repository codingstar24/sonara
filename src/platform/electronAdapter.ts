import type { PlatformAdapter } from './adapter';
import type { Source, Track, ScannedFile, SourceRef } from '@/db/types';
import type { PermissionState } from './adapter';

/**
 * Electron PlatformAdapter skeleton.
 * All methods delegate to window.electronAPI (exposed by the preload script).
 * Implementation will be completed when wrapping in Electron.
 */
export class ElectronAdapter implements PlatformAdapter {
  kind = 'electron' as const;

  /** Pick audio files via Electron's dialog.showOpenDialog */
  async pickFiles(): Promise<SourceRef[]> {
    // Will call window.electronAPI.pickFiles()
    throw new Error('ElectronAdapter.pickFiles not implemented yet');
  }

  /** Pick a folder via Electron's dialog.showOpenDialog */
  async pickFolder(): Promise<SourceRef | null> {
    // Will call window.electronAPI.pickFolder()
    throw new Error('ElectronAdapter.pickFolder not implemented yet');
  }

  /** Scan a source directory recursively using Node.js fs */
  async *scan(_source: Source, _signal: AbortSignal): AsyncGenerator<ScannedFile> {
    // Will use window.electronAPI.scanDirectory(source.path, signal)
    throw new Error('ElectronAdapter.scan not implemented yet');
  }

  /** Always granted in Electron since we use Node.js fs */
  async ensurePermission(_source: Source, _interactive: boolean): Promise<PermissionState> {
    return 'granted';
  }

  /** Get a playable URL via the local-media:// custom protocol */
  async getPlayableUrl(
    _track: Track,
    _source: Source
  ): Promise<{ url: string; dispose(): void }> {
    // Will construct local-media://path URL with CORS headers
    throw new Error('ElectronAdapter.getPlayableUrl not implemented yet');
  }

  /** Read sidecar text file using Node.js fs */
  async readSidecarText(
    _track: Track,
    _source: Source,
    _ext: string
  ): Promise<string | null> {
    // Will call window.electronAPI.readSidecarText(absolutePath)
    throw new Error('ElectronAdapter.readSidecarText not implemented yet');
  }

  /** Read image file next to the track using Node.js fs */
  async readImageNextTo(
    _track: Track,
    _source: Source,
    _names: string[]
  ): Promise<Blob | null> {
    // Will call window.electronAPI.readImageNextTo(dirPath, names)
    throw new Error('ElectronAdapter.readImageNextTo not implemented yet');
  }

  /** Watch a source directory for changes using chokidar */
  watchSource(_source: Source, _onChange: () => void): () => void {
    // Will call window.electronAPI.watchDirectory(source.path, onChange)
    return () => {};
  }

  /** Show a file in the OS file manager */
  showInFolder(_track: Track, _source: Source): void {
    // Will call window.electronAPI.showInFolder(absolutePath)
  }

  /** Register handler for "Open with" / file association */
  onExternalOpen(cb: (paths: string[]) => void): void {
    // Will call window.electronAPI.onExternalOpen(cb)
    void cb;
  }

  /** Register handler for global media keys (beyond Media Session) */
  onMediaKey(cb: (k: 'play' | 'pause' | 'next' | 'prev' | 'stop') => void): void {
    // Will call window.electronAPI.onMediaKey(cb)
    void cb;
  }

  /** Set taskbar progress bar */
  setTaskbarProgress(fraction: number | null): void {
    // Will call window.electronAPI.setTaskbarProgress(fraction)
    void fraction;
  }

  /** Execute action when sleep timer ends */
  onSleepTimerEnd(action: 'pause' | 'quit' | 'sleep-pc' | 'shutdown-pc'): void {
    // Will call window.electronAPI.onSleepTimerEnd(action)
    void action;
  }
}
