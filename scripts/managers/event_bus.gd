extends Node
## EventBus — the game's global signal hub (autoload).
##
## Systems never talk to each other directly. Instead they emit signals here,
## and any other system that cares connects to them. This keeps gameplay logic,
## UI, and managers fully decoupled, which is what lets the project scale to
## many systems (combat, pets, minigames, ...) without spaghetti dependencies.
##
## Convention: every milestone adds its signals under a clearly named section.
## Emit with:    EventBus.game_saved.emit(true)
## Listen with:  EventBus.game_saved.connect(_on_game_saved)

# --- Save system (Milestone 1) ---

## Fired once at startup after SaveManager finished its initial load attempt.
## is_new_game is true when no readable save file existed.
signal game_loaded(is_new_game: bool)

## Fired every time a save finishes (autosave, manual save, or save-on-exit).
signal game_saved(success: bool)

# --- Settings (Milestone 1) ---

## Fired whenever a setting value changes (e.g. "music_volume", 0.8).
signal setting_changed(setting_name: String, value: Variant)

# --- Scene flow (Milestone 1) ---

## Fired when a scene transition begins (screen starts fading to black).
signal scene_transition_started(scene_path: String)

## Fired when a scene transition ends (new scene visible, fade finished).
signal scene_transition_finished(scene_path: String)

# --- Combat (Milestone 2) ---

## Fired when a new enemy appears.
signal enemy_spawned(definition: EnemyDefinition, level: int, max_hp: float)

## Fired for every hit that lands on the enemy.
signal enemy_damaged(amount: float, is_crit: bool, hp_remaining: float, max_hp: float)

## Fired the moment an enemy's health reaches zero.
signal enemy_died(level: int, total_kills: int)

# --- Economy (Milestone 3) ---

## Fired whenever any currency balance changes. UI reads the new balance
## straight from the signal instead of polling CurrencyManager.
signal currency_changed(currency: StringName, balance: float)

## Fired when essence is earned, with where it came from
## (&"combat" now; &"offline", &"minigame", &"ad_bonus" in later milestones).
signal essence_earned(amount: float, source: StringName)

## Fired after a successful shop purchase.
signal upgrade_purchased(id: StringName, new_level: int)

# --- Idle & offline (Milestone 4) ---

## Fired exactly once per save file, at the moment auto-attack unlocks
## during live play (never re-fired when loading an already-unlocked save).
signal auto_attack_unlocked

## Fired when an offline reward has been granted and is waiting to be
## presented to the player (the essence is already in their balance).
signal offline_rewards_ready(amount: float, seconds_away: int, was_capped: bool)

# --- Bosses & worlds (Milestone 5) ---

## Fired when a boss fight begins (after the unobstructed-screen check).
signal boss_fight_started(definition: EnemyDefinition, level: int, max_hp: float, duration: float)

## Fired at the moment of a boss kill. The payout is already granted.
signal boss_fight_won(level: int, payout: float, is_world_boss: bool)

## Fired when the countdown expires with the boss alive.
signal boss_fight_failed(level: int)

## Fired when an enemy leaves without dying (boss endures / farm enemy
## steps aside for a retry) — EnemyView plays the withdraw micro-state.
signal enemy_withdrawn

## Fired by WorldManager after a world unlock is recorded and saved.
signal world_unlocked(world: WorldDefinition)

# --- Equipment & loot (Milestone 6) ---

## Fired when a new item enters the inventory (drop or forge).
signal item_dropped(item: Dictionary)

## Fired when the inventory contents change (drop, equip, salvage, forge).
signal inventory_changed

## Fired when an item is equipped or unequipped in a slot.
signal item_equipped(slot: StringName)

# --- Relics & Pets (Milestone 7) ---

## Fired when a relic is recovered (added to the collection).
signal relic_dropped(id: StringName)

## Fired when the active relic changes (attune / detach).
signal active_relic_changed(id: StringName)

## Fired once when the relic system awakens (first world unlock).
signal relics_awakened

## Fired when a new pet is unlocked.
signal pet_unlocked(id: StringName)

## Fired when the active pet gains a level.
signal pet_leveled(id: StringName, level: int)

## Fired when a pet evolves to a new stage.
signal pet_evolved(id: StringName, stage: int)

## Fired when the active pet changes.
signal active_pet_changed(id: StringName)

## Fired at offline-reward grant time with the estimated kills, so pet XP
## can be granted from the same estimate (never re-derived).
signal offline_kills_estimated(kills: int)

# --- Prestige & Ascendant Powers (Milestone 8) ---

## Fired once, on the first live crossing of the Eclipse unlock level, so the
## gameplay screen can announce it and reveal the ECLIPSE door.
signal eclipse_available

## Fired after an Eclipse completes. The crystals are already granted and the
## run is already reset.
signal eclipse_performed(reward: float, prestige_count: int)

## Fired after an Ascendant Power level is bought.
signal skill_purchased(id: StringName, new_level: int)

# --- The Arcade (Milestone 9) ---

## Fired whenever the Arcade Token meter changes (spend, regen, boss grant).
signal arcade_tokens_changed(count: int)

## Fired once, on the first live crossing of the Arcade unlock level.
signal arcade_unlocked

## Fired by the host after a run is paid out and recorded.
signal minigame_finished(id: StringName, outcome: int, payout: float)

# --- UI presentation facts (Milestone 5) ---
# Emitted by overlays (shop panel, blocking modals) so managers can defer
# moments that need an unobstructed screen. Presentation facts, not state.

signal ui_overlay_opened
signal ui_overlay_closed
