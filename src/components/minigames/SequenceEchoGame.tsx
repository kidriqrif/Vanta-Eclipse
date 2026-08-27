import React, { useState, useEffect } from 'react';
import { sound } from '../../utils/audio';

interface MinigameProps {
  onFinish: (score: number, won: boolean) => void;
  onQuit: () => void;
}

const BUTTONS = [
  { id: 0, color: '#FF3A46', activeColor: '#FF6EC0', name: 'Crimson' },
  { id: 1, color: '#3EDCFA', activeColor: '#F6F6FC', name: 'Azure' },
  { id: 2, color: '#FFD23C', activeColor: '#FFF', name: 'Gold' },
  { id: 3, color: '#6ADC3E', activeColor: '#A85CFF', name: 'Moss' },
];

export const SequenceEchoGame: React.FC<MinigameProps> = ({ onFinish, onQuit }) => {
  const TARGET_LENGTH = 5;
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerIndex, setPlayerIndex] = useState<number>(0);
  const [activeButton, setActiveButton] = useState<number | null>(null);
  const [isPlayback, setIsPlayback] = useState<boolean>(true);
  const [round, setRound] = useState<number>(1);

  // Playback sequence
  const playSequence = (seq: number[]) => {
    setIsPlayback(true);
    setPlayerIndex(0);

    seq.forEach((btnId, idx) => {
      setTimeout(() => {
        setActiveButton(btnId);
        sound.play('click');
        setTimeout(() => {
          setActiveButton(null);
          if (idx === seq.length - 1) {
            setIsPlayback(false);
          }
        }, 350);
      }, (idx + 1) * 600);
    });
  };

  // Start initial sequence
  useEffect(() => {
    const firstSeq = [Math.floor(Math.random() * 4)];
    setSequence(firstSeq);
    playSequence(firstSeq);
  }, []);

  const handleButtonClick = (id: number) => {
    if (isPlayback) return;

    sound.play('click');
    setActiveButton(id);
    setTimeout(() => setActiveButton(null), 200);

    if (id === sequence[playerIndex]) {
      const nextIdx = playerIndex + 1;
      setPlayerIndex(nextIdx);

      if (nextIdx === sequence.length) {
        // Round complete
        sound.play('confirm');
        if (sequence.length >= TARGET_LENGTH) {
          // Win game!
          sound.play('fanfare');
          setTimeout(() => onFinish(sequence.length, true), 800);
        } else {
          // Advance sequence
          const nextSeq = [...sequence, Math.floor(Math.random() * 4)];
          setSequence(nextSeq);
          setRound((r) => r + 1);
          setTimeout(() => playSequence(nextSeq), 700);
        }
      }
    } else {
      // Mismatch / Defeat
      sound.play('fail');
      setTimeout(() => onFinish(sequence.length - 1, false), 800);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-4 bg-[#08080C] text-[#F6F6FC]">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-[#6ADC3E]">SEQUENCE ECHO</span>
          <span className="text-[10px] text-[#8686A2]">
            Step {round} of {TARGET_LENGTH} | {isPlayback ? 'WATCH PATTERN...' : 'YOUR TURN'}
          </span>
        </div>

        <button
          onClick={onQuit}
          className="px-2.5 py-1 text-xs bg-[#2C2C3C] border border-[#4E4E66] text-[#8686A2] hover:text-[#F6F6FC]"
        >
          FORFEIT
        </button>
      </div>

      {/* 2x2 Buttons Grid */}
      <div className="grid grid-cols-2 gap-3 my-auto max-w-[240px] w-full">
        {BUTTONS.map((btn) => {
          const isActive = activeButton === btn.id;
          return (
            <button
              key={btn.id}
              onClick={() => handleButtonClick(btn.id)}
              disabled={isPlayback}
              className="aspect-square border-2 transition-all flex items-center justify-center font-bold text-xs"
              style={{
                backgroundColor: isActive ? btn.activeColor : '#171722',
                borderColor: btn.color,
                boxShadow: isActive ? `0 0 20px ${btn.color}` : 'none',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                color: isActive ? '#08080C' : btn.color,
              }}
            >
              {btn.name.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Bottom Hint */}
      <div className="text-center text-xs text-[#8686A2]">
        Memorize and repeat the glowing rune melody for {TARGET_LENGTH} consecutive notes.
      </div>
    </div>
  );
};
