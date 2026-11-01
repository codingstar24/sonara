import { describe, it, expect } from 'vitest';
import {
  initializeOrders,
  calculateOrderBetween,
  rebalanceOrders,
  ORDER_STEP,
  MIN_ORDER_GAP,
} from './orderKey';

describe('Playlist Order Key Management', () => {
  it('initializes items with sequential orders spaced by ORDER_STEP', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const ordered = initializeOrders(items);
    expect(ordered[0]!.order).toBe(ORDER_STEP);
    expect(ordered[1]!.order).toBe(ORDER_STEP * 2);
    expect(ordered[2]!.order).toBe(ORDER_STEP * 3);
  });

  it('calculates order for empty list', () => {
    const { newOrder, needsRebalance } = calculateOrderBetween(null, null);
    expect(newOrder).toBe(ORDER_STEP);
    expect(needsRebalance).toBe(false);
  });

  it('calculates order when prepending before first item', () => {
    const { newOrder, needsRebalance } = calculateOrderBetween(null, 1000);
    expect(newOrder).toBe(1); // max(1, 1000 - 1000)
    expect(needsRebalance).toBe(false);

    // Prepending before 1
    const sub = calculateOrderBetween(null, 1);
    expect(sub.newOrder).toBe(0.5);
    expect(sub.needsRebalance).toBe(false);
  });

  it('calculates order when appending to the end', () => {
    const { newOrder, needsRebalance } = calculateOrderBetween(3000, null);
    expect(newOrder).toBe(4000);
    expect(needsRebalance).toBe(false);
  });

  it('calculates order between two items', () => {
    const { newOrder, needsRebalance } = calculateOrderBetween(1000, 2000);
    expect(newOrder).toBe(1500);
    expect(needsRebalance).toBe(false);
  });

  it('detects when rebalancing is needed due to tight gap', () => {
    const { needsRebalance } = calculateOrderBetween(1000, 1000 + MIN_ORDER_GAP / 2);
    expect(needsRebalance).toBe(true);
  });

  it('rebalances a crowded list back to standard spacing', () => {
    const crowded = [
      { id: '1', order: 1000.1 },
      { id: '2', order: 1000.15 },
      { id: '3', order: 1000.17 },
      { id: '4', order: 1000.2 },
    ];
    const rebalanced = rebalanceOrders(crowded);
    expect(rebalanced.map((i) => i.order)).toEqual([1000, 2000, 3000, 4000]);
    expect(rebalanced.map((i) => i.id)).toEqual(['1', '2', '3', '4']);
  });
});
