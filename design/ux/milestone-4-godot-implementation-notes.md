# Milestone 4 — Godot Implementation Notes (Phase 3 pre-req)

Author: Godot UI specialist · Serves: `design/ux/milestone-4-idle-offline.md`
(approved spec) · Target: Godot 4.7 Stable, GDScript, fully typed.

Read alongside `docs/ARCHITECTURE.md`. Sections below match the six question
groups the programmer needs answered before starting. Everything cited was
verified against the actual project files, not assumed.

---

## 1. Resume hook (app foreground return)

**Verdict: `NOTIFICATION_APPLICATION_RESUMED` on Android; desktop stays
cold-launch-only. Guard against a possible startup fire with a boolean.**

### 1.1 The constants

- `Node.NOTIFICATION_APPLICATION_PAUSED` — app sent to background. Android +
  iOS **only**. `SaveManager` and `SettingsManager` already handle it
  (`save_manager.gd` line 53). On Android the engine delivers it and then
  suspends the main loop — timers, `_process`, and tweens all stop while
  backgrounded.
- `Node.NOTIFICATION_APPLICATION_RESUMED` — app back to foreground. Android +
  iOS **only** (per the official docs: "Specific to the Android and iOS
  platforms"). Delivered when the main loop resumes, i.e. always *after* the
  matching `APPLICATION_PAUSED`. This is IdleManager's hook.
- Notifications propagate through the tree in tree order, and autoloads sit
  under root in `project.godot` order — so `SaveManager` (autoload #3) has
  already finished its save-on-`PAUSED` before IdleManager (last autoload,
  see §2.3) would see the same notification. No ordering hazard.

Always use the named constants. The raw values (2014/2015) are
version-sensitive trivia; never hardcode them.

### 1.2 Does RESUMED fire at app start?

On Android the activity's `onResume` is part of the *launch* sequence, and
whether the engine relays that first one as `APPLICATION_RESUMED` is not
contractually documented and has varied across 4.x point releases. **Assume
it can fire at startup** and make the question irrelevant:

```gdscript
var _cold_launch_check_done: bool = false

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_RESUMED and _cold_launch_check_done:
		_run_offline_check()

func _on_game_loaded(is_new_game: bool) -> void:
	# ... (see §2.4 for the full body)
	if not is_new_game:
		_run_offline_check()
	_cold_launch_check_done = true
```

Belt and braces: the check is idempotent anyway, because the spec's
grant-then-`SaveManager.save_game()` sequence (§4C of the spec) runs
synchronously and advances `last_save_unix` — a second check moments later
computes `elapsed ≈ 0` and fails the `MIN_OFFLINE_SECONDS` gate.

### 1.3 Desktop behavior and testing

`APPLICATION_RESUMED`/`PAUSED` **never fire on desktop.** The desktop-capable
alternatives are `NOTIFICATION_APPLICATION_FOCUS_IN` (any window of the app
focused; fires on desktop and mobile) and `NOTIFICATION_WM_WINDOW_FOCUS_IN`
(per-window). **Do not use either.** On desktop the game keeps running while
unfocused — IdleManager keeps ticking and earning real essence the whole time
the player is alt-tabbed. Paying *offline* rewards on refocus would pay the
same wall-clock minutes twice. Desktop = cold-launch path only, and that is
correct behavior, not a gap.

**How a desktop tester exercises the flow** (this covers the full eligibility
+ deferred-popup pipeline, which is 90% of the code):

1. Play to enemy level 15 so `auto_attack_unlocked` is saved `true`.
2. Quit the app (window close → `NOTIFICATION_WM_CLOSE_REQUEST` → SaveManager
   saves, refreshing `last_save_unix`).
3. Wait ≥ `MIN_OFFLINE_SECONDS` (60 s placeholder — temporarily lower the
   constant to 5 s for fast iteration).
4. Relaunch → main menu → PLAY → the modal appears right after the fade-in
   (`scene_transition_finished` path).

The Android-only resume branch is deliberately just a second caller of the
same `_run_offline_check()` method — verify that one branch on a device, or
poke `IdleManager._run_offline_check()` from the editor's remote scene tree /
a debug-build hotkey. Keep both entry points funneling into that single
method so there is exactly one implementation to test.

---

## 2. IdleManager structure

**Verdict: child `Timer` (SaveManager's autosave idiom), explicitly
`PROCESS_MODE_PAUSABLE`, registered as the last autoload, and — critically —
connect `enemy_spawned` only inside the `game_loaded` handler.**

### 2.1 Timer child, not `_process` accumulation

Use a `Timer` node child (`wait_time = 1.0`, `one_shot = false`), created in
`_ready()` but **started only once `auto_attack_unlocked` is true**:

- A `_process` accumulator wakes the script VM every frame, forever, even in
  the pre-unlock hours of a new save. The Timer counts down in engine C++ and
  enters GDScript exactly once per second. Marginal battery win, but free.
- Start/stop semantics map exactly onto "locked/unlocked" with no per-frame
  branch.
- It is the established codebase idiom: `SaveManager._autosave_timer` is the
  same construction.

Tick precision is irrelevant here (the timer quantizes to the next idle
frame); do not reach for `SceneTreeTimer` chains or physics ticks.

### 2.2 process_mode

Set it explicitly, with a comment:

```gdscript
# Auto-attack is live gameplay, not an offline system: a future pause menu
# should genuinely stop it. (Absence is compensated by offline rewards.)
process_mode = Node.PROCESS_MODE_PAUSABLE
```

Do **not** copy the `PROCESS_MODE_ALWAYS` that SaveManager/SettingsManager/
GameManager/SceneManager use — those must survive pause; combat should not.
A Timer child follows its owner's effective mode, so the tick stops with the
tree. (Related pre-existing quirk noted in §6.6.)

### 2.3 Autoload position

Current `project.godot` order (verified): EventBus, SettingsManager,
SaveManager, GameManager, CurrencyManager, UpgradeManager, PlayerStats,
CombatManager, SceneManager. Register **IdleManager last, after
SceneManager** (#10). This satisfies the spec's "after CombatManager" and —
because direct calls are only allowed *downward* in the table — makes it
legal for IdleManager to reference `SceneManager.SCENE_GAMEPLAY` when
deciding whether a finished transition landed on gameplay (§4.4). IdleManager
calls SaveManager, CurrencyManager, PlayerStats, CombatManager, SceneManager
constants: all above it. Nothing calls IdleManager except UI. ✓

### 2.4 The load-ordering constraint (spec §2A branch) — verified reasoning

The startup sequence, confirmed against the actual code:

1. Autoload `_ready()`s run in `project.godot` order. CombatManager connects
   `_on_game_loaded` (`combat_manager.gd` line 49) **before IdleManager
   exists**, so its connection is earlier in the list. Godot fires signal
   connections in connection order.
2. `SaveManager._initial_load` is `call_deferred` from its `_ready()`
   (line 47), so it runs after *all* autoload `_ready()`s — every section,
   including IdleManager's `"idle"`, is registered and `load_save_data()` has
   run **before** `game_loaded` is emitted. A saved
   `auto_attack_unlocked = true` is therefore already in place.
3. When `game_loaded.emit()` runs, CombatManager's handler executes *during
   the emission* and synchronously emits `enemy_spawned` with the loaded
   level (possibly ≥ 15). Only after that does IdleManager's own
   `game_loaded` handler run.

Consequence: **if IdleManager connected `enemy_spawned` in `_ready()`, it
would receive that load-time spawn before it had any chance to intervene.**
That is survivable for saves that *contain* an `"idle"` section (flag already
loaded in step 2) — but not for the migration case: a pre-Milestone-4 save at
enemy level 20+ has **no** `"idle"` section, `load_save_data` is never called
for it (SaveManager only distributes sections that exist), the flag is still
`false`, and the load-time spawn would fire the celebration — exactly what
spec §2A forbids. So:

```gdscript
func _ready() -> void:
	process_mode = Node.PROCESS_MODE_PAUSABLE
	_tick_timer = Timer.new()
	_tick_timer.wait_time = AUTO_ATTACK_INTERVAL  # 1.0 — final value is game design's call
	_tick_timer.timeout.connect(_on_tick)
	add_child(_tick_timer)
	SaveManager.register_saveable("idle", self)
	EventBus.game_loaded.connect(_on_game_loaded)
	EventBus.scene_transition_finished.connect(_on_scene_transition_finished)
	# Deliberately NOT connecting enemy_spawned here — see _on_game_loaded.

func _on_game_loaded(is_new_game: bool) -> void:
	# Migration: save predates the "idle" section but is already past the
	# threshold — unlock silently, no signal, no celebration (spec §2A/§6).
	if not auto_attack_unlocked and CombatManager.enemy_level >= AUTO_ATTACK_UNLOCK_LEVEL:
		auto_attack_unlocked = true
	if auto_attack_unlocked:
		_tick_timer.start()
	# Connect only now: CombatManager's load-time enemy_spawned has already
	# fired (it runs earlier in game_loaded's connection list), so the first
	# spawn we see is a genuine live one.
	EventBus.enemy_spawned.connect(_on_enemy_spawned)
	if not is_new_game:
		_run_offline_check()
	_cold_launch_check_done = true

func _on_enemy_spawned(_definition: EnemyDefinition, level: int, _max_hp: float) -> void:
	if auto_attack_unlocked or level < AUTO_ATTACK_UNLOCK_LEVEL:
		return
	auto_attack_unlocked = true
	_tick_timer.start()
	EventBus.auto_attack_unlocked.emit()
	SaveManager.save_game()  # a crash in the next 60 s must not replay the celebration
```

Triggering off `enemy_spawned` (not `enemy_died`) matches spec §4A: the
level-15 spawn arrives 0.45 s after the kill via CombatManager's respawn
timer, so celebration and "tougher foe appears" read as one moment.

The tick handler stays trivial — CombatManager remains the only system that
touches enemy state:

```gdscript
func _on_tick() -> void:
	CombatManager.auto_attack()  # new public method beside player_tap_attack(),
	                             # same roll + _apply_damage path (spec §4B)
```

Save contract: `get_save_data()` returns `{"auto_attack_unlocked": ...}`;
`load_save_data()` restores it (do not start the timer there — `_on_game_loaded`
does, keeping one start path).

New EventBus signals (add a `--- Idle & offline (Milestone 4) ---` section):

```gdscript
signal auto_attack_unlocked()
signal offline_rewards_ready(amount: float, elapsed_seconds: int, capped: bool)
```

---

## 3. Unlock Celebration Toast (spec §3C)

**Verdict: self-contained scene with a `CanvasLayer` root at layer 50,
instanced by `gameplay.gd` on `EventBus.auto_attack_unlocked`. IdleManager
never touches a scene.**

Ownership reconciliation: IdleManager only *emits*. The gameplay scene
listens and instantiates — same relationship CombatManager already has with
damage numbers. A live unlock can in practice only happen while the gameplay
scene is on screen (pre-unlock kills are tap-only, and taps require
`CombatArea`), but if the signal ever fired sceneless it is simply a no-op —
"managers must work with no UI" holds by construction.

`scenes/gameplay/auto_attack_toast.tscn` + `scripts/ui/auto_attack_toast.gd`:

```
AutoAttackToast (CanvasLayer)            layer = 50, script attached
└── ToastPanel (PanelContainer)          mouse_filter = IGNORE  ← must be explicit, PanelContainer defaults to STOP
    │                                    anchors: top-center; FIXED offsets:
    │                                    left −400, right +400, top 430, bottom 610
    └── ToastVBox (VBoxContainer)        alignment center
        ├── IconRect (TextureRect)       56×56, centered (placeholder: essence_icon.svg until the artist's bolt icon lands)
        ├── HeadlineLabel (Label)        HeaderLabel variation, "AUTO-ATTACK UNLOCKED"
        └── BodyLabel (Label)            autowrap, "Your hero fights on, even when you're not tapping."
```

Key points:

- **Layer 50** sits above the gameplay HUD and the shop panel (both live on
  the scene's base canvas, layer 0) and below SceneManager's fade at 100 —
  exactly the spec's stacking. The CanvasLayer root works fine as a child of
  the gameplay scene; layers are viewport-global regardless of tree depth.
- **Fixed offsets** (not container-driven size) mean `ToastPanel.size` is
  valid the moment `_ready()` runs, so `pivot_offset = size * 0.5` needs no
  await-a-frame dance.
- Labels/TextureRects default to `MOUSE_FILTER_IGNORE`; only the
  PanelContainer needs the explicit `IGNORE`. Result: every tap passes
  through to `CombatArea` from frame one (spec requirement).
- **Animate the PanelContainer, never the CanvasLayer** — `CanvasLayer` is
  not a `CanvasItem`; it has no `modulate`, no `mouse_filter` (§6.1).

One-shot choreography in `_ready()`, then self-free (the `DamageNumber`
idiom — the tween is owned by the node it frees):

```gdscript
func _ready() -> void:
	_panel.pivot_offset = _panel.size * 0.5
	_panel.scale = Vector2.ZERO
	_panel.modulate.a = 0.0
	var tween: Tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(_panel, "scale", Vector2.ONE, 0.3) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)  # BACK overshoots to ~1.05 by itself
	tween.tween_property(_panel, "modulate:a", 1.0, 0.3)
	tween.chain().tween_interval(1.4)
	tween.chain().tween_property(_panel, "modulate:a", 0.0, 0.3)  # TRANS_LINEAR default
	tween.chain().tween_callback(queue_free)
```

Total ≈ 2.0 s, matching spec §4A. The gameplay handler does three things:

```gdscript
func _on_auto_attack_unlocked() -> void:
	add_child(TOAST_SCENE.instantiate())
	_pop_badge()                    # §5
	SettingsManager.vibrate(50)     # milestone buzz; vibrate() already gates on the setting
```

(Haptics stay in `gameplay.gd`, consistent with the existing 20 ms/35 ms
calls there.)

---

## 4. Offline-Rewards Modal (spec §3D + §7)

**Verdict: CanvasLayer confirmed — use layer 60. Ship one concrete scene now
on top of a generic script (`CenteredModalDialog`); extract a base *scene*
only when Milestone 8's confirm dialog actually needs it.**

### 4.1 Reusability shape (solo-dev recommendation)

Spec §7 proposes a base scene under `scenes/common/` immediately. My
recommendation is slightly leaner: **make the *script* the reusable artifact
now, and defer the base-scene split.** Godot scene inheritance works but is
the fiddliest part of the editor for a solo dev (owner remapping, inherited-
scene diffs), and this milestone has exactly one consumer. Concretely:

- `scripts/ui/centered_modal_dialog.gd` — `class_name CenteredModalDialog
  extends CanvasLayer`. Owns `%Scrim`, `%Card`, `%ConfirmButton` lookups, the
  `confirmed` signal, `_animate_in()` / `_animate_out()` with the spec's
  timings, and the double-press guard. ~60 lines, zero content knowledge.
- `scenes/gameplay/offline_rewards_modal.tscn` +
  `scripts/ui/offline_rewards_modal.gd extends CenteredModalDialog` — adds
  `setup(amount, elapsed_seconds, capped)` and the hold-to-reveal.
- Milestone 8's delete-save confirm: duplicate the `.tscn`, swap the body
  rows, reuse the script unchanged. If a third consumer appears, *then*
  promote to an inherited base scene under `scenes/common/`.

This is a conscious, behavior-identical simplification of §7 — flag it in
the PR description so the UX designer knows the pattern still exists, just
as a script contract rather than a scene file this milestone.

### 4.2 Scene tree

```
OfflineRewardsModal (CanvasLayer)        layer = 60, script offline_rewards_modal.gd
├── Scrim (ColorRect)                    %Scrim · full-rect anchors · mouse_filter = STOP
│                                        color = SceneManager.FADE_COLOR values with a ≈ 0.72 baked in
└── Card (PanelContainer)                %Card · mouse_filter = STOP
    │                                    anchors: center; FIXED offsets ±430 h, ±300 v (= 860×600, pivot safe at _ready)
    └── CardMargin (MarginContainer)     margins ~40
        └── CardVBox (VBoxContainer)     separation ~20, alignment center
            ├── TitleLabel (Label)       HeaderLabel variation, "✦  WELCOME BACK  ✦", centered
            ├── SubtitleLabel (Label)    autowrap, "Your hero kept fighting while you were away."
            ├── AmountRow (HBoxContainer) alignment center, separation 12
            │   ├── EssenceIcon (TextureRect)  56×56, essence_icon.svg
            │   └── AmountLabel (Label)  %AmountLabel · font 48 · mouse_filter = STOP  ← hold target
            ├── HoldHintLabel (Label)    22 px, dim, "(tap and hold for exact amount)"
            ├── DurationLabel (Label)    %DurationLabel, "Away for 3h 42m"
            ├── CapLabel (Label)         %CapLabel · smaller · visible = false  (§3E variant)
            └── ConfirmButton (Button)   %ConfirmButton · PrimaryButton variation · min 500×110 · "COLLECT"
```

- **Why layer 60, not 50:** the spec pins the toast at 50 but for the modal
  only says "above the HUD, below 100." Giving the modal its own value makes
  stacking deterministic if the two ever coexist, and starts a tidy layer
  registry: scene UI = 0, toast = 50, modal = 60, SceneManager fade = 100.
- **Scrim blocking works across layers:** the Viewport hit-tests GUI across
  all CanvasLayers top-down, so a full-rect `STOP` ColorRect on layer 60
  swallows input to every Control beneath — `CombatArea.gui_input`, MENU,
  the shop. `Card` is also `STOP` so card taps don't reach the scrim (the
  scrim is never a dismiss target — spec §7). `ConfirmButton` sits above the
  scrim in draw order, so it hit-tests first. Caveat: a scrim only blocks
  *GUI* input, not `_input`/`_unhandled_input` — nothing in this project
  takes taps that way (verified), keep it so.

### 4.3 Choreography (spec timings, verbatim)

Entrance in `_ready()` — button connected *before* the tween starts, so it is
live on frame one:

```gdscript
func _ready() -> void:
	_confirm_button.pressed.connect(_close)
	_card.pivot_offset = _card.size * 0.5   # size fixed by offsets → valid now
	_scrim.modulate.a = 0.0
	_card.modulate.a = 0.0
	_card.scale = Vector2(0.85, 0.85)
	var tween: Tween = create_tween().set_parallel(true)
	tween.tween_property(_scrim, "modulate:a", 1.0, 0.2)
	tween.tween_property(_card, "scale", Vector2.ONE, 0.25) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(_card, "modulate:a", 1.0, 0.25)

func _close() -> void:
	if _closing:
		return          # double-tap guard
	_closing = true
	var tween: Tween = create_tween().set_parallel(true)
	tween.tween_property(_card, "scale", Vector2(0.9, 0.9), 0.18) \
		.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	tween.tween_property(_card, "modulate:a", 0.0, 0.18)
	tween.tween_property(_scrim, "modulate:a", 0.0, 0.2)
	tween.chain().tween_callback(queue_free)
```

Light haptic on appear: `SettingsManager.vibrate(15)`-ish from the gameplay
handler that spawns it, alongside the existing call sites.

### 4.4 Who shows it, and when (pending plumbing)

IdleManager owns the pending state (spec §4D); the gameplay scene owns the
node. Signal design that covers *every* path in spec §2B with one listener:

- At eligibility time IdleManager: grants via `CurrencyManager.add`, emits
  `EventBus.essence_earned.emit(reward, &"offline")` (`CurrencyManager.add`
  only emits `currency_changed` — the granter emits `essence_earned`, same
  as CombatManager does for `&"combat"`), calls `SaveManager.save_game()`,
  stores `_pending_reward = {amount, elapsed_seconds, capped}`, and emits
  `offline_rewards_ready(...)`.
- IdleManager also listens to `EventBus.scene_transition_finished` and
  **re-emits** `offline_rewards_ready` when `scene_path ==
  SceneManager.SCENE_GAMEPLAY` and a pending reward exists. This is the
  cold-launch/deferred path — and firing on `scene_transition_finished` is
  precisely the spec's "wait for the fade-in" rule, for free.
- `gameplay.gd` is the only listener:

```gdscript
func _on_offline_rewards_ready(_amount: float, _elapsed: int, _capped: bool) -> void:
	var data: Dictionary = IdleManager.consume_pending_offline_reward()
	if data.is_empty():
		return
	var modal: OfflineRewardsModal = OFFLINE_MODAL_SCENE.instantiate()
	modal.setup(data["amount"], data["elapsed_seconds"], data["capped"])
	add_child(modal)
```

Pending is cleared **only** by `consume_pending_offline_reward()` (a normal
UI→manager call). That single rule makes every edge case in spec §6 fall
out: resume while on the settings screen or main menu → nobody consumes →
the next gameplay transition re-emits; resume mid-gameplay → consumed and
shown instantly; repeated background cycles → last computation wins because
each check overwrites `_pending_reward` after re-checking against the latest
`last_save_unix`. Note `gameplay.gd`'s `_ready()` runs before
`scene_transition_finished` is emitted (SceneManager awaits the fade first),
so the connection always exists in time.

### 4.5 Tap-and-hold for the exact number

Labels default to `MOUSE_FILTER_IGNORE` — **set `AmountLabel.mouse_filter =
STOP`** (only that label; the hint label stays IGNORE) or `gui_input` never
fires. Then press-and-hold is just the button state, same convention as
`CombatArea` (touch arrives as emulated mouse):

```gdscript
_amount_label.gui_input.connect(_on_amount_gui_input)

func _on_amount_gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_show_exact_amount(event.pressed)   # pressed=true → exact; false → abbreviated
```

No timer needed: "hold" = between press and release. Godot's Viewport routes
the matching *release* to the Control that took the press even if the finger
slid off it, so there is no stuck-open state. `_show_exact_amount(true)`
swaps the text to the exact integer with comma grouping — **no such
formatter exists yet** (`NumberFormat.format()` abbreviates only); add a
small `NumberFormat.format_exact(value: float) -> String` static. Likewise
the "Away for 3h 42m" line needs the spec §4C rough-duration helper —
recommend a `static func format_duration_rough(seconds: int) -> String`
beside `GameManager.format_time()`.

---

## 5. AutoAttackBadge in the top bar (spec §3B)

**Verdict: hidden `PanelContainer` third child of `WorldVBox`; the VBox
reflow claim is correct; scale pops on container children are safe — the
only real gotcha is sizing timing on first show.**

Addition to `gameplay.tscn` (below `StageLabel`):

```
WorldVBox (existing VBoxContainer)
├── WorldLabel (existing)
├── StageLabel (existing)
└── AutoAttackBadge (PanelContainer)     %AutoAttackBadge · visible = false · mouse_filter = IGNORE
    │                                    size_flags_horizontal = SHRINK_BEGIN  ← without this the VBox
    │                                    stretches the pill full-width (children default to Fill)
    └── BadgeHBox (HBoxContainer)        separation 8
        ├── BadgeIcon (TextureRect)      28×28 (placeholder: essence_icon.svg self-modulated teal until the artist asset)
        └── BadgeLabel (Label)           font 24, "AUTO-ATTACK ACTIVE", teal
```

- **Styling:** add a `BadgePanel` theme variation to `main_theme.tres`
  (`BadgePanel/base_type = &"PanelContainer"`, pill StyleBoxFlat: corner
  radius ~20, dark-teal fill, teal border) per the project rule "variations
  over per-node overrides." The label's teal `font_color` can be a direct
  override (single node) or a `BadgeLabel` variation if preferred.
- **Reflow:** containers skip `visible = false` children entirely, so the
  badge costs zero height until unlock. Flipping it visible grows `TopBar`
  ~38 px and `CombatArea` (`size_flags_vertical = 3`, expand-fill) absorbs
  it, as the spec claims. Side effect worth knowing: `EnemyView` is
  center-anchored inside `CombatArea`, so the enemy shifts down ~19 px once.
  Imperceptible; the spec even wants the reflow as a secondary cue.
- **Scale on a container child is NOT overwritten.** Containers own their
  children's `position` and `size` only — never `scale`, `pivot_offset`, or
  `modulate`. `_pop_essence_display()` already scale-pops `EssenceDisplay`,
  itself a container child, every time essence changes. (The thing you must
  never tween on a container child is `position` — that is why damage
  numbers live under the free-form `FxLayer`.)
- **The actual gotcha is timing:** while hidden the badge has never been
  sorted, so its `size` is garbage until the container re-sorts *after*
  `visible = true`. Compute the pivot one frame later:

```gdscript
func _pop_badge() -> void:
	_auto_attack_badge.visible = true
	await get_tree().process_frame            # let WorldVBox assign real size
	_auto_attack_badge.pivot_offset = _auto_attack_badge.size * 0.5
	_auto_attack_badge.scale = Vector2.ZERO
	var tween: Tween = create_tween()
	tween.tween_property(_auto_attack_badge, "scale", Vector2.ONE, 0.24) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)  # BACK supplies the 1.12 overshoot
	_start_badge_pulse()
```

- **Steady state on load (spec §2A branch):** in `_render_current_state()`
  add `_auto_attack_badge.visible = IdleManager.auto_attack_unlocked` (plus
  `_start_badge_pulse()` when true) — no pop, no toast.
- **Idle pulse (1.2 s cycle):** a looping tween owned by the gameplay scene,
  so it dies automatically on scene change — never build loops like this in
  an autoload:

```gdscript
func _start_badge_pulse() -> void:
	if _badge_pulse_tween != null and _badge_pulse_tween.is_valid():
		return
	_badge_pulse_tween = create_tween().set_loops()
	_badge_pulse_tween.tween_property(_auto_attack_badge, "modulate:a", 0.75, 0.6) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_badge_pulse_tween.tween_property(_auto_attack_badge, "modulate:a", 1.0, 0.6) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
```

---

## 6. Pitfalls checklist

1. **CanvasLayer is not a CanvasItem.** No `modulate`, no `mouse_filter`, no
   theme propagation of its own. Always animate and input-flag the Control
   *children* (ToastPanel, Scrim, Card). It does have `visible` and a layer
   transform — don't use those for fades.
2. **Layer registry.** Scene UI/shop = base canvas (0), toast = 50, modal =
   60, SceneManager fade = 100. Everything new stays below 100 so a scene
   transition can always cover it (spec §3D race note). Document this in the
   modal script header.
3. **CanvasLayer children anchor to the viewport, not the HUD.** The
   gameplay `MarginContainer`'s 40 px margins do not apply on layers 50/60;
   the toast/card offsets in §3/§4 are raw 1080×1920 design coordinates
   (safe under the project's `canvas_items` + `expand` stretch).
4. **`mouse_filter` is per-node — it does not inherit.** Labels and
   TextureRects default to IGNORE; PanelContainer, ColorRect, and plain
   Control default to STOP. Two traps here: forgetting IGNORE on ToastPanel
   (toast eats taps → violates spec §3C), and forgetting STOP on AmountLabel
   (hold-to-reveal silently never fires).
5. **`%` unique names are scoped to their owning scene.** `%AutoAttackBadge`
   resolves only inside `gameplay.tscn`'s script; the toast and modal resolve
   their own `%` names internally, including when instanced at runtime. A
   parent scene cannot reach *into* an instanced child's `%` names —
   `gameplay.gd` reaches `%UpgradeShopPanel` only because the flag is set on
   the instance node itself in `gameplay.tscn`. Same trick if gameplay ever
   needs a handle on a pre-placed modal (it doesn't — we instance on demand).
6. **Timers vs a paused SceneTree.** A `Timer` node follows its owner's
   process mode → IdleManager's tick correctly stops when paused (§2.2).
   But `get_tree().create_timer()` defaults `process_always = true`:
   CombatManager's 0.45 s respawn timer keeps counting through a pause and
   will spawn (signal emission is unaffected by pause). Pre-existing,
   harmless — with the tick paused nothing attacks — but don't "fix" it in
   passing, and don't copy `create_timer` for the auto-attack tick.
7. **Clocks.** `Time.get_unix_time_from_system()` is user-adjustable wall
   time: compute `var elapsed: int = maxi(0, now - SaveManager.last_save_unix)`
   so a backwards-set clock can't produce negative elapsed, and cast the
   float return with `int()` as SaveManager does. Never use
   `Time.get_ticks_msec()` or `GameManager.total_play_time` for offline math
   — engine clocks stop while Android suspends the main loop and reset every
   launch. Clock-forward cheating is accepted this milestone (the reward cap
   bounds it); note it for the designer.
8. **Sceneless CombatManager path — verified safe.** A grep of
   `scripts/managers/` shows no manager touches `current_scene`, `get_node`
   paths, or any UI node. The kill path is `PlayerStats.roll_tap_damage()`
   (pure) → `_apply_damage` → EventBus emissions (no-ops without listeners)
   → `CurrencyManager.add` → `get_tree().create_timer` — and autoloads are
   always in the tree, so `get_tree()` is valid on the main menu or during
   transitions. Ticking on the menu silently levels the enemy;
   `_render_current_state()` already repaints both the alive and
   between-respawn states on entry. One requirement on the new
   `CombatManager.auto_attack()`: keep the `if not _alive: return` guard
   (as `player_tap_attack()` has) so ticks landing in the respawn window are
   no-ops.
9. **Signal re-entrancy at load.** `enemy_spawned` fires *synchronously
   inside* the `game_loaded` emission (CombatManager's handler runs first).
   Hence §2.4's connect-late rule. Corollaries: signal connections fire in
   `connect()` order, and autoload `_ready()` order = `project.godot` order
   — reordering autoloads or moving these `connect()` calls silently breaks
   the no-celebration-on-load guarantee. Leave a comment saying so.
10. **RESUMED at startup.** Covered in §1.2 — gate on
    `_cold_launch_check_done`; grant-then-save makes any residual double
    check compute elapsed ≈ 0. Both are cheap; do both.
11. **Self-freeing nodes own their tweens.** The toast and modal free
    themselves via their own tween callbacks (the `DamageNumber` idiom) — a
    tween dies with its creating node, so a mid-animation scene change can
    never leave an orphaned tween targeting a freed node. Never have
    IdleManager (immortal autoload) create UI tweens.
12. **`essence_earned` is emitted by the granter, not CurrencyManager.**
    `CurrencyManager.add()` only emits `currency_changed`. IdleManager must
    itself emit `EventBus.essence_earned.emit(reward, &"offline")` — the
    exact source `event_bus.gd`'s doc comment reserves — mirroring
    CombatManager's `&"combat"` emission.
13. **Android export niceties.** `Input.vibrate_handheld()` requires the
    VIBRATE permission in the export preset (already true for the existing
    20/35 ms calls — the new 50 ms buzz changes nothing). Version-sensitive
    items in this document: the exact `NOTIFICATION_*` integer values and
    the RESUMED-at-startup behavior — both neutralized by using named
    constants and the `_cold_launch_check_done` guard.
