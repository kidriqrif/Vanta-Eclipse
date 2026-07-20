class_name WorldDefinition
extends Resource
## Data asset describing one 50-level world. Adding a world is a data
## drop: one .tres here, creature/boss definitions, and sprites.

## Stable identifier used in save files. Never rename after release.
@export var id: StringName = &""

@export var display_name: String = ""

## First enemy level of this world (1, 51, 101, ...).
@export var first_level: int = 1

## Normal-enemy roster (EnemyDefinition .tres paths).
@export var enemy_definition_paths: Array[String] = []

## Boss for each gate in order (+10, +20, +30, +40, +50/world boss).
@export var boss_definition_paths: Array[String] = []

## Nebula shader palette (deep_color / nebula_color / accent_color).
@export var deep_color: Color = Color(0.016, 0.008, 0.035)
@export var nebula_color: Color = Color(0.1, 0.05, 0.22)
@export var accent_color: Color = Color(0.36, 0.19, 0.66)

## All essence earned at this world's levels is multiplied by this.
@export var essence_multiplier: float = 1.0
