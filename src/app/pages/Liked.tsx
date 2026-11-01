import { type FC, useMemo, useState, useCallback } from 'react';
import {
  Heart,
  Play,
  Shuffle,
  MagnifyingGlass,
  ListDashes,
  Rows,
} from '@phosphor-icons/react';
import { useLikesStore } from '@/features/likes/likesStore';
import { useLibraryStore, usePlayerStore } from '../stores';
import { useQueueStore } from '@/features/queue/queueStore';
import { TrackRow } from '@/components/ui/TrackRow';
import { TrackContextMenu } from '@/components/ui/TrackContextMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import type { TrackLite } from '@/db/types';

function formatTotalDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs} hr ${mins} min`;
  }
  return `${mins} min`;
}

type SortField = 'date-added' | 'title' | 'artist' | 'album' | 'duration';

export const LikedPage: FC = () => {
  const likedIds = useLikesStore((s) => s.likedIds);
  const toggleLike = useLikesStore((s) => s.toggleLike);
  const tracksMap = useLibraryStore((s) => s.tracks);

  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const [filterQuery, setFilterQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('date-added');
  const [compact, setCompact] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Collect all liked tracks
  const likedTracks = useMemo(() => {
    const list: TrackLite[] = [];
    for (const tid of likedIds) {
      const t = tracksMap.get(tid);
      if (t) list.push(t);
    }
    return list;
  }, [likedIds, tracksMap]);

  // Total duration
  const totalDurationSecs = useMemo(() => {
    return likedTracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  }, [likedTracks]);

  // Filtered & Sorted tracks
  const displayedTracks = useMemo(() => {
    let result = [...likedTracks];

    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      switch (sortField) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'artist':
          return a.artist.localeCompare(b.artist);
        case 'album':
          return a.album.localeCompare(b.album);
        case 'duration':
          return a.duration - b.duration;
        case 'date-added':
        default:
          return b.addedAt - a.addedAt;
      }
    });

    return result;
  }, [likedTracks, filterQuery, sortField]);

  // Play entire liked songs context
  const handlePlayAll = useCallback(
    (startTrackId?: string) => {
      if (displayedTracks.length === 0) return;
      const ids = displayedTracks.map((t) => t.id);
      void useQueueStore
        .getState()
        .playContext('liked', 'liked', 'Liked Songs', ids, startTrackId || ids[0]);
    },
    [displayedTracks]
  );

  const handleShufflePlay = useCallback(() => {
    if (displayedTracks.length === 0) return;
    if (!useQueueStore.getState().shuffle) {
      useQueueStore.getState().toggleShuffle();
    }
    const ids = displayedTracks.map((t) => t.id);
    const randomStart = ids[Math.floor(Math.random() * ids.length)];
    void useQueueStore
      .getState()
      .playContext('liked', 'liked', 'Liked Songs', ids, randomStart);
  }, [displayedTracks]);

  // Selection handlers
  const handleSelect = (e: React.MouseEvent, track: TrackLite, idx: number) => {
    if (e.shiftKey && selectedIds.size > 0) {
      const lastSelectedId = Array.from(selectedIds)[selectedIds.size - 1]!;
      const lastIdx = displayedTracks.findIndex((t) => t.id === lastSelectedId);
      if (lastIdx !== -1) {
        const start = Math.min(lastIdx, idx);
        const end = Math.max(lastIdx, idx);
        const nextSet = new Set(selectedIds);
        for (let i = start; i <= end; i++) {
          const item = displayedTracks[i];
          if (item) nextSet.add(item.id);
        }
        setSelectedIds(nextSet);
        return;
      }
    }

    if (e.ctrlKey || e.metaKey) {
      const nextSet = new Set(selectedIds);
      if (nextSet.has(track.id)) {
        nextSet.delete(track.id);
      } else {
        nextSet.add(track.id);
      }
      setSelectedIds(nextSet);
      return;
    }

    setSelectedIds(new Set([track.id]));
  };

  const selectedTrackObjects = useMemo(() => {
    return Array.from(selectedIds)
      .map((id) => tracksMap.get(id))
      .filter((t): t is TrackLite => !!t);
  }, [selectedIds, tracksMap]);

  return (
    <div className="route-enter">
      {/* Hero Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '24px',
          padding: '40px 32px 24px',
          background:
            'linear-gradient(180deg, rgba(69, 10, 245, 0.45) 0%, rgba(18, 18, 18, 0) 100%)',
        }}
      >
        <div
          style={{
            width: 232,
            height: 232,
            minWidth: 232,
            borderRadius: 'var(--radius-card)',
            background: 'linear-gradient(135deg, #450AF5, #8E8EE5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-card)',
            flexShrink: 0,
          }}
        >
          <Heart size={96} weight="fill" color="#FFFFFF" />
        </div>

        <div>
          <span
            style={{
              fontSize: 'var(--text-caption)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Playlist
          </span>
          <h1
            style={{
              fontSize: 'clamp(32px, 6vw, 72px)',
              fontWeight: 'var(--font-display)',
              letterSpacing: '-0.03em',
              margin: '8px 0',
              lineHeight: 1,
            }}
          >
            Liked Songs
          </h1>
          <p style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)' }}>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>You</span> •{' '}
            {likedTracks.length} {likedTracks.length === 1 ? 'song' : 'songs'}
            {likedTracks.length > 0
              ? `, ${formatTotalDuration(totalDurationSecs)}`
              : ''}
          </p>
        </div>
      </div>

      {/* Action Row */}
      <div
        style={{
          padding: '0 32px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* 56px Green Play Button */}
          <button
            onClick={() => handlePlayAll()}
            disabled={displayedTracks.length === 0}
            aria-label="Play liked songs"
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'var(--accent)',
              color: 'var(--text-on-accent)',
              border: 'none',
              cursor: displayedTracks.length === 0 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-card)',
              transition: 'transform var(--transition-fast), filter var(--transition-fast)',
              opacity: displayedTracks.length === 0 ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (displayedTracks.length > 0)
                e.currentTarget.style.transform = 'scale(1.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <Play size={24} weight="fill" style={{ marginLeft: 3 }} />
          </button>

          {/* Shuffle button */}
          <button
            onClick={handleShufflePlay}
            disabled={displayedTracks.length === 0}
            aria-label="Shuffle liked songs"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-sub)',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: 'var(--radius-pill)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = 'var(--text)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = 'var(--text-sub)')
            }
          >
            <Shuffle size={24} />
          </button>
        </div>

        {/* Filter & View controls */}
        {likedTracks.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Search Input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-pill)',
                padding: '6px 14px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <MagnifyingGlass size={16} color="var(--text-sub)" />
              <input
                type="text"
                placeholder="Search in liked..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  fontSize: 'var(--text-caption)',
                  outline: 'none',
                  width: 140,
                }}
              />
            </div>

            {/* Sort Select */}
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              style={{
                background: 'var(--bg-card)',
                color: 'var(--text)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-pill)',
                padding: '6px 12px',
                fontSize: 'var(--text-caption)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="date-added">Date added</option>
              <option value="title">Title</option>
              <option value="artist">Artist</option>
              <option value="album">Album</option>
              <option value="duration">Duration</option>
            </select>

            {/* View toggle */}
            <button
              onClick={() => setCompact(!compact)}
              aria-label="Toggle compact view"
              style={{
                background: 'none',
                border: 'none',
                color: compact ? 'var(--accent)' : 'var(--text-sub)',
                cursor: 'pointer',
                padding: '6px',
              }}
              title={compact ? 'Switch to comfortable view' : 'Switch to compact view'}
            >
              {compact ? <Rows size={18} /> : <ListDashes size={18} />}
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '0 32px 32px' }}>
        {likedTracks.length === 0 ? (
          <EmptyState
            icon={<Heart size={48} />}
            title="Songs you like will appear here"
            description="Save songs by tapping the heart icon anywhere in the app."
          />
        ) : displayedTracks.length === 0 ? (
          <div
            style={{
              padding: '48px 0',
              textAlign: 'center',
              color: 'var(--text-sub)',
            }}
          >
            No matches found for &quot;{filterQuery}&quot;
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Table Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '40px minmax(200px, 4fr) minmax(120px, 2fr) 100px 40px',
                padding: '0 16px',
                height: 36,
                alignItems: 'center',
                borderBottom: '1px solid var(--divider)',
                fontSize: 'var(--text-caption)',
                color: 'var(--text-sub)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                gap: '16px',
                marginBottom: '8px',
              }}
            >
              <div style={{ textAlign: 'center' }}>#</div>
              <div>Title</div>
              <div>Album</div>
              <div style={{ textAlign: 'right' }}>Duration</div>
              <div />
            </div>

            {/* Rows */}
            {displayedTracks.map((t, idx) => {
              const isCurrent = t.id === currentTrackId;
              const isSelected = selectedIds.has(t.id);

              return (
                <TrackContextMenu
                  key={t.id}
                  track={t}
                  selectedTracks={selectedTrackObjects}
                >
                  <TrackRow
                    track={t}
                    index={idx}
                    compact={compact}
                    isCurrent={isCurrent}
                    isPlaying={isCurrent && isPlaying}
                    isLiked={true}
                    selected={isSelected}
                    onSelect={(e) => handleSelect(e, t, idx)}
                    onPlay={() => {
                      if (isCurrent) {
                        void useQueueStore.getState().togglePlay();
                      } else {
                        handlePlayAll(t.id);
                      }
                    }}
                    onDoubleClick={() => handlePlayAll(t.id)}
                    onLikeToggle={() => void toggleLike(t.id)}
                  />
                </TrackContextMenu>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
