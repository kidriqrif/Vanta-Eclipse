class_name PetDefinition
extends Resource
## One pet line — a companion that levels and evolves through stages, each
## granting one passive bonus that scales with level.

## Stable id used in save files. Never rename after release.
@export var id: StringName = &""

## Per-stage display names (index 0 = stage 1). Size = number of stages.
@export var stage_names: PackedStringArray = []

## Per-stage sprites, parallel to stage_names.
@export var stage_sprites: Array[Texture2D] = []

## Levels at which the pet advances to the next stage, ascending. A pet
## with stage_names size 2 and evolution_levels [10] is stage 1 below
## level 10 and stage 2 at 10+.
@export var evolution_levels: PackedInt32Array = []

## The PlayerStats stat this pet's bonus feeds (&"essence", &"tap_pct",
## &"crit_chance", &"crit_damage", &"boss", &"tap_flat").
@export var bonus_stat: StringName = &""

## Bonus fraction added per level (bonus = bonus_per_level * level).
@export var bonus_per_level: float = 0.02

@export var max_level: int = 30
