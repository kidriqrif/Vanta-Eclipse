# Vanta Eclipse — Architecture

This document explains how the project is organized and the rules every new
system must follow. It is the first thing to read before adding code.

## The manager pattern

The game needs objects created once at launch, alive for the whole session and
reachable from anywhere. Unity has no built-in construct for that, so
`Assets/Scripts/Core/Game.cs` is a static service locator built from a
`[RuntimeInitializeOnLoadMethod]` that runs **before the first scene loads**.
It fires whichever scene the editor starts in, so entering play mode on any
screen boots the full set of managers rather than half of them.

All long-lived game logic lives in managers under `Assets/Scripts/Managers/`.
Screens never own game state; they read managers and listen to `EventBus`.

Construction order matters, and it is the order in `Game.Boot()`. If you add or
reorder a manager, update this table in the same commit.

| Order | Manager | Locator | Responsibility |
| --- | --- | --- | --- |
| 1 | `EventBus` | `Game.Events` | Global signals as C# events. No logic, no state. |
| 2 | `SettingsManager` | `Game.Settings` | Player preferences (PlayerPrefs), audio mixer volumes, haptics. |
| 3 | `SaveManager` | `Game.Save` | Versioned JSON save file, autosave, atomic writes, migrations. |
| 4 | `GameManager` | `Game.State` | Game version, play time, session count. Deliberately small &mdash; it does NOT pause: an idle game must keep running. |
| 5 | `CurrencyManager` | `Game.Currency` | All currency balances (essence, void crystals, astral shards, void scraps). Only `Add()`/`TrySpend()` may change them. |
| 6 | `UpgradeManager` | `Game.Upgrades` | Upgrade definitions + owned levels; answers stat-modifier queries. |
| 7 | `EquipmentManager` | `Game.Equipment` | Inventory, equipped items, procedural generation, drops, salvage, forge. Ahead of `PlayerStats` so it can read the affix sums. |
| 8 | `RelicManager` | `Game.Relics` | Relic collection, the active relic, and the awaken state. Ahead of `PlayerStats`/`IdleManager`, which read its effect getters. |
| 9 | `PetManager` | `Game.Pets` | Pet roster, active pet, XP/level/evolution. Ahead of `PlayerStats`, which reads its bonus getter. |
| 10 | `SkillTreeManager` | `Game.Skills` | Ascendant Powers definitions and purchased levels. Ahead of `PlayerStats`. Powers are PERMANENT — they never reset on an Eclipse. |
| 11 | `PlayerStats` | `Game.Stats` | All player combat stats behind `Get*()` methods; every layer above (upgrades, equipment, relics, pets, powers) stacks inside them. |
| 12 | `WorldManager` | `Game.Worlds` | World definitions, unlock progression, essence multipliers. Never calls upward. |
| 13 | `CombatManager` | `Game.Combat` | Three-state combat machine (normal/boss/farm), gates, countdown, rewards, world-driven rosters. |
| 14 | `IdleManager` | `Game.Idle` | Auto-attack unlock/ticking, offline-reward eligibility and granting, app-resume hook. |
| 15 | `MinigameManager` | `Game.Arcade` | The Arcade: minigame definitions, the Arcade Token meter, per-game records, payout pricing. After `IdleManager`, whose live essence rate prices every reward. |
| 16 | `QuestManager` | `Game.Journal` | The Journal: quest chain, daily set, achievements. After `MinigameManager`, whose token grant it pays with. |
| 17 | `MonetizationManager` | `Game.Shop` | Opt-in ad offers, purchases, entitlements, cosmetics. No mechanic is ever pay-gated (GDD stance, non-negotiable). |
| 18 | `PrestigeManager` | `Game.Prestige` | The Eclipse loop: run peak level, Void Crystal payout, and resetting the run-scoped managers. Built late because it reaches across all of them. |
| 19 | `CardManager` | `Game.Cards` | Boss trophy cards: the rarity roll, the collection, and absorption into the active companion. Reads `PetManager`, read by nobody. |

