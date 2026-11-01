import { type FC, useCallback, useRef, useState } from 'react';
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
  Moon,
  Equalizer,
  CornersOut,
} from '@phosphor-icons/react';
import { usePlayerStore } from './stores';
import { useUIStore } from './stores';

// ============================================================
// Progress/Seek Bar (rAF-driven, does NOT re-render the app)
// ============================================================

interface SeekBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

const SeekBar: FC<SeekBarProps> = ({ currentTime, duration, onSeek }) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hoverX, setHoverX] = useState(0);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const hoverTime = duration > 0 && barRef.current
    ? (hoverX / barRef.current.offsetWidth) * duration
    : 0;

  const handleSeekFromEvent = useCallback(
    (clientX: number) => {
      if (!barRef.current || duration <= 0) return;
      const rect = barRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onSeek(fraction * duration);
    },
    [duration, onSeek]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setDragging(true);
      handleSeekFromEvent(e.clientX);

      const handleMove = (ev: MouseEvent) => {
        handleSeekFromEvent(ev.clientX);
      };
      const handleUp = () => {
        setDragging(false);
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [handleSeekFromEvent]
  );

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
        style={{
          fontSize: 'var(--text-caption)',
          color: 'var(--text-sub)',
          minWidth: 40,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatTime(currentTime)}
      </span>

      <div
        ref={barRef}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={Math.round(currentTime)}
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => {
          setHovering(false);
          setHoverX(0);
        }}
        onMouseMove={(e) => {
          if (barRef.current) {
            const rect = barRef.current.getBoundingClientRect();
            setHoverX(e.clientX - rect.left);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') onSeek(Math.min(duration, currentTime + 5));
          if (e.key === 'ArrowLeft') onSeek(Math.max(0, currentTime - 5));
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
        {/* Track */}
        <div
          style={{
            width: '100%',
            height: hovering || dragging ? 4 : 4,
            background: 'rgba(255,255,255,0.3)',
            borderRadius: 2,
            position: 'relative',
            overflow: 'visible',
          }}
        >
          {/* Fill */}
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: hovering || dragging ? 'var(--accent)' : 'var(--text)',
              borderRadius: 2,
              transition: dragging ? 'none' : 'background var(--duration-fast) var(--ease)',
            }}
          />

          {/* Thumb */}
          {(hovering || dragging) && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: `${progress}%`,
                transform: 'translate(-50%, -50%)',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: 'var(--text)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            />
          )}
        </div>

        {/* Hover time tooltip */}
        {hovering && !dragging && hoverX > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: hoverX,
              transform: 'translateX(-50%)',
              background: 'var(--bg-tooltip)',
              color: 'var(--text)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-thumb)',
              fontSize: 'var(--text-caption)',
              fontVariantNumeric: 'tabular-nums',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {formatTime(hoverTime)}
          </div>
        )}
      </div>

      <span
        style={{
          fontSize: 'var(--text-caption)',
          color: 'var(--text-sub)',
          minWidth: 40,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatTime(duration)}
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
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') onChange(Math.min(1, volume + 0.05));
        if (e.key === 'ArrowLeft') onChange(Math.max(0, volume - 0.05));
      }}
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
          background: 'rgba(255,255,255,0.3)',
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
              background: 'var(--text)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            }}
          />
        )}
      </div>
    </div>
  );
};

// ============================================================
// Player Bar
// ============================================================

