import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { toast } from 'sonner';
import { db } from '@/db/schema';
import type { ContextType, PlaylistTrack } from '@/db/types';
import {
  type FullQueueState,
  createInitialQueueState,
  playContext as playContextReducer,
  playNow as playNowReducer,
  playNext as playNextReducer,
  addToQueue as addToQueueReducer,
  removeFromQueue as removeFromQueueReducer,
  moveInQueue as moveInQueueReducer,
  clearQueue as clearQueueReducer,
  jumpToQueueItem as jumpToQueueItemReducer,
  getNextState,
  getPreviousState,
  setShuffle as setShuffleReducer,
} from '@/lib/queue';
import { audioEngine } from '@/engine/audioEngine';
import { mediaSessionManager } from '@/engine/mediaSession';
import { sleepTimerManager } from '@/features/player/sleepTimer';
import { usePlayerStore, useLibraryStore } from '@/app/stores';
import { safeBlobUrl } from '@/lib/blobUrl';

interface QueueStoreState extends FullQueueState {
  loaded: boolean;
  loadPersisted: () => Promise<void>;
  persist: () => Promise<void>;

  playContext: (
    type: ContextType,
    id: string,
    name: string,
    trackIds: string[],
    startTrackId?: string
  ) => Promise<void>;
  playNow: (trackId: string, type?: ContextType, id?: string, name?: string) => Promise<void>;
  playNext: (trackIds: string[]) => void;
  addToQueue: (trackIds: string[]) => void;
  removeFromQueue: (itemId: string) => void;
  moveInQueue: (from: number, to: number) => void;
  clearQueue: () => void;
  jumpTo: (itemId: string, section: 'queue' | 'context', contextIndex?: number) => Promise<void>;
  saveQueueAsPlaylist: (playlistName?: string) => Promise<void>;
  next: (isNaturalEnd?: boolean) => Promise<void>;
  previous: () => Promise<void>;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  togglePlay: () => Promise<void>;
  seek: (seconds: number) => void;
}

