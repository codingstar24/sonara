import { describe, it, expect } from 'vitest';
import { generateFingerprint, normalizeString } from './fingerprint';
import { parseFilename } from './filenameParser';
import { parseLrc } from './lrcParser';
import { parseM3U, parsePLS } from './m3uParser';

describe('Track Fingerprint', () => {
  it('normalizes diacritics and punctuation', () => {
    expect(normalizeString('Beyoncé - Déjà Vu (feat. Jay-Z)')).toBe('beyonce deja vu feat jayz');
  });

  it('generates deterministic fingerprint matching across variants', () => {
    const fp1 = generateFingerprint('Hello', 'Adele', 295.4, 1048576);
    const fp2 = generateFingerprint('hello!', 'Adele', 295.1, 1048576);
    expect(fp1).toBe(fp2);
    expect(fp1).toBe('hello|adele|295_1048576');
  });
});

describe('Filename Parser Fallbacks', () => {
  it('parses "01 - Artist - Title.mp3"', () => {
    const res = parseFilename('01 - Daft Punk - One More Time.mp3');
    expect(res.trackNo).toBe(1);
    expect(res.artist).toBe('Daft Punk');
    expect(res.title).toBe('One More Time');
  });

  it('parses "Artist - Title.flac"', () => {
    const res = parseFilename('Pink Floyd - Time.flac');
    expect(res.artist).toBe('Pink Floyd');
    expect(res.title).toBe('Time');
  });

  it('parses "05 Track Title.wav"', () => {
    const res = parseFilename('05 Track Title.wav');
    expect(res.trackNo).toBe(5);
    expect(res.title).toBe('Track Title');
  });

  it('infers album and artist from folder structure', () => {
    const res = parseFilename('01 Song.mp3', 'Radiohead/OK Computer/01 Song.mp3');
    expect(res.album).toBe('OK Computer');
    expect(res.artist).toBe('Radiohead');
  });
});

describe('LRC Synced Lyrics Parser', () => {
  it('parses timestamps and applies offset', () => {
    const lrc = `
[offset:500]
[00:12.50]First line
[00:15.00]Second line
    `;
    const res = parseLrc(lrc);
    expect(res.isSynced).toBe(true);
    expect(res.lines.length).toBe(2);
    expect(res.lines[0]?.text).toBe('First line');
    // 12.5s + 0.5s offset = 13.0s
    expect(res.lines[0]?.timeS).toBeCloseTo(13.0);
  });

  it('handles multi-timestamp lines', () => {
    const lrc = `[00:01.00][00:05.00]Chorus line`;
    const res = parseLrc(lrc);
    expect(res.lines.length).toBe(2);
    expect(res.lines[0]?.timeS).toBe(1);
    expect(res.lines[1]?.timeS).toBe(5);
    expect(res.lines[0]?.text).toBe('Chorus line');
    expect(res.lines[1]?.text).toBe('Chorus line');
  });

  it('falls back gracefully to plain text', () => {
    const plain = `Line 1\nLine 2\nLine 3`;
    const res = parseLrc(plain);
    expect(res.isSynced).toBe(false);
    expect(res.lines.length).toBe(3);
  });
});

describe('Playlist Parsers (M3U & PLS)', () => {
  it('parses M3U with EXTINF metadata', () => {
    const m3u = `
#EXTM3U
#EXTINF:210,Queen - Bohemian Rhapsody
songs/queen_bohemian.mp3
#EXTINF:180,Radiohead - Creep
songs/creep.mp3
    `;
    const res = parseM3U(m3u, 'Rock Classics');
    expect(res.name).toBe('Rock Classics');
    expect(res.entries.length).toBe(2);
    expect(res.entries[0]?.artist).toBe('Queen');
    expect(res.entries[0]?.title).toBe('Bohemian Rhapsody');
    expect(res.entries[0]?.duration).toBe(210);
    expect(res.entries[0]?.path).toBe('songs/queen_bohemian.mp3');
  });

  it('parses PLS format', () => {
    const pls = `
[playlist]
NumberOfEntries=1
File1=music/track1.mp3
Title1=The Beatles - Hey Jude
Length1=431
Version=2
    `;
    const res = parsePLS(pls);
    expect(res.entries.length).toBe(1);
    expect(res.entries[0]?.artist).toBe('The Beatles');
    expect(res.entries[0]?.title).toBe('Hey Jude');
    expect(res.entries[0]?.duration).toBe(431);
  });
});
