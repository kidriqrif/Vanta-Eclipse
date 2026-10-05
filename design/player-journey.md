# Vanta Eclipse — Player Journey

What the player is doing, feeling, and needing at each stage. UX specs
should name which stage they serve.

## 1. First Launch

Player opens the app for the first time. The current build has no main
menu: the app opens straight onto the Dark Forest combat screen, with a
one-time welcome tip over it. The earlier engines opened on an animated
void-nebula main menu whose single PLAY button was the only real choice.
That menu and its "find PLAY without hunting" need are history, though
`design/ux/milestone-4-idle-offline.md` still refers to them.

**Needs:** feel the tone (dark, mysterious, a little grand) in under 3
seconds; get to the first tap without hunting. The welcome tip must not be a
wall of text, and it must dismiss with one obvious tap.

## 2. First Combat

Player lands in the Dark Forest gameplay screen. A Gloom Wisp floats in
front of them.

**Needs:** understand "tap the enemy" with zero instruction (the enemy
visibly reacts to taps — squash, flash, floating damage number — so the
mechanic teaches itself within 1-2 taps). First kill should land within
~10 taps.

## 3. First Purchase

After a few kills, the player has enough Eclipse Essence to afford the
first Tap Damage upgrade (5 essence; it was called Void Claws in the earlier
engines). The upgrade list is the home tab, open under the combat arena
(its tab is labelled UPGRADES; gear forging lives in the ARMOR tab), and the
essence counter is always visible in the header.

**Needs:** notice they can afford something (the buy button visibly lights
up when affordable) and feel the payoff immediately (next tap hits harder).

## 4. Idle Discovery (Milestone 4 — new)

Around enemy level 15, Auto-Attack unlocks. The player may or may not still
be actively tapping at this point.

**Needs:** a clear, celebratory "something new just unlocked" moment (not a
silent state change); understand that the game now progresses even when
they're not tapping, without needing to read a wall of text.

## 5. Return Session (Milestone 4 — new)

The player closed the app (or Android killed it in the background and it
re-launched) and comes back minutes, hours, or the next day later.

**Needs:** immediately see what happened while they were away — a single
clear number ("you earned X Essence while away"), not a wall of stats;
one-tap dismissal so it never blocks getting back into the game; never feel
punished for having Auto-Attack "waste" time capped too low without
understanding why.

## 6. First Boss (Milestone 5 — new)

Around 1-2 minutes in, the player hits enemy level 10 and meets the first
boss: a bigger, meaner creature with a countdown timer.

**Needs:** instantly read "this is different and dangerous" (distinct
visual language: boss plate, timer, imposing presentation) without any
tutorial text; understand the stakes (beat it before the timer ends);
and — critically — a fail state that redirects rather than punishes:
losing must clearly say "grow stronger, then come back" with an obvious
retry path, never a dead end. Winning should feel like breaking a wall:
bigger payout, visible progress.

## 7. World Unlock (Milestone 5 — new)

Defeating the level-50 world boss ends the Dark Forest and opens the
Frozen Ruins.

**Needs:** a "new chapter" moment bigger than any celebration so far —
this is the game's largest reward to date and should be acknowledged
before play continues; immediately *visible* change afterward (new
enemies, new sky/palette) so the unlock feels real, not just a label; and
a sense of permanence — worlds never re-lock.

## 8. First Equipment Drop (Milestone 6 — new)

Somewhere in the first minutes of play, an enemy dies and leaves
something behind: the player's first piece of gear.

**Needs:** the drop moment must be noticeable without interrupting
combat (loot is a bonus, never a gate); finding where gear lives must
take one obvious tap; the item's power must be readable at a glance by a
player who has never seen an RPG stat sheet (rarity color + a few plain
stat lines, not a spreadsheet); equipping must feel immediately stronger
(the very next hit shows bigger numbers).

## 9. Gear Routine (Milestone 6 — new)

Once drops are flowing, the player settles into a check-compare-equip
rhythm every few minutes, salvaging rejects into Void Scraps and
eventually forging when scraps pile up.

**Needs:** comparing new vs equipped must be effortless (side-by-side or
clear better/worse signals); salvage must be safe (no accidental loss of
equipped or clearly-better items); the Forge must read as a slot machine
worth pulling, not a spreadsheet; none of this may ever be required to
progress — a player who ignores gear entirely just moves slower.

## 10. First Relic (Milestone 7 — new)

Deep enough in, the sealed relic slot awakens and the player equips their
first relic — a unique, permanent, build-defining effect (not another
stat stick).

**Needs:** understand at a glance that a relic is *different* from
equipment (unique named effect, not random affixes); feel the effect is
meaningful and build-shaping; only one relic active at a time, so the
choice matters; swapping is free and reversible.

## 11. Pet Companion (Milestone 7 — new)

The player unlocks their first pet, which fights alongside them and grows.

**Needs:** a pet feels like a growing companion, not a menu — it levels
from play, evolves at milestones (visible transformation), and its
passive bonus is legible; managing pets is a light, rewarding routine,
never a chore, and never required to progress.

## 12. Later stages (built, not yet written up here)

First Prestige (the Eclipse, Milestone 8) — First Minigame (the Arcade,
Milestone 9+). Both are in the game; their stages have not been written in
this document yet. Until they are, the design frames are in
`design/ux/milestone-8-prestige.md` and
`design/ux/milestone-9-minigame-framework.md`.
