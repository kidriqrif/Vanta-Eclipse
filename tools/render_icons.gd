extends SceneTree
## Rasterise the icon SVGs to the exact PNG sizes Play and Android require.
##
## Uses Godot's own SVG rasteriser (the ThorVG backend behind every .svg in
## sprites/), so the shipped icon is pixel-identical to what the game draws
## rather than whatever a separate tool would have produced.
##
## Run:  godot --headless --path . --script res://tools/render_icons.gd
## Output: production/icons/*.png — commit these; Play and the Android
## manifest both want PNG, and export_presets.cfg points at them by path.

## source svg -> [[out_name, pixel_size], ...]
const JOBS: Dictionary = {
	"res://icon.svg": [
		# Legacy launcher icon, pre-Android-8 and the fallback everywhere else.
		["launcher_192.png", 192],
	],
	"res://production/icons/adaptive_foreground.svg": [
		["adaptive_foreground_432.png", 432],
	],
	"res://production/icons/adaptive_background.svg": [
		["adaptive_background_432.png", 432],
	],
	"res://production/icons/store_icon.svg": [
		# Play Console listing icon. Must be opaque — flattened below.
		["store_icon_512.png", 512],
	],
}

const OUT_DIR: String = "res://production/icons"
## Anything Play shows as a solid tile must not carry alpha.
const OPAQUE: PackedStringArray = ["store_icon_512.png", "adaptive_background_432.png"]


func _init() -> void:
	DirAccess.make_dir_recursive_absolute(OUT_DIR)
	var failures: int = 0
	for svg_path: String in JOBS:
		var text: String = FileAccess.get_file_as_string(svg_path)
		if text.is_empty():
			push_error("render_icons: cannot read %s" % svg_path)
			failures += 1
			continue
		for job: Array in JOBS[svg_path]:
			var out_name: String = job[0]
			var size: int = job[1]
			if not _render(text, svg_path, out_name, size):
				failures += 1
	print("render_icons: %s" % ("OK" if failures == 0 else "%d FAILED" % failures))
	quit(1 if failures > 0 else 0)


func _render(svg_text: String, source: String, out_name: String, size: int) -> bool:
	var image := Image.new()
	# The SVGs are authored at their native size, so scale is a plain ratio.
	# Rasterising at the target size (rather than scaling a bitmap afterwards)
	# is the whole point: the curves stay analytically sharp at 192px.
	var native: float = _native_width(svg_text)
	if native <= 0.0:
		push_error("render_icons: no width on %s" % source)
		return false
	var error: int = image.load_svg_from_string(svg_text, size / native)
	if error != OK:
		push_error("render_icons: rasterise failed for %s (error %d)" % [source, error])
		return false
	# ThorVG rounds; force the exact dimensions Play validates against.
	if image.get_width() != size or image.get_height() != size:
		image.resize(size, size, Image.INTERPOLATE_LANCZOS)
	if out_name in OPAQUE:
		image = _flatten(image)
	var out_path: String = "%s/%s" % [OUT_DIR, out_name]
	if image.save_png(out_path) != OK:
		push_error("render_icons: cannot write %s" % out_path)
		return false
	print("  %-30s %dx%d  alpha=%s" % [
		out_name, image.get_width(), image.get_height(), image.detect_alpha() != Image.ALPHA_NONE
	])
	return true


func _native_width(svg_text: String) -> float:
	var regex := RegEx.new()
	regex.compile('width="([0-9.]+)"')
	var found := regex.search(svg_text)
	return found.get_string(1).to_float() if found != null else 0.0


## Composite onto the base colour and drop the alpha channel entirely.
## save_png() keeps RGBA8 otherwise, and Play rejects a store icon with an
## alpha channel even when every pixel in it is opaque.
func _flatten(source: Image) -> Image:
	var flat := Image.create_empty(source.get_width(), source.get_height(), false, Image.FORMAT_RGB8)
	flat.fill(Color("#0B0B0D"))
	for y: int in source.get_height():
		for x: int in source.get_width():
			var pixel: Color = source.get_pixel(x, y)
			flat.set_pixel(x, y, flat.get_pixel(x, y).lerp(pixel, pixel.a))
	return flat
