extends Node
## PlayerStats — the single source of truth for player combat statistics
## (autoload).
##
## Every stat is exposed through a get_*() function on purpose: each layer of
## the game stacks its modifiers inside these functions, and no calling code
## ever needs to change. Milestone 3 adds the upgrade layer.
## Milestone 6 adds the equipment layer, Milestone 7 the relic + pet layers,
## and Milestone 8 the Ascendant Powers layer.

const BASE_TAP_DAMAGE: float = 1.0
const BASE_CRIT_CHANCE: float = 0.05
const BASE_CRIT_MULTIPLIER: float = 2.0

## Hard cap so crit chance never becomes a guaranteed, boring 100%.
const MAX_CRIT_CHANCE: float = 0.5

## Fraction of the live essence rate earned while the game is closed.
const BASE_OFFLINE_EFFICIENCY: float = 0.5


func get_tap_damage() -> float:
	var flat: float = BASE_TAP_DAMAGE + UpgradeManager.get_stat_additive(&"tap_damage")
	flat += EquipmentManager.get_affix_sum(&"tap_flat")
	flat += RelicManager.get_effect_additive(&"tap_flat")
	flat += PetManager.get_active_bonus_additive(&"tap_flat")
	var damage: float = flat * UpgradeManager.get_stat_multiplier(&"tap_damage")
	damage *= 1.0 + EquipmentManager.get_affix_sum(&"tap_pct") \
		+ RelicManager.get_effect_additive(&"tap_pct") \
		+ PetManager.get_active_bonus_additive(&"tap_pct") \
		+ SkillTreeManager.get_stat_additive(&"tap_pct")
	return damage


func get_crit_chance() -> float:
	var chance: float = BASE_CRIT_CHANCE + UpgradeManager.get_stat_additive(&"crit_chance")
	chance += EquipmentManager.get_affix_sum(&"crit_chance")
	chance += RelicManager.get_effect_additive(&"crit_chance")
	chance += PetManager.get_active_bonus_additive(&"crit_chance")
	return clampf(chance, 0.0, MAX_CRIT_CHANCE)


func get_crit_multiplier() -> float:
	var mult: float = BASE_CRIT_MULTIPLIER + UpgradeManager.get_stat_additive(&"crit_damage")
	return mult + EquipmentManager.get_affix_sum(&"crit_damage") \
		+ RelicManager.get_effect_additive(&"crit_damage") \
		+ PetManager.get_active_bonus_additive(&"crit_damage") \
		+ SkillTreeManager.get_stat_additive(&"crit_damage")


## Multiplier applied to all essence earned from kills.
func get_essence_gain_multiplier() -> float:
	var mult: float = UpgradeManager.get_stat_multiplier(&"essence_gain")
	mult *= 1.0 + EquipmentManager.get_affix_sum(&"essence")
	mult *= 1.0 + PetManager.get_active_bonus_additive(&"essence")
	mult *= 1.0 + SkillTreeManager.get_stat_additive(&"essence")
	mult *= RelicManager.get_effect_multiplier(&"essence")
	return mult


## Multiplier applied to damage against bosses only (CombatManager applies
## it in _apply_damage when the target is a boss). 1.0 = no bonus.
func get_boss_damage_multiplier() -> float:
	return 1.0 + EquipmentManager.get_affix_sum(&"boss") \
		+ RelicManager.get_effect_additive(&"boss") \
		+ PetManager.get_active_bonus_additive(&"boss") \
		+ SkillTreeManager.get_stat_additive(&"boss")


## Fraction of the live essence rate paid out for time away. The Eclipse
## Heart relic multiplies this (x3 -> 1.5), and the Deep Rest power raises the
## base. The offline-doubler ad is NOT applied here: it doubles the amount
## already granted, at the modal, rather than the rate that produced it.
func get_offline_multiplier() -> float:
	# Deep Rest (Ascendant Power) raises the base efficiency; the Eclipse Heart
	# relic multiplies the result.
	var base: float = BASE_OFFLINE_EFFICIENCY \
		+ SkillTreeManager.get_stat_additive(&"offline_efficiency")
	return base * RelicManager.get_offline_multiplier()


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
