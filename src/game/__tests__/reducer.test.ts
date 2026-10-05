import { describe, expect, it } from 'vitest';
import { QUESTS, getForgeCost } from '../../data/definitions';
import { minigamePayout } from '../arcade';
import { eclipsePayout } from '../reducer';
import { BOSS_FIGHT_SECONDS, TOKEN_CAP, TOKEN_REGEN_MS } from '../state';
import { selectStats } from '../stats';
import { getQuestProgress } from '../quests';
import { harness, newGame, overpowered, T0 } from './helpers';

describe('combat and boss gates', () => {
  it('climbs a level per kill and pays essence', () => {
    const h = harness(newGame());
    h.killEnemy();
    expect(h.state.combat.level).toBe(2);
    expect(h.state.currencies.essence).toBeGreaterThan(0);
    expect(h.state.quests.counters.kills).toBe(1);
  });

  it('starts a timed boss on reaching a gate and drops to farm below it on timeout', () => {
    const h = harness(newGame((d) => { overpowered(d); }));
    for (let i = 0; i < 9; i++) h.killEnemy();
    expect(h.state.combat.level).toBe(10);
    expect(h.state.combat.mode).toBe('BOSS_FIGHT');
    expect(h.state.combat.enemy.isBoss).toBe(true);
    for (let i = 0; i < BOSS_FIGHT_SECONDS * 10 + 5; i++) {
      h.advance(100);
      h.dispatch({ type: 'TICK', dtMs: 100 });
    }
    expect(h.state.combat.mode).toBe('FARM_MODE');
    expect(h.state.combat.level).toBe(9);
    expect(h.state.combat.enemy.isBoss).toBe(false);
  });

  it('farm mode repeats the level; a gate only pays boss loot when the boss is killed', () => {
    const h = harness(newGame((d) => { overpowered(d); }));
    for (let i = 0; i < 9; i++) h.killEnemy();
    h.dispatch({ type: 'LEAVE_BOSS' });
    expect(h.state.combat).toMatchObject({ mode: 'FARM_MODE', level: 9 });
    const cardsBefore = h.state.cards.length;
    h.killEnemy();
    h.killEnemy();
    expect(h.state.combat.level).toBe(9);
    expect(h.state.cards.length).toBe(cardsBefore);
    expect(h.state.quests.counters.boss_wins || 0).toBe(0);

    expect(h.dispatch({ type: 'CHALLENGE_BOSS' }).ok).toBe(true);
    expect(h.state.combat).toMatchObject({ mode: 'BOSS_FIGHT', level: 10 });
    h.killEnemy();
    expect(h.state.combat).toMatchObject({ mode: 'NORMAL', level: 11 });
    expect(h.state.quests.counters.boss_wins).toBe(1);
    expect(h.state.cards.length).toBe(cardsBefore + 1);
    expect(h.state.inventory.length).toBeGreaterThanOrEqual(1);
  });

  it('cannot challenge a boss from a level that is not below a gate', () => {
    const h = harness(newGame());
    h.dispatch({ type: 'SET_FARM', on: true });
    expect(h.dispatch({ type: 'CHALLENGE_BOSS' }).ok).toBe(false);
    expect(h.state.combat.mode).toBe('FARM_MODE');
  });

  it('pauses the boss timer while a minigame is open', () => {
    const h = harness(newGame((d) => { overpowered(d); d.lifetimePeakLevel = 60; }));
    for (let i = 0; i < 9; i++) h.killEnemy();
    h.dispatch({ type: 'ARCADE_START', gameId: 'void_reflex' });
    for (let i = 0; i < 100; i++) h.dispatch({ type: 'TICK', dtMs: 100 });
    expect(h.state.combat.bossTimeLeft).toBe(BOSS_FIGHT_SECONDS);
  });

  it('beating the level-50 world boss unlocks the Frozen Ruins, a pet and relics', () => {
    const h = harness(newGame((d) => { overpowered(d); d.combat.level = 49; d.peakRunLevel = 49; }));
    h.killEnemy(); // 49 → 50, a gate
    expect(h.state.combat.mode).toBe('BOSS_FIGHT');
    h.killEnemy();
    expect(h.state.combat.level).toBe(51);
    expect(h.state.unlockedWorlds).toContain('frozen_ruins');
    expect(h.state.relicsAwakened).toBe(true);
    expect(h.state.pets.ember).toBeDefined();
    expect(h.state.activePetId).toBe('ember');
    expect(h.state.ui.worldUnlockModal).toBe('frozen_ruins');
    expect(h.fx.some((f) => f.type === 'save')).toBe(true);
  });

  it('auto-attack runs on ticks only after unlock', () => {
    const h = harness(newGame());
    const hp = h.state.combat.enemy.hp;
    for (let i = 0; i < 20; i++) h.dispatch({ type: 'TICK', dtMs: 100 });
    expect(h.state.combat.enemy.hp).toBe(hp);
    const h2 = harness(newGame((d) => { d.peakRunLevel = 15; d.combat.level = 15; }));
    const hp2 = h2.state.combat.enemy.hp;
    for (let i = 0; i < 20; i++) h2.dispatch({ type: 'TICK', dtMs: 100 });
    expect(h2.state.combat.enemy.hp).toBeLessThan(hp2);
  });

  it('applies the combo bonus to manual taps', () => {
    const h = harness(newGame((d) => { d.upgrades.void_claws = 99; d.combat.enemy.hp = 1e12; d.combat.enemy.maxHp = 1e12; }));
    for (let i = 0; i < 12; i++) {
      h.advance(200 + (i % 3) * 40);
      h.dispatch({ type: 'TAP', x: 100 + i, y: 100, touch: true });
    }
    const hits = h.fx.filter((f) => f.type === 'hit' && !f.crit) as { amount: number }[];
    expect(hits[hits.length - 1].amount).toBeGreaterThan(hits[0].amount);
  });

  it('autoclicker taps are ignored and do not count toward quests', () => {
    const h = harness(newGame((d) => { d.combat.enemy.hp = 1e12; d.combat.enemy.maxHp = 1e12; }));
    for (let i = 0; i < 60; i++) {
      h.advance(100);
      h.dispatch({ type: 'TAP', x: 100 + (i % 3) * 5, y: 100, touch: true });
    }
    expect(h.fx.some((f) => f.type === 'tapLocked')).toBe(true);
    expect(h.state.quests.counters.taps).toBeLessThan(25);
    expect(h.state.ui.tapGuard.lockedUntil).toBeGreaterThan(h.now);
  });
});

