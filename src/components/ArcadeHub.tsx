import React, { useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { MINIGAMES } from '../data/definitions';
import { formatNumber } from '../utils/numberFormat';
import { Gamepad2, Play, Trophy, Clock } from 'lucide-react';
import { VoidReflexGame } from './minigames/VoidReflexGame';
import { MemoryMatchGame } from './minigames/MemoryMatchGame';
import { ConnectFourGame } from './minigames/ConnectFourGame';
import { BattleshipGame } from './minigames/BattleshipGame';
import { LightsOutGame } from './minigames/LightsOutGame';
import { SequenceEchoGame } from './minigames/SequenceEchoGame';
import { RuneSweeperGame } from './minigames/RuneSweeperGame';

export const ArcadeHub: React.FC = () => {
  const {
    tokens,
    tokenRegenSecondsLeft,
    minigameRecords,
    spendToken,
    finishMinigame,
  } = useGame();

  const [activeMinigameId, setActiveMinigameId] = useState<string | null>(null);
  const [outcomeModal, setOutcomeModal] = useState<{
    won: boolean;
    reward: number;
    score: number;
  } | null>(null);

  const formatRegenTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleStartGame = (id: string) => {
    if (spendToken(1)) {
      setActiveMinigameId(id);
    }
  };

  const handleFinishGame = useCallback((score: number, won: boolean) => {
    if (!activeMinigameId) return;
    const reward = finishMinigame(activeMinigameId, score, won);
    setOutcomeModal({ won, reward, score });
    setActiveMinigameId(null);
  }, [activeMinigameId, finishMinigame]);

  return (
    <div className="flex-1 flex flex-col p-2.5 overflow-y-auto bg-[#171D35] gap-2 select-none ">
      {/* Active Minigame Full Overlay */}
      {activeMinigameId && (
        <div className="fixed inset-0 z-50 bg-[#171D35] flex flex-col">
          {activeMinigameId === 'void_reflex' && (
            <VoidReflexGame
              onFinish={handleFinishGame}
              onQuit={() => setActiveMinigameId(null)}
            />
          )}
          {activeMinigameId === 'memory_match' && (
            <MemoryMatchGame
              onFinish={handleFinishGame}
              onQuit={() => setActiveMinigameId(null)}
            />
          )}
          {activeMinigameId === 'connect_four' && (
            <ConnectFourGame
              onFinish={handleFinishGame}
              onQuit={() => setActiveMinigameId(null)}
            />
          )}
          {activeMinigameId === 'battleship' && (
            <BattleshipGame
              onFinish={handleFinishGame}
              onQuit={() => setActiveMinigameId(null)}
            />
          )}
          {activeMinigameId === 'lights_out' && (
            <LightsOutGame
              onFinish={handleFinishGame}
              onQuit={() => setActiveMinigameId(null)}
            />
          )}
          {activeMinigameId === 'sequence_echo' && (
            <SequenceEchoGame
              onFinish={handleFinishGame}
              onQuit={() => setActiveMinigameId(null)}
            />
          )}
          {activeMinigameId === 'runesweeper' && (
            <RuneSweeperGame
              onFinish={handleFinishGame}
              onQuit={() => setActiveMinigameId(null)}
            />
          )}
        </div>
      )}

      {/* Outcome Modal */}
      {outcomeModal && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div
            className={`bg-[#101426] border-2 p-3.5 max-w-xs w-full rounded-none flex flex-col items-center text-center gap-2.5 shadow-2xl ${
              outcomeModal.won ? 'border-[#36D9FF]' : 'border-[#FF4268]'
            }`}
          >
            <span
              className={`text-sm font-display font-black tracking-wider uppercase ${
                outcomeModal.won ? 'text-[#36D9FF]' : 'text-[#FF4268]'
              }`}
            >
              {outcomeModal.won ? 'TRIAL CONQUERED!' : 'TRIAL CONCLUDED'}
            </span>

            <div className="bg-[#171D35] border border-white/15 p-2 w-full flex flex-col gap-0.5">
              <span className="text-[9px] text-[#8993B2] font-tech uppercase">ESSENCE BURST YIELD</span>
              <span className="text-xs font-mono-code font-bold text-[#36D9FF]">
                +{formatNumber(outcomeModal.reward)} ESSENCE
              </span>
            </div>

            <button
              onClick={() => setOutcomeModal(null)}
              className="w-full py-1.5 hud-btn text-xs font-display font-bold"
            >
              COLLECT & RETURN
            </button>
          </div>
        </div>
      )}

      {/* Header Info */}
      <div className="bg-[#101426] border border-[#36D9FF]/40 p-2 rounded-none flex items-center justify-between hud-corner">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#36D9FF]/10 border border-[#36D9FF] flex items-center justify-center">
            <Gamepad2 size={13} className="text-[#36D9FF]" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase tracking-wider">
              SYS://ARCADE_SUITE
            </span>
            <span className="text-[9px] font-tech text-[#8993B2]">
              TACTICAL MINI-TRIALS FOR INSTANT ESSENCE INJECTION
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-xs font-mono-code font-bold text-[#FFC857]">{tokens} / 5 TOKENS</span>
          {tokens < 5 && (
            <span className="text-[8px] font-mono-code text-[#8993B2] flex items-center gap-0.5">
              <Clock size={8} /> +1 in {formatRegenTime(tokenRegenSecondsLeft)}
            </span>
          )}
        </div>
      </div>

      {/* Minigames Grid */}
      <div className="flex flex-col gap-1.5">
        {MINIGAMES.map((game) => {
          const record = minigameRecords[game.id];
          const hasRecord = record !== undefined;

          return (
            <div
              key={game.id}
              className="bg-[#101426] hover:bg-[#080812] border border-white/15 hover:border-[#36D9FF]/50 p-2 rounded-none flex items-center justify-between gap-2.5 transition-all"
            >
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase">
                    {game.displayName}
                  </span>
                  <span className="text-[8px] font-mono-code text-[#FFC857] bg-[#171D35] border border-[#FFC857]/40 px-1">
                    {game.rewardSeconds}s PAYOUT
                  </span>
                </div>

                <span className="text-[10px] font-tech text-[#8993B2] mt-0.5">
                  {game.description}
                </span>

                {hasRecord && (
                  <span className="text-[9px] font-mono-code text-[#36D9FF] flex items-center gap-1 mt-0.5">
                    <Trophy size={10} /> HIGH SCORE: {typeof record === 'number' ? record.toFixed(0) : record}
                  </span>
                )}
              </div>

              {/* Play Button */}
              <div className="shrink-0">
                <button
                  onClick={() => handleStartGame(game.id)}
                  disabled={tokens < 1}
                  className={`px-3 py-1 text-xs hud-btn flex items-center gap-1 ${
                    tokens >= 1 ? 'border-[#36D9FF]' : ''
                  }`}
                >
                  <Play size={10} />
                  <span>PLAY (1 TOKEN)</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
