# Milestone 7 — Godot Implementation Notes (Phase 3 pre-req)

Author: Godot UI specialist. Serves the APPROVED
`design/ux/milestone-7-relics-pets.md` (Relics + Pets), with the §1 DESIGN
OVERRIDE in force: the awaken and first-pet grant fire on the **first world
unlock the build ships — Frozen Ruins (world index 1, `id = &"frozen_ruins"`,
reached by defeating the level-50 Dark Forest world boss)**. Verified against
the actual files. Reuses M5/M6 load-bearing guarantees: autoload order +
IdleManager's connect-ordering, the self-freeing tween idiom, per-instance
shader materials, the depth-1 banner queue, and the M6 StringName save-key
normalization pattern.

Two new autoloads (**RelicManager**, **PetManager**), one new scene
(`SCENE_PETS`), one new in-gear slide-up panel, three IdleManager touches,
five PlayerStats getter edits, one gameplay companion node. **CombatManager
and WorldManager gain zero code** — every hook is an existing EventBus signal.

---

## 1. Autoload placement — verified against the load-order rule

New `[autoload]` order (insert both **between EquipmentManager and
PlayerStats**, per spec §4-last):

```
EventBus · SettingsManager · SaveManager · GameManager · CurrencyManager ·
UpgradeManager · EquipmentManager · RelicManager · PetManager · PlayerStats ·
SceneManager · WorldManager · CombatManager · IdleManager
```

Positions after insertion: RelicManager 8, PetManager 9, PlayerStats 10,
SceneManager 11, WorldManager 12, CombatManager 13, IdleManager 14 (last).

**Downward-call audit (the only calls that must respect load order):**

- **PlayerStats (10) → RelicManager (8), PetManager (9)** — downward ✓. This
  is the whole point of placing them above PlayerStats: the getters call
  *down* into them exactly as they already call down into UpgradeManager (6)
  and EquipmentManager (7).
- **IdleManager (14) → RelicManager (8)** — `get_attack_speed_mult()` for the
  Twin Fang interval; downward ✓.
- **RelicManager (8) / PetManager (9) direct calls:** only SaveManager (3,
  register), EventBus (1), CurrencyManager (5, none needed), and their own
  `.tres` loads — all downward ✓. They call **nothing** in WorldManager (12)
  or CombatManager (13).
- **The World/Combat coupling is signal-only.** RelicManager must *react* to
  `world_unlocked` (WorldManager, 12) and `boss_fight_won` (CombatManager,
  13) even though both load *after* it. This is legal and correct: those are
  `EventBus.connect()` calls in `_ready()`, and the signals fire at runtime
  (long after every `_ready()`), so load order is irrelevant to them — the
  same way EquipmentManager (7) already listens to CombatManager (13)'s
  `enemy_died`/`boss_fight_won` from above. **Confirmed: both managers
  function correctly above PlayerStats.**

**IdleManager stays last** — its M4 load-bearing guarantee survives untouched:
CombatManager (13) still `_ready()`s before IdleManager (14), so
CombatManager's `game_loaded` handler connects (and its load-time
`enemy_spawned` fires) before IdleManager's late `enemy_spawned` connect.
Inserting two autoloads *above* CombatManager shifts both down together and
preserves their relative order. Re-verify the comment at
`idle_manager.gd:110-113` still reads true after the reorder (it does).

**The upward-read trap (important).** Because Relic/Pet sit *above*
World/Combat, they can NOT read `WorldManager.highest_unlocked_index` or
`CombatManager.enemy_level` directly to back-fill an already-past save — that
would be an illegal upward call. §7 resolves the load-time back-fill through
`enemy_spawned` instead (an EventBus signal), mirroring exactly how
IdleManager back-fills `auto_attack_unlocked`.

---

## 2. RelicManager (`scripts/managers/relic_manager.gd`)

### 2.1 State + save

```gdscript
var _awakened: bool = false
var _owned: Array[Dictionary] = []      # [{ "id": StringName, "seen": bool }, ...]
var _active_id: StringName = &""
var _definitions_by_id: Dictionary = {} # StringName -> RelicDefinition
```

Save section `"relics"` (registered in `_ready()`):

```json
"relics": { "awakened": true, "active": "eclipse_heart",
            "owned": [ {"id": "eclipse_heart", "seen": true},
                       {"id": "twin_fang", "seen": false} ] }
```

`load_save_data()` applies the **M6 StringName normalization** — JSON turns
every `&"x"` into `"x"`, and `&"x" != "x"` as dict keys, so `_active_id` and
each owned `id` MUST be rebuilt as `StringName(...)` or the `effect_id`
`match` and the `_definitions_by_id` lookup silently miss after a reload:

