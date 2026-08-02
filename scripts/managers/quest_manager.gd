extends Node
## QuestManager — the Journal: the quest chain, the daily set, and achievements
## (autoload). Loads after MinigameManager, whose token grant it pays with, and
## reads the live essence rate for essence rewards.
##
## Everything here is a LIFETIME record: an Eclipse never takes a counter, a
## completion, or a claim away. Nothing here is ever required to progress — the
## Journal tells the player what to do next and pays them for it, and that is
## all it does.

const DEFINITION_DIR: String = "res://data/quests"
const DAILY_COUNT: int = 3
const SECONDS_PER_DAY: int = 86400
## Bound on evaluate()'s fast-forward loop.
const EVALUATE_PASSES: int = 32
## How often the UTC day is re-checked. Load and Journal-open were the only
## two rollover moments, so a session left running across UTC midnight kept
## serving yesterday's goals — claims included. refresh_dailies() returns on
## its first comparison when the day hasn't moved, so this costs nothing.
const DAILY_ROLLOVER_POLL_SECONDS: float = 60.0

var _definitions: Array[QuestDefinition] = []
var _definitions_by_id: Dictionary = {}
## metric (StringName) -> float. Cumulative metrics only; snapshots are queried.
var _counters: Dictionary = {}
## id -> true, both latched: a completion never un-completes (a snapshot metric
## can fall back below target when a balance is spent) and a claim is final.
var _completed: Dictionary = {}
var _claimed: Dictionary = {}
## Today's daily ids, the UTC day they were drawn for, and the counter values
## they started from (lifetime counters must be measured from the day's start).
var _daily_ids: Array[StringName] = []
var _daily_day: int = 0
var _daily_baseline: Dictionary = {}
## Last seen token count, so a decrease can be read as a spend.
var _last_token_count: int = 0
var _daily_rollover_timer: Timer


func _ready() -> void:
	_load_definitions()
	SaveManager.register_saveable("journal", self)
	EventBus.game_loaded.connect(_on_game_loaded)
	EventBus.enemy_died.connect(_on_enemy_died)
	EventBus.boss_fight_won.connect(_on_boss_fight_won)
	EventBus.essence_earned.connect(_on_essence_earned)
	EventBus.item_dropped.connect(_on_item_dropped)
	EventBus.minigame_finished.connect(_on_minigame_finished)
	EventBus.eclipse_performed.connect(_on_eclipse_performed)
	EventBus.upgrade_purchased.connect(_on_upgrade_purchased)
	EventBus.arcade_tokens_changed.connect(_on_arcade_tokens_changed)
	_daily_rollover_timer = Timer.new()
	_daily_rollover_timer.wait_time = DAILY_ROLLOVER_POLL_SECONDS
	_daily_rollover_timer.timeout.connect(refresh_dailies)
	add_child(_daily_rollover_timer)


func _load_definitions() -> void:
	var names: PackedStringArray = DirAccess.get_files_at(DEFINITION_DIR)
	for file_name: String in names:
		# An exported build ships .tres as .tres.remap; load() wants the
		# original path, so strip the suffix before building it.
		var clean: String = file_name.trim_suffix(".remap")
		if not clean.ends_with(".tres"):
			continue
		var definition: QuestDefinition = load("%s/%s" % [DEFINITION_DIR, clean])
		if definition == null:
			push_error("QuestManager: could not load quest: %s" % clean)
			continue
		_definitions.append(definition)
		_definitions_by_id[definition.id] = definition
	_definitions.sort_custom(
		func(a: QuestDefinition, b: QuestDefinition) -> bool:
			if a.kind != b.kind:
				return a.kind < b.kind
			return a.sort_order < b.sort_order
	)


# --- Save contract -----------------------------------------------------------


func get_save_data() -> Dictionary:
	var counters: Dictionary = {}
	for metric: StringName in _counters:
		counters[String(metric)] = _counters[metric]
	var baseline: Dictionary = {}
	for metric: StringName in _daily_baseline:
		baseline[String(metric)] = _daily_baseline[metric]
	var daily: Array[String] = []
	for id: StringName in _daily_ids:
		daily.append(String(id))
	return {
		"counters": counters,
		"completed": _string_keys(_completed),
		"claimed": _string_keys(_claimed),
		"daily_ids": daily,
		"daily_day": _daily_day,
		"daily_baseline": baseline,
	}


func load_save_data(data: Dictionary) -> void:
	_counters.clear()
	for key: String in data.get("counters", {}):
		_counters[StringName(key)] = float(data["counters"][key])
	_daily_baseline.clear()
	for key: String in data.get("daily_baseline", {}):
		_daily_baseline[StringName(key)] = float(data["daily_baseline"][key])
	_completed = _name_keys(data.get("completed", {}))
	_claimed = _name_keys(data.get("claimed", {}))
	_daily_ids.clear()
	for raw: String in data.get("daily_ids", []):
		var id: StringName = StringName(raw)
		if _definitions_by_id.has(id):
			_daily_ids.append(id)
	_daily_day = maxi(0, int(data.get("daily_day", 0)))


