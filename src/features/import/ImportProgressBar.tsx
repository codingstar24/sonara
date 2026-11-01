import type { FC } from 'react';
import { useImportStore } from './useImportStore';
import { importPipeline } from './importPipeline';
import { X, SpinnerGap } from '@phosphor-icons/react';

export const ImportProgressBar: FC = () => {
  const active = useImportStore((s) => s.active);
  const currentFilename = useImportStore((s) => s.currentFilename);
  const processedCount = useImportStore((s) => s.processedCount);
  const cancelRequested = useImportStore((s) => s.cancelRequested);

  if (!active) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '96px',
        right: '24px',
        backgroundColor: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-card)',
        padding: '16px 20px',
        boxShadow: 'var(--shadow-dropdown)',
        zIndex: 900,
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        maxWidth: 420,
        border: '1px solid var(--border-subtle)',
        animation: 'slideUp 200ms ease-out',
      }}
    >
      <SpinnerGap
        size={24}
        color="var(--accent)"
        style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
      />

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
          {cancelRequested ? 'Cancelling import...' : `Scanning... ${processedCount.toLocaleString()} songs`}
        </div>
        <div
          style={{
            fontSize: 'var(--text-caption)',
            color: 'var(--text-sub)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={currentFilename}
        >
          {currentFilename}
        </div>
      </div>

      {!cancelRequested && (
        <button
          onClick={() => importPipeline.cancel()}
          title="Cancel scanning"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-sub)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-pill)',
          }}
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
};
