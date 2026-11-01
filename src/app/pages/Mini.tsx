import { type FC, useEffect, useState } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Heart,
  ArrowsInLineVertical,
} from '@phosphor-icons/react';
import { usePlayerStore, useLibraryStore } from '@/app/stores';
import { useLikesStore } from '@/features/likes/likesStore';
import { useQueueStore } from '@/features/queue/queueStore';
import { playbackClock } from '@/engine/clock';
import { Cover } from '@/components/ui/Cover';

export const MiniPlayerPage: FC = () => {
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const libraryTracks = useLibraryStore((s) => s.tracks);

  const track = currentTrackId ? libraryTracks.get(currentTrackId) : null;
  const isLiked = useLikesStore((s) => (currentTrackId ? s.isLiked(currentTrackId) : false));
  const toggleLike = useLikesStore((s) => s.toggleLike);

  const [currentTimeS, setCurrentTimeS] = useState(0);

  useEffect(() => {
    let animId: number;
    const tick = () => {
      setCurrentTimeS(playbackClock.getCurrentTime());
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  const duration = track?.duration || 1;
  const progressPct = Math.min(100, Math.max(0, (currentTimeS / duration) * 100));

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    useQueueStore.getState().seek(pos * duration);
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#121212',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px',
        overflow: 'hidden',
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      {/* Top Bar / Drag Handle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 'var(--font-bold)', color: 'var(--text-sub)', letterSpacing: '0.05em' }}>
          SONARA MINI
        </span>
        <button
          onClick={() => window.history.back()}
          title="Return to Main Player"
          style={{ background: 'transparent', border: 'none', color: 'var(--text-sub)', cursor: 'pointer' }}
          className="hover:text-white"
        >
          <ArrowsInLineVertical size={16} />
        </button>
      </div>

      {/* Main Track Display */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
        <Cover artworkId={track?.artworkId} title={track?.title} size={80} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 'var(--font-bold)',
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: '2px',
            }}
          >
            {track?.title || 'No track playing'}
          </div>
          <div
            style={{
              fontSize: '13px',
              color: 'var(--text-sub)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: '6px',
            }}
          >
            {track?.artist || '—'}
          </div>

          {track && (
            <button
              onClick={() => void toggleLike(track.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: isLiked ? 'var(--accent)' : 'var(--text-sub)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <Heart size={18} weight={isLiked ? 'fill' : 'regular'} />
            </button>
          )}
        </div>
      </div>

      {/* Seek Bar & Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
        {/* Seek Bar */}
        <div
          onClick={handleSeek}
          style={{
            height: 12,
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: '100%',
              height: 4,
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                backgroundColor: 'var(--accent)',
              }}
            />
          </div>
        </div>

        {/* Time and Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-sub)' }}>
            {formatTime(currentTimeS)}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => void useQueueStore.getState().previous()}
              style={{ background: 'transparent', border: 'none', color: '#FFF', cursor: 'pointer' }}
            >
              <SkipBack size={18} weight="fill" />
            </button>

            <button
              onClick={() => void useQueueStore.getState().togglePlay()}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: '#FFF',
                color: '#000',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {isPlaying ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" style={{ marginLeft: 2 }} />}
            </button>

            <button
              onClick={() => void useQueueStore.getState().next(false)}
              style={{ background: 'transparent', border: 'none', color: '#FFF', cursor: 'pointer' }}
            >
              <SkipForward size={18} weight="fill" />
            </button>
          </div>

          <span style={{ fontSize: '11px', color: 'var(--text-sub)' }}>
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
};
