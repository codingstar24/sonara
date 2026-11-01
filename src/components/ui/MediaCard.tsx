import { type FC, useState } from 'react';
import { Play } from '@phosphor-icons/react';
import { Cover } from './Cover';

export interface MediaCardProps {
  title: string;
  subtitle?: string;
  artworkId?: string | null;
  isArtist?: boolean;
  onClick?: () => void;
  onPlay?: (e: React.MouseEvent) => void;
  className?: string;
}

export const MediaCard: FC<MediaCardProps> = ({
  title,
  subtitle,
  artworkId,
  isArtist = false,
  onClick,
  onPlay,
  className = '',
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`media-card ${className}`}
      style={{
        padding: '16px',
        borderRadius: 'var(--radius-card)',
        backgroundColor: hovered ? 'var(--bg-card-hover)' : 'var(--bg-card)',
        transition: 'background-color var(--transition-fast)',
        cursor: 'pointer',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      {/* Cover container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          marginBottom: '16px',
        }}
      >
        <Cover
          artworkId={artworkId}
          title={title}
          isArtist={isArtist}
          size="100%"
          style={{ width: '100%', height: '100%' }}
        />

        {/* Hover play button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay?.(e);
          }}
          aria-label={`Play ${title}`}
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            width: 48,
            height: 48,
            borderRadius: 'var(--radius-pill)',
            backgroundColor: 'var(--accent)',
            color: 'var(--text-on-accent)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-card)',
            cursor: 'pointer',
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translateY(0)' : 'translateY(8px)',
            transition: 'all 300ms cubic-bezier(0.3, 0, 0.4, 1)',
            pointerEvents: hovered ? 'auto' : 'none',
          }}
        >
          <Play size={22} weight="fill" style={{ marginLeft: 2 }} />
        </button>
      </div>

      {/* Info */}
      <div
        style={{
          fontSize: 'var(--text-title)',
          fontWeight: 'var(--font-heading)',
          color: 'var(--text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginBottom: '4px',
        }}
        title={title}
      >
        {title}
      </div>

      {subtitle && (
        <div
          style={{
            fontSize: 'var(--text-caption)',
            color: 'var(--text-sub)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.4,
          }}
          title={subtitle}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
};
