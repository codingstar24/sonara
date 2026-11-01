import { toast } from 'sonner';
import { getPlatform } from '@/platform';
import { db } from '@/db/schema';
import type { Source, Track, Artwork, TrackLite, Playlist, PlaylistTrack } from '@/db/types';
import { importWorkerPool } from '@/workers/workerPool';
import { useImportStore } from './useImportStore';
import { useLibraryStore, useSettingsStore } from '@/app/stores';
import { parseM3U, parsePLS } from '@/lib/m3uParser';
import { parseLrc } from '@/lib/lrcParser';
import { ORDER_KEY_INITIAL, ORDER_KEY_GAP, IMPORT_BATCH_SIZE } from '@/config/app';

export interface ImportOptions {
  createPlaylistPerFolder?: boolean;
  minTrackDurationS?: number;
}

export class ImportPipeline {
  private abortController: AbortController | null = null;

  async importFolder(options: ImportOptions = {}): Promise<void> {
    const platform = getPlatform();
    const sourceRef = await platform.pickFolder();
    if (!sourceRef) return;

    const sourceId = `src_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const source: Source = {
      id: sourceId,
      kind: sourceRef.kind,
      name: sourceRef.name,
      handle: sourceRef.handle,
      path: sourceRef.path,
      addedAt: Date.now(),
      lastScanAt: Date.now(),
      autoScan: true,
    };

    await db.sources.put(source);
    await this.scanSource(source, options);
  }

  async importFiles(): Promise<void> {
    const platform = getPlatform();
    const refs = await platform.pickFiles();
    if (!refs.length) return;

    const sourceId = `src_files_${Date.now()}`;
    const source: Source = {
      id: sourceId,
      kind: 'file-handle',
      name: 'Direct Files',
      addedAt: Date.now(),
      lastScanAt: Date.now(),
      autoScan: false,
    };
    await db.sources.put(source);

    this.abortController = new AbortController();
    const store = useImportStore.getState();
    store.startImport();

    const allowDuplicates = useSettingsStore.getState().allowDuplicates;
    const existingFingerprints = new Set(
      Array.from(useLibraryStore.getState().tracks.values()).map((t) => t.fingerprint)
    );

    let addedCount = 0;
    let dupCount = 0;
    let unsupportedCount = 0;

    const tracksBatch: Track[] = [];
    const artworkBatch: Artwork[] = [];
    const liteBatch: TrackLite[] = [];

    try {
      for (let i = 0; i < refs.length; i++) {
        if (store.cancelRequested || this.abortController.signal.aborted) break;

        const ref = refs[i]!;
        store.updateProgress(ref.name, i + 1, refs.length);

        if (!ref.handle) continue;
        const file = await (ref.handle as FileSystemFileHandle).getFile();

        const result = await importWorkerPool.parseFile({
          sourceId,
          relPath: ref.name,
          name: ref.name,
          size: file.size,
          lastModified: file.lastModified,
          blob: file,
        });

        if (result.success && result.track) {
          if (!allowDuplicates && existingFingerprints.has(result.track.fingerprint)) {
            dupCount++;
            continue;
          }

          existingFingerprints.add(result.track.fingerprint);
          if (result.track.unsupported) unsupportedCount++;

          tracksBatch.push({
            ...result.track,
            year: result.track.year ?? null,
            trackNo: result.track.trackNo ?? null,
            discNo: result.track.discNo ?? null,
            bitrate: result.track.bitrate ?? null,
            sampleRate: result.track.sampleRate ?? null,
            codec: result.track.codec ?? '',
            lossless: result.track.lossless ?? false,
            artworkId: result.track.artworkId ?? null,
            missing: false,
            unsupported: result.track.unsupported ?? false,
            overrides: null,
            hiddenFromRecs: false,
          });

          liteBatch.push({
            id: result.track.id,
            title: result.track.title,
            artist: result.track.artist,
            albumArtist: result.track.albumArtist,
            album: result.track.album,
            genres: result.track.genres,
            year: result.track.year ?? null,
            duration: result.track.duration,
            artworkId: result.track.artworkId ?? null,
            sourceId: result.track.sourceId,
            relPath: result.track.relPath,
            fingerprint: result.track.fingerprint,
            addedAt: result.track.addedAt,
            trackNo: result.track.trackNo ?? null,
            discNo: result.track.discNo ?? null,
            missing: false,
            unsupported: result.track.unsupported ?? false,
            lossless: result.track.lossless ?? false,
            codec: result.track.codec ?? '',
            hiddenFromRecs: false,
          });

          if (result.artwork) {
            artworkBatch.push({
              id: result.artwork.id,
              full: result.artwork.full,
              thumb: result.artwork.thumb,
              dominantColor: result.artwork.dominantColor,
            });
          }

          addedCount++;
        }
      }

      if (tracksBatch.length > 0) {
        await db.tracks.bulkPut(tracksBatch);
        if (artworkBatch.length > 0) {
          await db.artwork.bulkPut(artworkBatch);
        }
        useLibraryStore.getState().addTracks(liteBatch);
      }

      toast.success(
        `Added ${addedCount} ${addedCount === 1 ? 'song' : 'songs'} • ${dupCount} duplicates skipped • ${unsupportedCount} unsupported`
      );
    } finally {
      store.finishImport();
    }
  }

  async scanSource(source: Source, options: ImportOptions = {}): Promise<void> {
    const platform = getPlatform();
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const store = useImportStore.getState();
    store.startImport();

    const allowDuplicates = useSettingsStore.getState().allowDuplicates;
    const existingFingerprints = new Set(
      Array.from(useLibraryStore.getState().tracks.values()).map((t) => t.fingerprint)
    );

    let addedCount = 0;
    let dupCount = 0;
    let unsupportedCount = 0;
    let processedTotal = 0;

    const folderMap = new Map<string, string[]>();
    const tracksBatch: Track[] = [];
    const artworkBatch: Artwork[] = [];
    const liteBatch: TrackLite[] = [];

    const flushBatch = async () => {
      if (tracksBatch.length === 0) return;
      await db.tracks.bulkPut(tracksBatch);
      if (artworkBatch.length > 0) {
        await db.artwork.bulkPut(artworkBatch);
      }
      useLibraryStore.getState().addTracks(liteBatch);
      tracksBatch.length = 0;
      artworkBatch.length = 0;
      liteBatch.length = 0;
    };

    try {
      for await (const scanned of platform.scan(source, signal)) {
        if (store.cancelRequested || signal.aborted) break;

        processedTotal++;
        store.updateProgress(scanned.name, processedTotal, processedTotal + 10);

        try {
          const file = scanned.file;
          const result = await importWorkerPool.parseFile({
            sourceId: source.id,
            relPath: scanned.relPath,
            name: scanned.name,
            size: scanned.size,
            lastModified: scanned.lastModified,
            blob: file,
          });

          if (result.success && result.track) {
            if (options.minTrackDurationS && result.track.duration < options.minTrackDurationS) {
              continue;
            }

            if (!allowDuplicates && existingFingerprints.has(result.track.fingerprint)) {
              dupCount++;
              continue;
            }

            existingFingerprints.add(result.track.fingerprint);
            if (result.track.unsupported) unsupportedCount++;

            tracksBatch.push({
              ...result.track,
              year: result.track.year ?? null,
              trackNo: result.track.trackNo ?? null,
              discNo: result.track.discNo ?? null,
              bitrate: result.track.bitrate ?? null,
              sampleRate: result.track.sampleRate ?? null,
              codec: result.track.codec ?? '',
              lossless: result.track.lossless ?? false,
              artworkId: result.track.artworkId ?? null,
              missing: false,
              unsupported: result.track.unsupported ?? false,
              overrides: null,
              hiddenFromRecs: false,
            });

            liteBatch.push({
              id: result.track.id,
              title: result.track.title,
              artist: result.track.artist,
              albumArtist: result.track.albumArtist,
              album: result.track.album,
              genres: result.track.genres,
              year: result.track.year ?? null,
              duration: result.track.duration,
              artworkId: result.track.artworkId ?? null,
              sourceId: result.track.sourceId,
              relPath: result.track.relPath,
              fingerprint: result.track.fingerprint,
              addedAt: result.track.addedAt,
              trackNo: result.track.trackNo ?? null,
              discNo: result.track.discNo ?? null,
              missing: false,
              unsupported: result.track.unsupported ?? false,
              lossless: result.track.lossless ?? false,
              codec: result.track.codec ?? '',
              hiddenFromRecs: false,
            });

            if (result.artwork) {
              artworkBatch.push({
                id: result.artwork.id,
                full: result.artwork.full,
                thumb: result.artwork.thumb,
                dominantColor: result.artwork.dominantColor,
              });
            }

            // Track folder for playlist generation
            if (options.createPlaylistPerFolder) {
              const segs = scanned.relPath.split(/[/\\]/);
              if (segs.length > 1) {
                const folderName = segs[segs.length - 2]!;
                const existingList = folderMap.get(folderName) ?? [];
                existingList.push(result.track.id);
                folderMap.set(folderName, existingList);
              }
            }

            addedCount++;

            if (tracksBatch.length >= IMPORT_BATCH_SIZE) {
              await flushBatch();
            }
          }
        } catch (fileErr) {
          console.warn('Error reading scanned file:', scanned.name, fileErr);
        }
      }

      await flushBatch();

      // Create playlists from folders if requested
      if (options.createPlaylistPerFolder && folderMap.size > 0) {
        for (const [folderName, trackIds] of folderMap.entries()) {
          if (trackIds.length === 0) continue;
          const plId = `pl_folder_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const pl: Playlist = {
            id: plId,
            name: folderName,
            kind: 'manual',
            description: '',
            smartRules: null,
            coverArtworkId: null,
            customCover: null,
            parentFolderId: null,
            sortMode: 'custom',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await db.playlists.put(pl);

          const plTracks: PlaylistTrack[] = trackIds.map((tid, idx) => ({
            id: `plt_${plId}_${idx}`,
            playlistId: plId,
            trackId: tid,
            order: ORDER_KEY_INITIAL + idx * ORDER_KEY_GAP,
            addedAt: Date.now(),
          }));
          await db.playlistTracks.bulkPut(plTracks);
        }
      }

