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

## Where the last tap landed, so its damage number spawns under the finger.
var _last_tap_position: Vector2 = Vector2.ZERO
var _has_tap_position: bool = false
var _essence_pop_tween: Tween
var _badge_pulse_tween: Tween

@onready var _auto_attack_badge: PanelContainer = %AutoAttackBadge
@onready var _essence_display: HBoxContainer = %EssenceDisplay
@onready var _essence_label: Label = %EssenceLabel
@onready var _upgrades_button: Button = %UpgradesButton
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
	_combat_area.gui_input.connect(_on_combat_area_input)
	_menu_button.pressed.connect(_on_menu_pressed)
	_upgrades_button.pressed.connect(_shop_panel.toggle)

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
	_enemy_name_label.text = definition.display_name
	_stage_label.text = "Enemy Lv. %d" % level
	_update_health(max_hp, max_hp)


func _on_enemy_damaged(amount: float, is_crit: bool, hp: float, max_hp: float) -> void:
	_update_health(hp, max_hp)
	_spawn_damage_number(amount, is_crit)
	if is_crit:
		SettingsManager.vibrate(20)


func _on_enemy_died(_level: int, total_kills: int) -> void:
	_kills_label.text = "Void creatures slain: %s" % NumberFormat.format(float(total_kills))
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
	var modal: OfflineRewardsModal = OFFLINE_REWARDS_MODAL_SCENE.instantiate()
	modal.setup(data["amount"], data["seconds_away"], data["was_capped"])
	add_child(modal)
	SettingsManager.vibrate(15)


func _on_currency_changed(currency: StringName, balance: float) -> void:
	if currency != CurrencyManager.ESSENCE:
		return
	_essence_label.text = NumberFormat.format(balance)
	_pop_essence_display()


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
	if CombatManager.is_enemy_alive():
		var definition: EnemyDefinition = CombatManager.get_enemy_definition()
		_enemy_name_label.text = definition.display_name
		_stage_label.text = "Enemy Lv. %d" % CombatManager.enemy_level
		_update_health(CombatManager.enemy_hp, CombatManager.enemy_max_hp)
	else:
		# Between kill and respawn — the spawn signal fills this in shortly.
		_enemy_name_label.text = ""
		_stage_label.text = "Enemy Lv. %d" % CombatManager.enemy_level
		_update_health(0.0, 1.0)


func _update_health(hp: float, max_hp: float) -> void:
	_health_bar.max_value = max_hp
	_health_bar.value = hp
	_health_label.text = "%s / %s" % [NumberFormat.format(hp), NumberFormat.format(max_hp)]


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
