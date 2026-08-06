class_name CardRarityDefinition
extends Resource
## One rarity tier a boss card can roll. Adding a tier is one .tres.
##
## Card STATS are rolled at runtime and live in the save, not here — a card is
## an instance, not a definition, so there is no .tres per card. What lives in
## data is the shape of the roll: how often a tier comes up, how hard it hits,
## and what colour it wears. That keeps the tuning a designer actually turns
## out of CardManager entirely.

## Stable id used in save files. Never rename after release.
@export var id: StringName = &""

@export var display_name: String = ""

## Relative weight in the rarity roll. Weights are summed at load, so they do
## not have to add to anything in particular.
@export var drop_weight: float = 1.0

## Multiplies every rolled stat on a card of this tier. This is the whole
## difference between a common and a legendary — the stat ROLL is the same
## spread, scaled.
@export var potency_multiplier: float = 1.0

## Lowest world-boss tier that may roll this rarity. A boss on stage 3 should
## not hand out legendaries, and this is the floor that stops it.
@export var minimum_boss_level: int = 1

## The tier's colour, worn by the card frame and its name.
@export var color: Color = Color(0.525, 0.525, 0.635, 1)

## Position in collection sort (lower = rarer, listed first).
@export var sort_order: int = 0
