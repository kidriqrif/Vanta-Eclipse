import { expect, type Page } from '@playwright/test';
import type { GameState } from '../src/game/state';

/** Fails the test on any uncaught page error or console error. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Expected in a browser: there is no native AdMob/Billing here.
    if (/admob|not implemented on web|capacitor/i.test(text)) return;
    errors.push(`console: ${text}`);
  });
  return errors;
}

export async function freshGame(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await waitForStore(page);
}

export async function waitForStore(page: Page) {
  await page.waitForFunction(() => !!(window as unknown as { __vanta?: unknown }).__vanta);
}

export async function getState(page: Page): Promise<GameState> {
  return page.evaluate(() => (window as unknown as { __vanta: { getState(): unknown } }).__vanta.getState() as never);
}

/**
 * Edits the live state through the dev-only store handle. `patch` runs in the page with a
 * structured clone of the state and returns the replacement.
 */
export async function patchState(page: Page, patch: string) {
  await page.evaluate((src) => {
    const store = (window as unknown as { __vanta: { getState(): unknown; replace(s: unknown): void } }).__vanta;
    const s = structuredClone(store.getState()) as Record<string, unknown>;
    // eslint-disable-next-line no-new-func
    const next = new Function('s', src)(s) ?? s;
    store.replace(next);
  }, patch);
}

export async function dispatch(page: Page, action: unknown) {
  return page.evaluate((a) => (window as unknown as { __vanta: { dispatch(a: unknown): unknown } }).__vanta.dispatch(a), action);
}

/** Opens a tab by its nav label, going through the MORE sheet for secondary tabs. */
export async function openTab(page: Page, label: RegExp) {
  const nav = page.getByRole('navigation');
  const direct = nav.getByRole('button', { name: label });
  if (await direct.count()) {
    await direct.first().click();
    return;
  }
  await nav.getByRole('button', { name: /more/i }).click();
  await page.getByRole('group', { name: /more tabs/i }).getByRole('button', { name: label }).first().click();
}

/** The combat arena: the region that receives taps. */
export function arena(page: Page) {
  return page.getByTestId('combat-arena');
}

export async function humanTaps(page: Page, count: number, seed = 1) {
  const box = await arena(page).boundingBox();
  expect(box).not.toBeNull();
  let x = seed;
  const rand = () => {
    x = (x * 16807) % 2147483647;
    return x / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    await page.touchscreen.tap(box!.x + box!.width * (0.35 + rand() * 0.3), box!.y + box!.height * (0.4 + rand() * 0.2));
    await page.waitForTimeout(120 + rand() * 160);
  }
}
