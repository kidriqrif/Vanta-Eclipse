import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameProvider } from './context/GameProvider';
import { useBackHandler } from './hooks/useBackHandler';
import { useArcadeOverlayOpen } from './hooks/useArcadeOverlay';
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
import { NavigationTabs, type TabType } from './components/NavigationTabs';
import { BannerSlot } from './components/BannerSlot';
import { SettingsModal } from './components/SettingsModal';
import { NoAdsModal } from './components/NoAdsModal';
import { OfflineRewardsModal } from './components/OfflineRewardsModal';
import { WorldUnlockModal } from './components/WorldUnlockModal';
import { OnboardingManager } from './components/OnboardingManager';
import { ToastHost } from './components/ToastHost';
import { EclipseOverlay } from './components/EclipseOverlay';

const HOME_TAB: TabType = 'UPGRADES';

const TABS: Record<TabType, React.FC> = {
  UPGRADES: UpgradeShop,
  GEAR: GearPanel,
  JOURNAL: JournalPanel,
  CARDS: CardsCollection,
  PETS: PetsPanel,
  RELICS: RelicsPanel,
  ECLIPSE: EclipsePanel,
  ARCADE: ArcadeHub,
  SHOP: ShopPanel,
};

const GameShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>(HOME_TAB);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [noAdsOpen, setNoAdsOpen] = useState(false);
  const openShop = useCallback(() => {
    setNoAdsOpen(false);
    setActiveTab('SHOP');
  }, []);

  // Android back: from any other tab, back returns home; from home it minimizes the app.
  useBackHandler(activeTab !== HOME_TAB, () => setActiveTab(HOME_TAB));

  // While a minigame covers the screen, nothing underneath can be focused or clicked, so keyboard
  // focus can never wander into the nav and switch tabs out from under a running game.
  const arcadeOpen = useArcadeOverlayOpen();
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (shellRef.current) shellRef.current.inert = arcadeOpen;
  }, [arcadeOpen]);

  const ActivePanel = TABS[activeTab];

  return (
    <div ref={shellRef} className="w-full h-[100dvh] bg-abyss text-ink flex justify-center overflow-hidden font-mono-code select-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="relative w-full max-w-md h-full flex flex-col bg-void bg-grid-pattern sm:border-x sm:border-line">
        <Header onOpenSettings={() => setSettingsOpen(true)} onOpenNoAds={() => setNoAdsOpen(true)} />
        <CombatArena />
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <ActivePanel key={activeTab} />
        </main>
        <NavigationTabs activeTab={activeTab} onSelectTab={setActiveTab} />
        <BannerSlot />

        <ToastHost />
        {/* Player-opened dialogs first, game-triggered ones after: a dialog the game opens later
            then draws on top AND is the one the Android back button closes. */}
        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
        <NoAdsModal isOpen={noAdsOpen} onClose={() => setNoAdsOpen(false)} onOpenShop={openShop} />
        <OfflineRewardsModal />
        <WorldUnlockModal />
        <OnboardingManager />
        <EclipseOverlay />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <GameProvider>
      <GameShell />
    </GameProvider>
  );
}
