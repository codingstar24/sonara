import type { Track } from '@/db/types';

export interface MediaSessionCallbacks {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeekTo: (seconds: number) => void;
  onSeekBackward: (seconds: number) => void;
  onSeekForward: (seconds: number) => void;
}

export class MediaSessionManager {
  private callbacks: MediaSessionCallbacks | null = null;

  public init(callbacks: MediaSessionCallbacks) {
    this.callbacks = callbacks;
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const ms = navigator.mediaSession;

    try {
      ms.setActionHandler('play', () => this.callbacks?.onPlay());
      ms.setActionHandler('pause', () => this.callbacks?.onPause());
      ms.setActionHandler('nexttrack', () => this.callbacks?.onNext());
      ms.setActionHandler('previoustrack', () => this.callbacks?.onPrevious());
      ms.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          this.callbacks?.onSeekTo(details.seekTime);
        }
      });
      ms.setActionHandler('seekbackward', (details) => {
        this.callbacks?.onSeekBackward(details.seekOffset || 5);
      });
      ms.setActionHandler('seekforward', (details) => {
        this.callbacks?.onSeekForward(details.seekOffset || 5);
      });
    } catch (e) {
      console.warn('Failed to register some Media Session action handlers:', e);
    }
  }

  public updateMetadata(track: Track, artworkUrl?: string) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const artwork: MediaImage[] = [];
    if (artworkUrl) {
      artwork.push(
        { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' },
        { src: artworkUrl, sizes: '128x128', type: 'image/jpeg' }
      );
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork,
    });
  }

  public updatePlaybackState(state: 'none' | 'paused' | 'playing') {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = state;
  }

  public updatePositionState(duration: number, playbackRate = 1, position = 0) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if ('setPositionState' in navigator.mediaSession && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate,
          position: Math.min(position, duration),
        });
      } catch {
        // Silently catch invalid state ranges
      }
    }
  }
}

export const mediaSessionManager = new MediaSessionManager();
