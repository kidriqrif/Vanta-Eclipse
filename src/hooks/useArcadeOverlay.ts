import { useSyncExternalStore } from 'react';

/**
 * Whether the full-screen minigame overlay is on screen — from the moment a game opens until
 * its result banner is closed. That is longer than `ui.activeRun`, which ends when the result is
 * paid, so this (not activeRun) decides when the rest of the app must stay out of the way:
 * the shell goes inert, and game-triggered dialogs wait so they never sit hidden under the
 * overlay holding the Android back button.
 */
let open = 0;
const listeners = new Set<() => void>();

export function setArcadeOverlay(isOpen: boolean): void {
  open = Math.max(0, open + (isOpen ? 1 : -1));
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useArcadeOverlayOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open > 0);
}
