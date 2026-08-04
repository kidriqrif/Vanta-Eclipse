extends Control
## MinigameHost — the frame around whatever minigame is loaded. It owns
## everything that is NOT the game: the header, the forfeit flow, the payout,
## the record, the save, and the exit.
##
## This is why a new minigame is a scene plus a .tres and never a framework
## change: the game only plays and reports, the host does the rest.

const RESULT_BANNER_SCENE: PackedScene = preload("res://scenes/common/result_banner.tscn")

## Retired with the other door accents — one accent, game-wide.

## How long the armed QUIT confirm stays hot before disarming.
const ARM_SECONDS: float = 2.5

var _definition: MinigameDefinition
var _game: Minigame
var _quit_armed: bool = false
var _resolved: bool = false
var _disarm_timer: Timer

@onready var _quit_button: Button = %QuitButton
@onready var _title_label: Label = %TitleLabel
@onready var _header_spacer: Control = %HeaderSpacer
@onready var _game_body: Control = %GameBody


func _ready() -> void:
	_disarm_timer = Timer.new()
	_disarm_timer.one_shot = true
	_disarm_timer.timeout.connect(_disarm_quit)
	add_child(_disarm_timer)
	_quit_button.pressed.connect(_on_quit_pressed)

	# The hub hands the choice over through the manager, since change_scene
	# takes only a path. Read-and-clear so a stale id can't leak into a
	# later entry.
	var id: StringName = MinigameManager.pending_id
	MinigameManager.pending_id = &""
	_definition = MinigameManager.get_definition(id)
	if _definition == null:
		push_error("MinigameHost: no pending minigame — returning to the Arcade.")
		SceneManager.change_scene(SceneManager.SCENE_ARCADE)
		return
	_title_label.text = _definition.display_name.to_upper()
	_load_game()


func _load_game() -> void:
	var packed: PackedScene = load(_definition.scene_path)
	if packed == null:
		push_error("MinigameHost: could not load %s" % _definition.scene_path)
		SceneManager.change_scene(SceneManager.SCENE_ARCADE)
		return
	var instance: Node = packed.instantiate()
	if not instance is Minigame:
		push_error("MinigameHost: %s does not extend Minigame." % _definition.scene_path)
		instance.queue_free()
		SceneManager.change_scene(SceneManager.SCENE_ARCADE)
		return
	_game = instance
	# setup() before add_child, so the game's _ready() can rely on its context.
	# The context is data, from the definition — tuning never lives in code.
	_game.setup(_definition.context.duplicate(true))
	_game.finished.connect(_on_game_finished)
	_game.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_game_body.add_child(_game)


# --- Quit (Two-Tap Arm: the token is already spent, so this forfeits) ---------


func _on_quit_pressed() -> void:
	if _resolved:
		return
	if not _quit_armed:
		_quit_armed = true
		_quit_button.text = "TAP AGAIN: FORFEIT"
		_style_quit(true)
		_disarm_timer.start(ARM_SECONDS)
		return
	_disarm_timer.stop()
	if _game != null and is_instance_valid(_game):
		_game.force_quit()
	else:
		SceneManager.change_scene(SceneManager.SCENE_ARCADE)


func _disarm_quit() -> void:
	_quit_armed = false
	_quit_button.text = "QUIT"
	_style_quit(false)


func _style_quit(armed: bool) -> void:
	# The armed face is much wider than "QUIT", so it takes the header to
	# itself for the 2.5s arm window rather than shoving the title off centre.
	# (Reserving space for it instead would clip longer game titles.)
	_title_label.visible = not armed
	_header_spacer.visible = not armed
	if not armed:
		for state: String in ["normal", "hover", "pressed"]:
			_quit_button.remove_theme_stylebox_override(state)
		_quit_button.remove_theme_color_override("font_color")
		_quit_button.remove_theme_color_override("font_hover_color")
		return
	var style := StyleBoxFlat.new()
	style.bg_color = UIPalette.accent()
	style.set_content_margin_all(10)
	for state: String in ["normal", "hover", "pressed"]:
		_quit_button.add_theme_stylebox_override(state, style)
	var ink := Color.WHITE
	_quit_button.add_theme_color_override("font_color", ink)
	_quit_button.add_theme_color_override("font_hover_color", ink)


# --- Result ------------------------------------------------------------------


func _on_game_finished(result: Dictionary) -> void:
	if _resolved:
		return
	_resolved = true
	# The contract says emit-once, but disconnecting makes the host safe even
	# against a misbehaving game.
	if _game != null and is_instance_valid(_game):
		if _game.finished.is_connected(_on_game_finished):
			_game.finished.disconnect(_on_game_finished)
		# Freeze the board: the banner does not block input, so without this a
		# forfeited game keeps ticking and accepting taps underneath it.
		_game.teardown()
	_quit_button.disabled = true
	_disarm_timer.stop()
	# Never leave the armed face on a button that can no longer be tapped.
	if _quit_armed:
		_disarm_quit()
		_quit_button.disabled = true

	var outcome: int = int(result.get("outcome", Minigame.Outcome.LOSS))
	var won: bool = outcome == Minigame.Outcome.WIN
	var performance: float = float(result.get("performance", 0.0))
	# A loss or forfeit still pays a fraction — attempting is never punished.
	if not won:
		performance *= MinigameManager.LOSS_FLOOR
	var payout: float = MinigameManager.compute_payout(_definition, performance)

	CurrencyManager.add(CurrencyManager.ESSENCE, payout)
	EventBus.essence_earned.emit(payout, &"minigame")
	# Records are for COMPLETED runs only. A loss or forfeit did not achieve the
	# objective, so its score is not comparable to one that did — and for a
	# lower_is_better game a loss scores the worst possible value, which would
	# otherwise be written in as the first "best".
	var is_best: bool = false
	if outcome == Minigame.Outcome.WIN:
		is_best = MinigameManager.record_result(
			_definition.id, float(result.get("score", 0.0))
		)
	SaveManager.save_game()
	EventBus.minigame_finished.emit(_definition.id, outcome, payout)
	SettingsManager.vibrate(40 if won else 15)

	var headline: String = "VICTORY" if won else (
		"FORFEIT" if outcome == Minigame.Outcome.QUIT else "RUN COMPLETE"
	)
	var body: String = "+%s Essence" % NumberFormat.format(payout)
	var detail: String = str(result.get("detail", ""))
	if detail != "":
		body = "%s · %s" % [detail, body]
	if is_best:
		body += "  ★ BEST"
	var banner: ResultBanner = RESULT_BANNER_SCENE.instantiate()
	banner.setup(_definition.icon, headline, body, won)
	banner.tree_exited.connect(func() -> void:
		SceneManager.change_scene(SceneManager.SCENE_ARCADE)
	)
	add_child(banner)
