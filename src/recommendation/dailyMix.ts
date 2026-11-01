import type { TrackLite, TrackStats } from '@/db/types';
import {
  DAILY_MIX_MAX,
  DAILY_MIX_SIZE,
  DAILY_MIX_FAMILIAR_PCT,
  DAILY_MIX_REDISCOVERY_PCT,
  DAILY_MIX_DISCOVERY_PCT,
  DAILY_MIX_FAMILIAR_FIRST,
  DAILY_MIX_REDISCOVERY_DAYS,
  HALF_LIFE_LONG,
} from '@/config/app';
import { calculateDecayedValue } from './decay';
import { hashString, shuffleWithSeed } from './prng';

export interface DailyMixResult {
  id: string; // 'daily-mix-1', etc.
  mixIndex: number; // 1 to 6
  name: string;
  subtitle: string;
  artworkIds: string[];
  tintColor: string;
  tracks: TrackLite[];
}

const MIX_TINT_COLORS = [
  '#1DB954', // Green
  '#3D91F4', // Blue
  '#E91429', // Red
  '#F59B23', // Orange
  '#B02897', // Purple
  '#00B0FF', // Cyan
];

/**
 * Generates Daily Mixes (up to 6) based on library taste profile and clustering.
 */
export function generateDailyMixes(
  tracks: TrackLite[],
  allStats: Map<string, TrackStats>,
  likedTrackIds: Set<string>,
  localDate: string,
  now = Date.now()
): DailyMixResult[] {
  if (tracks.length === 0) return [];

  // 1. Calculate longScore for each track
  const trackScores = new Map<string, number>();
  for (const track of tracks) {
    const stats = allStats.get(track.id);
    const score = stats?.longScore
      ? calculateDecayedValue(stats.longScore, now, HALF_LIFE_LONG)
      : 0;
    trackScores.set(track.id, score);
  }

  // 2. Identify primary genre or fallback artist for each track
  let tracksWithGenre = 0;
  for (const t of tracks) {
    if (t.genres && t.genres.length > 0) tracksWithGenre++;
  }
  const useGenre = tracksWithGenre / tracks.length >= 0.5;

  // Cluster tracks into buckets
  const clusters = new Map<string, TrackLite[]>();
  for (const track of tracks) {
    let key: string;
    if (useGenre && track.genres && track.genres.length > 0) {
      key = track.genres[0]!.trim().toLowerCase();
    } else {
      key = (track.albumArtist || track.artist || 'Various Artists').trim().toLowerCase();
    }
    if (!clusters.has(key)) {
      clusters.set(key, []);
    }
    clusters.get(key)!.push(track);
  }

  // Calculate total longScore for each cluster
  const clusterScores: Array<{ key: string; score: number; tracks: TrackLite[] }> = [];
  for (const [key, clusterTracks] of clusters.entries()) {
    let totalClusterScore = 0;
    for (const t of clusterTracks) {
      totalClusterScore += trackScores.get(t.id) || 0;
    }
    clusterScores.push({ key, score: totalClusterScore, tracks: clusterTracks });
  }

  // Sort clusters by score descending
  clusterScores.sort((a, b) => b.score - a.score);

  // If library has very few tracks or all clusters are tiny, merge into 1 mix
  const minTracksPerMix = tracks.length < 20 ? 1 : 15;
  const eligibleClusters = clusterScores.filter((c) => c.tracks.length >= minTracksPerMix);
  const mixClusters = eligibleClusters.length > 0 ? eligibleClusters.slice(0, DAILY_MIX_MAX) : [
    { key: 'all', score: 1, tracks },
  ];

  const results: DailyMixResult[] = [];
  const rediscoveryThreshold = now - DAILY_MIX_REDISCOVERY_DAYS * 24 * 60 * 60 * 1000;

  mixClusters.forEach((cluster, idx) => {
    const mixIndex = idx + 1;
    const seed = hashString(`${localDate}::mix::${mixIndex}`);

    const clusterTracks = cluster.tracks;

    // Segment into Familiar, Rediscovery, Discovery
    const familiar: TrackLite[] = [];
    const rediscovery: TrackLite[] = [];
    const discovery: TrackLite[] = [];

    // Find top artists in this cluster
    const artistScores = new Map<string, number>();
    for (const t of clusterTracks) {
      const art = t.artist.trim();
      const s = (trackScores.get(t.id) || 0) + (likedTrackIds.has(t.id) ? 2 : 0);
      artistScores.set(art, (artistScores.get(art) || 0) + s);
    }
    const topArtists = Array.from(artistScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([art]) => art);

    for (const track of clusterTracks) {
      const stats = allStats.get(track.id);
      const isLiked = likedTrackIds.has(track.id);
      const playCount = stats?.playCount || 0;
      const lastPlayedAt = stats?.lastPlayedAt;

      if (playCount === 0 && !isLiked) {
        discovery.push(track);
      } else if (lastPlayedAt && lastPlayedAt < rediscoveryThreshold) {
        rediscovery.push(track);
      } else {
        familiar.push(track);
      }
    }

    // Sort familiar by score descending
    familiar.sort((a, b) => (trackScores.get(b.id) || 0) - (trackScores.get(a.id) || 0));

    // Sort rediscovery by longScore
    rediscovery.sort((a, b) => (trackScores.get(b.id) || 0) - (trackScores.get(a.id) || 0));

    // Sort discovery by similarity to top artists
    discovery.sort((a, b) => {
      const simA = topArtists.includes(a.artist.trim()) ? 1 : 0;
      const simB = topArtists.includes(b.artist.trim()) ? 1 : 0;
      return simB - simA;
    });

    const targetSize = Math.min(clusterTracks.length, DAILY_MIX_SIZE);
    const familiarCount = Math.floor(targetSize * DAILY_MIX_FAMILIAR_PCT);
    const rediscoveryCount = Math.floor(targetSize * DAILY_MIX_REDISCOVERY_PCT);
    const discoveryCount = Math.min(
      discovery.length,
      Math.floor(targetSize * DAILY_MIX_DISCOVERY_PCT)
    );

    const chosenFamiliar = familiar.slice(0, familiarCount);
    const chosenRediscovery = rediscovery.slice(0, rediscoveryCount);
    const chosenDiscovery = discovery.slice(0, discoveryCount);

    // If some buckets are short, backfill from familiar or remaining cluster tracks
    const chosenIds = new Set<string>([
      ...chosenFamiliar.map((t) => t.id),
      ...chosenRediscovery.map((t) => t.id),
      ...chosenDiscovery.map((t) => t.id),
    ]);

    const remainingCluster = shuffleWithSeed(
      clusterTracks.filter((t) => !chosenIds.has(t.id)),
      seed
    );

    // Assemble mix: first 5 familiar, then alternate
    const orderedTracks: TrackLite[] = [];
    const poolFam = [...chosenFamiliar];
    const poolRedisc = [...chosenRediscovery];
    const poolDisc = [...chosenDiscovery];
    const poolRem = [...remainingCluster];

    // First up to 5 familiar
    for (let i = 0; i < DAILY_MIX_FAMILIAR_FIRST && poolFam.length > 0; i++) {
      orderedTracks.push(poolFam.shift()!);
    }

    // Then alternate
    while (
      orderedTracks.length < targetSize &&
      (poolFam.length > 0 || poolRedisc.length > 0 || poolDisc.length > 0 || poolRem.length > 0)
    ) {
      if (poolFam.length > 0) orderedTracks.push(poolFam.shift()!);
      if (orderedTracks.length >= targetSize) break;

      if (poolRedisc.length > 0) orderedTracks.push(poolRedisc.shift()!);
      if (orderedTracks.length >= targetSize) break;

      if (poolDisc.length > 0) orderedTracks.push(poolDisc.shift()!);
      if (orderedTracks.length >= targetSize) break;

      if (poolRem.length > 0) orderedTracks.push(poolRem.shift()!);
    }

    // Collect up to 4 distinct artwork IDs
    const artworkIds: string[] = [];
    for (const t of orderedTracks) {
      if (t.artworkId && !artworkIds.includes(t.artworkId)) {
        artworkIds.push(t.artworkId);
        if (artworkIds.length === 4) break;
      }
    }

    // Top 3 artists for subtitle
    const mixArtists: string[] = [];
    for (const t of orderedTracks) {
      const art = t.artist.trim();
      if (art && !mixArtists.includes(art)) {
        mixArtists.push(art);
        if (mixArtists.length === 3) break;
      }
    }
    const subtitle = mixArtists.length > 0 ? `${mixArtists.join(', ')} and more` : 'Your personalized mix';

    results.push({
      id: `daily-mix-${mixIndex}`,
      mixIndex,
      name: `Daily Mix ${mixIndex}`,
      subtitle,
      artworkIds,
      tintColor: MIX_TINT_COLORS[(mixIndex - 1) % MIX_TINT_COLORS.length]!,
      tracks: orderedTracks,
    });
  });

  return results;
}
