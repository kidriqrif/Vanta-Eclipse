extends Control
## EnemyView — renders the current enemy and plays its animations.
## Pure presentation: it reads combat state and reacts to EventBus signals,
## but never modifies combat state itself.
##
## Animation layers (kept on separate nodes so tweens never fight):
##   GroundGlow    — the ground pool, counter-animated against the hover
##   SpriteHolder  — spawn pop-in, idle hover, death collapse
##   EnemySprite   — hit squash, flash, and crit wiggle
##
## The sprite wears effects/dimensional_sprite.gdshader, which derives a
## surface normal from the art's own alpha and lights it. Two things here feed
## it: the rim is retinted per enemy from EnemyDefinition.glow_color, and the
## ground glow below grounds the result — without it a lit sprite reads as a
## sticker floating on the backdrop, however good the shading is.
##
## It is a GLOW, not a shadow, and that is not a stylistic choice: the void
## backdrop is already near-black, so a dark contact shadow was invisible on
## it (confirmed by screenshotting a real run). These creatures emit light —
## pooling their own glow_color on the ground reads correctly AND is visible.

## Over-1.0 on purpose: this multiplies modulate, so it blows the sprite out
## rather than tinting it. Red-dominant since the palette overhaul — the old
## value led on blue, which a saturation scan cannot catch because every
## channel clamps to white on the way out.
const FLASH_COLOR: Color = Color(3.0, 2.0, 1.9)

## Ground-glow rest state, and how far it thins at the top of the hover.
## Light falls off with distance, so a rising creature pools a smaller, fainter
## glow; animating that against the bob is what turns a vertical slide into an
## object leaving the ground.
const GLOW_ALPHA: float = 0.38
const GLOW_LIFT_ALPHA: float = 0.20
const GLOW_LIFT_SCALE: float = 0.84

var _idle_tween: Tween
var _hit_tween: Tween
## Bosses render larger (EnemyDefinition.view_scale); every transform
## animation works relative to this base.
var _base_scale: Vector2 = Vector2.ONE
## The glow tracks view_scale too, so a boss pools a boss-sized light.
var _glow_scale: Vector2 = Vector2.ONE

@onready var _sprite_holder: Control = %SpriteHolder
@onready var _sprite: TextureRect = %EnemySprite
@onready var _death_particles: CPUParticles2D = %DeathParticles
@onready var _ground_glow: TextureRect = %GroundGlow


func _ready() -> void:
	EventBus.enemy_spawned.connect(_on_enemy_spawned)
	EventBus.enemy_damaged.connect(_on_enemy_damaged)
	EventBus.enemy_died.connect(_on_enemy_died)
	EventBus.enemy_withdrawn.connect(_on_enemy_withdrawn)

	# The scene may open mid-fight (e.g. returning from the menu), so render
	# whatever the CombatManager currently has.
	if CombatManager.is_enemy_alive():
		_show_enemy(CombatManager.get_enemy_definition())
		_start_idle()
	else:
		_sprite_holder.modulate.a = 0.0
		_ground_glow.modulate.a = 0.0


# --- Signal handlers ---------------------------------------------------------


func _on_enemy_spawned(definition: EnemyDefinition, _level: int, _max_hp: float) -> void:
	_kill_tween(_idle_tween)
	_kill_tween(_hit_tween)
	_show_enemy(definition)

	_sprite_holder.scale = _base_scale * 0.5
	_sprite_holder.modulate.a = 0.0
	_ground_glow.modulate.a = 0.0
	var spawn_tween: Tween = create_tween().set_parallel(true)
	spawn_tween.tween_property(_sprite_holder, "scale", _base_scale, 0.3) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	spawn_tween.tween_property(_sprite_holder, "modulate:a", 1.0, 0.2)
	# The pool arrives with the enemy; _start_idle then takes it over.
	spawn_tween.tween_property(_ground_glow, "modulate:a", GLOW_ALPHA, 0.3)
	spawn_tween.chain().tween_callback(_start_idle)


