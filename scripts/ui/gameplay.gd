extends Control
## Gameplay screen — the combat view (Milestone 2).
##
## A window into CombatManager: taps go in, EventBus signals come out and are
## rendered as health-bar changes, damage numbers, and animations. All combat
## rules live in CombatManager; this script only displays them.

const DAMAGE_NUMBER_SCENE: PackedScene = preload("res://scenes/gameplay/damage_number.tscn")
const AUTO_ATTACK_TOAST_SCENE: PackedScene = preload("res://scenes/gameplay/auto_attack_toast.tscn")
const OFFLINE_REWARDS_MODAL_SCENE: PackedScene = preload(
	"res://scenes/gameplay/offline_rewards_modal.tscn"
)
const RESULT_BANNER_SCENE: PackedScene = preload("res://scenes/common/result_banner.tscn")
const WORLD_UNLOCK_MODAL_SCENE: PackedScene = preload(
	"res://scenes/gameplay/world_unlock_modal.tscn"
)
const BOSS_SKULL_TEXTURE: Texture2D = preload("res://sprites/ui/boss_skull_icon.svg")
const LOOT_TOAST_SCENE: PackedScene = preload("res://scenes/gear/loot_toast.tscn")

## Where the last tap landed, so its damage number spawns under the finger.
var _last_tap_position: Vector2 = Vector2.ZERO
var _has_tap_position: bool = false
var _essence_pop_tween: Tween
var _badge_pulse_tween: Tween
## One-at-a-time blocking-modal presentation queue (M5 UX spec §6).
var _modal_queue: Array[Callable] = []
var _modal_active: bool = false
var _unlock_presentation_queued: bool = false
## Depth-1 banner queue so layer-50 transients never stack.
var _active_banner: ResultBanner
var _queued_banner: ResultBanner
## The currently-visible loot toast, so quick drops collapse into it.
var _active_loot_toast: Node

@onready var _auto_attack_badge: PanelContainer = %AutoAttackBadge
@onready var _world_label: Label = %WorldLabel
@onready var _boss_plate: HBoxContainer = %BossPlate
@onready var _boss_name_label: Label = %BossNameLabel
@onready var _timer_bar: ProgressBar = %TimerBar
@onready var _challenge_boss_button: Button = %ChallengeBossButton
@onready var _nebula_rect: ColorRect = $VoidBackground/NebulaRect
@onready var _essence_display: HBoxContainer = %EssenceDisplay
@onready var _essence_label: Label = %EssenceLabel
@onready var _upgrades_button: Button = %UpgradesButton
@onready var _gear_button: Button = %GearButton
@onready var _count_pill: PanelContainer = %CountPill
@onready var _count_label: Label = %CountLabel
@onready var _shop_panel: UpgradeShopPanel = %UpgradeShopPanel
@onready var _stage_label: Label = %StageLabel
@onready var _enemy_name_label: Label = %EnemyNameLabel
@onready var _health_bar: ProgressBar = %HealthBar
@onready var _health_label: Label = %HealthLabel
@onready var _combat_area: Control = %CombatArea
@onready var _fx_layer: Control = %FxLayer
@onready var _kills_label: Label = %KillsLabel
@onready var _session_label: Label = %SessionLabel
@onready var _play_time_label: Label = %PlayTimeLabel
@onready var _menu_button: Button = %MenuButton


func _ready() -> void:
	EventBus.enemy_spawned.connect(_on_enemy_spawned)
	EventBus.enemy_damaged.connect(_on_enemy_damaged)
	EventBus.enemy_died.connect(_on_enemy_died)
	EventBus.currency_changed.connect(_on_currency_changed)
	EventBus.auto_attack_unlocked.connect(_on_auto_attack_unlocked)
	EventBus.offline_rewards_ready.connect(_on_offline_rewards_ready)
	EventBus.boss_fight_started.connect(_on_boss_fight_started)
	EventBus.boss_fight_won.connect(_on_boss_fight_won)
	EventBus.boss_fight_failed.connect(_on_boss_fight_failed)
	EventBus.world_unlocked.connect(_on_world_unlocked)
	EventBus.scene_transition_finished.connect(_on_scene_transition_finished)
	_combat_area.gui_input.connect(_on_combat_area_input)
	_menu_button.pressed.connect(_on_menu_pressed)
	_upgrades_button.pressed.connect(_shop_panel.toggle)
	_gear_button.pressed.connect(_on_gear_pressed)
	_challenge_boss_button.pressed.connect(_on_challenge_boss_pressed)
	EventBus.item_dropped.connect(_on_item_dropped)
	_apply_world_palette()
	_update_count_pill()

	_session_label.text = "Session #%d" % GameManager.launch_count
	_essence_label.text = NumberFormat.format(
		CurrencyManager.get_balance(CurrencyManager.ESSENCE)
	)
	_render_current_state()


