import type { SoundId } from '../game/actions';
import type { GameSettings } from '../types/game';

const SFX: SoundId[] = [
  'tap_hit',
  'crit_hit',
  'enemy_death',
  'boss_defeat',
  'boss_warn',
  'loot',
  'fanfare',
  'levelup',
  'click',
  'confirm',
  'claim',
  'goal',
  'eclipse',
  'fail',
  'whoosh',
];
const MUSIC_URL = '/audio/music/ambient_void.wav';
/** Rapid repeats of the same sound inside this window are dropped, so auto-attack never machine-guns. */
const MIN_GAP_MS: Partial<Record<SoundId, number>> = { tap_hit: 45, crit_hit: 60, enemy_death: 60 };
const MUSIC_LEVEL = 0.6;

/**
 * Plays the game's real WAV assets (public/audio) through Web Audio. Browsers only allow
 * audio after a user gesture, so nothing loads or plays until `unlock()` runs on the first tap.
 * Music pauses whenever the app is backgrounded.
 */
class AudioService {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loading: Promise<void> | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private lastPlayed = new Map<SoundId, number>();
  private settings: Pick<GameSettings, 'sfxVolume' | 'bgmVolume' | 'sfxMuted' | 'bgmMuted'> = {
    sfxVolume: 0.8,
    bgmVolume: 0.5,
    sfxMuted: false,
    bgmMuted: false,
  };
  private suspendedByApp = false;

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor =
      typeof window !== 'undefined'
        ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain.connect(this.ctx.destination);
    this.musicGain.connect(this.ctx.destination);
    this.applyVolumes();
    return this.ctx;
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    const ctx = this.ctx;
    if (!ctx) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  private loadAll(): Promise<void> {
    if (!this.loading) {
      this.loading = Promise.all([
        ...SFX.map(async (id) => {
          const b = await this.loadBuffer(`/audio/sfx/${id}.wav`);
          if (b) this.buffers.set(id, b);
        }),
        (async () => {
          const b = await this.loadBuffer(MUSIC_URL);
          if (b) this.buffers.set('music', b);
        })(),
      ]).then(() => this.syncMusic());
    }
    return this.loading;
  }

  /** Call from a user gesture. Safe to call on every tap. */
  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended' && !this.suspendedByApp) ctx.resume().catch(() => undefined);
    void this.loadAll();
  }

  setVolumes(s: Pick<GameSettings, 'sfxVolume' | 'bgmVolume' | 'sfxMuted' | 'bgmMuted'>): void {
    this.settings = { sfxVolume: s.sfxVolume, bgmVolume: s.bgmVolume, sfxMuted: s.sfxMuted, bgmMuted: s.bgmMuted };
    this.applyVolumes();
    this.syncMusic();
  }

  private applyVolumes() {
    if (!this.ctx || !this.sfxGain || !this.musicGain) return;
    const t = this.ctx.currentTime;
    this.sfxGain.gain.setValueAtTime(this.settings.sfxMuted ? 0 : this.settings.sfxVolume, t);
    this.musicGain.gain.setValueAtTime(this.settings.bgmMuted ? 0 : this.settings.bgmVolume * MUSIC_LEVEL, t);
  }

  private syncMusic() {
    const ctx = this.ctx;
    const buffer = this.buffers.get('music');
    const wantMusic = !this.settings.bgmMuted && this.settings.bgmVolume > 0;
    if (!ctx || !buffer || !this.musicGain) return;
    if (wantMusic && !this.musicSource) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(this.musicGain);
      src.start();
      this.musicSource = src;
    } else if (!wantMusic && this.musicSource) {
      try {
        this.musicSource.stop();
      } catch {
        // already stopped
      }
      this.musicSource.disconnect();
      this.musicSource = null;
    }
  }

  play(id: SoundId): void {
    if (this.settings.sfxMuted || this.settings.sfxVolume <= 0 || this.suspendedByApp) return;
    const ctx = this.ctx;
    const buffer = this.buffers.get(id);
    if (!ctx || !buffer || !this.sfxGain || ctx.state !== 'running') return;
    const now = performance.now();
    const gap = MIN_GAP_MS[id];
    if (gap && now - (this.lastPlayed.get(id) ?? -Infinity) < gap) return;
    this.lastPlayed.set(id, now);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.sfxGain);
    src.start();
  }

  /** The app went to the background: silence everything until it returns. */
  suspend(): void {
    this.suspendedByApp = true;
    this.ctx?.suspend().catch(() => undefined);
  }

  resume(): void {
    this.suspendedByApp = false;
    this.ctx?.resume().catch(() => undefined);
  }
}

export const audio = new AudioService();
