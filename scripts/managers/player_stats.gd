extends Node
## PlayerStats — the single source of truth for player combat statistics
## (autoload).
##
## Every stat is exposed through a get_*() function on purpose: each layer of
## the game stacks its modifiers inside these functions, and no calling code
## ever needs to change. Milestone 3 adds the upgrade layer.
## TODO(Milestone 6): add equipment bonuses.
## TODO(Milestone 7): add relic and pet bonuses.
## TODO(Milestone 8): add prestige and skill tree bonuses.

const BASE_TAP_DAMAGE: float = 1.0
const BASE_CRIT_CHANCE: float = 0.05
const BASE_CRIT_MULTIPLIER: float = 2.0

## Hard cap so crit chance never becomes a guaranteed, boring 100%.
const MAX_CRIT_CHANCE: float = 0.5

## Fraction of the live essence rate earned while the game is closed.
const BASE_OFFLINE_EFFICIENCY: float = 0.5


func get_tap_damage() -> float:
	var damage: float = BASE_TAP_DAMAGE + UpgradeManager.get_stat_additive(&"tap_damage")
	damage *= UpgradeManager.get_stat_multiplier(&"tap_damage")
	return damage


func get_crit_chance() -> float:
	var chance: float = BASE_CRIT_CHANCE + UpgradeManager.get_stat_additive(&"crit_chance")
	return clampf(chance, 0.0, MAX_CRIT_CHANCE)


func get_crit_multiplier() -> float:
	return BASE_CRIT_MULTIPLIER + UpgradeManager.get_stat_additive(&"crit_damage")


## Multiplier applied to all essence earned from kills.
func get_essence_gain_multiplier() -> float:
	return UpgradeManager.get_stat_multiplier(&"essence_gain")


## Fraction of the live essence rate paid out for time away.
## TODO(Milestone 8): prestige upgrades raise this.
## TODO(Milestone 14): the "double offline rewards" ad multiplies it.
func get_offline_multiplier() -> float:
	return BASE_OFFLINE_EFFICIENCY


## Expected damage of one hit averaged over crit probability — the basis
## for offline kill-rate estimates.
func get_average_damage_per_hit() -> float:
	return get_tap_damage() * (1.0 + get_crit_chance() * (get_crit_multiplier() - 1.0))


## Roll one tap attack, including the critical-hit check.
## Returns {"amount": float, "is_crit": bool}.
func roll_tap_damage() -> Dictionary:
	var amount: float = get_tap_damage()
	var is_crit: bool = randf() < get_crit_chance()
	if is_crit:
		amount *= get_crit_multiplier()
	return {"amount": amount, "is_crit": is_crit}
