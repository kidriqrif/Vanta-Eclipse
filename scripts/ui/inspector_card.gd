extends CanvasLayer
## Inspector Card (pattern §7.1) — a player-summoned, multi-action item
## detail surface. Unlike the Centered Modal Dialog it has several actions
## (EQUIP / SALVAGE) and closes by CLOSE **or** scrim-tap — a deliberately
## different contract, so it is its own pattern, not a modal consumer.
##
## Lives inside the gear scene (CanvasLayer 60). Never fires ui_overlay
## signals: no boss gate can occur on the gear screen.

signal equip_requested(item_id: int)
signal unequip_requested(slot: StringName)
signal salvage_requested(item_id: int)

const ARM_SECONDS: float = 2.5
const UP_COLOR: Color = Color(0.4, 0.85, 0.5)
const DOWN_COLOR: Color = Color(0.9, 0.4, 0.45)
const MUTED: Color = Color(0.62, 0.57, 0.75)

var _item: Dictionary
var _is_equipped: bool
var _salvage_armed: bool = false
var _closing: bool = false

@onready var _scrim: ColorRect = %Scrim
@onready var _card: PanelContainer = %Card
@onready var _body: VBoxContainer = %CardBody
@onready var _salvage_button: Button = %SalvageButton
@onready var _equip_button: Button = %EquipButton


## Call BEFORE add_child. is_equipped = the shown item currently sits in its
## slot (offer UNEQUIP, hide SALVAGE — equipped items are never salvaged).
func setup(item: Dictionary, is_equipped: bool) -> void:
	_item = item
	_is_equipped = is_equipped


func _ready() -> void:
	var rarity: int = int(_item["rarity"])
	# Card border wears the item's rarity color.
	var style: StyleBoxFlat = _card.get_theme_stylebox("panel").duplicate()
	style.border_color = RarityStyle.color(rarity)
	style.border_width_left = 2
	style.border_width_top = 2
	style.border_width_right = 2
	style.border_width_bottom = 2
	_card.add_theme_stylebox_override("panel", style)

	_build_header(rarity)
	_build_affix_list()
	_build_compare()

	_equip_button.text = "UNEQUIP" if _is_equipped else "EQUIP"
	_equip_button.pressed.connect(_on_equip_pressed)
	_salvage_button.visible = not _is_equipped
	_salvage_button.pressed.connect(_on_salvage_pressed)
	%CloseButton.pressed.connect(close)
	_scrim.gui_input.connect(_on_scrim_input)

	_scrim.modulate.a = 0.0
	_card.pivot_offset = _card.size * 0.5
	_card.scale = Vector2(0.9, 0.9)
	_card.modulate.a = 0.0
	var tween: Tween = create_tween().set_parallel(true)
	tween.tween_property(_scrim, "modulate:a", 1.0, 0.18)
	tween.tween_property(_card, "scale", Vector2.ONE, 0.22) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(_card, "modulate:a", 1.0, 0.22)


func close() -> void:
	if _closing:
		return
	_closing = true
	var tween: Tween = create_tween().set_parallel(true)
	tween.tween_property(_card, "scale", Vector2(0.92, 0.92), 0.15) \
		.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	tween.tween_property(_card, "modulate:a", 0.0, 0.15)
	tween.tween_property(_scrim, "modulate:a", 0.0, 0.18)
	tween.chain().tween_callback(queue_free)


# --- Build ------------------------------------------------------------------


func _build_header(rarity: int) -> void:
	var pip_row: HBoxContainer = RarityStyle.make_pip_row(rarity)
	pip_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_body.add_child(pip_row)

	var name_label := Label.new()
	var slot_def: SlotDefinition = EquipmentManager.get_slot_definition(_item["slot"])
	var slot_name: String = slot_def.display_name if slot_def != null else str(_item["slot"])
	name_label.text = "%s %s" % [RarityStyle.rarity_name(rarity), slot_name]
	name_label.add_theme_color_override("font_color", RarityStyle.color(rarity))
	name_label.add_theme_font_size_override("font_size", 44)
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_body.add_child(name_label)

	var sub := Label.new()
	sub.text = "Item Level %d" % int(_item["item_level"])
	sub.add_theme_color_override("font_color", MUTED)
	sub.add_theme_font_size_override("font_size", 26)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_body.add_child(sub)


func _build_affix_list() -> void:
	var affixes: Dictionary = _item.get("affixes", {})
	for id: StringName in affixes:
		var row := Label.new()
		row.text = EquipmentManager.format_affix(id, affixes[id])
		row.add_theme_font_size_override("font_size", 30)
		row.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_body.add_child(row)


## When a different item is equipped in this slot, show the per-affix delta
## with arrow + sign + color (never color alone).
func _build_compare() -> void:
	if _is_equipped:
		return
	var equipped: Dictionary = EquipmentManager.get_equipped(_item["slot"])
	if equipped.is_empty():
		return
	var header := Label.new()
	header.text = "vs equipped:"
	header.add_theme_color_override("font_color", MUTED)
	header.add_theme_font_size_override("font_size", 24)
	header.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_body.add_child(header)

	var new_aff: Dictionary = _item.get("affixes", {})
	var old_aff: Dictionary = equipped.get("affixes", {})
	var stats: Dictionary = {}
	for id: StringName in new_aff:
		stats[id] = true
	for id: StringName in old_aff:
		stats[id] = true
	for id: StringName in stats:
		var delta: float = float(new_aff.get(id, 0.0)) - float(old_aff.get(id, 0.0))
		if is_zero_approx(delta):
			continue
		var up: bool = delta > 0.0
		var arrow: String = "▲" if up else "▼"
		var sign_str: String = "+" if up else "−"
		var affix: AffixDefinition = EquipmentManager.get_affix_definition(id)
		var shown: String = NumberFormat.format_percent(absf(delta)) if (
			affix != null and affix.is_percent) else NumberFormat.format(absf(delta))
		var label := Label.new()
		label.text = "%s %s %s%s" % [arrow, _affix_label(id), sign_str, shown]
		label.add_theme_color_override("font_color", UP_COLOR if up else DOWN_COLOR)
		label.add_theme_font_size_override("font_size", 26)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_body.add_child(label)


func _affix_label(id: StringName) -> String:
	var affix: AffixDefinition = EquipmentManager.get_affix_definition(id)
	if affix == null:
		return str(id)
	return affix.display_template.replace(" +{value}", "").replace("{value}", "")


# --- Actions ----------------------------------------------------------------


func _on_equip_pressed() -> void:
	if _is_equipped:
		unequip_requested.emit(_item["slot"])
	else:
		equip_requested.emit(int(_item["id"]))
	close()


func _on_salvage_pressed() -> void:
	# Two-Tap Arm for Epic+; Common/Rare salvage on the first tap.
	if int(_item["rarity"]) >= EquipmentManager.Rarity.EPIC and not _salvage_armed:
		_salvage_armed = true
		_salvage_button.text = "SALVAGE?"
		var timer: SceneTreeTimer = get_tree().create_timer(ARM_SECONDS)
		timer.timeout.connect(_disarm_salvage)
		return
	salvage_requested.emit(int(_item["id"]))
	close()


func _disarm_salvage() -> void:
	if is_instance_valid(_salvage_button) and _salvage_armed:
		_salvage_armed = false
		_salvage_button.text = "SALVAGE"


func _on_scrim_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed \
			and event.button_index == MOUSE_BUTTON_LEFT:
		close()
