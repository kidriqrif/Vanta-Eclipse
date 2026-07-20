extends Node
## CombatManager — owns all combat state and rules (autoload).
##
## Milestone 5: a three-state machine (normal / boss fight / farm mode).
## A boss guards every 10th level; the fight is timed; failing drops to
## farming level-1 below the gate with a free retry. Bosses flow through
## the same spawn/damage internals, so taps, auto-attack, crits, and
## every existing signal work unmodified.
##
## The gameplay scene is only a window into this manager: it sends taps
## and the CHALLENGE BOSS request in, and renders the signals that come
## out. Boss entry defers until the screen is unobstructed — overlays
## announce themselves on the EventBus (ui_overlay_opened/closed) and
## scene transitions are tracked from the existing signals.

enum State { NORMAL, BOSS_FIGHT, FARM_MODE }

const RESPAWN_DELAY: float = 0.45
## One extra breath after a boss falls before the next enemy appears.
const BOSS_WIN_RESPAWN_DELAY: float = 1.0
## The withdraw micro-state's length (boss endures / farm enemy steps aside).
const WITHDRAW_DELAY: float = 0.4

## Baseline enemy health curve (see docs/ARCHITECTURE.md Balancing).
const ENEMY_BASE_HP: float = 5.0
const ENEMY_HP_GROWTH: float = 1.15
const ESSENCE_BASE_REWARD: float = 2.0
const ESSENCE_REWARD_GROWTH: float = 1.09

## Boss tuning — locked by simulation (scratchpad boss_sim.py): 3x HP
## keeps gates 10-40 beatable on arrival while the level-50 world boss
## is a real ~6-minute wall that upgrades break. Deep-world walls are
## intentionally brutal until equipment (M6), relics (M7), prestige (M8).
const BOSS_HP_MULTIPLIER: float = 3.0
const BOSS_TIMER_DURATION: float = 30.0
const BOSS_REWARD_MULTIPLIER: float = 10.0
## The countdown only starts once the entrance settles (UX spec §4A) —
## the entrance can only ever GIVE time, never cost it.
const BOSS_ENTRANCE_GRACE: float = 1.1

var state: State = State.NORMAL
var enemy_level: int = 1
var total_kills: int = 0
var enemy_hp: float = 0.0
var enemy_max_hp: float = 0.0

var _current_definition: EnemyDefinition = null
var _alive: bool = false
var _boss_time_remaining: float = 0.0
var _boss_timer_running: bool = false
var _boss_entry_held: bool = false
var _overlay_count: int = 0
var _gameplay_current: bool = false
## world id (String) -> Array[EnemyDefinition], loaded on demand.
var _roster_cache: Dictionary = {}


func _ready() -> void:
	SaveManager.register_saveable("combat", self)
	EventBus.game_loaded.connect(_on_game_loaded)
	EventBus.ui_overlay_opened.connect(_on_overlay_opened)
	EventBus.ui_overlay_closed.connect(_on_overlay_closed)
	EventBus.scene_transition_started.connect(_on_scene_transition_started)
	EventBus.scene_transition_finished.connect(_on_scene_transition_finished)


func _process(delta: float) -> void:
	# Default PAUSABLE process mode on purpose: the countdown freezes with
	# a paused tree and with Android suspension — a notification can never
	# drain the timer (UX spec §6).
	if state != State.BOSS_FIGHT or not _boss_timer_running or not _alive:
		return
	_boss_time_remaining -= delta
	if _boss_time_remaining <= 0.0:
		_on_boss_timer_expired()


# --- Save contract (called by SaveManager) ------------------------------------


func get_save_data() -> Dictionary:
	return {
		"enemy_level": enemy_level,
		"total_kills": total_kills,
		# Mid-fight state is deliberately never saved: a killed app
		# re-enters the gate fresh (UX spec §6).
		"farm_mode": state == State.FARM_MODE,
	}


func load_save_data(data: Dictionary) -> void:
	enemy_level = maxi(1, int(data.get("enemy_level", 1)))
	total_kills = maxi(0, int(data.get("total_kills", 0)))
	state = State.FARM_MODE if bool(data.get("farm_mode", false)) else State.NORMAL


# --- Public API --------------------------------------------------------------


func is_enemy_alive() -> bool:
	return _alive


func get_enemy_definition() -> EnemyDefinition:
	return _current_definition


func get_boss_time_remaining() -> float:
	return maxf(0.0, _boss_time_remaining)


## The level whose enemies are actually being killed right now — used by
## IdleManager to price offline progression honestly at a boss wall.
func get_effective_kill_level() -> int:
	if state == State.NORMAL:
		return enemy_level
	return maxi(1, enemy_level - 1)


