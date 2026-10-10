import React, { useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import { audio } from '../../services/audio';
import { formatNumber } from '../../utils/numberFormat';
import type { MinigameProps, MinigameResult } from './types';

const ROUNDS = 5;
const SIGILS = 5;
const WIN_HITS = 3;
const MIN_WAIT_MS = 800;
const MAX_WAIT_MS = 2200;
/** A flare left untapped this long is a miss, so an interrupted run still reaches its end. */
const FLARE_TIMEOUT_MS = 2500;
const FEEDBACK_MS = 700;
const END_BEAT_MS = 900;

type Outcome =
  | { kind: 'hit'; ms: number; index: number }
  | { kind: 'early'; index: number }
  | { kind: 'wrong'; index: number }
  | { kind: 'missed' };

interface RoundState {
  /** 0-based index of the round being played. */
  round: number;
  /** wait → flare → feedback → wait …; the last round goes straight to done. */
  phase: 'wait' | 'flare' | 'feedback' | 'done';
  /** The sigil that flared this round, or -1 before the flare. */
  target: number;
  /** One per finished round. */
  outcomes: Outcome[];
}

type RoundAction =
  | { type: 'flare'; target: number }
  /** `sawFlare` is whether the flare was on screen when the finger came down. */
  | { type: 'tap'; round: number; index: number; sawFlare: boolean; ms: number }
  | { type: 'timeout' }
  | { type: 'next' };

const INITIAL: RoundState = { round: 0, phase: 'wait', target: -1, outcomes: [] };

function resolveRound(s: RoundState, outcome: Outcome): RoundState {
  const outcomes = [...s.outcomes, outcome];
  return { ...s, outcomes, phase: outcomes.length >= ROUNDS ? 'done' : 'feedback' };
}

function reduce(s: RoundState, a: RoundAction): RoundState {
  switch (a.type) {
    case 'flare':
      return s.phase === 'wait' ? { ...s, phase: 'flare', target: a.target } : s;
    case 'tap':
      if (a.round !== s.round) return s;
      if (s.phase === 'wait') return resolveRound(s, { kind: 'early', index: a.index });
      if (s.phase !== 'flare') return s;
      // A press that landed before the flare was drawn is still early, whatever the queue order.
      if (!a.sawFlare) return resolveRound(s, { kind: 'early', index: a.index });
      if (a.index !== s.target) return resolveRound(s, { kind: 'wrong', index: a.index });
      return resolveRound(s, { kind: 'hit', ms: Math.max(0, Math.round(a.ms)), index: a.index });
    case 'timeout':
      return s.phase === 'flare' ? resolveRound(s, { kind: 'missed' }) : s;
    case 'next':
      return s.phase === 'feedback' ? { ...s, round: s.round + 1, phase: 'wait', target: -1 } : s;
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** "312ms", or "1.4s" once it no longer fits in milliseconds. */
const formatMs = (ms: number) => (ms < 1000 ? `${formatNumber(ms)}ms` : `${formatNumber(ms / 1000)}s`);

function hitTimes(outcomes: Outcome[]): number[] {
  const times: number[] = [];
  for (const o of outcomes) if (o.kind === 'hit') times.push(o.ms);
  return times;
}

function summarize(outcomes: Outcome[]): MinigameResult {
  const hits = hitTimes(outcomes);
  // A 250 ms reaction scores 1.0, tapering to 0 at 900 ms; performance is the mean over hits.
  const total = hits.reduce((sum, ms) => sum + clamp((900 - ms) / 650, 0, 1), 0);
  const avg = hits.length > 0 ? Math.round(hits.reduce((a, b) => a + b, 0) / hits.length) : 0;
  return {
    won: hits.length >= WIN_HITS,
    performance: hits.length > 0 ? total / hits.length : 0,
    score: avg,
    detail:
      hits.length > 0
        ? `${formatNumber(hits.length)} of ${formatNumber(ROUNDS)} · avg ${formatMs(avg)}`
        : `${formatNumber(0)} of ${formatNumber(ROUNDS)} hit`,
  };
}

/** Sigil centres on a pentagon, as percentages of the play square. */
const SIGIL_POS = Array.from({ length: SIGILS }, (_, i) => {
  const angle = ((-90 + (360 / SIGILS) * i) * Math.PI) / 180;
  return { left: 50 + 34 * Math.cos(angle), top: 50 + 34 * Math.sin(angle) };
});
const SIGIL_SIZE = 28;

function statusLine(s: RoundState): { text: string; tone: string } {
  const last = s.outcomes[s.outcomes.length - 1];
  if (s.phase === 'wait') return { text: 'WAIT for a sigil to flare…', tone: 'text-dim' };
  if (s.phase === 'flare') return { text: 'TAP THE FLARING SIGIL!', tone: 'text-neon-bright' };
  if (s.phase === 'done') {
    const result = summarize(s.outcomes);
    return result.won
      ? { text: `DONE · ${result.detail}`, tone: 'text-toxic' }
      : { text: `DONE · ${result.detail} · ${formatNumber(WIN_HITS)} needed`, tone: 'text-dim' };
  }
  if (!last) return { text: '', tone: 'text-dim' };
  switch (last.kind) {
    case 'hit':
      return { text: `✓ HIT · ${formatMs(last.ms)}`, tone: 'text-toxic' };
    case 'early':
      return { text: '✕ TOO EARLY · round missed', tone: 'text-crimson' };
    case 'wrong':
      return { text: '✕ WRONG SIGIL · round missed', tone: 'text-crimson' };
    case 'missed':
      return { text: '✕ TOO SLOW · round missed', tone: 'text-crimson' };
  }
}

/**
 * Void Reflex: five rounds; after a random 0.8–2.2s one of five sigils flares and
 * the player taps it on press. Win = 3+ hits. Score = mean hit reaction in ms (lower is better).
 */
export const VoidReflexGame: React.FC<MinigameProps> = ({ onFinish }) => {
  const [state, send] = useReducer(reduce, INITIAL);
  const { round, phase, target, outcomes } = state;

  const onFinishRef = useRef(onFinish);
  useLayoutEffect(() => {
    onFinishRef.current = onFinish;
  });
  const finished = useRef(false);
  /** performance.now() at the commit that drew the current flare. */
  const flaredAt = useRef(0);

  useLayoutEffect(() => {
    if (phase === 'flare') flaredAt.current = performance.now();
  }, [phase, round]);

  // One timer per phase; each is cleared when the phase ends or the game unmounts.
  useEffect(() => {
    if (phase !== 'wait') return;
    const t = setTimeout(
      () => {
        audio.play('whoosh');
        send({ type: 'flare', target: Math.floor(Math.random() * SIGILS) });
      },
      MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS),
    );
    return () => clearTimeout(t);
  }, [phase, round]);

  useEffect(() => {
    if (phase !== 'flare') return;
    const t = setTimeout(() => send({ type: 'timeout' }), FLARE_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [phase, round]);

  useEffect(() => {
    if (phase !== 'feedback') return;
    const t = setTimeout(() => send({ type: 'next' }), FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [phase, round]);

  useEffect(() => {
    if (phase !== 'done') return;
    const result = summarize(outcomes);
    const t = setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onFinishRef.current(result);
    }, END_BEAT_MS);
    return () => clearTimeout(t);
  }, [phase, outcomes]);

  // A sound for each resolved round.
  useEffect(() => {
    const last = outcomes[outcomes.length - 1];
    if (last) audio.play(last.kind === 'hit' ? 'confirm' : 'fail');
  }, [outcomes]);

  const press = (index: number) => {
    if (phase === 'feedback' || phase === 'done') return;
    send({
      type: 'tap',
      round,
      index,
      sawFlare: phase === 'flare',
      ms: phase === 'flare' ? performance.now() - flaredAt.current : 0,
    });
  };

  const hits = hitTimes(outcomes).length;
  const last = outcomes[outcomes.length - 1];
  const showingResult = phase === 'feedback' || phase === 'done';
  const status = statusLine(state);

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-between gap-3 p-3">
      <div className="w-full flex flex-col items-center gap-1.5">
        <span className="text-sm font-display font-bold text-ink tracking-wider">
          ROUND {formatNumber(Math.min(round + 1, ROUNDS))} OF {formatNumber(ROUNDS)}
        </span>
        <ol className="flex items-center gap-1.5" aria-label="Rounds">
          {Array.from({ length: ROUNDS }, (_, i) => {
            const o = outcomes[i];
            const current = i === round && phase !== 'done';
            const label = o ? (o.kind === 'hit' ? 'hit' : 'miss') : current ? 'playing' : 'to come';
            return (
              <li
                key={i}
                aria-label={`Round ${i + 1}: ${label}`}
                className={`w-7 h-7 flex items-center justify-center border text-[11px] font-mono-code font-bold ${
                  o
                    ? o.kind === 'hit'
                      ? 'border-toxic text-toxic bg-toxic/10'
                      : 'border-crimson text-crimson bg-crimson/10'
                    : current
                      ? 'border-neon text-neon'
                      : 'border-line text-faint'
                }`}
              >
                {o ? (o.kind === 'hit' ? '✓' : '✕') : i + 1}
              </li>
            );
          })}
        </ol>
        <span className="text-[11px] font-tech text-dim">
          Hits {formatNumber(hits)} · {formatNumber(WIN_HITS)} to win
        </span>
      </div>

      <div className="relative w-full max-w-[320px] aspect-square">
        {SIGIL_POS.map((pos, i) => {
          const flared = phase === 'flare' && i === target;
          const wasTarget = showingResult && i === target && last !== undefined;
          const hitHere = wasTarget && last?.kind === 'hit';
          const wrongHere = showingResult && last !== undefined && last.kind !== 'hit' && last.kind !== 'missed' && last.index === i;
          const missedHere = wasTarget && last?.kind === 'missed';
          const mark = hitHere ? '✓' : wrongHere || missedHere ? '✕' : flared ? 'TAP!' : null;
          const stateWord = flared ? 'flaring, tap now' : hitHere ? 'hit' : wrongHere || missedHere ? 'missed' : 'dim';
          return (
            <button
              key={i}
              type="button"
              aria-label={`Sigil ${i + 1}, ${stateWord}`}
              onPointerDown={(e) => {
                e.preventDefault();
                press(i);
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
                  e.preventDefault();
                  press(i);
                }
              }}
              style={{
                left: `${pos.left - SIGIL_SIZE / 2}%`,
                top: `${pos.top - SIGIL_SIZE / 2}%`,
                width: `${SIGIL_SIZE}%`,
                height: `${SIGIL_SIZE}%`,
              }}
              className={`absolute rounded-full flex items-center justify-center touch-none select-none transition-transform duration-150 motion-reduce:transition-none ${
                flared
                  ? 'scale-125 border-4 border-neon-bright bg-neon/25 ring-4 ring-neon/40 shadow-[0_0_24px] shadow-neon/60 z-10'
                  : hitHere
                    ? 'scale-110 border-4 border-toxic bg-toxic/15'
                    : wrongHere || missedHere
                      ? 'border-2 border-dashed border-crimson bg-crimson/10'
                      : 'border-2 border-line bg-panel'
              }`}
            >
              <img
                src="/art/ui/minigame_reflex_icon.png"
                alt=""
                draggable={false}
                className={`w-3/4 h-3/4 object-contain pointer-events-none ${flared || hitHere ? 'opacity-100' : 'opacity-45'}`}
              />
              {mark && (
                <span
                  aria-hidden
                  className={`absolute inset-0 flex items-center justify-center font-display font-black pointer-events-none ${
                    flared ? 'text-lg text-ink drop-shadow-[0_0_6px_black]' : hitHere ? 'text-2xl text-toxic' : 'text-2xl text-crimson'
                  }`}
                >
                  {mark}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="w-full flex flex-col items-center gap-1 text-center">
        <p role="status" aria-live="polite" className={`min-h-[18px] text-xs font-display font-bold tracking-wide ${status.tone}`}>
          {status.text}
        </p>
        <p className="text-[10px] font-tech text-dim">Tap the sigil that flares, the moment it flares. Tapping early is a miss.</p>
      </div>
    </div>
  );
};
