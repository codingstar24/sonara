import type { FC } from 'react';
import { Heart, Play } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export const LikedPage: FC = () => {
  return (
    <div className="route-enter">
      {/* Hero Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '24px',
          padding: '40px 32px 24px',
          background: 'linear-gradient(180deg, rgba(69, 10, 245, 0.4) 0%, rgba(18, 18, 18, 0) 100%)',
        }}
      >
        {/* Liked songs badge */}
        <div
          style={{
            width: 192,
            height: 192,
            minWidth: 192,
            borderRadius: 'var(--radius-card)',
            background: 'linear-gradient(135deg, #450AF5, #8E8EE5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <Heart size={80} weight="fill" color="#FFFFFF" />
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
            Liked Songs
          </h1>
          <p style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)' }}>
            Your favorite tracks gathered in one place
          </p>
        </div>
      </div>

      {/* Action Row */}
      <div style={{ padding: '0 32px 24px' }}>
        <Button variant="primary" size="lg">
          <Play size={20} weight="fill" /> Play
        </Button>
      </div>

      {/* Content */}
      <div style={{ padding: '0 32px 32px' }}>
        <EmptyState
          icon={<Heart size={48} />}
          title="Songs you like will appear here"
          description="Save songs by tapping the heart icon anywhere in the app."
        />
      </div>
    </div>
  );
};
