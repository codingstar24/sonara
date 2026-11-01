import type { Source, Track, ScannedFile, SourceRef } from '@/db/types';

export type PermissionState = 'granted' | 'prompt' | 'denied';

export interface PlatformAdapter {
  kind: 'browser' | 'electron';

  /** Open a file picker for audio files */
  pickFiles(): Promise<SourceRef[]>;

  /** Open a directory picker */
  pickFolder(): Promise<SourceRef | null>;

  /** Recursively scan a source for audio files */
  scan(source: Source, signal: AbortSignal): AsyncGenerator<ScannedFile>;

  /** Check/request permission for a source's handle */
  ensurePermission(source: Source, interactive: boolean): Promise<PermissionState>;

  /** Get a playable URL for a track */
  getPlayableUrl(track: Track, source: Source): Promise<{ url: string; dispose(): void }>;

  /** Read a sidecar text file (e.g., .lrc) next to the track */
  readSidecarText(track: Track, source: Source, ext: string): Promise<string | null>;

  /** Read an image file in the same folder as the track */
  readImageNextTo(track: Track, source: Source, names: string[]): Promise<Blob | null>;

  // --- Optional Electron-only methods ---
  watchSource?(source: Source, onChange: () => void): () => void;
  showInFolder?(track: Track, source: Source): void;
  onExternalOpen?(cb: (paths: string[]) => void): void;
  onMediaKey?(cb: (k: 'play' | 'pause' | 'next' | 'prev' | 'stop') => void): void;
  setTaskbarProgress?(fraction: number | null): void;
  onSleepTimerEnd?(action: 'pause' | 'quit' | 'sleep-pc' | 'shutdown-pc'): void;
}
