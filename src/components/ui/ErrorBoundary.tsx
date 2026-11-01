import { Component, type ErrorInfo, type ReactNode } from 'react';
import { WarningCircle, ArrowClockwise, House } from '@phosphor-icons/react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Sonara ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.hash = '#/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 24px',
            textAlign: 'center',
            color: 'var(--text)',
            height: '100%',
            minHeight: '400px',
            backgroundColor: 'var(--bg-panel)',
            borderRadius: 'var(--radius-panel)',
            margin: '8px',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            <WarningCircle size={36} weight="bold" />
          </div>
          <h2
            style={{
              fontSize: 'var(--text-h2)',
              fontWeight: 'var(--font-heading)',
              marginBottom: '8px',
            }}
          >
            {this.props.fallbackTitle || 'Something went wrong'}
          </h2>
          <p
            style={{
              color: 'var(--text-sub)',
              fontSize: 'var(--text-body)',
              maxWidth: 500,
              lineHeight: 1.5,
              marginBottom: '24px',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error?.message || 'An unexpected rendering error occurred in this view.'}
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={this.handleGoHome}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--accent)',
                color: 'var(--text-on-accent)',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <House size={16} weight="bold" />
              Return Home
            </button>
            <button
              onClick={this.handleReload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <ArrowClockwise size={16} weight="bold" />
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
