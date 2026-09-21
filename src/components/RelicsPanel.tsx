import React from 'react';
import { useGame } from '../context/GameContext';
import { RELICS } from '../data/definitions';
import { Check, Lock, Zap } from 'lucide-react';

export const RelicsPanel: React.FC = () => {
  const {
    relicsAwakened,
    ownedRelics,
    activeRelicId,
    setActiveRelic,
  } = useGame();

  return (
    <div className="flex-1 flex flex-col p-2.5 overflow-y-auto bg-[#171D35] gap-2 select-none ">
      {/* Header Info */}
      <div className="bg-[#101426] border border-[#36D9FF]/40 p-2 rounded-none flex items-center justify-between hud-corner">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#36D9FF]/10 border border-[#36D9FF] flex items-center justify-center">
            <Zap size={13} className="text-[#36D9FF]" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase tracking-wider">
              SYS://RELIC_ARRAY [{ownedRelics.length}/{RELICS.length}]
            </span>
            <span className="text-[9px] font-tech text-[#8993B2]">
              ENGAGE QUANTUM SIGILS TO MODIFY TACTICAL ATTRIBUTES
            </span>
          </div>
        </div>

        {!relicsAwakened && (
          <div className="text-[8px] font-mono-code font-bold text-[#36D9FF] bg-[#171D35] border border-[#36D9FF] px-1.5 py-0.5 rounded-none flex items-center gap-1">
            <Lock size={9} /> UNLOCKS AT FLOOR 51
          </div>
        )}
      </div>

      {/* Relics List */}
      <div className="flex flex-col gap-2">
        {RELICS.map((relic) => {
          const isOwned = ownedRelics.some((r) => r.id === relic.id);
          const isActive = activeRelicId === relic.id;

          return (
            <div
              key={relic.id}
              className={`p-2.5 border transition-all flex items-center justify-between gap-3 rounded-none ${
                isActive
                  ? 'bg-[#101426] border-[#36D9FF] shadow-[inset_0_0_8px_rgba(155,81,111,0.15)]'
                  : isOwned
                  ? 'bg-[#101426] border-white/15 hover:border-white/30'
                  : 'bg-[#040406] border-white/10 opacity-40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-12 h-12 bg-[#171D35] border border-white/20 flex items-center justify-center p-1.5 shrink-0">
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
                    <Lock size={16} className="text-[#8993B2]" />
                  )}
                </div>

                <div className="flex flex-col">
                  <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase">
                    {isOwned ? relic.displayName : 'UNKNOWN SIGIL'}
                  </span>
                  <span className="text-[10px] text-[#36D9FF] font-mono-code font-bold mt-0.5">
                    {relic.effectDescription}
                  </span>
                  <span className="text-[9px] text-[#8993B2] font-tech italic mt-0.5">
                    "{relic.flavor}"
                  </span>
                </div>
              </div>

              <div className="shrink-0">
                {isOwned ? (
                  isActive ? (
                    <div className="px-2.5 py-1 bg-[#36D9FF] text-[#171D35] text-[10px] font-display font-bold rounded-none flex items-center gap-1">
                      <Check size={11} /> ACTIVE
                    </div>
                  ) : (
                    <button
                      onClick={() => setActiveRelic(relic.id)}
                      className="px-2.5 py-1 hud-btn text-[10px] font-display font-bold"
                    >
                      ENGAGE
                    </button>
                  )
                ) : (
                  <span className="text-[9px] text-[#8993B2] font-tech">
                    RUINS BOSS DROP
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
