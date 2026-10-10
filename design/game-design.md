# Vanta Eclipse — Game Design

The design intent behind the build: what the game is, what each stage of a
player's life needs, and the accessibility bar every screen must meet. The
rules themselves live in code (`src/game/`) and are unit-tested; this file is
the *why*. When code and this file disagree on a number, the code wins.

## Identity

A commercial incremental RPG that blends clicker, idle, RPG and minigame
mechanics. Dark fantasy tone, mobile-first, built for years of content
updates.

- **Platform:** Android (Google Play) first; the same code runs as a web
  build. Steam and iOS are possible later; neither is set up.
- **Engine:** React 18 + TypeScript on Vite, packaged for Android with
  Capacitor 8. The game was built in Godot, ported to Unity, then to React;
  the old engines live only in git history.
- **Orientation:** portrait, one column at most 448 CSS px wide, inside the
  safe-area insets.
- **Audience:** idle-game players (Cookie Clicker, AdVenture Capitalist,
  Melvor Idle) who also want light RPG progression.

## Core loop

```
Tap enemies -> gain Essence -> upgrade stats -> collect gear -> beat bosses
-> unlock worlds and mechanics -> Eclipse (prestige) -> stronger -> repeat
```

Target feel: a small reward every 1–3 minutes of active play, and a
meaningful one every time the player returns after time away.

| Currency | Role |
| --- | --- |
| Eclipse Essence | Main currency: kills, minigames; spent on upgrades. Reset by an Eclipse. |
| Void Crystals | Prestige currency: Ascendant Powers (permanent skills). |
| Void Scraps | From salvaged gear; spent at the forge. |
| Astral Shards | Cosmetics only. Earned from quests; also sold. Never power. |

**Monetization stance.** Player-friendly. Rewarded videos are opt-in
bonuses on top of something already earned, each with a daily cap; one
banner; one-time purchases (Remove Ads, Starter Pack, shards for cosmetics).
No mechanic is ever pay-gated, and there are no interstitials or forced ads.

## Worlds

Each world spans 50 levels with its own enemy roster and essence multiplier.
A boss guards every 10th level on a 30-second timer; failing drops the player
to farm the level below with a CHALLENGE BOSS button. Each world's level-50
boss is its world boss and opens the next world.

Shipped: **Dark Forest** (1–50; auto-attack at 15, Arcade at 20, Eclipse at
50) and **Frozen Ruins** (51 onward, with no upper end until World 3 exists;
companions and relics awaken here). Planned: Molten Core (101–150, crafting),
Astral Temple, Void Dimension (world modifiers), then more worlds as data.

Auto-attack stays a Dark Forest level-15 unlock. Re-gating something players
already have would be a take-back; later worlds bring their own new
mechanics instead.

## Player journey

What the player needs at each stage. A screen that serves a stage should
meet its needs.

1. **First launch.** The app opens straight onto combat with one short
   welcome tip. Feel the tone (dark, mysterious, a little grand) within
   seconds and reach the first tap without hunting; the tip dismisses with
   one obvious tap.
2. **First combat.** "Tap the enemy" must teach itself in one or two taps
   (the enemy reacts: flash, shake, a floating number). First kill within
   about ten taps.
3. **First purchase.** After a few kills the first upgrade is affordable.
   The buy button visibly lights up, and the next tap hits harder.
4. **Idle discovery (level 15).** Auto-attack unlocks with a celebratory
   moment, not a silent change. The player understands the game now plays
   without them.
5. **Return session.** Coming back after minutes or days, one clear number
   says what was earned while away, dismissed in one tap. If the offline
   cap cut the reward, say so and say what raises it.
6. **First boss (level 10).** Instantly reads as different and dangerous
   (boss plate, timer). Losing redirects rather than punishes: "grow
   stronger, then come back", with an obvious retry. Winning feels like
   breaking a wall.
7. **World unlock (level 50).** The biggest celebration so far, before play
   continues, followed by a visible change (new enemies, new name).
8. **First gear drop.** Noticeable without interrupting combat. Finding gear
   takes one tap; its power reads at a glance (rarity word, colour, pips, a
   few plain stat lines); equipping makes the next hit visibly bigger.
9. **Gear routine.** Compare, equip, salvage, forge every few minutes.
   Comparing is effortless, salvage can never destroy equipped gear, the
   forge is a slot machine worth pulling, and ignoring gear only slows a
   player down.
10. **First relic.** A relic is a unique named effect, not a stat stick. One
    is attuned at a time, so the choice matters; swapping is free.
11. **Companion.** A pet levels from kills, evolves at milestones, and its
    bonus is legible. Managing it is a light routine, never required.
12. **First Eclipse and the Arcade.** The Eclipse says exactly what resets
    and what is kept before a two-tap confirm. Minigames are short, always
    pay something, and can be quit with a two-tap QUIT.

## Accessibility

The committed tier is **Enhanced**. Every UI change is reviewed against it.

**Basic (the floor).**
- Text legible at the default OS scale: nothing below 8 CSS px on a 360 CSS
  px-wide phone.
- Touch targets at least 32 CSS px (1 CSS px is 1 dp in the WebView);
  primary actions nearer 44.
- No state is shown by colour alone: pair colour with text, an icon, a shape
  or motion (a rarity shows its word and pips; a locked item says LOCKED).
- A Vibration setting exists and every haptic respects it.

**Enhanced (required for every feature).**
- **Motion:** non-essential animation is short and never blocks input. The
  OS reduced-motion setting turns off the enemy idle, hit and shake
  animations (`src/index.css`); Settings has Screen shake and Damage numbers
  toggles. An in-game Reduce Motion setting does not exist yet.
- **Colour vision:** the non-colour signal alone must carry the state under
  red-green and blue-yellow deficiencies.
- **Numbers:** every amount goes through `src/utils/numberFormat.ts`.
- **Dialogs:** every dialog has one obvious, always-visible way out, and
  Android back closes it.
- **Sound:** every sound cue has a visual or haptic twin, since many players
  play muted.

**Full (not committed).** Complete screen-reader traversal and labels,
adjustable touch-target size, a high-contrast theme, adjustable text scale.
