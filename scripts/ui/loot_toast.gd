extends CanvasLayer
## Loot Toast (pattern §7.2) — a compact, non-blocking pickup pill. Rarity-
## colored, self-freeing. Multiple quick drops collapse into one pill
## ("N items") rather than stacking (the gameplay scene manages that).
## Mythic drops use the Result Banner instead (handled by the caller).

const HOLD_SECONDS: float = 1.3
## Absolute ceiling on lifetime so a sustained drop storm can't keep the
## pill alive forever by repeatedly restarting the hold.
const MAX_LIFETIME: float = 5.0

var _rarity: int = 0
var _count: int = 1
var _life_tween: Tween
var _spawned_at: float = 0.0
var _icon_texture: Texture2D
var _label_text: String = ""

@onready var _panel: PanelContainer = %ToastPanel
@onready var _icon: TextureRect = %ToastIcon
@onready var _pip_holder: Control = %PipHolder
@onready var _label: Label = %ToastLabel


## Call BEFORE add_child.
func setup(item: Dictionary) -> void:
	_rarity = int(item["rarity"])
	var slot_def: SlotDefinition = EquipmentManager.get_slot_definition(item["slot"])
	if slot_def != null:
		_icon_texture = slot_def.icon
	_label_text = "%s %s" % [
		RarityStyle.rarity_name(_rarity),
		slot_def.display_name if slot_def != null else str(item["slot"]),
	]


func _ready() -> void:
	_spawned_at = Time.get_ticks_msec() / 1000.0
	_icon.texture = _icon_texture
	_render()
	_panel.pivot_offset = _panel.size * 0.5
	_panel.scale = Vector2.ZERO
	_start_life()


## Fold another drop into this still-visible pill instead of stacking.
func add_item(item: Dictionary) -> void:
	_count += 1
	_rarity = maxi(_rarity, int(item["rarity"]))
	_render()
	_start_life()  # restart the hold so the collapsed pill lingers


func _render() -> void:
	for child in _pip_holder.get_children():
		child.queue_free()
	_pip_holder.add_child(RarityStyle.make_pip_row(_rarity))
	if _count > 1:
		_label.text = "%d items" % _count
		_icon.visible = false
	else:
		_label.text = _label_text
	_label.add_theme_color_override("font_color", RarityStyle.color(_rarity))
	var style: StyleBoxFlat = _panel.get_theme_stylebox("panel").duplicate()
	# The border is the rarity signal; the soft glow that used to sit behind it
	# was the same colour spread over 10px of blur.
	style.border_color = RarityStyle.color(_rarity)
	_panel.add_theme_stylebox_override("panel", style)


func _start_life() -> void:
	# Past the absolute ceiling, stop restarting and let the current tween
	# run to its free — a drop storm can't keep the pill alive forever.
	if Time.get_ticks_msec() / 1000.0 - _spawned_at > MAX_LIFETIME:
		return
	if _life_tween != null and _life_tween.is_valid():
		_life_tween.kill()
	_panel.modulate.a = 1.0
	_life_tween = create_tween()
	_life_tween.tween_property(_panel, "scale", Vector2.ONE, 0.25) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_life_tween.tween_interval(HOLD_SECONDS)
	_life_tween.tween_property(_panel, "modulate:a", 0.0, 0.25)
	_life_tween.tween_callback(queue_free)