func _process(_delta: float) -> void:
	var time_text: String = GameManager.format_time(GameManager.total_play_time)
	_play_time_label.text = time_text


# --- Input -------------------------------------------------------------------


func _on_combat_area_input(event: InputEvent) -> void:
	# Touch input arrives here as emulated mouse events too, so handling only
	# mouse buttons gives exactly one attack per tap on every platform.
	if event is InputEventMouseButton \
			and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_last_tap_position = event.position
		_has_tap_position = true
		CombatManager.player_tap_attack()
		_has_tap_position = false


# --- Combat signal handlers ----------------------------------------------------


func _on_enemy_spawned(definition: EnemyDefinition, level: int, max_hp: float) -> void:
	_update_health(max_hp, max_hp)
	if definition.is_boss:
		return  # the boss_fight_started handler owns the boss dressing
	_enemy_name_label.text = definition.display_name
	_enemy_name_label.visible = true
	if CombatManager.state == CombatManager.State.FARM_MODE:
		_stage_label.text = "Enemy Lv. %d · Boss at Lv. %d" % [level, CombatManager.enemy_level]
	else:
		_stage_label.text = "Enemy Lv. %d" % level


func _on_enemy_damaged(amount: float, is_crit: bool, hp: float, max_hp: float) -> void:
	_update_health(hp, max_hp)
	_spawn_damage_number(amount, is_crit)
	if is_crit:
		SettingsManager.vibrate(20)


func _on_enemy_died(_level: int, total_kills: int) -> void:
	_kills_label.text = "Void creatures slain: %s" % NumberFormat.format(float(total_kills))
	# Boss kills get the single stronger buzz from the win handler instead.
	if CombatManager.state != CombatManager.State.BOSS_FIGHT:
		SettingsManager.vibrate(35)


func _on_auto_attack_unlocked() -> void:
	add_child(AUTO_ATTACK_TOAST_SCENE.instantiate())
	_pop_badge()
	SettingsManager.vibrate(50)


func _on_offline_rewards_ready(_amount: float, _seconds: int, _capped: bool) -> void:
	# Pull the authoritative pending state; whoever consumes first wins,
	# so a re-emitted announcement can never double-show.
	var data: Dictionary = IdleManager.consume_pending_offline_rewards()
	if data.is_empty():
		return
	_enqueue_modal(func() -> Node:
		var modal: OfflineRewardsModal = OFFLINE_REWARDS_MODAL_SCENE.instantiate()
		modal.setup(data["amount"], data["seconds_away"], data["was_capped"])
		add_child(modal)
		SettingsManager.vibrate(15)
		return modal
	)


func _on_boss_fight_started(
	definition: EnemyDefinition, level: int, _max_hp: float, _duration: float
) -> void:
	_boss_name_label.text = definition.display_name.to_upper()
	_boss_plate.visible = true
	_enemy_name_label.visible = false
	_challenge_boss_button.visible = false
	var prefix: String = "World Boss" if WorldManager.is_world_boss_gate(level) else "Boss"
	_stage_label.text = "%s · Lv. %d" % [prefix, level]
	_dress_health_bar(true)
	_slam_boss_plate()
	SettingsManager.vibrate(50)


## The plate slams in at higher amplitude than the badge pop (spec §4A).
func _slam_boss_plate() -> void:
	await get_tree().process_frame
	if not _boss_plate.visible:
		return
	_boss_plate.pivot_offset = _boss_plate.size * 0.5
	_boss_plate.scale = Vector2(1.4, 1.4)
	create_tween().tween_property(_boss_plate, "scale", Vector2.ONE, 0.3) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func _on_boss_fight_won(_level: int, payout: float, is_world_boss: bool) -> void:
	_undress_boss()
	SettingsManager.vibrate(60)
	if is_world_boss and WorldManager.has_pending_unlock_celebration():
		return  # the World Unlock modal is the celebration — never both
	# (The final world's boss has no next world to unlock — it gets the
	# normal win banner so the moment is never silent.)
	var banner: ResultBanner = RESULT_BANNER_SCENE.instantiate()
	banner.setup(
		BOSS_SKULL_TEXTURE, "BOSS FELLED",
		"+%s Essence — the path ahead is open." % NumberFormat.format(payout), true
	)
	_show_banner(banner)


