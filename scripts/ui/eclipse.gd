extends Control
## The Eclipse screen — the prestige ritual (ASCEND) and the Ascendant Powers
## tree (POWERS), switched by a segmented control that shares one Void-Crystal
## header. A full SceneManager scene, so it holds any boss gate through the
## existing scene-transition test (no ui_overlay plumbing). Never required to
## progress. Reads PrestigeManager / SkillTreeManager and asks them to act.

const RESULT_BANNER_SCENE: PackedScene = preload("res://scenes/common/result_banner.tscn")
const ECLIPSE_TEXTURE: Texture2D = preload("res://sprites/ui/eclipse_icon.svg")

const CRYSTAL: Color = Color(0.4, 0.86, 0.85, 1)
const CRYSTAL_CORE: Color = Color(0.76, 0.97, 0.96, 1)
const CRYSTAL_DEEP: Color = Color(0.16, 0.44, 0.47, 1)
const IVORY: Color = Color(0.906, 0.886, 0.973, 1)
const MUTED: Color = Color(0.62, 0.57, 0.75, 1)
const WARM_MUTED: Color = Color(0.78, 0.62, 0.62, 1)
const CARD_BG: Color = Color(0.1, 0.078, 0.157, 0.9)

## How long the armed COLLAPSE confirm stays hot before disarming (§3A).
const ARM_SECONDS: float = 2.5

## Per-stat suffix for the effect line, so a bonus always names what it feeds.
const STAT_SUFFIX: Dictionary = {
	&"tap_pct": "tap damage",
	&"crit_damage": "crit damage",
	&"essence": "essence gain",
	&"offline_efficiency": "offline rate",
	&"offline_cap_hours": "offline cap (h)",
	&"crystal_gain": "crystal gain",
	&"boss": "boss damage",
	&"attack_speed": "attack speed",
}

var _collapse_armed: bool = false
var _collapse_button: Button
var _disarm_timer: Timer

@onready var _back_button: Button = %BackButton
@onready var _crystal_label: Label = %CrystalLabel
@onready var _ascend_tab: Button = %AscendTab
@onready var _powers_tab: Button = %PowersTab
@onready var _ascend_scroll: ScrollContainer = %AscendScroll
@onready var _ascend_box: VBoxContainer = %AscendBox
@onready var _powers_scroll: ScrollContainer = %PowersScroll
@onready var _powers_list: VBoxContainer = %PowersList
@onready var _nebula: ColorRect = $VoidBackground/NebulaRect


func _ready() -> void:
	_apply_world_palette()
	_disarm_timer = Timer.new()
	_disarm_timer.one_shot = true
	_disarm_timer.timeout.connect(_disarm_collapse)
	add_child(_disarm_timer)
	_back_button.pressed.connect(_on_back_pressed)
	_ascend_tab.pressed.connect(func() -> void: _set_active_tab(true))
	_powers_tab.pressed.connect(func() -> void: _set_active_tab(false))
	EventBus.currency_changed.connect(_on_currency_changed)
	EventBus.skill_purchased.connect(_on_skill_purchased)
	_update_crystal_label()
	_build_ascend()
	_build_powers()
	_set_active_tab(true)


# --- Header / tabs ------------------------------------------------------------


func _update_crystal_label() -> void:
	_crystal_label.text = NumberFormat.format(
		CurrencyManager.get_balance(CurrencyManager.VOID_CRYSTALS)
	)


func _set_active_tab(ascend: bool) -> void:
	_ascend_scroll.visible = ascend
	_powers_scroll.visible = not ascend
	_style_tab(_ascend_tab, ascend)
	_style_tab(_powers_tab, not ascend)


func _style_tab(button: Button, active: bool) -> void:
	var style := StyleBoxFlat.new()
	style.set_corner_radius_all(12)
	style.set_content_margin_all(10)
	if active:
		style.bg_color = CRYSTAL_DEEP
		style.border_width_bottom = 4
		style.border_color = CRYSTAL
	else:
		style.bg_color = Color(0.1, 0.078, 0.157, 0.6)
	for state: String in ["normal", "hover", "pressed", "focus"]:
		button.add_theme_stylebox_override(state, style)
	button.add_theme_color_override("font_color", CRYSTAL_CORE if active else MUTED)
	button.add_theme_color_override("font_hover_color", CRYSTAL_CORE if active else MUTED)


