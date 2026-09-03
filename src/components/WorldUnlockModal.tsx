import React from 'react';
import { useGame } from '../context/GameContext';
import { WORLDS } from '../data/definitions';
import { Trophy } from 'lucide-react';

export const WorldUnlockModal: React.FC = () => {
  const { newWorldUnlockedModal, closeWorldModal } = useGame();

  if (!newWorldUnlockedModal) return null;

  const world = WORLDS.find((w) => w.id === newWorldUnlockedModal) || WORLDS[1];

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="bg-[#101426] border-2 border-[#36D9FF] p-3.5 max-w-sm w-full rounded-none flex flex-col items-center text-center gap-2.5 shadow-[0_0_20px_rgba(155,81,111,0.2)]">
        <div className="w-12 h-12 bg-[#36D9FF]/10 border border-[#36D9FF] flex items-center justify-center animate-pulse">
          <Trophy size={24} className="text-[#36D9FF]" />
        </div>

        <div className="flex flex-col">
          <span className="text-[9px] text-[#36D9FF] font-display font-bold tracking-widest uppercase">
            NEW SECTOR BREACHED
          </span>
          <span className="text-sm font-display font-black text-[#FFFFFF] uppercase tracking-wider mt-0.5">
            {world.displayName}
          </span>
          <span className="text-[10px] font-tech text-[#8993B2] mt-0.5">{world.description}</span>
        </div>

        <div className="bg-[#171D35] border border-white/15 p-2 w-full text-left flex flex-col gap-1 text-[11px] text-[#FFFFFF] font-mono-code">
          <span className="text-[#36D9FF] font-display font-bold uppercase text-[9px]">SYSTEMS UNLOCKED:</span>
          <span>&gt; COMPANION BEAST PROTOCOL AWAKENED</span>
          <span>&gt; QUANTUM RELIC DROPS AUTHORIZED</span>
          <span>&gt; +{((world.essenceMultiplier - 1) * 100).toFixed(0)}% ESSENCE MULTIPLIER</span>
        </div>

        <button
          onClick={closeWorldModal}
          className="w-full py-1.5 hud-btn text-xs font-display font-bold"
        >
          ENGAGE SECTOR
        </button>
      </div>
    </div>
  );
};
