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
	_balances[ESSENCE] = _sanitize(data.get("essence", 0.0), "essence")
	_balances[VOID_CRYSTALS] = _sanitize(data.get("void_crystals", 0.0), "void_crystals")
	_balances[ASTRAL_SHARDS] = _sanitize(data.get("astral_shards", 0.0), "astral_shards")
	_balances[VOID_SCRAPS] = _sanitize(data.get("void_scraps", 0.0), "void_scraps")
	for currency: StringName in _balances:
		EventBus.currency_changed.emit(currency, _balances[currency])


## Read one balance out of a save document, rejecting anything that isn't a
## real number.
##
## maxf() alone is not enough. JSON has no literal for infinity, but a double
## that overflows parses to `inf` (Godot reads `1e400` as `inf`), and
## maxf(0.0, inf) is inf while maxf(0.0, NAN) is NAN — both sail straight
## through. That matters because the poison is self-perpetuating: Godot
## stringifies inf as `1e99999`, which parses back to inf on the next load,
## so a single bad value survives every save from then on. A NAN balance is
## worse than a large one: every comparison against NAN is false, so
## `_balances[c] < amount` in try_spend() never refuses and the subtraction
## leaves NAN behind — an unlimited wallet that also never visibly changes.
##
## Reachable without a hex editor: this is an incremental game whose numbers
## grow exponentially, so a long enough run can overflow a float on its own.
func _sanitize(raw: Variant, label: String) -> float:
	var value: float = float(raw)
	if not is_finite(value):
		push_error("CurrencyManager: %s was %s in the save — reset to 0." % [label, value])
		return 0.0
	return maxf(0.0, value)


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
	# The is_finite() half is load-bearing: every comparison against NAN is
	# false, so `amount < 0.0` alone waved NAN through and poisoned the balance
	# permanently. inf is refused here too — it only ever arrives from a
	# multiplier chain that has already overflowed, which is the real bug.
	if not is_finite(amount) or amount < 0.0:
		push_error("CurrencyManager: add() amount must be a positive number, got %s" % amount)
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
	if not is_finite(amount) or amount < 0.0:
		push_error("CurrencyManager: try_spend() amount must be a positive number, got %s" % amount)
		return false
	# A non-finite BALANCE is the dangerous direction: `NAN < amount` is false,
	# so without this the affordability test passes and every price in the game
	# becomes free. Refuse rather than repair, so the error is visible.
	if not is_finite(_balances[currency]):
		push_error("CurrencyManager: %s balance is %s — refusing to spend." \
			% [currency, _balances[currency]])
		return false
	if _balances[currency] < amount:
		return false
	_balances[currency] -= amount
	EventBus.currency_changed.emit(currency, _balances[currency])
	return true
