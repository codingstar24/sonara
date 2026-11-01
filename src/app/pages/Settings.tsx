import { type FC, useState, useEffect } from 'react';
import {
  Folder,
  PaintBrush,
  SpeakerHigh,
  Database,
  Keyboard,
  Info,
  House,
  Sparkle,
  DownloadSimple,
  UploadSimple,
  Trash,
  ArrowsClockwise,
  Check,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { db } from '@/db/schema';
import { useSettingsStore, useLibraryStore, useUIStore } from '../stores';
import { APP_NAME, APP_VERSION, APP_AUTHOR, APP_CREDITS } from '@/config/app';
import { createLibraryBackup, downloadBackupFile, restoreLibraryBackup } from '@/lib/backup';
import { importPipeline } from '@/features/import/importPipeline';
import { Button } from '@/components/ui/Button';
import type { Source } from '@/db/types';

type SettingsTab = 'appearance' | 'playback' | 'library' | 'home' | 'shortcuts' | 'data' | 'about';

export const SettingsPage: FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const settings = useSettingsStore();
  const updateSettings = useSettingsStore((s) => s.update);
  const totalTracks = useLibraryStore((s) => s.totalTracks);
  const setEqualizerOpen = useUIStore((s) => s.setEqualizerOpen);

  const [storageEstimate, setStorageEstimate] = useState<{ usageMB: number; quotaMB: number } | null>(null);
  const [isPersisted, setIsPersisted] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [customPath, setCustomPath] = useState('');
  const [isAddingPath, setIsAddingPath] = useState(false);

  const loadSources = () => {
    db.sources.toArray().then((srcs) => setSources(srcs.filter((s) => !s.id.startsWith('demo-'))));
  };

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage) {
      if (navigator.storage.persisted) {
        navigator.storage.persisted().then(setIsPersisted);
      }
      if (navigator.storage.estimate) {
        navigator.storage.estimate().then((est) => {
          setStorageEstimate({
            usageMB: Math.round((est.usage || 0) / (1024 * 1024)),
            quotaMB: Math.round((est.quota || 0) / (1024 * 1024)),
          });
        });
      }
    }
    loadSources();
  }, [totalTracks]);

  const handleAddCustomPath = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!customPath.trim()) return;
    setIsAddingPath(true);
    try {
      const ok = await importPipeline.importFolderPath(customPath);
      if (ok) {
        setCustomPath('');
        loadSources();
      }
    } finally {
      setIsAddingPath(false);
    }
  };

  const handleBrowseFolder = async () => {
    await importPipeline.importFolder();
    loadSources();
  };

  const handleRemoveSource = async (srcId: string, srcName: string) => {
    if (!confirm(`Are you sure you want to remove folder "${srcName}" from configured sources?`)) return;
    await db.sources.delete(srcId);
    toast.success(`Removed "${srcName}"`);
    loadSources();
  };

  const handleRescanSource = async (src: Source) => {
    toast.info(`Rescanning "${src.name}"...`);
    await importPipeline.scanSource(src, { createPlaylistPerFolder: true });
    loadSources();
  };

  const handleRequestPersistentStorage = async () => {
    if (navigator.storage && navigator.storage.persist) {
      const granted = await navigator.storage.persist();
      setIsPersisted(granted);
      if (granted) {
        toast.success('Persistent storage granted. Browser will never evict your library cache.');
      } else {
        toast.info('Persistent storage was not granted by browser.');
      }
    }
  };

  const handleExportBackup = async () => {
    try {
      const json = await createLibraryBackup();
      downloadBackupFile(json);
      toast.success('Backup file exported!');
    } catch {
      toast.error('Failed to export backup.');
    }
  };

  const handleImportBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const summary = await restoreLibraryBackup(text);
        toast.success(
          `Restored ${summary.playlistsImported} playlists, ${summary.likesImported} likes, ${summary.tracksMatched} matched tracks!`
        );
        // Refresh stores
        await useLibraryStore.getState().hydrate();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invalid backup';
        toast.error(`Restore failed: ${msg}`);
      }
    };
    input.click();
  };

  const handleClearCache = async () => {
    await db.recsCache.clear();
    toast.success('Recommendation cache cleared. Fresh picks will be computed on next Home visit.');
  };

  const handleResetListeningHistory = async () => {
    if (window.confirm('Reset all listening history and play counts? This cannot be undone.')) {
      await db.playEvents.clear();
      await db.trackStats.clear();
      await db.contextStats.clear();
      await db.recsCache.clear();
      toast.success('Listening history reset.');
    }
  };

  const handleResetEntireApp = async () => {
    if (
      window.confirm(
        'Are you sure you want to completely reset Sonara? All library index, playlists, likes, and settings will be cleared.'
      )
    ) {
      await db.delete();
      window.location.reload();
    }
  };

  const accentPresets = [
    { name: 'Spotify Green', hex: '#1ED760' },
    { name: 'Electric Blue', hex: '#3D91F4' },
    { name: 'Coral Red', hex: '#FF4E50' },
    { name: 'Violet Purple', hex: '#A855F7' },
    { name: 'Sunset Amber', hex: '#F59E0B' },
    { name: 'Neon Pink', hex: '#EC4899' },
  ];

  return (
    <div className="route-enter" style={{ padding: '24px 32px', maxWidth: 860, paddingBottom: '64px' }}>
      <h1
        style={{
          fontSize: 'clamp(28px, 4vw, 42px)',
          fontWeight: 'var(--font-display)',
          letterSpacing: '-0.03em',
          marginBottom: '20px',
        }}
      >
        Settings
      </h1>

      {/* Tabs Bar */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '12px',
          marginBottom: '28px',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'appearance' as const, label: 'Appearance', icon: PaintBrush },
          { id: 'playback' as const, label: 'Playback', icon: SpeakerHigh },
          { id: 'library' as const, label: 'Library', icon: Folder },
          { id: 'home' as const, label: 'Home Page', icon: House },
          { id: 'shortcuts' as const, label: 'Shortcuts', icon: Keyboard },
          { id: 'data' as const, label: 'Data & Backup', icon: Database },
          { id: 'about' as const, label: 'About', icon: Info },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: activeTab === tab.id ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === tab.id ? 'var(--text)' : 'var(--text-sub)',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 'var(--radius-pill)',
              fontWeight: 'var(--font-bold)',
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all var(--transition-fast)',
            }}
            className="hover:text-white"
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* --- Tab 1: Appearance --- */}
      {activeTab === 'appearance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Display Name */}
          <div style={{ padding: '20px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 'var(--text-body)', fontWeight: 'var(--font-bold)' }}>
              Profile Greeting Name
            </h3>
            <p style={{ margin: '0 0 14px 0', fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
              Name displayed in the Home greeting ("Good morning, Alex")
            </p>
            <input
              type="text"
              value={settings.displayName || ''}
              onChange={(e) => void updateSettings({ displayName: e.target.value })}
              placeholder="Your name"
              style={{
                width: 260,
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-pill)',
                padding: '8px 14px',
                color: 'var(--text)',
                outline: 'none',
              }}
            />
          </div>

          {/* Theme Selector */}
          <div style={{ padding: '20px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 'var(--text-body)', fontWeight: 'var(--font-bold)' }}>
              Theme
            </h3>
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              {(['dark', 'light', 'amoled'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => void updateSettings({ theme: t })}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 'var(--radius-pill)',
                    border: settings.theme === t ? '1px solid var(--accent)' : '1px solid var(--border)',
                    backgroundColor: settings.theme === t ? 'var(--bg-elevated)' : 'transparent',
                    color: settings.theme === t ? 'var(--text)' : 'var(--text-sub)',
                    fontWeight: 'var(--font-bold)',
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color */}
          <div style={{ padding: '20px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 'var(--text-body)', fontWeight: 'var(--font-bold)' }}>
              Accent Color
            </h3>
            <p style={{ margin: '0 0 14px 0', fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
              Choose a signature accent color for play buttons, sliders, and highlights
            </p>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              {accentPresets.map((p) => {
                const isSelected = settings.accent.toLowerCase() === p.hex.toLowerCase();
                return (
                  <button
                    key={p.hex}
                    onClick={() => void updateSettings({ accent: p.hex })}
                    title={p.name}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: p.hex,
                      border: isSelected ? '3px solid #FFF' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                    }}
                  >
                    {isSelected && <Check size={18} weight="bold" color="#000" />}
                  </button>
                );
              })}

              <input
                type="color"
                value={settings.accent}
                onChange={(e) => void updateSettings({ accent: e.target.value })}
                title="Custom color"
                style={{ width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', border: 'none', background: 'none' }}
              />
            </div>
          </div>

          {/* Density */}
          <div style={{ padding: '20px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 'var(--text-body)', fontWeight: 'var(--font-bold)' }}>
              Table Row Density
            </h3>
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button
                onClick={() => void updateSettings({ density: 'comfortable' })}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-pill)',
                  border: settings.density === 'comfortable' ? '1px solid var(--accent)' : '1px solid var(--border)',
                  backgroundColor: settings.density === 'comfortable' ? 'var(--bg-elevated)' : 'transparent',
                  color: 'var(--text)',
                  fontWeight: 'var(--font-bold)',
                  cursor: 'pointer',
                }}
              >
                Comfortable (56px)
              </button>
              <button
                onClick={() => void updateSettings({ density: 'compact' })}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-pill)',
                  border: settings.density === 'compact' ? '1px solid var(--accent)' : '1px solid var(--border)',
                  backgroundColor: settings.density === 'compact' ? 'var(--bg-elevated)' : 'transparent',
                  color: 'var(--text)',
                  fontWeight: 'var(--font-bold)',
                  cursor: 'pointer',
                }}
              >
                Compact (32px)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Tab 2: Playback --- */}
      {activeTab === 'playback' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            onClick={() => setEqualizerOpen(true)}
            style={{
              padding: '20px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-card)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            className="hover:bg-[var(--bg-card-hover)]"
          >
            <div>
              <div style={{ fontSize: 'var(--text-body)', fontWeight: 'var(--font-bold)' }}>
                10-Band Equalizer & DSP
              </div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
                Fine-tune frequency curves, preamp gain, and presets
              </div>
            </div>
            <button
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--accent)',
                color: '#000',
                border: 'none',
                fontWeight: 'var(--font-bold)',
                cursor: 'pointer',
              }}
            >
              Open Equalizer
            </button>
          </div>

          <div style={{ padding: '20px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'var(--font-bold)' }}>Restore Playback on Launch</div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
                  Remember paused track, playback position, and queue across sessions
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.restoreSession ?? true}
                onChange={(e) => void updateSettings({ restoreSession: e.target.checked })}
                style={{ width: 20, height: 20, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* --- Tab 3: Library --- */}
      {activeTab === 'library' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Storage Persistence */}
          <div style={{ padding: '20px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)' }}>
            <h3 style={{ margin: '0 0 6px 0', fontWeight: 'var(--font-bold)' }}>IndexedDB Storage</h3>
            <p style={{ margin: '0 0 14px 0', fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
              Storage usage: {storageEstimate ? `${storageEstimate.usageMB} MB of ~${storageEstimate.quotaMB} MB` : 'Calculating...'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: 'var(--text-caption)', color: isPersisted ? 'var(--accent)' : 'var(--text-sub)' }}>
                {isPersisted ? 'Persistent storage active (protected from eviction)' : 'Standard storage mode'}
              </span>
              {!isPersisted && (
                <button
                  onClick={() => void handleRequestPersistentStorage()}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: '12px',
                    fontWeight: 'var(--font-bold)',
                    cursor: 'pointer',
                  }}
                >
                  Enable Persistent Storage
                </button>
              )}
            </div>
          </div>

          {/* Add Music Folder Card */}
          <div style={{ padding: '20px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontWeight: 'var(--font-bold)', fontSize: 'var(--text-body)' }}>
              Add Music Folder
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
              Enter any local folder path (e.g. D:\Music) or browse your files to add songs and generate a playlist.
            </p>

            <form onSubmit={handleAddCustomPath} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="Enter custom folder path (e.g. D:\Music or C:\Users\Username\Music)"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-thumb)',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              <Button
                type="submit"
                variant="primary"
                disabled={!customPath.trim() || isAddingPath}
                style={{ whiteSpace: 'nowrap' }}
              >
                {isAddingPath ? 'Adding...' : 'Add Path'}
              </Button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Button variant="secondary" onClick={handleBrowseFolder}>
                <Folder size={18} weight="fill" style={{ marginRight: 6 }} />
                Browse Folders...
              </Button>
            </div>
          </div>

          {/* Music Sources List */}
          <div style={{ padding: '20px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontWeight: 'var(--font-bold)' }}>
              Configured Music Folders ({totalTracks} tracks in library)
            </h3>
            {sources.length === 0 ? (
              <div style={{ color: 'var(--text-sub)', fontSize: '13px' }}>No music directories configured yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sources.map((src) => (
                  <div
                    key={src.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      backgroundColor: 'var(--bg-elevated)',
                      borderRadius: 6,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'var(--font-bold)', fontSize: '14px', color: 'var(--text)' }}>
                        {src.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-sub)', marginTop: 2 }}>
                        {src.path || 'Local folder'} • Added {new Date(src.addedAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => void handleRescanSource(src)}
                        className="icon-btn"
                        title="Rescan Folder"
                        style={{ padding: 6 }}
                      >
                        <ArrowsClockwise size={18} />
                      </button>
                      <button
                        onClick={() => void handleRemoveSource(src.id, src.name)}
                        className="icon-btn hover:text-[var(--status-danger)]"
                        title="Remove Folder"
                        style={{ padding: 6 }}
                      >
                        <Trash size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* --- Tab 4: Home Page --- */}
      {activeTab === 'home' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ padding: '20px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'var(--font-bold)' }}>Time-of-Day Personalization</div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
                  Tailor Home shelf recommendations according to your hourly listening habits
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.timePersonalization ?? true}
                onChange={(e) => void updateSettings({ timePersonalization: e.target.checked })}
                style={{ width: 20, height: 20, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
            </div>
          </div>

          <div style={{ padding: '20px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'var(--font-bold)' }}>Reset Listening History</div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
                  Clear all play sessions, counts, and decay scores (library files stay intact)
                </div>
              </div>
              <button
                onClick={() => void handleResetListeningHistory()}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'transparent',
                  border: '1px solid #FF4E50',
                  color: '#FF4E50',
                  fontWeight: 'var(--font-bold)',
                  cursor: 'pointer',
                }}
              >
                Reset History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Tab 5: Shortcuts --- */}
      {activeTab === 'shortcuts' && (
        <div style={{ padding: '24px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontWeight: 'var(--font-bold)' }}>Keyboard Shortcuts</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
            {[
              { key: 'Space', desc: 'Play / Pause' },
              { key: 'Ctrl + →', desc: 'Next track' },
              { key: 'Ctrl + ←', desc: 'Previous track' },
              { key: 'Shift + → / ←', desc: 'Seek +/- 5 seconds' },
              { key: 'Ctrl + ↑ / ↓', desc: 'Adjust volume +/- 5%' },
              { key: 'S', desc: 'Toggle Shuffle' },
              { key: 'R', desc: 'Cycle Repeat' },
              { key: 'M', desc: 'Mute / Unmute' },
              { key: 'L', desc: 'Like / Unlike current track' },
              { key: 'F', desc: 'Toggle Fullscreen Mode' },
              { key: 'E', desc: 'Open Equalizer' },
              { key: 'Q', desc: 'Toggle Queue Panel' },
              { key: 'N', desc: 'Toggle Now Playing Panel' },
              { key: 'Y', desc: 'Toggle Lyrics Panel' },
              { key: 'Ctrl + K', desc: 'Open Command Palette' },
              { key: '/', desc: 'Focus Search Bar' },
              { key: 'Ctrl + ,', desc: 'Open Settings' },
              { key: 'Esc', desc: 'Close modals / exit Fullscreen' },
            ].map((s) => (
              <div
                key={s.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-elevated)',
                  borderRadius: 6,
                }}
              >
                <span>{s.desc}</span>
                <kbd
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontWeight: 'bold',
                    fontSize: '11px',
                  }}
                >
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- Tab 6: Data & Backup --- */}
      {activeTab === 'data' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Backup / Restore */}
          <div style={{ padding: '20px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)' }}>
            <h3 style={{ margin: '0 0 6px 0', fontWeight: 'var(--font-bold)' }}>Export / Import Library Backup</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
              Export all playlists, likes, play events, lyrics, and settings as a portable JSON file.
              Fingerprint-based matching ensures smooth migration across PCs.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => void handleExportBackup()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'var(--accent)',
                  color: '#000',
                  border: 'none',
                  fontWeight: 'var(--font-bold)',
                  cursor: 'pointer',
                }}
              >
                <DownloadSimple size={16} weight="bold" />
                <span>Export Backup (.json)</span>
              </button>

              <button
                onClick={handleImportBackup}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontWeight: 'var(--font-bold)',
                  cursor: 'pointer',
                }}
              >
                <UploadSimple size={16} weight="bold" />
                <span>Restore Backup</span>
              </button>
            </div>
          </div>

          {/* Clear Cache */}
          <div style={{ padding: '20px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'var(--font-bold)' }}>Clear Recommendation Cache</div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
                  Force recalculation of Daily Mixes and personalized shelves
                </div>
              </div>
              <button
                onClick={() => void handleClearCache()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontWeight: 'var(--font-bold)',
                  cursor: 'pointer',
                }}
              >
                <ArrowsClockwise size={16} />
                <span>Clear Cache</span>
              </button>
            </div>
          </div>

          {/* Danger Zone: Reset App */}
          <div
            style={{
              padding: '20px',
              backgroundColor: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 'var(--radius-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'var(--font-bold)', color: '#EF4444' }}>Danger Zone: Reset Application</div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
                  Deletes all IndexedDB tables and reloads the application. Local music files will NOT be touched.
                </div>
              </div>
              <button
                onClick={() => void handleResetEntireApp()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: '#EF4444',
                  color: '#FFF',
                  border: 'none',
                  fontWeight: 'var(--font-bold)',
                  cursor: 'pointer',
                }}
              >
                <Trash size={16} weight="bold" />
                <span>Reset Database</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Tab 7: About --- */}
      {activeTab === 'about' && (
        <div style={{ padding: '28px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000',
              }}
            >
              <Sparkle size={26} weight="fill" />
            </div>
            <div>
              <h2 style={{ fontSize: '22px', margin: 0, fontWeight: 'var(--font-bold)' }}>{APP_NAME}</h2>
              <span style={{ fontSize: '13px', color: 'var(--text-sub)' }}>Version {APP_VERSION} (Electron-Ready)</span>
            </div>
          </div>

          <p style={{ lineHeight: 1.6, color: 'var(--text-sub)', fontSize: '14px', marginBottom: '20px' }}>
            {APP_NAME} is a 100% offline, local-first music player crafted with Spotify-grade polish,
            Web Audio DSP, and tag-based personalized recommendation mathematics. Zero tracking, zero telemetry,
            and complete local privacy.
          </p>

          <div
            style={{
              padding: '14px 18px',
              backgroundColor: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-card)',
              marginBottom: '20px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Author & Creator
            </div>
            <div style={{ fontSize: '15px', fontWeight: 'var(--font-bold)', color: '#FFFFFF' }}>
              {APP_AUTHOR}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-sub)', marginTop: '2px' }}>
              {APP_CREDITS}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-sub)' }}>
            <div>· Built with React 19, TypeScript, Dexie IndexedDB, and Web Audio API</div>
            <div>· Tag extraction powered by music-metadata browser workers</div>
            <div>· Fast search indexing powered by MiniSearch</div>
            <div>· Icons by Phosphor Icons · Typography by Inter Variable</div>
          </div>
        </div>
      )}
    </div>
  );
};
