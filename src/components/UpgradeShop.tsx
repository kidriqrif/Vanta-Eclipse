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
        return <Zap size={14} className="text-[#36D9FF]" />;
      case 'eclipse_fangs':
        return <Cpu size={14} className="text-[#7CF2FF]" />;
      case 'dark_focus':
        return <Target size={14} className="text-[#36D9FF]" />;
      case 'blood_moon':
        return <Crosshair size={14} className="text-[#FF4268]" />;
      case 'essence_siphon':
        return <Anvil size={14} className="text-[#FFC857]" />;
      default:
        return <Zap size={14} className="text-[#36D9FF]" />;
    }
  };

  const getUpgradeStatSummary = (id: string) => {
    switch (id) {
      case 'void_claws':
        return `Tap DMG: ${formatNumber(tapDamage)}`;
      case 'eclipse_fangs':
        return `Tap Power: ${formatNumber(tapDamage)}`;
      case 'dark_focus':
        return `Crit Chance: ${(critChance * 100).toFixed(1)}%`;
      case 'blood_moon':
        return `Crit Multi: ${(critDamage * 100).toFixed(0)}%`;
      case 'essence_siphon':
        return `Essence Rate: ${((essenceMultiplier - 1) * 100).toFixed(0)}%`;
      default:
        return '';
    }
  };

  return (
    <div className="flex-1 flex flex-col p-2.5 overflow-y-auto bg-[#080A12] gap-2 select-none ">
      {/* Tactical Header & Multiplier Matrix */}
      <div className="flex items-center justify-between bg-[#101426] border border-[#30395C] p-2 rounded-none shrink-0 hud-corner">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#171D35] border border-[#FFC857]/50 flex items-center justify-center shadow-[0_0_6px_rgba(255,200,87,0.2)]">
            <Anvil size={13} className="text-[#FFC857]" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-display font-bold text-[#E8EDF7] uppercase tracking-wider">
              SYS://THE_FORGE
            </span>
            <span className="text-[9px] font-tech text-[#8993B2]">
              ENHANCE STRIKE POWER & RESONANCE
            </span>
          </div>
        </div>

        {/* Multiplier Selectors */}
        <div className="flex items-center border border-[#30395C] p-0.5 bg-[#171D35]">
          {multipliers.map((m) => (
            <button
              key={m}
              onClick={() => setMultiplier(m)}
              className={`px-2 py-0.5 text-[9px] font-mono-code font-bold transition-all rounded-none ${
                multiplier === m
                  ? 'bg-[#FFC857] text-[#080A12] shadow-[0_0_6px_rgba(255,200,87,0.4)]'
                  : 'text-[#8993B2] hover:text-[#E8EDF7]'
              }`}
            >
              {typeof m === 'number' ? `x${m}` : m}
            </button>
          ))}
        </div>
      </div>

      {/* Upgrades List Grid */}
      <div className="flex flex-col gap-1.5">
        {UPGRADES.map((upgrade) => {
          const currentLevel = upgradeLevels[upgrade.id] || 0;
          const isMaxLevel = upgrade.maxLevel > 0 && currentLevel >= upgrade.maxLevel;

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
              className={`p-2 border transition-all flex items-center justify-between gap-2.5 rounded-none ${
                isMaxLevel
                  ? 'bg-[#040509] border-[#30395C]/40 opacity-50'
                  : 'bg-[#101426] hover:bg-[#171D35] border-[#30395C] hover:border-[#36D9FF]/60'
              }`}
            >
              {/* Left Side Details */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 bg-[#171D35] border border-[#30395C] flex items-center justify-center shrink-0">
                  {getUpgradeIcon(upgrade.id)}
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-display font-bold text-[#E8EDF7] uppercase tracking-wide truncate">
                      {upgrade.displayName}
                    </span>
                    <span className="text-[9px] font-mono-code font-bold text-[#36D9FF] bg-[#17283A] px-1 border border-[#36D9FF]/40 shrink-0">
                      LV.{currentLevel}
                      {upgrade.maxLevel > 0 ? `/${upgrade.maxLevel}` : ''}
                    </span>
                  </div>

                  <span className="text-[10px] font-tech text-[#8993B2] truncate mt-0.5">
                    {upgrade.description}
                  </span>

                  <span className="text-[9px] font-mono-code text-[#36D9FF] mt-0.5">
                    {getUpgradeStatSummary(upgrade.id)}
                  </span>
                </div>
              </div>

              {/* Right Action Button */}
              <div className="shrink-0">
                {isMaxLevel ? (
                  <div className="px-2.5 py-1 bg-[#171D35] border border-[#30395C] text-[10px] font-display font-bold text-[#414866]">
                    MAX
                  </div>
                ) : (
                  <button
                    onClick={handleBuy}
                    disabled={!canAfford}
                    className={`px-3 py-1.5 text-xs font-display font-bold flex flex-col items-center min-w-[85px] transition-all rounded-none ${
                      canAfford
                        ? 'bg-[#171D35] border border-[#FFC857] text-[#FFC857] hover:bg-[#FFC857] hover:text-[#080A12] shadow-[0_0_8px_rgba(255,200,87,0.25)] active:scale-95'
                        : 'bg-[#101426] border border-[#30395C] text-[#414866] cursor-not-allowed opacity-50'
                    }`}
                  >
                    <span>
                      {multiplier === 'MAX' ? 'BUY MAX' : `UP +${countToBuy}`}
                    </span>
                    <span className="text-[8px] font-mono-code opacity-85">
                      {formatNumber(cost)} ESS
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
