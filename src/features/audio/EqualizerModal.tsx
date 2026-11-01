import { type FC, useState, useEffect } from 'react';
import { Sliders, X } from '@phosphor-icons/react';
import { EQ_BANDS } from '@/config/app';
import { audioEngine } from '@/engine/audioEngine';
import { useSettingsStore } from '@/app/stores';

export interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EQ_PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bass Boost': [5.5, 4.5, 3.5, 2, 0, 0, 0, 0, 0, 0],
  'Treble Boost': [0, 0, 0, 0, 0, 1, 2.5, 4, 5, 5.5],
  Vocal: [-1, -1.5, -0.5, 2, 4.5, 4, 2.5, 1, 0, -1],
  Rock: [4.5, 3.5, 2, 0.5, -1, -0.5, 1.5, 3, 4, 4.5],
  Pop: [-1, 1, 3, 3.5, 2, -0.5, 1, 2.5, 3, 2.5],
  Jazz: [3, 2, 1, 1.5, -1, -1, 0, 1.5, 2.5, 3.5],
  Classical: [4, 3, 2.5, 1.5, -1, -1, 0, 2, 3, 3.5],
  Electronic: [5, 4, 1.5, 0, -1.5, 1, 2, 3.5, 4.5, 4],
  'Hip-Hop': [6, 5, 2.5, 1, -1, -0.5, 1, 2, 3, 3.5],
  Acoustic: [3, 2, 1.5, 1, 2, 2, 2.5, 3, 2.5, 2],
  Loudness: [6, 4.5, 0, -2, -1, 0, 2, 4.5, 6, 6],
};

