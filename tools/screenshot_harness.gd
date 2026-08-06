extends Node
## Walks every screen in the game on a real renderer and saves framebuffer grabs.
##
## Registered as the LAST autoload by tools/screenshot_run.sh, which removes the
## entry again when it finishes — this is never part of a shipped build, and
## project.godot is restored even if the run crashes.
##
## Why it exists: `--headless` uses the dummy rasterizer and never compiles a
## shader, so a headless run proves the scripts boot and nothing more. Only a
## real renderer proves effects/*.gdshader compile, and only a screenshot proves
## the result looks like anything. That is not hypothetical — the first real run
## showed the enemy's contact shadow was invisible against the near-black void
## backdrop, which no static check could ever have caught.
##
## Coverage is the whole game, not a sample, because a defect that only touches
## one screen is exactly the kind static checks pass and nobody notices: the
## Gear screen can be broken for a week while gameplay looks perfect.
##
## Two passes. The first is a cold save — the state a new player boots into,
## where every list is empty and the empty states are the thing being checked.
## The second seeds a late-game save and re-shoots the screens whose whole job
## is rendering content, plus the doors (Eclipse, Arcade) that a cold save
## hides. Transients — banners, toasts, modals — are driven at the end, since
## they are children of the gameplay screen and are never on screen at rest.
##
##   VANTA_SHOT_DIR    where the PNGs go (default user://shots)
##   VANTA_SHOT_ONLY   substring filter, e.g. "gear" — for a fast iteration
##                     loop when only one screen is being worked on

const RESULT_BANNER_SCENE: PackedScene = preload("res://scenes/common/result_banner.tscn")
const LOOT_TOAST_SCENE: PackedScene = preload("res://scenes/gear/loot_toast.tscn")
const INSPECTOR_CARD_SCENE: PackedScene = preload("res://scenes/gear/inspector_card.tscn")
const OFFLINE_MODAL_SCENE: PackedScene = preload(
	"res://scenes/gameplay/offline_rewards_modal.tscn"
)
const WORLD_UNLOCK_SCENE: PackedScene = preload("res://scenes/gameplay/world_unlock_modal.tscn")
const BOSS_SKULL: Texture2D = preload("res://sprites/ui/boss_skull_icon.png")
## The same material the gameplay screen lights enemies with.
const BESTIARY_MATERIAL: Material = preload("res://effects/pixel_sprite_material.tres")

## A scene change is fade-out (0.25) + threaded load + a frame + fade-in (0.25).
## The slack on top lets a spawned enemy settle into its idle hover, so the
## ground glow is caught mid-animation rather than at rest.
const SETTLE_SECONDS: float = 1.8
## Panels tween open; long enough for the slide to finish and hold.
const PANEL_SECONDS: float = 0.9

var _out_dir: String = ""
var _only: String = ""
var _taken: int = 0
var _skipped: int = 0
var _layout_problems: int = 0
var _controls_seen: int = 0
var _font_problems: int = 0
var _font_device_problems: int = 0
var _text_controls_seen: int = 0
var _glyph_box: int = -1
## Scenes _goto() asked for and did not get. Any at all invalidates the run.
var _scene_failures: int = 0
var _probe: bool = false


