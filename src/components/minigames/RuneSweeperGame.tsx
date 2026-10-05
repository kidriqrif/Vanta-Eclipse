import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Flag, Pickaxe, Timer, X } from 'lucide-react';
import { formatDuration, formatNumber } from '../../utils/numberFormat';
import { clamp01, type MinigameProps } from './types';

/**
 * Rune Sweeper: minesweeper on a 6×6 field with 6 void mines.
 *
 * Mines are placed on the first reveal, away from the tapped rune and its neighbours, so the
 * first tap is always safe and always opens a region. Long-press (or right-click, or FLAG
 * mode) flags a rune; flags are capped at the mine count. Once a mine is hit or every safe
 * rune is open the board locks and the outcome is reported exactly once.
 */

const SIZE = 6;
const MINES = 6;
const CELLS = SIZE * SIZE;
const SAFE_TOTAL = CELLS - MINES;

const LONG_PRESS_MS = 420;
const MOVE_CANCEL_PX = 10;
const CLOCK_TICK_MS = 250;
const END_DELAY_MS = 1200; // let the final board read before the host takes over

const MINE_ART = '/art/minigames/shot_hit.png';

type Status = 'ready' | 'playing' | 'won' | 'lost';
type Notice = 'flag-cap' | 'flagged';

interface SweepState {
  /** A random ordering of every cell, drawn once; mines are taken from it on the first reveal. */
  order: readonly number[];
  /** Null until the first reveal. */
  mines: readonly boolean[] | null;
  adjacent: readonly number[];
  revealed: readonly boolean[];
  flagged: readonly boolean[];
  status: Status;
  /** The mine that ended the run. */
  hit: number | null;
  startedAt: number | null;
  endedAt: number | null;
  notice: Notice | null;
}

type SweepAction = { type: 'reveal'; cell: number; now: number } | { type: 'toggleFlag'; cell: number };

function neighbours(cell: number): number[] {
  const r = Math.floor(cell / SIZE);
  const c = cell % SIZE;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) out.push(nr * SIZE + nc);
    }
  }
  return out;
}

/** Mines from `order`, skipping the first-tapped cell and its neighbours (only the cell itself if space is short). */
function placeMines(order: readonly number[], first: number): boolean[] {
  const pick = (excluded: Set<number>) => order.filter((cell) => !excluded.has(cell)).slice(0, MINES);
  let chosen = pick(new Set([first, ...neighbours(first)]));
  if (chosen.length < MINES) chosen = pick(new Set([first]));
  const mines = new Array<boolean>(CELLS).fill(false);
  for (const cell of chosen) mines[cell] = true;
  return mines;
}

function countAdjacent(mines: readonly boolean[]): number[] {
  return mines.map((_, cell) => neighbours(cell).filter((n) => mines[n]).length);
}

/** Opens `start`, flooding outward through zeros. Flagged runes are left closed. */
function flood(
  mines: readonly boolean[],
  adjacent: readonly number[],
  revealed: readonly boolean[],
  flagged: readonly boolean[],
  start: number,
): boolean[] {
  const next = revealed.slice();
  const queue = [start];
  while (queue.length > 0) {
    const cell = queue.pop()!;
    if (next[cell] || flagged[cell] || mines[cell]) continue;
    next[cell] = true;
    if (adjacent[cell] === 0) {
      for (const n of neighbours(cell)) if (!next[n]) queue.push(n);
    }
  }
  return next;
}

function countSafeRevealed(s: SweepState): number {
  if (!s.mines) return 0;
  let n = 0;
  for (let i = 0; i < CELLS; i++) if (s.revealed[i] && !s.mines[i]) n++;
  return n;
}

function initState(): SweepState {
  const order = Array.from({ length: CELLS }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    order,
    mines: null,
    adjacent: new Array<number>(CELLS).fill(0),
    revealed: new Array<boolean>(CELLS).fill(false),
    flagged: new Array<boolean>(CELLS).fill(false),
    status: 'ready',
    hit: null,
    startedAt: null,
    endedAt: null,
    notice: null,
  };
}

