class_name StubBillingProvider
extends BillingProvider
## Development stand-in for a real store: grants instantly, charges nothing.
##
## Must NEVER reach a store build. See StubAdProvider.

var _tree: SceneTree


func _init(tree: SceneTree) -> void:
	_tree = tree


func purchase(_product_id: StringName) -> bool:
	await _tree.create_timer(0.4).timeout
	return true


func restore_purchases() -> Array[StringName]:
	# The stub owns nothing: local entitlements already live in the save, and
	# pretending to restore would mask a broken real implementation later.
	return []
