import React, { useState, useEffect, useRef } from 'react';
import { sound } from '../../utils/audio';

interface MinigameProps {
  onFinish: (score: number, won: boolean) => void;
  onQuit: () => void;
}

export const VoidReflexGame: React.FC<MinigameProps> = ({ onFinish, onQuit }) => {
  const TOTAL_ROUNDS = 5;
  const WIN_HITS = 3;

  const [round, setRound] = useState<number>(1);
  const [hits, setHits] = useState<number>(0);
  const [flared, setFlared] = useState<boolean>(false);
  const [roundStatus, setRoundStatus] = useState<'WAITING' | 'FLARED' | 'HIT' | 'EARLY' | 'MISSED'>('WAITING');
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [gameEnded, setGameEnded] = useState<boolean>(false);

  const flareTimerRef = useRef<NodeJS.Timeout | null>(null);
  const flareTimeRef = useRef<number>(0);
  const missTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Start round
  useEffect(() => {
    if (round > TOTAL_ROUNDS) {
      // End game
      setGameEnded(true);
      const isWon = hits >= WIN_HITS;
      const avgReaction =
        reactionTimes.length > 0
          ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length
          : 999;
      setTimeout(() => {
        onFinish(avgReaction, isWon);
      }, 1200);
      return;
    }

    setFlared(false);
    setRoundStatus('WAITING');
    setReactionTime(null);

    const waitMs = 800 + Math.random() * 1400;
    flareTimerRef.current = setTimeout(() => {
      setFlared(true);
      setRoundStatus('FLARED');
      flareTimeRef.current = Date.now();
      sound.play('boss_warn');

      // Auto miss if not tapped within 2.2s
      missTimerRef.current = setTimeout(() => {
        setFlared(false);
        setRoundStatus('MISSED');
        sound.play('fail');
        setTimeout(() => setRound((r) => r + 1), 700);
      }, 2200);
    }, waitMs);

    return () => {
      if (flareTimerRef.current) clearTimeout(flareTimerRef.current);
      if (missTimerRef.current) clearTimeout(missTimerRef.current);
    };
  }, [round, onFinish]);

  const handleSigilPress = () => {
    if (gameEnded) return;

    if (roundStatus === 'WAITING') {
      // Early press
      if (flareTimerRef.current) clearTimeout(flareTimerRef.current);
      setRoundStatus('EARLY');
      sound.play('fail');
      setTimeout(() => setRound((r) => r + 1), 700);
    } else if (roundStatus === 'FLARED') {
      // Successful hit
      if (missTimerRef.current) clearTimeout(missTimerRef.current);
      const rt = Date.now() - flareTimeRef.current;
      setReactionTime(rt);
      setReactionTimes((prev) => [...prev, rt]);
      setHits((h) => h + 1);
      setRoundStatus('HIT');
      setFlared(false);
      sound.play('confirm');
      setTimeout(() => setRound((r) => r + 1), 700);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-4 bg-[#08080C] text-[#F6F6FC]">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-[#FF3A46]">VOID REFLEX</span>
          <span className="text-[10px] text-[#8686A2]">
            Round {Math.min(round, TOTAL_ROUNDS)} of {TOTAL_ROUNDS} | Hits: {hits}/{WIN_HITS}
          </span>
        </div>

        <button
          onClick={onQuit}
          className="px-2.5 py-1 text-xs bg-[#2C2C3C] border border-[#4E4E66] text-[#8686A2] hover:text-[#F6F6FC]"
        >
          FORFEIT
        </button>
      </div>

      {/* Center Interactive Sigil */}
      <div className="flex flex-col items-center justify-center my-auto gap-4">
        <button
          onClick={handleSigilPress}
          className={`w-36 h-36 rounded-full border-4 flex items-center justify-center transition-all duration-75 select-none ${
            flared
              ? 'bg-[#FF3A46] border-[#F6F6FC] shadow-[0_0_30px_#FF3A46] scale-110'
              : roundStatus === 'HIT'
              ? 'bg-[#6ADC3E] border-[#F6F6FC] scale-105'
              : roundStatus === 'EARLY' || roundStatus === 'MISSED'
              ? 'bg-[#B01228] border-[#4E4E66]'
              : 'bg-[#171722] border-[#4E4E66] hover:border-[#8686A2]'
          }`}
        >
          <span className="text-2xl font-bold font-mono">
            {flared ? 'TAP!' : roundStatus === 'HIT' ? '✓' : roundStatus === 'EARLY' ? 'EARLY!' : roundStatus === 'MISSED' ? 'MISSED' : 'WAIT...'}
          </span>
        </button>

        {reactionTime !== null && (
          <span className="text-sm font-bold text-[#6ADC3E] font-mono">
            Reaction: {reactionTime}ms
          </span>
        )}
      </div>

      {/* Bottom Hint */}
      <div className="text-center text-xs text-[#8686A2]">
        Tap the sigil the instant it turns <span className="text-[#FF3A46] font-bold">RED</span>.
      </div>
    </div>
  );
};
