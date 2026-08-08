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
const SCENE_CARDS: String = "res://scenes/cards/card_collection.tscn"
const SCENE_ECLIPSE: String = "res://scenes/eclipse/eclipse.tscn"
const SCENE_ARCADE: String = "res://scenes/arcade/arcade.tscn"
const SCENE_MINIGAME_HOST: String = "res://scenes/minigames/minigame_host.tscn"
const SCENE_JOURNAL: String = "res://scenes/journal/journal.tscn"
const SCENE_SHOP: String = "res://scenes/shop/shop.tscn"

## The width the layout was designed against. Content never exceeds it.
const MAX_CONTENT_WIDTH: float = 1080.0

const FADE_DURATION: float = 0.25
## The base black, not a violet-tinted one — the transition should read as the
## screen going out, not as a colour washing over it.
const FADE_COLOR: Color = Color(0.016, 0.016, 0.02)
## Where a screen's original MarginContainer margins are stashed, so the
## safe-area inset is always applied to the baseline and never accumulates.
const SAFE_AREA_META: StringName = &"vanta_base_margins"

var _is_transitioning: bool = false
var _fade_rect: ColorRect


func _ready() -> void:
	# Transitions must work even while the game is paused.
	process_mode = Node.PROCESS_MODE_ALWAYS
	_build_fade_overlay()
	# The first scene is loaded by the engine, not by change_scene(), so it
	# never passes through the inset call below.
	get_tree().node_added.connect(_on_node_added)
	get_viewport().size_changed.connect(_apply_safe_area)
	_apply_safe_area.call_deferred()


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
		# Listeners parked their state on scene_transition_started and are
		# waiting for the matching finish. Without this CombatManager leaves
		# _gameplay_current false forever, _check_held_entry can never fire,
		# and enemies silently stop spawning with no visible cause. The scene
		# never actually changed, so report the one we are still on — not the
		# one that failed to load.
		var current_scene: Node = get_tree().current_scene
		if current_scene != null:
			EventBus.scene_transition_finished.emit(current_scene.scene_file_path)
		return

	get_tree().change_scene_to_packed(packed_scene)
	# Give the new scene one frame to enter the tree before revealing it.
	await get_tree().process_frame
	_apply_safe_area()

	await _fade_in()
	_is_transitioning = false
	EventBus.scene_transition_finished.emit(scene_path)


# --- Display safe area --------------------------------------------------------
##
## Android hands the app the WHOLE screen, including the strip behind a notch
## or punch-hole camera and the strip under the gesture bar. Nothing here read
## that, so on any modern phone the top row (world name, SHOP, MENU) sat under
## the cutout and the bottom row (GEAR, UPGRADES, the doors) sat under the
## gesture bar — on exactly the tall devices that dominate the install base.
##
## Every screen is built the same way: a full-bleed background, and a root
## MarginContainer holding all the UI. So the inset goes on that one node —
## the background still fills the display edge to edge, and only the controls
## move in. The scene's own margins are the baseline the inset is ADDED to,
## kept in metadata so re-applying on a resize can never accumulate.


func _on_node_added(node: Node) -> void:
	# The engine's initial scene, and nothing else — change_scene() insets its
	# own. Comparing against current_scene keeps this to one call per scene
	# rather than one per node in it.
	if node == get_tree().current_scene:
		_apply_safe_area.call_deferred()


func _apply_safe_area() -> void:
	var scene: Node = get_tree().current_scene
	if scene == null:
		return
	var margin: MarginContainer = scene.get_node_or_null("MarginContainer") as MarginContainer
	if margin == null:
		return

	if not margin.has_meta(SAFE_AREA_META):
		margin.set_meta(SAFE_AREA_META, Vector4(
			float(margin.get_theme_constant(&"margin_left")),
			float(margin.get_theme_constant(&"margin_top")),
			float(margin.get_theme_constant(&"margin_right")),
			float(margin.get_theme_constant(&"margin_bottom"))
		))
	var base: Vector4 = margin.get_meta(SAFE_AREA_META)
	var inset: Vector4 = _safe_area_inset()
	# The width cap is a SECOND inset term on the same margins, which is why it
	# lives here and not in a script on the MarginContainer itself. A separate
	# script writing margin_left/margin_right on this node, on this signal,
	# does not compose with the safe area — it replaces it. The per-scene
	# version connected later than this autoload, so it won, and it silently
	# dropped the cutout inset on exactly the phones that need it.
	var cap: float = _width_cap_inset(margin)
	margin.add_theme_constant_override(&"margin_left", int(base.x + inset.x + cap))
	margin.add_theme_constant_override(&"margin_top", int(base.y + inset.y))
	margin.add_theme_constant_override(&"margin_right", int(base.z + inset.z + cap))
	margin.add_theme_constant_override(&"margin_bottom", int(base.w + inset.w))


## Half the width past MAX_CONTENT_WIDTH, as a side inset. 0 on every phone.
##
## The layout is drawn for a 1080-wide portrait viewport, and stretch
## aspect="expand" only ever GROWS the viewport: a taller phone gets extra
## height, a tablet extra width, and nothing is ever cropped. That is right up
## to a point and wrong past it — at 3072 logical px (a 16:10 tablet in
## landscape) a bottom bar built for 1080 stretches to three times its width
## and the content it framed is a ribbon in an empty field. The layout audit
## passes throughout, because stranding is not overflow.
##
## This stopped being hypothetical at targetSdk 36: Android 16 ignores
## android:screenOrientation on displays 600dp and wider, so a portrait-locked
## game gets shown in landscape whether it asks to or not.
func _width_cap_inset(margin: MarginContainer) -> float:
	return maxf(0.0, margin.get_viewport_rect().size.x - MAX_CONTENT_WIDTH) * 0.5


## Left/top/right/bottom inset in VIEWPORT units.
##
## get_display_safe_area() is in physical window pixels and only means anything
## on a handheld — on desktop it returns the screen's work area, which has no
## relationship to the window, so this is gated to mobile rather than being
## allowed to compute nonsense insets everywhere else.
func _safe_area_inset() -> Vector4:
	var fake: String = OS.get_environment("VANTA_FAKE_SAFE_AREA")
	if not fake.is_empty():
		# A cutout simulator, so the inset path can be seen on a desktop run.
		# Without it this code only ever executes on hardware, which means it
		# would ship having never once been watched doing its job.
		var parts: PackedStringArray = fake.split(",")
		if parts.size() == 4:
			return Vector4(parts[0].to_float(), parts[1].to_float(),
				parts[2].to_float(), parts[3].to_float())
	if not OS.has_feature("mobile"):
		return Vector4.ZERO

	var window: Vector2i = DisplayServer.window_get_size()
	if window.x <= 0 or window.y <= 0:
		return Vector4.ZERO
	var safe: Rect2i = DisplayServer.get_display_safe_area()
	if safe.size.x <= 0 or safe.size.y <= 0:
		return Vector4.ZERO
	# canvas_items stretch means the viewport is in its own units, not pixels.
	var view: Vector2 = get_viewport().get_visible_rect().size
	var scale := Vector2(view.x / float(window.x), view.y / float(window.y))
	return Vector4(
		maxf(0.0, float(safe.position.x)) * scale.x,
		maxf(0.0, float(safe.position.y)) * scale.y,
		maxf(0.0, float(window.x - safe.position.x - safe.size.x)) * scale.x,
		maxf(0.0, float(window.y - safe.position.y - safe.size.y)) * scale.y
	)


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
