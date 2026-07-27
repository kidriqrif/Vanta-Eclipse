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
