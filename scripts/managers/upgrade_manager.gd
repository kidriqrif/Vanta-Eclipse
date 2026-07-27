extends Node
## UpgradeManager — owns all upgrade definitions and purchased levels
## (autoload).
##
## PlayerStats queries get_stat_additive()/get_stat_multiplier() when
## computing stats, so buying an upgrade changes combat instantly with no
## other system involved.

const UPGRADE_DEFINITION_PATHS: Array[String] = [
	"res://data/upgrades/void_claws.tres",
	"res://data/upgrades/eclipse_fangs.tres",
	"res://data/upgrades/dark_focus.tres",
	"res://data/upgrades/blood_moon.tres",
	"res://data/upgrades/essence_siphon.tres",
]

var _definitions: Array[UpgradeDefinition] = []
var _definitions_by_id: Dictionary = {}
## upgrade id (StringName) -> owned level (int)
var _levels: Dictionary = {}


func _ready() -> void:
	for path: String in UPGRADE_DEFINITION_PATHS:
		var definition: UpgradeDefinition = load(path)
		if definition == null:
			push_error("UpgradeManager: could not load upgrade definition: %s" % path)
			continue
		_definitions.append(definition)
		_definitions_by_id[definition.id] = definition
	_definitions.sort_custom(
		func(a: UpgradeDefinition, b: UpgradeDefinition) -> bool:
			return a.sort_order < b.sort_order
	)
	SaveManager.register_saveable("upgrades", self)


# --- Save contract (called by SaveManager) ------------------------------------


func get_save_data() -> Dictionary:
	var data: Dictionary = {}
	for id: StringName in _levels:
		if _levels[id] > 0:
			data[String(id)] = _levels[id]
	return data


func load_save_data(data: Dictionary) -> void:
	_levels.clear()
	for key: String in data:
		_levels[StringName(key)] = maxi(0, int(data[key]))


# --- Public API --------------------------------------------------------------


## Definitions in shop display order.
func get_definitions() -> Array[UpgradeDefinition]:
	return _definitions


func get_level(id: StringName) -> int:
	return int(_levels.get(id, 0))


func get_cost(id: StringName) -> float:
	var definition: UpgradeDefinition = _definitions_by_id.get(id)
	if definition == null:
		push_error("UpgradeManager: unknown upgrade: %s" % id)
		return 0.0
	return definition.get_cost(get_level(id))


func is_maxed(id: StringName) -> bool:
	var definition: UpgradeDefinition = _definitions_by_id.get(id)
	if definition == null:
		return true
	return definition.max_level > 0 and get_level(id) >= definition.max_level


func can_buy(id: StringName) -> bool:
	return not is_maxed(id) \
		and CurrencyManager.can_afford(CurrencyManager.ESSENCE, get_cost(id))


## Attempt to purchase one level. Returns true on success.
func buy(id: StringName) -> bool:
	if not _definitions_by_id.has(id):
		push_error("UpgradeManager: unknown upgrade: %s" % id)
		return false
	if is_maxed(id):
		return false
	if not CurrencyManager.try_spend(CurrencyManager.ESSENCE, get_cost(id)):
		return false
	_levels[id] = get_level(id) + 1
	EventBus.upgrade_purchased.emit(id, _levels[id])
	return true


## Clear every purchased upgrade on an Eclipse (Milestone 8). The shop is a
## run-scoped economy; prestige rebuilds it from scratch. PrestigeManager only.
func reset_for_prestige() -> void:
	_levels.clear()


## Sum of all ADDITIVE bonuses for a stat across owned upgrade levels.
func get_stat_additive(stat: StringName) -> float:
	var total: float = 0.0
	for definition: UpgradeDefinition in _definitions:
		if definition.stat == stat \
				and definition.modifier_type == UpgradeDefinition.ModifierType.ADDITIVE:
			total += definition.get_total_value(get_level(definition.id))
	return total


## Product of all PERCENT multipliers for a stat across owned upgrade levels.
func get_stat_multiplier(stat: StringName) -> float:
	var multiplier: float = 1.0
	for definition: UpgradeDefinition in _definitions:
		if definition.stat == stat \
				and definition.modifier_type == UpgradeDefinition.ModifierType.PERCENT:
			multiplier *= 1.0 + definition.get_total_value(get_level(definition.id))
	return multiplier