```gdscript
func load_save_data(data: Dictionary) -> void:
    _awakened = bool(data.get("awakened", false))
    _active_id = StringName(data.get("active", &""))
    _owned.clear()
    for raw in data.get("owned", []):
        var id := StringName(raw.get("id", &""))
        if not _definitions_by_id.has(id):
            continue   # a removed/renamed relic .tres — drop, never crash
        _owned.append({ "id": id, "seen": bool(raw.get("seen", true)) })
    if not _definitions_by_id.has(_active_id):
        _active_id = &""   # active relic no longer resolves -> unattuned
```

### 2.2 RelicDefinition (`scripts/data/relic_definition.gd`, `.tres` in `data/relics/`)

```gdscript
class_name RelicDefinition
extends Resource
@export var id: StringName = &""            # save-stable forever; never rename
@export var display_name: String = ""
@export var sigil: Texture2D
@export var effect_id: StringName = &""     # routing key the manager match()es
@export var effect_value: float = 0.0
@export var effect_description: String = "" # the ONE canonical plain sentence
@export var flavor: String = ""
@export var drop_weight: float = 1.0        # sim-owned; drop source/rate
```

Loaded in `_ready()` from a `RELIC_DEFINITION_PATHS` const array (the
UpgradeManager idiom). Adding a relic = one `.tres`; only a *new* `effect_id`
needs a line of manager code (§2.4). Backward-safe: new resource type, absent
from old saves; unknown `id`s in a save are filtered on load (above).

### 2.3 Effect-query API (read by PlayerStats + IdleManager)

Four getters, all safe to call when nothing is awakened/attuned (identity
returns). Internally each is a `match` on the **active** relic's `effect_id`:

```gdscript
func _active_definition() -> RelicDefinition:
    if not _awakened or _active_id == &"":
        return null
    return _definitions_by_id.get(_active_id)

# Stat-shaped ADDITIVE effects (EquipmentManager.get_affix_sum shape). 0.0 = none.
func get_effect_additive(stat: StringName) -> float:
    var def := _active_definition()
    if def == null: return 0.0
    match def.effect_id:
        &"boss_pct":  if stat == &"boss":        return def.effect_value
        &"crit_dmg":  if stat == &"crit_damage": return def.effect_value
    return 0.0

# Stat-shaped MULTIPLIER effects. 1.0 = none.
func get_effect_multiplier(stat: StringName) -> float:
    var def := _active_definition()
    if def == null: return 1.0
    match def.effect_id:
        &"essence_mult": if stat == &"essence": return def.effect_value
    return 1.0

# Eclipse Heart — a factor on PlayerStats.get_offline_multiplier(). 1.0 = none.
func get_offline_multiplier() -> float:
    var def := _active_definition()
    if def != null and def.effect_id == &"offline_mult": return def.effect_value
    return 1.0

# Twin Fang — the auto-attack cadence factor read by IdleManager. 1.0 = none.
func get_attack_speed_mult() -> float:
    var def := _active_definition()
    if def != null and def.effect_id == &"attack_speed": return def.effect_value
    return 1.0
```

### 2.4 The 5 named relics — exact routing

| Relic | `effect_id` | `effect_value` | Query used | Consumed in |
| --- | --- | --- | --- | --- |
| Hunter's Sigil | `&"boss_pct"` | 0.5 | `get_effect_additive(&"boss")` | `PlayerStats.get_boss_damage_multiplier()` (applied by CombatManager on boss hits — **no CombatManager change**) |
| Shatterstone | `&"crit_dmg"` | 1.0 | `get_effect_additive(&"crit_damage")` | `PlayerStats.get_crit_multiplier()` |
| Essence Prism | `&"essence_mult"` | 2.0 | `get_effect_multiplier(&"essence")` | `PlayerStats.get_essence_gain_multiplier()` |
| Eclipse Heart | `&"offline_mult"` | 3.0 | `get_offline_multiplier()` | `PlayerStats.get_offline_multiplier()` |
| Twin Fang | `&"attack_speed"` | 2.0 | `get_attack_speed_mult()` | `IdleManager` interval + offline (§5) |

Four route through PlayerStats getters with zero combat/idle code; only Twin
Fang needs the IdleManager hook (§5) because cadence is not a stat.

### 2.5 Awaken + drops + seen

- **`_ready()` connects:** `EventBus.world_unlocked` (live awaken, ceremony),
  `EventBus.enemy_spawned` (silent load-time back-fill, §7.1),
  `EventBus.boss_fight_won` (drop roll). `mark_all_seen()` for the panel.
