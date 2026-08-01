extends Node
## IdleManager — auto-attack unlock/ticking and offline progression
## (autoload).
##
## Owns, per design/ux/milestone-4-idle-offline.md §4D: the persisted
## auto_attack_unlocked flag (its own "idle" save section), the attack tick
## timer, offline-reward eligibility, the pending-popup state, and the
## app-resume hook. It never touches scenes — UI listens to EventBus and
## pulls pending state from here.

const AUTO_ATTACK_UNLOCK_LEVEL: int = 15
const AUTO_ATTACK_INTERVAL: float = 1.0

## Away periods shorter than this never trigger the offline flow —
## it exists to swallow rapid app-switching.
const MIN_OFFLINE_SECONDS: int = 60

## Longest away period that earns essence. Stated plainly in the popup
## whenever it actually reduced the reward (UX spec §6). The Long Slumber
## power extends it — see get_offline_cap_seconds().
const OFFLINE_CAP_SECONDS: int = 8 * 3600

var auto_attack_unlocked: bool = false

var _attack_timer: Timer
## Granted-but-not-yet-presented offline reward:
## {} or {"amount": float, "seconds_away": int, "was_capped": bool}
var _pending_offline_rewards: Dictionary = {}
## Guards the RESUMED notification, which some Android versions also fire
## during app startup, before the save has loaded.
var _cold_launch_check_done: bool = false


func _ready() -> void:
	# Auto-attack is live gameplay, not an offline system: a future pause
	# menu should genuinely stop it (absence is compensated by offline pay).
	process_mode = Node.PROCESS_MODE_PAUSABLE
	_attack_timer = Timer.new()
	_attack_timer.wait_time = AUTO_ATTACK_INTERVAL
	_attack_timer.timeout.connect(_on_attack_tick)
	add_child(_attack_timer)
	SaveManager.register_saveable("idle", self)
	EventBus.game_loaded.connect(_on_game_loaded)
	EventBus.scene_transition_finished.connect(_on_scene_transition_finished)
	# Twin Fang and any future cadence relic re-time the tick live.
	EventBus.active_relic_changed.connect(_on_active_relic_changed)
	# Swift Hunt quickens the same tick. get_effective_attack_interval() picks
	# the new rate up immediately (so offline pay scales at once), but a running
	# Timer keeps its old wait_time until something writes it — without this the
	# live auto-attack ignores every Swift Hunt level for the whole session.
	EventBus.skill_purchased.connect(_on_skill_purchased)
	_refresh_attack_interval()
	# Deliberately NOT connecting enemy_spawned here — see _on_game_loaded.


func _notification(what: int) -> void:
	# Android/iOS foreground-return (never fires on desktop — there the
	# game keeps running unfocused, so cold launch is the only offline
	# path, by design).
	if what == NOTIFICATION_APPLICATION_RESUMED and _cold_launch_check_done:
		_check_offline_rewards()


# --- Save contract (called by SaveManager) ------------------------------------


func get_save_data() -> Dictionary:
	return {"auto_attack_unlocked": auto_attack_unlocked}


func load_save_data(data: Dictionary) -> void:
	auto_attack_unlocked = bool(data.get("auto_attack_unlocked", false))


# --- Public API --------------------------------------------------------------


func has_pending_offline_rewards() -> bool:
	return not _pending_offline_rewards.is_empty()


## Hand the pending reward presentation to the UI exactly once.
## The essence itself was already granted at eligibility time.
func consume_pending_offline_rewards() -> Dictionary:
	var pending: Dictionary = _pending_offline_rewards
	_pending_offline_rewards = {}
	return pending


## Effective seconds between auto-attacks after cadence relics (Twin Fang).
## The single source both the live timer and the offline math read, so a
## faster-auto-attack relic doubles offline earning exactly as it does live.
func get_effective_attack_interval() -> float:
	# Twin Fang (relic) and Swift Hunt (Ascendant Power) both quicken the tick;
	# they multiply, and offline pay reads the same interval so it scales too.
	var speed: float = RelicManager.get_attack_speed_mult() \
		* SkillTreeManager.get_attack_speed_mult()
	return AUTO_ATTACK_INTERVAL / maxf(0.0001, speed)


## Away-time cap, extended by the Long Slumber power (Milestone 8).
func get_offline_cap_seconds() -> int:
	var bonus_hours: int = int(SkillTreeManager.get_stat_additive(&"offline_cap_hours"))
	return OFFLINE_CAP_SECONDS + bonus_hours * 3600


## Essence per second the auto-attacker earns at current stats, before the
## offline multiplier is applied. Rewards across the game are priced in
## SECONDS of this rate, so they never go stale as the player grows.
func get_live_essence_rate() -> float:
	# Priced at the EFFECTIVE kill level: at a boss wall the auto-attacker
	# is really killing gate-1 enemies, and offline pay must mirror that
	# honestly (UX spec milestone-5 §6). The interval is the effective one,
	# so Twin Fang's doubled cadence flows into offline pay (milestone-7 §6).
	var level: int = CombatManager.get_effective_kill_level()
	var seconds_per_kill: float = CombatManager.get_expected_seconds_per_kill(
		level, get_effective_attack_interval()
	)
	var essence_per_kill: float = CombatManager.get_essence_reward(level)
	return essence_per_kill / maxf(0.0001, seconds_per_kill)


