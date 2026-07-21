# Milestone 6 UX Spec — Equipment, Inventory, Loot & Crafting

Author: ux-designer · Status: draft for Phase 1c review
Serves: `design/player-journey.md` Stage 8 (First Equipment Drop) and
Stage 9 (Gear Routine).

Game-design decisions taken as fixed (not re-derived here): seven slots —
weapon, helmet, armor, gloves, boots, ring, relic — with the relic slot
visible but sealed until Milestone 7; five rarities Common/Rare/Epic/
Legendary/Mythic carrying exactly 1/2/3/4/5 random affixes from a
six-affix pool (tap damage +flat, tap damage +%, crit chance +, crit
damage +%, essence gain +%, boss damage +% — the last is a new stat this
milestone); item power scales with the enemy level that dropped it;
normal kills drop with a small chance, bosses always drop, world bosses
always drop high rarity; drops auto-enter the inventory; crafting v1 is
SALVAGE (any unequipped item → Void Scraps) and FORGE (pick a slot, pay
scraps, random item at current enemy level); no inventory cap this
milestone; equipping is instant and free; gear is never required — it
only accelerates. The exact numbers (drop %, rarity weight tables per
source, forge cost curve, salvage yield curve) are being tuned by a
parallel simulation — **every presentation below is parameterized and
stays correct whatever those numbers turn out to be** (all figures format
via `NumberFormat`; no layout or copy depends on a magnitude; every
illustrative value in a wireframe is marked as such).

Grading criteria from `player-journey.md`: Stage 8 — the drop must be
noticeable without interrupting combat; finding where gear lives must
take one obvious tap; item power must read at a glance for a player who
has never seen an RPG stat sheet; equipping must show bigger numbers on
the very next hit. Stage 9 — comparing new vs equipped must be
effortless; salvage must be safe AND not miserable; the Forge must read
as a slot machine worth pulling, not a spreadsheet; none of it may ever
gate progress.

---

## 1. Overview

Four connected features that turn the kill loop's corpses into a second
progression axis:

1. **The drop moment.** Kills sometimes (bosses: always) leave gear that
   auto-enters the inventory — no floor pickups, no taps, no interruption
   (this is an incremental, not an ARPG). The announcement is a new
   compact, input-transparent **Loot Toast** near the bottom of the HUD
   (§4D, pattern §7.2) — deliberately *smaller* than the Transient Result
   Banner, because drops are frequent and a 2.2s mid-screen banner per
   drop would wallpaper the combat area. Rarity is carried by a **pip
   row** (N filled pips = N affixes — the count is literally the rarity)
   plus the rarity word, never color alone. Mythic drops alone get the
   full Result Banner (its named future use, reserved for the tier rare
   enough to never spam). A count pill on the new GEAR button ("2 NEW")
   makes every drop findable later even if its toast was missed.

2. **The Gear screen** — a new full `SceneManager` scene (`SCENE_GEAR`),
   entered from a new **GEAR** button that permanently splits the
   gameplay bottom row with UPGRADES (§4A defends both choices against
   the M5 precedent that rejected splitting). Top-to-bottom: Void Scraps
   balance + FORGE entry, a 7-tile equipped grid (no paper-doll — the
   game has no hero figure and inventing one is a large art ask with no
   canon behind it), and the scrolling inventory, newest first. Combat
   continues headless while gearing — auto-attack keeps killing, essence
   keeps flowing, and new drops appear live at the top of the list.

3. **The Item Card** — tap any tile or row and a card presents the full
   affix list in plain language with a side-by-side THIS/EQUIPPED compare
   table, plus EQUIP and SALVAGE. This is deliberately **not** the
   Centered Modal Dialog: that pattern's contract is *exactly one dismiss
   action* for game-initiated announcements, and an item card is a
   player-initiated inspection holding three actions. Stretching the
   contract would dissolve the guarantee that gives it value, so the card
   is a new pattern — the **Inspector Card** (§4C, §7.1) — sharing the
   modal's visual DNA (scrim alpha, card dress, entrance/exit tweens,
   layer 60) under a different contract.

