import { describe, it, expect } from 'vitest';
import { parseLrc, findActiveLyricIndex } from './lrcParser';

describe('LRC Lyrics Parser', () => {
  it('parses basic LRC with offset tag and metadata', () => {
    const raw = `
      [ti:Bohemian Rhapsody]
      [ar:Queen]
      [offset:500]
      [00:01.00]Is this the real life?
      [00:05.50]Is this just fantasy?
      [00:10.00]Caught in a landslide
    `;

    const parsed = parseLrc(raw);
    expect(parsed.isSynced).toBe(true);
    expect(parsed.offsetMs).toBe(500);
    expect(parsed.lines).toHaveLength(3);
    expect(parsed.lines[0]).toEqual({ timeMs: 1000, text: 'Is this the real life?' });
    expect(parsed.lines[1]).toEqual({ timeMs: 5500, text: 'Is this just fantasy?' });
    expect(parsed.lines[2]).toEqual({ timeMs: 10000, text: 'Caught in a landslide' });
  });

  it('parses multi-timestamp lines and sorts chronologically', () => {
    const raw = `
      [00:10.00][00:30.00]Chorus line repeats here
      [00:20.00]Verse 1 line
    `;

    const parsed = parseLrc(raw);
    expect(parsed.lines).toHaveLength(3);
    expect(parsed.lines[0]!.timeMs).toBe(10000);
    expect(parsed.lines[1]!.timeMs).toBe(20000);
    expect(parsed.lines[2]!.timeMs).toBe(30000);
  });

  it('falls back to plain text when no timestamps are found', () => {
    const raw = `
      First line without timestamp
      Second line without timestamp
    `;

    const parsed = parseLrc(raw);
    expect(parsed.isSynced).toBe(false);
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[0]!.text).toBe('First line without timestamp');
  });

  it('finds the active lyric index accurately respecting offset', () => {
    const lines = [
      { timeMs: 1000, text: 'Line 1' },
      { timeMs: 4000, text: 'Line 2' },
      { timeMs: 8000, text: 'Line 3' },
    ];

    // At 500ms -> before line 1
    expect(findActiveLyricIndex(lines, 500, 0)).toBe(-1);

    // At 2000ms -> Line 1
    expect(findActiveLyricIndex(lines, 2000, 0)).toBe(0);

    // At 4500ms -> Line 2
    expect(findActiveLyricIndex(lines, 4500, 0)).toBe(1);

    // At 4500ms with +1000ms offset (effective time 3500ms) -> Line 1
    expect(findActiveLyricIndex(lines, 4500, 1000)).toBe(0);

    // At 10000ms -> Line 3
    expect(findActiveLyricIndex(lines, 10000, 0)).toBe(2);
  });
});
