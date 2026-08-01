# Milestone 6 Visual Design — Equipment, Inventory, Loot & Crafting

Author: lead dev in the art-director role (produced inline during a
subagent usage-limit outage; method identical to the M4/M5 visual specs
— ramp values, computed WCAG contrast, theme-vocabulary transcription).
Gives visual treatment to the approved `design/ux/milestone-6-equipment.md`.
Reference canvas 1080×1920.

---

## 1. Rarity Color System (the milestone's defining system)

Five tiers, spread across the hue wheel so no two are adjacent, each
chosen to NOT collide in meaning with the established accents (violet =
UI/rewards, teal = auto-attack, ember = boss threat, crit-gold, health-
crimson). All are used as **item-name text** on dark surfaces and as the
slot-tile / inventory-row accent.

| rarity | affixes | hex | `Color()` | hue |
|---|---|---|---|---|
| Common | 1 | `#9CA3AF` | `Color(0.612, 0.639, 0.686, 1)` | 218° desat |
| Rare | 2 | `#38BDF8` | `Color(0.22, 0.741, 0.973, 1)` | 198° |
| Epic | 3 | `#C084FC` | `Color(0.753, 0.518, 0.988, 1)` | 270° |
| Legendary | 4 | `#FBBF24` | `Color(0.984, 0.749, 0.141, 1)` | 43° |
| Mythic | 5 | `#FB5A7D` | `Color(0.984, 0.353, 0.49, 1)` | 347° |

**De-collision reasoning (verified):**
- *Rare cyan `#38BDF8` (198°)* vs auto-attack teal `#2DD4BF` (172°): 26°
  apart, and they never co-occur (teal is a HUD badge, Rare is item text).
- *Epic violet `#C084FC` (270°)* vs UI violet `#8B5CF6` (258°): the
  closest pair. Epic is markedly lighter (L 0.75 vs 0.63) and pinker, and
  appears only as item-name text, never as a button fill — the UI violet's
  role. The pip count (3) is the real signal (below).
- *Mythic rose `#FB5A7D` (347°)* vs health-crimson `#BA3357` (345°):
  Mythic is far lighter/brighter and appears as text; crimson is only ever
  a health-bar fill. Different context, different lightness.
- *Legendary gold `#FBBF24` (43°)* vs crit-gold `#FFCC40`: both gold, but
  crit-gold is a transient floating number and Legendary is a persistent
  item accent — never on screen in the same role. Acceptable by context.

**CVD safety:** the five span L 0.56–0.75 and hues 43/198/218/270/347, so
under red-green deficiency they separate on the blue axis + lightness, and
under blue-yellow the gold/rose/violet split on lightness. But color is
**never load-bearing** — see pips.

**Affix-count pips (the non-color rarity signal, spec-required).** Every
item name is preceded by a row of small pips equal to its affix count =
its rarity: 1 pip Common … 5 pips Mythic. Pips are the substance made
visible (each pip = one affix the item literally has), so the tier reads
at a glance with color switched off entirely.
- Pip: 14×14 diamond, `custom_minimum_size` 14, 4px separation, filled
  with the rarity color at full opacity, 1px `Color(0,0,0,0.4)` outline
  so light pips read on light patches.
- The rarity **word** ("Epic") also appears in every item name, every
  Loot Toast, every inventory row, and the Inspector Card header — a third
  redundant signal (color + pip count + word).

---

## 2. Per-Element Treatment (theme vocabulary)

