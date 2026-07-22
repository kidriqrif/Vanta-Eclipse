extends Control
## Relic Collection — a slide-up panel inside the gear scene (the shop/forge
## idiom). Lists owned relics; one is active at a time. Attune/detach is
## free and reversible. Lives inside the gear scene, so it fires no
## ui_overlay signals (no boss gate can occur there).

const OPEN_TOP: float = -1010.0
const CLOSED_TOP: float = 40.0
const OPEN_BOTTOM: float = 0.0
const CLOSED_BOTTOM: float = 1050.0
const SLIDE_TIME: float = 0.28
const RELIC_IVORY: Color = Color(0.984, 0.906, 0.659, 1)
const RELIC_GOLD: Color = Color(0.961, 0.769, 0.318, 1)
const MUTED: Color = Color(0.62, 0.57, 0.75, 1)

var _is_open: bool = false
var _slide_tween: Tween

@onready var _list: VBoxContainer = %RelicList
@onready var _empty_label: Label = %RelicEmptyLabel
@onready var _close_button: Button = %RelicCloseButton


func _ready() -> void:
	visible = false
	offset_top = CLOSED_TOP
	offset_bottom = CLOSED_BOTTOM
	_close_button.pressed.connect(close)
	EventBus.active_relic_changed.connect(_on_changed)
	EventBus.relic_dropped.connect(_on_changed)


func toggle() -> void:
	if _is_open:
		close()
	else:
		open()


func open() -> void:
	if _is_open:
		return
	_is_open = true
	visible = true
	_rebuild()
	RelicManager.mark_all_seen()
	_animate_to(OPEN_TOP, OPEN_BOTTOM)


func close() -> void:
	if not _is_open:
		return
	_is_open = false
	_animate_to(CLOSED_TOP, CLOSED_BOTTOM)
	_slide_tween.chain().tween_callback(hide)


# --- Internals ---------------------------------------------------------------


func _on_changed(_id: StringName) -> void:
	if _is_open:
		_rebuild()


func _rebuild() -> void:
	for child in _list.get_children():
		if child != _empty_label:
			child.queue_free()
	var owned: Array[Dictionary] = RelicManager.get_owned()
	_empty_label.visible = owned.is_empty()
	var active: StringName = RelicManager.get_active_id()
	for entry: Dictionary in owned:
		var def: RelicDefinition = RelicManager.get_definition(entry["id"])
		if def != null:
			_list.add_child(_make_row(def, def.id == active))


func _make_row(def: RelicDefinition, is_active: bool) -> PanelContainer:
	var row := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.10, 0.086, 0.055, 0.92)
	style.set_corner_radius_all(16)
	style.set_content_margin_all(18)
	style.set_border_width_all(2)
	style.border_color = RELIC_GOLD if is_active else Color(0.78, 0.58, 0.2, 0.5)
	row.add_theme_stylebox_override("panel", style)

	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 18)
	row.add_child(hbox)

	var sigil := TextureRect.new()
	sigil.texture = def.sigil
	sigil.custom_minimum_size = Vector2(72, 72)
	sigil.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	sigil.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	sigil.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	hbox.add_child(sigil)

	var info := VBoxContainer.new()
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	info.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	info.add_theme_constant_override("separation", 4)
	hbox.add_child(info)
	var name_row := HBoxContainer.new()
	name_row.add_theme_constant_override("separation", 12)
	info.add_child(name_row)
	var name_label := Label.new()
	name_label.text = def.display_name
	name_label.add_theme_color_override("font_color", RELIC_IVORY)
	name_label.add_theme_font_size_override("font_size", 30)
	name_row.add_child(name_label)
	if is_active:
		var active_pill := Label.new()
		active_pill.text = "● ACTIVE"
		active_pill.add_theme_color_override("font_color", RELIC_GOLD)
		active_pill.add_theme_font_size_override("font_size", 24)
		name_row.add_child(active_pill)
	var effect := Label.new()
	effect.text = def.effect_description
	effect.add_theme_color_override("font_color", MUTED)
	effect.add_theme_font_size_override("font_size", 24)
	effect.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.add_child(effect)

	var button := Button.new()
	button.custom_minimum_size = Vector2(220, 110)
	button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	if is_active:
		button.text = "DETACH"
		button.pressed.connect(RelicManager.detach)
	else:
		button.theme_type_variation = &"PrimaryButton"
		button.text = "ATTUNE"
		button.pressed.connect(func() -> void: RelicManager.attune(def.id))
	hbox.add_child(button)
	return row


func _animate_to(target_top: float, target_bottom: float) -> void:
	if _slide_tween != null and _slide_tween.is_valid():
		_slide_tween.kill()
	_slide_tween = create_tween().set_parallel(true)
	_slide_tween.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_slide_tween.tween_property(self, "offset_top", target_top, SLIDE_TIME)
	_slide_tween.tween_property(self, "offset_bottom", target_bottom, SLIDE_TIME)
