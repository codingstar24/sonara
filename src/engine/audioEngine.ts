import type { Track, Source } from '@/db/types';
import { getPlatform } from '@/platform';
import { playbackClock } from './clock';
import { EQ_BANDS, EQ_Q } from '@/config/app';

export interface AudioEngineEvents {
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (time: number, duration: number) => void;
  onError?: (err: Error) => void;
  onTrackLoaded?: (track: Track) => void;
  onPlayEvent?: (event: {
    trackId: string;
    listenedMs: number;
    durationMs: number;
    startedAt: number;
    completed: boolean;
    earlySkip: boolean;
  }) => void;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private audioA!: HTMLAudioElement;
  private audioB!: HTMLAudioElement;
  private sourceNodeA: MediaElementAudioSourceNode | null = null;
  private sourceNodeB: MediaElementAudioSourceNode | null = null;
  private deckGainA!: GainNode;
  private deckGainB!: GainNode;
  private mixGain!: GainNode;
  private volumeGain!: GainNode;
  public fadeGain!: GainNode;
  private eqNodes: BiquadFilterNode[] = [];
  public analyserNode!: AnalyserNode;

  private activeDeck: 'A' | 'B' = 'A';
  private currentTrack: Track | null = null;
  private currentPlayableUrl: { url: string; dispose(): void } | null = null;
  private preloadedTrack: Track | null = null;
  private preloadedUrl: { url: string; dispose(): void } | null = null;

  private volume = 1;
  private isMuted = false;
  private speed = 1;
  private crossfadeDurationS = 0;

  // Telemetry tracking
  private sessionStartTime = 0;
  private accumulatedListenedMs = 0;
  private lastTickTime = 0;

