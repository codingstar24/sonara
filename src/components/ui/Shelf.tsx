import type { FC, ReactNode } from 'react';

export interface ShelfProps {
  title: string;
  subtitle?: string;
  onShowAll?: () => void;
  children: ReactNode;
  emptyMessage?: string;
}

export const Shelf: FC<ShelfProps> = ({
  title,
  subtitle,
  onShowAll,
  children,
  emptyMessage,
}) => {
  return (
    <section style={{ marginBottom: '32px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 'var(--text-h2)',
              fontWeight: 'var(--font-heading)',
              color: 'var(--text)',
              lineHeight: 1.2,
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--text-sub)',
                marginTop: '4px',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {onShowAll && (
          <button
            onClick={onShowAll}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-sub)',
              fontSize: 'var(--text-caption)',
              fontWeight: 700,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              transition: 'color var(--transition-fast)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-sub)')}
          >
            Show all
          </button>
        )}
      </div>

      {/* Grid */}
      {children ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '16px',
          }}
        >
          {children}
        </div>
      ) : emptyMessage ? (
        <div
          style={{
            padding: '24px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-card)',
            color: 'var(--text-sub)',
            fontSize: 'var(--text-body)',
          }}
        >
          {emptyMessage}
        </div>
      ) : null}
    </section>
  );
};
