extends Control
## The Arcade hub — the token meter and one card per minigame definition.
## Data-driven, so Milestones 10-12 add themselves by dropping a .tres.
## A full SceneManager scene, so it holds any boss gate through the existing
## scene-transition test. Never required to progress.

const ARCADE: Color = Color(0.65, 0.93, 0.42, 1)
## The lime deep/core pair the PLAY button is built from, matching the door
## button that leads here (gameplay.gd) and the Eclipse screen's own treatment.
const ARCADE_DEEP: Color = Color(0.24, 0.42, 0.16, 1)
const ARCADE_CORE: Color = Color(0.83, 0.98, 0.7, 1)
## Dark enough on the lime fill to clear the 7:1 the theme holds itself to.
const ARCADE_ON_ACCENT: Color = Color(0.05, 0.12, 0.03, 1)
const WARM_MUTED: Color = Color(0.78, 0.62, 0.62, 1)
const CARD_BG: Color = Color(0.1, 0.078, 0.157, 0.9)

## How often the "next token in" line and the PLAY buttons re-read the meter.
const TICK_SECONDS: float = 1.0
## The opt-in offer surfaced when the meter runs dry (M14 §2).
const OFFER_ID: StringName = &"arcade_token"

var _tick_timer: Timer
## id (StringName) -> the card's PLAY Button, so the tick can re-dress them
## without rebuilding the list (which would fight the ScrollContainer).
var _play_buttons: Dictionary = {}
## Ids that were locked when the list was built. Auto-attack keeps killing
## while this screen is open, so a card can cross its unlock level in place.
var _locked_ids: Array[StringName] = []
## accrue_tokens() can emit arcade_tokens_changed, which re-enters this
## refresh; the guard keeps that to a single pass.
var _refreshing: bool = false

@onready var _back_button: Button = %BackButton
@onready var _token_label: Label = %TokenLabel
@onready var _next_token_label: Label = %NextTokenLabel
@onready var _card_list: VBoxContainer = %CardList
@onready var _offer_button: Button = %OfferButton
@onready var _nebula: ColorRect = $VoidBackground/NebulaRect


func _ready() -> void:
	_apply_world_palette()
	_back_button.pressed.connect(_on_back_pressed)
	EventBus.arcade_tokens_changed.connect(_on_tokens_changed)
	_tick_timer = Timer.new()
	_tick_timer.wait_time = TICK_SECONDS
	_tick_timer.timeout.connect(_refresh_meter)
	add_child(_tick_timer)
	_tick_timer.start()
	_offer_button.pressed.connect(_on_offer_pressed)
	_build_cards()
	_refresh_meter()


# --- Meter --------------------------------------------------------------------


func _refresh_meter() -> void:
	if _refreshing:
		return
	_refreshing = true
	MinigameManager.accrue_tokens()
	var tokens: int = MinigameManager.tokens
	_token_label.text = "%d / %d" % [tokens, MinigameManager.TOKEN_CAP]
	var remaining: int = MinigameManager.seconds_until_next_token()
	_next_token_label.visible = remaining > 0
	if remaining > 0:
		_next_token_label.text = "Next token in %s" % _format_wait(remaining)
	# Re-dress the PLAY buttons in place: a token landing must re-enable play
	# without rebuilding the list under the player's thumb.
	for id: StringName in _play_buttons:
		var button: Button = _play_buttons[id]
		if is_instance_valid(button):
			_dress_play_button(button, MinigameManager.get_definition(id))
	_refreshing = false
	_refresh_offer()
	# Auto-attack keeps killing while this screen is open, so a locked card can
	# cross its unlock level in place. Only then is a full rebuild warranted.
	if _has_newly_unlocked():
		_build_cards()


## The opt-in token offer appears only when the meter is actually empty — the
## moment it helps. It is a bonus, never a gate: tokens still regenerate on
## their own timer whether or not the player ever taps it.
func _refresh_offer() -> void:
	var show: bool = MinigameManager.tokens <= 0 \
		and MonetizationManager.can_offer(OFFER_ID)
	_offer_button.visible = show
	if show:
		_offer_button.text = "CLAIM A TOKEN · FREE" if MonetizationManager.ads_removed() \
			else "WATCH FOR A TOKEN"


func _on_offer_pressed() -> void:
	if MonetizationManager.is_busy():
		return
	_offer_button.disabled = true
	_offer_button.text = "WATCHING…"
	var granted: float = await MonetizationManager.run_offer(OFFER_ID)
	if not is_inside_tree():
		return
	_offer_button.disabled = false
	if granted > 0.0:
		SettingsManager.vibrate(30)
	_refresh_meter()


func _has_newly_unlocked() -> bool:
	for id: StringName in _locked_ids:
		var definition: MinigameDefinition = MinigameManager.get_definition(id)
		if definition != null and MinigameManager.is_unlocked(definition):
			return true
	return false


## Compact and register-neutral: this reads inside a sentence ("Next token in
## <1m") AND inside an all-caps button face ("NEXT TOKEN <1m").
func _format_wait(seconds: int) -> String:
	@warning_ignore("integer_division")
	var minutes: int = seconds / 60
	if minutes < 1:
		return "<1m"
	return "%dm" % minutes


func _on_tokens_changed(_count: int) -> void:
	_refresh_meter()


# --- Cards --------------------------------------------------------------------


func _build_cards() -> void:
	for child in _card_list.get_children():
		child.queue_free()
	_play_buttons.clear()
	_locked_ids.clear()
	for definition: MinigameDefinition in MinigameManager.get_definitions():
		if not MinigameManager.is_unlocked(definition):
			_locked_ids.append(definition.id)
		_card_list.add_child(_make_card(definition))


