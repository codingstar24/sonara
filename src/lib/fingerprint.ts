/**
 * Track fingerprint generator for duplicate detection and file relocation survival.
 * Fingerprint = normalized title|artist|round(duration) + size
 */

export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^\w\s]/g, '')        // remove punctuation
    .trim()
    .replace(/\s+/g, ' ');
}

export function generateFingerprint(
  title: string,
  artist: string,
  duration: number,
  size: number
): string {
  const normTitle = normalizeString(title || 'unknown');
  const normArtist = normalizeString(artist || 'unknown');
  const roundDuration = Math.round(duration || 0);
  return `${normTitle}|${normArtist}|${roundDuration}_${size}`;
}
