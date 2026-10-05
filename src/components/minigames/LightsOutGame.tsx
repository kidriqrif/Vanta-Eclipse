import React, { useEffect, useRef, useState } from 'react';
import { Sun } from 'lucide-react';
import { formatNumber } from '../../utils/numberFormat';
import type { MinigameProps, MinigameResult } from './types';

const SIZE = 4;
const PANES = SIZE * SIZE;
const MOVE_CAP = 20;
const MIN_PRESSES = 5;
const MAX_PRESSES = 8;
/** A known unsolved 5-press start, used only if every random roll somehow came out already dark. */
const FALLBACK_PRESSES: readonly number[] = [0, 5, 6, 10, 15];
const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
/** How long the final board stays up before the host's result banner takes over. */
const END_PAUSE_MS = 900;

interface PanesState {
  lit: readonly boolean[];
  /** How many distinct presses built the board: it can always be cleared in this many moves or fewer. */
  presses: number;
  moves: number;
  result: MinigameResult | null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Pure: flips pane `i` and its orthogonal neighbours. */
function flip(lit: readonly boolean[], i: number): boolean[] {
  const next = lit.slice();
  const r = Math.floor(i / SIZE);
  const c = i % SIZE;
  for (const [dr, dc] of NEIGHBOURS) {
    const rr = r + dr;
    const cc = c + dc;
    if (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) next[rr * SIZE + cc] = !next[rr * SIZE + cc];
  }
  return next;
}

function pressAll(presses: readonly number[]): boolean[] {
  return presses.reduce<boolean[]>((lit, i) => flip(lit, i), new Array<boolean>(PANES).fill(false));
}

/**
 * Applies k = 5–8 distinct random presses to a dark board, so the puzzle is always solvable
 * in k moves or fewer. Re-rolls the rare start that comes out already dark.
 */
function newGame(): PanesState {
  for (let attempt = 0; attempt < 32; attempt++) {
    const k = MIN_PRESSES + Math.floor(Math.random() * (MAX_PRESSES - MIN_PRESSES + 1));
    const order = Array.from({ length: PANES }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const lit = pressAll(order.slice(0, k));
    if (lit.some(Boolean)) return { lit, presses: k, moves: 0, result: null };
  }
  return { lit: pressAll(FALLBACK_PRESSES), presses: FALLBACK_PRESSES.length, moves: 0, result: null };
}

/** Pure: one tap, then the cleared check and the move-cap check. */
function press(state: PanesState, i: number): PanesState {
  if (state.result || i < 0 || i >= PANES) return state;
  const lit = flip(state.lit, i);
  const moves = state.moves + 1;
  let result: MinigameResult | null = null;
  if (!lit.some(Boolean)) {
    result = {
      won: true,
      performance: clamp(state.presses / moves, 0.4, 1),
      score: moves,
      detail: `Cleared in ${formatNumber(moves)} ${moves === 1 ? 'move' : 'moves'}`,
    };
  } else if (moves >= MOVE_CAP) {
    result = { won: false, performance: 0.2, score: moves, detail: 'Out of moves' };
  }
  return { ...state, lit, moves, result };
}

/** Calls onFinish exactly once, a beat after the outcome is decided so the final board stays readable. */
function useFinishOnce(result: MinigameResult | null, onFinish: MinigameProps['onFinish']) {
  const onFinishRef = useRef(onFinish);
  const sentRef = useRef(false);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);
  useEffect(() => {
    if (!result || sentRef.current) return;
    const timer = window.setTimeout(() => {
      if (sentRef.current) return;
      sentRef.current = true;
      onFinishRef.current(result);
    }, END_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [result]);
}

export const LightsOutGame: React.FC<MinigameProps> = ({ onFinish }) => {
  const [game, setGame] = useState<PanesState>(newGame);
  useFinishOnce(game.result, onFinish);

  const litCount = game.lit.filter(Boolean).length;
  const movesLeft = MOVE_CAP - game.moves;
  const status = game.result?.won
    ? { text: 'All dark — you win', tone: 'text-gold' }
    : game.result
      ? { text: 'Out of moves', tone: 'text-crimson' }
      : { text: 'Turn every pane dark', tone: 'text-neon' };

  const tap = (i: number) => {
    if (game.result) return;
    setGame((g) => press(g, i));
  };

  return (
    <div className="flex-1 min-h-0 w-full overflow-y-auto bg-void bg-grid-pattern flex flex-col items-center gap-3 p-3">
      <div className="w-full max-w-xs flex items-center justify-between gap-2 bg-panel border border-line px-2.5 py-1.5">
        <span className="text-[10px] font-tech text-dim uppercase">
          Moves left{' '}
          <span className={`text-xs font-mono-code font-bold ${movesLeft <= 5 ? 'text-crimson' : 'text-ink'}`}>
            {formatNumber(movesLeft)}
          </span>{' '}
          / {formatNumber(MOVE_CAP)}
        </span>
        <span className="text-[10px] font-tech text-dim uppercase">
          Lit <span className="text-xs font-mono-code font-bold text-gold">{formatNumber(litCount)}</span> /{' '}
          {formatNumber(PANES)}
        </span>
      </div>

      <p role="status" aria-live="polite" className={`min-h-[20px] text-xs font-display font-bold uppercase tracking-wider text-center ${status.tone}`}>
        {status.text}
      </p>

      <div className="w-full max-w-xs grid grid-cols-4 gap-2 bg-panel border-2 border-line p-2.5">
        {game.lit.map((on, i) => (
          <button
            key={i}
            type="button"
            onClick={() => tap(i)}
            disabled={game.result !== null}
            aria-label={`Row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}: ${on ? 'lit' : 'dark'}`}
            className={`aspect-square border-2 flex items-center justify-center transition-colors disabled:cursor-default ${
              on
                ? 'bg-gold border-gold text-void shadow-[0_0_12px_var(--color-gold)]'
                : 'bg-void border-line enabled:hover:border-dim enabled:active:bg-active'
            }`}
          >
            {on && <Sun size={22} strokeWidth={2.5} aria-hidden="true" />}
          </button>
        ))}
      </div>

      <p className="max-w-xs text-center text-[10px] font-tech text-dim">
        Sixteen panes. Each tap flips its neighbours too. This board can be cleared in {formatNumber(game.presses)} moves or
        fewer; you have {formatNumber(MOVE_CAP)}.
      </p>
    </div>
  );
};
