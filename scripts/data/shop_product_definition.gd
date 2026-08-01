class_name ShopProductDefinition
extends Resource
## One purchasable product. `store_id` is the SKU a real store would use; the
## stub billing provider ignores it.

enum Kind {
	## Permanent entitlement (remove_ads).
	ENTITLEMENT,
	## One-time bundle of currencies and/or a cosmetic.
	BUNDLE,
	## Premium currency.
	SHARDS,
}

@export var id: StringName = &""
@export var store_id: String = ""
@export var display_name: String = ""
@export var description: String = ""
@export var kind: Kind = Kind.BUNDLE
@export var price_text: String = "$2.99"
## Bundle contents (all optional).
@export var crystals: float = 0.0
@export var tokens: int = 0
@export var shards: float = 0.0
@export var cosmetic_id: StringName = &""
@export var sort_order: int = 0
