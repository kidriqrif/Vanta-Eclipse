import { produce, type Draft } from 'immer';
import {
  ADS,
  CARD_RARITIES,
  COSMETICS,
  DAILY_ALL_CLEAR_REWARDS,
  ENEMIES,
  ENEMY_DROP_CHANCE,
  PETS,
  PRODUCTS,
  QUESTS,
  RARITIES,
  RELICS,
  SKILLS,
  SLOTS,
  UPGRADES,
  getForgeCost,
} from '../data/definitions';
import type { CurrencyType, QuestDefinition } from '../types/game';
import { OK, fail, type Action, type ActionResult, type FxEvent, type SoundId } from './actions';
import { applyTokenRegen, isBetterScore, isMinigameUnlocked, minigameDef, minigamePayout } from './arcade';
import { rollCard, rollItem } from './loot';
import { computeOfflineReward } from './offline';
import { bumpCounter, canClaimAllClear, canClaimQuest } from './quests';
import { pick, weightedIndex, type Rng } from './rng';
import {
  AUTO_ATTACK_UNLOCK_LEVEL,
  BOSS_FIGHT_SECONDS,
  CARD_COLLECTION_CAP,
  ECLIPSE_UNLOCK_LEVEL,
  TOKEN_CAP,
  WORLD_TWO_FIRST_LEVEL,
  freshDaily,
  freshTapGuard,
  type GameState,
} from './state';
import {
  PET_ABSORB_CAP,
  bossEssence,
  enemyHpFor,
  essencePerKill,
  petDisplayName,
  petLevelFromXp,
  petStage,
  selectStats,
  skillStat,
  worldForLevel,
  type Stats,
} from './stats';
import { registerTap } from './tapGuard';

export interface ReduceContext {
  now: number;
  /** Local calendar date (YYYY-MM-DD); dailies roll over when it changes. */
  today: string;
  rng: Rng;
}

export interface ReduceOutput {
  state: GameState;
  fx: FxEvent[];
  result: ActionResult;
}

const COMBO_WINDOW_MS = 1500;
const MAX_AUTO_HITS_PER_TICK = 20;
/** Tuning constants the screens also quote, so copy and rules cannot drift apart. */
export const PET_XP_PER_KILL = 3;
export const RELIC_DROP_CHANCE = 0.25;
export const FROSTLING_DROP_CHANCE = 0.15;
export const BOSS_TOKEN_CHANCE = 0.1;
/** Each point of card vigor adds this much to the absorbing pet's bonus. */
export const VIGOR_TO_BONUS = 0.002;
const ECLIPSE_COMMIT_GUARD_MS = 3000;
const PROCESSED_TRANSACTIONS_KEPT = 200;

type D = Draft<GameState>;

interface Ctx extends ReduceContext {
  fx: FxEvent[];
  /** Stats as of the start of the action. Nothing within one action changes them materially. */
  stats: Stats;
}

const sound = (c: Ctx, id: SoundId) => c.fx.push({ type: 'sound', id });
const toast = (c: Ctx, text: string, tone: 'info' | 'loot' | 'rare' | 'warn' = 'info') =>
  c.fx.push({ type: 'toast', text, tone });
const haptic = (d: D, c: Ctx, strength: 'light' | 'medium' | 'heavy') => {
  if (d.settings.hapticsEnabled) c.fx.push({ type: 'haptic', strength });
};

/** Comboed manual taps add up to +25% damage: +2% per 3 consecutive taps. */
export function comboBonus(count: number): number {
  return Math.min(0.25, Math.floor(count / 3) * 0.02);
}

export function eclipsePayout(state: GameState): number {
  if (state.peakRunLevel < ECLIPSE_UNLOCK_LEVEL) return 0;
  const base = Math.floor(Math.pow(state.peakRunLevel / 10, 1.6));
  return Math.max(1, Math.round(base * (1 + skillStat(state, 'crystal_gain'))));
}

export function upgradeCost(level: number, id: string, count = 1): number {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return Infinity;
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.round(def.baseCost * Math.pow(def.costGrowth, level + i));
  return total;
}

