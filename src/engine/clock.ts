/**
 * Micro-clock for high-frequency playback position updates.
 * Components subscribe directly to avoid triggering React rerenders.
 */

export interface ClockSnapshot {
  currentTime: number;
  duration: number;
  progress: number; // 0 to 1
  isPlaying: boolean;
}

export type ClockListener = (snapshot: ClockSnapshot) => void;

export class PlaybackClock {
  private currentTime = 0;
  private duration = 0;
  private isPlaying = false;
  private listeners = new Set<ClockListener>();
  private rafId: number | null = null;
  private lastEmitTime = 0;

  public update(time: number, duration: number, isPlaying: boolean) {
    this.currentTime = time;
    this.duration = duration;
    this.isPlaying = isPlaying;
    this.emit();
  }

  public getSnapshot(): ClockSnapshot {
    return {
      currentTime: this.currentTime,
      duration: this.duration,
      progress: this.duration > 0 ? this.currentTime / this.duration : 0,
      isPlaying: this.isPlaying,
    };
  }

  public subscribe(listener: ClockListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  private emit() {
    const now = performance.now();
    if (now - this.lastEmitTime < 16) return; // Cap at ~60fps
    this.lastEmitTime = now;

    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  public startTick(getCurrentTime: () => number) {
    if (this.rafId !== null) return;

    const tick = () => {
      if (this.isPlaying) {
        this.currentTime = getCurrentTime();
        this.emit();
      }
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  public stopTick() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

export const playbackClock = new PlaybackClock();
