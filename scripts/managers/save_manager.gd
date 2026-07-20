extends Node
## SaveManager — the game's single source of truth for saving/loading (autoload).
##
## Design (built for years of updates):
##   * Any system that owns persistent data registers itself with
##     register_saveable(section_id, object). The object must implement:
##         get_save_data() -> Dictionary
##         load_save_data(data: Dictionary) -> void
##     New systems (equipment, pets, prestige, ...) plug in without ever
##     touching this file.
##   * The whole save is one versioned JSON document, so old saves can be
##     migrated forward in _migrate() when the format changes.
##   * Writes are atomic (write temp file, keep a backup, then swap), so a
##     crash or battery-death mid-save can never corrupt the player's progress.
##   * Cloud-save ready: get_full_save_text() returns the exact document a
##     cloud provider would upload, and the on-disk format is plain JSON.
##
## Saving happens automatically every AUTOSAVE_INTERVAL seconds, when the app
## is closed or backgrounded, and whenever save_game() is called manually.

const SAVE_VERSION: int = 1
const SAVE_PATH: String = "user://savegame.json"
const BACKUP_PATH: String = "user://savegame.backup.json"
const TEMP_PATH: String = "user://savegame.tmp"
const AUTOSAVE_INTERVAL: float = 60.0

## Unix timestamp of the most recent successful save (0 = never this session).
var last_save_unix: int = 0

## section_id (String) -> registered object providing that section's data.
var _saveables: Dictionary = {}
var _autosave_timer: Timer


func _ready() -> void:
	# Saving must keep working even while the game is paused.
	process_mode = Node.PROCESS_MODE_ALWAYS

	_autosave_timer = Timer.new()
	_autosave_timer.wait_time = AUTOSAVE_INTERVAL
	_autosave_timer.autostart = true
	_autosave_timer.timeout.connect(_on_autosave_timeout)
	add_child(_autosave_timer)

	# Deferred so every autoload (GameManager etc.) finishes _ready() and
	# registers its section BEFORE the save file is read and distributed.
	_initial_load.call_deferred()


func _notification(what: int) -> void:
	# Desktop window close, and Android sending the app to the background —
	# the two moments a mobile game is most likely to be killed by the OS.
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_APPLICATION_PAUSED:
		save_game()


# --- Public API --------------------------------------------------------------


## Register a system that owns persistent data. Call this from the system's
## _ready(). The section_id becomes its key inside the save file.
func register_saveable(section_id: String, saveable: Object) -> void:
	if _saveables.has(section_id):
		push_error("SaveManager: duplicate saveable section: %s" % section_id)
		return
	if not saveable.has_method("get_save_data") or not saveable.has_method("load_save_data"):
		push_error("SaveManager: '%s' must implement get_save_data() and load_save_data()" % section_id)
		return
	_saveables[section_id] = saveable


## Save the entire game. Returns true on success.
func save_game() -> bool:
	var success: bool = _write_atomically(get_full_save_text())
	if success:
		last_save_unix = int(Time.get_unix_time_from_system())
	else:
		push_error("SaveManager: save failed!")
	EventBus.game_saved.emit(success)
	return success


## Build the complete save document as JSON text. This is also exactly what a
## cloud-save provider would upload. TODO(Milestone 15): wire into Play Games
## cloud saves.
func get_full_save_text() -> String:
	var sections: Dictionary = {}
	for section_id: String in _saveables:
		sections[section_id] = _saveables[section_id].get_save_data()
	var document: Dictionary = {
		"save_version": SAVE_VERSION,
		"game_version": GameManager.GAME_VERSION,
		"saved_at_unix": int(Time.get_unix_time_from_system()),
		"sections": sections,
	}
	return JSON.stringify(document, "\t")


## True if a save file exists on disk.
func has_save() -> bool:
	return FileAccess.file_exists(SAVE_PATH) or FileAccess.file_exists(BACKUP_PATH)


## Permanently delete all saved progress (both main file and backup).
## TODO(Milestone 8): expose in Settings behind a confirmation dialog, and use
## as part of the prestige flow where appropriate.
func delete_save() -> void:
	if FileAccess.file_exists(SAVE_PATH):
		DirAccess.remove_absolute(SAVE_PATH)
	if FileAccess.file_exists(BACKUP_PATH):
		DirAccess.remove_absolute(BACKUP_PATH)
	last_save_unix = 0


# --- Internals ---------------------------------------------------------------


func _on_autosave_timeout() -> void:
	save_game()


func _initial_load() -> void:
	var loaded: bool = _try_load_from(SAVE_PATH)
	if not loaded and FileAccess.file_exists(BACKUP_PATH):
		push_warning("SaveManager: main save unreadable, restoring from backup.")
		loaded = _try_load_from(BACKUP_PATH)
	EventBus.game_loaded.emit(not loaded)


func _try_load_from(path: String) -> bool:
	if not FileAccess.file_exists(path):
		return false
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		push_error("SaveManager: cannot open %s (error %d)" % [path, FileAccess.get_open_error()])
		return false
	var text: String = file.get_as_text()
	file.close()

	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("SaveManager: %s is not valid save JSON." % path)
		return false
	var document: Dictionary = parsed
	if typeof(document.get("sections")) != TYPE_DICTIONARY:
		push_error("SaveManager: %s is missing its 'sections' block." % path)
		return false

	document = _migrate(document)

	var sections: Dictionary = document["sections"]
	for section_id: String in _saveables:
		if sections.has(section_id) and typeof(sections[section_id]) == TYPE_DICTIONARY:
			_saveables[section_id].load_save_data(sections[section_id])

	last_save_unix = int(document.get("saved_at_unix", 0))
	# TODO(Milestone 4): use saved_at_unix here to calculate offline progression.
	return true


## Upgrade an old save document to the current SAVE_VERSION, one step at a time.
## When the format changes, bump SAVE_VERSION and add a numbered step:
##
##     1:  # 1 -> 2: renamed "gold" to "eclipse_essence"
##         sections["currency"]["eclipse_essence"] = sections["currency"].get("gold", 0)
##
## Chaining single steps means a save from ANY old version always upgrades
## cleanly to the newest format.
func _migrate(document: Dictionary) -> Dictionary:
	var version: int = int(document.get("save_version", 1))
	while version < SAVE_VERSION:
		match version:
			_:
				push_warning("SaveManager: no migration defined from version %d." % version)
		version += 1
	document["save_version"] = SAVE_VERSION
	return document


## Write the save so that a crash at ANY point leaves a readable file:
##   1. write everything to a temp file
##   2. copy the current save to the backup slot
##   3. atomically rename the temp file over the real save
func _write_atomically(text: String) -> bool:
	var file := FileAccess.open(TEMP_PATH, FileAccess.WRITE)
	if file == null:
		push_error("SaveManager: cannot write %s (error %d)" % [TEMP_PATH, FileAccess.get_open_error()])
		return false
	file.store_string(text)
	file.close()

	if FileAccess.file_exists(SAVE_PATH):
		DirAccess.copy_absolute(SAVE_PATH, BACKUP_PATH)

	var error: int = DirAccess.rename_absolute(TEMP_PATH, SAVE_PATH)
	if error != OK:
		push_error("SaveManager: could not move temp save into place (error %d)" % error)
		return false
	return true
