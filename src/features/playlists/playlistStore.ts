import { create } from 'zustand';
import { toast } from 'sonner';
import { db } from '@/db/schema';
import type { Playlist, PlaylistTrack, PlaylistSortMode } from '@/db/types';
import { calculateOrderBetween, rebalanceOrders, ORDER_STEP } from '@/lib/orderKey';

interface PlaylistStoreState {
  playlists: Map<string, Playlist>;
  playlistTracks: Map<string, PlaylistTrack[]>;
  pins: Set<string>;
  loaded: boolean;

  hydrate: () => Promise<void>;
  createPlaylist: (
    name?: string,
    description?: string,
    parentFolderId?: string | null
  ) => Promise<string>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  updateDescription: (id: string, description: string) => Promise<void>;
  setCustomCover: (id: string, imageBlob: Blob) => Promise<void>;
  duplicatePlaylist: (id: string) => Promise<string>;
  deletePlaylist: (id: string) => Promise<void>;
  togglePin: (targetId: string, targetType?: 'playlist' | 'folder') => Promise<boolean>;
  addTracksToPlaylist: (
    playlistId: string,
    trackIds: string[],
    allowDuplicates?: boolean
  ) => Promise<{ added: number; skipped: number }>;
  removeTrackFromPlaylist: (playlistTrackId: string) => Promise<void>;
  reorderPlaylistTracks: (
    playlistId: string,
    fromIndex: number,
    toIndex: number
  ) => Promise<void>;
  saveSortAsCustomOrder: (playlistId: string, sortedTrackIds: string[]) => Promise<void>;
  convertSmartToNormal: (playlistId: string) => Promise<void>;
  setSortMode: (playlistId: string, mode: PlaylistSortMode) => Promise<void>;
}