      toast.success(
        `Added ${addedCount} ${addedCount === 1 ? 'song' : 'songs'} • ${dupCount} duplicates skipped • ${unsupportedCount} unsupported`
      );
    } catch (err: any) {
      if (!signal.aborted) {
        toast.error(`Scan error: ${err?.message || 'Unknown error'}`);
      }
    } finally {
      store.finishImport();
    }
  }

  async importPlaylist(file: File): Promise<void> {
    const text = await file.text();
    const isPls = file.name.endsWith('.pls');
    const parsed = isPls ? parsePLS(text, file.name.replace(/\.[^/.]+$/, '')) : parseM3U(text, file.name.replace(/\.[^/.]+$/, ''));

    const allTracks = Array.from(useLibraryStore.getState().tracks.values());
    const matchedTrackIds: string[] = [];

    for (const entry of parsed.entries) {
      // 1. Match by exact path or filename
      const matchByPath = allTracks.find(
        (t) => t.relPath.endsWith(entry.path) || entry.path.endsWith(t.relPath)
      );
      if (matchByPath) {
        matchedTrackIds.push(matchByPath.id);
        continue;
      }

      // 2. Match by duration and title
      if (entry.title && entry.duration) {
        const matchByTitleDur = allTracks.find(
          (t) =>
            Math.abs(t.duration - entry.duration!) <= 2 &&
            t.title.toLowerCase() === entry.title!.toLowerCase()
        );
        if (matchByTitleDur) {
          matchedTrackIds.push(matchByTitleDur.id);
          continue;
        }
      }

      // 3. Match by fuzzy artist and title
      if (entry.title && entry.artist) {
        const matchFuzzy = allTracks.find(
          (t) =>
            t.title.toLowerCase().includes(entry.title!.toLowerCase()) &&
            t.artist.toLowerCase().includes(entry.artist!.toLowerCase())
        );
        if (matchFuzzy) {
          matchedTrackIds.push(matchFuzzy.id);
          continue;
        }
      }
    }

    if (matchedTrackIds.length > 0) {
      const plId = `pl_m3u_${Date.now()}`;
      const playlist: Playlist = {
        id: plId,
        name: parsed.name,
        kind: 'manual',
        description: `Imported from ${file.name}`,
        smartRules: null,
        coverArtworkId: null,
        customCover: null,
        parentFolderId: null,
        sortMode: 'custom',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await db.playlists.put(playlist);

      const plTracks: PlaylistTrack[] = matchedTrackIds.map((tid, idx) => ({
        id: `plt_${plId}_${idx}`,
        playlistId: plId,
        trackId: tid,
        order: ORDER_KEY_INITIAL + idx * ORDER_KEY_GAP,
        addedAt: Date.now(),
      }));
      await db.playlistTracks.bulkPut(plTracks);

      toast.success(
        `Imported "${parsed.name}": matched ${matchedTrackIds.length} of ${parsed.entries.length} songs`
      );
    } else {
      toast.error(`No tracks in "${file.name}" could be matched to your library`);
    }
  }

  async importLrc(trackId: string, file: File): Promise<void> {
    const text = await file.text();
    const parsed = parseLrc(text);

    await db.lyrics.put({
      trackId,
      kind: parsed.isSynced ? 'synced' : 'plain',
      content: parsed.rawText,
      offset: parsed.offsetMs,
      updatedAt: Date.now(),
    });

    toast.success('Lyrics added to track');
  }

  cancel() {
    this.abortController?.abort();
    useImportStore.getState().requestCancel();
    importWorkerPool.clearQueue();
  }
}

export const importPipeline = new ImportPipeline();
