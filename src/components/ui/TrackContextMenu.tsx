import { type FC, type ReactNode, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as ContextMenu from '@radix-ui/react-context-menu';
import {
  Play,
  PlusCircle,
  Queue as QueueIcon,
  Heart,
  Playlist,
  Trash,
  User,
  Disc,
  CaretRight,
  Check,
} from '@phosphor-icons/react';
import { useQueueStore } from '@/features/queue/queueStore';
import { useLikesStore } from '@/features/likes/likesStore';
import { usePlaylistStore } from '@/features/playlists/playlistStore';
import { useLibraryStore } from '@/app/stores';
import type { TrackLite } from '@/db/types';

export interface TrackContextMenuProps {
  track: TrackLite;
  selectedTracks?: TrackLite[];
  playlistId?: string;
  playlistTrackId?: string;
  onRemoveFromPlaylist?: () => void;
  children: ReactNode;
}

export const TrackContextMenu: FC<TrackContextMenuProps> = ({
  track,
  selectedTracks = [],
  playlistId,
  onRemoveFromPlaylist,
  children,
}) => {
  const navigate = useNavigate();
  const toggleLike = useLikesStore((s) => s.toggleLike);
  const isLiked = useLikesStore((s) => s.isLiked(track.id));
  const playlistsMap = usePlaylistStore((s) => s.playlists);
  const playlistTracksMap = usePlaylistStore((s) => s.playlistTracks);

  const effectiveTracks = useMemo(() => {
    if (selectedTracks.length > 1 && selectedTracks.some((t) => t.id === track.id)) {
      return selectedTracks;
    }
    return [track];
  }, [track, selectedTracks]);

  const count = effectiveTracks.length;
  const isMulti = count > 1;
  const trackIds = useMemo(() => effectiveTracks.map((t) => t.id), [effectiveTracks]);

  const playlists = useMemo(() => Array.from(playlistsMap.values()), [playlistsMap]);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          style={{
            minWidth: 200,
            backgroundColor: 'rgba(35, 35, 35, 0.96)',
            backdropFilter: 'blur(16px)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            padding: '4px',
            boxShadow: 'var(--shadow-popover)',
            zIndex: 9999,
            color: 'var(--text)',
            fontSize: 'var(--text-caption)',
            fontFamily: 'var(--font-family)',
          }}
        >
          {/* Play */}
          <ContextMenu.Item
            onClick={() => {
              if (isMulti) {
                void useQueueStore.getState().playContext('songs', 'selection', `${count} Songs`, trackIds, track.id);
              } else {
                void useQueueStore.getState().playNow(track.id);
              }
            }}
            style={menuItemStyle}
            onMouseEnter={handleItemEnter}
            onMouseLeave={handleItemLeave}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={14} weight="fill" />
              <span>Play {isMulti ? `(${count} songs)` : ''}</span>
            </div>
          </ContextMenu.Item>

          {/* Play next */}
          <ContextMenu.Item
            onClick={() => useQueueStore.getState().playNext(trackIds)}
            style={menuItemStyle}
            onMouseEnter={handleItemEnter}
            onMouseLeave={handleItemLeave}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <QueueIcon size={14} />
              <span>Play next {isMulti ? `(${count})` : ''}</span>
            </div>
          </ContextMenu.Item>

          {/* Add to queue */}
          <ContextMenu.Item
            onClick={() => useQueueStore.getState().addToQueue(trackIds)}
            style={menuItemStyle}
            onMouseEnter={handleItemEnter}
            onMouseLeave={handleItemLeave}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PlusCircle size={14} />
              <span>Add to queue {isMulti ? `(${count})` : ''}</span>
            </div>
          </ContextMenu.Item>

          {/* Like / Unlike */}
          <ContextMenu.Item
            onClick={() => {
              if (isMulti) {
                if (isLiked) {
                  void useLikesStore.getState().unlikeTracks(trackIds);
                } else {
                  void useLikesStore.getState().likeTracks(trackIds);
                }
              } else {
                void toggleLike(track.id);
              }
            }}
            style={menuItemStyle}
            onMouseEnter={handleItemEnter}
            onMouseLeave={handleItemLeave}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Heart size={14} weight={isLiked ? 'fill' : 'regular'} color={isLiked ? 'var(--accent)' : 'inherit'} />
              <span>{isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}</span>
            </div>
          </ContextMenu.Item>

          <ContextMenu.Separator style={separatorStyle} />

          {/* Add to playlist submenu */}
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger
              style={{
                ...menuItemStyle,
                justifyContent: 'space-between',
              }}
              onMouseEnter={handleItemEnter}
              onMouseLeave={handleItemLeave}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Playlist size={14} />
                <span>Add to playlist {isMulti ? `(${count})` : ''}</span>
              </div>
              <CaretRight size={12} />
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent
                style={{
                  minWidth: 200,
                  maxHeight: 280,
                  overflowY: 'auto',
                  backgroundColor: 'rgba(35, 35, 35, 0.96)',
                  backdropFilter: 'blur(16px)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  padding: '4px',
                  boxShadow: 'var(--shadow-popover)',
                  zIndex: 10000,
                  color: 'var(--text)',
                  fontSize: 'var(--text-caption)',
                  fontFamily: 'var(--font-family)',
                }}
              >
                {/* Create new playlist option */}
                <ContextMenu.Item
                  onClick={async () => {
                    const newId = await usePlaylistStore.getState().createPlaylist();
                    await usePlaylistStore.getState().addTracksToPlaylist(newId, trackIds);
                  }}
                  style={menuItemStyle}
                  onMouseEnter={handleItemEnter}
                  onMouseLeave={handleItemLeave}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <PlusCircle size={14} />
                    <span>New playlist</span>
                  </div>
                </ContextMenu.Item>

                {playlists.length > 0 && <ContextMenu.Separator style={separatorStyle} />}

                {playlists.map((pl) => {
                  const existingTracks = playlistTracksMap.get(pl.id) || [];
                  const containsTrack = existingTracks.some((pt) => pt.trackId === track.id);

                  return (
                    <ContextMenu.Item
                      key={pl.id}
                      onClick={() => {
                        void usePlaylistStore.getState().addTracksToPlaylist(pl.id, trackIds);
                      }}
                      style={{
                        ...menuItemStyle,
                        justifyContent: 'space-between',
                      }}
                      onMouseEnter={handleItemEnter}
                      onMouseLeave={handleItemLeave}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pl.name}
                      </span>
                      {containsTrack && <Check size={14} weight="bold" color="var(--accent)" />}
                    </ContextMenu.Item>
                  );
                })}
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>

          {/* Remove from this playlist if viewing a playlist */}
          {playlistId && onRemoveFromPlaylist && (
            <ContextMenu.Item
              onClick={onRemoveFromPlaylist}
              style={menuItemStyle}
              onMouseEnter={handleItemEnter}
              onMouseLeave={handleItemLeave}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-sub)' }}>
                <Trash size={14} />
                <span>Remove from this playlist</span>
              </div>
            </ContextMenu.Item>
          )}

          <ContextMenu.Separator style={separatorStyle} />

          {/* Go to artist */}
          <ContextMenu.Item
            onClick={() => navigate(`/artist/${encodeURIComponent(track.artist)}`)}
            style={menuItemStyle}
            onMouseEnter={handleItemEnter}
            onMouseLeave={handleItemLeave}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={14} />
              <span>Go to artist</span>
            </div>
          </ContextMenu.Item>

          {/* Go to album */}
          <ContextMenu.Item
            onClick={() => {
              const albumKey = `${track.albumArtist || track.artist}:${track.album}`;
              navigate(`/album/${encodeURIComponent(albumKey)}`);
            }}
            style={menuItemStyle}
            onMouseEnter={handleItemEnter}
            onMouseLeave={handleItemLeave}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Disc size={14} />
              <span>Go to album</span>
            </div>
          </ContextMenu.Item>

          <ContextMenu.Separator style={separatorStyle} />

          {/* Remove from library */}
          <ContextMenu.Item
            onClick={async () => {
              await useLibraryStore.getState().removeTracks(trackIds);
            }}
            style={menuItemStyle}
            onMouseEnter={handleItemEnter}
            onMouseLeave={handleItemLeave}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff5555' }}>
              <Trash size={14} />
              <span>Remove from library {isMulti ? `(${count})` : ''}</span>
            </div>
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: 'var(--radius-xs)',
  cursor: 'pointer',
  outline: 'none',
  transition: 'background var(--transition-fast)',
  userSelect: 'none',
};

const separatorStyle: React.CSSProperties = {
  height: 1,
  backgroundColor: 'var(--divider)',
  margin: '4px 0',
};

function handleItemEnter(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
}

function handleItemLeave(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.backgroundColor = 'transparent';
}
