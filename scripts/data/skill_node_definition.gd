class_name SkillNodeDefinition
extends Resource
## Data asset describing one Ascendant Power (skill-tree node). Designers add
## powers by dropping a .tres in data/skills/ — the Eclipse screen builds its
## POWERS panel from these, grouped by branch.
##
## A node either adds value_per_level to a stat every level (ADDITIVE) or is a
## one-level permanent toggle (FLAG). SkillTreeManager sums/reads them, and the
## bonuses layer into PlayerStats / IdleManager exactly as relics and pets do.

enum EffectKind {
	## Each owned level adds value_per_level to the stat (summed).
	ADDITIVE,
	## A single-level permanent switch, read via SkillTreeManager.has_flag().
	FLAG,
}

## Stable identifier used in save files. Never rename after release.
@export var id: StringName = &""

## Branch heading it appears under (&"Might", &"Fortune", &"Ascendance",
## &"Automation"). Purely presentational grouping.
@export var branch: StringName = &""

@export var display_name: String = ""

## One short line describing what the power does.
@export var description: String = ""

@export var effect_kind: EffectKind = EffectKind.ADDITIVE

## Which stat/flag this feeds. ADDITIVE: tap_pct, crit_damage, essence,
## offline_efficiency, offline_cap_hours, crystal_gain, boss, attack_speed.
## FLAG: auto_attack_start. Consumers decide what each one means.
@export var effect_stat: StringName = &""

@export var value_per_level: float = 0.0

## Show the per-level/total effect as a percentage (fractions like 0.08).
@export var display_as_percent: bool = false

@export var base_cost: float = 4.0

## Cost multiplier per level owned, e.g. 1.55 = +55% per purchase.
@export var cost_growth: float = 1.55

## 1 for a FLAG node; a finite ceiling for ADDITIVE nodes.
@export var max_level: int = 1

## Required prerequisite node (&"" = none) and the level it must reach.
@export var prereq_id: StringName = &""
@export var prereq_level: int = 1

## Position within its branch (lower = higher up).
@export var sort_order: int = 0


func get_cost(level: int) -> float:
	return round(base_cost * pow(cost_growth, level))


func get_total_value(level: int) -> float:
	return value_per_level * level


## Human-readable total effect at a level, e.g. "+24%", "+6", or "+0.45".
func format_total(level: int) -> String:
	if effect_kind == EffectKind.FLAG:
		return "Active" if level > 0 else "—"
	var total: float = get_total_value(level)
	if display_as_percent:
		return "+%s%%" % String.num(total * 100.0, 0)
	var decimals: int = 0 if is_equal_approx(total, round(total)) else 2
	return "+%s" % String.num(total, decimals)
