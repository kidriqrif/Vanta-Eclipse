extends Minigame
## Rune Sweeper — a 5x5 field with five buried runes. Uncover every safe cell.
##
## No flagging. Marking suspected mines is the half of Minesweeper that needs a
## second input, and a phone only has one — every mobile port that keeps it ends
## up with a long-press or a mode toggle, both of which cost more than they buy
## in a 25-cell field. Uncovering is the whole game here.
##
## The first tap is always safe: the field is laid AFTER it, with that cell and
## its neighbours excluded. Losing on move one to a coin flip is not difficulty.

const SIZE: int = 5
const RUNES: int = 5

var _mine: Array[bool] = []
var _revealed: Array[bool] = []
var _buttons: Array[Button] = []
var _laid: bool = false
var _safe_total: int = SIZE * SIZE - RUNES
var _safe_found: int = 0

@onready var _status_label: Label = %StatusLabel
@onready var _grid: GridContainer = %Grid
@onready var _state_label: Label = %StateLabel


func _ready() -> void:
	_grid.columns = SIZE
	_mine.resize(SIZE * SIZE)
	_revealed.resize(SIZE * SIZE)
	for index: int in SIZE * SIZE:
		var cell := Button.new()
		cell.custom_minimum_size = Vector2(88, 88)
		cell.focus_mode = Control.FOCUS_NONE
		cell.add_theme_font_size_override("font_size", 27)
		cell.pressed.connect(_on_cell_pressed.bind(index))
		_grid.add_child(cell)
		_buttons.append(cell)
		_style_hidden(cell)
	_update_status()


func _style_hidden(cell: Button) -> void:
	paint_button(cell, UIPalette.raised(), UIPalette.line(), 2)


func _style_revealed(cell: Button, danger: bool) -> void:
	if danger:
		paint_button(cell, UIPalette.surface(), UIPalette.accent(), 4)
	else:
		paint_button(cell, UIPalette.surface(), UIPalette.line(), 1)


# --- Field -------------------------------------------------------------------


## Lay the runes, keeping `safe_index` and everything touching it clear so the
## opening tap always opens a pocket rather than a single number.
func _lay_field(safe_index: int) -> void:
	var forbidden: Dictionary = {safe_index: true}
	for neighbour: int in _neighbours(safe_index):
		forbidden[neighbour] = true
	var candidates: Array[int] = []
	for index: int in SIZE * SIZE:
		if not forbidden.has(index):
			candidates.append(index)
	candidates.shuffle()
	# A 5x5 field minus a 3x3 opening leaves 16 cells for 5 runes, so this
	# cannot run short — but take the minimum anyway rather than trusting the
	# arithmetic to survive someone retuning SIZE.
	for i: int in mini(RUNES, candidates.size()):
		_mine[candidates[i]] = true
	_safe_total = SIZE * SIZE - _mine.count(true)
	_laid = true


func _neighbours(index: int) -> Array[int]:
	var found: Array[int] = []
	var row: int = index / SIZE
	var column: int = index % SIZE
	for dr: int in [-1, 0, 1]:
		for dc: int in [-1, 0, 1]:
			if dr == 0 and dc == 0:
				continue
			var r: int = row + dr
			var c: int = column + dc
			if r >= 0 and r < SIZE and c >= 0 and c < SIZE:
				found.append(r * SIZE + c)
	return found


func _adjacent_runes(index: int) -> int:
	var count: int = 0
	for neighbour: int in _neighbours(index):
		if _mine[neighbour]:
			count += 1
	return count


# --- Play --------------------------------------------------------------------


func _on_cell_pressed(index: int) -> void:
	if not _laid:
		_lay_field(index)
	if _revealed[index]:
		return
	if _mine[index]:
		_reveal(index)
		_buttons[index].text = "*"
		_end_run(false)
		return
	_flood(index)
	_update_status()
	if _safe_found >= _safe_total:
		_end_run(true)


## Reveal `index`, and keep spreading through any cell that touches no rune.
## Iterative rather than recursive: a 25-cell flood is small, but a recursive
## reveal is the classic way this ends up re-entering a cell it already opened.
func _flood(index: int) -> void:
	var pending: Array[int] = [index]
	while not pending.is_empty():
		var current: int = pending.pop_back()
		if _revealed[current] or _mine[current]:
			continue
		_reveal(current)
		var adjacent: int = _adjacent_runes(current)
		_buttons[current].text = str(adjacent) if adjacent > 0 else ""
		if adjacent == 0:
			for neighbour: int in _neighbours(current):
				if not _revealed[neighbour]:
					pending.append(neighbour)


func _reveal(index: int) -> void:
	_revealed[index] = true
	if not _mine[index]:
		_safe_found += 1
	var cell: Button = _buttons[index]
	_style_revealed(cell, _mine[index])
	cell.disabled = true


func _update_status() -> void:
	_status_label.text = "%d of %d cells clear · %d runes" % [
		_safe_found, _safe_total, RUNES
	]


func _end_run(won: bool) -> void:
	for index: int in _buttons.size():
		_buttons[index].disabled = true
		if not won and _mine[index] and not _revealed[index]:
			# Show the field on a loss. A puzzle that hides its answer teaches
			# nothing and reads as arbitrary.
			_style_revealed(_buttons[index], true)
			_buttons[index].text = "*"
	var performance: float = clampf(
		float(_safe_found) / float(maxi(1, _safe_total)), 0.0, 1.0
	)
	_state_label.text = "FIELD CLEAR" if won else "RUNE STRUCK"
	_state_label.add_theme_color_override(
		"font_color", UIPalette.ink() if won else UIPalette.muted()
	)
	_finish(
		Outcome.WIN if won else Outcome.LOSS,
		performance,
		float(_safe_found),
		"%d of %d clear" % [_safe_found, _safe_total],
	)
