import { MIN_OFFLINE_SECONDS, type GameState } from './state';
import { relicEffect, selectStats, skillStat } from './stats';

export const BASE_OFFLINE_CAP_HOURS = 8;
export const BASE_OFFLINE_EFFICIENCY = 0.5;

export interface OfflineReward {
  amount: number;
  secondsAway: number;
  wasCapped: boolean;
}

/**
 * Essence earned while away. Only accrues once auto-attack is running (at level 15, or from
 * the start with Eternal Reflex), at the rate of whatever the player was doing — farming a
 * walled boss pays the farm rate, honestly (M5 §6).
 *  - cap: 8 h + Long Slumber
 *  - efficiency: 50% + Deep Rest
 *  - multiplier: the Eclipse Heart relic, when attuned
 */
export function computeOfflineReward(state: GameState, secondsAway: number): OfflineReward | null {
  const away = Math.floor(secondsAway);
  if (!(away >= MIN_OFFLINE_SECONDS)) return null;
  const stats = selectStats(state);
  if (!stats.autoAttackUnlocked) return null;

  const capHours = BASE_OFFLINE_CAP_HOURS + skillStat(state, 'offline_cap_hours');
  const maxSec = capHours * 3600;
  const effective = Math.min(away, maxSec);
  const efficiency = BASE_OFFLINE_EFFICIENCY + skillStat(state, 'offline_efficiency');
  const relicMult = relicEffect(state, 'offline_mult');
  const amount = Math.round(stats.liveEssenceRate * effective * efficiency * (relicMult > 0 ? relicMult : 1));
  if (amount < 1) return null;
  return { amount, secondsAway: away, wasCapped: away > maxSec };
}
