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
## whenever it actually reduced the reward (UX spec §6).
## TODO(Milestone 8): prestige upgrades extend this cap.
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


## Essence per second the auto-attacker earns at current stats,
## before the offline multiplier is applied.
func get_live_essence_rate() -> float:
	var seconds_per_kill: float = CombatManager.get_expected_seconds_per_kill(
		CombatManager.enemy_level, AUTO_ATTACK_INTERVAL
	)
	var essence_per_kill: float = CombatManager.get_essence_reward(CombatManager.enemy_level)
	return essence_per_kill / maxf(0.0001, seconds_per_kill)


# --- Internals ---------------------------------------------------------------


func _on_game_loaded(is_new_game: bool) -> void:
	# A save already past the threshold unlocks silently — the celebration
	# only ever plays on a live crossing (UX spec §2A). This also silently
	# migrates pre-Milestone-4 saves, which have no "idle" section at all.
	if not auto_attack_unlocked and CombatManager.enemy_level >= AUTO_ATTACK_UNLOCK_LEVEL:
		auto_attack_unlocked = true
	if auto_attack_unlocked:
		_attack_timer.start()
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
	var was_capped: bool = elapsed > OFFLINE_CAP_SECONDS
	var rewarded_seconds: int = mini(elapsed, OFFLINE_CAP_SECONDS)
	var amount: float = floor(
		get_live_essence_rate() * rewarded_seconds * PlayerStats.get_offline_multiplier()
	)
	if amount < 1.0:
		return
	CurrencyManager.add(CurrencyManager.ESSENCE, amount)
	EventBus.essence_earned.emit(amount, &"offline")
	# Advance last_save_unix right away so a crash after the grant cannot
	# re-run the same eligibility window and double-grant (UX spec §4C).
	SaveManager.save_game()
	_pending_offline_rewards = {
		"amount": amount,
		"seconds_away": elapsed,
		"was_capped": was_capped,
	}
	EventBus.offline_rewards_ready.emit(amount, elapsed, was_capped)
