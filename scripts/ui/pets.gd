extends Control
## The Pets screen — the active companion showcase (sprite, level, XP,
## evolution, passive bonus) and the owned roster. A full SceneManager
## scene, so it holds any boss gate through the existing scene-transition
## test (no ui_overlay plumbing). Never required to progress.

const MUTED: Color = Color(0.62, 0.57, 0.75, 1)
const ACCENTS: Dictionary = {
	&"ember": Color(0.984, 0.573, 0.235, 1),
	&"frostling": Color(0.576, 0.773, 0.992, 1),
}

@onready var _showcase: VBoxContainer = %ShowcaseBox
@onready var _roster: VBoxContainer = %RosterList
@onready var _empty_label: Label = %EmptyLabel
@onready var _companions_header: Label = %CompanionsHeader
@onready var _back_button: Button = %BackButton
@onready var _nebula: ColorRect = $VoidBackground/NebulaRect


func _ready() -> void:
	_apply_world_palette()
	_back_button.pressed.connect(_on_back_pressed)
	EventBus.active_pet_changed.connect(_on_changed)
	EventBus.pet_leveled.connect(_on_changed2)
	EventBus.pet_evolved.connect(_on_changed2)
	EventBus.pet_unlocked.connect(_on_changed)
	_refresh()


func _refresh() -> void:
	_build_showcase()
	_build_roster()


# --- Showcase ----------------------------------------------------------------


func _build_showcase() -> void:
	for child in _showcase.get_children():
		child.queue_free()
	var active: StringName = PetManager.get_active_id()
	if active == &"":
		var none := Label.new()
		none.text = "No active companion."
		none.add_theme_color_override("font_color", MUTED)
		none.add_theme_font_size_override("font_size", 28)
		none.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_showcase.add_child(none)
		return
	var def: PetDefinition = PetManager.get_definition(active)
	var stage: int = PetManager.get_stage(active)
	var level: int = PetManager.get_level(active)
	var accent: Color = ACCENTS.get(active, Color.WHITE)

	var sprite := TextureRect.new()
	sprite.texture = def.stage_sprites[stage]
	sprite.custom_minimum_size = Vector2(0, 300)
	sprite.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	sprite.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_showcase.add_child(sprite)

	var name_label := Label.new()
	name_label.text = "%s · Stage %d of %d" % [
		def.stage_names[stage], stage + 1, def.stage_names.size()
	]
	name_label.add_theme_font_size_override("font_size", 40)
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_showcase.add_child(name_label)

	var progress: Dictionary = PetManager.get_level_progress(active)
	var xp_bar := ProgressBar.new()
	xp_bar.custom_minimum_size = Vector2(0, 46)
	xp_bar.show_percentage = false
	xp_bar.max_value = maxf(1.0, progress["needed"])
	xp_bar.value = progress["into"]
	var fill := StyleBoxFlat.new()
	fill.bg_color = Color(0.42, 0.62, 0.98, 1)
	fill.set_corner_radius_all(12)
	xp_bar.add_theme_stylebox_override("fill", fill)
	_showcase.add_child(xp_bar)
	var xp_label := Label.new()
	if level >= def.max_level:
		xp_label.text = "Lv. %d · MAX" % level
	else:
		xp_label.text = "Lv. %d · %d / %d XP" % [
			level, int(progress["into"]), int(progress["needed"])
		]
	xp_label.add_theme_font_size_override("font_size", 26)
	xp_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_showcase.add_child(xp_label)

	var bonus := Label.new()
	bonus.text = _bonus_text(def, level)
	bonus.add_theme_color_override("font_color", accent)
	bonus.add_theme_font_size_override("font_size", 28)
	bonus.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_showcase.add_child(bonus)

	if stage < def.evolution_levels.size():
		var next_evo := Label.new()
		next_evo.text = "Evolves at Lv. %d" % def.evolution_levels[stage]
		next_evo.add_theme_color_override("font_color", MUTED)
		next_evo.add_theme_font_size_override("font_size", 24)
		next_evo.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_showcase.add_child(next_evo)


