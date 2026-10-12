import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameProvider } from './context/GameProvider';
import { isTabNew, tabVisitKey } from './game/guide';
import type { GameState } from './game/state';
import { useDispatch, useGameState } from './hooks/useGame';
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
import { JournalPanel, preferCodexSection } from './components/JournalPanel';
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
import { GuideBar } from './components/GuideBar';
import { Ticker } from './components/Ticker';

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
  /** Bumped to remount the open tab, so a link into it lands where it points even when it is already open. */
  const [deckKey, setDeckKey] = useState(0);
  const openShop = useCallback(() => {
    setNoAdsOpen(false);
    setActiveTab('SHOP');
  }, []);
  // The goal strip opens CODEX on its CHAIN page, even when CODEX is already open on another page.
  const openGoal = useCallback(() => {
    preferCodexSection('CHAIN');
    setActiveTab('JOURNAL');
    setDeckKey((k) => k + 1);
  }, []);

  // Android back: from any other tab, back returns home; from home it minimizes the app.
  useBackHandler(activeTab !== HOME_TAB, () => setActiveTab(HOME_TAB));

  // Looking at a tab clears its NEW marker. A visit before the tab matters marks nothing, so a tab
  // opened early still wears NEW when it unlocks.
  const dispatch = useDispatch();
  const activeTabNew = useGameState(useCallback((s: GameState) => isTabNew(s, activeTab), [activeTab]));
  useEffect(() => {
    if (activeTabNew) dispatch({ type: 'MARK_TUTORIAL_SEEN', id: tabVisitKey(activeTab) });
  }, [activeTabNew, activeTab, dispatch]);

  // While a minigame covers the screen, nothing underneath can be focused or clicked, so keyboard
  // focus can never wander into the nav and switch tabs out from under a running game.
  const arcadeOpen = useArcadeOverlayOpen();
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (shellRef.current) shellRef.current.inert = arcadeOpen;
  }, [arcadeOpen]);

  const ActivePanel = TABS[activeTab];

  return (
    // The native frame: fixed to the screen, never scrolling, inside the cutout and gesture-bar insets.
    <div ref={shellRef} className="fixed inset-0 overflow-hidden select-none bg-abyss text-ink flex justify-center font-tech safe-top safe-bottom safe-x">
      <div className="relative w-full max-w-md h-full flex flex-col bg-void sm:border-x-2 sm:border-line">
        {/* Three fixed zones: the arena (45%), the data ticker (5%) and the tab deck (50%). */}
        <div className="flex-1 min-h-0 grid grid-cols-1 grid-rows-[minmax(0,45fr)_minmax(36px,5fr)_minmax(0,50fr)]">
          <section aria-label="Arena" className="min-h-0 flex flex-col">
            <Header onOpenSettings={() => setSettingsOpen(true)} onOpenNoAds={() => setNoAdsOpen(true)} />
            <CombatArena />
          </section>
          <Ticker />
          {/* Only the active tab's body scrolls; containment keeps its redraws inside the deck. */}
          <section aria-label="Tabs" className="min-h-0 flex flex-col bg-void [contain:layout_paint]">
            <GuideBar tab={activeTab} onOpenGoal={openGoal} />
            <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <ActivePanel key={`${activeTab}:${deckKey}`} />
            </main>
            <NavigationTabs activeTab={activeTab} onSelectTab={setActiveTab} />
          </section>
        </div>
        <BannerSlot />

        <ToastHost />
        {/* Player-opened dialogs first, game-triggered ones after: a dialog the game opens later
            then draws on top AND is the one the Android back button closes. */}
        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
        <NoAdsModal isOpen={noAdsOpen} onClose={() => setNoAdsOpen(false)} onOpenShop={openShop} />
        <OfflineRewardsModal />
        <WorldUnlockModal />
        <OnboardingManager onOpenTab={setActiveTab} paused={settingsOpen || noAdsOpen} />
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