## Essence for killing a normal enemy of this level, after the player's
## essence multiplier and the level's world multiplier. Always >= 1.
func get_essence_reward(level: int) -> float:
	var reward: float = ESSENCE_BASE_REWARD * pow(ESSENCE_REWARD_GROWTH, level - 1)
	reward *= PlayerStats.get_essence_gain_multiplier()
	reward *= WorldManager.get_essence_multiplier_for_level(level)
	return maxf(1.0, round(reward))


func player_tap_attack() -> void:
	if not _alive:
		return
	var roll: Dictionary = PlayerStats.roll_tap_damage()
	_apply_damage(roll["amount"], roll["is_crit"])


## Called by IdleManager's tick. Identical rules to a tap.
func auto_attack() -> void:
	if not _alive:
		return
	var roll: Dictionary = PlayerStats.roll_tap_damage()
	_apply_damage(roll["amount"], roll["is_crit"])


## Average seconds one kill takes for an auto-attacker at current stats,
## against the baseline enemy of the given level (offline pricing).
func get_expected_seconds_per_kill(level: int, attack_interval: float) -> float:
	var hp: float = _baseline_hp(level)
	var hits: float = hp / maxf(0.0001, PlayerStats.get_average_damage_per_hit())
	return hits * attack_interval + RESPAWN_DELAY


## Called by the UI after the World Unlock modal's ENTER: the new
## world's first enemy spawns only now (spec §2B/§4C).
func resume_spawning() -> void:
	if not _alive:
		_do_respawn()


## Called by the UI when the CHALLENGE BOSS button is tapped.
func request_boss_challenge() -> void:
	if state != State.FARM_MODE:
		return
	state = State.BOSS_FIGHT
	if _alive:
		_alive = false
		EventBus.enemy_withdrawn.emit()
		get_tree().create_timer(WITHDRAW_DELAY).timeout.connect(_request_boss_entry)
	else:
		_request_boss_entry()


# --- Internals: flow ----------------------------------------------------------


func _on_game_loaded(_is_new_game: bool) -> void:
	# Grandfather rule (UX spec §6): a save whose level outruns the
	# unlock floor silently raises it — progress is never taken away.
	WorldManager.raise_unlocked_floor(WorldManager.world_index_for_level(enemy_level))
	if WorldManager.is_gate_level(enemy_level):
		if state == State.FARM_MODE:
			_spawn_enemy_at(get_effective_kill_level())
		else:
			# Saved at the gate (or killed mid-attempt): fresh auto-enter.
			_request_boss_entry()
	else:
		state = State.NORMAL
		_spawn_enemy_at(enemy_level)


func _apply_damage(amount: float, is_crit: bool) -> void:
	enemy_hp = maxf(0.0, enemy_hp - amount)
	EventBus.enemy_damaged.emit(amount, is_crit, enemy_hp, enemy_max_hp)
	if enemy_hp <= 0.0 and _alive:
		_on_enemy_killed()


func _on_enemy_killed() -> void:
	_alive = false
	total_kills += 1
	EventBus.enemy_died.emit(enemy_level, total_kills)
	if state == State.BOSS_FIGHT:
		_boss_timer_running = false
		var gate_level: int = enemy_level
		var payout: float = get_essence_reward(gate_level) * BOSS_REWARD_MULTIPLIER
		CurrencyManager.add(CurrencyManager.ESSENCE, payout)
		EventBus.essence_earned.emit(payout, &"boss")
		var is_world_boss: bool = WorldManager.is_world_boss_gate(gate_level)
		# Advance PAST the gate before announcing: WorldManager saves at
		# the kill, and that save must capture the post-win state so a
		# crash under the modal reloads into the new world, not the gate.
		state = State.NORMAL
		enemy_level += 1
		EventBus.boss_fight_won.emit(gate_level, payout, is_world_boss)
		if is_world_boss and WorldManager.has_pending_unlock_celebration():
			# The new world's first enemy spawns on ENTER (spec §2B/§4C);
			# gameplay calls resume_spawning() on acknowledgment.
			return
		_schedule_respawn(BOSS_WIN_RESPAWN_DELAY)
		return
	var reward: float = get_essence_reward(enemy_level if state == State.NORMAL
			else get_effective_kill_level())
	CurrencyManager.add(CurrencyManager.ESSENCE, reward)
	EventBus.essence_earned.emit(reward, &"combat")
	if state == State.NORMAL:
		enemy_level += 1
	_schedule_respawn(RESPAWN_DELAY)


func _schedule_respawn(delay: float) -> void:
	get_tree().create_timer(delay).timeout.connect(_do_respawn)


func _do_respawn() -> void:
	if _alive:
		return
	match state:
		State.NORMAL:
			if WorldManager.is_gate_level(enemy_level):
				_request_boss_entry()
			else:
				_spawn_enemy_at(enemy_level)
		State.FARM_MODE:
			_spawn_enemy_at(get_effective_kill_level())
		State.BOSS_FIGHT:
			pass  # the boss entry flow owns spawning in this state


