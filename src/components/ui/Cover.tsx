import { type FC, useState, useEffect } from 'react';
import { MusicNotes, User } from '@phosphor-icons/react';
import { db } from '@/db/schema';
import { safeBlobUrl } from '@/lib/blobUrl';

export interface CoverProps {
  artworkId?: string | null;
  size?: number | string;
  title?: string;
  isArtist?: boolean;
  rounded?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

// Generate deterministic gradient from string
function getDeterministicGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 45) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 65%, 28%), hsl(${hue2}, 75%, 15%))`;
}

export const Cover: FC<CoverProps> = ({
  artworkId,
  size = 48,
  title = '',
  isArtist = false,
  rounded,
  className = '',
  style,
  onClick,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!artworkId) {
      setBlobUrl(null);
      return;
    }

    let active = true;
    let url: string | null = null;

    db.artwork.get(artworkId).then((art) => {
      if (!active) return;
      const safe = safeBlobUrl(art?.thumb) || safeBlobUrl(art?.full);
      if (safe) {
        url = safe;
        setBlobUrl(url);
        setError(false);
      } else {
        setError(true);
      }
    }).catch(() => {
      if (active) setError(true);
    });

    return () => {
      active = false;
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    };
  }, [artworkId]);

  const borderRadius = rounded === false
    ? '0px'
    : isArtist
    ? 'var(--radius-pill)'
    : 'var(--radius-thumb)';
  const gradient = getDeterministicGradient(title || artworkId || 'Sonara');

  if (blobUrl && !error) {
    return (
      <img
        src={blobUrl}
        alt={title}
        onError={() => setError(true)}
        className={className}
        onClick={onClick}
        style={{
          width: size,
          height: size,
          minWidth: size,
          borderRadius,
          objectFit: 'cover',
          display: 'block',
          boxShadow: 'var(--shadow-card)',
          ...style,
        }}
      />
    );
  }

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius,
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255, 255, 255, 0.7)',
        boxShadow: 'var(--shadow-card)',
        userSelect: 'none',
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      {isArtist ? (
        <User size={typeof size === 'number' ? Math.round(size * 0.5) : 24} weight="bold" />
      ) : (
        <MusicNotes size={typeof size === 'number' ? Math.round(size * 0.45) : 24} weight="bold" />
      )}
    </div>
  );
};