func _on_boss_fight_failed(_level: int) -> void:
	_undress_boss()
	# No haptic: haptics mark rewards and impacts, never failures.
	var banner: ResultBanner = RESULT_BANNER_SCENE.instantiate()
	banner.setup(
		BOSS_SKULL_TEXTURE, "THE BOSS ENDURES",
		"Farm essence, grow stronger — challenge again anytime.", false
	)
	_show_banner(banner)
	_challenge_boss_button.disabled = false
	_pop_challenge_button()


## Pop-in for the retry path (the badge-pop idiom, spec §4B).
func _pop_challenge_button() -> void:
	_challenge_boss_button.visible = true
	await get_tree().process_frame
	if not _challenge_boss_button.visible:
		return
	_challenge_boss_button.pivot_offset = _challenge_boss_button.size * 0.5
	_challenge_boss_button.scale = Vector2(0.9, 0.9)
	create_tween().tween_property(_challenge_boss_button, "scale", Vector2.ONE, 0.24) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func _on_challenge_boss_pressed() -> void:
	# Disabled until resolution so double-taps cannot double-enter.
	_challenge_boss_button.disabled = true
	CombatManager.request_boss_challenge()


func _on_world_unlocked(_world: WorldDefinition) -> void:
	# Live unlock: give the death-and-payout beat its moment, then queue.
	get_tree().create_timer(0.6).timeout.connect(_enqueue_unlock_presentation)


func _on_scene_transition_finished(scene_path: String) -> void:
	# Re-present an unacknowledged unlock on arrival (UX spec §6).
	if scene_path == SceneManager.SCENE_GAMEPLAY \
			and WorldManager.has_pending_unlock_celebration():
		_enqueue_unlock_presentation()


func _on_currency_changed(currency: StringName, balance: float) -> void:
	if currency != CurrencyManager.ESSENCE:
		return
	_essence_label.text = NumberFormat.format(balance)
	_pop_essence_display()


func _on_gear_pressed() -> void:
	SceneManager.change_scene(SceneManager.SCENE_GEAR)


func _on_item_dropped(item: Dictionary) -> void:
	var rarity: int = int(item["rarity"])
	# Haptics mark meaningful drops only — Common/Rare are frequent and
	# silent (UX spec §4D).
	if rarity >= EquipmentManager.Rarity.EPIC:
		SettingsManager.vibrate(15)
	_update_count_pill()
	var slot_def: SlotDefinition = EquipmentManager.get_slot_definition(item["slot"])
	var slot_name: String = slot_def.display_name if slot_def != null else str(item["slot"])
	# Mythic drops get the full Result Banner; everything else a Loot Toast
	# that collapses if one is already showing.
	if rarity >= EquipmentManager.Rarity.MYTHIC:
		var banner: ResultBanner = RESULT_BANNER_SCENE.instantiate()
		banner.setup(BOSS_SKULL_TEXTURE, "MYTHIC DROP",
			"%s %s" % [RarityStyle.rarity_name(rarity), slot_name], true)
		_show_banner(banner)
		return
	if _active_loot_toast != null and is_instance_valid(_active_loot_toast):
		_active_loot_toast.add_item(item)
		return
	var toast: Node = LOOT_TOAST_SCENE.instantiate()
	toast.setup(item)
	_active_loot_toast = toast
	toast.tree_exited.connect(func() -> void: _active_loot_toast = null)
	add_child(toast)


func _update_count_pill() -> void:
	var count: int = EquipmentManager.get_unseen_count()
	_count_pill.visible = count > 0
	_count_label.text = "%d NEW" % count


func _on_menu_pressed() -> void:
	SceneManager.change_scene(SceneManager.SCENE_MAIN_MENU)


# --- Internals ---------------------------------------------------------------


