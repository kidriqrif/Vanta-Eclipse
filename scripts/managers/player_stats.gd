extends Node
## PlayerStats — the single source of truth for player combat statistics
## (autoload).
##
## Every stat is exposed through a get_*() function on purpose: later
## milestones layer modifiers on top of the base values inside these
## functions, and no calling code ever needs to change.
## TODO(Milestone 3): multiply in upgrade levels.
## TODO(Milestone 6): add equipment bonuses.
## TODO(Milestone 7): add relic and pet bonuses.
## TODO(Milestone 8): add prestige and skill tree bonuses.

const BASE_TAP_DAMAGE: float = 1.0
const BASE_CRIT_CHANCE: float = 0.05
const BASE_CRIT_MULTIPLIER: float = 2.0


func get_tap_damage() -> float:
	return BASE_TAP_DAMAGE


func get_crit_chance() -> float:
	return BASE_CRIT_CHANCE


func get_crit_multiplier() -> float:
	return BASE_CRIT_MULTIPLIER


## Roll one tap attack, including the critical-hit check.
## Returns {"amount": float, "is_crit": bool}.
func roll_tap_damage() -> Dictionary:
	var amount: float = get_tap_damage()
	var is_crit: bool = randf() < get_crit_chance()
	if is_crit:
		amount *= get_crit_multiplier()
	return {"amount": amount, "is_crit": is_crit}
