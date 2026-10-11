import { describe, expect, it } from 'vitest';
import { GUIDE, GUIDE_IDS, isEclipseTabOpen, isGuideBlocked, isGuidePending, isTabNew, nextGuideStep, reachedGuideSteps, tabVisitKey } from '../guide';
import { deserialize, serialize } from '../save';
import { seededRng } from '../rng';
import { BOSS_FIGHT_SECONDS } from '../state';
import { T0, harness, newGame, overpowered } from './helpers';

const seen = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, true]));
const step = (id: string) => GUIDE.find((g) => g.id === id)!;

describe('guide tips', () => {
  it('has unique ids, two lines each, and only real tabs', () => {
    expect(new Set(GUIDE_IDS).size).toBe(GUIDE_IDS.length);
    for (const g of GUIDE) {
      expect(g.lines.length).toBeGreaterThanOrEqual(1);
      expect(g.lines.length).toBeLessThanOrEqual(2);
    }
  });

  it('opens with the welcome tip on a new game, then waits until an upgrade is affordable', () => {
    expect(nextGuideStep(newGame())?.id).toBe('welcome');
    const s = newGame((d) => {
      d.tutorialsSeen = seen('welcome');
    });
    expect(nextGuideStep(s)).toBeNull();
    const rich = newGame((d) => {
      d.tutorialsSeen = seen('welcome');
      d.currencies.essence = 100;
    });
    expect(nextGuideStep(rich)?.id).toBe('forge');
  });

  it('teaches gear on the first drop and stops once something is equipped', () => {
    const h = harness(newGame((d) => { overpowered(d); d.tutorialsSeen = seen('welcome', 'forge', 'bosses'); }));
    for (let i = 0; i < 10; i++) h.killEnemy(); // through the level-10 boss, which always drops gear
    expect(h.state.inventory.length).toBeGreaterThan(0);
    expect(isGuidePending(h.state, step('first_gear'))).toBe(true);
    h.dispatch({ type: 'EQUIP_ITEM', itemId: h.state.inventory[0].id });
    expect(isGuidePending(h.state, step('first_gear'))).toBe(false);
  });

  it('explains how to get past a boss that held, only below the gate it lost to', () => {
    const h = harness(newGame((d) => { overpowered(d); d.tutorialsSeen = seen('welcome', 'forge'); }));
    for (let i = 0; i < 9; i++) h.killEnemy();
    expect(h.state.combat.mode).toBe('BOSS_FIGHT');
    for (let i = 0; i < BOSS_FIGHT_SECONDS * 10 + 5; i++) {
      h.advance(100);
      h.dispatch({ type: 'TICK', dtMs: 100 });
    }
    expect(h.state.combat).toMatchObject({ mode: 'FARM_MODE', level: 9 });
    expect(isGuidePending(h.state, step('farm'))).toBe(true);
    // Holding a level by choice, away from a gate, is not a lost boss.
    const held = newGame((d) => { d.combat.level = 4; d.lifetimePeakLevel = 5; d.combat.mode = 'FARM_MODE'; });
    expect(step('farm').due(held)).toBe(false);
  });

  it('only says auto-attack is on when it is on in this run', () => {
    const afterEclipse = newGame((d) => { d.lifetimePeakLevel = 120; d.peakRunLevel = 3; d.combat.level = 3; });
    expect(step('auto').due(afterEclipse)).toBe(false);
    const run = newGame((d) => { d.peakRunLevel = 15; d.combat.level = 15; });
    expect(step('auto').due(run)).toBe(true);
  });

  it('skips what an advanced save already knows, so old players do not get a wall of tips', () => {
    const veteran = newGame((d) => {
      d.combat.level = 64;
      d.peakRunLevel = 64;
      d.lifetimePeakLevel = 120;
      d.eclipseCount = 3;
      d.quests.counters = { kills: 9000, boss_wins: 40, upgrades_bought: 300, items_dropped: 90, cards_absorbed: 12, salvage: 50, forge: 4, minigame_played: 30, skills_bought: 8 };
      d.quests.claimed = ['q_first_blood'];
      d.equipped = { weapon: { id: 1, slot: 'weapon', rarity: 2, itemLevel: 60, affixes: { tap_flat: 10 }, seen: true } };
      d.cards = [{ id: 2, bossId: 'hollow_sovereign', bossName: 'Hollow Sovereign', rarity: 'rare', level: 50, power: 10, vigor: 10, obtainedAt: T0 }];
      d.relicsAwakened = true;
      d.unlockedWorlds = ['dark_forest', 'frozen_ruins'];
      d.relics = [{ id: 'twin_fang', seen: true }];
      d.activeRelicId = 'twin_fang';
      d.shop.ownedCosmetics = ['trail_void', 'trail_ember'];
    });
    // Only the two tips with no "already knows" test are left, and they show one at a time.
    expect(GUIDE.filter((g) => isGuidePending(veteran, g)).map((g) => g.id)).toEqual(['auto', 'ruins']);
  });

  it('waits while a boss fight, a minigame or another dialog owns the screen', () => {
    expect(isGuideBlocked(newGame())).toBe(false);
    expect(isGuideBlocked(newGame((d) => { d.combat.mode = 'BOSS_FIGHT'; }))).toBe(true);
    expect(isGuideBlocked(newGame((d) => { d.ui.activeRun = { runId: 1, gameId: 'void_reflex' }; }))).toBe(true);
    expect(isGuideBlocked(newGame((d) => { d.ui.pendingOffline = { amount: 1, secondsAway: 60, wasCapped: false, doubled: false }; }))).toBe(true);
    expect(isGuideBlocked(newGame((d) => { d.ui.worldUnlockModal = 'frozen_ruins'; }))).toBe(true);
  });

  it('lists the tips reached so far for the Guide in Settings', () => {
    const ids = reachedGuideSteps(newGame((d) => { d.tutorialsSeen = seen('welcome', 'forge'); })).map((g) => g.id);
    expect(ids).toContain('welcome');
    expect(ids).toContain('forge');
    expect(ids).not.toContain('eclipse');
  });
});

