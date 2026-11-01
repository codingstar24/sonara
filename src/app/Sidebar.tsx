import {
  type FC,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useRef,
  useState,
  useMemo,
  useEffect,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Queue as QueueIcon,
  Heart,
  Plus,
  MagnifyingGlass,
  CaretRight,
  PushPin,
  SortAscending,
  Folder,
  MusicNotes,
  FileText,
  Playlist as PlaylistIcon,
  User,
} from '@phosphor-icons/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { db } from '@/db/schema';
import type { Source } from '@/db/types';
import { Cover } from '@/components/ui/Cover';
import { useUIStore, usePlayerStore, useLibraryStore } from './stores';
import { usePlaylistStore } from '@/features/playlists/playlistStore';
import { useLikesStore } from '@/features/likes/likesStore';
import { useQueueStore } from '@/features/queue/queueStore';
import { SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_COLLAPSE_THRESHOLD } from '@/config/app';
import { importPipeline } from '@/features/import/importPipeline';
import { ImportModal } from '@/features/import/ImportModal';

export const Sidebar: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [importModalOpen, setImportModalOpen] = useState(false);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const setSidebarResizing = useUIStore((s) => s.setSidebarResizing);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<string | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const playlistsMap = usePlaylistStore((s) => s.playlists);
  const playlistTracksMap = usePlaylistStore((s) => s.playlistTracks);
  const pins = usePlaylistStore((s) => s.pins);
  const likedCount = useLikesStore((s) => s.likedIds.size);
  const currentContext = useQueueStore((s) => s.context);
  const isAudioPlaying = usePlayerStore((s) => s.isPlaying);
  const totalTracks = useLibraryStore((s) => s.totalTracks);
  const albumsMap = useLibraryStore((s) => s.albums);
  const artistsMap = useLibraryStore((s) => s.artists);

  const [sources, setSources] = useState<Source[]>([]);

  const loadSourcesList = useCallback(() => {
    void db.sources.toArray().then((list) => {
      setSources(list.filter((s) => !s.id.startsWith('demo-') && !s.name.toLowerCase().includes('demo music')));
    });
  }, []);

  useEffect(() => {
    loadSourcesList();
  }, [totalTracks, loadSourcesList]);

  const albumsList = useMemo(() => {
    let list = Array.from(albumsMap.values());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) => a.album.toLowerCase().includes(q) || a.albumArtist.toLowerCase().includes(q));
    }
    return list;
  }, [albumsMap, searchQuery]);

  const artistsList = useMemo(() => {
    let list = Array.from(artistsMap.values());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }
    return list;
  }, [artistsMap, searchQuery]);

  const filteredPlaylists = useMemo(() => {
    let list = Array.from(playlistsMap.values());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      const aPin = pins.has(a.id) ? 1 : 0;
      const bPin = pins.has(b.id) ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      return a.name.localeCompare(b.name);
    });
  }, [playlistsMap, pins, searchQuery]);

  const isCollapsed = collapsed || sidebarWidth <= SIDEBAR_MIN_WIDTH;

  // Resize handle
  const handleResizeStart = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      resizeRef.current = { startX: e.clientX, startWidth: sidebarWidth };
      setSidebarResizing(true);

      const handleMove = (ev: globalThis.MouseEvent) => {
        if (!resizeRef.current) return;
        const delta = ev.clientX - resizeRef.current.startX;
        let newWidth = resizeRef.current.startWidth + delta;

        if (newWidth < SIDEBAR_COLLAPSE_THRESHOLD) {
          setSidebarCollapsed(true);
          newWidth = SIDEBAR_MIN_WIDTH;
        } else {
          setSidebarCollapsed(false);
          newWidth = Math.max(SIDEBAR_COLLAPSE_THRESHOLD, Math.min(SIDEBAR_MAX_WIDTH, newWidth));
        }
        setSidebarWidth(newWidth);
      };

      const handleUp = () => {
        resizeRef.current = null;
        setSidebarResizing(false);
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [sidebarWidth, setSidebarWidth, setSidebarCollapsed, setSidebarResizing]
  );

  const handleDoubleClick = useCallback(() => {
    setSidebarWidth(320);
    setSidebarCollapsed(false);
  }, [setSidebarWidth, setSidebarCollapsed]);

  // Filter chips
  const filters = [
    { key: 'playlists', label: 'Playlists' },
    { key: 'albums', label: 'Albums' },
    { key: 'artists', label: 'Artists' },
    { key: 'folders', label: 'Folders' },
  ];

  return (
    <nav
      aria-label="Library sidebar"
      style={{
        width: isCollapsed ? SIDEBAR_MIN_WIDTH : sidebarWidth,
        minWidth: SIDEBAR_MIN_WIDTH,
        height: '100%',
        background: 'var(--bg-panel)',
        borderRadius: 'var(--radius-panel)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        transition: resizeRef.current ? 'none' : 'width var(--duration-normal) var(--ease)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: isCollapsed ? '12px 0' : '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          flexShrink: 0,
        }}
      >
        {isCollapsed ? (
          <button
            className="icon-btn"
            onClick={() => {
              setSidebarCollapsed(false);
              setSidebarWidth(320);
            }}
            aria-label="Expand library"
          >
            <QueueIcon size={24} />
          </button>
        ) : (
          <>
            <button
              onClick={() => navigate('/library')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'none',
                border: 'none',
                color: 'var(--text-sub)',
                cursor: 'pointer',
                fontSize: 'var(--text-body)',
                fontWeight: 'var(--font-title)',
                fontFamily: 'var(--font-family)',
                padding: 0,
                transition: 'color var(--duration-fast) var(--ease)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-sub)')}
            >
              <QueueIcon size={24} weight="bold" />
              Your Library
            </button>
            <div style={{ display: 'flex', gap: '4px' }}>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="icon-btn" aria-label="Add to library">
                    <Plus size={20} weight="bold" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    side="bottom"
                    align="end"
                    sideOffset={8}
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderRadius: 'var(--radius-card)',
                      padding: '4px',
                      minWidth: 180,
                      boxShadow: 'var(--shadow-dropdown)',
                      zIndex: 1000,
                      color: 'var(--text)',
                      fontSize: 'var(--text-body)',
                    }}
                  >
                    <DropdownMenu.Item
                      onClick={async () => {
                        const newId = await usePlaylistStore.getState().createPlaylist();
                        navigate(`/playlist/${newId}`);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-row-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <PlaylistIcon size={18} />
                      Create playlist
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onClick={() => setImportModalOpen(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-row-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <Folder size={18} />
                      Add folder...
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onClick={() => void importPipeline.importFiles()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-row-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <MusicNotes size={18} />
                      Add files...
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.m3u,.m3u8,.pls';
                        input.onchange = () => {
                          const file = input.files?.[0];
                          if (file) void importPipeline.importPlaylist(file);
                        };
                        input.click();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-row-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <FileText size={18} />
                      Import playlist...
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              <button
                className="icon-btn"
                onClick={() => {
                  setSidebarCollapsed(true);
                  setSidebarWidth(SIDEBAR_MIN_WIDTH);
                }}
                aria-label="Collapse library"
              >
                <CaretRight size={20} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Filter chips + search + sort */}
      {!isCollapsed && (
        <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() =>
                  setFilterActive(filterActive === f.key ? null : f.key)
                }
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 'var(--text-caption)',
                  fontWeight: 'var(--font-medium)',
                  fontFamily: 'var(--font-family)',
                  border: 'none',
                  cursor: 'pointer',
                  background:
                    filterActive === f.key
                      ? 'var(--text)'
                      : 'rgba(255,255,255,0.07)',
                  color:
                    filterActive === f.key
                      ? 'var(--bg-base)'
                      : 'var(--text)',
                  transition: 'all var(--duration-fast) var(--ease)',
                }}
              >
                {f.label}
              </button>
            ))}
            {filterActive && (
              <button
                onClick={() => setFilterActive(null)}
                className="icon-btn"
                aria-label="Clear filter"
                style={{ padding: 4 }}
              >
                <span style={{ fontSize: 14, fontWeight: 700 }}>✕</span>
              </button>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '8px',
            }}
          >
            <button
              className="icon-btn"
              onClick={() => setShowSearch(!showSearch)}
              aria-label="Search in library"
            >
              <MagnifyingGlass size={16} />
            </button>
            <button
              className="icon-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: 'var(--text-caption)',
                color: 'var(--text-sub)',
              }}
            >
              Recents
              <SortAscending size={14} />
            </button>
          </div>

          {showSearch && (
            <input
              type="text"
              placeholder="Search in Your Library"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                marginTop: '8px',
                padding: '8px 12px',
                background: 'var(--bg-input)',
                border: 'none',
                borderRadius: 'var(--radius-thumb)',
                color: 'var(--text)',
                fontSize: 'var(--text-caption)',
                fontFamily: 'var(--font-family)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          )}
        </div>
      )}

      {/* Library items */}
      <div
        className="scrollable-panel"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: isCollapsed ? '0 8px' : '0 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {/* Liked Songs - always first */}
        {(!filterActive || filterActive === 'playlists') && (
          <SidebarItem
            icon={
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius-thumb)',
                  background: 'linear-gradient(135deg, #450AF5, #8E8EE5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Heart size={20} weight="fill" color="white" />
              </div>
            }
            title="Liked Songs"
            subtitle={`Playlist • ${likedCount} ${likedCount === 1 ? 'song' : 'songs'}`}
            isActive={location.pathname === '/liked'}
            isCollapsed={isCollapsed}
            isPinned
            isPlaying={currentContext?.type === 'liked' && isAudioPlaying}
            onClick={() => navigate('/liked')}
          />
        )}

        {/* Dynamic playlists */}
        {(!filterActive || filterActive === 'playlists') &&
          filteredPlaylists.map((pl) => {
            const trackCount = playlistTracksMap.get(pl.id)?.length || 0;
            const isPlayingThis = currentContext?.id === pl.id && isAudioPlaying;
            const isPinnedThis = pins.has(pl.id);

            return (
              <SidebarItem
                key={pl.id}
                icon={
                  pl.customCover ? (
                    <img
                      src={URL.createObjectURL(pl.customCover)}
                      alt={pl.name}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 'var(--radius-thumb)',
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 'var(--radius-thumb)',
                        backgroundColor: 'var(--bg-card)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-sub)',
                        flexShrink: 0,
                      }}
                    >
                      <PlaylistIcon size={22} />
                    </div>
                  )
                }
                title={pl.name}
                subtitle={`${pl.kind === 'smart' ? 'Smart Playlist' : 'Playlist'} • ${trackCount} ${
                  trackCount === 1 ? 'song' : 'songs'
                }`}
                isActive={location.pathname === `/playlist/${pl.id}`}
                isCollapsed={isCollapsed}
                isPinned={isPinnedThis}
                isPlaying={isPlayingThis}
                onClick={() => navigate(`/playlist/${pl.id}`)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  // Check dataTransfer for track IDs if custom drag
                  const data = e.dataTransfer.getData('application/json');
                  if (data) {
                    try {
                      const parsed = JSON.parse(data);
                      if (Array.isArray(parsed.trackIds)) {
                        void usePlaylistStore.getState().addTracksToPlaylist(pl.id, parsed.trackIds);
                      }
                    } catch {}
                  }
                }}
              />
            );
          })}

        {/* Folders view */}
        {(!filterActive || filterActive === 'folders') &&
          sources.map((src) => (
            <SidebarItem
              key={`src-${src.id}`}
              icon={
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 'var(--radius-thumb)',
                    backgroundColor: 'var(--bg-card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent)',
                    flexShrink: 0,
                  }}
                >
                  <Folder size={24} weight="fill" />
                </div>
              }
              title={src.name}
              subtitle={`Folder • ${src.path || 'Local folder'}`}
              isActive={location.pathname === '/folders' && location.search.includes(src.id)}
              isCollapsed={isCollapsed}
              onClick={() => navigate(`/folders?id=${src.id}`)}
            />
          ))}

        {/* Albums filter view */}
        {filterActive === 'albums' &&
          albumsList.map((album) => (
            <SidebarItem
              key={album.key}
              icon={
                <Cover
                  artworkId={album.artworkId}
                  title={album.album}
                  size={48}
                  rounded
                />
              }
              title={album.album}
              subtitle={`Album • ${album.albumArtist}`}
              isActive={location.pathname === `/album/${encodeURIComponent(album.key)}`}
              isCollapsed={isCollapsed}
              onClick={() => navigate(`/album/${encodeURIComponent(album.key)}`)}
            />
          ))}

        {/* Artists filter view */}
        {filterActive === 'artists' &&
          artistsList.map((artist) => (
            <SidebarItem
              key={artist.name}
              icon={
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-sub)',
                    flexShrink: 0,
                  }}
                >
                  <User size={24} />
                </div>
              }
              title={artist.name}
              subtitle={`Artist • ${artist.trackCount} ${artist.trackCount === 1 ? 'song' : 'songs'}`}
              isActive={location.pathname === `/artist/${encodeURIComponent(artist.name)}`}
              isCollapsed={isCollapsed}
              onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
            />
          ))}

        {/* Empty state if no playlists and no songs */}
        {!isCollapsed && totalTracks === 0 && playlistsMap.size === 0 && (
          <div
            style={{
              margin: '16px 8px',
              padding: '20px 16px',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-card)',
            }}
          >
            <p
              style={{
                fontWeight: 'var(--font-title)',
                fontSize: 'var(--text-title)',
                marginBottom: '8px',
              }}
            >
              Add your music
            </p>
            <p
              style={{
                color: 'var(--text-sub)',
                fontSize: 'var(--text-caption)',
                marginBottom: '16px',
                lineHeight: 'var(--leading-relaxed)',
              }}
            >
              Drop files here or click below to add your music library
            </p>
            <button
              className="btn-primary"
              onClick={() => setImportModalOpen(true)}
              style={{
                height: 32,
                fontSize: 'var(--text-caption)',
                padding: '0 16px',
              }}
            >
              Browse files
            </button>
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        onDoubleClick={handleDoubleClick}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        style={{
          position: 'absolute',
          top: 0,
          right: -2,
          bottom: 0,
          width: 4,
          cursor: 'col-resize',
          zIndex: 10,
          background: 'transparent',
          transition: 'background var(--duration-fast) var(--ease)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      />

      <ImportModal open={importModalOpen} onOpenChange={setImportModalOpen} />
    </nav>
  );
};

// --- Sidebar Item ---
interface SidebarItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  isActive?: boolean;
  isCollapsed?: boolean;
  isPinned?: boolean;
  isPlaying?: boolean;
  onClick?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
}

