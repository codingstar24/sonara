/**
 * Filename and path heuristic parser for missing tags
 */

export interface ParsedFilename {
  title: string;
  artist: string;
  album?: string;
  trackNo?: number;
}

export function parseFilename(filename: string, relPath = ''): ParsedFilename {
  // Strip extension
  const base = filename.replace(/\.[^/.]+$/, '').trim();

  let trackNo: number | undefined;
  let artist = 'Unknown Artist';
  let title = base;

  // Pattern 1: "01 - Artist - Title" or "01. Artist - Title"
  const p1 = /^(\d{1,3})[\s._]*[-–—]\s*([^-–—]+)\s*[-–—]\s*(.+)$/;
  const m1 = base.match(p1);
  if (m1 && m1[1] && m1[2] && m1[3]) {
    trackNo = parseInt(m1[1], 10);
    artist = m1[2].trim();
    title = m1[3].trim();
  } else {
    // Pattern 2: "Artist - Title"
    const p2 = /^([^-–—]+)\s*[-–—]\s*(.+)$/;
    const m2 = base.match(p2);
    if (m2 && m2[1] && m2[2]) {
      // Check if m2[1] is just a track number
      const possibleTrack = parseInt(m2[1].trim(), 10);
      if (!isNaN(possibleTrack) && /^\d+$/.test(m2[1].trim())) {
        trackNo = possibleTrack;
        title = m2[2].trim();
      } else {
        artist = m2[1].trim();
        title = m2[2].trim();
      }
    } else {
      // Pattern 3: "01 Title" or "01. Title"
      const p3 = /^(\d{1,3})[\s._]+(.+)$/;
      const m3 = base.match(p3);
      if (m3 && m3[1] && m3[2]) {
        trackNo = parseInt(m3[1], 10);
        title = m3[2].trim();
      }
    }
  }

  // Derive album and artist from folder structure if available: e.g. Artist/Album/Title
  let album: string | undefined;
  if (relPath) {
    const segments = relPath.split(/[/\\]/).filter(Boolean);
    if (segments.length >= 2) {
      album = segments[segments.length - 2];
    }
    if (segments.length >= 3 && artist === 'Unknown Artist') {
      artist = segments[segments.length - 3]!;
    }
  }

  return {
    title: title || base,
    artist,
    album,
    trackNo,
  };
}
