extends Control
## The Shop — opt-in bonus offers, purchases, and tap-trail cosmetics.
##
## Nothing here gates a mechanic. Offers are bonuses the player may decline
## freely; cosmetics change nothing but the look of a tap.

const IVORY: Color = Color(0.906, 0.886, 0.973, 1)
const MUTED: Color = Color(0.62, 0.57, 0.75, 1)
const WARN: Color = Color(0.98, 0.75, 0.45, 1)
const CARD_BG: Color = Color(0.1, 0.078, 0.157, 0.9)
const TAB_ACTIVE_BG: Color = Color(0.16, 0.14, 0.24, 1)

var _offers_tab_active: bool = true
var _pending_label: Label

@onready var _back_button: Button = %BackButton
@onready var _shard_label: Label = %ShardLabel
@onready var _dev_banner: PanelContainer = %DevBanner
@onready var _offers_tab: Button = %OffersTab
@onready var _cosmetics_tab: Button = %CosmeticsTab
@onready var _item_list: VBoxContainer = %ItemList
@onready var _nebula: ColorRect = $VoidBackground/NebulaRect


func _ready() -> void:
	_apply_world_palette()
	# The banner is not subtle on purpose: while the stub providers are live,
	# nothing is charged and no real ad is shown.
	_dev_banner.visible = MonetizationManager.USE_STUB_PROVIDERS
	_back_button.pressed.connect(_on_back_pressed)
	_offers_tab.pressed.connect(func() -> void: _set_tab(true))
	_cosmetics_tab.pressed.connect(func() -> void: _set_tab(false))
	EventBus.currency_changed.connect(_on_currency_changed)
	EventBus.purchase_completed.connect(func(_id: StringName) -> void: _rebuild())
	EventBus.cosmetic_equipped.connect(func(_id: StringName) -> void: _rebuild())
	_refresh_shards()
	_set_tab(true)


func _set_tab(offers: bool) -> void:
	_offers_tab_active = offers
	_style_tab(_offers_tab, offers)
	_style_tab(_cosmetics_tab, not offers)
	_rebuild()


func _style_tab(button: Button, active: bool) -> void:
	var style := StyleBoxFlat.new()
	style.set_corner_radius_all(12)
	style.set_content_margin_all(10)
	if active:
		style.bg_color = TAB_ACTIVE_BG
		style.border_width_bottom = 4
		style.border_color = IVORY
	else:
		style.bg_color = Color(0.1, 0.078, 0.157, 0.6)
	button.add_theme_stylebox_override("normal", style)
	button.add_theme_stylebox_override("focus", style)
	var lit: StyleBoxFlat = style.duplicate()
	lit.bg_color = TAB_ACTIVE_BG if active else Color(0.14, 0.12, 0.21, 0.85)
	button.add_theme_stylebox_override("hover", lit)
	button.add_theme_stylebox_override("pressed", lit)
	button.add_theme_color_override("font_color", IVORY if active else MUTED)
	button.add_theme_color_override("font_hover_color", IVORY if active else MUTED)


func _refresh_shards() -> void:
	_shard_label.text = "%s Shards" % NumberFormat.format(
		CurrencyManager.get_balance(CurrencyManager.ASTRAL_SHARDS)
	)


func _on_currency_changed(currency: StringName, _balance: float) -> void:
	if currency == CurrencyManager.ASTRAL_SHARDS:
		_refresh_shards()
		if not _offers_tab_active:
			_rebuild()


# --- List ---------------------------------------------------------------------


func _rebuild() -> void:
	for child in _item_list.get_children():
		child.queue_free()
	_pending_label = null
	if _offers_tab_active:
		for placement: AdPlacementDefinition in MonetizationManager.get_placements():
			_item_list.add_child(_make_offer_card(placement))
		for product: ShopProductDefinition in MonetizationManager.get_products():
			_item_list.add_child(_make_product_card(product))
	else:
		for cosmetic: CosmeticDefinition in MonetizationManager.get_cosmetics():
			_item_list.add_child(_make_cosmetic_card(cosmetic))


func _card() -> PanelContainer:
	var card := PanelContainer.new()
	card.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style := StyleBoxFlat.new()
	style.bg_color = CARD_BG
	style.set_corner_radius_all(14)
	style.set_content_margin_all(16)
	style.border_width_left = 4
	style.border_color = Color(IVORY.r, IVORY.g, IVORY.b, 0.35)
	card.add_theme_stylebox_override("panel", style)
	return card


func _body(card: PanelContainer) -> VBoxContainer:
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(box)
	return box


func _title_row(box: VBoxContainer, title: String, right: String, ink: Color) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(row)
	var name_label := Label.new()
	name_label.text = title
	name_label.add_theme_color_override("font_color", IVORY)
	name_label.add_theme_font_size_override("font_size", 30)
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(name_label)
	if right == "":
		return
	var right_label := Label.new()
	right_label.text = right
	right_label.add_theme_color_override("font_color", ink)
	right_label.add_theme_font_size_override("font_size", 24)
	right_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(right_label)


func _description(box: VBoxContainer, text: String) -> void:
	var label := Label.new()
	label.text = text
	label.add_theme_color_override("font_color", MUTED)
	label.add_theme_font_size_override("font_size", 24)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(label)


func _action_button(text: String, enabled: bool) -> Button:
	var button := Button.new()
	button.custom_minimum_size = Vector2(240, 96)
	button.size_flags_horizontal = Control.SIZE_SHRINK_END
	button.text = text
	button.disabled = not enabled
	if enabled:
		button.theme_type_variation = &"PrimaryButton"
	return button


