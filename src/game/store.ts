import type { Action, ActionResult, FxEvent } from './actions';
import { reduce } from './reducer';
import type { Rng } from './rng';
import { localDateKey, type GameState } from './state';

export interface GameStore {
  getState(): GameState;
  /** Applies an action synchronously and returns its result; effects run after the commit. */
  dispatch(action: Action): ActionResult;
  subscribe(listener: () => void): () => void;
  /** Listen to reducer side effects (sounds, damage numbers, toasts, save requests). */
  onFx(listener: (fx: FxEvent) => void): () => void;
  /** Replaces the whole state (import, or a load that happened after creation). */
  replace(state: GameState): void;
}

export function createGameStore(initial: GameState, deps: { now: () => number; rng: Rng }): GameStore {
  let state = initial;
  const listeners = new Set<() => void>();
  const fxListeners = new Set<(fx: FxEvent) => void>();

  const notify = () => listeners.forEach((l) => l());

  return {
    getState: () => state,
    dispatch(action) {
      const now = deps.now();
      const out = reduce(state, action, { now, today: localDateKey(now), rng: deps.rng });
      if (out.state !== state) {
        state = out.state;
        notify();
      }
      for (const fx of out.fx) fxListeners.forEach((l) => l(fx));
      return out.result;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onFx(listener) {
      fxListeners.add(listener);
      return () => fxListeners.delete(listener);
    },
    replace(next) {
      state = next;
      notify();
    },
  };
}
