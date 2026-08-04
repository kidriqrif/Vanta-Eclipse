extends Control
## The Shop — opt-in bonus offers, purchases, and tap-trail cosmetics.
##
## Nothing here gates a mechanic. Offers are bonuses the player may decline
## freely; cosmetics change nothing but the look of a tap.


var _offers_tab_active: bool = true
var _pending_label: Label

@onready var _back_button: Button = %BackButton
@onready var _shard_label: Label = %ShardLabel
@onready var _dev_banner: PanelContainer = %DevBanner
@onready var _offers_tab: Button = %OffersTab
@onready var _cosmetics_tab: Button = %CosmeticsTab
@onready var _item_list: VBoxContainer = %ItemList


func _ready() -> void:
	# The banner warns whoever is BUILDING the game, so it is gated on a debug
	# build, not on the stub flag alone. Keyed only to USE_STUB_PROVIDERS it
	# would have shipped "DEVELOPMENT BUILD" to players in any release that
	# still had the stubs in it — which is exactly the release this branch
	# exists to make safe.
	_dev_banner.visible = MonetizationManager.USE_STUB_PROVIDERS and OS.is_debug_build()
	# With no real billing there is nothing honest to put on the OFFERS tab, so
	# the Shop becomes a single-tab cosmetics screen rather than a tab bar with
	# one dead half.
	var paid: bool = MonetizationManager.PAID_SURFACES_AVAILABLE
	_offers_tab.visible = paid
	_cosmetics_tab.visible = paid
	_back_button.pressed.connect(_on_back_pressed)
	_offers_tab.pressed.connect(func() -> void: _set_tab(true))
	_cosmetics_tab.pressed.connect(func() -> void: _set_tab(false))
	EventBus.currency_changed.connect(_on_currency_changed)
	EventBus.purchase_completed.connect(func(_id: StringName) -> void: _rebuild())
	EventBus.cosmetic_equipped.connect(func(_id: StringName) -> void: _rebuild())
	# Watching an ad burns one of that placement's daily offers, so the
	# "N left" line every offer row renders from offers_left() goes stale the
	# moment a reward is granted. The other two monetization signals already
	# rebuild here; this one was emitted and listened to by nothing.
	EventBus.ad_reward_granted.connect(
		func(_id: StringName, _amount: float) -> void: _rebuild()
	)
	_refresh_shards()
	_set_tab(MonetizationManager.PAID_SURFACES_AVAILABLE)


func _set_tab(offers: bool) -> void:
	_offers_tab_active = offers
	_style_tab(_offers_tab, offers)
	_style_tab(_cosmetics_tab, not offers)
	_rebuild()


func _style_tab(button: Button, active: bool) -> void:
	var style := StyleBoxFlat.new()
	style.set_content_margin_all(10)
	if active:
		style.bg_color = UIPalette.raised()
		style.border_width_bottom = 4
		style.border_color = UIPalette.ink()
	else:
		style.bg_color = UIPalette.fade(UIPalette.surface(), 0.6)
	button.add_theme_stylebox_override("normal", style)
	button.add_theme_stylebox_override("focus", style)
	var lit: StyleBoxFlat = style.duplicate()
	lit.bg_color = UIPalette.raised() if active else Color(0.141, 0.141, 0.184, 0.85)
	button.add_theme_stylebox_override("hover", lit)
	button.add_theme_stylebox_override("pressed", lit)
	button.add_theme_color_override("font_color", UIPalette.ink() if active else UIPalette.muted())
	button.add_theme_color_override(
		"font_hover_color", UIPalette.ink() if active else UIPalette.muted()
	)


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
	# Guarded as well as hidden: _set_tab(true) from anywhere — a future caller,
	# a restored tab state — must not be able to build a card that spends money
	# the build cannot take.
	if _offers_tab_active and MonetizationManager.PAID_SURFACES_AVAILABLE:
		for placement: AdPlacementDefinition in MonetizationManager.get_shop_placements():
			_item_list.add_child(_make_offer_card(placement))
		for product: ShopProductDefinition in MonetizationManager.get_products():
			_item_list.add_child(_make_product_card(product))
		_item_list.add_child(_make_restore_card())
	else:
		for cosmetic: CosmeticDefinition in MonetizationManager.get_cosmetics():
			_item_list.add_child(_make_cosmetic_card(cosmetic))


func _card() -> PanelContainer:
	var card := PanelContainer.new()
	card.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style := StyleBoxFlat.new()
	style.bg_color = UIPalette.surface()
	style.set_content_margin_all(16)
	style.border_width_left = 4
	style.border_color = Color(UIPalette.ink().r, UIPalette.ink().g, UIPalette.ink().b, 0.35)
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
	name_label.add_theme_color_override("font_color", UIPalette.ink())
	name_label.add_theme_font_size_override("font_size", 27)
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(name_label)
	if right == "":
		return
	var right_label := Label.new()
	right_label.text = right
	right_label.add_theme_color_override("font_color", ink)
	right_label.add_theme_font_size_override("font_size", 18)
	right_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(right_label)


