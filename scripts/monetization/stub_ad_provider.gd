class_name StubAdProvider
extends AdProvider
## Development stand-in for a real ad network: waits, then always succeeds.
##
## It exists so the offer flows, daily caps, rewards and UI are real and
## testable long before an SDK is wired. It must NEVER reach a store build —
## MonetizationManager.USE_STUB_PROVIDERS gates it, and the Shop screen shows a
## development banner while it is live.

const SIMULATED_WATCH_SECONDS: float = 3.0

var _tree: SceneTree


func _init(tree: SceneTree) -> void:
	_tree = tree


func request_rewarded(_placement_id: StringName) -> bool:
	# A real ad takes time; simulating that keeps the UI honest about the wait
	# it will have to cover once the SDK is real.
	await _tree.create_timer(SIMULATED_WATCH_SECONDS).timeout
	return true
