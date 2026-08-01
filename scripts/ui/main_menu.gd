extends Control
## Main menu — the entry point of the game.
## Pure UI: it only reads display data and asks managers to act.

@onready var _play_button: Button = %PlayButton
@onready var _settings_button: Button = %SettingsButton
@onready var _quit_button: Button = %QuitButton
@onready var _version_label: Label = %VersionLabel


func _ready() -> void:
	_version_label.text = "v%s" % GameManager.GAME_VERSION

	_play_button.pressed.connect(_on_play_pressed)
	_settings_button.pressed.connect(_on_settings_pressed)
	_quit_button.pressed.connect(_on_quit_pressed)

	# Google Play guidelines: mobile apps should not offer their own quit
	# button — the OS handles that. So it only appears on desktop builds.
	if OS.has_feature("mobile"):
		_quit_button.hide()


func _on_play_pressed() -> void:
	SceneManager.change_scene(SceneManager.SCENE_GAMEPLAY)


func _on_settings_pressed() -> void:
	SceneManager.change_scene(SceneManager.SCENE_SETTINGS)


func _on_quit_pressed() -> void:
	# Save first: quit() closes immediately without OS close notifications.
	SaveManager.save_game()
	get_tree().quit()
