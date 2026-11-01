import { PERSONALIZATION_THRESHOLD, PERSONALIZATION_MIN_SHOW } from '@/config/app';

/**
 * Calculates the personalization ramp factor in [0, 1].
 * personalization = min(1, totalCountedPlays / 100)
 */
export function calculatePersonalizationRamp(totalCountedPlays: number): number {
  if (totalCountedPlays <= 0) return 0;
  return Math.min(1.0, totalCountedPlays / PERSONALIZATION_THRESHOLD);
}

/**
 * Checks whether the user has passed the minimum threshold to show personalized shelves.
 */
export function isPersonalizationActive(personalizationRamp: number): boolean {
  return personalizationRamp >= PERSONALIZATION_MIN_SHOW;
}

/**
 * Calculates how many personalized slots to allocate for a shelf of size N.
 */
export function getPersonalizedSlotCount(ramp: number, totalSlots: number): number {
  if (ramp < PERSONALIZATION_MIN_SHOW) return 0;
  return Math.max(1, Math.round(ramp * totalSlots));
}