## Re-base auto-attack on an Eclipse (Milestone 8): a new run re-earns the
## level-15 unlock, UNLESS the Eternal Reflex power keeps it on from the start.
## Pending offline state is dropped with the reset. PrestigeManager only.
func reset_for_prestige() -> void:
	auto_attack_unlocked = SkillTreeManager.has_flag(&"auto_attack_start")
	_pending_offline_rewards = {}
	if auto_attack_unlocked:
		_attack_timer.start()
	else:
		_attack_timer.stop()
	_refresh_attack_interval()


func _refresh_attack_interval() -> void:
	# A running repeating Timer adopts the new wait_time on its NEXT cycle —
	# no start() (that would reset the current countdown).
	if _attack_timer != null:
		_attack_timer.wait_time = get_effective_attack_interval()


func _on_active_relic_changed(_id: StringName) -> void:
	_refresh_attack_interval()


func _on_skill_purchased(_id: StringName, _new_level: int) -> void:
	# Cheap enough to run for every power: only Swift Hunt moves the interval,
	# and _refresh_attack_interval() is an idempotent write.
	_refresh_attack_interval()


# --- Internals ---------------------------------------------------------------


func _on_game_loaded(is_new_game: bool) -> void:
	# A save already past the threshold unlocks silently — the celebration
	# only ever plays on a live crossing (UX spec §2A). This also silently
	# migrates pre-Milestone-4 saves, which have no "idle" section at all.
	# Design intent: a migrated save IS paid offline rewards for this very
	# launch — "your hero fought while you were away" is the update's own
	# welcome gift, and it can only happen once.
	if not auto_attack_unlocked and CombatManager.enemy_level >= AUTO_ATTACK_UNLOCK_LEVEL:
		auto_attack_unlocked = true
	if auto_attack_unlocked:
		_attack_timer.start()
	# RelicManager's save is loaded by now, so the cadence is correct.
	_refresh_attack_interval()
	# Connected only now: CombatManager's load-time enemy_spawned fires
	# earlier in the game_loaded connection list, so the first spawn this
	# handler sees is a genuine live one. Reordering the autoload list or
	# moving this connect() silently breaks the no-celebration-on-load rule.
	EventBus.enemy_spawned.connect(_on_enemy_spawned)
	if not is_new_game:
		_check_offline_rewards()
	_cold_launch_check_done = true


func _on_scene_transition_finished(scene_path: String) -> void:
	# Deferred-presentation path (UX spec §2B): a reward granted while no
	# gameplay screen was there to show it is re-announced the moment the
	# gameplay scene finishes fading in.
	if scene_path == SceneManager.SCENE_GAMEPLAY and has_pending_offline_rewards():
		EventBus.offline_rewards_ready.emit(
			_pending_offline_rewards["amount"],
			_pending_offline_rewards["seconds_away"],
			_pending_offline_rewards["was_capped"],
		)


func _on_enemy_spawned(_definition: EnemyDefinition, level: int, _max_hp: float) -> void:
	if auto_attack_unlocked or level < AUTO_ATTACK_UNLOCK_LEVEL:
		return
	auto_attack_unlocked = true
	_attack_timer.start()
	EventBus.auto_attack_unlocked.emit()
	# Persist immediately so a crash can't replay the celebration.
	# (Haptics for this moment live in the UI layer, with the other calls.)
	SaveManager.save_game()


func _on_attack_tick() -> void:
	if auto_attack_unlocked and CombatManager.is_enemy_alive():
		CombatManager.auto_attack()


func _check_offline_rewards() -> void:
	if not auto_attack_unlocked:
		return
	var last_save: int = SaveManager.last_save_unix
	if last_save <= 0:
		return
	# Wall-clock time (user-adjustable): clamp so a backwards-set clock can
	# never go negative. Clock-forward cheating is bounded by the cap.
	var elapsed: int = maxi(0, int(Time.get_unix_time_from_system()) - last_save)
	if elapsed < MIN_OFFLINE_SECONDS:
		return
	var cap_seconds: int = get_offline_cap_seconds()
	var was_capped: bool = elapsed > cap_seconds
	var rewarded_seconds: int = mini(elapsed, cap_seconds)
	var amount: float = floor(
		get_live_essence_rate() * rewarded_seconds * PlayerStats.get_offline_multiplier()
	)
	if amount < 1.0:
		return
	CurrencyManager.add(CurrencyManager.ESSENCE, amount)
	EventBus.essence_earned.emit(amount, &"offline")
	# Hand PetManager the same capped kill estimate (never re-derived, never
	# on the deferred re-emit) so offline pet XP stays consistent (M7 §6).
	var seconds_per_kill: float = CombatManager.get_expected_seconds_per_kill(
		CombatManager.get_effective_kill_level(), get_effective_attack_interval()
	)
	var kills: int = int(floor(rewarded_seconds / maxf(0.0001, seconds_per_kill)))
	if kills > 0:
		EventBus.offline_kills_estimated.emit(kills)
	# Advance last_save_unix right away so a crash after the grant cannot
	# re-run the same eligibility window and double-grant (UX spec §4C).
	SaveManager.save_game()
	_pending_offline_rewards = {
		"amount": amount,
		"seconds_away": elapsed,
		"was_capped": was_capped,
	}
	EventBus.offline_rewards_ready.emit(amount, elapsed, was_capped)
