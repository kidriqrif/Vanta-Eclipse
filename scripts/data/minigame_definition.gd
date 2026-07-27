class_name MinigameDefinition
extends Resource
## Data asset describing one Arcade minigame. Designers add a minigame by
## writing a scene whose root extends Minigame and dropping a .tres here —
## the Arcade hub and the host build themselves from these, so the framework
## never changes to gain a game.

## Stable identifier used in save files. Never rename after release.
@export var id: StringName = &""

@export var display_name: String = ""

## One short line shown on the hub card.
@export var description: String = ""

@export var icon: Texture2D

## Scene whose root extends Minigame.
@export var scene_path: String = ""

## Enemy level at which this card unlocks.
@export var unlock_level: int = 20

## The game's worth, in SECONDS of the player's live essence rate. Payout is
## this many seconds of current progress scaled by performance, so a win stays
## meaningful at every point in the game with no retuning.
@export var reward_seconds: float = 240.0

@export var token_cost: int = 1

## How this game's score ranks. Most games want a high score; a "fewest moves"
## or "fastest time" game sets this so records compare the other way.
@export var lower_is_better: bool = false

## Per-game configuration handed to Minigame.setup() — board size, difficulty,
## piece counts, whatever the game needs. Keeps tuning in data, not code.
@export var context: Dictionary = {}

## Position in the hub list (lower = higher up).
@export var sort_order: int = 0
