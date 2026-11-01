import { type FC, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Folder,
  Plus,
  Play,
  ArrowClockwise,
  Trash,
  FolderOpen,
  MusicNotes,
} from '@phosphor-icons/react';
import { db } from '@/db/schema';
import type { Source, TrackLite } from '@/db/types';
import { useLibraryStore, usePlayerStore } from '../stores';
import { useQueueStore } from '@/features/queue/queueStore';
import { importPipeline } from '@/features/import/importPipeline';
import { Button } from '@/components/ui/Button';
import { TrackRow } from '@/components/ui/TrackRow';
import { TrackContextMenu } from '@/components/ui/TrackContextMenu';
import { ImportModal } from '@/features/import/ImportModal';
import { useImportStore } from '@/features/import/useImportStore';
import { toast } from 'sonner';

export const FoldersPage: FC = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);

  const tracksMap = useLibraryStore((s) => s.tracks);
  const removeTracks = useLibraryStore((s) => s.removeTracks);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const [searchParams] = useSearchParams();
  const folderParamId = searchParams.get('id');

  // Load sources from database
  const loadSources = async () => {
    const list = (await db.sources.toArray()).filter(
      (s) => !s.id.startsWith('demo-') && !s.name.toLowerCase().includes('demo music')
    );
    setSources(list);
    if (folderParamId && list.some((s) => s.id === folderParamId)) {
      setSelectedSourceId(folderParamId);
    } else if (list.length > 0 && !selectedSourceId) {
      setSelectedSourceId(list[0]!.id);
    }
  };

  const isImportActive = useImportStore((s) => s.active);

  useEffect(() => {
    void loadSources();
  }, []);

  useEffect(() => {
    void loadSources();
  }, [tracksMap.size, folderParamId, isImportActive]);

  // Group tracks by source
  const sourceTracks = useMemo(() => {
    const map = new Map<string, TrackLite[]>();
    for (const t of tracksMap.values()) {
      const list = map.get(t.sourceId) || [];
      list.push(t);
      map.set(t.sourceId, list);
    }
    return map;
  }, [tracksMap]);

  // Build subfolder tree for selected source
  const currentTracks = useMemo(() => {
    if (!selectedSourceId) return [];
    const list = sourceTracks.get(selectedSourceId) || [];
    if (!selectedSubfolder) return list;
    return list.filter((t) => t.relPath.startsWith(selectedSubfolder));
  }, [selectedSourceId, selectedSubfolder, sourceTracks]);

  // Unique subfolders for selected source
  const subfolders = useMemo(() => {
    if (!selectedSourceId) return [];
    const list = sourceTracks.get(selectedSourceId) || [];
    const dirs = new Set<string>();

    for (const t of list) {
      const parts = t.relPath.split(/[/\\]/);
      if (parts.length > 1) {
        // Collect directory prefixes
        let prefix = '';
        for (let i = 0; i < parts.length - 1; i++) {
          prefix = prefix ? `${prefix}/${parts[i]}` : parts[i]!;
          dirs.add(prefix);
        }
      }
    }
    return Array.from(dirs).sort();
  }, [selectedSourceId, sourceTracks]);

  const handleRescanSource = async (source: Source) => {
    setScanningId(source.id);
    toast.info(`Rescanning folder "${source.name}"...`);
    try {
      await importPipeline.scanSource(source);
      await loadSources();
    } catch {
      toast.error('Rescan failed.');
    } finally {
      setScanningId(null);
    }
  };

  const handleRemoveSource = async (sourceId: string) => {
    const tracksToRemove = sourceTracks.get(sourceId) || [];
    if (tracksToRemove.length > 0) {
      await removeTracks(tracksToRemove.map((t) => t.id));
    }
    await db.sources.delete(sourceId);
    toast.success('Folder removed from library');
    await loadSources();
    if (selectedSourceId === sourceId) {
      setSelectedSourceId(null);
      setSelectedSubfolder(null);
    }
  };

  const handlePlayAll = () => {
    if (currentTracks.length === 0) return;
    const trackIds = currentTracks.map((t) => t.id);
    void useQueueStore.getState().playContext(
      'folder',
      selectedSourceId || 'folders',
      selectedSubfolder || 'Folder Tracks',
      trackIds,
      trackIds[0]
    );
  };


  return (
    <div className="route-enter" style={{ padding: '24px 32px', minHeight: '100%' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 'var(--text-display)',
              fontWeight: 'var(--font-display)',
              margin: '0 0 6px 0',
              letterSpacing: '-0.03em',
            }}
          >
            Folders
          </h1>
          <p style={{ margin: 0, color: 'var(--text-sub)', fontSize: 'var(--text-body)' }}>
            {sources.length} {sources.length === 1 ? 'folder connected' : 'folders connected'} •{' '}
            {tracksMap.size} total songs
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setImportModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} weight="bold" />
          <span>Add Folder</span>
        </Button>
      </div>

      {/* Main Content */}
      {sources.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 20px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-card)',
            border: '1px dashed var(--border)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: 'var(--bg-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
              marginBottom: '16px',
            }}
          >
            <Folder size={32} weight="fill" />
          </div>
          <h2 style={{ fontSize: 'var(--text-h2)', margin: '0 0 8px 0', color: 'var(--text)' }}>
            No folder sources connected
          </h2>
          <p
            style={{
              color: 'var(--text-sub)',
              fontSize: 'var(--text-body)',
              maxWidth: 420,
              marginBottom: '24px',
              lineHeight: 1.5,
            }}
          >
            Add your local music directory to browse your folder hierarchy, subfolders, and songs directly.
          </p>
          <Button variant="primary" onClick={() => setImportModalOpen(true)}>
            Connect Music Folder
          </Button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '280px 1fr',
            gap: '24px',
            minHeight: '600px',
          }}
        >
          {/* Left Column: Folders List & Subfolder Tree */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-card)',
              padding: '16px',
              border: '1px solid var(--border)',
              height: 'fit-content',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 'var(--font-bold)',
                color: 'var(--text-sub)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '4px',
              }}
            >
              Connected Folders
            </div>

            {sources.map((src) => {
              const count = sourceTracks.get(src.id)?.length || 0;
              const isSelected = selectedSourceId === src.id;

              return (
                <div
                  key={src.id}
                  onClick={() => {
                    setSelectedSourceId(src.id);
                    setSelectedSubfolder(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isSelected ? 'var(--bg-card-active)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 150ms ease',
                  }}
                  className="hover:bg-[var(--bg-card-hover)]"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <Folder size={20} weight={isSelected ? 'fill' : 'regular'} color="var(--accent)" />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: isSelected ? 'var(--font-bold)' : 'normal',
                          color: 'var(--text)',
                          fontSize: '14px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {src.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-sub)' }}>
                        {count} {count === 1 ? 'song' : 'songs'}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRescanSource(src);
                        }}
                        title="Rescan folder"
                        style={{ padding: 4 }}
                      >
                        <ArrowClockwise
                          size={15}
                          className={scanningId === src.id ? 'animate-spin' : ''}
                        />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRemoveSource(src.id);
                        }}
                        title="Remove folder"
                        style={{ padding: 4, color: '#EF4444' }}
                      >
                        <Trash size={15} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Subfolders Navigation */}
            {subfolders.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 'var(--font-bold)',
                    color: 'var(--text-sub)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginTop: '16px',
                    marginBottom: '4px',
                    borderTop: '1px solid var(--border)',
                    paddingTop: '12px',
                  }}
                >
                  Subdirectories
                </div>

                <div
                  onClick={() => setSelectedSubfolder(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: selectedSubfolder === null ? 'var(--bg-elevated)' : 'transparent',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--text)',
                  }}
                  className="hover:bg-[var(--bg-card-hover)]"
                >
                  <FolderOpen size={16} color="var(--text-sub)" />
                  <span>All Subfolders</span>
                </div>

                {subfolders.map((folder) => {
                  const isSubSelected = selectedSubfolder === folder;
                  const count =
                    (sourceTracks.get(selectedSourceId!) || []).filter((t) =>
                      t.relPath.startsWith(folder)
                    ).length;

                  return (
                    <div
                      key={folder}
                      onClick={() => setSelectedSubfolder(folder)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isSubSelected ? 'var(--bg-elevated)' : 'transparent',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: 'var(--text)',
                      }}
                      className="hover:bg-[var(--bg-card-hover)]"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <Folder size={16} color="var(--text-sub)" />
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {folder}
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-sub)' }}>{count}</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Right Column: Tracks in Current Folder */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-card)',
              padding: '20px 24px',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header info */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '16px',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'var(--font-bold)', color: 'var(--text)' }}>
                  {selectedSubfolder || sources.find((s) => s.id === selectedSourceId)?.name || 'Tracks'}
                </h2>
                <div style={{ fontSize: '13px', color: 'var(--text-sub)', marginTop: '4px' }}>
                  {sources.find((s) => s.id === selectedSourceId)?.path || ''}
                  {selectedSubfolder ? ` / ${selectedSubfolder}` : ''}
                </div>
              </div>

              {currentTracks.length > 0 && (
                <button
                  onClick={handlePlayAll}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#000',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-btn)',
                    transition: 'transform 150ms ease',
                  }}
                  className="hover:scale-105"
                  title="Play all tracks in folder"
                >
                  <Play size={20} weight="fill" />
                </button>
              )}
            </div>

            {/* Track list */}
            {currentTracks.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '60px 20px',
                  color: 'var(--text-sub)',
                }}
              >
                <MusicNotes size={40} style={{ marginBottom: '12px' }} />
                <div>No tracks found in this folder</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {currentTracks.map((track, idx) => (
                  <TrackContextMenu key={track.id} track={track}>
                    <TrackRow
                      track={track}
                      index={idx}
                      isPlaying={currentTrackId === track.id && isPlaying}
                      isCurrent={currentTrackId === track.id}
                      onPlay={() => {
                        const trackIds = currentTracks.map((t) => t.id);
                        void useQueueStore.getState().playContext(
                          'folder',
                          selectedSourceId || 'folders',
                          selectedSubfolder || 'Folder Tracks',
                          trackIds,
                          track.id
                        );
                      }}
                    />
                  </TrackContextMenu>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import Modal */}
      <ImportModal open={importModalOpen} onOpenChange={setImportModalOpen} />
    </div>
  );
};
