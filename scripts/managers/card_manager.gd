extends Node
## CardManager — boss trophy cards: the roll, the collection, and absorption
## (autoload).
##
## Every boss that dies leaves a card. The card is an INSTANCE, not a
## definition: its three stats are rolled at the kill from the boss's level and
## the tier that came up, and the result lives in the save. Only the shape of
## the roll is data (`data/card_rarities/`), so retuning drop rates or potency
## is a .tres edit and never touches this file.
##
## A card's exit is absorption. Feeding one to the active companion converts it
## into pet XP (its POWER) and a permanent addition to that pet's passive
## (its VIGOR), then destroys it — the same shape as essence: a resource you
## hold, spend once, and see reflected in a number that went up. That is why
## nothing here is equippable and there is no card slot: a collection you must
## curate is a second inventory, and the game already has one.
##
## Loads last. It reads PetManager and CurrencyManager and is read by neither.

## Where the rarity tiers live. Scanned as a directory so adding a tier is a
## file, and so check_data.py's reachability pass can see it.
const RARITY_DIR: String = "res://data/card_rarities"

## Rolled stats vary this far either side of their tier's baseline, so two
## cards off the same boss at the same tier are still not the same card.
const ROLL_SPREAD: float = 0.15

## POWER per boss level, before tier potency. Sets how much a card is worth as
## pet food: at level 50 a common is ~400 XP against the 3 XP a kill gives.
const POWER_PER_LEVEL: float = 8.0

## VIGOR converts to a permanent bonus fraction at this rate. A legendary rolls
## around 18 vigor, so one is worth ~3.6% — real, and not a substitute for
## levelling the pet.
const VIGOR_TO_BONUS: float = 0.002

## Hard cap on stored cards. Bosses are endless, so the collection has to be.
const COLLECTION_LIMIT: int = 200

var _rarities: Array[CardRarityDefinition] = []
var _rarities_by_id: Dictionary = {}
## The boss currently being fought, remembered from boss_fight_started —
## boss_fight_won carries a level and a payout but not who died.
var _pending_boss: EnemyDefinition = null
## Array of card dictionaries. See _roll_card() for the shape.
var _cards: Array = []


func _ready() -> void:
	_load_rarities()
	SaveManager.register_saveable("cards", self)
	EventBus.boss_fight_started.connect(_on_boss_fight_started)
	EventBus.boss_fight_won.connect(_on_boss_fight_won)


func _load_rarities() -> void:
	var dir := DirAccess.open(RARITY_DIR)
	if dir == null:
		return
	for file: String in dir.get_files():
		# Exported builds rename .tres to .remap; loading the un-suffixed path
		# resolves both, which is the same trick the other definition loaders
		# in this project use. The extension is checked AFTER that trim, for the
		# same reason QuestManager and MonetizationManager check it: without it
		# any stray file in the directory is handed straight to load().
		var file_name: String = file.trim_suffix(".remap")
		if not file_name.ends_with(".tres"):
			continue
		var path: String = RARITY_DIR + "/" + file_name
		var definition: CardRarityDefinition = load(path)
		if definition == null or definition.id == &"":
			continue
		_rarities.append(definition)
		_rarities_by_id[definition.id] = definition
	_rarities.sort_custom(
		func(a: CardRarityDefinition, b: CardRarityDefinition) -> bool:
			return a.sort_order < b.sort_order
	)


# --- Save contract -----------------------------------------------------------


func get_save_data() -> Dictionary:
	var stored: Array = []
	for card: Dictionary in _cards:
		stored.append(card.duplicate())
	return {"cards": stored}


func load_save_data(data: Dictionary) -> void:
	_cards.clear()
	for raw: Variant in data.get("cards", []):
		if raw is Dictionary:
			var card: Dictionary = _sanitise(raw as Dictionary)
			if not card.is_empty():
				_cards.append(card)


## A card off disk is untrusted: an edited save, or one written before a rarity
## was renamed, must not reach the UI as a half-built dictionary. Anything that
## cannot be made whole is dropped rather than repaired into a lie.
func _sanitise(raw: Dictionary) -> Dictionary:
	var rarity: StringName = StringName(raw.get("rarity", ""))
	if not _rarities_by_id.has(rarity):
		return {}
	return {
		"boss": String(raw.get("boss", "")),
		"name": String(raw.get("name", "Unknown")),
		"rarity": String(rarity),
		"level": maxi(1, int(raw.get("level", 1))),
		"power": maxf(0.0, float(raw.get("power", 0.0))),
		"vigor": maxf(0.0, float(raw.get("vigor", 0.0))),
		"focus": maxf(0.0, float(raw.get("focus", 0.0))),
	}