export const PlayerBar: FC = () => {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const setPlaying = usePlayerStore((s) => s.setPlaying);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);

  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const rightPanelMode = useUIStore((s) => s.rightPanelMode);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);

  // Mock data for the static shell
  const [currentTime] = useState(0);
  const duration = 0;
  const hasTrack = false;

  const VolumeIcon =
    muted || volume === 0
      ? SpeakerX
      : volume < 0.33
        ? SpeakerNone
        : volume < 0.66
          ? SpeakerLow
          : SpeakerHigh;

  return (
    <footer
      aria-label="Player controls"
      style={{
        height: 'var(--player-bar-height)',
        display: 'grid',
        gridTemplateColumns: '30% 40% 30%',
        alignItems: 'center',
        padding: '0 16px',
        background: 'var(--bg-base)',
      }}
    >
      {/* Left: Track info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minWidth: 0,
        }}
      >
        {/* Cover placeholder */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 'var(--radius-thumb)',
            background: hasTrack ? 'var(--bg-card)' : 'var(--bg-card)',
            flexShrink: 0,
            cursor: 'pointer',
          }}
        />
        {hasTrack ? (
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div
              className="truncate"
              style={{
                fontSize: 'var(--text-body)',
                fontWeight: 'var(--font-medium)',
                cursor: 'pointer',
              }}
            >
              Track Title
            </div>
            <div
              className="truncate"
              style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--text-sub)',
                cursor: 'pointer',
              }}
            >
              Artist Name
            </div>
          </div>
        ) : null}
        <button className="icon-btn" aria-label="Like" style={{ opacity: hasTrack ? 1 : 0.3 }}>
          <Heart size={18} />
        </button>
      </div>

      {/* Center: Controls + Seek */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          maxWidth: 722,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Control buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <button
            className={`icon-btn ${shuffle ? 'active' : ''}`}
            onClick={toggleShuffle}
            aria-label={`Shuffle ${shuffle ? 'on' : 'off'}`}
            style={{ position: 'relative' }}
          >
            <Shuffle size={18} />
            {shuffle && (
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                }}
              />
            )}
          </button>

          <button
            className="icon-btn"
            aria-label="Previous"
            style={{ opacity: hasTrack ? 1 : 0.5 }}
          >
            <SkipBack size={20} weight="fill" />
          </button>

          <button
            onClick={() => setPlaying(!isPlaying)}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--text)',
              border: 'none',
              color: 'var(--bg-base)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform var(--duration-fast) var(--ease)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {isPlaying ? (
              <Pause size={16} weight="fill" />
            ) : (
              <Play size={16} weight="fill" style={{ marginLeft: 1 }} />
            )}
          </button>

          <button
            className="icon-btn"
            aria-label="Next"
            style={{ opacity: hasTrack ? 1 : 0.5 }}
          >
            <SkipForward size={20} weight="fill" />
          </button>

          <button
            className={`icon-btn ${repeat !== 'off' ? 'active' : ''}`}
            onClick={cycleRepeat}
            aria-label={`Repeat ${repeat}`}
            style={{ position: 'relative' }}
          >
            {repeat === 'one' ? <RepeatOnce size={18} /> : <Repeat size={18} />}
            {repeat !== 'off' && (
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                }}
              />
            )}
          </button>
        </div>

        {/* Seek bar */}
        <SeekBar
          currentTime={currentTime}
          duration={duration}
          onSeek={() => {}}
        />
      </div>

      {/* Right: Volume + extras */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '8px',
        }}
      >
        <button
          className={`icon-btn ${rightPanelOpen && rightPanelMode === 'lyrics' ? 'active' : ''}`}
          onClick={() => toggleRightPanel('lyrics')}
          aria-label="Lyrics"
        >
          <MicrophoneStage size={18} />
        </button>

        <button
          className={`icon-btn ${rightPanelOpen && rightPanelMode === 'queue' ? 'active' : ''}`}
          onClick={() => toggleRightPanel('queue')}
          aria-label="Queue"
        >
          <QueueIcon size={18} />
        </button>

        <button
          className="icon-btn"
          aria-label="Sleep timer"
        >
          <Moon size={18} />
        </button>

        <button
          className="icon-btn"
          onClick={toggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          <VolumeIcon size={18} />
        </button>

        <VolumeSlider
          volume={volume}
          muted={muted}
          onChange={(v) => {
            setVolume(v);
            if (muted && v > 0) toggleMute();
          }}
        />

        <button className="icon-btn" aria-label="Equalizer">
          <Equalizer size={18} />
        </button>

        <button className="icon-btn" aria-label="Full screen">
          <CornersOut size={18} />
        </button>
      </div>
    </footer>
  );
};

// ============================================================
// Helpers
// ============================================================

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
