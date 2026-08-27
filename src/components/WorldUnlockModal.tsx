import React from 'react';
import { useGame } from '../context/GameContext';
import { WORLDS } from '../data/definitions';
import { Sparkles, Trophy } from 'lucide-react';

export const WorldUnlockModal: React.FC = () => {
  const { newWorldUnlockedModal, closeWorldModal } = useGame();

  if (!newWorldUnlockedModal) return null;

  const world = WORLDS.find((w) => w.id === newWorldUnlockedModal) || WORLDS[1];

  return (
    <div className="fixed inset-0 z-50 bg-[#08080C]/85 flex items-center justify-center p-4">
      <div className="bg-[#171722] border-2 border-[#3EDCFA] p-4 max-w-sm w-full flex flex-col items-center text-center gap-3">
        <div className="w-14 h-14 rounded-full bg-[#3EDCFA]/20 border border-[#3EDCFA] flex items-center justify-center animate-pulse">
          <Trophy size={28} className="text-[#3EDCFA]" />
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] text-[#3EDCFA] font-bold tracking-widest uppercase">
            NEW REALM BREACHED!
          </span>
          <span className="text-base font-bold text-[#F6F6FC] mt-0.5">
            {world.displayName.toUpperCase()}
          </span>
          <span className="text-xs text-[#C8C8DA] mt-1">{world.description}</span>
        </div>

        <div className="bg-[#08080C] border border-[#4E4E66] p-3 w-full text-left flex flex-col gap-1.5 text-xs text-[#C8C8DA]">
          <span className="text-[#3EDCFA] font-bold">SYSTEMS UNLOCKED:</span>
          <span>• 🐺 Companion Beast Awakened (Ember unlocked!)</span>
          <span>• 🔮 Sacred Relics Drop enabled from Bosses</span>
          <span>• ⚡ +{((world.essenceMultiplier - 1) * 100).toFixed(0)}% Essence Multiplier</span>
        </div>

        <button
          onClick={closeWorldModal}
          className="w-full py-2 bg-[#3EDCFA] text-[#08080C] text-xs font-bold hover:bg-[#F6F6FC] transition-colors"
        >
          ENTER REALM
        </button>
      </div>
    </div>
  );
};
