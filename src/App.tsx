import React, { useState } from 'react';
import { GameProvider } from './context/GameContext';
import { Header } from './components/Header';
import { CombatArena } from './components/CombatArena';
import { UpgradeShop } from './components/UpgradeShop';
import { GearPanel } from './components/GearPanel';
import { CardsCollection } from './components/CardsCollection';
import { PetsPanel } from './components/PetsPanel';
import { RelicsPanel } from './components/RelicsPanel';
import { EclipsePanel } from './components/EclipsePanel';
import { ArcadeHub } from './components/ArcadeHub';
import { JournalPanel } from './components/JournalPanel';
import { ShopPanel } from './components/ShopPanel';
import { NavigationTabs, TabType } from './components/NavigationTabs';
import { SettingsModal } from './components/SettingsModal';
import { OfflineRewardsModal } from './components/OfflineRewardsModal';
import { WorldUnlockModal } from './components/WorldUnlockModal';

const GameApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('UPGRADES');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  return (
    <div className="w-full h-screen bg-[#08080C] text-[#F6F6FC] font-mono flex items-center justify-center overflow-hidden">
      {/* Centered Phone / Tablet Layout Container */}
      <div className="w-full max-w-md h-full flex flex-col bg-[#08080C] border-x border-[#4E4E66] shadow-2xl relative">
        {/* Header HUD */}
        <Header onOpenSettings={() => setIsSettingsOpen(true)} />

        {/* Combat Tap Arena */}
        <CombatArena />

        {/* Dynamic Navigation Tab Panel */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#08080C]">
          {activeTab === 'UPGRADES' && <UpgradeShop />}
          {activeTab === 'GEAR' && <GearPanel />}
          {activeTab === 'CARDS' && <CardsCollection />}
          {activeTab === 'PETS' && <PetsPanel />}
          {activeTab === 'RELICS' && <RelicsPanel />}
          {activeTab === 'ECLIPSE' && <EclipsePanel />}
          {activeTab === 'ARCADE' && <ArcadeHub />}
          {activeTab === 'JOURNAL' && <JournalPanel />}
          {activeTab === 'SHOP' && <ShopPanel />}
        </main>

        {/* Bottom Navigation */}
        <NavigationTabs activeTab={activeTab} onSelectTab={setActiveTab} />

        {/* Overlay Modals */}
        {isSettingsOpen && (
          <SettingsModal onClose={() => setIsSettingsOpen(false)} />
        )}
        <OfflineRewardsModal />
        <WorldUnlockModal />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <GameProvider>
      <GameApp />
    </GameProvider>
  );
}
