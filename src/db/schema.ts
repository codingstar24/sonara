import Dexie from 'dexie';
import type {
  Source,
  Track,
  Artwork,
  Playlist,
  PlaylistTrack,
  Like,
  Favorite,
  Pin,
  PlayEvent,
  TrackStats,
  ContextStats,
  StoredLyrics,
  QueueState,
  RecsCache,
  AppSettings,
  SearchHistoryItem,
} from './types';

export class SonaraDB extends Dexie {
  sources!: Dexie.Table<Source, string>;
  tracks!: Dexie.Table<Track, string>;
  artwork!: Dexie.Table<Artwork, string>;
  playlists!: Dexie.Table<Playlist, string>;
  playlistTracks!: Dexie.Table<PlaylistTrack, string>;
  likes!: Dexie.Table<Like, string>;
  favorites!: Dexie.Table<Favorite, string>;
  pins!: Dexie.Table<Pin, string>;
  playEvents!: Dexie.Table<PlayEvent, string>;
  trackStats!: Dexie.Table<TrackStats, string>;
  contextStats!: Dexie.Table<ContextStats, string>;
  lyrics!: Dexie.Table<StoredLyrics, string>;
  queueState!: Dexie.Table<QueueState, string>;
  recsCache!: Dexie.Table<RecsCache, string>;
  settings!: Dexie.Table<AppSettings, string>;
  searchHistory!: Dexie.Table<SearchHistoryItem, string>;

  constructor() {
    super('sonara');

    this.version(1).stores({
      sources: 'id, kind, name, addedAt',
      tracks: 'id, sourceId, fingerprint, [sourceId+relPath], album, artist, albumArtist, artworkId, addedAt, missing, unsupported',
      artwork: 'id',
      playlists: 'id, kind, parentFolderId, name, createdAt, updatedAt',
      playlistTracks: 'id, playlistId, trackId, [playlistId+order], [playlistId+trackId]',
      likes: 'trackId, likedAt',
      favorites: 'id, kind, key, addedAt',
      pins: 'id, targetType, targetId, order',
      playEvents: 'id, trackId, startedAt, hour, weekday, contextType, contextId',
      trackStats: 'trackId, playCount, lastPlayedAt',
      contextStats: 'key, lastPlayedAt',
      lyrics: 'trackId',
      queueState: 'id',
      recsCache: 'id, computedAt',
      settings: 'id',
      searchHistory: 'id, searchedAt',
    });
  }
}

export const db = new SonaraDB();

// --- Default settings ---
export function getDefaultSettings(): AppSettings {
  return {
    id: 'settings',
    autoScanOnStartup: true,
    allowDuplicates: false,
    minTrackDurationS: 0,
    scanSidecarLrc: true,
    crossfadeS: 0,
    gapless: true,
    normalizeVolume: false,
    mono: false,
    defaultSpeed: 1,
    autoplay: true,
    restoreSession: true,
    outputDeviceId: '',
    eqEnabled: false,
    eqPreset: 'Flat',
    eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    eqPreamp: 0,
    theme: 'dark',
    accent: '#1ED760',
    density: 'comfortable',
    dynamicGradients: true,
    reducedMotion: false,
    shelfOrder: [
      'quick-picks', 'continue-listening', 'most-played', 'on-repeat',
      'picked-for-you', 'made-for-you', 'top-artists', 'top-albums',
      'because-you-listened', 'recently-played', 'recently-added', 'unheard-gems',
      'listening-snapshot',
    ],
    shelfVisibility: {},
    timePersonalization: true,
    excludedFolders: [],
    minRecTrackDurationS: 30,
    displayName: '',
    sidebarWidth: 320,
    rightPanelWidth: 340,
    sidebarCollapsed: false,
    rightPanelOpen: false,
    rightPanelMode: 'now-playing',
    songsColumns: ['#', 'title', 'album', 'date-added', 'duration'],
    songsColumnWidths: {},
    songsSortColumn: 'date-added',
    songsSortDirection: 'desc',
    volume: 1,
    muted: false,
    playbackSpeed: 1,
  };
}
