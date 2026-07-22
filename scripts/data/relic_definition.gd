class_name RelicDefinition
extends Resource
## One relic — a unique, named, permanent coded effect. Not affix gear.
## Adding a relic is one .tres; only a NEW effect_id needs manager code.

## Stable id used in save files. Never rename after release.
@export var id: StringName = &""

@export var display_name: String = ""

## The relic sigil (Aureate gold family).
@export var sigil: Texture2D

## Routing key the RelicManager match()es on: &"boss_pct", &"crit_dmg",
## &"essence_mult", &"offline_mult", &"attack_speed".
@export var effect_id: StringName = &""

## The effect magnitude (meaning depends on effect_id).
@export var effect_value: float = 0.0

## The one canonical plain-language sentence shown to the player.
@export var effect_description: String = ""

@export var flavor: String = ""

## Relative drop weight within the relic table.
@export var drop_weight: float = 1.0
