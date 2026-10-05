import { describe, expect, it } from 'vitest';
import { freshTapGuard, type TapGuardState } from '../state';
import { LOCKOUT_STEPS_MS, STRIKE_FORGIVE_MS, registerTap, type TapResult } from '../tapGuard';
import { seededRng } from '../rng';

function run(stream: { t: number; x: number; y: number; touch: boolean }[], start = freshTapGuard()) {
  let g: TapGuardState = start;
  const results: TapResult[] = [];
  for (const tap of stream) {
    const r = registerTap(g, tap.t, tap.x, tap.y, tap.touch);
    g = r.guard;
    results.push(r);
  }
  return { guard: g, results, flagged: results.filter((r) => r.verdict === 'flagged') };
}

/** A human: rate drifts, intervals vary 10–30%, the finger wanders a few pixels. */
function humanStream(seconds: number, cps: number, seed: number) {
  const rng = seededRng(seed);
  const out = [];
  let t = 1000;
  const end = t + seconds * 1000;
  while (t < end) {
    const mean = 1000 / (cps * (0.85 + rng() * 0.3));
    t += mean * (0.75 + rng() * 0.5);
    out.push({ t: Math.round(t), x: 180 + (rng() - 0.5) * 30, y: 300 + (rng() - 0.5) * 30, touch: true });
  }
  return out;
}

function metronome(seconds: number, cps: number, jitterPx = 6) {
  const out = [];
  const interval = 1000 / cps;
  for (let i = 0; i < seconds * cps; i++) {
    out.push({ t: Math.round(1000 + i * interval), x: 180 + (i % 3) * jitterPx, y: 300 + (i % 2) * jitterPx, touch: true });
  }
  return out;
}

describe('tap guard', () => {
  it('never flags human tapping, even fast two-thumb bursts', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const cps of [3, 6, 9, 12, 15]) {
        const { flagged } = run(humanStream(20, cps, seed * 100 + cps));
        expect(flagged, `seed ${seed} cps ${cps}`).toHaveLength(0);
      }
    }
  });

  it('flags a metronome-steady autoclicker below the old 15/s limit', () => {
    const { flagged } = run(metronome(5, 10));
    expect(flagged.length).toBeGreaterThan(0);
    expect(flagged[0].signal).toBe('rhythm');
  });

  it('flags rates no human sustains', () => {
    const fast = [];
    for (let i = 0; i < 40; i++) fast.push({ t: 1000 + i * 33 + (i % 2) * 9, x: 100 + (i % 9) * 5, y: 100 + (i % 4) * 7, touch: true });
    expect(run(fast).flagged[0]?.signal).toBe('burst');
  });

  it('flags pixel-perfect repeats on touch, but not a resting mouse', () => {
    const rng = seededRng(3);
    const stream = [];
    let t = 1000;
    for (let i = 0; i < 30; i++) {
      t += 140 + rng() * 120; // irregular timing defeats the rhythm check on purpose
      stream.push({ t: Math.round(t), x: 200, y: 400, touch: true });
    }
    expect(run(stream).flagged[0]?.signal).toBe('same_spot');
    expect(run(stream.map((s) => ({ ...s, touch: false }))).flagged).toHaveLength(0);
  });

  it('escalates the lockout and ignores taps while locked', () => {
    let g = freshTapGuard();
    const lockouts: number[] = [];
    let t = 1000;
    for (let strike = 0; strike < 4; strike++) {
      let flaggedAt = 0;
      for (let i = 0; i < 40 && !flaggedAt; i++) {
        t += 100;
        const r = registerTap(g, t, 50, 50, true);
        g = r.guard;
        if (r.verdict === 'flagged') flaggedAt = t;
      }
      expect(flaggedAt).toBeGreaterThan(0);
      lockouts.push(g.lockedUntil - flaggedAt);
      expect(registerTap(g, flaggedAt + 1, 50, 50, true).verdict).toBe('locked');
      t = g.lockedUntil + 2000;
    }
    expect(lockouts).toEqual([LOCKOUT_STEPS_MS[0], LOCKOUT_STEPS_MS[1], LOCKOUT_STEPS_MS[2], LOCKOUT_STEPS_MS[2]]);
  });

  it('forgives strikes after a clean stretch', () => {
    let g = freshTapGuard();
    let t = 1000;
    for (let i = 0; i < 40 && g.strikes === 0; i++) {
      t += 100;
      g = registerTap(g, t, 50, 50, true).guard;
    }
    expect(g.strikes).toBe(1);
    t = g.lockedUntil + STRIKE_FORGIVE_MS + 1000;
    let flaggedLock = 0;
    for (let i = 0; i < 40 && !flaggedLock; i++) {
      t += 100;
      const r = registerTap(g, t, 50, 50, true);
      g = r.guard;
      if (r.verdict === 'flagged') flaggedLock = g.lockedUntil - t;
    }
    expect(flaggedLock).toBe(LOCKOUT_STEPS_MS[0]);
  });
});
