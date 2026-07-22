class_name SlotDefinition
extends Resource
## One equipment slot. Data-driven so the slot set is content, not code.

## Stable id used in item data and save files. Never rename.
@export var id: StringName = &""

@export var display_name: String = ""

## Slot icon (neutral-tinted chrome).
@export var icon: Texture2D

## Sealed slots are shown but cannot hold items yet (the relic slot until
## Milestone 7). Flavor line shown in the empty tile.
@export var sealed: bool = false

@export var sealed_flavor: String = ""