# --- Public reads ------------------------------------------------------------


func get_cards() -> Array:
	return _cards.duplicate()


func get_card_count() -> int:
	return _cards.size()


func get_rarity(id: StringName) -> CardRarityDefinition:
	return _rarities_by_id.get(id)


func get_rarities() -> Array[CardRarityDefinition]:
	return _rarities.duplicate()


# --- Absorption --------------------------------------------------------------


## Feed one card to the active companion. Returns what it granted so the UI can
## say so, or an empty dictionary if the absorb could not happen.
##
## The pet must be ACTIVE, not merely owned: absorption is the one place a
## player chooses which companion gets stronger, and letting it target a benched
## pet would make the choice invisible.
func absorb(index: int) -> Dictionary:
	if index < 0 or index >= _cards.size():
		return {}
	var active: StringName = PetManager.get_active_id()
	if active == &"":
		return {}
	var card: Dictionary = _cards[index]
	var power: float = float(card.get("power", 0.0))
	var vigor: float = float(card.get("vigor", 0.0))
	var granted_bonus: float = PetManager.add_absorbed_bonus(
		active, vigor * VIGOR_TO_BONUS
	)
	PetManager.grant_xp(active, power)
	_cards.remove_at(index)
	SaveManager.save_game()
	var result: Dictionary = {
		"pet": String(active),
		"xp": power,
		"bonus": granted_bonus,
		"name": String(card.get("name", "")),
		"rarity": String(card.get("rarity", "")),
	}
	EventBus.card_absorbed.emit(active, power, granted_bonus)
	return result


# --- The roll ----------------------------------------------------------------


func _on_boss_fight_started(
	definition: EnemyDefinition, _level: int, _max_hp: float, _duration: float
) -> void:
	_pending_boss = definition


func _on_boss_fight_won(level: int, _payout: float, _is_world_boss: bool) -> void:
	var card: Dictionary = _roll_card(_pending_boss, level)
	_pending_boss = null
	if card.is_empty():
		return
	_cards.append(card)
	# Oldest first: the collection is a log of what you beat, and the early
	# cards are the ones a player has already absorbed or outgrown.
	while _cards.size() > COLLECTION_LIMIT:
		_cards.remove_at(0)
	SaveManager.save_game()
	EventBus.card_collected.emit(card.duplicate())


func _roll_card(boss: EnemyDefinition, level: int) -> Dictionary:
	var rarity: CardRarityDefinition = _roll_rarity(level)
	if rarity == null:
		return {}
	var potency: float = rarity.potency_multiplier
	return {
		"boss": String(boss.id) if boss != null else "",
		"name": boss.display_name if boss != null else "Nameless Boss",
		"rarity": String(rarity.id),
		"level": level,
		"power": float(level) * POWER_PER_LEVEL * potency * _spread(),
		"vigor": (1.0 + 2.0 * randf()) * potency * _spread(),
		"focus": 10.0 * potency * _spread(),
	}


## Weighted pick across every tier the boss is high enough level to roll.
##
## The level floor is applied by EXCLUDING tiers rather than by re-rolling: a
## re-roll loop on a table whose entries are all excluded never terminates, and
## the first boss in the game is exactly that case.
func _roll_rarity(level: int) -> CardRarityDefinition:
	var eligible: Array[CardRarityDefinition] = []
	var total: float = 0.0
	for rarity: CardRarityDefinition in _rarities:
		if level < rarity.minimum_boss_level or rarity.drop_weight <= 0.0:
			continue
		eligible.append(rarity)
		total += rarity.drop_weight
	if eligible.is_empty() or total <= 0.0:
		return null
	var roll: float = randf() * total
	for rarity: CardRarityDefinition in eligible:
		roll -= rarity.drop_weight
		if roll <= 0.0:
			return rarity
	return eligible[eligible.size() - 1]


func _spread() -> float:
	return 1.0 + randf_range(-ROLL_SPREAD, ROLL_SPREAD)
