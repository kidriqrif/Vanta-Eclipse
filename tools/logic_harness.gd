extends Node
## Runtime logic checks: save round-trip fidelity, and the invariants the
## static sweep cannot see.
##
## Why it exists: `validate_all.sh` compares what the files SAY to each other,
## and `screenshot_run.sh` proves the screens draw. Neither runs the economy.
## A `load_save_data()` that silently drops a field, coerces a type, or filters
## a collection it should have kept produces no parse error, no missing symbol
## and no visual difference — the player just loses something, once, on a
## launch nobody was watching.
##
## The round-trip is the core of it:
##
##     seed -> save_game() -> get_full_save_text()  = A
##          -> _try_load_from(disk)                        (the REAL load path)
##          -> get_full_save_text()                 = B
##
## A and B must be identical. Any difference is a field that does not survive
## being written and read back, which means it does not survive a restart.
##
## Registered as the last autoload by tools/logic_run.sh, so every manager has
## finished _ready() and registered its section before this runs.

## Fields that legitimately differ between two saves of the same state.
const VOLATILE: PackedStringArray = ["saved_at_unix"]

var _failures: int = 0
var _checks: int = 0


func _ready() -> void:
	# After SaveManager's deferred _initial_load and every manager's _ready.
	call_deferred("_run")


func _run() -> void:
	await get_tree().process_frame
	await get_tree().process_frame

	_seed()
	_check_round_trip()
	_check_invariants()
	_check_currency_hardening()
	_check_positive_control()

	print("")
	if _failures == 0:
		print("LOGIC: OK — %d checks passed" % _checks)
	else:
		print("LOGIC: %d of %d checks FAILED" % [_failures, _checks])
	get_tree().quit(1 if _failures > 0 else 0)


func _ok(label: String, passed: bool, detail: String = "") -> void:
	_checks += 1
	if passed:
		print("  pass    %s" % label)
	else:
		_failures += 1
		print("  FAIL    %s%s" % [label, ("\n            " + detail) if detail else ""])


# --- Seed --------------------------------------------------------------------


## Non-default state in every section. A round-trip over default values proves
## nothing: almost every field would match by being absent at both ends.
func _seed() -> void:
	CurrencyManager.add(CurrencyManager.ESSENCE, 4.8e6)
	CurrencyManager.add(CurrencyManager.VOID_SCRAPS, 1450.0)
	CurrencyManager.add(CurrencyManager.VOID_CRYSTALS, 32.0)
	CurrencyManager.add(CurrencyManager.ASTRAL_SHARDS, 9.0)

	CombatManager.enemy_level = 60
	PrestigeManager.load_save_data({
		"prestige_count": 2, "run_peak_level": 60, "lifetime_peak_level": 60,
		"unlock_announced": true,
	})
	WorldManager.raise_unlocked_floor(1)
	IdleManager.auto_attack_unlocked = true

	for rarity: int in range(EquipmentManager.Rarity.MYTHIC + 1):
		EquipmentManager._add_to_inventory(
			EquipmentManager.generate_item(58 + rarity, rarity)
		)
	var inventory: Array = EquipmentManager.get_inventory()
	if not inventory.is_empty():
		EquipmentManager.equip(int(inventory[0]["id"]))

	RelicManager.load_save_data({
		"awakened": true,
		"active": "twin_fang",
		"owned": [
			{"id": "twin_fang", "seen": true},
			{"id": "essence_prism", "seen": true},
			{"id": "shatterstone", "seen": false},
		],
	})
	PetManager.load_save_data({
		"active": "ember",
		"owned": {"ember": {"xp": 5400.0, "seen": true}},
	})
	MinigameManager.grant_token(3)
	# Journal counters and the daily set.
	QuestManager.load_save_data({
		"counters": {"kills": 12480.0, "taps": 3300.0},
		"daily_baseline": {"kills": 12000.0},
		"claimed": {"q_first_blood": true},
		"daily_day": int(Time.get_unix_time_from_system()) / 86400,
	})
	MonetizationManager.load_save_data({
		"ad_uses": {"arcade_token": 2},
		"ad_day": int(Time.get_unix_time_from_system()) / 86400,
		"entitlements": ["remove_ads"],
		"owned_cosmetics": ["trail_void"],
		"equipped_cosmetic": "trail_void",
	})
	# Skills: buy whatever the current crystals afford, so the section is dirty.
	for node: SkillNodeDefinition in SkillTreeManager.get_definitions():
		if SkillTreeManager.can_buy(node.id):
			SkillTreeManager.buy(node.id)
			break


# --- The round trip ----------------------------------------------------------