export const useQueueStore = create<QueueStoreState>()(
  subscribeWithSelector((set, get) => ({
    ...createInitialQueueState(),
    loaded: false,

    async loadPersisted() {
      try {
        const stored = await db.queueState.get('queue');
        if (stored) {
          set({
            current: stored.current,
            userQueue: stored.userQueue,
            context: stored.context,
            history: stored.history,
            shuffle: stored.shuffle,
            repeat: stored.repeat,
            loaded: true,
          });

          usePlayerStore.getState().setShuffle(stored.shuffle);
          usePlayerStore.getState().setRepeat(stored.repeat);

          // Restore track paused if present
          if (stored.current) {
            const track = await db.tracks.get(stored.current.trackId);
            if (track) {
              const source = await db.sources.get(track.sourceId);
              if (source) {
                await audioEngine.loadTrack(track, source, false);
                usePlayerStore.getState().setCurrentTrackId(track.id);
                usePlayerStore.getState().setDuration(track.duration);
              }
            }
          }
        } else {
          set({ loaded: true });
        }
      } catch (e) {
        console.warn('Failed to load persisted queue:', e);
        set({ loaded: true });
      }
    },

    async persist() {
      const state = get();
      try {
        await db.queueState.put({
          id: 'queue',
          current: state.current,
          userQueue: state.userQueue,
          context: state.context,
          history: state.history,
          shuffle: state.shuffle,
          repeat: state.repeat,
        });
      } catch {
        // Silently catch quota issues
      }
    },

    async playContext(type, id, name, trackIds, startTrackId) {
      const newState = playContextReducer(get(), type, id, name, trackIds, startTrackId);
      set(newState);
      void get().persist();

      if (newState.current) {
        await loadAndPlayTrack(newState.current.trackId);
      }
    },

    async playNow(trackId, type = 'songs', id = 'all', name = 'Songs') {
      const newState = playNowReducer(get(), trackId, type, id, name);
      set(newState);
      void get().persist();

      await loadAndPlayTrack(trackId);
    },

    playNext(trackIds) {
      const newState = playNextReducer(get(), trackIds);
      set(newState);
      void get().persist();
      toast.success(`Playing ${trackIds.length} ${trackIds.length === 1 ? 'song' : 'songs'} next`);
    },

    addToQueue(trackIds) {
      const newState = addToQueueReducer(get(), trackIds);
      set(newState);
      void get().persist();
      toast.success(`Added ${trackIds.length} ${trackIds.length === 1 ? 'song' : 'songs'} to queue`);
    },

    removeFromQueue(itemId) {
      const newState = removeFromQueueReducer(get(), itemId);
      set(newState);
      void get().persist();
    },

    moveInQueue(from, to) {
      const newState = moveInQueueReducer(get(), from, to);
      set(newState);
      void get().persist();
    },

    clearQueue() {
      const prev = get().userQueue;
      const newState = clearQueueReducer(get());
      set(newState);
      void get().persist();
      toast('Queue cleared', {
        action: {
          label: 'Undo',
          onClick: () => {
            set({ userQueue: prev });
            void get().persist();
          },
        },
      });
    },

    async jumpTo(itemId, section, contextIndex) {
      const prevQueue = get().userQueue;
      const newState = jumpToQueueItemReducer(get(), itemId, section, contextIndex);
      set(newState);
      void get().persist();

      if (section === 'queue') {
        toast('Jumped to track in queue', {
          action: {
            label: 'Undo',
            onClick: () => {
              set({ userQueue: prevQueue });
              void get().persist();
            },
          },
        });
      }

      if (newState.current) {
        await loadAndPlayTrack(newState.current.trackId);
      }
    },

    async saveQueueAsPlaylist(playlistName) {
      const state = get();
      const ids: string[] = [];
      if (state.current) ids.push(state.current.trackId);
      for (const item of state.userQueue) {
        ids.push(item.trackId);
      }
      if (state.context) {
        ids.push(...state.context.playOrder.slice(state.context.cursor + 1));
      }

      if (ids.length === 0) {
        toast.error('Queue is empty');
        return;
      }

      const id = `pl_${Date.now()}`;
      const name = playlistName || `Queue - ${new Date().toLocaleDateString()}`;
      await db.playlists.put({
        id,
        name,
        description: 'Saved from queue',
        kind: 'manual',
        smartRules: null,
        coverArtworkId: null,
        customCover: null,
        parentFolderId: null,
        sortMode: 'custom',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const playlistTracks: PlaylistTrack[] = ids.map((trackId, idx) => ({
        id: `pt_${id}_${idx}`,
        playlistId: id,
        trackId,
        order: idx,
        addedAt: Date.now(),
      }));
      await db.playlistTracks.bulkPut(playlistTracks);
      toast.success(`Saved "${name}" with ${ids.length} songs`);
    },

    async next(isNaturalEnd = false) {
      // Check sleep timer end-of-track mode
      if (isNaturalEnd) {
        sleepTimerManager.handleTrackEnd();
      }

      const nextState = getNextState(get(), isNaturalEnd);

      if (!nextState) {
        // End of queue reached with repeat off
        audioEngine.pause();
        audioEngine.seek(0);
        usePlayerStore.getState().setPlaying(false);
        return;
      }

      set(nextState);
      void get().persist();

      if (nextState.current) {
        await loadAndPlayTrack(nextState.current.trackId);
      }
    },

    async previous() {
      const audio = audioEngine.getActiveAudio();
      const currentPos = audio.currentTime;
      const { newState, shouldSeekToZero } = getPreviousState(get(), currentPos);

      if (shouldSeekToZero) {
        audioEngine.seek(0);
        return;
      }

      set(newState);
      void get().persist();

      if (newState.current) {
        await loadAndPlayTrack(newState.current.trackId);
      }
    },

    toggleShuffle() {
      const newShuffle = !get().shuffle;
      const newState = setShuffleReducer(get(), newShuffle);
      set(newState);
      usePlayerStore.getState().setShuffle(newShuffle);
      void get().persist();
    },

    cycleRepeat() {
      const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
      const idx = modes.indexOf(get().repeat);
      const newRepeat = modes[(idx + 1) % 3]!;
      set({ repeat: newRepeat });
      usePlayerStore.getState().setRepeat(newRepeat);
      void get().persist();
    },

    async togglePlay() {
      const isPlaying = usePlayerStore.getState().isPlaying;
      if (isPlaying) {
        audioEngine.pause();
        usePlayerStore.getState().setPlaying(false);
      } else {
        if (!get().current && useLibraryStore.getState().totalTracks > 0) {
          // Play first song in library
          const first = Array.from(useLibraryStore.getState().tracks.values())[0];
          if (first) {
            await get().playNow(first.id);
            return;
          }
        }
        await audioEngine.play();
        usePlayerStore.getState().setPlaying(true);
      }
    },

    seek(seconds) {
      audioEngine.seek(seconds);
    },
  }))
);

import {
  startTrackSession,
  finalizeSession,
  recordPlaybackTick,
} from '@/recommendation/telemetry';

// Helper to load track from DB and play through audioEngine
async function loadAndPlayTrack(trackId: string): Promise<void> {
  const track = await db.tracks.get(trackId);
  if (!track) {
    console.warn('loadAndPlayTrack: track not found in database:', trackId);
    return;
  }

  let source = await db.sources.get(track.sourceId);
  if (!source) {
    const allSources = await db.sources.toArray();
    source =
      allSources.find((s) => s.path && track.relPath.includes(s.path)) ||
      allSources[0];
    if (!source) {
      source = {
        id: track.sourceId || 'default-source',
        kind: 'path',
        name: 'Local Music',
        addedAt: Date.now(),
        lastScanAt: Date.now(),
        autoScan: false,
      };
    }
  }

  const context = useQueueStore.getState().context;
  startTrackSession(track.id, track.duration, context?.type, context?.id);

  usePlayerStore.getState().setCurrentTrackId(track.id);
  usePlayerStore.getState().setDuration(track.duration);
  usePlayerStore.getState().setPlaying(true);

  let artworkUrl: string | undefined;
  if (track.artworkId) {
    const art = await db.artwork.get(track.artworkId);
    artworkUrl = safeBlobUrl(art?.full) || undefined;
  }

  mediaSessionManager.updateMetadata(track, artworkUrl);
  mediaSessionManager.updatePlaybackState('playing');

  await audioEngine.loadTrack(track, source, true);
}

// Wire audio engine events into queue and player stores
audioEngine.setEvents({
  onPlay: () => {
    usePlayerStore.getState().setPlaying(true);
    mediaSessionManager.updatePlaybackState('playing');
  },
  onPause: () => {
    usePlayerStore.getState().setPlaying(false);
    mediaSessionManager.updatePlaybackState('paused');
  },
  onEnded: () => {
    void finalizeSession('ended');
    void useQueueStore.getState().next(true);
  },
  onTimeUpdate: (currentTime) => {
    recordPlaybackTick(currentTime * 1000);
  },
  onError: (err) => {
    void finalizeSession('skip');
    toast.error(err.message);
    setTimeout(() => {
      void useQueueStore.getState().next(false);
    }, 1000);
  },
});

// Wire media session callbacks
mediaSessionManager.init({
  onPlay: () => void useQueueStore.getState().togglePlay(),
  onPause: () => void useQueueStore.getState().togglePlay(),
  onNext: () => void useQueueStore.getState().next(false),
  onPrevious: () => void useQueueStore.getState().previous(),
  onSeekTo: (s) => useQueueStore.getState().seek(s),
  onSeekBackward: (offset) => {
    const pos = audioEngine.getActiveAudio().currentTime;
    useQueueStore.getState().seek(Math.max(0, pos - offset));
  },
  onSeekForward: (offset) => {
    const pos = audioEngine.getActiveAudio().currentTime;
    useQueueStore.getState().seek(pos + offset);
  },
});
