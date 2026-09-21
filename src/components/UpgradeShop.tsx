import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { UPGRADES } from '../data/definitions';
import { formatNumber } from '../utils/numberFormat';
import { Anvil, Zap, Target, Crosshair, Cpu } from 'lucide-react';

export type MultiplierType = 1 | 10 | 25 | 'MAX';

export const UpgradeShop: React.FC = () => {
  const {
    currencies,
    upgradeLevels,
    getUpgradeCost,
    buyUpgrade,
    buyMaxUpgrade,
    tapDamage,
    critChance,
    critDamage,
    essenceMultiplier,
  } = useGame();

  const [multiplier, setMultiplier] = useState<MultiplierType>(1);
  const multipliers: MultiplierType[] = [1, 10, 25, 'MAX'];

  const getUpgradeIcon = (id: string) => {
    switch (id) {
      case 'void_claws':
        return <Zap size={14} />;
      case 'eclipse_fangs':
        return <Cpu size={14} />;
      case 'dark_focus':
        return <Target size={14} />;
      case 'blood_moon':
        return <Crosshair size={14} />;
      case 'essence_siphon':
        return <Anvil size={14} />;
      default:
        return <Zap size={14} />;
    }
  };

  const getUpgradeColor = (id: string) => {
    switch (id) {
      case 'void_claws': return '#36D9FF'; // Cyan
      case 'eclipse_fangs': return '#A78BFA'; // Magenta/Purple
      case 'dark_focus': return '#FFC857'; // Orange
      case 'blood_moon': return '#FF4268'; // Red
      case 'essence_siphon': return '#39FF14'; // Green
      default: return '#36D9FF';
    }
  };

  const getUpgradeStatSummary = (id: string) => {
    switch (id) {
      case 'void_claws':
        return `Tap Dmg: ${formatNumber(tapDamage)}`;
      case 'eclipse_fangs':
        return `Tap Power: ${formatNumber(tapDamage * 10)}`;
      case 'dark_focus':
        return `Crit Chance: ${(critChance * 100).toFixed(1)}%`;
      case 'blood_moon':
        return `Crit Multiplier: ${(critDamage * 100).toFixed(0)}%`;
      case 'essence_siphon':
        return `Essence Rate: ${((essenceMultiplier - 1) * 100).toFixed(0)}%`;
      default:
        return '';
    }
  };

  return (
    <div className="flex-1 flex flex-col p-2.5 overflow-y-auto bg-[#080A12] gap-2 select-none ">
      {/* Tactical Header & Multiplier Matrix */}
      <div className="flex items-center justify-between bg-[#080A12] border border-[#30395C] p-2 rounded-none shrink-0 border-l-4 border-l-[#36D9FF]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#17283A] border border-[#36D9FF] flex items-center justify-center shadow-[0_0_6px_rgba(54,217,255,0.2)]">
            <Zap size={16} className="text-[#36D9FF]" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-display font-bold text-[#E8EDF7] uppercase tracking-wider leading-tight">
              UPGRADES
            </span>
            <span className="text-[9px] font-tech text-[#8993B2] uppercase">
              ENHANCE STATS
            </span>
          </div>
        </div>

        {/* Multiplier Selectors */}
        <div className="flex items-center border border-[#36D9FF]/40 p-0.5 bg-[#101426]">
          {multipliers.map((m) => (
            <button
              key={m}
              onClick={() => setMultiplier(m)}
              className={`px-2 py-1 text-[9px] font-mono-code font-bold transition-all rounded-none ${
                multiplier === m
                  ? 'bg-[#36D9FF] text-[#080A12] shadow-[0_0_6px_rgba(54,217,255,0.4)]'
                  : 'text-[#8993B2] hover:text-[#E8EDF7]'
              }`}
            >
              {typeof m === 'number' ? `x${m}` : m}
            </button>
          ))}
        </div>
      </div>

      {/* Upgrades List Grid */}
      <div className="flex flex-col gap-2 mt-2">
        {UPGRADES.map((upgrade) => {
          const currentLevel = upgradeLevels[upgrade.id] || 0;
          const isMaxLevel = upgrade.maxLevel > 0 && currentLevel >= upgrade.maxLevel;
          const color = getUpgradeColor(upgrade.id);

          let countToBuy = 1;
          if (multiplier === 'MAX') {
            countToBuy = 1;
          } else {
            countToBuy = multiplier;
            if (upgrade.maxLevel > 0) {
              countToBuy = Math.min(countToBuy, upgrade.maxLevel - currentLevel);
            }
          }

          const cost = getUpgradeCost(upgrade.id, multiplier === 'MAX' ? 1 : countToBuy);
          const canAfford = !isMaxLevel && currencies.essence >= cost && countToBuy > 0;

          const handleBuy = () => {
            if (multiplier === 'MAX') {
              buyMaxUpgrade(upgrade.id);
            } else {
              buyUpgrade(upgrade.id, countToBuy);
            }
          };

          return (
            <div
              key={upgrade.id}
              className={`relative overflow-hidden p-2 border transition-all flex items-center justify-between gap-2.5 rounded-none bg-scanline-pattern ${
                isMaxLevel
                  ? 'bg-[#040509] border-[#30395C]/40 opacity-50'
                  : 'bg-[#080A12] hover:bg-[#101426]'
              }`}
              style={!isMaxLevel ? { borderColor: `${color}40` } : {}}
            >
              {/* Left Side Details */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1 relative z-10">
                <div 
                  className="w-9 h-9 flex items-center justify-center shrink-0 border-l-[3px]"
                  style={{ backgroundColor: `${color}15`, borderLeftColor: color, borderTopColor: `${color}40`, borderRightColor: `${color}40`, borderBottomColor: `${color}40`, borderStyle: 'solid', borderWidth: '1px 1px 1px 3px', color: color }}
                >
                  {getUpgradeIcon(upgrade.id)}
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-nowrap">
                    <span className="text-xs sm:text-sm font-display font-bold text-[#E8EDF7] uppercase tracking-wide whitespace-nowrap">
                      {upgrade.displayName}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-mono-code font-bold px-1.5 py-0.5 border shrink-0 whitespace-nowrap"
                          style={{ backgroundColor: `${color}20`, borderColor: `${color}50`, color: color }}>
                      LV.{currentLevel < 10 ? `0${currentLevel}` : currentLevel}
                    </span>
                  </div>

                  <span className="text-[9px] sm:text-[10px] font-tech text-[#8993B2] mt-0.5 leading-tight whitespace-nowrap">
                    {getUpgradeStatSummary(upgrade.id)}
                  </span>
                </div>
              </div>

              {/* Right Action Button (Shorter Width) */}
              <div className="shrink-0 relative z-10">
                {isMaxLevel ? (
                  <div className="px-2.5 py-1.5 bg-[#171D35] border border-[#30395C] text-[10px] font-display font-bold text-[#414866] min-w-[64px] sm:min-w-[70px] text-center">
                    MAX
                  </div>
                ) : (
                  <button
                    onClick={handleBuy}
                    disabled={!canAfford}
                    className={`px-2 py-1 text-xs font-display font-bold flex flex-col items-center min-w-[64px] sm:min-w-[70px] transition-all rounded-none border-l-[3px]`}
                    style={{
                      borderColor: canAfford ? color : '#30395C',
                      backgroundColor: canAfford ? `${color}10` : '#101426',
                      color: canAfford ? color : '#414866',
                      opacity: canAfford ? 1 : 0.5
                    }}
                  >
                    <span className="text-[10px] sm:text-[11px] tracking-wide font-bold leading-tight">
                      UPGRADE
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-mono-code font-bold mt-0.5 flex items-center gap-1 text-[#E8EDF7] leading-none">
                      <span style={{ color: color }}>◆</span>
                      {cost >= 1000 ? `${(cost / 1000).toFixed(1)}K` : cost}
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
