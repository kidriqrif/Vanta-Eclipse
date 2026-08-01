extends Node
## PrestigeManager — owns the Eclipse (prestige) loop (autoload, loads last).
##
## Tracks the run's peak level, computes the Void Crystal payout, and performs
## the Eclipse by resetting the run-scoped managers (essence, upgrades, world
## climb, combat, idle) in a fixed order while the RPG collection (equipment,
## relics, pets) and every Ascendant Power are kept. It is the sole orchestrator
## of the reset — no other manager calls upward.

## Run peak that unlocks the Eclipse and anchors the reward curve (one world).
const ECLIPSE_UNLOCK_LEVEL: int = 50
## Reward curve, locked by scratchpad/prestige_sim.py:
##   crystals = max(1, floor(BASE * (peak / GATE)^EXP * (1 + crystal_gain))).
const BASE_CRYSTALS: float = 4.0
const REWARD_GATE: float = 50.0
const REWARD_EXP: float = 2.6

var prestige_count: int = 0
## Highest enemy level reached in the CURRENT run (the high-water mark — it
## does not fall when a boss wall knocks the player back to farming).
var run_peak_level: int = 1
## Highest level ever reached across all runs (drives is_unlocked / the button).
var lifetime_peak_level: int = 1

## Whether the one-time "the Eclipse awaits" banner has already been shown.
var _unlock_announced: bool = false


func _ready() -> void:
	SaveManager.register_saveable("prestige", self)
	# Only game_loaded here. enemy_spawned is connected later, inside
	# _on_game_loaded, so CombatManager's load-time spawn (which fires earlier
	# in the game_loaded chain) is never seen as a live crossing — the same
	# no-celebration-on-load discipline IdleManager uses for auto-attack.
	EventBus.game_loaded.connect(_on_game_loaded)


# --- Save contract -----------------------------------------------------------


func get_save_data() -> Dictionary:
	return {
		"prestige_count": prestige_count,
		"run_peak_level": run_peak_level,
		"lifetime_peak_level": lifetime_peak_level,
		"unlock_announced": _unlock_announced,
	}


func load_save_data(data: Dictionary) -> void:
	prestige_count = maxi(0, int(data.get("prestige_count", 0)))
	run_peak_level = maxi(1, int(data.get("run_peak_level", 1)))
	lifetime_peak_level = maxi(1, int(data.get("lifetime_peak_level", 1)))
	_unlock_announced = bool(data.get("unlock_announced", false))


# --- Public reads ------------------------------------------------------------


## The Eclipse door is visible once the player has ever reached the gate.
func is_unlocked() -> bool:
	return lifetime_peak_level >= ECLIPSE_UNLOCK_LEVEL


## Whether the CURRENT run has climbed far enough to collapse.
func can_eclipse() -> bool:
	return run_peak_level >= ECLIPSE_UNLOCK_LEVEL


## Void Crystals the current run would pay right now (0 below the gate).
func crystal_reward() -> int:
	if run_peak_level < ECLIPSE_UNLOCK_LEVEL:
		return 0
	var raw: float = BASE_CRYSTALS * pow(float(run_peak_level) / REWARD_GATE, REWARD_EXP)
	raw *= 1.0 + SkillTreeManager.get_stat_additive(&"crystal_gain")
	return maxi(1, int(floor(raw)))


# --- The Eclipse -------------------------------------------------------------


## Collapse the current run into the Eclipse. Returns the crystals granted, or
## 0 if the run has not reached the gate (the UI gates this too).
func perform_eclipse() -> int:
	if not can_eclipse():
		return 0
	var reward: int = crystal_reward()
	# 1. Pay out first, then reset the run economy in dependency order.
	CurrencyManager.add(CurrencyManager.VOID_CRYSTALS, float(reward))
	CurrencyManager.reset_run_currency()
	UpgradeManager.reset_for_prestige()
	WorldManager.reset_for_prestige()
	CombatManager.reset_for_prestige()
	IdleManager.reset_for_prestige()
	# 2. The new run starts at the freshly-spawned level.
	run_peak_level = CombatManager.enemy_level
	prestige_count += 1
	# 3. Permanent the moment it happens — a force-kill can't replay or lose it.
	SaveManager.save_game()
	EventBus.eclipse_performed.emit(float(reward), prestige_count)
	return reward


# --- Internals ---------------------------------------------------------------


func _on_game_loaded(_is_new_game: bool) -> void:
	# Seed the peaks silently from the level the save loaded into (CombatManager
	# already spawned it earlier in this same game_loaded chain), so a returning
	# run keeps its high-water mark without a banner.
	_note_frontier(true)
	# A save already past the gate is grandfathered: the door shows with no
	# banner. The banner only ever plays on a live crossing after this point.
	if lifetime_peak_level >= ECLIPSE_UNLOCK_LEVEL:
		_unlock_announced = true
	EventBus.enemy_spawned.connect(_on_enemy_spawned)


func _on_enemy_spawned(_definition: EnemyDefinition, _level: int, _max_hp: float) -> void:
	_note_frontier(false)


## Raise the peaks to the current combat frontier (the level being fought, not
## the possibly-lower farm spawn). When silent, never announces the unlock.
func _note_frontier(silent: bool) -> void:
	var frontier: int = CombatManager.enemy_level
	run_peak_level = maxi(run_peak_level, frontier)
	lifetime_peak_level = maxi(lifetime_peak_level, frontier)
	if silent:
		return
	if not _unlock_announced and lifetime_peak_level >= ECLIPSE_UNLOCK_LEVEL:
		_unlock_announced = true
		SaveManager.save_game()
		EventBus.eclipse_available.emit()
