import {
  type FC,
  useMemo,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Play,
  Shuffle,
  DotsThree,
  MagnifyingGlass,
  ListDashes,
  Rows,
  Playlist as PlaylistIcon,
  Lightning,
  PencilSimple,
  Copy,
  PushPin,
  FileArrowDown,
  Trash,
  ArrowsDownUp,
  DotsSixVertical,
} from '@phosphor-icons/react';
import { usePlaylistStore } from '@/features/playlists/playlistStore';
import { useLikesStore } from '@/features/likes/likesStore';
import { useLibraryStore, usePlayerStore } from '../stores';
import { useQueueStore } from '@/features/queue/queueStore';
import { generateCollageCover } from '@/features/playlists/playlistCover';
import { downloadPlaylistM3U8 } from '@/lib/playlistExport';
import { filterTracksWithSmartRules } from '@/lib/smartPlaylists';
import { TrackRow } from '@/components/ui/TrackRow';
import { TrackContextMenu } from '@/components/ui/TrackContextMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { EditPlaylistModal } from '@/features/playlists/EditPlaylistModal';
import { safeBlobUrl } from '@/lib/blobUrl';
import type { PlaylistTrack, TrackLite, PlaylistSortMode } from '@/db/types';

function formatTotalDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs} hr ${mins} min`;
  }
  return `${mins} min`;
}

interface SortableRowProps {
  pt: PlaylistTrack;
  track: TrackLite;
  index: number;
  compact: boolean;
  isCurrent: boolean;
  isPlaying: boolean;
  isLiked: boolean;
  selected: boolean;
  disabled: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onPlay: () => void;
  onDoubleClick: () => void;
  onLikeToggle: () => void;
}

const SortableRow: FC<SortableRowProps> = ({
  pt,
  track,
  index,
  compact,
  isCurrent,
  isPlaying,
  isLiked,
  selected,
  disabled,
  onSelect,
  onPlay,
  onDoubleClick,
  onLikeToggle,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pt.id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  };

  return (
    <div ref={setNodeRef} style={style}>
      {!disabled && (
        <button
          {...attributes}
          {...listeners}
          aria-label="Reorder track"
          style={{
            position: 'absolute',
            left: -4,
            zIndex: 2,
            background: 'none',
            border: 'none',
            color: 'var(--text-sub)',
            cursor: 'grab',
            padding: 0,
            width: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity var(--transition-fast)',
          }}
          className="dnd-handle"
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
        >
          <DotsSixVertical size={14} />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <TrackRow
          track={track}
          index={index}
          compact={compact}
          isCurrent={isCurrent}
          isPlaying={isPlaying}
          isLiked={isLiked}
          selected={selected}
          onSelect={onSelect}
          onPlay={onPlay}
          onDoubleClick={onDoubleClick}
          onLikeToggle={onLikeToggle}
        />
      </div>
    </div>
  );
};

const EMPTY_PLAYLIST_TRACKS: PlaylistTrack[] = [];

export const PlaylistPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const playlist = usePlaylistStore((s) => (id ? s.playlists.get(id) : undefined));
  const rawPlaylistTracks = usePlaylistStore(
    (s) => (id ? s.playlistTracks.get(id) : undefined)
  ) ?? EMPTY_PLAYLIST_TRACKS;
  const pins = usePlaylistStore((s) => s.pins);
  const isPinned = id ? pins.has(id) : false;

  const tracksMap = useLibraryStore((s) => s.tracks);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const toggleLike = useLikesStore((s) => s.toggleLike);
  const isLiked = useLikesStore((s) => s.isLiked);

  const [filterQuery, setFilterQuery] = useState('');
  const sortMode: PlaylistSortMode = playlist?.sortMode || 'custom';
  const [compact, setCompact] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [collageUrl, setCollageUrl] = useState<string | null>(null);

  // Compute a stable primitive key of artwork IDs (e.g. "art1,art2") to avoid object-reference re-triggers
  const collageArtworkIdsKey = useMemo(() => {
    if (!playlist || playlist.customCover) return '';
    return rawPlaylistTracks
      .map((pt) => tracksMap.get(pt.trackId)?.artworkId)
      .filter((artId): artId is string => !!artId)
      .slice(0, 4)
      .join(',');
  }, [playlist?.customCover, rawPlaylistTracks, tracksMap]);

  // Generate 2x2 collage cover if no custom cover - triggers ONLY when collageArtworkIdsKey changes
  useEffect(() => {
    let active = true;
    let url: string | null = null;

    if (!collageArtworkIdsKey) {
      setCollageUrl((prev) => (prev ? null : prev));
      return;
    }

    const artworkIds = collageArtworkIdsKey.split(',').filter(Boolean);
    if (artworkIds.length === 0) {
      setCollageUrl((prev) => (prev ? null : prev));
      return;
    }

    void generateCollageCover(artworkIds).then((blob) => {
      if (!active) return;
      const safeUrl = safeBlobUrl(blob);
      if (safeUrl) {
        url = safeUrl;
        setCollageUrl((prev) => (prev !== safeUrl ? safeUrl : prev));
      }
    });

    return () => {
      active = false;
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    };
  }, [collageArtworkIdsKey]);

  // Handle smart playlist vs manual
  const evaluatedTracks = useMemo(() => {
    if (!playlist) return [];

    if (playlist.kind === 'smart' && playlist.smartRules) {
      const allLibraryTracks = Array.from(tracksMap.values()).map((t) => ({
        track: t,
        isLiked: isLiked(t.id),
      }));
      const matched = filterTracksWithSmartRules(allLibraryTracks, playlist.smartRules);
      return matched.map((m, idx) => ({
        pt: {
          id: `smart_${playlist.id}_${idx}`,
          playlistId: playlist.id,
          trackId: m.track.id,
          order: idx * 1000,
          addedAt: m.track.addedAt,
        },
        track: m.track,
      }));
    }

    // Manual playlist
    const items: { pt: PlaylistTrack; track: TrackLite }[] = [];
    for (const pt of rawPlaylistTracks) {
      const t = tracksMap.get(pt.trackId);
      if (t) {
        items.push({ pt, track: t });
      }
    }
    return items;
  }, [playlist, rawPlaylistTracks, tracksMap, isLiked]);

  // Filtered & Sorted Tracks
  const displayedItems = useMemo(() => {
    let result = [...evaluatedTracks];

    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      result = result.filter(
        ({ track }) =>
          track.title.toLowerCase().includes(q) ||
          track.artist.toLowerCase().includes(q) ||
          track.album.toLowerCase().includes(q)
      );
    }

    if (sortMode !== 'custom') {
      result.sort((a, b) => {
        switch (sortMode) {
          case 'title':
            return a.track.title.localeCompare(b.track.title);
          case 'artist':
            return a.track.artist.localeCompare(b.track.artist);
          case 'album':
            return a.track.album.localeCompare(b.track.album);
          case 'duration':
            return a.track.duration - b.track.duration;
          case 'date-added':
            return b.pt.addedAt - a.pt.addedAt;
          default:
            return 0;
        }
      });
    }

    return result;
  }, [evaluatedTracks, filterQuery, sortMode]);

  const totalDuration = useMemo(() => {
    return evaluatedTracks.reduce((acc, { track }) => acc + (track.duration || 0), 0);
  }, [evaluatedTracks]);

  // DND Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const canReorder = sortMode === 'custom' && !filterQuery.trim() && playlist?.kind !== 'smart';

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !id) return;

      const oldIndex = rawPlaylistTracks.findIndex((pt) => pt.id === active.id);
      const newIndex = rawPlaylistTracks.findIndex((pt) => pt.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        void usePlaylistStore.getState().reorderPlaylistTracks(id, oldIndex, newIndex);
      }
    },
    [id, rawPlaylistTracks]
  );

  // Playback handlers
  const handlePlayAll = useCallback(
    (startTrackId?: string) => {
      if (!playlist || displayedItems.length === 0) return;
      const ids = displayedItems.map((i) => i.track.id);
      void useQueueStore
        .getState()
        .playContext('playlist', playlist.id, playlist.name, ids, startTrackId || ids[0]);
    },
    [playlist, displayedItems]
  );

  const handleShufflePlay = useCallback(() => {
    if (!playlist || displayedItems.length === 0) return;
    if (!useQueueStore.getState().shuffle) {
      useQueueStore.getState().toggleShuffle();
    }
    const ids = displayedItems.map((i) => i.track.id);
    const randomStart = ids[Math.floor(Math.random() * ids.length)];
    void useQueueStore
      .getState()
      .playContext('playlist', playlist.id, playlist.name, ids, randomStart);
  }, [playlist, displayedItems]);

  // Keyboard reordering Alt+Up/Down
  useEffect(() => {
    if (!canReorder || !id || selectedIds.size === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const selectedId = Array.from(selectedIds)[0];
        const idx = rawPlaylistTracks.findIndex((pt) => pt.trackId === selectedId);
        if (idx > 0) {
          void usePlaylistStore.getState().reorderPlaylistTracks(id, idx, idx - 1);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const selectedId = Array.from(selectedIds)[0];
        const idx = rawPlaylistTracks.findIndex((pt) => pt.trackId === selectedId);
        if (idx !== -1 && idx < rawPlaylistTracks.length - 1) {
          void usePlaylistStore.getState().reorderPlaylistTracks(id, idx, idx + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canReorder, id, selectedIds, rawPlaylistTracks]);

  // Selection handlers
  const handleSelect = (e: React.MouseEvent, track: TrackLite, idx: number) => {
    if (e.shiftKey && selectedIds.size > 0) {
      const lastSelectedId = Array.from(selectedIds)[selectedIds.size - 1]!;
      const lastIdx = displayedItems.findIndex((i) => i.track.id === lastSelectedId);
      if (lastIdx !== -1) {
        const start = Math.min(lastIdx, idx);
        const end = Math.max(lastIdx, idx);
        const nextSet = new Set(selectedIds);
        for (let i = start; i <= end; i++) {
          const item = displayedItems[i];
          if (item) nextSet.add(item.track.id);
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
      .map((tId) => tracksMap.get(tId))
      .filter((t): t is TrackLite => !!t);
  }, [selectedIds, tracksMap]);

  if (!playlist) {
    return (
      <div className="route-enter" style={{ padding: '40px 32px' }}>
        <h1 style={{ fontSize: 'var(--text-h2)' }}>Playlist not found</h1>
      </div>
    );
  }

  const coverSrc = safeBlobUrl(playlist.customCover) || collageUrl;

  return (
    <div className="route-enter">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '24px',
          padding: '40px 32px 24px',
          background:
            'linear-gradient(180deg, rgba(80, 56, 160, 0.35) 0%, rgba(18, 18, 18, 0) 100%)',
        }}
      >
        {/* Cover with edit overlay */}
        <div
          onClick={() => setEditModalOpen(true)}
          style={{
            width: 232,
            height: 232,
            minWidth: 232,
            borderRadius: 'var(--radius-card)',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-card)',
            color: 'var(--text-sub)',
            position: 'relative',
            cursor: 'pointer',
            overflow: 'hidden',
            flexShrink: 0,
          }}
          title="Click to edit details and cover"
        >
          {coverSrc ? (
            <img
              src={coverSrc}
              alt={playlist.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <PlaylistIcon size={80} />
          )}

          {/* Hover Edit Overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              opacity: 0,
              transition: 'opacity var(--transition-fast)',
              color: '#FFFFFF',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
          >
            <PencilSimple size={28} />
            <span style={{ fontSize: 'var(--text-caption)', fontWeight: 600 }}>Choose photo</span>
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: 'var(--text-caption)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {playlist.kind === 'smart' ? 'Smart Playlist' : 'Playlist'}
            </span>
            {playlist.kind === 'smart' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(30, 215, 96, 0.15)',
                  color: 'var(--accent)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                <Lightning size={12} weight="fill" />
                Live
              </span>
            )}
          </div>

          <h1
            onClick={() => setEditModalOpen(true)}
            style={{
              fontSize: 'clamp(28px, 5vw, 64px)',
              fontWeight: 'var(--font-display)',
              letterSpacing: '-0.03em',
              margin: '8px 0',
              lineHeight: 1.05,
              cursor: 'pointer',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={playlist.name}
          >
            {playlist.name}
          </h1>

          {playlist.description && (
            <p
              style={{
                color: 'var(--text-sub)',
                fontSize: 'var(--text-body)',
                marginBottom: '8px',
              }}
            >
              {playlist.description}
            </p>
          )}

          <p style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)' }}>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>You</span> •{' '}
            {evaluatedTracks.length} {evaluatedTracks.length === 1 ? 'song' : 'songs'}
            {evaluatedTracks.length > 0 ? `, ${formatTotalDuration(totalDuration)}` : ''}
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
            disabled={displayedItems.length === 0}
            aria-label={`Play ${playlist.name}`}
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'var(--accent)',
              color: 'var(--text-on-accent)',
              border: 'none',
              cursor: displayedItems.length === 0 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-card)',
              transition: 'transform var(--transition-fast)',
              opacity: displayedItems.length === 0 ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (displayedItems.length > 0) e.currentTarget.style.transform = 'scale(1.06)';
            }}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <Play size={24} weight="fill" style={{ marginLeft: 3 }} />
          </button>

          {/* Shuffle button */}
          <button
            onClick={handleShufflePlay}
            disabled={displayedItems.length === 0}
            aria-label="Shuffle playlist"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-sub)',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: 'var(--radius-pill)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-sub)')}
          >
            <Shuffle size={24} />
          </button>

          {/* More options menu */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                aria-label="More playlist options"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-sub)',
                  cursor: 'pointer',
                  padding: '8px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-sub)')}
              >
                <DotsThree size={28} weight="bold" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                style={{
                  minWidth: 180,
                  backgroundColor: 'rgba(35, 35, 35, 0.96)',
                  backdropFilter: 'blur(16px)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  padding: '4px',
                  boxShadow: 'var(--shadow-popover)',
                  zIndex: 10000,
                  color: 'var(--text)',
                  fontSize: 'var(--text-caption)',
                }}
              >
                <DropdownMenu.Item
                  onClick={() => setEditModalOpen(true)}
                  style={dropdownItemStyle}
                >
                  <PencilSimple size={14} style={{ marginRight: 8 }} /> Edit details
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onClick={() => void usePlaylistStore.getState().duplicatePlaylist(playlist.id)}
                  style={dropdownItemStyle}
                >
                  <Copy size={14} style={{ marginRight: 8 }} /> Duplicate
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onClick={() => void usePlaylistStore.getState().togglePin(playlist.id)}
                  style={dropdownItemStyle}
                >
                  <PushPin size={14} style={{ marginRight: 8 }} />{' '}
                  {isPinned ? 'Unpin from sidebar' : 'Pin to sidebar'}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onClick={() =>
                    downloadPlaylistM3U8(
                      playlist.name,
                      evaluatedTracks.map((i) => i.track)
                    )
                  }
                  style={dropdownItemStyle}
                >
                  <FileArrowDown size={14} style={{ marginRight: 8 }} /> Export as .m3u8
                </DropdownMenu.Item>

                {playlist.kind === 'smart' && (
                  <DropdownMenu.Item
                    onClick={() =>
                      void usePlaylistStore.getState().convertSmartToNormal(playlist.id)
                    }
                    style={dropdownItemStyle}
                  >
                    <ArrowsDownUp size={14} style={{ marginRight: 8 }} /> Convert to standard
                  </DropdownMenu.Item>
                )}

                <DropdownMenu.Separator
                  style={{ height: 1, backgroundColor: 'var(--divider)', margin: '4px 0' }}
                />

                <DropdownMenu.Item
                  onClick={() => {
                    void usePlaylistStore.getState().deletePlaylist(playlist.id);
                    navigate('/');
                  }}
                  style={{ ...dropdownItemStyle, color: '#ff5555' }}
                >
                  <Trash size={14} style={{ marginRight: 8 }} /> Delete
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {/* Filter & View Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Save custom sort button */}
          {sortMode !== 'custom' && (
            <button
              onClick={() =>
                void usePlaylistStore
                  .getState()
                  .saveSortAsCustomOrder(
                    playlist.id,
                    displayedItems.map((i) => i.track.id)
                  )
              }
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: 'var(--text)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Save as custom order
            </button>
          )}

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
              placeholder="Search in playlist..."
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
            value={sortMode}
            onChange={(e) => {
              const newMode = e.target.value as PlaylistSortMode;
              void usePlaylistStore.getState().setSortMode(playlist.id, newMode);
            }}
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
            <option value="custom">Custom order</option>
            <option value="title">Title</option>
            <option value="artist">Artist</option>
            <option value="album">Album</option>
            <option value="date-added">Date added</option>
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
      </div>

      {/* Content */}
      <div style={{ padding: '0 32px 32px' }}>
        {evaluatedTracks.length === 0 ? (
          <EmptyState
            icon={<PlaylistIcon size={48} />}
            title="This playlist is empty"
            description="Find more songs to add by browsing your library or searching."
          />
        ) : displayedItems.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-sub)' }}>
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

            {/* Sortable List or Standard List */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={displayedItems.map((i) => i.pt.id)}
                strategy={verticalListSortingStrategy}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {displayedItems.map(({ pt, track }, idx) => {
                    const isCurrent = track.id === currentTrackId;
                    const isSelected = selectedIds.has(track.id);

                    return (
                      <TrackContextMenu
                        key={pt.id}
                        track={track}
                        selectedTracks={selectedTrackObjects}
                        playlistId={playlist.id}
                        playlistTrackId={pt.id}
                        onRemoveFromPlaylist={() =>
                          void usePlaylistStore.getState().removeTrackFromPlaylist(pt.id)
                        }
                      >
                        <div>
                          <SortableRow
                            pt={pt}
                            track={track}
                            index={idx}
                            compact={compact}
                            isCurrent={isCurrent}
                            isPlaying={isCurrent && isPlaying}
                            isLiked={isLiked(track.id)}
                            selected={isSelected}
                            disabled={!canReorder}
                            onSelect={(e) => handleSelect(e, track, idx)}
                            onPlay={() => {
                              if (isCurrent) {
                                void useQueueStore.getState().togglePlay();
                              } else {
                                handlePlayAll(track.id);
                              }
                            }}
                            onDoubleClick={() => handlePlayAll(track.id)}
                            onLikeToggle={() => void toggleLike(track.id)}
                          />
                        </div>
                      </TrackContextMenu>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>

      {/* Edit Details Modal */}
      <EditPlaylistModal
        playlist={playlist}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
      />
    </div>
  );
};

const dropdownItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: 'var(--radius-xs)',
  cursor: 'pointer',
  outline: 'none',
  userSelect: 'none',
};
