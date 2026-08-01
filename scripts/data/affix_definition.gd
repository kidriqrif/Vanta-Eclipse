class_name AffixDefinition
extends Resource
## One rollable equipment affix. The affix pool is data — new affixes are
## new .tres files, no code change.

## Stable id used in item data and save files. Never rename.
@export var id: StringName = &""

## The PlayerStats stat this feeds: &"tap_flat", &"tap_pct", &"crit_chance",
## &"crit_damage", &"essence", &"boss".
@export var stat: StringName = &""

## Plain-language line; {value} is substituted with the formatted magnitude.
@export var display_template: String = "{value}"

## Roll range (before the rarity multiplier). For flat stats the value also
## scales with item level (see EquipmentManager.generate_item).
@export var min_value: float = 0.0
@export var max_value: float = 1.0

## True for stats read as fractions (percent display); false for flat.
@export var is_percent: bool = true

## Flat stats scale with the item's level by this factor per level.
@export var level_scale: float = 0.0
