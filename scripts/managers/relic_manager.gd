extends Node
## RelicManager — owns relic collection, the active relic, and the awaken
## state (autoload). Loads before PlayerStats/IdleManager, which read its
## effect-query getters. It never touches enemy state; combat/idle read
## specific hooks, everything else routes through PlayerStats getters.

## Frozen Ruins begins at level 51 (world index 1) — the awaken point.
const FROZEN_RUINS_FLOOR: int = 51
## Chance a Frozen-Ruins boss kill yields a relic (once awakened).
const RELIC_DROP_CHANCE: float = 0.25

const RELIC_DEFINITION_PATHS: Array[String] = [
	"res://data/relics/eclipse_heart.tres",
	"res://data/relics/hunters_sigil.tres",
	"res://data/relics/twin_fang.tres",
	"res://data/relics/shatterstone.tres",
	"res://data/relics/essence_prism.tres",
]

var _awakened: bool = false
## [{ "id": StringName, "seen": bool }, ...], newest first.
var _owned: Array[Dictionary] = []
var _active_id: StringName = &""
var _definitions_by_id: Dictionary = {}
var _definitions: Array[RelicDefinition] = []


func _ready() -> void:
	for path: String in RELIC_DEFINITION_PATHS:
		var definition: RelicDefinition = load(path)
		if definition != null:
			_definitions.append(definition)
			_definitions_by_id[definition.id] = definition
	SaveManager.register_saveable("relics", self)
	EventBus.game_loaded.connect(_on_game_loaded)
	EventBus.world_unlocked.connect(_on_world_unlocked)
	EventBus.enemy_spawned.connect(_on_enemy_spawned)
	EventBus.boss_fight_won.connect(_on_boss_fight_won)


# --- Save contract -----------------------------------------------------------


func get_save_data() -> Dictionary:
	return {
		"awakened": _awakened,
		"active": String(_active_id),
		"owned": _owned.duplicate(true),
	}


func load_save_data(data: Dictionary) -> void:
	# JSON downgrades StringName to String; rebuild or the effect_id match
	# and _definitions_by_id lookups silently miss (the M6 lesson).
	_awakened = bool(data.get("awakened", false))
	_active_id = StringName(data.get("active", ""))
	_owned.clear()
	for raw: Dictionary in data.get("owned", []):
		var id: StringName = StringName(raw.get("id", ""))
		if not _definitions_by_id.has(id):
			continue  # a removed/renamed relic — drop, never crash
		_owned.append({"id": id, "seen": bool(raw.get("seen", true))})
	if not _definitions_by_id.has(_active_id):
		_active_id = &""


# --- Effect queries (read by PlayerStats + IdleManager) ----------------------


func get_effect_additive(stat: StringName) -> float:
	var def: RelicDefinition = _active_definition()
	if def == null:
		return 0.0
	match def.effect_id:
		&"boss_pct":
			if stat == &"boss":
				return def.effect_value
		&"crit_dmg":
			if stat == &"crit_damage":
				return def.effect_value
	return 0.0


func get_effect_multiplier(stat: StringName) -> float:
	var def: RelicDefinition = _active_definition()
	if def != null and def.effect_id == &"essence_mult" and stat == &"essence":
		return def.effect_value
	return 1.0


## Eclipse Heart — a factor on PlayerStats.get_offline_multiplier(). 1.0 = none.
func get_offline_multiplier() -> float:
	var def: RelicDefinition = _active_definition()
	if def != null and def.effect_id == &"offline_mult":
		return def.effect_value
	return 1.0


## Twin Fang — auto-attack cadence factor read by IdleManager. 1.0 = none.
func get_attack_speed_mult() -> float:
	var def: RelicDefinition = _active_definition()
	if def != null and def.effect_id == &"attack_speed":
		return def.effect_value
	return 1.0


# --- Public reads / actions --------------------------------------------------


func is_awakened() -> bool:
	return _awakened


func get_active_id() -> StringName:
	return _active_id


func get_owned() -> Array[Dictionary]:
	return _owned


func get_definition(id: StringName) -> RelicDefinition:
	return _definitions_by_id.get(id)


func get_unseen_count() -> int:
	var count: int = 0
	for entry: Dictionary in _owned:
		if not bool(entry.get("seen", true)):
			count += 1
	return count


func attune(id: StringName) -> void:
	if not _owns(id):
		return
	_active_id = id
	SaveManager.save_game()
	EventBus.active_relic_changed.emit(id)


func detach() -> void:
	_active_id = &""
	SaveManager.save_game()
	EventBus.active_relic_changed.emit(&"")


func mark_all_seen() -> void:
	for entry: Dictionary in _owned:
		entry["seen"] = true


# --- Internals ---------------------------------------------------------------


func _active_definition() -> RelicDefinition:
	if not _awakened or _active_id == &"":
		return null
	return _definitions_by_id.get(_active_id)


func _owns(id: StringName) -> bool:
	for entry: Dictionary in _owned:
		if entry["id"] == id:
			return true
	return false


func _awaken(ceremony: bool) -> void:
	if _awakened:
		return
	_awakened = true
	SaveManager.save_game()
	if ceremony:
		EventBus.relics_awakened.emit()


func _on_game_loaded(_is_new_game: bool) -> void:
	pass  # awaken back-fill happens on the load-time enemy_spawned


func _on_world_unlocked(_world: WorldDefinition) -> void:
	# Live unlock: awaken with ceremony (the World Unlock modal is up).
	_awaken(true)


func _on_enemy_spawned(_definition: EnemyDefinition, level: int, _max_hp: float) -> void:
	# Silent back-fill for a save already past Frozen Ruins (migration).
	if not _awakened and level >= FROZEN_RUINS_FLOOR:
		_awaken(false)


func _on_boss_fight_won(_level: int, _payout: float, _is_world_boss: bool) -> void:
	if not _awakened:
		return
	if randf() >= RELIC_DROP_CHANCE:
		return
	var id: StringName = _roll_undropped_relic()
	if id == &"":
		return  # collection complete — no dupes
	_owned.push_front({"id": id, "seen": false})
	SaveManager.save_game()
	EventBus.relic_dropped.emit(id)


## Pick a random not-yet-owned relic by drop weight, or &"" if all owned.
func _roll_undropped_relic() -> StringName:
	var pool: Array[RelicDefinition] = []
	var total: float = 0.0
	for def: RelicDefinition in _definitions:
		if not _owns(def.id):
			pool.append(def)
			total += def.drop_weight
	if pool.is_empty():
		return &""
	var roll: float = randf() * total
	var acc: float = 0.0
	for def: RelicDefinition in pool:
		acc += def.drop_weight
		if roll <= acc:
			return def.id
	return pool[-1].id
