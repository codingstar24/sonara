import type { FC } from 'react';

export const SearchPage: FC = () => {
  return (
    <div className="route-enter" style={{ padding: '24px 32px' }}>
      <h1
        style={{
          fontSize: 'var(--text-h2)',
          fontWeight: 'var(--font-heading)',
          marginBottom: '24px',
        }}
      >
        Search
      </h1>

      {/* Browse all grid */}
      <section>
        <h2
          style={{
            fontSize: 'var(--text-title)',
            fontWeight: 'var(--font-heading)',
            marginBottom: '16px',
          }}
        >
          Browse all
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '16px',
          }}
        >
          {[
            { name: 'Recently Added', color: '#E13300' },
            { name: 'Most Played', color: '#1E3264' },
            { name: 'Liked Songs', color: '#5038A0' },
            { name: 'Folders', color: '#477D95' },
            { name: 'Rock', color: '#E61E32' },
            { name: 'Pop', color: '#148A08' },
            { name: 'Electronic', color: '#B02897' },
            { name: 'Hip-Hop', color: '#BA5D07' },
            { name: 'Jazz', color: '#1E3264' },
            { name: 'Classical', color: '#503750' },
          ].map((tile) => (
            <button
              key={tile.name}
              style={{
                height: 100,
                borderRadius: 'var(--radius-card)',
                background: tile.color,
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                textAlign: 'left',
                padding: '16px',
                fontFamily: 'var(--font-family)',
                color: 'var(--text)',
                fontSize: 'var(--text-title)',
                fontWeight: 'var(--font-heading)',
                transition: 'transform var(--duration-fast) var(--ease)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {tile.name}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
