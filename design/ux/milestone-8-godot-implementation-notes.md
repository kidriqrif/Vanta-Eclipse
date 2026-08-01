# Milestone 8 — Godot Implementation Notes

The engineering contract for Eclipse (prestige) + Ascendant Powers. Follows
the established manager/EventBus/data-driven patterns exactly.

## 1. Autoloads (order matters)
Insert **SkillTreeManager** immediately before `PlayerStats` (PlayerStats
reads its bonus getters at stat-compute time) and **PrestigeManager** last
(it calls `reset_for_prestige()` on the run-scoped managers and reads
SkillTreeManager for the Crystalline multiplier — all at runtime, so being
last is safe and keeps its own save section late):

```
… PetManager, SkillTreeManager, PlayerStats, SceneManager, WorldManager,
  CombatManager, IdleManager, PrestigeManager
```

## 2. Data resources
`scripts/data/skill_node_definition.gd` (`class_name SkillNodeDefinition`):
- `id: StringName`, `branch: StringName`, `display_name: String`,
  `description: String`
- `effect_stat: StringName` — one of `tap_pct`, `crit_damage`, `essence`,
  `offline_efficiency`, `offline_cap_hours`, `crystal_gain`, `boss`,
  `attack_speed`, or the flag `auto_attack_start`
- `effect_kind: enum {ADDITIVE, FLAG}` — ADDITIVE sums per level; FLAG is a
  1-level toggle read via `has_flag`
- `value_per_level: float`, `display_as_percent: bool`
- `base_cost: float`, `cost_growth: float`, `max_level: int`
- `prereq_id: StringName` (&"" = none), `prereq_level: int`
- `sort_order: int`
- `get_cost(level) -> round(base_cost * cost_growth ** level)`
- `get_total_value(level) -> value_per_level * level`

Nine `.tres` files in `data/skills/` — constants **locked by
`scratchpad/prestige_sim.py`**:

| id | branch | stat | /lvl | base | growth | max | prereq |
|----|--------|------|------|------|--------|-----|--------|
| void_edge | Might | tap_pct | 0.08 | 4 | 1.55 | 10 | — |
| ruin | Might | crit_damage | 0.15 | 6 | 1.60 | 8 | void_edge 1 |
| abundance | Fortune | essence | 0.10 | 4 | 1.55 | 12 | — |
| deep_rest | Fortune | offline_efficiency | 0.05 | 5 | 1.70 | 6 | abundance 1 |
| long_slumber | Fortune | offline_cap_hours | 2 | 6 | 1.70 | 8 | abundance 1 |
| crystalline | Ascendance | crystal_gain | 0.06 | 8 | 1.70 | 10 | — |
| dominion | Ascendance | boss | 0.20 | 6 | 1.60 | 8 | crystalline 1 |
| eternal_reflex | Automation | auto_attack_start (FLAG) | — | 12 | 1.0 | 1 | — |
| swift_hunt | Automation | attack_speed | 0.06 | 8 | 1.65 | 8 | eternal_reflex 1 |

## 3. SkillTreeManager
- Loads defs (sorted by branch then sort_order), `_levels: Dictionary`
  (id→int), registers save section `"skills"`.
- Save: store only levels > 0; load rebuilds StringName keys and filters
  unknown ids (JSON-downgrade discipline).
- `get_level(id)`, `get_cost(id)`, `is_maxed(id)`, `prereq_met(id)`,
  `can_buy(id)` (not maxed, prereq met, affords crystals), `buy(id)` (spends
  `VOID_CRYSTALS`, ++level, emits `skill_purchased`).
- Bonus getters read by PlayerStats/IdleManager/PrestigeManager:
  - `get_stat_additive(stat) -> Σ value_per_level*level` over ADDITIVE nodes
    whose `effect_stat == stat`.
  - `get_attack_speed_mult() -> 1.0 + get_stat_additive(&"attack_speed")`.
  - `has_flag(flag) -> bool` (FLAG node at level ≥ 1).
- `reset_for_prestige()` — **no-op**: powers are permanent. (Present for
  symmetry / clarity.)

## 4. PlayerStats / IdleManager integration (layer in, no caller changes)
- `get_tap_damage`: add `+ SkillTreeManager.get_stat_additive(&"tap_pct")`
  inside the `1.0 + …` tap_pct group.
- `get_crit_multiplier`: add `+ SkillTreeManager.get_stat_additive(&"crit_damage")`.
- `get_essence_gain_multiplier`: `mult *= 1.0 + SkillTreeManager.get_stat_additive(&"essence")`.
- `get_boss_damage_multiplier`: add `+ SkillTreeManager.get_stat_additive(&"boss")`.
- `get_offline_multiplier`: base becomes
  `(BASE_OFFLINE_EFFICIENCY + SkillTreeManager.get_stat_additive(&"offline_efficiency"))
   * RelicManager.get_offline_multiplier()`.
- IdleManager `get_effective_attack_interval`: divide by
  `RelicManager.get_attack_speed_mult() * SkillTreeManager.get_attack_speed_mult()`.
- IdleManager offline cap: replace the const use with
  `_offline_cap_seconds() = OFFLINE_CAP_SECONDS +
   int(SkillTreeManager.get_stat_additive(&"offline_cap_hours")) * 3600`.

