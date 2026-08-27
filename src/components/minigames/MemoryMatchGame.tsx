import React, { useState, useEffect } from 'react';
import { sound } from '../../utils/audio';

interface MinigameProps {
  onFinish: (score: number, won: boolean) => void;
  onQuit: () => void;
}

interface CardItem {
  id: number;
  symbol: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const SYMBOLS = ['◆', '▲', '●', '✦', '◼', '✖'];

export const MemoryMatchGame: React.FC<MinigameProps> = ({ onFinish, onQuit }) => {
  const MAX_ATTEMPTS = 12;
  const [cards, setCards] = useState<CardItem[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [attempts, setAttempts] = useState<number>(0);
  const [matchedPairs, setMatchedPairs] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // Initialize deck
  useEffect(() => {
    const deck: CardItem[] = [];
    let id = 0;
    SYMBOLS.forEach((symbol) => {
      deck.push({ id: id++, symbol, isFlipped: false, isMatched: false });
      deck.push({ id: id++, symbol, isFlipped: false, isMatched: false });
    });
    // Shuffle
    deck.sort(() => Math.random() - 0.5);
    setCards(deck);
  }, []);

  // Handle Card Click
  const handleCardClick = (index: number) => {
    if (isLocked || cards[index].isFlipped || cards[index].isMatched) return;

    sound.play('click');
    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      setIsLocked(true);
      const first = newCards[newFlipped[0]];
      const second = newCards[newFlipped[1]];
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (first.symbol === second.symbol) {
        // Match!
        sound.play('confirm');
        first.isMatched = true;
        second.isMatched = true;
        const newMatched = matchedPairs + 1;
        setMatchedPairs(newMatched);
        setFlippedIndices([]);
        setIsLocked(false);

        if (newMatched === SYMBOLS.length) {
          // Victory
          setTimeout(() => onFinish(newAttempts, true), 800);
        }
      } else {
        // Mismatch
        sound.play('fail');
        setTimeout(() => {
          first.isFlipped = false;
          second.isFlipped = false;
          setCards([...newCards]);
          setFlippedIndices([]);
          setIsLocked(false);

          if (newAttempts >= MAX_ATTEMPTS) {
            // Defeat
            onFinish(newAttempts, false);
          }
        }, 800);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-4 bg-[#08080C] text-[#F6F6FC]">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-[#3EDCFA]">MEMORY MATCH</span>
          <span className="text-[10px] text-[#8686A2]">
            Attempts: {attempts}/{MAX_ATTEMPTS} | Pairs: {matchedPairs}/{SYMBOLS.length}
          </span>
        </div>

        <button
          onClick={onQuit}
          className="px-2.5 py-1 text-xs bg-[#2C2C3C] border border-[#4E4E66] text-[#8686A2] hover:text-[#F6F6FC]"
        >
          FORFEIT
        </button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-4 gap-2.5 my-auto max-w-xs w-full">
        {cards.map((card, idx) => (
          <button
            key={card.id}
            onClick={() => handleCardClick(idx)}
            className={`aspect-square border-2 text-xl font-bold flex items-center justify-center transition-all ${
              card.isMatched
                ? 'bg-[#171722] border-[#6ADC3E] text-[#6ADC3E] opacity-70'
                : card.isFlipped
                ? 'bg-[#2C2C3C] border-[#3EDCFA] text-[#3EDCFA] scale-105'
                : 'bg-[#171722] border-[#4E4E66] text-[#4E4E66] hover:border-[#8686A2]'
            }`}
          >
            {card.isFlipped || card.isMatched ? card.symbol : '?'}
          </button>
        ))}
      </div>

      {/* Bottom Hint */}
      <div className="text-center text-xs text-[#8686A2]">
        Find all 6 matching rune pairs in {MAX_ATTEMPTS} attempts or fewer.
      </div>
    </div>
  );
};
