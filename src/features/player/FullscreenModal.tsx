import { type FC, useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
  RepeatOnce,
  Heart,
  SpeakerHigh,
  SpeakerX,
  CornersIn,
  MicrophoneStage,
  Waveform,
} from '@phosphor-icons/react';
import { db } from '@/db/schema';
import type { Track } from '@/db/types';
import { usePlayerStore, useLibraryStore } from '@/app/stores';
import { useLikesStore } from '@/features/likes/likesStore';
import { useQueueStore } from '@/features/queue/queueStore';
import { playbackClock } from '@/engine/clock';
import { Cover } from '@/components/ui/Cover';
import { LyricsViewer } from '@/features/lyrics/LyricsViewer';
import { Visualizer } from '@/features/audio/Visualizer';

interface FullscreenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FullscreenModal: FC<FullscreenModalProps> = ({ isOpen, onClose }) => {
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);

  const libraryTracks = useLibraryStore((s) => s.tracks);
  const isLiked = useLikesStore((s) => (currentTrackId ? s.isLiked(currentTrackId) : false));
  const toggleLike = useLikesStore((s) => s.toggleLike);

  const [fullTrack, setFullTrack] = useState<Track | null>(null);
  const [dominantColor, setDominantColor] = useState<string>('#121212');
  const [artworkBlobUrl, setArtworkBlobUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'lyrics' | 'visualizer'>('lyrics');

  // Idle mouse auto-hide controls
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const inactivityTimerRef = useRef<number | null>(null);

  // Seek bar state
  const [currentTimeS, setCurrentTimeS] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  // 1. Esc hotkey listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 2. Mouse inactivity auto-hide
  const resetInactivityTimer = () => {
    setIsControlsVisible(true);
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = window.setTimeout(() => {
      setIsControlsVisible(false);
    }, 3000);
  };

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('mousemove', resetInactivityTimer);
    resetInactivityTimer();

    return () => {
      window.removeEventListener('mousemove', resetInactivityTimer);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [isOpen]);

  // 3. Load full track & artwork
  useEffect(() => {
    if (!currentTrackId) {
      setFullTrack(null);
      setArtworkBlobUrl(null);
      return;
    }

    let active = true;
    db.tracks.get(currentTrackId).then((t) => {
      if (active && t) setFullTrack(t);
    });

    const lite = libraryTracks.get(currentTrackId);
    if (lite?.artworkId) {
      db.artwork.get(lite.artworkId).then((art) => {
        if (!active) return;
        if (art?.dominantColor) setDominantColor(art.dominantColor);
        if (art?.full) setArtworkBlobUrl(URL.createObjectURL(art.full));
      });
    }

    return () => {
      active = false;
      if (artworkBlobUrl) URL.revokeObjectURL(artworkBlobUrl);
    };
  }, [currentTrackId, libraryTracks]);

  // 4. Clock progress subscription
  useEffect(() => {
    let animId: number;

    const tick = () => {
      if (!isDragging) {
        setCurrentTimeS(playbackClock.getCurrentTime());
      }
      animId = requestAnimationFrame(tick);
    };

    if (isOpen) {
      animId = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(animId);
  }, [isOpen, isDragging]);

  if (!isOpen) return null;

  const duration = fullTrack?.duration || 1;
  const currentFraction = isDragging ? dragProgress : currentTimeS / duration;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeekMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setIsDragging(true);
    setDragProgress(pos);

    const onMouseMove = (moveEv: MouseEvent) => {
      const p = Math.max(0, Math.min(1, (moveEv.clientX - rect.left) / rect.width));
      setDragProgress(p);
    };

    const onMouseUp = (upEv: MouseEvent) => {
      const finalP = Math.max(0, Math.min(1, (upEv.clientX - rect.left) / rect.width));
      setIsDragging(false);
      useQueueStore.getState().seek(finalP * duration);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: '#000',
        overflow: 'hidden',
        cursor: isControlsVisible ? 'default' : 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Blurred Ambient Background with slow drift */}
      <div
        style={{
          position: 'absolute',
          inset: -60,
          backgroundImage: artworkBlobUrl ? `url(${artworkBlobUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: dominantColor,
          filter: 'blur(90px) brightness(0.28)',
          transform: 'scale(1.2)',
          transition: 'all 1s ease',
          zIndex: 1,
        }}
      />

      {/* Top Header / View Mode Switcher */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 40px',
          opacity: isControlsVisible ? 1 : 0,
          transition: 'opacity 0.4s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setViewMode('lyrics')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: viewMode === 'lyrics' ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: viewMode === 'lyrics' ? '#FFF' : 'rgba(255,255,255,0.6)',
              fontWeight: 'var(--font-bold)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <MicrophoneStage size={18} />
            <span>Lyrics</span>
          </button>

          <button
            onClick={() => setViewMode('visualizer')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: viewMode === 'visualizer' ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: viewMode === 'visualizer' ? '#FFF' : 'rgba(255,255,255,0.6)',
              fontWeight: 'var(--font-bold)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Waveform size={18} />
            <span>Visualizer</span>
          </button>
        </div>

        <button
          onClick={onClose}
          title="Exit Fullscreen (Esc)"
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(8px)',
            border: 'none',
            color: '#FFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          className="hover:scale-110 transition-transform"
        >
          <CornersIn size={20} />
        </button>
      </div>

      {/* Main Content Area (Left: Cover & Info, Right: Lyrics or Visualizer) */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '48px',
          padding: '0 64px 32px 64px',
          alignItems: 'center',
          minHeight: 0,
        }}
      >
        {/* Left Side: Artwork & Track Details */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            maxWidth: 480,
            margin: '0 auto',
            width: '100%',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              aspectRatio: '1',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
              marginBottom: '28px',
            }}
          >
            <Cover
              artworkId={fullTrack?.artworkId}
              title={fullTrack?.title}
              size="100%"
              style={{ width: '100%', height: '100%', borderRadius: 12 }}
            />
          </div>

          <div style={{ width: '100%', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h1
                  style={{
                    fontSize: 'clamp(24px, 3vw, 36px)',
                    fontWeight: 800,
                    color: '#FFF',
                    margin: '0 0 6px 0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fullTrack?.title || 'No track playing'}
                </h1>
                <div
                  style={{
                    fontSize: '18px',
                    color: 'rgba(255,255,255,0.7)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fullTrack?.artist} · {fullTrack?.album}
                </div>
              </div>

              {fullTrack && (
                <button
                  onClick={() => void toggleLike(fullTrack.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: isLiked ? 'var(--accent)' : 'rgba(255,255,255,0.6)',
                    padding: 8,
                  }}
                  className="hover:scale-115 transition-transform"
                >
                  <Heart size={28} weight={isLiked ? 'fill' : 'regular'} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Synced Lyrics OR Audio Visualizer */}
        <div
          style={{
            height: '100%',
            maxHeight: 560,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {viewMode === 'lyrics' ? (
            <LyricsViewer fontSize="large" />
          ) : (
            <div style={{ width: '100%', height: 320, display: 'flex', alignItems: 'center' }}>
              <Visualizer barCount={64} style={{ height: 260 }} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Floating Controls Bar */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '24px 64px 36px',
          opacity: isControlsVisible ? 1 : 0,
          transition: 'opacity 0.4s ease',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
        }}
      >
        {/* Seek Bar Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', width: 44, textAlign: 'right' }}>
            {formatTime(currentTimeS)}
          </span>

          <div
            onMouseDown={handleSeekMouseDown}
            style={{
              flex: 1,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              position: 'relative',
            }}
            className="group"
          >
            <div
              style={{
                width: '100%',
                height: 5,
                borderRadius: 3,
                backgroundColor: 'rgba(255,255,255,0.2)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${currentFraction * 100}%`,
                  height: '100%',
                  backgroundColor: 'var(--accent)',
                  borderRadius: 3,
                }}
              />
            </div>
          </div>

          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', width: 44 }}>
            {formatTime(duration)}
          </span>
        </div>

        {/* Central Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Left spacing dummy */}
          <div style={{ width: 160 }} />

          {/* Central play buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <button
              onClick={() => useQueueStore.getState().toggleShuffle()}
              title="Shuffle"
              style={{
                background: 'transparent',
                border: 'none',
                color: shuffle ? 'var(--accent)' : 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
              }}
              className="hover:scale-110 transition-transform"
            >
              <Shuffle size={22} />
            </button>

            <button
              onClick={() => void useQueueStore.getState().previous()}
              title="Previous"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#FFF',
                cursor: 'pointer',
              }}
              className="hover:scale-110 transition-transform"
            >
              <SkipBack size={26} weight="fill" />
            </button>

            <button
              onClick={() => void useQueueStore.getState().togglePlay()}
              title={isPlaying ? 'Pause' : 'Play'}
              style={{
                width: 58,
                height: 58,
                borderRadius: '50%',
                backgroundColor: '#FFF',
                color: '#000',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}
              className="hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause size={28} weight="fill" /> : <Play size={28} weight="fill" style={{ marginLeft: 3 }} />}
            </button>

            <button
              onClick={() => void useQueueStore.getState().next(false)}
              title="Next"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#FFF',
                cursor: 'pointer',
              }}
              className="hover:scale-110 transition-transform"
            >
              <SkipForward size={26} weight="fill" />
            </button>

            <button
              onClick={() => useQueueStore.getState().cycleRepeat()}
              title={`Repeat: ${repeat}`}
              style={{
                background: 'transparent',
                border: 'none',
                color: repeat !== 'off' ? 'var(--accent)' : 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
              }}
              className="hover:scale-110 transition-transform"
            >
              {repeat === 'one' ? <RepeatOnce size={22} /> : <Repeat size={22} />}
            </button>
          </div>

          {/* Right Volume Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: 160, justifyContent: 'flex-end' }}>
            <button
              onClick={toggleMute}
              style={{ background: 'transparent', border: 'none', color: '#FFF', cursor: 'pointer' }}
            >
              {muted || volume === 0 ? <SpeakerX size={20} /> : <SpeakerHigh size={20} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => usePlayerStore.getState().setVolume(parseFloat(e.target.value))}
              style={{ width: 100, accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
