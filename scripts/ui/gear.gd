extends Control
## The Gear screen — 7 equipment slots, scrolling inventory, Void Scraps,
## and the Forge. A full SceneManager scene: entering it fires
## scene_transition_started (which holds any boss gate) and BACK re-enters
## gameplay, re-checking the held gate — no ui_overlay plumbing needed.

const INSPECTOR_CARD_SCENE: PackedScene = preload("res://scenes/gear/inspector_card.tscn")
const LOCK_GLYPH: Texture2D = preload("res://sprites/ui/lock_glyph.svg")
const RELIC_SLOT_ICON: Texture2D = preload("res://sprites/ui/slot_relic.svg")
const SLOT_TILE_SIZE: Vector2 = Vector2(236, 250)
const ROW_HEIGHT: float = 140.0
const ARM_SECONDS: float = 2.5
const EQUIP_BG: Color = Color(0.086, 0.063, 0.133, 0.92)
const EMPTY_BG: Color = Color(0.06, 0.05, 0.09, 0.85)
const SEALED_BG: Color = Color(0.05, 0.045, 0.07, 0.9)
const MUTED: Color = Color(0.62, 0.57, 0.75)

var _commons_armed: bool = false

@onready var _slot_grid: GridContainer = %SlotGrid
@onready var _inventory_list: VBoxContainer = %InventoryList
@onready var _empty_label: Label = %EmptyLabel
@onready var _scraps_label: Label = %ScrapsLabel
@onready var _back_button: Button = %BackButton
@onready var _forge_button: Button = %ForgeButton
@onready var _salvage_commons_button: Button = %SalvageCommonsButton
@onready var _forge_panel: Control = %ForgePanel
@onready var _relic_panel: Control = %RelicCollectionPanel
@onready var _nebula: ColorRect = $VoidBackground/NebulaRect


func _ready() -> void:
	_apply_world_palette()
	_back_button.pressed.connect(_on_back_pressed)
	_forge_button.pressed.connect(_forge_panel.toggle)
	_salvage_commons_button.pressed.connect(_on_salvage_commons)
	_forge_panel.item_forged.connect(_on_item_forged)
	EventBus.inventory_changed.connect(_refresh)
	EventBus.item_equipped.connect(_on_item_equipped)
	EventBus.currency_changed.connect(_on_currency_changed)
	EventBus.relics_awakened.connect(_refresh)
	EventBus.relic_dropped.connect(func(_id: StringName) -> void: _refresh())
	EventBus.active_relic_changed.connect(func(_id: StringName) -> void: _refresh())
	_refresh()


func _refresh() -> void:
	_scraps_label.text = NumberFormat.format(
		CurrencyManager.get_balance(CurrencyManager.VOID_SCRAPS)
	)
	_rebuild_slots()
	_rebuild_inventory()
	_refresh_commons_button()


func _refresh_commons_button() -> void:
	var count: int = EquipmentManager.get_commons_count()
	_salvage_commons_button.disabled = count == 0
	if _commons_armed and count > 0:
		var yield_each: int = EquipmentManager.get_salvage_yield(EquipmentManager.Rarity.COMMON)
		_salvage_commons_button.text = "TAP AGAIN: %d → +%d" % [count, count * yield_each]
	else:
		_commons_armed = false
		_salvage_commons_button.text = "Salvage Commons (%d)" % count


# --- Slots -------------------------------------------------------------------


func _rebuild_slots() -> void:
	for child in _slot_grid.get_children():
		child.queue_free()
	for slot: SlotDefinition in EquipmentManager.get_slots():
		if slot.id == &"relic" and RelicManager.is_awakened():
			_slot_grid.add_child(_make_relic_tile())
		else:
			_slot_grid.add_child(_make_slot_tile(slot))


## The awakened relic tile (gold Aureate frame) — opens the Relic Collection.
func _make_relic_tile() -> Button:
	var tile := Button.new()
	tile.custom_minimum_size = SLOT_TILE_SIZE
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.10, 0.086, 0.055, 0.92)
	style.set_corner_radius_all(16)
	style.set_content_margin_all(12)
	style.set_border_width_all(3)
	style.border_color = Color(0.961, 0.769, 0.318, 0.95)
	style.shadow_color = Color(0.961, 0.769, 0.318, 0.3)
	# 12 is the single sanctioned relic-glow step (visual §1.3/§5); the empty
	# tile softens further below so it never out-glows an attuned one.
	style.shadow_size = 12
	tile.add_theme_stylebox_override("normal", style)
	tile.add_theme_stylebox_override("hover", style)
	tile.add_theme_stylebox_override("pressed", style)

	var box := VBoxContainer.new()
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_theme_constant_override("separation", 6)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	tile.add_child(box)

	var kicker := Label.new()
	kicker.text = "RELIC"
	kicker.add_theme_color_override("font_color", Color(0.984, 0.906, 0.659, 1))
	kicker.add_theme_font_size_override("font_size", 24)
	kicker.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(kicker)

	var active_id: StringName = RelicManager.get_active_id()
	var icon := TextureRect.new()
	icon.custom_minimum_size = Vector2(88, 88)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(icon)
	var sub := Label.new()
	sub.add_theme_font_size_override("font_size", 24)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(sub)
	if active_id != &"":
		var def: RelicDefinition = RelicManager.get_definition(active_id)
		icon.texture = def.sigil
		sub.text = def.display_name
	else:
		# Empty slot: the sigil is a faint prompt, not a lit relic — modulate
		# it down and dim the tile's own glow so it never reads as attuned
		# (visual §1.3).
		icon.texture = RELIC_SLOT_ICON
		icon.modulate = Color(0.7, 0.62, 0.35, 0.30)
		style.shadow_size = 8
		sub.text = "Tap to attune"
		sub.add_theme_color_override("font_color", MUTED)
	tile.pressed.connect(_relic_panel.toggle)
	return tile


