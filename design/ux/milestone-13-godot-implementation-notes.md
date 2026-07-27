# Milestone 13 — Godot Implementation Notes

Engineering contract for the Journal. Follows the established manager /
EventBus / data-driven patterns.

## 1. Autoload
Add **QuestManager** after `MinigameManager` (it reads
`IdleManager.get_live_essence_rate()` and queries other managers for snapshot
metrics), before `PrestigeManager`:

```
… IdleManager, MinigameManager, QuestManager, PrestigeManager
```

## 2. Data resource
`scripts/data/quest_definition.gd` (`class_name QuestDefinition`):
- `id: StringName`, `display_name: String`, `description: String`
- `kind: enum {QUEST, DAILY, ACHIEVEMENT}`
- `metric: StringName`, `metric_shape: enum {CUMULATIVE, SNAPSHOT}`
- `target: float`
- `reward_kind: enum {ESSENCE_SECONDS, ARCADE_TOKENS, VOID_CRYSTALS}`
- `reward_amount: float`
- `sort_order: int` — for QUEST this is also the chain order

Definitions live in `data/quests/`. The manager loads a directory listing
rather than a hardcoded path array (the roster will grow into the dozens):
`DirAccess.get_files_at("res://data/quests")`, filtering `.tres`, then sorting
by `kind` then `sort_order`. **Note the exported-build caveat:** `.tres` files
are imported to `.remap` in an export, so the listing must strip a trailing
`.remap` from each filename before loading.

## 3. QuestManager state
- `_counters: Dictionary` — metric (StringName) → float, cumulative only.
- `_claimed: Dictionary` — id → true.
- `_completed: Dictionary` — id → true (latched, so a snapshot metric that
  later falls back below target — a crystal balance being spent — stays
  complete).
- `_daily_ids: Array[StringName]`, `_daily_day: int`.
- Save section `"journal"`; StringName keys rebuilt on load, unknown ids
  filtered. `reset_for_prestige()` is a **no-op** — all of it is lifetime.

## 4. Metric wiring
Cumulative counters are incremented from EventBus:

| metric | source |
|---|---|
| `kills` | `enemy_died` |
| `boss_wins` | `boss_fight_won` |
| `essence_earned` | `essence_earned` (amount) |
| `items_dropped` | `item_dropped` |
| `minigames_won` | `minigame_finished` (outcome == WIN) |
| `eclipses` | `eclipse_performed` |
| `upgrades_bought` | `upgrade_purchased` |
| `tokens_spent` | `arcade_tokens_changed` (on a decrease) |

Snapshot metrics are read live in `get_progress()`:

| metric | source |
|---|---|
| `enemy_level` | `PrestigeManager.lifetime_peak_level` |
| `relics_owned` | `RelicManager.get_owned_ids().size()` |
| `pets_owned` | `PetManager.get_owned_ids().size()` |
| `crystals` | `CurrencyManager.get_balance(VOID_CRYSTALS)` |
| `skill_levels` | sum of `SkillTreeManager.get_level()` over definitions |

`get_progress(def) -> float` switches on `metric_shape`. `is_complete(def)`
latches into `_completed` the first time progress ≥ target, and emits
`goal_completed`.

**Completion is evaluated on a signal, not per frame:** any counter bump or a
Journal open runs `_evaluate()`, which walks the active set (active quest +
3 dailies + all achievements) and latches newly-complete goals. Walking every
definition every frame would be wasted work for a screen the player opens
occasionally.

## 5. Claiming
`claim(id) -> String` (returns the reward text, "" on refusal):
1. refuse unless complete and not already claimed (idempotent — this is the
   double-tap guard);
2. mark claimed, then pay:
   - `ESSENCE_SECONDS`: `IdleManager.get_live_essence_rate() * amount`, floored
     at 1, via `CurrencyManager.add(ESSENCE, …)` +
     `EventBus.essence_earned.emit(amount, &"quest")`;
   - `ARCADE_TOKENS`: `MinigameManager.grant_token(int(amount))`;
   - `VOID_CRYSTALS`: `CurrencyManager.add(VOID_CRYSTALS, amount)`;
3. if it was the active QUEST, advance `_active_quest_index` to the next
   unclaimed link;
4. `SaveManager.save_game()`, emit `goal_claimed`.

## 6. Dailies
`_refresh_dailies()`: `today = floor(unix / 86400)`. Reroll **only when
`today > _daily_day`** (strictly greater — a backwards clock must not reroll).
Draw 3 ids at random from the DAILY pool without repeats, clear their claim and
completion state and their counter baselines, set `_daily_day = today`, emit
`dailies_rerolled`. Called from `_on_game_loaded` and on Journal open.

**Daily progress needs a baseline.** Cumulative counters are lifetime, so a
daily "kill 100 enemies" must measure from the day's start: store
`_daily_baseline: Dictionary` (metric → counter value at reroll) and compute
daily progress as `counter - baseline`. Without this, a lifetime counter of
50,000 would complete every kill-daily instantly, forever.

`seconds_until_reset() -> int` for the "Resets in 4h" line.

## 7. UI
- `SCENE_JOURNAL = "res://scenes/journal/journal.tscn"`;
  `scripts/ui/journal.gd`.
- Segmented control (M8 pattern) over three ScrollContainers; goal rows built
  in code, every non-interactive node `MOUSE_FILTER_IGNORE` (Scroll-Safe
  Built Content).
- Rows show name, description, a ProgressBar plus the numeric `12 / 50`, the
  reward line, and CLAIM / "● CLAIMED" / the progress figure.
- Gameplay: a `JournalButton` (96×96, icon) in the top bar beside MENU with a
  durable unclaimed-count badge driven by `QuestManager.get_unclaimed_count()`
  — refreshed in `_ready` and on `goal_completed`/`goal_claimed`.

## 8. Save / migration
No `SAVE_VERSION` bump; an absent `"journal"` section zeroes cleanly. On load,
`_evaluate()` latches every already-satisfied snapshot goal, and the quest
chain advances past them, so an advanced save is not walked back through the
tutorial chain.
