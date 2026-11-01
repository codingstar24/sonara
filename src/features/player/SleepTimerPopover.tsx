import { type FC, useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Moon, Plus, X } from '@phosphor-icons/react';
import { sleepTimerManager, type SleepTimerSnapshot } from './sleepTimer';
import { formatTime } from '@/lib/formatters';

export const SleepTimerPopover: FC = () => {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<SleepTimerSnapshot>(sleepTimerManager.getSnapshot());
  const [customMin, setCustomMin] = useState('45');

  useEffect(() => {
    return sleepTimerManager.subscribe(setSnapshot);
  }, []);

  const presets = [
    { label: '5 minutes', min: 5 },
    { label: '10 minutes', min: 10 },
    { label: '15 minutes', min: 15 },
    { label: '30 minutes', min: 30 },
    { label: '45 minutes', min: 45 },
    { label: '1 hour', min: 60 },
  ];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={`icon-btn ${snapshot.active ? 'active' : ''}`}
          aria-label={
            snapshot.active
              ? `Sleep timer active (${formatTime(snapshot.remainingSeconds)} remaining)`
              : 'Sleep timer'
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: snapshot.active ? 'var(--accent)' : 'var(--text-sub)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: 'var(--radius-pill)',
          }}
        >
          <Moon size={18} weight={snapshot.active ? 'fill' : 'regular'} />
          {snapshot.active && snapshot.mode === 'duration' && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--accent)',
              }}
            >
              {formatTime(snapshot.remainingSeconds)}
            </span>
          )}
          {snapshot.active && snapshot.mode === 'end-of-track' && (
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)' }}>
              Track
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={12}
          style={{
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text)',
            borderRadius: 'var(--radius-card)',
            padding: '16px',
            width: 240,
            boxShadow: 'var(--shadow-dropdown)',
            zIndex: 1000,
            outline: 'none',
            fontSize: 'var(--text-body)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--text-title)' }}>Sleep timer</span>
            <Popover.Close asChild>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--text-sub)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </Popover.Close>
          </div>

          {snapshot.active ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
                {snapshot.mode === 'end-of-track'
                  ? 'Pauses at the end of the current track'
                  : `Pausing in ${formatTime(snapshot.remainingSeconds)}`}
              </div>

              {snapshot.mode === 'duration' && (
                <button
                  onClick={() => sleepTimerManager.add15Minutes()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--bg-card-hover)',
                    border: 'none',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 'var(--text-caption)',
                  }}
                >
                  <Plus size={14} weight="bold" /> +15 minutes
                </button>
              )}

              <button
                onClick={() => {
                  sleepTimerManager.cancel();
                  setOpen(false);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--danger)',
                  border: 'none',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 'var(--text-caption)',
                  marginTop: '4px',
                }}
              >
                Cancel timer
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {presets.map((preset) => (
                <button
                  key={preset.min}
                  onClick={() => {
                    sleepTimerManager.setDuration(preset.min);
                    setOpen(false);
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-body)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-row-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {preset.label}
                </button>
              ))}

              <button
                onClick={() => {
                  sleepTimerManager.setEndOfTrack();
                  setOpen(false);
                }}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-body)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-row-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                End of current track
              </button>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  marginTop: '4px',
                  borderTop: '1px solid var(--divider)',
                }}
              >
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={customMin}
                  onChange={(e) => setCustomMin(e.target.value)}
                  style={{
                    width: 50,
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text)',
                    fontSize: 'var(--text-caption)',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>min</span>
                <button
                  onClick={() => {
                    const m = parseInt(customMin, 10);
                    if (m > 0) {
                      sleepTimerManager.setDuration(m);
                      setOpen(false);
                    }
                  }}
                  style={{
                    marginLeft: 'auto',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--accent)',
                    color: 'var(--text-on-accent)',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 'var(--text-caption)',
                    cursor: 'pointer',
                  }}
                >
                  Set
                </button>
              </div>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
