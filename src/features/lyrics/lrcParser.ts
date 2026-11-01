export interface LyricLine {
  timeMs: number;
  text: string;
}

export interface ParsedLyrics {
  isSynced: boolean;
  offsetMs: number;
  lines: LyricLine[];
  plainText: string;
}

/**
 * Parses raw LRC string (supporting multi-timestamp lines and [offset:] tag) or plain text.
 */
export function parseLrc(content: string): ParsedLyrics {
  if (!content || !content.trim()) {
    return { isSynced: false, offsetMs: 0, lines: [], plainText: '' };
  }

  const rawLines = content.split(/\r?\n/);
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  const offsetRegex = /\[offset:\s*([+-]?\d+)\s*\]/i;

  let offsetMs = 0;
  const syncedLines: LyricLine[] = [];
  const plainLines: string[] = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for offset tag: [offset: +/-ms]
    const offsetMatch = trimmed.match(offsetRegex);
    if (offsetMatch && offsetMatch[1]) {
      offsetMs = parseInt(offsetMatch[1], 10) || 0;
      continue;
    }

    // Ignore metadata tags like [ti:], [ar:], [al:]
    if (/^\[(ti|ar|al|by|length|re|ve):/i.test(trimmed)) {
      continue;
    }

    // Find all timestamps on this line
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    timeRegex.lastIndex = 0;

    while ((match = timeRegex.exec(trimmed)) !== null) {
      const minutes = parseInt(match[1] || '0', 10);
      const seconds = parseInt(match[2] || '0', 10);
      let ms = 0;
      if (match[3]) {
        // e.g. .5 -> 500, .25 -> 250, .123 -> 123
        ms = parseInt(match[3].padEnd(3, '0').slice(0, 3), 10);
      }
      timestamps.push(minutes * 60 * 1000 + seconds * 1000 + ms);
    }

    // Extract text after removing timestamp tags
    const text = trimmed.replace(timeRegex, '').trim();

    if (timestamps.length > 0) {
      for (const t of timestamps) {
        syncedLines.push({ timeMs: t, text });
      }
    } else {
      plainLines.push(trimmed);
    }
  }

  if (syncedLines.length > 0) {
    // Sort chronologically
    syncedLines.sort((a, b) => a.timeMs - b.timeMs);
    return {
      isSynced: true,
      offsetMs,
      lines: syncedLines,
      plainText: syncedLines.map((l) => l.text).join('\n'),
    };
  }

  return {
    isSynced: false,
    offsetMs: 0,
    lines: plainLines.map((text) => ({ timeMs: 0, text })),
    plainText: plainLines.join('\n'),
  };
}

/**
 * Finds the currently active line index given the current playback time and offset.
 */
export function findActiveLyricIndex(
  lines: LyricLine[],
  currentTimeMs: number,
  offsetMs = 0
): number {
  if (lines.length === 0) return -1;
  const targetMs = currentTimeMs - offsetMs;

  let activeIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.timeMs <= targetMs) {
      activeIndex = i;
    } else {
      break;
    }
  }

  return activeIndex;
}
