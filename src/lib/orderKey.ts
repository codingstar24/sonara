/**
 * Order key management for playlist tracks.
 * Uses spaced integers with midpoint allocation and automatic rebalancing
 * when the gap between adjacent items becomes too small.
 */

export const ORDER_STEP = 1000;
export const MIN_ORDER_GAP = 0.001;

export interface Orderable {
  id: string;
  order: number;
}

/**
 * Generate initial sequential orders for a list of items
 */
export function initializeOrders<T extends object>(items: T[]): (T & { order: number })[] {
  return items.map((item, idx) => ({
    ...item,
    order: (idx + 1) * ORDER_STEP,
  }));
}

/**
 * Calculate the new order value when moving or inserting an item
 * between prevOrder and nextOrder.
 * - If at start: prevOrder is null, nextOrder is number.
 * - If at end: prevOrder is number, nextOrder is null.
 * - If between: both are numbers.
 * - If list empty: both are null.
 */
export function calculateOrderBetween(
  prevOrder: number | null | undefined,
  nextOrder: number | null | undefined
): { newOrder: number; needsRebalance: boolean } {
  if (prevOrder == null && nextOrder == null) {
    return { newOrder: ORDER_STEP, needsRebalance: false };
  }

  if (prevOrder == null && nextOrder != null) {
    if (nextOrder <= 1) {
      return { newOrder: nextOrder / 2, needsRebalance: nextOrder / 2 < MIN_ORDER_GAP };
    }
    return { newOrder: Math.max(1, nextOrder - ORDER_STEP), needsRebalance: false };
  }

  if (prevOrder != null && nextOrder == null) {
    return { newOrder: prevOrder + ORDER_STEP, needsRebalance: false };
  }

  if (prevOrder != null && nextOrder != null) {
    const gap = nextOrder - prevOrder;
    if (gap <= MIN_ORDER_GAP) {
      return { newOrder: prevOrder + gap / 2, needsRebalance: true };
    }
    return { newOrder: prevOrder + gap / 2, needsRebalance: false };
  }

  return { newOrder: ORDER_STEP, needsRebalance: false };
}

/**
 * Rebalance all items in a playlist to evenly spaced integers
 */
export function rebalanceOrders<T extends Orderable>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  return sorted.map((item, idx) => ({
    ...item,
    order: (idx + 1) * ORDER_STEP,
  }));
}
