extends Node
## MinigameManager — owns the Arcade: minigame definitions, the Arcade Token
## meter, per-game records, and payout pricing (autoload). Loads after
## IdleManager, whose live essence rate prices every reward.
##
## Tokens and records are META: they are kept across an Eclipse, like Void
## Crystals. Nothing here ever gates progression — the Arcade is a side door.

const TOKEN_CAP: int = 5
## Real seconds per regenerated token (2.5h to refill a spent meter).
const TOKEN_REGEN_SECONDS: int = 1800
## Chance a boss win also yields a token, so active play feeds the Arcade.
const BOSS_TOKEN_CHANCE: float = 0.10
## Fraction of the scaled reward a LOSS/QUIT still pays — attempting is never
## punished, it is just worth less than winning.
const LOSS_FLOOR: float = 0.25
const ARCADE_UNLOCK_LEVEL: int = 20

const MINIGAME_DEFINITION_PATHS: Array[String] = [
	"res://data/minigames/void_reflex.tres",
	"res://data/minigames/memory_match.tres",
	"res://data/minigames/connect_four.tres",
]

## Which minigame the host should load. The hub sets it immediately before
## changing scenes (SceneManager.change_scene takes only a path), and the host
## clears it on read.
var pending_id: StringName = &""

var tokens: int = TOKEN_CAP

var _definitions: Array[MinigameDefinition] = []
var _definitions_by_id: Dictionary = {}
## id (StringName) -> best score (float)
var _best: Dictionary = {}
## Unix time the current partial token started accruing from.
var _regen_anchor_unix: int = 0
var _unlock_announced: bool = false


func _ready() -> void:
	for path: String in MINIGAME_DEFINITION_PATHS:
		var definition: MinigameDefinition = load(path)
		if definition == null:
			push_error("MinigameManager: could not load minigame: %s" % path)
			continue
		_definitions.append(definition)
		_definitions_by_id[definition.id] = definition
	_definitions.sort_custom(
		func(a: MinigameDefinition, b: MinigameDefinition) -> bool:
			return a.sort_order < b.sort_order
	)
	SaveManager.register_saveable("arcade", self)
	EventBus.game_loaded.connect(_on_game_loaded)
	EventBus.boss_fight_won.connect(_on_boss_fight_won)


# --- Save contract -----------------------------------------------------------


func get_save_data() -> Dictionary:
	var best: Dictionary = {}
	for id: StringName in _best:
		best[String(id)] = _best[id]
	return {
		"tokens": tokens,
		"regen_anchor_unix": _regen_anchor_unix,
		"unlock_announced": _unlock_announced,
		"best": best,
	}


func load_save_data(data: Dictionary) -> void:
	# An absent section never reaches here, so a pre-Arcade save keeps the
	# full meter it was initialised with — the update's welcome gift.
	tokens = clampi(int(data.get("tokens", TOKEN_CAP)), 0, TOKEN_CAP)
	_regen_anchor_unix = maxi(0, int(data.get("regen_anchor_unix", 0)))
	_unlock_announced = bool(data.get("unlock_announced", false))
	_best.clear()
	var raw_best: Dictionary = data.get("best", {})
	for key: String in raw_best:
		var id: StringName = StringName(key)
		if _definitions_by_id.has(id):
			_best[id] = float(raw_best[key])


# --- Definitions -------------------------------------------------------------


func get_definitions() -> Array[MinigameDefinition]:
	return _definitions


func get_definition(id: StringName) -> MinigameDefinition:
	return _definitions_by_id.get(id)


func is_unlocked(definition: MinigameDefinition) -> bool:
	return CombatManager.enemy_level >= definition.unlock_level


func is_arcade_unlocked() -> bool:
	return _unlock_announced or CombatManager.enemy_level >= ARCADE_UNLOCK_LEVEL


# --- Tokens ------------------------------------------------------------------


## Bring the meter up to date with wall-clock time. Safe to call often.
func accrue_tokens() -> void:
	var now: int = int(Time.get_unix_time_from_system())
	if tokens >= TOKEN_CAP:
		# A full meter never banks time: idling at cap for a day must not hand
		# out instant tokens the moment one is spent.
		_regen_anchor_unix = now
		return
	if _regen_anchor_unix <= 0:
		_regen_anchor_unix = now
		return
	# Clamped at zero so a backwards-set clock can never grant or go negative.
	var elapsed: int = maxi(0, now - _regen_anchor_unix)
	@warning_ignore("integer_division")
	var gained: int = elapsed / TOKEN_REGEN_SECONDS
	if gained <= 0:
		return
	var before: int = tokens
	tokens = mini(TOKEN_CAP, tokens + gained)
	# Advance by exactly what was consumed so the remainder carries; snap to
	# now if the cap absorbed the rest.
	if tokens >= TOKEN_CAP:
		_regen_anchor_unix = now
	else:
		_regen_anchor_unix += gained * TOKEN_REGEN_SECONDS
	if tokens != before:
		EventBus.arcade_tokens_changed.emit(tokens)


