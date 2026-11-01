/**
 * M3U, M3U8, and PLS playlist parser
 */

export interface ParsedPlaylistEntry {
  path: string;
  title?: string;
  artist?: string;
  duration?: number;
}

export interface ParsedPlaylist {
  name: string;
  entries: ParsedPlaylistEntry[];
}

export function parseM3U(content: string, playlistName = 'Imported Playlist'): ParsedPlaylist {
  const lines = content.split(/\r?\n/).map((l) => l.trim());
  const entries: ParsedPlaylistEntry[] = [];

  let currentDuration: number | undefined;
  let currentTitle: string | undefined;
  let currentArtist: string | undefined;

  for (const line of lines) {
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      // #EXTINF:123,Artist - Title  or  #EXTINF:123,Title
      const info = line.substring(8);
      const commaIdx = info.indexOf(',');
      if (commaIdx !== -1) {
        const durStr = info.substring(0, commaIdx).trim();
        const dur = parseFloat(durStr);
        if (!isNaN(dur) && dur > 0) currentDuration = dur;

        const titleArtist = info.substring(commaIdx + 1).trim();
        const dashIdx = titleArtist.indexOf(' - ');
        if (dashIdx !== -1) {
          currentArtist = titleArtist.substring(0, dashIdx).trim();
          currentTitle = titleArtist.substring(dashIdx + 3).trim();
        } else {
          currentTitle = titleArtist;
        }
      }
      continue;
    }

    if (line.startsWith('#')) {
      // Other comment or tag
      continue;
    }

    // Media file path
    entries.push({
      path: line,
      duration: currentDuration,
      title: currentTitle,
      artist: currentArtist,
    });

    currentDuration = undefined;
    currentTitle = undefined;
    currentArtist = undefined;
  }

  return {
    name: playlistName,
    entries,
  };
}

export function parsePLS(content: string, playlistName = 'Imported Playlist'): ParsedPlaylist {
  const lines = content.split(/\r?\n/).map((l) => l.trim());
  const fileMap = new Map<number, string>();
  const titleMap = new Map<number, string>();
  const lengthMap = new Map<number, number>();

  for (const line of lines) {
    const fileMatch = line.match(/^File(\d+)=(.*)$/i);
    if (fileMatch && fileMatch[1] && fileMatch[2]) {
      fileMap.set(parseInt(fileMatch[1], 10), fileMatch[2].trim());
      continue;
    }

    const titleMatch = line.match(/^Title(\d+)=(.*)$/i);
    if (titleMatch && titleMatch[1] && titleMatch[2]) {
      titleMap.set(parseInt(titleMatch[1], 10), titleMatch[2].trim());
      continue;
    }

    const lengthMatch = line.match(/^Length(\d+)=(.*)$/i);
    if (lengthMatch && lengthMatch[1] && lengthMatch[2]) {
      const len = parseInt(lengthMatch[2].trim(), 10);
      if (!isNaN(len) && len > 0) lengthMap.set(parseInt(lengthMatch[1], 10), len);
    }
  }

  const entries: ParsedPlaylistEntry[] = [];
  const indices = Array.from(fileMap.keys()).sort((a, b) => a - b);

  for (const idx of indices) {
    const path = fileMap.get(idx)!;
    const rawTitle = titleMap.get(idx);
    const duration = lengthMap.get(idx);

    let artist: string | undefined;
    let title = rawTitle;

    if (rawTitle) {
      const dashIdx = rawTitle.indexOf(' - ');
      if (dashIdx !== -1) {
        artist = rawTitle.substring(0, dashIdx).trim();
        title = rawTitle.substring(dashIdx + 3).trim();
      }
    }

    entries.push({
      path,
      title,
      artist,
      duration,
    });
  }

  return {
    name: playlistName,
    entries,
  };
}
