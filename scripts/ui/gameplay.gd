extends Control
## Gameplay screen — Milestone 1 version.
##
## For now it proves the whole foundation works end-to-end: it shows live data
## from GameManager (play time, session number) that survives app restarts via
## SaveManager, and returns to the menu through SceneManager.
##
## TODO(Milestone 2): replace the center content with the combat area
## (tappable enemy, health bar, floating damage numbers).

@onready var _session_label: Label = %SessionLabel
@onready var _play_time_label: Label = %PlayTimeLabel
@onready var _menu_button: Button = %MenuButton


func _ready() -> void:
	_session_label.text = "Session #%d" % GameManager.launch_count
	_menu_button.pressed.connect(_on_menu_pressed)


func _process(_delta: float) -> void:
	var time_text: String = GameManager.format_time(GameManager.total_play_time)
	_play_time_label.text = "Total play time: %s" % time_text


func _on_menu_pressed() -> void:
	SceneManager.change_scene(SceneManager.SCENE_MAIN_MENU)
