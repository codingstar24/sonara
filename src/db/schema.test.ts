import { describe, it, expect } from 'vitest';
import { getDefaultSettings, db } from './schema';

describe('Database and Settings Schema', () => {
  it('returns valid default settings matching the specification', () => {
    const settings = getDefaultSettings();
    expect(settings.id).toBe('settings');
    expect(settings.theme).toBe('dark');
    expect(settings.accent).toBe('#1ED760');
    expect(settings.gapless).toBe(true);
    expect(settings.crossfadeS).toBe(0);
    expect(settings.autoScanOnStartup).toBe(true);
  });

  it('declares tables in Dexie database instance', () => {
    expect(db.sources).toBeDefined();
    expect(db.tracks).toBeDefined();
    expect(db.artwork).toBeDefined();
    expect(db.playlists).toBeDefined();
    expect(db.playlistTracks).toBeDefined();
    expect(db.likes).toBeDefined();
    expect(db.playEvents).toBeDefined();
    expect(db.trackStats).toBeDefined();
    expect(db.contextStats).toBeDefined();
    expect(db.lyrics).toBeDefined();
    expect(db.settings).toBeDefined();
  });
});
