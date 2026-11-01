import { create } from 'zustand';
import { toast } from 'sonner';
import { db } from '@/db/schema';
import type { Like } from '@/db/types';

interface LikesState {
  likedIds: Set<string>;
  loaded: boolean;
  hydrate: () => Promise<void>;
  isLiked: (trackId: string) => boolean;
  toggleLike: (trackId: string) => Promise<boolean>;
  likeTracks: (trackIds: string[]) => Promise<void>;
  unlikeTracks: (trackIds: string[]) => Promise<void>;
}

export const useLikesStore = create<LikesState>()((set, get) => ({
  likedIds: new Set<string>(),
  loaded: false,

  async hydrate() {
    try {
      const allLikes = await db.likes.toArray();
      const setIds = new Set(allLikes.map((l) => l.trackId));
      set({ likedIds: setIds, loaded: true });
    } catch (e) {
      console.warn('Failed to hydrate likes:', e);
      set({ loaded: true });
    }
  },

  isLiked(trackId: string) {
    return get().likedIds.has(trackId);
  },

  async toggleLike(trackId: string) {
    const current = get().likedIds.has(trackId);
    const newLiked = !current;
    const nextSet = new Set(get().likedIds);

    if (newLiked) {
      nextSet.add(trackId);
      set({ likedIds: nextSet });
      try {
        await db.likes.put({ trackId, likedAt: Date.now() });
        toast('Added to Liked Songs', {
          action: {
            label: 'Undo',
            onClick: () => {
              void get().toggleLike(trackId);
            },
          },
        });
      } catch (e) {
        console.error('Failed to save like:', e);
      }
    } else {
      nextSet.delete(trackId);
      set({ likedIds: nextSet });
      try {
        await db.likes.delete(trackId);
        toast('Removed from Liked Songs', {
          action: {
            label: 'Undo',
            onClick: () => {
              void get().toggleLike(trackId);
            },
          },
        });
      } catch (e) {
        console.error('Failed to remove like:', e);
      }
    }

    return newLiked;
  },

  async likeTracks(trackIds: string[]) {
    const nextSet = new Set(get().likedIds);
    const likesToPut: Like[] = [];
    const now = Date.now();

    for (const tid of trackIds) {
      nextSet.add(tid);
      likesToPut.push({ trackId: tid, likedAt: now });
    }

    set({ likedIds: nextSet });
    await db.likes.bulkPut(likesToPut);
    toast.success(`Added ${trackIds.length} songs to Liked Songs`);
  },

  async unlikeTracks(trackIds: string[]) {
    const nextSet = new Set(get().likedIds);
    for (const tid of trackIds) {
      nextSet.delete(tid);
    }

    set({ likedIds: nextSet });
    await db.likes.bulkDelete(trackIds);
    toast.success(`Removed ${trackIds.length} songs from Liked Songs`);
  },
}));