describe('spending', () => {
  it('buys upgrades atomically and only when affordable', () => {
    const h = harness(newGame((d) => { d.currencies.essence = 5; }));
    expect(h.dispatch({ type: 'BUY_UPGRADE', id: 'void_claws', count: 1 }).ok).toBe(true);
    expect(h.state.currencies.essence).toBe(0);
    expect(h.state.upgrades.void_claws).toBe(1);
    expect(h.dispatch({ type: 'BUY_UPGRADE', id: 'void_claws', count: 1 }).ok).toBe(false);
    expect(h.state.upgrades.void_claws).toBe(1);
  });

  it('x10 is all-or-nothing but shrinks to what maxLevel leaves', () => {
    const h = harness(newGame((d) => { d.currencies.essence = 1e9; d.upgrades.dark_focus = 28; }));
    const r = h.dispatch({ type: 'BUY_UPGRADE', id: 'dark_focus', count: 10 });
    expect(r).toMatchObject({ ok: true, value: 2 });
    expect(h.state.upgrades.dark_focus).toBe(30);
  });

  it('MAX buys as many as affordable', () => {
    const h = harness(newGame((d) => { d.currencies.essence = 1000; }));
    const r = h.dispatch({ type: 'BUY_UPGRADE', id: 'void_claws', count: 'max' });
    expect(r.value).toBeGreaterThan(5);
    expect(h.state.currencies.essence).toBeGreaterThanOrEqual(0);
  });

  it('skills respect prerequisites and cost crystals', () => {
    const h = harness(newGame((d) => { d.currencies.void_crystals = 100; }));
    expect(h.dispatch({ type: 'BUY_SKILL', id: 'deep_rest' })).toMatchObject({ ok: false, reason: 'prereq' });
    expect(h.dispatch({ type: 'BUY_SKILL', id: 'abundance' }).ok).toBe(true);
    expect(h.dispatch({ type: 'BUY_SKILL', id: 'deep_rest' }).ok).toBe(true);
    expect(h.state.currencies.void_crystals).toBe(100 - 4 - 5);
  });
});