func _make_offer_card(placement: AdPlacementDefinition) -> PanelContainer:
	var card: PanelContainer = _card()
	var box: VBoxContainer = _body(card)
	var left: int = MonetizationManager.offers_left(placement.id)
	_title_row(box, placement.display_name, "%d LEFT TODAY" % left, MUTED)
	_description(box, placement.description)
	# Owning remove_ads turns the watch into a one-tap grant — the word on the
	# button changes so the state is never carried by colour alone.
	var free: bool = MonetizationManager.ads_removed()
	var label: String = ("CLAIM · FREE" if free else "WATCH") if left > 0 else "NONE LEFT TODAY"
	var button: Button = _action_button(label, left > 0)
	if left > 0:
		button.pressed.connect(_on_offer_pressed.bind(placement.id, button))
	box.add_child(button)
	return card


func _make_product_card(product: ShopProductDefinition) -> PanelContainer:
	var card: PanelContainer = _card()
	var box: VBoxContainer = _body(card)
	var owned: bool = product.kind == ShopProductDefinition.Kind.ENTITLEMENT \
		and MonetizationManager.has_entitlement(product.id)
	_title_row(box, product.display_name, "" if owned else product.price_text, IVORY)
	_description(box, product.description)
	if owned:
		var marker := Label.new()
		marker.text = "● OWNED"
		marker.add_theme_color_override("font_color", MUTED)
		marker.add_theme_font_size_override("font_size", 24)
		marker.size_flags_horizontal = Control.SIZE_SHRINK_END
		marker.mouse_filter = Control.MOUSE_FILTER_IGNORE
		box.add_child(marker)
		return card
	var button: Button = _action_button("BUY", true)
	button.pressed.connect(_on_purchase_pressed.bind(product.id, button))
	box.add_child(button)
	return card


func _make_cosmetic_card(cosmetic: CosmeticDefinition) -> PanelContainer:
	var card: PanelContainer = _card()
	var box: VBoxContainer = _body(card)
	var owned: bool = MonetizationManager.owns_cosmetic(cosmetic.id)
	var equipped: bool = MonetizationManager.get_equipped_cosmetic_id() == cosmetic.id
	var price: String = "" if owned else "%s Shards" % NumberFormat.format(cosmetic.shard_price)
	_title_row(box, cosmetic.display_name, price, IVORY)

	# A live swatch of the actual trail and damage-number colours.
	var swatch_row := HBoxContainer.new()
	swatch_row.add_theme_constant_override("separation", 10)
	swatch_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(swatch_row)
	for color: Color in [cosmetic.trail_color, cosmetic.number_color]:
		var swatch := Panel.new()
		swatch.custom_minimum_size = Vector2(64, 32)
		swatch.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var style := StyleBoxFlat.new()
		style.bg_color = color
		style.set_corner_radius_all(8)
		swatch.add_theme_stylebox_override("panel", style)
		swatch_row.add_child(swatch)
	var swatch_note := Label.new()
	swatch_note.text = "trail · numbers"
	swatch_note.add_theme_color_override("font_color", MUTED)
	swatch_note.add_theme_font_size_override("font_size", 24)
	swatch_note.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	swatch_note.mouse_filter = Control.MOUSE_FILTER_IGNORE
	swatch_row.add_child(swatch_note)

	if equipped:
		var marker := Label.new()
		marker.text = "● EQUIPPED"
		marker.add_theme_color_override("font_color", IVORY)
		marker.add_theme_font_size_override("font_size", 24)
		marker.size_flags_horizontal = Control.SIZE_SHRINK_END
		marker.mouse_filter = Control.MOUSE_FILTER_IGNORE
		box.add_child(marker)
		return card
	if owned:
		var equip: Button = _action_button("EQUIP", true)
		equip.pressed.connect(func() -> void: MonetizationManager.equip_cosmetic(cosmetic.id))
		box.add_child(equip)
		return card
	var affordable: bool = CurrencyManager.can_afford(
		CurrencyManager.ASTRAL_SHARDS, cosmetic.shard_price
	)
	var buy: Button = _action_button(
		"BUY" if affordable else "NEED MORE SHARDS", affordable
	)
	if affordable:
		buy.pressed.connect(func() -> void:
			if MonetizationManager.buy_cosmetic(cosmetic.id):
				MonetizationManager.equip_cosmetic(cosmetic.id)
			_rebuild()
		)
	box.add_child(buy)
	return card


# --- Actions ------------------------------------------------------------------


func _on_offer_pressed(id: StringName, button: Button) -> void:
	if MonetizationManager.is_busy():
		return
	button.disabled = true
	button.text = "WATCHING…"
	var granted: float = await MonetizationManager.run_offer(id)
	if granted > 0.0:
		SettingsManager.vibrate(30)
	_rebuild()


func _on_purchase_pressed(id: StringName, button: Button) -> void:
	if MonetizationManager.is_busy():
		return
	button.disabled = true
	button.text = "PURCHASING…"
	var bought: bool = await MonetizationManager.purchase(id)
	if bought:
		SettingsManager.vibrate(40)
	_rebuild()


func _apply_world_palette() -> void:
	var world: WorldDefinition = WorldManager.get_world_for_level(CombatManager.enemy_level)
	var material: ShaderMaterial = _nebula.material
	material.set_shader_parameter("deep_color", world.deep_color)
	material.set_shader_parameter("nebula_color", world.nebula_color)
	material.set_shader_parameter("accent_color", world.accent_color)


func _on_back_pressed() -> void:
	SceneManager.change_scene(SceneManager.SCENE_GAMEPLAY)
