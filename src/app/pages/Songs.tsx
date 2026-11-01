import { type FC, useMemo, useState } from 'react';
import { useLibraryStore, usePlayerStore } from '../stores';
import { useQueueStore } from '@/features/queue/queueStore';
import { useLikesStore } from '@/features/likes/likesStore';
import { TrackRow } from '@/components/ui/TrackRow';
import { TrackContextMenu } from '@/components/ui/TrackContextMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { MusicNotes, Play } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import type { TrackLite } from '@/db/types';

export const SongsPage: FC = () => {
  const tracksMap = useLibraryStore((s) => s.tracks);
  const tracks = useMemo(() => Array.from(tracksMap.values()), [tracksMap]);
  const [filter, setFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLiked = useLikesStore((s) => s.isLiked);
  const toggleLike = useLikesStore((s) => s.toggleLike);

  const filteredTracks = useMemo(() => {
    if (!filter.trim()) return tracks;
    const q = filter.toLowerCase();
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q)
    );
  }, [tracks, filter]);

  const selectedTrackObjects = useMemo(() => {
    return Array.from(selectedIds)
      .map((id) => tracksMap.get(id))
      .filter((t): t is TrackLite => !!t);
  }, [selectedIds, tracksMap]);

  const handleSelect = (e: React.MouseEvent, track: TrackLite, idx: number) => {
    if (e.shiftKey && selectedIds.size > 0) {
      const lastSelectedId = Array.from(selectedIds)[selectedIds.size - 1]!;
      const lastIdx = filteredTracks.findIndex((t) => t.id === lastSelectedId);
      if (lastIdx !== -1) {
        const start = Math.min(lastIdx, idx);
        const end = Math.max(lastIdx, idx);
        const nextSet = new Set(selectedIds);
        for (let i = start; i <= end; i++) {
          const item = filteredTracks[i];
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

  return (
    <div className="route-enter" style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: '24px',
          gap: '16px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 'var(--text-display)',
              fontWeight: 'var(--font-display)',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}
          >
            Songs
          </h1>
          <p style={{ color: 'var(--text-sub)', marginTop: '8px' }}>
            {tracks.length} {tracks.length === 1 ? 'song' : 'songs'} in your library
          </p>
        </div>

        {tracks.length > 0 && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Filter songs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text)',
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 'var(--text-caption)',
                outline: 'none',
                width: 200,
              }}
            />
            <Button
              variant="primary"
              onClick={() => {
                if (filteredTracks.length > 0) {
                  void useQueueStore
                    .getState()
                    .playContext(
                      'songs',
                      'all',
                      'All Songs',
                      filteredTracks.map((t) => t.id),
                      filteredTracks[0]?.id
                    );
                }
              }}
            >
              <Play size={18} weight="fill" /> Play all
            </Button>
          </div>
        )}
      </div>

      {/* Table Content */}
      {tracks.length === 0 ? (
        <EmptyState
          icon={<MusicNotes size={48} />}
          title="Your library is empty"
          description="Add folders or audio files to populate your library."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Table Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '40px minmax(200px, 4fr) minmax(120px, 2fr) 100px 40px',
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

          {filteredTracks.map((t, idx) => {
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
                  isCurrent={isCurrent}
                  isPlaying={isCurrent && isPlaying}
                  isLiked={isLiked(t.id)}
                  selected={isSelected}
                  onSelect={(e) => handleSelect(e, t, idx)}
                  onPlay={() => {
                    if (isCurrent) {
                      void useQueueStore.getState().togglePlay();
                    } else {
                      void useQueueStore
                        .getState()
                        .playContext(
                          'songs',
                          'all',
                          'All Songs',
                          filteredTracks.map((x) => x.id),
                          t.id
                        );
                    }
                  }}
                  onDoubleClick={() => {
                    void useQueueStore
                      .getState()
                      .playContext(
                        'songs',
                        'all',
                        'All Songs',
                        filteredTracks.map((x) => x.id),
                        t.id
                      );
                  }}
                  onLikeToggle={() => void toggleLike(t.id)}
                />
              </TrackContextMenu>
            );
          })}
        </div>
      )}
    </div>
  );
};
