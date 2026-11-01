import { type FC, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import {
  MagnifyingGlass,
  Play,
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
  Heart,
  Sliders,
  CornersOut,
  MicrophoneStage,
  Queue as QueueIcon,
  House,
  MusicNotes,
  Disc,
  User,
  Folder,
  ChartBar,
  Gear,
  FirstAid,
  Sparkle,
} from '@phosphor-icons/react';
import { usePlayerStore, useLibraryStore, useUIStore } from '@/app/stores';
import { useQueueStore } from '@/features/queue/queueStore';
import { useLikesStore } from '@/features/likes/likesStore';
import { seedDemoData } from '@/recommendation/seedDemo';
import { toast } from 'sonner';

export const CommandPalette: FC = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const libraryTracks = useLibraryStore((s) => s.tracks);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);

  // Toggle on Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!open) return null;

  const runCommand = (action: () => void) => {
    setOpen(false);
    action();
  };

  // Top matching tracks based on search query
  const matchingTracks = search.trim()
    ? Array.from(libraryTracks.values())
        .filter(
          (t) =>
            t.title.toLowerCase().includes(search.toLowerCase()) ||
            t.artist.toLowerCase().includes(search.toLowerCase()) ||
            t.album.toLowerCase().includes(search.toLowerCase())
        )
        .slice(0, 6)
    : [];

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(10px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 620,
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-modal)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Command label="Global Command Palette">
          {/* Search Input Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 18px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <MagnifyingGlass size={20} color="var(--text-sub)" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command, song, album, or artist..."
              autoFocus
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--text)',
                fontSize: '15px',
                outline: 'none',
              }}
            />
            <kbd
              style={{
                fontSize: '11px',
                color: 'var(--text-sub)',
                backgroundColor: 'var(--bg-elevated)',
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              ESC
            </kbd>
          </div>

          {/* Results List */}
          <Command.List
            style={{
              maxHeight: 380,
              overflowY: 'auto',
              padding: '8px',
            }}
          >
            <Command.Empty
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                color: 'var(--text-sub)',
                fontSize: '13px',
              }}
            >
              No matching commands or tracks found.
            </Command.Empty>

            {/* Matching Songs */}
            {matchingTracks.length > 0 && (
              <Command.Group
                heading="Songs"
                style={{
                  fontSize: '11px',
                  fontWeight: 'var(--font-bold)',
                  color: 'var(--text-sub)',
                  padding: '6px 10px',
                  textTransform: 'uppercase',
                }}
              >
                {matchingTracks.map((t) => (
                  <Command.Item
                    key={t.id}
                    onSelect={() => runCommand(() => void useQueueStore.getState().playNow(t.id))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      color: 'var(--text)',
                      fontSize: '14px',
                    }}
                    className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
                  >
                    <MusicNotes size={16} color="var(--accent)" />
                    <span style={{ fontWeight: 'var(--font-bold)' }}>{t.title}</span>
                    <span style={{ color: 'var(--text-sub)', fontSize: '12px' }}>· {t.artist}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Quick Playback Controls */}
            <Command.Group
              heading="Playback Controls"
              style={{
                fontSize: '11px',
                fontWeight: 'var(--font-bold)',
                color: 'var(--text-sub)',
                padding: '6px 10px',
                textTransform: 'uppercase',
              }}
            >
              <Command.Item
                onSelect={() => runCommand(() => void useQueueStore.getState().togglePlay())}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <Play size={16} />
                <span>Play / Pause</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-sub)' }}>Space</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => void useQueueStore.getState().next(false))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <SkipForward size={16} />
                <span>Next Track</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-sub)' }}>Ctrl + →</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => void useQueueStore.getState().previous())}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <SkipBack size={16} />
                <span>Previous Track</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-sub)' }}>Ctrl + ←</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => useQueueStore.getState().toggleShuffle())}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <Shuffle size={16} />
                <span>Toggle Shuffle</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-sub)' }}>S</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => useQueueStore.getState().cycleRepeat())}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <Repeat size={16} />
                <span>Cycle Repeat Mode</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-sub)' }}>R</span>
              </Command.Item>

              {currentTrackId && (
                <Command.Item
                  onSelect={() => runCommand(() => void useLikesStore.getState().toggleLike(currentTrackId))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    color: 'var(--text)',
                    fontSize: '14px',
                  }}
                  className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
                >
                  <Heart size={16} color="var(--accent)" />
                  <span>Like / Unlike Current Track</span>
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-sub)' }}>L</span>
                </Command.Item>
              )}
            </Command.Group>

            {/* Views & Modals */}
            <Command.Group
              heading="Views & Audio Tools"
              style={{
                fontSize: '11px',
                fontWeight: 'var(--font-bold)',
                color: 'var(--text-sub)',
                padding: '6px 10px',
                textTransform: 'uppercase',
              }}
            >
              <Command.Item
                onSelect={() => runCommand(() => useUIStore.getState().setFullscreenOpen(true))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <CornersOut size={16} />
                <span>Open Fullscreen Experience</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-sub)' }}>F</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => useUIStore.getState().setEqualizerOpen(true))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <Sliders size={16} />
                <span>Open 10-Band Equalizer</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-sub)' }}>E</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => useUIStore.getState().toggleRightPanel('lyrics'))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <MicrophoneStage size={16} />
                <span>Toggle Lyrics Panel</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-sub)' }}>Y</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => useUIStore.getState().toggleRightPanel('queue'))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <QueueIcon size={16} />
                <span>Toggle Playback Queue</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-sub)' }}>Q</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => navigate('/mini'))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <CornersOut size={16} />
                <span>Open Mini Player</span>
              </Command.Item>
            </Command.Group>

            {/* Navigation */}
            <Command.Group
              heading="Navigation"
              style={{
                fontSize: '11px',
                fontWeight: 'var(--font-bold)',
                color: 'var(--text-sub)',
                padding: '6px 10px',
                textTransform: 'uppercase',
              }}
            >
              <Command.Item
                onSelect={() => runCommand(() => navigate('/'))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <House size={16} />
                <span>Home</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => navigate('/songs'))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <MusicNotes size={16} />
                <span>Songs</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => navigate('/albums'))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <Disc size={16} />
                <span>Albums</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => navigate('/artists'))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <User size={16} />
                <span>Artists</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => navigate('/folders'))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <Folder size={16} />
                <span>Folders</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => navigate('/liked'))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <Heart size={16} color="var(--accent)" />
                <span>Liked Songs</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => navigate('/stats'))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <ChartBar size={16} />
                <span>Listening Stats (Wrapped)</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => navigate('/health'))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <FirstAid size={16} />
                <span>Library Health</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => navigate('/settings'))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <Gear size={16} />
                <span>Settings</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-sub)' }}>Ctrl + ,</span>
              </Command.Item>
            </Command.Group>

            {/* Quick Demo Seed */}
            <Command.Group
              heading="Developer & Demo"
              style={{
                fontSize: '11px',
                fontWeight: 'var(--font-bold)',
                color: 'var(--text-sub)',
                padding: '6px 10px',
                textTransform: 'uppercase',
              }}
            >
              <Command.Item
                onSelect={() =>
                  runCommand(() => {
                    toast.info('Seeding demo library with 400 tracks...');
                    void seedDemoData().then(() => toast.success('Demo library loaded!'));
                  })
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
                className="hover:bg-[var(--bg-card-hover)] aria-selected:bg-[var(--bg-card-hover)]"
              >
                <Sparkle size={16} color="var(--accent)" />
                <span>Load Demo Library (400 tracks + 90 days history)</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
};
