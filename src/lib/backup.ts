import { db } from '@/db/schema';
import type {
  Playlist,
  PlaylistTrack,
  Like,
  Favorite,
  Pin,
  TrackStats,
  ContextStats,
  PlayEvent,
  StoredLyrics,
  AppSettings,
} from '@/db/types';

export interface SonaraBackupPayload {
  version: '1.0.0';
  appName: 'Sonara';
  exportedAt: number;
  fingerprints: Record<string, string>; // trackId -> fingerprint
  playlists: Playlist[];
  playlistTracks: PlaylistTrack[];
  likes: Like[];
  favorites: Favorite[];
  pins: Pin[];
  trackStats: TrackStats[];
  contextStats: ContextStats[];
  playEvents: PlayEvent[];
  lyrics: StoredLyrics[];
  settings?: AppSettings;
}

export interface RestoreSummary {
  playlistsImported: number;
  likesImported: number;
  playEventsImported: number;
  lyricsImported: number;
  statsImported: number;
  tracksMatched: number;
}

/**
 * Creates a versioned backup JSON string of user data.
 */
export async function createLibraryBackup(): Promise<string> {
  const [
    tracks,
    playlists,
    playlistTracks,
    likes,
    favorites,
    pins,
    trackStats,
    contextStats,
    playEvents,
    lyrics,
    settings,
  ] = await Promise.all([
    db.tracks.toArray(),
    db.playlists.toArray(),
    db.playlistTracks.toArray(),
    db.likes.toArray(),
    db.favorites.toArray(),
    db.pins.toArray(),
    db.trackStats.toArray(),
    db.contextStats.toArray(),
    db.playEvents.toArray(),
    db.lyrics.toArray(),
    db.settings.get('settings'),
  ]);

  const fingerprints: Record<string, string> = {};
  for (const t of tracks) {
    if (t.fingerprint) {
      fingerprints[t.id] = t.fingerprint;
    }
  }

  // Remove raw Blob objects from playlists for clean serialization
  const serializablePlaylists = playlists.map((p) => ({
    ...p,
    customCover: null,
  }));

  const payload: SonaraBackupPayload = {
    version: '1.0.0',
    appName: 'Sonara',
    exportedAt: Date.now(),
    fingerprints,
    playlists: serializablePlaylists,
    playlistTracks,
    likes,
    favorites,
    pins,
    trackStats,
    contextStats,
    playEvents,
    lyrics,
    settings,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Initiates a browser file download of the backup JSON.
 */
export function downloadBackupFile(jsonStr: string): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sonara-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Restores library metadata and listening history by matching track fingerprints.
 */
export async function restoreLibraryBackup(jsonStr: string): Promise<RestoreSummary> {
  let payload: SonaraBackupPayload;
  try {
    payload = JSON.parse(jsonStr) as SonaraBackupPayload;
    if (payload.appName !== 'Sonara' || !payload.version) {
      throw new Error('Invalid backup file format: missing Sonara signature.');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid JSON file';
    throw new Error(`Failed to parse backup: ${msg}`);
  }

  // 1. Build fingerprint -> localTrackId map from current database
  const currentTracks = await db.tracks.toArray();
  const fpToLocalId = new Map<string, string>();
  for (const t of currentTracks) {
    if (t.fingerprint) {
      fpToLocalId.set(t.fingerprint, t.id);
    }
  }

  // 2. Map oldTrackId -> fingerprint -> currentTrackId
  const oldIdToNewId = new Map<string, string>();
  for (const [oldId, fp] of Object.entries(payload.fingerprints || {})) {
    const newId = fpToLocalId.get(fp);
    if (newId) {
      oldIdToNewId.set(oldId, newId);
    }
  }

  const tracksMatched = oldIdToNewId.size;

  // 3. Remap and prepare records
  const likesToPut: Like[] = [];
  for (const l of payload.likes || []) {
    const localTrackId = oldIdToNewId.get(l.trackId);
    if (localTrackId) {
      likesToPut.push({ trackId: localTrackId, likedAt: l.likedAt });
    }
  }

  const playEventsToPut: PlayEvent[] = [];
  for (const ev of payload.playEvents || []) {
    const localTrackId = oldIdToNewId.get(ev.trackId);
    if (localTrackId) {
      playEventsToPut.push({ ...ev, trackId: localTrackId });
    }
  }

  const trackStatsToPut: TrackStats[] = [];
  for (const s of payload.trackStats || []) {
    const localTrackId = oldIdToNewId.get(s.trackId);
    if (localTrackId) {
      trackStatsToPut.push({ ...s, trackId: localTrackId });
    }
  }

  const lyricsToPut: StoredLyrics[] = [];
  for (const lyr of payload.lyrics || []) {
    const localTrackId = oldIdToNewId.get(lyr.trackId);
    if (localTrackId) {
      lyricsToPut.push({ ...lyr, trackId: localTrackId });
    }
  }

  const playlistsToPut = payload.playlists || [];
  const playlistTracksToPut: PlaylistTrack[] = [];
  for (const pt of payload.playlistTracks || []) {
    const localTrackId = oldIdToNewId.get(pt.trackId);
    if (localTrackId) {
      playlistTracksToPut.push({ ...pt, trackId: localTrackId });
    }
  }

  // 4. Batch commit to Dexie
  await db.transaction(
    'rw',
    [
      db.playlists,
      db.playlistTracks,
      db.likes,
      db.favorites,
      db.pins,
      db.trackStats,
      db.contextStats,
      db.playEvents,
      db.lyrics,
    ],
    async () => {
      if (playlistsToPut.length > 0) await db.playlists.bulkPut(playlistsToPut);
      if (playlistTracksToPut.length > 0) await db.playlistTracks.bulkPut(playlistTracksToPut);
      if (likesToPut.length > 0) await db.likes.bulkPut(likesToPut);
      if (payload.favorites && payload.favorites.length > 0) await db.favorites.bulkPut(payload.favorites);
      if (payload.pins && payload.pins.length > 0) await db.pins.bulkPut(payload.pins);
      if (trackStatsToPut.length > 0) await db.trackStats.bulkPut(trackStatsToPut);
      if (payload.contextStats && payload.contextStats.length > 0) await db.contextStats.bulkPut(payload.contextStats);
      if (playEventsToPut.length > 0) await db.playEvents.bulkPut(playEventsToPut);
      if (lyricsToPut.length > 0) await db.lyrics.bulkPut(lyricsToPut);
    }
  );

  return {
    playlistsImported: playlistsToPut.length,
    likesImported: likesToPut.length,
    playEventsImported: playEventsToPut.length,
    lyricsImported: lyricsToPut.length,
    statsImported: trackStatsToPut.length,
    tracksMatched,
  };
}
