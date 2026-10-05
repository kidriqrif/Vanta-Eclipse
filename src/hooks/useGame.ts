import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Action, ActionResult, FxEvent } from '../game/actions';
import type { GameState } from '../game/state';
import { localDateKey } from '../game/state';
import { selectStats, type Stats } from '../game/stats';
import type { GameStore } from '../game/store';

export interface GameControls {
  /** Wipes the save and restarts from a new game. */
  resetSave(): void;
  /** The current save as a string, for the player to copy somewhere safe. */
  exportSave(): string;
  /** Loads a save string; returns false (and changes nothing) if it is not a valid save. */
  importSave(raw: string): boolean;
  /** Persists immediately. */
  saveNow(): void;
}

export const StoreContext = createContext<GameStore | null>(null);
export const ControlsContext = createContext<GameControls | null>(null);

export function useGameStore(): GameStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useGameStore must be used inside <GameProvider>');
  return store;
}

export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

/**
 * Subscribes to one slice of the game. The component re-renders only when the selected value
 * changes (by `equal`, default Object.is). Return primitives or existing state objects, or
 * pass `shallowEqual` when the selector builds a new object.
 */
export function useGameState<T>(selector: (s: GameState) => T, equal: (a: T, b: T) => boolean = Object.is): T {
  const store = useGameStore();
  const cache = useRef<{ state: GameState; selector: (s: GameState) => T; value: T } | null>(null);
  const getSnapshot = () => {
    const state = store.getState();
    const c = cache.current;
    if (c && c.state === state && c.selector === selector) return c.value;
    const value = selector(state);
    if (c && equal(c.value, value)) {
      cache.current = { state, selector, value: c.value };
      return c.value;
    }
    cache.current = { state, selector, value };
    return value;
  };
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export function useStats(): Stats {
  return useGameState(selectStats);
}

export function useDispatch(): (action: Action) => ActionResult {
  const store = useGameStore();
  return store.dispatch;
}

export function useControls(): GameControls {
  const c = useContext(ControlsContext);
  if (!c) throw new Error('useControls must be used inside <GameProvider>');
  return c;
}

/** Wall-clock time that refreshes every `intervalMs`, for countdowns (token regen, lockouts). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useToday(): string {
  return localDateKey(useNow(30_000));
}

/** Listens to reducer side effects (damage numbers, shakes, toasts). The latest handler is always used. */
export function useFx(handler: (fx: FxEvent) => void): void {
  const store = useGameStore();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => store.onFx((fx) => ref.current(fx)), [store]);
}

/** A stable callback that dispatches a fixed action shape. */
export function useAction<A extends unknown[]>(build: (...args: A) => Action): (...args: A) => ActionResult {
  const dispatch = useDispatch();
  const ref = useRef(build);
  ref.current = build;
  return useCallback((...args: A) => dispatch(ref.current(...args)), [dispatch]);
}
