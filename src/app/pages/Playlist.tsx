import type { FC } from 'react';
import { useParams } from 'react-router-dom';
import { Playlist as PlaylistIcon, Play } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export const PlaylistPage: FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="route-enter">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '24px',
          padding: '40px 32px 24px',
          background: 'linear-gradient(180deg, rgba(80, 56, 160, 0.3) 0%, rgba(18, 18, 18, 0) 100%)',
        }}
      >
        <div
          style={{
            width: 192,
            height: 192,
            minWidth: 192,
            borderRadius: 'var(--radius-card)',
            background: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-card)',
            color: 'var(--text-sub)',
          }}
        >
          <PlaylistIcon size={64} />
        </div>

        <div>
          <span style={{ fontSize: 'var(--text-caption)', fontWeight: 700, textTransform: 'uppercase' }}>
            Playlist
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
            Playlist #{id ?? '1'}
          </h1>
          <p style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)' }}>
            Custom playlist • 0 songs
          </p>
        </div>
      </div>

      <div style={{ padding: '0 32px 24px' }}>
        <Button variant="primary" size="lg">
          <Play size={20} weight="fill" /> Play
        </Button>
      </div>

      <div style={{ padding: '0 32px 32px' }}>
        <EmptyState
          icon={<PlaylistIcon size={48} />}
          title="This playlist is empty"
          description="Find more songs to add by browsing your library or searching."
        />
      </div>
    </div>
  );
};