func _string_keys(source: Dictionary) -> Dictionary:
	var out: Dictionary = {}
	for id: StringName in source:
		out[String(id)] = true
	return out


func _name_keys(source: Dictionary) -> Dictionary:
	var out: Dictionary = {}
	for key: String in source:
		var id: StringName = StringName(key)
		if _definitions_by_id.has(id):
			out[id] = true
	return out


# --- Reads --------------------------------------------------------------------


func get_definition(id: StringName) -> QuestDefinition:
	return _definitions_by_id.get(id)


## Goals of one kind, in display order. QUEST returns the chain up to and
## including the active link — locked links are never shown, so the chain reads
## as a path rather than a wall.
func get_goals(kind: QuestDefinition.Kind) -> Array[QuestDefinition]:
	var out: Array[QuestDefinition] = []
	if kind == QuestDefinition.Kind.DAILY:
		for id: StringName in _daily_ids:
			var daily: QuestDefinition = _definitions_by_id.get(id)
			if daily != null:
				out.append(daily)
		return out
	for definition: QuestDefinition in _definitions:
		if definition.kind != kind:
			continue
		if kind == QuestDefinition.Kind.QUEST \
				and not _claimed.has(definition.id) \
				and not _completed.has(definition.id):
			# Everything done or awaiting a claim is shown; the first link that
			# is neither is the active one, and the chain stops after it.
			out.append(definition)
			return out
		out.append(definition)
	return out


## Progress toward a goal's target, already clamped at the target.
func get_progress(definition: QuestDefinition) -> float:
	var raw: float = 0.0
	if definition.metric_shape == QuestDefinition.MetricShape.SNAPSHOT:
		raw = _snapshot(definition.metric)
	else:
		raw = float(_counters.get(definition.metric, 0.0))
		if definition.kind == QuestDefinition.Kind.DAILY:
			# Lifetime counters must be measured from the day's start, or a
			# player with 50,000 kills completes every kill-daily instantly.
			raw -= float(_daily_baseline.get(definition.metric, 0.0))
	return clampf(raw, 0.0, definition.target)


func is_claimed(definition: QuestDefinition) -> bool:
	return _claimed.has(definition.id)


func is_claimable(definition: QuestDefinition) -> bool:
	return _completed.has(definition.id) and not _claimed.has(definition.id)


func get_unclaimed_count() -> int:
	var count: int = 0
	for kind: int in [
		QuestDefinition.Kind.QUEST,
		QuestDefinition.Kind.DAILY,
		QuestDefinition.Kind.ACHIEVEMENT,
	]:
		for definition: QuestDefinition in get_goals(kind):
			if is_claimable(definition):
				count += 1
	return count


func seconds_until_daily_reset() -> int:
	var now: int = int(Time.get_unix_time_from_system())
	@warning_ignore("integer_division")
	var day_start: int = (now / SECONDS_PER_DAY) * SECONDS_PER_DAY
	return maxi(0, day_start + SECONDS_PER_DAY - now)


# --- Claiming -----------------------------------------------------------------


## Pay out a completed goal. Returns the reward text, or "" if refused —
## refusing an already-claimed goal is what makes a double-tap safe.
func claim(id: StringName) -> String:
	var definition: QuestDefinition = _definitions_by_id.get(id)
	if definition == null or not is_claimable(definition):
		return ""
	if definition.reward_kind == QuestDefinition.RewardKind.ARCADE_TOKENS \
			and not MinigameManager.has_token_room(int(definition.reward_amount)):
		# Paying into a full meter would silently discard the reward. Refuse,
		# so it stays claimable until there is room; the UI says why.
		return ""
	_claimed[id] = true
	match definition.reward_kind:
		QuestDefinition.RewardKind.ARCADE_TOKENS:
			MinigameManager.grant_token(int(definition.reward_amount))
		QuestDefinition.RewardKind.VOID_CRYSTALS:
			CurrencyManager.add(CurrencyManager.VOID_CRYSTALS, definition.reward_amount)
		QuestDefinition.RewardKind.ASTRAL_SHARDS:
			CurrencyManager.add(CurrencyManager.ASTRAL_SHARDS, definition.reward_amount)
		_:
			var amount: float = maxf(1.0, floor(
				IdleManager.get_live_essence_rate() * definition.reward_amount
			))
			CurrencyManager.add(CurrencyManager.ESSENCE, amount)
			EventBus.essence_earned.emit(amount, &"quest")
	SaveManager.save_game()
	var text: String = definition.format_reward()
	EventBus.goal_claimed.emit(id, text)
	# Claiming a chain link reveals the next one, which an advanced save may
	# already satisfy — latch it now rather than waiting for the next kill.
	evaluate()
	return text


## Lifetime records — an Eclipse never takes them away.
func reset_for_prestige() -> void:
	pass