func _check_round_trip() -> void:
	if not SaveManager.save_game():
		_ok("save_game() writes", false, "save_game() returned false")
		return
	_ok("save_game() writes", true)

	# Two trips, not one. A load is allowed to NORMALISE — EquipmentManager,
	# for example, stamps an explicit "seen": true onto items that had no such
	# key, which changes the document without changing its meaning. So:
	#
	#   A -> load -> B   must lose nothing (every key in A survives, unchanged)
	#   B -> load -> C   must be identical (normalising twice must be a no-op)
	#
	# Together those catch the two failures that matter — a field that does not
	# survive a restart, and a load that keeps rewriting its own input — while
	# tolerating the one-time defaulting that is legitimate.
	var text_a: String = SaveManager.get_full_save_text()
	# The real load path, not a re-implementation of it: anything this harness
	# reimplements is something it stops testing.
	var loaded: bool = SaveManager._try_load_from(SaveManager.SAVE_PATH)
	_ok("_try_load_from() accepts what save_game() wrote", loaded)
	if not loaded:
		return
	var text_b: String = SaveManager.get_full_save_text()
	SaveManager.save_game()
	SaveManager._try_load_from(SaveManager.SAVE_PATH)
	var text_c: String = SaveManager.get_full_save_text()

	var sections_a: Dictionary = JSON.parse_string(text_a).get("sections", {})
	var sections_b: Dictionary = JSON.parse_string(text_b).get("sections", {})
	var sections_c: Dictionary = JSON.parse_string(text_c).get("sections", {})

	_ok("every section survives the trip",
		sections_a.keys().size() == sections_b.keys().size(),
		"before: %s\n            after:  %s" % [sections_a.keys(), sections_b.keys()])

	for section: String in sections_a:
		var missing: Array[String] = []
		_lost_keys(sections_a[section], sections_b.get(section), section, missing)
		_ok("section '%s' loses nothing on load" % section, missing.is_empty(),
			"dropped or changed: %s" % ", ".join(missing))

	for section: String in sections_b:
		_ok("section '%s' is stable across a second trip" % section,
			_same(sections_b[section], sections_c.get(section)),
			"first:  %s\n            second: %s"
				% [JSON.stringify(sections_b[section]),
					JSON.stringify(sections_c.get(section))])


## Record every path in `one` that is absent from `two` or holds a different
## value there. Extra keys in `two` are fine — that is normalisation.
func _lost_keys(one: Variant, two: Variant, path: String, out: Array[String]) -> void:
	if typeof(one) == TYPE_DICTIONARY:
		if typeof(two) != TYPE_DICTIONARY:
			out.append(path)
			return
		for key: Variant in (one as Dictionary):
			if String(key) in VOLATILE:
				continue
			if not (two as Dictionary).has(key):
				out.append("%s.%s" % [path, key])
			else:
				_lost_keys((one as Dictionary)[key], (two as Dictionary)[key],
					"%s.%s" % [path, key], out)
		return
	if typeof(one) == TYPE_ARRAY:
		if typeof(two) != TYPE_ARRAY or (one as Array).size() != (two as Array).size():
			out.append(path)
			return
		for i: int in (one as Array).size():
			_lost_keys((one as Array)[i], (two as Array)[i], "%s[%d]" % [path, i], out)
		return
	if not _same(one, two):
		out.append(path)


## Structural comparison that ignores the fields that are meant to move, and
## that treats 3 and 3.0 as equal — JSON has one number type, so an int written
## by one manager and read back as a float is not a defect by itself.
func _same(one: Variant, two: Variant) -> bool:
	if typeof(one) == TYPE_DICTIONARY and typeof(two) == TYPE_DICTIONARY:
		var da: Dictionary = one
		var db: Dictionary = two
		if da.keys().size() != db.keys().size():
			return false
		for key: Variant in da:
			if String(key) in VOLATILE:
				continue
			if not db.has(key) or not _same(da[key], db[key]):
				return false
		return true
	if typeof(one) == TYPE_ARRAY and typeof(two) == TYPE_ARRAY:
		var aa: Array = one
		var ab: Array = two
		if aa.size() != ab.size():
			return false
		for i: int in aa.size():
			if not _same(aa[i], ab[i]):
				return false
		return true
	if one is float or one is int:
		if not (two is float or two is int):
			return false
		return is_equal_approx(float(one), float(two))
	return one == two


# --- Invariants --------------------------------------------------------------


