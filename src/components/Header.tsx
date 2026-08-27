import React from 'react';
import { useGame } from '../context/GameContext';
import { formatNumber } from '../utils/numberFormat';
import { Settings, Volume2, VolumeX, Sparkles, Gem, ShieldAlert, Coins } from 'lucide-react';

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
    <header className="w-full bg-[#171722] border-b border-[#4E4E66] px-3 py-2 flex flex-col gap-2 shrink-0 z-30">
      {/* Top row: World info, Level badge, sound, settings */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-[#2C2C3C] border border-[#4E4E66] px-2 py-0.5 text-xs text-[#F6F6FC] font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#FF3A46] inline-block animate-pulse"></span>
            {activeWorld.displayName}
          </div>
          <div className="text-xs text-[#8686A2]">
            FL <span className="text-[#FF3A46] font-bold">LV.{enemyLevel}</span>
          </div>
          {combatState === 'BOSS_FIGHT' && (
            <span className="bg-[#B01228] border border-[#FF3A46] text-[#F6F6FC] text-[10px] px-1.5 py-0.2 font-bold flex items-center gap-1 animate-bounce">
              <ShieldAlert size={11} /> BOSS GATE
            </span>
          )}
          {combatState === 'FARM_MODE' && (
            <span className="bg-[#2C2C3C] border border-[#8686A2] text-[#8686A2] text-[10px] px-1.5 py-0.2">
              FARMING
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleSound}
            className="p-1.5 text-[#8686A2] hover:text-[#F6F6FC] hover:bg-[#2C2C3C] border border-transparent hover:border-[#4E4E66] transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button
            onClick={onOpenSettings}
            className="p-1.5 text-[#8686A2] hover:text-[#F6F6FC] hover:bg-[#2C2C3C] border border-transparent hover:border-[#4E4E66] transition-colors"
            title="Settings & Stats"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Currencies Bar */}
      <div className="grid grid-cols-4 gap-1 sm:gap-2">
        {/* Essence */}
        <div className="bg-[#08080C] border border-[#4E4E66] px-2 py-1 flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#A85CFF] shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] text-[#8686A2] leading-tight truncate">ESSENCE</span>
            <span className="text-xs font-bold text-[#F6F6FC] truncate">
              {formatNumber(currencies.essence)}
            </span>
          </div>
        </div>

        {/* Void Crystals */}
        <div className="bg-[#08080C] border border-[#4E4E66] px-2 py-1 flex items-center gap-1.5">
          <Gem size={12} className="text-[#3EDCFA] shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] text-[#8686A2] leading-tight truncate">CRYSTALS</span>
            <span className="text-xs font-bold text-[#3EDCFA] truncate">
              {formatNumber(currencies.void_crystals)}
            </span>
          </div>
        </div>

        {/* Void Scraps */}
        <div className="bg-[#08080C] border border-[#4E4E66] px-2 py-1 flex items-center gap-1.5">
          <Coins size={12} className="text-[#FF8A28] shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] text-[#8686A2] leading-tight truncate">SCRAPS</span>
            <span className="text-xs font-bold text-[#FF8A28] truncate">
              {formatNumber(currencies.void_scraps)}
            </span>
          </div>
        </div>

        {/* Astral Shards & Arcade Tokens */}
        <div className="bg-[#08080C] border border-[#4E4E66] px-2 py-1 flex items-center gap-1.5">
          <Sparkles size={12} className="text-[#FFD23C] shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] text-[#8686A2] leading-tight truncate">SHARDS/TOK</span>
            <span className="text-xs font-bold text-[#FFD23C] truncate">
              {formatNumber(currencies.astral_shards)} <span className="text-[#8686A2] font-normal">|</span> {tokens}T
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