/** How many levels of an upgrade the player can buy now (respecting maxLevel), and the total cost. */
export function affordableUpgrades(
  state: GameState,
  id: string,
  want: number | 'max',
): { count: number; cost: number; limit: number } {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return { count: 0, cost: 0, limit: 0 };
  const lvl = state.upgrades[id] || 0;
  const room = def.maxLevel > 0 ? Math.max(0, def.maxLevel - lvl) : Infinity;
  const limit = Math.min(room, want === 'max' ? 1000 : want);
  let count = 0;
  let cost = 0;
  while (count < limit) {
    const next = Math.round(def.baseCost * Math.pow(def.costGrowth, lvl + count));
    if (state.currencies.essence < cost + next) break;
    cost += next;
    count++;
  }
  return { count, cost, limit: Number.isFinite(limit) ? limit : count };
}

export function skillCost(state: GameState, id: string): number {
  const def = SKILLS.find((s) => s.id === id);
  if (!def) return Infinity;
  return Math.round(def.baseCost * Math.pow(def.costGrowth, state.skills[id] || 0));
}

export function skillBlocker(state: GameState, id: string): string | null {
  const def = SKILLS.find((s) => s.id === id);
  if (!def) return 'unknown';
  if ((state.skills[id] || 0) >= def.maxLevel) return 'max_level';
  if (def.prereqId && (state.skills[def.prereqId] || 0) < (def.prereqLevel || 1)) return 'prereq';
  if (state.currencies.void_crystals < skillCost(state, id)) return 'not_enough';
  return null;
}

/** Ad offers keep their daily cap even with Remove Ads; Remove Ads only skips the video. */
export function adWatchesToday(state: GameState, placementId: string, today: string): number {
  const w = state.shop.adWatches[placementId];
  return w && w.date === today ? w.count : 0;
}

// ---------------------------------------------------------------- currency

function addCurrency(d: D, currency: CurrencyType, amount: number) {
  if (!(amount > 0) || !Number.isFinite(amount)) return;
  d.currencies[currency] = (d.currencies[currency] || 0) + amount;
  if (currency === 'essence') bumpCounter(d as GameState, 'essence_earned', amount);
  if (currency === 'void_crystals') bumpCounter(d as GameState, 'crystals_earned', amount);
}

function spend(d: D, currency: CurrencyType, amount: number): boolean {
  if (!(amount >= 0) || !Number.isFinite(amount)) return false;
  if ((d.currencies[currency] || 0) < amount) return false;
  d.currencies[currency] -= amount;
  return true;
}

/** Explicit rewards (quests, purchases, ads) may overflow the meter; regen and boss drops may not. */
function grantTokens(d: D, amount: number, respectCap: boolean) {
  const before = d.arcade.tokens;
  d.arcade.tokens = respectCap ? Math.max(before, Math.min(TOKEN_CAP, before + amount)) : before + amount;
}

function grantQuestReward(d: D, quest: Pick<QuestDefinition, 'rewardKind' | 'rewardAmount'>) {
  switch (quest.rewardKind) {
    case 'ESSENCE':
      addCurrency(d, 'essence', quest.rewardAmount);
      break;
    case 'CRYSTALS':
      addCurrency(d, 'void_crystals', quest.rewardAmount);
      break;
    case 'SHARDS':
      addCurrency(d, 'astral_shards', quest.rewardAmount);
      break;
    case 'TOKENS':
      grantTokens(d, quest.rewardAmount, false);
      break;
  }
}

// ---------------------------------------------------------------- combat

function spawnEnemy(d: D, c: Ctx, level: number, isBoss: boolean) {
  const world = worldForLevel(level);
  const defId = isBoss
    ? world.bossIds[Math.floor((level - 1) / 10) % world.bossIds.length]
    : pick(c.rng, world.enemyIds);
  const hp = enemyHpFor(level, defId, isBoss);
  d.combat.enemy = { defId, level, maxHp: hp, hp, isBoss };
  d.combat.bossTimeLeft = BOSS_FIGHT_SECONDS;
}

function startBoss(d: D, c: Ctx, gateLevel: number) {
  d.combat.mode = 'BOSS_FIGHT';
  d.combat.level = gateLevel;
  spawnEnemy(d, c, gateLevel, true);
  sound(c, 'boss_warn');
  haptic(d, c, 'medium');
}

