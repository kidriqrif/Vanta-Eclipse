# Milestone 6 — Godot Implementation Notes (Phase 3 pre-req)

Author: lead dev in the Godot-specialist role (inline during a subagent
outage; verified against the files). Serves the approved
`milestone-6-equipment.md` with locked tuning (drop 3%; boss weights
30/40/22/7/1; world-boss 0/0/60/32/8; normal 74/20/5/0.9/0.1; salvage
2/5/12/30/75; forge 20; affixes 1/2/3/4/5 by rarity; flat ≈ level ×
0.06–0.18 × rarityMult). Folds in the six Phase-1c non-blocking notes.

## 1. EquipmentManager + item data model
Autoload **between UpgradeManager and PlayerStats** (verify: it calls
CurrencyManager (below), loads AffixDefinition/SlotDefinition resources;
PlayerStats calls it — all downward ✓). Item = plain `Dictionary`
(serializes directly, no custom-class save fragility):
`{"id": int, "slot": StringName, "rarity": int (0-4), "item_level": int,
"affixes": {StringName: float}}`. State: `_equipped: Dictionary`
(slot→item or absent), `_inventory: Array[Dictionary]`,
`_next_item_id: int` (monotonic counter, persisted — gives stable ids that
survive save/load for equip/salvage targeting; never reuse). Save section
`"equipment"`: `{equipped, inventory, next_item_id}`. Old saves lack it →
`load_save_data` defaults to empty (backward-safe).

## 2. Procedural generation
`generate_item(level, rarity) -> Dictionary`: affix_count = rarity+1;
`_affix_pool` (from AffixDefinition .tres) sampled N distinct via
`pool.duplicate(); shuffle(); slice(0,N)`; each magnitude rolled in the
affix's `[min,max] × rarityMult` and STORED (no seed — determinism via
stored values). `SlotDefinition` .tres = the 7 slots (id, display_name,
icon path, sealed:bool for relic). `AffixDefinition` .tres per affix
(id, stat StringName, display_template, min, max, is_percent). rarityMult
= [1.0, 1.15, 1.3, 1.5, 1.75].

## 3. PlayerStats equipment layer
Mirror the UpgradeManager layer exactly:
```
get_tap_damage: (BASE + upg_flat + EquipmentManager.sum("tap_flat")) 
                × upg_mult × (1 + EquipmentManager.sum("tap_pct"))
get_crit_chance += EquipmentManager.sum("crit_chance")   (still clamped 0.5)
get_crit_multiplier += EquipmentManager.sum("crit_damage")
get_essence_gain_multiplier ×= (1 + EquipmentManager.sum("essence"))
NEW get_boss_damage_multiplier() -> 1.0 + EquipmentManager.sum("boss")
```
`EquipmentManager.get_affix_sum(stat) -> float` sums over equipped.
**Boss-damage applies to boss hits only:** roll stays in
`PlayerStats.roll_tap_damage()` (crit context), but the boss multiplier is
applied in `CombatManager._apply_damage` — CombatManager knows the target
is a boss (`state == BOSS_FIGHT`), PlayerStats does not. So: roll returns
base amount; `_apply_damage` does `if state == BOSS_FIGHT: amount *=
PlayerStats.get_boss_damage_multiplier()`. Clean split, no context leak.

## 4. Drop wiring
EquipmentManager listens to `enemy_died(level, kills)` and
`boss_fight_won(level, payout, is_world_boss)`.
- **Boss-in-progress flag** (`_boss_drop_pending: bool`): set true in a
  handler on `boss_fight_started`, consumed on `boss_fight_won`. In the
  `enemy_died` handler: `if _boss_drop_pending: return` (suppresses the
  normal roll on the boss kill — reviewer-verified airtight). Make the
  setter **idempotent** (note 2): `boss_fight_started` sets true
  unconditionally; a GEAR-void mid-fight leaves it true, self-corrected
  because the next `boss_fight_started` re-sets true and no `enemy_died`
  fires while held.
- Normal: `enemy_died` (fires before `enemy_level++`, correct level) →
  `if randf() < 0.03: _drop(generate_item(level, _roll_rarity(NORMAL_W)))`.
