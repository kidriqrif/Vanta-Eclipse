class_name AdProvider
extends RefCounted
## The whole contract between the game and whatever serves rewarded ads.
##
## Deliberately one method. Everything else — caps, rewards, entitlements, UI —
## lives in MonetizationManager, so swapping the stub for a real SDK is one new
## subclass and one line in the manager, with no caller touched.
##
## TODO(Milestone 15): add AdMobProvider implementing this against the Godot
## Android AdMob plugin, and flip MonetizationManager.USE_STUB_PROVIDERS.


## Show a rewarded ad. Returns true only if it was watched to completion —
## false covers "no fill", "not ready", "dismissed early", and any error.
## Implementations MUST be safe to await and MUST never leave the caller hanging.
func request_rewarded(_placement_id: StringName) -> bool:
	return false
