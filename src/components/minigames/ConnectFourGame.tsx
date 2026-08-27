import React, { useState } from 'react';
import { sound } from '../../utils/audio';

interface MinigameProps {
  onFinish: (score: number, won: boolean) => void;
  onQuit: () => void;
}

type Cell = 0 | 1 | 2; // 0: empty, 1: Player (Red), 2: AI (Purple)

const ROWS = 6;
const COLS = 7;

export const ConnectFourGame: React.FC<MinigameProps> = ({ onFinish, onQuit }) => {
  const [board, setBoard] = useState<Cell[][]>(
    Array(ROWS).fill(0).map(() => Array(COLS).fill(0))
  );
  const [turn, setTurn] = useState<1 | 2>(1); // 1 = Player, 2 = AI
  const [moves, setMoves] = useState<number>(0);
  const [winner, setWinner] = useState<0 | 1 | 2 | 'DRAW'>(0);

  // Check 4-in-a-row
  const checkWin = (b: Cell[][], r: number, c: number, p: Cell): boolean => {
    const directions = [
      [0, 1], // horizontal
      [1, 0], // vertical
      [1, 1], // diagonal \
      [1, -1], // diagonal /
    ];

    for (const [dr, dc] of directions) {
      let count = 1;
      // forward
      for (let step = 1; step <= 3; step++) {
        const nr = r + dr * step;
        const nc = c + dc * step;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && b[nr][nc] === p) {
          count++;
        } else break;
      }
      // backward
      for (let step = 1; step <= 3; step++) {
        const nr = r - dr * step;
        const nc = c - dc * step;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && b[nr][nc] === p) {
          count++;
        } else break;
      }
      if (count >= 4) return true;
    }
    return false;
  };

  // AI Move
  const makeAIMove = (currentBoard: Cell[][], moveCount: number) => {
    setTimeout(() => {
      // Find valid columns
      const validCols: number[] = [];
      for (let c = 0; c < COLS; c++) {
        if (currentBoard[0][c] === 0) validCols.push(c);
      }

      if (validCols.length === 0) {
        setWinner('DRAW');
        setTimeout(() => onFinish(moveCount, false), 1000);
        return;
      }

      // Check if AI can win immediately
      let chosenCol = -1;
      for (const c of validCols) {
        let targetRow = -1;
        for (let r = ROWS - 1; r >= 0; r--) {
          if (currentBoard[r][c] === 0) {
            targetRow = r;
            break;
          }
        }
        if (targetRow !== -1 && checkWin(currentBoard, targetRow, c, 2)) {
          chosenCol = c;
          break;
        }
      }

      // Block player win
      if (chosenCol === -1) {
        for (const c of validCols) {
          let targetRow = -1;
          for (let r = ROWS - 1; r >= 0; r--) {
            if (currentBoard[r][c] === 0) {
              targetRow = r;
              break;
            }
          }
          if (targetRow !== -1 && checkWin(currentBoard, targetRow, c, 1)) {
            chosenCol = c;
            break;
          }
        }
      }

      // Random fallback
      if (chosenCol === -1) {
        chosenCol = validCols[Math.floor(Math.random() * validCols.length)];
      }

      // Apply AI drop
      let targetRow = -1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (currentBoard[r][chosenCol] === 0) {
          targetRow = r;
          break;
        }
      }

      const nextBoard = currentBoard.map((row) => [...row]);
      nextBoard[targetRow][chosenCol] = 2;
      setBoard(nextBoard);
      sound.play('click');

      if (checkWin(nextBoard, targetRow, chosenCol, 2)) {
        setWinner(2);
        sound.play('fail');
        setTimeout(() => onFinish(moveCount + 1, false), 1200);
      } else {
        setTurn(1);
      }
    }, 450);
  };

  // Player Column Click
  const handleDrop = (col: number) => {
    if (winner !== 0 || turn !== 1) return;

    // Find lowest empty row in col
    let targetRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][col] === 0) {
        targetRow = r;
        break;
      }
    }

    if (targetRow === -1) return; // full col

    sound.play('confirm');
    const nextBoard = board.map((row) => [...row]);
    nextBoard[targetRow][col] = 1;
    setBoard(nextBoard);

    const newMoves = moves + 1;
    setMoves(newMoves);

    if (checkWin(nextBoard, targetRow, col, 1)) {
      setWinner(1);
      sound.play('fanfare');
      setTimeout(() => onFinish(newMoves, true), 1200);
    } else {
      setTurn(2);
      makeAIMove(nextBoard, newMoves);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-4 bg-[#08080C] text-[#F6F6FC]">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-[#FF8A28]">CONNECT FOUR</span>
          <span className="text-[10px] text-[#8686A2]">
            Turn: {turn === 1 ? 'YOUR TURN' : 'VOID AI THINKING...'} | Moves: {moves}
          </span>
        </div>

        <button
          onClick={onQuit}
          className="px-2.5 py-1 text-xs bg-[#2C2C3C] border border-[#4E4E66] text-[#8686A2] hover:text-[#F6F6FC]"
        >
          FORFEIT
        </button>
      </div>

      {/* Board */}
      <div className="bg-[#171722] border-2 border-[#4E4E66] p-2 flex flex-col gap-1.5 my-auto max-w-sm w-full">
        {board.map((row, rIdx) => (
          <div key={rIdx} className="grid grid-cols-7 gap-1.5">
            {row.map((cell, cIdx) => (
              <button
                key={cIdx}
                onClick={() => handleDrop(cIdx)}
                disabled={turn !== 1 || winner !== 0}
                className={`aspect-square rounded-full border flex items-center justify-center transition-all ${
                  cell === 1
                    ? 'bg-[#FF3A46] border-[#F6F6FC] shadow-[0_0_8px_#FF3A46]'
                    : cell === 2
                    ? 'bg-[#A85CFF] border-[#F6F6FC] shadow-[0_0_8px_#A85CFF]'
                    : 'bg-[#08080C] border-[#4E4E66] hover:border-[#8686A2]'
                }`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Bottom Hint */}
      <div className="text-center text-xs text-[#8686A2]">
        {winner === 1 ? (
          <span className="text-[#6ADC3E] font-bold">VICTORY! 4 IN A ROW!</span>
        ) : winner === 2 ? (
          <span className="text-[#FF3A46] font-bold">DEFEATED BY VOID AI!</span>
        ) : (
          <span>Connect 4 of your red discs horizontally, vertically, or diagonally.</span>
        )}
      </div>
    </div>
  );
};
