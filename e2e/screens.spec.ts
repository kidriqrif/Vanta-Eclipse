import { test } from '@playwright/test';
import { freshGame, openTab, patchState } from './helpers';

/**
 * Not a test: captures every screen for a visual review or store screenshots.
 * Skipped unless CAPTURE=1:  CAPTURE=1 npx playwright test e2e/screens.spec.ts
 * Writes PNGs to $SHOTS_DIR (default ./test-results/screens).
 */
const OUT = process.env.SHOTS_DIR || 'test-results/screens';

test('capture screens', async ({ page }) => {
  test.skip(!process.env.CAPTURE, 'set CAPTURE=1 to capture screenshots');
  test.setTimeout(180_000);
  await freshGame(page);
  await patchState(
    page,
    `s.lifetimePeakLevel = 72; s.peakRunLevel = 64; s.combat.level = 64; s.combat.mode = 'NORMAL';
     s.currencies = { essence: 1234567, void_crystals: 42, astral_shards: 180, void_scraps: 260 };
     s.upgrades = { void_claws: 40, eclipse_fangs: 12, dark_focus: 18, blood_moon: 6, essence_siphon: 9 };
     s.relicsAwakened = true; s.unlockedWorlds = ['dark_forest','frozen_ruins'];
     s.pets = { ember: { xp: 700, seen: true, absorbed: 0.12 }, frostling: { xp: 30, seen: false, absorbed: 0 } };
     s.activePetId = 'ember';
     s.relics = [{ id: 'essence_prism', seen: true }, { id: 'twin_fang', seen: false }]; s.activeRelicId = 'essence_prism';
     s.skills = { abundance: 3, crystalline: 2, eternal_reflex: 1 };
     s.equipped = { weapon: { id: 900, slot: 'weapon', rarity: 3, itemLevel: 60, affixes: { tap_flat: 140, crit_chance: 0.04, boss: 0.3, essence: 0.12 }, seen: true } };
     s.inventory = [
       { id: 901, slot: 'weapon', rarity: 2, itemLevel: 62, affixes: { tap_flat: 120, tap_pct: 0.1, crit_damage: 0.2 }, seen: false },
       { id: 902, slot: 'ring', rarity: 0, itemLevel: 58, affixes: { essence: 0.07 }, seen: false },
       { id: 903, slot: 'boots', rarity: 4, itemLevel: 64, affixes: { tap_flat: 160, tap_pct: 0.2, crit_chance: 0.05, crit_damage: 0.4, boss: 0.5 }, seen: true }];
     s.cards = [{ id: 950, bossId: 'silent_colossus', bossName: 'Silent Colossus', rarity: 'epic', level: 60, power: 1056, vigor: 22, obtainedAt: Date.now() },
                { id: 951, bossId: 'elder_frost_shade', bossName: 'Elder Comet Drifter', rarity: 'common', level: 60, power: 480, vigor: 10, obtainedAt: Date.now() - 1000 }];
     s.arcade.records = { void_reflex: 312, lights_out: 9 };
     s.quests.counters = { kills: 1400, boss_wins: 12, upgrades_bought: 90, items_dropped: 14, taps: 3000, eclipses: 0 };
     s.quests.claimed = ['q_first_blood','q_first_boss'];
     s.tutorialsSeen = { welcome: true, forge: true, bosses: true, auto: true, arcade: true, eclipse: true, ruins: true };
     return s;`,
  );
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/01-combat-upgrades.png` });
  const tabs: [RegExp, string][] = [
    [/armor/i, '02-armor'], [/arcade/i, '03-arcade'], [/codex/i, '04-codex'], [/cards/i, '05-cards'],
    [/beast/i, '06-beast'], [/relics/i, '07-relics'], [/eclipse/i, '08-eclipse'], [/bazaar/i, '09-bazaar'],
  ];
  for (const [label, name] of tabs) {
    await openTab(page, label);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  }
  await page.getByRole('button', { name: /settings/i }).first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/10-settings.png` });
});
