class_name CenteredModalDialog
extends CanvasLayer
## Centered Modal Dialog (Blocking) — the reusable half of the pattern in
## design/ux/milestone-4-idle-offline.md §7. A full-screen scrim swallows
## all input behind it; a centered card holds content and exactly ONE
## dismiss action, live from the first rendered frame.
##
## This script is the reusable artifact; each concrete dialog is its own
## scene whose root uses (or extends) it and provides %Scrim, %Card, and
## %ConfirmButton. A shared base *scene* is deliberately deferred until a
## third consumer exists (Godot implementation notes §4.1).
##
## Layer registry: scene UI = 0, toast = 50, modal = 60, scene fade = 100.

## Emitted when the player activates the dismiss action, before the exit
## animation plays.
signal confirmed

var _closing: bool = false

@onready var _scrim: ColorRect = %Scrim
@onready var _card: PanelContainer = %Card
@onready var _confirm_button: Button = %ConfirmButton


func _ready() -> void:
	# Announce the blocking overlay so managers can defer moments that
	# need an unobstructed screen (M5 spec §4E). Closed is emitted only
	# when the scrim is truly gone (the free callback).
	EventBus.ui_overlay_opened.emit()
	# Connected before the entrance tween starts: the button is usable
	# immediately, the animation never gates the dismiss (Enhanced tier).
	_confirm_button.pressed.connect(_on_confirm_pressed)
	# Fixed offsets in the scene make size valid immediately.
	_card.pivot_offset = _card.size * 0.5
	_scrim.modulate.a = 0.0
	_card.modulate.a = 0.0
	_card.scale = Vector2(0.85, 0.85)
	var tween: Tween = create_tween().set_parallel(true)
	tween.tween_property(_scrim, "modulate:a", 1.0, 0.2)
	tween.tween_property(_card, "scale", Vector2.ONE, 0.25) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(_card, "modulate:a", 1.0, 0.25)


func _on_confirm_pressed() -> void:
	if _closing:
		return
	_closing = true
	confirmed.emit()
	var tween: Tween = create_tween().set_parallel(true)
	tween.tween_property(_card, "scale", Vector2(0.9, 0.9), 0.18) \
		.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	tween.tween_property(_card, "modulate:a", 0.0, 0.18)
	tween.tween_property(_scrim, "modulate:a", 0.0, 0.2)
	tween.chain().tween_callback(_finish_close)


func _finish_close() -> void:
	EventBus.ui_overlay_closed.emit()
	queue_free()
