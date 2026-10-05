# Vanta Eclipse — Game Concept

## Identity

Vanta Eclipse is a commercial incremental RPG blending clicker, idle, RPG,
and minigame mechanics. Dark fantasy tone, mobile-first, built for years of
content updates.

- **Platform priority:** Android (Google Play) first, then Steam and iOS.
  Neither of the last two is set up: there is no iOS project and no desktop
  wrapper.
- **Engine:** React 18 + TypeScript on Vite, packaged for Android with
  Capacitor 8. Android first; the same code also runs as a web build. The
  game was built in Godot, ported to Unity, and then ported to React. The
  earlier engines' code is in git history only.
- **Orientation:** Portrait. The Android activity is locked to portrait, and
  the UI is a single column at most 448 CSS px wide that respects the
  safe-area insets. The UX specs were drawn on a 1080×1920 canvas; on a
  360 CSS px-wide phone, 3 canvas px is about 1 CSS px.
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

## Build status

### Current state (1.4.0)

Version 1.4.0 (Android versionCode 5) rebuilt the game on a pure game core.
The Google AI Studio port it replaces did not work. The whole ruleset is now
plain TypeScript in `src/game/`: one GameState, a reducer that applies
actions to it, derived stats, loot, the tap guard, quests, arcade payouts,
offline earnings and the versioned save. Vitest unit-tests it
(`src/game/__tests__/`). The React screens in `src/components/` only read
state and dispatch actions. All content is data in `src/data/definitions.ts`.
`docs/ARCHITECTURE.md` describes how the pieces fit.

What ships: two worlds (Dark Forest 1–50, Frozen Ruins 51–100), boss gates
every 10th level, auto-attack at level 15, gear with salvage and forge, cards,
relics, companions, the Eclipse prestige with its skill tree, seven arcade
minigames (the milestone list below names the first four), the Codex
quest journal and offline earnings. Saves are local only. There is no cloud
save, but Android Auto Backup may carry the app's data to a reinstall or a
new phone.

Monetization is live code on test settings. AdMob serves Google's sample
(test) ads: a bottom banner, which Remove Ads hides, and three opt-in rewarded
offers with daily caps. Google Play Billing is integrated but switched off, so
the three products read "COMING SOON". See the Milestone 14 note below.

### Milestone history

These milestones were built in the earlier engines. The features carried over
to the current build; the engine-specific parts did not.

- Milestone 1: project architecture, autoload managers, save system — DONE
- Milestone 2: combat, enemies, damage numbers, animations — DONE
- Milestone 3: currency system, upgrade shop, stat scaling, balancing — DONE
- Milestone 4: auto attacks, idle mechanics, offline progression — DONE
- Milestone 5: boss battles, world progression, unlock system — DONE
- Milestone 6: equipment, inventory, loot tables, crafting — DONE
- Milestone 7: relics, pets, passive bonuses — DONE
- Milestone 8: prestige (Eclipse), Ascendant Powers skill tree — DONE
- Milestone 9: the Arcade — minigame framework + Void Reflex — DONE
- Milestone 10: Memory Match minigame — DONE
- Milestone 11: Connect Four minigame — DONE
- Milestone 12: Void Salvo (Battleship) minigame — DONE
- Milestone 13: the Journal — quests, dailies, achievements — DONE
- Milestone 14: monetization architecture (stub providers then; real now — see below) — DONE
- Milestone 15: optimization pass, Android export config, release checklist — DONE

**Milestone 14 now:** the stub providers and their switch
(**MonetizationManager.USE_STUB_PROVIDERS**) are gone. `src/services/ads.ts`
is AdMob: initialize, then the UMP consent check, then the banner and the
rewarded offers. `src/services/billing.ts` is Google Play Billing. Every
launch switch is in one file, `src/config/monetization.ts`: the banner and
rewarded ad unit IDs (Google's sample IDs today), `isTesting` (true), and
`BILLING_ENABLED` (false). The one other thing to change at launch is the
AdMob app ID in `android/app/src/main/AndroidManifest.xml`, which is also a
sample ID. The rest:

- Ad placements, caps and products are data in `src/data/definitions.ts`, and
  no price is hard-coded.
- There is no server-side receipt validation.
- Today the build shows test ads and charges nothing.

`production/monetisation-switch.md` is the go-live runbook.

**Release readiness:** `design/RELEASE-CHECKLIST.md` lists what still blocks
production. That includes the real AdMob IDs, the Play products and
`BILLING_ENABLED`, the updated privacy policy going live, new store
screenshots, the device checklist in `design/TESTING-GUIDE.md`, and Play's
closed-testing requirement for personal developer accounts.