## 5. PrestigeManager
State: `prestige_count:int`, `run_peak_level:int` (this run's high-water
mark), `lifetime_peak_level:int`, `_unlock_announced:bool`. Save section
`"prestige"`.

- Track peak: connect `enemy_spawned` **only** (inside `_on_game_loaded`, so
  CombatManager's load-time spawn is never read as a live crossing — the same
  discipline IdleManager uses). `enemy_died` is deliberately not connected: it
  carries the *pre*-increment level, so it can never exceed the last spawned
  frontier. Each handler raises `run_peak_level`/`lifetime_peak_level` from
  `CombatManager.enemy_level` (the frontier), not the spawn's `level` argument
  — in farm mode the spawn is a level below the wall being fought.
  On the first live crossing of `ECLIPSE_UNLOCK_LEVEL` (50), set the flag,
  save, and emit `eclipse_available` (gameplay shows the banner + the button).
  On load, a save already past 50 sets `_unlock_announced=true` silently
  (grandfather — no banner on load).
- `is_unlocked() -> lifetime_peak_level >= ECLIPSE_UNLOCK_LEVEL`.
- `can_eclipse() -> run_peak_level >= ECLIPSE_UNLOCK_LEVEL`.
- `crystal_reward() -> max(1, floor(BASE_CRYSTALS * (run_peak/GATE)^EXP *
  (1 + SkillTreeManager.get_stat_additive(&"crystal_gain"))))` with
  BASE_CRYSTALS=4.0, GATE=50, EXP=2.6; returns 0 if `run_peak < GATE`.
- `perform_eclipse()`:
  1. guard `can_eclipse()`.
  2. `reward = crystal_reward()`.
  3. `CurrencyManager.add(VOID_CRYSTALS, reward)`.
  4. `CurrencyManager.reset_run_currency()` (essence → 0; crystals, shards,
     scraps untouched).
  5. `UpgradeManager.reset_for_prestige()` (clear `_levels`).
  6. `WorldManager.reset_for_prestige()` (index 0, pending cleared).
  7. `CombatManager.reset_for_prestige()` (level 1, NORMAL, respawn fresh,
     total_kills kept).
  8. `IdleManager.reset_for_prestige()` (auto_attack_unlocked =
     SkillTreeManager.has_flag(&"auto_attack_start"); start/stop timer;
     clear pending offline).
  9. `run_peak_level = CombatManager.enemy_level` (1); `prestige_count += 1`.
  10. `SaveManager.save_game()`.
  11. `EventBus.eclipse_performed.emit(reward, prestige_count)`.

## 6. reset_for_prestige() hooks (new methods on run-scoped managers)
- **CurrencyManager.reset_run_currency()** — `_balances[ESSENCE] = 0.0`,
  emit `currency_changed(ESSENCE, 0)`.
- **UpgradeManager.reset_for_prestige()** — `_levels.clear()`.
- **WorldManager.reset_for_prestige()** — `highest_unlocked_index = 0`,
  `unlock_celebration_pending = ""`, `unlock_celebration_payout = 0.0`.
- **CombatManager.reset_for_prestige()** — `state = NORMAL`, `enemy_level =
  1`, `_alive = false`, stop boss timer/held flags, then `_do_respawn()` so
  a fresh Dark Forest enemy appears. total_kills kept (lifetime stat).
- **IdleManager.reset_for_prestige()** — set flag from the power, then
  `_attack_timer.start()`/`.stop()` to match, `_pending_offline_rewards = {}`.

These are ordinary methods called by PrestigeManager only. No manager calls
upward; PrestigeManager is the orchestrator.

## 7. Scene + UI
- `SceneManager.SCENE_ECLIPSE = "res://scenes/eclipse/eclipse.tscn"`.
- `scripts/ui/eclipse.gd` builds both panels; POWERS is data-driven from
  SkillTreeManager defs (one card per node, grouped by branch). Segmented
  toggle swaps panel visibility. As a full scene it holds any boss gate via
  the existing scene-transition test (no ui_overlay plumbing — same as gear
  and pets).
- COLLAPSE uses the Two-Tap Arm pattern; on commit call
  `PrestigeManager.perform_eclipse()`, then show the celebration banner **on
  the Eclipse screen** and return to gameplay on that banner's `tree_exited`.
  (The banner cannot be queued on gameplay: that scene is not in the tree
  while the Eclipse screen is current.)
- Gameplay: an `EclipseButton` in `BottomRow` (hidden until
  `PrestigeManager.is_unlocked()`, styled with the crystal-deep prestige
  tint); `_on_eclipse_available` shows the unlock banner and reveals the
  button. `eclipse_performed` is deliberately **not** handled in gameplay —
  `_ready` re-reads `is_unlocked()` when the scene returns, so a returning
  unlocked save shows the button without a banner.

## 8. EventBus additions
```
signal eclipse_available
signal eclipse_performed(reward: float, prestige_count: int)
signal skill_purchased(id: StringName, new_level: int)
```

## 9. Save / migration
No SAVE_VERSION bump needed — new sections (`skills`, `prestige`) are simply
absent in old saves and default cleanly. Both managers rebuild StringName
keys and filter unknown ids on load.
