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
import { usePlaylistStore } from '@/features/playlists/playlistStore';

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

    // Check if source already exists with this path
    let source: Source | undefined;
    if (sourceRef.path) {
      source = await db.sources.where('path').equals(sourceRef.path).first();
    }

    if (!source) {
      const sourceId = `src_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      source = {
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
    } else {
      source.lastScanAt = Date.now();
      await db.sources.put(source);
    }

    await this.scanSource(source, { ...options, createPlaylistPerFolder: true });
  }

  async importFolderPath(rawPath: string, options: ImportOptions = {}): Promise<boolean> {
    const trimmed = rawPath.trim().replace(/^["']|["']$/g, '');
    if (!trimmed) {
      toast.error('Please enter a valid folder path');
      return false;
    }

    const bridge = (window as any).sonara || (window as any).electronAPI;
    const normalized = trimmed.replace(/\\/g, '/');

    if (bridge?.fs?.dirExists) {
      const exists = await bridge.fs.dirExists(trimmed);
      if (!exists) {
        toast.error(`Folder not found: "${trimmed}". Please verify the path exists.`);
        return false;
      }
    }

    const folderName = normalized.split('/').filter(Boolean).pop() || 'Music Folder';

    let source = await db.sources.where('path').equals(normalized).first();
    if (!source) {
      const sourceId = `src_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      source = {
        id: sourceId,
        kind: 'path',
        name: folderName,
        path: normalized,
        addedAt: Date.now(),
        lastScanAt: Date.now(),
        autoScan: true,
      };
      await db.sources.put(source);
    } else {
      source.lastScanAt = Date.now();
      await db.sources.put(source);
    }

    await this.scanSource(source, { ...options, createPlaylistPerFolder: true });
    return true;
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

        let file: File | null = null;
        if (ref.path) {
          const bridge = (window as any).sonara || (window as any).electronAPI;
          if (bridge) {
            try {
              const buffer = await bridge.fs.readFile(ref.path);
              file = new File([buffer as unknown as BlobPart], ref.name);
            } catch (err) {
              console.warn('Failed to read file from path:', ref.path, err);
            }
          }
        } else if (ref.handle instanceof File) {
          file = ref.handle;
        } else if (ref.handle && typeof (ref.handle as any).getFile === 'function') {
          file = await (ref.handle as FileSystemFileHandle).getFile();
        }

        if (!file) continue;

        const relPath = ref.path ? ref.path.replace(/\\/g, '/') : ref.name;
        const result = await importWorkerPool.parseFile({
          sourceId,
          relPath,
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
        useLibraryStore.getState().rebuildDerived();
        await usePlaylistStore.getState().hydrate();
      }

      if (addedCount === 0 && dupCount > 0) {
        toast.info(`All ${dupCount} ${dupCount === 1 ? 'file is' : 'files are'} already in your library.`);
      } else if (addedCount === 0 && dupCount === 0) {
        toast.info('No audio files were imported.');
      } else {
        toast.success(
          `Added ${addedCount} ${addedCount === 1 ? 'song' : 'songs'}${dupCount > 0 ? ` • ${dupCount} already present` : ''}${unsupportedCount > 0 ? ` • ${unsupportedCount} unsupported` : ''}`
        );
      }
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
    const existingTracks = Array.from(useLibraryStore.getState().tracks.values());
    const existingFingerprints = new Set(existingTracks.map((t) => t.fingerprint));
    const existingTracksByFingerprint = new Map(existingTracks.map((t) => [t.fingerprint, t.id]));
    const existingTracksByPath = new Map(existingTracks.map((t) => [t.relPath, t.id]));

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

            // Determine folder name for playlist creation
            const segs = scanned.relPath.split(/[/\\]/);
            const folderName = segs.length > 1 ? segs[segs.length - 2]! : source.name;

            if (!allowDuplicates && existingFingerprints.has(result.track.fingerprint)) {
              dupCount++;
              // Even if track is already in library, add to folder playlist!
              const existingId =
                existingTracksByFingerprint.get(result.track.fingerprint) ||
                existingTracksByPath.get(scanned.relPath) ||
                result.track.id;
              const existingList = folderMap.get(folderName) ?? [];
              if (!existingList.includes(existingId)) {
                existingList.push(existingId);
              }
              folderMap.set(folderName, existingList);
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
            const existingList = folderMap.get(folderName) ?? [];
            if (!existingList.includes(result.track.id)) {
              existingList.push(result.track.id);
            }
            folderMap.set(folderName, existingList);

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
      await useLibraryStore.getState().hydrate();
      useLibraryStore.getState().rebuildDerived();

      // Create or update playlists from folders (always on by default)
      if (options.createPlaylistPerFolder !== false && folderMap.size > 0) {
        const allPlaylists = await db.playlists.toArray();
        for (const [folderName, trackIds] of folderMap.entries()) {
          if (trackIds.length === 0) continue;

          let targetPl = allPlaylists.find(
            (p) => p.name.toLowerCase() === folderName.toLowerCase()
          );

          let plId: string;
          if (!targetPl) {
            plId = `pl_folder_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            targetPl = {
              id: plId,
              name: folderName,
              kind: 'manual',
              description: `Imported folder (${source.path || source.name})`,
              smartRules: null,
              coverArtworkId: null,
              customCover: null,
              parentFolderId: null,
              sortMode: 'custom',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            await db.playlists.put(targetPl);
          } else {
            plId = targetPl.id;
          }

          const existingPlTracks = await db.playlistTracks.where('playlistId').equals(plId).toArray();
          const existingTrackSet = new Set(existingPlTracks.map((pt) => pt.trackId));
          const newTrackIds = trackIds.filter((tid) => !existingTrackSet.has(tid));

          if (newTrackIds.length > 0) {
            const startOrder = existingPlTracks.length * ORDER_KEY_GAP;
            const plTracks: PlaylistTrack[] = newTrackIds.map((tid, idx) => ({
              id: `plt_${plId}_${Date.now()}_${idx}`,
              playlistId: plId,
              trackId: tid,
              order: startOrder + idx * ORDER_KEY_GAP,
              addedAt: Date.now(),
            }));
            await db.playlistTracks.bulkPut(plTracks);
          }
        }
      }

      await usePlaylistStore.getState().hydrate();

      if (addedCount === 0 && dupCount > 0) {
        toast.info(`All ${dupCount} ${dupCount === 1 ? 'song' : 'songs'} in this folder are already in your library.`);
      } else if (addedCount === 0 && dupCount === 0) {
        toast.info('No supported audio files found in selected folder.');
      } else {
        toast.success(
          `Added ${addedCount} ${addedCount === 1 ? 'song' : 'songs'}${dupCount > 0 ? ` • ${dupCount} already present` : ''}${unsupportedCount > 0 ? ` • ${unsupportedCount} unsupported` : ''}`
        );
      }
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
      await usePlaylistStore.getState().hydrate();

      toast.success(
        `Imported "${parsed.name}": matched ${matchedTrackIds.length} of ${parsed.entries.length} songs`
      );
    } else {
      toast.error(`No tracks in "${file.name}" could be matched to your library`);
    }
  }

  async importDroppedFiles(files: File[]): Promise<void> {
    const playlists: File[] = [];
    const directAudioFiles: File[] = [];
    const audioExts = new Set(['.mp3', '.flac', '.wav', '.ogg', '.opus', '.m4a', '.aac', '.webm', '.wma']);

    for (const f of files) {
      const lower = f.name.toLowerCase();
      if (lower.endsWith('.m3u') || lower.endsWith('.m3u8') || lower.endsWith('.pls')) {
        playlists.push(f);
      } else {
        const dotIdx = lower.lastIndexOf('.');
        const ext = dotIdx !== -1 ? lower.slice(dotIdx) : '';
        if (audioExts.has(ext)) {
          directAudioFiles.push(f);
        }
      }
    }

    for (const pl of playlists) {
      await this.importPlaylist(pl);
    }

    if (directAudioFiles.length > 0) {
      const platform = getPlatform();
      if ('registerFiles' in platform && typeof (platform as any).registerFiles === 'function') {
        (platform as any).registerFiles(directAudioFiles);
      }

      const sourceId = `src_dropped_${Date.now()}`;
      const source: Source = {
        id: sourceId,
        kind: 'file-handle',
        name: 'Dropped Audio',
        addedAt: Date.now(),
        lastScanAt: Date.now(),
        autoScan: false,
      };
      await db.sources.put(source);

      const store = useImportStore.getState();
      store.startImport();
      const allowDuplicates = useSettingsStore.getState().allowDuplicates;
      const existingTracks = Array.from(useLibraryStore.getState().tracks.values());
      const existingFingerprints = new Set(existingTracks.map((t) => t.fingerprint));
      const existingTracksByFingerprint = new Map(existingTracks.map((t) => [t.fingerprint, t.id]));
      const existingTracksByPath = new Map(existingTracks.map((t) => [t.relPath, t.id]));

      let addedCount = 0;
      let dupCount = 0;
      let unsupportedCount = 0;
      const folderMap = new Map<string, string[]>();
      const tracksBatch: Track[] = [];
      const artworkBatch: Artwork[] = [];
      const liteBatch: TrackLite[] = [];

      try {
        for (let i = 0; i < directAudioFiles.length; i++) {
          const file = directAudioFiles[i]!;
          store.updateProgress(file.name, i + 1, directAudioFiles.length);

          const filePath = (file as any).path ? (file as any).path.replace(/\\/g, '/') : (file.webkitRelativePath || file.name);
          const segs = filePath.split('/');
          const folderName = segs.length > 1 ? segs[segs.length - 2]! : 'Dropped Music';

          const result = await importWorkerPool.parseFile({
            sourceId,
            relPath: filePath,
            name: file.name,
            size: file.size,
            lastModified: file.lastModified,
            blob: file,
          });

          if (result.success && result.track) {
            if (!allowDuplicates && existingFingerprints.has(result.track.fingerprint)) {
              dupCount++;
              const existingId =
                existingTracksByFingerprint.get(result.track.fingerprint) ||
                existingTracksByPath.get(filePath) ||
                result.track.id;
              const existingList = folderMap.get(folderName) ?? [];
              if (!existingList.includes(existingId)) {
                existingList.push(existingId);
              }
              folderMap.set(folderName, existingList);
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

            const existingList = folderMap.get(folderName) ?? [];
            if (!existingList.includes(result.track.id)) {
              existingList.push(result.track.id);
            }
            folderMap.set(folderName, existingList);

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

        useLibraryStore.getState().rebuildDerived();

        // Create or update playlist for dropped folders/songs
        if (folderMap.size > 0) {
          const allPlaylists = await db.playlists.toArray();
          for (const [folderName, trackIds] of folderMap.entries()) {
            if (trackIds.length === 0) continue;

            let targetPl = allPlaylists.find(
              (p) => p.name.toLowerCase() === folderName.toLowerCase()
            );

            let plId: string;
            if (!targetPl) {
              plId = `pl_dropped_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
              targetPl = {
                id: plId,
                name: folderName,
                kind: 'manual',
                description: 'Imported audio files',
                smartRules: null,
                coverArtworkId: null,
                customCover: null,
                parentFolderId: null,
                sortMode: 'custom',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              await db.playlists.put(targetPl);
            } else {
              plId = targetPl.id;
            }

            const existingPlTracks = await db.playlistTracks.where('playlistId').equals(plId).toArray();
            const existingTrackSet = new Set(existingPlTracks.map((pt) => pt.trackId));
            const newTrackIds = trackIds.filter((tid) => !existingTrackSet.has(tid));

            if (newTrackIds.length > 0) {
              const startOrder = existingPlTracks.length * ORDER_KEY_GAP;
              const plTracks: PlaylistTrack[] = newTrackIds.map((tid, idx) => ({
                id: `plt_${plId}_${Date.now()}_${idx}`,
                playlistId: plId,
                trackId: tid,
                order: startOrder + idx * ORDER_KEY_GAP,
                addedAt: Date.now(),
              }));
              await db.playlistTracks.bulkPut(plTracks);
            }
          }
          await usePlaylistStore.getState().hydrate();
        }

        if (addedCount > 0) {
          toast.success(
            `Added ${addedCount} ${addedCount === 1 ? 'song' : 'songs'}${dupCount > 0 ? ` • ${dupCount} already present` : ''}${unsupportedCount > 0 ? ` • ${unsupportedCount} unsupported` : ''}`
          );
        } else if (dupCount > 0) {
          toast.info(`All ${dupCount} songs are already in your library`);
        }
      } finally {
        store.finishImport();
      }
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