  private events: AudioEngineEvents = {};
  private consecutiveFailures = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initElements();
    }
  }

  private initElements() {
    this.audioA = new Audio();
    this.audioB = new Audio();

    this.audioA.preload = 'auto';
    this.audioB.preload = 'auto';
    this.audioA.crossOrigin = 'anonymous';
    this.audioB.crossOrigin = 'anonymous';

    const handleEnded = () => {
      this.recordTelemetry(true);
      this.events.onEnded?.();
    };

    const handleTimeUpdate = () => {
      const audio = this.getActiveAudio();
      playbackClock.update(audio.currentTime, audio.duration || 0, !audio.paused);
      this.events.onTimeUpdate?.(audio.currentTime, audio.duration || 0);

      // Track listening telemetry
      if (!audio.paused) {
        const now = performance.now();
        if (this.lastTickTime > 0) {
          this.accumulatedListenedMs += now - this.lastTickTime;
        }
        this.lastTickTime = now;
      }
    };

    const handleError = () => {
      this.consecutiveFailures++;
      const err = new Error(`Audio decode/playback error on deck ${this.activeDeck}`);
      this.events.onError?.(err);
    };

    this.audioA.addEventListener('ended', handleEnded);
    this.audioB.addEventListener('ended', handleEnded);
    this.audioA.addEventListener('timeupdate', handleTimeUpdate);
    this.audioB.addEventListener('timeupdate', handleTimeUpdate);
    this.audioA.addEventListener('error', handleError);
    this.audioB.addEventListener('error', handleError);

    playbackClock.startTick(() => this.getActiveAudio().currentTime);
  }

  public initGraph() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();

    this.sourceNodeA = this.ctx.createMediaElementSource(this.audioA);
    this.sourceNodeB = this.ctx.createMediaElementSource(this.audioB);

    this.deckGainA = this.ctx.createGain();
    this.deckGainB = this.ctx.createGain();
    this.mixGain = this.ctx.createGain();
    this.volumeGain = this.ctx.createGain();
    this.fadeGain = this.ctx.createGain();
    this.analyserNode = this.ctx.createAnalyser();

    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // Deck gains (Deck A active initially)
    this.deckGainA.gain.value = 1;
    this.deckGainB.gain.value = 0;

    // 10-band EQ chain
    this.eqNodes = EQ_BANDS.map((freq, idx) => {
      const filter = this.ctx!.createBiquadFilter();
      filter.frequency.value = freq;
      if (idx === 0) {
        filter.type = 'lowshelf';
      } else if (idx === EQ_BANDS.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
        filter.Q.value = EQ_Q;
      }
      filter.gain.value = 0;
      return filter;
    });

    // Connect: source -> deckGain -> mixGain -> volumeGain -> fadeGain -> eq[0..9] -> analyser -> destination
    this.sourceNodeA.connect(this.deckGainA);
    this.sourceNodeB.connect(this.deckGainB);

    this.deckGainA.connect(this.mixGain);
    this.deckGainB.connect(this.mixGain);

    this.mixGain.connect(this.volumeGain);
    this.volumeGain.connect(this.fadeGain);

    let lastNode: AudioNode = this.fadeGain;
    for (const eqNode of this.eqNodes) {
      lastNode.connect(eqNode);
      lastNode = eqNode;
    }

    lastNode.connect(this.analyserNode);
    this.analyserNode.connect(this.ctx.destination);

    this.applyVolume();
  }

  public setEvents(events: AudioEngineEvents) {
    this.events = { ...this.events, ...events };
  }

  public async loadTrack(track: Track, source: Source, autoPlay = true): Promise<void> {
    this.initGraph();
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }

    this.recordTelemetry(false);

    // Dispose old URL
    if (this.currentPlayableUrl) {
      this.currentPlayableUrl.dispose();
      this.currentPlayableUrl = null;
    }

    const platform = getPlatform();
    const playable = await platform.getPlayableUrl(track, source);
    this.currentPlayableUrl = playable;
    this.currentTrack = track;

    const audio = this.getActiveAudio();
    audio.src = playable.url;
    audio.playbackRate = this.speed;

    this.sessionStartTime = Date.now();
    this.accumulatedListenedMs = 0;
    this.lastTickTime = 0;
    this.consecutiveFailures = 0;

    this.events.onTrackLoaded?.(track);

    if (autoPlay) {
      await this.play();
    }
  }

  public async play(): Promise<void> {
    this.initGraph();
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }

    const audio = this.getActiveAudio();
    if (audio.src) {
      this.lastTickTime = performance.now();
      await audio.play();
      this.events.onPlay?.();
    }
  }

  public pause(): void {
    const audio = this.getActiveAudio();
    audio.pause();
    this.lastTickTime = 0;
    this.events.onPause?.();
  }

  public seek(seconds: number): void {
    const audio = this.getActiveAudio();
    if (isFinite(seconds) && seconds >= 0) {
      audio.currentTime = seconds;
      playbackClock.update(seconds, audio.duration || 0, !audio.paused);
    }
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    this.applyVolume();
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.applyVolume();
  }

  private applyVolume(): void {
    if (!this.volumeGain) return;
    const v = this.isMuted ? 0 : this.volume;
    // Perceptual volume: gain = v^2
    this.volumeGain.gain.setValueAtTime(v * v, this.ctx?.currentTime ?? 0);
  }

  public setSpeed(speed: number): void {
    this.speed = Math.max(0.5, Math.min(2.0, speed));
    this.audioA.playbackRate = this.speed;
    this.audioB.playbackRate = this.speed;
  }

  public setCrossfade(seconds: number): void {
    this.crossfadeDurationS = Math.max(0, Math.min(12, seconds));
  }

  public getCrossfade(): number {
    return this.crossfadeDurationS;
  }

  public async preloadTrack(track: Track, source: Source): Promise<void> {
    this.preloadedTrack = track;
    const platform = getPlatform();
    this.preloadedUrl?.dispose();
    const playable = await platform.getPlayableUrl(track, source);
    this.preloadedUrl = playable;
    const nextAudio = this.activeDeck === 'A' ? this.audioB : this.audioA;
    nextAudio.src = playable.url;
  }

  public getPreloadedTrack(): Track | null {
    return this.preloadedTrack;
  }

  public setEqBands(gains: number[]): void {
    if (this.eqNodes.length === 0) return;
    for (let i = 0; i < Math.min(gains.length, this.eqNodes.length); i++) {
      const node = this.eqNodes[i]!;
      const val = gains[i] ?? 0;
      node.gain.setValueAtTime(val, this.ctx?.currentTime ?? 0);
    }
  }

  public async setOutputDevice(sinkId: string): Promise<void> {
    if ('setSinkId' in this.audioA) {
      await (this.audioA as any).setSinkId(sinkId);
      await (this.audioB as any).setSinkId(sinkId);
    }
  }

  public getActiveAudio(): HTMLAudioElement {
    return this.activeDeck === 'A' ? this.audioA : this.audioB;
  }

  public getCurrentTrack(): Track | null {
    return this.currentTrack;
  }

  private recordTelemetry(completed: boolean) {
    if (!this.currentTrack || this.sessionStartTime === 0) return;

    const listenedMs = Math.round(this.accumulatedListenedMs);
    const durationMs = Math.round((this.currentTrack.duration || 0) * 1000);
    const earlySkip = !completed && listenedMs < 10000 && durationMs > 20000;

    this.events.onPlayEvent?.({
      trackId: this.currentTrack.id,
      listenedMs,
      durationMs,
      startedAt: this.sessionStartTime,
      completed,
      earlySkip,
    });

    this.sessionStartTime = 0;
    this.accumulatedListenedMs = 0;
  }

  public dispose() {
    this.recordTelemetry(false);
    this.audioA.pause();
    this.audioB.pause();
    this.audioA.src = '';
    this.audioB.src = '';
    this.currentPlayableUrl?.dispose();
    this.preloadedUrl?.dispose();
    playbackClock.stopTick();
    if (this.ctx && this.ctx.state !== 'closed') {
      void this.ctx.close();
    }
  }
}

export const audioEngine = new AudioEngine();
