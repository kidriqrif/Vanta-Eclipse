import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { QUESTS, DAILY_ALL_CLEAR_REWARDS } from '../data/definitions';
import { QuestDefinition } from '../types/game';
import { formatNumber } from '../utils/numberFormat';
import {
  BookOpen,
  Trophy,
  CheckCircle,
  Calendar,
  Gift,
  Zap,
  Lock,
} from 'lucide-react';
import { PlayGamesAchievementsModal } from './PlayGamesAchievementsModal';

export const JournalPanel: React.FC = () => {
  const {
    questCounters,
    dailyQuestCounters,
    claimedQuests,
    dailyClaimedQuests,
    dailyAllClearClaimed,
    claimQuestReward,
    claimDailyAllClearReward,
    activeDailyIds,
  } = useGame();

  const [activeTab, setActiveTab] = useState<'DAILY' | 'CHAIN' | 'ACHIEVEMENTS'>('DAILY');
  const [showPlayGamesModal, setShowPlayGamesModal] = useState<boolean>(false);

  // Daily calculations
  const dailyQuests = QUESTS.filter(
    (q) => q.kind === 'DAILY' && activeDailyIds.includes(q.id)
  );
  const dailyCompletedCount = dailyQuests.filter((q) =>
    dailyClaimedQuests.includes(q.id)
  ).length;
  const isDailyAllClearReady =
    dailyQuests.length > 0 &&
    dailyCompletedCount === dailyQuests.length &&
    !dailyAllClearClaimed;

  const chainQuests = QUESTS.filter((q) => q.kind === 'CHAIN');
  const achievementQuests = QUESTS.filter((q) => q.kind === 'ACHIEVEMENT');

  const renderQuestItem = (quest: QuestDefinition) => {
    const isDaily = quest.kind === 'DAILY';
    const isClaimed = isDaily
      ? dailyClaimedQuests.includes(quest.id)
      : claimedQuests.includes(quest.id);

    const currentVal = isDaily
      ? dailyQuestCounters[quest.metric] || 0
      : questCounters[quest.metric] || 0;

    const progress = Math.min(quest.targetValue, currentVal);
    const percent = Math.min(100, (progress / quest.targetValue) * 100);
    const isReadyToClaim = !isClaimed && progress >= quest.targetValue;

    const isLocked = quest.prereqId && !claimedQuests.includes(quest.prereqId);

    return (
      <div
        key={quest.id}
        className={`p-2.5 border transition-all flex items-center justify-between gap-3 rounded-none ${
          isClaimed
            ? 'bg-[#040406] border-white/10 opacity-50'
            : isReadyToClaim
            ? 'bg-[#101426] border-[#36D9FF] shadow-[inset_0_0_8px_rgba(57,255,20,0.15)]'
            : isLocked
            ? 'bg-[#040406] border-white/10 opacity-30'
            : 'bg-[#101426] border-white/15 hover:border-[#36D9FF]/50'
        }`}
      >
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase tracking-wide truncate">
              {quest.displayName}
            </span>
            {quest.category && (
              <span className="text-[8px] font-mono-code bg-[#171D35] border border-white/20 text-[#8993B2] px-1 rounded-none uppercase">
                {quest.category}
              </span>
            )}
          </div>

          <span className="text-[10px] font-tech text-[#8993B2] truncate mt-0.5">
            {quest.description}
          </span>

          {/* Progress Bar */}
          <div className="flex flex-col gap-0.5 mt-1.5">
            <div className="flex justify-between text-[8px] font-mono-code text-[#8993B2]">
              <span>PROGRESS</span>
              <span>
                {formatNumber(progress)} / {formatNumber(quest.targetValue)} [{percent.toFixed(0)}%]
              </span>
            </div>
            <div className="w-full h-1 bg-[#171D35] border border-white/15 overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  isReadyToClaim || isClaimed
                    ? 'bg-[#36D9FF]'
                    : 'bg-[#36D9FF]'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          {isClaimed ? (
            <div className="px-2.5 py-1 bg-[#171D35] border border-white/15 text-[9px] font-display font-bold text-[#36D9FF] rounded-none flex items-center gap-1">
              <CheckCircle size={10} /> DONE
            </div>
          ) : isLocked ? (
            <div className="px-2.5 py-1 bg-[#171D35] border border-white/10 text-[9px] font-display font-bold text-[#8993B2] rounded-none flex items-center gap-1">
              <Lock size={10} /> LOCKED
            </div>
          ) : (
            <button
              onClick={() => claimQuestReward(quest.id)}
              disabled={!isReadyToClaim}
              className={`px-3 py-1.5 text-xs font-display font-bold transition-all flex items-center gap-1 rounded-none ${
                isReadyToClaim
                  ? 'hud-btn bg-[#36D9FF] text-[#171D35] border-[#36D9FF] animate-pulse'
                  : 'bg-[#101426] border border-white/10 text-[#8993B2] cursor-not-allowed opacity-40'
              }`}
            >
              <span>
                +{formatNumber(quest.rewardAmount)} {quest.rewardKind}
              </span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col p-2.5 overflow-y-auto bg-[#171D35] gap-2 select-none ">
      {/* Top Tactical Header */}
      <div className="bg-[#101426] border border-[#36D9FF]/40 p-2 rounded-none flex items-center justify-between hud-corner">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#36D9FF]/10 border border-[#36D9FF] flex items-center justify-center">
            <BookOpen size={13} className="text-[#36D9FF]" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-display font-bold text-[#FFFFFF] uppercase tracking-wider">
              SYS://BOUNTY_MATRIX
            </span>
            <span className="text-[9px] font-tech text-[#8993B2]">
              OPERATIONAL OBJECTIVES & BOUNTY CLEARANCE
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 bg-[#171D35] border border-white/20 p-0.5 rounded-none">
        <button
          onClick={() => setActiveTab('DAILY')}
          className={`py-1 text-xs font-display font-bold tracking-wider transition-all flex items-center justify-center gap-1 rounded-none ${
            activeTab === 'DAILY'
              ? 'bg-[#36D9FF] text-[#171D35]'
              : 'text-[#8993B2] hover:text-[#FFFFFF]'
          }`}
        >
          <Calendar size={12} />
          <span>DAILY [{dailyCompletedCount}/{dailyQuests.length}]</span>
        </button>

        <button
          onClick={() => setActiveTab('CHAIN')}
          className={`py-1 text-xs font-display font-bold tracking-wider transition-all flex items-center justify-center gap-1 rounded-none ${
            activeTab === 'CHAIN'
              ? 'bg-[#36D9FF] text-[#171D35]'
              : 'text-[#8993B2] hover:text-[#FFFFFF]'
          }`}
        >
          <Zap size={12} />
          <span>CHRONICLES</span>
        </button>

        <button
          onClick={() => setActiveTab('ACHIEVEMENTS')}
          className={`py-1 text-xs font-display font-bold tracking-wider transition-all flex items-center justify-center gap-1 rounded-none ${
            activeTab === 'ACHIEVEMENTS'
              ? 'bg-[#36D9FF] text-[#171D35]'
              : 'text-[#8993B2] hover:text-[#FFFFFF]'
          }`}
        >
          <Trophy size={12} />
          <span>FEATS</span>
        </button>
      </div>

      {/* Daily Grand Clearance Banner */}
      {activeTab === 'DAILY' && (
        <div className="bg-[#101426] border border-[#FFC857]/40 p-2.5 rounded-none flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#FFC857]/10 border border-[#FFC857] flex items-center justify-center">
              <Gift size={15} className="text-[#FFC857]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-display font-bold text-[#FFC857] uppercase">
                DAILY ALL-CLEAR GRAND BOUNTY
              </span>
              <span className="text-[9px] font-mono-code text-[#8993B2]">
                +{DAILY_ALL_CLEAR_REWARDS.crystals} Crystals, +{DAILY_ALL_CLEAR_REWARDS.shards} Shards, +{DAILY_ALL_CLEAR_REWARDS.tokens} Tokens
              </span>
            </div>
          </div>

          <div>
            {dailyAllClearClaimed ? (
              <div className="px-3 py-1 bg-[#171D35] border border-white/20 text-[9px] font-display font-bold text-[#36D9FF] rounded-none flex items-center gap-1">
                <CheckCircle size={10} /> CLAIMED
              </div>
            ) : (
              <button
                onClick={() => claimDailyAllClearReward()}
                disabled={!isDailyAllClearReady}
                className={`px-3 py-1 text-xs hud-btn-gold ${
                  isDailyAllClearReady ? 'animate-pulse' : 'opacity-40 cursor-not-allowed'
                }`}
              >
                CLAIM ALL-CLEAR
              </button>
            )}
          </div>
        </div>
      )}

      {/* Google Play Games Feats Banner */}
      {activeTab === 'ACHIEVEMENTS' && (
        <div className="bg-[#101426] border border-[#36D9FF]/40 p-2.5 rounded-none flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#36D9FF]/10 border border-[#36D9FF] flex items-center justify-center shadow-[0_0_8px_rgba(57,255,20,0.15)]">
              <Trophy size={16} className="text-[#36D9FF]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-display font-bold text-[#FFFFFF] uppercase">
                GOOGLE PLAY GAMES MATRIX
              </span>
              <span className="text-[9px] font-mono-code text-[#8993B2]">
                Official Play Games XP & Cloud Sync
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowPlayGamesModal(true)}
            className="px-2.5 py-1 text-xs bg-[#171D35] hover:bg-[#36D9FF] hover:text-[#171D35] border border-[#36D9FF] text-[#36D9FF] font-display font-bold transition-all cursor-pointer flex items-center gap-1 shadow-[0_0_8px_rgba(155,81,111,0.2)]"
          >
            <Trophy size={11} /> OPEN
          </button>
        </div>
      )}

      {/* Quests List */}
      <div className="flex flex-col gap-1.5">
        {activeTab === 'DAILY' && dailyQuests.map(renderQuestItem)}
        {activeTab === 'CHAIN' && chainQuests.map(renderQuestItem)}
        {activeTab === 'ACHIEVEMENTS' && achievementQuests.map(renderQuestItem)}
      </div>

      {/* Google Play Games Achievements Modal */}
      {showPlayGamesModal && (
        <PlayGamesAchievementsModal onClose={() => setShowPlayGamesModal(false)} />
      )}
    </div>
  );
};