### 2A. Slot tile (§3C, 236×250, whole tile is the button)
Three `SlotTile` states, base `Button` (or a PanelContainer wrapping a
Button — implementer's call; styling below is the StyleBoxFlat):
```
equipped:  bg Color(0.086, 0.063, 0.133, 0.92)
           border_width 3, border_color = <rarity color> at full alpha
           corner_radius 16, shadow = rarity color @ 0.22, shadow_size 8
empty:     bg Color(0.06, 0.05, 0.09, 0.85)
           border_width 2, border_color Color(0.235, 0.18, 0.361, 0.6) (dashed feel via low alpha)
           corner_radius 16, no shadow — a quiet socket
sealed:    bg Color(0.05, 0.045, 0.07, 0.9), border 2 Color(0.2, 0.19, 0.24, 0.7)
           the slot icon is modulated Color(0.4,0.4,0.45,1) (desaturated),
           a small lock glyph (reuse a simple SVG) bottom-right, and the
           caption "Astral Temple" in 20px muted lavender
```
Contents: slot icon 96×96 centered-top (neutral tint, §3), the equipped
item's key-stat line (24px) + pip row below, or "Empty" (24px muted) for
empty, or the sealed caption. Equipped tiles show the rarity border — the
non-color backup is the pip row inside the tile.

### 2B. Inventory row (§3D, 1000×140)
`InventoryRow` PanelContainer:
```
bg Color(0.10, 0.078, 0.157, 0.9), corner_radius 14
LEFT ACCENT BAR: a 6px-wide ColorRect (rarity color) flush to the left
  edge inside the radius — the rarity signal that survives scrolling
```
Layout HBox: [accent bar] · slot icon 64×64 · VBox{ pip row + item name
in rarity color 30px · key-stat line 24px muted } · a right-aligned "NEW"
Status-Badge pill for unseen items. Whole row is a Button (opens the
Inspector Card).

### 2C. Inspector Card (§3E / pattern §7.1)
Its OWN identity (kin to `ModalCard` but distinct — it is a different
pattern). CanvasLayer 60 inside the gear scene, scrim + centered card:
```
scrim: Color(0.016, 0.008, 0.031, 0.6)   (lighter than modal's 0.72 —
       this is a browse surface, not a hard stop; scrim-tap DOES close)
card:  ModalCard stylebox but border_color = <item rarity color> @ 0.8,
       ~900×1100
```
Contents: header row (pip row + item name in rarity color 44px Cinzel via
TitleLabel recipe tinted to rarity + "Epic Helmet · Lv. 63" subtitle 26px
muted) · affix list (one `AffixRow` per affix: plain-language label 28px +
value 28px in `Color(0.906,0.886,0.973)`) · **compare block** when a
different item is equipped in that slot (each affix shows the delta with a
▲/▼ arrow AND +/− sign AND color — green `Color(0.4,0.85,0.5)` up / red
`Color(0.9,0.4,0.45)` down — the arrow/sign carry it color-free) · action
row: **EQUIP** (`PrimaryButton`, hidden if already equipped, becomes
UNEQUIP) · **SALVAGE** (new `DangerButton` variation, hidden if equipped)
· **CLOSE** (default Button, always present).

`DangerButton` variation (base Button):
```
normal:  bg Color(0.28, 0.10, 0.12, 0.95), border 2 Color(0.73,0.2,0.34,0.9)
hover:   bg Color(0.36, 0.13, 0.15, 1), border 2 Color(0.9,0.35,0.42,1)
pressed: bg Color(0.20, 0.07, 0.09, 1)
font: Color(0.98,0.9,0.9,1)   radius 16
```
On Two-Tap Arm (Epic+), SALVAGE re-labels to "SALVAGE?" and its border
brightens for the ~2.5s arm window (§7.3).

### 2D. Forge panel (§3F, Slide-Up reusing the shop geometry)
Same slide-up as `UpgradeShopPanel`. Header "THE FORGE" (HeaderLabel).
Void-Scraps balance row (scraps icon + count, Currency-Pop on change). A
row of 6 slot pickers (weapon…ring; relic excluded — sealed), each a
`SlotTile`-sized toggle; selected gets a violet-light 2px border. Cost
line "20 Void Scraps" (affordable = standard; unaffordable = the scraps
count in `Color(0.9,0.4,0.45)`). FORGE button (`PrimaryButton`, disabled
when unaffordable or no slot picked). **Odds line** (honesty precedent):
"Common 74% · Rare 20% · Epic 5% · Legendary 0.9% · Mythic 0.1%" in a 22px
muted row — the same weights as normal drops (forge is a normal-weight
pull). The **craft reveal** reuses the Result Banner vocabulary: on FORGE,
a 0.5s hold then the new item's Inspector Card opens with the entrance
pop, its rarity border flashing — the "slot machine" beat without a new
pattern.

### 2E. Loot Toast (§3G / pattern §7.2)
Compact pill, CanvasLayer 50, `mouse_filter` IGNORE on every node:
```
panel: bg Color(0.09,0.07,0.13,0.94), border 2 = <rarity color> @ 0.9,
       corner_radius 24 (pill), shadow = rarity color @ 0.25 size 10
       ~640×92, anchored top-center at y≈300 (clear of the boss plate)
```
Contents HBox: slot icon 44 · pip row · "Epic Gloves" in rarity color 30px
· nothing else. Lifetime: 0.25s pop + 1.3s hold + 0.25s fade, self-free.
Multiple drops in quick succession **collapse** into one pill reading
"3 items" with the highest rarity's border (not a queue) + the count-pill
on the GEAR entrance increments. **Mythic** overrides: a full Result
Banner ("MYTHIC DROP", Mythic-rose border) instead of the pill.

GEAR-entrance count pill: the Status Badge pattern — a small rose/violet
`Color(0.655,0.545,0.98)` pill with the unseen-item count, top-right of
the GEAR button; clears when the gear screen is opened.

---

## 3. Asset Manifest

All 128×128 unless noted, glow-disc + faceted-polygon idiom, gradients
only (no SVG filters). Slot/chrome icons use a NEUTRAL lavender-steel tint
(`#9a94c4` family) so they never compete with rarity color.

1. `sprites/ui/slot_weapon.svg` — an angular sword/fang silhouette.
2. `sprites/ui/slot_helmet.svg` — a faceted helm arc.
3. `sprites/ui/slot_armor.svg` — a chestplate trapezoid.
4. `sprites/ui/slot_gloves.svg` — a gauntlet/hand-guard.
5. `sprites/ui/slot_boots.svg` — a greave/boot wedge.
6. `sprites/ui/slot_ring.svg` — a faceted band with a gem (gem uses a
   soft violet, the only non-neutral accent, to read as "jewellery").
7. `sprites/ui/slot_relic.svg` — an eye/rune sigil (shown desaturated +
   locked until M7).
8. `sprites/ui/void_scraps_icon.svg` — like `essence_icon.svg` but a
   broken/fragmented crystal shard cluster, steel-grey `#8890b0` family
   with a faint violet glow disc (distinct material from essence).
9. `sprites/ui/forge_icon.svg` — a simple anvil silhouette (violet-steel).
10. `sprites/ui/lock_glyph.svg` — a tiny padlock (48×48) for the sealed
    relic tile.

**Explicitly NOT needed:** per-item art (items are slot-icon + rarity +
pips — no unique sprite per generated item, which would be thousands);
rarity-tinted slot icons (rarity lives in border/pips/text, icons stay
neutral); a bespoke forge-reveal scene (reuses Inspector Card entrance);
pip textures (pips are `ColorRect`/`Panel` diamonds, no SVG).

---

## 4. Accessibility Verification (computed)

| text | color | surface | ratio | verdict |
|---|---|---|---|---|
| Common name | `#9CA3AF` | gear card / row / toast | 7.29 / 6.93 / 7.34 | pass |
| Rare name | `#38BDF8` | " | 8.63 / 8.21 / 8.70 | pass |
| Epic name | `#C084FC` | " | 7.00 / 6.66 / 7.05 | pass |
| Legendary name | `#FBBF24` | " | 11.08 / 10.54 / 11.17 | pass |
| Mythic name | `#FB5A7D` | " | 6.04 / 5.75 / 6.09 | pass |
| compare ▲ up | `Color(0.4,0.85,0.5)` | card bg | 8.9 | pass |
| compare ▼ down | `Color(0.9,0.4,0.45)` | card bg | 5.6 | pass |
| affix value | `Color(0.906,0.886,0.973)` | card bg | 15.0 | pass |

Every rarity name clears 4.5:1 on all three surfaces. **No state is
color-only:** rarity = color + pip-count + word; compare delta = color +
arrow + sign; forge affordability = color + disabled button state + the
number. Touch targets: slot tile 236×250, inventory row 1000×140, all
card buttons ≥ 500×110 or ≥ 96 tall, forge slot pickers 236×250 — all
clear 96px. Motion: the craft reveal and toast are one-shot; the only new
loop-eligible element (the count-pill) does not pulse. `mouse_filter`
stated per node in §2.

---

## 5. Consistency Notes

- **Rarity is a fifth accent axis**, orthogonal to the four meaning-scoped
  accents — it only ever colors item identity (name/border/pip/accent
  bar), never chrome or actions. Actions keep their established colors:
  EQUIP = violet PrimaryButton, SALVAGE = the new crimson-family
  DangerButton (crimson already means "harm/loss" via the health bar, so
  destructive actions inheriting it is coherent), CLOSE = neutral.
- **No new radius values** (14 rows, 16 tiles/buttons, 20 cards, 24 pill).
- **Glow hierarchy** unchanged: rarity shadows 8–10, nothing above
  PrimaryButton hover (22).
- **Type roles** unchanged: Cinzel for the Inspector Card item name and
  "THE FORGE" header (ceremonial), default face for all data (affix
  values, stat lines, counts, odds).
- **The gear scene reuses `VoidBackground`** with the current world's
  palette (per the engine notes), so stepping into gear stays under the
  same sky — world continuity, and the shared material is already
  per-instance since M5.
- **Void Scraps** join the currency family visually as a "broken" cousin
  of essence — same construction, fragmented shape, steel tint — reading
  instantly as "salvage material," not a premium currency.