describe('tab markers', () => {
  it('marks a tab NEW once it matters, until it is opened', () => {
    const s = newGame((d) => { d.lifetimePeakLevel = 20; });
    expect(isTabNew(s, 'ARCADE')).toBe(true);
    expect(isTabNew(newGame(), 'ARCADE')).toBe(false);
    const visited = newGame((d) => { d.lifetimePeakLevel = 20; d.tutorialsSeen = { [tabVisitKey('ARCADE')]: true }; });
    expect(isTabNew(visited, 'ARCADE')).toBe(false);
  });

  it('keeps ECLIPSE open after an Eclipse, when the run is back at level 1 but powers can be bought', () => {
    expect(isEclipseTabOpen(newGame())).toBe(false);
    expect(isEclipseTabOpen(newGame((d) => { d.eclipseCount = 1; }))).toBe(true);
    expect(isEclipseTabOpen(newGame((d) => { d.currencies.void_crystals = 5; }))).toBe(true);
  });
});

describe('guide state in the reducer', () => {
  it('holds a boss fight while a tip is open', () => {
    const h = harness(newGame((d) => { overpowered(d); d.tutorialsSeen = seen('welcome'); }));
    for (let i = 0; i < 9; i++) h.killEnemy();
    expect(h.state.combat.mode).toBe('BOSS_FIGHT');
    h.dispatch({ type: 'SET_GUIDE_OPEN', open: true });
    const before = h.state.combat.bossTimeLeft;
    for (let i = 0; i < 50; i++) {
      h.advance(100);
      h.dispatch({ type: 'TICK', dtMs: 100 });
    }
    expect(h.state.combat.bossTimeLeft).toBe(before);
    expect(h.dispatch({ type: 'TAP', x: 10, y: 10, touch: true }).reason).toBe('busy');
    h.dispatch({ type: 'SET_GUIDE_OPEN', open: false });
    h.advance(100);
    h.dispatch({ type: 'TICK', dtMs: 100 });
    expect(h.state.combat.bossTimeLeft).toBeLessThan(before);
  });

  it('replays tips but keeps world celebrations remembered', () => {
    const h = harness(newGame((d) => { d.tutorialsSeen = { welcome: true, 'tab:ARCADE': true, 'world:frozen_ruins': true }; }));
    h.dispatch({ type: 'RESET_TUTORIALS' });
    expect(h.state.tutorialsSeen).toEqual({ 'world:frozen_ruins': true });
    expect(nextGuideStep(h.state)?.id).toBe('welcome');
  });

  it('refuses an empty or oversized tutorial id', () => {
    const h = harness(newGame());
    expect(h.dispatch({ type: 'MARK_TUTORIAL_SEEN', id: '' }).ok).toBe(false);
    expect(h.dispatch({ type: 'MARK_TUTORIAL_SEEN', id: 'x'.repeat(65) }).ok).toBe(false);
    expect(h.dispatch({ type: 'MARK_TUTORIAL_SEEN', id: 'welcome' }).ok).toBe(true);
  });

  it('announces auto-attack with a toast only after the first time, when the tip already said it', () => {
    const first = harness(newGame((d) => { overpowered(d); d.combat.level = 14; d.peakRunLevel = 14; d.lifetimePeakLevel = 14; }));
    first.killEnemy();
    expect(first.fx.some((f) => f.type === 'toast' && /AUTO-ATTACK/.test(f.text))).toBe(false);
    const later = harness(newGame((d) => { overpowered(d); d.combat.level = 14; d.peakRunLevel = 14; d.lifetimePeakLevel = 80; d.tutorialsSeen = seen('auto'); }));
    later.killEnemy();
    expect(later.fx.some((f) => f.type === 'toast' && /AUTO-ATTACK/.test(f.text))).toBe(true);
  });
});

describe('world celebration across a restart', () => {
  it('shows an uncelebrated world unlock again on the next launch, and not once it was closed', () => {
    const unlocked = newGame((d) => { d.unlockedWorlds = ['dark_forest', 'frozen_ruins']; d.relicsAwakened = true; });
    const again = deserialize(serialize(unlocked, T0), T0, seededRng(1))!.state;
    expect(again.ui.worldUnlockModal).toBe('frozen_ruins');

    const h = harness(again);
    h.dispatch({ type: 'CLOSE_WORLD_MODAL' });
    expect(h.state.tutorialsSeen['world:frozen_ruins']).toBe(true);
    const closed = deserialize(serialize(h.state, T0), T0, seededRng(1))!.state;
    expect(closed.ui.worldUnlockModal).toBeNull();
  });

  it('treats a save that saw the Frozen Ruins tip as already celebrated', () => {
    const old = newGame((d) => { d.unlockedWorlds = ['dark_forest', 'frozen_ruins']; d.tutorialsSeen = seen('ruins'); });
    expect(deserialize(serialize(old, T0), T0, seededRng(1))!.state.ui.worldUnlockModal).toBeNull();
  });
});