Two more are MonoBehaviours rather than plain objects, because fading, async
loading and AudioSources need engine callbacks: `SceneFlow` (`Game.Flow`) and
`AudioManager` (`Game.Audio`). Both are null outside play mode.

### The two clocks

Some managers must keep running while the game is paused and others must
freeze with it. Unity has one Update, so `GameRuntime` — the single
MonoBehaviour the locator creates — drives the managers on **two** deltas:

* `Time.unscaledDeltaTime` for anything that must keep running while paused:
  autosave, play time, the settings write debounce.
* `Time.deltaTime` for anything that must freeze: `Scheduler.After`, and
  through it the boss countdown. A notification can never drain that timer.

`Scheduler` owns both delays: `Scheduler.After(d, f)` runs `f` after `d`
scaled seconds, and `Scheduler.EndOfFrame(f)` defers `f` past the current
frame's mutation.

## Art is generated, not drawn

Every visual asset comes out of a Python generator, from one closed 16-colour
palette declared once in `tools/pixelart.py`:

| Tool | Produces |
|---|---|
| `tools/pixelart.py` | The palette and a canvas that stores palette **names**, so a mistyped colour is a `KeyError` at generation time rather than wrong pixels. Writes PNGs by hand with `zlib`/`struct`. |
| `tools/make_sprites.py` | All 57 sprites — creatures, pets, minigame pieces, UI icons. `--sheet` writes contact sheets for review. |
| `tools/make_font.py` | `vanta_pixel` — a 6×9 monospace bitmap face, 106 glyphs, as BMFont `.fnt` + atlas. |
| `tools/make_icons.py` | Launcher, adaptive, store icon and feature graphic. |
| `tools/make_audio.py` | All 15 effects and the drone. |

Three rules hold it together, and each exists because breaking it produced a
visible bug:

* **Nothing scales by a fraction.** Sprites, font sizes and icons are all
  integer multiples of what was authored. **Every** font size in the project
  is a multiple of 9 — the glyph box — because vanta_pixel is a bitmap face
  that exists at 9px and nowhere else, so any other size is the engine
  resampling the atlas. The icon grids are 32 and 27 because 512/192/432
  divide by them. A restyle once converted the theme and left the screens on
  their Nunito-era values, so 135 of 145 sizes were resampling on a "finished"
  pass; `VantaTheme.SnapFontSize` rounds onto the grid and
  `tools/check_unity.py` fails the sweep on a literal that is neither.
* **Surfaces are flat.** No corner radii, no soft shadows, no gradients — each
  needs colours between the ones the palette gives it. A falloff is spelled as
  solid pixels at falling density (`ground_glow()`) or as hard steps
  (`menu_divider()`).
* **`void` is the background, never a fill.** A void-filled body is not a dark
  shape, it is a hole.
* **The palette is closed.** `tools/check_unity.py` fails the sweep on a
  `new Color(...)` anywhere outside `VantaTheme`, `check_pixels.py` fails it on
  any *pixel* of any shipped PNG that is not one of the sixteen — 1.69M pixels
  across 66 images, which no source-file scan can see — and `check_glyphs.py`
  fails it on any rendered character the font has no glyph for.

## Communication rules

1. **UI → manager**: direct calls (`Game.Settings.MusicVolume = 0.5f`).
2. **Manager → anyone**: events on `EventBus`, never direct references to
   screens. Managers must work even when no UI exists.
3. **System → system**: prefer `EventBus` events. For direct calls the rule is
   about *when*, not merely direction:
   * **Inside a constructor** a manager may only touch managers above it in
     `Game.Boot()` — the ones below are still null. The C# compiler cannot
     catch this; a `NullReferenceException` on first launch can.
   * **At runtime** every manager exists, so a call in either direction is
     safe. Upward calls are still the exception and should earn their place:
     today only `SaveManager` → `GameManager.GameVersion` (a `const`, read
     while building the save document) and `QuestManager` →
     `PrestigeManager.LifetimePeakLevel` (a goal-metric snapshot).

