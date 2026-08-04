class_name DamageNumber
extends Label
## One floating damage number. Spawned by the gameplay scene on every hit,
## pops in, drifts upward, fades out, and frees itself.
##
## Usage:
##   var number: DamageNumber = scene.instantiate()
##   number.setup(amount, is_crit)
##   fx_layer.add_child(number)
##   number.position = hit_position - number.size * 0.5
##
## TODO(post-release): pool these instead of instantiate/free IF profiling on
## a real device shows pressure at very high attack speeds. Measured, not
## assumed — the M15 pass found this cost negligible by inspection.

const NORMAL_COLOR: Color = Color(0.941, 0.941, 0.965)
const CRIT_COLOR: Color = Color(0.91, 0.196, 0.235)
const CRIT_OUTLINE_COLOR: Color = Color(0.031, 0.031, 0.047)


func setup(amount: float, is_crit: bool) -> void:
	text = NumberFormat.format(amount)
	# LabelSettings resources are shared between instances, so duplicate
	# before changing anything — otherwise every number on screen changes.
	label_settings = label_settings.duplicate()
	if is_crit:
		label_settings.font_size = 54
		label_settings.font_color = CRIT_COLOR
		label_settings.outline_color = CRIT_OUTLINE_COLOR
	else:
		# The equipped cosmetic tints ordinary hits. Crits keep their own
		# colour: that one IS state (it reads "this hit was special"), and a
		# cosmetic must never overwrite a state signal.
		var cosmetic: CosmeticDefinition = MonetizationManager.get_equipped_cosmetic()
		label_settings.font_color = cosmetic.number_color if cosmetic != null \
			else NORMAL_COLOR
	# Compute our final size now so the caller can center us immediately.
	size = get_minimum_size()
	pivot_offset = size * 0.5


func _ready() -> void:
	var drift := Vector2(randf_range(-42.0, 42.0), -130.0)

	scale = Vector2(0.4, 0.4)
	var pop_tween: Tween = create_tween()
	pop_tween.tween_property(self, "scale", Vector2(1.15, 1.15), 0.11) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	pop_tween.tween_property(self, "scale", Vector2.ONE, 0.08)

	# as_relative: the drift is applied on top of whatever position the
	# caller assigns right after add_child().
	var float_tween: Tween = create_tween().set_parallel(true)
	float_tween.tween_property(self, "position", drift, 0.75) \
		.as_relative().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	float_tween.tween_property(self, "modulate:a", 0.0, 0.4).set_delay(0.35)
	float_tween.chain().tween_callback(queue_free)
