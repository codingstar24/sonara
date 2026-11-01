import type { FC } from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Sonara logo — a rounded waveform glyph in the accent color.
 * Three rounded bars of varying height suggesting a sound wave.
 */
export const SonaraLogo: FC<LogoProps> = ({ size = 32, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Sonara"
    role="img"
  >
    <rect width="32" height="32" rx="8" fill="var(--accent)" />
    <rect x="7" y="11" width="3.5" height="10" rx="1.75" fill="var(--text-on-accent)" />
    <rect x="14.25" y="6" width="3.5" height="20" rx="1.75" fill="var(--text-on-accent)" />
    <rect x="21.5" y="9" width="3.5" height="14" rx="1.75" fill="var(--text-on-accent)" />
  </svg>
);
