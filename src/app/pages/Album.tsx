import { type FC, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useLibraryStore, usePlayerStore } from '../stores';
import { useQueueStore } from '@/features/queue/queueStore';
import { Cover } from '@/components/ui/Cover';
import { TrackRow } from '@/components/ui/TrackRow';
import { Button } from '@/components/ui/Button';
import { Play } from '@phosphor-icons/react';

export const AlbumPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const decodedKey = id ? decodeURIComponent(id) : '';
  const album = useLibraryStore((s) => s.albums.get(decodedKey));
  const tracksMap = useLibraryStore((s) => s.tracks);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const albumTracks = useMemo(() => {
    if (!album) return [];
    return album.trackIds
      .map((tid) => tracksMap.get(tid))
      .filter((t): t is NonNullable<typeof t> => !!t)
      .sort((a, b) => (a.trackNo ?? 0) - (b.trackNo ?? 0));
  }, [album, tracksMap]);

  if (!album) {
    return (
      <div className="route-enter" style={{ padding: '40px 32px' }}>
        <h1 style={{ fontSize: 'var(--text-h2)' }}>Album not found</h1>
      </div>
    );
  }

  return (
    <div className="route-enter">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '24px',
          padding: '40px 32px 24px',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(18, 18, 18, 0) 100%)',
        }}
      >
        <Cover
          artworkId={album.artworkId}
          title={album.album}
          size={232}
          style={{ width: 232, height: 232 }}
        />

        <div>
          <span style={{ fontSize: 'var(--text-caption)', fontWeight: 700, textTransform: 'uppercase' }}>
            Album
          </span>
          <h1
            style={{
              fontSize: 'clamp(32px, 5vw, 64px)',
              fontWeight: 'var(--font-display)',
              letterSpacing: '-0.03em',
              margin: '8px 0',
              lineHeight: 1,
            }}
          >
            {album.album}
          </h1>
          <p style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)' }}>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{album.albumArtist}</span>
            {album.year ? ` • ${album.year}` : ''} • {album.trackCount} {album.trackCount === 1 ? 'song' : 'songs'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '0 32px 24px' }}>
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            if (albumTracks.length > 0) {
              void useQueueStore
                .getState()
                .playContext(
                  'album',
                  decodedKey,
                  album.album,
                  albumTracks.map((t) => t.id),
                  albumTracks[0]?.id
                );
            }
          }}
        >
          <Play size={20} weight="fill" /> Play
        </Button>
      </div>

      {/* Tracklist */}
      <div style={{ padding: '0 32px 32px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '40px minmax(200px, 4fr) minmax(120px, 2fr) 100px 40px',
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

        {albumTracks.map((t, idx) => {
          const isCurrent = t.id === currentTrackId;
          return (
            <TrackRow
              key={t.id}
              track={t}
              index={idx}
              isCurrent={isCurrent}
              isPlaying={isCurrent && isPlaying}
              onPlay={() => {
                if (isCurrent) {
                  void useQueueStore.getState().togglePlay();
                } else {
                  void useQueueStore
                    .getState()
                    .playContext(
                      'album',
                      decodedKey,
                      album.album,
                      albumTracks.map((x) => x.id),
                      t.id
                    );
                }
              }}
              onDoubleClick={() => {
                void useQueueStore
                  .getState()
                  .playContext(
                    'album',
                    decodedKey,
                    album.album,
                    albumTracks.map((x) => x.id),
                    t.id
                  );
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