export const EqualizerModal: FC<EqualizerModalProps> = ({ isOpen, onClose }) => {
  const settings = useSettingsStore();
  const updateSettings = useSettingsStore((s) => s.update);

  const [activeTab, setActiveTab] = useState<'eq' | 'playback'>('eq');
  const [eqEnabled, setEqEnabled] = useState(settings.eqEnabled);
  const [eqPreset, setEqPreset] = useState(settings.eqPreset);
  const [eqBands, setEqBands] = useState<number[]>(settings.eqBands || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [eqPreamp, setEqPreamp] = useState(settings.eqPreamp || 0);

  // Playback settings
  const [crossfade, setCrossfade] = useState(settings.crossfadeS || 0);
  const [gapless, setGapless] = useState(settings.gapless ?? true);
  const [speed, setSpeed] = useState(settings.defaultSpeed || 1);
  const [mono, setMono] = useState(settings.mono ?? false);
  const [normalize, setNormalize] = useState(settings.normalizeVolume ?? false);

  useEffect(() => {
    if (isOpen) {
      setEqEnabled(settings.eqEnabled);
      setEqPreset(settings.eqPreset);
      setEqBands(settings.eqBands || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      setEqPreamp(settings.eqPreamp || 0);
      setCrossfade(settings.crossfadeS || 0);
      setGapless(settings.gapless ?? true);
      setSpeed(settings.defaultSpeed || 1);
      setMono(settings.mono ?? false);
      setNormalize(settings.normalizeVolume ?? false);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleBandChange = (index: number, val: number) => {
    const updated = [...eqBands];
    updated[index] = val;
    setEqBands(updated);
    setEqPreset('Custom');

    // Apply to audio engine
    if (eqEnabled) {
      audioEngine.setEqBands(updated);
    }

    void updateSettings({
      eqBands: updated,
      eqPreset: 'Custom',
    });
  };

  const handlePresetSelect = (presetName: string) => {
    const presetValues = EQ_PRESETS[presetName];
    if (!presetValues) return;

    setEqPreset(presetName);
    setEqBands(presetValues);

    if (eqEnabled) {
      audioEngine.setEqBands(presetValues);
    }

    void updateSettings({
      eqPreset: presetName,
      eqBands: presetValues,
    });
  };

  const handleToggleBypass = (enabled: boolean) => {
    setEqEnabled(enabled);
    if (enabled) {
      audioEngine.setEqBands(eqBands);
    } else {
      audioEngine.setEqBands([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    }
    void updateSettings({ eqEnabled: enabled });
  };

  const handlePreampChange = (val: number) => {
    setEqPreamp(val);
    void updateSettings({ eqPreamp: val });
  };

  // Generate SVG frequency curve path
  const svgWidth = 520;
  const svgHeight = 110;
  const zeroY = svgHeight / 2;
  const points = eqBands.map((dbVal, idx) => {
    const effectiveDb = eqEnabled ? Math.max(-12, Math.min(12, dbVal + eqPreamp * 0.5)) : 0;
    const x = 30 + idx * ((svgWidth - 60) / (eqBands.length - 1));
    const y = zeroY - (effectiveDb / 12) * (svgHeight * 0.4);
    return { x, y };
  });

  // Construct smooth bezier curve
  let curvePath = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    const cx = (p0.x + p1.x) / 2;
    curvePath += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  const formatHz = (hz: number) => {
    return hz >= 1000 ? `${hz / 1000}k` : `${hz}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(10px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 680,
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={24} color="var(--accent)" weight="fill" />
            <h2 style={{ fontSize: 'var(--text-h2)', margin: 0, fontWeight: 'var(--font-heading)' }}>
              Audio & Equalizer
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Tabs switcher */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--bg-elevated)',
                padding: 3,
                borderRadius: 'var(--radius-pill)',
                gap: 2,
              }}
            >
              <button
                onClick={() => setActiveTab('eq')}
                style={{
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  fontSize: 'var(--text-caption)',
                  fontWeight: 'var(--font-bold)',
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'eq' ? 'var(--bg-card)' : 'transparent',
                  color: activeTab === 'eq' ? 'var(--text)' : 'var(--text-sub)',
                }}
              >
                10-Band EQ
              </button>
              <button
                onClick={() => setActiveTab('playback')}
                style={{
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  fontSize: 'var(--text-caption)',
                  fontWeight: 'var(--font-bold)',
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'playback' ? 'var(--bg-card)' : 'transparent',
                  color: activeTab === 'playback' ? 'var(--text)' : 'var(--text-sub)',
                }}
              >
                Options
              </button>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-sub)',
                cursor: 'pointer',
                padding: 4,
              }}
              className="hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {activeTab === 'eq' ? (
          <>
            {/* Preset Dropdown & Bypass Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: 'var(--text-body)', color: 'var(--text-sub)' }}>Preset:</span>
                <select
                  value={eqPreset}
                  onChange={(e) => handlePresetSelect(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '6px 14px',
                    color: 'var(--text)',
                    fontSize: 'var(--text-body)',
                    fontWeight: 'var(--font-bold)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {Object.keys(EQ_PRESETS).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  {eqPreset === 'Custom' && <option value="Custom">Custom</option>}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
                  {eqEnabled ? 'Enabled' : 'Bypassed'}
                </span>
                <button
                  onClick={() => handleToggleBypass(!eqEnabled)}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: eqEnabled ? 'var(--accent)' : 'var(--bg-elevated)',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background-color 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      backgroundColor: eqEnabled ? '#000' : '#888',
                      position: 'absolute',
                      top: 3,
                      left: eqEnabled ? 23 : 3,
                      transition: 'left 0.2s ease',
                    }}
                  />
                </button>
              </div>
            </div>

            {/* SVG Frequency Response Curve */}
            <div
              style={{
                width: '100%',
                height: 110,
                backgroundColor: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-card)',
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid var(--border)',
              }}
            >
              <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
                {/* 0dB Reference Line */}
                <line
                  x1="0"
                  y1={zeroY}
                  x2={svgWidth}
                  y2={zeroY}
                  stroke="rgba(255,255,255,0.12)"
                  strokeDasharray="4 4"
                />
                {/* Filled Area below curve */}
                <path
                  d={`${curvePath} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`}
                  fill="rgba(30,215,96,0.1)"
                />
                {/* Curve line */}
                <path
                  d={curvePath}
                  fill="none"
                  stroke={eqEnabled ? 'var(--accent)' : 'rgba(255,255,255,0.3)'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* Control points */}
                {points.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r={eqEnabled ? 4 : 2}
                    fill={eqEnabled ? 'var(--accent)' : 'rgba(255,255,255,0.5)'}
                  />
                ))}
              </svg>
            </div>

            {/* 10 Vertical Band Sliders */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '8px',
                paddingTop: '8px',
              }}
            >
              {EQ_BANDS.map((hz, idx) => {
                const val = eqBands[idx] || 0;
                return (
                  <div
                    key={hz}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        color: val !== 0 ? 'var(--accent)' : 'var(--text-sub)',
                        fontWeight: 'var(--font-bold)',
                        minHeight: 16,
                      }}
                    >
                      {val > 0 ? `+${val}` : val}
                    </span>

                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={0.5}
                      value={val}
                      disabled={!eqEnabled}
                      onChange={(e) => handleBandChange(idx, parseFloat(e.target.value))}
                      style={{
                        writingMode: 'vertical-lr',
                        direction: 'rtl',
                        height: 120,
                        accentColor: 'var(--accent)',
                        cursor: eqEnabled ? 'pointer' : 'not-allowed',
                      }}
                    />

                    <span style={{ fontSize: '11px', color: 'var(--text-sub)' }}>
                      {formatHz(hz)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Preamp Slider */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '12px 16px',
                backgroundColor: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-card)',
              }}
            >
              <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)', width: 70 }}>
                Preamp:
              </span>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={eqPreamp}
                disabled={!eqEnabled}
                onChange={(e) => handlePreampChange(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <span
                style={{
                  fontSize: 'var(--text-caption)',
                  color: 'var(--accent)',
                  fontWeight: 'var(--font-bold)',
                  width: 44,
                  textAlign: 'right',
                }}
              >
                {eqPreamp > 0 ? `+${eqPreamp}` : eqPreamp} dB
              </span>
            </div>
          </>
        ) : (
          /* Playback Options Tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '12px 0' }}>
            {/* Crossfade */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'var(--font-bold)', fontSize: 'var(--text-body)' }}>Crossfade</span>
                <span style={{ color: 'var(--accent)', fontWeight: 'var(--font-bold)' }}>{crossfade}s</span>
              </div>
              <input
                type="range"
                min={0}
                max={12}
                step={1}
                value={crossfade}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setCrossfade(val);
                  audioEngine.setCrossfade(val);
                  void updateSettings({ crossfadeS: val });
                }}
                style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)', marginTop: 4 }}>
                Smoothly fade out the ending song while fading in the next one.
              </div>
            </div>

            {/* Speed */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 'var(--font-bold)', fontSize: 'var(--text-body)' }}>Playback Speed</div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
                  Tempo adjustment without pitch shift
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[0.8, 1.0, 1.25, 1.5].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSpeed(s);
                      audioEngine.setSpeed(s);
                      void updateSettings({ defaultSpeed: s });
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-pill)',
                      border: 'none',
                      backgroundColor: speed === s ? 'var(--accent)' : 'var(--bg-elevated)',
                      color: speed === s ? '#000' : 'var(--text)',
                      fontWeight: 'var(--font-bold)',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Gapless Playback */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 'var(--font-bold)', fontSize: 'var(--text-body)' }}>Gapless Playback</div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
                  Eliminate dead silence between consecutive tracks
                </div>
              </div>
              <button
                onClick={() => {
                  const next = !gapless;
                  setGapless(next);
                  void updateSettings({ gapless: next });
                }}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: gapless ? 'var(--accent)' : 'var(--bg-elevated)',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    backgroundColor: gapless ? '#000' : '#888',
                    position: 'absolute',
                    top: 3,
                    left: gapless ? 23 : 3,
                    transition: 'left 0.2s ease',
                  }}
                />
              </button>
            </div>

            {/* Volume Normalization */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 'var(--font-bold)', fontSize: 'var(--text-body)' }}>Normalize Volume</div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
                  Set the same loudness level for all tracks
                </div>
              </div>
              <button
                onClick={() => {
                  const next = !normalize;
                  setNormalize(next);
                  void updateSettings({ normalizeVolume: next });
                }}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: normalize ? 'var(--accent)' : 'var(--bg-elevated)',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    backgroundColor: normalize ? '#000' : '#888',
                    position: 'absolute',
                    top: 3,
                    left: normalize ? 23 : 3,
                    transition: 'left 0.2s ease',
                  }}
                />
              </button>
            </div>

            {/* Mono Audio */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 'var(--font-bold)', fontSize: 'var(--text-body)' }}>Mono Audio</div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
                  Combine left and right audio channels
                </div>
              </div>
              <button
                onClick={() => {
                  const next = !mono;
                  setMono(next);
                  void updateSettings({ mono: next });
                }}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: mono ? 'var(--accent)' : 'var(--bg-elevated)',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    backgroundColor: mono ? '#000' : '#888',
                    position: 'absolute',
                    top: 3,
                    left: mono ? 23 : 3,
                    transition: 'left 0.2s ease',
                  }}
                />
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 24px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'var(--accent)',
              border: 'none',
              color: '#000',
              fontWeight: 'var(--font-bold)',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