func _ready() -> void:
	_out_dir = OS.get_environment("VANTA_SHOT_DIR")
	if _out_dir.is_empty():
		_out_dir = ProjectSettings.globalize_path("user://shots")
	DirAccess.make_dir_recursive_absolute(_out_dir)
	_only = OS.get_environment("VANTA_SHOT_ONLY")
	_probe = OS.get_environment("VANTA_LAYOUT_PROBE") == "1"
	_assert_phone_aspect()

	# Last autoload, so every manager below has finished _ready() by now.
	await get_tree().create_timer(2.0).timeout

	await _pass_cold()
	await _pass_seeded()
	await _pass_transients()
	await _pass_bestiary()

	print("HARNESS: %d shots written to %s (%d skipped by filter)"
		% [_taken, _out_dir, _skipped])
	if _scene_failures > 0:
		# Reported before the layout verdict, and separately from it: the audit
		# genuinely found no overflow, but it only looked at the screens that
		# loaded, so "no problems" says nothing about the ones that did not.
		print("LAYOUT: INCONCLUSIVE — %d scene(s) never loaded; the audit only "
			% _scene_failures + "walked what was on screen")
	elif _only.is_empty() and _controls_seen < 200:
		# The audit walked almost nothing, so a clean result means nothing.
		print("LAYOUT: INCONCLUSIVE — only %d controls inspected" % _controls_seen)
	elif _layout_problems == 0:
		print("LAYOUT: OK — %d controls inspected, none overflow or clip" % _controls_seen)
	else:
		print("LAYOUT: %d problem(s) across %d controls" % [_layout_problems, _controls_seen])

	# The font verdict is separate from the layout verdict and carries its own
	# "did it look at anything" guard, because the two walk different sets: a
	# screen of icons has plenty of controls and no text at all.
	if _scene_failures > 0:
		print("FONT: INCONCLUSIVE — %d scene(s) never loaded" % _scene_failures)
	elif _glyph_box_size() <= 0:
		print("FONT: INCONCLUSIVE — vanta_pixel.fnt did not load; nothing was resolved")
	elif _only.is_empty() and _text_controls_seen < 100:
		print("FONT: INCONCLUSIVE — only %d text controls inspected" % _text_controls_seen)
	elif _font_problems == 0:
		print("FONT: OK — %d text controls, every size a whole multiple of %dpx"
			% [_text_controls_seen, _glyph_box_size()])
	else:
		print("FONT: %d control(s) of %d render at a fractional glyph scale"
			% [_font_problems, _text_controls_seen])

	# The third verdict: what the RASTERISER did, as opposed to what the theme
	# asked for. FONT above passes as long as every declared size is a whole
	# multiple of 9. That is necessary and not sufficient — the window stretch
	# multiplies it afterwards, and 27px at a 0.5 stretch is 13.5 device px.
	#
	# The arithmetic is worth stating because it decides what this can even
	# claim. The face exists at 9px and the theme uses 9x{2,3,4,5,6}. For every
	# tier to land on whole glyph boxes at once, k*stretch must be a whole
	# number for k = 2..6 — and the only values that satisfy all five are the
	# integers. So a non-integer stretch cannot render this face exactly no
	# matter how the layout is written, and reporting that as a layout defect
	# would be blaming the project for the resolution it was asked to run at.
	# It is reported, loudly, and it does not fail the run.
	var stretch: float = _device_stretch()
	var whole: bool = absf(stretch - roundf(stretch)) < 0.001
	if _scene_failures > 0 or _glyph_box_size() <= 0:
		print("FONTDEVICE: INCONCLUSIVE — the run did not complete")
	elif not whole:
		print("FONTDEVICE: INCONCLUSIVE — window:viewport is %.3f, which is not "
			% stretch + "a whole number, so the 9px face cannot land exactly at "
			+ "any size. %d control(s) resample here. Shots at this resolution "
			% _font_device_problems + "do not show the text a 1080-wide device draws.")
	elif _font_device_problems == 0:
		print("FONTDEVICE: OK — %d text controls land on whole device pixels at a "
			% _text_controls_seen + "stretch of %.0f" % stretch)
	else:
		print("FONTDEVICE: %d control(s) of %d do not land on whole device pixels"
			% [_font_device_problems, _text_controls_seen])
	# Leaks ~11 ObjectDB instances because this quits mid-await. That warning is
	# the harness, not the game: a plain --quit-after boot exits clean.
	get_tree().quit()


# --- Pass 1: the cold save a new player boots into ----------------------------


func _pass_cold() -> void:
	await _shot("00_main_menu")

	await _goto(SceneManager.SCENE_SETTINGS)
	await _shot("01_settings")

	await _goto(SceneManager.SCENE_GAMEPLAY)
	await _shot("02_gameplay_idle")

	# Land taps: damage numbers, the hit flash, the tap trail and the death
	# burst are all code paths a boot-only run never reaches.
	for _i in 6:
		CombatManager.player_tap_attack()
		await get_tree().create_timer(0.12).timeout
	await _shot("03_gameplay_combat")

	await _toggle_panel("UpgradeShopPanel")
	await _shot("04_upgrade_panel")
	await _toggle_panel("UpgradeShopPanel")

	# The empty states. These are the screens a brand-new player actually sees
	# first, and the ones most likely to be built once and never looked at.
	await _goto(SceneManager.SCENE_GEAR)
	await _shot("05_gear_empty")

	await _goto(SceneManager.SCENE_JOURNAL)
	await _shot("06_journal")

	await _goto(SceneManager.SCENE_SHOP)
	await _shot("07_shop")

	await _goto(SceneManager.SCENE_PETS)
	await _shot("08_pets_empty")


