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

World 1 Dark Forest (basic combat) -> World 2 Frozen Ruins (auto attacks,
narratively) -> World 3 Molten Core (crafting) -> World 4 Astral Temple
(relics) -> World 5 Void Dimension (world modifiers) -> more worlds added
over time.

Note: the *build* roadmap introduces the Auto-Attack system mechanically in
Milestone 4, ahead of the world-gating system (Milestone 5). Until worlds
exist, Auto-Attack unlocks on an enemy-level threshold instead of a world
gate; Milestone 5 will re-frame that unlock as a Frozen Ruins world reward.

## Build status (updated as milestones land)

- Milestone 1: project architecture, autoload managers, save system — DONE
- Milestone 2: combat, enemies, damage numbers, animations — DONE
- Milestone 3: currency system, upgrade shop, stat scaling, balancing — DONE
- Milestone 4: auto attacks, idle mechanics, offline progression — IN PROGRESS
