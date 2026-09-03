import React from 'react';
import { useGame } from '../context/GameContext';
import { formatNumber } from '../utils/numberFormat';
import { Settings, Volume2, VolumeX, ShieldAlert, Cpu, Activity } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  const {
    currencies,
    enemyLevel,
    combatState,
    activeWorld,
    tokens,
    settings,
    updateSettings,
  } = useGame();

  const toggleSound = () => {
    const isMuted = settings.sfxMuted && settings.bgmMuted;
    updateSettings({ sfxMuted: !isMuted, bgmMuted: !isMuted });
  };

  const isMuted = settings.sfxMuted && settings.bgmMuted;

  return (
    <header className="w-full bg-[#080A12] border-b border-[#30395C] px-3 py-2 flex flex-col gap-2 shrink-0 z-30 relative ">
      {/* Top Sector Tactical Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {/* Sector Tag */}
          <div className="flex items-center gap-1.5 bg-[#101426] border border-[#36D9FF]/60 px-2 py-0.5 rounded-none shadow-[0_0_8px_rgba(54,217,255,0.15)]">
            <span className="w-1.5 h-1.5 bg-[#36D9FF] shadow-[0_0_6px_#36D9FF]"></span>
            <span className="text-[10px] font-display font-bold tracking-widest text-[#36D9FF] uppercase truncate">
              {activeWorld.displayName}
            </span>
          </div>

          {/* Floor Tactical Indicator */}
          <div className="flex items-center gap-1 bg-[#101426] border border-[#30395C] px-2 py-0.5 rounded-none">
            <span className="text-[9px] text-[#8993B2] font-tech tracking-wider">FLOOR:</span>
            <span className="text-xs font-mono-code font-bold text-[#E8EDF7]">
              {String(enemyLevel).padStart(3, '0')}
            </span>
          </div>

          {/* Combat State Badges */}
          {combatState === 'BOSS_FIGHT' && (
            <div className="bg-[#171D35] border border-[#FF4268] text-[#FF4268] text-[9px] font-display font-bold px-2 py-0.5 rounded-none flex items-center gap-1 shadow-[0_0_8px_rgba(255,66,104,0.4)] animate-pulse">
              <ShieldAlert size={10} className="text-[#FF4268]" />
              <span>BOSS GATE</span>
            </div>
          )}

          {combatState === 'FARM_MODE' && (
            <div className="bg-[#101426] border border-[#30395C] text-[#8993B2] text-[9px] font-tech font-bold px-1.5 py-0.5 rounded-none flex items-center gap-1">
              <span className="w-1 h-1 bg-[#36D9FF]"></span>
              <span>AUTO-FARM</span>
            </div>
          )}
        </div>

        {/* Tactical Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleSound}
            className="w-7 h-7 rounded-none bg-[#101426] hover:bg-[#17283A] hover:text-[#7CF2FF] border border-[#30395C] hover:border-[#36D9FF] text-[#8993B2] transition-all flex items-center justify-center active:scale-95"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            aria-label="Toggle Sound"
          >
            {isMuted ? <VolumeX size={13} className="text-[#FF4268]" /> : <Volume2 size={13} />}
          </button>
          <button
            onClick={onOpenSettings}
            className="w-7 h-7 rounded-none bg-[#101426] hover:bg-[#17283A] hover:text-[#7CF2FF] border border-[#30395C] hover:border-[#36D9FF] text-[#8993B2] transition-all flex items-center justify-center active:scale-95"
            title="Tactical Config"
            aria-label="Open Settings"
          >
            <Settings size={13} />
          </button>
        </div>
      </div>

      {/* High-Density Currency Matrix */}
      <div className="grid grid-cols-4 gap-1">
        {/* Essence Meter - Cyan */}
        <div className="bg-[#101426] border border-[#30395C] hover:border-[#36D9FF] p-1.5 rounded-none flex flex-col justify-between transition-colors group">
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-tech tracking-wider text-[#8993B2] uppercase">
              ESSENCE
            </span>
            <span className="text-[9px] text-[#36D9FF] leading-none">◆</span>
          </div>
          <span className="text-xs font-mono-code font-bold text-[#E8EDF7] truncate group-hover:text-[#36D9FF] transition-colors">
            {formatNumber(currencies.essence)}
          </span>
        </div>

        {/* Void Crystals - Gold */}
        <div className="bg-[#101426] border border-[#30395C] hover:border-[#FFC857] p-1.5 rounded-none flex flex-col justify-between transition-colors group">
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-tech tracking-wider text-[#8993B2] uppercase">
              CRYSTALS
            </span>
            <span className="text-[9px] text-[#FFC857] leading-none">◆</span>
          </div>
          <span className="text-xs font-mono-code font-bold text-[#E8EDF7] truncate group-hover:text-[#FFC857] transition-colors">
            {formatNumber(currencies.void_crystals)}
          </span>
        </div>

        {/* Scraps - Violet */}
        <div className="bg-[#101426] border border-[#30395C] hover:border-[#A78BFA] p-1.5 rounded-none flex flex-col justify-between transition-colors group">
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-tech tracking-wider text-[#8993B2] uppercase">
              SCRAPS
            </span>
            <span className="text-[9px] text-[#A78BFA] leading-none">◆</span>
          </div>
          <span className="text-xs font-mono-code font-bold text-[#E8EDF7] truncate group-hover:text-[#A78BFA] transition-colors">
            {formatNumber(currencies.void_scraps)}
          </span>
        </div>

        {/* Shards & Tokens - Crimson */}
        <div className="bg-[#101426] border border-[#30395C] hover:border-[#FF4268] p-1.5 rounded-none flex flex-col justify-between transition-colors group">
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-tech tracking-wider text-[#8993B2] uppercase">
              SHD / TOK
            </span>
            <span className="text-[9px] text-[#FF4268] leading-none">◆</span>
          </div>
          <span className="text-xs font-mono-code font-bold text-[#E8EDF7] truncate">
            {formatNumber(currencies.astral_shards)} <span className="text-[#30395C]">|</span> <span className="text-[#FFC857]">{tokens}</span>
          </span>
        </div>
      </div>
    </header>
  );
};