# --- Pass 2: a late-game save ------------------------------------------------


func _pass_seeded() -> void:
	_seed_late_game()

	await _goto(SceneManager.SCENE_GAMEPLAY)
	await _shot("10_gameplay_seeded")

	await _goto(SceneManager.SCENE_GEAR)
	await _shot("11_gear_full")

	await _toggle_panel("ForgePanel")
	await _shot("12_forge_panel")
	await _toggle_panel("ForgePanel")

	await _toggle_panel("RelicCollectionPanel")
	await _shot("13_relic_panel")
	await _toggle_panel("RelicCollectionPanel")

	await _goto(SceneManager.SCENE_PETS)
	await _shot("14_pets_owned")

	# Seeded with cards, because an empty collection screen and a full one
	# are different layouts and only one of them has a row to get wrong.
	_seed_cards()
	await _goto(SceneManager.SCENE_CARDS)
	await _shot("14b_cards")

	await _goto(SceneManager.SCENE_JOURNAL)
	await _shot("15_journal_progress")

	await _goto(SceneManager.SCENE_ECLIPSE)
	await _shot("16_eclipse")

	await _goto(SceneManager.SCENE_ARCADE)
	await _shot("17_arcade")

	# Every minigame, since each is a scene of its own and the Arcade hub
	# renders none of them.
	var games: Array[StringName] = [
		&"void_reflex", &"memory_match", &"connect_four", &"battleship",
		&"lights_out", &"sequence_echo", &"rune_sweeper",
	]
	var index: int = 18
	for id: StringName in games:
		MinigameManager.pending_id = id
		await _goto(SceneManager.SCENE_MINIGAME_HOST)
		await _shot("%d_minigame_%s" % [index, id])
		index += 1


# --- Pass 3: the transients layered over gameplay ------------------------------


func _pass_transients() -> void:
	await _goto(SceneManager.SCENE_GAMEPLAY)
	var scene: Node = get_tree().current_scene
	if scene == null:
		return

	# Instantiated directly rather than driven through EventBus: these are pure
	# presentation, and the question here is only whether they DRAW. Routing
	# through the managers would also fire haptics, saves and payouts.
	var banner: Node = RESULT_BANNER_SCENE.instantiate()
	banner.setup(BOSS_SKULL, "BOSS FELLED", "+128.4K Essence — the path ahead is open.", true)
	scene.add_child(banner)
	await get_tree().create_timer(0.7).timeout
	await _shot("22_result_banner")

	await get_tree().create_timer(2.2).timeout  # let it play out before the next

	var toast: Node = LOOT_TOAST_SCENE.instantiate()
	toast.setup(EquipmentManager.generate_item(60, EquipmentManager.Rarity.LEGENDARY))
	scene.add_child(toast)
	await get_tree().create_timer(0.6).timeout
	await _shot("23_loot_toast")

	var modal: Node = OFFLINE_MODAL_SCENE.instantiate()
	modal.setup(48200.0, 7 * 3600 + 42 * 60, true)
	scene.add_child(modal)
	await get_tree().create_timer(0.8).timeout
	await _shot("24_offline_modal")
	modal.queue_free()

	var world: WorldDefinition = WorldManager.get_world_for_level(60)
	if world != null:
		var unlock: Node = WORLD_UNLOCK_SCENE.instantiate()
		unlock.setup(world, 96000.0)
		scene.add_child(unlock)
		await get_tree().create_timer(0.9).timeout
		await _shot("25_world_unlock_modal")
		unlock.queue_free()

	# setup() before add_child(): the card builds itself in _ready().
	var card: Node = INSPECTOR_CARD_SCENE.instantiate()
	card.setup(EquipmentManager.generate_item(60, EquipmentManager.Rarity.MYTHIC), true)
	scene.add_child(card)
	await get_tree().create_timer(0.8).timeout
	await _shot("26_inspector_card")
	card.queue_free()

	# The boss dressing: a different health bar variation, the slam-in plate,
	# and the hidden challenge button. Driven through the signal because the
	# gameplay screen owns that whole state change.
	var boss: EnemyDefinition = CombatManager.get_enemy_definition()
	if boss != null:
		EventBus.boss_fight_started.emit(boss, 60, 5.0e5, 30.0)
		await get_tree().create_timer(1.0).timeout
		await _shot("27_boss_fight")


# --- Pass 4: every creature sprite, lit, on one sheet --------------------------