const SidebarItem: FC<SidebarItemProps> = ({
  icon,
  title,
  subtitle,
  isActive,
  isCollapsed,
  isPinned,
  isPlaying,
  onClick,
  onDrop,
  onDragOver,
}) => {
  const [dragHover, setDragHover] = useState(false);

  return (
    <button
      onClick={onClick}
      onDragOver={(e) => {
        if (onDragOver) {
          onDragOver(e);
          setDragHover(true);
        }
      }}
      onDragLeave={() => setDragHover(false)}
      onDrop={(e) => {
        setDragHover(false);
        onDrop?.(e);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: isCollapsed ? '4px' : '4px 8px',
        borderRadius: 'var(--radius-thumb)',
        background: dragHover
          ? 'rgba(30, 215, 96, 0.2)'
          : isActive
          ? 'var(--bg-row-hover)'
          : 'transparent',
        border: dragHover ? '1px dashed var(--accent)' : 'none',
        color: isPlaying ? 'var(--accent)' : 'var(--text)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-family)',
        transition: 'background var(--duration-fast) var(--ease)',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
      }}
      onMouseEnter={(e) => {
        if (!isActive && !dragHover) e.currentTarget.style.background = 'var(--bg-row-hover)';
      }}
      onMouseLeave={(e) => {
        if (!isActive && !dragHover) e.currentTarget.style.background = 'transparent';
      }}
    >
      {icon}
      {!isCollapsed && (
        <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
          <div
            className="truncate"
            style={{
              fontSize: 'var(--text-body)',
              fontWeight: 'var(--font-medium)',
              color: isPlaying ? 'var(--accent)' : 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isPlaying && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '2px',
                  height: '12px',
                }}
              >
                <span
                  style={{
                    width: 2,
                    height: '10px',
                    background: 'var(--accent)',
                    animation: 'equalizerBounce 0.8s infinite alternate',
                  }}
                />
                <span
                  style={{
                    width: 2,
                    height: '12px',
                    background: 'var(--accent)',
                    animation: 'equalizerBounce 1.1s infinite alternate 0.2s',
                  }}
                />
                <span
                  style={{
                    width: 2,
                    height: '8px',
                    background: 'var(--accent)',
                    animation: 'equalizerBounce 0.9s infinite alternate 0.4s',
                  }}
                />
              </div>
            )}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </span>
          </div>
          {subtitle && (
            <div
              className="truncate"
              style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--text-sub)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {isPinned && (
                <PushPin size={12} weight="fill" style={{ color: 'var(--accent)', flexShrink: 0 }} />
              )}
              {subtitle}
            </div>
          )}
        </div>
      )}
    </button>
  );
};
