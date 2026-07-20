class_name WorldUnlockModal
extends CenteredModalDialog
## The World Unlock celebration (M5 UX spec §3D) — the game's biggest
## must-acknowledge moment. Pure ceremony: the unlock and payout were
## granted and saved at the kill. ENTER is acknowledgment.

var _world: WorldDefinition
var _payout: float = 0.0

@onready var _name_row: HBoxContainer = %NameRow
@onready var _world_name_label: Label = %WorldNameLabel
@onready var _levels_label: Label = %LevelsLabel
@onready var _amount_label: Label = %AmountLabel


## Call BEFORE add_child().
func setup(world: WorldDefinition, payout: float) -> void:
	_world = world
	_payout = payout


func _ready() -> void:
	super()
	_world_name_label.text = _world.display_name.to_upper()
	_levels_label.text = "Levels %d – %d" % [
		_world.first_level, _world.first_level + WorldManager.LEVELS_PER_WORLD - 1,
	]
	# The world essence multiplier is deliberately NOT surfaced here —
	# the approved spec (§4C/§8) keeps it invisible until the future
	# world-select screen, its natural home.
	_set_exact_shown(false)
	_amount_label.gui_input.connect(_on_amount_gui_input)
	_stage_name_reveal()


## The name reveal is the headline act: it pops in ~0.5s after the card,
## and never gates ENTER (which is live from frame one, pattern contract).
func _stage_name_reveal() -> void:
	_name_row.modulate.a = 0.0
	await get_tree().process_frame
	_name_row.pivot_offset = _name_row.size * 0.5
	_name_row.scale = Vector2(0.6, 0.6)
	var tween: Tween = create_tween()
	tween.tween_interval(0.5)
	tween.tween_property(_name_row, "modulate:a", 1.0, 0.12)
	tween.parallel().tween_property(_name_row, "scale", Vector2.ONE, 0.3) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func _on_amount_gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_set_exact_shown(event.pressed)


func _set_exact_shown(exact: bool) -> void:
	if exact:
		_amount_label.text = "+%s Essence" % NumberFormat.format_exact(_payout)
	else:
		_amount_label.text = "+%s Essence" % NumberFormat.format(_payout)
