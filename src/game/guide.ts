import { COSMETICS, MINIGAMES, PETS, SKILLS, UPGRADES, getForgeCost } from '../data/definitions';
import { formatNumber, formatPercent } from '../utils/numberFormat';
import { LOSS_FLOOR } from './arcade';
import { BASE_OFFLINE_CAP_HOURS, BASE_OFFLINE_EFFICIENCY } from './offline';
import { hasClaimableQuest } from './quests';
import {
  FROSTLING_DROP_CHANCE,
  PET_XP_PER_KILL,
  RELIC_DROP_CHANCE,
  affordableUpgrades,
  skillBlocker,
} from './reducer';
import {
  ARCADE_UNLOCK_LEVEL,
  AUTO_ATTACK_UNLOCK_LEVEL,
  BOSS_FIGHT_SECONDS,
  CARD_COLLECTION_CAP,
  ECLIPSE_UNLOCK_LEVEL,
  TOKEN_CAP,
  TOKEN_REGEN_MS,
  WORLD_TWO_FIRST_LEVEL,
  type GameState,
} from './state';
import { PET_ABSORB_CAP, isAutoAttackUnlocked } from './stats';

/**
 * The guide: one-time tips that teach each system the moment the player first meets it, and a
 * "how it works" card for every tab. Everything here is pure, so what fires when is unit-tested
 * (src/game/__tests__/guide.test.ts). Seen flags live in state.tutorialsSeen:
 *   - a tip's own id ("gear", "cards", ...) once it is acknowledged;
 *   - `tab:<TAB>` once the tab has been opened (clears its NEW marker);
 *   - `help:<TAB>` once its first-visit "how it works" card has been dismissed.
 */

/** The game's tabs. NavigationTabs re-exports this as TabType. */
export type GuideTab = 'UPGRADES' | 'GEAR' | 'JOURNAL' | 'CARDS' | 'PETS' | 'RELICS' | 'ECLIPSE' | 'ARCADE' | 'SHOP';

/** The tabs that live in the MORE sheet, so copy can say where they are. */
export const MORE_TABS: readonly GuideTab[] = ['CARDS', 'PETS', 'RELICS', 'ECLIPSE', 'SHOP'];

/** The label each tab shows in the nav bar. */
export const TAB_LABEL: Record<GuideTab, string> = {
  UPGRADES: 'UPGRADES',
  GEAR: 'ARMOR',
  JOURNAL: 'CODEX',
  CARDS: 'CARDS',
  PETS: 'BEAST',
  RELICS: 'RELICS',
  ECLIPSE: 'ECLIPSE',
  ARCADE: 'ARCADE',
  SHOP: 'BAZAAR',
};

export interface GuideStep {
  /** Stable save key. Never rename one: old saves remember it. */
  id: string;
  title: string;
  lines: string[];
  /** The tab the tip is about; the tip offers to open it. */
  tab?: GuideTab;
  /** True once the player has met the thing this tip teaches. */
  due: (s: GameState) => boolean;
  /** True once the player has clearly learned it already: the tip is skipped, never shown. */
  known?: (s: GameState) => boolean;
}

const count = (s: GameState, metric: string) => s.quests.counters[metric] || 0;
const pct = (v: number) => formatPercent(v, 0).replace(/^\+/, '');
const cheapestTrail = Math.min(...COSMETICS.filter((c) => c.shardPrice > 0).map((c) => c.shardPrice));
const laterGames = [...new Set(MINIGAMES.map((m) => m.unlockLevel).filter((l) => l > ARCADE_UNLOCK_LEVEL))].sort((a, b) => a - b);
const evolveAt = Math.min(...PETS.flatMap((p) => p.evolutionLevels));

