import { type FC, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { RightPanel } from './RightPanel';
import { PlayerBar } from './PlayerBar';
import { useUIStore, useSettingsStore, useLibraryStore } from './stores';

// Pages
import { HomePage } from './pages/Home';
import { SearchPage } from './pages/Search';
import { SongsPage } from './pages/Songs';
import { AlbumsPage } from './pages/Albums';
import { ArtistsPage } from './pages/Artists';
import { FoldersPage } from './pages/Folders';
import { LikedPage } from './pages/Liked';
import { RecentPage } from './pages/Recent';
import { PlaylistPage } from './pages/Playlist';
import { AlbumPage } from './pages/Album';
import { ArtistPage } from './pages/Artist';
import { StatsPage } from './pages/Stats';
import { HealthPage } from './pages/Health';
import { SettingsPage } from './pages/Settings';
import { MiniPlayerPage } from './pages/Mini';
import { ReconnectBanner } from '@/features/import/ReconnectBanner';
import { ImportProgressBar } from '@/features/import/ImportProgressBar';
import { importPipeline } from '@/features/import/importPipeline';
import { useKeyboardShortcuts } from '@/features/player/useKeyboardShortcuts';
import { useQueueStore } from '@/features/queue/queueStore';
import { useLikesStore } from '@/features/likes/likesStore';
import { usePlaylistStore } from '@/features/playlists/playlistStore';
import { FullscreenModal } from '@/features/player/FullscreenModal';
import { EqualizerModal } from '@/features/audio/EqualizerModal';
import { CommandPalette } from '@/components/ui/CommandPalette';

export const App: FC = () => {
  useKeyboardShortcuts();
  const location = useLocation();
  const theme = useSettingsStore((s) => s.theme);
  const accent = useSettingsStore((s) => s.accent);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const dragOver = useUIStore((s) => s.dragOver);
  const setDragOver = useUIStore((s) => s.setDragOver);
  const setWindowWidth = useUIStore((s) => s.setWindowWidth);
  const fullscreenOpen = useUIStore((s) => s.fullscreenOpen);
  const setFullscreenOpen = useUIStore((s) => s.setFullscreenOpen);
  const equalizerOpen = useUIStore((s) => s.equalizerOpen);
  const setEqualizerOpen = useUIStore((s) => s.setEqualizerOpen);

  // Initialize settings, library hydration, persisted queue, and resize listeners
  useEffect(() => {
    void useSettingsStore.getState().load();
    void useLibraryStore.getState().hydrate();
    void useQueueStore.getState().loadPersisted();
    void useLikesStore.getState().hydrate();
    void usePlaylistStore.getState().hydrate();

    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth < 1100 && useUIStore.getState().rightPanelOpen) {
        useUIStore.getState().setRightPanelOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setWindowWidth]);

  // Apply theme and accent color to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.setProperty('--accent', accent);
  }, [theme, accent]);

  // Drag and drop events for file/folder import
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!e.relatedTarget) {
        setDragOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      const files = Array.from(e.dataTransfer?.files ?? []);
      if (!files.length) return;

      for (const file of files) {
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.m3u') || lower.endsWith('.m3u8') || lower.endsWith('.pls')) {
          void importPipeline.importPlaylist(file);
        }
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [setDragOver]);

  // Mini player standalone route
  if (location.pathname === '/mini') {
    return (
      <TooltipProvider>
        <MiniPlayerPage />
        <Toaster theme="dark" position="bottom-center" />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div
        className="app-shell"
        style={{
          display: 'grid',
          gridTemplateRows: '56px 1fr 80px',
          gridTemplateColumns: '1fr',
          height: '100vh',
          width: '100vw',
          backgroundColor: 'var(--bg-base)',
          padding: '8px',
          gap: '8px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Top Bar */}
        <TopBar />

        {/* Middle row: Sidebar + Main Content + Right Panel */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            minHeight: 0,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Sidebar />

          {/* Main scrollable panel */}
          <main
            id="main-view"
            tabIndex={-1}
            style={{
              flex: 1,
              backgroundColor: 'var(--bg-panel)',
              borderRadius: 'var(--radius-panel)',
              overflowY: 'auto',
              overflowX: 'hidden',
              position: 'relative',
              outline: 'none',
            }}
          >
            <ReconnectBanner />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/songs" element={<SongsPage />} />
              <Route path="/albums" element={<AlbumsPage />} />
              <Route path="/artists" element={<ArtistsPage />} />
              <Route path="/folders" element={<FoldersPage />} />
              <Route path="/liked" element={<LikedPage />} />
              <Route path="/recent" element={<RecentPage />} />
              <Route path="/playlist/:id" element={<PlaylistPage />} />
              <Route path="/album/:id" element={<AlbumPage />} />
              <Route path="/artist/:id" element={<ArtistPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/health" element={<HealthPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>

          {rightPanelOpen && <RightPanel />}
        </div>

        {/* Bottom Player Bar */}
        <PlayerBar />

        {/* Drag and Drop Overlay */}
        {dragOver && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              pointerEvents: 'none',
              border: '2px dashed var(--accent)',
              borderRadius: 'var(--radius-panel)',
              margin: '8px',
            }}
          >
            <h2 style={{ fontSize: 'var(--text-display)', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>
              Drop audio files or folders
            </h2>
            <p style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)' }}>
              Add MP3, FLAC, WAV, AAC, OGG, or playlists to your library
            </p>
          </div>
        )}

        <ImportProgressBar />
        {/* Global Toast notifications */}
        <Toaster theme="dark" position="bottom-center" />

        {/* Immersive Modals */}
        <FullscreenModal isOpen={fullscreenOpen} onClose={() => setFullscreenOpen(false)} />
        <EqualizerModal isOpen={equalizerOpen} onClose={() => setEqualizerOpen(false)} />
        <CommandPalette />
      </div>
    </TooltipProvider>
  );
};
