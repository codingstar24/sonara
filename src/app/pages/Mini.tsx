import type { FC } from 'react';
import { Play, SkipBack, SkipForward, Heart } from '@phosphor-icons/react';
import { Cover } from '@/components/ui/Cover';

export const MiniPlayerPage: FC = () => {
  return (
    <div
      style={{
        width: 360,
        height: '100vh',
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        boxSizing: 'border-box',
        justifyContent: 'space-between',
        userSelect: 'none',
      }}
    >
      {/* Cover */}
      <div style={{ width: '100%', aspectRatio: '1 / 1', marginBottom: '16px' }}>
        <Cover size="100%" style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Info & Like */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: 'var(--text-title)', fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            No track playing
          </div>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
            Sonara
          </div>
        </div>
        <button style={{ background: 'transparent', border: 'none', color: 'var(--text-sub)', cursor: 'pointer' }}>
          <Heart size={20} />
        </button>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', margin: '20px 0' }}>
        <button style={{ background: 'transparent', border: 'none', color: 'var(--text-sub)', cursor: 'pointer' }}>
          <SkipBack size={24} weight="fill" />
        </button>
        <button
          style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-pill)',
            background: 'var(--accent)',
            color: 'var(--text-on-accent)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Play size={22} weight="fill" style={{ marginLeft: 2 }} />
        </button>
        <button style={{ background: 'transparent', border: 'none', color: 'var(--text-sub)', cursor: 'pointer' }}>
          <SkipForward size={24} weight="fill" />
        </button>
      </div>

      {/* Progress */}
      <div style={{ width: '100%', height: 4, backgroundColor: 'var(--bg-card-hover)', borderRadius: 2 }}>
        <div style={{ width: '0%', height: '100%', backgroundColor: 'var(--accent)', borderRadius: 2 }} />
      </div>
    </div>
  );
};
