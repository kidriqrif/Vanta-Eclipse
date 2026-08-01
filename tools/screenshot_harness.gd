extends Node
## Drives a cold boot to the gameplay screen and saves real framebuffer grabs.
##
## Registered as the LAST autoload by tools/screenshot_run.sh, which removes
## the entry again when it finishes — this is never part of a shipped build,
## and project.godot is restored even if the run crashes.
##
## Why it exists: `--headless` uses the dummy rasterizer and never compiles a
## shader, so a headless run proves the scripts boot and nothing more. Only a
## real renderer proves effects/*.gdshader compile, and only a screenshot
## proves the result looks like anything. That is not a hypothetical — the
## first real run showed the enemy's contact shadow was invisible against the
## near-black void backdrop, which no static check could ever have caught.
##
## Output dir comes from VANTA_SHOT_DIR, falling back to user://shots.

var _out_dir: String = ""


func _ready() -> void:
	_out_dir = OS.get_environment("VANTA_SHOT_DIR")
	if _out_dir.is_empty():
		_out_dir = ProjectSettings.globalize_path("user://shots")
	DirAccess.make_dir_recursive_absolute(_out_dir)

	# Last autoload, so every manager below has finished _ready() by now.
	await get_tree().create_timer(2.0).timeout
	await _shot("00_main_menu")

	SceneManager.change_scene(SceneManager.SCENE_GAMEPLAY)
	# Fade out + threaded load + fade in, then let an enemy spawn and settle
	# into the idle hover so the ground glow is mid-animation.
	await get_tree().create_timer(3.5).timeout
	await _shot("01_gameplay_idle")

	# Land taps: damage numbers, the hit flash, the tap trail and the death
	# burst are all code paths a boot-only run never reaches.
	for _i in 6:
		CombatManager.player_tap_attack()
		await get_tree().create_timer(0.12).timeout
	await _shot("02_gameplay_combat")

	print("HARNESS: shots written to ", _out_dir)
	# Leaks ~11 ObjectDB instances because this quits mid-await. That warning
	# is the harness, not the game: a plain --quit-after boot exits clean.
	get_tree().quit()


func _shot(shot_name: String) -> void:
	# The framebuffer is only readable after the frame has actually been drawn.
	await RenderingServer.frame_post_draw
	var image: Image = get_viewport().get_texture().get_image()
	if image == null:
		print("HARNESS: no image for ", shot_name)
		return
	var path: String = "%s/%s.png" % [_out_dir, shot_name]
	print("HARNESS: ", shot_name, " -> err ", image.save_png(path))
