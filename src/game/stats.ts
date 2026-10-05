import { ENEMIES, PETS, RELICS, SKILLS, UPGRADES, WORLDS } from '../data/definitions';
import type { OwnedPet, WorldDefinition } from '../types/game';
import { AUTO_ATTACK_UNLOCK_LEVEL, WORLD_TWO_FIRST_LEVEL, type GameState } from './state';

export const CRIT_CHANCE_MIN = 0.05;
export const CRIT_CHANCE_CAP = 0.5;
export const CRIT_DAMAGE_MIN = 1.5;
export const BASE_AUTO_INTERVAL = 1.0;
export const PET_XP_PER_LEVEL = 60;
export const PET_ABSORB_CAP = 0.5;
export const BOSS_HP_MULT = 4.5;

export function worldForLevel(level: number): WorldDefinition {
  return level >= WORLD_TWO_FIRST_LEVEL ? WORLDS[1] : WORLDS[0];
}

export function enemyHpFor(level: number, defId: string, isBoss: boolean): number {
  const def = ENEMIES[defId];
  const mult = def?.hpMultiplier ?? 1;
  return Math.max(1, Math.round(10 * Math.pow(level, 1.45) * (isBoss ? BOSS_HP_MULT : 1) * mult));
}

export function essencePerKill(level: number, essenceMult: number): number {
  return Math.max(1, Math.round(Math.pow(level, 1.25) * essenceMult));
}

export function bossEssence(level: number, essenceMult: number): number {
  return Math.max(10, Math.round(Math.pow(level, 1.35) * essenceMult * 5));
}

/** Sum of an upgrade-shop stat, read from the definitions rather than hard-coded. */
export function upgradeStat(state: GameState, stat: string, type: 'ADDITIVE' | 'PERCENT'): number {
  let sum = 0;
  for (const u of UPGRADES) {
    if (u.stat === stat && u.modifierType === type) sum += (state.upgrades[u.id] || 0) * u.valuePerLevel;
  }
  return sum;
}

export function affixSum(state: GameState, stat: string): number {
  let sum = 0;
  for (const item of Object.values(state.equipped)) {
    const v = item?.affixes?.[stat];
    if (typeof v === 'number' && Number.isFinite(v)) sum += v;
  }
  return sum;
}

export function skillStat(state: GameState, stat: string): number {
  let sum = 0;
  for (const s of SKILLS) {
    if (s.effectStat === stat) sum += (state.skills[s.id] || 0) * s.valuePerLevel;
  }
  return sum;
}

/** The active relic's value for an effect, or 0 when that relic is not attuned. */
export function relicEffect(state: GameState, effectId: string): number {
  if (!state.activeRelicId) return 0;
  const relic = RELICS.find((r) => r.id === state.activeRelicId);
  return relic && relic.effectId === effectId ? relic.effectValue : 0;
}

export function petLevelFromXp(petId: string, xp: number): number {
  const def = PETS.find((p) => p.id === petId);
  if (!def) return 1;
  return Math.min(def.maxLevel, 1 + Math.floor(Math.max(0, xp) / PET_XP_PER_LEVEL));
}

export function petLevel(state: GameState, petId: string): number {
  const pet = state.pets[petId];
  return pet ? petLevelFromXp(petId, pet.xp) : 1;
}

/** 0 for the base form, 1 after the first evolution, and so on. */
export function petStage(petId: string, level: number): number {
  const def = PETS.find((p) => p.id === petId);
  if (!def) return 0;
  return def.evolutionLevels.filter((l) => level >= l).length;
}

export function petDisplayName(petId: string, level: number): string {
  const def = PETS.find((p) => p.id === petId);
  if (!def) return petId;
  return def.stageNames[Math.min(petStage(petId, level), def.stageNames.length - 1)];
}

export function petSprite(petId: string, level: number): string {
  const def = PETS.find((p) => p.id === petId);
  if (!def) return '';
  return def.stageSprites[Math.min(petStage(petId, level), def.stageSprites.length - 1)];
}

/** The total bonus a pet gives to its stat: level × per-level plus absorbed card vigor. */
export function petBonusValue(petId: string, pet: OwnedPet): number {
  const def = PETS.find((p) => p.id === petId);
  if (!def) return 0;
  const lvl = petLevelFromXp(petId, pet.xp);
  return lvl * def.bonusPerLevel + Math.min(PET_ABSORB_CAP, pet.absorbed || 0);
}

export function activePetBonus(state: GameState, stat: string): number {
  const id = state.activePetId;
  if (!id || !state.pets[id]) return 0;
  const def = PETS.find((p) => p.id === id);
  if (!def || def.bonusStat !== stat) return 0;
  return petBonusValue(id, state.pets[id]);
}