# --- Roster ------------------------------------------------------------------


func _build_roster() -> void:
	for child in _roster.get_children():
		if child != _empty_label:
			child.queue_free()
	var owned: Array = PetManager.get_owned_ids()
	_empty_label.visible = owned.is_empty()
	_companions_header.text = "COMPANIONS (%d)" % owned.size()
	var active: StringName = PetManager.get_active_id()
	for id: StringName in owned:
		_roster.add_child(_make_roster_row(id, id == active))


func _make_roster_row(id: StringName, is_active: bool) -> Button:
	var def: PetDefinition = PetManager.get_definition(id)
	var stage: int = PetManager.get_stage(id)
	var row := Button.new()
	row.custom_minimum_size = Vector2(0, 140)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.10, 0.078, 0.157, 0.9)
	style.set_corner_radius_all(14)
	style.set_content_margin_all(16)
	if is_active:
		style.set_border_width_all(2)
		style.border_color = Color(0.655, 0.545, 0.98, 1)
	row.add_theme_stylebox_override("normal", style)
	row.add_theme_stylebox_override("hover", style)
	row.add_theme_stylebox_override("pressed", style)

	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 16)
	hbox.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hbox.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	row.add_child(hbox)

	var icon := TextureRect.new()
	icon.texture = def.stage_sprites[stage]
	icon.custom_minimum_size = Vector2(96, 96)
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
	var name_row := HBoxContainer.new()
	name_row.add_theme_constant_override("separation", 12)
	info.add_child(name_row)
	var name_label := Label.new()
	name_label.text = "%s · Lv. %d" % [def.stage_names[stage], PetManager.get_level(id)]
	name_label.add_theme_font_size_override("font_size", 30)
	name_row.add_child(name_label)
	if is_active:
		var pill := Label.new()
		pill.text = "● ACTIVE"
		pill.add_theme_color_override("font_color", Color(0.655, 0.545, 0.98, 1))
		pill.add_theme_font_size_override("font_size", 24)
		name_row.add_child(pill)
	elif PetManager.is_unseen(id):
		var new_pill := Label.new()
		new_pill.text = "NEW"
		new_pill.add_theme_color_override("font_color", Color(0.655, 0.545, 0.98, 1))
		new_pill.add_theme_font_size_override("font_size", 24)
		name_row.add_child(new_pill)
	var bonus := Label.new()
	bonus.text = _bonus_text(def, PetManager.get_level(id))
	bonus.add_theme_color_override("font_color", MUTED)
	bonus.add_theme_font_size_override("font_size", 24)
	info.add_child(bonus)

	if not is_active:
		row.pressed.connect(func() -> void: PetManager.set_active(id))
	return row


# --- Helpers -----------------------------------------------------------------


func _bonus_text(def: PetDefinition, level: int) -> String:
	var pct: String = NumberFormat.format_percent(def.bonus_per_level * level)
	var stat_name: String = {
		&"essence": "Essence Gain",
		&"tap_pct": "Tap Damage",
		&"crit_chance": "Crit Chance",
		&"crit_damage": "Crit Damage",
		&"boss": "Boss Damage",
		&"tap_flat": "Tap Damage",
	}.get(def.bonus_stat, String(def.bonus_stat))
	return "%s +%s" % [stat_name, pct]


func _apply_world_palette() -> void:
	var world: WorldDefinition = WorldManager.get_world_for_level(CombatManager.enemy_level)
	var material: ShaderMaterial = _nebula.material
	material.set_shader_parameter("deep_color", world.deep_color)
	material.set_shader_parameter("nebula_color", world.nebula_color)
	material.set_shader_parameter("accent_color", world.accent_color)


func _on_changed(_id: StringName) -> void:
	_refresh()


func _on_changed2(_id: StringName, _n: int) -> void:
	_refresh()


func _on_back_pressed() -> void:
	PetManager.mark_all_seen()
	SaveManager.save_game()
	SceneManager.change_scene(SceneManager.SCENE_GAMEPLAY)
