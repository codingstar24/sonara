import { describe, it, expect } from 'vitest';
import {
  calculateDecayedValue,
  addToDecayedCounter,
  createDecayedCounter,
  createDefaultTrackStats,
  getEvaluatedStats,
} from './decay';
import { HALF_LIFE_SHORT } from '@/config/app';

describe('Decayed Counters', () => {
  it('correctly calculates half-life decay', () => {
    const t0 = 1000000;
    const counter = createDecayedCounter(10, t0);

    // At t0, value is 10
    expect(calculateDecayedValue(counter, t0, HALF_LIFE_SHORT)).toBe(10);

    // After 1 half-life, value is 5
    const t1 = t0 + HALF_LIFE_SHORT;
    expect(calculateDecayedValue(counter, t1, HALF_LIFE_SHORT)).toBeCloseTo(5, 5);

    // After 2 half-lives, value is 2.5
    const t2 = t0 + 2 * HALF_LIFE_SHORT;
    expect(calculateDecayedValue(counter, t2, HALF_LIFE_SHORT)).toBeCloseTo(2.5, 5);
  });

  it('adds weights correctly at future timestamps', () => {
    const t0 = 1000000;
    let counter = createDecayedCounter(10, t0);

    // 1 half-life later, decayed value is 5; add +1.0 -> should be 6
    const t1 = t0 + HALF_LIFE_SHORT;
    counter = addToDecayedCounter(counter, 1.0, t1, HALF_LIFE_SHORT);

    expect(counter.updatedAt).toBe(t1);
    expect(counter.value).toBeCloseTo(6.0, 5);

    // Test penalty (negative weight) clamping at 0
    counter = addToDecayedCounter(counter, -10.0, t1, HALF_LIFE_SHORT);
    expect(counter.value).toBe(0);
  });

  it('evaluates TrackStats properly across short and long half-lives', () => {
    const t0 = 1000000;
    const stats = createDefaultTrackStats('track-1', t0);
    stats.shortScore = createDecayedCounter(8, t0);
    stats.longScore = createDecayedCounter(8, t0);

    // After 1 short half-life (3 days), shortScore should be 4, longScore (30 days) decays much less
    const tShort = t0 + HALF_LIFE_SHORT;
    const evaluated = getEvaluatedStats(stats, tShort);

    expect(evaluated.shortScore).toBeCloseTo(4, 4);
    // 3 days out of 30 days is 0.1 half lives: 8 * 0.5^0.1 = 8 * 0.933 = ~7.46
    expect(evaluated.longScore).toBeGreaterThan(7);
    expect(evaluated.longScore).toBeLessThan(8);
  });
});
