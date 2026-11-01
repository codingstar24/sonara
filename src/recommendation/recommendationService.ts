import { db } from '@/db/schema';
import type { TrackLite, TrackStats } from '@/db/types';
import {
  RECS_CACHE_TTL_MS,
  getCurrentDaypart,
  DAYPARTS,
  HALF_LIFE_SHORT,
  HALF_LIFE_LONG,
} from '@/config/app';
import { calculateDecayedValue } from './decay';
import { calculateTrackRank, applyDiversityReRank, type ScoredTrack } from './rank';
import { generateDailyMixes, type DailyMixResult } from './dailyMix';
import { calculatePersonalizationRamp } from './personalization';
import { calculateSimilarity } from './similarity';

export interface QuickPickItem {
  id: string;
  type: 'liked' | 'playlist' | 'album' | 'artist';
  title: string;
  subtitle: string;
  artworkId: string | null;
  trackIds: string[];
}

export interface HomeShelfData {
  quickPicks: QuickPickItem[];
  continueListening: {
    track: TrackLite;
    positionMs: number;
    contextName?: string;
  } | null;
  jumpBackIn: Array<{
    id: string;
    type: 'playlist' | 'album' | 'artist';
    title: string;
    subtitle: string;
    artworkId: string | null;
    trackIds: string[];
  }>;
  mostPlayed: {
    today: Array<{ track: TrackLite; playCount: number }>;
    sevenDays: Array<{ track: TrackLite; playCount: number }>;
    thirtyDays: Array<{ track: TrackLite; playCount: number }>;
    allTime: Array<{ track: TrackLite; playCount: number }>;
  };
  onRepeat: TrackLite[];
  pickedForYou: ScoredTrack[];
  pickedForYouTitle: string;
  dailyMixes: DailyMixResult[];
  repeatRewind: TrackLite[];
  timeCapsule: TrackLite[];
  discoverMix: TrackLite[];
  topArtists: Array<{ name: string; trackCount: number; artworkId: string | null }>;
  topAlbums: Array<{ title: string; artist: string; year: number | null; artworkId: string | null; trackIds: string[] }>;
  becauseYouListened: Array<{
    artist: string;
    tracks: TrackLite[];
  }>;
  recentlyPlayed: TrackLite[];
  recentlyAddedAlbums: Array<{
    title: string;
    artist: string;
    year: number | null;
    artworkId: string | null;
    trackIds: string[];
  }>;
  unheardGems: TrackLite[];
  snapshot: {
    minutesToday: number;
    streakDays: number;
    topArtistThisWeek: string | null;
  };
  personalizationRamp: number;
}

/**
 * Computes all Home recommendations or loads from cache.
 */
