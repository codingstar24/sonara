import { describe, it, expect } from 'vitest';
import {
  calculateTimeAffinity,
  calculateTrackRank,
  applyDiversityReRank,
  type ScoredTrack,
} from './rank';
import { createDefaultTrackStats, createDecayedCounter } from './decay';
import type { TrackLite } from '@/db/types';

describe('Track Ranking and Diversity Re-ranking', () => {
  const dummyTrack: TrackLite = {
    id: 't-1',
    title: 'Test Song',
    artist: 'Radiohead',
    albumArtist: 'Radiohead',
    album: 'OK Computer',
    genres: ['Alternative Rock'],
    year: 1997,
    duration: 240,
    artworkId: null,
    sourceId: 's1',
    relPath: 't1.mp3',
    fingerprint: 'fp1',
    missing: false,
    unsupported: false,
    addedAt: 1000,
    lossless: false,
    codec: 'mp3',
    trackNo: 1,
    discNo: 1,
    hiddenFromRecs: false,
  };

  it('calculates time affinity with wrapping hours', () => {
    // 24 hour array
    const hist = new Array(24).fill(0);
    // User played at 23:00 (10 times) and 0:00 (5 times)
    hist[23] = 10;
    hist[0] = 5;

    // At 23:00, window is 22, 23, 0 -> 0 + 10 + 5 = 15 plays
    const affinityAt23 = calculateTimeAffinity(hist, 15, 23);
    expect(affinityAt23).toBe(1.0); // 15 / 15 = 1.0

    // At 0:00 (midnight), window is 23, 0, 1 -> 10 + 5 + 0 = 15
    const affinityAt0 = calculateTimeAffinity(hist, 15, 0);
    expect(affinityAt0).toBe(1.0);

    // At 12:00 (noon), window is 11, 12, 13 -> 0
    const affinityAt12 = calculateTimeAffinity(hist, 15, 12);
    expect(affinityAt12).toBe(0);
  });

  it('applies like boost and playlist boost correctly', () => {
    const t0 = 1000000;
    const stats = createDefaultTrackStats(dummyTrack.id, t0);
    stats.shortScore = createDecayedCounter(10, t0);

    // Baseline rank (unliked, 0 playlists)
    const base = calculateTrackRank(dummyTrack, stats, {
      now: t0,
      currentHour: 12,
      likedTrackIds: new Set(),
      trackPlaylistCountMap: new Map(),
    });

    // Liked rank (+30%)
    const liked = calculateTrackRank(dummyTrack, stats, {
      now: t0,
      currentHour: 12,
      likedTrackIds: new Set([dummyTrack.id]),
      trackPlaylistCountMap: new Map(),
    });
    expect(liked.rank).toBeCloseTo(base.rank * 1.3, 4);
    expect(liked.reasons).toContain('Liked song');

    // Playlist boost (2 playlists -> +10%)
    const inPlaylists = calculateTrackRank(dummyTrack, stats, {
      now: t0,
      currentHour: 12,
      likedTrackIds: new Set(),
      trackPlaylistCountMap: new Map([[dummyTrack.id, 2]]),
    });
    expect(inPlaylists.rank).toBeCloseTo(base.rank * 1.10, 4);
  });

  it('applies cooldown factor if track was played in the last 45 minutes', () => {
    const t0 = 1000000;
    const stats = createDefaultTrackStats(dummyTrack.id, t0);
    stats.shortScore = createDecayedCounter(10, t0);
    stats.lastPlayedAt = t0 - 10 * 60 * 1000; // 10 minutes ago (within 45 min)

    const cooled = calculateTrackRank(dummyTrack, stats, {
      now: t0,
      currentHour: 12,
      likedTrackIds: new Set(),
      trackPlaylistCountMap: new Map(),
    });

    stats.lastPlayedAt = t0 - 60 * 60 * 1000; // 60 minutes ago (outside cooldown)
    const uncooled = calculateTrackRank(dummyTrack, stats, {
      now: t0,
      currentHour: 12,
      likedTrackIds: new Set(),
      trackPlaylistCountMap: new Map(),
    });

    expect(cooled.rank).toBeCloseTo(uncooled.rank * 0.4, 4);
  });

  it('applies diversity re-ranking to downweight repeat artists and constrain albums', () => {
    const createItem = (id: string, artist: string, album: string, rank: number): ScoredTrack => ({
      track: { ...dummyTrack, id, artist, album },
      rank,
      baseRank: rank,
      reasons: [],
    });

    const candidates: ScoredTrack[] = [
      createItem('1', 'Artist A', 'Album 1', 100),
      createItem('2', 'Artist A', 'Album 1', 95),
      createItem('3', 'Artist A', 'Album 1', 90),
      createItem('4', 'Artist A', 'Album 1', 85), // 4th consecutive from Album 1
      createItem('5', 'Artist B', 'Album 2', 80),
      createItem('6', 'Artist C', 'Album 3', 70),
    ];

    const reranked = applyDiversityReRank(candidates, 5);

    // First should be track 1 (highest rank)
    expect(reranked[0]!.track.id).toBe('1');

    // Second pick: Artist A gets 0.75 penalty: 95 * 0.75 = 71.25.
    // Meanwhile Artist B has 80 > 71.25, so Artist B should win the second slot!
    expect(reranked[1]!.track.artist).toBe('Artist B');
  });
});