# --- ASCEND panel -------------------------------------------------------------


func _build_ascend() -> void:
	for child in _ascend_box.get_children():
		child.queue_free()

	var icon := TextureRect.new()
	icon.texture = ECLIPSE_TEXTURE
	icon.custom_minimum_size = Vector2(0, 150)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ascend_box.add_child(icon)

	var can: bool = PrestigeManager.can_eclipse()
	var reward: int = PrestigeManager.crystal_reward()

	var lead := _centered_label(
		"Collapsing this run yields" if can else "Not ready to collapse", 28, MUTED
	)
	_ascend_box.add_child(lead)

	var yield_text: String = "◆ %s Void Crystals" % NumberFormat.format(float(reward)) if can \
		else "Reach Lv. %d this run" % PrestigeManager.ECLIPSE_UNLOCK_LEVEL
	_ascend_box.add_child(_centered_label(yield_text, 48, CRYSTAL))

	_ascend_box.add_child(_centered_label(
		"Run peak: Lv. %d" % PrestigeManager.run_peak_level, 24, MUTED
	))

	var columns := HBoxContainer.new()
	columns.add_theme_constant_override("separation", 16)
	columns.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	columns.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ascend_box.add_child(columns)
	columns.add_child(_make_summary_column("RESETS", WARM_MUTED, [
		"Eclipse Essence", "All upgrades", "World progress", "Auto-Attack*",
	]))
	columns.add_child(_make_summary_column("KEPT", CRYSTAL, [
		"Void Crystals", "Ascendant Powers", "Equipment", "Relics", "Pets",
	]))

	var note := Label.new()
	note.text = "*Auto-Attack is re-earned at Lv. 15 — unless Eternal Reflex is owned."
	note.add_theme_color_override("font_color", MUTED)
	note.add_theme_font_size_override("font_size", 24)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ascend_box.add_child(note)

	_collapse_armed = false
	_collapse_button = Button.new()
	_collapse_button.custom_minimum_size = Vector2(0, 120)
	_collapse_button.theme_type_variation = &"PrimaryButton"
	_collapse_button.disabled = not can
	_collapse_button.text = "COLLAPSE INTO ECLIPSE" if can else "REACH LV. %d TO COLLAPSE" \
		% PrestigeManager.ECLIPSE_UNLOCK_LEVEL
	_style_collapse(false)
	_collapse_button.pressed.connect(_on_collapse_pressed)
	_ascend_box.add_child(_collapse_button)


func _make_summary_column(title: String, accent: Color, items: Array) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style := StyleBoxFlat.new()
	style.bg_color = CARD_BG
	style.set_corner_radius_all(14)
	style.set_content_margin_all(16)
	panel.add_theme_stylebox_override("panel", style)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(box)
	var header := Label.new()
	header.text = title
	header.add_theme_color_override("font_color", accent)
	header.add_theme_font_size_override("font_size", 26)
	header.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(header)
	for item: String in items:
		var row := Label.new()
		row.text = "· %s" % item
		row.add_theme_color_override("font_color", IVORY)
		row.add_theme_font_size_override("font_size", 24)
		row.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		box.add_child(row)
	return panel