## Which enemy spawns is random, so waiting for the roster to come round is not
## a way to review art. This lays every creature out at once under the SAME
## material the gameplay screen uses, each retinted with its own glow_color
## exactly as enemy_view.gd does it — so what the sheet shows is what the
## screen shows, and a whole art pass can be judged in one image instead of
## twenty reruns hoping for a particular spawn.
func _pass_bestiary() -> void:
	var sheet := ColorRect.new()
	sheet.color = Color(0.035, 0.02, 0.07)
	sheet.set_anchors_preset(Control.PRESET_FULL_RECT)
	get_tree().root.add_child(sheet)

	var grid := GridContainer.new()
	# Two columns, not three: at three the cell is ~180px on the captured
	# image, which is too small to judge the detail the sheet exists to show.
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 8)
	grid.add_theme_constant_override("v_separation", 8)
	grid.set_anchors_preset(Control.PRESET_FULL_RECT)
	sheet.add_child(grid)

	for entry: Array in _creatures():
		grid.add_child(_bestiary_cell(String(entry[0]), entry[1] as Texture2D, entry[2] as Color))

	await get_tree().create_timer(1.2).timeout
	await _shot("30_bestiary")
	sheet.queue_free()


## (label, texture, glow) for every creature in the game — enemies from their
## definitions, pets from every evolution stage.
func _creatures() -> Array[Array]:
	var out: Array[Array] = []
	var seen: Dictionary = {}
	for path: String in _definition_paths("res://data/enemies"):
		var def: EnemyDefinition = load(path) as EnemyDefinition
		# Elder variants reuse the base creature's art on purpose, so one
		# entry per distinct TEXTURE rather than per definition.
		if def == null or def.texture == null or seen.has(def.texture.resource_path):
			continue
		seen[def.texture.resource_path] = true
		out.append([def.display_name, def.texture, def.glow_color])
	for path: String in _definition_paths("res://data/pets"):
		var pet: PetDefinition = load(path) as PetDefinition
		if pet == null:
			continue
		for stage in pet.stage_sprites.size():
			out.append([pet.stage_names[stage], pet.stage_sprites[stage],
				Color(0.655, 0.545, 0.98)])
	return out


## Read off disk rather than through the managers: this needs every definition,
## including ones no manager exposes a list of, and adding a public accessor to
## a manager purely to feed a screenshot tool would be the tail wagging the dog.
func _definition_paths(dir_path: String) -> Array[String]:
	var out: Array[String] = []
	var dir: DirAccess = DirAccess.open(dir_path)
	if dir == null:
		print("HARNESS: cannot open ", dir_path)
		return out
	for file: String in dir.get_files():
		# An exported build renames .tres to .tres.remap.
		var file_name: String = file.trim_suffix(".remap")
		if file_name.ends_with(".tres"):
			out.append(dir_path.path_join(file_name))
	out.sort()
	return out


func _bestiary_cell(label_text: String, texture: Texture2D, glow: Color) -> Control:
	var cell := VBoxContainer.new()
	cell.custom_minimum_size = Vector2(532, 300)

	var art := TextureRect.new()
	art.texture = texture
	art.custom_minimum_size = Vector2(532, 262)
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	# duplicate(), or every cell would share one material and the last
	# rim_color written would silently win for all of them.
	art.material = BESTIARY_MATERIAL.duplicate()
	(art.material as ShaderMaterial).set_shader_parameter(&"rim_color", glow)
	cell.add_child(art)

	var caption := Label.new()
	caption.text = label_text
	caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	# 18, not 22: a multiple of the 9px glyph box. The sheet exists to judge
	# art, so a caption on it resampling at 2.44 boxes is the one place a soft
	# glyph is actively misleading.
	caption.add_theme_font_size_override("font_size", 18)
	cell.add_child(caption)
	return cell


# --- Seeding -------------------------------------------------------------------


## A late-game save, written through each manager's own load_save_data where one
## exists, so the state is exactly what a real save would restore.
## Fill the collection so the Cards screen is shot with rows in it — an empty
## list and a populated one are different layouts, and only one has a row to get
## wrong.
##
## Driven through the real signals rather than written into CardManager,
## because a seed that reached past the roll would screenshot a state the game
## cannot actually produce, and the roll is the part most likely to be wrong.
##
## The consequence is that WHICH tiers appear is the weighted roll's business,
## not this function's: one boss win per tier threshold usually returns mostly
## commons. That is the honest trade — these shots prove the screen renders real
## cards, and they are not a swatch of all five rarity colours.
func _seed_cards() -> void:
	for rarity: CardRarityDefinition in CardManager.get_rarities():
		EventBus.boss_fight_started.emit(
			CombatManager.get_enemy_definition(),
			maxi(1, rarity.minimum_boss_level), 100.0, 30.0
		)
		EventBus.boss_fight_won.emit(maxi(1, rarity.minimum_boss_level), 100.0, false)


