import { type FC, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useLibraryStore, usePlayerStore } from '../stores';
import { useQueueStore } from '@/features/queue/queueStore';
import { Cover } from '@/components/ui/Cover';
import { TrackRow } from '@/components/ui/TrackRow';
import { Button } from '@/components/ui/Button';
import { Play } from '@phosphor-icons/react';

export const ArtistPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const decodedName = id ? decodeURIComponent(id) : '';
  const artist = useLibraryStore((s) => s.artists.get(decodedName));
  const tracksMap = useLibraryStore((s) => s.tracks);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const artistTracks = useMemo(() => {
    if (!artist) return [];
    return artist.trackIds
      .map((tid) => tracksMap.get(tid))
      .filter((t): t is NonNullable<typeof t> => !!t);
  }, [artist, tracksMap]);

  if (!artist) {
    return (
      <div className="route-enter" style={{ padding: '40px 32px' }}>
        <h1 style={{ fontSize: 'var(--text-h2)' }}>Artist not found</h1>
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
          artworkId={artist.artworkId}
          title={artist.name}
          isArtist={true}
          size={232}
          style={{ width: 232, height: 232 }}
        />

        <div>
          <span style={{ fontSize: 'var(--text-caption)', fontWeight: 700, textTransform: 'uppercase' }}>
            Artist
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
            {artist.name}
          </h1>
          <p style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)' }}>
            {artist.trackCount} {artist.trackCount === 1 ? 'song' : 'songs'} in your library
          </p>
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '0 32px 24px' }}>
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            if (artistTracks.length > 0) {
              void useQueueStore
                .getState()
                .playContext(
                  'artist',
                  decodedName,
                  artist.name,
                  artistTracks.map((t) => t.id),
                  artistTracks[0]?.id
                );
            }
          }}
        >
          <Play size={20} weight="fill" /> Play
        </Button>
      </div>

      {/* Popular Tracks */}
      <div style={{ padding: '0 32px 32px' }}>
        <h2 style={{ fontSize: 'var(--text-h2)', marginBottom: '16px' }}>Popular</h2>
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

        {artistTracks.map((t, idx) => {
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
                      'artist',
                      decodedName,
                      artist.name,
                      artistTracks.map((x) => x.id),
                      t.id
                    );
                }
              }}
              onDoubleClick={() => {
                void useQueueStore
                  .getState()
                  .playContext(
                    'artist',
                    decodedName,
                    artist.name,
                    artistTracks.map((x) => x.id),
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
