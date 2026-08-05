class_name RarityStyle
extends RefCounted
## Shared rarity presentation: colors, names, and the affix-count pip row
## that carries rarity color-free. Used by slot tiles, inventory rows, the
## Inspector Card, and Loot Toasts so the system is defined once.

## A HUE ladder, one entry per tier, all five from the 16-colour palette.
##
## It used to be a value ladder — five greys climbing in brightness with only
## Mythic allowed any chroma — because the old scheme was a single red accent
## on neutrals and five competing hues would have fought it.
##
## A sixteen-colour palette has room for the hues and, more to the point, not
## enough room for the greys: snapping the old ramp onto it landed Rare and
## Epic on the SAME neutral, because the palette carries seven neutrals total
## and four of those are darker than any text. Two adjacent tiers that render
## identically is a worse outcome than any amount of colour.
##
## Still colour-blind safe, for the same reason it always was: make_pip_row()
## draws (rarity + 1) pips, so the tier is carried by COUNT and the hue is
## reinforcement.
## Tier count, so callers clamp without indexing a colour table.
const TIERS: int = 5
const NAMES: Array[String] = ["Common", "Rare", "Epic", "Legendary", "Mythic"]

const PIP_SIZE: float = 13.0
const PIP_CELL: float = 20.0
const PIP_SEPARATION: int = 4
const PIP_OUTLINE: Color = Color(0.031, 0.031, 0.047, 0.4)


## Common and Mythic BORROW their colours from the theme rather than restating
## them: they are the muted register and the accent, and a rarity ladder that
## drifts from the chrome it sits inside looks broken rather than deliberate.
## The middle three are palette hues the UI chrome never uses, so there is
## nothing to borrow — they are written out here, and check_ui.py's palette
## membership rule is what stops them wandering off the sixteen.
##
## A function rather than a const array because a GDScript `const` has to be
## resolvable at compile time, which rules out calling UIPalette at all.
static func color(rarity: int) -> Color:
	match clampi(rarity, 0, TIERS - 1):
		1: return Color(0.243, 0.863, 0.98, 1)   # Rare      — frost
		2: return Color(0.659, 0.361, 1, 1)   # Epic      — violet
		3: return Color(1, 0.824, 0.235, 1)   # Legendary — gold
		4: return UIPalette.accent()              # Mythic
	return UIPalette.muted()                      # Common — recedes


static func rarity_name(rarity: int) -> String:
	return NAMES[clampi(rarity, 0, NAMES.size() - 1)]


## Build an HBox of (rarity+1) diamond pips — the color-independent rarity
## signal (pip count == affix count == tier). Each pip carries a dark
## outline so light-colored pips (Common/Legendary) stay legible on light
## background patches. Caller adds it to the tree.
static func make_pip_row(rarity: int) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", PIP_SEPARATION)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var pip_color: Color = color(rarity)
	var style := StyleBoxFlat.new()
	style.bg_color = pip_color
	style.set_border_width_all(1)
	style.border_color = PIP_OUTLINE
	for i in range(rarity + 1):
		# A fixed cell keeps HBox layout stable while the inner panel is
		# rotated 45° into a diamond.
		var cell := Control.new()
		cell.custom_minimum_size = Vector2(PIP_CELL, PIP_CELL)
		cell.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var pip := Panel.new()
		pip.add_theme_stylebox_override("panel", style)
		pip.size = Vector2(PIP_SIZE, PIP_SIZE)
		pip.position = Vector2((PIP_CELL - PIP_SIZE) * 0.5, (PIP_CELL - PIP_SIZE) * 0.5)
		pip.pivot_offset = Vector2(PIP_SIZE, PIP_SIZE) * 0.5
		pip.rotation = deg_to_rad(45.0)
		pip.mouse_filter = Control.MOUSE_FILTER_IGNORE
		cell.add_child(pip)
		row.add_child(cell)
	return row


## The item's headline stat line, e.g. "Tap Damage +12" for its biggest
## affix — a glanceable "what does it do" for tiles and rows.
static func key_stat_line(item: Dictionary) -> String:
	var affixes: Dictionary = item.get("affixes", {})
	if affixes.is_empty():
		return ""
	var best_id: StringName = &""
	for id: StringName in affixes:
		best_id = id
		break
	return EquipmentManager.format_affix(best_id, affixes[best_id])
