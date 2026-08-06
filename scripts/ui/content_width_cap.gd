extends MarginContainer
## Stops a screen's content stranding itself on a wide display.
##
## The game is laid out for a 1080-wide portrait viewport under
## stretch/mode="canvas_items" with aspect="expand", which only ever GROWS the
## logical viewport: a taller phone is given extra height, a tablet extra
## width, and nothing is ever cropped. That is the right behaviour up to a
## point and the wrong one past it. At 3072 logical pixels — a 16:10 tablet in
## landscape — a bottom bar designed for 1080 is stretched to three times its
## width and the content it framed becomes a ribbon in an empty field. The
## layout audit passes the whole time, because nothing overflows or clips;
## stranding is not overflow, and measuring for overflow cannot see it.
##
## This stopped being hypothetical when the build moved to targetSdk 36.
## Android 16 ignores android:screenOrientation on displays 600dp and wider, so
## a tablet or an unfolded foldable will show this portrait-only game in
## landscape whether it asks to or not, and so will any phone in split-screen.
##
## Past MAX_CONTENT_WIDTH the extra width becomes side margin instead of
## content: the screen keeps its designed proportions and centres, which is
## what a portrait game on a wide screen should do. Below the cap this changes
## nothing at all, so every phone shape renders exactly as it did before.
##
## Attached to the root MarginContainer of every full screen. It is a script
## rather than a container type because the margins it sets are the ones the
## scene already declares, plus a computed inset — replacing the node would
## throw away per-screen margins that are deliberately not uniform.

## The width the layout was designed against. Content never exceeds it.
const MAX_CONTENT_WIDTH: float = 1080.0

## The scene's own declared margins, captured before anything is overridden.
## Read once in _ready(): after the first _apply() the getter would return this
## script's computed value, and the base would drift outward every resize.
var _base_left: int = 0
var _base_right: int = 0


func _ready() -> void:
	_base_left = get_theme_constant(&"margin_left")
	_base_right = get_theme_constant(&"margin_right")
	get_viewport().size_changed.connect(_apply)
	_apply()


func _apply() -> void:
	var width: float = get_viewport_rect().size.x
	var inset: int = int(maxf(0.0, width - MAX_CONTENT_WIDTH) * 0.5)
	add_theme_constant_override(&"margin_left", _base_left + inset)
	add_theme_constant_override(&"margin_right", _base_right + inset)
