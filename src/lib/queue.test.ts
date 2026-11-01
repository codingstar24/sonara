import { describe, it, expect } from 'vitest';
import {
  createInitialQueueState,
  playContext,
  playNow,
  playNext,
  addToQueue,
  removeFromQueue,
  moveInQueue,
  clearQueue,
  getNextState,
  getPreviousState,
  setShuffle,
  jumpToQueueItem,
} from './queue';
import { shuffleArray, mulberry32 } from './shuffle';

describe('Queue System & Reducers', () => {
  it('creates initial empty state', () => {
    const s = createInitialQueueState();
    expect(s.current).toBeNull();
    expect(s.userQueue).toEqual([]);
    expect(s.context).toBeNull();
  });

  it('plays a context and sets current track', () => {
    const s = createInitialQueueState();
    const next = playContext(s, 'playlist', 'p1', 'My Playlist', ['t1', 't2', 't3'], 't2');
    expect(next.current?.trackId).toBe('t2');
    expect(next.context?.cursor).toBe(1);
    expect(next.context?.playOrder).toEqual(['t1', 't2', 't3']);
  });

  it('keeps manual queue when a new context is selected', () => {
    let s = createInitialQueueState();
    s = playNow(s, 't0');
    s = addToQueue(s, ['manual1', 'manual2']);

    const next = playContext(s, 'album', 'a1', 'Album', ['t1', 't2', 't3']);
    expect(next.userQueue.map((i) => i.trackId)).toEqual(['manual1', 'manual2']);
    expect(next.current?.trackId).toBe('t1');
  });

  it('prioritizes userQueue over context on next()', () => {
    let s = createInitialQueueState();
    s = playContext(s, 'album', 'a1', 'Album', ['t1', 't2', 't3']);
    s = playNext(s, ['priority1']);

    const n1 = getNextState(s);
    expect(n1?.current?.trackId).toBe('priority1');
    expect(n1?.current?.origin).toBe('queue');
    expect(n1?.userQueue).toEqual([]);

    // After manual queue is consumed, resumes context
    const n2 = getNextState(n1!);
    expect(n2?.current?.trackId).toBe('t2');
    expect(n2?.current?.origin).toBe('context');
  });

  it('handles drag-and-drop move in userQueue', () => {
    let s = createInitialQueueState();
    s = addToQueue(s, ['q1', 'q2', 'q3']);
    const moved = moveInQueue(s, 0, 2);
    expect(moved.userQueue.map((i) => i.trackId)).toEqual(['q2', 'q3', 'q1']);
  });

  it('removes an item from queue', () => {
    let s = createInitialQueueState();
    s = addToQueue(s, ['q1', 'q2', 'q3']);
    const itemIdToRemove = s.userQueue[1]!.itemId;
    const removed = removeFromQueue(s, itemIdToRemove);
    expect(removed.userQueue.map((i) => i.trackId)).toEqual(['q1', 'q3']);
  });

  it('clears the manual queue', () => {
    let s = createInitialQueueState();
    s = addToQueue(s, ['q1', 'q2']);
    const cleared = clearQueue(s);
    expect(cleared.userQueue).toEqual([]);
  });

  it('handles repeat "one"', () => {
    let s = createInitialQueueState();
    s = { ...s, repeat: 'one' };
    s = playContext(s, 'playlist', 'p1', 'P', ['t1', 't2']);

    const naturalNext = getNextState(s, true);
    expect(naturalNext?.current?.trackId).toBe('t1');

    // Manual skip advances regardless of repeat one
    const manualNext = getNextState(s, false);
    expect(manualNext?.current?.trackId).toBe('t2');
  });

  it('handles repeat "all" wrapping at end of context', () => {
    let s = createInitialQueueState();
    s = { ...s, repeat: 'all' };
    s = playContext(s, 'playlist', 'p1', 'P', ['t1', 't2'], 't2');

    const next = getNextState(s);
    expect(next?.current?.trackId).toBe('t1');
    expect(next?.context?.cursor).toBe(0);
  });

  it('handles previous track (> 3s restarts, <= 3s steps back)', () => {
    let s = createInitialQueueState();
    s = playContext(s, 'playlist', 'p1', 'P', ['t1', 't2'], 't2');

    // Playing for 5 seconds -> restarts
    const prevRestart = getPreviousState(s, 5);
    expect(prevRestart.shouldSeekToZero).toBe(true);

    // Playing for 1 second -> goes back to t1
    const prevBack = getPreviousState(s, 1);
    expect(prevBack.shouldSeekToZero).toBe(false);
    expect(prevBack.newState.current?.trackId).toBe('t1');
  });

  it('toggles shuffle ON and OFF while keeping current track intact', () => {
    let s = createInitialQueueState();
    s = playContext(s, 'album', 'a1', 'Album', ['t1', 't2', 't3', 't4', 't5'], 't3');

    // Turn shuffle on
    const shuffled = setShuffle(s, true);
    expect(shuffled.shuffle).toBe(true);
    expect(shuffled.context?.playOrder[0]).toBe('t3');
    expect(shuffled.context?.playOrder.length).toBe(5);

    // Turn shuffle off -> restores original order and position
    const unshuffled = setShuffle(shuffled, false);
    expect(unshuffled.shuffle).toBe(false);
    expect(unshuffled.context?.playOrder).toEqual(['t1', 't2', 't3', 't4', 't5']);
    expect(unshuffled.context?.cursor).toBe(2);
  });
});

describe('Seeded Shuffle & PRNG', () => {
  it('mulberry32 generates deterministic sequence from seed', () => {
    const prng1 = mulberry32(12345);
    const prng2 = mulberry32(12345);
    expect(prng1()).toBe(prng2());
    expect(prng1()).toBe(prng2());
  });

  it('shuffles array without losing elements', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = shuffleArray(arr, mulberry32(42));
    expect(shuffled.length).toBe(arr.length);
    expect(shuffled.sort()).toEqual(arr);
  });

  it('jumps to item in userQueue and discards items above it', () => {
    let s = createInitialQueueState();
    s = playNow(s, 'curr');
    s = addToQueue(s, ['q1', 'q2', 'q3', 'q4']);

    const targetItem = s.userQueue[2]!; // 'q3'
    const jumped = jumpToQueueItem(s, targetItem.itemId, 'queue');

    expect(jumped.current?.trackId).toBe('q3');
    // Items above it ('q1', 'q2') discarded, remaining is ['q4']
    expect(jumped.userQueue.map((i) => i.trackId)).toEqual(['q4']);
    expect(jumped.history[0]?.trackId).toBe('curr');
  });

  it('jumps to item in context by index or trackId', () => {
    let s = createInitialQueueState();
    s = playContext(s, 'album', 'a1', 'Album', ['c1', 'c2', 'c3', 'c4'], 'c1');

    const jumped = jumpToQueueItem(s, 'c3', 'context', 2);
    expect(jumped.current?.trackId).toBe('c3');
    expect(jumped.context?.cursor).toBe(2);
    expect(jumped.history[0]?.trackId).toBe('c1');
  });
});
