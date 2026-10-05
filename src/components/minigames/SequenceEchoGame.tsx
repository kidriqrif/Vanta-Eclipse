import React, { useEffect, useReducer, useRef } from 'react';
import { formatNumber } from '../../utils/numberFormat';
import { clamp01, type MinigameProps } from './types';

/**
 * Sequence Echo: four runes call a growing pattern — one new rune per round, the whole call
 * replays each round — and the player echoes it back. Echo all TARGET_LENGTH runes to win.
 *
 * The full pattern is drawn once when the run starts, so React StrictMode re-running effects
 * cannot generate or play a second sequence. Taps are accepted only in the 'input' phase:
 * never during playback, the pause between rounds, or after the run has ended.
 */

const TARGET_LENGTH = 5;

const LEAD_IN_MS = 600; // quiet beat before a call starts
const STEP_MS = 650; // one rune every STEP_MS during a call
const LIT_MS = 400; // how long a called rune glows (the gap lets a repeated rune read twice)
const HANDOFF_MS = 150; // after the last rune dims, before taps open
const ROUND_PAUSE_MS = 800; // "round clear" beat before the next, longer call
const PRESS_FLASH_MS = 180; // glow on the rune the player tapped
const END_DELAY_MS = 1000; // let the final state read before the host takes over

interface Rune {
  name: string;
  art: string;
  /** Tailwind classes, written out in full so the compiler sees them. */
  border: string;
  glow: string;
  text: string;
  chip: string;
}

const RUNES: readonly Rune[] = [
  {
    name: 'Circle',
    art: '/art/minigames/face_circle.png',
    border: 'border-neon/50',
    glow: 'border-neon bg-neon/20 shadow-[0_0_24px_var(--color-neon)]',
    text: 'text-neon',
    chip: 'bg-neon text-void',
  },
  {
    name: 'Diamond',
    art: '/art/minigames/face_diamond.png',
    border: 'border-gold/50',
    glow: 'border-gold bg-gold/20 shadow-[0_0_24px_var(--color-gold)]',
    text: 'text-gold',
    chip: 'bg-gold text-void',
  },
  {
    name: 'Triangle',
    art: '/art/minigames/face_triangle.png',
    border: 'border-purple/50',
    glow: 'border-purple bg-purple/20 shadow-[0_0_24px_var(--color-purple)]',
    text: 'text-purple',
    chip: 'bg-purple text-void',
  },
  {
    name: 'Hexagon',
    art: '/art/minigames/face_hexagon.png',
    border: 'border-crimson/50',
    glow: 'border-crimson bg-crimson/20 shadow-[0_0_24px_var(--color-crimson)]',
    text: 'text-crimson',
    chip: 'bg-crimson text-void',
  },
];

type Phase = 'watch' | 'input' | 'pause' | 'won' | 'lost';

interface EchoState {
  /** The whole call for this run, drawn once. Round n plays the first n runes. */
  pattern: readonly number[];
  /** Runes in the current round's call (1..TARGET_LENGTH). */
  length: number;
  phase: Phase;
  /** Runes echoed correctly so far this round. */
  echoed: number;
  /** Rounds fully echoed — the score. */
  roundsCompleted: number;
  /** Rune glowing during a call. */
  lit: number | null;
  /** Feedback glow on the rune the player just tapped; seq retriggers the fade timer. */
  press: { rune: number; seq: number } | null;
  /** The tap that ended the run, and what the call needed instead. */
  miss: { tapped: number; expected: number } | null;
}

type EchoAction =
  | { type: 'light'; rune: number | null }
  | { type: 'callDone' }
  | { type: 'tap'; rune: number }
  | { type: 'unpress'; seq: number }
  | { type: 'nextRound' };

function initState(): EchoState {
  return {
    pattern: Array.from({ length: TARGET_LENGTH }, () => Math.floor(Math.random() * RUNES.length)),
    length: 1,
    phase: 'watch',
    echoed: 0,
    roundsCompleted: 0,
    lit: null,
    press: null,
    miss: null,
  };
}

