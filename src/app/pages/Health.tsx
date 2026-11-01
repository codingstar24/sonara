import { type FC, useState, useMemo } from 'react';
import {
  FirstAid,
  Copy,
  WarningCircle,
  ImageSquare,
  FileX,
  Trash,
  CheckCircle,
  Timer,
  Play,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { TrackLite } from '@/db/types';
import { useLibraryStore } from '@/app/stores';
import { Cover } from '@/components/ui/Cover';
import { useQueueStore } from '@/features/queue/queueStore';

type HealthCategory = 'duplicates' | 'missing' | 'artwork' | 'short' | 'unsupported';

export const HealthPage: FC = () => {
  const libraryTracks = useLibraryStore((s) => s.tracks);
  const totalTracks = useLibraryStore((s) => s.totalTracks);
  const removeTracks = useLibraryStore((s) => s.removeTracks);

  const [activeCategory, setActiveCategory] = useState<HealthCategory>('duplicates');

  // Compute health analytics
  const { duplicates, missing, noArtwork, shortTracks, unsupported } = useMemo(() => {
    const tracksList = Array.from(libraryTracks.values());

    // 1. Duplicates by fingerprint
    const fpMap = new Map<string, TrackLite[]>();
    for (const t of tracksList) {
      if (t.fingerprint) {
        if (!fpMap.has(t.fingerprint)) fpMap.set(t.fingerprint, []);
        fpMap.get(t.fingerprint)!.push(t);
      }
    }

    const duplicatesList: Array<{ fingerprint: string; tracks: TrackLite[] }> = [];
    for (const [fp, group] of fpMap.entries()) {
      if (group.length > 1) {
        duplicatesList.push({ fingerprint: fp, tracks: group });
      }
    }

    // 2. Missing files
    const missingList = tracksList.filter((t) => t.missing);

    // 3. Missing artwork
    const noArtworkList = tracksList.filter((t) => !t.artworkId);

    // 4. Very short tracks (< 15s)
    const shortList = tracksList.filter((t) => t.duration > 0 && t.duration < 15);

    // 5. Unsupported
    const unsupportedList = tracksList.filter((t) => t.unsupported);

    return {
      duplicates: duplicatesList,
      missing: missingList,
      noArtwork: noArtworkList,
      shortTracks: shortList,
      unsupported: unsupportedList,
    };
  }, [libraryTracks]);

  // Handle Pruning duplicate database rows (keeps the 1st track, removes subsequent duplicates)
  const handlePruneDuplicates = async () => {
    if (duplicates.length === 0) return;
    const idsToRemove: string[] = [];

    for (const group of duplicates) {
      // Keep group[0], remove the rest
      for (let i = 1; i < group.tracks.length; i++) {
        idsToRemove.push(group.tracks[i]!.id);
      }
    }

    await removeTracks(idsToRemove);
    toast.success(`Removed ${idsToRemove.length} duplicate library entries.`);
  };

  // Handle Pruning all missing tracks
  const handlePruneMissing = async () => {
    if (missing.length === 0) return;
    const ids = missing.map((t) => t.id);
    await removeTracks(ids);
    toast.success(`Removed ${ids.length} missing tracks from database.`);
  };

  const handlePlay = (id: string) => {
    void useQueueStore.getState().playNow(id);
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="route-enter" style={{ padding: '24px 32px', paddingBottom: '64px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <FirstAid size={32} color="var(--accent)" weight="fill" />
        <h1
          style={{
            fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: 'var(--font-display)',
            letterSpacing: '-0.03em',
            margin: 0,
          }}
        >
          Library Health
        </h1>
      </div>
      <p style={{ color: 'var(--text-sub)', marginBottom: '32px', fontSize: 'var(--text-body)' }}>
        Analyze library integrity, prune duplicate database records, and detect missing audio files.
        File safety guarantee: removing entries only deletes app database rows; local files are never touched.
      </p>

      {/* Health Overview Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '36px',
        }}
      >
        {[
          {
            key: 'duplicates' as const,
            icon: <Copy size={24} color="#3D91F4" weight="fill" />,
            title: 'Duplicates',
            count: `${duplicates.length} groups`,
            desc: 'Shared audio fingerprints',
          },
          {
            key: 'missing' as const,
            icon: <WarningCircle size={24} color="#FF4E50" weight="fill" />,
            title: 'Missing Files',
            count: `${missing.length} missing`,
            desc: 'Moved or renamed',
          },
          {
            key: 'artwork' as const,
            icon: <ImageSquare size={24} color="#F59E0B" weight="fill" />,
            title: 'Missing Artwork',
            count: `${noArtwork.length} tracks`,
            desc: 'No embedded cover',
          },
          {
            key: 'short' as const,
            icon: <Timer size={24} color="#A855F7" weight="fill" />,
            title: 'Short Tracks',
            count: `${shortTracks.length} tracks`,
            desc: 'Under 15 seconds',
          },
          {
            key: 'unsupported' as const,
            icon: <FileX size={24} color="#EC4899" weight="fill" />,
            title: 'Unsupported',
            count: `${unsupported.length} files`,
            desc: 'Need format conversion',
          },
        ].map((card) => {
          const isSelected = activeCategory === card.key;
          return (
            <div
              key={card.key}
              onClick={() => setActiveCategory(card.key)}
              style={{
                padding: '20px',
                backgroundColor: isSelected ? 'var(--bg-elevated)' : 'var(--bg-card)',
                border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                borderRadius: 'var(--radius-card)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
              className="hover:bg-[var(--bg-card-hover)]"
            >
              <div style={{ marginBottom: '12px' }}>{card.icon}</div>
              <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 'var(--font-bold)', margin: '0 0 4px 0' }}>
                {card.title}
              </h3>
              <div style={{ fontSize: 'var(--text-h3)', color: 'var(--text)', fontWeight: 'var(--font-bold)' }}>
                {card.count}
              </div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)', marginTop: '4px' }}>
                {card.desc}
              </div>
            </div>
          );
        })}
      </div>

      {/* Category Detail Section */}
      <div
        style={{
          padding: '24px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-card)',
        }}
      >
        {activeCategory === 'duplicates' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: 'var(--text-h2)', margin: 0, fontWeight: 'var(--font-bold)' }}>
                  Duplicate Audio Tracks
                </h2>
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
                  Tracks with identical decoded audio fingerprints
                </span>
              </div>

              {duplicates.length > 0 && (
                <button
                  onClick={() => void handlePruneDuplicates()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 18px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: 'var(--accent)',
                    border: 'none',
                    color: '#000',
                    fontWeight: 'var(--font-bold)',
                    cursor: 'pointer',
                  }}
                >
                  <Trash size={16} weight="fill" />
                  <span>Prune Duplicate DB Records</span>
                </button>
              )}
            </div>

            {duplicates.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', padding: '24px 0' }}>
                <CheckCircle size={24} weight="fill" />
                <span>No duplicate audio files detected in your library!</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {duplicates.map((group, idx) => (
                  <div
                    key={group.fingerprint}
                    style={{
                      padding: '16px',
                      backgroundColor: 'var(--bg-elevated)',
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ fontSize: '11px', color: 'var(--text-sub)', marginBottom: '8px', textTransform: 'uppercase' }}>
                      Duplicate Cluster #{idx + 1} ({group.tracks.length} copies)
                    </div>
                    {group.tracks.map((t, tIdx) => (
                      <div
                        key={t.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 0',
                          borderTop: tIdx > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <Cover artworkId={t.artworkId} title={t.title} size={36} />
                          <div>
                            <div style={{ fontWeight: 'var(--font-bold)', fontSize: '14px' }}>
                              {t.title} {tIdx === 0 && <span style={{ color: 'var(--accent)', fontSize: '11px' }}>(Keep)</span>}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-sub)' }}>
                              {t.artist} · {t.relPath}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handlePlay(t.id)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-sub)', cursor: 'pointer' }}
                          className="hover:text-white"
                        >
                          <Play size={16} weight="fill" />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeCategory === 'missing' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: 'var(--text-h2)', margin: 0, fontWeight: 'var(--font-bold)' }}>
                  Missing Audio Files
                </h2>
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
                  Files that could not be found at their expected local paths
                </span>
              </div>

              {missing.length > 0 && (
                <button
                  onClick={() => void handlePruneMissing()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 18px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: '#FF4E50',
                    border: 'none',
                    color: '#FFF',
                    fontWeight: 'var(--font-bold)',
                    cursor: 'pointer',
                  }}
                >
                  <Trash size={16} weight="fill" />
                  <span>Remove Missing DB Records</span>
                </button>
              )}
            </div>

            {missing.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', padding: '24px 0' }}>
                <CheckCircle size={24} weight="fill" />
                <span>All {totalTracks} tracks in your library are connected and healthy!</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {missing.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-elevated)',
                      borderRadius: 6,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'var(--font-bold)', color: '#FF4E50' }}>{t.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-sub)' }}>
                        {t.artist} · {t.relPath}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeCategory === 'artwork' && (
          <div>
            <h2 style={{ fontSize: 'var(--text-h2)', margin: '0 0 4px 0', fontWeight: 'var(--font-bold)' }}>
              Tracks Without Artwork
            </h2>
            <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)', marginBottom: '20px' }}>
              These tracks will display algorithmic color gradient placeholders.
            </p>

            {noArtwork.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', padding: '24px 0' }}>
                <CheckCircle size={24} weight="fill" />
                <span>Every track in your library has cover artwork!</span>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                {noArtwork.slice(0, 30).map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handlePlay(t.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px',
                      backgroundColor: 'var(--bg-elevated)',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                    className="hover:bg-[var(--bg-card-hover)]"
                  >
                    <Cover artworkId={null} title={t.title} size={40} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 'var(--font-bold)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.artist}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeCategory === 'short' && (
          <div>
            <h2 style={{ fontSize: 'var(--text-h2)', margin: '0 0 4px 0', fontWeight: 'var(--font-bold)' }}>
              Short Audio Tracks (&lt; 15 seconds)
            </h2>
            <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)', marginBottom: '20px' }}>
              These may be ringtones, sound effects, or voice memos. You can exclude them in Settings.
            </p>

            {shortTracks.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', padding: '24px 0' }}>
                <CheckCircle size={24} weight="fill" />
                <span>No short tracks found in your library.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {shortTracks.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-elevated)',
                      borderRadius: 6,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'var(--font-bold)', fontSize: '14px' }}>{t.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-sub)' }}>
                        {t.artist} · {t.relPath}
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-sub)', fontWeight: 'var(--font-bold)' }}>
                      {formatDuration(t.duration)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeCategory === 'unsupported' && (
          <div>
            <h2 style={{ fontSize: 'var(--text-h2)', margin: '0 0 4px 0', fontWeight: 'var(--font-bold)' }}>
              Unsupported Audio Formats
            </h2>
            <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)', marginBottom: '20px' }}>
              Formats like WMA or DSF require external transcoders or conversion to FLAC/MP3 for playback in web environments.
            </p>

            {unsupported.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', padding: '24px 0' }}>
                <CheckCircle size={24} weight="fill" />
                <span>All tracks in your library are in web-supported audio formats!</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {unsupported.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-elevated)',
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ fontWeight: 'var(--font-bold)' }}>{t.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-sub)' }}>{t.relPath}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