# --- Internals ----------------------------------------------------------------


func _snapshot(metric: StringName) -> float:
	match metric:
		&"enemy_level":
			return float(PrestigeManager.lifetime_peak_level)
		&"relics_owned":
			return float(RelicManager.get_owned().size())
		&"pets_owned":
			return float(PetManager.get_owned_ids().size())
		&"crystals":
			return CurrencyManager.get_balance(CurrencyManager.VOID_CRYSTALS)
		&"skill_levels":
			var total: float = 0.0
			for skill: SkillNodeDefinition in SkillTreeManager.get_definitions():
				total += float(SkillTreeManager.get_level(skill.id))
			return total
	return 0.0


func _bump(metric: StringName, amount: float = 1.0) -> void:
	_counters[metric] = float(_counters.get(metric, 0.0)) + amount
	evaluate()


## Latch any newly-complete goal in the ACTIVE set. Driven by signals and by
## opening the Journal — walking every definition every frame would be wasted
## work for a screen the player visits occasionally.
func evaluate() -> void:
	# Repeat while anything latches: completing a chain link reveals the next,
	# which may already be satisfied on an advanced save. Bounded so a data
	# error can never spin here.
	for _pass: int in range(EVALUATE_PASSES):
		if not _evaluate_once():
			return


func _evaluate_once() -> bool:
	var latched: bool = false
	for kind: int in [
		QuestDefinition.Kind.QUEST,
		QuestDefinition.Kind.DAILY,
		QuestDefinition.Kind.ACHIEVEMENT,
	]:
		for definition: QuestDefinition in get_goals(kind):
			if _completed.has(definition.id):
				continue
			if get_progress(definition) >= definition.target:
				_completed[definition.id] = true
				latched = true
				EventBus.goal_completed.emit(definition.id)
	return latched


## Draw a fresh daily set when the UTC day advances.
func refresh_dailies() -> void:
	var today: int = int(Time.get_unix_time_from_system()) / SECONDS_PER_DAY
	# STRICTLY greater: a backwards-set clock must never reroll into a fresh
	# set of goals.
	if today <= _daily_day and not _daily_ids.is_empty():
		return
	var pool: Array[QuestDefinition] = []
	for definition: QuestDefinition in _definitions:
		if definition.kind == QuestDefinition.Kind.DAILY:
			pool.append(definition)
	pool.shuffle()
	# Yesterday's state goes with yesterday's goals, including anything left
	# unclaimed — the UI states the reset time so this is never a surprise.
	for id: StringName in _daily_ids:
		_completed.erase(id)
		_claimed.erase(id)
	_daily_ids.clear()
	_daily_baseline.clear()
	for definition: QuestDefinition in pool.slice(0, mini(DAILY_COUNT, pool.size())):
		_daily_ids.append(definition.id)
		_completed.erase(definition.id)
		_claimed.erase(definition.id)
		if definition.metric_shape == QuestDefinition.MetricShape.CUMULATIVE:
			_daily_baseline[definition.metric] = float(_counters.get(definition.metric, 0.0))
	_daily_day = today
	EventBus.dailies_rerolled.emit()


func _on_game_loaded(_is_new_game: bool) -> void:
	_last_token_count = MinigameManager.tokens
	refresh_dailies()
	# Started only now, never in _ready: the poll must not draw a set before the
	# save has restored _daily_day, or every launch would reroll on the spot.
	_daily_rollover_timer.start()
	# Latch everything an existing save already satisfies, so an advanced player
	# is not walked back through the tutorial chain.
	evaluate()


func _on_enemy_died(_level: int, _total_kills: int) -> void:
	_bump(&"kills")


func _on_boss_fight_won(_level: int, _payout: float, _is_world_boss: bool) -> void:
	_bump(&"boss_wins")


func _on_essence_earned(amount: float, source: StringName) -> void:
	# Quest payouts are excluded: crediting them would let an essence reward
	# feed the very counter that pays it.
	if source != &"quest":
		_bump(&"essence_earned", amount)


func _on_item_dropped(_item: Dictionary) -> void:
	_bump(&"items_dropped")


func _on_minigame_finished(_id: StringName, outcome: int, _payout: float) -> void:
	# A forfeit is not a game played — it would otherwise let a player farm the
	# "play N games" daily by entering and quitting.
	if outcome == Minigame.Outcome.QUIT:
		return
	_bump(&"minigames_played")
	if outcome == Minigame.Outcome.WIN:
		_bump(&"minigames_won")


## Tokens only ever leave the meter by being spent on a game.
func _on_arcade_tokens_changed(count: int) -> void:
	if count < _last_token_count:
		_bump(&"tokens_spent", float(_last_token_count - count))
	_last_token_count = count


func _on_eclipse_performed(_reward: float, _count: int) -> void:
	_bump(&"eclipses")


func _on_upgrade_purchased(_id: StringName, _new_level: int) -> void:
	_bump(&"upgrades_bought")