This is what keeps the codebase scalable: a new system can be added by creating
a manager, registering a save section, and emitting/listening on the EventBus —
without editing existing systems.

## Save system

The save file (`Application.persistentDataPath/savegame.json`) is one
versioned JSON document:

```json
{
    "save_version": 1,
    "game_version": "0.1.0",
    "saved_at_unix": 1789000000,
    "sections": {
        "game": { "total_play_time": 123.4, "launch_count": 2, "created_at_unix": 1789000000 },
        "combat": { "enemy_level": 14, "total_kills": 13 },
        "currencies": { "essence": 250.0, "void_crystals": 0.0, "astral_shards": 0.0 },
        "upgrades": { "void_claws": 5, "dark_focus": 2 }
    }
}
```

Fourteen sections are registered, one per owning manager. A manager declares
its own section by implementing `ISaveable`; `Game.Saveables()` is the list
`SaveManager` walks.

| Section | Owner | Section | Owner |
| --- | --- | --- | --- |
| `game` | `GameManager` | `relics` | `RelicManager` |
| `currencies` | `CurrencyManager` | `pets` | `PetManager` |
| `upgrades` | `UpgradeManager` | `skills` | `SkillTreeManager` |
| `equipment` | `EquipmentManager` | `arcade` | `MinigameManager` |
| `world` | `WorldManager` | `journal` | `QuestManager` |
| `combat` | `CombatManager` | `shop` | `MonetizationManager` |
| `idle` | `IdleManager` | `prestige` | `PrestigeManager` |
| `cards` | `CardManager` | | |

* Any system with persistent data implements `ISaveable`: a `SaveKey`
  property naming its section, plus `GetSaveData()` / `LoadSaveData(data)`.
  The interface makes registration structural rather than a call someone has
  to remember, so a manager cannot silently stop being saved.
* Saving is automatic (every 60 s, on app close, on Android background) plus a
  manual button in Settings.
* Writes are **atomic**: temp file → backup current save → rename. A crash
  mid-save can never destroy progress; loading falls back to the backup.
* Format changes bump `SaveVersion` and add one numbered step in
  `SaveManager.Migrate()`. Old saves upgrade step by step to the newest format.
* Saves from a **newer** build are refused, never downgraded, and copied to
  `savegame.from_vN.json` first. Loading one would hand new-format
  sections to old code and relabel them as old-format, so the next update would
  migrate already-migrated data and destroy the run — and refusing without
  keeping a copy would be just as bad, because the 60 s autosave overwrites the
  file we declined to read.
* `saved_at_unix` is the anchor for offline progression (Milestone 4).

Settings are deliberately **not** part of the save file — they live in
`PlayerPrefs` — so they survive prestige resets and save deletion. Losing a
save must never also reset the audio to full.

## Adding a new screen

1. Create `Assets/Scenes/<ScreenName>.unity`. Its root under the Canvas
   carries a `SafeAreaFitter`; everything else hangs off that.
2. Create its behaviour in `Assets/Scripts/UI/`, deriving from `UIScreen` —
   display logic only. Reach nodes with `Find<T>("NodeName")`, never with a
   serialized inspector reference.
3. Add a constant in `Assets/Scripts/Core/Scenes.cs`.
4. Register the scene in Build Settings — `ChangeScene` to an unregistered
   scene fails only in a player build, never in the editor.
5. Navigate with `Game.Flow.ChangeScene(Scenes.<Name>)`.

`tools/check_unity.py` fails the sweep if any of steps 3, 4 or the file itself
disagree with each other.

**A component is a prefab, not a scene.** Anything a screen spawns — a banner,
a toast, a modal, an arcade board — lives in `Assets/Resources/Prefabs/` and is
instantiated with `UIPrefabs.Spawn<T>()`. Unity splits loading a scene from
instantiating a prefab: a scene is loaded one at a time and replaces what was
there, a prefab is instantiated many at a time into whatever is open. Building
a component as a scene puts an entry in Build Settings that nothing can
navigate to, and leaves the screen that embeds it holding a placeholder.

## Content as data