describe('gear', () => {
  it('equip and unequip never duplicate an item', () => {
    const h = harness(newGame((d) => {
      d.inventory = [
        { id: 1, slot: 'weapon', rarity: 1, itemLevel: 5, affixes: { tap_flat: 3 }, seen: false },
        { id: 2, slot: 'weapon', rarity: 2, itemLevel: 6, affixes: { tap_flat: 9 }, seen: false },
      ];
    }));
    h.dispatch({ type: 'EQUIP_ITEM', itemId: 1 });
    h.dispatch({ type: 'EQUIP_ITEM', itemId: 2 });
    expect(h.state.equipped.weapon.id).toBe(2);
    expect(h.state.inventory.map((i) => i.id)).toEqual([1]);
    h.dispatch({ type: 'UNEQUIP_ITEM', slot: 'weapon' });
    expect(h.state.equipped.weapon).toBeUndefined();
    expect(h.state.inventory.map((i) => i.id).sort()).toEqual([1, 2]);
  });

  it('gear affixes reach the damage formula', () => {
    const before = selectStats(newGame()).tapDamage;
    const after = selectStats(newGame((d) => {
      d.equipped.weapon = { id: 9, slot: 'weapon', rarity: 0, itemLevel: 1, affixes: { tap_flat: 10 }, seen: true };
    })).tapDamage;
    expect(after).toBe(before + 10);
  });

  it('salvage never touches equipped items; forge charges the shown cost', () => {
    const h = harness(newGame((d) => {
      d.equipped.ring = { id: 3, slot: 'ring', rarity: 0, itemLevel: 1, affixes: {}, seen: true };
      d.inventory = [{ id: 4, slot: 'boots', rarity: 0, itemLevel: 1, affixes: {}, seen: true }];
      d.currencies.void_scraps = 100;
    }));
    expect(h.dispatch({ type: 'SALVAGE_ITEM', itemId: 3 }).ok).toBe(false);
    expect(h.dispatch({ type: 'SALVAGE_COMMONS' })).toMatchObject({ ok: true, value: 2 });
    expect(h.state.equipped.ring).toBeDefined();
    const scraps = h.state.currencies.void_scraps;
    const r = h.dispatch({ type: 'FORGE_ITEM', slot: 'gloves' });
    expect(r.ok).toBe(true);
    expect(r.item?.slot).toBe('gloves');
    expect(h.state.currencies.void_scraps).toBe(scraps - getForgeCost(h.state.combat.level));
    expect(h.dispatch({ type: 'FORGE_ITEM', slot: 'relic' }).ok).toBe(false);
  });

  it('crit chance is capped at 50%', () => {
    const s = newGame((d) => {
      for (const slot of ['weapon', 'helmet', 'armor', 'boots', 'gloves', 'ring']) {
        d.equipped[slot] = { id: slot.length, slot, rarity: 4, itemLevel: 1, affixes: { crit_chance: 0.2 }, seen: true };
      }
    });
    expect(selectStats(s).critChance).toBe(0.5);
  });
});

describe('pets, cards and relics', () => {
  it('absorbing a card levels the active pet and adds vigor, even on an old save without absorbed', () => {
    const h = harness(newGame((d) => {
      d.pets.ember = { xp: 0, seen: true } as never;
      d.activePetId = 'ember';
      d.cards = [{ id: 5, bossId: 'b', bossName: 'B', rarity: 'common', level: 10, power: 130, vigor: 10, obtainedAt: T0 }];
    }));
    expect(h.dispatch({ type: 'ABSORB_CARD', cardId: 5 }).ok).toBe(true);
    expect(h.state.pets.ember.xp).toBe(130);
    expect(h.state.pets.ember.absorbed).toBeCloseTo(0.02);
    expect(h.state.cards).toHaveLength(0);
  });

  it('only owned relics can be attuned, and they can be detached', () => {
    const h = harness(newGame((d) => { d.relics = [{ id: 'essence_prism', seen: false }]; }));
    expect(h.dispatch({ type: 'SET_ACTIVE_RELIC', id: 'twin_fang' }).ok).toBe(false);
    expect(h.dispatch({ type: 'SET_ACTIVE_RELIC', id: 'essence_prism' }).ok).toBe(true);
    const doubled = selectStats(h.state).essenceMultiplier;
    h.dispatch({ type: 'SET_ACTIVE_RELIC', id: null });
    expect(selectStats(h.state).essenceMultiplier).toBeCloseTo(doubled / 2);
  });
});

