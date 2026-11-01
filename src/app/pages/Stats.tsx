import type { FC } from 'react';
import { ChartBar, Clock, Fire, Trophy } from '@phosphor-icons/react';

export const StatsPage: FC = () => {
  return (
    <div className="route-enter" style={{ padding: '24px 32px' }}>
      <h1
        style={{
          fontSize: 'var(--text-display)',
          fontWeight: 'var(--font-display)',
          letterSpacing: '-0.03em',
          marginBottom: '24px',
        }}
      >
        Your Listening
      </h1>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {[
          { icon: <Clock size={28} color="var(--accent)" />, label: 'Listening Time', value: '0 hrs' },
          { icon: <ChartBar size={28} color="#3D91F4" />, label: 'Total Plays', value: '0' },
          { icon: <Fire size={28} color="#FF6437" />, label: 'Current Streak', value: '0 days' },
          { icon: <Trophy size={28} color="#FFAA00" />, label: 'Top Artist', value: '—' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              padding: '20px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-sub)', fontSize: 'var(--text-caption)' }}>{kpi.label}</span>
              {kpi.icon}
            </div>
            <div style={{ fontSize: 'var(--text-h2)', fontWeight: 'var(--font-heading)', color: 'var(--text)' }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: '48px 24px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
          textAlign: 'center',
          color: 'var(--text-sub)',
        }}
      >
        <p>Start listening to music to unlock your personalized listening insights and charts.</p>
      </div>
    </div>
  );
};
