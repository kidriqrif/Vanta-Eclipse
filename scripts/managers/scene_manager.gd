extends Node
## SceneManager — all scene changes go through here (autoload).
##
## Provides a smooth fade-to-black transition and loads the next scene on a
## background thread, so the game never freezes during a switch — important
## once scenes grow heavy with art and effects on low-end Android devices.
##
## Usage from anywhere:
##     SceneManager.change_scene(SceneManager.SCENE_GAMEPLAY)

## Every scene in the game gets a constant here, so a moved/renamed scene file
## only ever needs fixing in one place.
const SCENE_MAIN_MENU: String = "res://scenes/main_menu/main_menu.tscn"
const SCENE_SETTINGS: String = "res://scenes/settings/settings_menu.tscn"
const SCENE_GAMEPLAY: String = "res://scenes/gameplay/gameplay.tscn"
const SCENE_GEAR: String = "res://scenes/gear/gear.tscn"
const SCENE_PETS: String = "res://scenes/pets/pets.tscn"
const SCENE_ECLIPSE: String = "res://scenes/eclipse/eclipse.tscn"
const SCENE_ARCADE: String = "res://scenes/arcade/arcade.tscn"
const SCENE_MINIGAME_HOST: String = "res://scenes/minigames/minigame_host.tscn"

const FADE_DURATION: float = 0.25
const FADE_COLOR: Color = Color(0.016, 0.008, 0.031)

var _is_transitioning: bool = false
var _fade_rect: ColorRect


func _ready() -> void:
	# Transitions must work even while the game is paused.
	process_mode = Node.PROCESS_MODE_ALWAYS
	_build_fade_overlay()


## Switch to another scene with a fade transition. Safe to call repeatedly —
## calls made while a transition is already running are ignored.
func change_scene(scene_path: String) -> void:
	if _is_transitioning:
		return
	_is_transitioning = true
	EventBus.scene_transition_started.emit(scene_path)

	# Block all taps/clicks while the screen is covered.
	_fade_rect.mouse_filter = Control.MOUSE_FILTER_STOP
	var fade_out: Tween = create_tween()
	fade_out.tween_property(_fade_rect, "modulate:a", 1.0, FADE_DURATION)
	await fade_out.finished

	var packed_scene: PackedScene = await _load_scene_in_background(scene_path)
	if packed_scene == null:
		push_error("SceneManager: failed to load scene: %s" % scene_path)
		await _fade_in()
		_is_transitioning = false
		return

	get_tree().change_scene_to_packed(packed_scene)
	# Give the new scene one frame to enter the tree before revealing it.
	await get_tree().process_frame

	await _fade_in()
	_is_transitioning = false
	EventBus.scene_transition_finished.emit(scene_path)


# --- Internals ---------------------------------------------------------------


func _build_fade_overlay() -> void:
	# A CanvasLayer with a huge layer number draws on top of everything.
	var layer := CanvasLayer.new()
	layer.layer = 100
	add_child(layer)

	_fade_rect = ColorRect.new()
	_fade_rect.color = FADE_COLOR
	_fade_rect.modulate.a = 0.0
	_fade_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fade_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(_fade_rect)


func _load_scene_in_background(scene_path: String) -> PackedScene:
	var error: int = ResourceLoader.load_threaded_request(scene_path)
	if error != OK:
		return null
	while true:
		var status: int = ResourceLoader.load_threaded_get_status(scene_path)
		match status:
			ResourceLoader.THREAD_LOAD_LOADED:
				return ResourceLoader.load_threaded_get(scene_path)
			ResourceLoader.THREAD_LOAD_IN_PROGRESS:
				await get_tree().process_frame
			_:
				# THREAD_LOAD_FAILED or THREAD_LOAD_INVALID_RESOURCE
				return null
	return null


func _fade_in() -> void:
	var fade_in: Tween = create_tween()
	fade_in.tween_property(_fade_rect, "modulate:a", 0.0, FADE_DURATION)
	await fade_in.finished
	_fade_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