describe('eclipse', () => {
  it('is locked below level 50', () => {
    const h = harness(newGame((d) => { d.peakRunLevel = 49; }));
    expect(h.dispatch({ type: 'PERFORM_ECLIPSE' }).ok).toBe(false);
  });

  it('resets the run, keeps the collection, pays crystals once', () => {
    const h = harness(newGame((d) => {
      d.peakRunLevel = 60;
      d.combat.level = 60;
      d.currencies = { essence: 1e6, void_crystals: 3, astral_shards: 7, void_scraps: 9 };
      d.upgrades = { void_claws: 40 };
      d.unlockedWorlds = ['dark_forest', 'frozen_ruins'];
      d.inventory = [{ id: 1, slot: 'ring', rarity: 2, itemLevel: 50, affixes: {}, seen: true }];
      d.skills = { abundance: 2 };
      d.pets = { ember: { xp: 100, seen: true, absorbed: 0.1 } };
    }));
    const payout = eclipsePayout(h.state);
    const r = h.dispatch({ type: 'PERFORM_ECLIPSE' });
    expect(r).toMatchObject({ ok: true, value: payout });
    expect(h.state.currencies).toEqual({ essence: 0, void_crystals: 3 + payout, astral_shards: 7, void_scraps: 9 });
    expect(h.state.upgrades).toEqual({});
    expect(h.state.combat).toMatchObject({ level: 1, mode: 'NORMAL' });
    expect(h.state.unlockedWorlds).toEqual(['dark_forest']);
    expect(h.state.inventory).toHaveLength(1);
    expect(h.state.skills).toEqual({ abundance: 2 });
    expect(h.state.pets.ember.xp).toBe(100);
    expect(h.dispatch({ type: 'PERFORM_ECLIPSE' }).ok).toBe(false);
  });
});

describe('arcade', () => {
  const unlocked = () => newGame((d) => { d.lifetimePeakLevel = 100; });

  it('pays exactly once per run, however many times the game reports', () => {
    const h = harness(unlocked());
    const start = h.dispatch({ type: 'ARCADE_START', gameId: 'memory_match' });
    expect(start.ok).toBe(true);
    expect(h.state.arcade.tokens).toBe(TOKEN_CAP - 1);
    const first = h.dispatch({ type: 'ARCADE_FINISH', runId: start.runId!, won: true, performance: 1, score: 8 });
    const essence = h.state.currencies.essence;
    const again = h.dispatch({ type: 'ARCADE_FINISH', runId: start.runId!, won: false, performance: 0, score: 99 });
    expect(first.ok).toBe(true);
    expect(again.ok).toBe(false);
    expect(h.state.currencies.essence).toBe(essence);
    expect(h.state.quests.counters.minigame_played).toBe(1);
  });

  it('quitting forfeits the token and pays nothing', () => {
    const h = harness(unlocked());
    const start = h.dispatch({ type: 'ARCADE_START', gameId: 'lights_out' });
    h.dispatch({ type: 'ARCADE_QUIT', runId: start.runId! });
    expect(h.state.ui.activeRun).toBeNull();
    expect(h.dispatch({ type: 'ARCADE_FINISH', runId: start.runId!, won: true, performance: 1, score: 1 }).ok).toBe(false);
    expect(h.state.currencies.essence).toBe(0);
  });

  it('respects unlock levels and token count', () => {
    const h = harness(newGame());
    expect(h.dispatch({ type: 'ARCADE_START', gameId: 'void_reflex' })).toMatchObject({ ok: false, reason: 'locked' });
    const h2 = harness(newGame((d) => { d.lifetimePeakLevel = 100; d.arcade.tokens = 0; d.arcade.regenAnchor = T0; }));
    expect(h2.dispatch({ type: 'ARCADE_START', gameId: 'void_reflex' })).toMatchObject({ ok: false, reason: 'no_tokens' });
  });

  it('records only wins, in the right direction', () => {
    const h = harness(unlocked());
    const play = (won: boolean, score: number) => {
      const r = h.dispatch({ type: 'ARCADE_START', gameId: 'lights_out' });
      h.dispatch({ type: 'ARCADE_FINISH', runId: r.runId!, won, performance: 0.5, score });
    };
    play(false, 3);
    expect(h.state.arcade.records.lights_out).toBeUndefined();
    play(true, 20);
    play(true, 30);
    play(true, 12);
    expect(h.state.arcade.records.lights_out).toBe(12);
  });

  it('pays rate × seconds × performance, a quarter on a loss, at least 1', () => {
    const def = { rewardSeconds: 100 } as never;
    expect(minigamePayout(10, def, true, 0.5)).toBe(500);
    expect(minigamePayout(10, def, false, 0.5)).toBe(125);
    expect(minigamePayout(10, def, false, 0)).toBe(1);
  });

  it('regenerates tokens from wall-clock time, never past the cap, never on a clock rollback', () => {
    const h = harness(newGame((d) => { d.arcade.tokens = 1; d.arcade.regenAnchor = T0; }));
    h.setNow(T0 + TOKEN_REGEN_MS * 2 + 1000);
    h.dispatch({ type: 'TICK', dtMs: 100 });
    expect(h.state.arcade.tokens).toBe(3);
    h.setNow(T0 + TOKEN_REGEN_MS * 50);
    h.dispatch({ type: 'TICK', dtMs: 100 });
    expect(h.state.arcade.tokens).toBe(TOKEN_CAP);
    const h2 = harness(newGame((d) => { d.arcade.tokens = 1; d.arcade.regenAnchor = T0; }));
    h2.setNow(T0 - TOKEN_REGEN_MS * 10);
    h2.dispatch({ type: 'TICK', dtMs: 100 });
    expect(h2.state.arcade.tokens).toBe(1);
  });
});

