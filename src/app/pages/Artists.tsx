import { type FC, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibraryStore } from '../stores';
import { MediaCard } from '@/components/ui/MediaCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Users } from '@phosphor-icons/react';

export const ArtistsPage: FC = () => {
  const navigate = useNavigate();
  const artistsMap = useLibraryStore((s) => s.artists);
  const artists = useMemo(() => Array.from(artistsMap.values()), [artistsMap]);

  return (
    <div className="route-enter" style={{ padding: '24px 32px' }}>
      <h1
        style={{
          fontSize: 'var(--text-h2)',
          fontWeight: 'var(--font-heading)',
          marginBottom: '24px',
        }}
      >
        Artists
      </h1>

      {artists.length === 0 ? (
        <EmptyState
          icon={<Users size={48} />}
          title="No artists found"
          description="Artists will appear here once you scan music folders."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '16px',
          }}
        >
          {artists.map((artist) => (
            <MediaCard
              key={artist.name}
              title={artist.name}
              subtitle="Artist"
              isArtist={true}
              artworkId={artist.artworkId}
              onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
