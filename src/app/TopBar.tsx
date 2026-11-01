import { type FC, useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  House,
  MagnifyingGlass,
  X,
  ChartBar,
  Gear,
} from '@phosphor-icons/react';
import { SEARCH_DEBOUNCE_MS } from '@/config/app';
import { isElectron } from '@/platform';

export const TopBar: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchValue, setSearchValue] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Navigate to search on input
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (value.trim()) {
          navigate(`/search?q=${encodeURIComponent(value.trim())}`);
        } else if (location.pathname === '/search') {
          navigate('/search');
        }
      }, SEARCH_DEBOUNCE_MS);
    },
    [navigate, location.pathname]
  );

  // Clear search on route change away from search
  useEffect(() => {
    if (!location.pathname.startsWith('/search')) {
      setSearchValue('');
    }
  }, [location.pathname]);

  // Keyboard shortcut: / or Ctrl+L focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.key === '/' || (e.ctrlKey && e.key === 'l')) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <header
      className="drag-region"
      style={{
        height: 'var(--top-bar-height)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '8px',
        background: 'transparent',
        position: 'relative',
        zIndex: 'var(--z-sticky)',
      }}
    >
      {/* Navigation buttons */}
      <div className="no-drag" style={{ display: 'flex', gap: '8px' }}>
        <button
          className="icon-btn"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.7)',
          }}
        >
          <ArrowLeft size={18} weight="bold" />
        </button>
        <button
          className="icon-btn"
          onClick={() => navigate(1)}
          aria-label="Go forward"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.7)',
          }}
        >
          <ArrowRight size={18} weight="bold" />
        </button>
      </div>

      {/* Center: Home + Search */}
      <div
        className="no-drag"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flex: '1',
          justifyContent: 'center',
          maxWidth: 560,
          margin: '0 auto',
        }}
      >
        <button
          className="icon-btn"
          onClick={() => navigate('/')}
          aria-label="Home"
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: location.pathname === '/' ? 'var(--bg-elevated)' : 'transparent',
            color: location.pathname === '/' ? 'var(--text)' : 'var(--text-sub)',
          }}
        >
          <House size={24} weight={location.pathname === '/' ? 'fill' : 'regular'} />
        </button>

        <div
          style={{
            flex: 1,
            maxWidth: 480,
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 48,
              background: 'var(--bg-input)',
              borderRadius: 'var(--radius-pill)',
              padding: '0 16px',
              gap: '8px',
              border: searchFocused ? '2px solid var(--text)' : '2px solid transparent',
              transition: 'border-color var(--duration-fast) var(--ease)',
            }}
          >
            <MagnifyingGlass
              size={20}
              weight="bold"
              style={{ color: 'var(--text-sub)', flexShrink: 0 }}
            />
            <input
              ref={inputRef}
              type="text"
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => {
                setSearchFocused(true);
                if (!location.pathname.startsWith('/search')) {
                  navigate('/search');
                }
              }}
              onBlur={() => setSearchFocused(false)}
              placeholder="What do you want to play?"
              aria-label="Search"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text)',
                fontSize: 'var(--text-body)',
                fontFamily: 'var(--font-family)',
              }}
            />
            {searchValue && (
              <button
                className="icon-btn no-drag"
                onClick={() => {
                  setSearchValue('');
                  inputRef.current?.focus();
                  if (location.pathname === '/search') {
                    navigate('/search');
                  }
                }}
                aria-label="Clear search"
                style={{ padding: 4 }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div
        className="no-drag"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          marginInlineStart: 'auto',
          paddingInlineEnd: isElectron() ? 150 : 16,
        }}
      >
        <button
          className="icon-btn"
          onClick={() => navigate('/stats')}
          aria-label="Listening stats"
        >
          <ChartBar size={20} />
        </button>
        <button
          className="icon-btn"
          onClick={() => navigate('/settings')}
          aria-label="Settings"
        >
          <Gear size={20} />
        </button>

        {/* Profile circle */}
        <button
          className="no-drag"
          aria-label="Profile menu"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--bg-elevated)',
            border: 'none',
            color: 'var(--text)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform var(--duration-fast) var(--ease)',
          }}
        >
          S
        </button>
      </div>
    </header>
  );
};
