extends Minigame
## Battleship — sink a hidden fleet inside a shot budget.
##
## Single-sided salvo rather than the two-player original: no opponent turn to
## wait through, which suits a one-minute mobile round and reuses the budget
## shape already proven in Memory Match.
##
## Scene + .tres only. Score is SHOTS USED with lower_is_better.

const CELL_EMPTY: Texture2D = preload("res://sprites/minigames/cell_empty.png")
const SHOT_MISS: Texture2D = preload("res://sprites/minigames/shot_miss.png")
const SHOT_HIT: Texture2D = preload("res://sprites/minigames/shot_hit.png")
const SHOT_SUNK: Texture2D = preload("res://sprites/minigames/shot_sunk.png")

const ARCADE_CORE: Color = Color(1, 0.851, 0.839, 1)
const CELL_BG: Color = Color(0.086, 0.086, 0.098, 0.9)

const UNKNOWN: int = 0
const MISS: int = 1
const HIT: int = 2

const DEFAULT_SIZE: int = 7
## 34 shots for a 9-cell fleet: locked by simulation (20k rounds/cell) at a
## 73% clear for careless play and 90% for a player who chases hits.
const DEFAULT_SHOTS: int = 34
## How far a win's payout falls from a perfect salvo to a last-shot scrape.
const WIN_FALLOFF: float = 0.6
const MIN_WIN_PERF: float = 0.4
const DEFAULT_FLEET: Array[int] = [4, 3, 2]
const POP_TIME: float = 0.14
## Guards against an unluckily-packed board wedging the placement loop.
const PLACEMENT_ATTEMPTS: int = 200
## Whole-layout restarts before giving up (see _place_fleet).
const LAYOUT_ATTEMPTS: int = 20

## Read from the theme rather than restated here: one palette, one source.
var _ink: Color = UIPalette.ink()
var _size: int = DEFAULT_SIZE
var _shot_budget: int = DEFAULT_SHOTS
var _fleet: Array[int] = []
## Per cell: which ship occupies it (-1 = open water), and what the player knows.
var _ship_at: Array[int] = []
var _marks: Array[int] = []
var _cells: Array[Button] = []
## Remaining un-hit cells per ship; 0 = sunk.
var _ship_health: Array[int] = []
var _shots: int = 0
var _hits: int = 0
var _sunk: int = 0
var _total_ship_cells: int = 0

@onready var _status_label: Label = %StatusLabel
@onready var _shots_label: Label = %ShotsLabel
@onready var _grid: GridContainer = %CellGrid


## Grid size, shot budget and fleet come from the definition.
func setup(context: Dictionary) -> void:
	_size = clampi(int(context.get("size", DEFAULT_SIZE)), 5, 8)
	_fleet.clear()
	# Keep the fleet sparse enough that a random layout always succeeds. A board
	# packed past a third full can wedge the placement search, and a ship that
	# fails to place would quietly shrink the target count and inflate scoring.
	var capacity: int = int(floor(float(_size * _size) / 3.0))
	var occupied: int = 0
	for length: Variant in context.get("fleet", DEFAULT_FLEET):
		var value: int = int(length)
		if value >= 2 and value <= _size and occupied + value <= capacity:
			_fleet.append(value)
			occupied += value
	if _fleet.is_empty():
		_fleet.assign(DEFAULT_FLEET)
		occupied = 0
		for length: int in _fleet:
			occupied += length
	# Never ship a mathematically unwinnable round: the budget must at least
	# cover a perfect salvo (the idiom memory_match.gd uses for its attempts).
	_shot_budget = maxi(occupied, int(context.get("shots", DEFAULT_SHOTS)))


func _ready() -> void:
	_grid.columns = _size
	_ship_at.resize(_size * _size)
	_ship_at.fill(-1)
	_marks.resize(_size * _size)
	_marks.fill(UNKNOWN)
	_place_fleet()
	_build_grid()
	_grid.resized.connect(_fit_cells)
	_fit_cells()
	_refresh_labels()
	_set_status("FIND THE FLEET", _ink)


# --- Setup ----------------------------------------------------------------------


## Lay the whole fleet out, retrying the ENTIRE layout on failure rather than
## dropping a ship. A pre-sunk ship would read as "1 of 3 sunk" before the first
## shot and quietly inflate the score; restarting keeps the roster honest.
func _place_fleet() -> void:
	for _layout: int in range(LAYOUT_ATTEMPTS):
		_ship_at.fill(-1)
		_ship_health.clear()
		_total_ship_cells = 0
		if _try_layout():
			return
	# Unreachable at any sane density (setup caps the fleet at a third of the
	# board), but if it ever happened the roster must still match the board.
	_fleet = _fleet.slice(0, _ship_health.size())


func _try_layout() -> bool:
	for ship: int in range(_fleet.size()):
		var length: int = _fleet[ship]
		var placed: bool = false
		for _attempt: int in range(PLACEMENT_ATTEMPTS):
			var horizontal: bool = randi() % 2 == 0
			var span: int = _size - length
			if span < 0:
				return false
			var row: int = randi() % (_size if horizontal else span + 1)
			var column: int = randi() % (span + 1 if horizontal else _size)
			if not _fits(row, column, length, horizontal):
				continue
			for step: int in range(length):
				var r: int = row + (0 if horizontal else step)
				var c: int = column + (step if horizontal else 0)
				_ship_at[r * _size + c] = ship
			placed = true
			break
		if not placed:
			return false
		_ship_health.append(length)
		_total_ship_cells += length
	return true