/** Moves the climb to `level`. Every tenth level is a boss gate and starts the fight. */
function enterLevel(d: D, c: Ctx, level: number) {
  const prevPeak = d.peakRunLevel;
  d.peakRunLevel = Math.max(d.peakRunLevel, level);
  d.lifetimePeakLevel = Math.max(d.lifetimePeakLevel, level);
  if (prevPeak < AUTO_ATTACK_UNLOCK_LEVEL && d.peakRunLevel >= AUTO_ATTACK_UNLOCK_LEVEL && !(d.skills['eternal_reflex'] > 0)) {
    toast(c, 'AUTO-ATTACK ONLINE: your strikes now continue on their own', 'rare');
  }
  if (prevPeak < ECLIPSE_UNLOCK_LEVEL && d.peakRunLevel >= ECLIPSE_UNLOCK_LEVEL) {
    toast(c, 'THE ECLIPSE AWAITS: collapse this run into permanent power', 'rare');
  }
  if (level % 10 === 0) {
    startBoss(d, c, level);
  } else {
    d.combat.mode = d.combat.mode === 'FARM_MODE' ? 'FARM_MODE' : 'NORMAL';
    d.combat.level = level;
    spawnEnemy(d, c, level, false);
  }
}

/** A failed or abandoned boss drops the player to farm the level below the gate (M5 §2C). */
function leaveBoss(d: D, c: Ctx, timedOut: boolean) {
  const gate = d.combat.level;
  const farmLevel = Math.max(1, gate - 1);
  d.combat.mode = 'FARM_MODE';
  d.combat.level = farmLevel;
  spawnEnemy(d, c, farmLevel, false);
  sound(c, 'fail');
  toast(c, timedOut ? 'THE BOSS ENDURES: farm, grow stronger, then challenge it again' : 'RETREATED: farming below the gate', 'warn');
}

function dropItem(d: D, c: Ctx, source: 'enemy' | 'boss', level: number) {
  const item = rollItem(c.rng, { id: d.nextId++, level, source });
  d.inventory.unshift(item);
  bumpCounter(d as GameState, 'items_dropped', 1);
  const rarity = RARITIES[item.rarity];
  const slot = SLOTS.find((s) => s.id === item.slot)?.displayName ?? item.slot;
  toast(c, `${rarity.displayName.toUpperCase()} ${slot.toUpperCase()} acquired`, item.rarity >= 3 ? 'rare' : 'loot');
  if (item.rarity >= 2) haptic(d, c, item.rarity >= 4 ? 'heavy' : 'light');
}

function givePetXp(d: D, c: Ctx, petId: string, xp: number) {
  const pet = d.pets[petId];
  if (!pet) return;
  const before = petLevelFromXp(petId, pet.xp);
  pet.xp += xp;
  const after = petLevelFromXp(petId, pet.xp);
  if (petStage(petId, after) > petStage(petId, before)) {
    toast(c, `${petDisplayName(petId, before).toUpperCase()} EVOLVED INTO ${petDisplayName(petId, after).toUpperCase()}`, 'rare');
    sound(c, 'fanfare');
  }
}

function unlockFrozenRuins(d: D, c: Ctx) {
  if (d.unlockedWorlds.includes('frozen_ruins')) return;
  d.unlockedWorlds.push('frozen_ruins');
  d.relicsAwakened = true;
  if (!d.pets['ember']) d.pets['ember'] = { xp: 0, seen: false, absorbed: 0 };
  if (!d.activePetId) d.activePetId = 'ember';
  d.ui.worldUnlockModal = 'frozen_ruins';
  sound(c, 'fanfare');
  c.fx.push({ type: 'save' });
}

