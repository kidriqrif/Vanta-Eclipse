class_name CosmeticDefinition
extends Resource
## A tap-trail cosmetic. Cosmetics live where NO state is encoded — the tap
## impact and its damage numbers — so they can reuse family hues freely without
## touching the accent scope law.

@export var id: StringName = &""
@export var display_name: String = ""
@export var trail_color: Color = Color(0.655, 0.545, 0.98, 1)
@export var number_color: Color = Color(0.91, 0.896, 0.944, 1)
## Astral Shards to buy it. 0 = granted (the default, or a bundle reward).
@export var shard_price: float = 0.0
@export var sort_order: int = 0
