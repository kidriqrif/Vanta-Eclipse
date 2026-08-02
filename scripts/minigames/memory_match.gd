extends Minigame
## Memory Match — find every pair inside an attempt budget.
##
## Built as scene + .tres only: it adds nothing to the framework and overrides
## nothing but setup(). Board size and budget arrive as data through
## setup(context), timing uses child Timers (so the inherited teardown() can
## stop them), and the run ends through _finish() exactly once.
##
## Score is ATTEMPTS, and the definition sets lower_is_better — fewer is a
## better record.

const FACES: Array[Texture2D] = [
	preload("res://sprites/minigames/face_circle.svg"),
	preload("res://sprites/minigames/face_square.svg"),
	preload("res://sprites/minigames/face_triangle.svg"),
	preload("res://sprites/minigames/face_diamond.svg"),
	preload("res://sprites/minigames/face_cross.svg"),
	preload("res://sprites/minigames/face_hexagon.svg"),
]
const CARD_BACK: Texture2D = preload("res://sprites/minigames/card_back.svg")
const CARD_BG: Color = Color(0.086, 0.086, 0.098, 0.9)

## Read from the theme rather than restated here: one palette, one source.
var _ink: Color = UIPalette.ink()
const ARCADE_CORE: Color = Color(1, 0.851, 0.839, 1)

const DEFAULT_PAIRS: int = 6
const DEFAULT_BUDGET: int = 12
const COLUMNS: int = 3
## How long a mismatched pair stays visible before flipping back.
const MISMATCH_HOLD: float = 0.75
const FLIP_TIME: float = 0.12

var _pairs: int = DEFAULT_PAIRS
var _budget: int = DEFAULT_BUDGET
var _attempts: int = 0
var _matched: int = 0
## Card buttons by index, and the face id each one hides.
var _cards: Array[Button] = []
var _faces: Array[int] = []
var _matched_flags: Array[bool] = []
var _revealed: Array[int] = []
var _busy: bool = false
var _hold_timer: Timer

@onready var _status_label: Label = %StatusLabel
@onready var _attempts_label: Label = %AttemptsLabel
@onready var _grid: GridContainer = %CardGrid


## Board size and budget are data on the definition, never constants here.
func setup(context: Dictionary) -> void:
	_pairs = clampi(int(context.get("pairs", DEFAULT_PAIRS)), 2, FACES.size())
	_budget = maxi(_pairs, int(context.get("attempt_budget", DEFAULT_BUDGET)))


func _ready() -> void:
	# A child Timer, not get_tree().create_timer(): teardown() stops child
	# Timers, so a forfeit cannot leave a flip-back pending (pattern §Minigame
	# Teardown).
	_hold_timer = Timer.new()
	_hold_timer.one_shot = true
	_hold_timer.timeout.connect(_on_mismatch_hold_done)
	add_child(_hold_timer)
	_grid.columns = COLUMNS
	_build_board()
	_refresh_labels()


# --- Board --------------------------------------------------------------------


func _build_board() -> void:
	var deck: Array[int] = []
	for face: int in range(_pairs):
		deck.append(face)
		deck.append(face)
	deck.shuffle()
	_faces = deck
	for index: int in range(deck.size()):
		_matched_flags.append(false)
		var card: Button = _make_card(index)
		_cards.append(card)
		_grid.add_child(card)


func _make_card(index: int) -> Button:
	var card := Button.new()
	card.custom_minimum_size = Vector2(200, 200)
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card.size_flags_vertical = Control.SIZE_EXPAND_FILL
	card.expand_icon = true
	card.icon = CARD_BACK
	# NOT flat: Godot skips every stylebox draw on a flat Button, which would
	# silently discard the matched-card border applied later. A plain dark
	# stylebox gives the same look while keeping that channel available.
	card.add_theme_stylebox_override("normal", _card_style(false))
	card.add_theme_stylebox_override("hover", _card_style(false))
	card.add_theme_stylebox_override("pressed", _card_style(false))
	card.add_theme_stylebox_override("disabled", _card_style(false))
	card.pressed.connect(_on_card_pressed.bind(index))
	return card


