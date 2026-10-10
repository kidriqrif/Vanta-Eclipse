import { ADS, COSMETICS, getForgeCost } from '../data/definitions';
import { msUntilNextToken } from './arcade';
import { hasClaimableQuest } from './quests';
import { adWatchesToday } from './reducer';
import type { GameState } from './state';

export const selectUnseenItemCount = (s: GameState) => s.inventory.reduce((n, i) => n + (i.seen ? 0 : 1), 0);
export const selectUnseenRelicCount = (s: GameState) => s.relics.reduce((n, r) => n + (r.seen ? 0 : 1), 0);
export const selectUnseenPetCount = (s: GameState) => Object.values(s.pets).reduce((n, p) => n + (p.seen ? 0 : 1), 0);
export const selectHasClaimableQuest = hasClaimableQuest;
export const selectForgeCost = (s: GameState) => getForgeCost(s.combat.level);
export const selectHasRemovedAds = (s: GameState) => s.shop.entitlements.includes('remove_ads');
export const selectNextTokenMs = (s: GameState, now: number) => msUntilNextToken(s.arcade, now);

export function selectActiveCosmetic(s: GameState) {
  return COSMETICS.find((c) => c.id === s.shop.activeCosmeticId) ?? COSMETICS[0];
}

/** Whether an ad offer can still be claimed today, and how many are left. */
export function selectAdOffer(s: GameState, placementId: string, today: string) {
  const def = ADS.find((a) => a.id === placementId);
  if (!def) return { available: false, remaining: 0, cap: 0 };
  const used = adWatchesToday(s, placementId, today);
  return { available: used < def.dailyCap, remaining: Math.max(0, def.dailyCap - used), cap: def.dailyCap };
}

export function rgbaFromUnit(c: { r: number; g: number; b: number; a: number }, alpha = c.a): string {
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${alpha})`;
}
