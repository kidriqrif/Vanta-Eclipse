import { CARD_RARITIES, COSMETICS, PETS, PRODUCTS, QUESTS, RELICS, SKILLS, SLOTS, UPGRADES } from '../data/definitions';
import type { Card, CurrencyType, Item, ItemRarity, OwnedPet, OwnedRelic } from '../types/game';
import { withFreshEnemy } from './reducer';
import type { Rng } from './rng';
import {
  DEFAULT_CURRENCIES,
  DEFAULT_SETTINGS,
  SAVE_VERSION,
  TOKEN_CAP,
  createInitialState,
  freshDaily,
  freshUi,
  localDateKey,
  type CombatMode,
  type GameState,
} from './state';

/** The key predates the versioned format; a `version` field inside tells the formats apart. */
export const SAVE_KEY = 'vanta_eclipse_save_v1';
/** The last save that loaded successfully, kept in case the main one is ever corrupted. */
export const BACKUP_KEY = 'vanta_eclipse_save_backup';
/** A one-time copy of an original v1 save, taken before it is first migrated. */
export const PREMIGRATION_KEY = 'vanta_eclipse_save_v1_premigration';
/** Tutorial flags lived under their own key before v2. */
export const LEGACY_TUTORIAL_KEY = 'vanta_eclipse_tutorials';

export interface SaveStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const localStorageAdapter: SaveStorage = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      // Storage full or unavailable: the game keeps running; the next save retries.
    }
  },
  remove: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      // ignore
    }
  },
};

type Loose = Record<string, unknown>;

const isObj = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, min = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, v) : fallback;
const int = (v: unknown, fallback: number, min = 0): number => Math.floor(num(v, fallback, min));
const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const uniq = <T,>(xs: T[]) => Array.from(new Set(xs));

const VALID_SLOTS = new Set(SLOTS.filter((s) => !s.sealed).map((s) => s.id));
const VALID_SKILLS = new Map(SKILLS.map((s) => [s.id, s.maxLevel]));
const VALID_UPGRADES = new Map(UPGRADES.map((u) => [u.id, u.maxLevel]));
const VALID_PETS = new Set(PETS.map((p) => p.id));
const VALID_RELICS = new Set(RELICS.map((r) => r.id));
const VALID_COSMETICS = new Set(COSMETICS.map((c) => c.id));
const VALID_CARD_RARITIES = new Set(CARD_RARITIES.map((r) => r.id));
const NON_CONSUMABLES = new Set(PRODUCTS.filter((p) => !p.consumable).map((p) => p.id));
const LIFETIME_QUESTS = new Set(QUESTS.filter((q) => q.kind !== 'DAILY').map((q) => q.id));
const DAILY_QUESTS = new Set(QUESTS.filter((q) => q.kind === 'DAILY').map((q) => q.id));

function cleanCounters(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (isObj(v)) for (const [k, x] of Object.entries(v)) if (typeof x === 'number' && Number.isFinite(x) && x > 0) out[k] = x;
  return out;
}

function cleanLevels(v: unknown, valid: Map<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(v)) return out;
  for (const [k, x] of Object.entries(v)) {
    if (!valid.has(k)) continue;
    const max = valid.get(k)!;
    const lvl = int(x, 0);
    if (lvl > 0) out[k] = max > 0 ? Math.min(max, lvl) : lvl;
  }
  return out;
}

function cleanItem(v: unknown, nextId: () => number, forcedSlot?: string): Item | null {
  if (!isObj(v)) return null;
  const slot = forcedSlot ?? str(v.slot, '');
  if (!VALID_SLOTS.has(slot) || (forcedSlot && v.slot !== undefined && v.slot !== forcedSlot)) return null;
  const rarity = Math.min(4, int(v.rarity, 0)) as ItemRarity;
  const affixes: Record<string, number> = {};
  if (isObj(v.affixes)) {
    for (const [k, x] of Object.entries(v.affixes)) if (typeof x === 'number' && Number.isFinite(x) && x > 0) affixes[k] = x;
  }
  return { id: nextId(), slot, rarity, itemLevel: int(v.itemLevel, 1, 1), affixes, seen: v.seen !== false };
}

