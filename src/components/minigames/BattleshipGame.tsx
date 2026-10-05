import React, { useEffect, useRef, useState } from 'react';
import { formatNumber } from '../../utils/numberFormat';
import type { MinigameProps, MinigameResult } from './types';

const GRID = 7;
const CELLS = GRID * GRID;
const MAX_SHOTS = 34;
/** Ship lengths, largest first so the long one always finds room. */
const FLEET: readonly number[] = [4, 3, 2];
const HULL_CELLS = FLEET.reduce((sum, size) => sum + size, 0);
const FLEET_SUMMARY = `${FLEET.length} hidden ships (${FLEET.map((s) => formatNumber(s)).join(', ')} cells long) lie in straight lines and never overlap.`;
/** How long the final grid stays up before the host's result banner takes over. */
const END_PAUSE_MS = 1000;
const ART = '/art/minigames';

interface Ship {
  size: number;
  /** Row-major cell indices: cell = row * GRID + col. */
  cells: readonly number[];
}

type LastShot = { cell: number; kind: 'miss' | 'hit' | 'sunk'; size: number } | null;

interface SalvoState {
  ships: readonly Ship[];
  /** cell → index into `ships`, or -1 for open water. */
  owner: readonly number[];
  shot: readonly boolean[];
  shots: number;
  last: LastShot;
  result: MinigameResult | null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Ships on rows 0, 2, 4 from the left edge: always valid, used only if random placement found no room. */
const FALLBACK_FLEET: readonly Ship[] = FLEET.map((size, n) => ({
  size,
  cells: Array.from({ length: size }, (_, k) => n * 2 * GRID + k),
}));

/**
 * Each ship picks uniformly from every position still free (both orientations), so placement
 * never gives up and never leaves the fleet short.
 */
function placeFleet(): readonly Ship[] {
  const taken = new Array<boolean>(CELLS).fill(false);
  const ships: Ship[] = [];
  for (const size of FLEET) {
    const options: number[][] = [];
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        for (const horizontal of [true, false]) {
          const cells: number[] = [];
          for (let k = 0; k < size; k++) {
            const rr = horizontal ? r : r + k;
            const cc = horizontal ? c + k : c;
            if (rr >= GRID || cc >= GRID || taken[rr * GRID + cc]) break;
            cells.push(rr * GRID + cc);
          }
          if (cells.length === size) options.push(cells);
        }
      }
    }
    if (options.length === 0) return FALLBACK_FLEET;
    const cells = options[Math.floor(Math.random() * options.length)];
    for (const i of cells) taken[i] = true;
    ships.push({ size, cells });
  }
  return ships;
}

function newGame(): SalvoState {
  const ships = placeFleet();
  const owner = new Array<number>(CELLS).fill(-1);
  ships.forEach((ship, n) => ship.cells.forEach((i) => (owner[i] = n)));
  return { ships, owner, shot: new Array<boolean>(CELLS).fill(false), shots: 0, last: null, result: null };
}

const isSunk = (ship: Ship, shot: readonly boolean[]) => ship.cells.every((i) => shot[i]);

/** Pure: one shot at `cell`, then the win check and the shot-limit check — after every shot, hit or miss. */
function fire(state: SalvoState, cell: number): SalvoState {
  if (state.result || cell < 0 || cell >= CELLS || state.shot[cell]) return state;
  const shot = state.shot.slice();
  shot[cell] = true;
  const shots = state.shots + 1;

  const n = state.owner[cell];
  const last: LastShot =
    n < 0
      ? { cell, kind: 'miss', size: 0 }
      : { cell, kind: isSunk(state.ships[n], shot) ? 'sunk' : 'hit', size: state.ships[n].size };

  let hullHit = 0;
  for (let i = 0; i < CELLS; i++) if (state.owner[i] >= 0 && shot[i]) hullHit++;

  let result: MinigameResult | null = null;
  if (hullHit === HULL_CELLS) {
    result = {
      won: true,
      performance: clamp(1 - (shots - HULL_CELLS) / (MAX_SHOTS - HULL_CELLS), 0.4, 1),
      score: shots,
      detail: `Fleet sunk in ${formatNumber(shots)} shots`,
    };
  } else if (shots >= MAX_SHOTS) {
    result = {
      won: false,
      performance: (0.5 * hullHit) / HULL_CELLS,
      score: shots,
      detail: `${formatNumber(hullHit)} of ${formatNumber(HULL_CELLS)} hull cells hit`,
    };
  }
  return { ...state, shot, shots, last, result };
}

/** Calls onFinish exactly once, a beat after the outcome is decided so the final grid stays readable. */
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

function statusLine(game: SalvoState): { text: string; tone: string } {
  if (game.result?.won) return { text: 'Fleet sunk — you win', tone: 'text-gold' };
  if (game.result) return { text: 'Out of shots — ships revealed', tone: 'text-crimson' };
  if (!game.last) return { text: 'Tap a square to fire', tone: 'text-neon' };
  if (game.last.kind === 'sunk') return { text: `Sunk the ${game.last.size}-cell ship`, tone: 'text-gold' };
  if (game.last.kind === 'hit') return { text: 'Hit — keep firing nearby', tone: 'text-crimson' };
  return { text: 'Miss', tone: 'text-dim' };
}

