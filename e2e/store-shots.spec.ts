import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { ENEMIES } from '../src/data/definitions';
import { enemyHpFor } from '../src/game/stats';
import { arena, dispatch, freshGame, openTab, patchState } from './helpers';

/**
 * Not a test: captures the Google Play phone screenshots into production/screenshots/, in store
 * order. Skipped unless CAPTURE=1:
 *
 *   CAPTURE=1 npx playwright test e2e/store-shots.spec.ts
 *
 * Each file is 1080x1920 (9:16 portrait: a 405x720 CSS viewport at 8/3 device pixels) and is
 * re-encoded as a 24-bit RGB PNG with no alpha channel, as Play asks. Every shot starts from the
 * same seeded mid-game save, so nothing one shot does (a kill, a drop, a token spent) shows in
 * the next. Optional: SHOTS=01,03 captures only the files whose names start that way;
 * STORE_SHOTS_DIR writes somewhere else for a dry run.
 */
const OUT = process.env.STORE_SHOTS_DIR || 'production/screenshots';
const ONLY = (process.env.SHOTS || '').split(',').filter(Boolean);
const W = 405;
const H = 720;

test.use({ viewport: { width: W, height: H }, deviceScaleFactor: 1080 / W, isMobile: true, hasTouch: true });

const TUTORIALS_SEEN = { welcome: true, forge: true, bosses: true, auto: true, arcade: true, eclipse: true, ruins: true };

/** A plausible mid-game save: two Eclipses in, Frozen Ruins open, a run in the sixties. */
function midGame(now: number) {
  const item = (id: number, slot: string, rarity: number, itemLevel: number, affixes: Record<string, number>, seen = true) => ({
    id,
    slot,
    rarity,
    itemLevel,
    affixes,
    seen,
  });
  const card = (
    id: number,
    bossId: string,
    bossName: string,
    rarity: string,
    level: number,
    power: number,
    vigor: number,
    ago: number,
  ) => ({
    id,
    bossId,
    bossName,
    rarity,
    level,
    power,
    vigor,
    obtainedAt: now - ago,
  });
  return {
    lifetimePeakLevel: 74,
    peakRunLevel: 68,
    eclipseCount: 2,
    unlockedWorlds: ['dark_forest', 'frozen_ruins'],
    currencies: { essence: 486_250, void_crystals: 38, astral_shards: 120, void_scraps: 345 },
    upgrades: { void_claws: 34, eclipse_fangs: 6, dark_focus: 14, blood_moon: 6, essence_siphon: 15 },
    equipped: {
      weapon: item(101, 'weapon', 3, 62, { tap_flat: 96, crit_chance: 0.039, crit_damage: 0.31, boss: 0.18 }),
      helmet: item(102, 'helmet', 2, 58, { crit_damage: 0.29, essence: 0.16, crit_chance: 0.022 }),
      armor: item(103, 'armor', 1, 55, { essence: 0.12, boss: 0.14 }),
      boots: item(104, 'boots', 4, 66, { tap_pct: 0.21, crit_chance: 0.044, crit_damage: 0.38, essence: 0.19, boss: 0.2 }),
      gloves: item(105, 'gloves', 2, 64, { tap_pct: 0.16, crit_chance: 0.031, tap_flat: 88 }),
      ring: item(106, 'ring', 1, 60, { essence: 0.15, crit_chance: 0.028 }),
    },
    inventory: [
      item(120, 'weapon', 4, 70, { tap_flat: 182, tap_pct: 0.19, crit_chance: 0.047, crit_damage: 0.36, boss: 0.31 }, false),
      item(119, 'ring', 2, 68, { essence: 0.17, crit_damage: 0.24, tap_pct: 0.11 }, false),
      item(118, 'helmet', 3, 67, { tap_flat: 140, crit_chance: 0.04, essence: 0.2, boss: 0.33 }),
      item(117, 'gloves', 1, 66, { crit_damage: 0.22, essence: 0.09 }),
      item(116, 'boots', 0, 65, { tap_flat: 104 }),
      item(115, 'armor', 2, 63, { boss: 0.3, tap_pct: 0.14, crit_chance: 0.025 }),
      item(114, 'ring', 0, 61, { crit_chance: 0.021 }),
    ],
    cards: [
      card(210, 'elder_frost_shade', 'Elder Comet Drifter', 'epic', 60, 1088, 23, 60_000),
      card(209, 'hollow_sovereign', 'Hollow Sovereign', 'legendary', 50, 1210, 31, 3_600_000),
      card(208, 'elder_shade_stalker', 'Elder Shade Stalker', 'rare', 30, 402, 17, 7_200_000),
      card(207, 'elder_thorn_fiend', 'Elder Thorn Fiend', 'uncommon', 40, 431, 13, 9_000_000),
      card(206, 'elder_gloom_wisp', 'Elder Gloom Wisp', 'common', 10, 79, 10, 12_000_000),
      card(205, 'elder_rime_fiend', 'Elder Rime Cluster', 'rare', 70, 945, 16, 15_000_000),
      card(204, 'elder_thorn_fiend', 'Elder Thorn Fiend', 'common', 20, 158, 9, 20_000_000),
      card(203, 'elder_shade_stalker', 'Elder Shade Stalker', 'uncommon', 30, 299, 14, 30_000_000),
    ],
    pets: {
      ember: { xp: 1_180, seen: true, absorbed: 0.18 },
      frostling: { xp: 470, seen: true, absorbed: 0.06 },
    },
    activePetId: 'ember',
    relicsAwakened: true,
    relics: [
      { id: 'essence_prism', seen: true },
      { id: 'hunters_sigil', seen: true },
      { id: 'twin_fang', seen: true },
    ],
    activeRelicId: 'essence_prism',
    skills: {
      abundance: 4,
      crystalline: 3,
      eternal_reflex: 1,
      void_edge: 2,
      deep_rest: 2,
      dominion: 1,
      ruin: 1,
      swift_hunt: 2,
      long_slumber: 1,
    },
    tutorialsSeen: TUTORIALS_SEEN,
    nextId: 300,
  };
}

