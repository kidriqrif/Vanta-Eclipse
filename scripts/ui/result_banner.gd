class_name ResultBanner
extends CanvasLayer
## Transient Result Banner (pattern library §7.2 of the M5 spec).
## Repeatable, parameterized, non-blocking two-second flourish — the
## Unlock Celebration Toast's geometry and motion with configurable
## content. Self-freeing (DamageNumber idiom).
##
## Usage: instantiate, setup(...), add_child. The gameplay scene owns a
## depth-1 queue so banners never stack on layer 50.

const WIN_BORDER: Color = Color(0.91, 0.196, 0.235, 0.9)
const WIN_SHADOW: Color = Color(0.91, 0.196, 0.235, 0.3)
const NEUTRAL_BORDER: Color = Color(0.141, 0.141, 0.184, 0.8)
const NEUTRAL_SHADOW: Color = Color(0.031, 0.031, 0.047, 0.5)
const WIN_HEADLINE_OUTLINE: Color = Color(0.478, 0.055, 0.11, 0.55)

var _icon: Texture2D
var _headline: String = ""
var _body: String = ""
var _is_win: bool = true

@onready var _panel: PanelContainer = %BannerPanel
@onready var _icon_rect: TextureRect = %BannerIcon
@onready var _headline_label: Label = %BannerHeadline
@onready var _body_label: Label = %BannerBody


## Call BEFORE add_child().
func setup(icon: Texture2D, headline: String, body: String, is_win: bool) -> void:
	_icon = icon
	_headline = headline
	_body = body
	_is_win = is_win


func _ready() -> void:
	_icon_rect.texture = _icon
	_headline_label.text = _headline
	_body_label.text = _body

	# Win celebrates in the reward violet; fail stays neutral — failure
	# copy redirects, it never scolds (UX spec §3C).
	var stylebox: StyleBoxFlat = _panel.get_theme_stylebox("panel").duplicate()
	stylebox.border_color = WIN_BORDER if _is_win else NEUTRAL_BORDER
	stylebox.shadow_color = WIN_SHADOW if _is_win else NEUTRAL_SHADOW
	stylebox.shadow_size = 18 if _is_win else 12
	_panel.add_theme_stylebox_override("panel", stylebox)
	if _is_win:
		_headline_label.add_theme_color_override("font_color", UIPalette.title())
		_headline_label.add_theme_color_override("font_outline_color", WIN_HEADLINE_OUTLINE)
		_headline_label.add_theme_constant_override("outline_size", 6)
	else:
		_headline_label.add_theme_color_override("font_color", UIPalette.ink())

	_panel.pivot_offset = _panel.size * 0.5
	_panel.scale = Vector2.ZERO
	_panel.modulate.a = 0.0
	var tween: Tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(_panel, "scale", Vector2.ONE, 0.3) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(_panel, "modulate:a", 1.0, 0.3)
	tween.chain().tween_interval(1.6)
	tween.chain().tween_property(_panel, "modulate:a", 0.0, 0.3)
	tween.chain().tween_callback(queue_free)
