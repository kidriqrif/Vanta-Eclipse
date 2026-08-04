extends Minigame
## Connect Four — four in a row against an AI opponent.
##
## Scene + .tres only. The AI's think-delay is a child Timer and the drop uses
## create_managed_tween(), so the inherited teardown() stops both: forfeit
## mid-drop and the board goes quiet instead of playing on under the banner.
##
## Score is MOVES TO WIN with lower_is_better — a faster win is a better record.

const DISC_PLAYER: Texture2D = preload("res://sprites/minigames/disc_player.png")
const DISC_AI: Texture2D = preload("res://sprites/minigames/disc_ai.png")
const CELL_EMPTY: Texture2D = preload("res://sprites/minigames/cell_empty.png")

const BOARD_BG: Color = Color(0.078, 0.078, 0.11, 0.9)

const EMPTY: int = 0
const PLAYER: int = 1
const AI: int = 2
const CONNECT: int = 4

const DEFAULT_COLUMNS: int = 7
const DEFAULT_ROWS: int = 6
## How long the AI "thinks" before dropping, so its turn is legible.
const AI_THINK: float = 0.55
const DROP_TIME: float = 0.22
## The column stylebox's left+right content margins, subtracted when sizing a
## cell so it stays square inside its column.
const CELL_INSET: float = 12.0
## Chance the AI plays a loose move INSTEAD OF its strategic one. It still
## always takes a win and always blocks; this only relaxes the positional play,
## which is the dial that makes it beatable without making it look broken.
const AI_BLUNDER_CHANCE: float = 0.6

## Read from the theme rather than restated here: one palette, one source.
var _ink: Color = UIPalette.ink()
var _columns: int = DEFAULT_COLUMNS
var _rows: int = DEFAULT_ROWS
var _blunder: float = AI_BLUNDER_CHANCE
## Board cells, row 0 = top. index = row * _columns + column.
var _board: Array[int] = []
var _cells: Array[TextureRect] = []
var _column_buttons: Array[Button] = []
var _player_moves: int = 0
var _busy: bool = false
var _think_timer: Timer

@onready var _status_label: Label = %StatusLabel
@onready var _board_row: HBoxContainer = %BoardRow


## Board shape and AI difficulty are data on the definition.
func setup(context: Dictionary) -> void:
	# Ceiling of 7: at the 120px column minimum, more than seven columns cannot
	# fit the 1000px body and the HBox would push them off-screen.
	_columns = clampi(int(context.get("columns", DEFAULT_COLUMNS)), 4, 7)
	_rows = clampi(int(context.get("rows", DEFAULT_ROWS)), 4, 8)
	_blunder = clampf(float(context.get("ai_blunder", AI_BLUNDER_CHANCE)), 0.0, 1.0)


func _ready() -> void:
	# Child Timer, not a SceneTree timer: teardown() must be able to stop the
	# AI mid-think (pattern §Minigame Teardown).
	_think_timer = Timer.new()
	_think_timer.one_shot = true
	_think_timer.timeout.connect(_on_ai_think_done)
	add_child(_think_timer)
	_board.resize(_columns * _rows)
	_board.fill(EMPTY)
	_build_board()
	_board_row.resized.connect(_fit_cells)
	_fit_cells()
	_set_status("YOUR TURN", _ink)


## Keep cells square. The columns share the width evenly but the row is free to
## grow tall, so without this a cell is ~136 wide by ~262 high: the disc draws
## at its width and leaves a gap above and below, and a vertical four stops
## reading as connected.
func _fit_cells() -> void:
	if _column_buttons.is_empty():
		return
	var side: float = maxf(96.0, _column_buttons[0].size.x - CELL_INSET)
	for cell: TextureRect in _cells:
		cell.custom_minimum_size = Vector2(0, side)


# --- Board ---------------------------------------------------------------------


