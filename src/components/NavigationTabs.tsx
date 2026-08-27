import React from 'react';
import { useGame } from '../context/GameContext';
import {
  Swords,
  Shield,
  Layers,
  Flame,
  Sparkles,
  Moon,
  Gamepad2,
  BookOpen,
  ShoppingBag,
} from 'lucide-react';

export type TabType =
  | 'UPGRADES'
  | 'GEAR'
  | 'CARDS'
  | 'PETS'
  | 'RELICS'
  | 'ECLIPSE'
  | 'ARCADE'
  | 'JOURNAL'
  | 'SHOP';

interface NavigationTabsProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const { unseenItemCount, tokens, completedQuests, claimedQuests } = useGame();

  const claimableQuestsCount = completedQuests.filter(
    (qId) => !claimedQuests.includes(qId)
  ).length;

  const tabs: { id: TabType; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'UPGRADES', label: 'FORGE', icon: <Swords size={16} /> },
    { id: 'GEAR', label: 'GEAR', icon: <Shield size={16} />, badge: unseenItemCount },
    { id: 'CARDS', label: 'CARDS', icon: <Layers size={16} /> },
    { id: 'PETS', label: 'PETS', icon: <Flame size={16} /> },
    { id: 'RELICS', label: 'RELICS', icon: <Sparkles size={16} /> },
    { id: 'ECLIPSE', label: 'ECLIPSE', icon: <Moon size={16} /> },
    { id: 'ARCADE', label: 'ARCADE', icon: <Gamepad2 size={16} />, badge: tokens > 0 ? tokens : undefined },
    { id: 'JOURNAL', label: 'JOURNAL', icon: <BookOpen size={16} />, badge: claimableQuestsCount > 0 ? claimableQuestsCount : undefined },
    { id: 'SHOP', label: 'SHOP', icon: <ShoppingBag size={16} /> },
  ];

  return (
    <nav className="w-full bg-[#171722] border-t border-[#4E4E66] px-1 py-1 shrink-0 z-30">
      <div className="grid grid-cols-9 gap-0.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`relative py-1.5 flex flex-col items-center justify-center transition-all ${
                isActive
                  ? 'bg-[#B01228] text-[#F6F6FC] font-bold shadow-inner'
                  : 'text-[#8686A2] hover:text-[#F6F6FC] hover:bg-[#2C2C3C]'
              }`}
            >
              {tab.icon}
              <span className="text-[8px] tracking-tighter mt-0.5 uppercase truncate max-w-full">
                {tab.label}
              </span>

              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[12px] h-3 bg-[#FFD23C] text-[#08080C] text-[8px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
