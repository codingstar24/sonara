import { describe, it, expect } from 'vitest';
import { generateDailyMixes } from './dailyMix';
import type { TrackLite, TrackStats } from '@/db/types';

describe('Daily Mix Generation', () => {
  const createTrack = (id: string, artist: string, genre: string): TrackLite => ({
    id,
    title: `Song ${id}`,
    artist,
    albumArtist: artist,
    album: `Album ${artist}`,
    genres: [genre],
    year: 2020,
    duration: 200,
    artworkId: `art-${id}`,
    sourceId: 's1',
    relPath: `${genre}/${id}.mp3`,
    fingerprint: `fp-${id}`,
    missing: false,
    unsupported: false,
    addedAt: 1000,
    lossless: false,
    codec: 'mp3',
    trackNo: 1,
    discNo: 1,
    hiddenFromRecs: false,
  });

  it('clusters tracks by genre into Daily Mixes', () => {
    const tracks: TrackLite[] = [];
    // 25 Rock tracks
    for (let i = 1; i <= 25; i++) {
      tracks.push(createTrack(`rock-${i}`, 'Rock Band', 'Rock'));
    }
    // 25 Pop tracks
    for (let i = 1; i <= 25; i++) {
      tracks.push(createTrack(`pop-${i}`, 'Pop Star', 'Pop'));
    }

    const allStats = new Map<string, TrackStats>();
    const likes = new Set<string>();

    const mixes = generateDailyMixes(tracks, allStats, likes, '2026-11-01');

    expect(mixes.length).toBeGreaterThanOrEqual(2);
    expect(mixes[0]!.name).toBe('Daily Mix 1');
    expect(mixes[1]!.name).toBe('Daily Mix 2');
    expect(mixes[0]!.tracks.length).toBeGreaterThan(0);
  });

  it('generates deterministic mixes for the same localDate', () => {
    const tracks: TrackLite[] = [];
    for (let i = 1; i <= 30; i++) {
      tracks.push(createTrack(`t-${i}`, `Artist ${i % 3}`, 'Electronic'));
    }

    const stats = new Map<string, TrackStats>();
    const likes = new Set<string>();

    const run1 = generateDailyMixes(tracks, stats, likes, '2026-11-01');
    const run2 = generateDailyMixes(tracks, stats, likes, '2026-11-01');

    expect(run1[0]!.tracks.map((t) => t.id)).toEqual(run2[0]!.tracks.map((t) => t.id));
  });
});
