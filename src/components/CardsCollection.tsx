import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { CARD_RARITIES, PETS } from '../data/definitions';
import { formatNumber, formatPercent } from '../utils/numberFormat';
import { Layers, Flame, Shield, HelpCircle, Zap } from 'lucide-react';
import { Card } from '../types/game';

export const CardsCollection: React.FC = () => {
  const { cards, absorbCard, activePetId } = useGame();
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  const activePetDef = PETS.find((p) => p.id === activePetId);

  return (
    <div className="flex-1 flex flex-col p-2.5 overflow-y-auto bg-[#171D35] gap-2 select-none ">
      {/* Header Info */}
      <div className="bg-[#101426] border border-[#36D9FF]/40 p-2 rounded-none flex items-center justify-between hud-corner">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#36D9FF]/10 border border-[#36D9FF] flex items-center justify-center">
            <Layers size={13} className="text-[#36D9FF]" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase tracking-wider">
              SYS://HOLO_CARDS [{cards.length}/200]
            </span>
            <span className="text-[9px] font-tech text-[#8993B2]">
              ABSORB MEMORY CORES INTO ACTIVE BEAST
            </span>
          </div>
        </div>

        {activePetDef ? (
          <div className="flex items-center gap-1 bg-[#171D35] border border-[#36D9FF]/40 px-1.5 py-0.5 rounded-none">
            <span className="text-[8px] font-tech text-[#8993B2]">TARGET:</span>
            <span className="text-[9px] font-display font-bold text-[#36D9FF]">
              {activePetDef.stageNames[0].toUpperCase()}
            </span>
          </div>
        ) : (
          <div className="text-[8px] font-display font-bold text-[#FF4268] bg-[#171D35] border border-[#FF4268] px-1.5 py-0.5 rounded-none">
            NO ACTIVE BEAST
          </div>
        )}
      </div>

      {/* Selected Card Inspector */}
      {selectedCard && (
        <div className="bg-[#101426] border border-[#36D9FF] p-2.5 rounded-none flex flex-col gap-2 shadow-[0_0_12px_rgba(155,81,111,0.2)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="text-[8px] font-mono-code font-bold px-1 py-0.2 rounded-none"
                style={{
                  backgroundColor:
                    CARD_RARITIES.find((r) => r.id === selectedCard.rarity)?.tierColor ||
                    '#36D9FF',
                  color: '#171D35',
                }}
              >
                {selectedCard.rarity.toUpperCase()}
              </span>
              <span className="text-xs font-display font-bold text-[#FFFFFF]">
                {selectedCard.bossName} [LEVEL {selectedCard.level}]
              </span>
            </div>
            <button
              onClick={() => setSelectedCard(null)}
              className="text-xs font-mono-code text-[#8993B2] hover:text-[#FFFFFF] px-1"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-[#171D35] border border-white/15 p-1.5 rounded-none flex items-center gap-2">
              <Flame size={13} className="text-[#FFC857]" />
              <div className="flex flex-col">
                <span className="text-[8px] text-[#8993B2] font-tech">COMPANION EXPERIENCE</span>
                <span className="text-xs font-mono-code font-bold text-[#FFC857]">
                  +{formatNumber(selectedCard.power)} EXP
                </span>
              </div>
            </div>

            <div className="bg-[#171D35] border border-white/15 p-1.5 rounded-none flex items-center gap-2">
              <Shield size={13} className="text-[#36D9FF]" />
              <div className="flex flex-col">
                <span className="text-[8px] text-[#8993B2] font-tech">VIGOR RESONANCE</span>
                <span className="text-xs font-mono-code font-bold text-[#36D9FF]">
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
            className={`w-full py-1 text-xs hud-btn flex items-center justify-center gap-1 ${
              activePetId ? 'border-[#36D9FF]' : ''
            }`}
          >
            <Zap size={12} />
            <span>ABSORB MEMORY INTO {activePetDef?.stageNames[0].toUpperCase() || 'BEAST'}</span>
          </button>
        </div>
      )}

      {/* Cards Grid */}
      {cards.length === 0 ? (
        <div className="bg-[#101426] border border-white/15 p-6 rounded-none text-center text-xs text-[#8993B2] flex flex-col items-center gap-2">
          <HelpCircle size={20} className="text-[#8993B2]/40" />
          <span className="font-tech uppercase">NO HOLOGRAPHIC TROPHIES RECORDED. VANQUISH BOSS GATES.</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {cards.map((card, idx) => {
            const rarityDef = CARD_RARITIES.find((r) => r.id === card.rarity);
            const isSelected = selectedCard?.id === card.id;

            return (
              <div
                key={`holo_card_${card.id}_${idx}`}
                onClick={() => setSelectedCard(card)}
                className={`bg-[#101426] border p-2 rounded-none flex flex-col justify-between cursor-pointer transition-all ${
                  isSelected ? 'border-white bg-[#473263]' : 'hover:border-[#36D9FF]'
                }`}
                style={{ borderColor: isSelected ? '#FFFFFF' : rarityDef?.tierColor || 'rgba(155, 81, 111, 0.3)' }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[7px] font-mono-code font-bold px-1 rounded-none"
                    style={{
                      backgroundColor: rarityDef?.tierColor || '#36D9FF',
                      color: '#171D35',
                    }}
                  >
                    {card.rarity.toUpperCase()}
                  </span>
                  <span className="text-[8px] font-mono-code text-[#8993B2]">LEVEL {card.level}</span>
                </div>

                <div className="my-1">
                  <span className="text-[11px] font-display font-bold text-[#FFFFFF] block truncate">
                    {card.bossName}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[8px] font-mono-code bg-[#171D35] p-1 border border-white/10">
                  <span className="text-[#FFC857] font-bold">+{card.power} EXP</span>
                  <span className="text-[#36D9FF] font-bold">+{card.vigor} VIGOR</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