func _seed_late_game() -> void:
	CurrencyManager.add(CurrencyManager.ESSENCE, 4.8e6)
	CurrencyManager.add(CurrencyManager.VOID_SCRAPS, 1450.0)
	CurrencyManager.add(CurrencyManager.VOID_CRYSTALS, 32.0)
	CurrencyManager.add(CurrencyManager.ASTRAL_SHARDS, 9.0)

	# Past the Eclipse gate (50) and the Arcade gate (20), and into world 2, so
	# the seeded pass exercises the later worlds rather than repeating the cold
	# pass at a higher level.
	CombatManager.enemy_level = 60
	PrestigeManager.load_save_data({
		"prestige_count": 2, "run_peak_level": 60, "lifetime_peak_level": 60,
		"unlock_announced": true,
	})
	WorldManager.raise_unlocked_floor(1)
	IdleManager.auto_attack_unlocked = true

	# One item per rarity so every tier's colour treatment is on screen at once,
	# plus a filled equipment slot.
	for rarity: int in range(EquipmentManager.Rarity.MYTHIC + 1):
		var item: Dictionary = EquipmentManager.generate_item(58 + rarity, rarity)
		EquipmentManager._add_to_inventory(item)
	var inventory: Array = EquipmentManager.get_inventory()
	if not inventory.is_empty():
		EquipmentManager.equip(int(inventory[0]["id"]))

	# Every relic, not a sample: the five sigils are only meant to be
	# distinguishable FROM EACH OTHER, so a shot showing three of them proves
	# very little about the two it left out.
	RelicManager.load_save_data({
		"awakened": true,
		"active": "twin_fang",
		"owned": [
			{"id": "twin_fang", "seen": true},
			{"id": "essence_prism", "seen": true},
			{"id": "hunters_sigil", "seen": false},
			{"id": "shatterstone", "seen": true},
			{"id": "eclipse_heart", "seen": true},
		],
	})
	PetManager.load_save_data({
		"active": "ember",
		"owned": {
			"ember": {"xp": 900.0, "seen": true},
			"frostling": {"xp": 120.0, "seen": false},
		},
	})
	QuestManager.evaluate()


# --- Plumbing -----------------------------------------------------------------


func _goto(scene_path: String) -> void:
	SceneManager.change_scene(scene_path)
	await get_tree().create_timer(SETTLE_SECONDS).timeout
	# Verify the scene actually arrived. A scene whose script fails to compile
	# leaves the PREVIOUS screen up, and everything downstream still "works":
	# the shot is taken, the audit walks whatever is on screen, and the run
	# reports LAYOUT: OK. That is not hypothetical — an import race made
	# gameplay.tscn fail to load and this harness printed "OK — 952 controls"
	# for a run that had silently lost a third of the game.
	var current: Node = get_tree().current_scene
	var arrived: String = current.scene_file_path if current != null else "<none>"
	if arrived != scene_path:
		_scene_failures += 1
		print("HARNESS: FAILED to reach %s — still on %s" % [scene_path, arrived])


## Panels are children of the screen that owns them, so they are reached by
## name rather than by a manager call.
func _toggle_panel(node_name: String) -> void:
	var scene: Node = get_tree().current_scene
	if scene == null:
		print("HARNESS: no current scene for panel ", node_name)
		return
	var panel: Node = scene.find_child(node_name, true, false)
	if panel == null:
		print("HARNESS: panel not found: ", node_name)
		return
	panel.toggle()
	await get_tree().create_timer(PANEL_SECONDS).timeout


