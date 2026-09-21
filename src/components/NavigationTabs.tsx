import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { QUESTS } from '../data/definitions';
import {
  Sword,
  Shield,
  Layers,
  ShoppingBag,
  Moon,
  Gamepad2,
  BookOpen,
  Cpu,
  Zap,
  MoreHorizontal
} from 'lucide-react';

export type TabType =
  | 'UPGRADES'
  | 'GEAR'
  | 'JOURNAL'
  | 'CARDS'
  | 'PETS'
  | 'RELICS'
  | 'ECLIPSE'
  | 'ARCADE'
  | 'SHOP';

interface NavigationTabsProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const {
    unseenItemCount,
    tokens,
    relicsAwakened,
    cards,
    activeDailyIds,
    dailyClaimedQuests,
    dailyAllClearClaimed,
    claimedQuests,
    questCounters,
    dailyQuestCounters,
  } = useGame();
  const [showMore, setShowMore] = useState(false);

  // Check unclaimed rewards in Journal
  const hasUnclaimedQuests = QUESTS.some((q) => {
    if (q.kind === 'DAILY') {
      if (!activeDailyIds.includes(q.id)) return false;
      if (dailyClaimedQuests.includes(q.id)) return false;
      const progress = dailyQuestCounters[q.metric] || 0;
      return progress >= q.targetValue;
    } else {
      if (claimedQuests.includes(q.id)) return false;
      const progress = questCounters[q.metric] || 0;
      return progress >= q.targetValue;
    }
  }) || (!dailyAllClearClaimed && activeDailyIds.length > 0 && activeDailyIds.every((id) => dailyClaimedQuests.includes(id)));

  const allTabs: {
    id: TabType;
    label: string;
    icon: React.ReactNode;
    badge?: number | string | boolean;
    badgeColor?: string;
  }[] = [
    { id: 'UPGRADES', label: 'FORGE', icon: <Zap size={16} /> },
    {
      id: 'GEAR',
      label: 'ARMOR',
      icon: <Shield size={16} />,
      badge: unseenItemCount > 0 ? unseenItemCount : undefined,
      badgeColor: '#36D9FF',
    },
    {
      id: 'RELICS',
      label: 'RELICS',
      icon: <Sword size={16} />,
      badge: !relicsAwakened ? undefined : undefined,
    },
    { id: 'SHOP', label: 'BAZAAR', icon: <ShoppingBag size={16} /> },
    {
      id: 'JOURNAL',
      label: 'CODEX',
      icon: <BookOpen size={16} />,
      badge: hasUnclaimedQuests ? '!' : undefined,
      badgeColor: '#FFC857',
    },
    {
      id: 'CARDS',
      label: 'CARDS',
      icon: <Layers size={16} />,
      badge: cards.length > 0 ? cards.length : undefined,
      badgeColor: '#36D9FF',
    },
    { id: 'PETS', label: 'BEAST', icon: <Cpu size={16} /> },
    { id: 'ECLIPSE', label: 'ECLIPSE', icon: <Moon size={16} /> },
    {
      id: 'ARCADE',
      label: 'ARCADE',
      icon: <Gamepad2 size={16} />,
      badge: tokens > 0 ? tokens : undefined,
      badgeColor: '#FFC857',
    },
  ];

  const primaryTabs = allTabs.slice(0, 4);
  const secondaryTabs = allTabs.slice(4);

  const isSecondaryActive = secondaryTabs.some(t => t.id === activeTab);
  const hasSecondaryBadge = secondaryTabs.some(t => t.badge !== undefined && t.badge !== false && t.badge !== 0);

  return (
    <div className="relative">
      {/* Main Bottom Nav */}
      <nav className="w-full bg-[#080A12] border-t border-[#30395C] px-0 flex items-center overflow-x-auto overflow-y-hidden shrink-0 select-none no-scrollbar">
        {allTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`min-w-[72px] flex-1 py-3 px-1 flex flex-col items-center justify-center gap-1.5 relative transition-colors rounded-none border-t-[3px] ${
                isActive
                  ? 'text-[#36D9FF] bg-[#101426] border-t-[#36D9FF] font-bold shadow-[inset_0_10px_15px_-10px_rgba(54,217,255,0.2)]'
                  : 'text-[#8993B2] hover:text-[#E8EDF7] border-t-transparent hover:bg-[#101426]/50'
              }`}
            >
              <div className="relative">
                {tab.icon}
                {tab.badge !== undefined && (
                  <span
                    className="absolute -top-1.5 -right-3 min-w-[12px] h-[12px] px-0.5 text-[8px] font-mono-code font-black rounded-full text-[#080A12] flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: tab.badgeColor || '#36D9FF' }}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-display uppercase tracking-wider leading-none">
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
