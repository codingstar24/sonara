import type { FC, ReactNode } from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: React.CSSProperties;
}

export const EmptyState: FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  style,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        minHeight: 280,
        ...style,
      }}
    >
      {icon && (
        <div
          style={{
            marginBottom: '16px',
            color: 'var(--text-sub)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </div>
      )}
      <h2
        style={{
          fontSize: 'var(--text-h2)',
          fontWeight: 'var(--font-heading)',
          color: 'var(--text)',
          marginBottom: '8px',
        }}
      >
        {title}
      </h2>
      {description && (
        <p
          style={{
            fontSize: 'var(--text-body)',
            color: 'var(--text-sub)',
            maxWidth: 400,
            marginBottom: actionLabel ? '24px' : 0,
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
