import type { TapGuardState } from './state';

/**
 * Autoclicker detection for manual taps.
 *
 * A raw taps-per-second limit both misses slow bots and punishes fast humans, so three
 * independent signals are used instead:
 *  1. Rate no human sustains: ≥ BURST_TAPS in one second, or ≥ SUSTAINED_TAPS over three.
 *  2. Machine rhythm: a long run of intervals with almost no variation. Human tapping
 *     varies by roughly 10–25% interval to interval; a bot's timer varies by ~1%.
 *  3. Pixel-perfect repeats on a touchscreen: fingers never land on the same pixel twenty
 *     times running. (Mouse clicks are excluded — a resting mouse legitimately does.)
 *
 * A detection locks manual taps for an escalating period. Auto-attack is unaffected, and
 * strikes are forgiven after a clean stretch. No ad is ever involved: an ad shown while a
 * bot is tapping would be clicked by the bot, which AdMob treats as invalid traffic.
 */

export const BURST_WINDOW_MS = 1000;
export const BURST_TAPS = 25;
export const SUSTAINED_WINDOW_MS = 3000;
export const SUSTAINED_TAPS = 50;
export const RHYTHM_INTERVALS = 20;
export const RHYTHM_MAX_MEAN_MS = 250;
export const RHYTHM_MAX_CV = 0.05;
export const SAME_SPOT_TAPS = 20;
export const SAME_SPOT_RADIUS_PX = 1.5;
export const SAME_SPOT_MAX_SPAN_MS = 4000;
/** A gap this long starts a fresh sequence, so pauses never count as rhythm. */
export const SEQUENCE_BREAK_MS = 1000;
export const LOCKOUT_STEPS_MS = [10_000, 30_000, 60_000];
export const STRIKE_FORGIVE_MS = 5 * 60 * 1000;
const HISTORY = 64;

export type TapVerdict = 'ok' | 'locked' | 'flagged';
export type TapSignal = 'burst' | 'sustained' | 'rhythm' | 'same_spot';

export interface TapResult {
  guard: TapGuardState;
  verdict: TapVerdict;
  signal?: TapSignal;
}

export function isLocked(guard: TapGuardState, now: number): boolean {
  return now < guard.lockedUntil;
}

function detect(g: TapGuardState): TapSignal | null {
  const n = g.times.length;
  const last = g.times[n - 1];

  let inBurst = 0;
  let inSustained = 0;
  for (let i = n - 1; i >= 0; i--) {
    const age = last - g.times[i];
    if (age < BURST_WINDOW_MS) inBurst++;
    if (age < SUSTAINED_WINDOW_MS) inSustained++;
    else break;
  }
  if (inBurst >= BURST_TAPS) return 'burst';
  if (inSustained >= SUSTAINED_TAPS) return 'sustained';

  if (n >= RHYTHM_INTERVALS + 1) {
    const intervals: number[] = [];
    for (let i = n - RHYTHM_INTERVALS; i < n; i++) intervals.push(g.times[i] - g.times[i - 1]);
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (mean > 0 && mean <= RHYTHM_MAX_MEAN_MS) {
      const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
      if (Math.sqrt(variance) / mean < RHYTHM_MAX_CV) return 'rhythm';
    }
  }

  if (n >= SAME_SPOT_TAPS) {
    const start = n - SAME_SPOT_TAPS;
    if (last - g.times[start] <= SAME_SPOT_MAX_SPAN_MS) {
      let allTouch = true;
      let sameSpot = true;
      const x0 = g.xs[start];
      const y0 = g.ys[start];
      for (let i = start; i < n; i++) {
        if (!g.touch[i]) allTouch = false;
        if (Math.hypot(g.xs[i] - x0, g.ys[i] - y0) > SAME_SPOT_RADIUS_PX) sameSpot = false;
      }
      if (allTouch && sameSpot) return 'same_spot';
    }
  }
  return null;
}

export function registerTap(guard: TapGuardState, now: number, x: number, y: number, isTouch: boolean): TapResult {
  if (isLocked(guard, now)) return { guard, verdict: 'locked' };

  let strikes = guard.strikes;
  if (strikes > 0 && now - guard.lastStrikeAt > STRIKE_FORGIVE_MS) strikes = 0;

  const lastTime = guard.times[guard.times.length - 1];
  const fresh = lastTime === undefined || now - lastTime > SEQUENCE_BREAK_MS || now < lastTime;
  const keep = fresh ? 0 : Math.max(0, guard.times.length - (HISTORY - 1));

  const next: TapGuardState = {
    times: [...guard.times.slice(keep), now],
    xs: [...guard.xs.slice(keep), x],
    ys: [...guard.ys.slice(keep), y],
    touch: [...guard.touch.slice(keep), isTouch],
    lockedUntil: guard.lockedUntil,
    strikes,
    lastStrikeAt: guard.lastStrikeAt,
  };
  if (fresh) {
    next.times = [now];
    next.xs = [x];
    next.ys = [y];
    next.touch = [isTouch];
  }

  const signal = detect(next);
  if (!signal) return { guard: next, verdict: 'ok' };

  const newStrikes = strikes + 1;
  const lockMs = LOCKOUT_STEPS_MS[Math.min(newStrikes - 1, LOCKOUT_STEPS_MS.length - 1)];
  return {
    guard: {
      times: [],
      xs: [],
      ys: [],
      touch: [],
      lockedUntil: now + lockMs,
      strikes: newStrikes,
      lastStrikeAt: now,
    },
    verdict: 'flagged',
    signal,
  };
}
