import React from 'react';
import { useGame } from '../context/GameContext';
import { PETS } from '../data/definitions';
import { formatPercent } from '../utils/numberFormat';
import { Check, Lock, Cpu } from 'lucide-react';

export const PetsPanel: React.FC = () => {
  const {
    ownedPets,
    activePetId,
    setActivePet,
    getPetLevel,
    relicsAwakened,
  } = useGame();

  return (
    <div className="flex-1 flex flex-col p-2.5 overflow-y-auto bg-[#171D35] gap-2 select-none ">
      {/* Header Info */}
      <div className="bg-[#101426] border border-[#36D9FF]/40 p-2 rounded-none flex items-center justify-between hud-corner">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#36D9FF]/10 border border-[#36D9FF] flex items-center justify-center">
            <Cpu size={13} className="text-[#36D9FF]" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase tracking-wider">
              SYS://BEAST_COMPANIONS
            </span>
            <span className="text-[9px] font-tech text-[#8993B2]">
              SYNCHRONIZE AUTONOMOUS COMBAT SUBROUTINES
            </span>
          </div>
        </div>

        {!relicsAwakened && (
          <div className="text-[8px] font-mono-code font-bold text-[#FFC857] bg-[#171D35] border border-[#FFC857] px-1.5 py-0.5 rounded-none flex items-center gap-1">
            <Lock size={9} /> UNLOCKS FLR 51
          </div>
        )}
      </div>

      {/* Pet Cards */}
      <div className="flex flex-col gap-2">
        {PETS.map((pet) => {
          const isOwned = !!ownedPets[pet.id];
          const petData = ownedPets[pet.id];
          const level = getPetLevel(pet.id);
          const stageIndex = level >= pet.evolutionLevels[0] ? 1 : 0;
          const stageName = pet.stageNames[stageIndex];
          const stageSprite = pet.stageSprites[stageIndex];
          const isActive = activePetId === pet.id;

          const currentXp = petData ? petData.xp : 0;
          const xpIntoLevel = currentXp % 60;
          const xpPercent = Math.min(100, (xpIntoLevel / 60) * 100);
          const absorbedBonus = Math.min(0.5, petData?.absorbed || 0);
          const totalBonus = level * pet.bonusPerLevel + absorbedBonus;

          return (
            <div
              key={pet.id}
              className={`p-2.5 border transition-all flex flex-col gap-2 rounded-none ${
                isActive
                  ? 'bg-[#101426] border-[#36D9FF] shadow-[inset_0_0_8px_rgba(155,81,111,0.15)]'
                  : isOwned
                  ? 'bg-[#101426] border-white/15 hover:border-white/30'
                  : 'bg-[#040406] border-white/10 opacity-40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-12 h-12 bg-[#171D35] border border-white/20 flex items-center justify-center p-1 relative shrink-0">
                    {isOwned ? (
                      <img
                        src={stageSprite}
                        alt={stageName}
                        className="w-full h-full object-contain pixelated"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Lock size={16} className="text-[#8993B2]" />
                    )}
                    {isOwned && stageIndex > 0 && (
                      <span className="absolute -top-1 -right-1 bg-[#36D9FF] text-[#171D35] text-[7px] font-mono-code font-black px-1">
                        EVO
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase">
                        {isOwned ? stageName : 'UNKNOWN BEAST'}
                      </span>
                      {isOwned && (
                        <span className="text-[8px] font-mono-code font-bold text-[#36D9FF] bg-[#36D9FF]/10 px-1 border border-[#36D9FF]/30">
                          LV.{level}/{pet.maxLevel}
                        </span>
                      )}
                    </div>

                    <span className="text-[9px] font-tech text-[#8993B2] mt-0.5">
                      {pet.bonusStat === 'essence' ? 'Essence Resonance' : 'Strike Potency'}:{' '}
                      <span className="text-[#36D9FF] font-mono-code font-bold">
                        {isOwned ? formatPercent(totalBonus) : `+${pet.bonusPerLevel * 100}%/LV`}
                      </span>
                    </span>

                    {isOwned && absorbedBonus > 0 && (
                      <span className="text-[8px] font-mono-code text-[#36D9FF]">
                        ABSORBED VIGOR: +{formatPercent(absorbedBonus, 2)}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  {isOwned ? (
                    isActive ? (
                      <div className="px-2.5 py-1 bg-[#36D9FF] text-[#171D35] text-[10px] font-display font-bold rounded-none flex items-center gap-1">
                        <Check size={11} /> ACTIVE
                      </div>
                    ) : (
                      <button
                        onClick={() => setActivePet(pet.id)}
                        className="px-2.5 py-1 hud-btn text-[10px] font-display font-bold"
                      >
                        DEPLOY
                      </button>
                    )
                  ) : (
                    <span className="text-[9px] text-[#8993B2] font-tech">
                      {pet.id === 'ember' ? 'AWAKENS FLR 51' : 'RUINS GATE DROP'}
                    </span>
                  )}
                </div>
              </div>

              {/* XP Progress Bar */}
              {isOwned && level < pet.maxLevel && (
                <div className="flex flex-col gap-0.5 mt-0.5">
                  <div className="flex justify-between text-[8px] font-mono-code text-[#8993B2]">
                    <span>EXP INTEGRATION</span>
                    <span>{xpIntoLevel} / 60 XP</span>
                  </div>
                  <div className="w-full h-1 bg-[#171D35] border border-white/10 overflow-hidden">
                    <div
                      className="h-full bg-[#36D9FF]"
                      style={{ width: `${xpPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
