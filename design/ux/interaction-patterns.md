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

## Centered Modal Dialog (Blocking)
**Used in:** offline-rewards popup. Future: prestige/delete-save
confirmations, boss-defeat and world-unlock announcements.
**Behavior:** for moments the player must actively acknowledge (unlike the
optional Slide-Up Panel). Full-screen scrim (the SceneManager fade color at
0.72 alpha) blocks all input behind it; a centered card holds content and
exactly ONE dismiss action styled as `PrimaryButton`, live from the first
frame — no tap-outside, no timeout, no second exit. Entrance 0.2s/0.25s
back-ease pop; exit 0.18s/0.2s; the node frees itself.
**Implementation:** the reusable artifact is the script contract
`CenteredModalDialog` (`scripts/ui/centered_modal_dialog.gd`; expects
`%Scrim`, `%Card`, `%ConfirmButton`, emits `confirmed`). Each concrete
dialog is its own scene extending it (first:
`scenes/gameplay/offline_rewards_modal.tscn`). A shared base *scene* is
deliberately deferred until a third consumer exists.

## Unlock Celebration Toast (non-blocking)
**Used in:** the Auto-Attack unlock moment. Future: any one-time feature
unlock worth celebrating without interrupting play.
**Behavior:** a transient card in the upper screen region on CanvasLayer 50
that ignores ALL input (taps pass through to combat), pops in with the
project's back-ease bounce, holds ~1.4s, fades, frees itself. Plays at most
once per save file per unlock — never replayed on load.
**Implementation:** `scenes/gameplay/auto_attack_toast.tscn` +
`scripts/ui/auto_attack_toast.gd`, instanced by the gameplay scene on the
relevant EventBus signal.

## Status Badge (pill)
**Used in:** the AUTO-ATTACK ACTIVE badge in the gameplay top bar. Future:
any permanent "system is active" readout.
**Behavior:** a non-interactive pill (`mouse_filter` IGNORE, exempt from
touch-target minimums) with icon + text; state is carried by presence and
words, never color alone. Appears with a one-time scale pop, then a purely
decorative 1.2s opacity pulse (1.0↔0.75). Once shown, never hidden again.
**Implementation:** `BadgePanel` theme variation in `main_theme.tres`;
badge node lives in `gameplay.tscn`'s `WorldVBox`, pop/pulse tweens in
`scripts/ui/gameplay.gd`.

## Hold-to-Reveal Exact Number
**Used in:** the offline modal's essence figure. Future: retrofit onto the
HUD essence counter and any other abbreviated large number.
**Behavior:** big numbers display abbreviated via `NumberFormat.format()`;
pressing and holding the figure swaps in the exact comma-grouped integer
(`NumberFormat.format_exact()`) for as long as held. A caption advertises
the affordance. Satisfies the Enhanced tier's "Readable numbers" rule.
**Implementation:** label with `mouse_filter = STOP` + `gui_input`
press/release handling — see `scripts/ui/offline_rewards_modal.gd`.

## CanvasLayer Registry
Overlay stacking is fixed project-wide: scene UI = 0, celebration toast =
50, blocking modals = 60, SceneManager transition fade = 100. New overlays
slot below 100 so a scene change can always cover them.

## Data-Driven Content Rows
**Used in:** the upgrade shop (one row per `UpgradeDefinition` resource).
**Behavior:** UI never hardcodes a list of content; it iterates a manager's
definitions and instances one row scene per entry. Adding content is a data
file, not a code change.
**Implementation:** `UpgradeShopPanel._ready()` +
`scenes/gameplay/upgrade_row.tscn`.
