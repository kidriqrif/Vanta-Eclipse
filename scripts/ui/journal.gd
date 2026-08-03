extends Control
## The Journal — quests, dailies and achievements behind one segmented control.
## A full SceneManager scene, so it holds any boss gate through the existing
## scene-transition test. Reads QuestManager and asks it to claim; it never
## grants anything itself.


## Each reward figure wears the colour of the family that reward belongs to —
## the Journal itself claims no accent (visual §1).
## Reward text used to be tinted per currency — violet, lime, teal — which put
## three accents in a list whose own words already say what the reward is. They
## are one muted register now, except Astral Shards: those are the scarcest
## thing the Journal hands out, so they get the accent and nothing else does.

## How long a claim refusal borrows the reset label before the normal
## "Resets in …" text is allowed back.
const REFUSAL_HOLD_SECONDS: float = 4.0

var _tab: QuestDefinition.Kind = QuestDefinition.Kind.QUEST
## Ticks-msec deadline while a refusal owns the reset label ("" state = 0).
## The 30s tick and _set_tab both honour it, so the explanation can neither
## be overwritten mid-read nor stranded on a tab that has no reset time.
var _refusal_until_msec: int = 0
## id -> the row that renders it, so a completion or claim re-dresses that row
## in place instead of rebuilding the list under the player's thumb.
var _rows: Dictionary = {}

@onready var _back_button: Button = %BackButton
@onready var _ready_pill: PanelContainer = %ReadyPill
@onready var _ready_label: Label = %ReadyLabel
@onready var _quests_tab: Button = %QuestsTab
@onready var _daily_tab: Button = %DailyTab
@onready var _achievements_tab: Button = %AchievementsTab
@onready var _reset_label: Label = %ResetLabel
@onready var _goal_list: VBoxContainer = %GoalList


func _ready() -> void:
	_back_button.pressed.connect(_on_back_pressed)
	_quests_tab.pressed.connect(func() -> void: _set_tab(QuestDefinition.Kind.QUEST))
	_daily_tab.pressed.connect(func() -> void: _set_tab(QuestDefinition.Kind.DAILY))
	_achievements_tab.pressed.connect(
		func() -> void: _set_tab(QuestDefinition.Kind.ACHIEVEMENT)
	)
	EventBus.goal_completed.connect(_on_goal_changed)
	EventBus.goal_claimed.connect(_on_goal_claimed)
	EventBus.dailies_rerolled.connect(_on_dailies_rerolled)
	# Opening the Journal is one of the two moments dailies can roll over, and
	# it re-latches anything completed while the screen was closed.
	QuestManager.refresh_dailies()
	QuestManager.evaluate()
	var tick := Timer.new()
	tick.wait_time = 30.0
	tick.timeout.connect(_refresh_reset_label)
	add_child(tick)
	tick.start()
	_set_tab(QuestDefinition.Kind.QUEST)


# --- Tabs ---------------------------------------------------------------------


func _set_tab(kind: QuestDefinition.Kind) -> void:
	_tab = kind
	# Changing tabs answers the refusal — drop it so the label below is
	# governed purely by the new tab.
	_refusal_until_msec = 0
	_style_tab(_quests_tab, kind == QuestDefinition.Kind.QUEST)
	_style_tab(_daily_tab, kind == QuestDefinition.Kind.DAILY)
	_style_tab(_achievements_tab, kind == QuestDefinition.Kind.ACHIEVEMENT)
	_reset_label.visible = kind == QuestDefinition.Kind.DAILY
	_refresh_reset_label()
	_rebuild()


func _refresh_reset_label() -> void:
	# A refusal is borrowing the label; don't overwrite it with a reset time
	# the player never asked about (and which is wrong outside DAILY).
	if Time.get_ticks_msec() < _refusal_until_msec:
		return
	if not _reset_label.visible:
		return
	_reset_label.text = "Resets in %s" % _format_reset(
		QuestManager.seconds_until_daily_reset()
	)


## Borrow the reset label to explain a refused claim. The label is DAILY-only
## furniture, so this has to hand it back afterwards — claiming from
## ACHIEVEMENTS otherwise leaves a stray "Resets in 7h" on a tab that has no
## reset at all.
func _show_refusal(text: String) -> void:
	_refusal_until_msec = Time.get_ticks_msec() + int(REFUSAL_HOLD_SECONDS * 1000.0)
	_reset_label.visible = true
	_reset_label.text = text
	get_tree().create_timer(REFUSAL_HOLD_SECONDS).timeout.connect(_end_refusal)