func seconds_until_next_token() -> int:
	accrue_tokens()
	if tokens >= TOKEN_CAP:
		return 0
	var now: int = int(Time.get_unix_time_from_system())
	var elapsed: int = maxi(0, now - _regen_anchor_unix)
	return maxi(0, TOKEN_REGEN_SECONDS - elapsed)


func has_token(cost: int = 1) -> bool:
	accrue_tokens()
	return tokens >= cost


## Spend entry cost. Returns false (changing nothing) when short.
func try_spend_token(cost: int = 1) -> bool:
	accrue_tokens()
	if tokens < cost:
		return false
	# Starting the anchor here means the next token begins accruing from the
	# moment the meter left full, not from some stale timestamp.
	if tokens >= TOKEN_CAP:
		_regen_anchor_unix = int(Time.get_unix_time_from_system())
	tokens -= cost
	EventBus.arcade_tokens_changed.emit(tokens)
	SaveManager.save_game()
	return true


func grant_token(count: int = 1) -> void:
	accrue_tokens()
	var before: int = tokens
	tokens = mini(TOKEN_CAP, tokens + count)
	if tokens == before:
		return  # at cap: absorbed silently, nothing to persist
	EventBus.arcade_tokens_changed.emit(tokens)
	# Persist the grant itself. WorldManager saves earlier in the boss-win
	# chain, so without this the token would be lost to a force-kill.
	SaveManager.save_game()


# --- Payout & records --------------------------------------------------------


## Essence a run pays: seconds-of-current-rate scaled by performance. Read
## live, so a win is worth "about N minutes of progress" at any power level.
func compute_payout(definition: MinigameDefinition, performance: float) -> float:
	var rate: float = IdleManager.get_live_essence_rate()
	var seconds: float = definition.reward_seconds * clampf(performance, 0.0, 1.0)
	return maxf(1.0, floor(rate * seconds))


func get_best(id: StringName) -> float:
	return float(_best.get(id, 0.0))


func has_best(id: StringName) -> bool:
	return _best.has(id)


## Record a run's score. Returns true when it beat the previous best.
## A first run only sets a record if it actually scored — otherwise a forfeit
## would write "Best: 0" permanently and claim a new record doing it.
func record_result(id: StringName, score: float) -> bool:
	var definition: MinigameDefinition = _definitions_by_id.get(id)
	if definition == null:
		return false
	if not _best.has(id):
		if score <= 0.0:
			return false
		_best[id] = score
		return true
	var previous: float = float(_best[id])
	var beaten: bool = score < previous if definition.lower_is_better else score > previous
	if not beaten:
		return false
	_best[id] = score
	return true


## The Arcade is meta — an Eclipse never takes tokens or records away.
func reset_for_prestige() -> void:
	pass


# --- Internals ---------------------------------------------------------------


func _on_game_loaded(_is_new_game: bool) -> void:
	if _regen_anchor_unix <= 0:
		_regen_anchor_unix = int(Time.get_unix_time_from_system())
	accrue_tokens()
	# A save already past the gate is grandfathered silently; the banner only
	# ever plays on a live crossing. Connected here (not in _ready) so
	# CombatManager's load-time spawn is never read as one.
	if CombatManager.enemy_level >= ARCADE_UNLOCK_LEVEL:
		_unlock_announced = true
	EventBus.enemy_spawned.connect(_on_enemy_spawned)


func _on_enemy_spawned(_definition: EnemyDefinition, _level: int, _max_hp: float) -> void:
	if _unlock_announced or CombatManager.enemy_level < ARCADE_UNLOCK_LEVEL:
		return
	_unlock_announced = true
	SaveManager.save_game()
	EventBus.arcade_unlocked.emit()


func _on_boss_fight_won(_level: int, _payout: float, _is_world_boss: bool) -> void:
	if randf() < BOSS_TOKEN_CHANCE:
		grant_token()