func _card_style(matched: bool) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.set_corner_radius_all(14)
	if matched:
		style.bg_color = Color(0.125, 0.125, 0.141, 0.55)
		style.set_border_width_all(3)
		style.border_color = _ink
	else:
		style.bg_color = CARD_BG
		style.set_border_width_all(2)
		style.border_color = Color(0.18, 0.18, 0.204, 0.6)
	return style


func _set_card_face(index: int, face_up: bool) -> void:
	var card: Button = _cards[index]
	# Flip reads as a horizontal squash-and-swap: the icon changes at the
	# midpoint, so the card turns rather than blinking. One-shot, 0.24s total.
	card.pivot_offset = card.size * 0.5
	var tween: Tween = create_managed_tween()
	tween.tween_property(card, "scale", Vector2(0.05, 1.0), FLIP_TIME)
	tween.tween_callback(func() -> void:
		card.icon = FACES[_faces[index]] if face_up else CARD_BACK
	)
	tween.tween_property(card, "scale", Vector2.ONE, FLIP_TIME)


func _on_card_pressed(index: int) -> void:
	if _busy or _matched_flags[index] or _revealed.has(index):
		return
	_set_card_face(index, true)
	_revealed.append(index)
	if _revealed.size() < 2:
		return
	_attempts += 1
	_busy = true
	var a: int = _revealed[0]
	var b: int = _revealed[1]
	if _faces[a] == _faces[b]:
		_resolve_match(a, b)
	else:
		_status_label.text = "NO MATCH"
		_status_label.add_theme_color_override("font_color", UIPalette.muted())
		_hold_timer.start(MISMATCH_HOLD)
	_refresh_labels()


func _resolve_match(a: int, b: int) -> void:
	_matched_flags[a] = true
	_matched_flags[b] = true
	_matched += 1
	_revealed.clear()
	_busy = false
	for index: int in [a, b]:
		# Matched cards stay face-up, are disabled, and gain an accent border —
		# state carried by shape and interactivity, not colour alone.
		var style: StyleBoxFlat = _card_style(true)
		_cards[index].add_theme_stylebox_override("normal", style)
		_cards[index].add_theme_stylebox_override("disabled", style)
		# The icon must stay full-strength: Godot dims a disabled Button's icon
		# to 40%, which would make a matched pair fade out rather than lock in.
		_cards[index].add_theme_color_override("icon_disabled_color", Color.WHITE)
		_cards[index].disabled = true
	_status_label.text = "MATCH!"
	_status_label.add_theme_color_override("font_color", ARCADE_CORE)
	if _matched >= _pairs:
		_end_run(true)
	elif _attempts >= _budget:
		# The budget can also run out on a successful match that doesn't clear
		# the board — the run has to end here too, not wait for a mismatch.
		_end_run(false)


func _on_mismatch_hold_done() -> void:
	for index: int in _revealed:
		_set_card_face(index, false)
	_revealed.clear()
	_busy = false
	_status_label.text = ""
	if _attempts >= _budget:
		_end_run(false)


func _refresh_labels() -> void:
	_attempts_label.text = "Attempt %d of %d · %d of %d pairs" % [
		mini(_attempts, _budget), _budget, _matched, _pairs
	]


# --- Reporting ----------------------------------------------------------------


func _end_run(won: bool) -> void:
	_hold_timer.stop()
	for card: Button in _cards:
		card.disabled = true
	# Win: efficiency, since perfect play clears N pairs in N attempts.
	# Loss: credit the pairs actually found, so the host's LOSS_FLOOR has
	# something to scale. Reporting 0 would make the floor a no-op and pay a
	# near-miss exactly what it pays someone who found nothing.
	var performance: float = float(_pairs) / float(maxi(1, _attempts)) if won \
		else float(_matched) / float(_pairs)
	var detail: String = "%d pairs in %d attempts" % [_matched, _attempts] if won \
		else "%d of %d pairs" % [_matched, _pairs]
	_status_label.text = "CLEARED" if won else "OUT OF ATTEMPTS"
	_status_label.add_theme_color_override("font_color", ARCADE_CORE if won else UIPalette.muted())
	_finish(
		Outcome.WIN if won else Outcome.LOSS, performance, float(_attempts), detail
	)
