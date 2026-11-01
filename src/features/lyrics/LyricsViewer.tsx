import { type FC, useState, useEffect, useRef } from 'react';
import { MicrophoneStage, Plus, Clock, FloppyDisk, Trash, PencilSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { db } from '@/db/schema';
import type { StoredLyrics } from '@/db/types';
import { usePlayerStore } from '@/app/stores';
import { useQueueStore } from '@/features/queue/queueStore';
import { parseLrc, findActiveLyricIndex, type ParsedLyrics } from './lrcParser';
import { playbackClock } from '@/engine/clock';

interface LyricsViewerProps {
  fontSize?: 'normal' | 'large';
  onSeek?: (seconds: number) => void;
}

export const LyricsViewer: FC<LyricsViewerProps> = ({ fontSize = 'normal', onSeek }) => {
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const [storedLyrics, setStoredLyrics] = useState<StoredLyrics | null>(null);
  const [parsed, setParsed] = useState<ParsedLyrics | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [offsetMs, setOffsetMs] = useState(0);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorText, setEditorText] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 1. Load lyrics from db
  useEffect(() => {
    if (!currentTrackId) {
      setStoredLyrics(null);
      setParsed(null);
      return;
    }

    let active = true;
    db.lyrics.get(currentTrackId).then((item) => {
      if (!active) return;
      if (item) {
        setStoredLyrics(item);
        setOffsetMs(item.offset || 0);
        setParsed(parseLrc(item.content));
      } else {
        setStoredLyrics(null);
        setParsed(null);
        setOffsetMs(0);
      }
    });

    return () => {
      active = false;
    };
  }, [currentTrackId]);

  // 2. Clock listener for smooth lyric syncing
  useEffect(() => {
    let animId: number;

    const tick = () => {
      const timeS = playbackClock.getCurrentTime();
      setCurrentTimeMs(Math.round(timeS * 1000));
      animId = requestAnimationFrame(tick);
    };

    if (isPlaying) {
      animId = requestAnimationFrame(tick);
    } else {
      const timeS = playbackClock.getCurrentTime();
      setCurrentTimeMs(Math.round(timeS * 1000));
    }

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying]);

  // 3. Auto-scroll active line to center
  const activeIndex = parsed?.isSynced
    ? findActiveLyricIndex(parsed.lines, currentTimeMs, offsetMs)
    : -1;

  useEffect(() => {
    if (activeIndex >= 0 && lineRefs.current[activeIndex] && containerRef.current) {
      const lineEl = lineRefs.current[activeIndex]!;
      const containerEl = containerRef.current;

      const containerHeight = containerEl.clientHeight;
      const lineTop = lineEl.offsetTop;
      const lineHeight = lineEl.clientHeight;

      const targetScroll = lineTop - containerHeight / 2 + lineHeight / 2;
      containerEl.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    }
  }, [activeIndex]);

  // 4. Offset adjustments (+/-0.5s)
  const handleAdjustOffset = async (deltaMs: number) => {
    if (!currentTrackId || !storedLyrics) return;
    const newOffset = offsetMs + deltaMs;
    setOffsetMs(newOffset);

    try {
      await db.lyrics.update(currentTrackId, {
        offset: newOffset,
        updatedAt: Date.now(),
      });
      toast.success(`Offset adjusted to ${newOffset > 0 ? '+' : ''}${newOffset}ms`);
    } catch (e) {
      console.warn('Failed saving lyric offset:', e);
    }
  };

  // 5. Save lyrics from editor
  const handleSaveLyrics = async () => {
    if (!currentTrackId || !editorText.trim()) return;

    const parsedTest = parseLrc(editorText);
    const item: StoredLyrics = {
      trackId: currentTrackId,
      kind: parsedTest.isSynced ? 'synced' : 'plain',
      content: editorText.trim(),
      offset: parsedTest.offsetMs || 0,
      updatedAt: Date.now(),
    };

    await db.lyrics.put(item);
    setStoredLyrics(item);
    setOffsetMs(item.offset);
    setParsed(parsedTest);
    setIsEditorOpen(false);
    toast.success(parsedTest.isSynced ? 'Synced lyrics saved!' : 'Lyrics saved!');
  };

  // 6. Delete lyrics
  const handleDeleteLyrics = async () => {
    if (!currentTrackId) return;
    await db.lyrics.delete(currentTrackId);
    setStoredLyrics(null);
    setParsed(null);
    toast.success('Lyrics removed');
  };

  const handleLineClick = (lineTimeMs: number) => {
    const sec = Math.max(0, (lineTimeMs + offsetMs) / 1000);
    if (onSeek) {
      onSeek(sec);
    } else {
      useQueueStore.getState().seek(sec);
    }
  };

  if (!currentTrackId) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-sub)',
          textAlign: 'center',
          padding: '32px',
        }}
      >
        <MicrophoneStage size={48} style={{ color: 'var(--text-faint)', marginBottom: 16 }} />
        <p style={{ fontWeight: 'var(--font-bold)', color: 'var(--text)' }}>No track playing</p>
        <p style={{ fontSize: 'var(--text-caption)' }}>Play a song to view or add lyrics</p>
      </div>
    );
  }

  // Empty state: No lyrics available
  if (!parsed || parsed.lines.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          textAlign: 'center',
          padding: '32px 16px',
        }}
      >
        <MicrophoneStage size={48} style={{ color: 'var(--text-faint)', marginBottom: 16 }} />
        <p style={{ fontWeight: 'var(--font-bold)', color: 'var(--text)', marginBottom: 6 }}>
          No lyrics available
        </p>
        <p style={{ color: 'var(--text-sub)', fontSize: 'var(--text-caption)', maxWidth: 280, marginBottom: 20 }}>
          Add synced .lrc or plain text lyrics for this song to sing along.
        </p>

        <button
          onClick={() => {
            setEditorText('');
            setIsEditorOpen(true);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: 'var(--bg-elevated)',
            border: 'none',
            color: 'var(--text)',
            fontSize: 'var(--text-caption)',
            fontWeight: 'var(--font-bold)',
            cursor: 'pointer',
          }}
          className="hover:bg-[var(--accent)] hover:text-black transition-colors"
        >
          <Plus size={16} />
          <span>Add Lyrics</span>
        </button>

        {isEditorOpen && (
          <LyricsEditorModal
            text={editorText}
            onChange={setEditorText}
            onSave={handleSaveLyrics}
            onClose={() => setIsEditorOpen(false)}
          />
        )}
      </div>
    );
  }

  const baseFontSize = fontSize === 'large' ? 24 : 17;
  const activeFontSize = fontSize === 'large' ? 32 : 22;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Controls Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          fontSize: '12px',
          color: 'var(--text-sub)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {parsed.isSynced && (
            <>
              <Clock size={14} />
              <span>Offset: {offsetMs > 0 ? `+${offsetMs}` : offsetMs}ms</span>
              <button
                onClick={() => void handleAdjustOffset(-500)}
                title="Shift earlier by 0.5s"
                style={{
                  background: 'var(--bg-elevated)',
                  border: 'none',
                  color: 'var(--text)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                -0.5s
              </button>
              <button
                onClick={() => void handleAdjustOffset(500)}
                title="Shift later by 0.5s"
                style={{
                  background: 'var(--bg-elevated)',
                  border: 'none',
                  color: 'var(--text)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                +0.5s
              </button>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => {
              setEditorText(storedLyrics?.content || '');
              setIsEditorOpen(true);
            }}
            title="Edit lyrics"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-sub)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            className="hover:text-white"
          >
            <PencilSimple size={14} />
            <span>Edit</span>
          </button>

          <button
            onClick={() => void handleDeleteLyrics()}
            title="Delete lyrics"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-sub)',
              cursor: 'pointer',
            }}
            className="hover:text-red-400"
          >
            <Trash size={14} />
          </button>
        </div>
      </div>

      {/* Lyrics Scrollable Lines */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '60px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          scrollBehavior: 'smooth',
        }}
      >
        {parsed.lines.map((line, idx) => {
          const isActive = parsed.isSynced && idx === activeIndex;
          return (
            <div
              key={idx}
              ref={(el) => {
                lineRefs.current[idx] = el;
              }}
              onClick={() => {
                if (parsed.isSynced) handleLineClick(line.timeMs);
              }}
              style={{
                fontSize: isActive ? activeFontSize : baseFontSize,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)',
                transform: isActive ? 'scale(1.02)' : 'scale(1)',
                transformOrigin: 'left center',
                transition: 'all 0.25s ease',
                cursor: parsed.isSynced ? 'pointer' : 'default',
                lineHeight: 1.4,
                userSelect: 'none',
              }}
              className={parsed.isSynced ? 'hover:text-white transition-colors' : ''}
            >
              {line.text || '♪'}
            </div>
          );
        })}
      </div>

      {/* Modal for adding/editing lyrics */}
      {isEditorOpen && (
        <LyricsEditorModal
          text={editorText}
          onChange={setEditorText}
          onSave={handleSaveLyrics}
          onClose={() => setIsEditorOpen(false)}
        />
      )}
    </div>
  );
};

interface LyricsEditorModalProps {
  text: string;
  onChange: (val: string) => void;
  onSave: () => void;
  onClose: () => void;
}

const LyricsEditorModal: FC<LyricsEditorModalProps> = ({ text, onChange, onSave, onClose }) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 600,
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 'var(--text-h3)', color: 'var(--text)' }}>
          Edit / Paste Lyrics
        </h3>
        <p style={{ margin: 0, fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
          Paste standard timestamped .LRC lyrics or plain text. Timestamps like [01:23.45] enable synchronized auto-scrolling.
        </p>

        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="[00:12.50]Line 1 of lyrics..."
          rows={12}
          style={{
            width: '100%',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '12px',
            color: 'var(--text)',
            fontSize: '13px',
            fontFamily: 'monospace',
            resize: 'vertical',
            outline: 'none',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontWeight: 'var(--font-bold)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 20px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'var(--accent)',
              border: 'none',
              color: '#000',
              cursor: 'pointer',
              fontWeight: 'var(--font-bold)',
            }}
          >
            <FloppyDisk size={16} weight="fill" />
            <span>Save Lyrics</span>
          </button>
        </div>
      </div>
    </div>
  );
};
