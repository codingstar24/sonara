import { type FC, useState } from 'react';
import { Play, Pause, Heart, DotsThree } from '@phosphor-icons/react';
import { Cover } from './Cover';
import type { TrackLite } from '@/db/types';

export interface TrackRowProps {
  track: TrackLite;
  index: number;
  isPlaying?: boolean;
  isCurrent?: boolean;
  isLiked?: boolean;
  selected?: boolean;
  compact?: boolean;
  onPlay?: () => void;
  onLikeToggle?: () => void;
  onSelect?: (e: React.MouseEvent) => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const TrackRow: FC<TrackRowProps> = ({
  track,
  index,
  isPlaying = false,
  isCurrent = false,
  isLiked = false,
  selected = false,
  compact = false,
  onPlay,
  onLikeToggle,
  onSelect,
  onDoubleClick,
  onContextMenu,
}) => {
  const [hovered, setHovered] = useState(false);
  const rowHeight = compact ? 36 : 56;

  return (
    <div
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="row"
      aria-selected={selected}
      tabIndex={0}
      style={{
        display: 'grid',
        gridTemplateColumns: '40px minmax(200px, 4fr) minmax(120px, 2fr) 100px 40px',
        alignItems: 'center',
        padding: '0 16px',
        height: rowHeight,
        borderRadius: 'var(--radius-sm)',
        backgroundColor: selected
          ? 'var(--bg-row-selected)'
          : hovered
            ? 'var(--bg-row-hover)'
            : 'transparent',
        cursor: 'default',
        userSelect: 'none',
        gap: '16px',
        fontSize: 'var(--text-body)',
        color: 'var(--text-sub)',
        opacity: track.missing ? 0.4 : 1,
        transition: 'background-color var(--transition-fast)',
      }}
    >
      {/* Col 1: # or Play/Pause / Equalizer glyph */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
        }}
      >
        {hovered ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay?.();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text)',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isCurrent && isPlaying ? (
              <Pause size={16} weight="fill" />
            ) : (
              <Play size={16} weight="fill" />
            )}
          </button>
        ) : isCurrent ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '2px',
              height: '14px',
            }}
          >
            <span
              style={{
                width: 2,
                height: isPlaying ? '12px' : '4px',
                background: 'var(--accent)',
                animation: isPlaying ? 'equalizerBounce 0.8s infinite alternate' : 'none',
              }}
            />
            <span
              style={{
                width: 2,
                height: isPlaying ? '14px' : '8px',
                background: 'var(--accent)',
                animation: isPlaying ? 'equalizerBounce 1.1s infinite alternate 0.2s' : 'none',
              }}
            />
            <span
              style={{
                width: 2,
                height: isPlaying ? '10px' : '6px',
                background: 'var(--accent)',
                animation: isPlaying ? 'equalizerBounce 0.9s infinite alternate 0.4s' : 'none',
              }}
            />
          </div>
        ) : (
          <span style={{ fontSize: 'var(--text-caption)' }}>{index + 1}</span>
        )}
      </div>

      {/* Col 2: Cover + Title + Artist */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        {!compact && (
          <Cover
            artworkId={track.artworkId}
            title={track.title}
            size={40}
            style={{ flexShrink: 0 }}
          />
        )}
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
          <div
            style={{
              color: isCurrent ? 'var(--accent)' : 'var(--text)',
              fontSize: 'var(--text-body)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={track.title}
          >
            {track.title}
          </div>
          <div
            style={{
              fontSize: 'var(--text-caption)',
              color: 'var(--text-sub)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={track.artist}
          >
            {track.artist}
          </div>
        </div>
      </div>

      {/* Col 3: Album */}
      <div
        style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontSize: 'var(--text-body)',
        }}
        title={track.album}
      >
        {track.album}
      </div>

      {/* Col 4: Heart + Duration */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
        {(hovered || isLiked) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLikeToggle?.();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: isLiked ? 'var(--accent)' : 'var(--text-sub)',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Heart size={16} weight={isLiked ? 'fill' : 'regular'} />
          </button>
        )}
        <span style={{ fontSize: 'var(--text-caption)', tabularNums: true } as React.CSSProperties}>
          {formatDuration(track.duration)}
        </span>
      </div>

      {/* Col 5: Menu button */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {hovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onContextMenu?.(e);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-sub)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <DotsThree size={20} weight="bold" />
          </button>
        )}
      </div>
    </div>
  );
};
