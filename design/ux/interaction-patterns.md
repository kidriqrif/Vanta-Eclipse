# Vanta Eclipse — Interaction Pattern Library

Reusable UI/UX patterns already implemented in the game. New screens reuse
these instead of inventing variants. When implementation introduces a
genuinely new pattern, it gets added here (see each milestone's
Implementation phase).

---

## Scene Fade Transition
**Used in:** every screen change (main menu ↔ settings ↔ gameplay).
**Behavior:** 0.25s fade to a near-black overlay, swap scene, fade back in.
Input is blocked while covered.
**Implementation:** `SceneManager.change_scene()`
(`scripts/managers/scene_manager.gd`), a `CanvasLayer` at layer 100 with a
full-rect `ColorRect`.

## Tap-to-Attack Combat Area
**Used in:** gameplay screen.
**Behavior:** the enemy sprite region is one large touch target (not just
the sprite bounds). One `InputEventMouseButton` press = one attack, works
identically for touch (Godot emulates touch as mouse by default) and mouse.
**Implementation:** `Control.gui_input` on `%CombatArea`
(`scripts/ui/gameplay.gd`).

## Floating Damage Number
**Used in:** every hit landed on an enemy.
**Behavior:** number pops in with a back-ease scale bounce, drifts up and
sideways, fades out over ~0.75s, then frees itself. Crits are larger, gold,
with a darker outline — color is never the *only* signal; size and motion
differ too.
**Implementation:** `DamageNumber` (`scripts/ui/damage_number.gd`),
instantiated from `scenes/gameplay/damage_number.tscn`.

## Slide-Up Panel (bottom sheet)
**Used in:** the upgrade shop.
**Behavior:** a panel anchored to the bottom slides up to cover roughly the
bottom half of the screen over 0.28s (cubic ease-out), with a CLOSE button;
sliding back down hides it. The screen behind stays interactive-adjacent
(player can keep tapping the enemy above the sheet).
**Implementation:** `UpgradeShopPanel` (`scripts/ui/upgrade_shop_panel.gd`).

## Currency Pop/Bounce Feedback
**Used in:** the Essence counter.
**Behavior:** whenever a tracked currency's balance changes, its display
scales up ~12% then eases back over 0.18s (back-ease). Cheap, readable
"something changed" signal without a full animation queue.
**Implementation:** `_pop_essence_display()` in `scripts/ui/gameplay.gd`,
driven by `EventBus.currency_changed`.

## Button Styles — Primary vs. Default
**Used in:** any screen with one dominant action vs. secondary ones.
**Behavior:** `PrimaryButton` theme variation (violet fill, glow shadow,
larger font) marks the one action the player is most likely to want next
(e.g. PLAY on the main menu). Default `Button` styling is used for
everything else (SETTINGS, BACK, MENU, individual shop buy buttons).
**Implementation:** `theme_type_variation = &"PrimaryButton"` in
`ui/theme/main_theme.tres`.

## Settings Control Row (Label + Slider/Toggle)
**Used in:** the Settings screen.
**Behavior:** a label above an `HSlider` (volumes) or a label beside a
`CheckButton` (haptics) inside a `PanelContainer` section. Sliders read
their value from the relevant manager on `_ready()` *before* connecting
`value_changed`, so restoring a saved value never fires a spurious "changed
by the player" side effect.
**Implementation:** `scripts/ui/settings_menu.gd`.

## Enemy Animation States
**Used in:** the enemy view during combat.
**Behavior:** four procedural states driven entirely by `EventBus` signals
— spawn (pop-in + fade), idle (gentle vertical hover loop), hit (squash +
color flash, extra rotation wobble on crit), death (shrink + fade +
particle burst in the enemy's own glow color). No external animation
files — all `Tween`-driven.
**Implementation:** `scripts/ui/enemy_view.gd`.

## Haptic Feedback on Impact Events
**Used in:** crits (light buzz) and kills (stronger buzz).
**Behavior:** short vibration on mobile only, gated by the player's Haptics
setting. Never the *only* feedback for an event — always paired with a
visual/audio cue.
**Implementation:** `SettingsManager.vibrate(duration_ms)`.

## Data-Driven Content Rows
**Used in:** the upgrade shop (one row per `UpgradeDefinition` resource).
**Behavior:** UI never hardcodes a list of content; it iterates a manager's
definitions and instances one row scene per entry. Adding content is a data
file, not a code change.
**Implementation:** `UpgradeShopPanel._ready()` +
`scenes/gameplay/upgrade_row.tscn`.