func _fits(row: int, column: int, length: int, horizontal: bool) -> bool:
	for step: int in range(length):
		var r: int = row + (0 if horizontal else step)
		var c: int = column + (step if horizontal else 0)
		if r < 0 or r >= _size or c < 0 or c >= _size:
			return false
		if _ship_at[r * _size + c] != -1:
			return false
	return true


func _build_grid() -> void:
	for index: int in range(_size * _size):
		var cell := Button.new()
		cell.custom_minimum_size = Vector2(96, 96)
		cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		cell.expand_icon = true
		cell.icon = CELL_EMPTY
		cell.add_theme_stylebox_override("normal", _cell_style(false))
		cell.add_theme_stylebox_override("hover", _cell_style(true))
		cell.add_theme_stylebox_override("pressed", _cell_style(true))
		cell.add_theme_stylebox_override("disabled", _cell_style(false))
		cell.add_theme_color_override("icon_disabled_color", Color.WHITE)
		cell.pressed.connect(_on_cell_pressed.bind(index))
		_grid.add_child(cell)
		_cells.append(cell)


func _cell_style(lit: bool) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = CELL_BG
	style.set_corner_radius_all(12)
	style.set_border_width_all(2)
	style.border_color = _ink if lit else Color(0.18, 0.18, 0.204, 0.6)
	return style


## Keep cells square against the live grid width.
func _fit_cells() -> void:
	if _cells.is_empty():
		return
	var side: float = maxf(96.0, _cells[0].size.x)
	# Only write when it actually changes: this runs from `resized`, and
	# re-assigning the same minimum every pass is needless layout churn.
	if is_equal_approx(_cells[0].custom_minimum_size.y, side):
		return
	for cell: Button in _cells:
		cell.custom_minimum_size = Vector2(96, side)


# --- Firing ---------------------------------------------------------------------


func _on_cell_pressed(index: int) -> void:
	if _marks[index] != UNKNOWN:
		return
	_shots += 1
	var ship: int = _ship_at[index]
	if ship < 0:
		_marks[index] = MISS
		_cells[index].icon = SHOT_MISS
		_set_status("MISS", UIPalette.muted())
	else:
		_marks[index] = HIT
		_hits += 1
		_cells[index].icon = SHOT_HIT
		_ship_health[ship] -= 1
		if _ship_health[ship] <= 0:
			_sunk += 1
			_reveal_sunk(ship, index)
			_set_status("SHIP SUNK", ARCADE_CORE)
		else:
			_set_status("HIT", _ink)
	_cells[index].disabled = true
	_pop(_cells[index])
	_refresh_labels()
	if _sunk >= _ship_health.size():
		_end_run(true, "fleet sunk in %d %s" % [_shots, "shot" if _shots == 1 else "shots"])
	elif _shots >= _shot_budget:
		_end_run(false, "%d of %d ships sunk" % [_sunk, _ship_health.size()])


## A sunk ship's cells become one solid slab, so a finished ship reads as a
## single mass rather than a scatter of hits.
func _reveal_sunk(ship: int, just_hit: int) -> void:
	for index: int in range(_ship_at.size()):
		if _ship_at[index] != ship:
			continue
		_cells[index].icon = SHOT_SUNK
		if index != just_hit:
			_pop(_cells[index])  # the caller pops the cell that was just hit


func _pop(cell: Button) -> void:
	cell.pivot_offset = cell.size * 0.5
	cell.scale = Vector2(0.7, 0.7)
	var tween: Tween = create_managed_tween()
	tween.tween_property(cell, "scale", Vector2.ONE, POP_TIME) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func _refresh_labels() -> void:
	_shots_label.text = "Shot %d of %d · %d of %d ships sunk" % [
		mini(_shots, _shot_budget), _shot_budget, _sunk, _ship_health.size()
	]


func _set_status(text: String, color: Color) -> void:
	_status_label.text = text
	_status_label.add_theme_color_override("font_color", color)


# --- Reporting ------------------------------------------------------------------


func _end_run(won: bool, detail: String) -> void:
	for cell: Button in _cells:
		cell.disabled = true
	# In-flight pops are settled by the base teardown(), which the host calls on
	# every terminal path — including a forfeit, which never reaches here.
	# Win: scaled across the range a real round actually occupies — from a
	# perfect salvo (every shot a hit) down to scraping in on the last shot.
	# Scoring perfection/shots instead would peg almost every win near the
	# floor, since a typical clear takes about three times the minimum.
	# Loss: the fraction of the fleet actually found, so a near-miss beats a
	# blind round once the host applies its LOSS_FLOOR.
	var performance: float = 0.0
	if won:
		var span: float = float(maxi(1, _shot_budget - _total_ship_cells))
		var over: float = float(maxi(0, _shots - _total_ship_cells))
		performance = clampf(1.0 - WIN_FALLOFF * (over / span), MIN_WIN_PERF, 1.0)
	elif _total_ship_cells > 0:
		performance = float(_hits) / float(_total_ship_cells)
	_set_status(
		"FLEET DESTROYED" if won else "OUT OF SHOTS",
		ARCADE_CORE if won else UIPalette.muted()
	)
	_finish(
		Outcome.WIN if won else Outcome.LOSS, performance, float(_shots), detail
	)
