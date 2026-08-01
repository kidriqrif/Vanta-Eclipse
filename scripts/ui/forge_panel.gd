extends Control
## The Forge — a slide-up panel inside the gear scene (the shop's idiom).
## Pick a slot, pay 20 Void Scraps, get a random item at the current level.
## Lives inside the gear scene, so it fires no ui_overlay signals.

signal item_forged(item: Dictionary)

const OPEN_TOP: float = -1010.0
const CLOSED_TOP: float = 40.0
const OPEN_BOTTOM: float = 0.0
const CLOSED_BOTTOM: float = 1050.0
const SLIDE_TIME: float = 0.28
const DENY_COLOR: Color = Color(0.9, 0.4, 0.45)

var _is_open: bool = false
var _selected_slot: StringName = &""
var _slide_tween: Tween
var _slot_buttons: Dictionary = {}

@onready var _slot_row: HBoxContainer = %SlotRow
@onready var _cost_label: Label = %CostLabel
@onready var _forge_button: Button = %ForgeButton
@onready var _close_button: Button = %ForgeCloseButton


func _ready() -> void:
	visible = false
	offset_top = CLOSED_TOP
	offset_bottom = CLOSED_BOTTOM
	_close_button.pressed.connect(close)
	_forge_button.pressed.connect(_on_forge_pressed)
	EventBus.currency_changed.connect(_on_currency_changed)
	_build_slot_pickers()
	_refresh()


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
	_refresh()
	_animate_to(OPEN_TOP, OPEN_BOTTOM)


func close() -> void:
	if not _is_open:
		return
	_is_open = false
	_animate_to(CLOSED_TOP, CLOSED_BOTTOM)
	_slide_tween.chain().tween_callback(hide)


# --- Internals ---------------------------------------------------------------


func _build_slot_pickers() -> void:
	for slot: SlotDefinition in EquipmentManager.get_slots():
		if slot.sealed:
			continue
		var button := Button.new()
		button.toggle_mode = true
		button.custom_minimum_size = Vector2(236, 250)
		button.icon = slot.icon
		button.expand_icon = true
		button.text = slot.display_name
		button.add_theme_font_size_override("font_size", 24)
		button.pressed.connect(_on_slot_selected.bind(slot.id))
		_slot_row.add_child(button)
		_slot_buttons[slot.id] = button


func _on_slot_selected(slot: StringName) -> void:
	_selected_slot = slot
	for id: StringName in _slot_buttons:
		_slot_buttons[id].button_pressed = (id == slot)
	_refresh()


func _on_currency_changed(currency: StringName, _balance: float) -> void:
	if currency == CurrencyManager.VOID_SCRAPS:
		_refresh()


func _refresh() -> void:
	var cost: float = EquipmentManager.FORGE_COST
	var balance: float = CurrencyManager.get_balance(CurrencyManager.VOID_SCRAPS)
	var affordable: bool = balance >= cost
	var cost_text: String = "%s / %s Void Scraps" % [
		NumberFormat.format(balance), NumberFormat.format(cost)
	]
	if not affordable:
		cost_text += "  ·  Need %s more" % NumberFormat.format(cost - balance)
	_cost_label.text = cost_text
	_cost_label.add_theme_color_override(
		"font_color", UIPalette.ink() if affordable else DENY_COLOR
	)
	_forge_button.text = "FORGE  ·  Item Lv. %d" % CombatManager.enemy_level
	_forge_button.disabled = not affordable or _selected_slot == &""


func _on_forge_pressed() -> void:
	if _selected_slot == &"":
		return
	var item: Dictionary = EquipmentManager.forge(_selected_slot, CombatManager.enemy_level)
	if item.is_empty():
		return
	SettingsManager.vibrate(20)
	item_forged.emit(item)


func _animate_to(target_top: float, target_bottom: float) -> void:
	if _slide_tween != null and _slide_tween.is_valid():
		_slide_tween.kill()
	_slide_tween = create_tween().set_parallel(true)
	_slide_tween.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_slide_tween.tween_property(self, "offset_top", target_top, SLIDE_TIME)
	_slide_tween.tween_property(self, "offset_bottom", target_bottom, SLIDE_TIME)
