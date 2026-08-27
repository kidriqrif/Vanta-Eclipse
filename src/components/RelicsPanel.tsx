import React from 'react';
import { useGame } from '../context/GameContext';
import { RELICS } from '../data/definitions';
import { Shield, Check, Lock } from 'lucide-react';

export const RelicsPanel: React.FC = () => {
  const {
    relicsAwakened,
    ownedRelics,
    activeRelicId,
    setActiveRelic,
  } = useGame();

  return (
    <div className="flex-1 flex flex-col p-3 overflow-y-auto bg-[#08080C] gap-3">
      {/* Header Info */}
      <div className="bg-[#171722] border border-[#4E4E66] p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-[#3EDCFA]" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#F6F6FC]">
              SACRED RELICS ({ownedRelics.length}/{RELICS.length})
            </span>
            <span className="text-[10px] text-[#8686A2]">
              Equip one powerful relic to augment your playstyle
            </span>
          </div>
        </div>

        {!relicsAwakened && (
          <div className="text-[10px] text-[#3EDCFA] border border-[#3EDCFA] px-2 py-0.5 flex items-center gap-1">
            <Lock size={10} /> AWAKENS AT LV.51
          </div>
        )}
      </div>

      {/* Relics List */}
      <div className="flex flex-col gap-2.5">
        {RELICS.map((relic) => {
          const isOwned = ownedRelics.some((r) => r.id === relic.id);
          const isActive = activeRelicId === relic.id;

          return (
            <div
              key={relic.id}
              className={`bg-[#171722] border p-3 flex items-center justify-between gap-3 transition-all ${
                isActive
                  ? 'border-[#3EDCFA] ring-1 ring-[#3EDCFA]'
                  : isOwned
                  ? 'border-[#4E4E66]'
                  : 'border-[#4E4E66] opacity-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#08080C] border border-[#4E4E66] flex items-center justify-center p-1.5 shrink-0">
                  {isOwned ? (
                    <img
                      src={relic.sigil}
                      alt={relic.displayName}
                      className="w-full h-full object-contain pixelated"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Lock size={18} className="text-[#4E4E66]" />
                  )}
                </div>

                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[#F6F6FC]">
                    {isOwned ? relic.displayName : 'Unknown Relic'}
                  </span>
                  <span className="text-[11px] text-[#3EDCFA] font-mono mt-0.5">
                    {relic.effectDescription}
                  </span>
                  <span className="text-[10px] text-[#8686A2] italic mt-0.5">
                    "{relic.flavor}"
                  </span>
                </div>
              </div>

              <div className="shrink-0">
                {isOwned ? (
                  isActive ? (
                    <div className="px-3 py-1.5 bg-[#3EDCFA] text-[#08080C] text-xs font-bold flex items-center gap-1">
                      <Check size={14} /> ACTIVE
                    </div>
                  ) : (
                    <button
                      onClick={() => setActiveRelic(relic.id)}
                      className="px-3 py-1.5 bg-[#2C2C3C] border border-[#4E4E66] text-xs font-bold text-[#F6F6FC] hover:bg-[#B01228] hover:border-[#FF3A46] transition-colors"
                    >
                      EQUIP
                    </button>
                  )
                ) : (
                  <span className="text-[10px] text-[#8686A2]">
                    Frozen Ruins Boss Drop
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
