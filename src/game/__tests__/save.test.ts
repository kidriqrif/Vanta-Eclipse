import { describe, expect, it } from 'vitest';
import { BACKUP_KEY, LEGACY_TUTORIAL_KEY, PREMIGRATION_KEY, SAVE_KEY, deserialize, loadGame, serialize, type SaveStorage } from '../save';
import { seededRng } from '../rng';
import { localDateKey } from '../state';
import { T0, harness, newGame } from './helpers';

function memoryStorage(initial: Record<string, string> = {}): SaveStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    get: (k) => (k in data ? data[k] : null),
    set: (k, v) => {
      data[k] = v;
    },
    remove: (k) => {
      delete data[k];
    },
  };
}

/** Exactly the shape the AI Studio build wrote, including its known defects. */
function v1Save(overrides: Record<string, unknown> = {}) {
  return {
    timestamp: T0 - 2 * 3600 * 1000,
    currencies: { essence: 1234, void_crystals: 12, astral_shards: 40 }, // no void_scraps: used to crash the header
    enemyLevel: 37,
    peakRunLevel: 37,
    lifetimePeakLevel: 62,
    eclipseCount: 1,
    unlockedWorlds: ['dark_forest'],
    upgradeLevels: { void_claws: 20, dark_focus: 45, bogus: 3 },
    equipped: {
      weapon: { id: 5, slot: 'weapon', rarity: 2, itemLevel: 30, affixes: { tap_flat: 40, crit_chance: 0.02 }, seen: true },
      ring: { id: 5, slot: 'ring', rarity: 9, itemLevel: 30, affixes: { essence: 0.1 } },
    },
    inventory: [
      { id: 5, slot: 'boots', rarity: 0, itemLevel: 10, affixes: { tap_flat: 3 }, seen: false },
      { id: 5, slot: 'boots', rarity: 0, itemLevel: 10, affixes: { tap_flat: 3 }, seen: false },
      { id: 6, slot: 'relic', rarity: 0, itemLevel: 10, affixes: {} },
    ],
    nextItemId: 1,
    cards: [{ id: 1, bossId: 'elder_gloom_wisp', bossName: 'Elder Gloom Wisp', rarity: 'rare', level: 10, power: 120, vigor: 15, obtainedAt: T0 }],
    ownedPets: { ember: { xp: 300, seen: true } },
    activePetId: 'ember',
    relicsAwakened: true,
    ownedRelics: [{ id: 'twin_fang', seen: false }, { id: 'twin_fang', seen: false }],
    activeRelicId: 'twin_fang',
    skillLevels: { abundance: 3, eternal_reflex: 4 },
    tokens: 42,
    minigameRecords: { void_reflex: 999, lights_out: 80 },
    questCounters: { kills: 900, boss_wins: 9 },
    dailyQuestCounters: { daily_kills: 12 },
    completedQuests: ['q_first_blood'],
    claimedQuests: ['q_first_blood', 'd_slayer'],
    dailyClaimedQuests: [],
    dailyAllClearClaimed: false,
    activeDailyIds: ['d_slayer', 'd_bosses', 'd_forge', 'd_arcade'],
    lastDailyDate: localDateKey(T0),
    purchasedProducts: ['remove_ads', 'starter_pack', 'trail_ember', 'trail_frost'],
    activeCosmeticId: 'trail_frost',
    settings: { sfxVolume: 0.3, bgmVolume: 7, sfxMuted: false, bgmMuted: true, hapticsEnabled: true, damageNumbers: false, screenShake: true },
    liveEssenceRate: 55,
    ...overrides,
  };
}