## A window cannot exceed the desktop, so asking for a 1920-tall window on a
## 1080p monitor silently yields ~1080x1050 — and stretch/aspect="expand" then
## renders a near-square viewport instead of a phone. The shots still LOOK
## plausible, which is what makes it dangerous: every conclusion about vertical
## layout is quietly wrong, and nothing says so. This is the only warning.
##
## The expected aspect comes from VANTA_EXPECT_ASPECT when the device matrix is
## driving, since there the non-phone aspect is the entire point; it falls back
## to the project's own base. Either way the question is the same: did we get
## the shape we ASKED for, or did the desktop quietly clamp it?
func _assert_phone_aspect() -> void:
	var size: Vector2 = get_viewport().get_visible_rect().size
	var want: float = float(ProjectSettings.get_setting("display/window/size/viewport_width")) \
		/ float(ProjectSettings.get_setting("display/window/size/viewport_height"))
	var requested: String = OS.get_environment("VANTA_EXPECT_ASPECT")
	if not requested.is_empty():
		want = requested.to_float()
	var got: float = size.x / maxf(size.y, 1.0)
	if absf(got - want) < 0.01:
		print("HARNESS: viewport %d x %d (aspect %.3f) — as requested" % [size.x, size.y, got])
		return
	print("HARNESS: ================= WRONG ASPECT RATIO =================")
	print("HARNESS: viewport is %d x %d (aspect %.3f), asked for %.3f." % [
		size.x, size.y, got, want,
	])
	print("HARNESS: The window was clamped by the desktop. Layout in these")
	print("HARNESS: shots is NOT what a player sees — lower SHOT_RES.")
	print("HARNESS: ======================================================")


# --- Layout audit ---------------------------------------------------------------


## Walk what is actually on screen and report anything that does not fit.
##
## Android portrait runs from 9:16 on old budget phones to 9:21 on an Xperia to
## 3:4 on a tablet to nearly square on an unfolded foldable. Eyeballing 28
## screens across 7 device shapes is 196 screenshots, which is not a review —
## it is a slideshow nobody finishes. So the harness measures instead, and the
## screenshots are only there to confirm what the numbers say.
##
## Two failures, both of which have already shipped in this project:
##   OVERFLOW — a control sticking out past the viewport edge. This is what a
##              phone with a different aspect does to a layout tuned on one.
##   CLIPPED  — a Label narrower than its own text, so the words are cut. The
##              Gear slot tiles did exactly this ("Boss Damage +29%" ran the
##              full width of a 236px tile with nothing to spare).
func _audit_layout(shot_name: String) -> void:
	var scene: Node = get_tree().current_scene
	if scene == null:
		return
	var view: Vector2 = get_viewport().get_visible_rect().size
	var problems: PackedStringArray = []
	if _probe:
		_inject_probe(scene)
	_walk_controls(scene, view, problems, false)
	for banner: Node in get_tree().root.get_children():
		if banner is Control and banner != scene:
			_walk_controls(banner, view, problems, false)
	if problems.is_empty():
		return
	# Individual findings are prefixed FINDING, never with a verdict's own word.
	# The three verdicts are the only lines that may begin "LAYOUT: ", "FONT: "
	# or "FONTDEVICE: ", so a reader — human or grep — cannot mistake the first
	# complaint about one screen for the conclusion about all of them. The
	# first version of this printed both with the same prefix and the wiring in
	# validate_all.sh promptly read a finding as the verdict.
	var font_faults: int = 0
	for problem: String in problems:
		if problem.begins_with("FONTSIZE") or problem.begins_with("FONTDEVICE"):
			font_faults += 1
		print("FINDING: %s  %s" % [shot_name, problem])
	# Counted apart from the layout total so each verdict reports only what it
	# measured. A font fault is not an overflow, and rolling them together
	# would let a clean layout read as broken and vice versa.
	_layout_problems += problems.size() - font_faults


## VANTA_LAYOUT_PROBE=1 plants one control off the right edge and one Label
## far too narrow for its own text, both of which the audit must report.
##
## Without this the audit is unfalsifiable: a walk that visits nothing — a null
## scene, a filter that excludes every node, a rename — prints exactly the same
## "OK" as a clean layout, and the greener it looks the less it means. Same
## reasoning as tools/selftest_checks.py, applied to the thing that measures.
func _inject_probe(scene: Node) -> void:
	if scene.has_node("__probe"):
		return
	var holder := Control.new()
	holder.name = "__probe"
	scene.add_child(holder)

	var offscreen := ColorRect.new()
	offscreen.name = "__probe_offscreen"
	offscreen.position = Vector2(get_viewport().get_visible_rect().size.x - 20.0, 100.0)
	offscreen.size = Vector2(200.0, 40.0)
	holder.add_child(offscreen)

	var box := Control.new()
	box.name = "__probe_box"
	box.position = Vector2(10.0, 100.0)
	box.custom_minimum_size = Vector2(40.0, 40.0)
	box.size = Vector2(40.0, 40.0)
	holder.add_child(box)
	var squeezed := Label.new()
	squeezed.name = "__probe_overhang"
	squeezed.text = "a line of text far too long for the box it has been given"
	squeezed.autowrap_mode = TextServer.AUTOWRAP_OFF
	box.add_child(squeezed)

	# One label at a size the bitmap font cannot render exactly. The font audit
	# must report it, for the same reason the two above exist: a walk that
	# resolves no font sizes at all prints the same "OK" as a clean one.
	var fractional := Label.new()
	fractional.name = "__probe_font_size"
	fractional.text = "resampled"
	fractional.add_theme_font_size_override("font_size", maxi(1, _glyph_box_size()) + 1)
	holder.add_child(fractional)