describe('journal', () => {
  it('chain quests on level, pets, relics and skills are claimable (they never were)', () => {
    const climb = QUESTS.find((q) => q.id === 'q_the_climb')!;
    const h = harness(newGame((d) => {
      d.lifetimePeakLevel = 30;
      d.quests.claimed = ['q_first_blood', 'q_first_boss', 'q_first_power'];
    }));
    expect(getQuestProgress(h.state, climb)).toBe(30);
    const tokens = h.state.arcade.tokens;
    expect(h.dispatch({ type: 'CLAIM_QUEST', id: 'q_the_climb' }).ok).toBe(true);
    expect(h.state.arcade.tokens).toBe(tokens + 2);
    expect(h.dispatch({ type: 'CLAIM_QUEST', id: 'q_the_climb' }).ok).toBe(false);
  });

  it('chain quests stay locked until the previous one is claimed', () => {
    const h = harness(newGame((d) => { d.quests.counters.boss_wins = 5; }));
    expect(h.dispatch({ type: 'CLAIM_QUEST', id: 'q_first_boss' }).ok).toBe(false);
  });

  it('dailies roll over at local midnight and the all-clear needs every daily claimed', () => {
    const h = harness(newGame());
    const ids = h.state.quests.daily.ids;
    for (const id of ids) {
      const q = QUESTS.find((x) => x.id === id)!;
      h.state = { ...h.state, quests: { ...h.state.quests, daily: { ...h.state.quests.daily, counters: { ...h.state.quests.daily.counters, [q.metric]: q.targetValue } } } };
    }
    expect(h.dispatch({ type: 'CLAIM_ALL_CLEAR' }).ok).toBe(false);
    for (const id of ids) expect(h.dispatch({ type: 'CLAIM_QUEST', id }).ok).toBe(true);
    expect(h.dispatch({ type: 'CLAIM_ALL_CLEAR' }).ok).toBe(true);
    h.setNow(T0 + 24 * 3600 * 1000);
    h.dispatch({ type: 'TICK', dtMs: 100 });
    expect(h.state.quests.daily.claimed).toEqual([]);
    expect(h.state.quests.daily.allClearClaimed).toBe(false);
  });
});

