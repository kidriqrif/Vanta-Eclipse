import { produce, type Draft } from 'immer';
import type { Action } from '../actions';
import { reduce } from '../reducer';
import { seededRng, type Rng } from '../rng';
import { createInitialState, localDateKey, type GameState } from '../state';
import { withFreshEnemy } from '../reducer';

export const T0 = new Date(2026, 9, 5, 12, 0, 0).getTime();

export function newGame(edit?: (d: Draft<GameState>) => void, seed = 1): GameState {
  const s = withFreshEnemy(createInitialState(T0), seededRng(seed));
  if (!edit) return s;
  const edited = produce(s, edit);
  // An edit that moves the level needs an enemy that belongs to it.
  return edited.combat.enemy.level !== edited.combat.level ? withFreshEnemy(edited, seededRng(seed)) : edited;
}

/** A tiny harness: dispatch actions against a state with a controllable clock and seeded RNG. */
export function harness(state: GameState, seed = 7) {
  let now = T0;
  const rng: Rng = seededRng(seed);
  const h = {
    state,
    fx: [] as ReturnType<typeof reduce>['fx'],
    get now() {
      return now;
    },
    advance(ms: number) {
      now += ms;
    },
    setNow(ms: number) {
      now = ms;
    },
    dispatch(action: Action) {
      const out = reduce(h.state, action, { now, today: localDateKey(now), rng });
      h.state = out.state;
      h.fx.push(...out.fx);
      return out.result;
    },
    /** Taps until the current enemy dies (with human-like jitter so the tap guard stays quiet). */
    killEnemy(maxTaps = 100000) {
      const startLevel = h.state.combat.level;
      const startMode = h.state.combat.mode;
      const startKills = h.state.quests.counters.kills || 0;
      for (let i = 0; i < maxTaps; i++) {
        now += 180 + ((i * 37) % 90);
        h.dispatch({ type: 'TAP', x: 100 + (i % 7) * 3, y: 200 + (i % 5) * 4, touch: true });
        if ((h.state.quests.counters.kills || 0) > startKills) return;
      }
      throw new Error(`enemy at level ${startLevel} (${startMode}) did not die`);
    },
  };
  return h;
}

/** Makes taps one-shot everything, so progression tests stay fast. */
export function overpowered(d: Draft<GameState>) {
  d.upgrades['void_claws'] = 5_000_000;
}
