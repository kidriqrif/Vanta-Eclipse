import React, { useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import { audio } from '../../services/audio';
import { formatNumber } from '../../utils/numberFormat';
import type { MinigameProps, MinigameResult } from './types';

const FACES = ['circle', 'cross', 'diamond', 'hexagon', 'square', 'triangle'] as const;
type Face = (typeof FACES)[number];

const PAIRS = FACES.length;
const MAX_ATTEMPTS = 12;
const MISMATCH_SHOW_MS = 800;
const END_BEAT_MS = 900;

interface MatchState {
  /** Fixed for the whole run once shuffled. */
  deck: readonly Face[];
  matched: readonly boolean[];
  /** Face-up cards that are not matched yet (0, 1, or the 2 of a mismatch). */
  open: readonly number[];
  /** An attempt = turning a second card. */
  attempts: number;
  pairs: number;
  /** `mismatch` locks input while two wrong cards are showing. */
  phase: 'play' | 'mismatch' | 'done';
  won: boolean;
}

type MatchAction = { type: 'flip'; index: number } | { type: 'hide' };

/** Fisher–Yates: every order equally likely. */
function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function newGame(): MatchState {
  const deck = shuffle([...FACES, ...FACES]);
  return { deck, matched: deck.map(() => false), open: [], attempts: 0, pairs: 0, phase: 'play', won: false };
}

function reduce(s: MatchState, a: MatchAction): MatchState {
  switch (a.type) {
    case 'flip': {
      const i = a.index;
      if (s.phase !== 'play' || i < 0 || i >= s.deck.length || s.matched[i] || s.open.includes(i)) return s;
      if (s.open.length === 0) return { ...s, open: [i] };
      const j = s.open[0];
      const attempts = s.attempts + 1;
      if (s.deck[i] === s.deck[j]) {
        const pairs = s.pairs + 1;
        const won = pairs === PAIRS;
        // The limit is checked after every attempt, matches included.
        const over = won || attempts >= MAX_ATTEMPTS;
        return {
          ...s,
          matched: s.matched.map((m, k) => m || k === i || k === j),
          open: [],
          attempts,
          pairs,
          phase: over ? 'done' : 'play',
          won,
        };
      }
      return { ...s, open: [j, i], attempts, phase: attempts >= MAX_ATTEMPTS ? 'done' : 'mismatch' };
    }
    case 'hide':
      return s.phase === 'mismatch' ? { ...s, open: [], phase: 'play' } : s;
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function summarize(s: MatchState): MinigameResult {
  return s.won
    ? {
        won: true,
        performance: clamp(1 - (s.attempts - PAIRS) / 12, 0.4, 1),
        score: s.attempts,
        detail: `${formatNumber(PAIRS)} pairs in ${formatNumber(s.attempts)} attempts`,
      }
    : {
        won: false,
        performance: (0.5 * s.pairs) / PAIRS,
        score: s.attempts,
        detail: `${formatNumber(s.pairs)} of ${formatNumber(PAIRS)} pairs`,
      };
}

/**
 * Memory Match: six pairs face down, twelve attempts to find them all. Score = attempts used
 * (lower is better).
 */
export const MemoryMatchGame: React.FC<MinigameProps> = ({ onFinish }) => {
  const [state, send] = useReducer(reduce, undefined, newGame);
  const { deck, matched, open, attempts, pairs, phase, won } = state;

  const onFinishRef = useRef(onFinish);
  useLayoutEffect(() => {
    onFinishRef.current = onFinish;
  });
  const finished = useRef(false);

  useEffect(() => {
    if (phase !== 'mismatch') return;
    const t = setTimeout(() => send({ type: 'hide' }), MISMATCH_SHOW_MS);
    return () => clearTimeout(t);
  }, [phase, attempts]);

  // Once done, every action is a no-op, so `state` no longer changes and the beat runs once.
  useEffect(() => {
    if (state.phase !== 'done') return;
    const result = summarize(state);
    const t = setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      onFinishRef.current(result);
    }, END_BEAT_MS);
    return () => clearTimeout(t);
  }, [state]);

  // A sound for each attempt: a match or a miss.
  const seen = useRef({ attempts: 0, pairs: 0 });
  useEffect(() => {
    if (attempts === seen.current.attempts) return;
    audio.play(pairs > seen.current.pairs ? 'confirm' : 'fail');
    seen.current = { attempts, pairs };
  }, [attempts, pairs]);

  const flip = (index: number) => {
    if (phase !== 'play' || matched[index] || open.includes(index)) return;
    audio.play('click');
    send({ type: 'flip', index });
  };

  const left = MAX_ATTEMPTS - attempts;
  const status =
    phase === 'done'
      ? won
        ? { text: `CLEARED · ${summarize(state).detail}`, tone: 'text-toxic' }
        : { text: `OUT OF ATTEMPTS · ${summarize(state).detail}`, tone: 'text-dim' }
      : phase === 'mismatch'
        ? { text: '✕ NOT A PAIR', tone: 'text-crimson' }
        : open.length === 1
          ? { text: 'Now find its pair', tone: 'text-neon' }
          : { text: 'Turn two cards', tone: 'text-dim' };

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-between gap-3 p-3">
      <div className="w-full max-w-sm grid grid-cols-2 gap-2">
        <div className="bg-panel border border-line px-2 py-1 flex flex-col items-center">
          <span className="text-[9px] font-tech text-dim uppercase tracking-wider">Attempts</span>
          <span className={`text-sm font-mono-code font-bold ${left <= 3 && phase !== 'done' ? 'text-crimson' : 'text-ink'}`}>
            {formatNumber(attempts)} / {formatNumber(MAX_ATTEMPTS)}
          </span>
          <span className="text-[9px] font-tech text-dim">{formatNumber(left)} left</span>
        </div>
        <div className="bg-panel border border-line px-2 py-1 flex flex-col items-center">
          <span className="text-[9px] font-tech text-dim uppercase tracking-wider">Pairs</span>
          <span className="text-sm font-mono-code font-bold text-toxic">
            {formatNumber(pairs)} / {formatNumber(PAIRS)}
          </span>
          <span className="text-[9px] font-tech text-dim">found</span>
        </div>
      </div>

      <div className="w-full max-w-sm grid grid-cols-4 gap-2">
        {deck.map((face, i) => {
          const isMatched = matched[i];
          const isOpen = open.includes(i);
          // A lost run turns the rest face up so the player sees where the pairs were.
          const revealed = !isMatched && !isOpen && phase === 'done' && !won;
          const faceUp = isMatched || isOpen || revealed;
          const wrong = isOpen && open.length === 2;
          const label = isMatched
            ? `${face}, matched`
            : isOpen
              ? wrong
                ? `${face}, not a pair`
                : face
              : revealed
                ? `${face}, not found`
                : 'face down';
          return (
            <button
              key={i}
              type="button"
              onClick={() => flip(i)}
              aria-label={`Card ${i + 1}, ${label}`}
              aria-disabled={phase !== 'play' || isMatched || isOpen}
              className={`relative aspect-square border-2 flex items-center justify-center overflow-hidden transition-transform duration-150 motion-reduce:transition-none ${
                isMatched
                  ? 'border-toxic bg-toxic/10'
                  : wrong
                    ? 'border-crimson bg-crimson/10'
                    : isOpen
                      ? 'border-neon-bright bg-active scale-105'
                      : revealed
                        ? 'border-line bg-panel2'
                        : 'border-line bg-panel hover:border-neon'
              }`}
            >
              <img
                src={faceUp ? `/art/minigames/face_${face}.png` : '/art/minigames/card_back.png'}
                alt=""
                draggable={false}
                className={`w-full h-full object-contain p-1.5 pointer-events-none ${revealed ? 'opacity-40' : ''}`}
              />
              {isMatched && (
                <span aria-hidden className="absolute top-0.5 right-1 text-xs font-bold text-toxic">
                  ✓
                </span>
              )}
              {wrong && (
                <span aria-hidden className="absolute top-0.5 right-1 text-xs font-bold text-crimson">
                  ✕
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
        <p className="text-[10px] font-tech text-dim">
          Find all {formatNumber(PAIRS)} pairs within {formatNumber(MAX_ATTEMPTS)} attempts. Each second card you turn is one attempt.
        </p>
      </div>
    </div>
  );
};