export async function getHomeRecommendations(
  allTracksMap: Map<string, TrackLite>,
  forceRefresh = false
): Promise<HomeShelfData> {
  const now = Date.now();
  const todayStr = new Date(now).toISOString().slice(0, 10);
  const daypart = getCurrentDaypart();

  // 1. Check cache
  if (!forceRefresh) {
    try {
      const cached = await db.recsCache.get('home_recs');
      if (
        cached &&
        cached.localDate === todayStr &&
        cached.daypart === daypart &&
        now - cached.computedAt < RECS_CACHE_TTL_MS
      ) {
        return cached.data as HomeShelfData;
      }
    } catch (e) {
      console.warn('Failed reading recs cache:', e);
    }
  }

  // 2. Load DB records
  const [allStatsList, allLikes, allPlayEvents, allContextStats, allPlaylists, allPlaylistTracks] =
    await Promise.all([
      db.trackStats.toArray(),
      db.likes.toArray(),
      db.playEvents.orderBy('startedAt').reverse().limit(1000).toArray(),
      db.contextStats.toArray(),
      db.playlists.toArray(),
      db.playlistTracks.toArray(),
    ]);

  const statsMap = new Map<string, TrackStats>(allStatsList.map((s) => [s.trackId, s]));
  const likedTrackIds = new Set<string>(allLikes.map((l) => l.trackId));

  // Count tracks per playlist
  const trackPlaylistCountMap = new Map<string, number>();
  for (const pt of allPlaylistTracks) {
    trackPlaylistCountMap.set(pt.trackId, (trackPlaylistCountMap.get(pt.trackId) || 0) + 1);
  }

  // Total counted plays for personalization ramp
  let totalCountedPlays = 0;
  for (const ev of allPlayEvents) {
    if (ev.counted) totalCountedPlays++;
  }
  const personalizationRamp = calculatePersonalizationRamp(totalCountedPlays);

  const tracks = Array.from(allTracksMap.values()).filter(
    (t) => !t.missing && !t.unsupported && !t.hiddenFromRecs
  );

  // Group tracks by album and artist
  const albumMap = new Map<string, TrackLite[]>();
  const artistMap = new Map<string, TrackLite[]>();
  for (const t of tracks) {
    const albKey = `${(t.album || 'Unknown Album').toLowerCase()}:::${(t.artist || '').toLowerCase()}`;
    if (!albumMap.has(albKey)) albumMap.set(albKey, []);
    albumMap.get(albKey)!.push(t);

    const artKey = (t.artist || 'Unknown Artist').trim();
    if (!artistMap.has(artKey)) artistMap.set(artKey, []);
    artistMap.get(artKey)!.push(t);
  }

  // --- 1. Quick Picks (8 items) ---
  const quickPicks: QuickPickItem[] = [];
  // Tile 1: Liked Songs
  quickPicks.push({
    id: 'liked-songs',
    type: 'liked',
    title: 'Liked Songs',
    subtitle: `${likedTrackIds.size} songs`,
    artworkId: null,
    trackIds: Array.from(likedTrackIds),
  });

  // Sort context stats by score
  const sortedContexts = allContextStats
    .map((cs) => ({
      ...cs,
      currentScore: calculateDecayedValue(cs.score, now, 7 * 86400000),
    }))
    .sort((a, b) => b.currentScore - a.currentScore);

  for (const cs of sortedContexts) {
    if (quickPicks.length >= 8) break;
    const [cType, cId] = cs.key.split(':');
    if (!cType || !cId) continue;

    if (cType === 'playlist') {
      const pl = allPlaylists.find((p) => p.id === cId);
      if (pl) {
        const pTracks = allPlaylistTracks.filter((pt) => pt.playlistId === pl.id).map((pt) => pt.trackId);
        quickPicks.push({
          id: pl.id,
          type: 'playlist',
          title: pl.name,
          subtitle: 'Playlist',
          artworkId: pl.coverArtworkId,
          trackIds: pTracks,
        });
      }
    } else if (cType === 'album') {
      // Find matching album
      for (const [key, aTracks] of albumMap.entries()) {
        if (aTracks[0]?.album.toLowerCase() === cId.toLowerCase()) {
          quickPicks.push({
            id: key,
            type: 'album',
            title: aTracks[0]?.album || 'Album',
            subtitle: aTracks[0]?.artist || 'Artist',
            artworkId: aTracks[0]?.artworkId || null,
            trackIds: aTracks.map((t) => t.id),
          });
          break;
        }
      }
    } else if (cType === 'artist') {
      const aTracks = artistMap.get(cId);
      if (aTracks && aTracks.length > 0) {
        quickPicks.push({
          id: cId,
          type: 'artist',
          title: cId,
          subtitle: 'Artist',
          artworkId: aTracks[0]?.artworkId || null,
          trackIds: aTracks.map((t) => t.id),
        });
      }
    }
  }

  // Backfill quick picks with top albums or playlists if fewer than 8
  if (quickPicks.length < 8) {
    for (const pl of allPlaylists) {
      if (quickPicks.length >= 8) break;
      if (quickPicks.some((qp) => qp.id === pl.id)) continue;
      const pTracks = allPlaylistTracks.filter((pt) => pt.playlistId === pl.id).map((pt) => pt.trackId);
      quickPicks.push({
        id: pl.id,
        type: 'playlist',
        title: pl.name,
        subtitle: 'Playlist',
        artworkId: pl.coverArtworkId,
        trackIds: pTracks,
      });
    }
  }

  if (quickPicks.length < 8) {
    for (const [key, aTracks] of albumMap.entries()) {
      if (quickPicks.length >= 8) break;
      if (quickPicks.some((qp) => qp.id === key)) continue;
      quickPicks.push({
        id: key,
        type: 'album',
        title: aTracks[0]?.album || 'Album',
        subtitle: aTracks[0]?.artist || 'Artist',
        artworkId: aTracks[0]?.artworkId || null,
        trackIds: aTracks.map((t) => t.id),
      });
    }
  }

  // --- 2. Continue Listening & Jump Back In ---
  let continueListening: HomeShelfData['continueListening'] = null;
  const recentEvents = allPlayEvents.slice(0, 30);
  if (recentEvents.length > 0) {
    const last = recentEvents[0]!;
    const track = allTracksMap.get(last.trackId);
    if (track && !last.completed && last.listenedMs > 5000) {
      continueListening = {
        track,
        positionMs: last.listenedMs,
        contextName: last.contextId || undefined,
      };
    }
  }

  // Jump Back In (last 6 distinct contexts)
  const jumpBackIn: HomeShelfData['jumpBackIn'] = [];
  const seenContexts = new Set<string>();
  for (const ev of recentEvents) {
    if (jumpBackIn.length >= 6) break;
    if (!ev.contextType || !ev.contextId) continue;
    const cKey = `${ev.contextType}:${ev.contextId}`;
    if (seenContexts.has(cKey)) continue;
    seenContexts.add(cKey);

    if (ev.contextType === 'album') {
      const aTracks = tracks.filter((t) => t.album.toLowerCase() === ev.contextId!.toLowerCase());
      if (aTracks.length > 0) {
        jumpBackIn.push({
          id: cKey,
          type: 'album',
          title: aTracks[0]!.album,
          subtitle: aTracks[0]!.artist,
          artworkId: aTracks[0]!.artworkId,
          trackIds: aTracks.map((t) => t.id),
        });
      }
    } else if (ev.contextType === 'playlist') {
      const pl = allPlaylists.find((p) => p.id === ev.contextId);
      if (pl) {
        const pTracks = allPlaylistTracks.filter((pt) => pt.playlistId === pl.id).map((pt) => pt.trackId);
        jumpBackIn.push({
          id: cKey,
          type: 'playlist',
          title: pl.name,
          subtitle: 'Playlist',
          artworkId: pl.coverArtworkId,
          trackIds: pTracks,
        });
      }
    }
  }

  // --- 3. Most Played (Today, 7 days, 30 days, All time) ---
  const todayStart = new Date(todayStr).getTime();
  const sevenDaysAgo = now - 7 * 86400000;
  const thirtyDaysAgo = now - 30 * 86400000;

  const countPlaysSince = (since: number): Array<{ track: TrackLite; playCount: number }> => {
    const counts = new Map<string, number>();
    for (const ev of allPlayEvents) {
      if (ev.startedAt >= since && ev.counted) {
        counts.set(ev.trackId, (counts.get(ev.trackId) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([id, playCount]) => ({ track: allTracksMap.get(id)!, playCount }))
      .filter((item) => item.track != null)
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 15);
  };

  const mostPlayed = {
    today: countPlaysSince(todayStart),
    sevenDays: countPlaysSince(sevenDaysAgo),
    thirtyDays: countPlaysSince(thirtyDaysAgo),
    allTime: tracks
      .map((t) => ({ track: t, playCount: statsMap.get(t.id)?.playCount || 0 }))
      .filter((i) => i.playCount > 0)
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 15),
  };

  // --- 4. On Repeat (top 20 by shortScore in last 14 days) ---
  const fourteenDaysAgo = now - 14 * 86400000;
  const onRepeat = tracks
    .map((t) => {
      const stats = statsMap.get(t.id);
      if (!stats || !stats.lastPlayedAt || stats.lastPlayedAt < fourteenDaysAgo) return null;
      const score = calculateDecayedValue(stats.shortScore, now, HALF_LIFE_SHORT);
      return { track: t, score };
    })
    .filter((item): item is { track: TrackLite; score: number } => item !== null && item.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.track)
    .slice(0, 20);

  // --- 5. Picked for You Right Now ---
  const rankCandidates: ScoredTrack[] = [];
  for (const track of tracks) {
    const stats = statsMap.get(track.id);
    const { rank, reasons } = calculateTrackRank(track, stats, {
      now,
      likedTrackIds,
      trackPlaylistCountMap,
    });
    if (rank > 0.01) {
      rankCandidates.push({
        track,
        rank,
        baseRank: rank,
        reasons,
      });
    }
  }

  // Sort by rank descending and apply diversity re-ranking
  rankCandidates.sort((a, b) => b.rank - a.rank);
  const pickedForYou = applyDiversityReRank(rankCandidates, 20);
  const pickedForYouTitle = DAYPARTS[daypart].shelfTitle;

  // --- 6. Made for You (Daily Mixes + Repeat Rewind + Time Capsule + Discover Mix) ---
  const dailyMixes = generateDailyMixes(tracks, statsMap, likedTrackIds, todayStr, now);

  // Repeat Rewind: heavy rotation 30-90 days ago, quiet in the last 30
  const repeatRewind = tracks
    .filter((t) => {
      const stats = statsMap.get(t.id);
      if (!stats || !stats.lastPlayedAt) return false;
      const quietInLast30 = stats.lastPlayedAt < thirtyDaysAgo;
      const playedInWindow = stats.lastPlayedAt >= now - 90 * 86400000;
      return quietInLast30 && playedInWindow && stats.playCount >= 3;
    })
    .slice(0, 20);

  // Time Capsule: liked or well-played tracks not heard for 60+ days
  const sixtyDaysAgo = now - 60 * 86400000;
  const timeCapsule = tracks
    .filter((t) => {
      const stats = statsMap.get(t.id);
      const isLiked = likedTrackIds.has(t.id);
      const isWellPlayed = (stats?.playCount || 0) >= 4;
      const notHeard = !stats?.lastPlayedAt || stats.lastPlayedAt < sixtyDaysAgo;
      return (isLiked || isWellPlayed) && notHeard;
    })
    .slice(0, 20);

  // Discover Mix: unplayed tracks most similar to user's taste
  const topTasteTracks = tracks
    .map((t) => ({ track: t, score: calculateDecayedValue(statsMap.get(t.id)?.longScore, now, HALF_LIFE_LONG) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((i) => i.track);

  const discoverMix = tracks
    .filter((t) => (statsMap.get(t.id)?.playCount || 0) === 0 && !likedTrackIds.has(t.id))
    .map((candidate) => {
      let maxSim = 0;
      for (const taste of topTasteTracks) {
        const sim = calculateSimilarity(candidate, taste);
        if (sim > maxSim) maxSim = sim;
      }
      return { track: candidate, sim: maxSim };
    })
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 20)
    .map((i) => i.track);

  // --- 7. Top Artists & Top Albums ---
  const artistScores = new Map<string, { name: string; score: number; count: number; artworkId: string | null }>();
  for (const track of tracks) {
    const art = (track.artist || 'Unknown Artist').trim();
    const stats = statsMap.get(track.id);
    const score = stats?.longScore ? calculateDecayedValue(stats.longScore, now, HALF_LIFE_LONG) : 0;
    const existing = artistScores.get(art) || { name: art, score: 0, count: 0, artworkId: track.artworkId };
    existing.score += score;
    existing.count += 1;
    if (!existing.artworkId && track.artworkId) existing.artworkId = track.artworkId;
    artistScores.set(art, existing);
  }

  const topArtists = Array.from(artistScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((a) => ({ name: a.name, trackCount: a.count, artworkId: a.artworkId }));

  // Top Albums
  const albumScores = new Map<string, { title: string; artist: string; year: number | null; artworkId: string | null; score: number; trackIds: string[] }>();
  for (const [key, aTracks] of albumMap.entries()) {
    let score = 0;
    for (const t of aTracks) {
      const stats = statsMap.get(t.id);
      score += stats?.longScore ? calculateDecayedValue(stats.longScore, now, HALF_LIFE_LONG) : 0;
    }
    const first = aTracks[0]!;
    albumScores.set(key, {
      title: first.album,
      artist: first.artist,
      year: first.year,
      artworkId: first.artworkId,
      score,
      trackIds: aTracks.map((t) => t.id),
    });
  }

  const topAlbums = Array.from(albumScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // --- 8. "Because you listened to <Artist>" (Top 2 artists) ---
  const becauseYouListened: HomeShelfData['becauseYouListened'] = [];
  const top2Artists = topArtists.slice(0, 2);
  for (const artistObj of top2Artists) {
    const artistTracks = tracks.filter((t) => t.artist.toLowerCase() === artistObj.name.toLowerCase());
    // Find tracks from other artists with highest similarity
    const otherTracks = tracks
      .filter((t) => t.artist.toLowerCase() !== artistObj.name.toLowerCase())
      .map((t) => {
        let maxSim = 0;
        for (const aTrack of artistTracks.slice(0, 3)) {
          const sim = calculateSimilarity(t, aTrack);
          if (sim > maxSim) maxSim = sim;
        }
        return { track: t, sim: maxSim };
      })
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 10)
      .map((i) => i.track);

    if (otherTracks.length >= 4) {
      becauseYouListened.push({
        artist: artistObj.name,
        tracks: otherTracks,
      });
    }
  }

  // --- 9. Recently Played & Recently Added ---
  const recentlyPlayedIds = Array.from(
    new Set(allPlayEvents.slice(0, 50).map((e) => e.trackId))
  );
  const recentlyPlayed = recentlyPlayedIds
    .map((id) => allTracksMap.get(id))
    .filter((t): t is TrackLite => t != null)
    .slice(0, 15);

  const recentlyAddedAlbums = Array.from(albumScores.values())
    .sort((a, b) => {
      const trackA = allTracksMap.get(a.trackIds[0] || '');
      const trackB = allTracksMap.get(b.trackIds[0] || '');
      return (trackB?.addedAt || 0) - (trackA?.addedAt || 0);
    })
    .slice(0, 10);

  // Unheard Gems: never played tracks from albums the user plays
  const playedAlbumNames = new Set(
    allPlayEvents
      .map((e) => allTracksMap.get(e.trackId)?.album)
      .filter((alb): alb is string => alb != null)
  );

  const unheardGems = tracks
    .filter((t) => (statsMap.get(t.id)?.playCount || 0) === 0 && playedAlbumNames.has(t.album))
    .slice(0, 15);

  // --- 10. Listening Snapshot Strip ---
  let minutesToday = 0;
  for (const ev of allPlayEvents) {
    if (ev.startedAt >= todayStart) {
      minutesToday += Math.round(ev.listenedMs / 60000);
    }
  }

  // Streak days calculation
  const uniqueDays = new Set(
    allPlayEvents
      .filter((e) => e.counted)
      .map((e) => new Date(e.startedAt).toISOString().slice(0, 10))
  );

  let streakDays = 0;
  let checkDay = new Date(now);
  while (true) {
    const dayStr = checkDay.toISOString().slice(0, 10);
    if (uniqueDays.has(dayStr)) {
      streakDays++;
      checkDay = new Date(checkDay.getTime() - 86400000);
    } else {
      break;
    }
  }

  const topArtistThisWeek = topArtists[0]?.name || null;

  const result: HomeShelfData = {
    quickPicks,
    continueListening,
    jumpBackIn,
    mostPlayed,
    onRepeat,
    pickedForYou,
    pickedForYouTitle,
    dailyMixes,
    repeatRewind,
    timeCapsule,
    discoverMix,
    topArtists,
    topAlbums,
    becauseYouListened,
    recentlyPlayed,
    recentlyAddedAlbums,
    unheardGems,
    snapshot: {
      minutesToday,
      streakDays,
      topArtistThisWeek,
    },
    personalizationRamp,
  };

  // Cache result
  try {
    await db.recsCache.put({
      id: 'home_recs',
      data: result,
      computedAt: now,
      localDate: todayStr,
      daypart,
      playsBucket: Math.floor(totalCountedPlays / 10),
    });
  } catch (e) {
    console.warn('Failed saving recs cache:', e);
  }

  return result;
}
