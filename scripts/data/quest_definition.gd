class_name QuestDefinition
extends Resource
## Data asset describing one Journal goal — a quest, a daily, or an achievement.
## All three kinds share this shape, so new content of any kind is a .tres in
## data/quests/ and never a code change.

enum Kind {
	## Linear chain, one active at a time; teaches the game in order.
	QUEST,
	## Three at once, rerolled every UTC day.
	DAILY,
	## Permanent record, all visible from the start.
	ACHIEVEMENT,
}

enum MetricShape {
	## A counter the Journal owns and saves, fed by EventBus. Only ever rises.
	CUMULATIVE,
	## A value another manager already owns; read live, never stored twice.
	SNAPSHOT,
}

enum RewardKind {
	## Seconds of the player's live essence rate — stays meaningful forever.
	ESSENCE_SECONDS,
	ARCADE_TOKENS,
	VOID_CRYSTALS,
}

## Stable identifier used in save files. Never rename after release.
@export var id: StringName = &""

@export var display_name: String = ""

## One short line describing what to do.
@export var description: String = ""

@export var kind: Kind = Kind.ACHIEVEMENT

## What is being counted. See the implementation notes for the metric table;
## QuestManager decides what each one means.
@export var metric: StringName = &""

@export var metric_shape: MetricShape = MetricShape.CUMULATIVE

@export var target: float = 1.0

@export var reward_kind: RewardKind = RewardKind.ESSENCE_SECONDS

@export var reward_amount: float = 120.0

## Display order. For a QUEST this is also its position in the chain.
@export var sort_order: int = 0


## Human-readable reward, e.g. "+4m of Essence" or "+3 Void Crystals".
func format_reward() -> String:
	match reward_kind:
		RewardKind.ARCADE_TOKENS:
			var tokens: int = int(reward_amount)
			return "+%d Arcade Token%s" % [tokens, "" if tokens == 1 else "s"]
		RewardKind.VOID_CRYSTALS:
			var crystals: int = int(reward_amount)
			return "+%d Void Crystal%s" % [crystals, "" if crystals == 1 else "s"]
		_:
			# Essence is priced in seconds of progress, so say it in those terms
			# rather than as a figure that would be meaningless out of context.
			var minutes: int = int(round(reward_amount / 60.0))
			if minutes < 1:
				return "+%ds of Essence" % int(reward_amount)
			return "+%dm of Essence" % minutes
