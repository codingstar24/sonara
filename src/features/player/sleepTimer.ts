import { toast } from 'sonner';
import { audioEngine } from '@/engine/audioEngine';
import { getPlatform } from '@/platform';
import { SLEEP_CHECK_INTERVAL_MS, SLEEP_FADE_DURATION_S } from '@/config/app';

export type SleepTimerMode = 'off' | 'duration' | 'end-of-track';

export interface SleepTimerSnapshot {
  active: boolean;
  mode: SleepTimerMode;
  remainingSeconds: number;
  deadlineMs: number | null;
}

export type SleepTimerListener = (snapshot: SleepTimerSnapshot) => void;

export class SleepTimerManager {
  private mode: SleepTimerMode = 'off';
  private deadlineMs: number | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<SleepTimerListener>();
  private fadeStarted = false;

  constructor() {
    this.restorePersisted();
  }

  private restorePersisted() {
    try {
      const stored = localStorage.getItem('sonara_sleep_timer');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.deadlineMs && parsed.deadlineMs > Date.now()) {
          this.setDeadline(parsed.deadlineMs);
        } else if (parsed.mode === 'end-of-track') {
          this.setEndOfTrack();
        } else {
          localStorage.removeItem('sonara_sleep_timer');
        }
      }
    } catch {
      // Ignore corrupted localStorage
    }
  }

  private persist() {
    try {
      if (this.mode === 'off') {
        localStorage.removeItem('sonara_sleep_timer');
      } else {
        localStorage.setItem(
          'sonara_sleep_timer',
          JSON.stringify({ mode: this.mode, deadlineMs: this.deadlineMs })
        );
      }
    } catch {
      // Ignore
    }
  }

  public setDuration(minutes: number) {
    if (minutes <= 0) {
      this.cancel();
      return;
    }
    const deadline = Date.now() + minutes * 60 * 1000;
    this.setDeadline(deadline);
  }

  public add15Minutes() {
    if (this.deadlineMs) {
      this.setDeadline(this.deadlineMs + 15 * 60 * 1000);
      toast.success('Added 15 minutes to sleep timer');
    }
  }

  public setEndOfTrack() {
    this.cancel();
    this.mode = 'end-of-track';
    this.persist();
    this.emit();
  }

  public handleTrackEnd() {
    if (this.mode === 'end-of-track') {
      audioEngine.pause();
      this.cancel();
      toast.info('Sleep timer ended: finished current track');
      const platform = getPlatform();
      platform.onSleepTimerEnd?.('pause');
    }
  }

  public setDeadline(deadlineMs: number) {
    this.cancel();
    this.mode = 'duration';
    this.deadlineMs = deadlineMs;
    this.fadeStarted = false;
    this.persist();

    this.timerInterval = setInterval(() => {
      this.tick();
    }, SLEEP_CHECK_INTERVAL_MS);

    this.emit();
  }

  private tick() {
    if (!this.deadlineMs) return;

    const remainingMs = this.deadlineMs - Date.now();
    const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));

    // Handle fade-out in the last 20 seconds
    const fadeDuration = SLEEP_FADE_DURATION_S;
    if (remainingSec <= fadeDuration && !this.fadeStarted && remainingSec > 0) {
      this.fadeStarted = true;
      if (audioEngine.fadeGain) {
        audioEngine.fadeGain.gain.linearRampToValueAtTime(0, remainingSec);
      }
    }

    if (remainingMs <= 0) {
      // End reached
      audioEngine.pause();
      if (audioEngine.fadeGain) {
        audioEngine.fadeGain.gain.value = 1; // restore gain
      }
      this.cancel();
      toast.info('Sleep timer ended: playback paused');
      const platform = getPlatform();
      platform.onSleepTimerEnd?.('pause');
      return;
    }

    this.emit();
  }

  public cancel() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (audioEngine.fadeGain) {
      audioEngine.fadeGain.gain.value = 1;
    }
    this.mode = 'off';
    this.deadlineMs = null;
    this.fadeStarted = false;
    this.persist();
    this.emit();
  }

  public getSnapshot(): SleepTimerSnapshot {
    let remainingSeconds = 0;
    if (this.mode === 'duration' && this.deadlineMs) {
      remainingSeconds = Math.max(0, Math.ceil((this.deadlineMs - Date.now()) / 1000));
    }
    return {
      active: this.mode !== 'off',
      mode: this.mode,
      remainingSeconds,
      deadlineMs: this.deadlineMs,
    };
  }

  public subscribe(listener: SleepTimerListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  private emit() {
    const snap = this.getSnapshot();
    for (const l of this.listeners) {
      l(snap);
    }
  }
}

export const sleepTimerManager = new SleepTimerManager();