func _end_refusal() -> void:
	# A tab change (or a second refusal) may have moved on already.
	if Time.get_ticks_msec() < _refusal_until_msec:
		return
	_refusal_until_msec = 0
	_reset_label.visible = _tab == QuestDefinition.Kind.DAILY
	_refresh_reset_label()


func _style_tab(button: Button, active: bool) -> void:
	var style := StyleBoxFlat.new()
	style.set_corner_radius_all(12)
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
	lit.bg_color = UIPalette.raised() if active else UIPalette.fade(UIPalette.surface(), 0.85)
	button.add_theme_stylebox_override("hover", lit)
	button.add_theme_stylebox_override("pressed", lit)
	button.add_theme_color_override("font_color", UIPalette.ink() if active else UIPalette.muted())
	button.add_theme_color_override(
		"font_hover_color", UIPalette.ink() if active else UIPalette.muted()
	)


func _format_reset(seconds: int) -> String:
	@warning_ignore("integer_division")
	var hours: int = seconds / 3600
	if hours >= 1:
		return "%dh" % hours
	@warning_ignore("integer_division")
	var minutes: int = seconds / 60
	return "%dm" % maxi(1, minutes)


# --- List ---------------------------------------------------------------------


func _rebuild() -> void:
	for child in _goal_list.get_children():
		child.queue_free()
	_rows.clear()
	var goals: Array[QuestDefinition] = QuestManager.get_goals(_tab)
	if goals.is_empty():
		_goal_list.add_child(_muted_label("Nothing here yet."))
	for definition: QuestDefinition in goals:
		var row: PanelContainer = _make_row(definition)
		_rows[definition.id] = row
		_goal_list.add_child(row)
	_refresh_ready_pill()


func _muted_label(text: String) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_color_override("font_color", UIPalette.muted())
	label.add_theme_font_size_override("font_size", 26)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return label


func _make_row(definition: QuestDefinition) -> PanelContainer:
	var card := PanelContainer.new()
	card.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_theme_stylebox_override("panel", _card_style(definition))

	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(box)

	# Row 1: name + reward, the reward in its own family's colour.
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 12)
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(top)
	var name_label := Label.new()
	name_label.text = definition.display_name
	name_label.add_theme_color_override("font_color", UIPalette.ink())
	name_label.add_theme_font_size_override("font_size", 30)
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(name_label)
	var reward := Label.new()
	reward.text = definition.format_reward()
	reward.add_theme_color_override("font_color", _reward_ink(definition))
	reward.add_theme_font_size_override("font_size", 24)
	reward.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(reward)

	# Row 2: description.
	var description := Label.new()
	description.text = definition.description
	description.add_theme_color_override("font_color", UIPalette.muted())
	description.add_theme_font_size_override("font_size", 24)
	description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	description.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(description)

	# Row 3: progress bar + the numeric, which is never omitted.
	var progress_row := HBoxContainer.new()
	progress_row.add_theme_constant_override("separation", 12)
	progress_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(progress_row)
	var bar := ProgressBar.new()
	bar.custom_minimum_size = Vector2(0, 28)
	bar.show_percentage = false
	bar.max_value = maxf(1.0, definition.target)
	bar.value = QuestManager.get_progress(definition)
	bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var fill := StyleBoxFlat.new()
	fill.bg_color = UIPalette.ink()
	fill.set_corner_radius_all(12)
	bar.add_theme_stylebox_override("fill", fill)
	progress_row.add_child(bar)
	var figure := Label.new()
	figure.text = _progress_text(definition)
	figure.add_theme_color_override("font_color", UIPalette.muted())
	figure.add_theme_font_size_override("font_size", 24)
	figure.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	figure.mouse_filter = Control.MOUSE_FILTER_IGNORE
	progress_row.add_child(figure)

	# Row 4: the action, when there is one.
	box.add_child(_make_action(definition))
	return card


func _card_style(definition: QuestDefinition) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.set_corner_radius_all(14)
	style.set_content_margin_all(16)
	# A claimed card recedes by dimming its GROUND, never the whole card:
	# modulate propagates to children and would take the text with it.
	style.bg_color = UIPalette.fade(UIPalette.surface(), 0.5) \
		if QuestManager.is_claimed(definition) else UIPalette.surface()
	# The spine brightens when a goal is claimable, so a reward waiting to be
	# collected is scannable down the left edge before reading a word.
	style.border_width_left = 4
	style.border_color = UIPalette.ink() if QuestManager.is_claimable(definition) \
		else Color(UIPalette.ink().r, UIPalette.ink().g, UIPalette.ink().b, 0.35)
	return style