function onKill(d: D, c: Ctx) {
  const enemy = d.combat.enemy;
  const level = enemy.level;
  sound(c, 'enemy_death');
  bumpCounter(d as GameState, 'kills', 1);
  if (d.activePetId) givePetXp(d, c, d.activePetId, PET_XP_PER_KILL);

  if (enemy.isBoss) {
    sound(c, 'boss_defeat');
    haptic(d, c, 'heavy');
    bumpCounter(d as GameState, 'boss_wins', 1);
    addCurrency(d, 'essence', bossEssence(level, c.stats.essenceMultiplier));

    const def = ENEMIES[enemy.defId];
    const card = rollCard(c.rng, {
      id: d.nextId++,
      level,
      bossId: enemy.defId,
      bossName: def?.displayName ?? enemy.defId,
      now: c.now,
    });
    d.cards.unshift(card);
    if (d.cards.length > CARD_COLLECTION_CAP) d.cards.splice(CARD_COLLECTION_CAP);
    const cardRarity = CARD_RARITIES.find((r) => r.id === card.rarity);
    toast(c, `${(cardRarity?.displayName ?? card.rarity).toUpperCase()} CARD: ${card.bossName.toUpperCase()}`, 'loot');

    if (level >= WORLD_TWO_FIRST_LEVEL && d.relicsAwakened && c.rng() < RELIC_DROP_CHANCE) {
      const unowned = RELICS.filter((r) => !d.relics.some((o) => o.id === r.id));
      if (unowned.length > 0) {
        const relic = unowned[weightedIndex(c.rng, unowned.map((r) => r.dropWeight))];
        d.relics.unshift({ id: relic.id, seen: false });
        toast(c, `RELIC FOUND: ${relic.displayName.toUpperCase()}`, 'rare');
        sound(c, 'loot');
      }
    }
    if (level >= WORLD_TWO_FIRST_LEVEL && !d.pets['frostling'] && c.rng() < FROSTLING_DROP_CHANCE) {
      d.pets['frostling'] = { xp: 0, seen: false, absorbed: 0 };
      toast(c, 'A FROSTLING HAS CHOSEN YOU', 'rare');
      sound(c, 'fanfare');
    }
    if (c.rng() < BOSS_TOKEN_CHANCE) grantTokens(d, 1, true);
    dropItem(d, c, 'boss', level);

    if (level + 1 >= WORLD_TWO_FIRST_LEVEL) unlockFrozenRuins(d, c);
    d.combat.mode = 'NORMAL';
    enterLevel(d, c, level + 1);
    return;
  }

  addCurrency(d, 'essence', essencePerKill(level, c.stats.essenceMultiplier));
  if (c.rng() < ENEMY_DROP_CHANCE) dropItem(d, c, 'enemy', level);

  if (d.combat.mode === 'FARM_MODE') spawnEnemy(d, c, level, false);
  else enterLevel(d, c, level + 1);
}

function applyHit(d: D, c: Ctx, opts: { auto: boolean; x?: number; y?: number; combo?: number }) {
  const s = c.stats;
  const crit = c.rng() < s.critChance;
  const bossMult = d.combat.enemy.isBoss ? s.bossDamageMultiplier : 1;
  const combo = opts.auto ? 0 : comboBonus(opts.combo ?? 0);
  const amount = Math.max(1, Math.round(s.tapDamage * (crit ? s.critDamage : 1) * bossMult * (1 + combo)));

  c.fx.push({ type: 'hit', amount, crit, auto: opts.auto, x: opts.x, y: opts.y });
  sound(c, crit ? 'crit_hit' : 'tap_hit');
  if (crit && !opts.auto) {
    if (d.settings.screenShake) c.fx.push({ type: 'shake' });
    haptic(d, c, 'light');
  }

  d.combat.enemy.hp -= amount;
  if (d.combat.enemy.hp <= 0) {
    d.combat.enemy.hp = 0;
    onKill(d, c);
  }
}

// ---------------------------------------------------------------- handlers

