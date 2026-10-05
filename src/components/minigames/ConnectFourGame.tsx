import React, { useEffect, useRef, useState } from 'react';
import { formatNumber } from '../../utils/numberFormat';
import type { MinigameProps, MinigameResult } from './types';
import { useFinishOnce } from './useFinishOnce';

const ROWS = 6;
const COLS = 7;
const EMPTY = 0;
const PLAYER = 1;
const AI = 2;
type Side = typeof PLAYER | typeof AI;
type Disc = typeof EMPTY | Side;
/** Row-major, row 0 at the top: cell = row * COLS + col. */
type Board = readonly Disc[];

/** The void's column preference when nothing is forced: centre first, then outward. Ties are random. */
const CENTRE_TIERS: readonly (readonly number[])[] = [[3], [2, 4], [1, 5], [0, 6]];
const DIRECTIONS: readonly (readonly [number, number])[] = [
  [0, 1], // across
  [1, 0], // down
  [1, 1], // diagonal \
  [1, -1], // diagonal /
];
const AI_DELAY_MS = 550;
/** How long the final board stays up before the host's result banner takes over. */
const END_PAUSE_MS = 1000;
const DISC_ART: Record<Side, string> = {
  [PLAYER]: '/art/minigames/disc_player.png',
  [AI]: '/art/minigames/disc_ai.png',
};

