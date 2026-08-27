import React, { useState, useEffect } from 'react';
import { sound } from '../../utils/audio';

interface MinigameProps {
  onFinish: (score: number, won: boolean) => void;
  onQuit: () => void;
}

const GRID_SIZE = 7;
const MAX_SHOTS = 34;

interface Ship {
  id: number;
  size: number;
  coords: { r: number; c: number }[];
  hits: number;
}

export const BattleshipGame: React.FC<MinigameProps> = ({ onFinish, onQuit }) => {
  const [grid, setGrid] = useState<('EMPTY' | 'MISS' | 'HIT')[][]>(
    Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill('EMPTY'))
  );
  const [ships, setShips] = useState<Ship[]>([]);
  const [shots, setShots] = useState<number>(0);
  const [sunkCount, setSunkCount] = useState<number>(0);

  // Initialize Ships
  useEffect(() => {
    const shipSizes = [4, 3, 2];
    const placedShips: Ship[] = [];
    const occupied = new Set<string>();

    shipSizes.forEach((size, idx) => {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 100) {
        attempts++;
        const isHorizontal = Math.random() < 0.5;
        const r = isHorizontal
          ? Math.floor(Math.random() * GRID_SIZE)
          : Math.floor(Math.random() * (GRID_SIZE - size + 1));
        const c = isHorizontal
          ? Math.floor(Math.random() * (GRID_SIZE - size + 1))
          : Math.floor(Math.random() * GRID_SIZE);

        const coords: { r: number; c: number }[] = [];
        let collision = false;

        for (let i = 0; i < size; i++) {
          const cr = isHorizontal ? r : r + i;
          const cc = isHorizontal ? c + i : c;
          if (occupied.has(`${cr},${cc}`)) {
            collision = true;
            break;
          }
          coords.push({ r: cr, c: cc });
        }

        if (!collision) {
          coords.forEach((coord) => occupied.add(`${coord.r},${coord.c}`));
          placedShips.push({ id: idx, size, coords, hits: 0 });
          placed = true;
        }
      }
    });

    setShips(placedShips);
  }, []);

  const handleTileClick = (r: number, c: number) => {
    if (grid[r][c] !== 'EMPTY') return;

    const newShots = shots + 1;
    setShots(newShots);

    // Check hit
    let hitShip: Ship | null = null;
    ships.forEach((s) => {
      if (s.coords.some((coord) => coord.r === r && coord.c === c)) {
        hitShip = s;
      }
    });

    const nextGrid = grid.map((row) => [...row]);

    if (hitShip) {
      nextGrid[r][c] = 'HIT';
      sound.play('crit_hit');

      // Update ship hits
      const updatedShips = ships.map((s) => {
        if (s.id === hitShip?.id) {
          const newHits = s.hits + 1;
          if (newHits === s.size) {
            sound.play('fanfare');
            setSunkCount((prev) => prev + 1);
          }
          return { ...s, hits: newHits };
        }
        return s;
      });
      setShips(updatedShips);
      setGrid(nextGrid);

      // Check all sunk
      const allSunk = updatedShips.every((s) => s.hits >= s.size);
      if (allSunk) {
        setTimeout(() => onFinish(newShots, true), 800);
      }
    } else {
      nextGrid[r][c] = 'MISS';
      sound.play('tap_hit');
      setGrid(nextGrid);

      if (newShots >= MAX_SHOTS) {
        // Out of ammo
        setTimeout(() => onFinish(newShots, false), 800);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-4 bg-[#08080C] text-[#F6F6FC]">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-[#FF3A46]">VOID SALVO</span>
          <span className="text-[10px] text-[#8686A2]">
            Shots: {shots}/{MAX_SHOTS} | Sunk: {sunkCount}/{ships.length}
          </span>
        </div>

        <button
          onClick={onQuit}
          className="px-2.5 py-1 text-xs bg-[#2C2C3C] border border-[#4E4E66] text-[#8686A2] hover:text-[#F6F6FC]"
        >
          FORFEIT
        </button>
      </div>

      {/* Grid */}
      <div className="bg-[#171722] border-2 border-[#4E4E66] p-1.5 flex flex-col gap-1 my-auto max-w-xs w-full">
        {grid.map((row, rIdx) => (
          <div key={rIdx} className="grid grid-cols-7 gap-1">
            {row.map((cell, cIdx) => (
              <button
                key={cIdx}
                onClick={() => handleTileClick(rIdx, cIdx)}
                className={`aspect-square border text-xs font-bold flex items-center justify-center transition-all ${
                  cell === 'HIT'
                    ? 'bg-[#FF3A46] border-[#F6F6FC] text-[#F6F6FC]'
                    : cell === 'MISS'
                    ? 'bg-[#2C2C3C] border-[#4E4E66] text-[#8686A2]'
                    : 'bg-[#08080C] border-[#4E4E66] hover:border-[#8686A2]'
                }`}
              >
                {cell === 'HIT' ? '✖' : cell === 'MISS' ? '•' : ''}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Bottom Hint */}
      <div className="text-center text-xs text-[#8686A2]">
        Sink all 3 hidden void cruisers (lengths 4, 3, 2) before ammunition depletes.
      </div>
    </div>
  );
};
