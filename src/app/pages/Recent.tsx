import type { FC } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ClockCounterClockwise } from '@phosphor-icons/react';

export const RecentPage: FC = () => {
  return (
    <div className="route-enter" style={{ padding: '24px 32px' }}>
      <h1
        style={{
          fontSize: 'var(--text-h2)',
          fontWeight: 'var(--font-heading)',
          marginBottom: '24px',
        }}
      >
        Recently Played
      </h1>

      <EmptyState
        icon={<ClockCounterClockwise size={48} />}
        title="No listening history yet"
        description="Tracks and playlists you listen to will be recorded here for quick access."
      />
    </div>
  );
};
