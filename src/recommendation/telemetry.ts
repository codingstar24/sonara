import { db } from '@/db/schema';
import type { PlayEvent, ContextType } from '@/db/types';
import {
  COUNTED_MIN_S,
  COUNTED_MIN_FRACTION,
  COMPLETED_MIN_FRACTION,
  EARLY_SKIP_MAX_S,
  EARLY_SKIP_MIN_DURATION_S,
  REPLAY_BONUS_WINDOW_MS,
  WEIGHT_COMPLETED,
  WEIGHT_COUNTED,
  WEIGHT_REPLAY_BONUS,
  WEIGHT_EARLY_SKIP,
  HALF_LIFE_SHORT,
  HALF_LIFE_LONG,
  HALF_LIFE_PLAYS30,
  HALF_LIFE_SKIPS30,
  HALF_LIFE_CONTEXT,
} from '@/config/app';
import { addToDecayedCounter, createDefaultTrackStats, createDecayedCounter } from './decay';

interface ActiveSession {
  trackId: string;
  durationMs: number;
  startedAt: number;
  contextType: ContextType | null;
  contextId: string | null;
  source: string;
  lastTickPositionMs: number;
  accumulatedListenedMs: number;
  lastPositionTimestamp: number;
}

let activeSession: ActiveSession | null = null;
let lastPlayedTrackId: string | null = null;
let lastPlayedTrackTimestamp = 0;

/**
 * Starts a new track playback session for telemetry.
 */
export function startTrackSession(
  trackId: string,
  durationS: number,
  contextType?: ContextType | null,
  contextId?: string | null,
  source = 'local'
): void {
  const now = Date.now();

  // If there was an ongoing session for a different track, finalize it as a track_change
  if (activeSession && activeSession.trackId !== trackId) {
    finalizeSession('track_change');
  }

  activeSession = {
    trackId,
    durationMs: Math.max(1000, durationS * 1000),
    startedAt: now,
    contextType: contextType || null,
    contextId: contextId || null,
    source,
    lastTickPositionMs: 0,
    accumulatedListenedMs: 0,
    lastPositionTimestamp: now,
  };
}

/**
 * Called periodically during playback to record real elapsed listen time.
 */
export function recordPlaybackTick(positionMs: number): void {
  if (!activeSession) return;
  const now = Date.now();
  const deltaReal = now - activeSession.lastPositionTimestamp;

  // If playback was progressing normally (real time delta <= 3s)
  if (deltaReal > 0 && deltaReal < 3000) {
    activeSession.accumulatedListenedMs += deltaReal;
  }

  activeSession.lastTickPositionMs = positionMs;
  activeSession.lastPositionTimestamp = now;
}

/**
 * Finalizes the active playback session, creates a PlayEvent, and incrementally updates TrackStats & ContextStats.
 */
export async function finalizeSession(
  reason: 'ended' | 'skip' | 'pause' | 'stop' | 'track_change'
): Promise<PlayEvent | null> {
  if (!activeSession) return null;

  const session = activeSession;
  activeSession = null;

  const now = Date.now();
  const listenedMs = session.accumulatedListenedMs;
  const durationMs = session.durationMs;
  const durationS = durationMs / 1000;
  const listenedS = listenedMs / 1000;

  // 1. Classification
  const countedThresholdS = Math.min(COUNTED_MIN_S, durationS * COUNTED_MIN_FRACTION);
  const counted = listenedS >= countedThresholdS;

  const completed = reason === 'ended' || listenedS >= durationS * COMPLETED_MIN_FRACTION;
  const earlySkip =
    (reason === 'skip' || reason === 'track_change') &&
    listenedS < EARLY_SKIP_MAX_S &&
    durationS > EARLY_SKIP_MIN_DURATION_S;

  // Date/time info
  const dateObj = new Date(session.startedAt);
  const hour = dateObj.getHours();
  const weekday = dateObj.getDay();

  // 2. Event weight calculation
  let weight = 0;
  if (completed) {
    weight += WEIGHT_COMPLETED;
  } else if (counted) {
    weight += WEIGHT_COUNTED;
  } else if (earlySkip) {
    weight += WEIGHT_EARLY_SKIP;
  }

  // Replay bonus (+0.4) if same track played again within 10 min
  if (
    lastPlayedTrackId === session.trackId &&
    session.startedAt - lastPlayedTrackTimestamp < REPLAY_BONUS_WINDOW_MS
  ) {
    weight += WEIGHT_REPLAY_BONUS;
  }

  lastPlayedTrackId = session.trackId;
  lastPlayedTrackTimestamp = now;

  // 3. Construct PlayEvent
  const eventId = `pe_${session.startedAt}_${Math.random().toString(36).slice(2, 8)}`;
  const playEvent: PlayEvent = {
    id: eventId,
    trackId: session.trackId,
    startedAt: session.startedAt,
    listenedMs,
    durationMs,
    completed,
    counted,
    earlySkip,
    source: session.source,
    contextType: session.contextType,
    contextId: session.contextId,
    hour,
    weekday,
  };

  try {
    // Save event to DB
    await db.playEvents.put(playEvent);

    // 4. Update TrackStats incrementally (O(1))
    await db.transaction('rw', db.trackStats, db.contextStats, async () => {
      let stats = await db.trackStats.get(session.trackId);
      if (!stats) {
        stats = createDefaultTrackStats(session.trackId, session.startedAt);
      }

      if (counted) {
        stats.playCount += 1;
      }
      if (earlySkip) {
        stats.skipCount += 1;
      }

      stats.lastPlayedAt = now;
      stats.totalListenMs += listenedMs;
      stats.hourHist[hour] = (stats.hourHist[hour] || 0) + 1;
      stats.weekdayHist[weekday] = (stats.weekdayHist[weekday] || 0) + 1;

      // Update decayed scores
      stats.shortScore = addToDecayedCounter(stats.shortScore, weight, now, HALF_LIFE_SHORT);
      stats.longScore = addToDecayedCounter(stats.longScore, weight, now, HALF_LIFE_LONG);

      if (counted) {
        stats.plays30 = addToDecayedCounter(stats.plays30, 1.0, now, HALF_LIFE_PLAYS30);
      }
      if (earlySkip) {
        stats.skips30 = addToDecayedCounter(stats.skips30, 1.0, now, HALF_LIFE_SKIPS30);
      }

      await db.trackStats.put(stats);

      // 5. Update ContextStats if played from a playlist/album/artist/folder
      if (session.contextType && session.contextId) {
        const contextKey = `${session.contextType}:${session.contextId}`;
        let ctxStat = await db.contextStats.get(contextKey);
        if (!ctxStat) {
          ctxStat = {
            key: contextKey,
            score: createDecayedCounter(0, now),
            lastPlayedAt: now,
            plays: 0,
          };
        }

        ctxStat.lastPlayedAt = now;
        if (counted) {
          ctxStat.plays += 1;
          ctxStat.score = addToDecayedCounter(ctxStat.score, 1.0, now, HALF_LIFE_CONTEXT);
        }

        await db.contextStats.put(ctxStat);
      }
    });
  } catch (err) {
    console.warn('[Telemetry] Error recording play event:', err);
  }

  return playEvent;
}
