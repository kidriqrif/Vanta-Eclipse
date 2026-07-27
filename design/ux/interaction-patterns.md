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

## Countdown Timer Bar
**Used in:** boss fights. Future: timed minigames, timed ad-bonus windows.
**Behavior:** a full-width bar draining smoothly from a configured
duration to zero with centered 28px `M:SS` numerals inside it (outlined —
text over a moving two-tone fill is always outline-anchored). Urgency at
`min(10s, duration/3)` remaining: ember fill + 0.6s decorative pulse; the
numerals alone are sufficient. Non-interactive. The bar never owns the
countdown — it polls its owner system per frame.
**Implementation:** `scenes/common/countdown_timer_bar.tscn` +
`scripts/ui/countdown_timer_bar.gd` (self-syncs via `sync_with_combat()`).

## Transient Result Banner (repeatable, non-blocking)
**Used in:** boss win/fail. Future: minigame results, drop announcements.
**Behavior:** the Unlock Celebration Toast's geometry/motion/input-
transparency, but repeatable and parameterized (`setup(icon, headline,
body, is_win)`); win variant celebrates in violet, fail stays neutral.
A depth-1 queue (owned by the spawning scene) prevents layer-50 stacking.
**Implementation:** `scenes/common/result_banner.tscn` +
`scripts/ui/result_banner.gd`.

## Blocking-Modal Presentation Queue
**Used in:** gameplay arrivals where multiple must-acknowledge moments
collide (offline rewards + world unlock).
**Behavior:** blocking modals never stack; a scene-owned queue presents
one at a time — chronological past (offline) before go-forward state
(world unlock) — each next presentation on the previous one's exit.
**Implementation:** `_enqueue_modal()` / `_present_next_modal()` in
`scripts/ui/gameplay.gd`.

## Inspector Card (dismissible, multi-action)
**Used in:** the item detail card (equip/salvage/close). Future: any
player-summoned detail surface with more than one action.
**Behavior:** deliberately NOT the Centered Modal Dialog — that pattern's
contract is exactly one dismiss and no tap-outside. The Inspector Card is
player-initiated, carries several actions (EQUIP/UNEQUIP + SALVAGE +
CLOSE), and closes by CLOSE **or** scrim-tap. Rarity-bordered card on a
lighter scrim (0.6, a browse surface not a hard stop). Buttons live from
frame one. Supports an info-only mode (empty/sealed slots) that shows one
message and CLOSE alone.
**Implementation:** `scripts/ui/inspector_card.gd` +
`scenes/gear/inspector_card.tscn`.

## Loot Toast (compact transient pickup)
**Used in:** equipment drops. Future: any frequent, low-ceremony pickup.
**Behavior:** a small rarity-colored pill (CanvasLayer 50, all nodes
IGNORE) that pops, holds ~1.3s, fades, self-frees. Quick successive drops
**collapse** into one pill ("N items") rather than stacking or queuing; a
hard MAX_LIFETIME ceiling stops a drop storm from keeping it alive
forever. Rarity is carried by pip count + word, never color alone. Rare
top-tier events (Mythic) escalate to the Result Banner instead.
**Implementation:** `scripts/ui/loot_toast.gd` +
`scenes/gear/loot_toast.tscn`.

