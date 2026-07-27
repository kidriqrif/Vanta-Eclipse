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
	_quiesce(self)
	set_process(false)
	set_physics_process(false)
	set_process_input(false)
	set_process_unhandled_input(false)


## Stop every child Timer and disable every child button.
##
## Disabling the buttons is the load-bearing half: setting mouse_filter on the
## root does NOT stop its children from receiving taps (picking checks children
## first), so without this a resolved game still answers input.
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
