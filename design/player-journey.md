# Vanta Eclipse — Player Journey

What the player is doing, feeling, and needing at each stage. UX specs
should name which stage they serve.

## 1. First Launch

Player opens the app for the first time. Sees the animated void-nebula main
menu, the Vanta Eclipse title and emblem. No tutorial modal — the single
PLAY button is the only real choice, so there's nothing to explain yet.

**Needs:** feel the tone (dark, mysterious, a little grand) in under 3
seconds; find PLAY without hunting.

## 2. First Combat

Player lands in the Dark Forest gameplay screen. A Gloom Wisp floats in
front of them.

**Needs:** understand "tap the enemy" with zero instruction (the enemy
visibly reacts to taps — squash, flash, floating damage number — so the
mechanic teaches itself within 1-2 taps). First kill should land within
~10 taps.

## 3. First Purchase

After a few kills, the player has enough Eclipse Essence to afford Void
Claws (5 essence). The UPGRADES button and essence counter are both always
visible during combat.

**Needs:** notice they can afford something (the buy button visibly lights
up when affordable) and feel the payoff immediately (next tap hits harder).

## 4. Idle Discovery (Milestone 4 — new)

Around enemy level 15, Auto-Attack unlocks. The player may or may not still
be actively tapping at this point.

**Needs:** a clear, celebratory "something new just unlocked" moment (not a
silent state change); understand that the game now progresses even when
they're not tapping, without needing to read a wall of text.

## 5. Return Session (Milestone 4 — new)

The player closed the app (or Godot re-launched after being backgrounded on
Android) and comes back minutes, hours, or the next day later.

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

## 10. Future stages (not yet built)

First Relic (Milestone 7) — First Prestige (Milestone 8) — First
Minigame (Milestone 9+).
