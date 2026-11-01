import type { Track, TrackLite } from '@/db/types';
import {
  SIM_SAME_ARTIST,
  SIM_SAME_ALBUM,
  SIM_GENRE_JACCARD,
  SIM_YEAR_PROXIMITY,
  SIM_CO_LISTENING,
  SIM_SAME_FOLDER,
  SIM_YEAR_RANGE,
} from '@/config/app';

export type AnyTrack = Track | TrackLite;

/**
 * Calculates Jaccard similarity between two sets of genres: |A ∩ B| / |A ∪ B|.
 */
export function calculateGenreJaccard(genresA: string[] = [], genresB: string[] = []): number {
  if (genresA.length === 0 || genresB.length === 0) return 0;

  const setA = new Set(genresA.map((g) => g.trim().toLowerCase()).filter(Boolean));
  const setB = new Set(genresB.map((g) => g.trim().toLowerCase()).filter(Boolean));

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionCount = 0;
  for (const g of setA) {
    if (setB.has(g)) intersectionCount++;
  }

  const unionSize = new Set([...setA, ...setB]).size;
  return unionSize > 0 ? intersectionCount / unionSize : 0;
}

/**
 * Extracts folder path from relPath.
 */
export function getFolderFromRelPath(relPath: string): string {
  const norm = relPath.replace(/\\/g, '/');
  const lastSlash = norm.lastIndexOf('/');
  return lastSlash === -1 ? '' : norm.slice(0, lastSlash);
}

/**
 * Pairwise similarity score between two tracks, in [0, 1].
 */
export function calculateSimilarity(
  a: AnyTrack,
  b: AnyTrack,
  coListeningMap?: Map<string, number>
): number {
  if (a.id === b.id) return 1.0;

  let score = 0;

  // 1. Same Artist (0.35)
  const artistA = (a.artist || '').trim().toLowerCase();
  const artistB = (b.artist || '').trim().toLowerCase();
  if (artistA && artistB && artistA === artistB) {
    score += SIM_SAME_ARTIST;
  }

  // 2. Same Album (0.20)
  const albumA = (a.album || '').trim().toLowerCase();
  const albumB = (b.album || '').trim().toLowerCase();
  if (albumA && albumB && albumA === albumB) {
    score += SIM_SAME_ALBUM;
  }

  // 3. Genre Jaccard (0.20)
  const genreSim = calculateGenreJaccard(a.genres, b.genres);
  score += SIM_GENRE_JACCARD * genreSim;

  // 4. Year Proximity (0.10)
  if (a.year != null && b.year != null && a.year > 0 && b.year > 0) {
    const diff = Math.abs(a.year - b.year);
    const proximity = Math.max(0, 1 - Math.min(1, diff / SIM_YEAR_RANGE));
    score += SIM_YEAR_PROXIMITY * proximity;
  }

  // 5. Co-listening (0.10)
  if (coListeningMap && artistA && artistB && artistA !== artistB) {
    const key = artistA < artistB ? `${artistA}::${artistB}` : `${artistB}::${artistA}`;
    const coVal = coListeningMap.get(key) || 0;
    score += SIM_CO_LISTENING * Math.min(1, coVal);
  }

  // 6. Same Folder (0.05)
  const folderA = getFolderFromRelPath(a.relPath);
  const folderB = getFolderFromRelPath(b.relPath);
  if (folderA && folderB && folderA.toLowerCase() === folderB.toLowerCase()) {
    score += SIM_SAME_FOLDER;
  }

  return Math.min(1.0, score);
}
