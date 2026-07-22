class_name RarityStyle
extends RefCounted
## Shared rarity presentation: colors, names, and the affix-count pip row
## that carries rarity color-free. Used by slot tiles, inventory rows, the
## Inspector Card, and Loot Toasts so the system is defined once.

const COLORS: Array[Color] = [
	Color(0.612, 0.639, 0.686, 1),  # Common
	Color(0.22, 0.741, 0.973, 1),   # Rare
	Color(0.753, 0.518, 0.988, 1),  # Epic
	Color(0.984, 0.749, 0.141, 1),  # Legendary
	Color(0.984, 0.353, 0.49, 1),   # Mythic
]
const NAMES: Array[String] = ["Common", "Rare", "Epic", "Legendary", "Mythic"]

const PIP_SIZE: float = 14.0
const PIP_SEPARATION: int = 4


static func color(rarity: int) -> Color:
	return COLORS[clampi(rarity, 0, COLORS.size() - 1)]


static func rarity_name(rarity: int) -> String:
	return NAMES[clampi(rarity, 0, NAMES.size() - 1)]


## Build an HBox of (rarity+1) pips — the color-independent rarity signal
## (pip count == affix count == tier). Caller adds it to the tree.
static func make_pip_row(rarity: int) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", PIP_SEPARATION)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var pip_color: Color = color(rarity)
	for i in range(rarity + 1):
		var pip := ColorRect.new()
		pip.color = pip_color
		pip.custom_minimum_size = Vector2(PIP_SIZE, PIP_SIZE)
		pip.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_child(pip)
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
