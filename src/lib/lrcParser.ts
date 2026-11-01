/**
 * LRC parser supporting:
 * - Standard [mm:ss.xx] and [mm:ss.xxx] timestamps
 * - Multi-timestamp lines: [00:12.00][00:24.00] Repeated line
 * - [offset:+/-ms] tag
 * - Sorted timeline of lines
 */

export interface LyricLine {
  timeS: number;
  text: string;
}

export interface ParsedLrc {
  lines: LyricLine[];
  offsetMs: number;
  isSynced: boolean;
  rawText: string;
}

export function parseLrc(raw: string): ParsedLrc {
  if (!raw || !raw.trim()) {
    return { lines: [], offsetMs: 0, isSynced: false, rawText: '' };
  }

  let offsetMs = 0;
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
  const lines: LyricLine[] = [];

  const rawLines = raw.split(/\r?\n/);

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check [offset:+/-500]
    const offsetMatch = trimmed.match(/^\[offset:\s*([+-]?\d+)\s*\]/i);
    if (offsetMatch && offsetMatch[1]) {
      offsetMs = parseInt(offsetMatch[1], 10);
      continue;
    }

    // Extract all timestamps on this line
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    timeRegex.lastIndex = 0;

    while ((match = timeRegex.exec(trimmed)) !== null) {
      const min = parseInt(match[1]!, 10);
      const sec = parseInt(match[2]!, 10);
      const msPart = match[3] ?? '0';
      const ms = msPart.length === 2 ? parseInt(msPart, 10) * 10 : parseInt(msPart, 10);
      const timeS = min * 60 + sec + ms / 1000;
      timestamps.push(timeS);
    }

    if (timestamps.length > 0) {
      // Strip timestamp tags from line content
      const text = trimmed.replace(timeRegex, '').trim();
      for (const timeS of timestamps) {
        lines.push({ timeS, text });
      }
    }
  }

  // If timestamps were found, sort lines by timeS and apply offset
  if (lines.length > 0) {
    const offsetS = offsetMs / 1000;
    for (const l of lines) {
      l.timeS = Math.max(0, l.timeS + offsetS);
    }
    lines.sort((a, b) => a.timeS - b.timeS);
    return {
      lines,
      offsetMs,
      isSynced: true,
      rawText: raw,
    };
  }

  // Plain-text fallback without timestamps
  const plainLines = rawLines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((text, i) => ({ timeS: i, text }));

  return {
    lines: plainLines,
    offsetMs: 0,
    isSynced: false,
    rawText: raw,
  };
}
