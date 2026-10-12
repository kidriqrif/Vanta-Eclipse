import { expect, test } from '@playwright/test';
import { GUIDE_ALL_SEEN, freshGame, getState, patchState, watchErrors } from './helpers';

/** Everything seen except the given keys, as a patch for state.tutorialsSeen. */
const seenExcept = (...keys: string[]) => {
  const seen: Record<string, boolean> = { ...GUIDE_ALL_SEEN };
  for (const k of keys) delete seen[k];
  return `s.tutorialsSeen = ${JSON.stringify(seen)};`;
};

test.describe('onboarding guide', () => {
  test('a new player is welcomed, shown how the first screen works, and pointed at the next goal', async ({ page }) => {
    const errors = watchErrors(page);
    await freshGame(page);
    const tip = page.getByRole('dialog', { name: /welcome to vanta eclipse/i });
    await expect(tip).toBeVisible();
    await tip.getByRole('button', { name: /got it/i }).click();
    await expect(tip).toHaveCount(0);
    expect((await getState(page)).tutorialsSeen.welcome).toBe(true);

    // The UPGRADES "how it works" card opens by itself on the first visit, and stays dismissed.
    const help = page.getByRole('region', { name: /how upgrades work/i });
    await expect(help).toBeVisible();
    await help.getByRole('button', { name: /got it/i }).click();
    await expect(help).toHaveCount(0);
    expect((await getState(page)).tutorialsSeen['help:UPGRADES']).toBe(true);
    // ...and the ? brings it back.
    await page.getByRole('button', { name: /how this screen works/i }).click();
    await expect(page.getByRole('region', { name: /how upgrades work/i })).toBeVisible();

    // The goal strip names the first story goal and opens it in CODEX.
    await page.getByRole('button', { name: /^goal: first blood/i }).click();
    await expect(page.getByRole('navigation').getByRole('button', { name: /codex/i })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('tab', { name: /chain/i })).toHaveAttribute('aria-selected', 'true');
    expect(errors).toEqual([]);
  });

  test('a tip about a tab opens it, even one hidden under MORE', async ({ page }) => {
    const errors = watchErrors(page);
    await freshGame(page);
    await patchState(
      page,
      `${seenExcept('boss_cards')} s.cards = [{ id: 900, bossId: 'hollow_sentinel', bossName: 'Hollow Sentinel', rarity: 'rare', level: 10, power: 80, vigor: 12, obtainedAt: Date.now() }]; return s;`,
    );
    const tip = page.getByRole('dialog', { name: /boss cards/i });
    await expect(tip).toBeVisible();
    await tip.getByRole('button', { name: /open cards/i }).click();
    await expect(tip).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /boss cards/i })).toBeVisible();
    expect((await getState(page)).tutorialsSeen.boss_cards).toBe(true);
    expect(errors).toEqual([]);
  });

  test('a double tap on the dialog before a tip cannot skip the tip unread', async ({ page }) => {
    await freshGame(page);
    await patchState(page, `${seenExcept('eclipse', 'world:frozen_ruins')} s.peakRunLevel = 51; s.lifetimePeakLevel = 51; s.ui.worldUnlockModal = 'frozen_ruins'; return s;`);
    const cont = page.getByRole('button', { name: /^continue$/i });
    await expect(cont).toBeVisible();
    await cont.dblclick();
    await expect(page.getByRole('dialog', { name: /the eclipse awaits/i })).toBeVisible();
    expect((await getState(page)).tutorialsSeen.eclipse).toBeFalsy();
  });

  test('a newly opened tab is marked NEW until visited, and MORE says so', async ({ page }) => {
    await freshGame(page);
    await patchState(page, `${seenExcept('tab:CARDS')} s.cards = [{ id: 901, bossId: 'hollow_sentinel', bossName: 'Hollow Sentinel', rarity: 'common', level: 10, power: 40, vigor: 5, obtainedAt: Date.now() }]; return s;`);
    const more = page.getByRole('navigation').getByRole('button', { name: /more tabs/i });
    await expect(more).toHaveAttribute('aria-label', /something new inside/i);
    await more.click();
    const cards = page.getByRole('group', { name: /more tabs/i }).getByRole('button', { name: /cards, new, not opened yet/i });
    await expect(cards).toBeVisible();
    await cards.click();
    await expect.poll(async () => (await getState(page)).tutorialsSeen['tab:CARDS']).toBe(true);
    await expect(more).not.toHaveAttribute('aria-label', /something new inside/i);
  });

  test('a tab opened before it matters still wears NEW once it unlocks', async ({ page }) => {
    await freshGame(page);
    await patchState(page, `${seenExcept('tab:ARCADE')} return s;`);
    const arcade = page.getByRole('navigation').getByRole('button', { name: /^arcade/i });
    await arcade.click();
    await page.getByRole('navigation').getByRole('button', { name: /^upgrades/i }).click();
    expect((await getState(page)).tutorialsSeen['tab:ARCADE']).toBeFalsy();
    await patchState(page, `s.lifetimePeakLevel = 25; s.peakRunLevel = 25; s.tutorialsSeen.arcade = true; return s;`);
    await expect(arcade).toHaveAccessibleName(/new, not opened yet/i);
  });

  test('a tip waits while Settings is open, and shows once it closes', async ({ page }) => {
    await freshGame(page);
    await patchState(page, `${seenExcept()} return s;`);
    await page.getByRole('button', { name: 'Settings' }).click();
    await patchState(page, `delete s.tutorialsSeen.welcome; return s;`);
    await page.waitForTimeout(800);
    await expect(page.getByRole('dialog', { name: /welcome to vanta eclipse/i })).toHaveCount(0);
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog', { name: /welcome to vanta eclipse/i })).toBeVisible();
  });

  test('Escape on the MORE sheet closes only the sheet', async ({ page }) => {
    await freshGame(page);
    await patchState(page, `${seenExcept()} return s;`);
    const nav = page.getByRole('navigation');
    await nav.getByRole('button', { name: /^arcade/i }).click();
    await nav.getByRole('button', { name: /more tabs/i }).click();
    const sheet = page.getByRole('group', { name: /more tabs/i });
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(nav.getByRole('button', { name: /^arcade/i })).toHaveAttribute('aria-current', 'page');
  });

  test('the goal strip opens the story path even from another CODEX page', async ({ page }) => {
    await freshGame(page);
    await patchState(page, `${seenExcept()} return s;`);
    await page.getByRole('navigation').getByRole('button', { name: /^codex/i }).click();
    await page.getByRole('tab', { name: /daily/i }).click();
    await expect(page.getByRole('tab', { name: /daily/i })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: /^goal: /i }).click();
    await expect(page.getByRole('tab', { name: /chain/i })).toHaveAttribute('aria-selected', 'true');
  });

  test('Escape closes a tip on the web, and Settings can read and replay the tips', async ({ page }) => {
    await freshGame(page);
    const tip = page.getByRole('dialog', { name: /welcome to vanta eclipse/i });
    await expect(tip).toBeVisible();
    await page.waitForTimeout(700); // past the double-tap guard
    await page.keyboard.press('Escape');
    await expect(tip).toHaveCount(0);

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('tab', { name: /guide/i }).click();
    await page.getByRole('button', { name: /welcome to vanta eclipse/i }).click();
    await expect(page.getByText(/tap the enemy to strike it/i)).toBeVisible();
    await page.getByRole('button', { name: /replay tips/i }).click();
    await page.getByRole('button', { name: /tap again: show tips again/i }).click();
    // Tips keep a few seconds' gap after the last one (GUIDE_GAP_MS), then the welcome plays again.
    await expect(page.getByRole('dialog', { name: /welcome to vanta eclipse/i })).toBeVisible({ timeout: 10_000 });
  });
});
