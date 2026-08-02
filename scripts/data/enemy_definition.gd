class_name EnemyDefinition
extends Resource
## Data asset describing one enemy type. Designers add new enemies by creating
## a .tres file in data/enemies/ — no code changes needed.
##
## Note: a world names its own roster via WorldDefinition.enemy_definition_paths
## rather than each enemy naming its world, and loot is generated from the kill
## LEVEL by EquipmentManager rather than a per-enemy table. Both were considered
## here and deliberately solved on the other side.

## Stable identifier used in code and (later) loot tables. Never rename.
@export var id: StringName = &""

## Name shown above the health bar.
@export var display_name: String = ""

## The enemy's sprite (SVG or PNG).
@export var texture: Texture2D

## Relative toughness: 1.0 = baseline, 1.3 = 30% more health.
@export var hp_multiplier: float = 1.0

## Accent color used for death particles and effects.
@export var glow_color: Color = Color(0.769, 0.769, 0.804)

## True for boss-tier enemies (boss HUD dressing, timed fights).
@export var is_boss: bool = false

## Sprite scale multiplier applied by EnemyView (bosses ~1.3).
@export var view_scale: float = 1.0