type CellView = 'water' | 'miss' | 'hit' | 'sunk' | 'revealed';

const CELL_WORD: Record<CellView, string> = {
  water: 'not fired on',
  miss: 'miss',
  hit: 'hit',
  sunk: 'sunk ship',
  revealed: 'ship you did not find',
};

export const BattleshipGame: React.FC<MinigameProps> = ({ onFinish }) => {
  const [game, setGame] = useState<SalvoState>(newGame);
  useFinishOnce(game.result, onFinish);

  const sunk = game.ships.map((ship) => isSunk(ship, game.shot));
  const hullHit = game.owner.reduce((sum, n, i) => sum + (n >= 0 && game.shot[i] ? 1 : 0), 0);
  const shotsLeft = MAX_SHOTS - game.shots;
  const lost = game.result !== null && !game.result.won;
  const status = statusLine(game);

  const viewOf = (i: number): CellView => {
    const n = game.owner[i];
    if (!game.shot[i]) return lost && n >= 0 ? 'revealed' : 'water';
    if (n < 0) return 'miss';
    return sunk[n] ? 'sunk' : 'hit';
  };

  const shoot = (cell: number) => {
    if (game.result) return;
    setGame((g) => fire(g, cell));
  };

  return (
    <div className="flex-1 min-h-0 w-full overflow-y-auto bg-void bg-grid-pattern flex flex-col items-center gap-3 p-3">
      <div className="w-full max-w-xs flex items-center justify-between gap-2 bg-panel border border-line px-2.5 py-1.5">
        <span className="text-[10px] font-tech text-dim uppercase">
          Shots left{' '}
          <span className={`text-xs font-mono-code font-bold ${shotsLeft <= 5 ? 'text-crimson' : 'text-ink'}`}>
            {formatNumber(shotsLeft)}
          </span>{' '}
          / {formatNumber(MAX_SHOTS)}
        </span>
        <span className="text-[10px] font-tech text-dim uppercase">
          Hull hit <span className="text-xs font-mono-code font-bold text-ink">{formatNumber(hullHit)}</span> /{' '}
          {formatNumber(HULL_CELLS)}
        </span>
      </div>

      <ul className="w-full max-w-xs flex flex-wrap justify-center gap-1.5" aria-label="Enemy fleet">
        {game.ships.map((ship, n) => (
          <li
            key={n}
            className={`flex items-center gap-1.5 border px-1.5 py-1 text-[10px] font-tech uppercase ${
              sunk[n] ? 'border-gold/60 text-gold' : 'border-line text-dim'
            }`}
          >
            <span className="flex gap-0.5" aria-hidden="true">
              {ship.cells.map((cell) => (
                <span key={cell} className={`w-2.5 h-2.5 border ${sunk[n] ? 'bg-gold border-gold' : 'border-dim'}`} />
              ))}
            </span>
            {formatNumber(ship.size)}-cell · {sunk[n] ? 'Sunk' : 'Afloat'}
          </li>
        ))}
      </ul>

      <p role="status" aria-live="polite" className={`min-h-[20px] text-xs font-display font-bold uppercase tracking-wider text-center ${status.tone}`}>
        {status.text}
      </p>

      <div className="w-full max-w-xs grid grid-cols-7 gap-1 bg-panel border-2 border-line p-1.5">
        {Array.from({ length: CELLS }, (_, i) => {
          const view = viewOf(i);
          const art = view === 'miss' ? 'shot_miss' : view === 'hit' ? 'shot_hit' : view === 'sunk' ? 'shot_sunk' : 'cell_empty';
          const isLast = game.last?.cell === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => shoot(i)}
              disabled={game.result !== null || game.shot[i]}
              aria-label={`Row ${Math.floor(i / GRID) + 1}, column ${(i % GRID) + 1}: ${CELL_WORD[view]}`}
              className={`relative aspect-square transition-colors enabled:hover:bg-active enabled:active:bg-active disabled:cursor-default ${
                view === 'revealed' ? 'border-2 border-dashed border-crimson/70' : isLast ? 'ring-1 ring-ink/60' : ''
              }`}
            >
              <img
                src={`${ART}/${art}.png`}
                alt=""
                draggable={false}
                className={`absolute inset-0 w-full h-full pixelated ${view === 'water' || view === 'revealed' ? '' : 'animate-fade-in'}`}
              />
              {view === 'revealed' && <span className="absolute inset-[30%] bg-crimson/40" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <p className="max-w-xs text-center text-[10px] font-tech text-dim">
        {FLEET_SUMMARY} Sink them all within {formatNumber(MAX_SHOTS)} shots.
      </p>
    </div>
  );
};