func _make_action(definition: QuestDefinition) -> Control:
	if QuestManager.is_claimable(definition):
		var claim := Button.new()
		claim.custom_minimum_size = Vector2(220, 96)
		claim.size_flags_horizontal = Control.SIZE_SHRINK_END
		claim.theme_type_variation = &"PrimaryButton"
		claim.text = "CLAIM"
		claim.pressed.connect(_on_claim_pressed.bind(definition.id))
		return claim
	var marker := Label.new()
	marker.add_theme_font_size_override("font_size", 24)
	marker.size_flags_horizontal = Control.SIZE_SHRINK_END
	marker.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if QuestManager.is_claimed(definition):
		marker.text = "● CLAIMED"
		marker.add_theme_color_override("font_color", UIPalette.muted())
	else:
		# Incomplete: the numeric above already carries the state, so this row
		# stays empty rather than repeating it.
		marker.text = ""
	return marker


func _progress_text(definition: QuestDefinition) -> String:
	var current: float = QuestManager.get_progress(definition)
	return "%s / %s" % [
		NumberFormat.format_exact(current), NumberFormat.format_exact(definition.target)
	]


func _reward_ink(definition: QuestDefinition) -> Color:
	match definition.reward_kind:
		QuestDefinition.RewardKind.ASTRAL_SHARDS:
			return UIPalette.accent()
	return UIPalette.muted()


func _refresh_ready_pill() -> void:
	var count: int = QuestManager.get_unclaimed_count()
	_ready_pill.visible = count > 0
	_ready_label.text = "%d READY" % count


# --- Signals ------------------------------------------------------------------


func _on_claim_pressed(id: StringName) -> void:
	var text: String = QuestManager.claim(id)
	if text == "":
		# Refused: already claimed (a safe double-tap), or a token reward with
		# no room in the meter — say so rather than looking broken.
		var definition: QuestDefinition = QuestManager.get_definition(id)
		if definition != null and QuestManager.is_claimable(definition):
			_show_refusal("Arcade token meter is full — spend one first.")
		return
	SettingsManager.vibrate(30)


func _on_goal_changed(id: StringName) -> void:
	_redress(id)


func _on_goal_claimed(id: StringName, _reward_text: String) -> void:
	# Re-dress first — that swaps in the row which shows "● CLAIMED" — and let
	# _redress pop the REPLACEMENT. Popping the outgoing row would animate a
	# node being freed in the same frame, which is no animation at all.
	_redress(id, true)
	# A claimed quest reveals the next link. Append it rather than rebuilding:
	# a rebuild would reset the scroll position under the player's thumb.
	if _tab == QuestDefinition.Kind.QUEST:
		_append_new_goals()


## Add any goal now visible in this tab that has no row yet, preserving scroll.
func _append_new_goals() -> void:
	for definition: QuestDefinition in QuestManager.get_goals(_tab):
		if _rows.has(definition.id):
			continue
		var row: PanelContainer = _make_row(definition)
		_rows[definition.id] = row
		_goal_list.add_child(row)
	_refresh_ready_pill()


func _on_dailies_rerolled() -> void:
	if _tab == QuestDefinition.Kind.DAILY:
		_rebuild()


## Replace one row in place, keeping the player's scroll position.
func _redress(id: StringName, pop: bool = false) -> void:
	var row: Control = _rows.get(id)
	var definition: QuestDefinition = QuestManager.get_definition(id)
	if row == null or not is_instance_valid(row) or definition == null:
		_refresh_ready_pill()
		return
	var index: int = row.get_index()
	var replacement: PanelContainer = _make_row(definition)
	_goal_list.add_child(replacement)
	_goal_list.move_child(replacement, index)
	_rows[id] = replacement
	row.queue_free()
	if pop:
		# The incoming row is the one that animates; the outgoing one is being
		# freed this frame and could not show a tween.
		replacement.pivot_offset = replacement.size * 0.5
		replacement.scale = Vector2(1.03, 1.03)
		create_tween().tween_property(replacement, "scale", Vector2.ONE, 0.2) \
			.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_refresh_ready_pill()


func _on_back_pressed() -> void:
	SceneManager.change_scene(SceneManager.SCENE_GAMEPLAY)
