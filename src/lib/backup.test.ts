import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { restoreLibraryBackup, type SonaraBackupPayload } from './backup';
import { db } from '@/db/schema';

describe('Backup and Restore Engine', () => {
  beforeEach(async () => {
    await db.tracks.clear();
    await db.likes.clear();
    await db.playlists.clear();
    await db.playlistTracks.clear();
  });

  it('rejects invalid or non-Sonara backups', async () => {
    await expect(restoreLibraryBackup('{"notSonara": true}')).rejects.toThrow();
  });

  it('restores and maps records using track fingerprints', async () => {
    // 1. Existing local track with new local ID
    await db.tracks.put({
      id: 'local-track-99',
      sourceId: 's1',
      relPath: 'Rock/song.mp3',
      fingerprint: 'unique-fp-12345',
      title: 'Local Song',
      artist: 'Band',
      albumArtist: 'Band',
      album: 'Album',
      genres: ['Rock'],
      year: 2021,
      duration: 200,
      artworkId: null,
      size: 1000,
      lastModified: 1000,
      addedAt: 1000,
      missing: false,
      unsupported: false,
      codec: 'mp3',
      bitrate: 320000,
      sampleRate: 44100,
      lossless: false,
      trackNo: 1,
      discNo: 1,
      overrides: null,
      hiddenFromRecs: false,
    });

    // 2. Synthetic backup created on a different PC where the track had id "old-pc-track-1"
    const payload: SonaraBackupPayload = {
      version: '1.0.0',
      appName: 'Sonara',
      exportedAt: 1000000,
      fingerprints: {
        'old-pc-track-1': 'unique-fp-12345',
      },
      playlists: [
        {
          id: 'pl-1',
          name: 'My Old Playlist',
          description: 'Restored playlist',
          kind: 'manual',
          smartRules: null,
          coverArtworkId: null,
          customCover: null,
          parentFolderId: null,
          sortMode: 'custom',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      playlistTracks: [
        {
          id: 'pt-1',
          playlistId: 'pl-1',
          trackId: 'old-pc-track-1',
          order: 1000,
          addedAt: 1000,
        },
      ],
      likes: [
        {
          trackId: 'old-pc-track-1',
          likedAt: 2000,
        },
      ],
      favorites: [],
      pins: [],
      trackStats: [],
      contextStats: [],
      playEvents: [],
      lyrics: [],
    };

    const summary = await restoreLibraryBackup(JSON.stringify(payload));

    expect(summary.tracksMatched).toBe(1);
    expect(summary.likesImported).toBe(1);
    expect(summary.playlistsImported).toBe(1);

    // Verify database row for like was remapped to 'local-track-99'
    const storedLike = await db.likes.get('local-track-99');
    expect(storedLike).toBeDefined();
    expect(storedLike?.likedAt).toBe(2000);

    // Verify playlist track was remapped
    const storedPt = await db.playlistTracks.get('pt-1');
    expect(storedPt?.trackId).toBe('local-track-99');
  });
});
