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
## A flare that is never tapped auto-misses, so an interrupted run always ends
## instead of waiting forever for a tap that isn't coming.
const FLARE_WINDOW: float = 2.5
const ROUND_GAP: float = 0.45
const FLARE_TWEEN: float = 0.15

const ARCADE_CORE: Color = UIPalette.ink()

## Read from the theme rather than restated here: one palette, one source.
var _ink: Color = UIPalette.ink()
var _round: int = 0
var _hits: int = 0
var _score_sum: float = 0.0
var _reaction_sum: float = 0.0
var _flared: bool = false
var _flare_at_msec: int = 0
var _flare_tween: Tween
## All three are child Timers, never SceneTree timers: teardown() stops child
## Timers, so a forfeited run goes quiet instead of playing on under the banner.
var _wait_timer: Timer
var _window_timer: Timer
var _gap_timer: Timer

@onready var _round_label: Label = %RoundLabel
@onready var _sigil_button: Button = %SigilButton
@onready var _sigil_icon: TextureRect = %SigilIcon
@onready var _sigil_ring: Panel = %SigilRing
@onready var _state_label: Label = %StateLabel
@onready var _result_label: Label = %ResultLabel


func _ready() -> void:
	_wait_timer = _make_timer(_on_flare)
	_window_timer = _make_timer(_on_flare_expired)
	_gap_timer = _make_timer(_start_round)
	# Fire on press, not release: billing a slow finger-lift as reaction time
	# would penalise players with motor impairments for no design reason.
	_sigil_button.action_mode = BaseButton.ACTION_MODE_BUTTON_PRESS
	_sigil_button.pressed.connect(_on_sigil_pressed)
	_style_ring()
	_start_round()


func _make_timer(handler: Callable) -> Timer:
	var timer := Timer.new()
	timer.one_shot = true
	timer.timeout.connect(handler)
	add_child(timer)
	return timer


func _style_ring() -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = Color.TRANSPARENT
	style.set_border_width_all(10)
	style.border_color = ARCADE_CORE
	_sigil_ring.add_theme_stylebox_override("panel", style)
	_sigil_ring.visible = false


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
	# At rest the sigil is small, dim, ringless, and says WAIT. The flare
	# differs by SIZE, SHAPE (the ring) and WORD, so the state is fully
	# readable with no colour at all (UX §7).
	if _flare_tween != null and _flare_tween.is_valid():
		# Kill it first: a tap inside the tween's window would otherwise let it
		# keep animating and leave the sigil enlarged while reading "WAIT".
		_flare_tween.kill()
	_sigil_icon.modulate = Color(0.941, 0.941, 0.965, 0.45)
	_sigil_icon.scale = Vector2.ONE
	_sigil_ring.visible = false
	_state_label.text = "WAIT"
	_state_label.add_theme_color_override("font_color", UIPalette.muted())


func _on_flare() -> void:
	_flared = true
	_flare_at_msec = Time.get_ticks_msec()
	_sigil_icon.modulate = UIPalette.ink()
	_sigil_icon.pivot_offset = _sigil_icon.size * 0.5
	_sigil_ring.visible = true
	_state_label.text = "TAP!"
	_state_label.add_theme_color_override("font_color", _ink)
	if _flare_tween != null and _flare_tween.is_valid():
		_flare_tween.kill()
	_flare_tween = create_managed_tween()
	_flare_tween.tween_property(_sigil_icon, "scale", Vector2(1.25, 1.25), FLARE_TWEEN) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_window_timer.start(FLARE_WINDOW)


## The flare timed out unanswered — score the round a miss and move on.
func _on_flare_expired() -> void:
	if not _flared:
		return
	_result_label.text = "Missed"
	_result_label.add_theme_color_override("font_color", UIPalette.muted())
	_next_round()


func _on_sigil_pressed() -> void:
	if _wait_timer.is_stopped() and not _flared:
		return  # between rounds — ignore stray taps
	if not _flared:
		# Jumped the gun: this round is a miss, but the run continues.
		_wait_timer.stop()
		_result_label.text = "Too early!"
		_result_label.add_theme_color_override("font_color", UIPalette.muted())
		_next_round()
		return
	_window_timer.stop()
	var reaction: float = float(Time.get_ticks_msec() - _flare_at_msec) / 1000.0
	_hits += 1
	_reaction_sum += reaction
	_score_sum += _normalize_reaction(reaction)
	_result_label.text = "%d ms" % int(reaction * 1000.0)
	_result_label.add_theme_color_override("font_color", ARCADE_CORE)
	_next_round()


func _next_round() -> void:
	_flared = false
	_window_timer.stop()
	_set_resting()
	_gap_timer.start(ROUND_GAP)


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
	_state_label.add_theme_color_override("font_color", ARCADE_CORE if won else UIPalette.muted())
	_finish(
		Outcome.WIN if won else Outcome.LOSS, performance, float(_hits), detail
	)
