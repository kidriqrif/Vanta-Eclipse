import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { ShieldCheck, Zap, X, Check, Award, Sparkles, Ban } from 'lucide-react';

interface NoAdsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NoAdsModal: React.FC<NoAdsModalProps> = ({ isOpen, onClose }) => {
  const { hasRemovedAds, buyProduct } = useGame();
  const [justActivated, setJustActivated] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleActivate = () => {
    buyProduct('remove_ads');
    setJustActivated(true);
    setTimeout(() => {
      setJustActivated(false);
    }, 2500);
  };

  return (
    <div
      id="modal-no-ads-overlay"
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-4 animate-fade-in select-none"
    >
      <div className="bg-[#101426] border-2 border-[#FFC857] max-w-sm w-full rounded-none flex flex-col shadow-[0_0_30px_rgba(255,200,87,0.25)] overflow-hidden">
        {/* Header Bar */}
        <div className="bg-[#171D35] border-b border-[#30395C] px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#FFC857]/15 border border-[#FFC857] flex items-center justify-center">
              <ShieldCheck size={14} className="text-[#FFC857]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-display font-black text-[#E8EDF7] tracking-wider uppercase">
                {hasRemovedAds ? 'PRO PROTOCOL ACTIVE' : 'VANTA PRO PROTOCOL'}
              </span>
              <span className="text-[9px] font-tech text-[#8993B2] uppercase">
                {hasRemovedAds ? 'PERMANENT AD-FREE STATUS' : 'PERMANENT AD REMOVAL UPGRADE'}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-6 h-6 bg-[#101426] hover:bg-[#17283A] text-[#8993B2] hover:text-[#E8EDF7] border border-[#30395C] flex items-center justify-center transition-colors"
            aria-label="Close modal"
          >
            <X size={13} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 flex flex-col gap-3">
          {/* Status Banner */}
          {hasRemovedAds ? (
            <div className="bg-[#17283A] border border-[#36D9FF]/70 p-2.5 flex items-center gap-2.5 shadow-[0_0_12px_rgba(54,217,255,0.2)]">
              <div className="w-8 h-8 bg-[#36D9FF]/20 border border-[#36D9FF] flex items-center justify-center shrink-0">
                <Check size={18} className="text-[#36D9FF]" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-display font-bold text-[#36D9FF] uppercase tracking-wider">
                  OVERRIDE FULLY ENGAGED
                </span>
                <span className="text-[9px] font-tech text-[#E8EDF7]/90 leading-tight">
                  All advertisement banners are permanently disabled. All daily power surges and bonuses execute instantly.
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-[#171D35] border border-[#FFC857]/40 p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#FFC857]/10 border border-[#FFC857] flex items-center justify-center shrink-0 animate-pulse">
                <Sparkles size={16} className="text-[#FFC857]" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-display font-bold text-[#FFC857] uppercase tracking-wider">
                  UNRESTRICTED TACTICAL FLOW
                </span>
                <span className="text-[9px] font-tech text-[#8993B2] leading-tight">
                  Upgrade your tactical rig with permanent ad-free status across all systems and devices.
                </span>
              </div>
            </div>
          )}

          {/* Perks Matrix */}
          <div className="bg-[#171D35] border border-[#30395C] p-2.5 flex flex-col gap-2">
            <span className="text-[9px] font-display font-bold text-[#8993B2] uppercase tracking-wider">
              PERMANENT PROTOCOL BENEFITS:
            </span>

            <div className="flex flex-col gap-1.5 text-xs font-tech">
              <div className="flex items-start gap-2">
                <Ban size={13} className="text-[#36D9FF] shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-[#E8EDF7] font-bold">100% Ad Banners Eradicated</span>
                  <span className="text-[9px] text-[#8993B2]">
                    Bottom telemetry ad banners and native video banners are completely eliminated forever.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Zap size={13} className="text-[#FFC857] shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-[#E8EDF7] font-bold">Instant Daily Power Surges</span>
                  <span className="text-[9px] text-[#8993B2]">
                    Instantly collect bonus Essence and Arcade Tokens with zero ad wait times.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Award size={13} className="text-[#A78BFA] shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-[#E8EDF7] font-bold">Permanent Pro Signature</span>
                  <span className="text-[9px] text-[#8993B2]">
                    Unlocks the high-tech Pro HUD signature badge and priority terminal status.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          {hasRemovedAds ? (
            <button
              id="btn-no-ads-dismiss"
              onClick={onClose}
              className="w-full py-2 bg-[#17283A] hover:bg-[#36D9FF] hover:text-[#080A12] border border-[#36D9FF] text-[#36D9FF] text-xs font-display font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(54,217,255,0.2)] active:scale-98"
            >
              <Check size={14} />
              <span>RETURN TO TERMINAL</span>
            </button>
          ) : (
            <button
              id="btn-no-ads-purchase"
              onClick={handleActivate}
              className="w-full py-2 bg-[#FFC857] hover:bg-[#FFE082] text-[#080A12] border border-[#FFC857] text-xs font-display font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,200,87,0.4)] active:scale-98"
            >
              <ShieldCheck size={15} />
              <span>{justActivated ? 'ACTIVATION CONFIRMED!' : 'ACTIVATE PERMANENT NO ADS — $2.99'}</span>
            </button>
          )}

          <div className="flex items-center justify-center text-[8px] font-mono-code text-[#8993B2]">
            <span>ONE-TIME PURCHASE • STORED IN PERMANENT SYSTEM CLOUD</span>
          </div>
        </div>
      </div>
    </div>
  );
};
