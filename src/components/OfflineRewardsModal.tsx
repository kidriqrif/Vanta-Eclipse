import React from 'react';
import { useGame } from '../context/GameContext';
import { formatNumber } from '../utils/numberFormat';
import { Moon, Sparkles, Zap } from 'lucide-react';

export const OfflineRewardsModal: React.FC = () => {
  const { offlineRewardsModal, claimOfflineRewards, hasRemovedAds } = useGame();

  if (!offlineRewardsModal) return null;

  const hours = Math.floor(offlineRewardsModal.secondsAway / 3600);
  const minutes = Math.floor((offlineRewardsModal.secondsAway % 3600) / 60);

  return (
    <div className="fixed inset-0 z-50 bg-[#08080C]/85 flex items-center justify-center p-4">
      <div className="bg-[#171722] border-2 border-[#A85CFF] p-4 max-w-xs w-full flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[#A85CFF]/20 border border-[#A85CFF] flex items-center justify-center">
          <Moon size={24} className="text-[#A85CFF]" />
        </div>

        <div className="flex flex-col">
          <span className="text-sm font-bold text-[#F6F6FC]">WELCOME BACK, SLAYER</span>
          <span className="text-[11px] text-[#8686A2]">
            You were away for {hours}h {minutes}m
          </span>
          {offlineRewardsModal.wasCapped && (
            <span className="text-[10px] text-[#FF8A28]">
              (Storage cap reached! Upgrade Long Slumber to extend)
            </span>
          )}
        </div>

        <div className="bg-[#08080C] border border-[#4E4E66] p-3 w-full flex flex-col gap-1">
          <span className="text-[10px] text-[#8686A2]">ESSENCE HARVESTED</span>
          <span className="text-base font-bold text-[#A85CFF]">
            +{formatNumber(offlineRewardsModal.amount)} ESSENCE
          </span>
        </div>

        <div className="w-full flex flex-col gap-2 mt-1">
          <button
            onClick={() => claimOfflineRewards(true)}
            className="w-full py-2 bg-[#FFD23C] text-[#08080C] text-xs font-bold hover:bg-[#F6F6FC] transition-colors flex items-center justify-center gap-1.5 shadow-[0_0_12px_#FFD23C]"
          >
            <Zap size={14} /> DOUBLE REWARD ({formatNumber(offlineRewardsModal.amount * 2)})
          </button>

          <button
            onClick={() => claimOfflineRewards(false)}
            className="w-full py-1.5 bg-[#2C2C3C] border border-[#4E4E66] text-xs font-bold text-[#F6F6FC] hover:bg-[#4E4E66]"
          >
            CLAIM NORMAL
          </button>
        </div>
      </div>
    </div>
  );
};