func _build_board() -> void:
	for column: int in range(_columns):
		# The whole column is the touch target: a full-height strip is far
		# easier to hit than an individual cell.
		var button := Button.new()
		button.custom_minimum_size = Vector2(120, 0)
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.size_flags_vertical = Control.SIZE_EXPAND_FILL
		# Distinct styleboxes per state: a full column must not look identical
		# to a playable one, and a tap needs press feedback.
		button.add_theme_stylebox_override("normal", _column_style(false, false))
		button.add_theme_stylebox_override("hover", _column_style(true, false))
		button.add_theme_stylebox_override("pressed", _column_style(true, false))
		button.add_theme_stylebox_override("disabled", _column_style(false, true))
		button.pressed.connect(_on_column_pressed.bind(column))
		_board_row.add_child(button)
		_column_buttons.append(button)

		var stack := VBoxContainer.new()
		stack.add_theme_constant_override("separation", 8)
		stack.alignment = BoxContainer.ALIGNMENT_CENTER
		stack.mouse_filter = Control.MOUSE_FILTER_IGNORE
		stack.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		button.add_child(stack)
		for row: int in range(_rows):
			var cell := TextureRect.new()
			cell.texture = CELL_EMPTY
			cell.custom_minimum_size = Vector2(0, 96)
			cell.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			cell.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			cell.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			cell.mouse_filter = Control.MOUSE_FILTER_IGNORE
			stack.add_child(cell)
			_cells.append(cell)  # appended column-major; _cell_at() re-maps


func _column_style(lit: bool, full: bool) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.set_content_margin_all(6)
	style.bg_color = BOARD_BG
	style.set_border_width_all(2)
	if full:
		# A full column reads as closed: dimmer ground, no accent edge.
		style.bg_color = Color(BOARD_BG.r, BOARD_BG.g, BOARD_BG.b, BOARD_BG.a * 0.5)
		style.border_color = Color(0.141, 0.141, 0.184, 0.5)
	elif lit:
		style.border_color = _ink
	else:
		style.border_color = Color(_ink.r, _ink.g, _ink.b, 0.35)
	return style


## Cells are built column-major but addressed row-major.
func _cell_at(row: int, column: int) -> TextureRect:
	return _cells[column * _rows + row]


func _at(row: int, column: int) -> int:
	return _board[row * _columns + column]


func _set_at(row: int, column: int, value: int) -> void:
	_board[row * _columns + column] = value


## Lowest empty row in a column, or -1 when the column is full.
func _landing_row(column: int) -> int:
	for row: int in range(_rows - 1, -1, -1):
		if _at(row, column) == EMPTY:
			return row
	return -1


func _valid_columns() -> Array[int]:
	var valid: Array[int] = []
	for column: int in range(_columns):
		if _landing_row(column) >= 0:
			valid.append(column)
	return valid


# --- Turns ---------------------------------------------------------------------


func _on_column_pressed(column: int) -> void:
	if _busy:
		return
	var row: int = _landing_row(column)
	if row < 0:
		return  # full column — the disabled state below normally prevents this
	_busy = true
	_player_moves += 1
	_place(row, column, PLAYER)
	if _check_win(row, column, PLAYER):
		_end_run(true, "won in %d moves" % _player_moves)
		return
	if _valid_columns().is_empty():
		_end_draw()
		return
	_set_status("OPPONENT THINKING", UIPalette.muted())
	_refresh_columns()
	_think_timer.start(AI_THINK)


func _on_ai_think_done() -> void:
	var column: int = _ai_choose_column()
	if column < 0:
		_end_draw()
		return
	var row: int = _landing_row(column)
	_place(row, column, AI)
	if _check_win(row, column, AI):
		_end_run(false, "opponent connected four")
		return
	if _valid_columns().is_empty():
		_end_draw()
		return
	_busy = false
	_set_status("YOUR TURN", _ink)
	_refresh_columns()


func _place(row: int, column: int, who: int) -> void:
	_set_at(row, column, who)
	var cell: TextureRect = _cell_at(row, column)
	cell.texture = DISC_PLAYER if who == PLAYER else DISC_AI
	# The disc drops in: managed so a forfeit mid-animation stops it.
	cell.pivot_offset = cell.size * 0.5
	cell.scale = Vector2(0.4, 0.4)
	var tween: Tween = create_managed_tween()
	tween.tween_property(cell, "scale", Vector2.ONE, DROP_TIME) \
		.set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)


func _refresh_columns() -> void:
	for column: int in range(_columns):
		_column_buttons[column].disabled = _busy or _landing_row(column) < 0


func _set_status(text: String, color: Color) -> void:
	_status_label.text = text
	_status_label.add_theme_color_override("font_color", color)


# --- Win detection --------------------------------------------------------------


## Does the disc just placed at (row, column) complete a line for `who`?
func _check_win(row: int, column: int, who: int) -> bool:
	for direction: Vector2i in [
		Vector2i(0, 1), Vector2i(1, 0), Vector2i(1, 1), Vector2i(1, -1)
	]:
		var run: int = 1
		run += _run_length(row, column, direction.x, direction.y, who)
		run += _run_length(row, column, -direction.x, -direction.y, who)
		if run >= CONNECT:
			return true
	return false