function reducer(s: SweepState, a: SweepAction): SweepState {
  if (s.status === 'won' || s.status === 'lost') return s;
  const { cell } = a;
  if (cell < 0 || cell >= CELLS || s.revealed[cell]) return s;

  if (a.type === 'toggleFlag') {
    const placing = !s.flagged[cell];
    if (placing && s.flagged.filter(Boolean).length >= MINES) {
      return s.notice === 'flag-cap' ? s : { ...s, notice: 'flag-cap' };
    }
    const flagged = s.flagged.slice();
    flagged[cell] = placing;
    return { ...s, flagged, notice: null };
  }

  if (s.flagged[cell]) return s.notice === 'flagged' ? s : { ...s, notice: 'flagged' };

  const mines = s.mines ?? placeMines(s.order, cell);
  const adjacent = s.mines ? s.adjacent : countAdjacent(mines);
  const startedAt = s.startedAt ?? a.now;

  if (mines[cell]) {
    const revealed = s.revealed.slice();
    revealed[cell] = true;
    return { ...s, mines, adjacent, revealed, startedAt, status: 'lost', hit: cell, endedAt: a.now, notice: null };
  }

  const revealed = flood(mines, adjacent, s.revealed, s.flagged, cell);
  const next: SweepState = { ...s, mines, adjacent, revealed, startedAt, status: 'playing', notice: null };
  return countSafeRevealed(next) >= SAFE_TOTAL ? { ...next, status: 'won', endedAt: a.now } : next;
}

/** Whole seconds of a finished run; at least 1 so a record always reads as a time. */
function finalSeconds(startedAt: number | null, endedAt: number | null): number {
  if (startedAt === null || endedAt === null) return 1;
  return Math.max(1, Math.floor((endedAt - startedAt) / 1000));
}

const NUMBER_CLASS = ['', 'text-neon', 'text-toxic', 'text-gold', 'text-crimson', 'text-purple', 'text-purple', 'text-purple', 'text-purple'];

