extends Node
## EquipmentManager — owns all gear: inventory, equipped items, procedural
## generation, drops, salvage, and the forge (autoload).
##
## Items are plain Dictionaries so they serialize straight into the save:
##   {"id": int, "slot": StringName, "rarity": int, "item_level": int,
##    "affixes": {StringName: float}}
## PlayerStats reads get_affix_sum() in its stat getters (the same layering
## the UpgradeManager uses); CombatManager only emits signals — this manager
## never touches enemy state or scenes.

enum Rarity { COMMON, RARE, EPIC, LEGENDARY, MYTHIC }

const RARITY_NAMES: Array[String] = ["Common", "Rare", "Epic", "Legendary", "Mythic"]
const RARITY_AFFIX_COUNT: Array[int] = [1, 2, 3, 4, 5]
const RARITY_MULT: Array[float] = [1.0, 1.15, 1.3, 1.5, 1.75]
const RARITY_SALVAGE: Array[int] = [2, 5, 12, 30, 75]

## Drop tuning — locked by scratchpad/loot_sim.py (see docs/ARCHITECTURE.md).
const NORMAL_DROP_CHANCE: float = 0.03
const NORMAL_WEIGHTS: Array[float] = [0.74, 0.20, 0.05, 0.009, 0.001]
const BOSS_WEIGHTS: Array[float] = [0.30, 0.40, 0.22, 0.07, 0.01]
const WORLD_BOSS_WEIGHTS: Array[float] = [0.0, 0.0, 0.60, 0.32, 0.08]
const FORGE_COST: float = 20.0

const AFFIX_PATHS: Array[String] = [
	"res://data/affixes/tap_flat.tres",
	"res://data/affixes/tap_pct.tres",
	"res://data/affixes/crit_chance.tres",
	"res://data/affixes/crit_damage.tres",
	"res://data/affixes/essence.tres",
	"res://data/affixes/boss.tres",
]
const SLOT_PATHS: Array[String] = [
	"res://data/slots/weapon.tres",
	"res://data/slots/helmet.tres",
	"res://data/slots/armor.tres",
	"res://data/slots/gloves.tres",
	"res://data/slots/boots.tres",
	"res://data/slots/ring.tres",
	"res://data/slots/relic.tres",
]

## Drops the player hasn't seen on the Gear screen yet (runtime-only,
## drives the count pill on the GEAR button). Reset by mark_all_seen().
var unseen_count: int = 0

## slot id (StringName) -> item Dictionary
var _equipped: Dictionary = {}
var _inventory: Array = []
var _next_item_id: int = 1
## True between boss spawn and its resolution, so the boss kill's normal
## enemy_died roll is suppressed (the guaranteed boss drop rides
## boss_fight_won instead). Tracked from signals — no upward CombatManager
## call. Set true on every boss start (idempotent).
var _boss_in_progress: bool = false

var _affixes: Array[AffixDefinition] = []
var _slots: Array[SlotDefinition] = []
var _slots_by_id: Dictionary = {}
## Per-stat cached sum over equipped items, rebuilt on any equip change.
var _affix_sums: Dictionary = {}


func _ready() -> void:
	for path: String in AFFIX_PATHS:
		var affix: AffixDefinition = load(path)
		if affix != null:
			_affixes.append(affix)
	for path: String in SLOT_PATHS:
		var slot: SlotDefinition = load(path)
		if slot != null:
			_slots.append(slot)
			_slots_by_id[slot.id] = slot
	SaveManager.register_saveable("equipment", self)
	EventBus.enemy_died.connect(_on_enemy_died)
	EventBus.boss_fight_started.connect(_on_boss_fight_started)
	EventBus.boss_fight_won.connect(_on_boss_fight_won)
	EventBus.boss_fight_failed.connect(_on_boss_fight_failed)
	_recompute_sums()


# --- Save contract -----------------------------------------------------------


func get_save_data() -> Dictionary:
	return {
		"equipped": _equipped.duplicate(true),
		"inventory": _inventory.duplicate(true),
		"next_item_id": _next_item_id,
	}


