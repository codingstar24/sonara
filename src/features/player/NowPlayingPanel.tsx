import { type FC, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  DotsThree,
  ArrowRight,
  MusicNotes,
} from '@phosphor-icons/react';
import { db } from '@/db/schema';
import type { Track, TrackStats } from '@/db/types';
import { usePlayerStore, useLibraryStore } from '@/app/stores';
import { useLikesStore } from '@/features/likes/likesStore';
import { useQueueStore } from '@/features/queue/queueStore';
import { Cover } from '@/components/ui/Cover';
import { TrackContextMenu } from '@/components/ui/TrackContextMenu';

export const NowPlayingPanel: FC = () => {
  const navigate = useNavigate();
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const libraryTracks = useLibraryStore((s) => s.tracks);

  const isLiked = useLikesStore((s) => (currentTrackId ? s.isLiked(currentTrackId) : false));
  const toggleLike = useLikesStore((s) => s.toggleLike);

  const [fullTrack, setFullTrack] = useState<Track | null>(null);
  const [trackStats, setTrackStats] = useState<TrackStats | null>(null);
  const [dominantColor, setDominantColor] = useState<string>('rgba(255,255,255,0.05)');

  // Next in queue preview
  const userQueue = useQueueStore((s) => s.userQueue);
  const context = useQueueStore((s) => s.context);
  const nextTrackId =
    userQueue.length > 0
      ? userQueue[0]?.trackId
      : context && context.cursor + 1 < context.playOrder.length
      ? context.playOrder[context.cursor + 1]
      : null;
  const nextTrack = nextTrackId ? libraryTracks.get(nextTrackId) : null;

  useEffect(() => {
    if (!currentTrackId) {
      setFullTrack(null);
      setTrackStats(null);
      setDominantColor('rgba(255,255,255,0.05)');
      return;
    }

    let active = true;

    // Load full Track record
    db.tracks.get(currentTrackId).then((t) => {
      if (active && t) setFullTrack(t);
    });

    // Load track stats
    db.trackStats.get(currentTrackId).then((s) => {
      if (active && s) setTrackStats(s);
    });

    // Load dominant artwork color
    const lite = libraryTracks.get(currentTrackId);
    if (lite?.artworkId) {
      db.artwork.get(lite.artworkId).then((art) => {
        if (active && art?.dominantColor) {
          setDominantColor(art.dominantColor);
        }
      });
    }

    return () => {
      active = false;
    };
  }, [currentTrackId, libraryTracks]);

  if (!currentTrackId || !fullTrack) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          textAlign: 'center',
          color: 'var(--text-sub)',
          padding: '32px 16px',
        }}
      >
        <MusicNotes size={48} style={{ color: 'var(--text-faint)', marginBottom: 16 }} />
        <p style={{ fontWeight: 'var(--font-bold)', color: 'var(--text)' }}>No track playing</p>
        <p style={{ fontSize: 'var(--text-caption)' }}>Select a song to see details</p>
      </div>
    );
  }

  // Calculate artist info
  const artistName = fullTrack.artist.trim();
  let artistTrackCount = 0;
  for (const t of libraryTracks.values()) {
    if (t.artist.trim().toLowerCase() === artistName.toLowerCase()) {
      artistTrackCount++;
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes <= 0) return '—';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatBitrate = (br: number | null) => {
    if (!br) return '—';
    const kbps = br > 1000 ? Math.round(br / 1000) : br;
    return `${kbps} kbps`;
  };

  const formatSampleRate = (sr: number | null) => {
    if (!sr) return '—';
    const khz = (sr / 1000).toFixed(1);
    return `${khz} kHz`;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        position: 'relative',
        background: `linear-gradient(180deg, ${dominantColor}25 0%, transparent 320px)`,
        paddingTop: '8px',
      }}
    >
      {/* 1. Large Square Cover with 8px radius */}
      <div
        style={{
          width: '100%',
          aspectRatio: '1',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
        }}
      >
        <Cover
          artworkId={fullTrack.artworkId}
          title={fullTrack.title}
          size="100%"
          style={{ width: '100%', height: '100%', borderRadius: 8 }}
        />
      </div>

      {/* 2. Track Title, Artist, Heart & Menu */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2
            style={{
              fontSize: '22px',
              fontWeight: 'var(--font-bold)',
              color: 'var(--text)',
              margin: '0 0 4px 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {fullTrack.title}
          </h2>
          <div
            onClick={() => navigate(`/artist/${encodeURIComponent(fullTrack.artist)}`)}
            style={{
              fontSize: '15px',
              color: 'var(--text-sub)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
            className="hover:underline hover:text-white transition-colors"
          >
            {fullTrack.artist}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={() => void toggleLike(fullTrack.id)}
            title={isLiked ? 'Unlike song' : 'Like song'}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isLiked ? 'var(--accent)' : 'var(--text-sub)',
              padding: 6,
            }}
            className="hover:scale-110 transition-transform"
          >
            <Heart size={22} weight={isLiked ? 'fill' : 'regular'} />
          </button>

          <TrackContextMenu track={libraryTracks.get(fullTrack.id) || (fullTrack as any)}>
            <button
              title="More options"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-sub)',
                padding: 6,
              }}
              className="hover:text-white"
            >
              <DotsThree size={24} weight="bold" />
            </button>
          </TrackContextMenu>
        </div>
      </div>

      {/* 3. About the Artist Card */}
      <div
        style={{
          padding: '16px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)', fontWeight: 'var(--font-bold)', textTransform: 'uppercase' }}>
          About the Artist
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 'var(--text-body)', fontWeight: 'var(--font-bold)', color: 'var(--text)' }}>
              {fullTrack.artist}
            </div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
              {artistTrackCount} {artistTrackCount === 1 ? 'song' : 'songs'} in your library
            </div>
          </div>

          <button
            onClick={() => navigate(`/artist/${encodeURIComponent(fullTrack.artist)}`)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--border)',
              backgroundColor: 'transparent',
              color: 'var(--text)',
              fontSize: 'var(--text-caption)',
              fontWeight: 'var(--font-bold)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            className="hover:bg-[var(--bg-elevated)]"
          >
            <span>View</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* 4. Next in Queue Preview Card */}
      {nextTrack && (
        <div
          onClick={() => void useQueueStore.getState().next(false)}
          className="group"
          style={{
            padding: '14px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-card)',
            cursor: 'pointer',
            transition: 'background-color var(--transition-fast)',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--text-sub)', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Next in Queue
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Cover artworkId={nextTrack.artworkId} title={nextTrack.title} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 'var(--font-bold)',
                  fontSize: 'var(--text-body)',
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {nextTrack.title}
              </div>
              <div
                style={{
                  fontSize: 'var(--text-caption)',
                  color: 'var(--text-sub)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {nextTrack.artist}
              </div>
            </div>
            <ArrowRight size={16} color="var(--text-sub)" />
          </div>
        </div>
      )}

      {/* 5. Track Info Card */}
      <div
        style={{
          padding: '16px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          fontSize: 'var(--text-caption)',
        }}
      >
        <div style={{ fontWeight: 'var(--font-bold)', color: 'var(--text-sub)', textTransform: 'uppercase' }}>
          Audio & File Metadata
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <span style={{ color: 'var(--text-sub)' }}>Codec: </span>
            <span style={{ color: 'var(--text)', fontWeight: 'var(--font-bold)', textTransform: 'uppercase' }}>
              {fullTrack.codec || 'MP3'}
            </span>
            {fullTrack.lossless && (
              <span
                style={{
                  marginLeft: 6,
                  padding: '1px 5px',
                  backgroundColor: 'rgba(30,215,96,0.15)',
                  color: 'var(--accent)',
                  fontSize: '10px',
                  borderRadius: 3,
                }}
              >
                LOSSLESS
              </span>
            )}
          </div>
          <div>
            <span style={{ color: 'var(--text-sub)' }}>Bitrate: </span>
            <span style={{ color: 'var(--text)' }}>{formatBitrate(fullTrack.bitrate)}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-sub)' }}>Sample Rate: </span>
            <span style={{ color: 'var(--text)' }}>{formatSampleRate(fullTrack.sampleRate)}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-sub)' }}>File Size: </span>
            <span style={{ color: 'var(--text)' }}>{formatFileSize(fullTrack.size)}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-sub)' }}>Year: </span>
            <span style={{ color: 'var(--text)' }}>{fullTrack.year || '—'}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-sub)' }}>Plays: </span>
            <span style={{ color: 'var(--accent)', fontWeight: 'var(--font-bold)' }}>
              {trackStats?.playCount || 0}
            </span>
          </div>
        </div>

        {fullTrack.genres && fullTrack.genres.length > 0 && (
          <div style={{ marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
            <span style={{ color: 'var(--text-sub)' }}>Genres: </span>
            <span style={{ color: 'var(--text)' }}>{fullTrack.genres.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  );
};
