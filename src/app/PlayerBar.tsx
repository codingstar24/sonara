import { type FC, useCallback, useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  RepeatOnce,
  Shuffle,
  Heart,
  SpeakerHigh,
  SpeakerLow,
  SpeakerX,
  SpeakerNone,
  Queue as QueueIcon,
  MicrophoneStage,
  Equalizer,
  CornersOut,
} from '@phosphor-icons/react';
import { usePlayerStore, useUIStore, useLibraryStore } from './stores';
import { useQueueStore } from '@/features/queue/queueStore';
import { useLikesStore } from '@/features/likes/likesStore';
import { playbackClock, type ClockSnapshot } from '@/engine/clock';
import { Cover } from '@/components/ui/Cover';
import { SleepTimerPopover } from '@/features/player/SleepTimerPopover';
import { formatTime } from '@/lib/formatters';
import { toast } from 'sonner';

// ============================================================
// Progress/Seek Bar (rAF-driven, does NOT re-render the app)
// ============================================================

interface SeekBarProps {
  onSeek: (time: number) => void;
}

const SeekBar: FC<SeekBarProps> = ({ onSeek }) => {
  const barRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const timeTextRef = useRef<HTMLSpanElement>(null);
  const durationTextRef = useRef<HTMLSpanElement>(null);

  const [hovering, setHovering] = useState(false);
  const [hoverX, setHoverX] = useState(0);
  const durationRef = useRef(0);

  useEffect(() => {
    return playbackClock.subscribe((snap: ClockSnapshot) => {
      durationRef.current = snap.duration;
      const pct = snap.progress * 100;
      if (fillRef.current) {
        fillRef.current.style.width = `${pct}%`;
      }
      if (thumbRef.current) {
        thumbRef.current.style.left = `${pct}%`;
      }
      if (timeTextRef.current) {
        timeTextRef.current.textContent = formatTime(snap.currentTime);
      }
      if (durationTextRef.current) {
        durationTextRef.current.textContent = formatTime(snap.duration);
      }
    });
  }, []);

  const handleSeekFromEvent = useCallback(
    (clientX: number) => {
      if (!barRef.current || durationRef.current <= 0) return;
      const rect = barRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onSeek(fraction * durationRef.current);
    },
    [onSeek]
  );

  const hoverTime =
    durationRef.current > 0 && barRef.current
      ? (hoverX / barRef.current.offsetWidth) * durationRef.current
      : 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
      }}
    >
      <span
        ref={timeTextRef}
        style={{
          fontSize: 'var(--text-caption)',
          color: 'var(--text-sub)',
          minWidth: 40,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        0:00
      </span>

      <div
        ref={barRef}
        role="slider"
        aria-label="Seek"
        tabIndex={0}
        onMouseDown={(e) => {
          handleSeekFromEvent(e.clientX);
          const handleMove = (ev: MouseEvent) => handleSeekFromEvent(ev.clientX);
          const handleUp = () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
          };
          window.addEventListener('mousemove', handleMove);
          window.addEventListener('mouseup', handleUp);
        }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onMouseMove={(e) => {
          if (barRef.current) {
            const rect = barRef.current.getBoundingClientRect();
            setHoverX(e.clientX - rect.left);
          }
        }}
        style={{
          flex: 1,
          height: 12,
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: '100%',
            height: 4,
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 2,
            position: 'relative',
            overflow: 'visible',
          }}
        >
          <div
            ref={fillRef}
            style={{
              width: '0%',
              height: '100%',
              background: hovering ? 'var(--accent)' : 'var(--text)',
              borderRadius: 2,
              transition: 'background var(--transition-fast)',
            }}
          />

          <div
            ref={thumbRef}
            style={{
              position: 'absolute',
              top: '50%',
              left: '0%',
              transform: 'translate(-50%, -50%)',
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#FFFFFF',
              boxShadow: 'var(--shadow-dropdown)',
              opacity: hovering ? 1 : 0,
              pointerEvents: 'none',
              transition: 'opacity var(--transition-fast)',
            }}
          />

          {hovering && durationRef.current > 0 && (
            <div
              style={{
                position: 'absolute',
                top: -24,
                left: hoverX,
                transform: 'translateX(-50%)',
                background: 'var(--bg-elevated)',
                color: 'var(--text)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                fontWeight: 600,
                pointerEvents: 'none',
              }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>
      </div>

      <span
        ref={durationTextRef}
        style={{
          fontSize: 'var(--text-caption)',
          color: 'var(--text-sub)',
          minWidth: 40,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        0:00
      </span>
    </div>
  );
};

// ============================================================
// Volume Slider
// ============================================================

interface VolumeSliderProps {
  volume: number;
  muted: boolean;
  onChange: (v: number) => void;
}

const VolumeSlider: FC<VolumeSliderProps> = ({ volume, muted, onChange }) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);
  const displayVolume = muted ? 0 : volume;

  const handleSeek = useCallback(
    (clientX: number) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onChange(fraction);
    },
    [onChange]
  );

  return (
    <div
      ref={barRef}
      role="slider"
      aria-label="Volume"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(displayVolume * 100)}
      aria-valuetext={`${Math.round(displayVolume * 100)}%`}
      tabIndex={0}
      onMouseDown={(e) => {
        handleSeek(e.clientX);
        const handleMove = (ev: MouseEvent) => handleSeek(ev.clientX);
        const handleUp = () => {
          window.removeEventListener('mousemove', handleMove);
          window.removeEventListener('mouseup', handleUp);
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onWheel={(e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        onChange(Math.max(0, Math.min(1, volume + delta)));
      }}
      style={{
        width: 93,
        height: 12,
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: '100%',
          height: 4,
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 2,
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${displayVolume * 100}%`,
            height: '100%',
            background: hovering ? 'var(--accent)' : 'var(--text)',
            borderRadius: 2,
          }}
        />
        {hovering && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: `${displayVolume * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#FFFFFF',
              boxShadow: 'var(--shadow-dropdown)',
            }}
          />
        )}
      </div>
    </div>
  );
};

// ============================================================
// Main PlayerBar Component
// ============================================================

export const PlayerBar: FC = () => {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);

  const togglePlay = useQueueStore((s) => s.togglePlay);
  const next = useQueueStore((s) => s.next);
  const previous = useQueueStore((s) => s.previous);
  const toggleShuffle = useQueueStore((s) => s.toggleShuffle);
  const cycleRepeat = useQueueStore((s) => s.cycleRepeat);
  const seek = useQueueStore((s) => s.seek);

  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const rightPanelMode = useUIStore((s) => s.rightPanelMode);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);

  const track = useLibraryStore((s) =>
    currentTrackId ? s.tracks.get(currentTrackId) : null
  );

  const isLiked = useLikesStore((s) => (currentTrackId ? s.isLiked(currentTrackId) : false));
  const toggleLike = useLikesStore((s) => s.toggleLike);

  const handleLikeToggle = () => {
    if (currentTrackId) {
      void toggleLike(currentTrackId);
    }
  };

  const VolumeIcon =
    muted || volume === 0
      ? SpeakerX
      : volume < 0.3
        ? SpeakerNone
        : volume < 0.7
          ? SpeakerLow
          : SpeakerHigh;

  return (
    <footer
      aria-label="Now Playing bar"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(200px, 30%) 1fr minmax(200px, 30%)',
        alignItems: 'center',
        padding: '0 16px',
        background: 'var(--bg-base)',
        height: '100%',
        userSelect: 'none',
      }}
    >
      {/* Left: Track info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
        {track ? (
          <>
            <Cover
              artworkId={track.artworkId}
              title={track.title}
              size={56}
              style={{ cursor: 'pointer', flexShrink: 0 }}
              onClick={() => toggleRightPanel('now-playing')}
            />
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: 'var(--text-body)',
                  fontWeight: 600,
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  cursor: 'pointer',
                }}
                title={track.title}
                onClick={() => toggleRightPanel('now-playing')}
              >
                {track.title}
              </div>
              <div
                style={{
                  fontSize: 'var(--text-caption)',
                  color: 'var(--text-sub)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={track.artist}
              >
                {track.artist}
              </div>
            </div>
            <button
              onClick={handleLikeToggle}
              aria-label={isLiked ? 'Unlike song' : 'Like song'}
              style={{
                background: 'transparent',
                border: 'none',
                color: isLiked ? 'var(--accent)' : 'var(--text-sub)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                transition: 'transform var(--transition-fast)',
              }}
            >
              <Heart size={18} weight={isLiked ? 'fill' : 'regular'} />
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Cover size={56} />
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
              No song selected
            </div>
          </div>
        )}
      </div>

      {/* Center: Controls + Seek */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          maxWidth: 720,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Shuffle */}
          <button
            className={`icon-btn ${shuffle ? 'active' : ''}`}
            onClick={toggleShuffle}
            aria-label={`Shuffle ${shuffle ? 'on' : 'off'}`}
            style={{
              color: shuffle ? 'var(--accent)' : 'var(--text-sub)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              padding: 4,
            }}
          >
            <Shuffle size={18} weight={shuffle ? 'bold' : 'regular'} />
          </button>

          {/* Previous */}
          <button
            onClick={() => void previous()}
            aria-label="Previous"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-sub)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <SkipBack size={20} weight="fill" />
          </button>

          {/* Play / Pause button */}
          <button
            onClick={() => void togglePlay()}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-pill)',
              background: '#FFFFFF',
              border: 'none',
              color: '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-card)',
              transition: 'transform var(--transition-bounce)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {isPlaying ? (
              <Pause size={18} weight="fill" />
            ) : (
              <Play size={18} weight="fill" style={{ marginLeft: 2 }} />
            )}
          </button>

          {/* Next */}
          <button
            onClick={() => void next(false)}
            aria-label="Next"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-sub)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <SkipForward size={20} weight="fill" />
          </button>

          {/* Repeat */}
          <button
            onClick={cycleRepeat}
            aria-label={`Repeat ${repeat}`}
            style={{
              color: repeat !== 'off' ? 'var(--accent)' : 'var(--text-sub)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              padding: 4,
            }}
          >
            {repeat === 'one' ? (
              <RepeatOnce size={18} weight="bold" />
            ) : (
              <Repeat size={18} weight={repeat === 'all' ? 'bold' : 'regular'} />
            )}
          </button>
        </div>

        {/* Seek Bar */}
        <SeekBar onSeek={seek} />
      </div>

      {/* Right: Volume + extras */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
        {/* Lyrics */}
        <button
          onClick={() => toggleRightPanel('lyrics')}
          aria-label="Lyrics"
          style={{
            background: 'transparent',
            border: 'none',
            color: rightPanelOpen && rightPanelMode === 'lyrics' ? 'var(--accent)' : 'var(--text-sub)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <MicrophoneStage size={18} />
        </button>

        {/* Queue */}
        <button
          onClick={() => toggleRightPanel('queue')}
          aria-label="Queue"
          style={{
            background: 'transparent',
            border: 'none',
            color: rightPanelOpen && rightPanelMode === 'queue' ? 'var(--accent)' : 'var(--text-sub)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <QueueIcon size={18} />
        </button>

        {/* Sleep Timer Popover */}
        <SleepTimerPopover />

        {/* Mute toggle */}
        <button
          onClick={toggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-sub)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <VolumeIcon size={18} />
        </button>

        {/* Volume Slider */}
        <VolumeSlider volume={volume} muted={muted} onChange={setVolume} />

        {/* Equalizer */}
        <button
          onClick={() => toast.info('Equalizer available in Phase 6')}
          aria-label="Equalizer"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-sub)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <Equalizer size={18} />
        </button>

        {/* Fullscreen */}
        <button
          onClick={() => {
            if (!document.fullscreenElement) {
              void document.documentElement.requestFullscreen();
            } else {
              void document.exitFullscreen();
            }
          }}
          aria-label="Full screen"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-sub)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <CornersOut size={18} />
        </button>
      </div>
    </footer>
  );
};
