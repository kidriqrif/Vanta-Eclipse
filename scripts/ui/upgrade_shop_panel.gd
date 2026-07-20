class_name UpgradeShopPanel
extends Control
## The upgrade shop — a panel that slides up over the bottom half of the
## gameplay screen, so the player can keep tapping while browsing.
## Builds one UpgradeRow per definition at runtime: adding a new upgrade
## .tres file makes it appear here automatically.

const UPGRADE_ROW_SCENE: PackedScene = preload("res://scenes/gameplay/upgrade_row.tscn")

## Panel offsets relative to the screen's bottom edge (anchors are bottom).
const OPEN_TOP: float = -1010.0
const OPEN_BOTTOM: float = 0.0
const CLOSED_TOP: float = 40.0
const CLOSED_BOTTOM: float = 1050.0
const SLIDE_TIME: float = 0.28

var _is_open: bool = false
var _slide_tween: Tween

@onready var _rows_vbox: VBoxContainer = %RowsVBox
@onready var _close_button: Button = %CloseButton


func _ready() -> void:
	visible = false
	offset_top = CLOSED_TOP
	offset_bottom = CLOSED_BOTTOM
	_close_button.pressed.connect(close)
	for definition: UpgradeDefinition in UpgradeManager.get_definitions():
		var row: UpgradeRow = UPGRADE_ROW_SCENE.instantiate()
		row.setup(definition)
		_rows_vbox.add_child(row)


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
	_animate_to(OPEN_TOP, OPEN_BOTTOM)


func close() -> void:
	if not _is_open:
		return
	_is_open = false
	_animate_to(CLOSED_TOP, CLOSED_BOTTOM)
	_slide_tween.chain().tween_callback(hide)


func _animate_to(target_top: float, target_bottom: float) -> void:
	if _slide_tween != null and _slide_tween.is_valid():
		_slide_tween.kill()
	_slide_tween = create_tween().set_parallel(true)
	_slide_tween.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_slide_tween.tween_property(self, "offset_top", target_top, SLIDE_TIME)
	_slide_tween.tween_property(self, "offset_bottom", target_bottom, SLIDE_TIME)
