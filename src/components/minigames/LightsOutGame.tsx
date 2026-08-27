import React, { useState, useEffect } from 'react';
import { sound } from '../../utils/audio';

interface MinigameProps {
  onFinish: (score: number, won: boolean) => void;
  onQuit: () => void;
}

const SIZE = 4;

export const LightsOutGame: React.FC<MinigameProps> = ({ onFinish, onQuit }) => {
  const [grid, setGrid] = useState<boolean[][]>(
    Array(SIZE).fill(0).map(() => Array(SIZE).fill(false))
  );
  const [moves, setMoves] = useState<number>(0);
  const [gameStarted, setGameStarted] = useState<boolean>(false);

  // Initialize solvable board by applying 6-9 random toggles
  useEffect(() => {
    const board = Array(SIZE).fill(0).map(() => Array(SIZE).fill(false));
    const toggle = (b: boolean[][], r: number, c: number) => {
      const dirs = [
        [0, 0],
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ];
      dirs.forEach(([dr, dc]) => {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
          b[nr][nc] = !b[nr][nc];
        }
      });
    };

    const pressCount = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < pressCount; i++) {
      const r = Math.floor(Math.random() * SIZE);
      const c = Math.floor(Math.random() * SIZE);
      toggle(board, r, c);
    }

    setGrid(board);
    setGameStarted(true);
  }, []);

  const handleCellClick = (r: number, c: number) => {
    if (!gameStarted) return;
    sound.play('click');

    const nextGrid = grid.map((row) => [...row]);
    const dirs = [
      [0, 0],
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];
    dirs.forEach(([dr, dc]) => {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
        nextGrid[nr][nc] = !nextGrid[nr][nc];
      }
    });

    setGrid(nextGrid);
    const newMoves = moves + 1;
    setMoves(newMoves);

    // Check win (all false)
    const isAllOff = nextGrid.every((row) => row.every((val) => !val));
    if (isAllOff) {
      sound.play('fanfare');
      setTimeout(() => onFinish(newMoves, true), 800);
    }
  };

  const activeLights = grid.reduce(
    (acc, row) => acc + row.filter((v) => v).length,
    0
  );

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-4 bg-[#08080C] text-[#F6F6FC]">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-[#FFD23C]">LIGHTS OUT</span>
          <span className="text-[10px] text-[#8686A2]">
            Moves: {moves} | Active Runes: {activeLights}
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
      <div className="bg-[#171722] border-2 border-[#4E4E66] p-3 flex flex-col gap-2 my-auto max-w-xs w-full">
        {grid.map((row, rIdx) => (
          <div key={rIdx} className="grid grid-cols-4 gap-2">
            {row.map((cell, cIdx) => (
              <button
                key={cIdx}
                onClick={() => handleCellClick(rIdx, cIdx)}
                className={`aspect-square border-2 transition-all ${
                  cell
                    ? 'bg-[#FFD23C] border-[#F6F6FC] shadow-[0_0_12px_#FFD23C]'
                    : 'bg-[#08080C] border-[#4E4E66] hover:border-[#8686A2]'
                }`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Bottom Hint */}
      <div className="text-center text-xs text-[#8686A2]">
        Extinguish all golden runes. Each press inverts the tile and its 4 neighbors.
      </div>
    </div>
  );
};
