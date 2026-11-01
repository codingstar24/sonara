import type { Track, TrackLite, SmartRule, SmartPlaylistRules } from '@/db/types';

export interface TrackEvaluationContext {
  track: Track | TrackLite;
  playCount?: number;
  lastPlayedAt?: number | null;
  isLiked?: boolean;
}

/**
 * Check if a single smart rule matches a track in context
 */
export function evaluateSmartRule(rule: SmartRule, ctx: TrackEvaluationContext): boolean {
  const { track, playCount = 0, lastPlayedAt = null, isLiked = false } = ctx;
  const now = Date.now();
  const dayMs = 86400000;

  switch (rule.field) {
    case 'genre': {
      const gList = (track.genres || []).map((g) => g.toLowerCase());
      const val = String(rule.value).toLowerCase();
      if (rule.op === 'is') return gList.includes(val);
      if (rule.op === 'is-not') return !gList.includes(val);
      if (rule.op === 'contains') return gList.some((g) => g.includes(val));
      return false;
    }

    case 'artist': {
      const a = (track.artist || '').toLowerCase();
      const val = String(rule.value).toLowerCase();
      if (rule.op === 'is') return a === val;
      if (rule.op === 'is-not') return a !== val;
      if (rule.op === 'contains') return a.includes(val);
      return false;
    }

    case 'album': {
      const alb = (track.album || '').toLowerCase();
      const val = String(rule.value).toLowerCase();
      if (rule.op === 'is') return alb === val;
      if (rule.op === 'is-not') return alb !== val;
      if (rule.op === 'contains') return alb.includes(val);
      return false;
    }

    case 'year': {
      const y = track.year ?? 0;
      if (rule.op === 'is') return y === Number(rule.value);
      if (rule.op === 'gte') return y >= Number(rule.value);
      if (rule.op === 'lte') return y <= Number(rule.value);
      if (rule.op === 'range' && Array.isArray(rule.value)) {
        const [min, max] = rule.value;
        return y >= (min ?? 0) && y <= (max ?? 9999);
      }
      return false;
    }

    case 'added-days': {
      const daysAgo = (now - track.addedAt) / dayMs;
      const targetDays = Number(rule.value);
      if (rule.op === 'lte') return daysAgo <= targetDays;
      if (rule.op === 'gte') return daysAgo >= targetDays;
      return false;
    }

    case 'play-count': {
      const count = playCount;
      const target = Number(rule.value);
      if (rule.op === 'gte') return count >= target;
      if (rule.op === 'lte') return count <= target;
      if (rule.op === 'is') return count === target;
      return false;
    }

    case 'last-played-days': {
      if (rule.op === 'never') {
        return lastPlayedAt == null || playCount === 0;
      }
      if (lastPlayedAt == null) return false;
      const daysSincePlay = (now - lastPlayedAt) / dayMs;
      const target = Number(rule.value);
      if (rule.op === 'gte') return daysSincePlay >= target;
      if (rule.op === 'lte') return daysSincePlay <= target;
      return false;
    }

    case 'liked': {
      const targetBool = Boolean(rule.value);
      return isLiked === targetBool;
    }

    case 'duration': {
      const d = track.duration;
      if (rule.op === 'gte') return d >= Number(rule.value);
      if (rule.op === 'lte') return d <= Number(rule.value);
      if (rule.op === 'range' && Array.isArray(rule.value)) {
        const [min, max] = rule.value;
        return d >= (min ?? 0) && d <= (max ?? Infinity);
      }
      return false;
    }

    case 'lossless': {
      const targetLossless = Boolean(rule.value);
      return (track.lossless ?? false) === targetLossless;
    }

    default:
      return false;
  }
}

/**
 * Filter and sort a collection of tracks according to smart playlist rules
 */
export function filterTracksWithSmartRules(
  items: TrackEvaluationContext[],
  rulesConfig: SmartPlaylistRules
): TrackEvaluationContext[] {
  const { match, rules, limit, sortBy } = rulesConfig;

  if (rules.length === 0) return items;

  let filtered = items.filter((ctx) => {
    if (match === 'all') {
      return rules.every((r) => evaluateSmartRule(r, ctx));
    } else {
      return rules.some((r) => evaluateSmartRule(r, ctx));
    }
  });

  // Sort
  filtered = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.track.title.localeCompare(b.track.title);
      case 'artist':
        return a.track.artist.localeCompare(b.track.artist);
      case 'album':
        return a.track.album.localeCompare(b.track.album);
      case 'date-added':
        return b.track.addedAt - a.track.addedAt;
      case 'duration':
        return b.track.duration - a.track.duration;
      case 'plays':
        return (b.playCount ?? 0) - (a.playCount ?? 0);
      default:
        return 0;
    }
  });

  if (limit != null && limit > 0) {
    filtered = filtered.slice(0, limit);
  }

  return filtered;
}
