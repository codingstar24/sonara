import {
  type FC,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useRef,
  useState,
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
} from '@phosphor-icons/react';
import { useUIStore } from './stores';
import { SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_COLLAPSE_THRESHOLD } from '@/config/app';

export const Sidebar: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const setSidebarResizing = useUIStore((s) => s.setSidebarResizing);

  const [showSearch, setShowSearch] = useState(false);
  const [filterActive, setFilterActive] = useState<string | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

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
              <button className="icon-btn" aria-label="Add to library">
                <Plus size={20} weight="bold" />
              </button>
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
        }}
      >
        {/* Liked Songs - always first */}
        <SidebarItem
          icon={
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--radius-thumb)',
                background: 'var(--liked-gradient)',
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
          subtitle="Playlist"
          isActive={location.pathname === '/liked'}
          isCollapsed={isCollapsed}
          isPinned
          onClick={() => navigate('/liked')}
        />

        {/* Empty state */}
        {!isCollapsed && (
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
}

const SidebarItem: FC<SidebarItemProps> = ({
  icon,
  title,
  subtitle,
  isActive,
  isCollapsed,
  isPinned,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: isCollapsed ? '4px' : '4px 8px',
        borderRadius: 'var(--radius-thumb)',
        background: isActive ? 'var(--bg-row-hover)' : 'transparent',
        border: 'none',
        color: 'var(--text)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-family)',
        transition: 'background var(--duration-fast) var(--ease)',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'var(--bg-row-hover)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'transparent';
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
              color: isActive ? 'var(--text)' : 'var(--text)',
            }}
          >
            {title}
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