function cleanCard(v: unknown, nextId: () => number, now: number): Card | null {
  if (!isObj(v)) return null;
  const rarity = str(v.rarity, 'common');
  return {
    id: nextId(),
    bossId: str(v.bossId, 'unknown'),
    bossName: str(v.bossName, 'Unknown'),
    rarity: VALID_CARD_RARITIES.has(rarity) ? rarity : 'common',
    level: int(v.level, 1, 1),
    power: int(v.power, 1, 1),
    vigor: int(v.vigor, 1, 1),
    obtainedAt: num(v.obtainedAt, now),
  };
}

/**
 * Maps the original flat v1 save (written by the AI Studio build) onto the v2 shape. It is
 * deliberately conservative:
 *  - minigame records are dropped: v1 recorded losses and kept some of them backwards;
 *  - "purchases" of Remove Ads / Starter Pack are dropped: v1 granted them without payment.
 *    Their contents (crystals, tokens, the Ember Trail) stay with the player.
 */
function fromV1(v1: Loose, now: number, today: string): Loose {
  const purchased = strArr(v1.purchasedProducts);
  const sameDay = v1.lastDailyDate === today;
  return {
    version: SAVE_VERSION,
    currencies: v1.currencies,
    combat: { mode: 'NORMAL', level: v1.enemyLevel },
    peakRunLevel: v1.peakRunLevel,
    lifetimePeakLevel: v1.lifetimePeakLevel,
    eclipseCount: v1.eclipseCount,
    unlockedWorlds: v1.unlockedWorlds,
    upgrades: v1.upgradeLevels,
    equipped: v1.equipped,
    inventory: v1.inventory,
    cards: v1.cards,
    pets: v1.ownedPets,
    activePetId: v1.activePetId,
    relicsAwakened: v1.relicsAwakened,
    relics: v1.ownedRelics,
    activeRelicId: v1.activeRelicId,
    skills: v1.skillLevels,
    arcade: { tokens: v1.tokens, regenAnchor: v1.timestamp, records: {} },
    quests: {
      counters: v1.questCounters,
      claimed: v1.claimedQuests,
      daily: sameDay
        ? {
            date: today,
            ids: v1.activeDailyIds,
            counters: v1.dailyQuestCounters,
            claimed: v1.dailyClaimedQuests,
            allClearClaimed: v1.dailyAllClearClaimed,
          }
        : undefined,
    },
    shop: {
      entitlements: [],
      ownedCosmetics: purchased.filter((p) => VALID_COSMETICS.has(p)),
      activeCosmeticId: v1.activeCosmeticId,
      adWatches: v1.adWatchCounts,
      processedTransactions: [],
    },
    settings: v1.settings,
    savedAt: num(v1.timestamp, now),
  };
}