- Boss: `boss_fight_won` → guaranteed `_drop(generate_item(level,
  _roll_rarity(is_world_boss ? WORLD_W : BOSS_W)))`. **Forge/boss level =
  the level arg**; the world-boss item drop rides into the WorldUnlockModal
  (note 6): EquipmentManager holds `_pending_world_boss_item`, gameplay
  passes it to `WorldUnlockModal.setup(world, payout, item)` which shows a
  compact item line + "view in Gear" (item is already in inventory).
- New EventBus signals: `item_dropped(item)`, `inventory_changed`,
  `item_equipped(slot)`, `scraps_changed(balance)` — UI renders these.
- Auto-equip-if-better is NOT automatic (player agency); drops just enter
  inventory + Loot Toast. (Sim modeled greedy-equip only for tuning.)

## 5. Gear scene
`scenes/gear/gear.tscn` (+ `SCENE_GEAR` in scene_manager.gd):
```
Gear (Control, theme)
├── VoidBackground (instance, palette applied in _ready from current world)
├── Margin/VBox
│   ├── Header HBox: "GEAR" title · VoidScraps display · BACK button
│   ├── SlotGrid (GridContainer, 3 cols): 7 SlotTile instances
│   ├── ForgeButton (opens the Forge slide-up)
│   └── InventoryScroll (ScrollContainer > VBox of InventoryRow)
├── ForgePanel (Slide-Up, instance — inside this scene)
└── InspectorCard (CanvasLayer 60, instance — spawned on demand)
```
**Boss-gate reconciliation (reviewer-confirmed):** Gear is a full scene →
entering fires `scene_transition_started` → CombatManager
`_gameplay_current=false` holds any gate; BACK → `scene_transition_finished
(SCENE_GAMEPLAY)` → `_check_held_entry.call_deferred()` re-enters. The
Inspector Card + Forge live INSIDE the gear scene where no gate can fire,
so they do **not** emit `ui_overlay_opened/closed` (that signal exists for
overlays over the *gameplay* scene). Confirmed correct.
Combat continues sceneless while gearing (auto-attack keeps killing/earning
post-L15; pre-L15 first-drop visits pause earning like today's menu —
harmless).

## 6. Forge + salvage
- **Forge** = a Slide-Up Panel (reuse `upgrade_shop_panel.gd` open/close +
  geometry) inside the gear scene. FORGE → `EquipmentManager.forge(slot)`:
  `try_spend(VOID_SCRAPS, 20)` → `generate_item(CombatManager.enemy_level,
  _roll_rarity(NORMAL_W))` → inventory + open its Inspector Card with the
  reveal flash.
- **Salvage**: `EquipmentManager.salvage(item_id)` → remove from inventory,
  `CurrencyManager.add(VOID_SCRAPS, SALVAGE_YIELD[rarity])`, emit
  `scraps_changed`. Refuses if equipped. Common/Rare instant; Epic+ gated
  by **Two-Tap Arm** in the UI (button re-labels to "SALVAGE?" + starts a
  ~2.5s `SceneTreeTimer`; second tap within the window confirms, timeout
  reverts). Bulk "salvage all Commons" button in the inventory header.
- **VOID_SCRAPS** currency: add the constant AND its key to CurrencyManager
  `_balances`, `get_save_data`, `load_save_data` (note 3 — the hardcoded
  keys must include it).

## 7. Pitfalls
1. Old saves: no `"equipment"`/`void_scraps` → defaults (empty inv, 0
   scraps). AffixDefinition/SlotDefinition are new .tres, no back-compat
   issue.
2. Item id: monotonic `_next_item_id`, persisted, never reused → no
   cross-session collision.
3. Equip mid-boss applies next hit (per-roll getter reads — verified).
4. Inventory scroll: a plain VBox of InventoryRow is fine for the expected
   counts this milestone (no cap); revisit pooling only if profiling bites
   — noted, not built.
5. Affix display: reuse `NumberFormat.format` for flat, a new
   `NumberFormat.format_percent(v)` ("+12%") for percent affixes.
6. The gear scene's VoidBackground material is already per-instance (M5) —
   applying the world palette in `_ready` won't touch the menu/gameplay.
