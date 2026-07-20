extends Node
## WorldManager — owns the world list, unlock progression, and palettes
## (autoload). Never touches scenes; never calls upward (CombatManager
## queries IT for rosters/multipliers and reports the loaded level for
## migration via raise_unlocked_floor()).

const LEVELS_PER_WORLD: int = 50

const WORLD_DEFINITION_PATHS: Array[String] = [
	"res://data/worlds/dark_forest.tres",
	"res://data/worlds/frozen_ruins.tres",
]

## Highest world index ever unlocked (0 = Dark Forest). Never decreases.
var highest_unlocked_index: int = 0

## World id whose unlock celebration hasn't been acknowledged yet ("" = none).
var unlock_celebration_pending: String = ""

var _worlds: Array[WorldDefinition] = []


func _ready() -> void:
	for path: String in WORLD_DEFINITION_PATHS:
		var world: WorldDefinition = load(path)
		if world == null:
			push_error("WorldManager: could not load world: %s" % path)
			continue
		_worlds.append(world)
	SaveManager.register_saveable("world", self)
	EventBus.boss_fight_won.connect(_on_boss_fight_won)


# --- Save contract -----------------------------------------------------------


func get_save_data() -> Dictionary:
	return {
		"highest_unlocked_index": highest_unlocked_index,
		"unlock_celebration_pending": unlock_celebration_pending,
	}


func load_save_data(data: Dictionary) -> void:
	highest_unlocked_index = maxi(0, int(data.get("highest_unlocked_index", 0)))
	unlock_celebration_pending = str(data.get("unlock_celebration_pending", ""))


# --- Public API --------------------------------------------------------------


func world_index_for_level(level: int) -> int:
	@warning_ignore("integer_division")
	var index: int = (maxi(1, level) - 1) / LEVELS_PER_WORLD
	return clampi(index, 0, _worlds.size() - 1)


func get_world_for_level(level: int) -> WorldDefinition:
	return _worlds[world_index_for_level(level)]


func get_essence_multiplier_for_level(level: int) -> float:
	return get_world_for_level(level).essence_multiplier


func is_gate_level(level: int) -> bool:
	return level % 10 == 0


func is_world_boss_gate(level: int) -> bool:
	return level % LEVELS_PER_WORLD == 0


## The boss EnemyDefinition path guarding a gate level.
func get_boss_path_for_gate(gate_level: int) -> String:
	var world: WorldDefinition = get_world_for_level(gate_level)
	@warning_ignore("integer_division")
	var index: int = (gate_level - (world.first_level - 1)) / 10 - 1
	if index < 0 or index >= world.boss_definition_paths.size():
		push_error("WorldManager: no boss defined for gate %d" % gate_level)
		return ""
	return world.boss_definition_paths[index]


## Silent migration (grandfather rule): called by CombatManager on load
## with the world index its saved level implies. Raises the unlock floor
## with no celebration — celebrations are for live crossings only.
func raise_unlocked_floor(world_index: int) -> void:
	highest_unlocked_index = maxi(highest_unlocked_index, world_index)


func has_pending_unlock_celebration() -> bool:
	return unlock_celebration_pending != ""


func get_pending_unlock_world() -> WorldDefinition:
	for world: WorldDefinition in _worlds:
		if String(world.id) == unlock_celebration_pending:
			return world
	return null


## Called by the UI when the World Unlock modal's ENTER is tapped.
func acknowledge_unlock_celebration() -> void:
	unlock_celebration_pending = ""


# --- Internals ---------------------------------------------------------------


func _on_boss_fight_won(level: int, _payout: float, is_world_boss: bool) -> void:
	if not is_world_boss:
		return
	var next_index: int = world_index_for_level(level) + 1
	if next_index >= _worlds.size():
		# Final world's boss: nothing further to unlock yet.
		# TODO(content): World 3 "Molten Core" arrives as a data drop.
		return
	if next_index <= highest_unlocked_index:
		return
	highest_unlocked_index = next_index
	unlock_celebration_pending = String(_worlds[next_index].id)
	# Permanent the moment it happens — no crash can take it back.
	SaveManager.save_game()
	EventBus.world_unlocked.emit(_worlds[next_index])
