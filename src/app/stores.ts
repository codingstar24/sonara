import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { toast } from 'sonner';
import { db, getDefaultSettings } from '@/db/schema';
import type { AppSettings } from '@/db/types';
import {
  SIDEBAR_DEFAULT_WIDTH,
  RIGHT_PANEL_DEFAULT_WIDTH,
} from '@/config/app';

// ============================================================
// Settings Store
// ============================================================

interface SettingsState extends AppSettings {
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  subscribeWithSelector((set, get) => ({
    ...getDefaultSettings(),
    loaded: false,

    async load() {
      const stored = await db.settings.get('settings');
      if (stored) {
        set({ ...stored, loaded: true });
      } else {
        const defaults = getDefaultSettings();
        await db.settings.put(defaults);
        set({ ...defaults, loaded: true });
      }
    },

    async update(patch) {
      const current = get();
      const updated = { ...current, ...patch, id: 'settings' };
      // Remove non-persisted fields
      const { loaded: _, load: _l, update: _u, ...toPersist } = updated as SettingsState;
      void _; void _l; void _u;
      await db.settings.put(toPersist as AppSettings);
      set(patch);
    },
  }))
);

// ============================================================
// UI Store (transient UI state, not persisted)
// ============================================================

export type RightPanelMode = 'now-playing' | 'queue' | 'lyrics';

interface UIState {
  // Sidebar
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  sidebarResizing: boolean;
  setSidebarWidth: (w: number) => void;
  setSidebarCollapsed: (c: boolean) => void;
  setSidebarResizing: (r: boolean) => void;

  // Right panel
  rightPanelWidth: number;
  rightPanelOpen: boolean;
  rightPanelMode: RightPanelMode;
  setRightPanelWidth: (w: number) => void;
  setRightPanelOpen: (open: boolean) => void;
  setRightPanelMode: (mode: RightPanelMode) => void;
  toggleRightPanel: (mode: RightPanelMode) => void;

  // Scroll positions for back/forward
  scrollPositions: Map<string, number>;
  saveScrollPosition: (key: string, pos: number) => void;
  getScrollPosition: (key: string) => number;

  // Drop overlay
  dragOver: boolean;
  setDragOver: (v: boolean) => void;

  // Import progress
  importActive: boolean;
  setImportActive: (v: boolean) => void;

  // Window width tracking
  windowWidth: number;
  setWindowWidth: (w: number) => void;

  // Immersive & Audio Modals
  fullscreenOpen: boolean;
  setFullscreenOpen: (open: boolean) => void;
  equalizerOpen: boolean;
  setEqualizerOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  subscribeWithSelector((set, get) => ({
    fullscreenOpen: false,
    setFullscreenOpen: (open) => set({ fullscreenOpen: open }),
    equalizerOpen: false,
    setEqualizerOpen: (open) => set({ equalizerOpen: open }),
    sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
    sidebarCollapsed: false,
    sidebarResizing: false,
    setSidebarWidth: (w) => set({ sidebarWidth: w }),
    setSidebarCollapsed: (c) => set({ sidebarCollapsed: c }),
    setSidebarResizing: (r) => set({ sidebarResizing: r }),

    rightPanelWidth: RIGHT_PANEL_DEFAULT_WIDTH,
    rightPanelOpen: false,
    rightPanelMode: 'now-playing',
    setRightPanelWidth: (w) => set({ rightPanelWidth: w }),
    setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
    setRightPanelMode: (mode) => set({ rightPanelMode: mode }),
    toggleRightPanel: (mode) => {
      const state = get();
      if (state.rightPanelOpen && state.rightPanelMode === mode) {
        set({ rightPanelOpen: false });
      } else {
        set({ rightPanelOpen: true, rightPanelMode: mode });
      }
    },

    scrollPositions: new Map(),
    saveScrollPosition: (key, pos) => {
      const map = new Map(get().scrollPositions);
      map.set(key, pos);
      set({ scrollPositions: map });
    },
    getScrollPosition: (key) => get().scrollPositions.get(key) ?? 0,

    dragOver: false,
    setDragOver: (v) => set({ dragOver: v }),

    importActive: false,
    setImportActive: (v) => set({ importActive: v }),

    windowWidth: typeof window !== 'undefined' ? window.innerWidth : 1280,
    setWindowWidth: (w) => set({ windowWidth: w }),
  }))
);