func _run_length(row: int, column: int, d_row: int, d_col: int, who: int) -> int:
	var count: int = 0
	var r: int = row + d_row
	var c: int = column + d_col
	while r >= 0 and r < _rows and c >= 0 and c < _columns and _at(r, c) == who:
		count += 1
		r += d_row
		c += d_col
	return count


## Longest line the player achieved — used to credit a loss honestly.
func _longest_run(who: int) -> int:
	var best: int = 0
	for row: int in range(_rows):
		for column: int in range(_columns):
			if _at(row, column) != who:
				continue
			for direction: Vector2i in [
				Vector2i(0, 1), Vector2i(1, 0), Vector2i(1, 1), Vector2i(1, -1)
			]:
				var run: int = 1 + _run_length(row, column, direction.x, direction.y, who)
				best = maxi(best, run)
	return best


# --- AI -------------------------------------------------------------------------


## Win, else block, else avoid handing over a win, else favour the centre.
##
## The opponent NEVER misses a win or a block — an AI that overlooks those
## reads as broken rather than beatable. Only the strategic layer is loosened,
## which keeps it competent while leaving the player room to build a threat.
func _ai_choose_column() -> int:
	var valid: Array[int] = _valid_columns()
	if valid.is_empty():
		return -1
	for column: int in valid:
		if _wins_with(column, AI):
			return column
	for column: int in valid:
		if _wins_with(column, PLAYER):
			return column
	if randf() < _blunder:
		return valid.pick_random()
	var safe: Array[int] = []
	for column: int in valid:
		if not _hands_over_win(column):
			safe.append(column)
	return _weighted_centre(safe if not safe.is_empty() else valid)


func _wins_with(column: int, who: int) -> bool:
	var row: int = _landing_row(column)
	if row < 0:
		return false
	_set_at(row, column, who)
	var won: bool = _check_win(row, column, who)
	_set_at(row, column, EMPTY)
	return won


## Would dropping here stack the player's winning square right on top?
func _hands_over_win(column: int) -> bool:
	var row: int = _landing_row(column)
	if row <= 0:
		return false  # lands in the top row, so nothing can sit above it
	_set_at(row, column, AI)
	var opens: bool = _would_complete(row - 1, column, PLAYER)
	_set_at(row, column, EMPTY)
	return opens


func _would_complete(row: int, column: int, who: int) -> bool:
	_set_at(row, column, who)
	var won: bool = _check_win(row, column, who)
	_set_at(row, column, EMPTY)
	return won


## Centre columns are worth more in Connect Four; pick among the best few.
func _weighted_centre(options: Array[int]) -> int:
	var centre: float = float(_columns - 1) / 2.0
	var best: Array[int] = []
	var best_score: float = -1.0
	for column: int in options:
		var score: float = centre - absf(float(column) - centre)
		if score > best_score:
			best_score = score
			best = [column]
		elif is_equal_approx(score, best_score):
			best.append(column)
	return best.pick_random()


# --- Reporting ------------------------------------------------------------------


## A filled board is a tie. The framework's Outcome has no DRAW — a draw is
## not a win, so it pays the loss floor — but the copy must never call a tie a
## defeat, and the longest-line credit already pays it honestly.
func _end_draw() -> void:
	_end_run(false, "a draw — board full", true)


func _end_run(won: bool, detail: String, drawn: bool = false) -> void:
	_think_timer.stop()
	_busy = true
	for button: Button in _column_buttons:
		button.disabled = true
	# In-flight drops are settled by the base teardown(), which the host calls on
	# every terminal path — including a forfeit, which never reaches here.
	# Win: a faster win is worth more (8 moves pays full, 16 pays the floor).
	# Loss: credit the longest line actually built, so a near-miss beats a rout
	# once the host applies its LOSS_FLOOR.
	var performance: float = 0.0
	if won:
		performance = clampf(8.0 / float(maxi(1, _player_moves)), 0.5, 1.0)
	else:
		performance = clampf(float(_longest_run(PLAYER) - 1) / float(CONNECT - 1), 0.0, 1.0)
	var headline: String = "YOU WIN" if won else ("DRAW" if drawn else "DEFEATED")
	_set_status(headline, UIPalette.ink() if won else UIPalette.muted())
	_finish(
		Outcome.WIN if won else Outcome.LOSS, performance, float(_player_moves), detail
	)
