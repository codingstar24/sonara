// ============================================================
// Core data types for Sonara
// ============================================================

// --- Sources ---
export type SourceKind = 'directory-handle' | 'file-handle' | 'path';

export interface Source {
  id: string;
  kind: SourceKind;
  handle?: FileSystemDirectoryHandle | FileSystemFileHandle;
  path?: string;
  name: string;
  addedAt: number;
  lastScanAt: number | null;
  autoScan: boolean;
}

// --- Tracks ---
export interface Track {
  id: string;
  sourceId: string;
  relPath: string;
  size: number;
  lastModified: number;
  fingerprint: string;
  title: string;
  artist: string;
  albumArtist: string;
  album: string;
  genres: string[];
  year: number | null;
  trackNo: number | null;
  discNo: number | null;
  duration: number; // seconds
  bitrate: number | null;
  sampleRate: number | null;
  codec: string;
  lossless: boolean;
  artworkId: string | null;
  addedAt: number;
  missing: boolean;
  unsupported: boolean;
  overrides: Partial<TrackOverrides> | null;
  hiddenFromRecs: boolean;
}

export interface TrackOverrides {
  title: string;
  artist: string;
  albumArtist: string;
  album: string;
  genres: string[];
  year: number | null;
  trackNo: number | null;
  discNo: number | null;
  artworkId: string | null;
}

/** Lightweight track representation for in-memory index */
export interface TrackLite {
  id: string;
  title: string;
  artist: string;
  albumArtist: string;
  album: string;
  genres: string[];
  year: number | null;
  duration: number;
  artworkId: string | null;
  sourceId: string;
  relPath: string;
  missing: boolean;
  unsupported: boolean;
  addedAt: number;
  lossless: boolean;
  codec: string;
  trackNo: number | null;
  discNo: number | null;
  hiddenFromRecs: boolean;
}

// --- Artwork ---
export interface Artwork {
  id: string; // content hash
  full: Blob;
  thumb: Blob;
  dominantColor: string;
}

// --- Playlists ---
export type PlaylistKind = 'manual' | 'smart' | 'folder';
export type PlaylistSortMode = 'custom' | 'title' | 'artist' | 'album' | 'date-added' | 'duration' | 'plays';

export interface Playlist {
  id: string;
  name: string;
  description: string;
  kind: PlaylistKind;
  smartRules: SmartPlaylistRules | null;
  coverArtworkId: string | null;
  customCover: Blob | null;
  parentFolderId: string | null;
  sortMode: PlaylistSortMode;
  createdAt: number;
  updatedAt: number;
}

export interface SmartPlaylistRules {
  match: 'all' | 'any';
  rules: SmartRule[];
  limit: number | null;
  sortBy: PlaylistSortMode;
}

export interface SmartRule {
  field: 'genre' | 'artist' | 'album' | 'year' | 'added-days' | 'play-count' | 'last-played-days' | 'liked' | 'duration' | 'lossless';
  op: 'is' | 'is-not' | 'contains' | 'gte' | 'lte' | 'range' | 'never';
  value: string | number | [number, number] | boolean;
}

export interface PlaylistTrack {
  id: string;
  playlistId: string;
  trackId: string;
  order: number;
  addedAt: number;
}

// --- Likes ---
export interface Like {
  trackId: string;
  likedAt: number;
}

// --- Favorites (albums/artists) ---
export interface Favorite {
  id: string;
  kind: 'album' | 'artist';
  key: string; // "albumArtist|album" or "artist"
  addedAt: number;
}

// --- Pins ---
export interface Pin {
  id: string;
  targetType: 'playlist' | 'album' | 'artist' | 'folder';
  targetId: string;
  order: number;
  addedAt: number;
}

// --- Play Events ---
export interface PlayEvent {
  id: string;
  trackId: string;
  startedAt: number;
  listenedMs: number;
  durationMs: number;
  completed: boolean;
  counted: boolean;
  earlySkip: boolean;
  source: string;
  contextType: ContextType | null;
  contextId: string | null;
  hour: number;
  weekday: number;
}

// --- Track Stats ---
export interface DecayedCounter {
  value: number;
  updatedAt: number;
}

export interface TrackStats {
  trackId: string;
  playCount: number;
  skipCount: number;
  lastPlayedAt: number | null;
  totalListenMs: number;
  hourHist: number[]; // [24]
  weekdayHist: number[]; // [7]
  shortScore: DecayedCounter;
  longScore: DecayedCounter;
  plays30: DecayedCounter;
  skips30: DecayedCounter;
}

