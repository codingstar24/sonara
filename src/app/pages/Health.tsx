import type { FC } from 'react';
import { FirstAid, Copy, WarningCircle, ImageSquare } from '@phosphor-icons/react';

export const HealthPage: FC = () => {
  return (
    <div className="route-enter" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <FirstAid size={32} color="var(--accent)" />
        <h1
          style={{
            fontSize: 'var(--text-display)',
            fontWeight: 'var(--font-display)',
            letterSpacing: '-0.03em',
          }}
        >
          Library Health
        </h1>
      </div>
      <p style={{ color: 'var(--text-sub)', marginBottom: '32px' }}>
        Detect duplicates, missing files, broken tags, and uncompressed tracks
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {[
          { icon: <Copy size={24} />, title: 'Duplicates', count: '0 detected', desc: 'Identical fingerprints' },
          { icon: <WarningCircle size={24} />, title: 'Missing Files', count: '0 missing', desc: 'Files moved or deleted' },
          { icon: <ImageSquare size={24} />, title: 'Missing Artwork', count: '0 tracks', desc: 'No embedded or folder cover' },
        ].map((card) => (
          <div
            key={card.title}
            style={{
              padding: '20px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-card)',
            }}
          >
            <div style={{ color: 'var(--text-sub)', marginBottom: '12px' }}>{card.icon}</div>
            <h3 style={{ fontSize: 'var(--text-title)', fontWeight: 600, marginBottom: '4px' }}>
              {card.title}
            </h3>
            <div style={{ fontSize: 'var(--text-body)', color: 'var(--accent)', fontWeight: 700 }}>
              {card.count}
            </div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)', marginTop: '4px' }}>
              {card.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
