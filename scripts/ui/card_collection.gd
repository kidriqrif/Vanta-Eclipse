extends Control
## The Cards screen — boss trophies, and the one place they are spent.
##
## A card is only ever destroyed here, deliberately: absorption is permanent and
## a collection screen that consumes on a mistap is a screen players stop
## opening. So the row itself is inert and the ABSORB button is a separate,
## smaller target that names what it will do before it does it.

## The blank card, tinted per row by its rarity's colour.
const CARD_FRAME: Texture2D = preload("res://sprites/ui/card_frame_icon.png")

## The theme's one bright accent, read from the theme rather than restated: one
## palette, one source. Cards belong to the pet loop and borrow the accent the
## Pets screen already wears rather than introducing another.
var _accent: Color = UIPalette.accent()

@onready var _target: VBoxContainer = %TargetBox
@onready var _list: VBoxContainer = %CollectionList
@onready var _empty_label: Label = %EmptyLabel
@onready var _collection_header: Label = %CollectionHeader
@onready var _back_button: Button = %BackButton


func _ready() -> void:
	_back_button.pressed.connect(_on_back_pressed)
	EventBus.card_collected.connect(_on_card_collected)
	EventBus.card_absorbed.connect(_on_card_absorbed)
	EventBus.active_pet_changed.connect(_on_pet_changed)
	CardManager.mark_all_seen()
	_refresh()


func _refresh() -> void:
	_build_target()
	_build_list()


# --- Absorption target -------------------------------------------------------


func _build_target() -> void:
	for child in _target.get_children():
		child.queue_free()
	var active: StringName = PetManager.get_active_id()
	if active == &"":
		_target.add_child(_centred(
			"No active companion — a card needs somewhere to go.", 18, UIPalette.muted()
		))
		return
	var def: PetDefinition = PetManager.get_definition(active)
	var stage: int = PetManager.get_stage(active)
	_target.add_child(_centred("ABSORBING INTO", 18, UIPalette.muted()))
	_target.add_child(_centred(def.stage_names[stage], 27, UIPalette.ink()))
	# Body ink, not the accent. crimson on the void background clears AA (5.7:1)
	# and not AAA, and this line is a small STAT rather than a mark — at 18px it
	# was the least readable text on the screen. The accent earns its contrast
	# on short labels, not on numbers someone has to read.
	var absorbed: float = PetManager.get_absorbed_bonus(active)
	_target.add_child(_centred(
		"Absorbed bonus  +%.1f%%" % (absorbed * 100.0), 27, UIPalette.ink()
	))


func _centred(text: String, size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return label


# --- Collection --------------------------------------------------------------


func _build_list() -> void:
	for child in _list.get_children():
		if child != _empty_label:
			child.queue_free()
	var cards: Array = CardManager.get_cards()
	_empty_label.visible = cards.is_empty()
	_collection_header.text = "COLLECTION (%d)" % cards.size()
	# Newest first. The card a player just won is the one they came to look at,
	# and the collection is append-ordered, so this walks it backwards.
	for index: int in range(cards.size() - 1, -1, -1):
		_list.add_child(_make_row(cards[index], index))


func _make_row(card: Dictionary, index: int) -> PanelContainer:
	var rarity: CardRarityDefinition = CardManager.get_rarity(
		StringName(card.get("rarity", ""))
	)
	var tint: Color = rarity.color if rarity != null else UIPalette.ink()
	var row := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = UIPalette.raised()
	style.set_content_margin_all(16)
	# The rarity spine. A card's tier is the first thing a player sorts on, so
	# it is carried by an edge that survives being skimmed, not by the text.
	style.border_color = tint
	style.border_width_left = 6
	row.add_theme_stylebox_override("panel", style)

	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 16)
	row.add_child(hbox)

	# One card graphic, tinted per tier. The art is drawn near-white precisely
	# so modulate can carry the rarity — baking five frames would put the
	# palette in a PNG where a data edit could no longer reach it.
	var art := TextureRect.new()
	art.texture = CARD_FRAME
	art.custom_minimum_size = Vector2(96, 96)
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	art.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	art.modulate = tint
	hbox.add_child(art)

	var text_box := VBoxContainer.new()
	text_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text_box.add_theme_constant_override("separation", 9)
	hbox.add_child(text_box)

	var name_label := Label.new()
	name_label.text = String(card.get("name", "Unknown"))
	name_label.add_theme_font_size_override("font_size", 27)
	name_label.add_theme_color_override("font_color", tint)
	text_box.add_child(name_label)

	var tier: String = rarity.display_name if rarity != null else "Unknown"
	var meta := Label.new()
	meta.text = "%s · Lv. %d" % [tier, int(card.get("level", 1))]
	meta.add_theme_font_size_override("font_size", 18)
	meta.add_theme_color_override("font_color", UIPalette.muted())
	text_box.add_child(meta)

	var stats := Label.new()
	stats.text = "POW %s   VIG %.1f   FOC %.1f" % [
		NumberFormat.format_exact(float(card.get("power", 0.0))),
		float(card.get("vigor", 0.0)),
		float(card.get("focus", 0.0)),
	]
	stats.add_theme_font_size_override("font_size", 18)
	stats.add_theme_color_override("font_color", UIPalette.ink())
	text_box.add_child(stats)

	var absorb := Button.new()
	absorb.text = "ABSORB"
	absorb.custom_minimum_size = Vector2(200, 96)
	absorb.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	absorb.disabled = PetManager.get_active_id() == &""
	absorb.pressed.connect(_on_absorb_pressed.bind(index))
	hbox.add_child(absorb)
	return row


# --- Events ------------------------------------------------------------------


func _on_absorb_pressed(index: int) -> void:
	# The whole list is rebuilt from the manager afterwards rather than the one
	# row being removed: absorbing shifts every later index by one, and a stale
	# index on a button that is still on screen would feed the wrong card next.
	if CardManager.absorb(index).is_empty():
		return
	_refresh()


func _on_card_collected(_card: Dictionary) -> void:
	CardManager.mark_all_seen()
	_refresh()


func _on_card_absorbed(_pet_id: StringName, _xp: float, _bonus: float) -> void:
	_build_target()


func _on_pet_changed(_id: StringName) -> void:
	_refresh()


func _on_back_pressed() -> void:
	SceneManager.change_scene(SceneManager.SCENE_PETS)
