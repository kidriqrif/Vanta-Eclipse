import { MINIGAMES } from '../data/definitions';
import type { MinigameDefinition } from '../types/game';
import { TOKEN_CAP, TOKEN_REGEN_MS, type ArcadeSlice, type GameState } from './state';

/** Share of a game's scaled value a loss still pays — attempting is never punished. */
export const LOSS_FLOOR = 0.25;

/**
 * Brings the token meter up to date with wall-clock time. Tokens accrue
 * while the app is closed; time beyond a full meter is discarded; a clock set backwards
 * grants nothing.
 */
export function regenTokens(arcade: ArcadeSlice, now: number): ArcadeSlice {
  // At or above the cap (rewards may overflow it) the meter is full: nothing accrues. Idling
  // at full never banks instant tokens because spending from a full meter restarts the
  // anchor at the moment of the spend (see ARCADE_START in reducer.ts).
  if (arcade.tokens >= TOKEN_CAP) return arcade;
  if (now < arcade.regenAnchor) return { ...arcade, regenAnchor: now };
  const periods = Math.floor((now - arcade.regenAnchor) / TOKEN_REGEN_MS);
  if (periods <= 0) return arcade;
  const tokens = Math.min(TOKEN_CAP, arcade.tokens + periods);
  return {
    ...arcade,
    tokens,
    regenAnchor: tokens >= TOKEN_CAP ? now : arcade.regenAnchor + periods * TOKEN_REGEN_MS,
  };
}

/** In-place variant for reducer drafts. */
export function applyTokenRegen(arcade: ArcadeSlice, now: number): void {
  const next = regenTokens({ tokens: arcade.tokens, regenAnchor: arcade.regenAnchor, records: {} }, now);
  if (next.tokens !== arcade.tokens) arcade.tokens = next.tokens;
  if (next.regenAnchor !== arcade.regenAnchor) arcade.regenAnchor = next.regenAnchor;
}

/** Milliseconds until the next token, or 0 when the meter is full. */
export function msUntilNextToken(arcade: ArcadeSlice, now: number): number {
  if (arcade.tokens >= TOKEN_CAP) return 0;
  return Math.max(0, TOKEN_REGEN_MS - Math.max(0, now - arcade.regenAnchor));
}

export function minigameDef(id: string): MinigameDefinition | undefined {
  return MINIGAMES.find((m) => m.id === id);
}

/** Games unlock against the lifetime peak, so an Eclipse never re-locks one. */
export function isMinigameUnlocked(state: GameState, def: MinigameDefinition): boolean {
  return state.lifetimePeakLevel >= def.unlockLevel;
}

/** payout = rate × reward_seconds × performance, a loss pays LOSS_FLOOR of that, minimum 1. */
export function minigamePayout(rewardRate: number, def: MinigameDefinition, won: boolean, performance: number): number {
  const perf = Math.min(1, Math.max(0, Number.isFinite(performance) ? performance : 0));
  const value = rewardRate * def.rewardSeconds * perf * (won ? 1 : LOSS_FLOOR);
  return Math.max(1, Math.round(value));
}

export function isBetterScore(def: MinigameDefinition, score: number, best: number | undefined): boolean {
  if (!Number.isFinite(score)) return false;
  if (best === undefined) return true;
  return def.lowerIsBetter ? score < best : score > best;
}