interface C4State {
  board: Board;
  turn: 'player' | 'ai';
  playerMoves: number;
  lastCell: number | null;
  winLine: readonly number[] | null;
  result: MinigameResult | null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
const plural = (n: number, word: string) => `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`;

function newGame(): C4State {
  return {
    board: new Array<Disc>(ROWS * COLS).fill(EMPTY),
    turn: 'player',
    playerMoves: 0,
    lastCell: null,
    winLine: null,
    result: null,
  };
}

/** The row a disc dropped in `col` lands on, or -1 when the column is full. */
function dropRow(board: Board, col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (board[r * COLS + col] === EMPTY) return r;
  return -1;
}

function withDisc(board: Board, row: number, col: number, side: Side): Board {
  const next = board.slice();
  next[row * COLS + col] = side;
  return next;
}

/** Every cell of the run of `side` through (row, col) if it is four or longer, else null. */
function lineThrough(board: Board, row: number, col: number, side: Side): number[] | null {
  for (const [dr, dc] of DIRECTIONS) {
    const line = [row * COLS + col];
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r * COLS + c] === side) {
        line.push(r * COLS + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

/** Columns where `side` would complete four with its next disc. */
function winningColumns(board: Board, side: Side): number[] {
  const cols: number[] = [];
  for (let c = 0; c < COLS; c++) {
    const r = dropRow(board, c);
    if (r >= 0 && lineThrough(withDisc(board, r, c, side), r, c, side)) cols.push(c);
  }
  return cols;
}

/** Win if possible, else block, else the most central column that does not hand the player a win. */
function chooseAiColumn(board: Board): number {
  const open: number[] = [];
  for (let c = 0; c < COLS; c++) if (dropRow(board, c) >= 0) open.push(c);
  if (open.length === 0) return -1;

  const wins = winningColumns(board, AI);
  if (wins.length > 0) return pick(wins);
  const blocks = winningColumns(board, PLAYER);
  if (blocks.length > 0) return pick(blocks);

  const safe = open.filter((c) => winningColumns(withDisc(board, dropRow(board, c), c, AI), PLAYER).length === 0);
  const pool = safe.length > 0 ? safe : open;
  for (const tier of CENTRE_TIERS) {
    const options = tier.filter((c) => pool.includes(c));
    if (options.length > 0) return pick(options);
  }
  return pick(pool);
}

function resultFor(winner: Side | null, playerMoves: number): MinigameResult {
  if (winner === PLAYER) {
    return {
      won: true,
      performance: clamp(1 - (playerMoves - 4) / 17, 0.4, 1),
      score: playerMoves,
      detail: `Won in ${plural(playerMoves, 'move')}`,
    };
  }
  if (winner === AI) return { won: false, performance: 0.2, score: playerMoves, detail: 'The void connected four' };
  return { won: false, performance: 0.5, score: playerMoves, detail: 'Draw — the board filled' };
}

/** Pure: one disc for `side` in `col`, then win / draw detection. Illegal or late moves return the state unchanged. */
function applyDrop(state: C4State, col: number, side: Side): C4State {
  if (state.result || state.turn !== (side === PLAYER ? 'player' : 'ai')) return state;
  if (col < 0 || col >= COLS) return state;
  const row = dropRow(state.board, col);
  if (row < 0) return state;

  const board = withDisc(state.board, row, col, side);
  const playerMoves = state.playerMoves + (side === PLAYER ? 1 : 0);
  const winLine = lineThrough(board, row, col, side);
  const full = board.every((d) => d !== EMPTY);
  return {
    board,
    turn: side === PLAYER ? 'ai' : 'player',
    playerMoves,
    lastCell: row * COLS + col,
    winLine,
    result: winLine ? resultFor(side, playerMoves) : full ? resultFor(null, playerMoves) : null,
  };
}

/** Calls onFinish exactly once, a beat after the outcome is decided so the final board stays readable. */

function statusLine(game: C4State): { text: string; tone: string } {
  if (game.result?.won) return { text: 'Four in a row — you win', tone: 'text-gold' };
  if (game.result && game.winLine) return { text: 'The void connected four', tone: 'text-crimson' };
  if (game.result) return { text: 'Draw — the board filled', tone: 'text-dim' };
  if (game.turn === 'player') return { text: 'Your turn — tap a column', tone: 'text-neon' };
  return { text: 'The void is choosing…', tone: 'text-dim' };
}

function columnLabel(board: Board, col: number): string {
  const stack: string[] = [];
  for (let r = ROWS - 1; r >= 0; r--) {
    const d = board[r * COLS + col];
    if (d === EMPTY) break;
    stack.push(d === PLAYER ? 'yours' : 'void');
  }
  const free = ROWS - stack.length;
  const contents = stack.length > 0 ? `${stack.join(', ')} from the bottom` : 'empty';
  return `Column ${col + 1}: ${contents}; ${free === 0 ? 'full' : `${free} free`}`;
}

/**
 * A disc with a shape cue as well as colour: the void's discs are hollow-centred, yours are solid.
 * `className` must position it (relative or absolute) so the centre mark has an anchor.
 */
const DiscArt: React.FC<{ side: Side; className: string }> = ({ side, className }) => (
  <span className={`block ${className}`}>
    <img src={DISC_ART[side]} alt="" draggable={false} className="w-full h-full pixelated" />
    {side === AI && <span className="absolute inset-[34%] rounded-full bg-void/75" />}
  </span>
);

export const ConnectFourGame: React.FC<MinigameProps> = ({ onFinish }) => {
  const [game, setGame] = useState<C4State>(newGame);
  useFinishOnce(game.result, onFinish, END_PAUSE_MS);

  // The void's turn. Input is locked until its disc lands; the timer dies with the component.
  useEffect(() => {
    if (game.turn !== 'ai' || game.result) return;
    const board = game.board;
    const timer = window.setTimeout(() => {
      const col = chooseAiColumn(board);
      setGame((g) => (g.board === board ? applyDrop(g, col, AI) : g));
    }, AI_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [game.turn, game.result, game.board]);

  const playerTurn = game.turn === 'player' && !game.result;
  const winCells = new Set(game.winLine ?? []);
  const status = statusLine(game);

  const drop = (col: number) => {
    if (!playerTurn) return;
    setGame((g) => applyDrop(g, col, PLAYER));
  };

  return (
    <div className="flex-1 min-h-0 w-full overflow-y-auto bg-void bg-grid-pattern flex flex-col items-center gap-3 p-3">
      <div className="w-full max-w-sm flex items-center justify-between gap-2 bg-panel border border-line px-2.5 py-1.5">
        <div className="flex items-center gap-3 text-[10px] font-tech text-dim uppercase">
          <span className="flex items-center gap-1">
            <DiscArt side={PLAYER} className="relative w-4 h-4" /> You
          </span>
          <span className="flex items-center gap-1">
            <DiscArt side={AI} className="relative w-4 h-4" /> Void
          </span>
        </div>
        <span className="text-[10px] font-tech text-dim uppercase">
          Your moves <span className="text-xs font-mono-code font-bold text-ink">{formatNumber(game.playerMoves)}</span>
        </span>
      </div>

      <p role="status" aria-live="polite" className={`min-h-[20px] text-xs font-display font-bold uppercase tracking-wider text-center ${status.tone}`}>
        {status.text}
      </p>

      <div className="w-full max-w-sm grid grid-cols-7 gap-1 bg-panel border-2 border-line p-1.5">
        {Array.from({ length: COLS }, (_, c) => {
          const full = game.board[c] !== EMPTY;
          return (
            <button
              key={c}
              type="button"
              onClick={() => drop(c)}
              disabled={!playerTurn || full}
              aria-label={columnLabel(game.board, c)}
              className="flex flex-col gap-1 p-0.5 transition-colors enabled:hover:bg-active enabled:active:bg-active disabled:cursor-default"
            >
              {Array.from({ length: ROWS }, (_, r) => {
                const cell = r * COLS + c;
                const disc = game.board[cell];
                const ring = winCells.has(cell) ? 'ring-2 ring-gold' : game.lastCell === cell ? 'ring-1 ring-ink/60' : '';
                return (
                  <span key={r} className={`relative block w-full aspect-square rounded-sm ${ring}`}>
                    <img src="/art/minigames/cell_empty.png" alt="" draggable={false} className="absolute inset-0 w-full h-full pixelated" />
                    {disc !== EMPTY && <DiscArt side={disc} className="absolute inset-[6%] animate-fade-in" />}
                  </span>
                );
              })}
            </button>
          );
        })}
      </div>

      <p className="max-w-sm text-center text-[10px] font-tech text-dim">
        Line up four of your discs across, down or diagonally before the void does. Centre columns are strongest.
      </p>
    </div>
  );
};