- **Awaken:** `_awaken(ceremony: bool)`, idempotent on `_awakened`. On
  `world_unlocked(world)` → `_awaken(true)` → set flag, `SaveManager.save_game()`,
  emit `relics_awakened` (gameplay folds the "the relic slot stirs" line into
  the World Unlock modal, §8). The awakened flag persists, so this never
  replays on load.
- **Drops:** `_on_boss_fight_won(level, payout, is_world_boss)` → if awakened,
  roll the sim's rare-relic table (dupe rule: exclude already-owned, then stop,
  §8) → `_owned.push_front({id, seen=false})`, `SaveManager.save_game()`
  (grant-then-present), emit `relic_dropped(id)`. A relic dropping mid-boss is
  fine — state lands regardless; presentation is gameplay's concern (§8).
- **Actions:** `attune(id)` sets `_active_id` (auto-detaches the incumbent by
  overwrite), saves, emits `active_relic_changed(id)`. `detach()` sets `&""`,
  saves, emits `active_relic_changed(&"")`. `mark_all_seen()` clears every
  owned `seen` flag (called by the gear scene on back).
- **Emits:** `relic_dropped(id)`, `active_relic_changed(id)`, `relics_awakened`.
  Public reads: `is_awakened()`, `get_active_id()`, `get_owned()`,
  `get_definition(id)`, `get_unseen_count()`.

---

## 3. PetManager (`scripts/managers/pet_manager.gd`)

### 3.1 State + save

```gdscript
var _unlocked: bool = false
var _owned: Array[Dictionary] = []      # [{ "id": StringName, "xp": float, "seen": bool }]
var _active_id: StringName = &""
var _definitions_by_id: Dictionary = {} # StringName -> PetDefinition
```

Save section `"pets"`. **Level and evolution stage are DERIVED from `xp` +
the definition curve, never stored** — one source of truth, so a mid-level-up
crash cannot desync (spec §6):

```json
"pets": { "unlocked": true, "active": "ember",
          "owned": [ {"id":"ember","xp":1440.0,"seen":true},
                     {"id":"frostling","xp":120.0,"seen":false} ] }
```

`load_save_data()` applies the same StringName normalization (`id`,
`_active_id`) and the same drop-unknown-ids guard as §2.1.

### 3.2 PetDefinition (`scripts/data/pet_definition.gd`, `.tres` in `data/pets/`)

```gdscript
class_name PetDefinition
extends Resource
@export var id: StringName = &""
@export var stages: Array[PetStageDefinition] = []  # ordered by level_threshold
@export var bonus_stat: StringName = &""            # PlayerStats vocab: "essence","tap_pct","crit_chance",...
@export var bonus_base: float = 0.0                 # sim-owned
@export var bonus_per_level: float = 0.0            # sim-owned
@export var xp_base: float = 0.0                    # sim-owned XP curve
@export var xp_growth: float = 1.0

func bonus_at_level(level: int) -> float:
    return bonus_base + bonus_per_level * float(level - 1)
func level_for_xp(xp: float) -> int: ...            # invert the cumulative curve
func stage_for_level(level: int) -> int:            # highest stage.threshold <= level
    var s := 0
    for i in stages.size():
        if level >= stages[i].level_threshold: s = i
    return s
```

`PetStageDefinition` (nested resource): `stage_name: String`,
`sprite: Texture2D`, `level_threshold: int`. New pet = new `.tres`. New
evolution form = one array entry + one sprite. Backward-safe new type.

### 3.3 XP → level → evolution

