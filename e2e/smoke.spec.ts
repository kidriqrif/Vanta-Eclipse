import { expect, test } from '@playwright/test';
import { arena, dispatch, freshGame, getState, humanTaps, openTab, patchState, waitForStore, watchErrors } from './helpers';

test.describe('core loop', () => {
  test('a new game taps, earns, climbs, and every tab opens cleanly', async ({ page }) => {
    const errors = watchErrors(page);
    await freshGame(page);
    // Dismiss the welcome tip if it is up.
    const ack = page.getByRole('button', { name: /acknowledge/i });
    if (await ack.isVisible().catch(() => false)) await ack.click();

    await humanTaps(page, 40);
    const s = await getState(page);
    expect(s.currencies.essence).toBeGreaterThan(0);
    expect(s.combat.level).toBeGreaterThan(1);
    expect(s.ui.tapGuard.lockedUntil).toBe(0);

    for (const label of [/upgrades/i, /armor/i, /arcade/i, /codex/i, /cards/i, /beast/i, /relics/i, /eclipse/i, /bazaar/i]) {
      await openTab(page, label);
      await page.waitForTimeout(150);
    }
    expect(errors).toEqual([]);
  });

  test('boss gate: retreat farms below the gate, challenge re-fights it', async ({ page }) => {
    const errors = watchErrors(page);
    await freshGame(page);
    await patchState(page, `s.upgrades.void_claws = 1000000; s.combat.level = 9; s.combat.enemy = { ...s.combat.enemy, level: 9, hp: 1, maxHp: 1 }; s.tutorialsSeen = { welcome: true, forge: true, bosses: true }; return s;`);
    await humanTaps(page, 1);
    await expect.poll(async () => (await getState(page)).combat.mode).toBe('BOSS_FIGHT');
    // RETREAT is a two-tap confirm because it sits inside the tap field.
    await page.getByRole('button', { name: /retreat/i }).click();
    await page.getByRole('button', { name: /confirm retreat/i }).click();
    await expect.poll(async () => (await getState(page)).combat).toMatchObject({ mode: 'FARM_MODE', level: 9 });
    await page.getByRole('button', { name: /challenge boss/i }).click();
    await expect.poll(async () => (await getState(page)).combat).toMatchObject({ mode: 'BOSS_FIGHT', level: 10 });
    await humanTaps(page, 1); // damage is one-shot here: one tap kills the boss
    await expect.poll(async () => (await getState(page)).combat.level).toBe(11);
    const s = await getState(page);
    expect(s.cards.length).toBe(1);
    expect(s.inventory.length).toBeGreaterThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test('a metronome autoclicker is locked out; human tapping is not', async ({ page }) => {
    const errors = watchErrors(page);
    await freshGame(page);
    await patchState(page, `s.tutorialsSeen = { welcome: true }; s.combat.enemy = { ...s.combat.enemy, hp: 1e12, maxHp: 1e12 }; return s;`);
    await humanTaps(page, 30, 7);
    await expect(page.getByText(/tapping paused/i)).toHaveCount(0);

    const box = (await arena(page).boundingBox())!;
    for (let i = 0; i < 30; i++) {
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(100);
    }
    await expect(page.getByText(/tapping paused/i).first()).toBeVisible();
    const before = (await getState(page)).quests.counters.taps;
    await page.touchscreen.tap(box.x + 40, box.y + 120);
    expect((await getState(page)).quests.counters.taps).toBe(before);
    expect(errors).toEqual([]);
  });
});

test.describe('saves and offline', () => {
  test('an old v1 save migrates, and offline earnings can be doubled once', async ({ page }) => {
    const errors = watchErrors(page);
    // Seed before the app's first load (once), exactly as an old install would have it.
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      localStorage.setItem(
        'vanta_eclipse_save_v1',
        JSON.stringify({
          timestamp: Date.now() - 2 * 3600 * 1000,
          currencies: { essence: 500, void_crystals: 3, astral_shards: 0 },
          enemyLevel: 22,
          peakRunLevel: 22,
          lifetimePeakLevel: 22,
          upgradeLevels: { void_claws: 10 },
          tokens: 2,
          purchasedProducts: ['remove_ads'],
          settings: { sfxVolume: 0.5, bgmVolume: 0.5, sfxMuted: true, bgmMuted: true, hapticsEnabled: true, damageNumbers: true, screenShake: true },
        }),
      );
      localStorage.setItem('vanta_eclipse_tutorials', JSON.stringify({ welcome: true, forge: true, bosses: true, auto: true, arcade: true }));
    });
    await page.goto('/');
    await waitForStore(page);
    const s = await getState(page);
    expect(s.combat.level).toBe(22);
    expect(s.shop.entitlements).toEqual([]);
    expect(s.ui.pendingOffline?.amount).toBeGreaterThan(0);
    const granted = s.currencies.essence;
    expect(granted).toBeGreaterThan(500);

    await page.getByRole('button', { name: /double/i }).click();
    await expect.poll(async () => (await getState(page)).ui.pendingOffline?.doubled).toBe(true);
    const after = (await getState(page)).currencies.essence;
    expect(after - granted).toBe(s.ui.pendingOffline!.amount);

    await page.reload();
    await waitForStore(page);
    expect((await getState(page)).currencies.essence).toBeGreaterThanOrEqual(after);
    expect(errors).toEqual([]);
  });
});

test.describe('shop honesty', () => {
  test('paid items never grant anything while billing is off', async ({ page }) => {
    const errors = watchErrors(page);
    await freshGame(page);
    await patchState(page, `s.tutorialsSeen = { welcome: true }; return s;`);
    await openTab(page, /bazaar/i);
    await expect(page.getByText(/coming soon/i).first()).toBeVisible();
    const buttons = page.getByRole('button', { name: /coming soon/i });
    const n = await buttons.count();
    for (let i = 0; i < n; i++) await buttons.nth(i).click({ force: true }).catch(() => undefined);
    const s = await getState(page);
    expect(s.shop.entitlements).toEqual([]);
    expect(s.currencies.astral_shards).toBe(0);
    await expect(page.getByRole('button', { name: /no ads/i })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('a bonus offer respects its daily cap', async ({ page }) => {
    await freshGame(page);
    for (let i = 0; i < 6; i++) await dispatch(page, { type: 'AD_REWARD', placementId: 'arcade_token' });
    expect((await getState(page)).shop.adWatches.arcade_token.count).toBe(3);
  });
});
