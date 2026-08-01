extends Control
## EnemyView — renders the current enemy and plays its animations.
## Pure presentation: it reads combat state and reacts to EventBus signals,
## but never modifies combat state itself.
##
## Animation layers (kept on separate nodes so tweens never fight):
##   ContactShadow — the ground plate, counter-animated against the hover
##   SpriteHolder  — spawn pop-in, idle hover, death collapse
##   EnemySprite   — hit squash, flash, and crit wiggle
##
## The sprite wears effects/dimensional_sprite.gdshader, which derives a
## surface normal from the art's own alpha and lights it. Two things here feed
## it: the rim is retinted per enemy from EnemyDefinition.glow_color, and the
## contact shadow below grounds the result — without a shadow a lit sprite
## reads as a sticker floating on the backdrop, however good the shading is.

const FLASH_COLOR: Color = Color(2.2, 1.9, 3.0)

## Contact-shadow rest state, and how far it thins at the top of the hover.
## A rising object casts a smaller, fainter shadow; animating that against the
## bob is what turns a vertical slide into an object leaving the ground.
const SHADOW_ALPHA: float = 0.55
const SHADOW_LIFT_ALPHA: float = 0.34
const SHADOW_LIFT_SCALE: float = 0.86

var _idle_tween: Tween
var _hit_tween: Tween
## Bosses render larger (EnemyDefinition.view_scale); every transform
## animation works relative to this base.
var _base_scale: Vector2 = Vector2.ONE
## The shadow tracks view_scale too, so a boss casts a boss-sized plate.
var _shadow_scale: Vector2 = Vector2.ONE

@onready var _sprite_holder: Control = %SpriteHolder
@onready var _sprite: TextureRect = %EnemySprite
@onready var _death_particles: CPUParticles2D = %DeathParticles
@onready var _contact_shadow: TextureRect = %ContactShadow


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
		_contact_shadow.modulate.a = 0.0


# --- Signal handlers ---------------------------------------------------------


func _on_enemy_spawned(definition: EnemyDefinition, _level: int, _max_hp: float) -> void:
	_kill_tween(_idle_tween)
	_kill_tween(_hit_tween)
	_show_enemy(definition)

	_sprite_holder.scale = _base_scale * 0.5
	_sprite_holder.modulate.a = 0.0
	_contact_shadow.modulate.a = 0.0
	var spawn_tween: Tween = create_tween().set_parallel(true)
	spawn_tween.tween_property(_sprite_holder, "scale", _base_scale, 0.3) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	spawn_tween.tween_property(_sprite_holder, "modulate:a", 1.0, 0.2)
	# The plate arrives with the enemy; _start_idle then takes it over.
	spawn_tween.tween_property(_contact_shadow, "modulate:a", SHADOW_ALPHA, 0.3)
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
	# The plate collapses with the body — a shadow outliving its caster is
	# the one thing that would break the grounding this exists to sell.
	death_tween.tween_property(_contact_shadow, "modulate:a", 0.0, 0.22)


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
	withdraw_tween.tween_property(_contact_shadow, "modulate:a", 0.0, 0.4)


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

	_shadow_scale = Vector2.ONE * definition.view_scale
	_contact_shadow.scale = _shadow_scale
	_contact_shadow.modulate.a = SHADOW_ALPHA


func _start_idle() -> void:
	_kill_tween(_idle_tween)
	_idle_tween = create_tween().set_loops()
	# Rise: the plate tightens and fades in the same 1.4s on the same curve,
	# so the two never drift apart and the enemy reads as leaving the ground.
	_idle_tween.tween_property(_sprite_holder, "position:y", -16.0, 1.4) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_idle_tween.parallel().tween_property(_contact_shadow, "scale",
			_shadow_scale * SHADOW_LIFT_SCALE, 1.4) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_idle_tween.parallel().tween_property(_contact_shadow, "modulate:a",
			SHADOW_LIFT_ALPHA, 1.4) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	# Fall.
	_idle_tween.tween_property(_sprite_holder, "position:y", 0.0, 1.4) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_idle_tween.parallel().tween_property(_contact_shadow, "scale",
			_shadow_scale, 1.4) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_idle_tween.parallel().tween_property(_contact_shadow, "modulate:a",
			SHADOW_ALPHA, 1.4) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)


func _kill_tween(tween: Tween) -> void:
	if tween != null and tween.is_valid():
		tween.kill()