/** Turns any parsed save (current or migrated) into a valid GameState. Never throws. */
export function sanitize(raw: Loose, now: number, rng: Rng, legacyTutorials?: Loose): GameState {
  const base = createInitialState(now);
  const today = localDateKey(now);
  let counter = 1;
  const nextId = () => counter++;

  const currencies = { ...DEFAULT_CURRENCIES };
  if (isObj(raw.currencies)) {
    for (const k of Object.keys(DEFAULT_CURRENCIES) as CurrencyType[]) currencies[k] = num(raw.currencies[k], 0);
  }

  const equipped: Record<string, Item> = {};
  if (isObj(raw.equipped)) {
    for (const [slot, v] of Object.entries(raw.equipped)) {
      const item = cleanItem(v, nextId, slot);
      if (item) equipped[slot] = item;
    }
  }
  const inventory = (Array.isArray(raw.inventory) ? raw.inventory : [])
    .map((v) => cleanItem(v, nextId))
    .filter((x): x is Item => !!x);
  const cards = (Array.isArray(raw.cards) ? raw.cards : [])
    .map((v) => cleanCard(v, nextId, now))
    .filter((x): x is Card => !!x)
    .slice(0, 200);

  const pets: Record<string, OwnedPet> = {};
  if (isObj(raw.pets)) {
    for (const [id, v] of Object.entries(raw.pets)) {
      if (!VALID_PETS.has(id) || !isObj(v)) continue;
      pets[id] = { xp: num(v.xp, 0), seen: v.seen !== false, absorbed: Math.min(0.5, num(v.absorbed, 0)) };
    }
  }
  const relicIds = uniq(
    (Array.isArray(raw.relics) ? raw.relics : [])
      .map((r) => (isObj(r) ? str(r.id, '') : ''))
      .filter((id) => VALID_RELICS.has(id)),
  );
  const relics: OwnedRelic[] = relicIds.map((id) => {
    const original = (raw.relics as unknown[]).find((r) => isObj(r) && r.id === id) as Loose | undefined;
    return { id, seen: original?.seen !== false };
  });

  const activePetId = typeof raw.activePetId === 'string' && pets[raw.activePetId] ? raw.activePetId : null;
  const activeRelicId =
    typeof raw.activeRelicId === 'string' && relicIds.includes(raw.activeRelicId) ? raw.activeRelicId : null;

  const combatRaw = isObj(raw.combat) ? raw.combat : {};
  const mode: CombatMode = combatRaw.mode === 'FARM_MODE' || combatRaw.mode === 'BOSS_FIGHT' ? combatRaw.mode : 'NORMAL';
  const level = int(combatRaw.level, 1, 1);
  const peakRunLevel = Math.max(level, int(raw.peakRunLevel, 1, 1));
  const lifetimePeakLevel = Math.max(peakRunLevel, int(raw.lifetimePeakLevel, 1, 1));

  const arcadeRaw = isObj(raw.arcade) ? raw.arcade : {};
  const records: Record<string, number> = {};
  if (isObj(arcadeRaw.records)) {
    for (const [k, v] of Object.entries(arcadeRaw.records)) if (typeof v === 'number' && Number.isFinite(v)) records[k] = v;
  }
  const anchor = num(arcadeRaw.regenAnchor, now);

  const questsRaw = isObj(raw.quests) ? raw.quests : {};
  const dailyRaw = isObj(questsRaw.daily) ? questsRaw.daily : null;
  const daily =
    dailyRaw && dailyRaw.date === today
      ? {
          date: today,
          ids: (() => {
            const ids = strArr(dailyRaw.ids).filter((id) => DAILY_QUESTS.has(id));
            return ids.length > 0 ? ids : freshDaily(today).ids;
          })(),
          counters: cleanCounters(dailyRaw.counters),
          claimed: uniq(strArr(dailyRaw.claimed).filter((id) => DAILY_QUESTS.has(id))),
          allClearClaimed: dailyRaw.allClearClaimed === true,
        }
      : freshDaily(today);

  const shopRaw = isObj(raw.shop) ? raw.shop : {};
  const ownedCosmetics = uniq(['trail_void', ...strArr(shopRaw.ownedCosmetics).filter((c) => VALID_COSMETICS.has(c))]);
  const activeCosmeticId = str(shopRaw.activeCosmeticId, 'trail_void');
  const adWatches: GameState['shop']['adWatches'] = {};
  if (isObj(shopRaw.adWatches)) {
    for (const [k, v] of Object.entries(shopRaw.adWatches)) {
      if (isObj(v) && typeof v.date === 'string') adWatches[k] = { date: v.date, count: int(v.count, 0) };
    }
  }

  const settings = { ...DEFAULT_SETTINGS };
  if (isObj(raw.settings)) {
    for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof typeof DEFAULT_SETTINGS)[]) {
      const v = raw.settings[k];
      if (typeof v === typeof DEFAULT_SETTINGS[k]) (settings as Record<string, unknown>)[k] = typeof v === 'number' ? Math.min(1, Math.max(0, v)) : v;
    }
  }

  const tutorialsSeen: Record<string, boolean> = {};
  for (const src of [legacyTutorials, raw.tutorialsSeen]) {
    if (isObj(src)) for (const [k, v] of Object.entries(src)) if (v === true) tutorialsSeen[k] = true;
  }

  const unlockedWorlds = uniq(['dark_forest', ...strArr(raw.unlockedWorlds).filter((w) => w === 'frozen_ruins')]);

  const state: GameState = {
    ...base,
    currencies,
    combat: { ...base.combat, mode, level },
    peakRunLevel,
    lifetimePeakLevel,
    eclipseCount: int(raw.eclipseCount, 0),
    unlockedWorlds,
    upgrades: cleanLevels(raw.upgrades, VALID_UPGRADES),
    equipped,
    inventory,
    cards,
    pets,
    activePetId,
    relicsAwakened: raw.relicsAwakened === true || unlockedWorlds.includes('frozen_ruins') || relics.length > 0,
    relics,
    activeRelicId,
    skills: cleanLevels(raw.skills, VALID_SKILLS),
    arcade: { tokens: Math.min(99, int(arcadeRaw.tokens, TOKEN_CAP)), regenAnchor: Math.min(anchor, now), records },
    quests: {
      counters: cleanCounters(questsRaw.counters),
      daily,
      claimed: uniq(strArr(questsRaw.claimed).filter((id) => LIFETIME_QUESTS.has(id))),
    },
    shop: {
      entitlements: uniq(strArr(shopRaw.entitlements).filter((e) => NON_CONSUMABLES.has(e))),
      ownedCosmetics,
      activeCosmeticId: ownedCosmetics.includes(activeCosmeticId) ? activeCosmeticId : 'trail_void',
      adWatches,
      processedTransactions: uniq(strArr(shopRaw.processedTransactions)).slice(-200),
    },
    settings,
    tutorialsSeen,
    nextId: counter,
    savedAt: Math.min(num(raw.savedAt, now), now),
    ui: freshUi(),
  };
  return withFreshEnemy(state, rng);
}

