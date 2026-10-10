import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import type { FxEvent } from '../game/actions';
import { deserialize, loadGame, localStorageAdapter, SAVE_KEY, BACKUP_KEY, serialize, writeSave } from '../game/save';
import { createInitialState, type GameState } from '../game/state';
import { withFreshEnemy } from '../game/reducer';
import { createGameStore, type GameStore } from '../game/store';
import { ControlsContext, StoreContext, type GameControls } from '../hooks/useGame';
import { runBackHandler } from '../hooks/useBackHandler';
import { audio } from '../services/audio';
import { impact } from '../services/haptics';
import { ads } from '../services/ads';
import { billing } from '../services/billing';
import { syncPurchases } from '../hooks/useMonetization';

const TICK_MS = 100;
const AUTOSAVE_MS = 5000;
const MIN_AWAY_FOR_OFFLINE_MS = 60_000;
const PURCHASE_SYNC_MIN_GAP_MS = 60_000;
/**
 * The id of the page that owns the save. On the web two tabs share one localStorage; the newest
 * claims the save and an older tab stops instead of overwriting newer progress with stale state.
 */
const OWNER_KEY = 'vanta_eclipse_owner';

function newTabId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createStore(): GameStore {
  const now = Date.now();
  const loaded = loadGame(localStorageAdapter, now, Math.random);
  const store = createGameStore(loaded.state, { now: Date.now, rng: Math.random });
  // Offline earnings are granted at load, before the player can act.
  const away = (now - loaded.state.savedAt) / 1000;
  store.dispatch({ type: 'APPLY_OFFLINE', secondsAway: away });
  return store;
}

/**
 * Owns the one game store and everything that drives it: the tick, autosave, app lifecycle
 * (background → save and silence; resume → offline earnings), the Android back button, and the
 * reducer's side effects (sound, haptics). Screens read state through the hooks in useGame.ts.
 */
