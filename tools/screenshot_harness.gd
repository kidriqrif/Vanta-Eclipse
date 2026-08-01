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
const BOSS_SKULL: Texture2D = preload("res://sprites/ui/boss_skull_icon.svg")

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


func _ready() -> void:
	_out_dir = OS.get_environment("VANTA_SHOT_DIR")
	if _out_dir.is_empty():
		_out_dir = ProjectSettings.globalize_path("user://shots")
	DirAccess.make_dir_recursive_absolute(_out_dir)
	_only = OS.get_environment("VANTA_SHOT_ONLY")
	_assert_phone_aspect()

	# Last autoload, so every manager below has finished _ready() by now.
	await get_tree().create_timer(2.0).timeout

	await _pass_cold()
	await _pass_seeded()
	await _pass_transients()

	print("HARNESS: %d shots written to %s (%d skipped by filter)"
		% [_taken, _out_dir, _skipped])
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


# --- Seeding -------------------------------------------------------------------


## A late-game save, written through each manager's own load_save_data where one
## exists, so the state is exactly what a real save would restore.
func _seed_late_game() -> void:
	CurrencyManager.add(CurrencyManager.ESSENCE, 4.8e6)
	CurrencyManager.add(CurrencyManager.VOID_SCRAPS, 1450.0)
	CurrencyManager.add(CurrencyManager.VOID_CRYSTALS, 32.0)
	CurrencyManager.add(CurrencyManager.ASTRAL_SHARDS, 9.0)

	# Past the Eclipse gate (50) and the Arcade gate (20), and into world 2 so
	# the nebula palette differs from every cold-pass shot.
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

	RelicManager.load_save_data({
		"awakened": true,
		"active": "twin_fang",
		"owned": [
			{"id": "twin_fang", "seen": true},
			{"id": "essence_prism", "seen": true},
			{"id": "hunters_sigil", "seen": false},
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
func _assert_phone_aspect() -> void:
	var size: Vector2 = get_viewport().get_visible_rect().size
	var want: float = float(ProjectSettings.get_setting("display/window/size/viewport_width")) \
		/ float(ProjectSettings.get_setting("display/window/size/viewport_height"))
	var got: float = size.x / maxf(size.y, 1.0)
	if absf(got - want) < 0.02:
		print("HARNESS: viewport %d x %d (aspect %.3f) — matches the phone" % [size.x, size.y, got])
		return
	print("HARNESS: ================= WRONG ASPECT RATIO =================")
	print("HARNESS: viewport is %d x %d (aspect %.3f), phone is %.3f." % [
		size.x, size.y, got, want,
	])
	print("HARNESS: The window was clamped by the desktop. Vertical layout in")
	print("HARNESS: these shots is NOT what a player sees — lower SHOT_RES.")
	print("HARNESS: ======================================================")


func _shot(shot_name: String) -> void:
	if not _only.is_empty() and not shot_name.contains(_only):
		_skipped += 1
		return
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
