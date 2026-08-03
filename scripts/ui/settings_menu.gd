extends Control
## Settings screen — audio sliders, haptics toggle, manual save, and the
## about/privacy block. Pure UI: all real work happens in SettingsManager /
## SaveManager.

## Play requires a reachable privacy policy for the listing, and expects the
## app itself to be able to reach it. Served by GitHub Pages out of docs/ in
## this repository, so the page and the app version it describes are committed
## together and cannot drift apart.
const PRIVACY_URL: String = "https://kidriqrif.github.io/Vanta-Eclipse/privacy-policy.html"

@onready var _master_slider: HSlider = %MasterSlider
@onready var _music_slider: HSlider = %MusicSlider
@onready var _sfx_slider: HSlider = %SfxSlider
@onready var _haptics_toggle: CheckButton = %HapticsToggle
@onready var _last_save_label: Label = %LastSaveLabel
@onready var _save_game_button: Button = %SaveGameButton
@onready var _privacy_button: Button = %PrivacyButton
@onready var _version_label: Label = %VersionLabel
@onready var _back_button: Button = %BackButton


func _ready() -> void:
	# Show the current values FIRST, then connect the signals — otherwise
	# setting .value here would immediately re-trigger the setters for nothing.
	_master_slider.value = SettingsManager.master_volume * 100.0
	_music_slider.value = SettingsManager.music_volume * 100.0
	_sfx_slider.value = SettingsManager.sfx_volume * 100.0
	_haptics_toggle.button_pressed = SettingsManager.haptics_enabled

	_master_slider.value_changed.connect(_on_master_changed)
	_music_slider.value_changed.connect(_on_music_changed)
	_sfx_slider.value_changed.connect(_on_sfx_changed)
	_haptics_toggle.toggled.connect(_on_haptics_toggled)
	_save_game_button.pressed.connect(_on_save_game_pressed)
	_privacy_button.pressed.connect(_on_privacy_pressed)
	_back_button.pressed.connect(_on_back_pressed)
	_version_label.text = "Vanta Eclipse %s" % GameManager.GAME_VERSION

	EventBus.game_saved.connect(_on_game_saved)
	_update_last_save_label()


# --- Signal handlers ---------------------------------------------------------


## Hands the URL to the system browser. The only outbound call the game makes —
## and it is the OS opening a page, not the game fetching anything, so the
## "this app makes no network requests" claim in that very policy holds.
func _on_privacy_pressed() -> void:
	OS.shell_open(PRIVACY_URL)


func _on_master_changed(value: float) -> void:
	SettingsManager.master_volume = value / 100.0


func _on_music_changed(value: float) -> void:
	SettingsManager.music_volume = value / 100.0


func _on_sfx_changed(value: float) -> void:
	SettingsManager.sfx_volume = value / 100.0


func _on_haptics_toggled(pressed: bool) -> void:
	SettingsManager.haptics_enabled = pressed


func _on_save_game_pressed() -> void:
	SaveManager.save_game()


func _on_game_saved(success: bool) -> void:
	if success:
		_update_last_save_label()
	else:
		_last_save_label.text = "Save failed — check device storage."


func _on_back_pressed() -> void:
	SceneManager.change_scene(SceneManager.SCENE_MAIN_MENU)


# --- Internals ---------------------------------------------------------------


@warning_ignore("integer_division")
func _update_last_save_label() -> void:
	var saved_at: int = SaveManager.last_save_unix
	if saved_at <= 0:
		_last_save_label.text = "Not saved yet this session."
		return
	var seconds_ago: int = int(Time.get_unix_time_from_system()) - saved_at
	if seconds_ago < 5:
		_last_save_label.text = "Last saved: just now"
	elif seconds_ago < 60:
		_last_save_label.text = "Last saved: %s ago" % _plural(seconds_ago, "second")
	elif seconds_ago < 3600:
		_last_save_label.text = "Last saved: %s ago" % _plural(seconds_ago / 60, "minute")
	else:
		_last_save_label.text = "Last saved: %s ago" % _plural(seconds_ago / 3600, "hour")


## "1 hour" / "2 hours". Every branch above hits the singular case for a full
## unit each time (the first minute after a save, the first hour, and so on),
## so "1 hours ago" was on screen more often than not.
func _plural(count: int, noun: String) -> String:
	return "%d %s" % [count, noun if count == 1 else noun + "s"]