func _walk_controls(
	node: Node, view: Vector2, problems: PackedStringArray, scrolled: bool
) -> void:
	# A ScrollContainer's whole job is holding content bigger than itself, so
	# everything under one is exempt — otherwise every list in the game reports.
	var inside_scroll: bool = scrolled or node is ScrollContainer
	if node is Control:
		var control: Control = node
		if not control.is_visible_in_tree():
			return  # a hidden panel parked offscreen is not a layout fault
		_controls_seen += 1
		if not inside_scroll and control.get_child_count() == 0:
			var rect: Rect2 = control.get_global_rect()
			if rect.size.x > 0.5 and rect.size.y > 0.5:
				var over := Vector2(
					maxf(-rect.position.x, rect.end.x - view.x),
					maxf(-rect.position.y, rect.end.y - view.y)
				)
				if over.x > 1.0 or over.y > 1.0:
					problems.append("OVERFLOW %s by (%.0f, %.0f) — rect %s, viewport %s"
						% [control.name, maxf(over.x, 0.0), maxf(over.y, 0.0), rect, view])
		if control is Label and not inside_scroll:
			var label: Label = control
			# autowrap re-flows instead of overhanging, so it cannot fail this.
			# Checking the label against its PARENT rather than against its own
			# rect is deliberate: Godot clamps a Control's size up to its own
			# minimum, so a Label is never smaller than its text — it grows and
			# hangs over whatever contains it instead. That is exactly what the
			# Gear slot tiles did, with the affix line running past the tile.
			var parent := label.get_parent() as Control
			if label.autowrap_mode == TextServer.AUTOWRAP_OFF 					and not label.text.is_empty() and parent != null 					and parent.size.x > 1.0 					and label.size.x > parent.size.x + 1.0:
				problems.append("OVERHANG %s is %.0fpx inside a %.0fpx %s — \"%s\""
					% [label.name, label.size.x, parent.size.x, parent.name, label.text])
		_audit_font_size(control, problems)
	for child: Node in node.get_children():
		_walk_controls(child, view, problems, inside_scroll)


## The one size vanta_pixel actually contains, read from the font rather than
## written down here. A constant would be free to disagree with the shipped
## atlas; FontFile.fixed_size cannot.
func _glyph_box_size() -> int:
	if _glyph_box < 0:
		var font := load("res://fonts/vanta_pixel.fnt") as FontFile
		_glyph_box = font.fixed_size if font != null else 0
	return _glyph_box


## Fails any text control resolving to a size the bitmap font cannot render
## exactly.
##
## vanta_pixel's glyphs are 9px tall and exist at that size only. Godot serves
## another size by scaling the atlas: at a whole multiple every source pixel
## becomes an even block and the glyph is the one the font contains, but at 26
## the factor is 2.889, stems land between pixels and get resampled. The result
## is a soft, unevenly-weighted glyph — the exact smooth look the revamp
## removed, reintroduced in the thing a player reads.
##
## This runs at RUNTIME, against what the engine resolved, because that is the
## only place the answer is complete. Grepping for `font_size = N` finds the
## literals and misses everything else: a LabelSettings resource bypasses the
## theme entirely, and a size passed positionally into a helper is just an
## integer argument at the call site. Three of those were live in eclipse.gd
## after a pass that had "fixed" every literal in the project.
func _audit_font_size(control: Control, problems: PackedStringArray) -> void:
	var box: int = _glyph_box_size()
	if box <= 0:
		return  # the font failed to load; _check_font_loaded reports that
	var size: int = -1
	if control is Label:
		var label: Label = control
		# LabelSettings wins over every theme item when it is set, so reading
		# the theme here would report a size this label does not use.
		size = (
			label.label_settings.font_size if label.label_settings != null
			else label.get_theme_font_size(&"font_size")
		)
	elif control is Button or control is RichTextLabel:
		size = control.get_theme_font_size(&"font_size")
	else:
		return
	_text_controls_seen += 1
	if size > 0 and size % box != 0:
		problems.append("FONTSIZE %s renders at %dpx, which is %.2f glyph boxes — "
			% [control.name, size, float(size) / float(box)]
			+ "a bitmap font only scales exactly at whole multiples of %d" % box)
		_font_problems += 1
		return
	if size > 0:
		_audit_font_device_pixels(control, size, problems)


