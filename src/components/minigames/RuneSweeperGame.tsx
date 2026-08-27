import React, { useState, useEffect } from 'react';
import { sound } from '../../utils/audio';

interface MinigameProps {
  onFinish: (score: number, won: boolean) => void;
  onQuit: () => void;
}

const SIZE = 6;
const TRAPS = 6;

interface Tile {
  r: number;
  c: number;
  isTrap: boolean;
  isOpen: boolean;
  isFlagged: boolean;
  adjacentTraps: number;
}

export const RuneSweeperGame: React.FC<MinigameProps> = ({ onFinish, onQuit }) => {
  const [board, setBoard] = useState<Tile[][]>([]);
  const [flagMode, setFlagMode] = useState<boolean>(false);
  const [flagsPlaced, setFlagsPlaced] = useState<number>(0);
  const [moves, setMoves] = useState<number>(0);

  // Initialize board
  useEffect(() => {
    const grid: Tile[][] = [];
    for (let r = 0; r < SIZE; r++) {
      const row: Tile[] = [];
      for (let c = 0; c < SIZE; c++) {
        row.push({
          r,
          c,
          isTrap: false,
          isOpen: false,
          isFlagged: false,
          adjacentTraps: 0,
        });
      }
      grid.push(row);
    }

    // Place traps
    let placed = 0;
    while (placed < TRAPS) {
      const r = Math.floor(Math.random() * SIZE);
      const c = Math.floor(Math.random() * SIZE);
      if (!grid[r][c].isTrap) {
        grid[r][c].isTrap = true;
        placed++;
      }
    }

    // Count adjacent traps
    const dirs = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1],
    ];

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!grid[r][c].isTrap) {
          let count = 0;
          dirs.forEach(([dr, dc]) => {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && grid[nr][nc].isTrap) {
              count++;
            }
          });
          grid[r][c].adjacentTraps = count;
        }
      }
    }

    setBoard(grid);
  }, []);

  // Reveal flood fill
  const revealTile = (grid: Tile[][], r: number, c: number) => {
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || grid[r][c].isOpen || grid[r][c].isFlagged) {
      return;
    }
    grid[r][c].isOpen = true;
    if (grid[r][c].adjacentTraps === 0 && !grid[r][c].isTrap) {
      const dirs = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1],
      ];
      dirs.forEach(([dr, dc]) => revealTile(grid, r + dr, c + dc));
    }
  };

  const handleTileClick = (r: number, c: number) => {
    const tile = board[r][c];
    if (tile.isOpen) return;

    if (flagMode) {
      sound.play('click');
      const nextBoard = board.map((row) => row.map((t) => ({ ...t })));
      nextBoard[r][c].isFlagged = !nextBoard[r][c].isFlagged;
      setBoard(nextBoard);
      setFlagsPlaced((prev) => (nextBoard[r][c].isFlagged ? prev + 1 : prev - 1));
      return;
    }

    if (tile.isFlagged) return;

    const newMoves = moves + 1;
    setMoves(newMoves);

    if (tile.isTrap) {
      // Hit trap: Game over!
      sound.play('fail');
      const nextBoard = board.map((row) =>
        row.map((t) => ({ ...t, isOpen: t.isOpen || t.isTrap }))
      );
      setBoard(nextBoard);
      setTimeout(() => onFinish(newMoves, false), 1000);
      return;
    }

    // Safe reveal
    sound.play('confirm');
    const nextBoard = board.map((row) => row.map((t) => ({ ...t })));
    revealTile(nextBoard, r, c);
    setBoard(nextBoard);

    // Check Win condition (all non-traps open)
    let nonTrapsUnopened = 0;
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        if (!nextBoard[i][j].isTrap && !nextBoard[i][j].isOpen) {
          nonTrapsUnopened++;
        }
      }
    }

    if (nonTrapsUnopened === 0) {
      sound.play('fanfare');
      setTimeout(() => onFinish(newMoves, true), 800);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-4 bg-[#08080C] text-[#F6F6FC]">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-[#A85CFF]">RUNE SWEEPER</span>
          <span className="text-[10px] text-[#8686A2]">
            Traps: {TRAPS} | Flags: {flagsPlaced} | Moves: {moves}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFlagMode(!flagMode)}
            className={`px-2 py-1 text-xs font-bold border transition-colors ${
              flagMode
                ? 'bg-[#FF3A46] text-[#08080C] border-[#FF3A46]'
                : 'bg-[#171722] text-[#8686A2] border-[#4E4E66]'
            }`}
          >
            {flagMode ? '🚩 FLAG MODE' : '⛏️ REVEAL MODE'}
          </button>

          <button
            onClick={onQuit}
            className="px-2 py-1 text-xs bg-[#2C2C3C] border border-[#4E4E66] text-[#8686A2] hover:text-[#F6F6FC]"
          >
            FORFEIT
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-[#171722] border-2 border-[#4E4E66] p-1.5 flex flex-col gap-1 my-auto max-w-xs w-full">
        {board.map((row, rIdx) => (
          <div key={rIdx} className="grid grid-cols-6 gap-1">
            {row.map((tile, cIdx) => (
              <button
                key={cIdx}
                onClick={() => handleTileClick(rIdx, cIdx)}
                className={`aspect-square border text-xs font-bold flex items-center justify-center transition-all ${
                  tile.isOpen
                    ? tile.isTrap
                      ? 'bg-[#FF3A46] border-[#F6F6FC] text-[#F6F6FC]'
                      : 'bg-[#08080C] border-[#4E4E66] text-[#6ADC3E]'
                    : tile.isFlagged
                    ? 'bg-[#2C2C3C] border-[#FF3A46] text-[#FF3A46]'
                    : 'bg-[#171722] border-[#4E4E66] hover:border-[#8686A2]'
                }`}
              >
                {tile.isOpen
                  ? tile.isTrap
                    ? '💥'
                    : tile.adjacentTraps > 0
                    ? tile.adjacentTraps
                    : ''
                  : tile.isFlagged
                  ? '🚩'
                  : ''}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Bottom Hint */}
      <div className="text-center text-xs text-[#8686A2]">
        Reveal all safe tiles without triggering any of the {TRAPS} void traps.
      </div>
    </div>
  );
};
