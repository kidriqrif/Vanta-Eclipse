# Vanta Eclipse — Architecture

This document explains how the project is organized and the rules every new
system must follow. It is the first thing to read before adding code.

## The manager (autoload) pattern

Godot lets us register scripts as **autoloads**: they are created once when the
game starts, never destroyed, and are reachable from any script by name.
All long-lived game logic lives in autoload managers under `scripts/managers/`.
Scenes (screens) are throwaway views: they read data from managers, display it,
and forward player input back to managers. **Scenes never own game state.**

Load order matters — each autoload may only rely on the ones above it:

| Order | Autoload | File | Responsibility |
| --- | --- | --- | --- |
| 1 | `EventBus` | `event_bus.gd` | Global signals. No logic, no state. |
| 2 | `SettingsManager` | `settings_manager.gd` | Player preferences (`user://settings.cfg`), audio bus volumes, haptics. |
| 3 | `SaveManager` | `save_manager.gd` | Versioned JSON save file, autosave, atomic writes, migrations. |
| 4 | `GameManager` | `game_manager.gd` | Game version, play time, session count, pause. Deliberately small. |
| 5 | `CurrencyManager` | `currency_manager.gd` | All currency balances (essence, void crystals, astral shards). Only add()/try_spend() may change them. |
| 6 | `UpgradeManager` | `upgrade_manager.gd` | Upgrade definitions + owned levels; answers stat-modifier queries. |
| 7 | `PlayerStats` | `player_stats.gd` | All player combat stats behind `get_*()` functions; each layer (upgrades, equipment, ...) stacks inside them. |
| 8 | `CombatManager` | `combat_manager.gd` | Enemy state, damage rules, kill/respawn loop, essence rewards, infinite scaling. |
| 8 | `SceneManager` | `scene_manager.gd` | Scene switching with fade + threaded loading. Above the combat managers so they may compare scene-path constants (M5). |
| 9 | `WorldManager` | `world_manager.gd` | World definitions, unlock progression (grandfather migration), palettes, essence multipliers. |
| 10 | `CombatManager` | `combat_manager.gd` | Three-state combat machine (normal/boss/farm), gates, countdown, rewards, world-driven rosters. |
| 6b | `EquipmentManager` | `equipment_manager.gd` | Inventory, equipped items, procedural generation, drops, salvage, forge. Between UpgradeManager and PlayerStats so PlayerStats reads its affix sums; items are serialized dicts, affix/slot pools are `.tres`. |
| 11 | `IdleManager` | `idle_manager.gd` | Auto-attack unlock/ticking, offline-reward eligibility and granting (priced at the effective farm level), app-resume hook. Last on purpose: its `enemy_spawned` connection order relative to CombatManager's `game_loaded` handler is load-bearing (see its comments). |

## Communication rules

1. **UI → manager**: direct calls (`SettingsManager.music_volume = 0.5`).
2. **Manager → anyone**: signals on `EventBus`, never direct references to
   scenes. Managers must work even when no UI exists.
3. **System → system**: prefer `EventBus` signals; direct calls only downward
   in the load-order table.

This is what keeps the codebase scalable: a new system can be added by creating
a manager, registering a save section, and emitting/listening on the EventBus —
without editing existing systems.

## Save system

The save file (`user://savegame.json`) is one versioned JSON document:

```json
{
    "save_version": 1,
    "game_version": "0.1.0",
    "saved_at_unix": 1789000000,
    "sections": {
        "game": { "total_play_time": 123.4, "launch_count": 2, "created_at_unix": 1789000000 },
        "combat": { "enemy_level": 14, "total_kills": 13 },
        "currencies": { "essence": 250.0, "void_crystals": 0.0, "astral_shards": 0.0 },
        "upgrades": { "void_claws": 5, "dark_focus": 2 },
        "idle": { "auto_attack_unlocked": true },
        "world": { "highest_unlocked_index": 1, "unlock_celebration_pending": "", "unlock_celebration_payout": 0.0 }
    }
}
```

* Any system with persistent data calls
  `SaveManager.register_saveable("section_id", self)` in `_ready()` and
  implements `get_save_data()` / `load_save_data(data)`.