function handle(d: D, a: Action, c: Ctx, base: GameState): ActionResult {
  switch (a.type) {
    case 'TICK': {
      const dt = Math.min(1, Math.max(0, a.dtMs / 1000));
      if (d.quests.daily.date !== c.today) d.quests.daily = freshDaily(c.today);
      applyTokenRegen(d.arcade, c.now);
      if (d.ui.combo.count > 0 && c.now - d.ui.combo.lastAt > COMBO_WINDOW_MS) d.ui.combo = { count: 0, lastAt: 0 };

      // The boss timer pauses while a minigame is open: the arcade is its own screen.
      if (d.combat.mode === 'BOSS_FIGHT' && !d.ui.activeRun) {
        d.combat.bossTimeLeft = Math.max(0, d.combat.bossTimeLeft - dt);
        if (d.combat.bossTimeLeft <= 0) {
          leaveBoss(d, c, true);
          return OK;
        }
      }
      if (c.stats.autoAttackUnlocked) {
        d.combat.autoAcc += dt;
        let hits = 0;
        while (d.combat.autoAcc >= c.stats.autoAttackInterval && hits < MAX_AUTO_HITS_PER_TICK) {
          d.combat.autoAcc -= c.stats.autoAttackInterval;
          applyHit(d, c, { auto: true });
          hits++;
        }
        if (hits >= MAX_AUTO_HITS_PER_TICK) d.combat.autoAcc = 0;
      } else if (d.combat.autoAcc !== 0) {
        d.combat.autoAcc = 0;
      }
      return OK;
    }

    case 'TAP': {
      const r = registerTap(d.ui.tapGuard as GameState['ui']['tapGuard'], c.now, a.x, a.y, a.touch);
      d.ui.tapGuard = r.guard;
      if (r.verdict === 'locked') return fail('locked');
      if (r.verdict === 'flagged') {
        d.ui.combo = { count: 0, lastAt: 0 };
        c.fx.push({ type: 'tapLocked', until: r.guard.lockedUntil, signal: r.signal! });
        sound(c, 'fail');
        return fail('flagged');
      }
      const combo = c.now - d.ui.combo.lastAt > COMBO_WINDOW_MS ? 1 : Math.min(999, d.ui.combo.count + 1);
      d.ui.combo = { count: combo, lastAt: c.now };
      bumpCounter(d as GameState, 'taps', 1);
      applyHit(d, c, { auto: false, x: a.x, y: a.y, combo });
      return OK;
    }

    case 'CHALLENGE_BOSS': {
      if (d.combat.mode !== 'FARM_MODE') return fail('not_farming');
      const gate = d.combat.level + 1;
      if (gate % 10 !== 0) return fail('no_gate');
      startBoss(d, c, gate);
      return OK;
    }

    case 'LEAVE_BOSS': {
      if (d.combat.mode !== 'BOSS_FIGHT') return fail('no_boss');
      leaveBoss(d, c, false);
      return OK;
    }

    case 'SET_FARM': {
      if (d.combat.mode === 'BOSS_FIGHT') return fail('in_boss');
      d.combat.mode = a.on ? 'FARM_MODE' : 'NORMAL';
      sound(c, 'click');
      return OK;
    }

    case 'BUY_UPGRADE': {
      const { count, cost, limit } = affordableUpgrades(base, a.id, a.count);
      // A fixed-size buy (x10) is all or nothing; it shrinks only to what maxLevel leaves.
      if (count <= 0 || (a.count !== 'max' && count < limit)) return fail('not_enough');
      if (!spend(d, 'essence', cost)) return fail('not_enough');
      d.upgrades[a.id] = (d.upgrades[a.id] || 0) + count;
      bumpCounter(d as GameState, 'upgrades_bought', count);
      sound(c, 'levelup');
      return { ok: true, value: count };
    }

    case 'EQUIP_ITEM': {
      const idx = d.inventory.findIndex((i) => i.id === a.itemId);
      if (idx < 0) return fail('missing');
      const item = d.inventory[idx];
      const slot = SLOTS.find((s) => s.id === item.slot);
      if (!slot || slot.sealed) return fail('sealed');
      d.inventory.splice(idx, 1);
      const prev = d.equipped[item.slot];
      if (prev) d.inventory.unshift({ ...prev, seen: true });
      d.equipped[item.slot] = { ...item, seen: true };
      sound(c, 'confirm');
      return OK;
    }

    case 'UNEQUIP_ITEM': {
      const item = d.equipped[a.slot];
      if (!item) return fail('empty');
      delete d.equipped[a.slot];
      d.inventory.unshift({ ...item, seen: true });
      sound(c, 'click');
      return OK;
    }

    case 'SALVAGE_ITEM': {
      const idx = d.inventory.findIndex((i) => i.id === a.itemId);
      if (idx < 0) return fail('missing');
      const yieldScraps = RARITIES[d.inventory[idx].rarity]?.salvageYield ?? 2;
      d.inventory.splice(idx, 1);
      addCurrency(d, 'void_scraps', yieldScraps);
      bumpCounter(d as GameState, 'salvage', 1);
      sound(c, 'claim');
      return { ok: true, value: yieldScraps };
    }

    case 'SALVAGE_COMMONS': {
      const commons = d.inventory.filter((i) => i.rarity === 0);
      if (commons.length === 0) return fail('none');
      const total = commons.length * RARITIES[0].salvageYield;
      d.inventory = d.inventory.filter((i) => i.rarity !== 0);
      addCurrency(d, 'void_scraps', total);
      bumpCounter(d as GameState, 'salvage', commons.length);
      sound(c, 'claim');
      return { ok: true, value: total };
    }

    case 'FORGE_ITEM': {
      const slot = SLOTS.find((s) => s.id === a.slot);
      if (!slot || slot.sealed) return fail('sealed');
      const level = d.combat.level;
      if (!spend(d, 'void_scraps', getForgeCost(level))) return fail('not_enough');
      const item = rollItem(c.rng, { id: d.nextId++, level, source: 'forge', slot: a.slot, seen: true });
      d.inventory.unshift(item);
      bumpCounter(d as GameState, 'forge', 1);
      sound(c, 'loot');
      if (item.rarity >= 2) haptic(d, c, item.rarity >= 4 ? 'heavy' : 'light');
      return { ok: true, item };
    }

    case 'MARK_ITEMS_SEEN':
      for (const i of d.inventory) if (!i.seen) i.seen = true;
      return OK;
    case 'MARK_RELICS_SEEN':
      for (const r of d.relics) if (!r.seen) r.seen = true;
      return OK;
    case 'MARK_PETS_SEEN':
      for (const p of Object.values(d.pets)) if (!p.seen) p.seen = true;
      return OK;

    case 'ABSORB_CARD': {
      const petId = d.activePetId;
      if (!petId || !d.pets[petId]) return fail('no_pet');
      const idx = d.cards.findIndex((cd) => cd.id === a.cardId);
      if (idx < 0) return fail('missing');
      const def = PETS.find((p) => p.id === petId);
      const pet = d.pets[petId];
      const atMax = !!def && petLevelFromXp(petId, pet.xp) >= def.maxLevel;
      if (atMax && (pet.absorbed || 0) >= PET_ABSORB_CAP) return fail('no_gain');
      const card = d.cards[idx];
      d.cards.splice(idx, 1);
      pet.absorbed = Math.min(PET_ABSORB_CAP, (pet.absorbed || 0) + card.vigor * VIGOR_TO_BONUS);
      givePetXp(d, c, petId, card.power);
      bumpCounter(d as GameState, 'cards_absorbed', 1);
      sound(c, 'fanfare');
      return OK;
    }

    case 'SET_ACTIVE_PET': {
      if (!d.pets[a.id]) return fail('not_owned');
      d.activePetId = a.id;
      sound(c, 'confirm');
      return OK;
    }

    case 'SET_ACTIVE_RELIC': {
      if (a.id !== null && !d.relics.some((r) => r.id === a.id)) return fail('not_owned');
      d.activeRelicId = a.id;
      sound(c, a.id ? 'confirm' : 'click');
      return OK;
    }

    case 'BUY_SKILL': {
      const blocker = skillBlocker(base, a.id);
      if (blocker) return fail(blocker);
      if (!spend(d, 'void_crystals', skillCost(base, a.id))) return fail('not_enough');
      d.skills[a.id] = (d.skills[a.id] || 0) + 1;
      bumpCounter(d as GameState, 'skills_bought', 1);
      sound(c, 'goal');
      return OK;
    }

    case 'PERFORM_ECLIPSE': {
      if (d.ui.eclipseAt && c.now - d.ui.eclipseAt < ECLIPSE_COMMIT_GUARD_MS) return fail('busy');
      const payout = eclipsePayout(base);
      if (payout <= 0) return fail('locked');
      addCurrency(d, 'void_crystals', payout);
      d.eclipseCount += 1;
      bumpCounter(d as GameState, 'eclipses', 1);
      // RESET (M8 §1): the run economy. Everything else is kept.
      d.currencies.essence = 0;
      d.upgrades = {};
      d.peakRunLevel = 1;
      d.unlockedWorlds = ['dark_forest'];
      d.combat.mode = 'NORMAL';
      d.combat.level = 1;
      d.combat.autoAcc = 0;
      spawnEnemy(d, c, 1, false);
      d.ui.combo = { count: 0, lastAt: 0 };
      d.ui.eclipseAt = c.now;
      sound(c, 'eclipse');
      haptic(d, c, 'heavy');
      c.fx.push({ type: 'eclipse', crystals: payout }, { type: 'save' });
      return { ok: true, value: payout };
    }

    case 'ARCADE_START': {
      const def = minigameDef(a.gameId);
      if (!def) return fail('unknown');
      if (!isMinigameUnlocked(base, def)) return fail('locked');
      if (d.ui.activeRun) return fail('busy');
      applyTokenRegen(d.arcade, c.now);
      if (d.arcade.tokens < def.tokenCost) return fail('no_tokens');
      const wasFull = d.arcade.tokens >= TOKEN_CAP;
      d.arcade.tokens -= def.tokenCost;
      // Dropping below a full meter starts the regen clock now, never in the past.
      if (wasFull && d.arcade.tokens < TOKEN_CAP) d.arcade.regenAnchor = c.now;
      const runId = d.ui.nextRunId++;
      d.ui.activeRun = { runId, gameId: a.gameId };
      sound(c, 'click');
      c.fx.push({ type: 'save' });
      return { ok: true, runId };
    }

    case 'ARCADE_FINISH': {
      // The latch: only the run that is open can finish, and only once.
      const run = d.ui.activeRun;
      if (!run || run.runId !== a.runId) return fail('stale');
      d.ui.activeRun = null;
      const def = minigameDef(run.gameId)!;
      const payout = minigamePayout(c.stats.rewardRate, def, a.won, a.performance);
      addCurrency(d, 'essence', payout);
      bumpCounter(d as GameState, 'minigame_played', 1);
      let newRecord = false;
      if (a.won) {
        bumpCounter(d as GameState, 'minigame_wins', 1);
        if (isBetterScore(def, a.score, d.arcade.records[def.id])) {
          newRecord = d.arcade.records[def.id] !== undefined;
          d.arcade.records[def.id] = a.score;
        }
      }
      sound(c, a.won ? 'fanfare' : 'claim');
      c.fx.push({ type: 'save' });
      return { ok: true, value: payout, newRecord };
    }

    case 'ARCADE_QUIT': {
      const run = d.ui.activeRun;
      if (!run || run.runId !== a.runId) return fail('stale');
      d.ui.activeRun = null;
      sound(c, 'click');
      return OK;
    }

    case 'CLAIM_QUEST': {
      const quest = QUESTS.find((q) => q.id === a.id);
      if (!quest || !canClaimQuest(base, quest)) return fail('not_ready');
      grantQuestReward(d, quest);
      if (quest.kind === 'DAILY') d.quests.daily.claimed.push(quest.id);
      else d.quests.claimed.push(quest.id);
      sound(c, 'goal');
      return { ok: true, value: quest.rewardAmount };
    }

    case 'CLAIM_ALL_CLEAR': {
      if (!canClaimAllClear(base)) return fail('not_ready');
      addCurrency(d, 'void_crystals', DAILY_ALL_CLEAR_REWARDS.crystals);
      addCurrency(d, 'astral_shards', DAILY_ALL_CLEAR_REWARDS.shards);
      addCurrency(d, 'essence', DAILY_ALL_CLEAR_REWARDS.essence);
      grantTokens(d, DAILY_ALL_CLEAR_REWARDS.tokens, false);
      d.quests.daily.allClearClaimed = true;
      sound(c, 'fanfare');
      return OK;
    }

    case 'AD_REWARD': {
      const def = ADS.find((x) => x.id === a.placementId);
      if (!def) return fail('unknown');
      const watched = adWatchesToday(base, def.id, c.today);
      if (watched >= def.dailyCap) return fail('capped');
      if (def.rewardKind === 'OFFLINE_DOUBLE') {
        const pending = d.ui.pendingOffline;
        if (!pending || pending.doubled) return fail('nothing_to_double');
        addCurrency(d, 'essence', pending.amount);
        pending.doubled = true;
      } else if (def.rewardKind === 'TOKEN') {
        grantTokens(d, Math.max(1, Math.round(def.rewardAmount)), false);
      } else {
        addCurrency(d, 'essence', Math.round(c.stats.rewardRate * def.rewardAmount));
      }
      // Counted after the grant: a watch that yields nothing never costs an offer (M14 §2).
      d.shop.adWatches[def.id] = { date: c.today, count: watched + 1 };
      sound(c, 'claim');
      c.fx.push({ type: 'save' });
      return OK;
    }

    case 'PURCHASE_GRANTED':
    case 'RESTORE_ENTITLEMENTS': {
      const ids = a.type === 'PURCHASE_GRANTED' ? [a.productId] : a.productIds;
      if (a.type === 'PURCHASE_GRANTED' && a.transactionId) {
        if (d.shop.processedTransactions.includes(a.transactionId)) return fail('already_granted');
        d.shop.processedTransactions.push(a.transactionId);
        if (d.shop.processedTransactions.length > PROCESSED_TRANSACTIONS_KEPT) {
          d.shop.processedTransactions.splice(0, d.shop.processedTransactions.length - PROCESSED_TRANSACTIONS_KEPT);
        }
      }
      let granted = 0;
      for (const id of ids) {
        const product = PRODUCTS.find((p) => p.id === id || p.storeId === id);
        if (!product) continue;
        if (product.consumable) {
          if (a.type === 'RESTORE_ENTITLEMENTS') continue;
          addCurrency(d, 'astral_shards', product.shards ?? 0);
          addCurrency(d, 'void_crystals', product.crystals ?? 0);
          granted++;
          continue;
        }
        if (d.shop.entitlements.includes(product.id)) continue;
        d.shop.entitlements.push(product.id);
        addCurrency(d, 'void_crystals', product.crystals ?? 0);
        if (product.tokens) grantTokens(d, product.tokens, false);
        if (product.cosmeticId && !d.shop.ownedCosmetics.includes(product.cosmeticId)) {
          d.shop.ownedCosmetics.push(product.cosmeticId);
        }
        granted++;
      }
      if (granted > 0) {
        sound(c, 'fanfare');
        c.fx.push({ type: 'save' });
      }
      return { ok: granted > 0, value: granted };
    }

    case 'BUY_COSMETIC': {
      const cos = COSMETICS.find((x) => x.id === a.id);
      if (!cos) return fail('unknown');
      if (d.shop.ownedCosmetics.includes(a.id) || cos.shardPrice <= 0) {
        if (!d.shop.ownedCosmetics.includes(a.id)) d.shop.ownedCosmetics.push(a.id);
        d.shop.activeCosmeticId = a.id;
        return OK;
      }
      if (!spend(d, 'astral_shards', cos.shardPrice)) return fail('not_enough');
      d.shop.ownedCosmetics.push(a.id);
      d.shop.activeCosmeticId = a.id;
      sound(c, 'confirm');
      return OK;
    }

    case 'SET_COSMETIC': {
      const cos = COSMETICS.find((x) => x.id === a.id);
      if (!cos || (!d.shop.ownedCosmetics.includes(a.id) && cos.shardPrice > 0)) return fail('not_owned');
      d.shop.activeCosmeticId = a.id;
      sound(c, 'click');
      return OK;
    }

    case 'UPDATE_SETTINGS': {
      const p = a.partial;
      const clamp01 = (v: unknown, fallback: number) =>
        typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
      const s = d.settings;
      if ('sfxVolume' in p) s.sfxVolume = clamp01(p.sfxVolume, s.sfxVolume);
      if ('bgmVolume' in p) s.bgmVolume = clamp01(p.bgmVolume, s.bgmVolume);
      for (const k of ['sfxMuted', 'bgmMuted', 'hapticsEnabled', 'damageNumbers', 'screenShake'] as const) {
        if (k in p && typeof p[k] === 'boolean') s[k] = p[k] as boolean;
      }
      return OK;
    }

    case 'APPLY_OFFLINE': {
      const reward = computeOfflineReward(base, a.secondsAway);
      if (!reward) return fail('none');
      addCurrency(d, 'essence', reward.amount);
      const prev = d.ui.pendingOffline;
      d.ui.pendingOffline =
        prev && !prev.doubled
          ? {
              amount: prev.amount + reward.amount,
              secondsAway: prev.secondsAway + reward.secondsAway,
              wasCapped: prev.wasCapped || reward.wasCapped,
              doubled: false,
            }
          : { ...reward, doubled: false };
      return { ok: true, value: reward.amount };
    }

    case 'DISMISS_OFFLINE':
      d.ui.pendingOffline = null;
      return OK;

    case 'CLOSE_WORLD_MODAL':
      d.ui.worldUnlockModal = null;
      return OK;

    case 'MARK_TUTORIAL_SEEN':
      d.tutorialsSeen[a.id] = true;
      return OK;
  }
}

