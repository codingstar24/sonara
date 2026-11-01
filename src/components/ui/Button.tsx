import { type ButtonHTMLAttributes, forwardRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', style, children, ...props }, ref) => {
    const sizeStyles = {
      sm: { height: 32, padding: '0 16px', fontSize: 'var(--text-caption)', fontWeight: 600 },
      md: { height: 44, padding: '0 24px', fontSize: 'var(--text-body)', fontWeight: 700 },
      lg: { height: 48, padding: '0 32px', fontSize: 'var(--text-body)', fontWeight: 700 },
    }[size];

    const variantStyles = {
      primary: {
        background: 'var(--accent)',
        color: 'var(--text-on-accent)',
        border: 'none',
      },
      secondary: {
        background: 'var(--bg-card)',
        color: 'var(--text)',
        border: 'none',
      },
      outline: {
        background: 'transparent',
        color: 'var(--text)',
        border: '1px solid var(--border-subtle)',
      },
      ghost: {
        background: 'transparent',
        color: 'var(--text-sub)',
        border: 'none',
      },
      danger: {
        background: 'var(--danger)',
        color: '#FFFFFF',
        border: 'none',
      },
    }[variant];

    return (
      <button
        ref={ref}
        className={`spotify-button ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          borderRadius: 'var(--radius-pill)',
          cursor: props.disabled ? 'not-allowed' : 'pointer',
          opacity: props.disabled ? 0.5 : 1,
          transition: 'all var(--transition-bounce)',
          fontFamily: 'var(--font-family)',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          ...sizeStyles,
          ...variantStyles,
          ...style,
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
