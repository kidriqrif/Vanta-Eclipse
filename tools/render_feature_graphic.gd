extends SceneTree
## Compose the 1024x500 Play Store feature graphic.
##
## Must run WINDOWED, not --headless: the headless dummy rasteriser draws
## nothing, so a headless capture is a blank PNG that still saves successfully.
## Same reason tools/screenshot_run.sh runs the game in a real window.
##
## Run:  godot --path . --resolution 1024x500 \
##             --script res://tools/render_feature_graphic.gd
##
## Composes through a SubViewport at exactly 1024x500 rather than capturing the
## window, so the project's `expand` stretch cannot resize the result.

const OUT_PATH: String = "res://production/icons/feature_graphic_1024x500.png"
const MARK_SVG: String = "res://production/icons/adaptive_foreground.svg"
const FONT_BLACK: String = "res://fonts/nunito-latin-900-normal.woff2"
const FONT_BOLD: String = "res://fonts/nunito-latin-700-normal.woff2"

const WIDTH: int = 1024
const HEIGHT: int = 500
## Play crops this asset differently across surfaces; keep everything that
## matters away from the edges.
const MARGIN: float = 64.0

const BASE := Color("#0B0B0D")
const INK := Color("#EDEDF0")
const MUTED := Color("#9C9CA5")
const ACCENT := Color("#FF3B30")

var _viewport: SubViewport
var _frames: int = 0


func _initialize() -> void:
	_viewport = SubViewport.new()
	_viewport.size = Vector2i(WIDTH, HEIGHT)
	_viewport.transparent_bg = false
	_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	_viewport.add_child(_build())
	root.add_child(_viewport)


func _process(_delta: float) -> bool:
	_frames += 1
	# A couple of frames so the SubViewport has actually drawn once.
	if _frames < 4:
		return false
	var image: Image = _viewport.get_texture().get_image()
	# Feature graphics must be fully opaque; SubViewport can hand back RGBA8.
	image.convert(Image.FORMAT_RGB8)
	if image.save_png(OUT_PATH) != OK:
		push_error("render_feature_graphic: could not write %s" % OUT_PATH)
		return true
	print("feature graphic: %dx%d -> %s" % [image.get_width(), image.get_height(), OUT_PATH])
	return true


func _build() -> Control:
	var page := Control.new()
	page.size = Vector2(WIDTH, HEIGHT)

	var background := ColorRect.new()
	background.color = BASE
	background.size = Vector2(WIDTH, HEIGHT)
	page.add_child(background)

	# Corona glow bled behind the mark so the left half is not flat black.
	var glow := TextureRect.new()
	glow.texture = _radial_glow(512, ACCENT)
	glow.size = Vector2(760, 760)
	glow.position = Vector2(-140, (HEIGHT - 760) * 0.5)
	glow.modulate = Color(1, 1, 1, 0.5)
	page.add_child(glow)

	var mark := TextureRect.new()
	mark.texture = _svg_texture(MARK_SVG, 300)
	mark.size = Vector2(300, 300)
	mark.position = Vector2(MARGIN + 20.0, (HEIGHT - 300) * 0.5)
	page.add_child(mark)

	var text_left: float = MARGIN + 20.0 + 300.0 + 56.0
	var text_width: float = WIDTH - text_left - MARGIN

	# The wordmark is set on two lines. One line of "VANTA ECLIPSE" large
	# enough to carry the graphic does not fit beside a 300px mark — measured,
	# not estimated, because the first attempt at 74px ran off the right edge.
	var black: Font = load(FONT_BLACK)
	var bold: Font = load(FONT_BOLD)
	var title_size: int = mini(
		_fit(black, "VANTA", text_width, 92),
		_fit(black, "ECLIPSE", text_width, 92)
	)
	var line_height: float = title_size * 1.02
	var block_top: float = 148.0

	for i: int in 2:
		var line := Label.new()
		line.text = ["VANTA", "ECLIPSE"][i]
		line.add_theme_font_override("font", black)
		line.add_theme_font_size_override("font_size", title_size)
		line.add_theme_color_override("font_color", INK)
		line.size = Vector2(text_width, line_height)
		line.position = Vector2(text_left, block_top + i * line_height)
		page.add_child(line)

	# A short accent rule instead of a second colour or a glow — the same
	# restraint the in-game theme uses to separate a title from its subtitle.
	var rule_top: float = block_top + 2 * line_height + 22.0
	var rule := ColorRect.new()
	rule.color = ACCENT
	rule.size = Vector2(96, 5)
	rule.position = Vector2(text_left + 3.0, rule_top)
	page.add_child(rule)

	var tagline := Label.new()
	tagline.text = "Your hero fights on while you're away."
	tagline.add_theme_font_override("font", bold)
	tagline.add_theme_font_size_override("font_size", _fit(bold, tagline.text, text_width, 28))
	tagline.add_theme_color_override("font_color", MUTED)
	tagline.size = Vector2(text_width, 44)
	tagline.position = Vector2(text_left, rule_top + 26.0)
	page.add_child(tagline)

	return page


## Largest size at or below `start` at which `text` fits `max_width`.
## Play crops the feature graphic, so overrunning the margin is not a cosmetic
## problem — the first and last letters are the ones that get eaten.
func _fit(font: Font, text: String, max_width: float, start: int) -> int:
	var size: int = start
	while size > 10:
		if font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x <= max_width:
			return size
		size -= 1
	return size


func _svg_texture(path: String, pixel_size: int) -> ImageTexture:
	var text: String = FileAccess.get_file_as_string(path)
	var image := Image.new()
	# adaptive_foreground.svg is authored at 432.
	image.load_svg_from_string(text, pixel_size / 432.0)
	if image.get_width() != pixel_size:
		image.resize(pixel_size, pixel_size, Image.INTERPOLATE_LANCZOS)
	return ImageTexture.create_from_image(image)


## Soft radial falloff, built rather than loaded so the graphic needs no extra
## asset committed alongside it.
func _radial_glow(size: int, color: Color) -> ImageTexture:
	var image := Image.create_empty(size, size, false, Image.FORMAT_RGBA8)
	var centre: float = size * 0.5
	for y: int in size:
		for x: int in size:
			var distance: float = Vector2(x - centre, y - centre).length() / centre
			var alpha: float = clampf(1.0 - distance, 0.0, 1.0)
			# squared falloff reads as light, linear reads as a flat disc
			image.set_pixel(x, y, Color(color.r, color.g, color.b, alpha * alpha * 0.55))
	return ImageTexture.create_from_image(image)
