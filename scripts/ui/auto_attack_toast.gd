extends CanvasLayer
## One-shot Auto-Attack unlock celebration (UX spec §3C).
## Instanced by the gameplay scene on EventBus.auto_attack_unlocked, plays
## its choreography, and frees itself — the DamageNumber idiom, so a scene
## change mid-animation can never orphan the tween.
##
## Layer registry: scene UI = 0, toast = 50, modal = 60, scene fade = 100.
## Fully non-blocking: every node ignores mouse input, so taps land on the
## combat area beneath from frame one.

@onready var _panel: PanelContainer = %ToastPanel


func _ready() -> void:
	# Fixed offsets in the scene make size valid immediately.
	_panel.pivot_offset = _panel.size * 0.5
	_panel.scale = Vector2.ZERO
	_panel.modulate.a = 0.0
	var tween: Tween = create_tween()
	tween.set_parallel(true)
	# TRANS_BACK overshoots (~1.05) on its own — the spec's pop-in.
	tween.tween_property(_panel, "scale", Vector2.ONE, 0.3) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(_panel, "modulate:a", 1.0, 0.3)
	tween.chain().tween_interval(1.4)
	tween.chain().tween_property(_panel, "modulate:a", 0.0, 0.3)
	tween.chain().tween_callback(queue_free)