func _render_current_state() -> void:
	_kills_label.text = "Void creatures slain: %s" \
		% NumberFormat.format(float(CombatManager.total_kills))
	# Steady-state badge on load — no pop, no toast (UX spec §2A branch).
	_auto_attack_badge.visible = IdleManager.auto_attack_unlocked
	if IdleManager.auto_attack_unlocked:
		_start_badge_pulse()
	_world_label.text = WorldManager.get_world_for_level(
		CombatManager.enemy_level
	).display_name.to_upper()
	var in_farm_mode: bool = CombatManager.state == CombatManager.State.FARM_MODE
	_challenge_boss_button.visible = in_farm_mode
	_challenge_boss_button.disabled = false
	var mid_boss_fight: bool = CombatManager.state == CombatManager.State.BOSS_FIGHT \
		and CombatManager.is_enemy_alive()
	_boss_plate.visible = mid_boss_fight
	_enemy_name_label.visible = not mid_boss_fight
	_dress_health_bar(mid_boss_fight)
	if CombatManager.is_enemy_alive():
		var definition: EnemyDefinition = CombatManager.get_enemy_definition()
		if mid_boss_fight:
			_boss_name_label.text = definition.display_name.to_upper()
		else:
			_enemy_name_label.text = definition.display_name
		_update_health(CombatManager.enemy_hp, CombatManager.enemy_max_hp)
	else:
		# Between kill and respawn — the spawn signal fills this in shortly.
		_enemy_name_label.text = ""
		_update_health(0.0, 1.0)
	# Stage label per state (review #4: farm re-entry must keep the wall
	# suffix and show the level actually being fought).
	if mid_boss_fight:
		var world_gate: bool = WorldManager.is_world_boss_gate(CombatManager.enemy_level)
		var prefix: String = "World Boss" if world_gate else "Boss"
		_stage_label.text = "%s · Lv. %d" % [prefix, CombatManager.enemy_level]
	elif in_farm_mode:
		_stage_label.text = "Enemy Lv. %d · Boss at Lv. %d" % [
			CombatManager.get_effective_kill_level(), CombatManager.enemy_level,
		]
	else:
		_stage_label.text = "Enemy Lv. %d" % CombatManager.enemy_level


func _update_health(hp: float, max_hp: float) -> void:
	_health_bar.max_value = max_hp
	_health_bar.value = hp
	_health_label.text = "%s / %s" % [NumberFormat.format(hp), NumberFormat.format(max_hp)]


func _dress_health_bar(boss: bool) -> void:
	_health_bar.theme_type_variation = &"BossHealthBar" if boss else &""
	_health_bar.custom_minimum_size.y = 60 if boss else 46


func _undress_boss() -> void:
	_boss_plate.visible = false
	_enemy_name_label.visible = true
	_dress_health_bar(false)


## Depth-1 banner queue: layer-50 transients never stack (pattern §7.2).
func _show_banner(banner: ResultBanner) -> void:
	if _active_banner != null and is_instance_valid(_active_banner):
		_queued_banner = banner
		return
	_active_banner = banner
	banner.tree_exited.connect(_on_banner_exited)
	add_child(banner)


func _on_banner_exited() -> void:
	_active_banner = null
	if _queued_banner != null and is_instance_valid(_queued_banner):
		var next_banner: ResultBanner = _queued_banner
		_queued_banner = null
		_show_banner(next_banner)


## One-at-a-time blocking-modal queue (UX spec §6: offline first, unlock
## on its dismissal; generalized for future must-acknowledge moments).
func _enqueue_modal(spawner: Callable) -> void:
	_modal_queue.append(spawner)
	if not _modal_active:
		_present_next_modal()


func _present_next_modal() -> void:
	if _modal_queue.is_empty():
		_modal_active = false
		return
	_modal_active = true
	var spawner: Callable = _modal_queue.pop_front()
	var modal: Node = spawner.call()
	if modal == null:
		_present_next_modal()
		return
	modal.tree_exited.connect(_present_next_modal)


