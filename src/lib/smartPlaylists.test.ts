import { describe, it, expect } from 'vitest';
import {
  evaluateSmartRule,
  filterTracksWithSmartRules,
  type TrackEvaluationContext,
} from './smartPlaylists';
import type { SmartPlaylistRules } from '@/db/types';

describe('Smart Playlists Evaluation Engine', () => {
  const sampleTrack: TrackEvaluationContext = {
    track: {
      id: 't1',
      sourceId: 's1',
      relPath: 'Rock/queen.flac',
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      album: 'A Night at the Opera',
      albumArtist: 'Queen',
      genres: ['Classic Rock'],
      year: 1975,
      trackNo: 11,
      discNo: 1,
      duration: 354,
      bitrate: 900,
      sampleRate: 44100,
      codec: 'flac',
      lossless: true,
      artworkId: 'art1',
      fingerprint: 'fp1',
      missing: false,
      unsupported: false,
      size: 1024,
      lastModified: Date.now(),
      overrides: null,
      hiddenFromRecs: false,
      addedAt: Date.now() - 5 * 86400000, // 5 days ago
    },
    playCount: 42,
    lastPlayedAt: Date.now() - 2 * 86400000, // 2 days ago
    isLiked: true,
  };

  it('matches string fields with is, is-not, contains', () => {
    expect(evaluateSmartRule({ field: 'genre', op: 'is', value: 'classic rock' }, sampleTrack)).toBe(true);
    expect(evaluateSmartRule({ field: 'genre', op: 'is-not', value: 'pop' }, sampleTrack)).toBe(true);
    expect(evaluateSmartRule({ field: 'artist', op: 'contains', value: 'que' }, sampleTrack)).toBe(true);
    expect(evaluateSmartRule({ field: 'album', op: 'is', value: 'wrong album' }, sampleTrack)).toBe(false);
  });

  it('evaluates year with gte, lte, range, and is', () => {
    expect(evaluateSmartRule({ field: 'year', op: 'gte', value: 1970 }, sampleTrack)).toBe(true);
    expect(evaluateSmartRule({ field: 'year', op: 'lte', value: 1970 }, sampleTrack)).toBe(false);
    expect(evaluateSmartRule({ field: 'year', op: 'range', value: [1970, 1980] }, sampleTrack)).toBe(true);
    expect(evaluateSmartRule({ field: 'year', op: 'is', value: 1975 }, sampleTrack)).toBe(true);
  });

  it('evaluates liked and lossless flags', () => {
    expect(evaluateSmartRule({ field: 'liked', op: 'is', value: true }, sampleTrack)).toBe(true);
    expect(evaluateSmartRule({ field: 'lossless', op: 'is', value: true }, sampleTrack)).toBe(true);
    expect(evaluateSmartRule({ field: 'lossless', op: 'is', value: false }, sampleTrack)).toBe(false);
  });

  it('evaluates play count and last played days', () => {
    expect(evaluateSmartRule({ field: 'play-count', op: 'gte', value: 40 }, sampleTrack)).toBe(true);
    expect(evaluateSmartRule({ field: 'play-count', op: 'lte', value: 10 }, sampleTrack)).toBe(false);
    expect(evaluateSmartRule({ field: 'last-played-days', op: 'gte', value: 1 }, sampleTrack)).toBe(true);
    expect(evaluateSmartRule({ field: 'last-played-days', op: 'never', value: true }, sampleTrack)).toBe(false);
  });

  it('evaluates combined rules with match: all and match: any', () => {
    const rulesConfigAll: SmartPlaylistRules = {
      match: 'all',
      rules: [
        { field: 'genre', op: 'contains', value: 'rock' },
        { field: 'year', op: 'gte', value: 1970 },
        { field: 'liked', op: 'is', value: true },
      ],
      limit: 10,
      sortBy: 'title',
    };

    const res = filterTracksWithSmartRules([sampleTrack], rulesConfigAll);
    expect(res.length).toBe(1);

    const rulesConfigFailing: SmartPlaylistRules = {
      match: 'all',
      rules: [
        { field: 'genre', op: 'contains', value: 'jazz' }, // fails
        { field: 'liked', op: 'is', value: true },
      ],
      limit: 10,
      sortBy: 'title',
    };
    expect(filterTracksWithSmartRules([sampleTrack], rulesConfigFailing).length).toBe(0);

    const rulesConfigAny: SmartPlaylistRules = {
      match: 'any',
      rules: [
        { field: 'genre', op: 'contains', value: 'jazz' }, // fails
        { field: 'liked', op: 'is', value: true }, // passes
      ],
      limit: 10,
      sortBy: 'title',
    };
    expect(filterTracksWithSmartRules([sampleTrack], rulesConfigAny).length).toBe(1);
  });
});