func _on_enemy_damaged(_amount: float, is_crit: bool, _hp: float, _max_hp: float) -> void:
	_kill_tween(_hit_tween)
	_sprite.scale = Vector2.ONE
	_sprite.rotation = 0.0

	var squash := Vector2(1.16, 0.82) if is_crit else Vector2(1.1, 0.88)
	_hit_tween = create_tween()
	_hit_tween.tween_property(_sprite, "scale", squash, 0.05)
	_hit_tween.parallel().tween_property(_sprite, "modulate", Color.WHITE, 0.2) \
		.from(FLASH_COLOR)
	if is_crit:
		_hit_tween.parallel().tween_property(_sprite, "rotation", 0.09, 0.06) \
			.from(-0.06)
	_hit_tween.tween_property(_sprite, "scale", Vector2.ONE, 0.16) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if is_crit:
		_hit_tween.parallel().tween_property(_sprite, "rotation", 0.0, 0.16)


func _on_enemy_died(_level: int, _total_kills: int) -> void:
	_kill_tween(_idle_tween)
	_kill_tween(_hit_tween)
	_sprite.scale = Vector2.ONE
	_sprite.rotation = 0.0
	_death_particles.restart()

	var death_tween: Tween = create_tween().set_parallel(true)
	death_tween.tween_property(_sprite_holder, "scale", _base_scale * 0.05, 0.3) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	death_tween.tween_property(_sprite_holder, "modulate:a", 0.0, 0.3)
	death_tween.tween_property(_sprite_holder, "rotation", 0.3, 0.3)
	# The pool dies with the body — light outliving its source is the one
	# thing that would break the grounding this exists to sell.
	death_tween.tween_property(_ground_glow, "modulate:a", 0.0, 0.22)


## The withdraw micro-state (M5 UX spec §4B): the enemy LEAVES — no
## particles, no rotation, pointedly not the death animation.
func _on_enemy_withdrawn() -> void:
	_kill_tween(_idle_tween)
	_kill_tween(_hit_tween)
	_sprite.scale = Vector2.ONE
	_sprite.rotation = 0.0
	var withdraw_tween: Tween = create_tween().set_parallel(true)
	withdraw_tween.tween_property(_sprite_holder, "scale", _base_scale * 0.7, 0.4) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	withdraw_tween.tween_property(_sprite_holder, "modulate:a", 0.0, 0.4)
	withdraw_tween.tween_property(_ground_glow, "modulate:a", 0.0, 0.4)


# --- Internals ---------------------------------------------------------------


func _show_enemy(definition: EnemyDefinition) -> void:
	_sprite.texture = definition.texture
	_sprite.modulate = Color.WHITE
	_death_particles.color = definition.glow_color
	_base_scale = Vector2.ONE * definition.view_scale
	_sprite_holder.scale = _base_scale
	_sprite_holder.rotation = 0.0
	_sprite_holder.position = Vector2.ZERO
	_sprite_holder.modulate = Color.WHITE

	# The silhouette catches the creature's own light rather than a single
	# global accent, so a frost enemy rims cold and a shade rims violet off
	# the same shader. The material is resource_local_to_scene, so this
	# retint cannot leak into any other user of it.
	var sprite_material: ShaderMaterial = _sprite.material as ShaderMaterial
	if sprite_material != null:
		sprite_material.set_shader_parameter(&"rim_color", definition.glow_color)

	# Same source as the rim: the pool is this creature's own light on the
	# ground, so it is tinted rather than darkened.
	_glow_scale = Vector2.ONE * definition.view_scale
	_ground_glow.scale = _glow_scale
	_ground_glow.modulate = Color(
		definition.glow_color.r, definition.glow_color.g,
		definition.glow_color.b, GLOW_ALPHA
	)


func _start_idle() -> void:
	_kill_tween(_idle_tween)
	_idle_tween = create_tween().set_loops()
	# Rise: the pool tightens and dims in the same 1.4s on the same curve, so
	# the two never drift apart and the enemy reads as leaving the ground.
	_idle_tween.tween_property(_sprite_holder, "position:y", -16.0, 1.4) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_idle_tween.parallel().tween_property(_ground_glow, "scale",
			_glow_scale * GLOW_LIFT_SCALE, 1.4) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_idle_tween.parallel().tween_property(_ground_glow, "modulate:a",
			GLOW_LIFT_ALPHA, 1.4) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	# Fall.
	_idle_tween.tween_property(_sprite_holder, "position:y", 0.0, 1.4) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_idle_tween.parallel().tween_property(_ground_glow, "scale",
			_glow_scale, 1.4) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_idle_tween.parallel().tween_property(_ground_glow, "modulate:a",
			GLOW_ALPHA, 1.4) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)


func _kill_tween(tween: Tween) -> void:
	if tween != null and tween.is_valid():
		tween.kill()
