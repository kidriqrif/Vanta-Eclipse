extends Node
## CombatManager — owns all combat state and rules (autoload).
##
## The gameplay scene is only a window into this manager: it sends taps in
## and renders the signals that come out. That separation is what will let
## idle/offline combat (Milestone 4) run with no scene on screen at all.

const RESPAWN_DELAY: float = 0.45

## Baseline enemy health curve. An enemy's final health is:
##   ENEMY_BASE_HP * ENEMY_HP_GROWTH^(level-1) * definition.hp_multiplier
## TODO(Milestone 3): full balancing pass once the upgrade shop exists.
## TODO(Milestone 5): world multipliers and per-world enemy pools.
const ENEMY_BASE_HP: float = 4.0
const ENEMY_HP_GROWTH: float = 1.12

const ENEMY_DEFINITION_PATHS: Array[String] = [
	"res://data/enemies/gloom_wisp.tres",
	"res://data/enemies/thorn_fiend.tres",
	"res://data/enemies/shade_stalker.tres",
]

## Current enemy level — rises by one with every kill, forever.
var enemy_level: int = 1
var total_kills: int = 0
var enemy_hp: float = 0.0
var enemy_max_hp: float = 0.0

var _definitions: Array[EnemyDefinition] = []
var _current_definition: EnemyDefinition = null
var _alive: bool = false


func _ready() -> void:
	for path: String in ENEMY_DEFINITION_PATHS:
		var definition: EnemyDefinition = load(path)
		if definition == null:
			push_error("CombatManager: could not load enemy definition: %s" % path)
			continue
		_definitions.append(definition)
	SaveManager.register_saveable("combat", self)
	# The first enemy spawns only after the save file restored enemy_level.
	EventBus.game_loaded.connect(_on_game_loaded)


# --- Save contract (called by SaveManager) ------------------------------------


func get_save_data() -> Dictionary:
	return {
		"enemy_level": enemy_level,
		"total_kills": total_kills,
	}


func load_save_data(data: Dictionary) -> void:
	enemy_level = maxi(1, int(data.get("enemy_level", 1)))
	total_kills = maxi(0, int(data.get("total_kills", 0)))


# --- Public API --------------------------------------------------------------


func is_enemy_alive() -> bool:
	return _alive


func get_enemy_definition() -> EnemyDefinition:
	return _current_definition


## Called by the gameplay scene when the player taps the combat area.
func player_tap_attack() -> void:
	if not _alive:
		return
	var roll: Dictionary = PlayerStats.roll_tap_damage()
	_apply_damage(roll["amount"], roll["is_crit"])


# --- Internals ---------------------------------------------------------------


func _apply_damage(amount: float, is_crit: bool) -> void:
	enemy_hp = maxf(0.0, enemy_hp - amount)
	EventBus.enemy_damaged.emit(amount, is_crit, enemy_hp, enemy_max_hp)
	if enemy_hp <= 0.0 and _alive:
		_on_enemy_killed()


func _on_enemy_killed() -> void:
	_alive = false
	total_kills += 1
	EventBus.enemy_died.emit(enemy_level, total_kills)
	# TODO(Milestone 3): grant Eclipse Essence based on enemy_level here.
	enemy_level += 1
	# Short pause so the death animation can play before the next enemy.
	get_tree().create_timer(RESPAWN_DELAY).timeout.connect(_spawn_enemy)


func _spawn_enemy() -> void:
	if _definitions.is_empty():
		push_error("CombatManager: no enemy definitions loaded — cannot spawn.")
		return
	_current_definition = _definitions.pick_random()
	enemy_max_hp = ENEMY_BASE_HP * pow(ENEMY_HP_GROWTH, enemy_level - 1)
	enemy_max_hp *= _current_definition.hp_multiplier
	enemy_hp = enemy_max_hp
	_alive = true
	EventBus.enemy_spawned.emit(_current_definition, enemy_level, enemy_max_hp)


func _on_game_loaded(_is_new_game: bool) -> void:
	_spawn_enemy()
