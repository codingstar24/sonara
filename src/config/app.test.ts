import { describe, it, expect } from 'vitest';
import {
  APP_NAME,
  getCurrentDaypart,
  DAYPARTS,
  AUDIO_EXTENSIONS,
} from './app';
import { formatTime, parseTime } from '@/lib/formatters';

describe('App Configuration and Helpers', () => {
  it('has valid APP_NAME and Dayparts', () => {
    expect(APP_NAME).toBe('Sonara');
    expect(DAYPARTS.morning.greeting).toBe('Good morning');
    expect(DAYPARTS.afternoon.greeting).toBe('Good afternoon');
    expect(DAYPARTS.evening.greeting).toBe('Good evening');
    expect(DAYPARTS.night.greeting).toBe('Good night');
  });

  it('determines current daypart correctly', () => {
    const daypart = getCurrentDaypart();
    expect(['morning', 'afternoon', 'evening', 'night']).toContain(daypart);
  });

  it('contains supported audio extensions', () => {
    expect(AUDIO_EXTENSIONS.has('mp3')).toBe(true);
    expect(AUDIO_EXTENSIONS.has('flac')).toBe(true);
    expect(AUDIO_EXTENSIONS.has('wav')).toBe(true);
    expect(AUDIO_EXTENSIONS.has('m4a')).toBe(true);
    expect(AUDIO_EXTENSIONS.has('ogg')).toBe(true);
    expect(AUDIO_EXTENSIONS.has('opus')).toBe(true);
  });

  it('formats time to mm:ss and hh:mm:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(3665)).toBe('1:01:05');
  });

  it('parses time strings back to seconds', () => {
    expect(parseTime('1:05')).toBe(65);
    expect(parseTime('1:01:05')).toBe(3665);
    expect(parseTime('invalid')).toBe(0);
  });
});
