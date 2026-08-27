import React from 'react';
import { useGame } from '../context/GameContext';
import { PETS } from '../data/definitions';
import { formatNumber, formatPercent } from '../utils/numberFormat';
import { Sparkles, Check, Lock } from 'lucide-react';

export const PetsPanel: React.FC = () => {
  const {
    ownedPets,
    activePetId,
    setActivePet,
    getPetLevel,
    relicsAwakened,
  } = useGame();

  return (
    <div className="flex-1 flex flex-col p-3 overflow-y-auto bg-[#08080C] gap-3">
      {/* Header Info */}
      <div className="bg-[#171722] border border-[#4E4E66] p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#FF8A28]" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#F6F6FC]">COMPANION ROSTER</span>
            <span className="text-[10px] text-[#8686A2]">
              Companions earn XP on kills and absorb boss trophy cards
            </span>
          </div>
        </div>

        {!relicsAwakened && (
          <div className="text-[10px] text-[#FF8A28] border border-[#FF8A28] px-2 py-0.5 flex items-center gap-1">
            <Lock size={10} /> AWAKENS AT LV.51
          </div>
        )}
      </div>

      {/* Pet Cards */}
      <div className="flex flex-col gap-3">
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
              className={`bg-[#171722] border p-3 flex flex-col gap-2.5 transition-all ${
                isActive
                  ? 'border-[#FF8A28] ring-1 ring-[#FF8A28]'
                  : isOwned
                  ? 'border-[#4E4E66]'
                  : 'border-[#4E4E66] opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-[#08080C] border border-[#4E4E66] flex items-center justify-center p-1 relative">
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
                      <Lock size={20} className="text-[#4E4E66]" />
                    )}
                    {isOwned && stageIndex > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-[#FF8A28] text-[#08080C] text-[8px] font-bold px-1">
                        EVO
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#F6F6FC]">
                        {isOwned ? stageName : 'Unknown Beast'}
                      </span>
                      {isOwned && (
                        <span className="text-xs text-[#FF8A28] font-bold">
                          LV.{level}/{pet.maxLevel}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-[#C8C8DA] mt-0.5">
                      {pet.bonusStat === 'essence' ? 'Essence Gain' : 'Tap Damage'}:{' '}
                      <span className="text-[#6ADC3E] font-bold font-mono">
                        {isOwned ? formatPercent(totalBonus) : `+${pet.bonusPerLevel * 100}%/lv`}
                      </span>
                    </span>

                    {isOwned && absorbedBonus > 0 && (
                      <span className="text-[10px] text-[#A85CFF]">
                        Absorbed Vigor: +{formatPercent(absorbedBonus, 2)}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  {isOwned ? (
                    isActive ? (
                      <div className="px-3 py-1.5 bg-[#FF8A28] text-[#08080C] text-xs font-bold flex items-center gap-1">
                        <Check size={14} /> ACTIVE
                      </div>
                    ) : (
                      <button
                        onClick={() => setActivePet(pet.id)}
                        className="px-3 py-1.5 bg-[#2C2C3C] border border-[#4E4E66] text-xs font-bold text-[#F6F6FC] hover:bg-[#B01228] hover:border-[#FF3A46] transition-colors"
                      >
                        SET ACTIVE
                      </button>
                    )
                  ) : (
                    <span className="text-[11px] text-[#8686A2]">
                      {pet.id === 'ember' ? 'Awakens at Lv.51' : 'Frozen Ruins Drop'}
                    </span>
                  )}
                </div>
              </div>

              {/* XP Progress bar */}
              {isOwned && level < pet.maxLevel && (
                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between text-[10px] text-[#8686A2]">
                    <span>EXPERIENCE</span>
                    <span>
                      {xpIntoLevel} / 60 XP
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#08080C] border border-[#4E4E66] overflow-hidden">
                    <div
                      className="h-full bg-[#FF8A28] transition-all duration-200"
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
