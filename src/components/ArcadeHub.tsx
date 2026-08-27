import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { MINIGAMES } from '../data/definitions';
import { formatNumber } from '../utils/numberFormat';
import { Sparkles, Gamepad2, Play, Trophy, Clock } from 'lucide-react';
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
    liveEssenceRate,
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

  const handleFinishGame = (score: number, won: boolean) => {
    if (!activeMinigameId) return;
    const reward = finishMinigame(activeMinigameId, score, won);
    setOutcomeModal({ won, reward, score });
    setActiveMinigameId(null);
  };

  return (
    <div className="flex-1 flex flex-col p-3 overflow-y-auto bg-[#08080C] gap-3">
      {/* Active Minigame Full Overlay */}
      {activeMinigameId && (
        <div className="fixed inset-0 z-50 bg-[#08080C] flex flex-col">
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
        <div className="fixed inset-0 z-50 bg-[#08080C]/80 flex items-center justify-center p-4">
          <div
            className={`bg-[#171722] border-2 p-4 max-w-xs w-full flex flex-col items-center text-center gap-3 ${
              outcomeModal.won ? 'border-[#6ADC3E]' : 'border-[#FF3A46]'
            }`}
          >
            <span
              className={`text-base font-bold ${
                outcomeModal.won ? 'text-[#6ADC3E]' : 'text-[#FF3A46]'
              }`}
            >
              {outcomeModal.won ? 'VICTORY ACHIEVED!' : 'TRIAL CONCLUDED'}
            </span>

            <div className="bg-[#08080C] border border-[#4E4E66] p-2.5 w-full flex flex-col gap-1">
              <span className="text-xs text-[#8686A2]">ESSENCE REWARD</span>
              <span className="text-sm font-bold text-[#A85CFF]">
                +{formatNumber(outcomeModal.reward)} ESSENCE
              </span>
            </div>

            <button
              onClick={() => setOutcomeModal(null)}
              className="w-full py-1.5 bg-[#B01228] border border-[#FF3A46] text-xs font-bold text-[#F6F6FC] hover:bg-[#FF3A46]"
            >
              COLLECT & RETURN
            </button>
          </div>
        </div>
      )}

      {/* Header Info */}
      <div className="bg-[#171722] border border-[#4E4E66] p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gamepad2 size={18} className="text-[#FFD23C]" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#F6F6FC]">THE VOID ARCADE</span>
            <span className="text-[10px] text-[#8686A2]">
              Play mini-trials to earn burst essence rewards
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-[#FFD23C]">{tokens} / 5 TOKENS</span>
          </div>
          {tokens < 5 && (
            <span className="text-[9px] text-[#8686A2] flex items-center gap-1">
              <Clock size={10} /> +1 in {formatRegenTime(tokenRegenSecondsLeft)}
            </span>
          )}
        </div>
      </div>

      {/* Minigames Grid */}
      <div className="flex flex-col gap-2.5">
        {MINIGAMES.map((game) => {
          const record = minigameRecords[game.id];
          const hasRecord = record !== undefined;

          return (
            <div
              key={game.id}
              className="bg-[#171722] border border-[#4E4E66] p-3 flex items-center justify-between gap-3"
            >
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#F6F6FC]">
                    {game.displayName}
                  </span>
                  <span className="text-[10px] text-[#FFD23C] font-mono">
                    {game.rewardSeconds}s Payout
                  </span>
                </div>

                <span className="text-[11px] text-[#C8C8DA] mt-0.5">
                  {game.description}
                </span>

                {hasRecord && (
                  <span className="text-[10px] text-[#6ADC3E] flex items-center gap-1 mt-0.5">
                    <Trophy size={11} /> Best: {typeof record === 'number' ? record.toFixed(0) : record}
                  </span>
                )}
              </div>

              {/* Play Button */}
              <div className="shrink-0">
                <button
                  onClick={() => handleStartGame(game.id)}
                  disabled={tokens < 1}
                  className={`px-3 py-1.5 text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                    tokens >= 1
                      ? 'bg-[#B01228] border-[#FF3A46] text-[#F6F6FC] hover:bg-[#FF3A46]'
                      : 'bg-[#2C2C3C] border-[#4E4E66] text-[#8686A2] cursor-not-allowed opacity-50'
                  }`}
                >
                  <Play size={12} /> PLAY (1T)
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
