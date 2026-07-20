extends Control
## Settings screen — audio sliders, haptics toggle, and manual save.
## Pure UI: all real work happens in SettingsManager / SaveManager.

@onready var _master_slider: HSlider = %MasterSlider
@onready var _music_slider: HSlider = %MusicSlider
@onready var _sfx_slider: HSlider = %SfxSlider
@onready var _haptics_toggle: CheckButton = %HapticsToggle
@onready var _last_save_label: Label = %LastSaveLabel
@onready var _save_game_button: Button = %SaveGameButton
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
	_back_button.pressed.connect(_on_back_pressed)

	EventBus.game_saved.connect(_on_game_saved)
	_update_last_save_label()


# --- Signal handlers ---------------------------------------------------------


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
		_last_save_label.text = "Last saved: %d seconds ago" % seconds_ago
	elif seconds_ago < 3600:
		_last_save_label.text = "Last saved: %d minutes ago" % (seconds_ago / 60)
	else:
		_last_save_label.text = "Last saved: %d hours ago" % (seconds_ago / 3600)
