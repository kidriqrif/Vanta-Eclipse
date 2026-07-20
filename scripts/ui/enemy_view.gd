extends Control
## EnemyView — renders the current enemy and plays its animations.
## Pure presentation: it reads combat state and reacts to EventBus signals,
## but never modifies combat state itself.
##
## Animation layers (kept on separate nodes so tweens never fight):
##   SpriteHolder — spawn pop-in, idle hover, death collapse
##   EnemySprite  — hit squash, flash, and crit wiggle

const FLASH_COLOR: Color = Color(2.2, 1.9, 3.0)

var _idle_tween: Tween
var _hit_tween: Tween

@onready var _sprite_holder: Control = %SpriteHolder
@onready var _sprite: TextureRect = %EnemySprite
@onready var _death_particles: CPUParticles2D = %DeathParticles


func _ready() -> void:
	EventBus.enemy_spawned.connect(_on_enemy_spawned)
	EventBus.enemy_damaged.connect(_on_enemy_damaged)
	EventBus.enemy_died.connect(_on_enemy_died)

	# The scene may open mid-fight (e.g. returning from the menu), so render
	# whatever the CombatManager currently has.
	if CombatManager.is_enemy_alive():
		_show_enemy(CombatManager.get_enemy_definition())
		_start_idle()
	else:
		_sprite_holder.modulate.a = 0.0


# --- Signal handlers ---------------------------------------------------------


func _on_enemy_spawned(definition: EnemyDefinition, _level: int, _max_hp: float) -> void:
	_kill_tween(_idle_tween)
	_kill_tween(_hit_tween)
	_show_enemy(definition)

	_sprite_holder.scale = Vector2(0.5, 0.5)
	_sprite_holder.modulate.a = 0.0
	var spawn_tween: Tween = create_tween().set_parallel(true)
	spawn_tween.tween_property(_sprite_holder, "scale", Vector2.ONE, 0.3) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	spawn_tween.tween_property(_sprite_holder, "modulate:a", 1.0, 0.2)
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
	death_tween.tween_property(_sprite_holder, "scale", Vector2(0.05, 0.05), 0.3) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	death_tween.tween_property(_sprite_holder, "modulate:a", 0.0, 0.3)
	death_tween.tween_property(_sprite_holder, "rotation", 0.3, 0.3)


# --- Internals ---------------------------------------------------------------


func _show_enemy(definition: EnemyDefinition) -> void:
	_sprite.texture = definition.texture
	_sprite.modulate = Color.WHITE
	_death_particles.color = definition.glow_color
	_sprite_holder.scale = Vector2.ONE
	_sprite_holder.rotation = 0.0
	_sprite_holder.position = Vector2.ZERO
	_sprite_holder.modulate = Color.WHITE


func _start_idle() -> void:
	_kill_tween(_idle_tween)
	_idle_tween = create_tween().set_loops()
	_idle_tween.tween_property(_sprite_holder, "position:y", -16.0, 1.4) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_idle_tween.tween_property(_sprite_holder, "position:y", 0.0, 1.4) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)


func _kill_tween(tween: Tween) -> void:
	if tween != null and tween.is_valid():
		tween.kill()
