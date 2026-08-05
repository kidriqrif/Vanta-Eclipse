class_name UIPalette
extends RefCounted
## The one place a script may ask the theme for a colour.
##
## Screens build rows and cards in code, so they need palette values that a
## `theme_type_variation` cannot reach. Before this they each kept their own
## `const IVORY`/`const MUTED` copy — sixteen files holding the same two
## literals. That was invisible duplication until the palette changed, at
## which point every copy silently kept the old colour and the restyle only
## half-applied: the theme was right and the screens were wrong.
##
## Reading the Theme resource directly (rather than `Control.get_theme_color`)
## means this works from any script, including ones not in the tree yet, and
## keeps `main_theme.tres` the single source of truth.
##
## The surface and accent values are pulled out of styleboxes rather than
## re-declared here, for the same reason: a stylebox IS the theme's statement
## about what that colour is, so reading it cannot drift from it.
##
## `tools/check_ui.py` fails the sweep on any script that hardcodes a colour
## the theme already defines, so the duplication cannot come back.

const THEME: Theme = preload("res://ui/theme/main_theme.tres")


## Primary body text.
static func ink() -> Color:
	return THEME.get_color(&"font_color", &"Label")


## Secondary / supporting text — the muted register.
static func muted() -> Color:
	return THEME.get_color(&"font_color", &"HeaderLabel")


## Display headlines.
static func title() -> Color:
	return THEME.get_color(&"font_color", &"TitleLabel")


## The bright accent: marks, active state, small text on black. Read off the
## slider fill, which is the theme's plainest statement of "this is the accent".
static func accent() -> Color:
	return _box_color(&"grabber_area", &"HSlider", Color(1, 0.227, 0.275))


## The deep accent: a fill that white text sits on. Not interchangeable with
## accent() — that one is tuned to be READ against black, this one to be read
## THROUGH, and neither clears 7:1 in the other's job.
static func accent_deep() -> Color:
	return _box_color(&"normal", &"PrimaryButton", Color(0.69, 0.071, 0.157))


## Panel fill.
static func surface() -> Color:
	return _box_color(&"panel", &"PanelContainer", Color(0.09, 0.09, 0.133))


## A row or tile sitting on a panel — one step up from the surface.
static func raised() -> Color:
	return _box_color(&"hover", &"Button", Color(0.173, 0.173, 0.235))


## Hairline dividers and inactive borders.
static func line() -> Color:
	var box: StyleBoxFlat = THEME.get_stylebox(&"normal", &"Button") as StyleBoxFlat
	return box.border_color if box != null else Color(0.173, 0.173, 0.235)


## Same colour at a different alpha, for scrims and de-emphasised states.
static func fade(color: Color, alpha: float) -> Color:
	return Color(color.r, color.g, color.b, alpha)


static func _box_color(name: StringName, type: StringName, fallback: Color) -> Color:
	var box: StyleBoxFlat = THEME.get_stylebox(name, type) as StyleBoxFlat
	return box.bg_color if box != null else fallback
