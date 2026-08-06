extends Minigame
## Lights Out — a 4x4 grid where every tap flips a plus-shape. Clear the board.
##
## The board is scrambled by PLAYING it, never by randomising cells directly:
## a random 4x4 arrangement is only solvable about one time in sixteen, and a
## player cannot tell an unsolvable board from a hard one. Scrambling with real
## taps from the solved state guarantees a solution exists and puts a ceiling on
## how long it is.

const SIZE: int = 4
## Taps used to scramble. Also the par the score is measured against, since a
## board built in N taps is always solvable in at most N.
const SCRAMBLE_TAPS: int = 6
## Slack over par before a run is a loss. Generous: this is a puzzle, and the
## payout already scales with efficiency.
const MOVE_LIMIT: int = 24

var _lit: Array[bool] = []
var _buttons: Array[Button] = []
var _moves: int = 0

@onready var _moves_label: Label = %MovesLabel
@onready var _grid: GridContainer = %Grid
@onready var _state_label: Label = %StateLabel


func _ready() -> void:
	_grid.columns = SIZE
	_lit.resize(SIZE * SIZE)
	_build_board()
	_scramble()
	_redraw()


func _build_board() -> void:
	for index: int in SIZE * SIZE:
		var cell := Button.new()
		cell.custom_minimum_size = Vector2(110, 110)
		cell.focus_mode = Control.FOCUS_NONE
		cell.pressed.connect(_on_cell_pressed.bind(index))
		_grid.add_child(cell)
		_buttons.append(cell)


func _scramble() -> void:
	# A scramble that happens to solve the board would hand the player a win
	# before they touched it, so keep going until at least one pane is lit.
	while not _lit.has(true):
		for _i: int in SCRAMBLE_TAPS:
			_toggle_plus(randi() % (SIZE * SIZE))


func _toggle_plus(index: int) -> void:
	var row: int = index / SIZE
	var column: int = index % SIZE
	for offset: Vector2i in [
		Vector2i(0, 0), Vector2i(1, 0), Vector2i(-1, 0),
		Vector2i(0, 1), Vector2i(0, -1),
	]:
		var r: int = row + offset.y
		var c: int = column + offset.x
		if r < 0 or r >= SIZE or c < 0 or c >= SIZE:
			continue
		var target: int = r * SIZE + c
		_lit[target] = not _lit[target]


func _on_cell_pressed(index: int) -> void:
	_moves += 1
	_toggle_plus(index)
	_redraw()
	if not _lit.has(true):
		_end_run(true)
	elif _moves >= MOVE_LIMIT:
		_end_run(false)


func _redraw() -> void:
	for index: int in _buttons.size():
		var style := StyleBoxFlat.new()
		# Lit and dark differ in FILL and BORDER, not hue alone, so the board
		# stays readable without colour (UX §7).
		style.bg_color = UIPalette.accent() if _lit[index] else UIPalette.surface()
		style.border_color = UIPalette.ink() if _lit[index] else UIPalette.line()
		style.set_border_width_all(4 if _lit[index] else 2)
		for state: String in ["normal", "hover", "pressed", "focus"]:
			_buttons[index].add_theme_stylebox_override(state, style)
	var remaining: int = _lit.count(true)
	_moves_label.text = "Moves %d of %d · %d lit" % [_moves, MOVE_LIMIT, remaining]


func _end_run(won: bool) -> void:
	for cell: Button in _buttons:
		cell.disabled = true
	# Par is the scramble length; finishing at or under it is a perfect score,
	# and it decays from there rather than stepping, so one extra tap costs a
	# little instead of a grade.
	var performance: float = 0.0
	if won:
		performance = clampf(
			float(SCRAMBLE_TAPS) / float(maxi(_moves, SCRAMBLE_TAPS)), 0.0, 1.0
		)
	_state_label.text = "CLEARED" if won else "OUT OF MOVES"
	_state_label.add_theme_color_override(
		"font_color", UIPalette.ink() if won else UIPalette.muted()
	)
	_finish(
		Outcome.WIN if won else Outcome.LOSS,
		performance,
		float(maxi(0, MOVE_LIMIT - _moves)),
		"%d moves" % _moves,
	)