func _description(box: VBoxContainer, text: String) -> void:
	var label := Label.new()
	label.text = text
	label.add_theme_color_override("font_color", UIPalette.muted())
	label.add_theme_font_size_override("font_size", 18)
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
	_title_row(box, placement.display_name, "%d LEFT TODAY" % left, UIPalette.muted())
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
	var owned: bool = MonetizationManager.is_one_time_owned(product)
	_title_row(box, product.display_name, "" if owned else product.price_text, UIPalette.ink())
	_description(box, product.description)
	if owned:
		var marker := Label.new()
		marker.text = "● OWNED"
		marker.add_theme_color_override("font_color", UIPalette.muted())
		marker.add_theme_font_size_override("font_size", 18)
		marker.size_flags_horizontal = Control.SIZE_SHRINK_END
		marker.mouse_filter = Control.MOUSE_FILTER_IGNORE
		box.add_child(marker)
		return card
	var button: Button = _action_button("BUY", true)
	button.pressed.connect(_on_purchase_pressed.bind(product.id, button))
	box.add_child(button)
	return card


## Both stores require a restore path for non-consumables.
func _make_restore_card() -> PanelContainer:
	var card: PanelContainer = _card()
	var box: VBoxContainer = _body(card)
	_title_row(box, "Restore Purchases", "", UIPalette.muted())
	_description(box, "Re-apply anything this account already owns.")
	var button: Button = _action_button("RESTORE", true)
	button.pressed.connect(func() -> void:
		button.disabled = true
		button.text = "RESTORING…"
		var restored: int = await MonetizationManager.restore_purchases()
		if not is_inside_tree():
			return
		if restored > 0:
			_rebuild()
		else:
			button.text = "NOTHING TO RESTORE"
	)
	box.add_child(button)
	return card


func _make_cosmetic_card(cosmetic: CosmeticDefinition) -> PanelContainer:
	var card: PanelContainer = _card()
	var box: VBoxContainer = _body(card)
	var owned: bool = MonetizationManager.owns_cosmetic(cosmetic.id)
	var equipped: bool = MonetizationManager.get_equipped_cosmetic_id() == cosmetic.id
	var price: String = "" if owned else "%s Shards" % NumberFormat.format(cosmetic.shard_price)
	_title_row(box, cosmetic.display_name, price, UIPalette.ink())

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
		swatch.add_theme_stylebox_override("panel", style)
		swatch_row.add_child(swatch)
	var swatch_note := Label.new()
	swatch_note.text = "trail · numbers"
	swatch_note.add_theme_color_override("font_color", UIPalette.muted())
	swatch_note.add_theme_font_size_override("font_size", 18)
	swatch_note.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	swatch_note.mouse_filter = Control.MOUSE_FILTER_IGNORE
	swatch_row.add_child(swatch_note)

	if equipped:
		var marker := Label.new()
		marker.text = "● EQUIPPED"
		marker.add_theme_color_override("font_color", UIPalette.ink())
		marker.add_theme_font_size_override("font_size", 18)
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
		# equip_cosmetic emits cosmetic_equipped, which rebuilds; buying without
		# equipping still needs one, so only that branch asks for it.
		buy.pressed.connect(func() -> void:
			if MonetizationManager.buy_cosmetic(cosmetic.id):
				MonetizationManager.equip_cosmetic(cosmetic.id)
			else:
				_rebuild()
		)
	box.add_child(buy)
	return card


# --- Actions ------------------------------------------------------------------


func _on_offer_pressed(id: StringName, button: Button) -> void:
	if MonetizationManager.is_busy():
		return
	button.disabled = true
	_run_countdown(button)
	var granted: float = await MonetizationManager.run_offer(id)
	# BACK is deliberately live during a watch, so this scene may already be
	# gone. Touching its nodes (or buzzing on the next screen) after that would
	# be a bug the player sees.
	if not is_inside_tree():
		return
	if granted > 0.0:
		SettingsManager.vibrate(30)
	_rebuild()


## Tick a visible numeric countdown on the button for the length of the watch.
## A bare spinner would leave the player with no idea how long this takes.
func _run_countdown(button: Button) -> void:
	var remaining: int = int(ceil(StubAdProvider.SIMULATED_WATCH_SECONDS)) \
		if MonetizationManager.USE_STUB_PROVIDERS else 0
	if MonetizationManager.ads_removed() or remaining <= 0:
		button.text = "CLAIMING…"
		return
	while remaining > 0 and is_instance_valid(button) and is_inside_tree():
		button.text = "WATCHING · %ds" % remaining
		await get_tree().create_timer(1.0).timeout
		remaining -= 1


func _on_purchase_pressed(id: StringName, button: Button) -> void:
	if MonetizationManager.is_busy():
		return
	button.disabled = true
	button.text = "PURCHASING…"
	var bought: bool = await MonetizationManager.purchase(id)
	if not is_inside_tree():
		return
	if bought:
		SettingsManager.vibrate(40)
	_rebuild()


func _on_back_pressed() -> void:
	SceneManager.change_scene(SceneManager.SCENE_GAMEPLAY)
