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
