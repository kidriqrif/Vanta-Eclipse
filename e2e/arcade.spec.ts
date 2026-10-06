import { expect, test, type Page } from '@playwright/test';
import { MINIGAMES } from '../src/data/definitions';
import { dispatch, freshGame, getState, openTab, patchState, watchErrors } from './helpers';

async function unlockArcade(page: Page) {
  await patchState(
    page,
    `s.lifetimePeakLevel = 100; s.arcade.tokens = 50; s.tutorialsSeen = { welcome: true, forge: true, bosses: true, auto: true, arcade: true, eclipse: true, ruins: true }; return s;`,
  );
  await openTab(page, /arcade/i);
}

/** Taps random spots inside the minigame overlay until its result banner appears. */
async function monkeyUntilResult(page: Page, seed: number) {
  const overlay = page.getByTestId('minigame-host');
  await expect(overlay).toBeVisible();
  const box = (await overlay.boundingBox())!;
  let x = seed;
  const rand = () => {
    x = (x * 48271) % 2147483647;
    return x / 2147483647;
  };
  const cont = page.getByRole('button', { name: /continue/i });
  for (let i = 0; i < 600; i++) {
    if (await cont.isVisible().catch(() => false)) return;
    // Stay below the header so the QUIT button is never hit.
    const px = box.x + 10 + rand() * (box.width - 20);
    const py = box.y + 90 + rand() * (box.height - 120);
    await page.mouse.click(px, py);
    await page.waitForTimeout(60 + rand() * 120);
  }
  throw new Error('minigame never produced a result');
}

test.describe('arcade', () => {
  for (const [i, def] of [...MINIGAMES].sort((a, b) => a.sortOrder - b.sortOrder).entries()) {
    test(`${def.displayName}: plays to an outcome and pays exactly once`, async ({ page }) => {
      const errors = watchErrors(page);
      await freshGame(page);
      await unlockArcade(page);
      const before = await getState(page);

      const card = page.getByTestId(`minigame-card-${def.id}`);
      await card.getByRole('button', { name: /play/i }).click();
      await monkeyUntilResult(page, 1000 + i * 77);

      const s = await getState(page);
      expect(s.quests.counters.minigame_played ?? 0).toBe((before.quests.counters.minigame_played ?? 0) + 1);
      expect(s.arcade.tokens).toBe(before.arcade.tokens - def.tokenCost);
      expect(s.ui.activeRun).toBeNull();
      const paid = s.currencies.essence - before.currencies.essence;
      expect(paid).toBeGreaterThanOrEqual(1);

      // Hammering the banner and waiting must not pay again.
      await page.waitForTimeout(1500);
      expect((await getState(page)).currencies.essence - before.currencies.essence).toBe(paid);
      await page.getByRole('button', { name: /continue/i }).click();
      await expect(page.getByTestId('minigame-host')).toHaveCount(0);
      expect((await getState(page)).quests.counters.minigame_played).toBe(s.quests.counters.minigame_played);
      expect(errors).toEqual([]);
    });
  }

  test('an open minigame holds a boss fight: auto-attack never touches the boss', async ({ page }) => {
    const errors = watchErrors(page);
    await freshGame(page);
    await unlockArcade(page);
    await patchState(
      page,
      `s.peakRunLevel = 39; s.combat.level = 39; s.combat.mode = 'FARM_MODE';
       s.combat.enemy = { ...s.combat.enemy, level: 39 }; s.skills = { eternal_reflex: 1 }; return s;`,
    );
    await dispatch(page, { type: 'CHALLENGE_BOSS' });
    await page.getByTestId('minigame-card-memory_match').getByRole('button', { name: /play/i }).click();
    await expect(page.getByTestId('minigame-host')).toBeVisible();
    const start = await getState(page);
    expect(start.combat.mode).toBe('BOSS_FIGHT');
    expect(start.ui.activeRun).not.toBeNull();
    await page.waitForTimeout(3000);
    const held = await getState(page);
    expect(held.combat.enemy.hp).toBe(start.combat.enemy.hp);
    expect(held.combat.bossTimeLeft).toBe(start.combat.bossTimeLeft);
    expect(errors).toEqual([]);
  });

  test('quitting forfeits the token and pays nothing', async ({ page }) => {
    const errors = watchErrors(page);
    await freshGame(page);
    await unlockArcade(page);
    const before = await getState(page);
    await page.getByTestId('minigame-card-lights_out').getByRole('button', { name: /play/i }).click();
    await expect(page.getByTestId('minigame-host')).toBeVisible();
    await page.getByRole('button', { name: /quit/i }).click();
    await page.getByRole('button', { name: /forfeit/i }).click();
    await expect(page.getByTestId('minigame-host')).toHaveCount(0);
    const s = await getState(page);
    expect(s.ui.activeRun).toBeNull();
    expect(s.arcade.tokens).toBe(before.arcade.tokens - 1);
    expect(s.quests.counters.minigame_played ?? 0).toBe(before.quests.counters.minigame_played ?? 0);
    expect(errors).toEqual([]);
  });
});