Game content lives in `ScriptableObject` assets, not code. Enemies are
`EnemyDefinition` assets in `Assets/Resources/Content/EnemyDefinition/` —
adding an enemy means adding one `.asset` and one sprite, zero code changes.
Upgrades, equipment, relics, pets, skills, quests, worlds, minigames and shop
products all follow the same pattern; `DefinitionRegistry` loads each type with
one `Resources.LoadAll` and the screens build themselves from what it finds.

Each definition class is `partial` and split in two: the generated half holds
the serialized fields, and a hand-written half under `Data/Methods/` holds the
behaviour. That split is what let the fields be regenerated from the content
without overwriting logic.

## Balancing

Combat/economy curves are tuned by simulation, not gut feeling — see the
constants in `CombatManager`. Current tuning (active tapping, greedy
upgrade buying): level 30 in ~1.5 min, level 50 at ~8 min, level 60 at
~19 min, soft wall near level 70 that idle mechanics (Milestone 4) relieve.
Enemy health grows 15%/level while essence rewards grow 9%/level — that
widening gap is what makes upgrades feel necessary.

Idle/offline (Milestone 4): auto-attack ticks at 1.0s (one third of active
tapping speed) once unlocked at enemy level 15. Offline pay mirrors the
real auto-attack kill rate at the player's current stats, at 50%
efficiency (`PlayerStats.get_offline_multiplier`), capped at 8 hours —
both values are deliberate upgrade hooks for prestige and rewarded ads.
Enemy level never advances while away: the player returns to essence, not
to a wall.

Loot (Milestone 6, tuned via scratchpad loot_sim.py): 3% drop on normal
kills, guaranteed on bosses (weights 30/40/22/7/1), world bosses min-Epic
(0/0/60/32/8), normal weights 74/20/5/0.9/0.1. Affix magnitudes anchor to
the upgrade curve (flat rolls ~L x 0.06-0.18 x rarity), giving full gear
~1.45x dps — acceleration, never a gate. Salvage 2/5/12/30/75 scraps by
rarity; forge pull costs 20 (~first pull at 30-40 min).

Bosses (Milestone 5, tuned via scratchpad boss_sim.py): every 10th level,
3x HP, 30s timer (1.1s entrance grace), 10x payout. Gates 10-40 are
beatable on arrival with escalating tension; the level-50 world boss is a
~6-minute farm wall; Frozen Ruins pays 2.5x essence. Deep-world walls
(L60+) are intentionally brutal until equipment/relics/prestige land.

## Visual identity

The style is **pixel-art roguelike**: hard edges, a closed palette, and nothing
that scales by a fraction.

* Backdrop: the `VoidBackground` prefab, a single flat fill.
  It used to be a nebula shader with drifting dust; that was removed, and its
  removal is what finally exposed a violet gradient divider that had survived
  an entire palette pass by blending into the animation behind it.
* Type: **`vanta_pixel`** (`Assets/Resources/Fonts/`), a 6×9 monospace bitmap
  face generated by `tools/make_font.py` and turned into a Unity Font asset by
  `Assets/Editor/PixelFontImporter.cs`.  Unity has no BMFont importer, so the
  106 glyphs are transcribed into `CharacterInfo` entries from the `.fnt` the
  generator writes — the generator stays the single source of truth for the
  face and nothing is typed in by hand. Monospace because a roguelike is a grid and because
  numbers that change every frame must not jitter as their digits change
  width. It replaced Nunito, a rounded humanist sans — the last thing in the
  project that read as a modern mobile app.
* **Shape**: every corner radius is **0**. A rounded rectangle carries an
  anti-aliased arc, which is the one thing hard-edged sprites cannot sit
  beside. Hierarchy is **filled primary, outlined secondary**.

### The colour system

One **closed 16-colour palette**, declared once in `tools/pixelart.py` and used
by everything: sprites, font atlas, theme, icons, rarity tiers, enemy glows.

