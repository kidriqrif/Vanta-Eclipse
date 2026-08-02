class_name RarityStyle
extends RefCounted
## Shared rarity presentation: colors, names, and the affix-count pip row
## that carries rarity color-free. Used by slot tiles, inventory rows, the
## Inspector Card, and Loot Toasts so the system is defined once.

## A VALUE ladder, not a rainbow. The tiers used to be five saturated hues
## (blue / violet / gold / rose), which is four accents competing with the UI
## and with each other. Here they climb in brightness and only the top tier is
## allowed any chroma, so a Mythic drop is the one moment colour appears in the
## inventory at all.
##
## This is safe to do because rarity never depended on colour: make_pip_row()
## below draws (rarity + 1) pips, so the tier is carried by COUNT and the
## colour has always been reinforcement.
const COLORS: Array[Color] = [
	Color(0.404, 0.404, 0.435, 1),  # Common — recedes
	Color(0.588, 0.588, 0.624, 1),  # Rare
	Color(0.769, 0.769, 0.804, 1),  # Epic
	Color(0.949, 0.949, 0.965, 1),  # Legendary — near white
	Color(1.0, 0.231, 0.188, 1),    # Mythic — the accent, and only here
]
const NAMES: Array[String] = ["Common", "Rare", "Epic", "Legendary", "Mythic"]

const PIP_SIZE: float = 13.0
const PIP_CELL: float = 20.0
const PIP_SEPARATION: int = 4
const PIP_OUTLINE: Color = Color(0, 0, 0, 0.4)


static func color(rarity: int) -> Color:
	return COLORS[clampi(rarity, 0, COLORS.size() - 1)]


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
