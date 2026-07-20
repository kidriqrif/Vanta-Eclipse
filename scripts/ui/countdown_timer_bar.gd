extends ProgressBar
## Countdown Timer Bar (pattern library §7.1 of the M5 spec).
## Self-contained: shows itself on boss_fight_started, polls
## CombatManager.get_boss_time_remaining() per frame, enters the urgency
## state in the final stretch, and hides after the fight resolves.
## The bar never owns the countdown — CombatManager does.

const URGENT_SECONDS_CAP: float = 10.0
const HIDE_DELAY: float = 0.6

## Fill styleboxes assigned in the scene file.
@export var normal_fill: StyleBoxFlat
@export var urgent_fill: StyleBoxFlat

var _urgent_threshold: float = 10.0
var _running: bool = false
var _urgent: bool = false
var _displayed_second: int = -1
var _pulse_tween: Tween

@onready var _time_label: Label = %TimeLabel


func _ready() -> void:
	visible = false
	EventBus.boss_fight_started.connect(_on_boss_fight_started)
	EventBus.boss_fight_won.connect(_on_boss_fight_won)
	EventBus.boss_fight_failed.connect(_on_boss_fight_failed)
	sync_with_combat()


func _process(_delta: float) -> void:
	if not _running:
		return
	var remaining: float = CombatManager.get_boss_time_remaining()
	value = remaining
	# Only touch the label when the displayed second changes.
	var second: int = int(ceilf(remaining))
	if second != _displayed_second:
		_displayed_second = second
		@warning_ignore("integer_division")
		_time_label.text = "%d:%02d" % [second / 60, second % 60]
	if not _urgent and remaining <= _urgent_threshold and remaining > 0.0:
		_enter_urgency()


## Re-render mid-fight state when the gameplay scene is (re)entered.
func sync_with_combat() -> void:
	if CombatManager.state == CombatManager.State.BOSS_FIGHT and CombatManager.is_enemy_alive():
		_start(CombatManager.BOSS_TIMER_DURATION)


# --- Internals ---------------------------------------------------------------


func _on_boss_fight_started(
	_definition: EnemyDefinition, _level: int, _max_hp: float, duration: float
) -> void:
	_start(duration)


func _start(duration: float) -> void:
	max_value = duration
	value = CombatManager.get_boss_time_remaining()
	_urgent_threshold = minf(URGENT_SECONDS_CAP, duration / 3.0)
	_urgent = false
	_displayed_second = -1
	_kill_pulse()
	if normal_fill != null:
		add_theme_stylebox_override("fill", normal_fill)
	modulate.a = 0.0
	visible = true
	_running = true
	create_tween().tween_property(self, "modulate:a", 1.0, 0.25)


func _enter_urgency() -> void:
	_urgent = true
	if urgent_fill != null:
		add_theme_stylebox_override("fill", urgent_fill)
	# Decorative pulse — the draining bar and the numerals carry the
	# urgency with this switched off (Enhanced tier).
	_pulse_tween = create_tween().set_loops()
	_pulse_tween.tween_property(self, "modulate:a", 0.75, 0.3) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_pulse_tween.tween_property(self, "modulate:a", 1.0, 0.3) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)


func _on_boss_fight_won(_level: int, _payout: float, _is_world_boss: bool) -> void:
	_finish()


func _on_boss_fight_failed(_level: int) -> void:
	# An expiry freezes at a true zero, never at "0:01".
	value = 0.0
	_time_label.text = "0:00"
	_finish()


func _finish() -> void:
	_running = false
	_kill_pulse()
	var tween: Tween = create_tween()
	tween.tween_interval(HIDE_DELAY)
	tween.tween_property(self, "modulate:a", 0.0, 0.25)
	tween.tween_callback(hide)


func _kill_pulse() -> void:
	if _pulse_tween != null and _pulse_tween.is_valid():
		_pulse_tween.kill()
	modulate.a = 1.0