function reducer(s: EchoState, a: EchoAction): EchoState {
  switch (a.type) {
    case 'light':
      return s.phase === 'watch' && s.lit !== a.rune ? { ...s, lit: a.rune } : s;
    case 'callDone':
      return s.phase === 'watch' ? { ...s, phase: 'input', lit: null, echoed: 0 } : s;
    case 'tap': {
      if (s.phase !== 'input') return s;
      const press = { rune: a.rune, seq: (s.press?.seq ?? 0) + 1 };
      const expected = s.pattern[s.echoed];
      if (a.rune !== expected) {
        return { ...s, phase: 'lost', press, miss: { tapped: a.rune, expected } };
      }
      const echoed = s.echoed + 1;
      if (echoed < s.length) return { ...s, echoed, press };
      return {
        ...s,
        echoed,
        press,
        roundsCompleted: s.length,
        phase: s.length >= TARGET_LENGTH ? 'won' : 'pause',
      };
    }
    case 'unpress':
      return s.press && s.press.seq === a.seq ? { ...s, press: null } : s;
    case 'nextRound':
      return s.phase === 'pause' ? { ...s, length: s.length + 1, echoed: 0, phase: 'watch' } : s;
  }
}

export const SequenceEchoGame: React.FC<MinigameProps> = ({ onFinish }) => {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const { pattern, length, phase, echoed, roundsCompleted, lit, press, miss } = state;

  // The host may hand us a new onFinish on any render; the end timer must not restart for it.
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);
  const finishedRef = useRef(false);

  // Play the call. Every timer is owned by this effect, so a StrictMode re-run or an unmount
  // clears the whole schedule before any of it fires.
  useEffect(() => {
    if (phase !== 'watch') return;
    const timers: number[] = [];
    for (let i = 0; i < length; i++) {
      const at = LEAD_IN_MS + i * STEP_MS;
      const rune = pattern[i];
      timers.push(window.setTimeout(() => dispatch({ type: 'light', rune }), at));
      timers.push(window.setTimeout(() => dispatch({ type: 'light', rune: null }), at + LIT_MS));
    }
    const done = LEAD_IN_MS + (length - 1) * STEP_MS + LIT_MS + HANDOFF_MS;
    timers.push(window.setTimeout(() => dispatch({ type: 'callDone' }), done));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [phase, length, pattern]);

  // Short beat between rounds, then the next, longer call.
  useEffect(() => {
    if (phase !== 'pause') return;
    const t = window.setTimeout(() => dispatch({ type: 'nextRound' }), ROUND_PAUSE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Fade the tap glow.
  const pressSeq = press?.seq;
  useEffect(() => {
    if (pressSeq === undefined) return;
    const t = window.setTimeout(() => dispatch({ type: 'unpress', seq: pressSeq }), PRESS_FLASH_MS);
    return () => window.clearTimeout(t);
  }, [pressSeq]);

  // Report the outcome exactly once, after a beat so the final state can be read.
  useEffect(() => {
    if (phase !== 'won' && phase !== 'lost') return;
    const won = phase === 'won';
    const t = window.setTimeout(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      onFinishRef.current({
        won,
        performance: won ? 1 : clamp01(roundsCompleted / TARGET_LENGTH),
        score: roundsCompleted,
        detail: `Echoed ${formatNumber(roundsCompleted)} of ${formatNumber(TARGET_LENGTH)}`,
      });
    }, END_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [phase, roundsCompleted]);

  const inputOpen = phase === 'input';
  const ended = phase === 'won' || phase === 'lost';

  let headline: string;
  let headlineClass: string;
  let subline: string;
  switch (phase) {
    case 'watch':
      headline = 'Watch';
      headlineClass = 'text-neon';
      subline = `Memorise the call: ${formatNumber(length)} ${length === 1 ? 'rune' : 'runes'}.`;
      break;
    case 'input':
      headline = 'Your turn';
      headlineClass = 'text-gold';
      subline = `Echo it back: ${formatNumber(echoed)} of ${formatNumber(length)} done.`;
      break;
    case 'pause':
      headline = 'Round clear';
      headlineClass = 'text-toxic';
      subline = 'The next call adds one rune.';
      break;
    case 'won':
      headline = 'Pattern echoed';
      headlineClass = 'text-toxic';
      subline = `All ${formatNumber(TARGET_LENGTH)} rounds echoed.`;
      break;
    case 'lost':
      headline = 'Wrong rune';
      headlineClass = 'text-crimson';
      subline = miss
        ? `The call needed ${RUNES[miss.expected].name}. Echoed ${formatNumber(roundsCompleted)} of ${formatNumber(TARGET_LENGTH)}.`
        : `Echoed ${formatNumber(roundsCompleted)} of ${formatNumber(TARGET_LENGTH)}.`;
      break;
  }

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-between gap-4 p-4 bg-void text-ink select-none overflow-y-auto">
      {/* Round track */}
      <div className="w-full max-w-sm flex flex-col items-center gap-2">
        <div className="w-full flex items-center justify-between font-display text-[10px] uppercase text-dim">
          <span>
            Round {formatNumber(length)} of {formatNumber(TARGET_LENGTH)}
          </span>
          <span>
            Echoed {formatNumber(roundsCompleted)} of {formatNumber(TARGET_LENGTH)}
          </span>
        </div>
        <div className="w-full flex gap-1.5" aria-hidden="true">
          {Array.from({ length: TARGET_LENGTH }, (_, i) => {
            const done = i < roundsCompleted;
            const current = !done && i === length - 1 && !ended;
            return (
              <span
                key={i}
                className={`h-2 flex-1 border ${
                  done ? 'bg-neon border-neon' : current ? 'border-neon bg-transparent' : 'border-line bg-transparent'
                }`}
              />
            );
          })}
        </div>
        <p role="status" aria-live="polite" className="flex flex-col items-center gap-0.5 text-center">
          <span className={`font-display text-base font-black uppercase tracking-widest ${headlineClass}`}>{headline}</span>
          <span className="text-[11px] text-dim">{subline}</span>
        </p>
      </div>

      {/* The four runes */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-[280px]">
        {RUNES.map((rune, id) => {
          const glowing = lit === id || press?.rune === id;
          const wrong = phase === 'lost' && miss?.tapped === id;
          const needed = phase === 'lost' && miss?.expected === id && miss.tapped !== id;
          const look = wrong ? 'wrong' : needed ? 'needed' : glowing ? 'glow' : 'idle';
          const frame =
            look === 'wrong'
              ? 'border-crimson bg-crimson/20'
              : look === 'needed'
                ? 'border-gold border-dashed bg-panel'
                : look === 'glow'
                  ? `${rune.glow} scale-105`
                  : `${rune.border} bg-panel`;
          const label = look === 'wrong' ? `✕ ${rune.name}` : look === 'needed' ? `Needed: ${rune.name}` : rune.name;
          return (
            <button
              key={rune.name}
              type="button"
              onClick={() => dispatch({ type: 'tap', rune: id })}
              disabled={!inputOpen}
              aria-label={`${rune.name} rune`}
              className={`aspect-square border-2 flex flex-col items-center justify-center gap-2 transition-all duration-100 ${frame} ${
                inputOpen ? 'cursor-pointer active:scale-95' : 'cursor-default'
              }`}
            >
              <img
                src={rune.art}
                alt=""
                draggable={false}
                className={`pixelated w-14 h-14 transition-opacity ${look === 'idle' && !inputOpen ? 'opacity-50' : 'opacity-100'}`}
              />
              <span
                className={`font-display text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${
                  look === 'glow' ? rune.chip : look === 'wrong' ? 'bg-crimson text-void' : look === 'needed' ? 'text-gold' : rune.text
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Progress through the current call */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length }, (_, i) => (
            <span key={i} className={`w-3 h-3 border ${i < echoed ? 'bg-gold border-gold' : 'border-line'}`} />
          ))}
        </div>
        <p className="text-center text-[11px] text-dim max-w-xs">
          Watch the runes light up, then tap them in the same order. Each round adds one rune; echo{' '}
          {formatNumber(TARGET_LENGTH)} in a row to win.
        </p>
      </div>
    </div>
  );
};
