extends Minigame
## Void Reflex — the reference minigame that proves the framework contract.
##
## Five rounds. Each round the sigil waits a random 0.8-2.2s, then flares; the
## player taps. Tapping after the flare scores by reaction time, tapping before
## it misses that round. Win at 3+ hits. Nothing ends the run early and a loss
## still pays, so the game is a pleasant 15 seconds either way.

const ROUNDS: int = 5
const WIN_HITS: int = 3
const WAIT_MIN: float = 0.8
const WAIT_MAX: float = 2.2
## Reaction scoring window: <=250ms scores 1.0, >=900ms scores 0.0.
const REACTION_BEST: float = 0.25
const REACTION_WORST: float = 0.9

const ARCADE: Color = Color(0.65, 0.93, 0.42, 1)
const ARCADE_CORE: Color = Color(0.83, 0.98, 0.7, 1)
const MUTED: Color = Color(0.62, 0.57, 0.75, 1)

var _round: int = 0
var _hits: int = 0
var _score_sum: float = 0.0
var _reaction_sum: float = 0.0
var _flared: bool = false
var _flare_at_msec: int = 0
var _wait_timer: Timer

@onready var _round_label: Label = %RoundLabel
@onready var _sigil_button: Button = %SigilButton
@onready var _sigil_icon: TextureRect = %SigilIcon
@onready var _state_label: Label = %StateLabel
@onready var _result_label: Label = %ResultLabel


func _ready() -> void:
	_wait_timer = Timer.new()
	_wait_timer.one_shot = true
	_wait_timer.timeout.connect(_on_flare)
	add_child(_wait_timer)
	_sigil_button.pressed.connect(_on_sigil_pressed)
	_start_round()


# --- Round flow ---------------------------------------------------------------


func _start_round() -> void:
	_round += 1
	if _round > ROUNDS:
		_end_run()
		return
	_flared = false
	_round_label.text = "Round %d of %d" % [_round, ROUNDS]
	_set_resting()
	_wait_timer.start(randf_range(WAIT_MIN, WAIT_MAX))


func _set_resting() -> void:
	# At rest the sigil is small, dim, and says WAIT — the flare differs by
	# size, brightness AND word, so it never depends on colour (UX §7).
	_sigil_icon.modulate = Color(1, 1, 1, 0.45)
	_sigil_icon.scale = Vector2.ONE
	_state_label.text = "WAIT"
	_state_label.add_theme_color_override("font_color", MUTED)


func _on_flare() -> void:
	_flared = true
	_flare_at_msec = Time.get_ticks_msec()
	_sigil_icon.modulate = Color(1, 1, 1, 1)
	_sigil_icon.pivot_offset = _sigil_icon.size * 0.5
	_state_label.text = "TAP!"
	_state_label.add_theme_color_override("font_color", ARCADE)
	var tween: Tween = create_tween()
	tween.tween_property(_sigil_icon, "scale", Vector2(1.25, 1.25), 0.12) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func _on_sigil_pressed() -> void:
	if _wait_timer.is_stopped() and not _flared:
		return  # between rounds — ignore stray taps
	if not _flared:
		# Jumped the gun: this round is a miss, but the run continues.
		_wait_timer.stop()
		_result_label.text = "Too early!"
		_result_label.add_theme_color_override("font_color", MUTED)
		_next_round()
		return
	var reaction: float = float(Time.get_ticks_msec() - _flare_at_msec) / 1000.0
	_hits += 1
	_reaction_sum += reaction
	_score_sum += _normalize_reaction(reaction)
	_result_label.text = "%d ms" % int(reaction * 1000.0)
	_result_label.add_theme_color_override("font_color", ARCADE_CORE)
	_next_round()


func _next_round() -> void:
	_flared = false
	_set_resting()
	get_tree().create_timer(0.45).timeout.connect(_start_round)


func _normalize_reaction(reaction: float) -> float:
	var span: float = REACTION_WORST - REACTION_BEST
	return clampf((REACTION_WORST - reaction) / span, 0.0, 1.0)


# --- Reporting ----------------------------------------------------------------


func _end_run() -> void:
	_wait_timer.stop()
	_sigil_button.disabled = true
	var won: bool = _hits >= WIN_HITS
	var performance: float = _score_sum / float(_hits) if _hits > 0 else 0.0
	var detail: String = "%d of %d" % [_hits, ROUNDS]
	if _hits > 0:
		detail += " · avg %dms" % int((_reaction_sum / float(_hits)) * 1000.0)
	_state_label.text = "COMPLETE"
	_state_label.add_theme_color_override("font_color", ARCADE_CORE if won else MUTED)
	_finish(
		Outcome.WIN if won else Outcome.LOSS, performance, float(_hits), detail
	)
