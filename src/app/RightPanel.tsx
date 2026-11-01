import {
  type FC,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useRef,
} from 'react';
import {
  X,
  MusicNote,
  Queue as QueueIcon,
  MicrophoneStage,
} from '@phosphor-icons/react';
import { useUIStore } from './stores';
import {
  RIGHT_PANEL_MIN_WIDTH,
  RIGHT_PANEL_MAX_WIDTH,
} from '@/config/app';
import { QueuePanel } from '@/features/queue/QueuePanel';

export const RightPanel: FC = () => {
  const rightPanelWidth = useUIStore((s) => s.rightPanelWidth);
  const rightPanelMode = useUIStore((s) => s.rightPanelMode);
  const setRightPanelWidth = useUIStore((s) => s.setRightPanelWidth);
  const setRightPanelOpen = useUIStore((s) => s.setRightPanelOpen);
  const setRightPanelMode = useUIStore((s) => s.setRightPanelMode);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      resizeRef.current = { startX: e.clientX, startWidth: rightPanelWidth };

      const handleMove = (ev: globalThis.MouseEvent) => {
        if (!resizeRef.current) return;
        const delta = resizeRef.current.startX - ev.clientX;
        const newWidth = Math.max(
          RIGHT_PANEL_MIN_WIDTH,
          Math.min(RIGHT_PANEL_MAX_WIDTH, resizeRef.current.startWidth + delta)
        );
        setRightPanelWidth(newWidth);
      };

      const handleUp = () => {
        resizeRef.current = null;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [rightPanelWidth, setRightPanelWidth]
  );

  const tabs = [
    { key: 'now-playing' as const, label: 'Now Playing', icon: MusicNote },
    { key: 'queue' as const, label: 'Queue', icon: QueueIcon },
    { key: 'lyrics' as const, label: 'Lyrics', icon: MicrophoneStage },
  ];

  return (
    <aside
      aria-label="Side panel"
      style={{
        width: rightPanelWidth,
        minWidth: RIGHT_PANEL_MIN_WIDTH,
        height: '100%',
        background: 'var(--bg-panel)',
        borderRadius: 'var(--radius-panel)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          flexShrink: 0,
        }}
      >
        {/* Tab buttons */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setRightPanelMode(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 'var(--text-caption)',
                fontWeight: 'var(--font-medium)',
                fontFamily: 'var(--font-family)',
                border: 'none',
                cursor: 'pointer',
                background:
                  rightPanelMode === tab.key
                    ? 'rgba(255,255,255,0.1)'
                    : 'transparent',
                color:
                  rightPanelMode === tab.key
                    ? 'var(--text)'
                    : 'var(--text-sub)',
                transition: 'all var(--duration-fast) var(--ease)',
              }}
            >
              <tab.icon size={14} weight={rightPanelMode === tab.key ? 'fill' : 'regular'} />
              {tab.label}
            </button>
          ))}
        </div>

        <button
          className="icon-btn"
          onClick={() => setRightPanelOpen(false)}
          aria-label="Close panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div
        className="scrollable-panel"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 16px 16px',
        }}
      >
        {rightPanelMode === 'now-playing' && <NowPlayingPanel />}
        {rightPanelMode === 'queue' && <QueuePanel />}
        {rightPanelMode === 'lyrics' && <LyricsViewer />}
      </div>

      {/* Resize handle (left edge) */}
      <div
        onMouseDown={handleResizeStart}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        style={{
          position: 'absolute',
          top: 0,
          left: -2,
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
    </aside>
  );
};

import { NowPlayingPanel } from '@/features/player/NowPlayingPanel';
import { LyricsViewer } from '@/features/lyrics/LyricsViewer';
