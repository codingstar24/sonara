import type { TrackStats, TrackLite } from '@/db/types';
import {
  LIKE_BOOST,
  PLAYLIST_BOOST_PER,
  PLAYLIST_BOOST_CAP,
  SKIP_PENALTY_MAX,
  SKIP_PENALTY_WEIGHT,
  TIME_AFFINITY_WEIGHT,
  TIME_AFFINITY_MIN_PLAYS,
  COOLDOWN_FACTOR,
  COOLDOWN_WINDOW_MS,
  DIVERSITY_ARTIST_DECAY,
  MAX_CONSECUTIVE_SAME_ALBUM,
} from '@/config/app';
import { calculateDecayedValue } from './decay';
import { HALF_LIFE_SHORT, HALF_LIFE_PLAYS30, HALF_LIFE_SKIPS30 } from '@/config/app';

export interface RankContext {
  now?: number;
  currentHour?: number;
  likedTrackIds: Set<string>;
  trackPlaylistCountMap: Map<string, number>;
}

export interface ScoredTrack {
  track: TrackLite;
  rank: number;
  baseRank: number;
  reasons: string[];
}

/**
 * Calculates time-of-day affinity:
 * (hist[h-1] + hist[h] + hist[h+1]) / max(1, playCount)
 * Hours wrap nicely (0-23).
 */
export function calculateTimeAffinity(
  hourHist: number[] | undefined,
  playCount: number,
  hour: number
): number {
  if (!hourHist || playCount <= 0) return 0;

  const hPrev = (hour + 23) % 24;
  const hCurr = hour % 24;
  const hNext = (hour + 1) % 24;

  const sum = (hourHist[hPrev] || 0) + (hourHist[hCurr] || 0) + (hourHist[hNext] || 0);
  return sum / Math.max(1, playCount);
}

/**
 * Formats hour in 12-hour AM/PM format (e.g. 9 PM, 12 PM, 8 AM)
 */
export function formatHourAmPm(hour: number): string {
  const h = hour % 24;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH} ${period}`;
}

/**
 * Calculates raw base rank and explanation reasons for a track.
 */
export function calculateTrackRank(
  track: TrackLite,
  stats: TrackStats | undefined,
  ctx: RankContext
): { rank: number; reasons: string[] } {
  const now = ctx.now ?? Date.now();
  const hour = ctx.currentHour ?? new Date(now).getHours();
  const reasons: string[] = [];

  // 1. Short score (what I'm into right now)
  const shortScore = stats?.shortScore
    ? calculateDecayedValue(stats.shortScore, now, HALF_LIFE_SHORT)
    : 0;

  if (shortScore >= 2.0) {
    const roundedPlays = Math.round(shortScore);
    reasons.push(
      roundedPlays > 1 ? `Played ~${roundedPlays} times recently` : 'Recent favorite'
    );
  }

  // 2. Like boost (1.3 if liked)
  const isLiked = ctx.likedTrackIds.has(track.id);
  const likeMultiplier = isLiked ? LIKE_BOOST : 1.0;
  if (isLiked) {
    reasons.push('Liked song');
  }

  // 3. Playlist boost: (1 + 0.05 * min(4, playlistCount))
  const playlistCount = ctx.trackPlaylistCountMap.get(track.id) || 0;
  const playlistMultiplier = 1 + PLAYLIST_BOOST_PER * Math.min(PLAYLIST_BOOST_CAP, playlistCount);
  if (playlistCount > 0) {
    reasons.push(`In ${playlistCount} of your playlists`);
  }

  // 4. Skip penalty: (1 - min(0.5, 0.6 * skips30 / (skips30 + plays30 + 1)))
  const skips30 = stats?.skips30
    ? calculateDecayedValue(stats.skips30, now, HALF_LIFE_SKIPS30)
    : 0;
  const plays30 = stats?.plays30
    ? calculateDecayedValue(stats.plays30, now, HALF_LIFE_PLAYS30)
    : 0;
  const skipRatio = skips30 / (skips30 + plays30 + 1);
  const skipPenalty = 1 - Math.min(SKIP_PENALTY_MAX, SKIP_PENALTY_WEIGHT * skipRatio);

  // 5. Time boost: (1 + 0.75 * timeAffinity * confidence)
  const playCount = stats?.playCount || 0;
  const timeAffinity = calculateTimeAffinity(stats?.hourHist, playCount, hour);
  const confidence = Math.min(1, playCount / TIME_AFFINITY_MIN_PLAYS);
  const timeBoost = 1 + TIME_AFFINITY_WEIGHT * timeAffinity * confidence;

  if (timeAffinity > 0.4 && confidence > 0.5) {
    reasons.push(`You often play this around ${formatHourAmPm(hour)}`);
  }

  // Raw rank before cooldown
  let rank = shortScore * likeMultiplier * playlistMultiplier * skipPenalty * timeBoost;

  // 6. Cooldown: multiply by 0.4 if played in the last 45 minutes
  if (stats?.lastPlayedAt && now - stats.lastPlayedAt < COOLDOWN_WINDOW_MS) {
    rank *= COOLDOWN_FACTOR;
  }

  if (reasons.length === 0) {
    reasons.push(`From your library: ${track.artist}`);
  }

  return { rank, reasons };
}

/**
 * Diversity re-ranking (greedy, MMR-like):
 * adjusted = rank * 0.75^(tracks by the same artist already picked)
 * Never more than 3 consecutive tracks from the same album.
 */
export function applyDiversityReRank(
  candidates: ScoredTrack[],
  maxCount: number
): ScoredTrack[] {
  const result: ScoredTrack[] = [];
  const artistCounts = new Map<string, number>();
  const remaining = [...candidates];

  while (result.length < maxCount && remaining.length > 0) {
    let bestIndex = -1;
    let bestScore = -1;

    // Check last consecutive album streak
    const lastAlbum = result.length > 0 ? result[result.length - 1]!.track.album : null;
    let consecutiveSameAlbum = 0;
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i]!.track.album && result[i]!.track.album === lastAlbum) {
        consecutiveSameAlbum++;
      } else {
        break;
      }
    }

    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i]!;
      const artist = (item.track.artist || '').trim().toLowerCase();
      const count = artistCounts.get(artist) || 0;

      // Rule: Never more than 3 consecutive tracks from same album
      if (
        consecutiveSameAlbum >= MAX_CONSECUTIVE_SAME_ALBUM &&
        item.track.album &&
        item.track.album === lastAlbum
      ) {
        continue;
      }

      // Penalty: 0.75^count
      const penalty = Math.pow(DIVERSITY_ARTIST_DECAY, count);
      const adjustedRank = item.rank * penalty;

      if (adjustedRank > bestScore) {
        bestScore = adjustedRank;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) {
      // If all remaining violated consecutive album constraint, break or take first
      break;
    }

    const [chosen] = remaining.splice(bestIndex, 1);
    if (!chosen) break;

    const artist = (chosen.track.artist || '').trim().toLowerCase();
    artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);

    result.push({
      ...chosen,
      rank: bestScore,
    });
  }

  return result;
}