function joinLevels(levels: number[]): string {
  const parts = levels.map((l) => formatNumber(l));
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * Every tip, in priority order: when several are due at once, the first one here shows first,
 * and the rest wait their turn (see GUIDE_GAP_MS in the OnboardingManager).
 */
export const GUIDE: GuideStep[] = [
  {
    id: 'welcome',
    title: 'WELCOME TO VANTA ECLIPSE',
    lines: [
      'Tap the enemy to strike it. Every kill pays essence and takes you one level deeper.',
      'Your next goal is always shown above the tabs. Tap it to see the whole path in CODEX.',
    ],
    due: () => true,
    known: (s) => s.lifetimePeakLevel > 5,
  },
  {
    // Kept as "forge" from the first React build, so players who saw it there are not shown it again.
    id: 'forge',
    title: 'BUY YOUR FIRST UPGRADE',
    lines: [
      'You have enough essence for an upgrade. UPGRADES makes every hit stronger: tap damage, critical hits and essence per kill.',
      'Stronger hits climb faster. Check back whenever the essence piles up.',
    ],
    tab: 'UPGRADES',
    due: (s) => UPGRADES.some((u) => affordableUpgrades(s, u.id, 1).count > 0),
    known: (s) => count(s, 'upgrades_bought') > 0,
  },
  {
    id: 'bosses',
    title: 'A BOSS IS NEAR',
    lines: [
      `Every 10th level is a boss. Beat it within ${formatNumber(BOSS_FIGHT_SECONDS)} seconds to pass.`,
      'If time runs out you farm the level below. Get stronger, then tap CHALLENGE BOSS. Bosses always drop gear and a card.',
    ],
    due: (s) => s.lifetimePeakLevel >= 9,
    known: (s) => count(s, 'boss_wins') > 0,
  },
  {
    // Not "gear": the first React build used that id for a different tip, and old saves carry it.
    id: 'first_gear',
    title: 'YOU FOUND GEAR',
    lines: [
      'Open ARMOR, tap the new item, then EQUIP. Its stats add to yours at once.',
      'Bosses always drop gear and enemies sometimes do. Gear is kept through an Eclipse.',
    ],
    tab: 'GEAR',
    due: (s) => count(s, 'items_dropped') > 0 || s.inventory.length > 0,
    known: (s) => Object.keys(s.equipped).length > 0,
  },
  {
    id: 'farm',
    title: 'THE BOSS HELD',
    lines: [
      'You are farming the level below it. Every kill still pays essence and can drop gear.',
      'To get stronger: buy upgrades, equip better gear, then tap CHALLENGE BOSS. HOLD LEVEL farms like this whenever you like.',
    ],
    tab: 'UPGRADES',
    due: (s) =>
      s.combat.mode === 'FARM_MODE' && (s.combat.level + 1) % 10 === 0 && s.lifetimePeakLevel > s.combat.level,
    known: (s) => count(s, 'boss_wins') >= 5,
  },
  {
    id: 'codex',
    title: 'A GOAL IS COMPLETE',
    lines: [
      'Claim its reward in CODEX. A ! on CODEX means something is ready.',
      'CHAIN goals walk you through the game one step at a time; DAILY goals refresh every day.',
    ],
    tab: 'JOURNAL',
    due: hasClaimableQuest,
    known: (s) => s.quests.claimed.length > 0 || s.quests.daily.claimed.length > 0,
  },
  {
    id: 'auto',
    title: 'AUTO-ATTACK ONLINE',
    lines: [
      'You now strike on your own, even while you browse the other tabs. Tapping still adds damage.',
      `You also earn while away: ${pct(BASE_OFFLINE_EFFICIENCY)} of your rate for up to ${formatNumber(BASE_OFFLINE_CAP_HOURS)} hours. Each run, auto-attack starts at level ${formatNumber(AUTO_ATTACK_UNLOCK_LEVEL)}.`,
    ],
    due: isAutoAttackUnlocked,
  },
  {
    // Not "cards", for the same reason as first_gear.
    id: 'boss_cards',
    title: 'BOSS CARDS',
    lines: [
      'Every boss you beat drops a card. They wait in CARDS, under MORE.',
      `From level ${formatNumber(WORLD_TWO_FIRST_LEVEL)} you have a companion, and it can absorb cards to grow faster and stronger.`,
    ],
    tab: 'CARDS',
    due: (s) => s.cards.length > 0,
    known: (s) => count(s, 'cards_absorbed') > 0,
  },
  {
    id: 'salvage',
    title: 'SALVAGE AND FORGE',
    lines: [
      'Gear you will not wear can be salvaged in ARMOR for Void Scraps. Equipped gear is safe.',
      'Spend scraps at the forge for a new item in the slot you choose.',
    ],
    tab: 'GEAR',
    due: (s) => s.inventory.length >= 4 || s.currencies.void_scraps >= getForgeCost(s.combat.level),
    known: (s) => count(s, 'salvage') > 0 && count(s, 'forge') > 0,
  },
  {
    id: 'arcade',
    title: 'THE ARCADE IS OPEN',
    lines: [
      `Short minigames that pay essence. Each costs a token; tokens refill 1 every ${formatNumber(TOKEN_REGEN_MS / 60_000)} minutes, up to ${formatNumber(TOKEN_CAP)}.`,
      `A win pays the most, a loss still pays ${pct(LOSS_FLOOR)}. More games open at levels ${joinLevels(laterGames)}.`,
    ],
    tab: 'ARCADE',
    due: (s) => s.lifetimePeakLevel >= ARCADE_UNLOCK_LEVEL,
    known: (s) => count(s, 'minigame_played') > 0,
  },
  {
    id: 'eclipse',
    title: 'THE ECLIPSE AWAITS',
    lines: [
      `This run reached level ${formatNumber(ECLIPSE_UNLOCK_LEVEL)}, so ECLIPSE (under MORE) can end it for Void Crystals. The deeper the run, the more crystals.`,
      'You restart at level 1 without essence or upgrades. Gear, cards, companions and relics are always kept.',
    ],
    tab: 'ECLIPSE',
    due: (s) => s.peakRunLevel >= ECLIPSE_UNLOCK_LEVEL,
    known: (s) => s.eclipseCount > 0,
  },
  {
    id: 'ruins',
    title: 'A COMPANION JOINS YOU',
    lines: [
      `Ember fights at your side and gains ${formatNumber(PET_XP_PER_KILL)} XP from every kill. It evolves at level ${formatNumber(evolveAt)}. Meet it in BEAST, under MORE.`,
      `Feed it boss cards in CARDS to grow faster. Bosses here can also drop relics (${pct(RELIC_DROP_CHANCE)} each).`,
    ],
    tab: 'PETS',
    due: (s) => s.relicsAwakened,
  },
  {
    id: 'relic',
    title: 'YOU FOUND A RELIC',
    lines: [
      'A relic is one permanent power. Attune it in RELICS, under MORE.',
      'Only one works at a time, and swapping is always free.',
    ],
    tab: 'RELICS',
    due: (s) => s.relics.length > 0,
    known: (s) => s.activeRelicId !== null,
  },
  {
    id: 'powers',
    title: 'ASCENDANT POWERS',
    lines: [
      'Void Crystals buy Ascendant Powers in ECLIPSE, under MORE. They are permanent and never reset.',
      'Some powers need another one first; the tree shows what each one needs.',
    ],
    tab: 'ECLIPSE',
    due: (s) => s.eclipseCount > 0 || SKILLS.some((k) => skillBlocker(s, k.id) === null),
    known: (s) => count(s, 'skills_bought') > 0,
  },
  {
    id: 'trails',
    title: 'TAP TRAILS',
    lines: [
      `You have enough Astral Shards for a tap trail in BAZAAR, under MORE. Trails change how your hits look, nothing else.`,
      'Shards come from CODEX goals.',
    ],
    tab: 'SHOP',
    due: (s) => s.currencies.astral_shards >= cheapestTrail,
    known: (s) => s.shop.ownedCosmetics.length > 1,
  },
];

export const GUIDE_IDS = GUIDE.map((g) => g.id);

/** Something else owns the screen: a tip may not start now (it waits, it is never lost). */
export function isGuideBlocked(s: GameState): boolean {
  return (
    s.ui.pendingOffline !== null ||
    s.ui.worldUnlockModal !== null ||
    s.ui.activeRun !== null ||
    s.combat.mode === 'BOSS_FIGHT'
  );
}

/** Whether a tip still has something to teach: it is due, unseen, and not already learned. */
export function isGuidePending(s: GameState, step: GuideStep): boolean {
  return !s.tutorialsSeen[step.id] && step.due(s) && !(step.known?.(s) ?? false);
}

/** The tip to show next, or null. Ignores blocking; see isGuideBlocked. */
export function nextGuideStep(s: GameState): GuideStep | null {
  return GUIDE.find((g) => isGuidePending(s, g)) ?? null;
}

/** The tips the player has reached so far (seen, due or already learned), for the Guide in Settings. */
export function reachedGuideSteps(s: GameState): GuideStep[] {
  return GUIDE.filter((g) => s.tutorialsSeen[g.id] || g.due(s));
}

// ------------------------------------------------------------------ tabs

export const tabVisitKey = (tab: GuideTab) => `tab:${tab}`;
export const tabHelpKey = (tab: GuideTab) => `help:${tab}`;

/**
 * Tabs that just started to matter and have not been opened since: they wear a NEW marker
 * (and light the MORE dot) until the player looks.
 */
export function isTabNew(s: GameState, tab: GuideTab): boolean {
  if (s.tutorialsSeen[tabVisitKey(tab)]) return false;
  switch (tab) {
    case 'ARCADE':
      return s.lifetimePeakLevel >= ARCADE_UNLOCK_LEVEL;
    case 'CARDS':
      return s.cards.length > 0;
    case 'PETS':
      return Object.keys(s.pets).length > 0;
    case 'RELICS':
      return s.relics.length > 0;
    case 'ECLIPSE':
      return isEclipseTabOpen(s);
    case 'SHOP':
      return s.currencies.astral_shards >= cheapestTrail;
    default:
      return false;
  }
}

/** ECLIPSE matters once a run can collapse, or once crystals can buy powers there. */
export function isEclipseTabOpen(s: GameState): boolean {
  return (
    s.peakRunLevel >= ECLIPSE_UNLOCK_LEVEL ||
    s.eclipseCount > 0 ||
    s.currencies.void_crystals > 0 ||
    Object.keys(s.skills).length > 0
  );
}

export interface TabHelp {
  title: string;
  lines: string[];
}

/** The "how it works" card of each tab: shown on the first visit, and again from its ? button. */
export const TAB_HELP: Record<GuideTab, TabHelp> = {
  UPGRADES: {
    title: 'HOW UPGRADES WORK',
    lines: [
      'Essence buys upgrades that make every hit stronger. Prices rise with each level.',
      'x1, x10 and x25 buy exactly that many; MAX buys as many as you can afford.',
      'An Eclipse resets upgrades. That is how each new run starts stronger.',
    ],
  },
  GEAR: {
    title: 'HOW ARMOR WORKS',
    lines: [
      'Six slots. Tap a tile or a stored item to see its stats, compare it with what you wear, and EQUIP it.',
      'Rarity, from Common to Mythic: each pip is one more stat line.',
      'Salvage spare gear for Void Scraps, then forge a new item in the slot you pick. Gear is kept through an Eclipse.',
    ],
  },
  JOURNAL: {
    title: 'HOW THE CODEX WORKS',
    lines: [
      'CHAIN: the path through the game, one goal at a time. Follow it if you are unsure what to do next.',
      'DAILY: four new goals every day, plus a bonus for clearing all of them. FEATS: lifetime milestones.',
      'Rewards are claimed by hand: tap CLAIM. A ! on CODEX means something is ready.',
    ],
  },
  CARDS: {
    title: 'HOW CARDS WORK',
    lines: [
      'Every boss you beat drops a card. Rarer cards are stronger.',
      `An active companion can absorb a card: its power becomes XP, and its vigor permanently raises the companion's bonus, up to ${pct(PET_ABSORB_CAP)} in all.`,
      `You keep up to ${formatNumber(CARD_COLLECTION_CAP)} cards; when full, the oldest one goes.`,
    ],
  },
  PETS: {
    title: 'HOW COMPANIONS WORK',
    lines: [
      `Companions awaken in the Frozen Ruins (level ${formatNumber(WORLD_TWO_FIRST_LEVEL)}). The active one gains ${formatNumber(PET_XP_PER_KILL)} XP per kill and evolves at level ${formatNumber(evolveAt)}.`,
      'Only the active companion gives its bonus. Switching is free.',
      `Frozen Ruins bosses have a ${pct(FROSTLING_DROP_CHANCE)} chance to bring a second companion.`,
    ],
  },
  RELICS: {
    title: 'HOW RELICS WORK',
    lines: [
      `Frozen Ruins bosses have a ${pct(RELIC_DROP_CHANCE)} chance to drop a relic you do not have yet.`,
      'Each relic is one permanent power. Attune one at a time; swapping is free.',
    ],
  },
  ECLIPSE: {
    title: 'HOW THE ECLIPSE WORKS',
    lines: [
      `From level ${formatNumber(ECLIPSE_UNLOCK_LEVEL)} in a run, collapse it for Void Crystals. The deeper the run, the more you get.`,
      'It resets essence, upgrades and your level. Gear, cards, companions, relics and powers are kept.',
      'Spend crystals below on Ascendant Powers: permanent bonuses that make every later run faster.',
    ],
  },
  ARCADE: {
    title: 'HOW THE ARCADE WORKS',
    lines: [
      `Each game costs a token. Tokens refill 1 every ${formatNumber(TOKEN_REGEN_MS / 60_000)} minutes up to ${formatNumber(TOKEN_CAP)}, even while the game is closed.`,
      `Payouts follow your current essence rate. A win pays the most; a loss still pays ${pct(LOSS_FLOOR)}.`,
      'QUIT forfeits the run and its token.',
    ],
  },
  SHOP: {
    title: 'HOW THE BAZAAR WORKS',
    lines: [
      'Bonus offers are optional short videos with a daily limit. Skipping costs you nothing.',
      'Tap trails change how your hits look, nothing else. They cost Astral Shards from CODEX goals.',
    ],
  },
};