## Two-Tap Arm (in-place destructive confirm)
**Used in:** Epic+ single salvage and bulk salvage-commons. Future: any
destructive action too frequent for a full confirm dialog.
**Behavior:** the destructive button re-labels to a confirming state that
also **discloses the outcome** ("TAP AGAIN: +N SCRAPS", "TAP AGAIN: N →
+M") and disarms after ~2.5s. One tap arms, a second within the window
commits; the yield is always on the button face before commitment.
Common/Rare skip arming (cheap, plentiful). Never applies to equipped
items.
**Implementation:** `scripts/ui/inspector_card.gd` (single),
`scripts/ui/gear.gd` (bulk).

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

## Diegetic Companion Entry & Durable Badges
**Used in:** the active pet on the combat screen (`CompanionButton`,
200×200, low-left of `CombatArea`, clear of the centred enemy). Future:
any always-present ally/summon that is also a screen entry point.
**Behavior:** the button *is* the companion — it shows the active pet's
current-stage sprite and a persistent "Lv. N" pill, and doubles as the tap
target for the Pets screen. Its NEW badge is a **durable record**: it
reflects `PetManager.get_unseen_count() > 0` (any unseen companion —
starter grant or a boss drop), not a fired signal, so a missed banner never
loses the news; it clears when the Pets screen marks all seen. Level-ups
are low-ceremony (§2.8): the Lv. pill re-texts and both it and the button
get a center-pivot scale-pop (`_pop_control`), no toast queued. Relic drops
mirror this on the GEAR side — `_update_count_pill()` sums unseen equipment
**and** unseen relics, so the pill is the durable record for everything
behind Gear.
**Implementation:** `_update_companion()` / `_pop_control()` /
`_update_count_pill()` in `scripts/ui/gameplay.gd`; nodes in
`scenes/gameplay/gameplay.tscn`.

## Single-Class Accent Scope
**Used in:** relics, pets, bosses — every family that carries a signature
color. Enforced across M5–M7.
**Behavior:** each accent belongs to exactly one class and never leaks.
Aureate gold (`Color(0.961,0.769,0.318)` frame, `0.984,0.906,0.659` ivory
names) is **relic-only** — never on buttons, gear, pets, or chrome. The
companion class wears **ally-violet** `Color(0.545,0.361,0.965)` — one
color for XP fill, roster spine (a uniform 6px left border on every row),
active border, and the Lv./NEW/ACTIVE pills; a pet never borrows the
boss-ember threat accent `Color(0.984,0.573,0.235)` (boss-only) or any
per-species tint. Data labels stay standard ink `Color(0.906,0.886,0.973)`.
Relic glow is a single sanctioned step (shadow_size 12), below the
PrimaryButton hover glow; the empty relic slot dims its sigil
(`modulate.a 0.30`, shadow 8) so it never reads as attuned.
**Implementation:** `ALLY_VIOLET`/`STANDARD` in `scripts/ui/pets.gd`;
`_make_relic_tile()` in `scripts/ui/gear.gd`.

## Segmented Panel Switch
**Used in:** the Eclipse screen (ASCEND | POWERS). Future: any screen with
two or three sibling views that share one context header.
**Behavior:** one row of equal-width buttons (h=96) above a stack of
panels; exactly one panel is visible. The active segment is marked three
ways so it survives color loss — a filled background, the brighter label
color, and a 4px underline bar in the family accent. The segment's own word
is its label, so the active view is always named. Switching never reloads
data; both panels are built once and toggled.
**Implementation:** `_set_active_tab()` / `_style_tab()` in
`scripts/ui/eclipse.gd`.

## Reset/Kept Disclosure
**Used in:** the Eclipse (prestige) commit. Future: any irreversible action
that trades something away for something permanent.
**Behavior:** the screen states the full cost *before* the action is
reachable — two labelled columns (RESETS / KEPT) listing every affected
system in plain words, always visible, never behind a disclosure toggle.
The commit itself then uses the **Two-Tap Arm** pattern, whose armed face
discloses the yield ("TAP AGAIN · +N ◆ · RESETS RUN"). The player can never
be surprised by what an irreversible act costs them.
**Implementation:** `_make_summary_column()` / `_on_collapse_pressed()` in
`scripts/ui/eclipse.gd`.

## Scroll-Safe Built Content
**Used in:** every list built in code inside a `ScrollContainer` (Eclipse
powers/ascend, gear, pets).
**Behavior:** nodes created in GDScript default to `MOUSE_FILTER_STOP`, and
a STOP child **swallows a touch-drag that begins on it** — so a card body or
label silently kills drag-scrolling from that point. Every non-interactive
node built in code therefore sets `mouse_filter = MOUSE_FILTER_IGNORE`
explicitly (including the list's own VBox in the scene). Only real controls
(Buttons) stay STOP. Setting a parent to IGNORE never blocks its children:
picking checks children first.
**Implementation:** `scripts/ui/eclipse.gd` (all builders).

## Font-Safe Glyphs
**Applies to:** every string that reaches a Button or a `HeaderLabel` /
`TitleLabel`.
**Behavior:** the theme sets Cinzel on `Button/fonts/font` and the header
label variations, and Cinzel is a 220-codepoint Latin display face. It does
**not** contain `◈ ◆ ★ ● →`, so those render as `.notdef` boxes there —
verified against `fonts/cinzel-latin-700-normal.woff2`. Only `·` (U+00B7)
and `—` (U+2014) among the punctuation we use are Cinzel-safe.
Therefore: **buttons and headers spell it out** ("PLAY · 1 TOKEN",
"NEED 12 MORE", "TAP AGAIN: 12 FOR +24"), while decorative glyphs live only
in plain Labels, which fall back to Godot's built-in face because the theme
sets no `default_font`. Where a glyph would be identity rather than
decoration (a currency mark), prefer the actual **icon** beside the number —
it is a stronger cue than a character and cannot go missing.
**Check:** `grep -rE '(button|Button)\.text\s*=.*[◈◆★●→]' scripts/` must
come back empty.

## Minigame Teardown
**Used in:** the Arcade host/minigame contract. Future: any embedded,
self-contained mode that reports a result to a frame around it.
**Behavior:** a result banner is a layer-50 transient and does **not** block
input, so a game that has reported its result keeps running underneath it —
timers fire, taps register. The host therefore calls `teardown()` the moment
a run resolves; the base implementation stops every child Timer and refuses
input, and subclasses override for anything extra (calling `super()` first).
**Consequence — child Timers and `create_managed_tween()` are the required
timing idioms.** A `get_tree().create_timer()` belongs to the SceneTree, not
the game, so teardown cannot reach it and it fires after the run has ended.
The same is true of `create_tween()`: the SceneTree drives tweens
independently of `process_mode`, so an unmanaged one keeps animating after a
run resolves — flipping a card or dropping a piece underneath the result
banner. `Minigame.create_managed_tween()` records the tween so `teardown()`
kills it.
**Check:** inside `scripts/minigames/`, `create_tween()` should appear only in
`create_managed_tween()` itself.
**Corollary — a tween must never own a resting state that outlives the run.**
Teardown *kills* managed tweens rather than completing them (completing them
would fire callbacks, e.g. flipping a card face-up after the run ended). So a
tween that animates *toward* the correct final value leaves that value unset if
the run ends before it finishes — Connect Four's winning disc froze at its 0.4
start scale under the banner, on every single run.
`teardown()` therefore restores `scale` to `Vector2.ONE` across the whole
subtree after killing tweens. This lives in the **base class, not in each
game's end routine**: a forfeit reaches `_finish` through `force_quit()` and
never runs that routine, so a hand-rolled snap silently misses the QUIT path —
which is exactly how all three games shipped frozen mid-animation on forfeit
until it was caught. A game whose resting scale is not `Vector2.ONE` overrides
`teardown()` and calls `super()`.
Two Godot behaviours this pattern exists to survive, both found in review:
a **flat `Button` never draws its styleboxes**, so state applied that way is
silently discarded; and a **disabled `Button` dims its icon to 40%**, so a
"locked in" state fades out unless `icon_disabled_color` is overridden.
**Records are for completed runs only** — a loss or forfeit is not comparable
to a run that met the objective, and in a `lower_is_better` game a loss scores
the worst possible value, which would otherwise be written in as the first
"best".
**Implementation:** `Minigame.teardown()` / `create_managed_tween()` in
`scripts/minigames/minigame.gd`; called from `_on_game_finished` in
`scripts/ui/minigame_host.gd`; child Timers in
`scripts/minigames/void_reflex.gd` and `memory_match.gd` as the reference.