func _make_slot_tile(slot: SlotDefinition) -> Button:
	var tile := Button.new()
	tile.custom_minimum_size = SLOT_TILE_SIZE
	var equipped: Dictionary = EquipmentManager.get_equipped(slot.id)
	var style := StyleBoxFlat.new()
	style.set_corner_radius_all(16)
	style.set_content_margin_all(12)
	if slot.sealed:
		style.bg_color = SEALED_BG
		style.set_border_width_all(2)
		style.border_color = Color(0.2, 0.19, 0.24, 0.7)
	elif not equipped.is_empty():
		style.bg_color = EQUIP_BG
		style.set_border_width_all(3)
		style.border_color = RarityStyle.color(int(equipped["rarity"]))
		var glow: Color = RarityStyle.color(int(equipped["rarity"]))
		glow.a = 0.22
		style.shadow_color = glow
		style.shadow_size = 8
	else:
		style.bg_color = EMPTY_BG
		style.set_border_width_all(2)
		style.border_color = Color(0.235, 0.18, 0.361, 0.6)
	tile.add_theme_stylebox_override("normal", style)
	tile.add_theme_stylebox_override("hover", style)
	tile.add_theme_stylebox_override("pressed", style)

	var box := VBoxContainer.new()
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_theme_constant_override("separation", 6)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	tile.add_child(box)

	var icon := TextureRect.new()
	icon.texture = slot.icon
	icon.custom_minimum_size = Vector2(88, 88)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if slot.sealed:
		icon.modulate = Color(0.4, 0.4, 0.45, 1)
	box.add_child(icon)

	var name_label := Label.new()
	name_label.text = slot.display_name
	name_label.add_theme_font_size_override("font_size", 24)
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(name_label)

	if slot.sealed:
		var flavor := Label.new()
		flavor.text = slot.sealed_flavor
		flavor.add_theme_color_override("font_color", MUTED)
		flavor.add_theme_font_size_override("font_size", 24)
		flavor.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		flavor.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		box.add_child(flavor)
		# A lock glyph bottom-right marks the slot sealed beyond the tint.
		var lock := TextureRect.new()
		lock.texture = LOCK_GLYPH
		lock.custom_minimum_size = Vector2(40, 40)
		lock.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		lock.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT
		lock.mouse_filter = Control.MOUSE_FILTER_IGNORE
		lock.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		lock.offset_left = -52
		lock.offset_top = -52
		lock.offset_right = -12
		lock.offset_bottom = -12
		tile.add_child(lock)
		tile.pressed.connect(_open_sealed_card.bind(slot))
	elif not equipped.is_empty():
		var pips: HBoxContainer = RarityStyle.make_pip_row(int(equipped["rarity"]))
		pips.alignment = BoxContainer.ALIGNMENT_CENTER
		box.add_child(pips)
		var stat := Label.new()
		stat.text = RarityStyle.key_stat_line(equipped)
		stat.add_theme_color_override("font_color", MUTED)
		stat.add_theme_font_size_override("font_size", 24)
		stat.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		box.add_child(stat)
		tile.pressed.connect(_open_card.bind(equipped, true))
	else:
		var empty := Label.new()
		empty.text = "Empty"
		empty.add_theme_color_override("font_color", MUTED)
		empty.add_theme_font_size_override("font_size", 24)
		empty.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		box.add_child(empty)
		tile.pressed.connect(_open_empty_card.bind(slot))
	return tile


# --- Inventory ---------------------------------------------------------------


func _rebuild_inventory() -> void:
	for child in _inventory_list.get_children():
		if child != _empty_label:
			child.queue_free()
	var inventory: Array = EquipmentManager.get_inventory()
	_empty_label.visible = inventory.is_empty()
	for item: Dictionary in inventory:
		_inventory_list.add_child(_make_inventory_row(item))