export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const storeRef = useRef<GameStore | null>(null);
  const tabId = useRef('');
  if (!storeRef.current) {
    storeRef.current = createStore();
    tabId.current = newTabId();
    localStorageAdapter.set(OWNER_KEY, tabId.current);
  }
  const store = storeRef.current;
  const superseded = useRef(false);
  const [showSuperseded, setShowSuperseded] = useState(false);

  // Dev builds only: a handle for the end-to-end tests (e2e/) and for debugging in the console.
  if (import.meta.env.DEV) (window as unknown as { __vanta?: GameStore }).__vanta = store;

  const dirty = useRef(false);
  const pausedAt = useRef<number | null>(null);

  const controls = useMemo<GameControls>(() => {
    const saveNow = () => {
      if (superseded.current || localStorageAdapter.get(OWNER_KEY) !== tabId.current) {
        superseded.current = true;
        return;
      }
      writeSave(localStorageAdapter, store.getState(), Date.now());
      dirty.current = false;
    };
    /**
     * Purchases and today's ad counts belong to this device and this Google account, never to
     * a pasted or reset save: keep them, then ask Play for anything owned.
     */
    const keepDeviceShop = (next: GameState): GameState => {
      const cur = store.getState().shop;
      return {
        ...next,
        shop: {
          ...next.shop,
          entitlements: cur.entitlements,
          processedTransactions: cur.processedTransactions,
          adWatches: cur.adWatches,
        },
      };
    };
    const resync = () => void syncPurchases(store.dispatch).catch(() => undefined);
    return {
      saveNow,
      exportSave: () => serialize(store.getState(), Date.now()),
      importSave: (raw) => {
        const parsed = deserialize(raw.trim(), Date.now(), Math.random);
        if (!parsed) return false;
        store.replace(keepDeviceShop(parsed.state));
        saveNow();
        resync();
        return true;
      },
      resetSave: () => {
        localStorageAdapter.remove(SAVE_KEY);
        localStorageAdapter.remove(BACKUP_KEY);
        store.replace(keepDeviceShop(withFreshEnemy(createInitialState(Date.now()), Math.random)));
        saveNow();
        resync();
      },
    };
  }, [store]);

  // Another tab or window claimed the save: stop ticking and saving here.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== OWNER_KEY || e.newValue === tabId.current) return;
      superseded.current = true;
      pausedAt.current = Date.now();
      audio.suspend();
      setShowSuperseded(true);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Side effects requested by the reducer.
  useEffect(() => {
    return store.onFx((fx: FxEvent) => {
      const s = store.getState().settings;
      if (fx.type === 'sound') audio.play(fx.id);
      else if (fx.type === 'haptic' && s.hapticsEnabled) impact(fx.strength);
      else if (fx.type === 'save') controls.saveNow();
    });
  }, [store, controls]);

  // Audio follows the settings.
  useEffect(() => {
    let last = store.getState().settings;
    audio.setVolumes(last);
    return store.subscribe(() => {
      const s = store.getState().settings;
      if (s !== last) {
        last = s;
        audio.setVolumes(s);
      }
    });
  }, [store]);

  // Mark the save dirty on any change; autosave writes at most every few seconds.
  useEffect(() => {
    const unsub = store.subscribe(() => {
      dirty.current = true;
    });
    const id = setInterval(() => {
      if (dirty.current) controls.saveNow();
    }, AUTOSAVE_MS);
    return () => {
      unsub();
      clearInterval(id);
    };
  }, [store, controls]);

  // The game clock. dt is measured, not assumed; a long stall is capped by the reducer and
  // the rest is paid as offline time on resume.
  useEffect(() => {
    let last = performance.now();
    const id = setInterval(() => {
      const t = performance.now();
      const dt = t - last;
      last = t;
      if (pausedAt.current === null) store.dispatch({ type: 'TICK', dtMs: dt });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [store]);

  // Background / foreground.
  useEffect(() => {
    let lastPurchaseSync = Date.now(); // the start-up effect below syncs at launch
    const onPause = () => {
      if (pausedAt.current !== null) return;
      pausedAt.current = Date.now();
      controls.saveNow();
      audio.suspend();
    };
    const onResume = () => {
      if (superseded.current) return;
      const since = pausedAt.current;
      pausedAt.current = null;
      audio.resume();
      if (since !== null && Date.now() - since >= MIN_AWAY_FOR_OFFLINE_MS) {
        store.dispatch({ type: 'APPLY_OFFLINE', secondsAway: (Date.now() - since) / 1000 });
      }
      // Retry anything that failed at launch (offline, Play unreachable), and pick up a purchase
      // whose payment cleared while the app sat in the background (Google's queryPurchases-on-resume).
      void ads.init();
      if (Date.now() - lastPurchaseSync >= PURCHASE_SYNC_MIN_GAP_MS) {
        lastPurchaseSync = Date.now();
        void billing
          .init()
          .then(() => (billing.isAvailable() ? syncPurchases(store.dispatch) : 0))
          .catch((err) => console.warn('Purchase sync on resume failed', err));
      }
    };
    const onVisibility = () => (document.hidden ? onPause() : onResume());
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPause);

    const handles: Promise<{ remove: () => Promise<void> }>[] = [];
    if (Capacitor.isNativePlatform()) {
      handles.push(CapApp.addListener('pause', onPause));
      handles.push(CapApp.addListener('resume', onResume));
      handles.push(
        CapApp.addListener('backButton', () => {
          if (!runBackHandler()) CapApp.minimizeApp().catch(() => undefined);
        }),
      );
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPause);
      for (const h of handles) h.then((x) => x.remove()).catch(() => undefined);
    };
  }, [store, controls]);

  // Audio may only start after a gesture.
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // Ads (consent first) and the store's entitlements.
  useEffect(() => {
    void ads.init();
    // Picks up purchases that cleared while the app was closed, and re-grants entitlements
    // after a reinstall. Silent: the Settings button reports errors when the player asks.
    void billing
      .init()
      .then(() => syncPurchases(store.dispatch))
      .catch((err) => console.warn('Purchase sync failed; it is retried on resume', err));
  }, [store]);

  return (
    <StoreContext.Provider value={store}>
      <ControlsContext.Provider value={controls}>
        {children}
        {showSuperseded && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Game open elsewhere"
            className="fixed inset-0 z-[200] bg-void/95 flex flex-col items-center justify-center gap-3 p-6 text-center"
          >
            <p className="font-display font-bold text-sm text-gold tracking-wider">OPEN IN ANOTHER TAB</p>
            <p className="font-tech text-xs text-dim max-w-[260px]">
              Vanta Eclipse was opened in another tab or window, so this one has stopped to keep your progress safe.
            </p>
            <button type="button" className="hud-btn px-4 min-h-[44px] text-xs" onClick={() => window.location.reload()}>
              PLAY HERE INSTEAD
            </button>
          </div>
        )}
      </ControlsContext.Provider>
    </StoreContext.Provider>
  );
};