export function isAutoAttackUnlocked(state: GameState): boolean {
  return state.peakRunLevel >= AUTO_ATTACK_UNLOCK_LEVEL || (state.skills['eternal_reflex'] || 0) > 0;
}

export interface Stats {
  tapDamage: number;
  critChance: number;
  critDamage: number;
  essenceMultiplier: number;
  bossDamageMultiplier: number;
  autoAttackUnlocked: boolean;
  autoAttackInterval: number;
  /** Auto-attack damage per second (0 until auto-attack unlocks). */
  dps: number;
  /** Essence per second from auto-attack at the current level; 0 until it unlocks. */
  liveEssenceRate: number;
  /**
   * The rate rewards are priced in (minigames, ad bonuses). Same formula as the live rate
   * but computed even before auto-attack unlocks, so a reward is never worth nothing.
   */
  rewardRate: number;
}

function compute(state: GameState): Stats {
  const world = worldForLevel(state.combat.level);

  const tapFlat = 1 + upgradeStat(state, 'tap_damage', 'ADDITIVE') + affixSum(state, 'tap_flat');
  const tapMult =
    (1 + upgradeStat(state, 'tap_damage', 'PERCENT')) *
    (1 + affixSum(state, 'tap_pct')) *
    (1 + activePetBonus(state, 'tap_pct')) *
    (1 + skillStat(state, 'tap_pct'));
  const tapDamage = Math.max(1, Math.round(tapFlat * tapMult));

  const critChance = Math.min(
    CRIT_CHANCE_CAP,
    Math.max(CRIT_CHANCE_MIN, 0.05 + upgradeStat(state, 'crit_chance', 'ADDITIVE') + affixSum(state, 'crit_chance')),
  );

  const critDamage = Math.max(
    CRIT_DAMAGE_MIN,
    2.0 +
      upgradeStat(state, 'crit_damage', 'ADDITIVE') +
      affixSum(state, 'crit_damage') +
      relicEffect(state, 'crit_dmg') +
      skillStat(state, 'crit_damage'),
  );

  const relicEssence = relicEffect(state, 'essence_mult');
  const essenceMultiplier =
    world.essenceMultiplier *
    (1 + upgradeStat(state, 'essence_gain', 'PERCENT')) *
    (1 + affixSum(state, 'essence')) *
    (1 + activePetBonus(state, 'essence')) *
    (1 + skillStat(state, 'essence')) *
    (relicEssence > 0 ? relicEssence : 1);

  const bossDamageMultiplier =
    (1 + affixSum(state, 'boss')) * (1 + relicEffect(state, 'boss_pct')) * (1 + skillStat(state, 'boss'));

  const autoAttackUnlocked = isAutoAttackUnlocked(state);
  const relicSpeed = relicEffect(state, 'attack_speed');
  const speedMult = (relicSpeed > 0 ? relicSpeed : 1) * (1 + skillStat(state, 'attack_speed'));
  const autoAttackInterval = BASE_AUTO_INTERVAL / Math.max(0.1, speedMult);

  // Expected damage per auto-attack includes crits, so the rate reflects what the player really earns.
  const expectedHit = tapDamage * (1 + critChance * (critDamage - 1));
  const autoDps = expectedHit / autoAttackInterval;
  const level = state.combat.level;
  const hpAtLevel = 10 * Math.pow(level, 1.45);
  const killTime = Math.max(0.5, hpAtLevel / autoDps);
  const rewardRate = Math.max(1, essencePerKill(level, essenceMultiplier) / killTime);

  return {
    tapDamage,
    critChance,
    critDamage,
    essenceMultiplier,
    bossDamageMultiplier,
    autoAttackUnlocked,
    autoAttackInterval,
    dps: autoAttackUnlocked ? autoDps : 0,
    liveEssenceRate: autoAttackUnlocked ? rewardRate : 0,
    rewardRate,
  };
}

// Single-entry memo keyed on the slices stats depend on. The tick changes the state object
// ten times a second, but these slices only change when the player does something.
let memoKey: unknown[] = [];
let memoValue: Stats | null = null;

export function selectStats(state: GameState): Stats {
  const key = [
    state.upgrades,
    state.equipped,
    state.pets,
    state.activePetId,
    state.activeRelicId,
    state.skills,
    state.combat.level,
    state.peakRunLevel,
  ];
  if (memoValue && key.length === memoKey.length && key.every((k, i) => k === memoKey[i])) return memoValue;
  memoKey = key;
  memoValue = compute(state);
  return memoValue;
}