// ============================================================
// Library Store (in-memory index)
// ============================================================

import type { TrackLite, DerivedAlbum, DerivedArtist } from '@/db/types';

interface LibraryState {
  // Main index
  tracks: Map<string, TrackLite>;
  totalTracks: number;
  loaded: boolean;
  loading: boolean;

  // Derived
  albums: Map<string, DerivedAlbum>;
  artists: Map<string, DerivedArtist>;

  // Actions
  hydrate: () => Promise<void>;
  addTrack: (track: TrackLite) => void;
  addTracks: (tracks: TrackLite[]) => void;
  removeTrack: (id: string) => void;
  removeTracks: (ids: string[]) => Promise<void>;
  updateTrack: (id: string, patch: Partial<TrackLite>) => void;
  rebuildDerived: () => void;
}

export const useLibraryStore = create<LibraryState>()(
  subscribeWithSelector((set, get) => ({
    tracks: new Map(),
    totalTracks: 0,
    loaded: false,
    loading: false,
    albums: new Map(),
    artists: new Map(),

    async hydrate() {
      if (get().loading || get().loaded) return;
      set({ loading: true });

      const CHUNK_SIZE = 500;
      let offset = 0;
      const allTracks = new Map<string, TrackLite>();

      while (true) {
        const chunk = await db.tracks
          .offset(offset)
          .limit(CHUNK_SIZE)
          .toArray();

        if (chunk.length === 0) break;

        for (const t of chunk) {
          const lite: TrackLite = {
            id: t.id,
            title: t.overrides?.title ?? t.title,
            artist: t.overrides?.artist ?? t.artist,
            albumArtist: t.overrides?.albumArtist ?? t.albumArtist,
            album: t.overrides?.album ?? t.album,
            genres: t.overrides?.genres ?? t.genres,
            year: t.overrides?.year !== undefined ? t.overrides.year : t.year,
            duration: t.duration,
            artworkId: t.overrides?.artworkId !== undefined ? t.overrides.artworkId : t.artworkId,
            sourceId: t.sourceId,
            relPath: t.relPath,
            fingerprint: t.fingerprint,
            missing: t.missing,
            unsupported: t.unsupported,
            addedAt: t.addedAt,
            lossless: t.lossless,
            codec: t.codec,
            trackNo: t.overrides?.trackNo !== undefined ? t.overrides.trackNo : t.trackNo,
            discNo: t.overrides?.discNo !== undefined ? t.overrides.discNo : t.discNo,
            hiddenFromRecs: t.hiddenFromRecs,
          };
          allTracks.set(t.id, lite);
        }

        // Progressive update
        set({
          tracks: new Map(allTracks),
          totalTracks: allTracks.size,
        });

        offset += chunk.length;
        if (chunk.length < CHUNK_SIZE) break;

        // Yield to main thread
        await new Promise((r) => setTimeout(r, 0));
      }

      set({ loaded: true, loading: false });
      get().rebuildDerived();
    },

    addTrack(track) {
      const tracks = new Map(get().tracks);
      tracks.set(track.id, track);
      set({ tracks, totalTracks: tracks.size });
    },

    addTracks(newTracks) {
      const tracks = new Map(get().tracks);
      for (const t of newTracks) {
        tracks.set(t.id, t);
      }
      set({ tracks, totalTracks: tracks.size });
      get().rebuildDerived();
    },

    removeTrack(id) {
      const tracks = new Map(get().tracks);
      tracks.delete(id);
      set({ tracks, totalTracks: tracks.size });
    },

    async removeTracks(ids) {
      const tracks = new Map(get().tracks);
      for (const id of ids) {
        tracks.delete(id);
      }
      set({ tracks, totalTracks: tracks.size });
      get().rebuildDerived();

      await db.transaction('rw', [db.tracks, db.likes, db.playlistTracks], async () => {
        await db.tracks.bulkDelete(ids);
        await db.likes.bulkDelete(ids);
        await db.playlistTracks.where('trackId').anyOf(ids).delete();
      });
      toast.success(`Removed ${ids.length} ${ids.length === 1 ? 'song' : 'songs'} from library`);
    },

    updateTrack(id, patch) {
      const tracks = new Map(get().tracks);
      const existing = tracks.get(id);
      if (existing) {
        tracks.set(id, { ...existing, ...patch });
        set({ tracks });
      }
    },

    rebuildDerived() {
      const { tracks } = get();
      const albumMap = new Map<string, DerivedAlbum>();
      const artistMap = new Map<string, DerivedArtist>();

      for (const t of tracks.values()) {
        // Albums
        const albumKey = `${t.albumArtist || t.artist}|${t.album}`;
        if (t.album) {
          const existing = albumMap.get(albumKey);
          if (existing) {
            existing.trackCount++;
            existing.totalDuration += t.duration;
            existing.trackIds.push(t.id);
            if (!existing.artworkId && t.artworkId) {
              existing.artworkId = t.artworkId;
            }
            if (!existing.year && t.year) {
              existing.year = t.year;
            }
            for (const g of t.genres) {
              if (!existing.genres.includes(g)) existing.genres.push(g);
            }
          } else {
            albumMap.set(albumKey, {
              key: albumKey,
              albumArtist: t.albumArtist || t.artist,
              album: t.album,
              year: t.year,
              artworkId: t.artworkId,
              trackCount: 1,
              totalDuration: t.duration,
              trackIds: [t.id],
              genres: [...t.genres],
            });
          }
        }

        // Artists
        const artistNames = t.artist.split(/[,;&]/).map((a) => a.trim()).filter(Boolean);
        for (const name of artistNames) {
          const existing = artistMap.get(name);
          if (existing) {
            existing.trackCount++;
            existing.trackIds.push(t.id);
            if (!existing.artworkId && t.artworkId) {
              existing.artworkId = t.artworkId;
            }
          } else {
            artistMap.set(name, {
              name,
              trackCount: 1,
              albumCount: 0,
              artworkId: t.artworkId,
              trackIds: [t.id],
            });
          }
        }
      }

      // Count albums per artist
      for (const album of albumMap.values()) {
        const artistEntry = artistMap.get(album.albumArtist);
        if (artistEntry) {
          artistEntry.albumCount++;
        }
      }

      set({ albums: albumMap, artists: artistMap });
    },
  }))
);