/** Lifetime counters, the chain quests done so far, today's daily progress and the Arcade. */
const QUEST_PATCH = `
  s.quests.counters = { kills: 4820, boss_wins: 31, upgrades_bought: 412, items_dropped: 58, taps: 18650,
    eclipses: 2, minigame_played: 19, minigame_wins: 13, salvage: 24, forge: 6, cards_absorbed: 7, essence_earned: 2400000 };
  s.quests.claimed = ['q_first_blood','q_first_boss','q_first_power','q_the_climb','q_arcade','q_spoils','q_eclipse',
    'q_companion','q_relic','a_kills_1k'];
  s.quests.daily.counters = { daily_kills: 64, daily_boss_wins: 1, daily_taps: 96, daily_minigame_played: 2,
    daily_minigame_wins: 1, daily_items_dropped: 1, daily_salvage: 3, daily_forge: 0, daily_upgrades_bought: 5,
    daily_cards_absorbed: 0, daily_essence_earned: 7400 };
  s.arcade.tokens = 4;
  s.arcade.regenAnchor = Date.now() - 11 * 60 * 1000;
  s.arcade.records = { void_reflex: 286, memory_match: 9, connect_four: 13, battleship: 24, lights_out: 7,
    sequence_echo: 9, rune_sweeper: 71 };
`;

const FRESH_TAP_GUARD = '{ times: [], xs: [], ys: [], touch: [], lockedUntil: 0, strikes: 0, lastStrikeAt: 0 }';

/** Puts the fight at `level` against a normal `defId` with `hpFrac` of its health left. */
async function setFight(page: Page, mode: 'NORMAL' | 'FARM_MODE', level: number, defId: string, hpFrac = 1) {
  const maxHp = enemyHpFor(level, defId, false);
  const hp = Math.round(maxHp * hpFrac);
  await patchState(
    page,
    `s.combat = { ...s.combat, mode: '${mode}', level: ${level}, autoAcc: 0, bossTimeLeft: 30,
       enemy: { defId: '${defId}', level: ${level}, maxHp: ${maxHp}, hp: ${hp}, isBoss: false } };
     s.ui.tapGuard = ${FRESH_TAP_GUARD};
     return s;`,
  );
}