describe('save migration and loading', () => {
  it('migrates a real v1 save, repairing what v1 got wrong', () => {
    const r = deserialize(JSON.stringify(v1Save()), T0, seededRng(1), { welcome: true, forge: true });
    expect(r?.migratedFromV1).toBe(true);
    const s = r!.state;
    expect(s.currencies).toEqual({ essence: 1234, void_crystals: 12, astral_shards: 40, void_scraps: 0 });
    expect(s.combat.level).toBe(37);
    expect(s.combat.enemy.level).toBe(37);
    expect(s.lifetimePeakLevel).toBe(62);
    expect(s.upgrades).toEqual({ void_claws: 20, dark_focus: 30 }); // unknown dropped, max level clamped
    expect(s.equipped.weapon.affixes.tap_flat).toBe(40);
    expect(s.equipped.ring.rarity).toBe(4); // clamped to Mythic
    expect(s.inventory).toHaveLength(2); // the sealed-slot item is dropped
    const ids = [...Object.values(s.equipped), ...s.inventory].map((i) => i.id).concat(s.cards.map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length); // duplicate ids from v1 are reassigned
    expect(s.nextId).toBeGreaterThan(Math.max(...ids));
    expect(s.pets.ember).toEqual({ xp: 300, seen: true, absorbed: 0 });
    expect(s.relics).toEqual([{ id: 'twin_fang', seen: false }]);
    expect(s.skills).toEqual({ abundance: 3, eternal_reflex: 1 });
    expect(s.arcade.records).toEqual({}); // v1 records were unreliable
    expect(s.quests.claimed).toEqual(['q_first_blood']); // daily ids never live in the lifetime list
    expect(s.quests.daily.counters).toEqual({ daily_kills: 12 });
    expect(s.shop.entitlements).toEqual([]); // v1 never charged for these
    expect([...s.shop.ownedCosmetics].sort()).toEqual(['trail_ember', 'trail_frost', 'trail_void']);
    expect(s.shop.activeCosmeticId).toBe('trail_frost');
    expect(s.settings.bgmVolume).toBe(1);
    expect(s.tutorialsSeen).toEqual({ welcome: true, forge: true });
    expect(s.savedAt).toBe(T0 - 2 * 3600 * 1000);
  });

  it('a v1 save from a previous day gets fresh dailies', () => {
    const s = deserialize(JSON.stringify(v1Save({ lastDailyDate: '2020-01-01' })), T0, seededRng(1))!.state;
    expect(s.quests.daily.date).toBe(localDateKey(T0));
    expect(s.quests.daily.counters).toEqual({});
  });

  it('never resumes inside a running boss timer', () => {
    const s = deserialize(JSON.stringify(v1Save({ enemyLevel: 40 })), T0, seededRng(1))!.state;
    expect(s.combat).toMatchObject({ mode: 'FARM_MODE', level: 39 });
  });

  it('round-trips the current format without losing anything but session state', () => {
    const h = harness(newGame((d) => { d.lifetimePeakLevel = 100; }));
    h.killEnemy();
    h.dispatch({ type: 'BUY_UPGRADE', id: 'void_claws', count: 1 });
    h.dispatch({ type: 'ARCADE_START', gameId: 'void_reflex' });
    const raw = serialize(h.state, T0 + 5000);
    const back = deserialize(raw, T0 + 5000, seededRng(2))!;
    expect(back.migratedFromV1).toBe(false);
    const strip = (s: typeof h.state) => ({ ...s, ui: undefined, savedAt: 0, combat: { ...s.combat, enemy: undefined, autoAcc: 0 } });
    expect(strip(back.state)).toEqual(strip(h.state));
    expect(back.state.ui.activeRun).toBeNull();
  });

  it('keeps a pre-migration copy and a backup, and falls back to the backup when the main save is corrupt', () => {
    const v1 = JSON.stringify(v1Save());
    const storage = memoryStorage({ [SAVE_KEY]: v1, [LEGACY_TUTORIAL_KEY]: '{"welcome":true}' });
    const first = loadGame(storage, T0, seededRng(1));
    expect(first.source).toBe('save');
    expect(storage.data[PREMIGRATION_KEY]).toBe(v1);
    expect(storage.data[BACKUP_KEY]).toBe(v1);
    storage.set(SAVE_KEY, '{not json');
    const second = loadGame(storage, T0, seededRng(1));
    expect(second.source).toBe('backup');
    expect(second.state.combat.level).toBe(37);
  });

  it('starts a new game when there is nothing to load, keeping old tutorial flags', () => {
    const r = loadGame(memoryStorage({ [LEGACY_TUTORIAL_KEY]: '{"welcome":true}' }), T0, seededRng(1));
    expect(r.source).toBe('new');
    expect(r.state.tutorialsSeen).toEqual({ welcome: true });
    expect(r.state.combat.enemy.maxHp).toBeGreaterThan(0);
  });

  it('rejects garbage imports', () => {
    expect(deserialize('[]', T0, seededRng(1))).toBeNull();
    expect(deserialize('nope', T0, seededRng(1))).toBeNull();
  });
});