export interface LoadResult {
  state: GameState;
  /** Where the state came from: a save, the backup after the main save failed, or a new game. */
  source: 'save' | 'backup' | 'new';
  migratedFromV1: boolean;
}

function parse(raw: string | null): Loose | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return isObj(v) ? v : null;
  } catch {
    return null;
  }
}

function legacyTutorialsFrom(storage: SaveStorage): Loose | undefined {
  const t = parse(storage.get(LEGACY_TUTORIAL_KEY));
  return t ?? undefined;
}

/** Parses a save string (from storage or an import) into a state, migrating v1. */
export function deserialize(raw: string, now: number, rng: Rng, legacyTutorials?: Loose): { state: GameState; migratedFromV1: boolean } | null {
  const parsed = parse(raw);
  if (!parsed) return null;
  const isV1 = parsed.version === undefined;
  const today = localDateKey(now);
  const loose = isV1 ? fromV1(parsed, now, today) : parsed;
  return { state: sanitize(loose, now, rng, legacyTutorials), migratedFromV1: isV1 };
}

export function loadGame(storage: SaveStorage, now: number, rng: Rng): LoadResult {
  const legacy = legacyTutorialsFrom(storage);
  const mainRaw = storage.get(SAVE_KEY);
  const main = mainRaw ? deserialize(mainRaw, now, rng, legacy) : null;
  if (main && mainRaw) {
    if (main.migratedFromV1 && !storage.get(PREMIGRATION_KEY)) storage.set(PREMIGRATION_KEY, mainRaw);
    storage.set(BACKUP_KEY, mainRaw);
    return { state: main.state, source: 'save', migratedFromV1: main.migratedFromV1 };
  }
  const backupRaw = storage.get(BACKUP_KEY);
  const backup = backupRaw ? deserialize(backupRaw, now, rng, legacy) : null;
  if (backup) return { state: backup.state, source: 'backup', migratedFromV1: backup.migratedFromV1 };
  const fresh = withFreshEnemy(createInitialState(now), rng);
  return { state: legacy ? { ...fresh, tutorialsSeen: sanitize({}, now, rng, legacy).tutorialsSeen } : fresh, source: 'new', migratedFromV1: false };
}

/** Everything except the session-only `ui` slice, stamped with the save time. */
export function serialize(state: GameState, now: number): string {
  const { ui: _ui, ...persisted } = state;
  return JSON.stringify({ ...persisted, version: SAVE_VERSION, savedAt: now });
}

export function writeSave(storage: SaveStorage, state: GameState, now: number): void {
  storage.set(SAVE_KEY, serialize(state, now));
}
