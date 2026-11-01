import { type ButtonHTMLAttributes, forwardRef } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: number;
  active?: boolean;
  activeColor?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      size = 32,
      active = false,
      activeColor = 'var(--accent)',
      className = '',
      style,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={`icon-btn ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          borderRadius: 'var(--radius-pill)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          color: active ? activeColor : 'var(--text-sub)',
          cursor: props.disabled ? 'not-allowed' : 'pointer',
          opacity: props.disabled ? 0.4 : 1,
          transition: 'all var(--transition-fast)',
          padding: 0,
          position: 'relative',
          ...style,
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