describe('ads, purchases and offline', () => {
  it('ad offers keep their daily cap even with Remove Ads', () => {
    const h = harness(newGame((d) => { d.shop.entitlements = ['remove_ads']; }));
    for (let i = 0; i < 3; i++) expect(h.dispatch({ type: 'AD_REWARD', placementId: 'arcade_token' }).ok).toBe(true);
    expect(h.dispatch({ type: 'AD_REWARD', placementId: 'arcade_token' })).toMatchObject({ ok: false, reason: 'capped' });
  });

  it('offline double only doubles a pending reward, once, and an empty watch costs nothing', () => {
    const h = harness(newGame((d) => { d.peakRunLevel = 20; d.combat.level = 20; }));
    expect(h.dispatch({ type: 'AD_REWARD', placementId: 'offline_double' }).ok).toBe(false);
    expect(h.state.shop.adWatches.offline_double).toBeUndefined();
    const r = h.dispatch({ type: 'APPLY_OFFLINE', secondsAway: 3600 });
    expect(r.ok).toBe(true);
    const base = h.state.currencies.essence;
    expect(base).toBe(r.value);
    expect(h.dispatch({ type: 'AD_REWARD', placementId: 'offline_double' }).ok).toBe(true);
    expect(h.state.currencies.essence).toBe(base * 2);
    expect(h.dispatch({ type: 'AD_REWARD', placementId: 'offline_double' }).ok).toBe(false);
  });

  it('offline needs auto-attack, honours the cap, Deep Rest and the Eclipse Heart', () => {
    const noAuto = harness(newGame());
    expect(noAuto.dispatch({ type: 'APPLY_OFFLINE', secondsAway: 3600 }).ok).toBe(false);
    const reflex = harness(newGame((d) => { d.skills.eternal_reflex = 1; }));
    expect(reflex.dispatch({ type: 'APPLY_OFFLINE', secondsAway: 3600 }).ok).toBe(true);

    const amount = (edit: Parameters<typeof newGame>[0], secs = 3600) =>
      harness(newGame(edit)).dispatch({ type: 'APPLY_OFFLINE', secondsAway: secs }).value!;
    const base = amount((d) => { d.peakRunLevel = 20; d.combat.level = 20; });
    expect(amount((d) => { d.peakRunLevel = 20; d.combat.level = 20; d.skills.deep_rest = 2; })).toBeCloseTo(base * 1.2, -1);
    expect(amount((d) => { d.peakRunLevel = 20; d.combat.level = 20; d.relics = [{ id: 'eclipse_heart', seen: true }]; d.activeRelicId = 'eclipse_heart'; })).toBeCloseTo(base * 3, -1);
    const capped = harness(newGame((d) => { d.peakRunLevel = 20; d.combat.level = 20; }));
    capped.dispatch({ type: 'APPLY_OFFLINE', secondsAway: 3600 * 100 });
    expect(capped.state.ui.pendingOffline?.wasCapped).toBe(true);
    expect(capped.state.currencies.essence).toBeCloseTo(base * 8, -2);
  });

  it('purchases: entitlements once, consumables every time, restore skips consumables', () => {
    const h = harness(newGame());
    h.dispatch({ type: 'PURCHASE_GRANTED', productId: 'starter_pack' });
    h.dispatch({ type: 'PURCHASE_GRANTED', productId: 'starter_pack' });
    expect(h.state.currencies.void_crystals).toBe(25);
    expect(h.state.arcade.tokens).toBe(TOKEN_CAP + 5);
    expect(h.state.shop.ownedCosmetics).toContain('trail_ember');
    h.dispatch({ type: 'PURCHASE_GRANTED', productId: 'shards_small' });
    h.dispatch({ type: 'PURCHASE_GRANTED', productId: 'vanta_shards_small' });
    expect(h.state.currencies.astral_shards).toBe(400);
    h.dispatch({ type: 'RESTORE_ENTITLEMENTS', productIds: ['vanta_remove_ads', 'vanta_shards_small'] });
    expect(h.state.shop.entitlements).toContain('remove_ads');
    expect(h.state.currencies.astral_shards).toBe(400);
  });

  it('a Play transaction is granted once, however many times it is reported', () => {
    const h = harness(newGame());
    expect(h.dispatch({ type: 'PURCHASE_GRANTED', productId: 'shards_small', transactionId: 'GPA.1' }).ok).toBe(true);
    expect(h.dispatch({ type: 'PURCHASE_GRANTED', productId: 'shards_small', transactionId: 'GPA.1' })).toMatchObject({ ok: false, reason: 'already_granted' });
    expect(h.dispatch({ type: 'PURCHASE_GRANTED', productId: 'shards_small', transactionId: 'GPA.2' }).ok).toBe(true);
    expect(h.state.currencies.astral_shards).toBe(400);
  });
});
