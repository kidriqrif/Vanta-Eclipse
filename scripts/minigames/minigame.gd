class_name Minigame
extends Control
## Base class every Arcade minigame extends. It is the whole contract between
## a game and the framework, and it is deliberately tiny.
##
## The host owns all framing, payout, saving, and scene flow; a minigame owns
## only its own play. A minigame must NOT change scenes, touch currency or
## tokens, or call SaveManager — it just plays, then reports once.
##
## Lifecycle:
##     host: instantiate -> setup(context) -> add_child
##     game: _ready() builds the board and starts play
##     game: emits finished(result) exactly once, via _finish()
##
## result = {"outcome": Outcome, "performance": float 0-1, "score": float,
##           "detail": String}

## Emitted exactly once, when the run ends for any reason.
signal finished(result: Dictionary)

enum Outcome { WIN, LOSS, QUIT }

## Guards the emit-once contract — _finish() is a no-op after the first call.
var _finished: bool = false
## Tweens started through create_managed_tween(), so teardown() can kill them.
var _managed_tweens: Array[Tween] = []


## Override to receive host context (difficulty, modifiers, ...). Called
## BEFORE the node enters the tree, so _ready() can rely on it.
func setup(_context: Dictionary) -> void:
	pass


## Called by the host's QUIT flow only. A minigame never quits itself.
func force_quit() -> void:
	_finish(Outcome.QUIT, 0.0, 0.0, "Forfeited")


## Stop playing. The host calls this the moment a run resolves, so the board
## freezes under the result banner instead of playing on beneath it (the
## banner does not block input).
##
## The base implementation handles the two things every minigame has: it stops
## every child Timer and refuses further input. That is why child Timers are
## the required idiom for game timing — a `get_tree().create_timer()` is owned
## by the SceneTree, not the game, so teardown cannot reach it. Override to add
## your own quiescing, and call super() first.
func teardown() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	for tween: Tween in _managed_tweens:
		if tween != null and tween.is_valid():
			tween.kill()
	_managed_tweens.clear()
	# Killing a tween leaves its property wherever it stopped, so a pop, drop or
	# flip caught mid-flight would freeze the board shrunken or squashed under
	# the result banner. Every game's animations start from an off-rest scale
	# and return to ONE, so restoring it here settles all of them — on EVERY
	# terminal path, including a forfeit, which never runs a game's end routine.
	# A game whose resting scale is not ONE must override this and call super().
	_snap_rest(self)
	_quiesce(self)
	set_process(false)
	set_physics_process(false)
	set_process_input(false)
	set_process_unhandled_input(false)


## A one-shot child Timer wired to `handler`.
##
## CHILD, not get_tree().create_timer(): a SceneTree timer is owned by the tree,
## so teardown() cannot reach it and a forfeited run keeps firing under the
## result banner. Every game needs this and four of them had written it out.
func make_timer(handler: Callable) -> Timer:
	var timer := Timer.new()
	timer.one_shot = true
	timer.timeout.connect(handler)
	add_child(timer)
	return timer


## Paint a button flat in one fill and one border, across EVERY state.
##
## Setting only "normal" is the trap: a board cell repainted on tap reverts to
## the theme's look the moment a finger rests on it, because hover/pressed are
## still the theme's. The disabled state is included so a finished board keeps
## the colours it ended on.
func paint_button(button: Button, fill: Color, border: Color, width: int) -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = border
	style.set_border_width_all(width)
	for state: String in ["normal", "hover", "pressed", "focus", "disabled"]:
		button.add_theme_stylebox_override(state, style)


## Start a tween the framework can stop. Use this instead of create_tween():
## the SceneTree drives tweens independently of process_mode, so an unmanaged
## one keeps animating after a run resolves and can flip a card or drop a piece
## underneath the result banner.
func create_managed_tween() -> Tween:
	var tween: Tween = create_tween()
	_managed_tweens.append(tween)
	# Keep the list from growing across a long run.
	_managed_tweens = _managed_tweens.filter(
		func(t: Tween) -> bool: return t != null and t.is_valid()
	)
	return tween


## Stop every child Timer and disable every child button.
##
## Disabling the buttons is the load-bearing half: setting mouse_filter on the
## root does NOT stop its children from receiving taps (picking checks children
## first), so without this a resolved game still answers input.
func _snap_rest(node: Node) -> void:
	for child: Node in node.get_children():
		if child is Control:
			(child as Control).scale = Vector2.ONE
		_snap_rest(child)


func _quiesce(node: Node) -> void:
	for child: Node in node.get_children():
		if child is Timer:
			child.stop()
		elif child is BaseButton:
			child.disabled = true
		_quiesce(child)


## Report the run's end. Subclasses call this instead of emitting directly:
## it enforces emit-once and clamps performance into the payout's valid range.
func _finish(
	outcome: Outcome, performance: float, score: float, detail: String
) -> void:
	if _finished:
		return
	_finished = true
	finished.emit({
		"outcome": outcome,
		"performance": clampf(performance, 0.0, 1.0),
		"score": score,
		"detail": detail,
	})
