import { type FC, useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DotsSixVertical,
  X,
  Queue as QueueIcon,
  ClockCounterClockwise,
  Playlist,
} from '@phosphor-icons/react';
import { useQueueStore } from './queueStore';
import { useLibraryStore, usePlayerStore } from '@/app/stores';
import { Cover } from '@/components/ui/Cover';
import type { QueueItem, TrackLite } from '@/db/types';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTotalDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs} hr ${mins} min`;
  }
  return `${mins} min`;
}

interface SortableQueueRowProps {
  item: QueueItem;
  track?: TrackLite;
  onRemove: () => void;
  onDoubleClick: () => void;
}

const SortableQueueRow: FC<SortableQueueRowProps> = ({
  item,
  track,
  onRemove,
  onDoubleClick,
}) => {
  const [hovered, setHovered] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.itemId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: hovered ? 'var(--bg-card-hover)' : 'transparent',
    userSelect: 'none',
    cursor: 'pointer',
    position: 'relative',
  };

  const title = track?.title || 'Unknown Track';
  const artist = track?.artist || 'Unknown Artist';
  const duration = track?.duration ? formatDuration(track.duration) : '--:--';

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={onDoubleClick}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        aria-label="Reorder track"
        style={{
          background: 'none',
          border: 'none',
          color: hovered ? 'var(--text-sub)' : 'transparent',
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          width: 18,
          height: 18,
          flexShrink: 0,
        }}
      >
        <DotsSixVertical size={16} weight="bold" />
      </button>

      {/* Cover */}
      <Cover
        artworkId={track?.artworkId}
        title={title}
        size={40}
        style={{ flexShrink: 0, borderRadius: 'var(--radius-sm)' }}
      />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div
          style={{
            fontSize: 'var(--text-body)',
            fontWeight: 500,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={title}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 'var(--text-caption)',
            color: 'var(--text-sub)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={artist}
        >
          {artist}
        </div>
      </div>

      {/* Duration / Remove button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        {hovered ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label="Remove from queue"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-sub)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-pill)',
            }}
          >
            <X size={14} weight="bold" />
          </button>
        ) : (
          <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
            {duration}
          </span>
        )}
      </div>
    </div>
  );
};

export const QueuePanel: FC = () => {
  const [activeTab, setActiveTab] = useState<'queue' | 'recent'>('queue');
  const tracksMap = useLibraryStore((s) => s.tracks);

  const current = useQueueStore((s) => s.current);
  const userQueue = useQueueStore((s) => s.userQueue);
  const context = useQueueStore((s) => s.context);
  const history = useQueueStore((s) => s.history);

  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);

  const currentTrack = current ? tracksMap.get(current.trackId) : null;

  // DND Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = userQueue.findIndex((i) => i.itemId === active.id);
      const newIndex = userQueue.findIndex((i) => i.itemId === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        useQueueStore.getState().moveInQueue(oldIndex, newIndex);
      }
    },
    [userQueue]
  );

  // Next from context items
  const contextUpcoming = useMemo(() => {
    if (!context || context.cursor >= context.playOrder.length - 1) return [];
    const upcomingTrackIds = context.playOrder.slice(context.cursor + 1);
    return upcomingTrackIds.map((trackId, offset) => ({
      trackId,
      originalIndex: context.cursor + 1 + offset,
      track: tracksMap.get(trackId),
    }));
  }, [context, tracksMap]);

  // Context total duration
  const contextTotalSecs = useMemo(() => {
    return contextUpcoming.reduce((acc, item) => acc + (item.track?.duration || 0), 0);
  }, [contextUpcoming]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        color: 'var(--text)',
      }}
    >
      {/* Tab toggle */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--divider)',
          marginBottom: '16px',
        }}
      >
        <button
          onClick={() => setActiveTab('queue')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-pill)',
            border: 'none',
            cursor: 'pointer',
            fontSize: 'var(--text-caption)',
            fontWeight: 600,
            background:
              activeTab === 'queue' ? 'var(--bg-card-hover)' : 'transparent',
            color: activeTab === 'queue' ? 'var(--text)' : 'var(--text-sub)',
            transition: 'all var(--transition-fast)',
          }}
        >
          <QueueIcon size={14} weight={activeTab === 'queue' ? 'bold' : 'regular'} />
          Queue
        </button>
        <button
          onClick={() => setActiveTab('recent')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-pill)',
            border: 'none',
            cursor: 'pointer',
            fontSize: 'var(--text-caption)',
            fontWeight: 600,
            background:
              activeTab === 'recent' ? 'var(--bg-card-hover)' : 'transparent',
            color: activeTab === 'recent' ? 'var(--text)' : 'var(--text-sub)',
            transition: 'all var(--transition-fast)',
          }}
        >
          <ClockCounterClockwise
            size={14}
            weight={activeTab === 'recent' ? 'bold' : 'regular'}
          />
          Recently played
        </button>
      </div>

      {/* Tab 1: Queue */}
      {activeTab === 'queue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section: Now Playing */}
          <div>
            <div
              style={{
                fontSize: 'var(--text-caption)',
                fontWeight: 700,
                color: 'var(--text-sub)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '8px',
              }}
            >
              Now playing
            </div>
            {currentTrack ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-card)',
                }}
              >
                <Cover
                  artworkId={currentTrack.artworkId}
                  title={currentTrack.title}
                  size={48}
                  style={{ flexShrink: 0, borderRadius: 'var(--radius-sm)' }}
                />
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: 'var(--text-body)',
                      fontWeight: 600,
                      color: 'var(--accent)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={currentTrack.title}
                  >
                    {currentTrack.title}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-caption)',
                      color: 'var(--text-sub)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={currentTrack.artist}
                  >
                    {currentTrack.artist}
                  </div>
                </div>

                {/* Animated Equalizer */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '2px',
                    height: '14px',
                    marginRight: '8px',
                  }}
                >
                  <span
                    style={{
                      width: 2,
                      height: isPlaying ? '12px' : '4px',
                      background: 'var(--accent)',
                      animation: isPlaying
                        ? 'equalizerBounce 0.8s infinite alternate'
                        : 'none',
                    }}
                  />
                  <span
                    style={{
                      width: 2,
                      height: isPlaying ? '14px' : '8px',
                      background: 'var(--accent)',
                      animation: isPlaying
                        ? 'equalizerBounce 1.1s infinite alternate 0.2s'
                        : 'none',
                    }}
                  />
                  <span
                    style={{
                      width: 2,
                      height: isPlaying ? '10px' : '6px',
                      background: 'var(--accent)',
                      animation: isPlaying
                        ? 'equalizerBounce 0.9s infinite alternate 0.4s'
                        : 'none',
                    }}
                  />
                </div>
              </div>
            ) : (
              <div
                style={{
                  fontSize: 'var(--text-caption)',
                  color: 'var(--text-sub)',
                  fontStyle: 'italic',
                }}
              >
                No track playing
              </div>
            )}
          </div>

          {/* Section: Next in queue */}
          {userQueue.length > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--text-caption)',
                    fontWeight: 700,
                    color: 'var(--text-sub)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Next in queue
                </div>
                <button
                  onClick={() => useQueueStore.getState().clearQueue()}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-sub)',
                    fontSize: 'var(--text-caption)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-pill)',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = 'var(--text)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = 'var(--text-sub)')
                  }
                >
                  Clear queue
                </button>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={userQueue.map((i) => i.itemId)}
                  strategy={verticalListSortingStrategy}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {userQueue.map((item) => (
                      <SortableQueueRow
                        key={item.itemId}
                        item={item}
                        track={tracksMap.get(item.trackId)}
                        onRemove={() =>
                          useQueueStore.getState().removeFromQueue(item.itemId)
                        }
                        onDoubleClick={() =>
                          void useQueueStore.getState().jumpTo(item.itemId, 'queue')
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* Section: Next from <context> */}
          {context && contextUpcoming.length > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--text-caption)',
                    fontWeight: 700,
                    color: 'var(--text-sub)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Next from: {context.name}
                </div>
                <button
                  onClick={() =>
                    void useQueueStore.getState().saveQueueAsPlaylist()
                  }
                  title="Save queue as playlist"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-sub)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: 'var(--text-caption)',
                    padding: '2px 6px',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = 'var(--text)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = 'var(--text-sub)')
                  }
                >
                  <Playlist size={14} />
                  Save as playlist
                </button>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-faint)',
                  marginBottom: '8px',
                }}
              >
                {contextUpcoming.length}{' '}
                {contextUpcoming.length === 1 ? 'song' : 'songs'} •{' '}
                {formatTotalDuration(contextTotalSecs)}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {contextUpcoming.map((item) => {
                  const title = item.track?.title || 'Unknown Track';
                  const artist = item.track?.artist || 'Unknown Artist';
                  const dur = item.track?.duration
                    ? formatDuration(item.track.duration)
                    : '--:--';

                  return (
                    <div
                      key={`${item.trackId}-${item.originalIndex}`}
                      onDoubleClick={() =>
                        void useQueueStore
                          .getState()
                          .jumpTo(item.trackId, 'context', item.originalIndex)
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '6px 8px',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'background var(--transition-fast)',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = 'var(--bg-card-hover)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = 'transparent')
                      }
                    >
                      <Cover
                        artworkId={item.track?.artworkId}
                        title={title}
                        size={40}
                        style={{
                          flexShrink: 0,
                          borderRadius: 'var(--radius-sm)',
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <div
                          style={{
                            fontSize: 'var(--text-body)',
                            fontWeight: 500,
                            color: 'var(--text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={title}
                        >
                          {title}
                        </div>
                        <div
                          style={{
                            fontSize: 'var(--text-caption)',
                            color: 'var(--text-sub)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={artist}
                        >
                          {artist}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 'var(--text-caption)',
                          color: 'var(--text-sub)',
                          flexShrink: 0,
                        }}
                      >
                        {dur}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state when nothing in queue and nothing upcoming */}
          {!currentTrack && userQueue.length === 0 && contextUpcoming.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 16px',
                textAlign: 'center',
              }}
            >
              <QueueIcon
                size={48}
                style={{ color: 'var(--text-faint)', marginBottom: 16 }}
              />
              <p style={{ fontWeight: 'var(--font-title)' }}>Queue is empty</p>
              <p
                style={{
                  color: 'var(--text-sub)',
                  fontSize: 'var(--text-caption)',
                  marginTop: 4,
                }}
              >
                Play songs from your library to populate the queue
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Recently Played */}
      {activeTab === 'recent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {history.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 16px',
                textAlign: 'center',
              }}
            >
              <ClockCounterClockwise
                size={48}
                style={{ color: 'var(--text-faint)', marginBottom: 16 }}
              />
              <p style={{ fontWeight: 'var(--font-title)' }}>
                No recently played songs
              </p>
              <p
                style={{
                  color: 'var(--text-sub)',
                  fontSize: 'var(--text-caption)',
                  marginTop: 4,
                }}
              >
                Songs you play will show up here
              </p>
            </div>
          ) : (
            history.map((item, idx) => {
              const track = tracksMap.get(item.trackId);
              const title = track?.title || 'Unknown Track';
              const artist = track?.artist || 'Unknown Artist';
              const dur = track?.duration ? formatDuration(track.duration) : '--:--';
              const isItemPlaying =
                isPlaying && currentTrackId === item.trackId;

              return (
                <div
                  key={`${item.itemId}-${idx}`}
                  onDoubleClick={() =>
                    void useQueueStore.getState().playNow(item.trackId)
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'var(--bg-card-hover)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'transparent')
                  }
                >
                  <Cover
                    artworkId={track?.artworkId}
                    title={title}
                    size={40}
                    style={{
                      flexShrink: 0,
                      borderRadius: 'var(--radius-sm)',
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <div
                      style={{
                        fontSize: 'var(--text-body)',
                        fontWeight: 500,
                        color: isItemPlaying ? 'var(--accent)' : 'var(--text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={title}
                    >
                      {title}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-caption)',
                        color: 'var(--text-sub)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={artist}
                    >
                      {artist}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 'var(--text-caption)',
                      color: 'var(--text-sub)',
                      flexShrink: 0,
                    }}
                  >
                    {dur}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
