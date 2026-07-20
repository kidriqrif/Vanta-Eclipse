class_name EnemyDefinition
extends Resource
## Data asset describing one enemy type. Designers add new enemies by creating
## a .tres file in data/enemies/ — no code changes needed.
##
## TODO(Milestone 5): add world_id so each world pulls its own enemy pool.
## TODO(Milestone 6): add loot table reference.

## Stable identifier used in code and (later) loot tables. Never rename.
@export var id: StringName = &""

## Name shown above the health bar.
@export var display_name: String = ""

## The enemy's sprite (SVG or PNG).
@export var texture: Texture2D

## Relative toughness: 1.0 = baseline, 1.3 = 30% more health.
@export var hp_multiplier: float = 1.0

## Accent color used for death particles and effects.
@export var glow_color: Color = Color(0.6, 0.4, 1.0)