func _make_inventory_row(item: Dictionary) -> Button:
	var rarity: int = int(item["rarity"])
	var row := Button.new()
	row.custom_minimum_size = Vector2(0, ROW_HEIGHT)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.10, 0.078, 0.157, 0.9)
	style.set_corner_radius_all(14)
	style.set_content_margin_all(14)
	style.content_margin_left = 22.0
	row.add_theme_stylebox_override("normal", style)
	row.add_theme_stylebox_override("hover", style)
	row.add_theme_stylebox_override("pressed", style)

	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 16)
	hbox.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hbox.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	row.add_child(hbox)

	var accent := ColorRect.new()
	accent.color = RarityStyle.color(rarity)
	accent.custom_minimum_size = Vector2(6, 0)
	accent.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hbox.add_child(accent)

	var slot_def: SlotDefinition = EquipmentManager.get_slot_definition(item["slot"])
	var icon := TextureRect.new()
	icon.texture = slot_def.icon if slot_def != null else null
	icon.custom_minimum_size = Vector2(64, 64)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hbox.add_child(icon)

	var info := VBoxContainer.new()
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	info.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	info.add_theme_constant_override("separation", 4)
	info.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hbox.add_child(info)

	info.add_child(RarityStyle.make_pip_row(rarity))
	var slot_name: String = slot_def.display_name if slot_def != null else str(item["slot"])
	var name_label := Label.new()
	name_label.text = "%s %s" % [RarityStyle.rarity_name(rarity), slot_name]
	name_label.add_theme_color_override("font_color", RarityStyle.color(rarity))
	name_label.add_theme_font_size_override("font_size", 30)
	info.add_child(name_label)
	var stat := Label.new()
	stat.text = RarityStyle.key_stat_line(item)
	stat.add_theme_color_override("font_color", MUTED)
	stat.add_theme_font_size_override("font_size", 24)
	info.add_child(stat)

	# Durable NEW tag for items not yet seen on the Gear screen.
	if EquipmentManager.is_item_unseen(item):
		var new_pill := Label.new()
		new_pill.text = "NEW"
		new_pill.add_theme_color_override("font_color", Color(0.655, 0.545, 0.98, 1))
		new_pill.add_theme_font_size_override("font_size", 24)
		new_pill.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		hbox.add_child(new_pill)

	row.pressed.connect(_open_card.bind(item, false))
	return row


# --- Actions -----------------------------------------------------------------


func _open_card(item: Dictionary, is_equipped: bool) -> void:
	var card: Node = INSPECTOR_CARD_SCENE.instantiate()
	card.setup(item, is_equipped)
	card.equip_requested.connect(_on_equip_requested)
	card.unequip_requested.connect(_on_unequip_requested)
	card.salvage_requested.connect(_on_salvage_requested)
	add_child(card)


func _open_empty_card(slot: SlotDefinition) -> void:
	var card: Node = INSPECTOR_CARD_SCENE.instantiate()
	card.setup_info(
		"Empty %s" % slot.display_name, "",
		"Defeat enemies to find %s gear, then equip it here." % slot.display_name.to_lower()
	)
	add_child(card)


func _open_sealed_card(slot: SlotDefinition) -> void:
	var card: Node = INSPECTOR_CARD_SCENE.instantiate()
	card.setup_info("%s — Sealed" % slot.display_name, slot.sealed_flavor,
		"This slot awakens in a later world.")
	add_child(card)


func _on_equip_requested(item_id: int) -> void:
	EquipmentManager.equip(item_id)
	SettingsManager.vibrate(15)


func _on_unequip_requested(slot: StringName) -> void:
	EquipmentManager.unequip(slot)


func _on_salvage_requested(item_id: int) -> void:
	EquipmentManager.salvage(item_id)


func _on_salvage_commons() -> void:
	if EquipmentManager.get_commons_count() == 0:
		return
	# Bulk salvage is always armed — one tap to arm, a second to commit.
	if not _commons_armed:
		_commons_armed = true
		_refresh_commons_button()
		get_tree().create_timer(ARM_SECONDS).timeout.connect(_disarm_commons)
		return
	_commons_armed = false
	EquipmentManager.salvage_all_commons()


func _disarm_commons() -> void:
	if _commons_armed:
		_commons_armed = false
		_refresh_commons_button()


func _on_item_forged(item: Dictionary) -> void:
	_forge_panel.close()
	_open_card(item, false)


func _on_item_equipped(_slot: StringName) -> void:
	_refresh()


func _on_currency_changed(currency: StringName, _balance: float) -> void:
	if currency == CurrencyManager.VOID_SCRAPS:
		_scraps_label.text = NumberFormat.format(_balance)


## Stay under the current world's sky for continuity (the material is
## per-instance since M5, so this never touches the gameplay/menu skies).
func _apply_world_palette() -> void:
	var world: WorldDefinition = WorldManager.get_world_for_level(CombatManager.enemy_level)
	var material: ShaderMaterial = _nebula.material
	material.set_shader_parameter("deep_color", world.deep_color)
	material.set_shader_parameter("nebula_color", world.nebula_color)
	material.set_shader_parameter("accent_color", world.accent_color)


func _on_back_pressed() -> void:
	# Everything viewed this visit is now seen — clears the GEAR pill and
	# NEW tags. Durable: the flags persist through the save.
	EquipmentManager.mark_all_seen()
	SaveManager.save_game()
	SceneManager.change_scene(SceneManager.SCENE_GAMEPLAY)
