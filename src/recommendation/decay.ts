import type { DecayedCounter, TrackStats } from '@/db/types';
import {
  HALF_LIFE_SHORT,
  HALF_LIFE_LONG,
  HALF_LIFE_PLAYS30,
  HALF_LIFE_SKIPS30,
} from '@/config/app';

/**
 * Calculates the decayed value of a counter at a given timestamp.
 * Formula: valueAt(t) = value * 0.5^((t - updatedAt) / H)
 */
export function calculateDecayedValue(
  counter: DecayedCounter | undefined,
  now: number,
  halfLifeMs: number
): number {
  if (!counter || counter.value <= 0) return 0;
  if (now <= counter.updatedAt) return counter.value;

  const elapsed = now - counter.updatedAt;
  const factor = Math.pow(0.5, elapsed / halfLifeMs);
  return counter.value * factor;
}

/**
 * Adds a weight to a decayed counter at a given timestamp.
 * Formula: add(w, t) = { value: max(0, valueAt(t) + w), updatedAt: t }
 */
export function addToDecayedCounter(
  counter: DecayedCounter | undefined,
  weight: number,
  now: number,
  halfLifeMs: number
): DecayedCounter {
  const currentValue = calculateDecayedValue(counter, now, halfLifeMs);
  const newValue = Math.max(0, currentValue + weight);
  return {
    value: newValue,
    updatedAt: now,
  };
}

/**
 * Creates a new decayed counter initialized at now.
 */
export function createDecayedCounter(initialValue = 0, now = Date.now()): DecayedCounter {
  return {
    value: Math.max(0, initialValue),
    updatedAt: now,
  };
}

/**
 * Creates default TrackStats for a new track.
 */
export function createDefaultTrackStats(trackId: string, now = Date.now()): TrackStats {
  return {
    trackId,
    playCount: 0,
    skipCount: 0,
    lastPlayedAt: null,
    totalListenMs: 0,
    hourHist: new Array(24).fill(0),
    weekdayHist: new Array(7).fill(0),
    shortScore: createDecayedCounter(0, now),
    longScore: createDecayedCounter(0, now),
    plays30: createDecayedCounter(0, now),
    skips30: createDecayedCounter(0, now),
  };
}

/**
 * Evaluates current scores for a TrackStats object at timestamp `now`.
 */
export function getEvaluatedStats(stats: TrackStats, now = Date.now()): {
  shortScore: number;
  longScore: number;
  plays30: number;
  skips30: number;
} {
  return {
    shortScore: calculateDecayedValue(stats.shortScore, now, HALF_LIFE_SHORT),
    longScore: calculateDecayedValue(stats.longScore, now, HALF_LIFE_LONG),
    plays30: calculateDecayedValue(stats.plays30, now, HALF_LIFE_PLAYS30),
    skips30: calculateDecayedValue(stats.skips30, now, HALF_LIFE_SKIPS30),
  };
}
