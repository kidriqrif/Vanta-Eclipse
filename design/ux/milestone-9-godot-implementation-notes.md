# Milestone 9 — Godot Implementation Notes

The engineering contract for the Arcade framework. Follows the established
manager / EventBus / data-driven patterns.

## 1. Autoload
Add **MinigameManager** after `IdleManager` (it reads
`IdleManager.get_live_essence_rate()` when pricing payouts) and before
`PrestigeManager` for readability:

```
… CombatManager, IdleManager, MinigameManager, PrestigeManager
```

## 2. Data resource
`scripts/data/minigame_definition.gd` (`class_name MinigameDefinition`):
- `id: StringName`, `display_name: String`, `description: String`
- `icon: Texture2D`, `scene_path: String`
- `unlock_level: int` — enemy level at which the card unlocks
- `reward_seconds: float` — the game's "worth" in seconds of live rate
- `token_cost: int` (default 1), `sort_order: int`

One `.tres` for M9: `data/minigames/void_reflex.tres`
(unlock_level 20, reward_seconds 240, token_cost 1).

## 3. The Minigame base class
`scripts/minigames/minigame.gd` (`class_name Minigame extends Control`):

```gdscript
enum Outcome { WIN, LOSS, QUIT }
signal finished(result: Dictionary)

func setup(context: Dictionary) -> void   # override; called BEFORE add_child
func force_quit() -> void                 # host-only; emits QUIT once
func _finish(outcome, performance, score, detail) -> void   # protected helper
```

`_finish` guards a `_finished` bool so `finished` can only ever emit once,
clamps `performance` to 0–1, and packs the result Dictionary. Subclasses
call it; they never emit the signal directly.

## 4. MinigameManager
State: `tokens: int`, `_regen_anchor_unix: int`, `_best: Dictionary`
(id→float). Save section `"arcade"`.

- **Constants:** `TOKEN_CAP = 5`, `TOKEN_REGEN_SECONDS = 1800`,
  `BOSS_TOKEN_CHANCE = 0.10`, `LOSS_FLOOR = 0.25`, `ARCADE_UNLOCK_LEVEL = 20`.
- `_ready`: load definitions, register saveable, connect `game_loaded`
  (regen catch-up), `enemy_spawned` (unlock announce, connected only inside
  `_on_game_loaded` — the no-celebration-on-load discipline), and
  `boss_fight_won` (token chance).
- **Regen** `_accrue_tokens()`: `elapsed = max(0, now - _regen_anchor_unix)`;
  `gained = elapsed / TOKEN_REGEN_SECONDS`; add up to the cap; advance the
  anchor by `gained * TOKEN_REGEN_SECONDS` (not to `now` — the remainder must
  carry). **If the meter is at/over cap, snap the anchor to `now`** so idling
  full never banks hours. Call on load, on spend, and whenever the UI asks.
- `seconds_until_next_token() -> int` (0 when full).
- `try_spend_token() -> bool` — accrues first, then decrements; on success
  snapshot-saves.
- `compute_payout(def, performance) -> float`:
  `max(1, floor(rate * def.reward_seconds * clamp(performance,0,1)))`, and
  the caller applies `LOSS_FLOOR` for a non-win by passing
  `performance * LOSS_FLOOR`.
- `record_result(id, score) -> bool` (true when a new best was set).
- `is_unlocked(def) -> CombatManager.enemy_level >= def.unlock_level`.
- `reset_for_prestige()` — **no-op**: tokens and records are meta, kept
  across an Eclipse.
- Save: `{tokens, regen_anchor_unix, best:{id:score}}`; load rebuilds
  StringName keys, filters unknown ids, clamps tokens to the cap. **Absent
  section defaults to a full meter** (the update's welcome gift).

## 5. The host
`scenes/minigames/minigame_host.tscn` + `scripts/ui/minigame_host.gd`.

Because `SceneManager.change_scene` takes only a path, the host reads which
game to load from a manager field set by the hub: `MinigameManager.pending_id`
(cleared on read). The host then:
1. `def = get_definition(pending_id)`; if null → return to the hub.
2. `load(def.scene_path).instantiate()`, `setup(def.context.duplicate(true))`
   — per-game tuning is data on the definition, never code — connect
   `finished`, add to the body container.
3. On `finished`: disconnect, compute payout (applying `LOSS_FLOOR` for
   non-wins), `CurrencyManager.add(ESSENCE, payout)`,
   `EventBus.essence_earned.emit(payout, &"minigame")` (the source StringName
   already reserved in EventBus since M3), `record_result`, `SaveManager
   .save_game()`, emit `minigame_finished`, present the Result Banner, and
   return to `SCENE_ARCADE` on its `tree_exited`.
4. QUIT: Two-Tap Arm → `game.force_quit()`, which routes through the same
   `finished` path with `QUIT` and performance 0.

## 6. The hub
`scenes/arcade/arcade.tscn` + `scripts/ui/arcade.gd`. Data-driven cards from
`MinigameManager.get_definitions()`. PLAY sets `MinigameManager.pending_id`
then `change_scene(SCENE_MINIGAME_HOST)`. A 1s `Timer` refreshes the "next
token in" line and re-enables PLAY the moment a token lands (no full rebuild
— only the meter label and the buttons' text/disabled state).

## 7. Void Reflex
`scenes/minigames/void_reflex.tscn` + `scripts/minigames/void_reflex.gd`
(`extends Minigame`). Five rounds; per round a `Timer` of
`randf_range(0.8, 2.2)` then flare; taps before the flare mark that round a
miss and move on. Reaction scoring:
`normalized = clamp((0.9 - reaction) / (0.9 - 0.25), 0, 1)`.
Win at ≥3 hits; `performance` = mean normalized over hits (0 with none);
`score` = hits; `detail` = "4 of 5 · avg 312ms".

## 8. Gameplay entry
An `ArcadeButton` in `BottomRow` beside ECLIPSE, hidden until
`MinigameManager.is_arcade_unlocked()`, styled with the arcade-deep tint.
`arcade_unlocked` reveals it and fires the unlock Result Banner. As with the
Eclipse door, `_ready` re-reads the unlocked state so a returning save shows
the button with no banner.

Note the bottom row now holds four buttons (GEAR · UPGRADES · ECLIPSE ·
ARCADE) at 1080 wide: with the row's 16px separation that is ~231px each,
still far above the 96px touch floor.

## 9. EventBus additions
```
signal arcade_tokens_changed(count: int)
signal arcade_unlocked
signal minigame_finished(id: StringName, outcome: int, payout: float)
```

## 10. Save / migration
No `SAVE_VERSION` bump — the new `"arcade"` section is simply absent in old
saves and defaults to a full meter.