## Fails any text control whose glyphs do not land on whole DEVICE pixels.
##
## _audit_font_size above checks the size the THEME asked for. That is not the
## size the rasteriser uses. stretch/mode="canvas_items" multiplies everything
## by the window-to-viewport ratio, so on a 540-wide window a perfectly legal
## 27px label is drawn at 13.5px, and a legal 18px label whose box lands on an
## odd row is drawn across a half pixel. Both resample a face that exists at
## exactly one size, and resampling is what pixel art is for avoiding.
##
## This is not theoretical. It cost the main menu BOTH periods in "Devour the
## light. Ascend.", which shipped reading "Devour the light  Ascend". The
## period is a single pixel; the resample rounded it away while still charging
## it a 6px advance, so the gap stayed and the glyph did not. Every gate the
## project had reported green: the atlas contains the period, the declared size
## is a whole multiple of 9, and every pixel was on-palette. Nothing measured
## the one thing that was wrong.
##
## The tolerance is deliberately loose. A transform is floating point and a
## centred label lands a hair off exact constantly; only a genuine half-pixel
## is a resample, so the bar is a quarter of a device pixel.
func _audit_font_device_pixels(
	control: Control, size: int, problems: PackedStringArray
) -> void:
	var box: int = _glyph_box_size()
	var transform: Transform2D = control.get_global_transform_with_canvas()
	# get_global_transform_with_canvas() stops at the VIEWPORT. The window
	# stretch that canvas_items applies on top of it is the whole effect being
	# measured here, so it has to be multiplied back in by hand — without it
	# this function silently audits 1080x1920 and reports on a resolution
	# nobody is looking at.
	var stretch: float = _device_stretch()
	# A control the game is actively scaling — a damage number mid-pop — is not
	# a layout fact, and failing the build for the middle of a tween would make
	# this gate noise. Only statically-placed text is the project's to get
	# right.
	if absf(transform.get_scale().y - 1.0) > 0.01:
		return
	var device: float = float(size) * stretch
	if absf(device - roundf(device)) > 0.01 or int(roundf(device)) % box != 0:
		problems.append("FONTDEVICE %s asks for %dpx and the window stretch of "
			% [control.name, size]
			+ "%.3f draws it at %.2f device px — not a whole multiple of %d"
			% [stretch, device, box])
		_font_device_problems += 1
		return
	var offset: float = transform.origin.y * stretch
	if absf(offset - roundf(offset)) > 0.25:
		problems.append("FONTDEVICE %s sits at device y=%.2f — a bitmap glyph "
			% [control.name, offset]
			+ "straddling a half pixel is resampled, and a 1px glyph "
			+ "(a period) can be rounded away entirely")
		_font_device_problems += 1


## Window pixels per viewport pixel. 1.0 when the window matches the project
## resolution, 0.5 for the half-scale screenshot run, and whatever a real
## handset's width divides to in the player's hands.
func _device_stretch() -> float:
	var view: Vector2 = get_viewport().get_visible_rect().size
	if view.y <= 0.0:
		return 1.0
	return float(DisplayServer.window_get_size().y) / view.y


func _shot(shot_name: String) -> void:
	if not _only.is_empty() and not shot_name.contains(_only):
		_skipped += 1
		return
	_audit_layout(shot_name)
	# The framebuffer is only readable after the frame has actually been drawn.
	await RenderingServer.frame_post_draw
	var image: Image = get_viewport().get_texture().get_image()
	if image == null:
		print("HARNESS: no image for ", shot_name)
		return
	var path: String = "%s/%s.png" % [_out_dir, shot_name]
	var err: int = image.save_png(path)
	if err != OK:
		print("HARNESS: FAILED to write ", shot_name, " -> err ", err)
		return
	_taken += 1
	print("HARNESS: ", shot_name)
