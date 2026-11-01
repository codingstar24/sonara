import type { FC } from 'react';
import { APP_NAME, getCurrentDaypart, DAYPARTS } from '@/config/app';
import { useSettingsStore } from '../stores';

export const HomePage: FC = () => {
  const daypart = getCurrentDaypart();
  const greeting = DAYPARTS[daypart].greeting;
  const displayName = useSettingsStore((s) => s.displayName);

  return (
    <div className="route-enter" style={{ padding: '24px 32px' }}>
      {/* Greeting */}
      <h1
        style={{
          fontSize: 'clamp(24px, 4vw, 48px)',
          fontWeight: 'var(--font-display)',
          letterSpacing: '-0.02em',
          marginBottom: '24px',
        }}
      >
        {greeting}{displayName ? `, ${displayName}` : ''}
      </h1>

      {/* Quick Picks placeholder */}
      <section style={{ marginBottom: '32px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '8px',
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <QuickPickCard key={i} index={i} />
          ))}
        </div>
      </section>

      {/* Shelves */}
      <Shelf title="Recently added" emptyMessage="Add music to your library to see it here" />
      <Shelf title={DAYPARTS[daypart].shelfTitle} emptyMessage="Play some tracks and we'll start personalizing" />
      <Shelf title="Your most played" emptyMessage="Your most played tracks will appear here" />

      {/* Cold start card */}
      <div
        style={{
          margin: '48px 0',
          padding: '32px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          textAlign: 'center',
          maxWidth: 480,
          marginInline: 'auto',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--accent-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '28px',
          }}
        >
          🎵
        </div>
        <h2
          style={{
            fontSize: 'var(--text-h2)',
            fontWeight: 'var(--font-heading)',
            marginBottom: '8px',
          }}
        >
          Welcome to {APP_NAME}
        </h2>
        <p
          style={{
            color: 'var(--text-sub)',
            fontSize: 'var(--text-body)',
            lineHeight: 'var(--leading-relaxed)',
            marginBottom: '24px',
          }}
        >
          Add your music files or folders to get started. Play a few songs and
          this page will start showing personalized recommendations.
        </p>
        <button
          className="btn-primary"
          style={{ margin: '0 auto' }}
        >
          Add your music
        </button>
      </div>
    </div>
  );
};

// --- Quick Pick Card ---
const QuickPickCard: FC<{ index: number }> = ({ index }) => {
  const colors = [
    'var(--liked-gradient)',
    'linear-gradient(135deg, #1E3A5F, #2D5A8E)',
    'linear-gradient(135deg, #3A1E5F, #5A2D8E)',
    'linear-gradient(135deg, #1E5F3A, #2D8E5A)',
    'linear-gradient(135deg, #5F3A1E, #8E5A2D)',
    'linear-gradient(135deg, #5F1E3A, #8E2D5A)',
    'linear-gradient(135deg, #3A5F1E, #5A8E2D)',
    'linear-gradient(135deg, #1E5F5F, #2D8E8E)',
  ];

  return (
    <button
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0',
        height: 56,
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-thumb)',
        border: 'none',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'background var(--duration-fast) var(--ease)',
        textAlign: 'left',
        color: 'var(--text)',
        fontFamily: 'var(--font-family)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-card)')}
    >
      <div
        style={{
          width: 56,
          height: 56,
          background: colors[index % colors.length],
          flexShrink: 0,
        }}
      />
      <span
        className="truncate"
        style={{
          padding: '0 16px',
          fontSize: 'var(--text-body)',
          fontWeight: 'var(--font-title)',
          flex: 1,
          minWidth: 0,
        }}
      >
        {index === 0 ? 'Liked Songs' : `Playlist ${index}`}
      </span>
    </button>
  );
};

// --- Shelf ---
interface ShelfProps {
  title: string;
  emptyMessage?: string;
}

const Shelf: FC<ShelfProps> = ({ title, emptyMessage }) => {
  return (
    <section style={{ marginBottom: '32px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <h2
          style={{
            fontSize: 'var(--text-h2)',
            fontWeight: 'var(--font-heading)',
            cursor: 'pointer',
          }}
        >
          {title}
        </h2>
        <button
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-sub)',
            fontSize: 'var(--text-caption)',
            fontWeight: 'var(--font-title)',
            fontFamily: 'var(--font-family)',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-header)',
          }}
        >
          Show all
        </button>
      </div>

      {/* Empty state */}
      <div
        style={{
          padding: '32px',
          textAlign: 'center',
          color: 'var(--text-faint)',
          fontSize: 'var(--text-body)',
        }}
      >
        {emptyMessage}
      </div>
    </section>
  );
};
