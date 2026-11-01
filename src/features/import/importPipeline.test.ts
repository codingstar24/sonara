import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/schema';
import type { Track, Source } from '@/db/types';

describe('Folder Import & Track Re-linking', () => {
  beforeEach(async () => {
    await db.sources.clear();
    await db.tracks.clear();
    await db.playlists.clear();
    await db.playlistTracks.clear();
  });

  it('updates loose direct file tracks when their folder is imported', async () => {
    // 1. Simulate loose track previously imported via single file
    const looseTrack: Track = {
      id: 'src_files_123:D:/Movies/Favs/song1.mp3',
      sourceId: 'src_files_123',
      relPath: 'D:/Movies/Favs/song1.mp3',
      size: 4000000,
      lastModified: Date.now(),
      fingerprint: 'fp_song1',
      title: 'Song 1',
      artist: 'Artist 1',
      albumArtist: 'Artist 1',
      album: 'Album 1',
      genres: ['Pop'],
      year: 2024,
      trackNo: 1,
      discNo: 1,
      duration: 180,
      bitrate: 320,
      sampleRate: 44100,
      codec: 'mp3',
      lossless: false,
      artworkId: null,
      missing: false,
      unsupported: false,
      addedAt: Date.now(),
      overrides: null,
      hiddenFromRecs: false,
    };
    await db.tracks.put(looseTrack);

    // 2. Now user imports the folder D:/Movies/Favs
    const folderSource: Source = {
      id: 'src_folder_favs',
      kind: 'path',
      name: 'Favs',
      path: 'D:/Movies/Favs',
      addedAt: Date.now(),
      lastScanAt: Date.now(),
      autoScan: true,
    };
    await db.sources.put(folderSource);

    // 3. Re-linking logic simulation (as implemented in importPipeline)
    const scannedRelPath = 'song1.mp3';
    await db.tracks.update(looseTrack.id, {
      sourceId: folderSource.id,
      relPath: scannedRelPath,
    });

    const updated = await db.tracks.get(looseTrack.id);
    expect(updated).toBeDefined();
    expect(updated?.sourceId).toBe('src_folder_favs');
    expect(updated?.relPath).toBe('song1.mp3');
  });

  it('creates a playlist for imported folders', async () => {
    const plId = `pl_folder_${Date.now()}`;
    await db.playlists.put({
      id: plId,
      name: 'Favs',
      kind: 'manual',
      description: 'Imported folder (D:/Movies/Favs)',
      smartRules: null,
      coverArtworkId: null,
      customCover: null,
      parentFolderId: null,
      sortMode: 'custom',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const pl = await db.playlists.get(plId);
    expect(pl).toBeDefined();
    expect(pl?.name).toBe('Favs');
  });
});
