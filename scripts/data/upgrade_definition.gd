class_name UpgradeDefinition
extends Resource
## Data asset describing one shop upgrade. Designers add upgrades by creating
## a .tres file in data/upgrades/ — the shop UI builds itself from these.
##
## An upgrade modifies one player stat, either:
##   ADDITIVE — each level adds value_per_level to the stat directly
##   PERCENT  — each level adds value_per_level to a percentage multiplier
##              (0.10 at level 3 means the stat is multiplied by 1.30)

enum ModifierType {
	ADDITIVE,
	PERCENT,
}

## Stable identifier used in save files. Never rename after release.
@export var id: StringName = &""

@export var display_name: String = ""

## One short line shown in the shop, e.g. "Tap damage +1 per level."
@export var description: String = ""

## Which stat this modifies: &"tap_damage", &"crit_chance", &"crit_damage",
## or &"essence_gain". PlayerStats decides what each one means.
@export var stat: StringName = &""

@export var modifier_type: ModifierType = ModifierType.ADDITIVE

@export var value_per_level: float = 1.0

## Show the effect as a percentage (used for ADDITIVE stats that are
## fractions, like crit chance where 0.005 should read "+0.5%").
@export var display_as_percent: bool = false

@export var base_cost: float = 5.0

## Cost multiplier per level owned, e.g. 1.15 = +15% per purchase.
@export var cost_growth: float = 1.15

## 0 = can be bought forever.
@export var max_level: int = 0

## Position in the shop list (lower = higher up).
@export var sort_order: int = 0


func get_cost(level: int) -> float:
	return round(base_cost * pow(cost_growth, level))


func get_total_value(level: int) -> float:
	return value_per_level * level


## Human-readable total effect at a level, e.g. "+12" or "+30%".
func format_effect(level: int) -> String:
	var total: float = get_total_value(level)
	if display_as_percent or modifier_type == ModifierType.PERCENT:
		return "+%s%%" % String.num(total * 100.0, 1)
	return "+%s" % NumberFormat.format(total)