/**
 * A fresh game with the mid-game save on top. `damageNumbers: false` is the real Settings
 * toggle; the panel shots use it so a half-faded auto-attack number never sits on the enemy.
 */
async function seed(page: Page, opts: { damageNumbers: boolean }) {
  await freshGame(page);
  const save = JSON.stringify(midGame(Date.now()));
  await patchState(page, `Object.assign(s, ${save}); ${QUEST_PATCH} s.settings.damageNumbers = ${opts.damageNumbers}; return s;`);
}

function wanted(name: string) {
  return ONLY.length === 0 || ONLY.some((p) => name.startsWith(p));
}

/** No loot or level toast over the shot. */
async function noToasts(page: Page) {
  await expect(page.locator('.anim-toast')).toHaveCount(0, { timeout: 5000 });
}

async function shot(page: Page, name: string) {
  mkdirSync(OUT, { recursive: true });
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, animations: 'allow' });
  writeFileSync(path, toRgbPng(readFileSync(path)));
}

/** Scrolls the panel's own scroller so `target` sits `gap` CSS px below its top edge. */
async function scrollPanelTo(target: Locator, gap = 8) {
  await target.evaluate((el, g) => {
    const scroller = el.closest('.overflow-y-auto') as HTMLElement;
    scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - g;
  }, gap);
}

// ------------------------------------------------------------------ PNG: RGBA in, RGB out

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * Chromium writes 8-bit RGBA (colour type 6). Play wants 24-bit PNGs without alpha, so this
 * decodes the image, drops the (fully opaque) alpha channel and writes colour type 2.
 */
