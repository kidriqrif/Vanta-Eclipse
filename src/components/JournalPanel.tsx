import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { QUESTS } from '../data/definitions';
import { formatNumber } from '../utils/numberFormat';
import { BookOpen, Check, Gift } from 'lucide-react';

export const JournalPanel: React.FC = () => {
  const {
    enemyLevel,
    questCounters,
    completedQuests,
    claimedQuests,
    claimQuestReward,
    ownedRelics,
    ownedPets,
    skillLevels,
  } = useGame();

  const [activeTab, setActiveTab] = useState<'CHAIN' | 'DAILY' | 'ACHIEVEMENT'>('CHAIN');

  const filteredQuests = QUESTS.filter((q) => q.kind === activeTab);

  const getMetricValue = (metric: string): number => {
    if (metric === 'enemy_level') return enemyLevel;
    if (metric === 'relics_owned') return ownedRelics.length;
    if (metric === 'pets_owned') return Object.keys(ownedPets).length;
    if (metric === 'skills_bought') {
      return Object.values(skillLevels).reduce((a, b) => a + b, 0);
    }
    return questCounters[metric] || 0;
  };

  const getRewardLabel = (kind: string, amount: number) => {
    switch (kind) {
      case 'ESSENCE': return `+${formatNumber(amount)} ESSENCE`;
      case 'TOKENS': return `+${amount} TOKENS`;
      case 'CRYSTALS': return `+${amount} CRYSTALS`;
      case 'SHARDS': return `+${amount} SHARDS`;
      default: return `+${amount}`;
    }
  };

  return (
    <div className="flex-1 flex flex-col p-3 overflow-y-auto bg-[#08080C] gap-3">
      {/* Header Info */}
      <div className="bg-[#171722] border border-[#4E4E66] p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-[#FF8A28]" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#F6F6FC]">CHRONICLES & QUESTS</span>
            <span className="text-[10px] text-[#8686A2]">
              Complete objectives to earn bonus resources
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1 bg-[#171722] p-1 border border-[#4E4E66] shrink-0">
        {(['CHAIN', 'DAILY', 'ACHIEVEMENT'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-1 text-xs font-bold transition-colors ${
              activeTab === tab
                ? 'bg-[#B01228] text-[#F6F6FC]'
                : 'text-[#8686A2] hover:text-[#F6F6FC]'
            }`}
          >
            {tab === 'CHAIN' ? 'MILESTONES' : tab === 'DAILY' ? 'DAILIES' : 'ACHIEVEMENTS'}
          </button>
        ))}
      </div>

      {/* Quests List */}
      <div className="flex flex-col gap-2">
        {filteredQuests.map((quest) => {
          const curVal = getMetricValue(quest.metric);
          const isCompleted = completedQuests.includes(quest.id) || curVal >= quest.targetValue;
          const isClaimed = claimedQuests.includes(quest.id);
          const progressPct = Math.min(100, (curVal / quest.targetValue) * 100);

          return (
            <div
              key={quest.id}
              className={`bg-[#171722] border p-2.5 flex items-center justify-between gap-3 ${
                isClaimed
                  ? 'border-[#4E4E66] opacity-60'
                  : isCompleted
                  ? 'border-[#6ADC3E]'
                  : 'border-[#4E4E66]'
              }`}
            >
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F6F6FC] truncate">
                    {quest.displayName}
                  </span>
                  <span className="text-[10px] text-[#8686A2] font-mono">
                    {formatNumber(curVal)} / {formatNumber(quest.targetValue)}
                  </span>
                </div>

                <span className="text-[11px] text-[#C8C8DA] mt-0.5">
                  {quest.description}
                </span>

                {/* Progress bar */}
                <div className="w-full h-1 bg-[#08080C] border border-[#4E4E66] mt-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      isCompleted ? 'bg-[#6ADC3E]' : 'bg-[#FF8A28]'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Action */}
              <div className="shrink-0">
                {isClaimed ? (
                  <div className="px-2.5 py-1 bg-[#2C2C3C] text-[10px] font-bold text-[#8686A2] flex items-center gap-1">
                    <Check size={12} /> CLAIMED
                  </div>
                ) : isCompleted ? (
                  <button
                    onClick={() => claimQuestReward(quest.id)}
                    className="px-3 py-1.5 bg-[#6ADC3E] text-[#08080C] text-xs font-bold hover:bg-[#F6F6FC] transition-colors flex items-center gap-1 shadow-[0_0_8px_#6ADC3E]"
                  >
                    <Gift size={13} /> CLAIM
                  </button>
                ) : (
                  <div className="px-2 py-1 bg-[#08080C] border border-[#4E4E66] text-[10px] font-bold text-[#FFD23C] text-center">
                    {getRewardLabel(quest.rewardKind, quest.rewardAmount)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