export const usePlaylistStore = create<PlaylistStoreState>()((set, get) => ({
  playlists: new Map<string, Playlist>(),
  playlistTracks: new Map<string, PlaylistTrack[]>(),
  pins: new Set<string>(),
  loaded: false,

  async hydrate() {
    try {
      const [allPlaylists, allTracks, allPins] = await Promise.all([
        db.playlists.toArray(),
        db.playlistTracks.toArray(),
        db.pins.toArray(),
      ]);

      const playlistMap = new Map<string, Playlist>();
      for (const pl of allPlaylists) {
        playlistMap.set(pl.id, pl);
      }

      const tracksMap = new Map<string, PlaylistTrack[]>();
      for (const pt of allTracks) {
        const list = tracksMap.get(pt.playlistId) || [];
        list.push(pt);
        tracksMap.set(pt.playlistId, list);
      }

      // Sort each playlist's tracks by order
      for (const [pId, list] of tracksMap.entries()) {
        list.sort((a, b) => a.order - b.order);
        tracksMap.set(pId, list);
      }

      const pinSet = new Set(allPins.map((p) => p.targetId));

      set({
        playlists: playlistMap,
        playlistTracks: tracksMap,
        pins: pinSet,
        loaded: true,
      });
    } catch (e) {
      console.warn('Failed to hydrate playlists:', e);
      set({ loaded: true });
    }
  },

  async createPlaylist(customName, description = '', parentFolderId = null) {
    const playlists = get().playlists;

    let finalName = customName;
    if (!finalName) {
      // Find next "My playlist #N"
      let count = 1;
      const existingNames = new Set(Array.from(playlists.values()).map((p) => p.name));
      while (existingNames.has(`My playlist #${count}`)) {
        count++;
      }
      finalName = `My playlist #${count}`;
    }

    const id = `pl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    const newPlaylist: Playlist = {
      id,
      name: finalName,
      description,
      kind: 'manual',
      smartRules: null,
      coverArtworkId: null,
      customCover: null,
      parentFolderId,
      sortMode: 'custom',
      createdAt: now,
      updatedAt: now,
    };

    await db.playlists.put(newPlaylist);

    const nextPlaylists = new Map(get().playlists);
    nextPlaylists.set(id, newPlaylist);
    set({ playlists: nextPlaylists });

    toast.success(`Created "${finalName}"`);
    return id;
  },

  async renamePlaylist(id, name) {
    const playlist = get().playlists.get(id);
    if (!playlist) return;

    const updated = { ...playlist, name, updatedAt: Date.now() };
    await db.playlists.put(updated);

    const nextPlaylists = new Map(get().playlists);
    nextPlaylists.set(id, updated);
    set({ playlists: nextPlaylists });
    toast.success('Playlist renamed');
  },

  async updateDescription(id, description) {
    const playlist = get().playlists.get(id);
    if (!playlist) return;

    const updated = { ...playlist, description, updatedAt: Date.now() };
    await db.playlists.put(updated);

    const nextPlaylists = new Map(get().playlists);
    nextPlaylists.set(id, updated);
    set({ playlists: nextPlaylists });
  },

  async setCustomCover(id, imageBlob) {
    const playlist = get().playlists.get(id);
    if (!playlist) return;

    const updated = { ...playlist, customCover: imageBlob, updatedAt: Date.now() };
    await db.playlists.put(updated);

    const nextPlaylists = new Map(get().playlists);
    nextPlaylists.set(id, updated);
    set({ playlists: nextPlaylists });
    toast.success('Cover updated');
  },

  async duplicatePlaylist(id) {
    const playlist = get().playlists.get(id);
    if (!playlist) throw new Error('Playlist not found');

    const newId = `pl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();
    const duplicatedName = `${playlist.name} (Copy)`;

    const duplicated: Playlist = {
      ...playlist,
      id: newId,
      name: duplicatedName,
      createdAt: now,
      updatedAt: now,
    };

    const existingTracks = get().playlistTracks.get(id) || [];
    const duplicatedTracks: PlaylistTrack[] = existingTracks.map((pt, idx) => ({
      id: `pt_${newId}_${idx}`,
      playlistId: newId,
      trackId: pt.trackId,
      order: pt.order,
      addedAt: now,
    }));

    await db.transaction('rw', [db.playlists, db.playlistTracks], async () => {
      await db.playlists.put(duplicated);
      if (duplicatedTracks.length > 0) {
        await db.playlistTracks.bulkPut(duplicatedTracks);
      }
    });

    const nextPlaylists = new Map(get().playlists);
    nextPlaylists.set(newId, duplicated);

    const nextTracks = new Map(get().playlistTracks);
    nextTracks.set(newId, duplicatedTracks);

    set({ playlists: nextPlaylists, playlistTracks: nextTracks });
    toast.success(`Duplicated as "${duplicatedName}"`);
    return newId;
  },

  async deletePlaylist(id) {
    const playlist = get().playlists.get(id);
    if (!playlist) return;

    const tracks = get().playlistTracks.get(id) || [];

    // Optimistically remove from state
    const nextPlaylists = new Map(get().playlists);
    nextPlaylists.delete(id);

    const nextTracks = new Map(get().playlistTracks);
    nextTracks.delete(id);

    set({ playlists: nextPlaylists, playlistTracks: nextTracks });

    let undone = false;

    toast(`Deleted "${playlist.name}"`, {
      duration: 10000,
      action: {
        label: 'Undo',
        onClick: async () => {
          undone = true;
          const restoredPlaylists = new Map(get().playlists);
          restoredPlaylists.set(id, playlist);

          const restoredTracks = new Map(get().playlistTracks);
          restoredTracks.set(id, tracks);

          set({ playlists: restoredPlaylists, playlistTracks: restoredTracks });
          await db.transaction('rw', [db.playlists, db.playlistTracks], async () => {
            await db.playlists.put(playlist);
            if (tracks.length > 0) {
              await db.playlistTracks.bulkPut(tracks);
            }
          });
        },
      },
    });

    setTimeout(async () => {
      if (!undone) {
        await db.transaction('rw', [db.playlists, db.playlistTracks, db.pins], async () => {
          await db.playlists.delete(id);
          await db.playlistTracks.where('playlistId').equals(id).delete();
          await db.pins.where('targetId').equals(id).delete();
        });
      }
    }, 10500);
  },

  async togglePin(targetId, targetType = 'playlist') {
    const pins = get().pins;
    const isPinned = pins.has(targetId);
    const nextPins = new Set(pins);

    if (isPinned) {
      nextPins.delete(targetId);
      set({ pins: nextPins });
      await db.pins.where('targetId').equals(targetId).delete();
      return false;
    } else {
      nextPins.add(targetId);
      set({ pins: nextPins });
      await db.pins.put({
        id: `pin_${targetId}`,
        targetType,
        targetId,
        order: Date.now(),
        addedAt: Date.now(),
      });
      return true;
    }
  },

  async addTracksToPlaylist(playlistId, trackIds, allowDuplicates = false) {
    const playlist = get().playlists.get(playlistId);
    if (!playlist) return { added: 0, skipped: 0 };

    const currentTracks = get().playlistTracks.get(playlistId) || [];
    const existingTrackIdSet = new Set(currentTracks.map((pt) => pt.trackId));

    const toAdd: string[] = [];
    let skipped = 0;

    for (const tid of trackIds) {
      if (!allowDuplicates && existingTrackIdSet.has(tid)) {
        skipped++;
      } else {
        toAdd.push(tid);
        existingTrackIdSet.add(tid);
      }
    }

    if (toAdd.length === 0) {
      if (skipped > 0) {
        toast.info(`${skipped} ${skipped === 1 ? 'song already' : 'songs already'} in playlist`);
      }
      return { added: 0, skipped };
    }

    let lastOrder = currentTracks.length > 0 ? currentTracks[currentTracks.length - 1]!.order : 0;
    const now = Date.now();

    const newPlaylistTracks: PlaylistTrack[] = toAdd.map((trackId) => {
      lastOrder += ORDER_STEP;
      return {
        id: `pt_${playlistId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        playlistId,
        trackId,
        order: lastOrder,
        addedAt: now,
      };
    });

    await db.playlistTracks.bulkPut(newPlaylistTracks);

    const merged = [...currentTracks, ...newPlaylistTracks];
    const nextTracks = new Map(get().playlistTracks);
    nextTracks.set(playlistId, merged);

    set({ playlistTracks: nextTracks });
    toast.success(
      `Added ${toAdd.length} ${toAdd.length === 1 ? 'song' : 'songs'} to "${playlist.name}"`
    );

    return { added: toAdd.length, skipped };
  },

  async removeTrackFromPlaylist(playlistTrackId) {
    let foundPlaylistId: string | null = null;
    const nextTracks = new Map(get().playlistTracks);

    for (const [pId, list] of nextTracks.entries()) {
      const idx = list.findIndex((pt) => pt.id === playlistTrackId);
      if (idx !== -1) {
        foundPlaylistId = pId;
        const copy = [...list];
        copy.splice(idx, 1);
        nextTracks.set(pId, copy);
        break;
      }
    }

    if (foundPlaylistId) {
      set({ playlistTracks: nextTracks });
      await db.playlistTracks.delete(playlistTrackId);
      toast.success('Removed from playlist');
    }
  },

  async reorderPlaylistTracks(playlistId, fromIndex, toIndex) {
    const list = get().playlistTracks.get(playlistId);
    if (!list || fromIndex === toIndex) return;

    const copy = [...list];
    const [moved] = copy.splice(fromIndex, 1);
    if (!moved) return;
    copy.splice(toIndex, 0, moved);

    // Calculate new order
    const prev = toIndex > 0 ? copy[toIndex - 1]?.order : null;
    const next = toIndex < copy.length - 1 ? copy[toIndex + 1]?.order : null;
    const { newOrder, needsRebalance } = calculateOrderBetween(prev, next);

    moved.order = newOrder;

    let finalTracks = copy;
    if (needsRebalance) {
      finalTracks = rebalanceOrders(copy);
      await db.playlistTracks.bulkPut(finalTracks);
    } else {
      await db.playlistTracks.put(moved);
    }

    const nextMap = new Map(get().playlistTracks);
    nextMap.set(playlistId, finalTracks);
    set({ playlistTracks: nextMap });
  },

  async saveSortAsCustomOrder(playlistId, sortedTrackIds) {
    const list = get().playlistTracks.get(playlistId);
    if (!list) return;

    const idToTrack = new Map(list.map((pt) => [pt.trackId, pt]));
    const reordered: PlaylistTrack[] = [];

    sortedTrackIds.forEach((tId, idx) => {
      const pt = idToTrack.get(tId);
      if (pt) {
        reordered.push({
          ...pt,
          order: (idx + 1) * ORDER_STEP,
        });
      }
    });

    await db.playlistTracks.bulkPut(reordered);
    const nextMap = new Map(get().playlistTracks);
    nextMap.set(playlistId, reordered);

    // Also update playlist sortMode to 'custom'
    const pl = get().playlists.get(playlistId);
    if (pl) {
      const updated = { ...pl, sortMode: 'custom' as const, updatedAt: Date.now() };
      await db.playlists.put(updated);
      const nextPlaylists = new Map(get().playlists);
      nextPlaylists.set(playlistId, updated);
      set({ playlists: nextPlaylists });
    }

    set({ playlistTracks: nextMap });
    toast.success('Saved as custom order');
  },

  async convertSmartToNormal(playlistId) {
    const pl = get().playlists.get(playlistId);
    if (!pl || pl.kind !== 'smart') return;

    const updated: Playlist = {
      ...pl,
      kind: 'manual',
      smartRules: null,
      updatedAt: Date.now(),
    };

    await db.playlists.put(updated);
    const nextPlaylists = new Map(get().playlists);
    nextPlaylists.set(playlistId, updated);
    set({ playlists: nextPlaylists });
    toast.success('Converted to standard playlist');
  },

  async setSortMode(playlistId, sortMode) {
    const pl = get().playlists.get(playlistId);
    if (!pl) return;

    const updated = { ...pl, sortMode, updatedAt: Date.now() };
    await db.playlists.put(updated);
    const nextPlaylists = new Map(get().playlists);
    nextPlaylists.set(playlistId, updated);
    set({ playlists: nextPlaylists });
  },
}));
