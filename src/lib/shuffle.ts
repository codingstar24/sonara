/**
 * Seeded PRNG (mulberry32) and Fisher-Yates array shuffle
 */

export function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleArray<T>(array: T[], prng: () => number = Math.random): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

/**
 * Spotify-style shuffle: current track stays first, remaining tracks are randomized
 */
export function shuffleWithCurrentFirst<T>(
  items: T[],
  currentIndex: number,
  prng: () => number = Math.random
): T[] {
  if (items.length <= 1) return [...items];

  const currentItem = items[currentIndex];
  if (currentItem === undefined) return shuffleArray(items, prng);

  const remaining = items.filter((_, idx) => idx !== currentIndex);
  const shuffledRemaining = shuffleArray(remaining, prng);

  return [currentItem, ...shuffledRemaining];
}
