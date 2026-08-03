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


## All essence earned at this world's levels is multiplied by this.
@export var essence_multiplier: float = 1.0
