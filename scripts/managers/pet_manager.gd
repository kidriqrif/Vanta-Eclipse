extends Node
## PetManager — owns the pet roster, the active pet, and XP/level/evolution
## (autoload). Loads before PlayerStats, which reads its bonus getter. The
## active pet's passive bonus flows through PlayerStats; XP comes from
## enemy_died (live) and offline_kills_estimated (offline).

const FROZEN_RUINS_FLOOR: int = 51
const XP_BASE: float = 60.0
const XP_PER_KILL: float = 3.0
## The pet granted free when the roster awakens.
const STARTER_ID: StringName = &"ember"
## Chance a Frozen-Ruins boss yields the second pet (once, if unowned).
const PET_DROP_CHANCE: float = 0.15

const PET_DEFINITION_PATHS: Array[String] = [
	"res://data/pets/ember.tres",
	"res://data/pets/frostling.tres",
]

## id (StringName) -> { "xp": float, "seen": bool }
var _owned: Dictionary = {}
var _active_id: StringName = &""
var _definitions_by_id: Dictionary = {}
var _definitions: Array[PetDefinition] = []


func _ready() -> void:
	for path: String in PET_DEFINITION_PATHS:
		var definition: PetDefinition = load(path)
		if definition != null:
			_definitions.append(definition)
			_definitions_by_id[definition.id] = definition
	SaveManager.register_saveable("pets", self)
	EventBus.world_unlocked.connect(_on_world_unlocked)
	EventBus.enemy_spawned.connect(_on_enemy_spawned)
	EventBus.enemy_died.connect(_on_enemy_died)
	EventBus.boss_fight_won.connect(_on_boss_fight_won)
	EventBus.offline_kills_estimated.connect(_on_offline_kills)


# --- Save contract -----------------------------------------------------------


func get_save_data() -> Dictionary:
	var owned: Dictionary = {}
	for id: StringName in _owned:
		owned[String(id)] = _owned[id].duplicate()
	return {"active": String(_active_id), "owned": owned}


func load_save_data(data: Dictionary) -> void:
	_owned.clear()
	var raw_owned: Dictionary = data.get("owned", {})
	for key: String in raw_owned:
		var id: StringName = StringName(key)
		if not _definitions_by_id.has(id):
			continue
		var entry: Dictionary = raw_owned[key]
		# "absorbed" defaults to 0.0 rather than being required, so a save
		# written before boss cards existed loads as a pet that has eaten
		# nothing instead of failing to load at all.
		_owned[id] = {
			"xp": float(entry.get("xp", 0.0)),
			"seen": bool(entry.get("seen", true)),
			"absorbed": maxf(0.0, float(entry.get("absorbed", 0.0))),
		}
	_active_id = StringName(data.get("active", ""))
	if not _definitions_by_id.has(_active_id):
		_active_id = &""


# --- Bonus query (read by PlayerStats) ---------------------------------------


## Additive bonus fraction the ACTIVE pet contributes to a stat. 0.0 = none.
##
## Two terms: what the pet has grown into (level) and what it has been fed
## (absorbed boss cards). Both land on the SAME stat, because a companion that
## boosted one number by living and a different one by eating would need the
## player to track two things to answer one question.
func get_active_bonus_additive(stat: StringName) -> float:
	if _active_id == &"":
		return 0.0
	var def: PetDefinition = _definitions_by_id.get(_active_id)
	if def == null or def.bonus_stat != stat:
		return 0.0
	return def.bonus_per_level * get_level(_active_id) + get_absorbed_bonus(_active_id)


## The permanent bonus fraction a pet has absorbed from boss cards.
func get_absorbed_bonus(id: StringName) -> float:
	return float(_owned.get(id, {}).get("absorbed", 0.0))


## Add to a pet's absorbed bonus, clamped to `cap`. Returns what was actually
## added, which is less than asked for once the pet is near the ceiling — the
## caller reports that number, so a card eaten into a full pet cannot claim to
## have done something it did not.
func add_absorbed_bonus(id: StringName, amount: float, cap: float) -> float:
	if not _owned.has(id) or amount <= 0.0:
		return 0.0
	var before: float = get_absorbed_bonus(id)
	var after: float = minf(cap, before + amount)
	_owned[id]["absorbed"] = after
	return after - before


## Feed a pet XP directly, outside the kill loop. Unlike _grant_xp() this names
## its target instead of assuming the active pet, because absorption is aimed.
func grant_absorbed_xp(id: StringName, amount: float) -> void:
	if not _owned.has(id) or amount <= 0.0:
		return
	var def: PetDefinition = _definitions_by_id.get(id)
	if def == null:
		return
	var before_level: int = get_level(id)
	var before_stage: int = get_stage(id)
	var cap_xp: float = _xp_for_level(def.max_level)
	_owned[id]["xp"] = minf(cap_xp, get_xp(id) + amount)
	var after_level: int = get_level(id)
	if after_level > before_level:
		EventBus.pet_leveled.emit(id, after_level)
		if get_stage(id) > before_stage:
			EventBus.pet_evolved.emit(id, get_stage(id))


