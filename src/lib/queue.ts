import type { ContextType, QueueItem, QueueContext } from '@/db/types';
import { shuffleWithCurrentFirst } from './shuffle';
import { QUEUE_HISTORY_CAP } from '@/config/app';

export interface FullQueueState {
  current: QueueItem | null;
  userQueue: QueueItem[];
  context: QueueContext | null;
  history: QueueItem[];
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
}

export function createInitialQueueState(): FullQueueState {
  return {
    current: null,
    userQueue: [],
    context: null,
    history: [],
    shuffle: false,
    repeat: 'off',
  };
}

let idCounter = 0;
export function generateQueueItemId(): string {
  return `qi_${Date.now()}_${++idCounter}_${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Start playback from a context (album, playlist, songs, search, etc.)
 * Preserves the manual userQueue!
 */
export function playContext(
  state: FullQueueState,
  contextType: ContextType,
  contextId: string,
  contextName: string,
  trackIds: string[],
  startTrackId?: string
): FullQueueState {
  if (trackIds.length === 0) return state;

  const originalOrder = [...trackIds];
  let cursor = 0;
  if (startTrackId) {
    const idx = originalOrder.indexOf(startTrackId);
    if (idx !== -1) cursor = idx;
  }

  let playOrder = [...originalOrder];
  if (state.shuffle) {
    playOrder = shuffleWithCurrentFirst(originalOrder, cursor);
    cursor = 0;
  }

  const currentTrackId = playOrder[cursor]!;
  const currentItem: QueueItem = {
    itemId: generateQueueItemId(),
    trackId: currentTrackId,
    origin: 'context',
  };

  const newHistory = state.current
    ? [state.current, ...state.history].slice(0, QUEUE_HISTORY_CAP)
    : state.history;

  return {
    ...state,
    current: currentItem,
    context: {
      type: contextType,
      id: contextId,
      name: contextName,
      trackIds: originalOrder,
      playOrder,
      cursor,
    },
    history: newHistory,
  };
}

/**
 * Play a track immediately (overrides current, pushes old to history)
 */
export function playNow(
  state: FullQueueState,
  trackId: string,
  contextType: ContextType = 'songs',
  contextId = 'all',
  contextName = 'Songs'
): FullQueueState {
  const currentItem: QueueItem = {
    itemId: generateQueueItemId(),
    trackId,
    origin: 'context',
  };

  const newHistory = state.current
    ? [state.current, ...state.history].slice(0, QUEUE_HISTORY_CAP)
    : state.history;

  return {
    ...state,
    current: currentItem,
    context: {
      type: contextType,
      id: contextId,
      name: contextName,
      trackIds: [trackId],
      playOrder: [trackId],
      cursor: 0,
    },
    history: newHistory,
  };
}

/**
 * Add tracks to the top of the user queue (Play Next)
 * Preserves the provided array order
 */
export function playNext(state: FullQueueState, trackIds: string[]): FullQueueState {
  const newItems: QueueItem[] = trackIds.map((tid) => ({
    itemId: generateQueueItemId(),
    trackId: tid,
    origin: 'queue',
  }));

  return {
    ...state,
    userQueue: [...newItems, ...state.userQueue],
  };
}

/**
 * Append tracks to the end of the user queue
 */
export function addToQueue(state: FullQueueState, trackIds: string[]): FullQueueState {
  const newItems: QueueItem[] = trackIds.map((tid) => ({
    itemId: generateQueueItemId(),
    trackId: tid,
    origin: 'queue',
  }));

  return {
    ...state,
    userQueue: [...state.userQueue, ...newItems],
  };
}

/**
 * Remove an item from the user queue by unique itemId
 */
export function removeFromQueue(state: FullQueueState, itemId: string): FullQueueState {
  return {
    ...state,
    userQueue: state.userQueue.filter((item) => item.itemId !== itemId),
  };
}

/**
 * Reorder an item in the user queue (drag and drop)
 */
export function moveInQueue(
  state: FullQueueState,
  fromIndex: number,
  toIndex: number
): FullQueueState {
  if (
    fromIndex < 0 ||
    fromIndex >= state.userQueue.length ||
    toIndex < 0 ||
    toIndex >= state.userQueue.length ||
    fromIndex === toIndex
  ) {
    return state;
  }

  const items = [...state.userQueue];
  const [removed] = items.splice(fromIndex, 1);
  if (!removed) return state;
  items.splice(toIndex, 0, removed);

  return {
    ...state,
    userQueue: items,
  };
}

/**
 * Clear the manual user queue
 */
export function clearQueue(state: FullQueueState): FullQueueState {
  return {
    ...state,
    userQueue: [],
  };
}

/**
 * Jump to a specific queue item in userQueue or context
 */
export function jumpToQueueItem(
  state: FullQueueState,
  targetId: string,
  section: 'queue' | 'context',
  contextIndex?: number
): FullQueueState {
  const newHistory = state.current
    ? [state.current, ...state.history].slice(0, QUEUE_HISTORY_CAP)
    : state.history;

  if (section === 'queue') {
    const idx = state.userQueue.findIndex((item) => item.itemId === targetId);
    if (idx === -1) return state;
    const currentItem = state.userQueue[idx]!;
    const remaining = state.userQueue.slice(idx + 1);
    return {
      ...state,
      current: currentItem,
      userQueue: remaining,
      history: newHistory,
    };
  }

  if (section === 'context') {
    if (!state.context || state.context.playOrder.length === 0) return state;
    let targetIdx = contextIndex;
    if (targetIdx === undefined || targetIdx < 0) {
      targetIdx = state.context.playOrder.indexOf(targetId);
    }
    if (targetIdx === -1 || targetIdx >= state.context.playOrder.length) return state;

    const trackId = state.context.playOrder[targetIdx]!;
    return {
      ...state,
      current: {
        itemId: generateQueueItemId(),
        trackId,
        origin: 'context',
      },
      context: {
        ...state.context,
        cursor: targetIdx,
      },
      history: newHistory,
    };
  }

  return state;
}

/**
 * Advance to next track
 * 1. repeat 'one' and natural end -> replay same track
 * 2. userQueue has items -> pop first
 * 3. else advance context cursor
 * 4. context end -> repeat 'all' wrap or repeat 'off' stop
 */
export function getNextState(
  state: FullQueueState,
  isNaturalEnd = false
): FullQueueState | null {
  if (!state.current) return null;

  // 1. Repeat One
  if (state.repeat === 'one' && isNaturalEnd) {
    return state; // Engine will seek to 0 and replay
  }

  const newHistory = [state.current, ...state.history].slice(0, QUEUE_HISTORY_CAP);

  // 2. User Queue beats context
  if (state.userQueue.length > 0) {
    const [nextItem, ...remainingQueue] = state.userQueue;
    return {
      ...state,
      current: nextItem!,
      userQueue: remainingQueue,
      history: newHistory,
    };
  }

  // 3. Advance context
  if (state.context && state.context.playOrder.length > 0) {
    const nextCursor = state.context.cursor + 1;

    if (nextCursor < state.context.playOrder.length) {
      const nextTrackId = state.context.playOrder[nextCursor]!;
      return {
        ...state,
        current: {
          itemId: generateQueueItemId(),
          trackId: nextTrackId,
          origin: 'context',
        },
        context: {
          ...state.context,
          cursor: nextCursor,
        },
        history: newHistory,
      };
    }

    // Context reached end
    if (state.repeat === 'all') {
      let playOrder = [...state.context.trackIds];
      if (state.shuffle) {
        // Re-shuffle, but ensure first track differs from current if possible
        playOrder = shuffleWithCurrentFirst(playOrder, 0);
        if (playOrder.length > 1 && playOrder[0] === state.current.trackId) {
          const swap = playOrder[0]!;
          playOrder[0] = playOrder[1]!;
          playOrder[1] = swap;
        }
      }

      const nextTrackId = playOrder[0]!;
      return {
        ...state,
        current: {
          itemId: generateQueueItemId(),
          trackId: nextTrackId,
          origin: 'context',
        },
        context: {
          ...state.context,
          playOrder,
          cursor: 0,
        },
        history: newHistory,
      };
    }
  }

  // End of queue with repeat 'off'
  return null;
}

/**
 * Step back to previous track or seek to beginning
 */
export function getPreviousState(
  state: FullQueueState,
  currentPositionSeconds: number
): { newState: FullQueueState; shouldSeekToZero: boolean } {
  // If track has been playing for > 3s, restart it
  if (currentPositionSeconds > 3 || !state.current) {
    return { newState: state, shouldSeekToZero: true };
  }

  // Check history
  if (state.history.length > 0) {
    const [prevItem, ...remainingHistory] = state.history;
    return {
      newState: {
        ...state,
        current: prevItem!,
        history: remainingHistory,
      },
      shouldSeekToZero: false,
    };
  }

  // Step context cursor back
  if (state.context && state.context.cursor > 0) {
    const prevCursor = state.context.cursor - 1;
    const prevTrackId = state.context.playOrder[prevCursor]!;
    return {
      newState: {
        ...state,
        current: {
          itemId: generateQueueItemId(),
          trackId: prevTrackId,
          origin: 'context',
        },
        context: {
          ...state.context,
          cursor: prevCursor,
        },
      },
      shouldSeekToZero: false,
    };
  }

  return { newState: state, shouldSeekToZero: true };
}

/**
 * Toggle shuffle ON/OFF
 * ON: Shuffles remaining tracks, keeping current first
 * OFF: Restores original context order, continuing from current position
 */
export function setShuffle(state: FullQueueState, shuffle: boolean): FullQueueState {
  if (state.shuffle === shuffle || !state.context) {
    return { ...state, shuffle };
  }

  const { context } = state;
  let playOrder = [...context.trackIds];
  let cursor = 0;

  if (shuffle) {
    const currentTrackId = state.current?.trackId;
    const currentIdx = currentTrackId ? playOrder.indexOf(currentTrackId) : 0;
    playOrder = shuffleWithCurrentFirst(playOrder, currentIdx >= 0 ? currentIdx : 0);
    cursor = 0;
  } else {
    // Restore original order
    const currentTrackId = state.current?.trackId;
    cursor = currentTrackId ? Math.max(0, playOrder.indexOf(currentTrackId)) : 0;
  }

  return {
    ...state,
    shuffle,
    context: {
      ...context,
      playOrder,
      cursor,
    },
  };
}