func load_save_data(data: Dictionary) -> void:
	# JSON turns every StringName into a plain String, and Godot treats
	# &"x" and "x" as different dict keys — so slot ids and affix ids must
	# be normalized back to StringName or lookups (and stat sums) would
	# silently miss after a reload.
	_equipped.clear()
	var raw_equipped: Dictionary = data.get("equipped", {})
	for slot_key in raw_equipped:
		var item: Dictionary = _normalize_item(raw_equipped[slot_key])
		_equipped[StringName(slot_key)] = item
	_inventory.clear()
	for raw_item in data.get("inventory", []):
		_inventory.append(_normalize_item(raw_item))
	_next_item_id = maxi(1, int(data.get("next_item_id", 1)))
	_recompute_sums()


## Rebuild one loaded item with StringName keys where the runtime expects them.
func _normalize_item(raw: Dictionary) -> Dictionary:
	var affixes: Dictionary = {}
	for stat in raw.get("affixes", {}):
		affixes[StringName(stat)] = float(raw["affixes"][stat])
	return {
		"id": int(raw.get("id", 0)),
		"slot": StringName(raw.get("slot", &"")),
		"rarity": int(raw.get("rarity", 0)),
		"item_level": int(raw.get("item_level", 1)),
		"affixes": affixes,
	}


# --- Public: data queries ----------------------------------------------------


func get_slots() -> Array[SlotDefinition]:
	return _slots


func get_slot_definition(slot: StringName) -> SlotDefinition:
	return _slots_by_id.get(slot)


func get_equipped(slot: StringName) -> Dictionary:
	return _equipped.get(slot, {})


func get_inventory() -> Array:
	return _inventory


## Sum of an affix stat across all equipped items (read by PlayerStats).
func get_affix_sum(stat: StringName) -> float:
	return _affix_sums.get(stat, 0.0)


func get_affix_definition(id: StringName) -> AffixDefinition:
	for affix: AffixDefinition in _affixes:
		if affix.id == id:
			return affix
	return null


## Human-readable affix line, e.g. "Tap Damage +12" or "Crit Chance +0.8%".
func format_affix(affix_id: StringName, value: float) -> String:
	var affix: AffixDefinition = get_affix_definition(affix_id)
	if affix == null:
		return "%s +%s" % [affix_id, value]
	var shown: String = NumberFormat.format_percent(value) if affix.is_percent \
		else NumberFormat.format(value)
	return affix.display_template.replace("{value}", shown)


# --- Public: player actions --------------------------------------------------


## Equip an item from the inventory by id. The previously equipped item (if
## any) returns to the inventory. Sealed slots refuse.
func equip(item_id: int) -> bool:
	var index: int = _inventory_index(item_id)
	if index == -1:
		return false
	var item: Dictionary = _inventory[index]
	var slot: StringName = item["slot"]
	var slot_def: SlotDefinition = _slots_by_id.get(slot)
	if slot_def == null or slot_def.sealed:
		return false
	_inventory.remove_at(index)
	if _equipped.has(slot):
		_inventory.append(_equipped[slot])
	_equipped[slot] = item
	_recompute_sums()
	EventBus.item_equipped.emit(slot)
	EventBus.inventory_changed.emit()
	return true


## Move the equipped item in a slot back to the inventory.
func unequip(slot: StringName) -> bool:
	if not _equipped.has(slot):
		return false
	_inventory.append(_equipped[slot])
	_equipped.erase(slot)
	_recompute_sums()
	EventBus.item_equipped.emit(slot)
	EventBus.inventory_changed.emit()
	return true


## Salvage an inventory item into Void Scraps. Refuses equipped items
## (callers pass only inventory ids). Returns scraps granted, or 0.
func salvage(item_id: int) -> int:
	var index: int = _inventory_index(item_id)
	if index == -1:
		return 0
	var item: Dictionary = _inventory[index]
	var scraps: int = RARITY_SALVAGE[int(item["rarity"])]
	_inventory.remove_at(index)
	CurrencyManager.add(CurrencyManager.VOID_SCRAPS, float(scraps))
	EventBus.inventory_changed.emit()
	return scraps


## Salvage every Common in the inventory at once. Returns total scraps.
func salvage_all_commons() -> int:
	var total: int = 0
	for i in range(_inventory.size() - 1, -1, -1):
		if int(_inventory[i]["rarity"]) == Rarity.COMMON:
			total += RARITY_SALVAGE[Rarity.COMMON]
			_inventory.remove_at(i)
	if total > 0:
		CurrencyManager.add(CurrencyManager.VOID_SCRAPS, float(total))
		EventBus.inventory_changed.emit()
	return total


