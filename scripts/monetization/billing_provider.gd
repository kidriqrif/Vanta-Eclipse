class_name BillingProvider
extends RefCounted
## The whole contract between the game and whatever processes purchases.
##
## TODO(pre-release, BLOCKING): add PlayBillingProvider implementing this
## against the Godot Google Play Billing plugin, INCLUDING server-side receipt
## validation (see design/RELEASE-CHECKLIST.md).
## A client-only "purchase succeeded" is trivially spoofable and must never be
## trusted for anything that costs real money.


## Attempt to buy a product. Returns true only on a completed, acknowledged
## purchase. Implementations MUST be safe to await.
func purchase(_product_id: StringName) -> bool:
	return false


## Restore previously-owned non-consumables (a store requirement on both
## platforms). Returns the product ids the account owns.
func restore_purchases() -> Array[StringName]:
	return []
