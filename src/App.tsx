import React, { useState, useEffect } from 'react';
import { AdMob } from '@capacitor-community/admob';
import { GameProvider, useGame } from './context/GameContext';
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
import { AdBanner } from './components/AdBanner';
import { SettingsModal } from './components/SettingsModal';
import { OfflineRewardsModal } from './components/OfflineRewardsModal';
import { WorldUnlockModal } from './components/WorldUnlockModal';
import { OnboardingManager } from './components/OnboardingManager';

const EclipseOverlay: React.FC = () => {
  const { eclipsePhase } = useGame();

  return (
    <div className={`fixed inset-0 z-[100] transition-all ${
      eclipsePhase === 'fading' ? 'bg-black opacity-100 duration-[2500ms]' : 
      eclipsePhase === 'flashing' ? 'bg-[#FFC857] opacity-100 duration-150 mix-blend-screen' : 
      eclipsePhase === 'recovering' ? 'bg-black opacity-0 duration-[1500ms] pointer-events-none' :
      'bg-black opacity-0 duration-0 pointer-events-none'
    }`} />
  );
};

const GameApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('UPGRADES');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  return (
    <div className="w-full h-screen bg-[#040509] text-[#E8EDF7] flex items-center justify-center overflow-hidden font-mono-code select-none pt-[env(safe-area-inset-top,24px)] pb-[env(safe-area-inset-bottom,0px)]">
      {/* Centered Tactical HUD Shell */}
      <div className="w-full max-w-md h-full flex flex-col bg-[#080A12] sm:border-x sm:border-[#30395C] relative shadow-[0_0_50px_rgba(0,0,0,0.95)]">
        <EclipseOverlay />

        {/* Header HUD */}
        <Header onOpenSettings={() => setIsSettingsOpen(true)} />

        {/* Combat Tap Arena */}
        <CombatArena />

        {/* Dynamic Navigation Tab Panel */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#080A12]">
          {activeTab === 'UPGRADES' && <UpgradeShop />}
          {activeTab === 'GEAR' && <GearPanel />}
          {activeTab === 'JOURNAL' && <JournalPanel />}
          {activeTab === 'CARDS' && <CardsCollection />}
          {activeTab === 'PETS' && <PetsPanel />}
          {activeTab === 'RELICS' && <RelicsPanel />}
          {activeTab === 'ECLIPSE' && <EclipsePanel />}
          {activeTab === 'ARCADE' && <ArcadeHub />}
          {activeTab === 'SHOP' && <ShopPanel />}
        </main>

        {/* Bottom Navigation */}
        <NavigationTabs activeTab={activeTab} onSelectTab={setActiveTab} />

        {/* Non-Intrusive Tactical Telemetry Banner */}
        <AdBanner 
          onNavigateToShop={() => setActiveTab('SHOP')} 
          onNavigateToJournal={() => setActiveTab('JOURNAL')} 
        />

        {/* Overlay Modals */}
        {isSettingsOpen && (
          <SettingsModal onClose={() => setIsSettingsOpen(false)} />
        )}
        <OfflineRewardsModal />
        <WorldUnlockModal />
        <OnboardingManager />
      </div>
    </div>
  );
};

export default function App() {
  useEffect(() => {
    const initAds = async () => {
      try {
        await AdMob.initialize({});
        console.log('AdMob initialized successfully');
      } catch (err) {
        console.warn('AdMob initialization failed (expected on web):', err);
      }
    };
    initAds();
  }, []);

  return (
    <GameProvider>
      <GameApp />
    </GameProvider>
  );
}
