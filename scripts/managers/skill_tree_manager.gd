extends Node
## SkillTreeManager — owns the Ascendant Powers (skill-tree) definitions and
## purchased levels (autoload). Loads before PlayerStats, which reads its bonus
## getters. Powers are bought with Void Crystals and are PERMANENT — they never
## reset on an Eclipse; that is the whole point of prestige.
##
## Its bonuses layer into the existing PlayerStats / IdleManager getters exactly
## as relics and pets do, so no combat code changes to gain a new power.

const SKILL_DEFINITION_PATHS: Array[String] = [
	"res://data/skills/void_edge.tres",
	"res://data/skills/ruin.tres",
	"res://data/skills/abundance.tres",
	"res://data/skills/deep_rest.tres",
	"res://data/skills/long_slumber.tres",
	"res://data/skills/crystalline.tres",
	"res://data/skills/dominion.tres",
	"res://data/skills/eternal_reflex.tres",
	"res://data/skills/swift_hunt.tres",
]

var _definitions: Array[SkillNodeDefinition] = []
var _definitions_by_id: Dictionary = {}
## skill id (StringName) -> owned level (int)
var _levels: Dictionary = {}


func _ready() -> void:
	for path: String in SKILL_DEFINITION_PATHS:
		var definition: SkillNodeDefinition = load(path)
		if definition == null:
			push_error("SkillTreeManager: could not load skill definition: %s" % path)
			continue
		_definitions.append(definition)
		_definitions_by_id[definition.id] = definition
	SaveManager.register_saveable("skills", self)


# --- Save contract -----------------------------------------------------------


func get_save_data() -> Dictionary:
	var data: Dictionary = {}
	for id: StringName in _levels:
		if _levels[id] > 0:
			data[String(id)] = _levels[id]
	return data


func load_save_data(data: Dictionary) -> void:
	_levels.clear()
	for key: String in data:
		var id: StringName = StringName(key)
		if _definitions_by_id.has(id):
			_levels[id] = maxi(0, int(data[key]))


# --- Public reads / actions --------------------------------------------------


## Definitions in load order (branch groups preserved by the path list).
func get_definitions() -> Array[SkillNodeDefinition]:
	return _definitions


func get_definition(id: StringName) -> SkillNodeDefinition:
	return _definitions_by_id.get(id)


func get_level(id: StringName) -> int:
	return int(_levels.get(id, 0))


func get_cost(id: StringName) -> float:
	var def: SkillNodeDefinition = _definitions_by_id.get(id)
	if def == null:
		return 0.0
	return def.get_cost(get_level(id))


func is_maxed(id: StringName) -> bool:
	var def: SkillNodeDefinition = _definitions_by_id.get(id)
	if def == null:
		return true
	return get_level(id) >= def.max_level


func prereq_met(id: StringName) -> bool:
	var def: SkillNodeDefinition = _definitions_by_id.get(id)
	if def == null:
		return false
	if def.prereq_id == &"":
		return true
	return get_level(def.prereq_id) >= def.prereq_level


func can_buy(id: StringName) -> bool:
	return not is_maxed(id) and prereq_met(id) \
		and CurrencyManager.can_afford(CurrencyManager.VOID_CRYSTALS, get_cost(id))


## Attempt to buy one level. Returns true on success.
func buy(id: StringName) -> bool:
	if not _definitions_by_id.has(id) or is_maxed(id) or not prereq_met(id):
		return false
	if not CurrencyManager.try_spend(CurrencyManager.VOID_CRYSTALS, get_cost(id)):
		return false
	_levels[id] = get_level(id) + 1
	SaveManager.save_game()
	EventBus.skill_purchased.emit(id, _levels[id])
	return true


# --- Bonus getters (read by PlayerStats / IdleManager / PrestigeManager) ------


## Sum of value_per_level*level across ADDITIVE nodes feeding this stat.
func get_stat_additive(stat: StringName) -> float:
	var total: float = 0.0
	for def: SkillNodeDefinition in _definitions:
		if def.effect_kind == SkillNodeDefinition.EffectKind.ADDITIVE \
				and def.effect_stat == stat:
			total += def.get_total_value(get_level(def.id))
	return total


## Multiplier form for auto-attack cadence (Swift Hunt). 1.0 = no bonus.
func get_attack_speed_mult() -> float:
	return 1.0 + get_stat_additive(&"attack_speed")


## True when a FLAG node (e.g. auto_attack_start) is owned.
func has_flag(flag: StringName) -> bool:
	for def: SkillNodeDefinition in _definitions:
		if def.effect_kind == SkillNodeDefinition.EffectKind.FLAG \
				and def.effect_stat == flag:
			return get_level(def.id) > 0
	return false


## Powers are permanent — an Eclipse never touches them. Present for symmetry
## with the other run-scoped managers' reset hooks.
func reset_for_prestige() -> void:
	pass
