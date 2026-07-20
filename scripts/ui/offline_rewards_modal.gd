class_name OfflineRewardsModal
extends CenteredModalDialog
## The WELCOME BACK offline-rewards dialog (UX spec §3D/§3E).
## Pure presentation: the essence was already granted by IdleManager at
## eligibility time — COLLECT is acknowledgment, not a claim action.
##
## Usage (gameplay scene):
##   var modal: OfflineRewardsModal = SCENE.instantiate()
##   modal.setup(amount, seconds_away, was_capped)
##   add_child(modal)

var _amount: float = 0.0
var _seconds_away: int = 0
var _was_capped: bool = false

@onready var _amount_label: Label = %AmountLabel
@onready var _duration_label: Label = %DurationLabel
@onready var _cap_label: Label = %CapLabel


## Call BEFORE add_child().
func setup(amount: float, seconds_away: int, was_capped: bool) -> void:
	_amount = amount
	_seconds_away = seconds_away
	_was_capped = was_capped


func _ready() -> void:
	super()
	_set_exact_shown(false)
	_duration_label.text = "Away for %s" % GameManager.format_duration_rough(_seconds_away)
	_cap_label.text = "(offline earnings cap at %dh)" \
		% int(IdleManager.OFFLINE_CAP_SECONDS / 3600.0)
	# The cap line only appears when the cap actually reduced the reward —
	# and then always plainly, never as a silently shortened time (§6).
	_cap_label.visible = _was_capped
	_amount_label.gui_input.connect(_on_amount_gui_input)


# --- Hold-to-reveal exact amount (Enhanced tier "Readable numbers") ----------


func _on_amount_gui_input(event: InputEvent) -> void:
	# "Hold" is simply the pressed state between press and release; the
	# viewport routes the release back here even if the finger slides off.
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_set_exact_shown(event.pressed)


func _set_exact_shown(exact: bool) -> void:
	if exact:
		_amount_label.text = "+%s Essence" % NumberFormat.format_exact(_amount)
	else:
		_amount_label.text = "+%s Essence" % NumberFormat.format(_amount)