4. **Crafting v1.** SALVAGE from the card (instant for Common/Rare, a
   two-tap in-place arm for Epic+ — §4E resolves "safe AND not
   miserable"; equipped items can never be salvaged), a bulk SALVAGE
   COMMONS action, and the FORGE: a Slide-Up Panel (pattern reuse) with a
   slot picker, an honest always-visible odds line (the cap-disclosure
   precedent applied to gambling), and a reveal beat that IS the Inspector
   Card's entrance with the pips ticking in one by one — the slot-machine
   payoff built from existing celebration vocabulary.

Ownership follows M5's discipline (§4G): a new `EquipmentManager` owns
items, drops, salvage, and forging; `PlayerStats` stacks equipment inside
its existing `get_*()` layering (which is what makes "next hit is
bigger" true by construction); `CombatManager` emits and never touches
items; UI owns nothing. Items are procedurally generated dicts in the
save — the affix pool and slot list are data-driven resources.

---

## 2. User Flows

### 2A. Stage 8 — first drop → find it → equip it

```
An enemy dies (tap or auto-attack). EquipmentManager rolls the drop
chance (normal kill) — first success of this save file
        │
        ▼
Item is generated and pushed into the inventory IMMEDIATELY (state
first, presentation second — the grant-then-present idiom; no
crash can lose a drop)
        │
        ▼
FIRST-DROP CELEBRATION (once per save, never replayed on load):
  a Transient Result Banner, win variant, gated by a save flag:
  "FIRST GEAR DROP — ◆◇◇◇◇ COMMON SWORD · it waits in GEAR below."
  + the GEAR button's count pill pops in: "1 NEW"
  (this drop's ordinary Loot Toast is suppressed — one moment, one
  announcement; the banner rides the existing depth-1 layer-50 queue,
  so a drop landing at the level-15 Auto-Attack toast can never stack)
        │
        ▼
Player taps GEAR (labeled text button, bottom row — the one obvious
tap; the pill corroborates "something is in there")
        │
        ▼
Scene Fade Transition → Gear screen. Badge count clears on entry;
the row keeps its NEW pill for this visit. Inventory shows one row:
"COMMON SWORD · Lv. 3 · ◆◇◇◇◇ · +2 Tap Damage"
        │
        ▼
Player taps the row → Inspector Card: name, pips, item level, the
affix in plain words ("Tap Damage +2"), caption "The weapon slot is
empty — equipping is pure gain.", EQUIP (PrimaryButton) / SALVAGE /
CLOSE
        │
        ▼
EQUIP → card closes, weapon tile fills with a pop (badge-pop idiom),
tile shows glyph + pips + "Lv. 3" + "+2 TAP"
        │
        ▼
BACK → gameplay. The very next hit rolls with the new stats —
PlayerStats getters are read per-roll, so bigger damage numbers are
automatic, not choreographed (§4A). Stage 8 complete.
```

### 2B. Stage 9 — the check-compare-equip-salvage routine

```
Drops accumulate during play (Loot Toasts announce; pill counts)
        │
        ▼
Every few minutes: GEAR → inventory, newest first — the drops since
last visit are the top rows, wearing NEW pills
        │
        ▼
Tap a row → Inspector Card with the THIS | EQUIPPED compare table
(union of both items' stats; ▲ / ▼ / — markers carry better/worse
without color). One glance answers "upgrade or scrap?"
   │                              │
   ▼                              ▼
Better: EQUIP                 Worse: SALVAGE
  swapped-out item returns      Common/Rare: instant — scraps land,
  to the TOP of the list        counter pops, card closes
  (undo is one tap away)        Epic+: button arms — "TAP AGAIN:
                                +840 SCRAPS" — second tap executes
        │
        ▼
Leftover commons pile up → SALVAGE COMMONS (12) in the inventory
header — arms the same way, showing count and total yield before
the second tap. Never touches equipped items or anything above
Common (misery removed, safety intact)
        │
        ▼
Scraps pile up → Forge flow (2C)
```

### 2C. Forge flow

```
Gear screen → FORGE (beside the scraps balance — fuel and furnace
share a row)
        │
        ▼
Forge panel slides up (Slide-Up Panel pattern, shop geometry).
Scraps balance and equipped grid stay visible above the sheet.
Contents: slot picker (6 chips + sealed relic chip), forge level
line ("Forges at Item Lv. 23 — your current hunting ground"),
odds line (always visible, exact percentages from the tuning sim),
FORGE button with the cost on its face
        │
        ▼
Player picks a slot chip (selection = border weight + check glyph,
not color alone) → FORGE enabled iff scraps >= cost; otherwise
disabled with "Need 92 more Scraps" in words
        │
        ▼
FORGE tap → button disables (double-tap guard) → ~0.7s forge beat
(chip glyph pulse + particle burst — existing celebration
vocabulary, one-shot) → scraps counter drops with a Currency Pop
        │
        ▼
THE REVEAL: the Inspector Card pops with the result. Its pips tick
in one by one (~0.08s apart) — each socket filling is the
slot-machine tension; a fifth pip is the Mythic crescendo. Haptic
scaled by rarity (Epic+ 25ms, Mythic 50ms). Card offers EQUIP /
SALVAGE / CLOSE — win or lose, the next action is one tap away
        │
        ▼
Close panel or forge again (cost re-renders from live balance)
```

### 2D. Getting there and back — combat while gearing

```
Gameplay ──GEAR──▶ Gear screen ──BACK──▶ Gameplay
   (Scene Fade Transition both ways, ~0.25s each)

While the Gear scene is current:
  · managers run sceneless — auto-attack keeps killing and earning
  · drops keep rolling; new items appear live at the top of the
    inventory list with a pop (the list IS the toast in here)
  · a boss gate reached mid-visit HOLDS (empty combat area, no
    countdown) via the existing M5 unobstructed-screen deferral —
    CombatManager already tracks the current scene; a full scene
    needs no ui_overlay signals (§6)
  · GEAR during an active boss fight follows the M5 MENU rule: the
    attempt voids silently, the gate re-enters fresh on return —
    with the new gear equipped (§6)
```

---

## 3. Wireframes

Reference canvas 1080×1920. The Gear screen adopts the gameplay scene's
frame conventions: `MarginContainer` margins 40/40/40/28, main VBox
separation 18. Y-values are derived from those constants, accurate to
±25px. Per the recurring Phase-4 lesson, **every new node states its
`mouse_filter` explicitly** — no new element relies on a container
default.

### 3A. Gameplay bottom row — the permanent GEAR | UPGRADES split

```
NORMAL MODE                          x=40                x=1040
y≈1680   Void creatures slain: 214          ◄── unchanged
y≈1734 ┌───────────────────────┐ ┌───────────────────────┐
       │        GEAR      ⦿2 NEW│ │       UPGRADES        │
y≈1844 └───────────────────────┘ └───────────────────────┘
         x=40 ─── x=531            x=549 ─── x=1040
        Session #4                              12m 30s

FARM MODE (unchanged above the split)
y≈1606 ┌─────────────────────────────────────────────────┐
       │              ⚔  CHALLENGE BOSS                   │ ◄── M5, full
y≈1716 └─────────────────────────────────────────────────┘     width, intact
y≈1734 ┌───────────────────────┐ ┌───────────────────────┐
       │        GEAR      ⦿2 NEW│ │       UPGRADES        │
y≈1844 └───────────────────────┘ └───────────────────────┘
```

- **GearButton** — 491×110, default `Button` style (STOP by nature),
  text `"GEAR"`. Left position: UPGRADES keeps the thumb-nearest right
  half for the right-handed majority, because it is tapped many times a
  minute in the early game while GEAR's cadence is minutes.
- **UpgradesButton** — shrinks from full width to 491×110. Same node,
  same behavior.
- **Why splitting is right here when M5 rejected it.** M5's rejection
  had three grounds, each specific to CHALLENGE BOSS: *(1) halved
  targets* — at 491×110 both buttons still exceed the 96px floor five
  times over in width and are unchanged in height; *(2) broken
  muscle memory* — that argument targeted a **conditional** split that
  would reflow UPGRADES every time farm mode toggled; this split is
  **permanent**, changes the layout exactly once at the milestone
  boundary, and never moves again (the relic slot and Forge both live
  inside the Gear screen, so no future milestone adds a third button);
  *(3) visual demotion of the primary action* — GEAR and UPGRADES are
  peer *navigation*, not a mode's primary action; neither wears
  PrimaryButton (tapping the enemy remains the game's primary action),
  and CHALLENGE BOSS keeps its own full-width PrimaryButton row above,
  untouched.
- **Rejected alternatives:** a compact icon-only square beside a wide
  UPGRADES fails Stage 8's "one obvious tap" — a player who has never
  seen a gear screen cannot decode an unlabeled glyph, and the
  asymmetry reads as "lesser feature" forever. A main-menu entrance
  adds a second path outside the play loop the routine lives in
  (rejected for now; revisit alongside the future world-select screen).
- **NewItemsPill** — a small pill (~120×44) straddling the GearButton's
  top-right corner, `BadgePanel`-family dress, text `"2 NEW"` (24px) —
  the count IS the signal, no color needed. `mouse_filter = IGNORE` on
  pill and label (explicit); non-interactive, exempt from touch-target
  minimums. Pops in/increments with the badge-pop idiom; clears on Gear
  screen entry. Hidden at zero — presence means "unseen loot exists,"
  matching the Status Badge philosophy of state-by-presence-and-words.

### 3B. Gear screen (new scene: `scenes/gear/gear.tscn`)

```
x=40                                                          x=1040
y=40   ┌──────────────────────────────────────────┬──────────┐
       │ GEAR                                      │  BACK    │  header 38px /
y=136  └──────────────────────────────────────────┴──────────┘  button 200×96
y≈154  ┌────────────────────────────┬─────────────────────────┐
       │ [scrap icon] 1.2K Void Scraps│        FORGE            │  42px figure /
y≈264  └────────────────────────────┴─────────────────────────┘  button 320×110
y≈282  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
       │  WEAPON  │ │  HELMET  │ │  ARMOR   │ │  GLOVES  │
       │  (tile)  │ │  (tile)  │ │  (tile)  │ │  (tile)  │      4× 236×250
y≈532  └──────────┘ └──────────┘ └──────────┘ └──────────┘
y≈550  ┌──────────┐ ┌──────────┐ ┌──────────┐
       │  BOOTS   │ │   RING   │ │  RELIC   │                  3× 236×250
y≈800  └──────────┘ └──────────┘ └──────────┘
y≈818  ┌──────────────────────────────┬───────────────────────┐
       │ INVENTORY (23) · newest first │  SALVAGE COMMONS (12) │  32px / 460×96
y≈914  └──────────────────────────────┴───────────────────────┘
y≈932  ┌─────────────────────────────────────────────────────┐
       │ [row] EPIC GLOVES · Lv. 23 · ◆◆◆◇◇ · +14 Tap   NEW  │  rows 1000×140,
       │ [row] RARE RING · Lv. 22 · ◆◆◇◇◇ · +6% Essence NEW  │  separation 14,
       │ [row] COMMON BOOTS · Lv. 22 · ◆◇◇◇◇ · +3 Tap        │  ~6 visible,
       │ [row] ...                                     scroll │  vertical scroll
y≈1892 └─────────────────────────────────────────────────────┘
```

- **TopBar** — mirrors the gameplay top bar: `HeaderLabel` "GEAR" 38px
  (IGNORE, explicit), BACK button 200×96 (STOP by nature) →
  `SceneManager.change_scene(SCENE_GAMEPLAY)`.
- **ScrapsRow** — scrap icon 44×44 (`sprites/ui/void_scrap_icon.svg`,
  NEW asset, essence-icon construction rules) + balance at 42px via
  `NumberFormat`, Currency Pop on every `currency_changed` for
  `void_scraps`, and **Hold-to-Reveal** on the label (the pattern's
  planned retrofit path gets its second consumer; label
  `mouse_filter = STOP`, caption advertised inside the Forge panel where
  the exact number matters). FORGE button 320×110 (STOP) opens §3F.
  Essence is deliberately NOT shown here — scraps are the only currency
  spendable on this screen, and the HUD essence counter is one BACK
  away. The HUD conversely never shows scraps: they exist only where
  they can be spent.
- **Equipped grid** — seven fixed tiles in a 4+3 grid, always all seven
  visible with no layout change ever (the M7 relic awakening only
  changes one tile's state). Row 2's fourth cell stays empty.
- **Inventory** — `ScrollContainer` (~960px tall). Fixed sort: **newest
  first** — the routine is "check what just dropped," and a power- or
  rarity-sort would bury the new arrivals under old favorites; a
  swapped-out item re-enters at the top (most recently handled — undo is
  the top row). No sort control this milestone: one honest order beats a
  control nobody needs yet (a cap + auto-salvage + sorting are named
  future QoL, §8). Header count updates live.
- **Empty state** (no items yet): the scroll area shows a centered muted
  block — `"No gear yet."` (32px) / `"Enemies sometimes leave equipment
  behind when slain. Bosses always do."` (26px) — teaching the drop rule
  in one sentence; all tiles show their Empty state. The GEAR button
  exists from the first session (layout stability; the empty state does
  the teaching), only the pill waits for a real drop.

### 3C. Slot tile — three states (236×250 each, whole tile is the button)

```
EQUIPPED               EMPTY                  SEALED (relic)
┌────────────┐        ┌ ─ ─ ─ ─ ─ ┐          ┌────────────┐
│  GLOVES    │        │  RING      │          │  RELIC     │
│   [glyph]  │        │   [glyph,  │          │   [lock    │
│            │        │    dimmed] │          │    glyph]  │
│  ◆◆◆◇◇     │        │            │          │            │
│  Lv. 23    │        │   Empty    │          │   Sealed   │
│  +14 TAP   │        └ ─ ─ ─ ─ ─ ┘          └────────────┘
└────────────┘         dashed border           solid, dimmed
 rarity border
```

- Tile = `Button`-derived panel (STOP by nature); every child label/icon
  `mouse_filter = IGNORE` (explicit). Content: slot name 24px small-caps
  muted; slot glyph 76×76 (seven NEW assets,
  `sprites/ui/slot_weapon.svg` … `slot_relic.svg`, essence-icon
  construction rules); pip row (five 20×20 sockets, N filled —
  `sprites/ui/rarity_pip.svg`, filled/empty variants); `"Lv. 23"` 24px;
  key-stat line 24px = the item's highest-value affix in short form
  (`short_label` from the affix definition: `+14 TAP`, `+9% CRIT`,
  `+8% ESSENCE`, `+15% BOSS`). Rarity border color is the art
  director's; the pips and the rarity word (on the card) carry rarity
  without it.
- Empty: dashed border, dimmed glyph, `"Empty"` 24px. Tap → nothing
  equips from here; the tile is still tappable and opens a minimal
  Inspector Card variant: `"RING — EMPTY"` / `"Gear for this slot drops
  from any enemy."` / CLOSE. One vocabulary: tap a tile, get a card.
- Sealed relic: solid border, dimmed lock glyph
  (`sprites/ui/slot_relic_lock.svg` or lock overlay), `"Sealed"` 24px.
  Tap → Inspector Card variant: `"RELIC — SEALED"` / *"Relics awaken in
  the Astral Temple."* / CLOSE (§4B). The mystery is a promise, not a
  denial — same doctrine as the boss fail copy.

### 3D. Inventory row (1000×140)

```
┌──────────────────────────────────────────────────────────────┐
│ [glyph]  EPIC GLOVES                                    NEW  │
│  72×72   Lv. 23 · ◆◆◆◇◇ · +14 Tap Damage                     │
└──────────────────────────────────────────────────────────────┘
```

- Whole row is one touch target (STOP); children IGNORE (explicit —
  the M4 PanelContainer lesson). Name 30px in the rarity accent with
  the rarity word IN the name (`"EPIC GLOVES"` — color never alone);
  meta line 25px muted: item level · pips · the same key-stat short
  line the tiles use. NEW pill 24px (IGNORE), shown for items unseen at
  screen entry, cleared on next entry.
- Rows are Data-Driven Content Rows: one row scene instanced per item
  dict, exactly the upgrade-shop idiom.

### 3E. Inspector Card — item details + compare (pattern §7.1)

Layer 60. `%Scrim` full-screen at the SceneManager fade color, 0.72
alpha (STOP — blocks the screen behind; **tapping the scrim closes the
card**, unlike the blocking modal). `%Card` x=40–1040 (1000 wide, STOP),
height content-driven, centered — worst case (5-affix vs 5-affix
compare) ≈ y 310–1610. Inner padding 40.

```
x=40                                                        x=1040
      ┌──────────────────────────────────────────────────────┐
      │  EPIC GLOVES                          ◆◆◆◇◇          │ 40px Cinzel,
      │  Item Lv. 23 · Gloves                                │ rarity accent
      │  ────────────────────────────────────────────────    │
      │                    THIS        EQUIPPED (RARE, Lv.19)│ 24px headers
      │  Tap Damage        +14   ▲     +9                    │
      │  Crit Chance       +2.1% ▲     —                     │ 28px rows,
      │  Essence Gain      —           +6%  ▼ lost           │ 44px tall
      │  Boss Damage       +11%  ▲     —                     │
      │  ────────────────────────────────────────────────    │
      │  Salvages for +840 Void Scraps                       │ 24px caption
      │  ┌───────────────────┐  ┌───────────────────┐        │
      │  │       EQUIP        │  │   SALVAGE  +840 ⚙ │        │ 451×110 each
      │  └───────────────────┘  └───────────────────┘        │
      │  ┌──────────────────────────────────────────┐        │
      │  │                  CLOSE                    │        │ 920×96
      │  └──────────────────────────────────────────┘        │
      └──────────────────────────────────────────────────────┘
```

- **Compare table** — the union of both items' stats, one row per stat,
  two value columns. THIS column carries markers: `▲` higher, `▼`
  lower, `—` stat absent; the EQUIPPED column marks stats that would be
  *lost* on swap (`▼ lost`) — losing an essence affix must be as
  visible as gaining a damage one. Glyphs + values carry better/worse;
  color (if the art pass adds any) is decoration. Random affixes make
  the sets heterogeneous, which is exactly why side-by-side beats
  inline deltas: "— vs +6%" is legible where "+0% (change −6%)" is a
  lie. Empty slot: single column, caption `"This slot is empty —
  equipping is pure gain."`.
- **No composite power score, deliberately.** A scalar over
  heterogeneous affixes (essence% vs tap damage) would be an invented
  number the sim can't defend; the game's honesty precedent (offline
  cap disclosure, farm-rate pricing) extends to never faking precision.
  The table IS the comparison.
- **Variants** (one scene, content-driven): *inventory item* — EQUIP +
  SALVAGE + CLOSE as drawn; *equipped item* (opened from a tile) —
  compare columns collapse to one, actions UNEQUIP + CLOSE, caption
  `"Equipped gear can't be salvaged — unequip it first."`; *empty
  slot / sealed relic* — text + CLOSE only; *forge reveal* — identical
  to inventory variant, entrance doubles as the reveal (§4F).
- All buttons STOP by nature; labels/pips IGNORE (explicit). Every
  action disables all three buttons while it processes (double-tap
  guard). EQUIP is PrimaryButton — statistically the tap the player
  came to make; SALVAGE and CLOSE default style.

### 3F. Forge panel (Slide-Up Panel — reuses the shop's exact geometry)

Opens to `offset_top = -1010` → covers y 910–1920 of the Gear screen.
Scraps balance (y≈154) and the whole equipped grid (ends y≈800) stay
visible above the sheet — the player watches their balance drop when
they pull the lever.

```
y≈910 ┌──────────────────────────────────────────┬──────────┐
      │ THE FORGE                                 │  CLOSE   │ 38px / 180×96
      ├──────────────────────────────────────────┴──────────┤
      │ Forges at Item Lv. 23 — your current hunting ground  │ 26px
      │ ┌────────┐┌────────┐┌────────┐┌────────┐             │
      │ │ WEAPON ││ HELMET ││ ARMOR  ││ GLOVES │             │ chips 230×120
      │ └────────┘└────────┘└────────┘└────────┘             │
      │ ┌────────┐┌────────┐┌────────┐                       │
      │ │ BOOTS ✓││  RING  ││ RELIC  │ (relic: dimmed,       │
      │ └────────┘└────────┘└────────┘  "Sealed", disabled)  │
      │                                                       │
      │ ┌──────────────────────────────────────────────────┐ │
      │ │            FORGE BOOTS — 240 SCRAPS               │ │ full width
      │ └──────────────────────────────────────────────────┘ │ ×110
      │        Need 92 more Scraps        (only when short)   │ 24px
      │ Odds: 70% Common · 20% Rare · 8% Epic ·               │ 24px, always
      │       1.9% Legendary · 0.1% Mythic                    │ visible
y≈1920└───────────────────────────────────────────────────────┘
```

- Chips are Buttons (STOP); selected state = heavier border + `✓` glyph
  + label stays (never color alone). Relic chip disabled with
  `"Sealed"` sub-label. The FORGE button names the chosen slot and its
  cost on its face — the whole transaction in one line. All values via
  `NumberFormat`; the odds line renders whatever weight table the sim
  locks (illustrative figures above). Panel emits
  `ui_overlay_opened`/`closed` per the Slide-Up contract.

### 3G. Loot Toast (pattern §7.2) and Mythic banner

```
LOOT TOAST (normal + boss drops)      x=240 ────────── x=840
                                y≈1420 ┌──────────────────┐
                                       │ ◆◆◇◇◇ RARE BOOTS │ 90px tall,
                                y≈1510 └──────────────────┘ 28px text
        (band y 1420–1510: below the enemy art, which ends
         ≈y1377 boss-scaled; above kills label / CHALLENGE
         BOSS / the button row; never covers TimerBar y≈424
         or either health bar; IGNORE on every node)

MYTHIC ONLY — Transient Result Banner, win variant (x140–940,
y430–610, existing geometry/queue):
   "A MYTHIC EMERGES · ◆◆◆◆◆ Mythic Ring · Lv. 41 — it waits in GEAR."
```

---

## 4. Interaction Details

### 4A. Getting there — the GEAR entrance and what combat does meanwhile

- **Gear is a full `SceneManager` scene, not a slide-up panel.** Three
  reasons, in order of force: *(1) the boss timer.* A panel tall enough
  to hold seven slots plus an inventory would cover the whole screen —
  and M5's hardest rule is that a countdown never runs behind something
  the player is reading. The shop panel gets away with mid-boss browsing
  because the timer stays visible above the sheet (M5 §3E); a
  full-screen gear panel would drain it unseen. A scene change instead
  triggers the existing leave-mid-fight rule (attempt voids, free fresh
  retry) — strictly more honest. *(2) space.* The shop's half-screen
  works for a one-dimensional list; 7 tiles + scraps + forge + list
  need the full 1920. *(3) the deferral is free.* `CombatManager`
  already holds boss entries while the gameplay scene isn't current —
  a scene slots into M5's machinery with zero new signals (§6).
  Cost accepted: ~0.25s fade each way at a minutes-scale cadence —
  cheap; the threaded loader keeps it hitch-free.
- **Engineering hooks:** `SCENE_GEAR` constant in `scene_manager.gd`
  (the architecture's "adding a new screen" checklist, step 3);
  `scenes/gear/gear.tscn` + `scripts/ui/gear_screen.gd`.
- **Combat continues headless.** Autoloads run sceneless: auto-attack
  ticks, kills pay essence, drops roll, farm mode farms. The Gear
  screen is a second window into the same managers — its list connects
  to `item_dropped` and prepends new rows live with a pop. The one
  pause: a gate reached mid-visit holds the boss entry (empty combat
  area, auto-attack no-ops) until the player returns — identical to
  sitting on the main menu today, and the wireframed StageLabel will
  read `"Boss at Lv. N"` the moment they're back.
- **"Next hit is bigger" is structural, not staged.**
  `CombatManager.player_tap_attack()` and `auto_attack()` call
  `PlayerStats.roll_tap_damage()` per attack, which reads
  `get_tap_damage()` per roll — verified in the current code. Equipment
  stacking inside those getters (§4G) means an equip mid-farm applies
  to the literal next hit with zero new plumbing. Stage 8's payoff
  requirement is satisfied by architecture.

### 4B. The Gear screen

- **Seen/unseen:** `EquipmentManager` tracks an unseen flag per item.
  Entering the Gear scene calls `mark_all_seen()` — the button pill
  clears immediately — but the screen snapshots the flags at entry so
  NEW pills persist for the visit (the player can still find what's
  new). Next entry, they're gone.
- **Tiles** render from `equipment_changed(slot)`; equipping pops the
  tile (badge-pop idiom, 0.24s). Tap tile → Inspector Card (equipped /
  empty / sealed variant per §3C/§3E).
- **Sealed relic** is a real tile at full size from day one — M7 flips
  its state, never the layout (fixed decision honored structurally).
  Its card copy is the canon line verbatim: *"Relics awaken in the
  Astral Temple."* No milestone numbers, no dates — future mechanics
  announce themselves (M5 doctrine).
- **Sort** is fixed newest-first (rationale §3B). Equip-swaps re-enter
  at the top; salvaged rows collapse out with a 0.15s shrink (one-shot,
  non-essential).
- **Scraps display** pops on every balance change (Currency Pop
  pattern, driven by the existing `currency_changed` signal — free).

### 4C. The Item Card — container resolution and compare

- **Why not the Centered Modal Dialog (the honest answer to the
  library's hardest fit).** The pattern's contract is precise: a
  *game-initiated, must-acknowledge* moment; scrim; card; **exactly ONE
  dismiss action**, no tap-outside, no second exit. That single-exit
  rule is not styling — it is the guarantee that an interrupted player
  never hunts for the way out. The item card inverts every clause: the
  *player* summons it, it holds *decisions* (EQUIP, SALVAGE), and it
  needs a forgiving exit (tap-outside) precisely because it is casual.
  Declaring it "the third consumer" would either force three actions
  into a one-action contract or quietly rewrite the contract under the
  two existing consumers. Both are dishonest. The card is a **new
  pattern — Inspector Card (§7.1)** — that deliberately *shares the
  modal's visual DNA* (same scrim color/alpha, same card dress, same
  0.2s/0.25s entrance and 0.18s/0.2s exit tweens, layer 60) so the two
  read as siblings, while the contracts stay distinct: announcements
  have one exit; inspections have actions plus an always-visible CLOSE
  plus tap-outside. (Implementation may share scrim/tween code by
  composition; that is an engineering choice, not a pattern merge —
  the M5 banner/toast precedent exactly.)
- **Dismissal:** CLOSE button (920×96, always visible — the Enhanced
  tier's "single obvious exit" is satisfied by the button; scrim-tap is
  a bonus affordance for experts, never the only path). No timeout.
- **Plain-language stat lines** (canonical copy, one per affix):
  `Tap Damage +14` · `Tap Damage +12%` · `Crit Chance +2.5%` ·
  `Crit Damage +30%` · `Essence Gain +8%` · `Boss Damage +15%`.
  Percent formatting follows `UpgradeDefinition.format_effect()`'s
  precedent (`String.num(v * 100.0, 1)`). No RPG jargon, no derived
  DPS math — six affixes, six sentences a Cookie Clicker player reads
  cold (Stage 8's "never seen an RPG stat sheet" bar).
- **Compare** per §3E. Opened from the Forge reveal or from a row, the
  EQUIPPED column always reflects the live equipped item at open time —
  and because the scrim blocks the screen behind, nothing can mutate
  the comparison underneath the player except a background drop, which
  only appends to the list and never touches either compared item (§6).
- **EQUIP** → `EquipmentManager.equip(uid)`: instant, free; swapped
  item returns to inventory top; card closes on the manager's
  confirmation signal; tile pops. **UNEQUIP** (equipped variant) →
  returns the item to inventory top; tile reverts to Empty. Unequip
  exists for agency and as the only road to salvaging something
  equipped — it is never styled primary.

### 4D. The drop moment

- **The pipeline:** `EquipmentManager` hears `enemy_died` /
  `boss_fight_won` on the EventBus (it never calls CombatManager — §4G),
  rolls per source, generates the item, appends it to the inventory,
  emits `item_dropped(item, source)`. State lands before any
  presentation — the grant-then-present idiom; no crash loses loot.
- **Announcement tiers** (frequency-proportional volume):
  - *Common/Rare* → **Loot Toast** (§3G): compact pill, pips + rarity
    word, pops in (back-ease, the project bounce), holds ~1.1s, fades,
    frees itself. `mouse_filter = IGNORE` on every node — a mid-tap
    player never loses an attack to loot. No haptic (haptics mark
    rewards *worth a buzz*; buzzing every common would devalue the
    channel).
  - *Epic/Legendary* → same toast + a 25ms haptic (between crit 20 and
    kill 35).
  - *Mythic* → the **Transient Result Banner** (win variant) — the
    pattern's named future use, reserved for the tier whose sim odds
    (~0.1%) make it an event, not a stream. Rides the existing depth-1
    banner queue. 50ms haptic.
  - The **GEAR pill** increments with a pop on every drop regardless of
    tier — the durable, missable-proof record.
- **Collapse rule for streams:** if a Loot Toast is live when another
  drop lands, the toast's content is *replaced* in place with the newer
  item and the hold timer resets; if more than one was folded in, the
  line gains `"+2 more"`. Never a growing queue — auto-attack at 1/s
  against a generous drop rate must not build a 20-second toast debt.
  (The Result Banner keeps its own queue; toasts and banners occupy
  different bands and never collide — §3G geometry.)
- **Rarity at the moment of drop, never color-only:** the pip row
  (count = affix count = rarity) plus the rarity word in the item name,
  in the toast, the rows, the tiles, and the card. Color is the third
  voice, and the art director owns it (§8).
- **First-ever drop** (Stage 8's teaching moment): once per save file,
  the drop's announcement upgrades to a Result Banner — win variant,
  gated by a persisted flag exactly like the Auto-Attack toast —
  naming the button: `"FIRST GEAR DROP — it waits in GEAR below."`
  The ordinary toast is suppressed for that drop (one moment, one
  voice). No blocking modal, no tutorial arrow: a labeled button plus
  a banner naming it is "one obvious tap" without interrupting the
  loop. The pill provides the second, persistent breadcrumb.
- **Boss drops:** guaranteed; the loot toast plays alongside the BOSS
  FELLED banner (separate bands, simultaneous is fine — the banner
  celebrates the wall, the toast the spoils). **World-boss drops**
  (guaranteed high rarity) would land under the World Unlock modal's
  scrim, so instead the drop line joins the modal itself — one line
  under the payout figure: `"Your foe dropped: ◆◆◆◆◇ LEGENDARY RING"`
  — the modal is already the celebration container, and a suppressed
  toast would orphan the milestone's best drop (§6).

### 4E. Salvage

- **Guard rails first:** equipped items are unsalvageable, structurally
  — the equipped-item card simply has no SALVAGE action (§3E), and
  `EquipmentManager.salvage(uid)` refuses non-inventory uids. Stage 9's
  "no accidental loss of equipped" is satisfied by absence, not by a
  warning.
- **Single-item salvage, friction proportional to stakes:**
  - *Common/Rare:* one tap. The button face already states the
    consequence (`SALVAGE +120 ⚙`), the tiers are the replaceable
    bulk, and a confirm dialog per common is exactly the misery Stage 9
    forbids. Feedback: scraps Currency Pop + a small `+120 ⚙` float
    (damage-number idiom) + the card closes (its subject no longer
    exists) + the row collapses.
  - *Epic/Legendary/Mythic:* **Two-Tap Arm** (§7.3). First tap arms the
    button in place: label swaps to `"TAP AGAIN: +840 SCRAPS"`, border
    weight doubles (words + weight, not color — and per the M5 scope
    rule, never ember, which means boss threat only). Second tap within
    3s executes; timeout or tapping anywhere else disarms silently.
    In-place confirmation keeps the interaction on one target — no
    stacked scrim-on-scrim dialog, no pointer travel — fast enough for
    the routine, deliberate enough for a Mythic.
- **Bulk:** `SALVAGE COMMONS (12)` in the inventory header — scope is
  **unequipped Commons only**, the one tier where regret is
  statistically impossible. Same Two-Tap Arm (bulk is always armed):
  `"TAP AGAIN: 12 ITEMS → +340 SCRAPS"`. Disabled at zero commons with
  the count visible (`(0)`) — the button teaches its own trigger.
  Salvaging Rares in bulk was considered and deferred: early game,
  Rares are upgrades, and a bulk action that can eat upgrades needs
  the future per-slot power heuristics — cap + auto-salvage territory
  (§8).
- **Yield transparency:** the yield (rarity/level-scaled, sim curve)
  appears on the button face and card caption *before* any salvage —
  the player never gambles on what destruction pays.

### 4F. The Forge

- **Entry & frame:** FORGE button beside the scraps balance (fuel next
  to furnace); opens the Forge slide-up panel (§3F) inside the Gear
  scene — pattern-standard 0.28s slide, CLOSE button, overlay signals.
- **Slot picker:** six chips + the sealed relic chip (disabled,
  `"Sealed"`) — the seal is stated everywhere the slot appears, one
  rule. Selection persists while the panel is open; last-forged slot
  preselects on reopen (the routine forges the same weak slot
  repeatedly).
- **Cost & affordability:** cost on the FORGE button face
  (`FORGE BOOTS — 240 SCRAPS`, `NumberFormat`). Affordable → enabled +
  PrimaryButton (the shop's "lights up when affordable" journey rule,
  Stage 3 precedent); short → disabled + `"Need 92 more Scraps"` in
  words below (state by words and disabled-dress, never color alone).
  Re-renders on every `currency_changed`.
- **Item level honesty:** the panel states the forge level in plain
  words (`"Forges at Item Lv. 23"`). The level used is the level of
  the enemies currently being killed (the effective farm level at a
  boss wall) — the Forge mints what the world currently drops, never
  pretending the unbeaten gate's level is farmable. Flagged for GD
  confirmation in §8 since the fixed decision's "current enemy level"
  admits both readings; the UI renders whichever is locked.
- **Odds, disclosed:** the full rarity table, always visible, exact
  percentages from the sim (§3F). This game already tells players when
  the offline cap cut their reward; a gacha lever with hidden odds
  would betray that voice (and, pragmatically, ahead of Google Play's
  loot-odds disclosure requirements). Presentation is one quiet 24px
  line — honesty, not a spreadsheet.
- **The pull:** FORGE tap → all panel inputs disable → scraps spent
  (`try_spend`, refuses cleanly on a race — §6) → ~0.7s forge beat: the
  selected chip's glyph pulses once and a particle burst plays in the
  scrap accent (existing celebration vocabulary; one-shot; carries no
  information — the reveal is the information). → **The reveal is the
  Inspector Card's entrance**: the card pops (standard 0.25s back-ease)
  with name, then the pip row ticks in socket by socket (~0.08s each,
  total ≤0.4s) — the tick is the slot-machine tell; the fifth pip is a
  jackpot bell. Haptics: Epic+ 25ms, Mythic 50ms at the last pip.
  Actions right on the card: EQUIP / SALVAGE / CLOSE — a bad pull
  converts back to scraps in two taps, which is what keeps pulling
  feeling safe. Total tap-to-actionable ≈ 1.1s — the boss-entrance
  budget, proven snappy enough to repeat.
- **Repeat pulls:** closing the card returns to the open panel, chip
  still selected, cost re-rendered. No pity timers, no streaks this
  milestone — the odds line is the whole truth.

### 4G. System Ownership (§4-last)

Per `docs/ARCHITECTURE.md`: UI owns nothing; every new piece of state
has a named manager owner.

- **A new `EquipmentManager` autoload**, registered **between
  `UpgradeManager` and `PlayerStats`** (PlayerStats must call downward
  into it for stat queries, exactly as it already calls
  UpgradeManager). It owns:
  - the **inventory** (Array of item dicts) and **equipped** map
    (slot → item dict), persisted in its own `"equipment"` save section;
  - **item generation**: rarity roll per source weight table, affix
    rolls from the data-driven pool, value scaling by item level;
  - **drop rolls**: connects to `enemy_died(level, …)` and
    `boss_fight_won(level, …, is_world_boss)`; tracks
    boss-fight-in-progress from `boss_fight_started/won/failed` signals
    so a boss kill's `enemy_died` never double-rolls the normal chance
    (signal-only knowledge — it never calls CombatManager, which sits
    below it in load order);
  - the **forge level**: cached from `enemy_spawned` payloads for
    non-boss spawns (this equals the effective farm level at a wall by
    construction) and persisted, so no upward call is ever needed;
  - **salvage and forge**: scrap grants via `CurrencyManager.add()`,
    forge costs via `try_spend()` (both legal downward calls), each
    mutation followed by `SaveManager.save_game()` before any
    presentation (grant-then-present);
  - **seen/unseen** flags and `mark_all_seen()`;
  - stat aggregation: `get_stat_additive(stat)` /
    `get_stat_multiplier(stat)` over equipped items' affixes — the
    UpgradeManager query shape, deliberately.
- **`CurrencyManager`** gains one constant: `VOID_SCRAPS =
  &"void_scraps"` and a fourth balance in its existing save section.
  Nothing else changes — earning/spending flows through the existing
  `add()`/`try_spend()`; UI copy always says "Scraps"/"Void Scraps" and
  never bare "Void" (the prestige currency is Void *Crystals* — the
  words must never collide).
- **`PlayerStats`** resolves its `TODO(Milestone 6)`: equipment stacks
  inside the existing getters —
  `get_tap_damage() = (BASE + upgrades_add + equipment_add) ×
  upgrades_mult × equipment_mult`; crit chance adds equipment (still
  clamped at `MAX_CRIT_CHANCE`); crit multiplier and essence gain
  likewise; plus one new getter, `get_boss_damage_multiplier()`
  (`1.0 +` equipment sum). **`CombatManager`** applies that multiplier
  to roll amounts only while `state == BOSS_FIGHT` (a legal downward
  read — PlayerStats is above it), which also means a boss-damage affix
  equipped between attempts applies to the retry's first hit. No
  calling code changes anywhere — the layered-getter design doing its
  job.
- **`CombatManager` emits, never touches items.** Zero equipment code
  lands in it beyond the boss-damage multiplier read. Its existing
  signals are the entire drop interface.
- **EventBus additions (Milestone 6 section):**
  `item_dropped(item: Dictionary, source: StringName)` (sources:
  `&"kill"`, `&"boss"`, `&"world_boss"`, `&"forge"`),
  `equipment_changed(slot: StringName)`, `inventory_changed`.
- **Items are data, not resources.** Generated items are plain dicts
  serialized in the save — procedural content can't be `.tres` files.
  The *definitions* are data-driven resources, per the content-as-data
  rule: `AffixDefinition` in `data/affixes/` (id, stat StringName —
  matching the UpgradeManager stat vocabulary plus `&"boss_damage"` —
  modifier kind, display template `"Tap Damage +{v}"`, `short_label`
  `"TAP"`, per-level/rarity value curve params) and `SlotDefinition` in
  `data/equipment_slots/` (id, display name, glyph path, sort order,
  `sealed: bool` — the relic ships `true`; M7 flips a data file, not
  code). Adding an affix or unsealing a slot is a data drop.
- **Save section shape** (loose contract; engineering owns exact keys):

  ```json
  "equipment": {
      "next_uid": 18,
      "forge_level": 23,
      "equipped": { "weapon": { …item… }, "gloves": { …item… } },
      "inventory": [
          { "uid": 17, "slot": "gloves", "rarity": 3, "level": 23,
            "affixes": [ { "id": "tap_flat", "value": 14.0 },
                         { "id": "crit_chance", "value": 0.021 },
                         { "id": "boss_pct", "value": 0.11 } ],
            "seen": false }
      ]
  }
  ```

  Scraps live in `"currencies"` (`"void_scraps": 340.0`). Inventory is
  stored in acquisition order (append newest); the UI renders it
  reversed. Absent section = empty inventory (pre-M6 saves migrate
  silently, §6). Affix `id`s are save-stable forever, like upgrade ids.
- **UI owns nothing:** `gear_screen.gd`, the Inspector Card, the Forge
  panel, Loot Toast, and the GEAR pill render manager state and EventBus
  signals, and report exactly these actions: `equip(uid)`,
  `unequip(slot)`, `salvage(uid)`, `salvage_all_commons()`, `forge(slot)`,
  `mark_all_seen()` — plus the Forge panel's passive
  `ui_overlay_opened/closed` announcements per the Slide-Up contract.

---

## 5. Accessibility Notes

Mapped against the committed **Enhanced** tier in
`design/accessibility-requirements.md`, with all three recurring Phase-4
lessons applied.

- **Touch targets (every interactive element ≥ 96×96):** GEAR and
  UPGRADES 491×110 each (the split's floor-check, done deliberately in
  §3A); BACK 200×96; FORGE entry 320×110; slot tiles 236×250 ×7;
  inventory rows 1000×140; SALVAGE COMMONS 460×96; card EQUIP/SALVAGE
  451×110, CLOSE 920×96; forge chips 230×120; panel FORGE full-width
  ×110; panel CLOSE 180×96. Every one clears the floor. Deliberately
  non-interactive and exempt (stated here to head off the review
  question, per precedent): pips, the GEAR pill, NEW pills, the Loot
  Toast tree, the odds/level/yield captions.
- **Explicit `mouse_filter` audit (Phase-4 lesson #1):** stated per
  node in §3 — STOP: all buttons/tiles/rows/chips (by nature), the
  Inspector Card's Scrim and Card, the scraps Hold-to-Reveal label.
  IGNORE (explicit, since containers don't default to it): every
  label/icon/pip inside tiles, rows, and cards; the GEAR pill and its
  label; the entire Loot Toast tree; header labels; captions. The Loot
  Toast's IGNORE is load-bearing: it floats over the combat area and a
  player mid-tap must never have an attack eaten by loot.
- **Color-independent state, verified per state:** *rarity* = pip count
  (= affix count, so the signal is also the substance) + the rarity
  word in every item name — color third. *Better/worse* = ▲/▼/— glyphs
  + the literal values side by side. *NEW* = a word pill. *Affordable /
  not* = enabled/disabled dress + "Need N more Scraps" in words.
  *Selected chip* = border weight + ✓ + persistent label. *Sealed /
  empty slots* = words on the tile + distinct border treatment (dashed
  vs solid) + lock glyph. *Armed salvage* = the label literally changes
  sentence. All hold under both CVD axes because every state survives
  full desaturation; the art director's rarity palette (§8) is
  celebratory dressing, constrained to stay out of the ember
  boss-threat scope.
- **Readable numbers:** all scrap balances, costs, and yields via
  `NumberFormat`; the Gear screen's scraps figure carries Hold-to-Reveal
  (the pattern's second retrofit consumer). Affix values are printed
  exact by nature (small numbers, one-decimal percents per the
  UpgradeDefinition formatting precedent). The M4/M5 open item on the
  HUD essence counter is unaffected and re-flagged in §8.
- **Motion reduction:** all new animations are one-shot and short —
  toast ~1.7s total self-freeing, pill/tile pops 0.24s, pip tick ≤0.4s,
  forge beat ~0.7s, row collapse 0.15s, card tweens per the shared
  modal timings. Nothing loops. Nothing gates input beyond its stated
  duration: the card's buttons are live from the first frame (pips tick
  in *around* an already-tappable EQUIP), and the forge beat disables
  only the Forge panel's own inputs while the transaction it animates
  completes. The Two-Tap Arm is motion-free (a label/border swap plus a
  silent 3s disarm).
- **Interruptible modals:** the Inspector Card's CLOSE is single,
  obvious, always visible, live from frame one; scrim-tap is
  supplementary, never the only exit; no timeout. The Forge panel has
  the pattern-standard CLOSE. Toasts and pills require no
  acknowledgment ever.
- **Sound:** still Milestone 14+; every cue here (drop tiers, forge
  reveal, salvage) is already visual-first with haptics only where a
  buzz means reward — future audio is additive, never load-bearing.

---

## 6. Edge Cases

- **Boss gate reached while the Gear screen is open — reconciling the
  deferral with a full scene.** The M5 unobstructed-screen check has
  two inputs: the overlay count *and* whether the gameplay scene is
  current (tracked from the existing `scene_transition_*` signals). A
  full Gear scene never needs to emit `ui_overlay_opened` — the scene
  test already holds the entry, exactly as it does for the main menu
  today. Consequence, stated honestly: while held at a gate mid-visit,
  no enemy exists, so auto-attack earns nothing until the player
  returns; at a minutes-cadence visit this is seconds of idle, and the
  alternative (a countdown starting on an unseen screen) is forbidden
  by M5's own rule. The Forge panel and Inspector Card, being in-scene
  overlays of a non-gameplay scene, change nothing for combat.
- **GEAR tapped during an active boss fight.** Follows the M5 MENU rule
  verbatim: the attempt voids silently (no fail banner, no farm-mode
  entry from a first attempt), and the gate auto-enters fresh on
  return — now wearing whatever was equipped in between. Nothing is
  lost (free retries, full timer); a mid-fight regear amounts to
  "restart the fight stronger," which is player-favorable. The button
  is deliberately NOT disabled mid-fight: a dead button teaches
  nothing, and the shop precedent says management stays reachable.
  UPGRADES remains the in-fight power lever precisely because the shop
  keeps the timer visible while gear cannot (§4A).
- **Drop during a boss fight.** Toasts spawn in the y 1420–1510 band —
  below the boss art, above the button stack, nowhere near the
  TimerBar (y≈424) or either bar (§3G geometry) — and pass all input
  through. A drop can also coincide with the win banner (bands don't
  overlap; both may show). No deferral needed: drops are silent state
  plus a transient.
- **Drop while a blocking modal is up, or off the gameplay scene.**
  The item lands in the inventory regardless (state first). Toasts and
  Mythic banners spawn only when the gameplay scene is current and no
  layer-60 overlay is up; missed announcements are NOT queued — the
  GEAR pill and NEW tags are the durable record, and replaying stale
  toasts after a modal would misattribute the moment. In the Gear
  scene, arriving drops prepend to the visible list with a pop — the
  list is the toast there.
- **World-boss drop vs the World Unlock modal.** The guaranteed
  high-rarity drop lands at the kill; the unlock modal presents ~0.6s
  later and would scrim over any toast. The modal therefore carries the
  drop as a content line (`"Your foe dropped: ◆◆◆◆◇ LEGENDARY RING"`,
  §4D) — the celebration container absorbs the spoils instead of
  suppressing them. The pill still increments. The blocking-modal
  presentation queue is untouched: M6 adds **no** new blocking modals
  to the gameplay scene, so the M5 §6 queue rule (offline first, unlock
  on its dismissal, nothing presents while the queue is non-empty) is
  inherited unchanged — reused, not extended.
- **First drop colliding with another layer-50 transient** (e.g. a
  drop at the level-15 Auto-Attack unlock, or during a boss result
  banner). The first-drop announcement is implemented as a Result
  Banner precisely so it rides the existing depth-1 banner queue —
  M5's "the rule exists for future unlocks" note, now cashed in. Loot
  Toasts occupy a different band and follow their own collapse rule
  (§4D); they never join the banner queue.
- **Equip/unequip mid-anything — stat timing.** Verified against the
  code: damage getters are read per-roll (§4A), essence gain per-kill,
  boss damage per-hit while in `BOSS_FIGHT`. There is no cached stat
  anywhere, so no stale-stat edge exists. Offline pricing
  (`IdleManager.get_live_essence_rate`) also reads live stats, so gear
  honestly raises offline earnings too — no copy change needed.
- **Salvage/forge races.** Every Inspector Card action disables all
  card buttons while processing; the Forge button disables on tap;
  `try_spend()` refuses cleanly if scraps are short at execution time
  (only possible via a same-frame race, but the refusal path is
  defined: button re-renders, nothing lost). An armed salvage button
  disarms on ANY other input — arming can never linger into a
  different context. Bulk salvage recomputes its set at execution:
  items equipped between arm and confirm are excluded by the
  unequipped-Commons predicate itself.
- **Salvaging with the card open while the list changes beneath.**
  Impossible to corrupt: the scrim blocks all gear-screen input while
  a card is open, and the only background mutation (a drop) appends to
  the list without touching the card's subject or the equipped
  comparison. Cards always operate on uids, so even a reordered list
  can never redirect an action.
- **Relic slot interactions, everywhere.** Tile → sealed card variant
  with the canon line; forge chip → disabled + `"Sealed"`; generation →
  the relic slot is simply absent from every drop and forge pool (a
  sealed `SlotDefinition` is excluded at the data layer, so no code
  path can mint a relic early).
- **App killed mid-forge or mid-salvage.** Manager mutations follow
  grant-then-present with an immediate save (§4G): the spend, the
  generated item, and the scrap grant are one save-committed step
  before any reveal animates. A kill during the reveal loses only the
  ceremony — the item is in the inventory (NEW-tagged) on relaunch.
  Ceremonies never replay on load (project-wide rule since M4).
- **Pre-M6 saves.** No `"equipment"` section → empty inventory, empty
  slots, zero scraps, no migration step needed (absent-defaults idiom).
  Nothing retroactive is granted: the player's next kills start
  dropping normally, and their genuinely-first drop plays the
  first-drop teaching banner — the update announces itself with its
  own mechanic, like M4's offline welcome gift.
- **Unbounded inventory (no cap this milestone).** The list scrolls;
  hundreds of items remain navigable because newest-first keeps the
  actionable items on top and bulk salvage keeps Commons drained. A
  hoarder's thousand-row list is an engineering perf note (row
  recycling), not a UX break — but the cap + auto-salvage QoL is
  re-flagged in §8 with this as its trigger.
- **Offline periods.** No drops accrue offline this milestone: offline
  pay is a rate estimate, not simulated kills, and minting items from
  estimated kills would either flood (per-kill fidelity) or require a
  new honesty story. The offline modal continues to report essence
  only, which stays true. Flagged for GD sign-off in §8.

---

## 7. New Patterns Proposed

### 7.1 Inspector Card (dismissible, multi-action)

**Used in:** the item card, all variants (inventory item, equipped
item, empty slot, sealed relic, forge reveal). Expected future reuse:
relic details (M7), pet cards (M10+), skill-node inspection (M8) — any
player-summoned "look closer at one thing, maybe act on it" surface.
**Behavior:** the Centered Modal Dialog's visual family — full-screen
scrim (SceneManager fade color, 0.72 alpha), centered card, layer 60,
identical entrance/exit tweens — under an inverted contract: the
*player* opens it, it holds **multiple actions** (one may be
PrimaryButton), and it dismisses via an always-visible CLOSE button
*plus* scrim-tap, with no timeout. Emits `ui_overlay_opened`/`closed`
like every blocking overlay. Distinct from Centered Modal Dialog by
exactly three contract clauses (initiation, action count, exit paths);
that pattern's one-dismiss announcement contract is untouched and keeps
its two consumers.
**Implementation:** proposed as `scripts/ui/inspector_card.gd` +
`scenes/gear/item_card.tscn` (`%Scrim`, `%Card`, `%CloseButton`,
content-driven action row; may share scrim/tween code with
`CenteredModalDialog` by composition — engineering's call, not a
pattern merge).

### 7.2 Loot Toast (compact transient pickup pill)

**Used in:** equipment drops. Expected future reuse: any high-frequency
pickup/reward stream (pet shards, minigame tickets) too frequent for
the Result Banner's 2.2s mid-screen footprint.
**Behavior:** a small pill (~600×90) in a low screen band clear of all
HUD instruments, input-transparent (`mouse_filter = IGNORE`
everywhere, explicit), pop-in / ~1.1s hold / fade / self-free. Content
is one line: signal glyphs (pips) + name. **Collapse rule instead of a
queue:** a new event while live replaces content and resets the hold,
folding overflow into a `"+N more"` suffix — transients for streams
must never accumulate debt. Distinct from the Result Banner (event-
scale announcements, queued, mid-screen) and the Unlock Celebration
Toast (once-per-save); the three form a volume ladder: toast < banner
< blocking modal.
**Implementation:** proposed as `scenes/common/loot_toast.tscn` +
`scripts/ui/loot_toast.gd`, instanced by the gameplay scene on
`item_dropped`.

### 7.3 Two-Tap Arm (in-place destructive confirm)

**Used in:** Epic+ single salvage, bulk salvage. Expected future reuse:
any *repeatable, medium-stakes* destructive action where a blocking
confirm dialog would be friction-miserable (NOT save-wipe/prestige —
those remain full Centered Modal Dialog ceremony when they arrive).
**Behavior:** first activation arms the same button in place — the
label rewrites to the explicit consequence (`"TAP AGAIN: +840
SCRAPS"`) and the border weight doubles (words + weight, never color
alone, never ember). Second activation within 3s executes; timeout or
any other input disarms silently. Single motor target, zero new
containers, consequence stated before commitment.
**Implementation:** a small reusable script
(`scripts/ui/two_tap_arm_button.gd`) wrapping a Button's label/style
swap and disarm timer.

*(Considered and NOT proposed as patterns: the GEAR count pill — a
Status Badge kin with a lifecycle, single consumer for now; the rarity
pip row — load-bearing **visual vocabulary**, not an interaction,
handed to the visual-design pass with its non-color contract fixed
here; the forge reveal beat — a composition of §7.1's entrance and
existing celebration vocabulary, no independent contract.)*

---

## 8. Open Questions for the Game Designer / Team

- **The tuning set** (parallel sim): normal-kill drop chance; rarity
  weight tables per source (normal / boss / world-boss floor); forge
  odds table and cost curve; salvage yield curve by rarity × level;
  affix value ranges by item level. Every surface here is
  parameterized; the odds line (§3F) renders whatever is locked. One
  UX-side request: keep the normal drop chance high enough that Stage
  8 lands "somewhere in the first minutes" as the journey promises —
  the first-drop teaching moment is load-bearing.
- **Forge level semantics** — this spec uses the effective farm level
  (what's actually dropping) and says so on the panel; the fixed
  decision's "current enemy level" could also mean the gate level at a
  wall. Confirm; the copy adapts either way (§4F).
- **Offline drops** — this spec ships essence-only offline (§6).
  Confirm, or scope an offline-loot story for a later milestone
  (prestige-adjacent QoL feels like its home).
- **Item naming** (writer): display names are `RARITY + SLOT` this
  milestone ("EPIC GLOVES"). Procedural flavor names ("Gauntlets of
  the Hollow Sun") are a pure-content upgrade later — the name line is
  the only surface that changes.
- **Rarity accent palette** (art director): five accents, distinct
  from the violet UI family, the teal auto-attack family, the crit
  gold, and — hard constraint — outside the ember family, whose M5
  scope rule reserves it for boss threat. Verified with the composited
  method; pips + rarity words already carry every state without them.
  Asset order: `void_scrap_icon.svg`, seven slot glyphs + relic lock,
  `rarity_pip.svg` (filled/empty), all on essence-icon construction
  rules.
- **"Boss Damage" stat wording** (writer): plain and literal here;
  a flavored name ("Slayer") must not obscure what it does.
- **Crit-cap disclosure** — equipment crit affixes can push toward the
  existing 50% crit cap. The card shows raw affix values; there is no
  stats-summary screen yet to disclose the cap the way the offline cap
  is disclosed. Fine this milestone (cap is far away at M6 stat
  budgets — sim to confirm); a character-stats readout is the natural
  M7/M8 home. Flag, don't build.
- **Inventory QoL trigger** (future, restated from the fixed
  decisions): cap + auto-salvage rules + sort controls arrive as one
  package when real inventories justify them; the perf note in §6 is
  the tripwire.
- **Hold-to-Reveal on the HUD essence counter** — carried forward from
  M4 §8 and M5 §8, unchanged; scraps shipped with it on the Gear
  screen, so the HUD counter is now the only abbreviated figure
  without it.
- **For engineering, not design:** (a) autoload table gains
  `EquipmentManager` between UpgradeManager and PlayerStats — re-verify
  the M4 IdleManager connect-order comment survives (it should:
  IdleManager stays last); (b) `SCENE_GEAR` constant + scene per the
  architecture checklist; (c) the Forge panel reuses the shop panel's
  offsets verbatim — extract shared constants or accept duplication
  consciously; (d) inventory row recycling if row counts grow hostile
  (§6).