# --- Public reads / actions --------------------------------------------------


func get_active_id() -> StringName:
	return _active_id


func get_owned_ids() -> Array:
	return _owned.keys()


func get_definition(id: StringName) -> PetDefinition:
	return _definitions_by_id.get(id)


func owns(id: StringName) -> bool:
	return _owned.has(id)


func get_xp(id: StringName) -> float:
	return _owned.get(id, {}).get("xp", 0.0)


func get_level(id: StringName) -> int:
	var def: PetDefinition = _definitions_by_id.get(id)
	if def == null:
		return 1
	return _level_for_xp(get_xp(id), def)


func get_stage(id: StringName) -> int:
	var def: PetDefinition = _definitions_by_id.get(id)
	if def == null:
		return 0
	var level: int = get_level(id)
	var stage: int = 0
	for threshold: int in def.evolution_levels:
		if level >= threshold:
			stage += 1
	# Clamped against BOTH parallel arrays, not just the names. Five UI sites
	# take this index straight into stage_sprites, so a pet given a third name
	# before its third sprite exists would crash the companion button — which
	# is on screen the entire game. check_data.py rejects that content at build
	# time; this is what keeps a build that slipped through merely wrong-looking
	# instead of dead.
	var stages: int = mini(def.stage_names.size(), def.stage_sprites.size())
	return clampi(stage, 0, maxi(0, stages - 1))


## XP into the current level and XP needed to reach the next.
func get_level_progress(id: StringName) -> Dictionary:
	var def: PetDefinition = _definitions_by_id.get(id)
	if def == null:
		return {"into": 0.0, "needed": 1.0}
	var level: int = get_level(id)
	if level >= def.max_level:
		return {"into": 1.0, "needed": 1.0}
	var xp: float = get_xp(id)
	var floor_xp: float = _xp_for_level(level)
	return {"into": xp - floor_xp, "needed": _xp_for_level(level + 1) - floor_xp}


func set_active(id: StringName) -> void:
	if not _owned.has(id):
		return
	_active_id = id
	SaveManager.save_game()
	EventBus.active_pet_changed.emit(id)


func mark_all_seen() -> void:
	for id: StringName in _owned:
		_owned[id]["seen"] = true


func get_unseen_count() -> int:
	var count: int = 0
	for id: StringName in _owned:
		if not bool(_owned[id].get("seen", true)):
			count += 1
	return count


func is_unseen(id: StringName) -> bool:
	return _owned.has(id) and not bool(_owned[id].get("seen", true))


# --- Internals ---------------------------------------------------------------


func _grant(id: StringName, make_active: bool) -> void:
	if _owned.has(id) or not _definitions_by_id.has(id):
		return
	_owned[id] = {"xp": 0.0, "seen": false, "absorbed": 0.0}
	if make_active and _active_id == &"":
		_active_id = id
	SaveManager.save_game()
	EventBus.pet_unlocked.emit(id)
	if make_active:
		EventBus.active_pet_changed.emit(id)


func _grant_xp(amount: float) -> void:
	if _active_id == &"":
		return
	var def: PetDefinition = _definitions_by_id.get(_active_id)
	if def == null:
		return
	var before_level: int = get_level(_active_id)
	var before_stage: int = get_stage(_active_id)
	var cap_xp: float = _xp_for_level(def.max_level)
	_owned[_active_id]["xp"] = minf(cap_xp, get_xp(_active_id) + amount)
	var after_level: int = get_level(_active_id)
	if after_level > before_level:
		EventBus.pet_leveled.emit(_active_id, after_level)
		if get_stage(_active_id) > before_stage:
			EventBus.pet_evolved.emit(_active_id, get_stage(_active_id))


func _xp_for_level(level: int) -> float:
	# Total XP to reach a level: XP_BASE * (level-1)*level/2.
	var l: int = maxi(1, level) - 1
	return XP_BASE * float(l * (l + 1)) / 2.0


func _level_for_xp(xp: float, def: PetDefinition) -> int:
	var level: int = 1
	while level < def.max_level and xp >= _xp_for_level(level + 1):
		level += 1
	return level


func _on_world_unlocked(_world: WorldDefinition) -> void:
	_grant(STARTER_ID, true)


func _on_enemy_spawned(_definition: EnemyDefinition, level: int, _max_hp: float) -> void:
	# Migration back-fill: a save already past Frozen Ruins gets the starter.
	if _owned.is_empty() and level >= FROZEN_RUINS_FLOOR:
		_grant(STARTER_ID, true)


func _on_enemy_died(_level: int, _total_kills: int) -> void:
	_grant_xp(XP_PER_KILL)


func _on_offline_kills(kills: int) -> void:
	if kills > 0:
		_grant_xp(XP_PER_KILL * kills)


func _on_boss_fight_won(_level: int, _payout: float, _is_world_boss: bool) -> void:
	if _owned.is_empty():
		return  # roster not awakened yet
	if _owned.has(&"frostling") or randf() >= PET_DROP_CHANCE:
		return
	_grant(&"frostling", false)
