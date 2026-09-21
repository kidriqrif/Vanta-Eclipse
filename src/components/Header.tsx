import React from 'react';
import { useGame } from '../context/GameContext';
import { formatNumber } from '../utils/numberFormat';
import { Settings, ShieldCheck, ShieldAlert, Cpu, Activity, RefreshCcw } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenNoAds: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, onOpenNoAds }) => {
  const {
    currencies,
    enemyLevel,
    combatState,
    activeWorld,
    tokens,
    hasRemovedAds,
  } = useGame();

  return (
    <header className="w-full bg-[#080A12] border-b border-[#30395C] px-2.5 py-1.5 flex flex-col gap-1.5 shrink-0 z-30 relative select-none">
      {/* Top Sector Tactical Row */}
      <div className="flex items-center justify-between gap-1.5 w-full min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 shrink">
          {/* Integrated Sector & Floor Tactical Badge */}
          <div className="flex items-center bg-[#101426] border border-[#36D9FF] rounded-none overflow-hidden shrink-0 shadow-[0_0_8px_rgba(54,217,255,0.12)]">
            <div className="flex items-center justify-center w-5 self-stretch bg-[#101426] border-r border-[#36D9FF] text-[#36D9FF]">
              <span className="text-[10px] font-bold block leading-none shadow-[0_0_6px_#36D9FF]">≡</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-[#101426]">
              <span className="text-[10px] font-display font-bold tracking-wider text-[#36D9FF] uppercase flex-shrink-0">
                {activeWorld.displayName}
              </span>
            </div>
            <div className="flex flex-col justify-center px-1.5 py-0.5 bg-[#171D35] border-l border-[#36D9FF]">
              <span className="text-[7px] text-[#8993B2] font-tech uppercase tracking-wider leading-none">F-</span>
              <span className="text-[10px] font-mono-code font-bold text-[#E8EDF7] leading-none">
                {String(enemyLevel).padStart(3, '0')}
              </span>
            </div>
          </div>

          {/* Combat State Badges */}
          {combatState === 'BOSS_FIGHT' && (
            <div className="bg-[#171D35] border border-[#FF4268] text-[#FF4268] text-[8px] font-display font-bold px-1.5 py-1 rounded-none flex items-center gap-1 shadow-[0_0_8px_rgba(255,66,104,0.3)] animate-pulse shrink-0">
              <ShieldAlert size={10} className="text-[#FF4268]" />
              <span>BOSS GATE</span>
            </div>
          )}
        </div>

        {/* Tactical Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {combatState === 'FARM_MODE' && (
            <div className="bg-[#101426] border border-[#36D9FF] text-[#36D9FF] text-[8px] font-tech font-bold px-1.5 py-1 rounded-none flex flex-col items-center justify-center gap-0.5 shrink-0 shadow-[0_0_8px_rgba(54,217,255,0.15)] leading-none">
              <span className="flex items-center gap-1"><RefreshCcw size={8} className="animate-spin-slow"/> AUTO:</span>
              <span className="text-[#39FF14]">ENGAGED</span>
            </div>
          )}
          
          {/* Permanent No Ads Button - Streamlined */}
          <button
            id="btn-header-no-ads"
            onClick={onOpenNoAds}
            className={`h-6 px-2 rounded-none border transition-all flex items-center gap-1 active:scale-95 cursor-pointer select-none group shrink-0 ${
              hasRemovedAds
                ? 'bg-[#101426] border-[#36D9FF]/70 text-[#36D9FF] shadow-[0_0_6px_rgba(54,217,255,0.2)] hover:border-[#36D9FF]'
                : 'bg-[#171D35] border-[#FFC857] text-[#FFC857] shadow-[0_0_8px_rgba(255,200,87,0.25)] hover:bg-[#FFC857] hover:text-[#080A12]'
            }`}
            title={hasRemovedAds ? 'Pro Protocol Active (Permanent Ad-Free)' : 'Unlock Permanent No Ads ($2.99)'}
            aria-label={hasRemovedAds ? 'Pro Active' : 'Permanent No Ads'}
          >
            <ShieldCheck size={11} className={hasRemovedAds ? 'text-[#36D9FF]' : 'text-current shrink-0'} />
            <span className="text-[9px] font-display font-bold uppercase tracking-wider whitespace-nowrap">
              {hasRemovedAds ? 'PRO' : 'NO ADS'}
            </span>
            {!hasRemovedAds ? (
              <span className="text-[8px] font-mono-code font-bold opacity-85 group-hover:opacity-100 whitespace-nowrap ml-0.5">
                $2.99
              </span>
            ) : (
              <span className="w-1 h-1 bg-[#36D9FF] rounded-full shadow-[0_0_4px_#36D9FF]"></span>
            )}
          </button>

          {/* Settings Button */}
          <button
            id="btn-header-settings"
            onClick={onOpenSettings}
            className="w-6 h-6 rounded-none bg-[#101426] hover:bg-[#17283A] hover:text-[#7CF2FF] border border-[#30395C] hover:border-[#36D9FF] text-[#8993B2] transition-all flex items-center justify-center active:scale-95 cursor-pointer shrink-0"
            title="Tactical Config"
            aria-label="Open Settings"
          >
            <Settings size={12} />
          </button>
        </div>
      </div>

      {/* Streamlined Slim Currency Matrix */}
      <div className="grid grid-cols-4 gap-2 mt-1">
        {/* Essence Meter - Cyan */}
        <div 
          className="bg-[#080A12] border-l-2 border-l-[#36D9FF] pl-2 flex flex-col justify-center"
          title={`Essence: ${currencies.essence.toLocaleString()}`}
        >
          <div className="flex items-center gap-1 leading-none mb-1">
            <span className="text-[6px] text-[#36D9FF] shrink-0">◆</span>
            <span className="text-[7.5px] font-tech tracking-wider text-[#8993B2] uppercase truncate">
              ESSENCE
            </span>
          </div>
          <span className="text-xs font-mono-code font-bold text-[#E8EDF7] leading-tight truncate">
            {formatNumber(currencies.essence)}
          </span>
        </div>

        {/* Void Crystals - Magenta */}
        <div 
          className="bg-[#080A12] border-l-2 border-l-[#FF4268] pl-2 flex flex-col justify-center"
          title={`Void Crystals: ${currencies.void_crystals.toLocaleString()}`}
        >
          <div className="flex items-center gap-1 leading-none mb-1">
            <span className="text-[6px] text-[#FF4268] shrink-0">◆</span>
            <span className="text-[7.5px] font-tech tracking-wider text-[#8993B2] uppercase truncate">
              CRYSTALS
            </span>
          </div>
          <span className="text-xs font-mono-code font-bold text-[#E8EDF7] leading-tight truncate">
            {formatNumber(currencies.void_crystals)}
          </span>
        </div>

        {/* Scraps - Gold/Orange */}
        <div 
          className="bg-[#080A12] border-l-2 border-l-[#FFC857] pl-2 flex flex-col justify-center"
          title={`Void Scraps: ${currencies.void_scraps.toLocaleString()}`}
        >
          <div className="flex items-center gap-1 leading-none mb-1">
            <span className="text-[6px] text-[#FFC857] shrink-0">⬢</span>
            <span className="text-[7.5px] font-tech tracking-wider text-[#8993B2] uppercase truncate">
              SCRAPS
            </span>
          </div>
          <span className="text-xs font-mono-code font-bold text-[#E8EDF7] leading-tight truncate">
            {formatNumber(currencies.void_scraps)}
          </span>
        </div>

        {/* Tokens - Crimson/Red */}
        <div 
          className="bg-[#080A12] border-l-2 border-l-[#FF3333] pl-2 flex flex-col justify-center"
          title={`Arcade Tokens: ${tokens}`}
        >
          <div className="flex items-center gap-1 leading-none mb-1">
            <span className="text-[6px] text-[#FF3333] shrink-0">✦</span>
            <span className="text-[7.5px] font-tech tracking-wider text-[#8993B2] uppercase truncate">
              TOKENS
            </span>
          </div>
          <span className="text-xs font-mono-code font-bold text-[#E8EDF7] leading-tight truncate">
            {formatNumber(tokens)}
          </span>
        </div>
      </div>
    </header>
  );
};