That is the change. The project previously ran *five* independent colour
systems and kept them coherent by rule — one accent hue, a measured 308° gap
from the nearest rarity, a saturation ceiling for dark surfaces. Those rules
worked, and they were necessary because nothing enforced coherence
mechanically. A closed palette enforces it by construction: there is no
"nearly right" colour available to reach for.

Seven neutrals do structure (background → panel → row → border → muted →
body → title) and nine hues do meaning (element, rarity, currency, danger).

* Rarity is a **hue** ladder — ash, frost, violet, gold, crimson. It was a
  brightness ramp, which is what a single-accent scheme wanted; snapping that
  ramp onto sixteen colours put Rare and Epic on the *same* neutral, because
  the palette carries seven neutrals and four are darker than any text. Tier
  is still carried by pip **count**, so it stays colour-blind safe.
* `tools/check_unity.py` fails the sweep on any colour literal outside
  `VantaTheme`. That check replaced a hue-arc rule which was both too loose
  (any red, not *the* red) and structurally blind to the failure that matters
  most — two greys one step apart have no chroma, so an arc skips them
  entirely.
* Note that `design/ux/milestone-*.md` predate this restyle and describe the
  Cinzel-era treatment. They are kept as the design record of each
  milestone; `Assets/Scripts/UI/VantaTheme.cs` is the authority on what
  actually ships.
* All colour and type comes from `VantaTheme`. Unity's UI has no global theme,
  so the twelve named styles (`PrimaryButton`, `TitleLabel`, `HeaderLabel` and
  the rest) live in `VantaTheme.Styles` and are the only place a widget may
  read them from. They were transcribed entry by entry rather than inferred
  from their names: an earlier pass guessed, and guessed wrong on six of the
  twelve.
* Screens that build rows and tiles in code go through `UIBuild`. A "panel with
  a 3px border and 12px of padding" is three GameObjects in Unity — an Image
  has a colour and nothing else — so without that helper every list screen
  would restate the construction twenty times.
* Every full screen names itself with a `TitleLabel` node carrying the
  `TitleLabel` variation. Six screens had drifted onto `HeaderLabel` — the
  muted *secondary text* role — so half the game announced itself in dim grey
  body text. Each scene looked deliberate on its own; only side by side was it
  obviously an accident.
* Sliding overlays (Forge, Relics, Upgrade shop) take the `OverlayPanel`
  variation, not the default `PanelContainer`. They cover the screen behind
  them rather than floating over a scrim, so they must be fully opaque; at the
  shared 0.92 alpha the Gear inventory showed straight through the Forge's own
  header and read as a rendering fault.
* A progress bar or slider whose fill has no explicit height draws at zero.
  The three Settings volume sliders once rendered as a single 4px dot for
  exactly this reason: the styles *were* assigned, so the theme looked complete
  while the screen was empty. `SceneBuilder` gives every converted slider a
  real fill rect; anything built by hand must too.
* **One accent, spent not sprayed.** The scheme is red on true-neutral black.
  Red marks the primary action, the active state and danger, and nothing else;
  everything the player is not currently being asked to do is neutral. That
  restraint is most of what reads as "minimal" — the previous theme put its
  accent on every border, title and pill at once.
* The bright accent (`#FF3B30`) and the deep accent (`#A8101A`) are two jobs,
  not two shades. The first has to be READ against black (5.4:1), the second
  read THROUGH by white text on top of it (7.6:1). No single red clears both.
* **Per-door accents are retired.** Eclipse teal and Arcade lime were two extra
  neon hues on the busiest row in the game. Doors are told apart by icon and
  label, which is what players navigate by. Rarity is likewise a VALUE ladder
  now — grey to near-white — with chroma only on Mythic, which is safe because
  `make_pip_row()` has always carried the tier by pip count.
* Colour in the game world follows the same rule: ordinary enemies glow pale,
  and only bosses burn red. Nebula backdrops are near-black, separated by
  temperature and value rather than hue.
