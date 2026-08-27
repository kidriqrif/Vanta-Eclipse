import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { CARD_RARITIES, PETS } from '../data/definitions';
import { formatNumber, formatPercent } from '../utils/numberFormat';
import { Sparkles, Flame, Shield, HelpCircle } from 'lucide-react';
import { Card } from '../types/game';

export const CardsCollection: React.FC = () => {
  const { cards, absorbCard, activePetId, ownedPets } = useGame();
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  const activePetDef = PETS.find((p) => p.id === activePetId);
  const activePetData = activePetId ? ownedPets[activePetId] : null;

  return (
    <div className="flex-1 flex flex-col p-3 overflow-y-auto bg-[#08080C] gap-3">
      {/* Header Info */}
      <div className="bg-[#171722] border border-[#4E4E66] p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#A85CFF]" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#F6F6FC]">
              BOSS TROPHY CARDS ({cards.length}/200)
            </span>
            <span className="text-[10px] text-[#8686A2]">
              Absorb cards to empower your active companion
            </span>
          </div>
        </div>

        {activePetDef ? (
          <div className="flex items-center gap-1.5 bg-[#08080C] border border-[#4E4E66] px-2 py-1">
            <span className="text-[10px] text-[#8686A2]">TARGET:</span>
            <span className="text-xs font-bold text-[#FF8A28]">
              {activePetDef.stageNames[0]}
            </span>
          </div>
        ) : (
          <div className="text-[10px] text-[#FF3A46] border border-[#FF3A46] px-2 py-0.5">
            NO ACTIVE PET
          </div>
        )}
      </div>

      {/* Selected Card Inspector */}
      {selectedCard && (
        <div className="bg-[#171722] border-2 border-[#A85CFF] p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold px-1.5 py-0.5"
                style={{
                  backgroundColor:
                    CARD_RARITIES.find((r) => r.id === selectedCard.rarity)?.tierColor ||
                    '#C8C8DA',
                  color: '#08080C',
                }}
              >
                {selectedCard.rarity.toUpperCase()}
              </span>
              <span className="text-xs font-bold text-[#F6F6FC]">
                {selectedCard.bossName} (Lv.{selectedCard.level})
              </span>
            </div>
            <button
              onClick={() => setSelectedCard(null)}
              className="text-xs text-[#8686A2] hover:text-[#F6F6FC]"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 my-1">
            <div className="bg-[#08080C] border border-[#4E4E66] p-2 flex items-center gap-2">
              <Flame size={16} className="text-[#FF8A28]" />
              <div className="flex flex-col">
                <span className="text-[9px] text-[#8686A2]">POWER (PET XP)</span>
                <span className="text-xs font-bold text-[#FF8A28]">
                  +{formatNumber(selectedCard.power)} XP
                </span>
              </div>
            </div>

            <div className="bg-[#08080C] border border-[#4E4E66] p-2 flex items-center gap-2">
              <Shield size={16} className="text-[#6ADC3E]" />
              <div className="flex flex-col">
                <span className="text-[9px] text-[#8686A2]">VIGOR (PASSIVE)</span>
                <span className="text-xs font-bold text-[#6ADC3E]">
                  +{formatPercent(selectedCard.vigor * 0.002, 2)}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              absorbCard(selectedCard.id);
              setSelectedCard(null);
            }}
            disabled={!activePetId}
            className={`w-full py-1.5 text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
              activePetId
                ? 'bg-[#B01228] border-[#FF3A46] text-[#F6F6FC] hover:bg-[#FF3A46]'
                : 'bg-[#2C2C3C] border-[#4E4E66] text-[#8686A2] cursor-not-allowed opacity-50'
            }`}
          >
            <Sparkles size={14} /> ABSORB INTO {activePetDef?.stageNames[0].toUpperCase() || 'COMPANION'}
          </button>
        </div>
      )}

      {/* Cards Grid */}
      {cards.length === 0 ? (
        <div className="bg-[#171722] border border-[#4E4E66] p-6 text-center text-xs text-[#8686A2] flex flex-col items-center gap-2">
          <HelpCircle size={24} className="text-[#4E4E66]" />
          <span>No trophy cards collected yet. Defeat Boss Gates to earn rare boss trophy cards!</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {cards.map((card) => {
            const rarityDef = CARD_RARITIES.find((r) => r.id === card.rarity);
            const isSelected = selectedCard?.id === card.id;

            return (
              <div
                key={card.id}
                onClick={() => setSelectedCard(card)}
                className={`bg-[#171722] border p-2 flex flex-col justify-between cursor-pointer transition-all hover:scale-102 ${
                  isSelected ? 'ring-2 ring-[#F6F6FC]' : ''
                }`}
                style={{ borderColor: rarityDef?.tierColor || '#4E4E66' }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[9px] font-bold px-1 py-0.2"
                    style={{
                      backgroundColor: rarityDef?.tierColor || '#C8C8DA',
                      color: '#08080C',
                    }}
                  >
                    {card.rarity.toUpperCase()}
                  </span>
                  <span className="text-[9px] text-[#8686A2]">Lv.{card.level}</span>
                </div>

                <div className="my-1.5">
                  <span className="text-xs font-bold text-[#F6F6FC] block truncate">
                    {card.bossName}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] bg-[#08080C] p-1 border border-[#4E4E66]">
                  <span className="text-[#FF8A28] font-bold">+{card.power} XP</span>
                  <span className="text-[#6ADC3E] font-bold">+{card.vigor} VIG</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
