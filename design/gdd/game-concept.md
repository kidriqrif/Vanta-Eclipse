# Vanta Eclipse — Game Concept

## Identity

Vanta Eclipse is a commercial incremental RPG blending clicker, idle, RPG,
and minigame mechanics. Dark fantasy tone, mobile-first, built for years of
content updates.

- **Platform priority:** Android (Google Play) first, then Steam and iOS.
- **Engine:** Godot 4.7 Stable, GDScript.
- **Orientation:** Portrait, 1080×1920 reference canvas, responsive.
- **Audience:** Incremental/idle-game players (Cookie Clicker, AdVenture
  Capitalist, Melvor Idle fans) who also want light RPG progression —
  equipment, relics, pets, prestige, minigames.

## Core loop

```
Tap enemies -> Gain Eclipse Essence -> Upgrade stats -> Collect equipment
-> Defeat bosses -> Unlock new worlds -> Unlock new mechanics -> Prestige
-> Become stronger -> Repeat forever
```

Target feel: a small reward every 1-3 minutes of active play, and a
meaningful reward every time the player returns after time away.

## Currencies

| Currency | Role |
| --- | --- |
| Eclipse Essence | Main currency — combat kills, spent in the upgrade shop |
| Void Crystals | Prestige currency — permanent upgrades, automation, skill trees |
| Astral Shards | Premium currency — cosmetics, convenience, never pay-to-win |

## Monetization stance

Player-friendly. Rewarded ads for bonuses (double offline rewards, extra
chest, bonus essence), one-time purchases (remove ads, starter pack,
cosmetics). No mechanic is ever pay-gated — ads and purchases only
accelerate or decorate.

## World structure (future milestones)

Each world spans 50 enemy levels with its own enemy roster, nebula
palette, and essence multiplier. A boss guards every 10th level (timed
fight; failing drops the player back to farming with a retry button), and
the level-50 boss of each world is its world boss — defeating it unlocks
the next world.

World 1 Dark Forest (levels 1-50; introduces basic combat and, at level
15, Auto-Attack) -> World 2 Frozen Ruins (51-100) -> World 3 Molten Core
(101-150; crafting planned) -> World 4 Astral Temple (relics planned) ->
World 5 Void Dimension (world modifiers planned) -> more worlds added over
time as pure data drops.

Design correction (supersedes the original sketch): Auto-Attack shipped as
a Dark Forest level-15 unlock in Milestone 4 and stays there — re-gating a
feature players already have behind Frozen Ruins would be a take-back.
Later worlds introduce the *new* mechanics of their own milestones.

## Build status (updated as milestones land)

- Milestone 1: project architecture, autoload managers, save system — DONE
- Milestone 2: combat, enemies, damage numbers, animations — DONE
- Milestone 3: currency system, upgrade shop, stat scaling, balancing — DONE
- Milestone 4: auto attacks, idle mechanics, offline progression — DONE
- Milestone 5: boss battles, world progression, unlock system — DONE
- Milestone 6: equipment, inventory, loot tables, crafting — DONE
- Milestone 7: relics, pets, passive bonuses — DONE
- Milestone 8: prestige (Eclipse), Ascendant Powers skill tree — DONE