function toRgbPng(png: Buffer): Buffer {
  if (!png.subarray(0, 8).equals(PNG_SIG)) throw new Error('not a PNG');
  let off = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  const idat: Buffer[] = [];
  while (off < png.length) {
    const len = png.readUInt32BE(off);
    const type = png.toString('ascii', off + 4, off + 8);
    const data = png.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8];
      colorType = data[9];
      if (depth !== 8 || data[12] !== 0) throw new Error(`unsupported PNG: depth ${depth}, interlace ${data[12]}`);
    } else if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  if (colorType === 2) return png;
  if (colorType !== 6) throw new Error(`unsupported PNG colour type ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const inBpp = 4;
  const inStride = width * inBpp;
  const outStride = width * 3;
  const prevIn = Buffer.alloc(inStride);
  const curIn = Buffer.alloc(inStride);
  const prevOut = Buffer.alloc(outStride);
  const curOut = Buffer.alloc(outStride);
  const out = Buffer.alloc(height * (outStride + 1));
  const cand = [0, 1, 2, 3, 4].map(() => Buffer.alloc(outStride));

  for (let y = 0; y < height; y++) {
    // Unfilter one RGBA row.
    const ft = raw[y * (inStride + 1)];
    const src = raw.subarray(y * (inStride + 1) + 1, (y + 1) * (inStride + 1));
    for (let i = 0; i < inStride; i++) {
      const a = i >= inBpp ? curIn[i - inBpp] : 0;
      const b = prevIn[i];
      const c = i >= inBpp ? prevIn[i - inBpp] : 0;
      let v = src[i];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) v += paeth(a, b, c);
      else if (ft !== 0) throw new Error(`bad PNG filter ${ft}`);
      curIn[i] = v & 0xff;
    }
    curIn.copy(prevIn);
    for (let x = 0; x < width; x++) {
      if (curIn[x * 4 + 3] !== 255) throw new Error('screenshot has transparent pixels');
      curOut[x * 3] = curIn[x * 4];
      curOut[x * 3 + 1] = curIn[x * 4 + 1];
      curOut[x * 3 + 2] = curIn[x * 4 + 2];
    }
    // Refilter the RGB row with whichever filter gives the smallest sum (the usual heuristic).
    let best = 0;
    let bestSum = Infinity;
    for (let f = 0; f <= 4; f++) {
      const dst = cand[f];
      let sum = 0;
      for (let i = 0; i < outStride; i++) {
        const a = i >= 3 ? curOut[i - 3] : 0;
        const b = prevOut[i];
        const c = i >= 3 ? prevOut[i - 3] : 0;
        const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c);
        const v = (curOut[i] - pred) & 0xff;
        dst[i] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) {
        bestSum = sum;
        best = f;
      }
    }
    out[y * (outStride + 1)] = best;
    cand[best].copy(out, y * (outStride + 1) + 1);
    curOut.copy(prevOut);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour, no alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    PNG_SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(out, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ driving the fight

/** A seeded Park-Miller generator, so the tap pattern is the same on every run. */
function lcg(seed: number) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return x / 2147483647;
  };
}

interface Want {
  level: number;
  boss: boolean;
  /** The enemy's display name, which the damage numbers must not cover. */
  name: string;
  /** The enemy's HP fraction must stay within [lo, hi]. */
  lo: number;
  hi: number;
  /** At least this many consecutive manual taps, so the combo badge shows a real bonus. */
  combo: number;
}

/** Past this the combo is left to lapse and rebuilt, so the badge reads like a normal burst. */
const COMBO_CEILING = 40;
/** The combo window in src/game/reducer.ts is 1.5s; a longer pause lets it lapse. */
const COMBO_LAPSE_MS = 1700;

/**
 * Checks the fight in the page and, when it looks right, freezes every CSS animation in the
 * same task, so the screenshot records exactly that frame: the newest damage number a crit at
 * full opacity, every crit off the sprite's body, every visible number clear of the others, of
 * the enemy's name and of the badges, the hit flash on the sprite, the combo badge and the HP
 * bar inside [lo, hi]. The screen shake is finished rather than frozen, so the arena stays lined
 * up with the header. `overshot` means a kill or too much damage, and the fight has to be put
 * back.
 */
function checkAndFreeze(page: Page, want: Want): Promise<{ overshot: boolean; frozen: boolean; combo: number }> {
  return page.evaluate((w) => {
    const s = (window as unknown as { __vanta: { getState(): import('../src/game/state').GameState } }).__vanta.getState();
    const pct = s.combat.enemy.hp / s.combat.enemy.maxHp;
    const arenaEl = document.querySelector('[data-testid="combat-arena"]')!;
    const nums = [...arenaEl.querySelectorAll<HTMLElement>('.anim-damage')];
    const newest = nums[nums.length - 1];
    const crit = !!newest && (newest.textContent ?? '').startsWith('CRIT');
    const spans = [...arenaEl.querySelectorAll('span')];
    const byText = (t: string) => spans.find((el) => el.textContent === t);
    // The enemy's name, the PET and RELIC chips and the combo badge must stay readable.
    const fixed = [
      byText(w.name),
      byText('PET')?.parentElement,
      byText('RELIC')?.parentElement,
      spans.find((el) => /STRIKES/.test(el.textContent ?? ''))?.parentElement,
    ];
    const obstacles = fixed.filter((el): el is HTMLElement => !!el).map((el) => el.getBoundingClientRect());
    const visible = nums.filter((n) => Number(getComputedStyle(n).opacity) > 0.12);
    const boxes = visible.map((n) => n.getBoundingClientRect());
    type Box = { left: number; right: number; top: number; bottom: number };
    const apart = (a: Box, b: Box) => a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top;
    const clear =
      !!fixed[0] && boxes.every((a, i) => obstacles.every((o) => apart(a, o)) && boxes.every((b, j) => i === j || apart(a, b)));
    // Crits are the numbers the shot is about, so their glyphs (the line box less the leading)
    // must also stay off the body of the sprite: the middle 30% of the enemy image, where the
    // bright core is. A tendril behind one is fine; the core makes it unreadable. That holds for
    // an older crit still rising through the enemy, not only the newest.
    const sprite = [...arenaEl.querySelectorAll('img')].find((img) => img.alt === w.name)?.getBoundingClientRect();
    let critsReadable = false;
    if (crit && sprite) {
      const ix = sprite.width * 0.35;
      const iy = sprite.height * 0.35;
      const core = { left: sprite.left + ix, right: sprite.right - ix, top: sprite.top + iy, bottom: sprite.bottom - iy };
      critsReadable = visible
        .filter((n) => (n.textContent ?? '').startsWith('CRIT'))
        .every((n) => {
          const r = n.getBoundingClientRect();
          const lead = Math.max(0, (r.height - parseFloat(getComputedStyle(n).fontSize)) / 2);
          return apart({ left: r.left, right: r.right, top: r.top + lead, bottom: r.bottom - lead }, core);
        });
    }
    const toasts = document.querySelectorAll('.anim-toast').length;
    const overshot = s.combat.level !== w.level || s.combat.enemy.isBoss !== w.boss || pct < w.lo;
    const frozen = !overshot && pct <= w.hi && s.ui.combo.count >= w.combo && critsReadable && clear && toasts === 0;
    if (frozen) {
      for (const anim of document.getAnimations()) {
        if ((anim as CSSAnimation).animationName === 'screenShake') anim.finish();
        else anim.pause();
      }
      // Hold the game clock too (the provider ticks through this same store object), so no
      // auto-attack lands between this check and the screenshot.
      const store = (window as unknown as { __vanta: { dispatch(a: { type: string }): unknown } }).__vanta;
      const dispatch = store.dispatch;
      store.dispatch = (a) => (a.type === 'TICK' ? { ok: true } : dispatch(a));
    }
    return { overshot, frozen, combo: s.ui.combo.count };
  }, want);
}

/**
 * Taps like a person (varied spots, about three taps a second, on the lower half of the enemy,
 * so a fresh crit sits between its body and its name and the numbers rise over it) until
 * checkAndFreeze holds a good frame. A kill or an overshoot calls `reset` to put the same fight
 * back; the combo carries on, as it does when the next enemy appears.
 */
async function fightUntil(page: Page, want: Want & { reset: () => Promise<void>; seed: number }) {
  const { reset, seed, ...check } = want;
  const box = (await arena(page).boundingBox())!;
  const rand = lcg(seed);
  await reset();
  for (let i = 0; i < 400; i++) {
    await page.touchscreen.tap(box.x + box.width * (0.3 + rand() * 0.4), box.y + box.height * (0.5 + rand() * 0.08));
    await page.waitForTimeout(30);
    const r = await checkAndFreeze(page, check);
    if (r.frozen) return;
    if (r.overshot) await reset();
    if (r.combo > COMBO_CEILING) await page.waitForTimeout(COMBO_LAPSE_MS);
    await page.waitForTimeout(220 + rand() * 200);
  }
  throw new Error('the fight never reached the wanted state');
}

// ------------------------------------------------------------------ the minigame

/** Memory Match with perfect recall until `pairs` are found, then one more card turned. */
async function memoryMidGame(page: Page, pairs: number) {
  const host = page.getByTestId('minigame-host');
  const card = (i: number) => host.getByRole('button', { name: new RegExp(`^Card ${i + 1},`) });
  const known = new Map<number, string>();
  const matched = new Set<number>();
  const flip = async (i: number) => {
    await card(i).click();
    const face = ((await card(i).getAttribute('aria-label')) ?? '').replace(/^Card \d+, /, '').split(',')[0];
    known.set(i, face);
    return face;
  };
  const partner = (i: number, face: string) =>
    [...known.entries()].find(([j, f]) => j !== i && f === face && !matched.has(j))?.[0];
  const nextUnknown = (skip: number) => {
    for (let i = 0; i < 12; i++) if (i !== skip && !known.has(i) && !matched.has(i)) return i;
    return -1;
  };
  while (matched.size / 2 < pairs) {
    const seenPair = [...known.entries()].find(([i, f]) => !matched.has(i) && partner(i, f) !== undefined);
    const first = seenPair ? seenPair[0] : nextUnknown(-1);
    const face = await flip(first);
    const p = partner(first, face);
    const second = p !== undefined ? p : nextUnknown(first);
    if ((await flip(second)) === face) {
      matched.add(first);
      matched.add(second);
      await page.waitForTimeout(250);
    } else {
      await page.waitForTimeout(1000); // a miss shows for 800ms, then both cards turn back
    }
  }
  await flip(nextUnknown(-1));
  await page.waitForTimeout(350);
}

// ------------------------------------------------------------------ the shots

type Shot = { name: string; run: (page: Page) => Promise<void> };

/**
 * A secondary screen with the climb ticking along above it. The fight is set last, just before
 * the shot, so auto-attack has not yet worn the enemy down; `prepare` does anything inside.
 */
function panel(
  name: string,
  tab: RegExp,
  fight: { level: number; enemy: string; hp: number },
  prepare?: (page: Page) => Promise<void>,
): Shot {
  return {
    name,
    run: async (page) => {
      await seed(page, { damageNumbers: false });
      await openTab(page, tab);
      if (prepare) await prepare(page);
      await noToasts(page);
      await setFight(page, 'NORMAL', fight.level, fight.enemy, fight.hp);
      await page.waitForTimeout(350);
      await shot(page, name);
    },
  };
}

/** In store order. */
const SHOTS: Shot[] = [
  {
    // Home: the climb mid-fight, with the hit flash, a combo and a crit on screen.
    name: '01-combat',
    run: async (page) => {
      await seed(page, { damageNumbers: true });
      await page.waitForTimeout(300);
      const reset = () => setFight(page, 'NORMAL', 66, 'rime_fiend');
      const name = ENEMIES.rime_fiend.displayName;
      await fightUntil(page, { reset, level: 66, boss: false, name, lo: 0.3, hi: 0.72, combo: 15, seed: 11 });
      await shot(page, '01-combat');
    },
  },
  {
    // A gate boss with its 30-second timer running, over the cards every boss drops.
    name: '02-boss',
    run: async (page) => {
      await seed(page, { damageNumbers: true });
      await openTab(page, /cards/i);
      await page.waitForTimeout(300);
      const reset = async () => {
        await setFight(page, 'FARM_MODE', 69, 'hollow_sentinel');
        expect(await dispatch(page, { type: 'CHALLENGE_BOSS' })).toMatchObject({ ok: true });
      };
      // Level 70 is the Frozen Ruins' second gate: the Elder Rime Cluster.
      const name = ENEMIES.elder_rime_fiend.displayName;
      await fightUntil(page, { reset, level: 70, boss: true, name, lo: 0.42, hi: 0.85, combo: 12, seed: 5 });
      await shot(page, '02-boss');
    },
  },
  panel('03-armor', /armor/i, { level: 66, enemy: 'frost_shade', hp: 0.6 }, async (page) => {
    // A new Mythic drop compared with the equipped Legendary.
    await page.getByRole('button', { name: /mythic weapon/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
  }),
  panel('04-arcade', /arcade/i, { level: 64, enemy: 'hollow_sentinel', hp: 0.77 }),
  {
    // Memory Match mid-run: three pairs found, a fourth card turned.
    name: '05-memory',
    run: async (page) => {
      await seed(page, { damageNumbers: false });
      await openTab(page, /arcade/i);
      await page.getByTestId('minigame-card-memory_match').getByRole('button', { name: /play/i }).click();
      await expect(page.getByTestId('minigame-host')).toBeVisible();
      await memoryMidGame(page, 3);
      await shot(page, '05-memory');
    },
  },
  panel('06-beast', /beast/i, { level: 63, enemy: 'frost_shade', hp: 0.64 }),
  panel('07-eclipse', /eclipse/i, { level: 67, enemy: 'hollow_sentinel', hp: 0.55 }, async (page) => {
    // The Ascendant Powers tree, not the reset summary above it.
    await scrollPanelTo(page.getByRole('heading', { name: /ascendant powers/i }));
  }),
  panel('08-relics', /relics/i, { level: 62, enemy: 'rime_fiend', hp: 0.71 }),
];

test.describe('store screenshots', () => {
  test.skip(!process.env.CAPTURE, 'set CAPTURE=1 to capture the store screenshots');

  for (const s of SHOTS) {
    test(s.name, async ({ page }) => {
      test.skip(!wanted(s.name), 'not in SHOTS');
      test.setTimeout(240_000);
      await s.run(page);
    });
  }
});