export const RuneSweeperGame: React.FC<MinigameProps> = ({ onFinish }) => {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const { mines, adjacent, revealed, flagged, status, hit, startedAt, endedAt, notice } = state;
  const [flagMode, setFlagMode] = useState(false);
  const [clock, setClock] = useState(() => performance.now());

  const ended = status === 'won' || status === 'lost';
  const flagsPlaced = flagged.filter(Boolean).length;
  const safeRevealed = countSafeRevealed(state);

  // The host may hand us a new onFinish on any render; the end timer must not restart for it.
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);
  const finishedRef = useRef(false);

  // Live clock while the run is on; it stops (and the readout freezes) when the run ends.
  useEffect(() => {
    if (status !== 'playing') return;
    setClock(performance.now());
    const id = window.setInterval(() => setClock(performance.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, [status]);

  // Long-press to flag. The pending timer lives in a ref and is cleared on release, on drift,
  // when the run ends and on unmount; the click that follows a long-press is swallowed.
  const press = useRef<{ cell: number; x: number; y: number; timer: number } | null>(null);
  const swallowClick = useRef<number | null>(null);
  const cancelPress = () => {
    if (press.current) {
      window.clearTimeout(press.current.timer);
      press.current = null;
    }
  };
  useEffect(() => cancelPress, []);
  useEffect(() => {
    if (ended) cancelPress();
  }, [ended]);

  // Report the outcome exactly once, after a beat so the final board can be read.
  useEffect(() => {
    if (status !== 'won' && status !== 'lost') return;
    const won = status === 'won';
    const secs = finalSeconds(startedAt, endedAt);
    const t = window.setTimeout(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      onFinishRef.current(
        won
          ? {
              won: true,
              performance: Math.min(1, Math.max(0.4, 1 - (secs - 20) / 100)),
              score: secs,
              detail: `Cleared in ${formatDuration(secs)}`,
            }
          : {
              won: false,
              performance: clamp01((0.5 * safeRevealed) / SAFE_TOTAL),
              score: secs,
              detail: `Mine triggered — ${formatNumber(safeRevealed)} of ${formatNumber(SAFE_TOTAL)} safe runes cleared`,
            },
      );
    }, END_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [status, startedAt, endedAt, safeRevealed]);

  const onPointerDown = (cell: number, e: React.PointerEvent<HTMLButtonElement>) => {
    if (ended) return;
    if (e.pointerType === 'mouse' && e.button !== 0) {
      if (e.button === 2) dispatch({ type: 'toggleFlag', cell });
      return;
    }
    cancelPress();
    swallowClick.current = null;
    const timer = window.setTimeout(() => {
      press.current = null;
      swallowClick.current = cell;
      dispatch({ type: 'toggleFlag', cell });
    }, LONG_PRESS_MS);
    press.current = { cell, x: e.clientX, y: e.clientY, timer };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_CANCEL_PX) cancelPress();
  };

  const onClick = (cell: number, e: React.MouseEvent<HTMLButtonElement>) => {
    // detail 0 = keyboard activation, which no long-press can precede.
    if (e.detail !== 0 && swallowClick.current === cell) {
      swallowClick.current = null;
      return;
    }
    swallowClick.current = null;
    if (flagMode) dispatch({ type: 'toggleFlag', cell });
    else dispatch({ type: 'reveal', cell, now: performance.now() });
  };

  const shownSeconds = ended
    ? finalSeconds(startedAt, endedAt)
    : startedAt === null
      ? 0
      : Math.floor(Math.max(0, clock - startedAt) / 1000);

  let statusLine: string;
  let statusClass = 'text-dim';
  if (status === 'won') {
    statusLine = `Field cleared in ${formatDuration(shownSeconds)}.`;
    statusClass = 'text-toxic';
  } else if (status === 'lost') {
    statusLine = `Mine triggered — ${formatNumber(safeRevealed)} of ${formatNumber(SAFE_TOTAL)} safe runes cleared.`;
    statusClass = 'text-crimson';
  } else if (notice === 'flag-cap') {
    statusLine = `All ${formatNumber(MINES)} flags are placed. Remove one first.`;
    statusClass = 'text-gold';
  } else if (notice === 'flagged') {
    statusLine = 'That rune is flagged. Long-press it or use FLAG mode to remove the flag.';
    statusClass = 'text-gold';
  } else if (flagMode) {
    statusLine = 'FLAG mode: taps place or remove flags.';
    statusClass = 'text-gold';
  } else if (status === 'ready') {
    statusLine = 'Tap any rune to start. Your first tap is always safe.';
  } else {
    statusLine = 'Tap to reveal. Long-press to flag a mine.';
  }

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-between gap-3 p-4 bg-void text-ink select-none overflow-y-auto">
      {/* Readouts + mode */}
      <div className="w-full max-w-[340px] flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2 font-display text-[10px] uppercase">
          <div className="border border-line bg-panel px-2 py-1.5 flex flex-col items-center">
            <span className="text-dim">Mines</span>
            <span className="text-sm font-bold text-crimson">{formatNumber(MINES)}</span>
          </div>
          <div className="border border-line bg-panel px-2 py-1.5 flex flex-col items-center">
            <span className="text-dim flex items-center gap-1">
              <Flag size={10} aria-hidden="true" /> Flags
            </span>
            <span className="text-sm font-bold text-gold">
              {formatNumber(flagsPlaced)} / {formatNumber(MINES)}
            </span>
          </div>
          <div className="border border-line bg-panel px-2 py-1.5 flex flex-col items-center">
            <span className="text-dim flex items-center gap-1">
              <Timer size={10} aria-hidden="true" /> Time
            </span>
            <span className="text-sm font-bold text-neon">{formatDuration(shownSeconds)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tap mode">
          {(
            [
              { flag: false, label: 'Reveal', Icon: Pickaxe },
              { flag: true, label: 'Flag', Icon: Flag },
            ] as const
          ).map(({ flag, label, Icon }) => {
            const active = flagMode === flag;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                disabled={ended}
                onClick={() => setFlagMode(flag)}
                className={`min-h-[36px] px-2 border font-display text-[11px] font-bold uppercase flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 ${
                  active
                    ? flag
                      ? 'bg-gold text-void border-gold'
                      : 'bg-neon text-void border-neon'
                    : 'bg-panel text-dim border-line hover:border-neon hover:text-neon-bright'
                }`}
              >
                <Icon size={14} aria-hidden="true" />
                {label}
                {active && <span className="text-[9px] font-mono-code">(on)</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* The field */}
      <div
        className="w-full max-w-[340px] grid grid-cols-6 gap-1 p-1.5 bg-panel border-2 border-line [-webkit-touch-callout:none]"
        onContextMenu={(e) => e.preventDefault()}
      >
        {Array.from({ length: CELLS }, (_, cell) => {
          const row = Math.floor(cell / SIZE) + 1;
          const col = (cell % SIZE) + 1;
          const isMine = mines?.[cell] ?? false;
          const open = revealed[cell];
          const isFlagged = flagged[cell];
          // After the run, show every mine: a win marks them all, a loss keeps the player's correct flags.
          const showMine = ended && isMine;
          const markedMine = showMine && cell !== hit && (status === 'won' || isFlagged);
          const wrongFlag = status === 'lost' && isFlagged && !isMine;

          let face: React.ReactNode = null;
          let look = 'bg-panel2 border-line shadow-[inset_0_-3px_0_var(--color-line)]';
          let label = 'hidden';

          if (markedMine) {
            look = 'bg-panel2 border-gold/70';
            face = <Flag size={18} className="text-gold" aria-hidden="true" />;
            label = 'mine, marked';
          } else if (showMine) {
            look = cell === hit ? 'bg-crimson/30 border-crimson' : 'bg-abyss border-crimson/50';
            face = (
              <img
                src={MINE_ART}
                alt=""
                draggable={false}
                className={`pixelated ${cell === hit ? 'w-4/5 h-4/5' : 'w-3/5 h-3/5 opacity-80'}`}
              />
            );
            label = cell === hit ? 'mine, triggered' : 'mine';
          } else if (wrongFlag) {
            look = 'bg-panel2 border-crimson/60';
            face = (
              <span className="relative flex items-center justify-center">
                <Flag size={16} className="text-gold/60" aria-hidden="true" />
                <X size={20} className="absolute text-crimson" aria-hidden="true" />
              </span>
            );
            label = 'flagged, no mine here';
          } else if (open) {
            const n = adjacent[cell];
            look = 'bg-abyss border-line/40';
            face = n > 0 ? <span className={`font-display text-base font-black ${NUMBER_CLASS[n]}`}>{n}</span> : null;
            label = n > 0 ? `${n} ${n === 1 ? 'mine' : 'mines'} touching` : 'clear';
          } else if (isFlagged) {
            look = 'bg-panel2 border-gold/70';
            face = <Flag size={18} className="text-gold" aria-hidden="true" />;
            label = 'flagged';
          }

          return (
            <button
              key={cell}
              type="button"
              disabled={ended}
              aria-label={`Row ${row}, column ${col}: ${label}`}
              onPointerDown={(e) => onPointerDown(cell, e)}
              onPointerMove={onPointerMove}
              onPointerUp={cancelPress}
              onPointerCancel={cancelPress}
              onPointerLeave={cancelPress}
              onClick={(e) => onClick(cell, e)}
              className={`aspect-square min-h-[32px] border flex items-center justify-center transition-colors ${look} ${
                !ended && !open ? 'cursor-pointer hover:border-neon/70 active:bg-active' : 'cursor-default'
              }`}
            >
              {face}
            </button>
          );
        })}
      </div>

      {/* Status + how to play */}
      <div className="w-full max-w-[340px] flex flex-col items-center gap-1 text-center">
        <p role="status" aria-live="polite" className={`text-xs font-bold ${statusClass}`}>
          {statusLine}
        </p>
        <p className="text-[11px] text-dim">
          Open every safe rune without touching one of the {formatNumber(MINES)} mines. A number counts the mines touching
          that rune.
        </p>
      </div>
    </div>
  );
};