## Spend scraps to forge a random item for a slot at the given level (the
## caller passes the current enemy level — this manager loads before
## CombatManager and must not read it directly). Returns the new item, or
## {} if unaffordable / invalid slot.
func forge(slot: StringName, level: int) -> Dictionary:
	var slot_def: SlotDefinition = _slots_by_id.get(slot)
	if slot_def == null or slot_def.sealed:
		return {}
	if not CurrencyManager.try_spend(CurrencyManager.VOID_SCRAPS, FORGE_COST):
		return {}
	var item: Dictionary = generate_item(level, _roll_rarity(NORMAL_WEIGHTS), slot)
	_add_to_inventory(item)
	return item


# --- Generation --------------------------------------------------------------


## Build one item. If slot is empty, a random non-sealed slot is chosen.
func generate_item(level: int, rarity: int, slot: StringName = &"") -> Dictionary:
	if slot == &"":
		slot = _random_unsealed_slot()
	var count: int = RARITY_AFFIX_COUNT[rarity]
	var pool: Array[AffixDefinition] = _affixes.duplicate()
	pool.shuffle()
	var affixes: Dictionary = {}
	for i in range(mini(count, pool.size())):
		var affix: AffixDefinition = pool[i]
		affixes[affix.id] = _roll_affix_value(affix, level, rarity)
	var item: Dictionary = {
		"id": _next_item_id,
		"slot": slot,
		"rarity": rarity,
		"item_level": level,
		"affixes": affixes,
	}
	_next_item_id += 1
	return item


func _roll_affix_value(affix: AffixDefinition, level: int, rarity: int) -> float:
	var coefficient: float = randf_range(affix.min_value, affix.max_value)
	var mult: float = RARITY_MULT[rarity]
	if affix.is_percent:
		return coefficient * mult
	# Flat stats scale with the dropping level (loot_sim.py model).
	return maxf(1.0, round(level * coefficient * mult))


# --- Internals ---------------------------------------------------------------


func _on_enemy_died(level: int, _total_kills: int) -> void:
	# The boss kill's normal roll is suppressed; its guaranteed drop rides
	# boss_fight_won instead (no double drop).
	if _boss_in_progress:
		return
	if randf() < NORMAL_DROP_CHANCE:
		_drop(generate_item(level, _roll_rarity(NORMAL_WEIGHTS)))


func _on_boss_fight_started(
	_definition: EnemyDefinition, _level: int, _max_hp: float, _duration: float
) -> void:
	_boss_in_progress = true


func _on_boss_fight_failed(_level: int) -> void:
	_boss_in_progress = false


func _on_boss_fight_won(level: int, _payout: float, is_world_boss: bool) -> void:
	_boss_in_progress = false
	var weights: Array[float] = WORLD_BOSS_WEIGHTS if is_world_boss else BOSS_WEIGHTS
	_drop(generate_item(level, _roll_rarity(weights)))
	# TODO(Milestone 6 polish): surface the world-boss drop inside the
	# WorldUnlockModal; for now it enters inventory + the count pill.


func _drop(item: Dictionary) -> void:
	_add_to_inventory(item)
	unseen_count += 1
	EventBus.item_dropped.emit(item)


## Called by the Gear screen on open — the count pill clears.
func mark_all_seen() -> void:
	unseen_count = 0


func _add_to_inventory(item: Dictionary) -> void:
	# Newest first — the sort order the Gear screen displays.
	_inventory.push_front(item)
	EventBus.inventory_changed.emit()


func _roll_rarity(weights: Array[float]) -> int:
	var roll: float = randf()
	var acc: float = 0.0
	for i in range(weights.size()):
		acc += weights[i]
		if roll <= acc:
			return i
	return weights.size() - 1


func _random_unsealed_slot() -> StringName:
	var open: Array[StringName] = []
	for slot: SlotDefinition in _slots:
		if not slot.sealed:
			open.append(slot.id)
	return open.pick_random()


func _inventory_index(item_id: int) -> int:
	for i in range(_inventory.size()):
		if int(_inventory[i]["id"]) == item_id:
			return i
	return -1


func _recompute_sums() -> void:
	_affix_sums.clear()
	for slot: StringName in _equipped:
		var affixes: Dictionary = _equipped[slot].get("affixes", {})
		for stat: StringName in affixes:
			_affix_sums[stat] = _affix_sums.get(stat, 0.0) + float(affixes[stat])