* Saving is automatic (every 60 s, on app close, on Android background) plus a
  manual button in Settings.
* Writes are **atomic**: temp file → backup current save → rename. A crash
  mid-save can never destroy progress; loading falls back to the backup.
* Format changes bump `SAVE_VERSION` and add one numbered step in
  `SaveManager._migrate()`. Old saves upgrade step by step to the newest format.
* `saved_at_unix` is the anchor for offline progression (Milestone 4).
* Cloud saves (Milestone 15) will upload `SaveManager.get_full_save_text()`.

Settings are deliberately **not** part of the save file so they survive
prestige resets and save deletion.

## Adding a new screen

1. Create `scenes/<screen_name>/<screen_name>.tscn` with a `Control` root and
   the shared theme `ui/theme/main_theme.tres`.
2. Create its script in `scripts/ui/` — display logic only.
3. Add a `SCENE_<NAME>` constant in `scene_manager.gd`.
4. Navigate with `SceneManager.change_scene(SceneManager.SCENE_<NAME>)`.

## Content as data

Game content lives in Resource files (`.tres`), not code. Enemies are
`EnemyDefinition` resources in `data/enemies/` — adding an enemy means adding
one `.tres` file and one sprite, zero code changes. Shop upgrades are
`UpgradeDefinition` resources in `data/upgrades/` and the shop UI builds
itself from them. Equipment, relics, and pets will follow the same pattern.

## Balancing

Combat/economy curves are tuned by simulation, not gut feeling — see the
constants in `combat_manager.gd`. Current tuning (active tapping, greedy
upgrade buying): level 30 in ~1.5 min, level 50 at ~8 min, level 60 at
~19 min, soft wall near level 70 that idle mechanics (Milestone 4) relieve.
Enemy health grows 15%/level while essence rewards grow 9%/level — that
widening gap is what makes upgrades feel necessary.

Idle/offline (Milestone 4): auto-attack ticks at 1.0s (one third of active
tapping speed) once unlocked at enemy level 15. Offline pay mirrors the
real auto-attack kill rate at the player's current stats, at 50%
efficiency (`PlayerStats.get_offline_multiplier`), capped at 8 hours —
both values are deliberate upgrade hooks for prestige and rewarded ads.
Enemy level never advances while away: the player returns to essence, not
to a wall.

Loot (Milestone 6, tuned via scratchpad loot_sim.py): 3% drop on normal
kills, guaranteed on bosses (weights 30/40/22/7/1), world bosses min-Epic
(0/0/60/32/8), normal weights 74/20/5/0.9/0.1. Affix magnitudes anchor to
the upgrade curve (flat rolls ~L x 0.06-0.18 x rarity), giving full gear
~1.45x dps — acceleration, never a gate. Salvage 2/5/12/30/75 scraps by
rarity; forge pull costs 20 (~first pull at 30-40 min).

Bosses (Milestone 5, tuned via scratchpad boss_sim.py): every 10th level,
3x HP, 30s timer (1.1s entrance grace), 10x payout. Gates 10-40 are
beatable on arrival with escalating tension; the level-50 world boss is a
~6-minute farm wall; Frozen Ruins pays 2.5x essence. Deep-world walls
(L60+) are intentionally brutal until equipment/relics/prestige land.

## Visual identity

* Shared animated backdrop: `scenes/common/void_background.tscn`
  (nebula shader in `effects/` + drifting dust particles).
* Display font: Cinzel Bold (`fonts/`, SIL OFL licensed — safe for
  commercial use; license bundled).
* All widget styling comes from `ui/theme/main_theme.tres`. Theme
  *variations* (`PrimaryButton`, `TitleLabel`, `HeaderLabel`) give screens a
  consistent look — set `theme_type_variation` on a node instead of
  hand-overriding fonts and colors.

## Conventions

* Files and folders: `snake_case` (Godot style guide). Node names: `PascalCase`.
* GDScript is fully typed (`var health: int = 10`, `-> void`).
* Every future save-format change needs a migration step — never break old saves.
* Mobile first: portrait 1080×1920 base resolution, `canvas_items` stretch with
  `expand` aspect, touch targets at least ~100 px tall.
* `TODO(Milestone N):` comments mark planned work and are searchable.