* Every screen is a full-bleed background plus one content root holding all
  the UI. Keep that shape: `SafeAreaFitter` sits on **that root** and insets it
  by the display safe area, so a notch or gesture bar pushes the controls in
  while the background still reaches the display edge. A screen that puts UI
  outside the content root will sit under the system chrome on most current
  phones.

  The width cap lives in the same component as the safe-area inset, not in a
  separate one. Split across two components they compose by luck: whichever
  writes the margins last wins, and the loser's inset — the display cutout, on
  exactly the notched phones it exists for — disappears with no symptom.
* Layout is tuned against 1080x1920 because `stretch/aspect="expand"` only ever
  *grows* the viewport — that base is both the narrowest and the shortest case
  any Android device produces, so what fits there fits everywhere.
  `bash tools/screenshots.sh` proves this across ten device shapes: it renders
  every screen in play mode at each of them and measures overflow, collapsed
  and overlapping rows, and blank frames. It is stage 8 of the sweep.

### Where the shading lives

The sprites are indexed pixel art: a 64×64 PNG whose every pixel is one of the
sixteen palette colours, drawn with its own lit/mid/shadow ramp already in it
(`tools/make_sprites.py`). **The art is shaded; the shader is not.** That is
the inversion from the previous style and it is the whole architecture of this
layer.

Before the revamp the sprites were SVGs — smooth shapes with no shading of
their own — and **dimensional_sprite** (deleted) supplied all of it,
deriving a fake surface normal from the alpha gradient and running Lambert
diffuse, a rim term and a Blinn-Phong highlight over it. That shader was correct for 512px
vector art and actively destructive here: on a 64px sprite scaled 8× it
averaged a seven-texel bevel across pixels that were the image, then
desaturated the result against a 0.42 grey ambient. The first pixel-art render
came out a blurred grey smudge, and the sprites were not the reason.

`Assets/Resources/Shaders/PixelRim.shader` replaced it and does one thing: a
hard **one-texel outline** in the creature's own colour, so the silhouette
stays off the background. It measures that texel with `_MainTex_TexelSize`,
which is in UV units of the *source* image, so the halo is one source pixel
thick at any scale and never drifts off the art's own grid.

It is written against the **UI** pipeline, not the sprite one: the enemy is an
`Image` inside the screen's canvas, so the shader carries the stencil,
clip-rect and vertex-colour plumbing every Canvas material needs. Dropping any
of it would make the creature ignore masks and CanvasGroup alpha.

`EnemyView` creates one material instance per view and retints `_RimColor` per
enemy from `EnemyDefinition.glowColor`. That isolation is an explicit
`new Material(shader)` and a matching `Destroy` in `OnDestroy`, because
without the instance every enemy on screen shares one material and the last
retint wins — and because a material created with `new` is not
owned by the AssetDatabase and is not collected with the GameObject.

Two rules for anything that adopts it:

1. **Multiply by the incoming vertex colour; never ignore it.** That colour
   already carries the graphic's tint and its CanvasGroup alpha, so hit
   flashes, fades and every alpha animation keep working. The shader relies on
   this.
2. **A creature needs ground.** A sprite with nothing under it reads as a
   sticker. Pair it with `Assets/Resources/Art/ui/ground_glow.png` — a dithered pool, not a
   blurred ellipse — and counter-animate it against any hover; see
   `EnemyView`, where the pool tightens and fades on the same curve as the
   bob.

Budget: 5 texture taps, one branch, no loops, one pass — sized for low-end
Android. Note that `Material.SetColor` naming a property the shader does not
declare is discarded without an error anywhere: the tuning knob simply does
nothing, and nothing in the sweep guards it.

## Conventions

* Files and types: `PascalCase`. Scene and prefab node names: `PascalCase`,
  and they are load-bearing — screens look their nodes up by name.
* Serialized definition fields stay `camelCase`, matching the content they were
  generated from; everything else follows normal C# casing.
* Every future save-format change needs a migration step — never break old saves.
* Mobile first: portrait 1080×1920 reference resolution, `CanvasScaler` set to
  `ScaleWithScreenSize` matching HEIGHT, touch targets at least ~100 px tall.
* `TODO(Milestone N):` comments mark planned work and are searchable.
