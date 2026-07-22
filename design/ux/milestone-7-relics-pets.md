# Milestone 7 UX Spec — Relics & Pets

Author: ux-designer · Status: draft for Phase 1c review
Serves: `design/player-journey.md` Stage 10 (First Relic) and Stage 11
(Pet Companion).

Game-design decisions taken as fixed (not re-derived here): the M6 sealed
relic slot **awakens** this milestone; relics are **unique, named** items,
each a single coded permanent effect (not procedural affix gear); relics
are collected as rare boss / world-boss drops — a growing collection with
**one active at a time** in the relic slot, swap free and reversible;
pets have a **level** (from an XP source), an **evolution** at level
thresholds (visible transform + name change + bigger bonus), and **one
passive bonus each** scaling with level; multiple pets owned; neither
system is ever required to progress. This spec **recommends and defends**
the open triggers and the one-active-pet rule the brief left to UX, and
**parameterizes every number** (level curves, XP per kill, evolution
thresholds, relic/pet drop rates) exactly as M6 did — a parallel tuning
sim owns the magnitudes; no layout or copy here depends on one, and every
illustrative figure in a wireframe is marked as such.

Grading criteria from `player-journey.md`: **Stage 10** — a relic must
read at a glance as *different* from equipment (unique named effect, not
random affixes); the effect must feel meaningful and build-shaping; only
one active, so the choice matters; swapping is free and reversible.
**Stage 11** — a pet must feel like a *growing companion, not a menu*: it
levels from play, evolves at milestones with a visible transformation, its
passive bonus is legible, managing it is light and rewarding and never a
chore, and it is never required to progress.

This spec follows M6's structure and reuses M6's Gear screen, item-card
vocabulary, and ownership discipline wherever the two milestones touch.

---

## 1. Overview

> **DESIGN OVERRIDE (build sequencing).** The brief and the M6 flavor
> point relics at World 4 (Astral Temple), but only Worlds 1–2 exist as
> data — gating M7 behind World 4 would make it unreachable. Per the
> established precedent (auto-attack was a world-themed mechanic gated on
> an available trigger instead), the awaken fires on the **first world
> unlock the game actually ships — Frozen Ruins (World 2), earned by
> defeating the first world boss at level 50.** Everywhere this spec says
> "Astral Temple unlock," read "first world unlock (Frozen Ruins)"; the
> mechanism (§4-last) is unchanged — it hooks the same `world_unlocked`
> signal, just at world index 1. The Astral Temple remains the aspirational
> canon home and reclaims the theme when Worlds 3–4 ship.

Two features arrive when the player **conquers their first world** and
crosses into the **Frozen Ruins** — the first celebrated "new chapter"
beat the build delivers. Both are deep-game companions to the kill loop,
introduced at the same moment so the milestone teaches itself once.

