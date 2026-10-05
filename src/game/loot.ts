import { AFFIXES, CARD_RARITIES, LOOT_TABLES, RARITY_AFFIX_MULT, SLOTS } from '../data/definitions';
import type { Card, Item, ItemRarity } from '../types/game';
import { pick, shuffled, weightedIndex, type Rng } from './rng';

export type LootSource = keyof typeof LOOT_TABLES;

export const EQUIPPABLE_SLOTS = SLOTS.filter((s) => !s.sealed).map((s) => s.id);

export function rollRarity(rng: Rng, source: LootSource): ItemRarity {
  return weightedIndex(rng, LOOT_TABLES[source]) as ItemRarity;
}

/**
 * One item. Rarity decides how many distinct affixes it carries (rarity + 1). Percent affixes
 * scale with rarity; flat ones also scale with the item level so they stay relevant.
 */
export function rollItem(
  rng: Rng,
  opts: { id: number; level: number; source: LootSource; slot?: string; seen?: boolean },
): Item {
  const rarity = rollRarity(rng, opts.source);
  const slot = opts.slot ?? pick(rng, EQUIPPABLE_SLOTS);
  const mult = RARITY_AFFIX_MULT[rarity];
  const affixes: Record<string, number> = {};
  for (const affix of shuffled(rng, AFFIXES).slice(0, rarity + 1)) {
    const coef = affix.minValue + rng() * (affix.maxValue - affix.minValue);
    affixes[affix.stat] = affix.isPercent
      ? Number((coef * mult).toFixed(3))
      : Math.max(1, Math.round(opts.level * coef * mult));
  }
  return { id: opts.id, slot, rarity, itemLevel: opts.level, affixes, seen: opts.seen ?? false };
}

export function rollCard(rng: Rng, opts: { id: number; level: number; bossId: string; bossName: string; now: number }): Card {
  const idx = weightedIndex(
    rng,
    CARD_RARITIES.map((r) => r.dropWeight),
  );
  const rarity = CARD_RARITIES[idx];
  const jitter = () => 0.85 + rng() * 0.3;
  return {
    id: opts.id,
    bossId: opts.bossId,
    bossName: opts.bossName,
    rarity: rarity.id,
    level: opts.level,
    power: Math.max(1, Math.round(opts.level * 8 * rarity.potency * jitter())),
    vigor: Math.max(1, Math.round(10 * rarity.potency * jitter())),
    obtainedAt: opts.now,
  };
}