## A centered display label. Always MOUSE_FILTER_IGNORE: these sit inside the
## touch-drag ScrollContainers, and a STOP child swallows a drag begun on it.
func _centered_label(text: String, size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_size_override("font_size", size)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return label


func _style_collapse(armed: bool) -> void:
	var style := StyleBoxFlat.new()
	style.set_corner_radius_all(14)
	style.set_content_margin_all(14)
	style.bg_color = CRYSTAL_CORE if armed else CRYSTAL_DEEP
	style.border_color = CRYSTAL_CORE
	style.set_border_width_all(2 if armed else 0)
	for state: String in ["normal", "hover", "pressed"]:
		_collapse_button.add_theme_stylebox_override(state, style)
	_collapse_button.add_theme_color_override(
		"font_color", Color(0.04, 0.12, 0.13, 1) if armed else CRYSTAL_CORE
	)
	_collapse_button.add_theme_color_override(
		"font_hover_color", Color(0.04, 0.12, 0.13, 1) if armed else CRYSTAL_CORE
	)


func _on_collapse_pressed() -> void:
	if not PrestigeManager.can_eclipse():
		return
	if not _collapse_armed:
		_collapse_armed = true
		_collapse_button.text = "TAP AGAIN · +%d ◆ · RESETS RUN" % PrestigeManager.crystal_reward()
		_style_collapse(true)
		_disarm_timer.start(ARM_SECONDS)
		return
	_disarm_timer.stop()
	SettingsManager.vibrate(60)
	var reward: int = PrestigeManager.perform_eclipse()
	_celebrate_and_return(reward)


func _disarm_collapse() -> void:
	if _collapse_button == null or not is_instance_valid(_collapse_button):
		return
	_collapse_armed = false
	_collapse_button.text = "COLLAPSE INTO ECLIPSE"
	_style_collapse(false)


func _celebrate_and_return(reward: int) -> void:
	_collapse_button.disabled = true
	var banner: ResultBanner = RESULT_BANNER_SCENE.instantiate()
	banner.setup(ECLIPSE_TEXTURE, "ECLIPSE", "+%d Void Crystals" % reward, true)
	banner.tree_exited.connect(func() -> void:
		SceneManager.change_scene(SceneManager.SCENE_GAMEPLAY)
	)
	add_child(banner)


# --- POWERS panel -------------------------------------------------------------


func _build_powers() -> void:
	for child in _powers_list.get_children():
		child.queue_free()
	var current_branch: StringName = &""
	for def: SkillNodeDefinition in SkillTreeManager.get_definitions():
		if def.branch != current_branch:
			current_branch = def.branch
			_powers_list.add_child(_make_branch_header(String(def.branch)))
		_powers_list.add_child(_make_node_card(def))


## Branch heading plus the hairline rule that separates the tree's sections
## (visual §3B).
func _make_branch_header(title: String) -> VBoxContainer:
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var header := Label.new()
	header.text = title.to_upper()
	header.theme_type_variation = &"HeaderLabel"
	header.add_theme_font_size_override("font_size", 30)
	header.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(header)
	var rule := Panel.new()
	rule.custom_minimum_size = Vector2(0, 2)
	rule.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var rule_style := StyleBoxFlat.new()
	rule_style.bg_color = Color(CRYSTAL.r, CRYSTAL.g, CRYSTAL.b, 0.35)
	rule.add_theme_stylebox_override("panel", rule_style)
	box.add_child(rule)
	return box


func _make_node_card(def: SkillNodeDefinition) -> PanelContainer:
	var level: int = SkillTreeManager.get_level(def.id)
	var maxed: bool = SkillTreeManager.is_maxed(def.id)
	var locked: bool = not SkillTreeManager.prereq_met(def.id)

	var card := PanelContainer.new()
	card.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style := StyleBoxFlat.new()
	style.set_corner_radius_all(14)
	style.set_content_margin_all(16)
	style.border_width_left = 4  # the prestige "one class" spine on every card
	# A locked node recedes by dimming its BACKGROUND and spine, never the text:
	# modulating the whole card would drag the effect line under the contrast
	# floor. The state is carried by the "REQUIRES …" word regardless.
	if locked:
		style.bg_color = Color(CARD_BG.r, CARD_BG.g, CARD_BG.b, CARD_BG.a * 0.55)
		style.border_color = Color(CRYSTAL.r, CRYSTAL.g, CRYSTAL.b, 0.4)
	else:
		style.bg_color = CARD_BG
		style.border_color = CRYSTAL
	card.add_theme_stylebox_override("panel", style)

	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(box)

	# Row 1: name + state marker.
	var name_row := HBoxContainer.new()
	name_row.add_theme_constant_override("separation", 12)
	name_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(name_row)
	var name_label := Label.new()
	name_label.text = def.display_name
	name_label.add_theme_color_override("font_color", IVORY)
	name_label.add_theme_font_size_override("font_size", 30)
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	name_row.add_child(name_label)
	var marker := Label.new()
	if maxed:
		marker.text = "● MAXED"
		marker.add_theme_color_override("font_color", CRYSTAL_CORE)
	else:
		marker.text = "● Lv. %d / %d" % [level, def.max_level]
		marker.add_theme_color_override("font_color", CRYSTAL)
	marker.add_theme_font_size_override("font_size", 24)
	marker.mouse_filter = Control.MOUSE_FILTER_IGNORE
	name_row.add_child(marker)

	# Row 2: effect line.
	var effect := Label.new()
	effect.text = _effect_line(def, level)
	effect.add_theme_color_override("font_color", MUTED)
	effect.add_theme_font_size_override("font_size", 24)
	effect.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	effect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(effect)

	# Row 3: action.
	box.add_child(_make_action(def, maxed, locked))
	return card


func _make_action(def: SkillNodeDefinition, maxed: bool, locked: bool) -> Control:
	if maxed:
		var done := Label.new()
		done.text = "● MAXED"
		done.add_theme_color_override("font_color", CRYSTAL_CORE)
		done.add_theme_font_size_override("font_size", 26)
		done.mouse_filter = Control.MOUSE_FILTER_IGNORE
		return done
	if locked:
		var req := Label.new()
		var prereq: SkillNodeDefinition = SkillTreeManager.get_definition(def.prereq_id)
		var prereq_name: String = prereq.display_name if prereq != null else String(def.prereq_id)
		req.text = "REQUIRES %s Lv. %d" % [prereq_name, def.prereq_level]
		req.add_theme_color_override("font_color", WARM_MUTED)
		req.add_theme_font_size_override("font_size", 24)
		req.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		req.mouse_filter = Control.MOUSE_FILTER_IGNORE
		return req
	var cost: int = int(SkillTreeManager.get_cost(def.id))
	var button := Button.new()
	button.custom_minimum_size = Vector2(220, 96)
	button.size_flags_horizontal = Control.SIZE_SHRINK_END
	if SkillTreeManager.can_buy(def.id):
		button.theme_type_variation = &"PrimaryButton"
		button.text = "BUY   ◆ %d" % cost
		button.pressed.connect(func() -> void: SkillTreeManager.buy(def.id))
	else:
		button.disabled = true
		button.text = "NEED %d ◆" % cost
	return button


func _effect_line(def: SkillNodeDefinition, level: int) -> String:
	if def.effect_kind == SkillNodeDefinition.EffectKind.FLAG:
		return def.description
	var suffix: String = STAT_SUFFIX.get(def.effect_stat, "")
	if level >= def.max_level:
		return "%s %s (max)" % [def.format_total(level), suffix]
	if level <= 0:
		return "Next: %s %s" % [def.format_total(1), suffix]
	return "%s %s  →  %s %s" % [
		def.format_total(level), suffix, def.format_total(level + 1), suffix
	]


# --- Signals ------------------------------------------------------------------


func _on_currency_changed(currency: StringName, _balance: float) -> void:
	if currency == CurrencyManager.VOID_CRYSTALS:
		_update_crystal_label()


func _on_skill_purchased(_id: StringName, _new_level: int) -> void:
	SettingsManager.vibrate(20)
	_build_powers()


func _apply_world_palette() -> void:
	var world: WorldDefinition = WorldManager.get_world_for_level(CombatManager.enemy_level)
	var material: ShaderMaterial = _nebula.material
	material.set_shader_parameter("deep_color", world.deep_color)
	material.set_shader_parameter("nebula_color", world.nebula_color)
	material.set_shader_parameter("accent_color", world.accent_color)


func _on_back_pressed() -> void:
	SaveManager.save_game()
	SceneManager.change_scene(SceneManager.SCENE_GAMEPLAY)