func _enqueue_unlock_presentation() -> void:
	if _unlock_presentation_queued or not WorldManager.has_pending_unlock_celebration():
		return
	_unlock_presentation_queued = true
	_enqueue_modal(func() -> Node:
		var world: WorldDefinition = WorldManager.get_pending_unlock_world()
		if world == null:
			_unlock_presentation_queued = false
			return null
		var modal: WorldUnlockModal = WORLD_UNLOCK_MODAL_SCENE.instantiate()
		modal.setup(world, WorldManager.unlock_celebration_payout)
		modal.confirmed.connect(_on_unlock_acknowledged.bind(world))
		add_child(modal)
		# The sky recolors behind the scrim once the card settles (§4C).
		get_tree().create_timer(0.45).timeout.connect(_tween_world_palette.bind(world))
		SettingsManager.vibrate(50)
		return modal
	)


func _on_unlock_acknowledged(world: WorldDefinition) -> void:
	_unlock_presentation_queued = false
	WorldManager.acknowledge_unlock_celebration()
	# The new world's first enemy spawns now, on ENTER (spec §2B/§4C).
	CombatManager.resume_spawning()
	_world_label.text = world.display_name.to_upper()
	_world_label.pivot_offset = _world_label.size * 0.5
	_world_label.scale = Vector2(1.15, 1.15)
	create_tween().tween_property(_world_label, "scale", Vector2.ONE, 0.25) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


## Instant palette apply for the current world (cold loads and scene
## entries — transitions are for live unlocks only, §4C).
func _apply_world_palette() -> void:
	var world: WorldDefinition = WorldManager.get_world_for_level(CombatManager.enemy_level)
	var material: ShaderMaterial = _nebula_rect.material
	material.set_shader_parameter("deep_color", world.deep_color)
	material.set_shader_parameter("nebula_color", world.nebula_color)
	material.set_shader_parameter("accent_color", world.accent_color)


func _tween_world_palette(world: WorldDefinition) -> void:
	var material: ShaderMaterial = _nebula_rect.material
	var tween: Tween = create_tween().set_parallel(true)
	tween.tween_property(material, "shader_parameter/deep_color", world.deep_color, 0.8)
	tween.tween_property(material, "shader_parameter/nebula_color", world.nebula_color, 0.8)
	tween.tween_property(material, "shader_parameter/accent_color", world.accent_color, 0.8)


## One-time badge pop-in at the unlock moment (UX spec §4A).
func _pop_badge() -> void:
	_auto_attack_badge.visible = true
	# The badge has never been laid out while hidden — wait one frame so
	# WorldVBox assigns its real size before computing the pivot.
	await get_tree().process_frame
	_auto_attack_badge.pivot_offset = _auto_attack_badge.size * 0.5
	_auto_attack_badge.scale = Vector2.ZERO
	var tween: Tween = create_tween()
	tween.tween_property(_auto_attack_badge, "scale", Vector2.ONE, 0.24) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_start_badge_pulse()


## Decorative 1.2s opacity pulse — the badge's text and icon alone carry
## the state, per the Enhanced accessibility tier.
func _start_badge_pulse() -> void:
	if _badge_pulse_tween != null and _badge_pulse_tween.is_valid():
		return
	_badge_pulse_tween = create_tween().set_loops()
	_badge_pulse_tween.tween_property(_auto_attack_badge, "modulate:a", 0.75, 0.6) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_badge_pulse_tween.tween_property(_auto_attack_badge, "modulate:a", 1.0, 0.6) \
		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)


## Small scale bounce on the essence counter every time it changes.
func _pop_essence_display() -> void:
	if _essence_pop_tween != null and _essence_pop_tween.is_valid():
		_essence_pop_tween.kill()
	_essence_display.pivot_offset = _essence_display.size * 0.5
	_essence_display.scale = Vector2(1.12, 1.12)
	_essence_pop_tween = create_tween()
	_essence_pop_tween.tween_property(_essence_display, "scale", Vector2.ONE, 0.18) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func _spawn_damage_number(amount: float, is_crit: bool) -> void:
	var number: DamageNumber = DAMAGE_NUMBER_SCENE.instantiate()
	number.setup(amount, is_crit)
	_fx_layer.add_child(number)

	var spawn_position: Vector2
	if _has_tap_position:
		spawn_position = _last_tap_position
	else:
		# Auto attacks (Milestone 4) have no tap point — rise above the enemy.
		spawn_position = _combat_area.size * Vector2(0.5, 0.3) \
			+ Vector2(randf_range(-40.0, 40.0), 0.0)
	number.position = spawn_position - number.size * 0.5
