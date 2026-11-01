import { type FC, useEffect, useState } from 'react';
import { db } from '@/db/schema';
import { getPlatform } from '@/platform';
import { Warning, ArrowClockwise } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';

export const ReconnectBanner: FC = () => {
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    async function checkSources() {
      const sources = await db.sources.toArray();
      const dirSources = sources.filter((s) => s.kind === 'directory-handle' && s.handle);
      if (dirSources.length === 0) return;

      const platform = getPlatform();
      let hasPromptOrDenied = false;

      for (const src of dirSources) {
        const perm = await platform.ensurePermission(src, false);
        if (perm === 'prompt' || perm === 'denied') {
          hasPromptOrDenied = true;
          break;
        }
      }

      setNeedsReconnect(hasPromptOrDenied);
    }

    void checkSources();
  }, []);

  const handleReconnectAll = async () => {
    setChecking(true);
    const platform = getPlatform();
    const sources = await db.sources.toArray();
    const dirSources = sources.filter((s) => s.kind === 'directory-handle' && s.handle);

    for (const src of dirSources) {
      await platform.ensurePermission(src, true);
    }

    setChecking(false);
    setNeedsReconnect(false);
  };

  if (!needsReconnect) return null;

  return (
    <div
      style={{
        backgroundColor: '#1E3264',
        color: '#FFFFFF',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 'var(--radius-card)',
        margin: '12px 16px 0',
        boxShadow: 'var(--shadow-card)',
        animation: 'fadeIn 200ms ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Warning size={22} weight="fill" color="#FFAA00" />
        <span style={{ fontSize: 'var(--text-body)', fontWeight: 500 }}>
          Permission required to access your music folders after reload.
        </span>
      </div>

      <Button
        variant="primary"
        size="sm"
        disabled={checking}
        onClick={handleReconnectAll}
      >
        <ArrowClockwise size={16} />
        {checking ? 'Reconnecting...' : 'Reconnect music folders'}
      </Button>
    </div>
  );
};
