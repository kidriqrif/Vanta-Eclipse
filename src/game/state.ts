import type { Card, CurrencyType, Item, OwnedPet, OwnedRelic, GameSettings } from '../types/game';
import { getDailyQuestIdsForDate } from '../data/definitions';

export const SAVE_VERSION = 2;

export const TOKEN_CAP = 5;
export const TOKEN_REGEN_MS = 30 * 60 * 1000;
export const BOSS_FIGHT_SECONDS = 30;
export const AUTO_ATTACK_UNLOCK_LEVEL = 15;
export const ECLIPSE_UNLOCK_LEVEL = 50;
export const ARCADE_UNLOCK_LEVEL = 20;
export const MIN_OFFLINE_SECONDS = 60;
export const CARD_COLLECTION_CAP = 200;
export const WORLD_TWO_FIRST_LEVEL = 51;

/**
 * NORMAL: climbing; each kill advances a level.
 * BOSS_FIGHT: a timed gate boss at a multiple of 10.
 * FARM_MODE: kills repeat the current level (after a failed boss, or by choice).
 */
export type CombatMode = 'NORMAL' | 'BOSS_FIGHT' | 'FARM_MODE';

export interface EnemyState {
  defId: string;
  level: number;
  maxHp: number;
  hp: number;
  isBoss: boolean;
}

export interface CombatSlice {
  mode: CombatMode;
  level: number;
  enemy: EnemyState;
  bossTimeLeft: number;
  /** Seconds accumulated toward the next auto-attack. */
  autoAcc: number;
}

export interface ArcadeSlice {
  tokens: number;
  /** Wall-clock ms when the current regen period started (reset to now while full). */
  regenAnchor: number;
  /** Best score per minigame id, only from wins. */
  records: Record<string, number>;
}

export interface DailySlice {
  date: string;
  ids: string[];
  counters: Record<string, number>;
  claimed: string[];
  allClearClaimed: boolean;
}

export interface QuestSlice {
  /** Lifetime counters, keyed by metric (kills, taps, ...). */
  counters: Record<string, number>;
  daily: DailySlice;
  /** Chain quests and achievements whose reward has been taken. */
  claimed: string[];
}

export interface AdWatch {
  date: string;
  count: number;
}

export interface ShopSlice {
  /** Non-consumable store purchases: remove_ads, starter_pack. */
  entitlements: string[];
  ownedCosmetics: string[];
  activeCosmeticId: string;
  adWatches: Record<string, AdWatch>;
  /** Google Play transaction ids already granted, so a purchase can never pay out twice. */
  processedTransactions: string[];
}

export interface TapGuardState {
  times: number[];
  xs: number[];
  ys: number[];
  touch: boolean[];
  lockedUntil: number;
  strikes: number;
  lastStrikeAt: number;
}

export interface PendingOffline {
  amount: number;
  secondsAway: number;
  wasCapped: boolean;
  doubled: boolean;
}

export interface ArcadeRun {
  runId: number;
  gameId: string;
}

/** Session-only state. Never written to the save. */
export interface UiSlice {
  pendingOffline: PendingOffline | null;
  worldUnlockModal: string | null;
  tapGuard: TapGuardState;
  combo: { count: number; lastAt: number };
  activeRun: ArcadeRun | null;
  nextRunId: number;
  /** Set when an Eclipse commits, so the overlay can play its flash. */
  eclipseAt: number;
}

export interface GameState {
  version: number;
  currencies: Record<CurrencyType, number>;
  combat: CombatSlice;
  peakRunLevel: number;
  lifetimePeakLevel: number;
  eclipseCount: number;
  unlockedWorlds: string[];
  upgrades: Record<string, number>;
  equipped: Record<string, Item>;
  inventory: Item[];
  cards: Card[];
  pets: Record<string, OwnedPet>;
  activePetId: string | null;
  relicsAwakened: boolean;
  relics: OwnedRelic[];
  activeRelicId: string | null;
  skills: Record<string, number>;
  arcade: ArcadeSlice;
  quests: QuestSlice;
  shop: ShopSlice;
  settings: GameSettings;
  tutorialsSeen: Record<string, boolean>;
  /** Monotonic id source for items and cards. */
  nextId: number;
  /** Wall-clock ms of the last save; the offline reward is measured from here. */
  savedAt: number;
  ui: UiSlice;
}

export const DEFAULT_SETTINGS: GameSettings = {
  sfxVolume: 0.8,
  bgmVolume: 0.5,
  sfxMuted: false,
  bgmMuted: false,
  hapticsEnabled: true,
  damageNumbers: true,
  screenShake: true,
};

export const DEFAULT_CURRENCIES: Record<CurrencyType, number> = {
  essence: 0,
  void_crystals: 0,
  astral_shards: 0,
  void_scraps: 0,
};

/** Local calendar date, the key the daily quests roll over on. */
export function localDateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function freshDaily(date: string): DailySlice {
  return { date, ids: getDailyQuestIdsForDate(date), counters: {}, claimed: [], allClearClaimed: false };
}

export function freshTapGuard(): TapGuardState {
  return { times: [], xs: [], ys: [], touch: [], lockedUntil: 0, strikes: 0, lastStrikeAt: 0 };
}

export function freshUi(): UiSlice {
  return {
    pendingOffline: null,
    worldUnlockModal: null,
    tapGuard: freshTapGuard(),
    combo: { count: 0, lastAt: 0 },
    activeRun: null,
    nextRunId: 1,
    eclipseAt: 0,
  };
}

/** A brand-new game. The enemy is a placeholder until combat.spawn runs (see createNewGame). */
export function createInitialState(now: number): GameState {
  return {
    version: SAVE_VERSION,
    currencies: { ...DEFAULT_CURRENCIES },
    combat: {
      mode: 'NORMAL',
      level: 1,
      enemy: { defId: 'gloom_wisp', level: 1, maxHp: 9, hp: 9, isBoss: false },
      bossTimeLeft: BOSS_FIGHT_SECONDS,
      autoAcc: 0,
    },
    peakRunLevel: 1,
    lifetimePeakLevel: 1,
    eclipseCount: 0,
    unlockedWorlds: ['dark_forest'],
    upgrades: {},
    equipped: {},
    inventory: [],
    cards: [],
    pets: {},
    activePetId: null,
    relicsAwakened: false,
    relics: [],
    activeRelicId: null,
    skills: {},
    arcade: { tokens: TOKEN_CAP, regenAnchor: now, records: {} },
    quests: { counters: {}, daily: freshDaily(localDateKey(now)), claimed: [] },
    shop: {
      entitlements: [],
      ownedCosmetics: ['trail_void'],
      activeCosmeticId: 'trail_void',
      adWatches: {},
      processedTransactions: [],
    },
    settings: { ...DEFAULT_SETTINGS },
    tutorialsSeen: {},
    nextId: 1,
    savedAt: now,
    ui: freshUi(),
  };
}
