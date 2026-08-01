class_name AdPlacementDefinition
extends Resource
## One opt-in rewarded-ad offer. Adding or retuning a placement is a .tres.

enum RewardKind {
	## Seconds of the player's live essence rate — stays proportionate forever.
	ESSENCE_SECONDS,
	ARCADE_TOKENS,
	## Multiplies a caller-supplied amount (the offline-rewards doubler).
	MULTIPLY_PENDING,
}

@export var id: StringName = &""
@export var display_name: String = ""
@export var description: String = ""
@export var reward_kind: RewardKind = RewardKind.ESSENCE_SECONDS
@export var reward_amount: float = 600.0
## Offers per UTC day. Keeps "grind ads" from ever being the optimal strategy.
@export var daily_cap: int = 3
## True when the offer only means anything at a specific moment (the offline
## doubler needs a pending amount). Contextual placements are surfaced by that
## moment's UI and never listed in the Shop, where they would grant nothing.
@export var contextual: bool = false
@export var sort_order: int = 0
