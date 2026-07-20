# Milestone 5 — Godot Implementation Notes (Phase 3 pre-req)

Author: lead dev in the Godot-specialist role (produced inline during the
subagent-credit outage; verified against the actual project files).
Serves the approved `design/ux/milestone-5-bosses-worlds.md` with the
locked tuning: timer 30.0s · boss HP ×3.0 · boss reward ×10 · 50-level
worlds · Frozen Ruins essence ×2.5 · urgency at `min(10s, duration/3)`.

## 1. Boss countdown

Delta accumulation in a new `CombatManager._process(delta)` — not a Timer
node. Reasons: the countdown must be readable per-frame
(`get_boss_time_remaining()` polled by the TimerBar), cancelable mid-run
(MENU voids the attempt), and must freeze under both SceneTree pause and
Android suspension. `CombatManager` has no explicit `process_mode`, so it
defaults to PAUSABLE — correct here (unlike the ALWAYS managers); Android
suspension stops `_process` entirely (M4 notes §1.1), so backgrounding
freezes the fight for free, exactly as UX §6 requires. The `_process`
body is two lines guarded by `state == State.BOSS_FIGHT`; cost is nil.

## 2. CombatManager state machine

`enum State { NORMAL, BOSS_FIGHT, FARM_MODE }` + `var _boss_entry_held`.

- Gate detection in `_on_enemy_killed()`: after `enemy_level += 1`, if
  `enemy_level % 10 == 0` → `_request_boss_entry()` instead of the normal
  respawn timer. `_request_boss_entry()` checks the obstruction state
  (§below); clear → boss entrance; blocked → `_boss_entry_held = true`
  (empty combat area holds, per spec §2A).
