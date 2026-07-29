extends Node
## CurrencyManager — single source of truth for every currency balance
## (autoload).
##
## All three game currencies live here from day one so later systems slot in
## without refactoring. Balances are floats: incremental-game numbers
## eventually outgrow 64-bit integers, and all display goes through
## NumberFormat anyway.
##
## Nothing outside this manager may change a balance. Earning goes through
## add(), spending through try_spend() — which refuses cleanly instead of
## going negative.

## Main currency, earned from kills (Milestone 3+).
const ESSENCE: StringName = &"essence"

## Prestige currency, earned by collapsing a run into the Eclipse (M8).
const VOID_CRYSTALS: StringName = &"void_crystals"

## Premium currency, bought in the Shop and spent on cosmetics (M14).
const ASTRAL_SHARDS: StringName = &"astral_shards"

## Crafting material from salvaging gear (Milestone 6). Spent at the Forge.
const VOID_SCRAPS: StringName = &"void_scraps"

var _balances: Dictionary = {
	ESSENCE: 0.0,
	VOID_CRYSTALS: 0.0,
	ASTRAL_SHARDS: 0.0,
	VOID_SCRAPS: 0.0,
}


func _ready() -> void:
	SaveManager.register_saveable("currencies", self)


# --- Save contract (called by SaveManager) ------------------------------------


func get_save_data() -> Dictionary:
	return {
		"essence": _balances[ESSENCE],
		"void_crystals": _balances[VOID_CRYSTALS],
		"astral_shards": _balances[ASTRAL_SHARDS],
		"void_scraps": _balances[VOID_SCRAPS],
	}


func load_save_data(data: Dictionary) -> void:
	_balances[ESSENCE] = maxf(0.0, float(data.get("essence", 0.0)))
	_balances[VOID_CRYSTALS] = maxf(0.0, float(data.get("void_crystals", 0.0)))
	_balances[ASTRAL_SHARDS] = maxf(0.0, float(data.get("astral_shards", 0.0)))
	_balances[VOID_SCRAPS] = maxf(0.0, float(data.get("void_scraps", 0.0)))
	for currency: StringName in _balances:
		EventBus.currency_changed.emit(currency, _balances[currency])


# --- Public API --------------------------------------------------------------


func get_balance(currency: StringName) -> float:
	if not _balances.has(currency):
		push_error("CurrencyManager: unknown currency: %s" % currency)
		return 0.0
	return _balances[currency]


func can_afford(currency: StringName, amount: float) -> bool:
	return get_balance(currency) >= amount


## Grant currency. Amount must be positive — spending goes through try_spend().
func add(currency: StringName, amount: float) -> void:
	if not _balances.has(currency):
		push_error("CurrencyManager: unknown currency: %s" % currency)
		return
	if amount < 0.0:
		push_error("CurrencyManager: add() amount must be positive, got %f" % amount)
		return
	_balances[currency] += amount
	EventBus.currency_changed.emit(currency, _balances[currency])


## Wipe the run currency on an Eclipse (Milestone 8). Only Eclipse Essence is
## a run-scoped balance; Void Crystals, Astral Shards, and Void Scraps are all
## kept across prestige. Called by PrestigeManager only.
func reset_run_currency() -> void:
	_balances[ESSENCE] = 0.0
	EventBus.currency_changed.emit(ESSENCE, 0.0)


## Attempt to spend. Returns false (and changes nothing) if the balance is
## too low — callers decide how to present that to the player.
func try_spend(currency: StringName, amount: float) -> bool:
	if not _balances.has(currency):
		push_error("CurrencyManager: unknown currency: %s" % currency)
		return false
	if amount < 0.0:
		push_error("CurrencyManager: try_spend() amount must be positive, got %f" % amount)
		return false
	if _balances[currency] < amount:
		return false
	_balances[currency] -= amount
	EventBus.currency_changed.emit(currency, _balances[currency])
	return true
