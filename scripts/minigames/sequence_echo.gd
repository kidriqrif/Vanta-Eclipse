extends Minigame
## Sequence Echo — four runes call a growing pattern; echo it back.
##
## The sequence GROWS rather than being redrawn each round: appending one step
## means the player's memory of the previous round still counts, which is the
## whole appeal. Regenerating it every round would make each round independent
## and turn a memory game into five reaction tests.

const RUNES: int = 4
## Echoing a sequence this long wins the run. Reached in four correct rounds
## from a start of two.
const WIN_LENGTH: int = 6
const START_LENGTH: int = 2
const LIT_SECONDS: float = 0.42
const GAP_SECONDS: float = 0.2
const ROUND_PAUSE: float = 0.6

var _sequence: Array[int] = []
var _position: int = 0
var _playing: bool = true
var _playback_index: int = 0
var _rounds_cleared: int = 0
var _buttons: Array[Button] = []
## Child Timers, not SceneTree timers: teardown() stops these, so a forfeited
## run stops flashing instead of playing on under the result banner.
var _lit_timer: Timer
var _gap_timer: Timer

@onready var _round_label: Label = %RoundLabel
@onready var _grid: GridContainer = %Grid
@onready var _state_label: Label = %StateLabel


func _ready() -> void:
	_grid.columns = 2
	_lit_timer = _make_timer(_on_lit_elapsed)
	_gap_timer = _make_timer(_on_gap_elapsed)
	_build_runes()
	for _i: int in START_LENGTH:
		_sequence.append(randi() % RUNES)
	_start_playback()


func _make_timer(handler: Callable) -> Timer:
	var timer := Timer.new()
	timer.one_shot = true
	timer.timeout.connect(handler)
	add_child(timer)
	return timer


func _build_runes() -> void:
	for index: int in RUNES:
		var rune := Button.new()
		rune.custom_minimum_size = Vector2(200, 200)
		rune.focus_mode = Control.FOCUS_NONE
		rune.text = ["I", "II", "III", "IV"][index]
		rune.add_theme_font_size_override("font_size", 36)
		rune.pressed.connect(_on_rune_pressed.bind(index))
		_grid.add_child(rune)
		_buttons.append(rune)
		_set_rune_lit(index, false)


## Lit and dark differ by FILL and BORDER WIDTH as well as colour, so the
## pattern is followable without relying on hue.
func _set_rune_lit(index: int, lit: bool) -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = UIPalette.accent() if lit else UIPalette.surface()
	style.border_color = UIPalette.ink() if lit else UIPalette.line()
	style.set_border_width_all(6 if lit else 2)
	for state: String in ["normal", "hover", "pressed", "focus"]:
		_buttons[index].add_theme_stylebox_override(state, style)


# --- Playback ----------------------------------------------------------------


func _start_playback() -> void:
	_playing = true
	_position = 0
	_playback_index = 0
	_round_label.text = "Pattern of %d" % _sequence.size()
	_state_label.text = "WATCH"
	_state_label.add_theme_color_override("font_color", UIPalette.muted())
	_gap_timer.start(ROUND_PAUSE)


func _on_gap_elapsed() -> void:
	if _playback_index >= _sequence.size():
		_begin_echo()
		return
	_set_rune_lit(_sequence[_playback_index], true)
	_lit_timer.start(LIT_SECONDS)


func _on_lit_elapsed() -> void:
	_set_rune_lit(_sequence[_playback_index], false)
	_playback_index += 1
	_gap_timer.start(GAP_SECONDS)


func _begin_echo() -> void:
	_playing = false
	_state_label.text = "ECHO"
	_state_label.add_theme_color_override("font_color", UIPalette.ink())


# --- Input -------------------------------------------------------------------


func _on_rune_pressed(index: int) -> void:
	if _playing:
		return  # taps during playback are ignored, not penalised
	if index != _sequence[_position]:
		_end_run(false)
		return
	_position += 1
	if _position < _sequence.size():
		return
	_rounds_cleared += 1
	if _sequence.size() >= WIN_LENGTH:
		_end_run(true)
		return
	_sequence.append(randi() % RUNES)
	_start_playback()


func _end_run(won: bool) -> void:
	_lit_timer.stop()
	_gap_timer.stop()
	for rune: Button in _buttons:
		rune.disabled = true
	# Progress toward the win length, so a run that died one rune short still
	# pays most of the way. A loss on the first round pays nothing.
	var reached: int = _sequence.size() if won else _sequence.size() - 1
	var performance: float = clampf(
		float(reached - START_LENGTH + 1) / float(WIN_LENGTH - START_LENGTH + 1),
		0.0, 1.0
	)
	_state_label.text = "ECHOED" if won else "BROKEN"
	_state_label.add_theme_color_override(
		"font_color", UIPalette.ink() if won else UIPalette.muted()
	)
	_finish(
		Outcome.WIN if won else Outcome.LOSS,
		performance,
		float(_rounds_cleared),
		"pattern of %d" % reached,
	)
