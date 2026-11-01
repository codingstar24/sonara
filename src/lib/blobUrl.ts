/**
 * Safely creates an object URL from an unknown blob or image source.
 * Returns null if the source is not a valid Blob or File, preventing
 * uncaught TypeError exceptions in React renders.
 */
export function safeBlobUrl(source: unknown): string | null {
  if (!source) return null;
  if (typeof source === 'string') {
    if (source.startsWith('data:') || source.startsWith('blob:') || source.startsWith('http://') || source.startsWith('https://') || source.startsWith('local-media://')) {
      return source;
    }
    return null;
  }
  if (source instanceof Blob) {
    try {
      return URL.createObjectURL(source);
    } catch {
      return null;
    }
  }
  return null;
}
