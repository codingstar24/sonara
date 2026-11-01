import { type FC, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibraryStore } from '../stores';
import { MediaCard } from '@/components/ui/MediaCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Disc } from '@phosphor-icons/react';

export const AlbumsPage: FC = () => {
  const navigate = useNavigate();
  const albumsMap = useLibraryStore((s) => s.albums);
  const albums = useMemo(() => Array.from(albumsMap.values()), [albumsMap]);

  return (
    <div className="route-enter" style={{ padding: '24px 32px' }}>
      <h1
        style={{
          fontSize: 'var(--text-h2)',
          fontWeight: 'var(--font-heading)',
          marginBottom: '24px',
        }}
      >
        Albums
      </h1>

      {albums.length === 0 ? (
        <EmptyState
          icon={<Disc size={48} />}
          title="No albums found"
          description="Albums will automatically appear when you import music with album metadata."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '16px',
          }}
        >
          {albums.map((album) => (
            <MediaCard
              key={album.key}
              title={album.album}
              subtitle={`${album.albumArtist}${album.year ? ` • ${album.year}` : ''}`}
              artworkId={album.artworkId}
              onClick={() => navigate(`/album/${encodeURIComponent(album.key)}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
