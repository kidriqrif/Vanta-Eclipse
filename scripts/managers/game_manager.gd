extends Node
## GameManager — central game state and version info (autoload).
##
## Milestone 1 scope: game version, play-time tracking, session counting, and
## pause control. Registers itself as the "game" section of the save file.
## Later milestones will NOT pile everything in here — each big system
## (currencies, combat, equipment, ...) gets its own manager and registers its
## own save section. GameManager stays small on purpose.

## Displayed in the UI and stamped into every save file.
## Bump this for every release build.
const GAME_VERSION: String = "0.1.0"

## Total seconds the player has spent in the game, across all sessions.
var total_play_time: float = 0.0

## How many times the game has been launched (1 = first ever session).
var launch_count: int = 0

## Unix timestamp of the very first launch. Used later for statistics.
var created_at_unix: int = 0


func _ready() -> void:
	# Keep tracking time even while the game is paused.
	process_mode = Node.PROCESS_MODE_ALWAYS
	SaveManager.register_saveable("game", self)
	EventBus.game_loaded.connect(_on_game_loaded)


func _process(delta: float) -> void:
	total_play_time += delta


# --- Save contract (called by SaveManager) ------------------------------------


func get_save_data() -> Dictionary:
	return {
		"total_play_time": total_play_time,
		"launch_count": launch_count,
		"created_at_unix": created_at_unix,
	}


func load_save_data(data: Dictionary) -> void:
	total_play_time = float(data.get("total_play_time", 0.0))
	launch_count = int(data.get("launch_count", 0))
	created_at_unix = int(data.get("created_at_unix", 0))


# --- Public helpers ----------------------------------------------------------


## Coarse duration for "you were away" copy, deliberately without seconds
## (UX spec design/ux/milestone-4-idle-offline.md §4C):
## 42m · 3h 42m · 2d 5h.
@warning_ignore("integer_division")
static func format_duration_rough(seconds: int) -> String:
	var minutes: int = seconds / 60
	if minutes < 1:
		return "moments"
	if minutes < 60:
		return "%dm" % minutes
	var hours: int = minutes / 60
	if hours < 24:
		return "%dh %dm" % [hours, minutes % 60]
	return "%dd %dh" % [hours / 24, hours % 24]


## Format a duration in seconds as a short human-readable string,
## e.g. 4325.0 -> "1h 12m 05s".
@warning_ignore("integer_division")
static func format_time(seconds: float) -> String:
	var total: int = int(seconds)
	var hours: int = total / 3600
	var minutes: int = (total % 3600) / 60
	var secs: int = total % 60
	if hours > 0:
		return "%dh %02dm %02ds" % [hours, minutes, secs]
	return "%dm %02ds" % [minutes, secs]


# --- Internals ---------------------------------------------------------------


func _on_game_loaded(_is_new_game: bool) -> void:
	# Runs exactly once per app start, after the save (if any) was applied.
	launch_count += 1
	if created_at_unix == 0:
		created_at_unix = int(Time.get_unix_time_from_system())