// --- Context Stats ---
export interface ContextStats {
  key: string; // 'playlist:<id>' | 'album:<key>' | 'artist:<name>' | 'folder:<path>'
  score: DecayedCounter;
  lastPlayedAt: number;
  plays: number;
}

// --- Lyrics ---
export interface StoredLyrics {
  trackId: string;
  kind: 'synced' | 'plain';
  content: string; // raw LRC or plain text
  offset: number; // ms
  updatedAt: number;
}

// --- Queue State (persisted) ---
export type ContextType = 'playlist' | 'album' | 'artist' | 'liked' | 'folder' | 'songs' | 'search' | 'mix' | 'radio';

export interface QueueItem {
  itemId: string;
  trackId: string;
  origin: 'queue' | 'context';
}

export interface QueueContext {
  type: ContextType;
  id: string;
  name: string;
  trackIds: string[];
  playOrder: string[];
  cursor: number;
}

export interface QueueState {
  id: string; // singleton "queue"
  current: QueueItem | null;
  userQueue: QueueItem[];
  context: QueueContext | null;
  history: QueueItem[];
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
}

// --- Recommendations Cache ---
export interface RecsCache {
  id: string; // key
  data: unknown;
  computedAt: number;
  localDate: string;
  daypart: string;
  playsBucket: number;
}

// --- Settings ---
export interface AppSettings {
  id: string; // singleton "settings"
  // Library
  autoScanOnStartup: boolean;
  allowDuplicates: boolean;
  minTrackDurationS: number;
  scanSidecarLrc: boolean;
  // Playback
  crossfadeS: number;
  gapless: boolean;
  normalizeVolume: boolean;
  mono: boolean;
  defaultSpeed: number;
  autoplay: boolean;
  restoreSession: boolean;
  outputDeviceId: string;
  // Equalizer
  eqEnabled: boolean;
  eqPreset: string;
  eqBands: number[];
  eqPreamp: number;
  // Appearance
  theme: 'dark' | 'light' | 'amoled' | 'system';
  accent: string;
  density: 'comfortable' | 'compact';
  dynamicGradients: boolean;
  reducedMotion: boolean;
  // Home
  shelfOrder: string[];
  shelfVisibility: Record<string, boolean>;
  timePersonalization: boolean;
  excludedFolders: string[];
  minRecTrackDurationS: number;
  // Profile
  displayName: string;
  // Layout
  sidebarWidth: number;
  rightPanelWidth: number;
  sidebarCollapsed: boolean;
  rightPanelOpen: boolean;
  rightPanelMode: 'now-playing' | 'queue' | 'lyrics';
  songsColumns: string[];
  songsColumnWidths: Record<string, number>;
  songsSortColumn: string;
  songsSortDirection: 'asc' | 'desc';
  volume: number;
  muted: boolean;
  playbackSpeed: number;
}

// --- Search History ---
export interface SearchHistoryItem {
  id: string;
  query: string;
  type: 'track' | 'album' | 'artist' | 'playlist' | 'text';
  targetId: string | null;
  searchedAt: number;
}

// --- Derived types (not stored, computed) ---
export interface DerivedAlbum {
  key: string; // "albumArtist|album"
  albumArtist: string;
  album: string;
  year: number | null;
  artworkId: string | null;
  trackCount: number;
  totalDuration: number;
  trackIds: string[];
  genres: string[];
}

export interface DerivedArtist {
  name: string;
  trackCount: number;
  albumCount: number;
  artworkId: string | null; // largest album cover
  trackIds: string[];
}

// --- Scanned file (from PlatformAdapter) ---
export interface ScannedFile {
  name: string;
  relPath: string;
  size: number;
  lastModified: number;
  file: File;
}

// --- Source reference ---
export interface SourceRef {
  kind: SourceKind;
  handle?: FileSystemDirectoryHandle | FileSystemFileHandle;
  path?: string;
  name: string;
}

// --- Import progress ---
export interface ImportProgress {
  sourceId: string;
  sourceName: string;
  total: number;
  processed: number;
  added: number;
  duplicates: number;
  unsupported: number;
  errors: number;
  currentFile: string;
  done: boolean;
  cancelled: boolean;
}

// --- Recommendation types ---
export interface RecommendedTrack {
  trackId: string;
  rank: number;
  reasons: string[];
}

export interface DailyMix {
  index: number;
  name: string;
  subtitle: string;
  trackIds: string[];
  coverTrackIds: string[]; // 4 tracks for the collage cover
  seed: number;
}
