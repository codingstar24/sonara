import { type FC, useState } from 'react';
import { useSettingsStore } from '../stores';
import { APP_NAME, APP_VERSION } from '@/config/app';

type SettingsTab = 'library' | 'playback' | 'appearance' | 'data' | 'about';

export const SettingsPage: FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const theme = useSettingsStore((s) => s.theme);
  const accent = useSettingsStore((s) => s.accent);
  const crossfadeS = useSettingsStore((s) => s.crossfadeS);
  const gapless = useSettingsStore((s) => s.gapless);
  const normalizeVolume = useSettingsStore((s) => s.normalizeVolume);
  const update = useSettingsStore((s) => s.update);

  const accentPresets = [
    { name: 'Spotify Green', hex: '#1ED760' },
    { name: 'Neon Blue', hex: '#1D9BF0' },
    { name: 'Electric Purple', hex: '#8B5CF6' },
    { name: 'Vibrant Pink', hex: '#EC4899' },
    { name: 'Sunset Orange', hex: '#F97316' },
    { name: 'Crimson Red', hex: '#EF4444' },
  ];

  return (
    <div className="route-enter" style={{ padding: '24px 32px', maxWidth: 800 }}>
      <h1
        style={{
          fontSize: 'var(--text-display)',
          fontWeight: 'var(--font-display)',
          letterSpacing: '-0.03em',
          marginBottom: '24px',
        }}
      >
        Settings
      </h1>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--divider)',
          paddingBottom: '12px',
          marginBottom: '28px',
        }}
      >
        {(['appearance', 'playback', 'library', 'data', 'about'] as SettingsTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? 'var(--bg-card-hover)' : 'transparent',
              color: activeTab === tab ? 'var(--text)' : 'var(--text-sub)',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 'var(--radius-pill)',
              fontWeight: 600,
              fontSize: 'var(--text-body)',
              textTransform: 'capitalize',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'appearance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Theme */}
          <div>
            <h3 style={{ fontSize: 'var(--text-h2)', marginBottom: '8px' }}>Theme</h3>
            <p style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)', marginBottom: '16px' }}>
              Select the appearance theme for {APP_NAME}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              {(['dark', 'amoled', 'light'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => update({ theme: t })}
                  style={{
                    padding: '12px 20px',
                    borderRadius: 'var(--radius-card)',
                    background: theme === t ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                    border: theme === t ? '2px solid var(--accent)' : '2px solid transparent',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <h3 style={{ fontSize: 'var(--text-h2)', marginBottom: '8px' }}>Accent Color</h3>
            <p style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)', marginBottom: '16px' }}>
              Choose an accent color for buttons, active tabs, and sliders
            </p>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {accentPresets.map((preset) => (
                <button
                  key={preset.hex}
                  onClick={() => update({ accent: preset.hex })}
                  title={preset.name}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-pill)',
                    background: preset.hex,
                    border: accent === preset.hex ? '3px solid #FFFFFF' : 'none',
                    cursor: 'pointer',
                    transform: accent === preset.hex ? 'scale(1.15)' : 'none',
                    transition: 'all var(--transition-bounce)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'playback' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Crossfade */}
          <div>
            <h3 style={{ fontSize: 'var(--text-h2)', marginBottom: '8px' }}>Crossfade</h3>
            <p style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)', marginBottom: '12px' }}>
              Allow songs to fade into each other: {crossfadeS}s
            </p>
            <input
              type="range"
              min="0"
              max="12"
              value={crossfadeS}
              onChange={(e) => update({ crossfadeS: Number(e.target.value) })}
              style={{ width: 240, accentColor: 'var(--accent)' }}
            />
          </div>

          {/* Gapless */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 'var(--text-h2)', marginBottom: '4px' }}>Gapless Playback</h3>
              <p style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)' }}>
                Seamless transitions between consecutive tracks
              </p>
            </div>
            <input
              type="checkbox"
              checked={gapless}
              onChange={(e) => update({ gapless: e.target.checked })}
              style={{ width: 20, height: 20, accentColor: 'var(--accent)' }}
            />
          </div>

          {/* Normalize */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 'var(--text-h2)', marginBottom: '4px' }}>Normalize Volume</h3>
              <p style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)' }}>
                Apply ReplayGain normalization for consistent loudness
              </p>
            </div>
            <input
              type="checkbox"
              checked={normalizeVolume}
              onChange={(e) => update({ normalizeVolume: e.target.checked })}
              style={{ width: 20, height: 20, accentColor: 'var(--accent)' }}
            />
          </div>
        </div>
      )}

      {activeTab === 'library' && (
        <div style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)' }}>
          <p>Manage your music folders, scan settings, and duplicate handling.</p>
        </div>
      )}

      {activeTab === 'data' && (
        <div style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)' }}>
          <p>Export or import your playlists, listening history, and custom tags.</p>
        </div>
      )}

      {activeTab === 'about' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-h2)', color: 'var(--text)' }}>{APP_NAME}</h2>
            <p style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)' }}>Version {APP_VERSION}</p>
          </div>
          <p style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)', lineHeight: 1.6 }}>
            A fast, private, 100% offline local music player built with web technologies and designed for audio lovers.
          </p>
        </div>
      )}
    </div>
  );
};
