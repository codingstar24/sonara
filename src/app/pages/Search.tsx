import { type FC, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLibraryStore, usePlayerStore } from '../stores';
import { useQueueStore } from '@/features/queue/queueStore';
import { searchEngine } from '@/features/search/searchIndex';
import { TrackRow } from '@/components/ui/TrackRow';
import { MediaCard } from '@/components/ui/MediaCard';
import { Cover } from '@/components/ui/Cover';
import { Play } from '@phosphor-icons/react';
import { EmptyState } from '@/components/ui/EmptyState';

export const SearchPage: FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q')?.trim() ?? '';
  const [filterType, setFilterType] = useState<'all' | 'songs' | 'artists' | 'albums'>('all');

  const tracksMap = useLibraryStore((s) => s.tracks);
  const albumsMap = useLibraryStore((s) => s.albums);
  const artistsMap = useLibraryStore((s) => s.artists);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  // Sync search engine index if needed
  useMemo(() => {
    const tracks = Array.from(tracksMap.values());
    const albums = Array.from(albumsMap.values());
    const artists = Array.from(artistsMap.values());
    searchEngine.indexLibrary(tracks, albums, artists, []);
  }, [tracksMap, albumsMap, artistsMap]);

  // Execute search
  const results = useMemo(() => {
    if (!query) return null;
    return searchEngine.search(query);
  }, [query]);

  // Categorize results
  const matchingTracks = useMemo(() => {
    if (!results) return [];
    return results
      .filter((r) => r.type === 'track')
      .map((r) => tracksMap.get(r.id.replace('track:', '')))
      .filter((t): t is NonNullable<typeof t> => !!t);
  }, [results, tracksMap]);

  const matchingAlbums = useMemo(() => {
    if (!results) return [];
    return results
      .filter((r) => r.type === 'album')
      .map((r) => albumsMap.get(r.id.replace('album:', '')))
      .filter((a): a is NonNullable<typeof a> => !!a);
  }, [results, albumsMap]);

  const matchingArtists = useMemo(() => {
    if (!results) return [];
    return results
      .filter((r) => r.type === 'artist')
      .map((r) => artistsMap.get(r.id.replace('artist:', '')))
      .filter((a): a is NonNullable<typeof a> => !!a);
  }, [results, artistsMap]);

  const topResult = matchingTracks[0] || matchingArtists[0] || matchingAlbums[0];

  // If no query, render Browse All
  if (!query) {
    return (
      <div className="route-enter" style={{ padding: '24px 32px' }}>
        <h1
          style={{
            fontSize: 'var(--text-h2)',
            fontWeight: 'var(--font-heading)',
            marginBottom: '24px',
          }}
        >
          Browse all
        </h1>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '16px',
          }}
        >
          {[
            { name: 'Recently Added', color: '#E13300', path: '/recent' },
            { name: 'Liked Songs', color: '#5038A0', path: '/liked' },
            { name: 'Songs', color: '#1E3264', path: '/songs' },
            { name: 'Albums', color: '#477D95', path: '/albums' },
            { name: 'Artists', color: '#8B5CF6', path: '/artists' },
            { name: 'Folders', color: '#148A08', path: '/folders' },
            { name: 'Rock', color: '#E61E32', path: '/songs' },
            { name: 'Pop', color: '#1DB954', path: '/songs' },
            { name: 'Electronic', color: '#B02897', path: '/songs' },
            { name: 'Hip-Hop', color: '#BA5D07', path: '/songs' },
            { name: 'Jazz', color: '#1E3264', path: '/songs' },
            { name: 'Classical', color: '#503750', path: '/songs' },
          ].map((tile) => (
            <button
              key={tile.name}
              onClick={() => navigate(tile.path)}
              style={{
                height: 110,
                borderRadius: 'var(--radius-card)',
                background: tile.color,
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                textAlign: 'left',
                padding: '16px',
                fontFamily: 'var(--font-family)',
                color: '#FFFFFF',
                fontSize: 'var(--text-title)',
                fontWeight: 700,
                boxShadow: 'var(--shadow-card)',
                transition: 'transform var(--transition-fast)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {tile.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // If query returned no results
  if (matchingTracks.length === 0 && matchingAlbums.length === 0 && matchingArtists.length === 0) {
    return (
      <div className="route-enter" style={{ padding: '48px 32px' }}>
        <EmptyState
          title={`No results found for "${query}"`}
          description="Please check your spelling or try searching for another artist, song, or album."
        />
      </div>
    );
  }

  return (
    <div className="route-enter" style={{ padding: '24px 32px' }}>
      {/* Filter chips */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {(['all', 'songs', 'artists', 'albums'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              background: filterType === type ? 'var(--text)' : 'var(--bg-card)',
              color: filterType === type ? 'var(--bg-base)' : 'var(--text)',
              border: 'none',
              fontWeight: 600,
              fontSize: 'var(--text-caption)',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Top Result + Songs split */}
      {filterType === 'all' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 1.2fr) minmax(320px, 2fr)',
            gap: '24px',
            marginBottom: '40px',
          }}
        >
          {/* Top Result Card */}
          {topResult && (
            <div>
              <h2 style={{ fontSize: 'var(--text-h2)', fontWeight: 700, marginBottom: '16px' }}>
                Top result
              </h2>
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: '24px',
                  borderRadius: 'var(--radius-card)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  cursor: 'pointer',
                  transition: 'background-color var(--transition-fast)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card)')}
              >
                {'title' in topResult ? (
                  <Cover artworkId={topResult.artworkId} title={topResult.title} size={92} />
                ) : 'name' in topResult ? (
                  <Cover isArtist={true} artworkId={topResult.artworkId} title={topResult.name} size={92} />
                ) : (
                  <Cover artworkId={topResult.artworkId} title={topResult.album} size={92} />
                )}

                <div>
                  <div style={{ fontSize: 'var(--text-h2)', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
                    {'title' in topResult ? topResult.title : 'name' in topResult ? topResult.name : topResult.album}
                  </div>
                  <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-sub)' }}>
                    {'title' in topResult ? (
                      <>Song • {topResult.artist}</>
                    ) : 'name' in topResult ? (
                      <>Artist</>
                    ) : (
                      <>Album • {topResult.albumArtist}</>
                    )}
                  </div>
                </div>

                <button
                  aria-label="Play top result"
                  onClick={(e) => {
                    e.stopPropagation();
                    if ('title' in topResult) {
                      void useQueueStore.getState().playNow(topResult.id, 'search', 'search', 'Search');
                    } else if ('name' in topResult) {
                      void useQueueStore.getState().playContext('artist', topResult.name, topResult.name, topResult.trackIds);
                    } else {
                      void useQueueStore.getState().playContext('album', topResult.key, topResult.album, topResult.trackIds);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    bottom: '24px',
                    right: '24px',
                    width: 48,
                    height: 48,
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: 'var(--accent)',
                    color: 'var(--text-on-accent)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'var(--shadow-card)',
                    cursor: 'pointer',
                  }}
                >
                  <Play size={22} weight="fill" style={{ marginLeft: 2 }} />
                </button>
              </div>
            </div>
          )}

          {/* Songs Preview */}
          {matchingTracks.length > 0 && (
            <div>
              <h2 style={{ fontSize: 'var(--text-h2)', fontWeight: 700, marginBottom: '16px' }}>
                Songs
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {matchingTracks.slice(0, 4).map((t, idx) => {
                  const isCurrent = t.id === currentTrackId;
                  return (
                    <TrackRow
                      key={t.id}
                      track={t}
                      index={idx}
                      compact={true}
                      isCurrent={isCurrent}
                      isPlaying={isCurrent && isPlaying}
                      onPlay={() => {
                        if (isCurrent) {
                          void useQueueStore.getState().togglePlay();
                        } else {
                          void useQueueStore
                            .getState()
                            .playContext(
                              'search',
                              'search',
                              `Search "${query}"`,
                              matchingTracks.map((x) => x.id),
                              t.id
                            );
                        }
                      }}
                      onDoubleClick={() => {
                        void useQueueStore
                          .getState()
                          .playContext(
                            'search',
                            'search',
                            `Search "${query}"`,
                            matchingTracks.map((x) => x.id),
                            t.id
                          );
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Artists section */}
      {(filterType === 'all' || filterType === 'artists') && matchingArtists.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: 'var(--text-h2)', fontWeight: 700, marginBottom: '16px' }}>
            Artists
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '16px',
            }}
          >
            {matchingArtists.slice(0, 6).map((art) => (
              <MediaCard
                key={art.name}
                title={art.name}
                subtitle="Artist"
                isArtist={true}
                artworkId={art.artworkId}
                onClick={() => navigate(`/artist/${encodeURIComponent(art.name)}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Albums section */}
      {(filterType === 'all' || filterType === 'albums') && matchingAlbums.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: 'var(--text-h2)', fontWeight: 700, marginBottom: '16px' }}>
            Albums
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '16px',
            }}
          >
            {matchingAlbums.slice(0, 6).map((alb) => (
              <MediaCard
                key={alb.key}
                title={alb.album}
                subtitle={`${alb.albumArtist}${alb.year ? ` • ${alb.year}` : ''}`}
                artworkId={alb.artworkId}
                onClick={() => navigate(`/album/${encodeURIComponent(alb.key)}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* All matching tracks if Songs filter active */}
      {filterType === 'songs' && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {matchingTracks.map((t, idx) => {
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
                        'search',
                        'search',
                        `Search "${query}"`,
                        matchingTracks.map((x) => x.id),
                        t.id
                      );
                  }
                }}
                onDoubleClick={() => {
                  void useQueueStore
                    .getState()
                    .playContext(
                      'search',
                      'search',
                      `Search "${query}"`,
                      matchingTracks.map((x) => x.id),
                      t.id
                    );
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
