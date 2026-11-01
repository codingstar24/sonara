import type { FC } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Folder } from '@phosphor-icons/react';

export const FoldersPage: FC = () => {
  return (
    <div className="route-enter" style={{ padding: '24px 32px' }}>
      <h1
        style={{
          fontSize: 'var(--text-h2)',
          fontWeight: 'var(--font-heading)',
          marginBottom: '24px',
        }}
      >
        Folders
      </h1>

      <EmptyState
        icon={<Folder size={48} />}
        title="No folder sources connected"
        description="Add a music directory to browse your local directory structure directly."
      />
    </div>
  );
};