// ============================================================
// Player Store (playback state)
// ============================================================

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerState {
  isPlaying: boolean;
  currentTrackId: string | null;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  speed: number;

  setPlaying: (p: boolean) => void;
  setCurrentTrackId: (id: string | null) => void;
  setDuration: (d: number) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  toggleMute: () => void;
  setShuffle: (s: boolean) => void;
  toggleShuffle: () => void;
  setRepeat: (r: RepeatMode) => void;
  cycleRepeat: () => void;
  setSpeed: (s: number) => void;
}

export const usePlayerStore = create<PlayerState>()(
  subscribeWithSelector((set, get) => ({
    isPlaying: false,
    currentTrackId: null,
    duration: 0,
    volume: 1,
    muted: false,
    shuffle: false,
    repeat: 'off',
    speed: 1,

    setPlaying: (p) => set({ isPlaying: p }),
    setCurrentTrackId: (id) => set({ currentTrackId: id }),
    setDuration: (d) => set({ duration: d }),
    setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
    setMuted: (m) => set({ muted: m }),
    toggleMute: () => set({ muted: !get().muted }),
    setShuffle: (s) => set({ shuffle: s }),
    toggleShuffle: () => set({ shuffle: !get().shuffle }),
    setRepeat: (r) => set({ repeat: r }),
    cycleRepeat: () => {
      const modes: RepeatMode[] = ['off', 'all', 'one'];
      const idx = modes.indexOf(get().repeat);
      set({ repeat: modes[(idx + 1) % 3]! });
    },
    setSpeed: (s) => set({ speed: s }),
  }))
);