1. **Relics — folded into the existing Gear screen.** The M6 relic tile
   stops being sealed and becomes a live window into a new **RelicManager**.
   Tapping it opens the **Relic Collection** (a Slide-Up Panel *inside* the
   Gear scene, exactly the Forge panel's in-scene overlay idiom — §3B):
   every owned relic as a Data-Driven Content Row, an ACTIVE marker, and a
   relic **Inspector Card** whose actions are **ATTUNE / DETACH / CLOSE** —
   deliberately no pips, no rarity, no affixes, no salvage. Relics carry a
   *named effect in one plain sentence*, never a stat sheet — the whole
   point is that a relic does not look like gear (§4B, §4C). One relic
   active; attuning another auto-detaches the current one; the swap is free.
   No new navigation: the awakened tile is the one obvious tap (§4A).

2. **Pets — a new full `SceneManager` scene, entered by tapping the
   companion.** The active pet now **fights alongside the player** as a
   sprite in the gameplay combat area (Stage 11's literal promise), and
   that sprite **is** the entrance: tapping it opens the new **Pets screen**
   (`SCENE_PETS`). This is the milestone's central layout decision — it adds
   **zero** persistent bottom-bar chrome, honoring M6's explicit promise
   that the GEAR|UPGRADES split "changes the layout exactly once… and never
   moves again," and a full scene inherits the M5/M6 boss-gate deferral for
   free (§4A). The Pets screen shows the active pet's evolution form, level,
   an XP bar, its plain-language passive bonus, and a roster of every owned
   pet with a one-tap SET ACTIVE. One pet active; its bonus is the only one
   that applies (§4A defends one-vs-many).

3. **Growth and drop moments, on a volume ladder that reuses the whole M6
   celebration vocabulary.** Pet **level-up** is frequent and quiet — a
   **Loot Toast**-family transient (`"Ember reached Lv. 7"`) plus a pop on
   the companion. Pet **evolution** is rare and loud — a **Result Banner**
   (win variant) plus the visible sprite transform, *not* a blocking modal
   (it fires mid-combat; M5/M6 doctrine keeps blocking modals for offline
   and world-unlock only). **Relic drops** and **new-pet drops** are rare
   and special — always the **Result Banner**, never the compact Loot Toast,
   marking them as bigger than any gear drop. The **first pet** is a
   guaranteed grant at the Astral Temple unlock (M4's "welcome gift" idiom);
   the relic slot **awakens** at the same unlock; the first *relic* then
   drops from the new world's bosses. All of it rides the **existing**
   depth-1 banner queue and blocking-modal presentation queue — **M7 adds no
   new blocking gameplay modal** (§4D, §6).

Ownership follows M6's discipline (§4-last): two new autoloads —
**RelicManager** (owned/active relics, effect queries, awaken flag) and
**PetManager** (owned/active pets, XP/level/evolution, bonus queries) —
sit between EquipmentManager and PlayerStats; `PlayerStats` reads **both**
inside its existing `get_*()` layering, which is what makes every
stat-shaped relic and pet bonus apply to the literal next hit with zero new
plumbing. **CombatManager gains no new hook** (the boss-damage multiplier
read it already has carries Hunter's Sigil). **IdleManager gains exactly
one hook** — the auto-attack interval, because Twin Fang changes attack
*cadence*, which is not a PlayerStats value (§4-last). UI owns nothing.

---

## 2. User Flows

### 2A. Stage 10 — the slot awakens → first relic → first attune

```
Player defeats the DARK FOREST's level-50 world boss and unlocks the
FROZEN RUINS — the first world unlock (existing World Unlock modal)
        │
        ▼
RelicManager.awaken() flips the relic system on (state first). The
World Unlock modal — already the chapter's celebration container —
carries one added line: "The relic slot stirs. The bosses of the
frozen deep hold what fills it." (no new modal; M6 world-boss-drop
idiom reused, §6)
        │
        ▼
Player taps GEAR (unchanged bottom-row button). On the Gear screen the
former SEALED tile is now AWAKENED-EMPTY: solid border, a faint relic
sigil, "Relic — Empty", "Tap to attune". A one-time "the seal breaks"
shimmer plays on first view (once per save, never replayed on load)
        │
        ▼
Tap the relic tile → RELIC COLLECTION panel slides up (in-scene, §3B).
Empty state: "No relic attuned. Relics are recovered from the bosses of
the Frozen Ruins and beyond." — teaching the drop rule in one line
        │
        ▼
Player farms / fights a Frozen Ruins boss. RelicManager rolls the rare
relic drop → the relic is added to the owned collection IMMEDIATELY
(grant-then-present) → RESULT BANNER, win variant: "RELIC RECOVERED · Eclipse
Heart — offline rewards tripled." + the GEAR pill increments
        │
        ▼
GEAR → relic tile wears a NEW badge → tap → Relic Collection, one row:
"Eclipse Heart · Offline rewards ×3 · NEW". Tap the row → Relic
Inspector Card: name, a single plain sentence, flavor line, ATTUNE
(PrimaryButton) / CLOSE. No pips. No affix list. No SALVAGE. A caption
teaches the rule once: "A relic is one permanent power. Only one may be
attuned — swapping is always free."
        │
        ▼
ATTUNE → card closes, the relic tile fills with the relic sigil + name +
its one-line effect + an ACTIVE marker (badge-pop idiom). Stage 10
complete — the player has felt "different from gear" (named effect, one
active, free swap) without a tutorial.
```

### 2B. Stage 11 — first companion → grow → evolve → switch

```
The Astral Temple unlock also GRANTS the first pet (guaranteed, §4A) —
PetManager.grant_starter() runs at the unlock, state first
        │
        ▼
Back in gameplay, a COMPANION sprite now stands beside the enemy and
animates on every hit/kill (Stage 11: "fights alongside them"). A
one-time hint toast: "A companion joined you — tap it to see it grow."
The companion wears a small NEW badge until first opened
        │
        ▼
Player taps the COMPANION (its own touch target, off the enemy's strike
zone — §4A) → Scene Fade → PETS screen. First-pet state: one pet, active,
Lv. 1, XP bar near-empty, bonus line "Essence gain +4%", next-evolution
preview "Evolves at Lv. 10". Caption: "Your companion grows as you fight."
        │
        ▼
Player keeps playing. Every kill grants the active pet XP (PetManager
hears enemy_died). Crossing a level → LEVEL-UP: a compact Loot-Toast-
family transient "Ember reached Lv. 7" + a companion scale-pop. Frequent,
quiet, never blocking (§4E). The bonus line ticks up with the level.
        │
        ▼
Crossing an evolution threshold → EVOLUTION: the companion sprite
transforms in place (visible), its name changes, its bonus curve steepens.
A RESULT BANNER (win variant) marks it: "EMBER EVOLVED — now BLAZE ·
Essence gain +11%". Non-blocking; the transform is the payoff (§4E)
        │
        ▼
Later the player finds a second pet (rare boss drop) → RESULT BANNER
"NEW COMPANION — Frostling" → it enters the roster with a NEW badge, not
yet active
        │
        ▼
PETS → tap the Frostling row → Pet Inspector Card (form, level, bonus,
next evolution) → SET ACTIVE. The companion swaps on return to gameplay;
its bonus applies to the very next hit (PlayerStats reads live, §4A). One
active — the choice matters, and it is free/reversible.
```

### 2C. Getting there and back — panels, scenes, and combat meanwhile

```
Gameplay ──GEAR──▶ Gear screen ──(tap relic tile)──▶ Relic Collection
   panel (in-scene overlay) ──CLOSE──▶ Gear ──BACK──▶ Gameplay

Gameplay ──(tap companion)──▶ Pets screen ──BACK──▶ Gameplay
   (Scene Fade Transition ~0.25s each way)

While the Gear scene OR the Pets scene is current:
  · managers run sceneless — auto-attack keeps killing and earning;
    relic/pet drops keep rolling; pet XP keeps accruing from kills
  · a boss gate reached mid-visit HOLDS (empty combat area, no
    countdown) via the existing scene test in CombatManager — a full
    scene, like the Gear scene and the main menu, needs no ui_overlay
    signals; the Relic Collection panel, living inside the non-gameplay
    Gear scene, needs none either (the Forge panel already establishes
    this — §4A, §6)
  · a relic/pet drop arriving on these screens appends to its list live
    (the list is the toast there); no banner replays on return (§6)
```

---

## 3. Wireframes

Reference canvas 1080×1920. New surfaces adopt the Gear/gameplay frame
conventions: `MarginContainer` margins 40/40/40/28, main VBox separation
18. Y-values are derived from those, accurate to ±25px. Per the recurring
Phase-4 lesson, **every new node states its `mouse_filter` explicitly** —
nothing relies on a container default.

### 3A. The awakened relic tile (Gear screen, 236×250 — three states)

The relic tile keeps its M6 position (row 2, cell 3) and size. Only its
**state source** changes: it now reads **RelicManager**, not the
EquipmentManager equipped map. This is the one tile in the grid backed by
a different manager (§4-last).

```
SEALED (pre-M7)        AWAKENED-EMPTY         ATTUNED
┌────────────┐        ┌────────────┐          ┌────────────┐
│  RELIC     │        │  RELIC     │          │ Eclipse    │
│  [lock     │        │  [sigil,   │          │  Heart     │
│   glyph]   │        │   faint]   │          │  [sigil]   │
│            │        │            │          │            │
│  Sealed    │        │  Empty     │          │ Offline ×3 │
└────────────┘        │  Tap to    │          │  ● ACTIVE  │
 solid, dimmed        │  attune    │          └────────────┘
 (M6 state)           └────────────┘           solid border +
                       solid border             attuned glow
```

- Whole tile is a `Button` (STOP by nature); every child label/sigil
  `mouse_filter = IGNORE` (explicit). No pip row ever — relics have no
  rarity tier (§4B); the tile carries the relic **name** and its **one-line
  effect** instead of a key-stat line.
- **Sealed → Awakened** is a state flip driven by `RelicManager.is_awakened()`,
  not by generating gear. A first-view "seal breaks" shimmer (one-shot,
  ≤0.5s, save-gated) marks the transition (§4B).
- **ACTIVE marker** = a filled dot glyph + the word "ACTIVE" (never color
  alone — Status Badge doctrine).
- Tap in **any** state → the Relic Collection panel (§3B). Sealed state is
  unreachable post-awaken; before awaken the tile keeps its M6 sealed card.

### 3B. Relic Collection panel (Slide-Up Panel inside the Gear scene)

Reuses the Forge panel's geometry and in-scene-overlay rules verbatim
(0.28s cubic slide, CLOSE button, **fires no `ui_overlay` signals** because
it lives in a non-gameplay scene — the Forge panel's stated contract). The
Gear scene's scraps row and equipped grid stay visible above the sheet.

```
y≈820 ┌──────────────────────────────────────────┬──────────┐
      │ RELICS                                    │  CLOSE   │ 38px / 180×96
      ├──────────────────────────────────────────┴──────────┤
      │ ACTIVE                                                │ 24px header
      │ ┌──────────────────────────────────────────────────┐ │
      │ │ [sigil] ECLIPSE HEART            ● ATTUNED        │ │ active card
      │ │  64×64  Offline rewards are tripled.             │ │ 1000×150
      │ └──────────────────────────────────────────────────┘ │
      │ COLLECTION (3)                                        │ 24px header
      │ ┌──────────────────────────────────────────────────┐ │
      │ │ [sigil] HUNTER'S SIGIL                       NEW │ │ rows 1000×140,
      │ │  Boss damage +50%.                               │ │ separation 14,
      │ │ [sigil] TWIN FANG                                │ │ vertical scroll
      │ │  Auto-attack fires twice as fast.                │ │
      │ │ [sigil] ...                               scroll │ │
y≈1920└──────────────────────────────────────────────────────┘ ┘
```

- **ACTIVE card** — the currently-attuned relic pinned at top: sigil, name
  (30px), the single plain effect sentence (25px muted), an "● ATTUNED"
  badge. Empty state (awakened, none attuned): a muted block "No relic
  attuned." / "Relics drop from the bosses of the Frozen Ruins and beyond."
- **COLLECTION rows** — Data-Driven Content Rows, one per owned relic (the
  upgrade-shop / M6-inventory idiom). Each: sigil 64×64, name 30px, the one
  effect sentence 25px muted, a "NEW" word pill (IGNORE) for relics unseen
  since last open. The attuned relic is excluded from the list (it lives in
  the ACTIVE card) or shown with its own ATTUNED badge — engineering's call;
  copy holds either way. Whole row STOP; children IGNORE (explicit).
- No sort control, no rarity, no pips — the collection is small and every
  relic is unique. Tap a row → Relic Inspector Card (§3B).

### 3C. Relic Inspector Card (Inspector Card pattern — relic variant)

Layer 60. Identical scrim / card dress / entrance-exit tweens as the M6
item card; **different action set** and no compare table (relics are not
comparable stat sheets).

```
x=40                                                        x=1040
      ┌──────────────────────────────────────────────────────┐
      │  ECLIPSE HEART                          [sigil 80]    │ 40px Cinzel
      │  Relic                                                │ 24px muted
      │  ────────────────────────────────────────────────    │
      │  Offline rewards are tripled.                        │ 30px, the
      │                                                       │ ONE effect
      │  "A heart that beats in the dark between sessions."  │ 24px flavor
      │  ────────────────────────────────────────────────    │
      │  Only one relic may be attuned. Swapping is free.    │ 24px caption
      │  ┌──────────────────────────────────────────────┐    │
      │  │                  ATTUNE                       │    │ 920×110
      │  └──────────────────────────────────────────────┘    │ (DETACH if
      │  ┌──────────────────────────────────────────────┐    │  already
      │  │                  CLOSE                        │    │  active)
      │  └──────────────────────────────────────────────┘    │ 920×96
      └──────────────────────────────────────────────────────┘
```

- **Actions, content-driven:** an *unattuned* relic → **ATTUNE**
  (PrimaryButton) + CLOSE. The *attuned* relic → **DETACH** + CLOSE
  (DETACH never PrimaryButton — attuning is the tap the player came for).
  **No SALVAGE, ever** — relics are unique and permanent; the action simply
  does not exist (Stage 10's "not another stat stick" reinforced by the
  absent verb, the M6 equipped-item-cannot-be-salvaged idiom).
- **ATTUNE** → `RelicManager.attune(id)`: auto-detaches the current relic,
  attunes this one, instant and free; card closes on the manager signal;
  tile pops. **DETACH** → clears the slot (agency; a valid choice if a
  relic's effect is situational). Buttons disable while processing
  (double-tap guard).
- The one effect sentence is **canonical copy** owned by the writer, read
  straight from `RelicDefinition.effect_description` — no derived math, no
  jargon (§8).

### 3D. Pets screen (new scene: `scenes/pets/pets.tscn`)

```
x=40                                                          x=1040
y=40   ┌──────────────────────────────────────────┬──────────┐
       │ PETS                                      │  BACK    │ 38px / 200×96
y=136  └──────────────────────────────────────────┴──────────┘
y≈160  ┌─────────────────────────────────────────────────────┐
       │                   [ BLAZE  sprite ]                  │ active pet
       │                     ~300×300                         │ showcase
y≈500  │  BLAZE                          Stage 2 of 3         │ 40px / 26px
       │  ┌───────────────────────────────────────────────┐  │
       │  │ Lv. 12   ███████████░░░░░░░░   1.4K / 3.0K XP  │  │ XP bar 96 tall
       │  └───────────────────────────────────────────────┘  │
       │  Essence gain +11%          Evolves at Lv. 25       │ 28px / 24px
y≈760  ├─────────────────────────────────────────────────────┤
       │ COMPANIONS (3)                                       │ 32px header
y≈820  ┌─────────────────────────────────────────────────────┐
       │ [form] BLAZE · Lv. 12 · Essence +11%     ● ACTIVE   │ rows 1000×140,
       │ [form] FROSTLING · Lv. 3 · Tap dmg +2%        NEW   │ separation 14,
       │ [form] SPARKLING · Lv. 1 · Crit +0.5%              │ scroll
y≈1892 └─────────────────────────────────────────────────────┘
```

- **Active-pet showcase** — the current **evolution form** sprite (large,
  a gentle <1.5s idle hover, motion-reduction-safe), the pet name (40px),
  an evolution indicator in **words** ("Stage 2 of 3" + the stage's name),
  the XP bar, the passive bonus in plain language ("Essence gain +11%"),
  and the next-evolution preview ("Evolves at Lv. 25"). Sprite is
  non-interactive here (`mouse_filter = IGNORE`).
- **XP bar** — reuses the health/timer **bar visual family** as a *filling*
  progress bar (not a new pattern, §7): a full-width bar, `Lv. N` at the
  left, `cur / next XP` numerals inside (outlined, ≥24px), Hold-to-Reveal
  on the figure for the exact comma-grouped value. Non-interactive
  (`mouse_filter = IGNORE`). At the evolution cap stage the right label
  reads "MAX FORM" and the bar tracks level only (no further evolution).
- **Roster** — `ScrollContainer` of Data-Driven Content Rows, one per owned
  pet: current-form icon 64×64, name 30px, `Lv. N`, the passive bonus short
  line, and an "● ACTIVE" badge (word + dot) on the active pet, a "NEW" pill
  on unseen pets. Whole row STOP; children IGNORE. Tap → Pet Inspector Card.
- **First-pet state** — the roster holds exactly one pet, already active,
  Lv. 1; the showcase teaches with "Your companion grows as you fight. It
  evolves at higher levels." No empty state exists once unlocked (the first
  pet is granted, never zero).

### 3E. Pet Inspector Card (Inspector Card pattern — pet variant)

```
      ┌──────────────────────────────────────────────────────┐
      │  FROSTLING                              [form 80]     │ 40px
      │  Companion · Stage 1 of 3                            │ 24px muted
      │  ────────────────────────────────────────────────    │
      │  Lv. 3   ████░░░░░░░░░░░   120 / 400 XP              │ XP bar
      │  Tap damage +2%                                       │ 28px bonus
      │  Evolves into FROSTWYRM at Lv. 10                    │ 24px preview
      │  ────────────────────────────────────────────────    │
      │  ┌──────────────────────────────────────────────┐    │
      │  │                SET ACTIVE                     │    │ 920×110
      │  └──────────────────────────────────────────────┘    │ PrimaryButton
      │  ┌──────────────────────────────────────────────┐    │ (hidden/
      │  │                  CLOSE                        │    │  disabled if
      │  └──────────────────────────────────────────────┘    │  already active)
      └──────────────────────────────────────────────────────┘
```

- **SET ACTIVE** → `PetManager.set_active(id)`: instant, free, reversible
  (the relic/pet swap doctrine — the choice matters *because* only one
  bonus applies, not because switching is punished). The active pet's card
  shows the SET ACTIVE button disabled with "Already active" in words. CLOSE
  + scrim-tap dismiss (Inspector Card contract). No destructive action —
  pets are never salvaged or released this milestone.

### 3F. The companion in gameplay + growth transients

```
GAMEPLAY combat area (companion is the entrance to §3D)
        ┌───────────────────────────────┐
        │            [ ENEMY ]          │  ← central strike zone
        │                               │    (CombatArea, unchanged)
        │   [companion]                 │  ← 200×200 Button, STOP,
        │    Lv.12  ⓝ                   │    LOW-LEFT, clear of the
        └───────────────────────────────┘    enemy's tap region (§4A)

LEVEL-UP (frequent) — Loot-Toast-family transient, IGNORE everywhere:
        ┌──────────────────────┐  "Ember reached Lv. 7"  (~1.1s, self-frees)
        └──────────────────────┘

EVOLUTION (rare) — Transient Result Banner, win variant, existing queue:
        "EMBER EVOLVED — now BLAZE · Essence gain +11%"

RELIC DROP (rare) — Transient Result Banner, win variant:
        "RELIC RECOVERED · Eclipse Heart — offline rewards tripled."

NEW PET DROP (rare) — Transient Result Banner, win variant:
        "NEW COMPANION — Frostling joins the hunt."
```

- The **companion** sits low-left (or a corner the art pass fixes), a
  200×200 `Button` (STOP) whose bounds are the pet's touch target; taps
  outside it fall through to the CombatArea and attack as normal (§4A
  resolves the tap-collision risk). A small `Lv. N` label + a NEW badge
  (word pill) ride on it; both IGNORE. Its attack/hit animation is
  decorative, synced to `enemy_damaged` / `enemy_died` — the pet is a
  *passive bonus*, not a separate damage source (§4A, §4-last).
- All four transients carry their signal in **words** (name + effect), never
  color alone. Level-up gets no haptic (too frequent); evolution, relic
  drop, and new-pet drop get a reward-scaled haptic (evolution/pet 35ms,
  relic 50ms — a relic is the rarer event).

---

## 4. Interaction Details

### 4A. Getting there — the central layout decision, defended

**No new persistent navigation is added.** The gameplay bottom row stays
the M6 GEAR|UPGRADES split, unchanged.

- **Relics live inside the Gear screen.** The awakened relic tile is the
  entry (§3A); the Relic Collection is an in-scene Slide-Up Panel (§3B).
  This is the smallest possible surface: the player already knows GEAR is
  where equipped things live, and the relic slot has sat visible-but-sealed
  since M6 precisely so its awakening needs no new teaching. Because the
  panel lives in a **non-gameplay scene**, it fires no `ui_overlay` signals
  and holds any boss gate purely by the scene test — the Forge panel's exact
  contract, reused (§6).
- **Pets are a full `SceneManager` scene entered by tapping the companion.**
  Three reasons, in order of force. *(1) M6's promise.* M6 argued the
  GEAR|UPGRADES split is right *because* it "changes the layout exactly once
  at the milestone boundary and never moves again… no future milestone adds
  a third button." Adding a PETS button (or a bottom nav bar) would break
  that promise, reflow the UPGRADES target the player taps many times a
  minute, and either show a locked/dead PETS tab pre-unlock or pop one in
  mid-game (the layout instability M6 explicitly rejected). *(2) The
  companion is already there.* Stage 11 makes the pet a sprite that fights
  alongside the player; the diegetic object **is** the affordance — tapping
  your companion to manage it needs no chrome and no label. Before the first
  pet unlocks, there is no companion, so there is nothing to clutter. *(3)
  The gate deferral is free.* A full scene slots into the M5/M6 machinery
  with zero new signals — `CombatManager` already holds a boss entry while
  the gameplay scene isn't current (the main-menu and Gear-scene case).
  Cost accepted: ~0.25s fade each way at a minutes-scale cadence.
- **Rejected alternatives.** *A bottom nav bar* (UPGRADES|GEAR|PETS): steals
  permanent vertical space from the primary tap-the-enemy action, reflows
  UPGRADES, and forces a pre-unlock locked tab — three strikes against M6's
  stated principles. *A third bottom-row button*: same halved-target and
  muscle-memory objections M5 raised against splitting, now with no
  offsetting need since the companion carries the entry. *Pets folded into
  the Gear screen like relics*: pets are not gear-adjacent (no slot, no
  compare, a live growing sprite) and the roster + showcase + XP bar want
  the full 1920 — the same space argument M6 used to make Gear a scene
  rather than a panel.
- **Tap-collision safeguard.** The companion `Button` (STOP) occupies a
  deliberately off-center, modest region (low-left, ~200×200) so it never
  overlaps the enemy's central strike zone; a tap on the companion consumes
  the event (opens Pets), a tap anywhere else in the CombatArea attacks.
  Exact placement is handed to the visual pass with this constraint fixed.

- **One active pet, defended.** The brief asked UX to recommend; this spec
  recommends **one active pet whose single bonus applies**, mirroring the
  fixed one-active-relic rule. Three reasons: *(1) the choice stays
  meaningful* — the whole reason "only one relic active" makes the choice
  matter applies identically to pets; multiple simultaneous bonuses would
  dissolve that. *(2) the getter layering stays clean* — PlayerStats reads
  `PetManager.get_active_bonus_*()` for exactly one pet, the same shape as
  the relic and equipment reads; an N-pet team would need a team-aggregate
  and its own balancing pass. *(3) the fiction stays singular* — one
  companion fights alongside you on screen; a squad is a different visual
  and a different feature. A "pet team" is named future scope (§8), not M7.

- **"Next hit is bigger" is structural for relics and pets too.** Every
  stat-shaped relic and pet bonus is summed inside the PlayerStats getters
  that `roll_tap_damage()` reads per attack (§4-last). An attune or a
  set-active applies to the literal next roll with no choreography — the
  same architectural guarantee M6 leaned on.

### 4B. Relics read as *not gear* — the distinct-from-equipment signal

Stage 10's core need is that a relic instantly reads as a different kind of
thing. The design carries that difference in **five deliberate absences and
one presence**, none of them a tutorial:

- **No pips, no rarity tier.** Gear's whole rarity vocabulary (pip count =
  affix count) is absent; a relic is unique, so there is nothing to count.
- **No affix list, no compare table.** A relic has one coded effect, shown
  as **one plain sentence** ("Offline rewards are tripled."), never a stat
  grid.
- **No salvage, no forge.** The relic Inspector Card offers ATTUNE/DETACH
  only; relics never enter the scraps economy (a relic is not fungible).
- **One active, free swap.** The relic tile holds exactly one; attuning
  auto-detaches. The card's caption states the rule once.
- **A bigger drop ceremony.** Relics never use the compact Loot Toast that
  gear drops get — they always earn the full Result Banner (§4D), signalling
  "this is rarer and larger than any gear."
- **The one presence:** a named identity (a title + a sigil + a flavor
  line), so a relic feels like an artifact, not a stat stick.

**Awaken trigger — first world unlock (Frozen Ruins, World 2), per the
DESIGN OVERRIDE in §1.** Defended against the two alternatives the brief
named:

- *vs a fixed enemy level*: the world unlock is already a celebrated "new
  chapter" beat with a modal in front of the player; awakening the slot
  there gives the moment a visible cause, where a silent flip at a bare
  level would be a state change nobody witnesses. It is equally
  deterministic (every player awakens at the same point — their first
  world-boss victory) and it rides an event that already exists in code.
- *vs first relic drop*: awakening on the first *drop* couples two things
  that are better decoupled. If awaken waited for a drop, a rare drop could
  leave the slot sealed for a long, confusing stretch, and the drop's
  Result Banner would have to also teach the whole system. Instead: **awaken
  at the unlock (slot ready, empty, explained), first relic arrives as a
  drop soon after** — the slot is prepared before the player has anything to
  put in it, which is exactly how the M6 empty-slot teaching works.

The relic slot therefore awakens **empty**; the first relic is a rare drop
from Frozen Ruins bosses / world-bosses onward (a distinct drop KIND,
§4-last). (The Astral Temple reclaims this as its themed source when
Worlds 3–4 ship; until then the frozen deep is the real, reachable
source the copy names.)

### 4C. The Relic Collection and attune flow

- The panel reuses the Slide-Up + Data-Driven Content Rows + Inspector Card
  patterns wholesale; the only new copy is the empty state and the
  once-shown attune-rule caption.
- **Attune is instant, free, reversible.** `RelicManager.attune(id)` swaps
  the active relic (auto-detach the incumbent) and emits
  `active_relic_changed(id)`; the tile and ACTIVE card re-render on the
  signal. DETACH exists for agency and for the situational-effect case
  (e.g., detach Eclipse Heart during an active-play session where offline
  bonus is moot — though there is no penalty to leaving it on).
- **Seen/unseen** mirrors M6: RelicManager tracks an unseen flag per owned
  relic; opening the Relic Collection marks all seen (clears the relic's
  contribution to the GEAR pill and the tile's NEW badge), snapshotting at
  open so per-row NEW pills persist for the visit.

### 4D. Drop and unlock moments — the volume ladder

State always lands before any presentation (grant-then-present; a crash
never loses a relic or a pet). Announcement volume is proportional to rarity:

- **Pet level-up** (frequent) → a **Loot Toast**-family transient
  (`"Ember reached Lv. 7"`), input-transparent, ~1.1s, self-freeing, plus a
  companion scale-pop. No haptic. If several levels land at once (a big
  offline return, §6), the toast collapses to the highest ("Ember reached
  Lv. 9") — the Loot Toast collapse rule reused, never a queue.
- **Pet evolution** (rare) → a **Transient Result Banner**, win variant, on
  the existing depth-1 banner queue: `"EMBER EVOLVED — now BLAZE · Essence
  gain +11%"`, plus the visible sprite transform on the companion and the
  Pets screen. 35ms haptic. **Not a blocking modal** — it fires from a kill
  mid-combat, and M5/M6 doctrine reserves blocking modals for offline
  rewards and world unlocks; freezing the kill loop for a pet would violate
  Stage 11's "never a chore." The transformation is the payoff; the banner
  names it (§4E defends banner-over-modal in full).
- **Relic drop** (rare) → always the **Result Banner**, win variant:
  `"RELIC RECOVERED · <name> — <effect>."` 50ms haptic. Rides the banner
  queue, so if it drops from a boss it sequences *after* the BOSS FELLED
  banner (never stacks).
- **New-pet drop** (rare) → **Result Banner** `"NEW COMPANION — <name>
  joins the hunt."` 35ms haptic. Enters the roster with a NEW badge.
- **First pet** (once) → **granted** at the Astral Temple unlock, announced
  as a **line inside the existing World Unlock modal** (the celebration
  container already on screen — the M6 world-boss-drop idiom), plus the
  companion appears in gameplay with a one-time "tap it to see it grow" hint
  toast. No new modal.
- **Relic slot awaken** (once) → a **line inside the same World Unlock
  modal**, plus the one-time "seal breaks" shimmer on the tile at first
  Gear-screen view.
- **Durable breadcrumbs:** a relic drop increments the **GEAR pill** (relics
  live in the Gear screen; the pill already means "unseen things in Gear");
  a new pet lights a **NEW badge on the companion sprite** until the Pets
  screen is opened (there is no pet nav button to carry a pill — the
  companion carries it). Missed announcements are **never queued** (M6 rule):
  the pill and the badges are the record.
- **World-boss drops under the World Unlock modal** (relic or pet) fold into
  the modal as content lines exactly as M6 folds a gear drop — the modal's
  scrim would bury a banner, so the celebration container absorbs the spoils.

### 4E. Evolution as a Result Banner, not a blocking modal

The brief flagged this choice explicitly. **Recommendation: Result Banner
(win variant), non-blocking.** Reasoning:

- It fires from a kill *mid-combat*. A blocking modal here freezes the loop
  the player is actively driving — the opposite of Stage 11's "light,
  rewarding, never a chore."
- The **visible transformation is the real payoff**, and it is visible
  regardless of the announcement: the companion sprite changes form in
  place, and the Pets screen shows the new form and name. The banner is the
  celebratory caption, not the mechanism.
- M6 established the discipline "this milestone adds no new blocking modal";
  M7 keeps it, so the M5 blocking-modal presentation queue (offline →
  world-unlock) is inherited **unchanged**, not extended.

**Escalation valve (flagged, §8):** if playtests show players missing their
first-ever evolution, the *first* evolution only can escalate to a blocking
Centered Modal Dialog, save-gated exactly like M6's first-drop banner — a
one-time teaching moment, not a recurring interruption. Default ships as the
banner.

### 4F. Pet growth — XP source, level, evolution

- **XP source — recommended: kills (active) + estimated kills (offline).**
  PetManager hears `enemy_died` and grants the active pet XP per kill
  (curve owned by the sim). This ties growth to the core loop — the pet
  literally grows *as you fight*, Stage 11's promise — with zero new player
  action. Only the **active** pet gains XP (consistent with one-active).
- **Offline XP — recommended: yes.** A companion that stops growing the
  moment you close the app would feel dead, and the "meaningful reward every
  return" pillar wants the pet to have grown while away. PetManager grants
  offline XP from the **same estimated-kills figure** IdleManager already
  derives for offline essence (offline seconds ÷ seconds-per-kill), handed
  over via one EventBus signal at resume (§4-last) — no second simulation,
  no new honesty story. If the pet **leveled or evolved** while away, a
  compact line joins the offline modal ("Ember grew to Lv. 9" /
  "Ember evolved into Blaze"); if nothing changed, the modal stays
  essence-only (Stage 5's "one clear number, not a wall of stats" preserved).
- **Level & evolution.** Level rises with XP; the passive bonus scales with
  level on the pet's curve. Evolution stages are data (`PetDefinition`,
  §4-last): at each threshold the pet's **form (sprite), name, and bonus
  curve** all change — a discrete, celebrated step above the smooth
  per-level bonus creep. The top stage is the "MAX FORM" cap (level keeps
  rising, bonus keeps scaling, no further transform).

### 4G. Relic effect routing — getters vs explicit hooks

The named M7 relics split cleanly into two routing classes. This is the
load-bearing engineering decision the brief asked for.

- **Route through a PlayerStats getter (no CombatManager/IdleManager code
  change):**
  - **Hunter's Sigil** (boss damage +50%) → `get_boss_damage_multiplier()`
    already sums a boss stat and is *already* applied in
    `CombatManager._apply_damage` while `state == BOSS_FIGHT`. The relic adds
    to that sum; **CombatManager needs no new hook.**
  - **Shatterstone** (crits deal +100% crit damage) →
    `get_crit_multiplier()`.
  - **Essence Prism** (essence gain ×2) → `get_essence_gain_multiplier()`.
  - **Eclipse Heart** (offline rewards ×3) → `get_offline_multiplier()`,
    which `IdleManager._check_offline_rewards()` already reads at resume.
    The relic multiplies it (`BASE 0.5 × 3 = 1.5`), so offline pay genuinely
    triples — no IdleManager code change; see §6 for the "active at return"
    semantics.
- **Require an explicit hook (the effect is not a PlayerStats value):**
  - **Twin Fang** (auto-attack fires twice as fast) → the auto-attack
    *cadence* lives in `IdleManager` as `AUTO_ATTACK_INTERVAL = 1.0` on the
    `_attack_timer`. It is not a stat, so it cannot flow through a getter.
    **The one new hook:** IdleManager reads
    `RelicManager.get_attack_speed_mult()` and sets
    `_attack_timer.wait_time = AUTO_ATTACK_INTERVAL / mult` (0.5s with Twin
    Fang), recomputing on `active_relic_changed`. A running Timer applies the
    new interval on its next cycle, so the doubled rate begins at the next
    tick — clean, no re-plumbing of the tick handler.

**Pet bonuses** are all stat-shaped this milestone (essence/tap/crit/etc.),
so they route exclusively through the PlayerStats getters — **no pet needs a
combat or idle hook.** (A future attack-speed *pet* would reuse Twin Fang's
IdleManager hook; kept out of M7 to hold the rule "pets flow through
getters," §8.)

### 4-last. System Ownership

Per `docs/ARCHITECTURE.md`: UI owns nothing; every new piece of state has a
named manager owner. M7 adds two autoloads, both **between EquipmentManager
and PlayerStats** in the load order (PlayerStats must call *downward* into
them, exactly as it already calls UpgradeManager and EquipmentManager):

```
… UpgradeManager · EquipmentManager · RelicManager · PetManager ·
  PlayerStats · SceneManager · WorldManager · CombatManager · IdleManager
```

- **New `RelicManager` autoload.** Owns:
  - the **owned** relics (Array of relic id StringNames) and the **active**
    relic id, plus the **awaken** flag, in its own `"relics"` save section;
  - **relic definitions** loaded from `RelicDefinition` `.tres` (§ below);
  - **drop rolls**: connects to `boss_fight_won(level, …, is_world_boss)`
    (and, if the sim wants normal-kill relic drops, `enemy_died`) and rolls
    the rare relic drop against a data-driven table — a relic the player
    already owns is re-rolled or converted per the sim's dupe rule (§8);
  - **awaken**: connects to `world_unlocked(world)` and awakens on the
    first world unlock (Frozen Ruins, world index 1 — per §1 override);
    exposes `is_awakened()`;
  - **effect queries** the layers above call: stat-shaped effects via
    `get_effect_additive(stat)` / `get_effect_multiplier(stat)` (the
    EquipmentManager query shape), plus the two specific readouts
    `get_offline_multiplier()` (Eclipse Heart) and `get_attack_speed_mult()`
    (Twin Fang) for the non-stat effects. Internally a `match` on the active
    relic's `effect_id` routes each relic to its class;
  - **seen/unseen** flags and `mark_all_seen()`;
  - emits `relic_dropped(id)`, `active_relic_changed(id)`, `relics_awakened`.
  It calls nothing upward; it never touches CombatManager or scenes.
- **New `PetManager` autoload.** Owns:
  - the **owned** pets (Array of `{id, xp}`), the **active** pet id, and the
    **unlock** flag, in its own `"pets"` save section (level and evolution
    stage are **derived** from xp + the definition's curve, never stored —
    one source of truth);
  - **pet definitions** from `PetDefinition` `.tres`;
  - **XP grants**: connects to `enemy_died` for live XP; grants offline XP
    from a new `offline_kills_estimated(kills)` signal IdleManager emits at
    resume (see below); detects level and evolution crossings and emits
    `pet_leveled(id, level)` / `pet_evolved(id, stage)`;
  - **first-pet grant** and **new-pet drops**: `grant_starter()` on the
    Astral Temple `world_unlocked`; rare drops on `boss_fight_won`;
  - **bonus queries**: `get_active_bonus_additive(stat)` /
    `get_active_bonus_multiplier(stat)` over the active pet's current-level
    bonus — the getter shape PlayerStats consumes;
  - **active swap**: `set_active(id)`, emits `active_pet_changed(id)`;
  - seen/unseen flags, `mark_all_seen()`; emits `pet_unlocked(id)`.
- **`PlayerStats`** resolves its `TODO(Milestone 7)`: each getter adds the
  relic and pet layers alongside the equipment layer already present —
  e.g. `get_boss_damage_multiplier() = 1.0 + EquipmentManager.get_affix_sum(
  &"boss") + RelicManager.get_effect_additive(&"boss") +
  PetManager.get_active_bonus_additive(&"boss")`; `get_essence_gain_multiplier`
  multiplies in the relic and pet factors; `get_crit_multiplier` adds them;
  `get_offline_multiplier() = BASE_OFFLINE_EFFICIENCY ×
  RelicManager.get_offline_multiplier()`. Crit chance stays clamped at
  `MAX_CRIT_CHANCE`. **No calling code anywhere changes** — the layered
  getter design absorbs both new systems, which is what makes the
  attune/set-active-applies-to-next-hit guarantee true by construction.
- **`CombatManager` gains no new code.** The boss-damage multiplier read it
  added in M6 already carries Hunter's Sigil; all other relic/pet stat
  effects arrive through the getters it already calls per roll. Its existing
  signals are the entire relic/pet drop and XP interface.
- **`IdleManager` gains exactly three touches:** *(a)* the Twin Fang hook —
  `_refresh_attack_interval()` sets `_attack_timer.wait_time` from
  `RelicManager.get_attack_speed_mult()`, called on `_ready`, on
  `active_relic_changed`, and after load. *(b)* **Offline is repriced at the
  same effective interval** — `get_live_essence_rate()` (and the offline
  kills estimate) must divide by the *effective* interval
  `1.0 / get_attack_speed_mult()`, NOT the raw `AUTO_ATTACK_INTERVAL`
  constant, so Twin Fang's doubled kill rate flows into offline essence and
  offline pet XP exactly as it does live. Without this the relic would
  silently double active earning only — the reviewer-flagged desync. One
  small helper, `get_effective_attack_interval()`, is the single source both
  the live timer and the offline math read. *(c)* it emits
  `offline_kills_estimated(kills)` alongside `offline_rewards_ready` at
  resume, so PetManager grants offline XP from the same estimate without
  re-deriving it (a downward-free, signal-only handoff).
- **Definitions are data, per the content-as-data rule.**
  - `RelicDefinition` in `data/relics/`: `id` (StringName, save-stable
    forever), `display_name`, `sigil` (Texture2D), `effect_id` (StringName
    the RelicManager `match` switches on — e.g. `&"boss_pct"`,
    `&"crit_pct"`, `&"essence_mult"`, `&"offline_mult"`, `&"attack_speed"`),
    the effect magnitude/params, `effect_description` (the one canonical
    plain sentence), `flavor`, and drop weight/source. Adding a relic is a
    new `.tres`; only `effect_id` values with no existing routing need a
    line of manager code.
  - `PetDefinition` in `data/pets/`: `id`, an ordered **evolution stages**
    array (each: `name`, `sprite`, `level_threshold`), the **bonus stat**
    (StringName, matching the PlayerStats stat vocabulary), and the **bonus
    curve** (base + per-level params). New pet = new `.tres`.
  - The **relic slot exclusion** is reconciled here: EquipmentManager must
    **never mint or equip affix gear into the relic slot even after
    awaken**. Recommendation: EquipmentManager keeps excluding the relic
    slot from its generation/equip pools *by slot id / kind* (not by the
    `sealed` bool), so "awakening" is purely a RelicManager state that drives
    the tile — the `SlotDefinition.sealed` flip, if kept, governs only the
    tile's locked/awakened *visual*, never gear eligibility. Flagged for
    engineering (§8).
- **EventBus additions (Milestone 7 section):**
  `relic_dropped(id: StringName)`, `active_relic_changed(id: StringName)`,
  `relics_awakened`, `pet_unlocked(id: StringName)`,
  `pet_leveled(id: StringName, level: int)`,
  `pet_evolved(id: StringName, stage: int)`,
  `active_pet_changed(id: StringName)`,
  `offline_kills_estimated(kills: int)`.
- **Save sections** (loose contract; engineering owns exact keys):

  ```json
  "relics": { "awakened": true, "active": "eclipse_heart",
              "owned": [ { "id": "eclipse_heart", "seen": true },
                         { "id": "twin_fang",     "seen": false } ] },
  "pets":   { "unlocked": true, "active": "ember",
              "owned": [ { "id": "ember",     "xp": 1440.0, "seen": true },
                         { "id": "frostling", "xp": 120.0,  "seen": false } ] }
  ```

  Level and evolution stage are recomputed from `xp` + the definition on
  load (never stored). Absent sections = not-yet-awakened / not-yet-unlocked
  (the M6 absent-defaults idiom); pre-M7 saves migrate silently.
- **UI owns nothing:** the relic tile, Relic Collection panel, relic/pet
  Inspector Cards, the Pets scene, the companion sprite, the growth
  transients, and the XP bar render manager state and EventBus signals and
  report exactly these actions: `attune(id)`, `detach()`, `mark_all_seen()`
  (relics); `set_active(id)`, `mark_all_seen()` (pets).

---

## 5. Accessibility Notes

Mapped against the committed **Enhanced** tier in
`design/accessibility-requirements.md`, all three recurring Phase-4 lessons
applied.

- **Touch targets (every interactive element ≥ 96×96):** relic tile 236×250
  (M6 size); Relic Collection rows 1000×140, panel CLOSE 180×96; relic card
  ATTUNE/DETACH 920×110, CLOSE 920×96; the **companion** entry 200×200; Pets
  BACK 200×96, roster rows 1000×140; pet card SET ACTIVE 920×110, CLOSE
  920×96. Every one clears the floor. Deliberately non-interactive and
  exempt (stated to pre-empt the review question): the XP bar, the ACTIVE /
  NEW pills, relic sigils and pet sprites, all effect/bonus/flavor captions,
  and every growth transient.
- **Explicit `mouse_filter` audit (Phase-4 lesson #1):** STOP — the relic
  tile, Relic Collection rows, both Inspector Cards' Scrim and Card, the
  companion Button, all Pets roster rows and buttons. IGNORE (explicit,
  since containers do not default to it) — every label/sigil/sprite inside
  tiles, rows, cards, and the showcase; the XP bar and its numerals; the
  ACTIVE/NEW pills and the companion's `Lv. N`/NEW badge; the entire
  level-up transient tree (load-bearing: it floats over the combat area and
  a mid-tap player must never lose an attack to a pet level-up).
- **Color-independent state, verified per state:** *active relic/pet* =
  "● ACTIVE"/"● ATTUNED" **word + dot glyph** + a border treatment, never
  color alone; *evolution stage* = "Stage 2 of 3" **in words** + the sprite
  form change + the name change; *XP progress* = the `cur / next` **numerals**
  beside the bar fill, never fill alone; *NEW* = a word pill; *relic vs gear*
  = the entire absence of pips plus the named effect sentence. Every state
  survives full desaturation. The art director's relic-sigil and pet-form
  palettes are celebratory dressing, constrained (as in M6) to stay out of
  the ember boss-threat scope.
- **Readable numbers:** XP figures via `NumberFormat` with **Hold-to-Reveal**
  on the XP bar figure (the pattern's next retrofit consumer); relic effects
  print their canonical sentence (no raw magnitudes to abbreviate); pet
  bonus percents follow the `UpgradeDefinition.format_effect()` one-decimal
  precedent.
- **Motion reduction:** every new animation is one-shot and short — the
  "seal breaks" shimmer ≤0.5s, tile/companion pops 0.24s, level-up toast
  ~1.1s self-freeing, evolution transform ≤0.6s, relic/pet banners on the
  existing ≤2.2s queue. The only loop is the companion's idle hover and the
  showcase sprite hover, both <1.5s and non-essential to comprehension
  (kept within the standing pre-"Reduce Motion" rule). Nothing gates input
  beyond its stated duration; Inspector Card buttons are live from frame one.
- **Interruptible modals:** both Inspector Cards carry the pattern's single
  always-visible CLOSE (live from frame one) plus scrim-tap, no timeout. The
  Relic Collection panel has the pattern-standard CLOSE. Growth transients
  and badges require no acknowledgment ever.
- **Sound:** still Milestone 14+; every cue here (level-up, evolution, relic
  drop, attune) is visual-first with haptics only where a buzz marks a
  reward — future audio is additive, never load-bearing.

---

## 6. Edge Cases

- **Boss gate reached while the Gear or Pets screen is open.** Both are
  handled by the existing scene test in `CombatManager` — a full scene (Pets)
  and the in-scene Relic Collection panel (which, like the Forge panel,
  fires no `ui_overlay` signals) both leave the gameplay scene non-current,
  so a gate held mid-visit stays held (empty combat area, no countdown)
  until the player returns. No new deferral machinery. Consequence, stated
  honestly: while held, no enemy exists, so auto-attack earns nothing and
  the pet gains no XP until return — seconds of idle at a minutes-cadence
  visit, and the alternative (a countdown ticking on an unseen screen) is
  forbidden by M5's own rule.
- **Relic tile / relic panel / Pets screen tapped during an active boss
  fight.** GEAR and the companion both require leaving the gameplay scene,
  so this follows the M6 MENU rule verbatim: the attempt voids silently
  (no fail banner), and the gate auto-enters fresh on return — now with the
  newly attuned relic or newly active pet in effect. A mid-fight regear
  amounts to "restart the fight stronger," which is player-favorable.
- **Swapping active relic/pet mid-boss — stat timing.** Because the swap can
  only happen off the gameplay scene (which voids the attempt), the fresh
  re-entry reads the new relic/pet through the per-roll getters from its
  first hit — no stale-stat edge exists (there is no cached stat). Twin Fang
  attuned between attempts: IdleManager's timer already recomputed on
  `active_relic_changed`, so the retry auto-attacks at the doubled rate.
- **Relic / pet drop during a boss fight or behind a modal.** State lands in
  the owned collection regardless (grant-then-present). The Result Banner
  spawns only when the gameplay scene is current and no layer-60 overlay is
  up; if it drops from a boss, it sequences after the BOSS FELLED banner on
  the shared depth-1 queue. If it drops from a **world boss** under the World
  Unlock modal's scrim, it folds into the modal as a content line (M6 rule).
  Missed announcements are **not** queued — the GEAR pill (relics) and the
  companion NEW badge (pets) are the durable record.
- **Relic / pet drop while off the gameplay scene** (on the Gear or Pets
  screen). No banner; the arriving relic/pet appends to its list live with a
  pop — the list is the toast there, exactly the M6 in-scene-drop behavior.
- **Eclipse Heart ×3 interacting with the IdleManager offline multiplier.**
  `get_offline_multiplier()` returns `BASE_OFFLINE_EFFICIENCY (0.5) ×
  RelicManager.get_offline_multiplier() (3.0) = 1.5`; IdleManager reads it
  unchanged at resume, so offline essence genuinely triples. The multiplier
  reflects the relic **active at the moment of return**, not during the away
  window — the same honest model M6 uses for gear affecting offline pay
  (offline is a rate estimate priced at current stats, never a simulation).
  If the relic is detached before returning, the bonus simply is not applied
  — no copy change needed; the offline modal's single number stays true.
- **Twin Fang vs the fixed 1.0s auto-attack tick — live AND offline.**
  Handled by the IdleManager hook (§4G): `wait_time = 1.0 /
  attack_speed_mult` → 0.5s while attuned, landing on the timer's next
  cycle; detaching restores 1.0s the same way. Critically, the SAME
  effective interval drives `get_live_essence_rate()` and the offline kills
  estimate (§4G touch *b*), so offline essence and offline pet XP double
  right alongside live earning — the relic never silently applies to only
  half the game. A stacked future attack-speed pet multiplies into the same
  `attack_speed_mult` product (out of M7 scope).
- **Pet XP offline.** Granted from IdleManager's estimated-kills figure via
  the `offline_kills_estimated` signal (§4F); if the pet leveled/evolved
  while away, one line joins the offline modal, else the modal stays
  essence-only. If the away period was capped (the M4 offline cap), pet XP is
  computed from the same capped kill estimate — the two stay consistent by
  construction (they share the estimate). Flagged for GD (§8).
- **App killed mid-attune, mid-set-active, or mid-drop.** Every manager
  mutation is save-committed before any ceremony animates (grant-then-present
  with an immediate `SaveManager.save_game()`), so a kill during a banner or
  an evolution transform loses only the ceremony — the relic/pet is owned
  (NEW-tagged) on relaunch, and ceremonies never replay on load (the
  project-wide rule since M4). Pet level/stage recompute from stored `xp`, so
  a mid-level-up kill cannot desync the derived level.
- **Relic slot before awaken / relic generation safety.** Before the Astral
  Temple unlock the relic tile keeps its M6 sealed card; the relic system is
  inert. EquipmentManager never mints or equips affix gear into the relic
  slot even after awaken (excluded by slot id/kind, §4-last), so no code path
  can ever put an affix item where a relic belongs.
- **Pre-M7 saves.** No `"relics"`/`"pets"` sections → not awakened, no pets
  (absent-defaults idiom, no migration step). A player already past the
  Astral Temple unlock on load has the slot awakened and the starter pet
  granted at that load (the M4 welcome-gift idiom — the update announces
  itself with its own mechanic), never retroactively back-filled with drops.
- **A pet dropped that the player already owns / a relic dupe.** Deferred to
  the sim's dupe rule (§8) — the recommended default is that relic/pet drop
  tables exclude already-owned entries until the pool is exhausted, then stop
  dropping (no dupes, no scrap-conversion economy this milestone).

---

## 7. New Patterns Proposed

### 7.1 Diegetic Companion Entry (in-world object as navigation)

**Used in:** the active pet, which stands in the gameplay combat area and,
when tapped, opens the Pets screen. Expected future reuse: any persistent
in-world game object that is also the entrance to its own management surface
(a summoned turret, a base structure, a mount).
**Behavior:** a `Button` (STOP) whose bounds sit **off the primary action's
hot zone** (here, clear of the enemy's central strike region) so a tap on
the object opens its screen while a tap anywhere else performs the primary
action. The object carries at most a compact status glyph and a NEW badge
(both IGNORE, word-or-icon, never color-only). It exists only after its
feature unlocks, so it adds **zero** persistent navigation chrome — the
object's presence *is* the affordance. Distinct from a nav Button (which is
UI chrome with a permanent slot) and from the Tap-to-Attack CombatArea
(which is the primary action's target, not a navigation entry).
**Implementation:** proposed as a `Button` node in `gameplay.tscn`'s world
region bound to `SceneManager.change_scene(SCENE_PETS)`, shown/hidden on
`pet_unlocked` and driven by `active_pet_changed`.

*(Considered and NOT proposed as patterns: the **relic Inspector Card** and
**pet Inspector Card** — variants of the existing Inspector Card with a
different action set (ATTUNE/DETACH, SET ACTIVE) and no compare table, not a
new contract; the **XP / growth bar** — a filling variant of the existing
health/timer bar visual family with Hold-to-Reveal, no new interaction; the
**evolution reveal** — a composition of the Result Banner and a sprite
sprite-swap transform, no independent contract; the **relic effect sentence**
— load-bearing copy vocabulary handed to the writer, not an interaction. All
four reuse existing patterns and are called out here so the review does not
mistake them for un-catalogued invention.)*

---

## 8. Open Questions for the Game Designer / Team

- **The tuning set** (parallel sim, as in M6): relic drop rate and per-source
  weights; the M7 relic list (the five named — Eclipse Heart, Hunter's Sigil,
  Twin Fang, Shatterstone, Essence Prism — plus any others) and each one's
  magnitude; pet XP-per-kill curve; evolution level thresholds; pet passive
  bonus base + per-level curve; new-pet drop rate. Every surface here is
  parameterized and renders whatever the sim locks. One UX-side request:
  keep the first relic reachable "deep enough in but not punishingly rare,"
  so Stage 10 actually lands.
- **World-content dependency — RESOLVED by the §1 DESIGN OVERRIDE.** The
  awaken and first-pet triggers key off the **first world unlock (Frozen
  Ruins, World 2)**, which ships as data today and fires the real
  `world_unlocked` event — so the triggers have a world to fire on now. When
  Molten Core (W3) and the Astral Temple (W4) ship, the Astral Temple
  reclaims the relic theme; no M7 change needed then. No blocking dependency
  remains.
- **First-pet trigger** — a **guaranteed grant at the first world unlock
  (Frozen Ruins)**, on the same `world_unlocked` event as the relic awaken,
  so both land in the one celebrated moment.
- **Evolution ceremony** — this spec ships evolution as a **non-blocking
  Result Banner**, with an optional save-gated first-evolution escalation to
  a blocking modal (§4E). Confirm the default and whether to build the valve.
- **Offline pet XP** — this spec **grants it** from IdleManager's estimated
  kills, with a conditional line in the offline modal (§4F). Confirm, or
  scope pets to active-play XP only.
- **Pet as passive-only vs a real combat participant** — this spec makes the
  pet a **passive stat bonus with a decorative fighting sprite** (simplest,
  honest for M7). Confirm, or scope pets that deal independent damage
  (a larger combat + balancing change, likely its own milestone).
- **Relic/pet dupe rule** — recommended default: drop tables exclude
  already-owned entries, then stop (no dupes, no conversion economy).
  Confirm.
- **The "flip sealed" reconciliation** (engineering) — keep EquipmentManager
  excluding the relic slot from affix generation/equip **by slot id/kind**
  permanently, so awakening is a RelicManager state and the `SlotDefinition.
  sealed` bool (if flipped) governs only the tile's visual, never gear
  eligibility (§4-last). Confirm the approach so no affix item can ever mint
  for the relic slot.
- **GEAR pill scope** — this spec has relic drops increment the existing GEAR
  pill (relics live in the Gear screen) and pet drops light a NEW badge on
  the companion (no pet nav button exists). Confirm the shared pill reads
  cleanly, or split relic-unseen onto the relic tile alone.
- **Relic naming / effect copy** (writer) — each relic ships one canonical
  plain-language `effect_description` (no derived math) plus a flavor line;
  "Boss Damage", "Auto-Attack", etc. must stay literal enough to read cold.
- **Hold-to-Reveal on the HUD essence counter** — still the only abbreviated
  figure without it, carried forward from M4/M5/M6 §8, unchanged.
- **For engineering, not design:** (a) autoload table gains RelicManager and
  PetManager between EquipmentManager and PlayerStats — re-verify the
  IdleManager connect-order comment survives (IdleManager stays last);
  (b) `SCENE_PETS` constant + `scenes/pets/pets.tscn` per the architecture's
  new-screen checklist; (c) the Relic Collection panel reuses the Forge
  panel's offsets — extract shared slide-up constants or accept the
  duplication consciously; (d) IdleManager's `_refresh_attack_interval()` and
  `offline_kills_estimated` emission are the only two new touches in an
  otherwise unchanged combat/idle path.