- The boss spawns through `_spawn_enemy()` with a definition override
  (the gate's boss from WorldManager) — HP = baseline level HP × 3.0 ×
  `definition.hp_multiplier`; `enemy_spawned` fires as usual (EnemyView
  renders it), plus `boss_fight_started(definition, level, max_hp, 30.0)`.
- Timer expiry → `boss_fight_failed(level)`, `state = FARM_MODE`
  (persisted: `"combat"` section gains `"farm_mode": bool` — absent in
  old saves, `.get(..., false)` default is correct), spawn at
  `enemy_level - 1` via a level override in `_spawn_enemy()`; the
  level-advance line in `_on_enemy_killed` is guarded by
  `state != FARM_MODE`.
- `request_boss_challenge()` (UI): only valid in FARM_MODE; withdraws the
  farm enemy (new EventBus `enemy_withdrawn` signal → EnemyView plays the
  micro-state; CombatManager marks `_alive = false` without kill rewards)
  then re-enters the boss flow after the 0.4s beat.
- Win → `boss_fight_won(level, payout, is_world_boss)`; payout =
  `get_essence_reward(level) × 10` through the same grant path (source
  `&"boss"`); extended 1.0s respawn beat.
- **Obstruction tracking:** `_overlay_count` incremented/decremented by
  the new `EventBus.ui_overlay_opened/closed`; `_gameplay_current` bool
  maintained from `scene_transition_started/finished` (compare payload to
  `SceneManager.SCENE_GAMEPLAY` — legal after the reorder, §3). Both
  changes re-check `_boss_entry_held`.

## 3. Autoload reorder — verified

New order: EventBus, SettingsManager, SaveManager, GameManager,
CurrencyManager, UpgradeManager, PlayerStats, **SceneManager,
WorldManager, CombatManager, IdleManager**.

Walked every direct call: SceneManager → EventBus only ✓. WorldManager →
SaveManager/EventBus ✓. CombatManager → PlayerStats, CurrencyManager,
WorldManager, SceneManager constants ✓ (all above). IdleManager →
SaveManager, CombatManager, PlayerStats, CurrencyManager, SceneManager ✓.
UI → managers only ✓. The M4 load-bearing guarantee (CombatManager's
`game_loaded` handler connects before IdleManager's, so the load-time
`enemy_spawned` precedes IdleManager's late connect) is preserved:
CombatManager still `_ready()`s before IdleManager. SceneManager gains no
new callers-from-below. GameManager/SaveManager untouched.

## 4. WorldManager + WorldDefinition

`scripts/data/world_definition.gd` — `class_name WorldDefinition extends
Resource`: `id: StringName`, `display_name: String`,
`first_level: int`, `enemy_definition_paths: Array[String]`,
`boss_definition_paths: Array[String]` (5 entries, gates +10..+50),
`deep_color/nebula_color/accent_color: Color`,
`essence_multiplier: float`. Files in `data/worlds/`.

`WorldManager` (autoload #9): loads world list (const paths),
`get_current_world()` derived from `CombatManager.enemy_level`… **no —
derivation inverted**: WorldManager cannot call CombatManager (below it).
Instead `get_world_for_level(level)` is pure; CombatManager asks
`WorldManager.get_world_for_level(enemy_level)` for roster/boss/multiplier
(downward ✓), and the UI asks CombatManager-aware helpers or passes the
level. Persisted (`"world"` section): `highest_unlocked_index: int`,
`unlock_celebration_pending: String` (world id or ""). Migration is pure
derivation — `floor((enemy_level − 1) / 50.0)` on `game_loaded` raises
`highest_unlocked_index` silently if the save outruns it (grandfather
rule, spec §6); gates below the level need no storage at all (farm_mode
false + level position encode everything). Listens for
`boss_fight_won(is_world_boss=true)` → unlock, save, emit
`world_unlocked(world)`.

`get_essence_reward()` in CombatManager multiplies by the level's world
multiplier — offline pay and boss payouts inherit it automatically.
IdleManager's farm-rate dependency: add
`CombatManager.get_effective_kill_level()` (returns `enemy_level` in
NORMAL, `enemy_level - 1` in BOSS_FIGHT/FARM_MODE) and use it in
`get_live_essence_rate()`.

## 5. UI mechanics

- **TimerBar** — `scenes/common/countdown_timer_bar.tscn`: ProgressBar
  (drains via `_process` polling `CombatManager.get_boss_time_remaining()`,
  smooth) + inside Label (28px, dark outline per visual §2C, text updated
  only when the displayed second changes). Two fill styleboxes swapped at
  the urgency threshold; pulse tween owned by the bar, killed on hide.
- **Result Banner** — `scenes/common/result_banner.tscn` +
  `result_banner.gd` with `setup(icon, headline, body, accent)`;
  self-freeing toast idiom; gameplay owns a depth-1 queue (`_pending_banner`)
  and spawns the next on the current one's `tree_exited`.
- **ui_overlay signals** — emit in `upgrade_shop_panel.gd` `open()`
  (after `_is_open` guard) / `close()` (same), and in
  `centered_modal_dialog.gd` `_ready()` (opened) + the exit tween's
  `queue_free` callback (closed — the scrim truly gone; emit-once guard
  via `_closing`). M4's offline modal inherits both via the base script:
  zero changes to `offline_rewards_modal.gd`.
- **Modal presentation queue** — in `gameplay.gd`: an `Array[Callable]`;
  `scene_transition_finished` handler asks IdleManager then WorldManager
  for pending presentations, enqueues in that order (offline first, spec
  §6), presents head; each modal's `confirmed`/`tree_exited` presents the
  next. Live events (offline_rewards_ready mid-session, world_unlocked)
  route through the same queue so nothing ever stacks.
- **EnemyView withdraw** — new handler on `enemy_withdrawn`: kill
  idle/hit tweens, 0.4s parallel tween scale→0.7 + modulate:a→0, no
  particles, no rotation. Boss scale: `enemy_spawned` applies
  `definition.view_scale` to the holder's base scale in `_show_enemy`
  (spawn/death tweens multiply against it — store `_base_scale`).
- **Boss dress swapping** — `_render_current_state()` gains branches on
  `CombatManager.state`: BossPlate/EnemyNameLabel visibility swap,
  HealthBar `custom_minimum_size.y` 46↔60 + variation swap
  (`theme_type_variation = &"BossHealthBar"` / `&""`), TimerBar
  show/hide, ChallengeBossButton visibility, StageLabel text format.
  All also driven live by the boss signals.

## 6. Palette system

`void_background.tscn`: add `resource_local_to_scene = true` on the
ShaderMaterial sub-resource (one-line scene edit) — each instance gets
its own material; the menu keeps brand colors untouched. Cold-load:
`gameplay.gd _ready()` applies the current world's three uniforms
instantly via `material.set_shader_parameter()`. Live transition (world
unlock): gameplay tweens
`material:shader_parameter/deep_color` (and the other two) with
`tween_property` — shader params are valid tween paths in Godot 4 —
0.8s parallel, starting 0.45s after the modal settles (timed from the
modal's `_ready` via the queue presentation). `WorldLabel.text` reads the
world each `_render_current_state()`.

## 7. Pitfalls

1. Old `EnemyDefinition` .tres files lack `is_boss`/`view_scale`: exports
   default (`false`/`1.0`) on load — backward-safe, no re-save needed.
2. `"combat"` save gains `farm_mode`: `.get` default false — old saves
   safe; a save mid-BOSS_FIGHT loads as NORMAL at the gate → auto
   re-enter fresh (spec §6 exactly).
3. Overlay-count storms: both shop methods already guard re-entry
   (`_is_open`); modal emits closed exactly once (guarded by `_closing`
   + the free callback). A modal freed by scene change without its exit
   tween would leak a count — but scene change also flips
   `_gameplay_current = false` and the count is rebuilt per-scene:
   **reset `_overlay_count = 0` on `scene_transition_started`** (overlays
   die with their scene; the two long-lived overlays are both
   gameplay-owned). Note this in code.
4. Timer label updates: only set `text` when the second changes (per-frame
   `String` churn is pointless allocation on mobile).
5. The urgency threshold uses the CONFIGURED duration
   (`min(10.0, duration / 3.0)`), computed once at fight start.
6. `boss_definition_paths` load lazily per gate (5 more resources per
   world; `load()` at fight entry is imperceptible next to the entrance).
7. Elder definitions share base textures — no extra VRAM.