/**
 * The whole game, as a pure function of (state, action, time, randomness). Side effects come
 * back as `fx` for the store to run after committing; the return value of the action comes
 * back as `result`, synchronously, so the UI never has to guess whether a purchase went through.
 */
export function reduce(state: GameState, action: Action, ctx: ReduceContext): ReduceOutput {
  const c: Ctx = { ...ctx, fx: [], stats: selectStats(state) };
  let result: ActionResult = OK;
  const next = produce(state, (d) => {
    result = handle(d, action, c, state);
  });
  return { state: next, fx: c.fx, result };
}

/** Starts a fresh run at level 1 with a real enemy rather than the placeholder. */
export function withFreshEnemy(state: GameState, rng: Rng): GameState {
  return produce(state, (d) => {
    const c: Ctx = { now: 0, today: '', rng, fx: [], stats: selectStats(state) };
    const level = Math.max(1, d.combat.level);
    if (level % 10 === 0) {
      // Never resume straight into a running boss timer (the offline modal may be up):
      // farm below the gate, one tap from CHALLENGE BOSS.
      d.combat.mode = 'FARM_MODE';
      d.combat.level = level - 1;
      spawnEnemy(d, c, level - 1, false);
    } else {
      if (d.combat.mode === 'BOSS_FIGHT') d.combat.mode = 'NORMAL';
      d.combat.level = level;
      spawnEnemy(d, c, level, false);
    }
    d.combat.autoAcc = 0;
    d.ui.tapGuard = freshTapGuard();
  });
}