- **Live XP:** `_ready()` connects `EventBus.enemy_died(level, kills)` →
  grant the **active** pet `xp` (per-kill amount the sim owns; only the active
  pet gains, consistent with one-active). After each grant, recompute derived
  level/stage; on a **crossing** emit `pet_leveled(id, level)` and/or
  `pet_evolved(id, stage)`. **Do not save per kill** (frequent — rides the
  60s autosave, matching CombatManager's `total_kills`); DO
  `SaveManager.save_game()` on an **evolution** crossing (rare, ceremony) and
  on drops/grants. `xp` is the source of truth, so a lost level-up on crash
  self-heals on next autosave.
- **Bonus query (read by PlayerStats):**
  ```gdscript
  func get_active_bonus_additive(stat: StringName) -> float:
      var def := _active_definition()
      if def == null or def.bonus_stat != stat: return 0.0
      return def.bonus_at_level(_active_level())
  func get_active_bonus_multiplier(_stat: StringName) -> float:
      return 1.0   # reserved; all M7 pet bonuses are additive
  ```
  `_active_definition()`/`_active_level()` return null/0 when no pet active →
  identity, safe from before the first pet exists.

### 3.4 Grant + drops + swap

- **First pet (guaranteed):** `_grant_starter()` on the live `world_unlocked`
  (Frozen Ruins), and silently on the load-time back-fill (§7.1). Adds the
  starter to `_owned`, sets `_active_id`, saves, emits `pet_unlocked(id)`
  (gameplay shows the companion + one-time hint).
- **New-pet drops:** `_on_boss_fight_won` → sim table (exclude-owned, §8) →
  `_owned.push_front`, save, emit `pet_unlocked(id)`.
- **Offline XP:** connects `EventBus.offline_kills_estimated(kills)` (§5c) →
  grant the active pet `kills × xp_per_kill`, recompute crossings. This is a
  **state grant**, so it fires from the single grant-time emission, never the
  deferred re-presentation (§9 avoids double-count). Track a pending
  offline-growth summary (`{leveled_to, evolved_to}`) that the offline modal
  reads via a `consume_pending_offline_growth()`, mirroring IdleManager's
  `consume_pending_offline_rewards()` — one line in the modal or nothing.
- **`set_active(id)`** → set, save, emit `active_pet_changed(id)`.
  `mark_all_seen()` for the roster.
- **Emits:** `pet_unlocked(id)`, `pet_leveled(id, level)`,
  `pet_evolved(id, stage)`, `active_pet_changed(id)`.

---

## 4. PlayerStats layer — exact getter edits

Each getter adds a RelicManager term and a PetManager term **alongside** the
existing EquipmentManager term, in the same additive/multiplicative shape.
**No calling code anywhere changes** — the layered design absorbs both. No
getter needs combat context except boss damage, which is already handled by
CombatManager applying `get_boss_damage_multiplier()` only on boss hits
(`combat_manager.gd:194`); nothing new there.

```gdscript
func get_tap_damage() -> float:
    var flat := BASE_TAP_DAMAGE + UpgradeManager.get_stat_additive(&"tap_damage")
    flat += EquipmentManager.get_affix_sum(&"tap_flat")
    flat += RelicManager.get_effect_additive(&"tap_flat")
    flat += PetManager.get_active_bonus_additive(&"tap_flat")
    var damage := flat * UpgradeManager.get_stat_multiplier(&"tap_damage")
    damage *= 1.0 + EquipmentManager.get_affix_sum(&"tap_pct") \
        + RelicManager.get_effect_additive(&"tap_pct") \
        + PetManager.get_active_bonus_additive(&"tap_pct")   # e.g. Frostling "Tap dmg +2%"
    return damage

func get_crit_chance() -> float:
    var chance := BASE_CRIT_CHANCE + UpgradeManager.get_stat_additive(&"crit_chance")
    chance += EquipmentManager.get_affix_sum(&"crit_chance")
    chance += RelicManager.get_effect_additive(&"crit_chance")
    chance += PetManager.get_active_bonus_additive(&"crit_chance")  # e.g. Sparkling "Crit +0.5%"
    return clampf(chance, 0.0, MAX_CRIT_CHANCE)                     # cap unchanged

func get_crit_multiplier() -> float:
    var mult := BASE_CRIT_MULTIPLIER + UpgradeManager.get_stat_additive(&"crit_damage")
    return mult + EquipmentManager.get_affix_sum(&"crit_damage") \
        + RelicManager.get_effect_additive(&"crit_damage") \       # Shatterstone +1.0
        + PetManager.get_active_bonus_additive(&"crit_damage")

func get_essence_gain_multiplier() -> float:
    var mult := UpgradeManager.get_stat_multiplier(&"essence_gain")
    mult *= 1.0 + EquipmentManager.get_affix_sum(&"essence")
    mult *= 1.0 + PetManager.get_active_bonus_additive(&"essence")  # e.g. Ember "Essence +11%"
    mult *= RelicManager.get_effect_multiplier(&"essence")          # Essence Prism ×2 (else ×1)
    return mult

func get_boss_damage_multiplier() -> float:
    return 1.0 + EquipmentManager.get_affix_sum(&"boss") \
        + RelicManager.get_effect_additive(&"boss") \               # Hunter's Sigil +0.5
        + PetManager.get_active_bonus_additive(&"boss")

func get_offline_multiplier() -> float:
    return BASE_OFFLINE_EFFICIENCY * RelicManager.get_offline_multiplier()  # Eclipse Heart ×3 -> 1.5
```

Delete the `TODO(Milestone 7)` at `player_stats.gd:9`. The
attune/set-active-applies-to-the-literal-next-hit guarantee is true **by
construction** — the getters cache nothing; `roll_tap_damage()` reads them per
attack. Eclipse Heart arithmetic matches spec §6 exactly:
`0.5 × 3.0 = 1.5`, so offline pay genuinely triples; with no relic,
`get_offline_multiplier()` returns 1.0 → `0.5` unchanged.

---

## 5. IdleManager — the three touches (Twin Fang + offline reprice + handoff)

The single source both the live timer and the offline math read:

```gdscript
## Effective seconds between auto-attacks after cadence relics (Twin Fang).
func get_effective_attack_interval() -> float:
    return AUTO_ATTACK_INTERVAL / maxf(0.0001, RelicManager.get_attack_speed_mult())
```

**(a) Live timer.** New helper + wiring; `AUTO_ATTACK_INTERVAL` stays the base
const:

```gdscript
func _refresh_attack_interval() -> void:
    _attack_timer.wait_time = get_effective_attack_interval()
```

- In `_ready()`, after `add_child(_attack_timer)`, call
  `_refresh_attack_interval()` and connect
  `EventBus.active_relic_changed.connect(func(_id): _refresh_attack_interval())`.
- In `_on_game_loaded()`, call `_refresh_attack_interval()` before/after
  `_attack_timer.start()` (RelicManager's save is already loaded by
  `game_loaded`). A running repeating Timer picks up the new `wait_time` on
  its **next** cycle — so attuning Twin Fang mid-farm doubles the rate from
  the next tick with no tick-handler re-plumbing (spec §4G). Detaching
  restores 1.0s the same way.

**(b) Offline repriced at the SAME effective interval.** In
`get_live_essence_rate()`, replace the raw constant with the effective
interval so Twin Fang's doubled kill rate flows into offline essence too
(the reviewer-flagged desync):

```gdscript
    var seconds_per_kill := CombatManager.get_expected_seconds_per_kill(
        level, get_effective_attack_interval())   # was AUTO_ATTACK_INTERVAL
```

**(c) `offline_kills_estimated` handoff.** In `_check_offline_rewards()`, after
granting essence and **at grant time only** (never on the deferred
`_on_scene_transition_finished` re-emit — that is presentation, not state),
emit the same kill estimate PetManager consumes:

```gdscript
    CurrencyManager.add(CurrencyManager.ESSENCE, amount)
    EventBus.essence_earned.emit(amount, &"offline")
    var seconds_per_kill := CombatManager.get_expected_seconds_per_kill(
        CombatManager.get_effective_kill_level(), get_effective_attack_interval())
    var kills := int(floor(rewarded_seconds / maxf(0.0001, seconds_per_kill)))
    if kills > 0:
        EventBus.offline_kills_estimated.emit(kills)   # pet XP, granted once
    SaveManager.save_game()
    _pending_offline_rewards = { ... }                 # unchanged
    EventBus.offline_rewards_ready.emit(amount, elapsed, was_capped)
```

`rewarded_seconds` already respects the M4 offline cap, so pet XP and offline
essence share one capped estimate and stay consistent by construction (spec
§6). No second simulation, no new honesty story.

---

## 6. Relic-slot reconciliation — awaken WITHOUT minting affix gear

**Recommendation (confirmed clean): keep `data/slots/relic.tres`
`sealed = true` forever.** Do **not** flip `sealed` to drive awaken. The
`sealed` bool stays a pure **gear-eligibility gate**; the relic **UI** reads
RelicManager. Tracing the three gates verifies the relic slot can never mint
or equip affix gear even post-awaken:

- `equip()` (`equipment_manager.gd:203`) refuses `slot_def.sealed` → relic
  slot never equips affix items ✓
- `forge()` (`:260`) refuses `sealed`, and `forge_panel._build_slot_pickers`
  (`:67`) `continue`s past sealed slots → relic never even offered ✓
- `generate_item()` with empty slot picks `_random_unsealed_slot()`
  (`:275/:361`) which excludes sealed → drops never target the relic slot ✓

So `sealed = true` already excludes the relic KIND from every generation/equip
path — no new EquipmentManager code, and no risk an affix item lands where a
relic belongs (spec §6, §8). EquipmentManager stays entirely relic-unaware.

**gear.gd branches the relic tile on manager state, not on `sealed`.** In
`_rebuild_slots()`/`_make_slot_tile()`, special-case the relic slot up front:

```gdscript
func _make_slot_tile(slot: SlotDefinition) -> Button:
    if slot.id == &"relic":
        return _make_relic_tile(slot)     # reads RelicManager, ignores `sealed`
    ...  # existing sealed / equipped / empty branches for the 6 gear slots
```

`_make_relic_tile(slot)` renders three states from RelicManager (§3A):

- `not RelicManager.is_awakened()` → the **existing M6 sealed card** (lock
  glyph, `sealed_flavor`, dimmed), tap → `_open_sealed_card(slot)`. Nothing
  changed pre-awaken.
- awakened, `get_active_id() == &""` → **AWAKENED-EMPTY** (solid border, faint
  sigil, "Relic — Empty / Tap to attune"). First-view "seal breaks" shimmer,
  save-gated once (a bool in the `"relics"` section, never replayed on load).
- awakened + active → **ATTUNED** (sigil + `display_name` + one-line
  `effect_description` + "● ACTIVE" word+dot). Tap in **any** awakened state →
  `_relic_collection_panel.open()`.

Re-render on `EventBus.active_relic_changed` and `relics_awakened` (connect in
gear.gd `_ready`, call `_refresh`). Because PlayerStats caches nothing, no
"stat display" needs manual invalidation — anything reading a getter is live
next frame.

---

## 7. Scenes, panels, and the companion node

### 7.1 Load-time back-fill via `enemy_spawned` (the legal upward-read fix)

Relic/Pet cannot read World/Combat state at load (upward). Instead both
**connect `EventBus.enemy_spawned` in `_ready()`** (early, so they catch
CombatManager's load-time spawn) and silently back-fill an already-past save,
exactly mirroring `idle_manager.gd`'s `auto_attack_unlocked` back-fill:

```gdscript
const FROZEN_RUINS_FLOOR: int = 51   # = LEVELS_PER_WORLD + 1 (world index 1)

func _on_enemy_spawned(_def, level: int, _hp: float) -> void:
    if not _awakened and level >= FROZEN_RUINS_FLOOR:
        _awaken(false)     # silent: no ceremony on a migrated save
```

Why this is airtight: `level >= 51` is only ever reached *after* the level-50
world boss falls — the exact unlock moment. On **live** unlock, WorldManager
emits `world_unlocked` (ceremony) *before* the next enemy spawns (the world
boss returns early and the level-51 enemy only spawns on modal ENTER), so the
`_awakened` flag is already set and the `enemy_spawned` branch no-ops →
ceremony always wins. On a **migrated** save (e.g. saved at level 65),
`world_unlocked` never re-fires, but the load-time spawn at 65 triggers the
silent awaken. PetManager uses the identical guard to `_grant_starter()`.
No new signal, no upward call, no ceremony replay.

### 7.2 `SCENE_PETS` + `scenes/pets/pets.tscn`

Add `const SCENE_PETS: String = "res://scenes/pets/pets.tscn"` to
`scene_manager.gd`. Follow the architecture new-screen checklist (Control
root, `main_theme.tres`, script in `scripts/ui/`).

```
Pets (Control, theme = main_theme.tres)
├── VoidBackground (instance; per-instance material, palette applied in _ready
│                    from WorldManager.get_world_for_level — the M5 idiom)
├── MarginContainer (margins 40/40/40/28)
│   └── VBox (separation 18)
│       ├── HeaderRow (HBox)
│       │   ├── TitleLabel  "PETS"            (mouse_filter IGNORE)
│       │   └── BackButton  "BACK" 200×96     (STOP)
│       ├── ShowcasePanel (PanelContainer > VBox)   — active pet
│       │   ├── FormSprite  (TextureRect ~300×300, IGNORE, <1.5s idle hover)
│       │   ├── NameRow (HBox): NameLabel 40px · StageLabel "Stage 2 of 3" 26px
│       │   ├── XpBar (ProgressBar, IGNORE) + Lv.N (left) + "cur / next XP"
│       │   │           outlined numerals ≥24px, Hold-to-Reveal on the figure
│       │   └── InfoRow (HBox): BonusLabel "Essence gain +11%" · NextEvo "Evolves at Lv. 25"
│       ├── CompanionsHeader (Label "COMPANIONS (N)")
│       └── RosterScroll (ScrollContainer)
│           └── RosterList (VBox, separation 14) — one RosterRow (Button, STOP)
│                 per owned pet: form icon 64×64, name, Lv.N, bonus line,
│                 "● ACTIVE" on active, "NEW" pill on unseen (children IGNORE)
└── InspectorCard (spawned on demand — reuse inspector_card.tscn, §7.4)
```

`pets.gd`: builds showcase + roster from PetManager; rebuilds on
`active_pet_changed`, `pet_leveled`, `pet_evolved`, `pet_unlocked`. Row tap →
Pet Inspector Card → SET ACTIVE. BACK → `PetManager.mark_all_seen()` +
`SaveManager.save_game()` + `change_scene(SCENE_GAMEPLAY)`. **Boss-gate
deferral is free** — a full scene leaves the gameplay scene non-current, so
CombatManager's existing scene test holds any gate exactly as the Gear scene
does (spec §6). No `ui_overlay` signals.

### 7.3 Companion sprite in `gameplay.tscn` (Diegetic Companion Entry, §7.1 spec)

Add one node **inside `CombatArea`** (`MarginContainer/GameplayVBox/CombatArea`),
as a sibling after `EnemyView`/`FxLayer`:

```
CombatArea (Control)
├── EnemyView (instance)
├── FxLayer (Control, mouse_filter IGNORE)
└── CompanionButton (Button, STOP, ~200×200, anchored BOTTOM-LEFT,
    │                clear of the enemy's central strike zone)
    ├── FormSprite  (TextureRect, IGNORE — the active pet's current-stage sprite)
    ├── LevelLabel  (Label "Lv. N", IGNORE)
    └── NewBadge    (Label "NEW" pill, IGNORE — until Pets first opened)
```

Why taps don't collide: `CombatArea.gui_input` (wired at `gameplay.gd:73`)
receives taps that reach CombatArea; a child `Button` with `MOUSE_FILTER_STOP`
consumes taps over its own rect (opening Pets), and taps anywhere else fall
through to CombatArea and attack — the same mechanism `FxLayer` (IGNORE)
already relies on. `CompanionButton.pressed → SceneManager.change_scene(
SceneManager.SCENE_PETS)`; the scene fade holds any boss gate for free.

`gameplay.gd` additions:

- `_ready()` connect `pet_unlocked` (show companion + one-time hint toast, save
  a hint-shown flag), `active_pet_changed` (swap `FormSprite` + `LevelLabel`),
  `pet_leveled` (Loot-Toast-family transient "Ember reached Lv. 7" + companion
  scale-pop — reuse `LOOT_TOAST_SCENE`/`_pop_*` idiom, IGNORE, self-freeing,
  collapses to highest on multi-level), `pet_evolved` (Result Banner win
  variant via `_show_banner` + `FormSprite` swap + ≤0.6s transform tween, 35ms
  haptic), `relic_dropped` and new-pet `pet_unlocked` (Result Banner via
  `_show_banner`, 50ms / 35ms haptic).
- **Hidden when no active pet:** in `_render_current_state()` set
  `CompanionButton.visible = PetManager.get_active_id() != &""`.
- **World-Unlock-modal fold:** relic-awaken and first-pet lines ride the
  existing World Unlock modal (extend `WorldUnlockModal.setup()` with optional
  extra lines — the M6 world-boss-drop idiom). When
  `WorldManager.has_pending_unlock_celebration()`, a `relic_dropped` /
  `pet_unlocked` handler must **defer to the modal instead of a banner**
  (guard just like `_on_boss_fight_won` at `gameplay.gd:186`) so a world-boss
  relic/pet folds into the modal and never stacks under the scrim (spec §4D).
- **Count pill:** extend `_update_count_pill()` to
  `EquipmentManager.get_unseen_count() + RelicManager.get_unseen_count()`
  (relics live in the Gear screen); gear.gd `_on_back_pressed` marks BOTH
  managers seen. Pets carry their own NEW badge on the companion, not the pill.

### 7.4 Relic Collection panel + Inspector Card variants

- **Relic Collection** = a Slide-Up Panel **inside the gear scene**,
  `scenes/gear/relic_collection_panel.tscn` + `relic_collection_panel.gd`,
  cloned from `forge_panel.gd` verbatim (same `OPEN_TOP/CLOSED_TOP/
  OPEN_BOTTOM/CLOSED_BOTTOM`, `SLIDE_TIME 0.28` cubic, CLOSE button, **fires no
  `ui_overlay` signals** — it lives in a non-gameplay scene). Add a
  `RelicCollectionPanel` instance to `gear.tscn` beside `ForgePanel`; gear.gd
  wires the relic tile tap → `open()`. Builds the ACTIVE card + COLLECTION
  Data-Driven Content Rows from `RelicManager.get_owned()`; row tap → relic
  Inspector Card. §8's shared-slide-up-constants note: extract or duplicate
  consciously — the two panels' offsets are identical.
- **Inspector Card variants** reuse `inspector_card.gd` (the scrim/card dress
  and entrance/exit tweens already handle `_info_mode`). Add:
  - `setup_relic(def: RelicDefinition, is_active: bool)` + `_build_relic()`:
    name (Cinzel 40), "Relic" sub, the ONE `effect_description` sentence,
    flavor, the once-shown attune caption; **no pips, no affix list, no
    compare, no SALVAGE**. Reuse `_equip_button` as the primary action:
    ATTUNE (unattuned) / DETACH (active, not primary-styled). New signals
    `attune_requested(id)` / `detach_requested()`; relic panel forwards to
    `RelicManager.attune()`/`detach()`. Card closes on `active_relic_changed`.
  - `setup_pet(def, level, is_active)` + `_build_pet()`: form, "Companion ·
    Stage k of n", XP bar, bonus, next-evo preview; primary action SET ACTIVE
    (disabled "Already active" when active), CLOSE only, no destructive verb.
    New signal `set_active_requested(id)` → `PetManager.set_active()`.

  Both are Inspector Card *variants* (different action set, no compare table),
  not new patterns (spec §7).

---

## 8. EventBus additions (Milestone 7 section)

Add under a `# --- Relics & Pets (Milestone 7) ---` header in `event_bus.gd`:

```gdscript
signal relic_dropped(id: StringName)
signal active_relic_changed(id: StringName)
signal relics_awakened
signal pet_unlocked(id: StringName)
signal pet_leveled(id: StringName, level: int)
signal pet_evolved(id: StringName, stage: int)
signal active_pet_changed(id: StringName)
signal offline_kills_estimated(kills: int)
```

(`gdscript/warnings/unused_signal=0` is already set in `project.godot`, so
signals wired only from UI won't warn.)

---

## 9. Pitfalls & backward-safety

1. **Old saves lack `"relics"`/`"pets"`.** `load_save_data` `.get` defaults →
   not awakened, no active relic, no pets (the M6 absent-defaults idiom, no
   migration step, `SAVE_VERSION` unchanged). A save already past Frozen Ruins
   awakens + gets the starter pet **at that load** via the §7.1 `enemy_spawned`
   back-fill — the update announces itself with its own mechanic, never
   retroactively back-filled with drops.
2. **StringName key normalization (the M6 lesson).** Relic/pet `id`s and the
   `active` id are Strings in JSON; rebuild them as `StringName(...)` on load
   or the `effect_id` `match`, `_definitions_by_id` lookups, and the
   `bonus_stat` comparison silently miss after a reload. Copy
   `equipment_manager.gd:90-119`'s normalization discipline.
3. **RelicDefinition/PetDefinition `.tres` backward-safety.** New resource
   types → absent from old saves. A save referencing a removed/renamed relic
   or pet `id` is filtered on load (drop the entry, clear active if it no
   longer resolves) so a content change never crashes an existing save.
4. **`active_relic_changed` must refresh two things.** PlayerStats-derived
   displays (auto-live, getters cache nothing — just re-render on the signal
   in gear.gd) AND `IdleManager._refresh_attack_interval()` (§5a). Miss the
   second and Twin Fang won't re-cadence on a live swap.
5. **Offline pet-XP double-count.** `offline_kills_estimated` is emitted
   **once**, at grant time in `_check_offline_rewards()` — NOT in the deferred
   `_on_scene_transition_finished` re-emit (which re-announces the essence
   modal for presentation). Live `enemy_died` XP and offline estimated XP
   never overlap (offline is an estimate, not simulated kills).
6. **Evolution changes the sprite live.** `pet_evolved` swaps `FormSprite` on
   both the gameplay companion and the Pets showcase in place + a ≤0.6s
   transform tween; non-blocking Result Banner, never a modal (spec §4E). The
   derived stage recomputes from stored `xp`, so a crash mid-transform loses
   only the ceremony — the pet is already evolved on reload.
7. **Companion hidden when no pet active.** `CompanionButton.visible` gates on
   `PetManager.get_active_id() != &""`; before the first pet there is no node
   to clutter the combat area (the Diegetic Companion Entry contract).
8. **Grant-then-present everywhere.** Relic/pet drops and the starter grant
   commit to the owned collection with an immediate `SaveManager.save_game()`
   before any banner/transform animates; ceremonies never replay on load (the
   project-wide rule since M4). A kill mid-ceremony loses only the ceremony.
9. **Timer wait-time semantics.** Setting `_attack_timer.wait_time` on the
   running repeating Timer applies on its next cycle — the intended
   "doubled rate begins at the next tick" behavior; do not `start()`
   (that would reset the current countdown).

---

## Spec inconsistency found (for the writer/GD, non-blocking)

The brief's task item 1/4 phrases Eclipse Heart as
`get_offline_multiplier()` **adds** `RelicManager.get_offline_multiplier_bonus()`
(additive `_bonus`), but the approved spec §4-last/§6 defines it
**multiplicatively**: `PlayerStats.get_offline_multiplier() =
BASE_OFFLINE_EFFICIENCY × RelicManager.get_offline_multiplier()`, with the
worked arithmetic `0.5 × 3.0 = 1.5`. These are two different method
names/shapes. **Resolved to the spec's multiplicative form** (§2.3, §4): one
`RelicManager.get_offline_multiplier()` returning a factor that defaults to
`1.0` — it reproduces the spec's `1.5` exactly and keeps the identity clean
(no relic → `0.5` unchanged), whereas an additive `_bonus` defaulting to `0.0`
would need `BASE × (1 + bonus)` and a `2.0` magnitude to hit the same number.
No design impact; the copy just names the method inconsistently.
