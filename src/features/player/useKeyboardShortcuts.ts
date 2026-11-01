import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueueStore } from '@/features/queue/queueStore';
import { audioEngine } from '@/engine/audioEngine';
import { usePlayerStore, useUIStore } from '@/app/stores';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when user is typing inside input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Space: Play/Pause
      if (e.code === 'Space') {
        e.preventDefault();
        void useQueueStore.getState().togglePlay();
        return;
      }

      // Ctrl + Right: Next track
      if (isCtrlOrCmd && e.key === 'ArrowRight') {
        e.preventDefault();
        void useQueueStore.getState().next(false);
        return;
      }

      // Ctrl + Left: Previous track
      if (isCtrlOrCmd && e.key === 'ArrowLeft') {
        e.preventDefault();
        void useQueueStore.getState().previous();
        return;
      }

      // Shift + Right: Seek +5s
      if (e.shiftKey && e.key === 'ArrowRight') {
        e.preventDefault();
        const pos = audioEngine.getActiveAudio().currentTime;
        const dur = audioEngine.getActiveAudio().duration || 0;
        useQueueStore.getState().seek(Math.min(dur, pos + 5));
        return;
      }

      // Shift + Left: Seek -5s
      if (e.shiftKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        const pos = audioEngine.getActiveAudio().currentTime;
        useQueueStore.getState().seek(Math.max(0, pos - 5));
        return;
      }

      // Ctrl + Up: Volume +5%
      if (isCtrlOrCmd && e.key === 'ArrowUp') {
        e.preventDefault();
        const v = usePlayerStore.getState().volume;
        usePlayerStore.getState().setVolume(Math.min(1, v + 0.05));
        return;
      }

      // Ctrl + Down: Volume -5%
      if (isCtrlOrCmd && e.key === 'ArrowDown') {
        e.preventDefault();
        const v = usePlayerStore.getState().volume;
        usePlayerStore.getState().setVolume(Math.max(0, v - 0.05));
        return;
      }

      // S: Toggle shuffle
      if (!isCtrlOrCmd && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        useQueueStore.getState().toggleShuffle();
        return;
      }

      // R: Cycle repeat
      if (!isCtrlOrCmd && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        useQueueStore.getState().cycleRepeat();
        return;
      }

      // M: Mute
      if (!isCtrlOrCmd && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        usePlayerStore.getState().toggleMute();
        return;
      }

      // Q: Toggle Queue panel
      if (!isCtrlOrCmd && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        useUIStore.getState().toggleRightPanel('queue');
        return;
      }

      // N: Toggle Now Playing panel
      if (!isCtrlOrCmd && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        useUIStore.getState().toggleRightPanel('now-playing');
        return;
      }

      // Y: Toggle Lyrics
      if (!isCtrlOrCmd && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        useUIStore.getState().toggleRightPanel('lyrics');
        return;
      }

      // / or Ctrl + L: Focus search
      if ((!isCtrlOrCmd && e.key === '/') || (isCtrlOrCmd && (e.key === 'l' || e.key === 'L'))) {
        e.preventDefault();
        navigate('/search');
        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
        searchInput?.focus();
        return;
      }

      // Ctrl + , : Settings
      if (isCtrlOrCmd && e.key === ',') {
        e.preventDefault();
        navigate('/settings');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
}
