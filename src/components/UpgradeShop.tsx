import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { UPGRADES } from '../data/definitions';
import { formatNumber } from '../utils/numberFormat';
import { Swords, Crosshair, Zap, Sparkles, TrendingUp } from 'lucide-react';

export const UpgradeShop: React.FC = () => {
  const {
    currencies,
    upgradeLevels,
    getUpgradeCost,
    buyUpgrade,
    buyMaxUpgrade,
  } = useGame();

  const [buyMultiplier, setBuyMultiplier] = useState<1 | 10 | 'MAX'>(1);

  const getUpgradeIcon = (id: string) => {
    switch (id) {
      case 'void_claws': return <Swords size={18} className="text-[#FF3A46]" />;
      case 'eclipse_fangs': return <TrendingUp size={18} className="text-[#FF8A28]" />;
      case 'dark_focus': return <Crosshair size={18} className="text-[#FFD23C]" />;
      case 'blood_moon': return <Zap size={18} className="text-[#FF3A46]" />;
      case 'essence_siphon': return <Sparkles size={18} className="text-[#A85CFF]" />;
      default: return <Swords size={18} className="text-[#C8C8DA]" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col p-3 overflow-y-auto bg-[#08080C] gap-3">
      {/* Multiplier toggle bar */}
      <div className="flex items-center justify-between bg-[#171722] border border-[#4E4E66] p-2 shrink-0">
        <span className="text-xs font-bold text-[#F6F6FC]">FORGE UPGRADES</span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[#8686A2] mr-1">BUY:</span>
          {([1, 10, 'MAX'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setBuyMultiplier(m)}
              className={`px-2.5 py-0.5 text-xs font-bold border transition-colors ${
                buyMultiplier === m
                  ? 'bg-[#B01228] border-[#FF3A46] text-[#F6F6FC]'
                  : 'bg-[#2C2C3C] border-[#4E4E66] text-[#8686A2] hover:text-[#F6F6FC]'
              }`}
            >
              {m === 'MAX' ? 'MAX' : `+${m}`}
            </button>
          ))}
        </div>
      </div>

      {/* Upgrades List */}
      <div className="flex flex-col gap-2">
        {UPGRADES.map((def) => {
          const currentLevel = upgradeLevels[def.id] || 0;
          const isMaxed = def.maxLevel > 0 && currentLevel >= def.maxLevel;

          let countToBuy = 1;
          let cost = 0;

          if (!isMaxed) {
            if (buyMultiplier === 'MAX') {
              countToBuy = 1; // will execute buyMax
              cost = getUpgradeCost(def.id, 1);
            } else {
              countToBuy = def.maxLevel > 0 ? Math.min(buyMultiplier, def.maxLevel - currentLevel) : buyMultiplier;
              cost = getUpgradeCost(def.id, countToBuy);
            }
          }

          const canAfford = !isMaxed && currencies.essence >= cost;

          const handlePurchase = () => {
            if (buyMultiplier === 'MAX') {
              buyMaxUpgrade(def.id);
            } else {
              buyUpgrade(def.id, countToBuy);
            }
          };

          return (
            <div
              key={def.id}
              className="bg-[#171722] border border-[#4E4E66] p-2.5 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 bg-[#08080C] border border-[#4E4E66] flex items-center justify-center shrink-0">
                  {getUpgradeIcon(def.id)}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#F6F6FC] truncate">
                      {def.displayName}
                    </span>
                    <span className="text-[10px] text-[#8686A2] font-mono">
                      LV.{currentLevel}
                      {def.maxLevel > 0 && `/${def.maxLevel}`}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#C8C8DA] leading-tight mt-0.5">
                    {def.description}
                  </span>
                </div>
              </div>

              {/* Buy Button */}
              <div className="shrink-0">
                {isMaxed ? (
                  <div className="px-3 py-1.5 bg-[#2C2C3C] border border-[#4E4E66] text-[11px] font-bold text-[#8686A2]">
                    MAXED
                  </div>
                ) : (
                  <button
                    onClick={handlePurchase}
                    disabled={!canAfford}
                    className={`px-3 py-1.5 text-xs font-bold border transition-colors flex flex-col items-center min-w-[80px] ${
                      canAfford
                        ? 'bg-[#B01228] border-[#FF3A46] text-[#F6F6FC] hover:bg-[#FF3A46] active:translate-y-0.5'
                        : 'bg-[#2C2C3C] border-[#4E4E66] text-[#8686A2] cursor-not-allowed opacity-50'
                    }`}
                  >
                    <span>{buyMultiplier === 'MAX' ? 'BUY MAX' : `+${countToBuy}`}</span>
                    <span className="text-[10px] font-normal opacity-90">
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
