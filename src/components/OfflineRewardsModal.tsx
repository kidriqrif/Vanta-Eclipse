import React from 'react';
import { useGame } from '../context/GameContext';
import { formatNumber } from '../utils/numberFormat';
import { Moon, Zap } from 'lucide-react';

export const OfflineRewardsModal: React.FC = () => {
  const { offlineRewardsModal, claimOfflineRewards } = useGame();

  if (!offlineRewardsModal) return null;

  const hours = Math.floor(offlineRewardsModal.secondsAway / 3600);
  const minutes = Math.floor((offlineRewardsModal.secondsAway % 3600) / 60);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="bg-[#101426] border-2 border-[#36D9FF] p-3.5 max-w-xs w-full rounded-none flex flex-col items-center text-center gap-2.5 shadow-[0_0_20px_rgba(155,81,111,0.2)]">
        <div className="w-10 h-10 bg-[#36D9FF]/10 border border-[#36D9FF] flex items-center justify-center">
          <Moon size={20} className="text-[#36D9FF]" />
        </div>

        <div className="flex flex-col">
          <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase tracking-wide">
            RE-ENGAGED TELEMETRY
          </span>
          <span className="text-[10px] font-tech text-[#8993B2]">
            OFFLINE DURATION: {hours}H {minutes}M
          </span>
          {offlineRewardsModal.wasCapped && (
            <span className="text-[9px] font-mono-code text-[#FFC857]">
              [STORAGE CAP REACHED - UPGRADE SLUMBER MATRIX]
            </span>
          )}
        </div>

        <div className="bg-[#171D35] border border-white/15 p-2 w-full flex flex-col gap-0.5">
          <span className="text-[8px] text-[#8993B2] font-tech uppercase">ESSENCE HARVESTED</span>
          <span className="text-sm font-mono-code font-bold text-[#36D9FF]">
            +{formatNumber(offlineRewardsModal.amount)} ESSENCE
          </span>
        </div>

        <div className="w-full flex flex-col gap-1.5 mt-0.5">
          <button
            onClick={() => claimOfflineRewards(true)}
            className="w-full py-1.5 hud-btn-gold text-xs font-display font-bold flex items-center justify-center gap-1"
          >
            <Zap size={13} /> DOUBLE REWARD ({formatNumber(offlineRewardsModal.amount * 2)})
          </button>

          <button
            onClick={() => claimOfflineRewards(false)}
            className="w-full py-1 bg-[#101426] hover:bg-[#36D9FF] hover:text-black border border-white/20 text-xs font-display font-bold text-[#FFFFFF] rounded-none transition-all"
          >
            CLAIM STANDARD
          </button>
        </div>
      </div>
    </div>
  );
};