func _request_boss_entry() -> void:
	state = State.BOSS_FIGHT
	if _overlay_count == 0 and _gameplay_current:
		_enter_boss_fight()
	else:
		# A countdown must never tick behind a scrim, an open shop, or a
		# scene that isn't the gameplay screen (UX spec §2A).
		_boss_entry_held = true


func _enter_boss_fight() -> void:
	var path: String = WorldManager.get_boss_path_for_gate(enemy_level)
	var definition: EnemyDefinition = load(path) if path != "" else null
	if definition == null:
		push_error("CombatManager: missing boss for gate %d — farming instead." % enemy_level)
		state = State.FARM_MODE
		_spawn_enemy_at(get_effective_kill_level())
		return
	_current_definition = definition
	enemy_max_hp = _baseline_hp(enemy_level) * BOSS_HP_MULTIPLIER * definition.hp_multiplier
	enemy_hp = enemy_max_hp
	_alive = true
	_boss_time_remaining = BOSS_TIMER_DURATION
	_boss_timer_running = false
	EventBus.enemy_spawned.emit(definition, enemy_level, enemy_max_hp)
	EventBus.boss_fight_started.emit(definition, enemy_level, enemy_max_hp, BOSS_TIMER_DURATION)
	get_tree().create_timer(BOSS_ENTRANCE_GRACE).timeout.connect(_on_entrance_settled)


func _on_entrance_settled() -> void:
	if state == State.BOSS_FIGHT and _alive:
		_boss_timer_running = true


func _on_boss_timer_expired() -> void:
	_boss_timer_running = false
	_alive = false
	state = State.FARM_MODE
	EventBus.boss_fight_failed.emit(enemy_level)
	EventBus.enemy_withdrawn.emit()
	# Farm mode is persistent state — record it now.
	SaveManager.save_game()
	_schedule_respawn(RESPAWN_DELAY)


func _spawn_enemy_at(level: int) -> void:
	var roster: Array[EnemyDefinition] = _get_roster(level)
	if roster.is_empty():
		push_error("CombatManager: empty roster for level %d — cannot spawn." % level)
		return
	_current_definition = roster.pick_random()
	enemy_max_hp = _baseline_hp(level) * _current_definition.hp_multiplier
	enemy_hp = enemy_max_hp
	_alive = true
	EventBus.enemy_spawned.emit(_current_definition, level, enemy_max_hp)


func _baseline_hp(level: int) -> float:
	return ENEMY_BASE_HP * pow(ENEMY_HP_GROWTH, level - 1)


func _get_roster(level: int) -> Array[EnemyDefinition]:
	var world: WorldDefinition = WorldManager.get_world_for_level(level)
	var key: String = String(world.id)
	if not _roster_cache.has(key):
		var roster: Array[EnemyDefinition] = []
		for path: String in world.enemy_definition_paths:
			var definition: EnemyDefinition = load(path)
			if definition == null:
				push_error("CombatManager: could not load enemy definition: %s" % path)
				continue
			roster.append(definition)
		_roster_cache[key] = roster
	return _roster_cache[key]


# --- Internals: obstruction tracking ------------------------------------------


func _on_overlay_opened() -> void:
	_overlay_count += 1


func _on_overlay_closed() -> void:
	_overlay_count = maxi(0, _overlay_count - 1)
	# Deferred: the modal queue may present its NEXT dialog during this
	# same emission chain — checking at end of frame sees the true final
	# overlay state, so a countdown can never start under a scrim.
	_check_held_entry.call_deferred()


func _on_scene_transition_started(_scene_path: String) -> void:
	_gameplay_current = false
	# Overlays die with their scene; the count rebuilds per-scene.
	_overlay_count = 0
	if state == State.BOSS_FIGHT and _alive:
		# Leaving mid-fight voids the attempt silently; the gate
		# auto-enters fresh on return (UX spec §6).
		_alive = false
		_boss_timer_running = false
		_boss_entry_held = true


func _on_scene_transition_finished(scene_path: String) -> void:
	if scene_path == SceneManager.SCENE_GAMEPLAY:
		_gameplay_current = true
		# Deferred: pending offline/unlock modals are enqueued later in
		# this same emission (IdleManager re-emit, gameplay handler run
		# after this one). End-of-frame, their ui_overlay_opened has
		# landed and the held entry correctly stays held (review #1).
		_check_held_entry.call_deferred()


func _check_held_entry() -> void:
	if _boss_entry_held and _overlay_count == 0 and _gameplay_current:
		_boss_entry_held = false
		_enter_boss_fight()