func _make_card(definition: MinigameDefinition) -> PanelContainer:
	var unlocked: bool = MinigameManager.is_unlocked(definition)

	var card := PanelContainer.new()
	card.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style := StyleBoxFlat.new()
	style.set_corner_radius_all(14)
	style.set_content_margin_all(16)
	style.border_width_left = 4  # the arcade "one class" spine on every card
	# A locked card recedes by dimming its BACKGROUND, never the whole card:
	# modulating would drag the description under the contrast floor.
	if unlocked:
		style.bg_color = CARD_BG
		style.border_color = ARCADE
	else:
		style.bg_color = Color(CARD_BG.r, CARD_BG.g, CARD_BG.b, CARD_BG.a * 0.55)
		style.border_color = Color(ARCADE.r, ARCADE.g, ARCADE.b, 0.4)
	card.add_theme_stylebox_override("panel", style)

	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(box)

	# Row 1: icon + name + best.
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 16)
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(top)
	var icon := TextureRect.new()
	icon.texture = definition.icon
	icon.custom_minimum_size = Vector2(96, 96)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(icon)
	var name_label := Label.new()
	name_label.text = definition.display_name
	name_label.add_theme_color_override("font_color", UIPalette.ink())
	name_label.add_theme_font_size_override("font_size", 30)
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	name_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(name_label)
	if MinigameManager.has_best(definition.id):
		var best := Label.new()
		best.text = "Best: %s" % NumberFormat.format(MinigameManager.get_best(definition.id))
		best.add_theme_color_override("font_color", ARCADE)
		best.add_theme_font_size_override("font_size", 24)
		best.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		best.mouse_filter = Control.MOUSE_FILTER_IGNORE
		top.add_child(best)

	# Row 2: description.
	var description := Label.new()
	description.text = definition.description
	description.add_theme_color_override("font_color", UIPalette.muted())
	description.add_theme_font_size_override("font_size", 24)
	description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	description.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(description)

	# Row 3: action.
	if not unlocked:
		var locked := Label.new()
		locked.text = "REACHES Lv. %d" % definition.unlock_level
		locked.add_theme_color_override("font_color", WARM_MUTED)
		locked.add_theme_font_size_override("font_size", 24)
		locked.mouse_filter = Control.MOUSE_FILTER_IGNORE
		box.add_child(locked)
		return card
	var play := Button.new()
	play.custom_minimum_size = Vector2(220, 96)
	play.size_flags_horizontal = Control.SIZE_SHRINK_END
	play.pressed.connect(_on_play_pressed.bind(definition))
	_dress_play_button(play, definition)
	_play_buttons[definition.id] = play
	box.add_child(play)
	return card


## Set a PLAY button's affordability state. Every state carries a WORD, so it
## never depends on colour or on the disabled tint alone.
func _dress_play_button(button: Button, definition: MinigameDefinition) -> void:
	if definition == null:
		return
	if MinigameManager.has_token(definition.token_cost):
		button.disabled = false
		button.theme_type_variation = &"PrimaryButton"
		_paint_lime(button)
		button.text = "PLAY · %d TOKEN" % definition.token_cost
		return
	button.disabled = true
	button.theme_type_variation = &""
	for state: String in ["normal", "hover", "pressed"]:
		button.remove_theme_stylebox_override(state)
	button.remove_theme_color_override("font_color")
	button.remove_theme_color_override("font_hover_color")
	var remaining: int = MinigameManager.seconds_until_next_token()
	button.text = "NEXT TOKEN %s" % _format_wait(remaining) if remaining > 0 else "NO TOKENS"


## Repaint a PrimaryButton in the Arcade's lime.
##
## "Each door keeps its own accent — the tints never mix" is the rule the
## gameplay door buttons follow and that the Eclipse screen carries through to
## its COLLAPSE button. The Arcade was the one screen that stopped at the door:
## every card, icon and rule here is lime, and then the primary action on all
## four of them came out in the global pink.
func _paint_lime(button: Button) -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = ARCADE
	style.set_corner_radius_all(28)
	style.set_content_margin_all(16)
	style.border_width_bottom = 8
	style.border_color = ARCADE_DEEP
	style.shadow_color = Color(ARCADE.r, ARCADE.g, ARCADE.b, 0.32)
	style.shadow_size = 22
	for state: String in ["normal", "hover", "pressed"]:
		button.add_theme_stylebox_override(state, style)
	button.add_theme_color_override("font_color", ARCADE_ON_ACCENT)
	button.add_theme_color_override("font_hover_color", ARCADE_ON_ACCENT)


func _on_play_pressed(definition: MinigameDefinition) -> void:
	# Spend on entry, before the game loads: a crash mid-game costs the token
	# but can never double-spend it (UX §9).
	if not MinigameManager.try_spend_token(definition.token_cost):
		_refresh_meter()
		return
	SettingsManager.vibrate(20)
	MinigameManager.pending_id = definition.id
	SceneManager.change_scene(SceneManager.SCENE_MINIGAME_HOST)


# --- Misc ---------------------------------------------------------------------


func _apply_world_palette() -> void:
	var world: WorldDefinition = WorldManager.get_world_for_level(CombatManager.enemy_level)
	var material: ShaderMaterial = _nebula.material
	material.set_shader_parameter("deep_color", world.deep_color)
	material.set_shader_parameter("nebula_color", world.nebula_color)
	material.set_shader_parameter("accent_color", world.accent_color)


func _on_back_pressed() -> void:
	SceneManager.change_scene(SceneManager.SCENE_GAMEPLAY)
