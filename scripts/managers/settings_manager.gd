extends Node
## SettingsManager — loads, applies, and persists player settings (autoload).
##
## Settings live in their own ConfigFile (user://settings.cfg), deliberately
## separate from the gameplay save file: volume preferences must survive
## prestige resets, save deletion, and save-format migrations.
##
## Every property uses a setter, so writing e.g.
##     SettingsManager.music_volume = 0.5
## immediately applies the change (audio bus updated), notifies the rest of
## the game through EventBus, and schedules a disk write.

const SETTINGS_PATH: String = "user://settings.cfg"

## Audio bus names — must match default_bus_layout.tres exactly.
const BUS_MASTER: String = "Master"
const BUS_MUSIC: String = "Music"
const BUS_SFX: String = "SFX"

## How long after the last change we wait before writing to disk.
## Prevents hammering storage while the player drags a volume slider.
const SAVE_DEBOUNCE_SECONDS: float = 0.5

## Volumes are stored as linear values from 0.0 (silent) to 1.0 (full).
var master_volume: float = 1.0: set = set_master_volume
var music_volume: float = 0.8: set = set_music_volume
var sfx_volume: float = 0.8: set = set_sfx_volume

## Whether the phone should vibrate on important game events (mobile only).
var haptics_enabled: bool = true: set = set_haptics_enabled

var _save_timer: Timer


func _ready() -> void:
	# Settings must keep working even while the game is paused.
	process_mode = Node.PROCESS_MODE_ALWAYS

	_save_timer = Timer.new()
	_save_timer.one_shot = true
	_save_timer.wait_time = SAVE_DEBOUNCE_SECONDS
	_save_timer.timeout.connect(_write_to_disk)
	add_child(_save_timer)

	_load_from_disk()


func _notification(what: int) -> void:
	# Flush pending settings when the app closes (desktop) or is sent to the
	# background (Android home button / app switch).
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_APPLICATION_PAUSED:
		if not _save_timer.is_stopped():
			_save_timer.stop()
			_write_to_disk()


# --- Setters -----------------------------------------------------------------


func set_master_volume(value: float) -> void:
	master_volume = clampf(value, 0.0, 1.0)
	_apply_bus_volume(BUS_MASTER, master_volume)
	EventBus.setting_changed.emit("master_volume", master_volume)
	_queue_save()


func set_music_volume(value: float) -> void:
	music_volume = clampf(value, 0.0, 1.0)
	_apply_bus_volume(BUS_MUSIC, music_volume)
	EventBus.setting_changed.emit("music_volume", music_volume)
	_queue_save()


func set_sfx_volume(value: float) -> void:
	sfx_volume = clampf(value, 0.0, 1.0)
	_apply_bus_volume(BUS_SFX, sfx_volume)
	EventBus.setting_changed.emit("sfx_volume", sfx_volume)
	_queue_save()


func set_haptics_enabled(value: bool) -> void:
	haptics_enabled = value
	EventBus.setting_changed.emit("haptics_enabled", haptics_enabled)
	_queue_save()


# --- Public helpers ----------------------------------------------------------


## Vibrate the device for the given duration, respecting the player's setting.
## Safe to call on any platform — it does nothing on desktop.

func vibrate(duration_ms: int) -> void:
	if haptics_enabled and OS.has_feature("mobile"):
		Input.vibrate_handheld(duration_ms)


# --- Internals ---------------------------------------------------------------


func _apply_bus_volume(bus_name: String, linear: float) -> void:
	var bus_index: int = AudioServer.get_bus_index(bus_name)
	if bus_index == -1:
		push_warning("SettingsManager: audio bus not found: %s" % bus_name)
		return
	# linear_to_db(0) is negative infinity, so fully-off uses mute instead.
	AudioServer.set_bus_mute(bus_index, linear <= 0.0)
	if linear > 0.0:
		AudioServer.set_bus_volume_db(bus_index, linear_to_db(linear))


func _queue_save() -> void:
	# Restart the debounce timer; the actual write happens shortly after the
	# player stops changing things. Skipped before _ready adds the timer.
	if _save_timer != null and _save_timer.is_inside_tree():
		_save_timer.start()


func _write_to_disk() -> void:
	var config := ConfigFile.new()
	config.set_value("audio", "master_volume", master_volume)
	config.set_value("audio", "music_volume", music_volume)
	config.set_value("audio", "sfx_volume", sfx_volume)
	config.set_value("gameplay", "haptics_enabled", haptics_enabled)
	var error: int = config.save(SETTINGS_PATH)
	if error != OK:
		push_error("SettingsManager: failed to write %s (error %d)" % [SETTINGS_PATH, error])


func _load_from_disk() -> void:
	var config := ConfigFile.new()
	var error: int = config.load(SETTINGS_PATH)
	if error != OK:
		# First launch (or unreadable file): apply and keep the defaults.
		_apply_bus_volume(BUS_MASTER, master_volume)
		_apply_bus_volume(BUS_MUSIC, music_volume)
		_apply_bus_volume(BUS_SFX, sfx_volume)
		return
	# Assigning through "self" runs the setters, which apply the values.
	self.master_volume = config.get_value("audio", "master_volume", 1.0)
	self.music_volume = config.get_value("audio", "music_volume", 0.8)
	self.sfx_volume = config.get_value("audio", "sfx_volume", 0.8)
	self.haptics_enabled = config.get_value("gameplay", "haptics_enabled", true)
	# Loading is not a player change — cancel the debounce write it queued.
	_save_timer.stop()