func _check_invariants() -> void:
	for currency: StringName in [
		CurrencyManager.ESSENCE, CurrencyManager.VOID_CRYSTALS,
		CurrencyManager.ASTRAL_SHARDS, CurrencyManager.VOID_SCRAPS,
	]:
		var value: float = CurrencyManager.get_balance(currency)
		_ok("%s is a finite, non-negative number" % currency,
			is_finite(value) and value >= 0.0, "value = %s" % value)

	# An equipped item that is not in the inventory is a dangling reference:
	# the slot renders from the inventory entry, so the gear screen would show
	# an occupied slot with nothing in it.
	# equip() MOVES the item out of the inventory, so an id must appear in
	# exactly one of the two. Finding one in both would mean a duplication bug
	# that hands the player the same affixes twice.
	var ids: Dictionary = {}
	for item: Dictionary in EquipmentManager.get_inventory():
		ids[int(item.get("id", 0))] = true
	var duplicated: Array[String] = []
	for slot: SlotDefinition in EquipmentManager.get_slots():
		var item: Dictionary = EquipmentManager.get_equipped(slot.id)
		if item.is_empty():
			continue
		var item_id: int = int(item.get("id", 0))
		if ids.has(item_id):
			duplicated.append("item %d is equipped in %s AND in the inventory"
				% [item_id, slot.id])
		if item_id <= 0:
			duplicated.append("%s holds an item with no id" % slot.id)
	_ok("no item is both equipped and in the inventory",
		duplicated.is_empty(), ", ".join(duplicated))

	var active: StringName = RelicManager.get_active_id()
	var owned_ids: Array[StringName] = []
	for entry: Dictionary in RelicManager.get_owned():
		owned_ids.append(StringName(entry.get("id", "")))
	_ok("the active relic is one the player owns",
		active == &"" or owned_ids.has(active),
		"active = %s, owned = %s" % [active, owned_ids])

	_ok("lifetime peak level is never below the run peak",
		PrestigeManager.lifetime_peak_level >= PrestigeManager.run_peak_level,
		"lifetime = %d, run = %d"
			% [PrestigeManager.lifetime_peak_level, PrestigeManager.run_peak_level])

	_ok("the equipped cosmetic is one the player owns",
		MonetizationManager.owns_cosmetic(MonetizationManager.get_equipped_cosmetic_id()),
		"equipped = %s" % MonetizationManager.get_equipped_cosmetic_id())


## Prove the round-trip comparison can fail.
##
## Everything above passed on the first run it ever made, which is the exact
## situation where a check is worth nothing: `_lost_keys` returning an empty
## array because it silently walked nothing looks identical to a clean save.
## So damage a real save on disk, push it through the same load path, and
## require the comparison to notice. If this reports "did NOT notice", every
## round-trip pass printed above is meaningless.
func _check_positive_control() -> void:
	# Set the value here rather than relying on the seed. The first version of
	# this control ran after _check_currency_hardening(), which loads a save
	# with no void_scraps key and so had already zeroed it — deleting a field
	# that was 0 and reading back 0 is not a detectable change, and the control
	# correctly reported that it was testing nothing.
	CurrencyManager.add(CurrencyManager.VOID_SCRAPS, 777.0)
	SaveManager.save_game()
	var text_a: String = SaveManager.get_full_save_text()

	var file := FileAccess.open(SaveManager.SAVE_PATH, FileAccess.READ)
	if file == null:
		_ok("positive control: save is readable", false)
		return
	var document: Dictionary = JSON.parse_string(file.get_as_text())
	file.close()

	# A field a player would notice losing, in a section every save has.
	document["sections"]["currencies"].erase("void_scraps")
	var out := FileAccess.open(SaveManager.SAVE_PATH, FileAccess.WRITE)
	out.store_string(JSON.stringify(document, "\t"))
	out.close()

	SaveManager._try_load_from(SaveManager.SAVE_PATH)
	var damaged: Dictionary = JSON.parse_string(
		SaveManager.get_full_save_text()).get("sections", {})
	var original: Dictionary = JSON.parse_string(text_a).get("sections", {})

	var found: Array[String] = []
	_lost_keys(original["currencies"], damaged.get("currencies"), "currencies", found)
	_ok("positive control: a deleted currency IS reported as lost",
		not found.is_empty(),
		"the comparison did not notice void_scraps disappearing — "
			+ "every round-trip result above is vacuous")


## The security pass hardened CurrencyManager against non-finite values. These
## assert the hardening from the outside, through the public API, so it cannot
## be removed without something going red.
func _check_currency_hardening() -> void:
	var before: float = CurrencyManager.get_balance(CurrencyManager.ESSENCE)
	CurrencyManager.add(CurrencyManager.ESSENCE, INF)
	CurrencyManager.add(CurrencyManager.ESSENCE, INF - INF)
	_ok("add() refuses inf and NAN",
		is_equal_approx(CurrencyManager.get_balance(CurrencyManager.ESSENCE), before),
		"balance moved to %s" % CurrencyManager.get_balance(CurrencyManager.ESSENCE))

	CurrencyManager.load_save_data({"essence": INF, "void_crystals": 5.0})
	_ok("load_save_data() rejects a non-finite balance",
		is_finite(CurrencyManager.get_balance(CurrencyManager.ESSENCE)),
		"essence = %s" % CurrencyManager.get_balance(CurrencyManager.ESSENCE))
	_ok("...without discarding the good values beside it",
		is_equal_approx(CurrencyManager.get_balance(CurrencyManager.VOID_CRYSTALS), 5.0))
