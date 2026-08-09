# Milestone 7 Visual Design — Relics & Pets

Author: art-director. Gives visual treatment to the approved
`design/ux/milestone-7-relics-pets.md` (note its §1 DESIGN OVERRIDE: the
relic slot awakens and the starter pet is granted at the **first world
unlock — Frozen Ruins, World 2**, not the Astral Temple). Method identical
to the M5/M6 visual specs — ramp-mirroring for new color families, computed
WCAG contrast, direct transcription of `main_theme.tres` vocabulary
(StyleBoxFlat params, `Color()`, `theme_type_variation` names), and an
"explicitly NOT needed" list. Reference canvas 1080×1920.

> **Honesty correction carried in.** The M5/M6 docs cite violet-light
> `Color(0.655, 0.545, 0.98)` at "10.6:1 on the card." That color's
> luminance (L=0.336) caps at **7.72:1 on pure black**, so 10.6 is
> unreachable and every ratio in this doc is recomputed from first
> principles. Where I want a bright violet reward tint at >10:1 I use the
> essence-lavender `Color(0.769, 0.71, 0.992)` (L=0.519 → 10.3:1 on card,
> the M4-measured value), not violet-light.

---

## 1. Relic Visual Identity + Treatments

### 1.1 The identity decision — ONE prestige tier, unique sigils, shared gold frame

Relics must read at a glance as **a different kind of thing than the
5-rarity gear system** (Stage 10's core need, UX §4B). The decision:

**Relics are a single prestige tier — not five.** There is exactly one
relic treatment: a **radiant gold-white aureole** ("mythic-beyond-mythic"),
above and apart from the rarity ladder. Every relic wears the same exalted
frame and the same gold. What distinguishes one relic from another is
**unique per-relic sigil art** inside that shared frame — never a tier
color, never a pip count.

This is deliberately the inverse of gear's signal grammar:

| axis | Gear (M6) | Relic (M7) |
|---|---|---|
| tier signal | 5 colors + affix pips + rarity word | **none** — all relics are one tier |
| identity signal | slot icon (7 shared) + rarity | **unique sigil per relic** |
| accent | per-item rarity color | **one gold-white for all relics** |
| framing | rarity-tinted border | **shared radiant gold frame + halo** |

So a relic reads as *a named artifact from a set of five*, where gear reads
as *a graded instance of a slot*. The uniform gold across every relic is
itself the message: "these are all the same exalted class, and that class
is higher than Mythic." A player never has to learn a new color code — the
absence of the rarity vocabulary plus the gold-white radiance does the work
(reinforcing UX §4B's "five deliberate absences and one presence").

Why single-tier over per-relic tier colors: the collection is tiny (five)
and every relic is unique and permanent, so there is nothing to *grade* —
a second color axis would imply a hierarchy the design explicitly rejects
("only one active, the choice matters" is horizontal, not vertical). One
gold tier keeps the fiction singular and the accent budget clean.

### 1.2 The relic (Aureate) color family — ramp-mirrored, de-collided

Stop-for-stop mirror of the violet/teal/ember/ice ramps, rotated to a warm
gold-white (~43°) and pushed to very high lightness so it reads as a
luminous aureole, not a saturated amber.

| name | hex | `Color()` | used for |
|---|---|---|---|
| `relic-veil` | `#FFF6E0` | `Color(1.0, 0.965, 0.878, 1)` | sigil top-facet highlight, aura core, relic-name-on-dark option |
| `relic-light` | `#FBE7A8` | `Color(0.984, 0.906, 0.659, 1)` | **relic name text**, frame inner rim, sigil cross-facet |
| `relic-glow` | `#F5C451` | `Color(0.961, 0.769, 0.318, 1)` | aureole glow disc, frame outer ring, **attuned halo/border** |
| `relic-deep` | `#C79433` | `Color(0.78, 0.58, 0.2, 1)` | frame border, sigil mid facet, awakened-empty border |
| `relic-abyss` | `#7A5A1E` | `Color(0.478, 0.353, 0.118, 1)` | sigil darkest facet, relic-name outline |

**Scope rule (as strict as ember's):** the Aureate family means exactly one
thing — *this is a relic*. It appears only on relic surfaces (the relic
tile, the Relic Collection panel, the relic Inspector Card, the relic-drop
banner's name + sigil). Never on a button, never on gear, never on a pet,
never as chrome.

**De-collision (verified, method per M6 §1):**
- *relic-light name `#FBE7A8` (L=0.805) vs Legendary gold `#FBBF24`
  (L≈0.60):* the real collision risk, both ~43°. Resolved three ways, all
  active at once: (a) relic-light is a **pale cream** — markedly lighter and
  far less saturated than Legendary's amber, so it reads "radiant/exalted,"
  not "legendary"; (b) the two **never co-occur** — Legendary is item-name
  text inside the gear rarity inventory; relic names live only on relic
  surfaces, a different scene region entirely (exactly how M6 de-collided
  Epic-violet from UI-violet by role + never-adjacent context); (c) a relic
  name is always accompanied by its **unique sigil and the word "Relic,"**
  neither of which any gear item has.
- *relic-glow `#F5C451` vs crit-gold `#FFCC40`:* crit-glow is a **transient
  floating combat number**; relic-glow is a **persistent frame/halo**.
  Different role, never on screen in the same job (the exact ember-vs-crit
  separation M5 accepted).
- *relic gold vs UI/reward violet, auto-attack teal, boss ember, ice-blue,
  Rare-cyan/Epic-violet/Mythic-rose:* all a full hue-family away; no
  possible confusion.

**CVD:** gold-white sits at very high lightness (L 0.48–1.0 across the
ramp), so under any deficiency it separates from every mid-lightness accent
on the lightness axis. And relic identity is **never color-only** (§4): the
uniform frame, the sigil, the word "Relic," and the effect sentence all
carry it desaturated.

### 1.3 The awakened relic tile (Gear screen, 236×250 — three states)

Keeps its M6 grid cell and size; only its **state source** changes (reads
`RelicManager`, UX §3A). Base is the M6 `SlotTile` `Button`; the relic
variant swaps the styleboxes below. Every child label/sigil
`mouse_filter = IGNORE` (explicit); the tile itself is STOP by nature.

Relics sit in a **warm-tinted socket** — the one warm bg in an otherwise
cool-violet gear grid — so the relic cell is legible as "special" before a
word is read.

```
AWAKENED-EMPTY  (StyleBoxFlat)
  bg_color        Color(0.09, 0.075, 0.055, 0.85)   # warm dark socket
  border_width_*  2
  border_color    Color(0.78, 0.58, 0.2, 0.55)      # relic-deep, quiet gold
  corner_radius_* 16
  (no shadow — an awakened but empty vault)
  contents: slot_relic.svg 96×96 @ modulate Color(1,1,1,0.30) (faint sigil),
            "Empty" 24px muted, "Tap to attune" 20px muted-lavender

ATTUNED  (StyleBoxFlat)
  bg_color        Color(0.11, 0.09, 0.06, 0.92)      # warm dark, richer
  border_width_*  3
  border_color    Color(0.961, 0.769, 0.318, 1)      # relic-glow, full
  corner_radius_* 16
  shadow_color    Color(0.961, 0.769, 0.318, 0.28)   # gold aureole
  shadow_size     12
  contents: <this relic's sigil> 96×96, name relic-light 24px,
            one-line effect 22px muted, "● ACTIVE" word+dot 22px relic-light
```

- **The gold halo (shadow_size 12) intentionally out-glows every gear tile**
  (rarity shadows cap at 8–10, M6 §2A) while staying under PrimaryButton
  hover (22). This is the visual proof that a relic is "more special than
  any Mythic drop" — a deliberate, single, defended addition to the glow
  hierarchy (§5).
- **No pip row ever.** The tile carries the relic name + its one-line
  effect where a gear tile carries pips + a key-stat line.
- **ACTIVE marker** = filled dot glyph `●` (font, not an asset) + the word
  "ACTIVE," never gold alone (Status Badge doctrine).
- **"Seal breaks" shimmer** (UX §3A, first view only, save-gated, ≤0.5s):
  a one-shot radial wipe of `relic-glow @ 0.0→0.35→0.0` sweeping the tile,
  reusing the craft-reveal tween timing — not a new pattern.

### 1.4 Relic Collection panel (Slide-Up inside the Gear scene, UX §3B)

Reuses the Forge panel geometry verbatim (0.28s cubic slide, CLOSE button,
**fires no `ui_overlay` signals** — non-gameplay scene, the Forge contract).

- **Header** "RELICS" — `HeaderLabel` variation, 38px. CLOSE 180×96 default
  `Button`.
- **ACTIVE card** (the pinned attuned relic, 1000×150): a `ModalCard`-dressed
  panel with `border_color = Color(0.961, 0.769, 0.318, 0.7)` (relic-glow) —
  the gold frame marks it as the live relic. Sigil 64×64, name relic-light
  30px, the one effect sentence 25px muted, an "● ATTUNED" word+dot badge.
  Empty state (awakened, none attuned): a muted block — "No relic attuned." /
  "Relics drop from the bosses of the Frozen Ruins and beyond." 25px muted.
- **COLLECTION rows** (Data-Driven Content Rows, 1000×140, separation 14,
  vertical scroll): the M6 `InventoryRow` `PanelContainer` **with one
  change** — the 6px left accent bar is **`relic-glow` on every row**
  (uniform gold, no rarity variance). Uniform gold is the point: it reads
  "these are all one exalted class," the visual opposite of gear's
  multi-color accent bars.

```
InventoryRow (relic variant), PanelContainer StyleBoxFlat
  bg_color        Color(0.10, 0.078, 0.157, 0.9)   # unchanged M6 row bg
  corner_radius_* 14
  LEFT ACCENT     6px ColorRect Color(0.961, 0.769, 0.318, 1) (relic-glow)
  layout HBox: [gold accent] · sigil 64×64 · VBox{ name relic-light 30px ·
               effect sentence 25px muted } · right-aligned "NEW" word pill
  whole row = Button (STOP); children IGNORE (explicit)
```

- No sort control, no rarity, no pips (UX §3B). Tap a row → relic Inspector
  Card.

### 1.5 Relic Inspector Card (Inspector Card pattern — relic variant, UX §3C)

CanvasLayer 60, the M6 Inspector Card scrim + card dress, **re-accented gold
and stripped of the compare table** (relics are not comparable stat sheets).

```
scrim: Color(0.016, 0.008, 0.031, 0.6)             # M6 browse scrim, scrim-tap closes
card:  ModalCard stylebox, border_color = Color(0.961, 0.769, 0.318, 0.8)  # relic-glow
       ~900×1100
```

- **Header:** relic name 40px Cinzel (`TitleLabel` recipe **tinted to
  relic-light** `Color(0.984, 0.906, 0.659)`, outline_size 6,
  `font_outline_color = Color(0.478, 0.353, 0.118, 0.8)` = relic-abyss —
  the boss-name recipe transposed to gold), "Relic" subtitle 24px muted,
  sigil 80×80 top-right.
- **The one effect sentence** 30px standard label `Color(0.906,0.886,0.973)`
  — canonical copy from `RelicDefinition.effect_description`, no math, no
  affix grid.
- **Flavor line** 24px muted, e.g. *"A heart that beats in the dark between
  sessions."*
- **Rule caption** 24px muted: "Only one relic may be attuned. Swapping is
  free."
- **Actions, content-driven:** unattuned → **ATTUNE** (`PrimaryButton`,
  920×110) + **CLOSE** (default, 920×96). Attuned → **DETACH** (default
  `Button`, never PrimaryButton) + CLOSE. **No SALVAGE — the `DangerButton`
  never appears on a relic card** (relics are unique/permanent; the absent
  verb is itself a Stage-10 signal, UX §4B). Buttons disable while
  processing (double-tap guard).

### 1.6 Relic-drop moment (Result Banner, UX §3F/§4D)

Relics never use the compact Loot Toast — always the full **Result Banner,
win variant** (the M5 `CelebrationToast` win recipe: violet-light border +
violet glow shadow 18), marking a relic as bigger than any gear drop. The
banner is standard-framed, but its payload wears the relic vocabulary:
headline "RELIC RECOVERED" 40px Cinzel (`TitleLabel` violet recipe), the
relic **sigil 56×56** as the icon slot, and the relic **name in relic-light**
inside the body line — "Eclipse Heart — offline rewards tripled." 50ms
haptic (the rarer event; UX §3F). Under a World Unlock modal's scrim, it
folds into the modal as a content line (M6 rule) rather than spawning.

---

## 2. Pet Visual System + Treatments

### 2.1 The pet identity system — ally-violet aura + friendly construction

Pets are rendered as sprites in the **same combat area as enemies** (Stage
11), so the binding visual problem is: a companion must never be mistaken
for a threat. The system solves it with one rule and one construction
grammar:

**Every pet wears an ally-violet aureole.** On enemies, the **aura disc is
the threat signal** — violet-dark for Dark Forest, `ice-glow` for Frozen
Ruins, ember for world bosses. Pets invert this: **the pet aura is always
the player's own reward violet** (`#a78bfa` family, `Color(0.545, 0.361,
0.965)` glow), regardless of the pet's elemental body tint. The aura reads
"this one is mine." Body color is then free to carry elemental flavor
(Ember warm, Frostling cool) without ever colliding with a threat accent —
which also satisfies UX §5's constraint that pet palettes "stay out of the
ember boss-threat scope" (a fire pet named Ember never wears the boss-ember
family; its warmth lives in the body, its aura stays ally-violet).

**Friendly construction grammar** (separates pets from enemies at any hue):

| trait | Enemy sprite | Pet sprite |
|---|---|---|
| aura | threat-colored (ember/ice/violet-dark) | **ally-violet, always** |
| silhouette | tall, angular, hollow | **compact, rounded, bouncy** |
| eyes | glowing **hollow voids** | **bright solid friendly eyes** (ally-violet `#c4b5fd`), highlight dot |
| body value | dark, near-black facets | **brighter, lighter facets** |
| posture | looming | small, low to the ground |

This gives the pet set the same internal cohesion the relic frame gives
relics: all pets share the ally-violet aura + friendly grammar, and differ
only in elemental body + evolution silhouette.

### 2.2 How many pets/evolutions to art for M7 — recommendation

**Art two full lines, base + evolved (4 sprites core). Defer stage-3 caps
and a third pet to a content drop** — the exact M5 `silent_colossus`
precedent (data ships pointing the stage-3 slot at the stage-2 sprite with a
`TODO(content)` until the art lands weeks-out; players reach the cap long
after ship).

| line | stage 1 | stage 2 | stage 3 (cap) | M7 status |
|---|---|---|---|---|
| **Ember** (guaranteed starter, bonus: essence gain) | Ember | Blaze | *(name TBD, e.g. Inferno)* | **art S1+S2 now; S3 deferrable** |
| **Frostling** (first rare drop, bonus: tap damage) | Frostling | Frostwyrm | *(name TBD)* | **art S1+S2 now; S3 deferrable** |
| **Sparkling** (third pet, bonus: crit) | Sparkling | — | — | **fully deferrable content-drop** |

Rationale: Stage 11's grading criterion is that the player **sees a
transformation**. The starter (Ember) is granted to everyone and is the
first evolution anyone reaches, so Ember→Blaze **must** be arted — that
single transform makes Stage 11 land. A second line (Frostling→Frostwyrm)
proves roster variety and a second visible evolution. Four sprites deliver
two complete "grow → evolve → switch" loops; the stage-3 caps sit at high
levels (UX shows "Evolves at Lv. 25") and the third pet is a rare later
drop, so both are honest content-drop deferrals, not cut scope. Minimum
viable if further squeezed = the Ember line's two stages.

### 2.3 Pet body palettes (art only, not scoped accents)

Body tints are flavor art (like M6 rarity is orthogonal to chrome); each is
verified to not read as a threat accent. All share the ally-violet aura +
friendly eyes.

| pet | body gradient | note vs threat accents |
|---|---|---|
| Ember (S1) | coral→amber `#FFC48A`→`#E08A4A` | warmer/**pinker & lighter** than boss-ember `#FB923C`; friendly round body + ally aura ⇒ never a threat |
| Blaze (S2) | brighter coral-gold `#FFD59A`→`#F0954E`, taller flame crest | same warm family intensified |
| Frostling (S1) | **pale** ice `#CBE6FF`→`#6FA8E6` | far **lighter** than enemy ice `#1E3A8A`/`#0C1B45` (frost_shade) ⇒ friendly, not the FR-creature family |
| Frostwyrm (S2) | ice `#9FCBFF`→`#3E7FD6`, serpentine crest | brighter than the ice enemy family; ally aura |

### 2.4 The companion in gameplay (Diegetic Companion Entry, UX §3F/§7.1)

**No new asset — the companion IS the active pet's sprite**, drawn at
200×200 in the combat area (as enemies draw their 512 sprite scaled). A
`Button` (STOP), placed **low-left, clear of the enemy's central strike
zone** (UX §4A tap-collision safeguard): a tap on it opens `SCENE_PETS`, a
tap anywhere else in CombatArea attacks. It carries a compact `Lv. N` label
(22px standard, IGNORE) and a "NEW" word pill (IGNORE) until first opened —
both word/glyph, never color-only. Idle hover <1.5s, motion-reduction-safe.
Attack/hit animation is a decorative scale-pop synced to
`enemy_damaged`/`enemy_died` (the pet is a passive bonus, not a damage
source).

### 2.5 Pets scene (`Assets/Scenes/Pets.unity`, UX §3D)

Full `SceneManager` scene. **Reuses `VoidBackground`** with the current
world's palette (per engine notes / M6 §5) — stepping into Pets stays under
the same sky. Frame conventions: `MarginContainer` 40/40/40/28, main VBox
separation 18.

- **Header** "PETS" 38px (`HeaderLabel`) · BACK 200×96 default `Button`.
- **Active-pet showcase:** the active pet's **current evolution-form sprite**
  ~300×300 (gentle <1.5s idle hover, IGNORE), then:
  - pet **name** 40px in bright `Color(0.93, 0.91, 1)` (standard-bright, NOT
    Cinzel — pets are friendly companions, deliberately *not* the ceremonial
    Cinzel that relics/bosses/world-names get; §5).
  - **evolution indicator in words** 26px muted: "Stage 2 of 3" + the
    stage's name — never a color-coded stage.
  - **XP bar** (§2.6).
  - **passive bonus** in plain language 28px standard label — "Essence gain
    +11%".
  - **next-evolution preview** 24px muted — "Evolves at Lv. 25"; at the cap
    stage this reads "MAX FORM."
- **Roster** (`ScrollContainer` of Data-Driven Content Rows, 1000×140,
  separation 14): the M6 row shape with a **6px ally-violet left accent bar**
  (`Color(0.545, 0.361, 0.965, 1)` — uniform, like relics' uniform gold; pets
  are one companion class). Per row: current-form icon 64×64, name 30px,
  `Lv. N`, the bonus short line, an "● ACTIVE" word+dot badge on the active
  pet, a "NEW" pill on unseen pets. Whole row STOP; children IGNORE. Tap →
  Pet Inspector Card.

### 2.6 XP bar (filling variant of the health/timer bar family, UX §3D)

A new `PetXPBar` `ProgressBar` theme variation — **not a new pattern**, the
existing bar visual family filling upward. Growth = the reward color, so the
fill is ally-violet.

```
PetXPBar/base_type = &"ProgressBar"
background (StyleBoxFlat):
  bg_color        Color(0.07, 0.05, 0.11, 0.92)      # reuse pb_bg
  border 1 · border_color Color(0.3, 0.22, 0.45, 0.9) · corner_radius_* 12
fill (StyleBoxFlat):
  bg_color        Color(0.545, 0.361, 0.965, 1)      # reward violet (slider_fill)
  corner_radius_* 12
  shadow_color    Color(0.545, 0.361, 0.965, 0.25)
  shadow_size     6
```

- Height ~96 (touch-exempt, non-interactive, `mouse_filter = IGNORE`).
- `Lv. N` at the left, `cur / next XP` numerals inside. **Numerals require
  the M5 outline treatment** — bare white on a filled/empty boundary
  measures ~3:1 and fails; white `Color(0.95, 0.93, 1)` with
  `outline_size = 6`, `font_outline_color = Color(0.06, 0.03, 0.12, 1)`
  measures **15.4:1 regardless of fill state** (M5 §2C, the systemic
  label-inside-bar answer). ≥24px, `NumberFormat` + Hold-to-Reveal on the
  figure (UX §5 — the pattern's next retrofit consumer).
- At the cap stage the right label reads "MAX FORM" and the bar tracks level
  only.

### 2.7 Pet Inspector Card (Inspector Card pattern — pet variant, UX §3E)

Same Inspector Card dress; **card border = ally-violet**
`Color(0.655, 0.545, 0.98, 0.8)` (pets are violet-framed, matching their
aura, as relics are gold-framed). Header: pet name 40px bright standard +
"Companion · Stage 1 of 3" 24px muted + form icon 80×80. XP bar. Bonus 28px
standard. Preview 24px muted — "Evolves into Frostwyrm at Lv. 10". **SET
ACTIVE** (`PrimaryButton` 920×110; disabled with "Already active" in words
on the active pet) + **CLOSE** (920×96). No destructive action — pets are
never released this milestone.

### 2.8 Growth transients (UX §3F/§4D)

- **Level-up** (frequent) → **Loot-Toast-family pill** (`CelebrationToast`
  recipe), `mouse_filter` IGNORE on every node (load-bearing — floats over
  the combat area; a mid-tap player must never lose an attack to a level-up).
  Border re-accented to **ally-violet** `Color(0.655, 0.545, 0.98, 0.9)`
  (a pet growth is an ally event, not a rarity event). "Ember reached Lv. 7"
  30px standard label. 0.25s pop + hold + 0.25s fade (~1.1s), self-free +
  a companion scale-pop. No haptic. Multiple levels at once collapse to the
  highest (the Loot Toast collapse rule).
- **Evolution** (rare) → **Result Banner, win variant** (violet-light border
  + violet glow 18): "EMBER EVOLVED — now BLAZE · Essence gain +11%",
  headline 40px Cinzel (`TitleLabel` violet recipe), the new form's icon
  56×56, the bonus tinted essence-lavender `Color(0.769, 0.71, 0.992)`
  (10.3:1). Plus the **visible in-place sprite transform** (≤0.6s cross-fade
  swap on the companion + showcase) — the real payoff; non-blocking (UX
  §4E). 35ms haptic.
- **New-pet drop** (rare) → **Result Banner** "NEW COMPANION — Frostling
  joins the hunt." + roster NEW badge. 35ms haptic.

---

## 3. Asset Manifest

Construction idiom for all: **glow-disc + faceted polygons, radial/linear
gradients only, NO SVG filters** (the essence/slot/enemy idiom). New files
under `sprites/`.

### 3.1 Relic sigils — 5 × 128×128, shared aureole frame, unique center

Each sigil is self-contained (frame baked in, like the glow disc is baked
into every existing icon) so the five are drop-in and always read as a set.
**Shared sub-structure copied into all five** (the "relic frame"):
1. aureole glow disc r=62, `radialGradient` `relic-glow` stops
   0.35→op 0.5, 0.72→op 0.15, 1→op 0 (the essence-icon glow structure,
   gold);
2. a faceted octagonal **frame ring** r≈54, `linearGradient`
   `relic-deep`→`relic-light` with a `relic-veil @ 0.6` top-left glint —
   the gold border that unifies the set;
3. the unique **sigil** inside r≈40, `relic-veil`→`relic-deep` facets,
   `relic-abyss` darkest facet, bold masses only (must read at 64px in the
   collection row and 56px in the drop banner).

| # | file | central sigil (hints its effect) |
|---|---|---|
| 1 | `sprites/ui/relic_eclipse_heart.svg` | **Eclipse Heart** (offline ×3): a dark eclipse disc (`#100a04` moon) crossing a `relic-glow` corona (reuse `eclipse_emblem` corona logic in gold), a small faceted heart glinting at the eclipse center — "beats in the dark between sessions." |
| 2 | `sprites/ui/relic_hunters_sigil.svg` | **Hunter's Sigil** (boss dmg +50%): a bold faceted **downward arrowhead/chevron** striking into a small notched crown silhouette at the base — "slays the mighty." Two `relic-veil`→`relic-deep` facets split on a center seam. |
| 3 | `sprites/ui/relic_twin_fang.svg` | **Twin Fang** (auto-attack ×2 speed): **two mirrored curved fang polygons** crossing, with two thin `relic-light` motion-slash slivers behind — "fires twice as fast." |
| 4 | `sprites/ui/relic_shatterstone.svg` | **Shatterstone** (crit dmg +100%): a faceted gem **fracturing outward**, 3–4 shard fragments flung off (reuse `void_scraps` fragment logic in gold) with a `relic-veil` crack-line — "critical shatter." |
| 5 | `sprites/ui/relic_essence_prism.svg` | **Essence Prism** (essence ×2): a triangular **prism refracting a beam into two facet-rays** (reuse essence-crystal facet logic), the split reading as "doubles" — one beam in, two out. |

### 3.2 Pet sprites — 512×512, bold masses (read down to 64px)

Authored at 512×512 to match the enemy pipeline and downscale cleanly to
the showcase (~300), companion (200), and roster icon (64). All share:
ally-violet aura disc (`radialGradient` `#8b5cf6`/`#a78bfa`, the
`gloom_wisp` aura structure), friendly rounded silhouette, **solid bright
eyes** `#c4b5fd` with a `#f8f6ff` highlight dot (NOT hollow), bright body
facets.

| # | file | form |
|---|---|---|
| 1 | `sprites/pets/pet_ember.svg` | **Ember** (starter S1): small rounded flame-cub, coral→amber body, a single soft flame tuft, ally-violet aura + eyes. |
| 2 | `sprites/pets/pet_blaze.svg` | **Blaze** (starter S2): larger, brighter coral-gold flame-beast, taller triple flame crest, more facets — a clear "bigger, evolved" silhouette. |
| 3 | `sprites/pets/pet_frostling.svg` | **Frostling** (drop S1): small pale-ice sprite, rounded crystalline body, two stubby ice-shard nubs, ally aura + eyes. |
| 4 | `sprites/pets/pet_frostwyrm.svg` | **Frostwyrm** (drop S2): elongated serpentine ice-drake, crystalline dorsal crest, brighter ice facets — visibly evolved from Frostling. |

**Deferrable (content-drop, `silent_colossus` precedent — data may point the
slot at the stage-2 sprite with `TODO(content)`):**
`sprites/pets/pet_ember_s3.svg`, `sprites/pets/pet_frostwyrm_s3.svg`
(stage-3 caps, names TBD by writer), and `sprites/pets/pet_sparkling.svg`
(third line, base).

### 3.3 Explicitly NOT needed

- **No per-relic frame textures** — the gold frame is a shared sub-structure
  baked into each of the five sigils (like the glow disc is shared across all
  existing icons).
- **No rarity pips, pip textures, or rarity colors for relics** — single
  tier, no counting (the whole point of §1.1).
- **No separate companion sprite** — the in-combat companion is the active
  pet's sprite drawn at 200×200; the roster icon is the same texture at 64.
- **No "ACTIVE"/"ATTUNED"/"NEW" badge textures** — word pills + the `●` font
  glyph carry every state (never a bespoke asset, never color-only).
- **No bespoke evolution/reveal scene** — evolution is a Result Banner + an
  in-place sprite cross-fade swap; relic drop reuses the Result Banner.
- **No XP-bar texture** — `PetXPBar` is a `ProgressBar` styled via
  StyleBoxFlat (§2.6).
- **No new modal/card scenes** — the relic and pet Inspector Cards are the M6
  Inspector Card re-accented (gold / ally-violet) with a different action
  set and no compare table (UX §7.1 confirms these are variants, not new
  patterns).
- **No empty-state sigil asset** — the awakened-empty tile reuses the
  existing `slot_relic.svg` at 0.30 modulate.
- **Stage-3 pet forms + the Sparkling line are NOT M7 art** — deferrable
  content-drop (§3.2).

---

## 4. Accessibility Verification (computed)

Committed **Enhanced** tier (`design/accessibility-requirements.md`), all
three recurring Phase-4 lessons applied. Surface luminances used:
Inspector/Modal card & banner bg `Color(0.075,0.055,0.12)` **L=0.0055**;
row/panel bg `Color(0.10,0.078,0.157)` **L=0.0086**; relic ATTUNED tile bg
`Color(0.11,0.09,0.06)` **L=0.0089**.

| text | color | L | surface | ratio | verdict |
|---|---|---|---|---|---|
| Relic name | relic-light `#FBE7A8` | 0.805 | card / tile / row / banner | 15.4 / 14.5 / 14.6 / 15.4 | pass |
| Relic effect sentence | muted `Color(0.62,0.57,0.75)` | 0.314 | card / tile / row | 6.6 / 6.2 / 6.2 | pass |
| Relic flavor / rule caption | muted `Color(0.62,0.57,0.75)` | 0.314 | card | 6.6 | pass |
| Pet name 40px | bright `Color(0.93,0.91,1)` | 0.830 | card / row | 15.9 / 15.0 | pass |
| Pet bonus line 28px | standard `Color(0.906,0.886,0.973)` | 0.781 | card / row | 15.0 / 14.2 | pass |
| Evolution banner bonus | essence-lav `Color(0.769,0.71,0.992)` | 0.519 | banner | 10.3 | pass |
| Stage / preview / level muted | muted `Color(0.62,0.57,0.75)` | 0.314 | card / row | 6.6 / 6.2 | pass |
| XP numerals (`cur/next`, `Lv.N`) | white `#F2EEFF` on 6px dark outline | — | any fill state | **15.4** | pass (outline-anchored, M5 §2C) |
| ~~XP numerals, bare~~ | white | — | violet fill boundary | ~3.0 | **fail → outline required** |
| Level-up toast text | standard `Color(0.906,0.886,0.973)` | 0.781 | toast bg | 15.0 | pass |

Every text-on-surface clears 4.5:1 (most clear 10:1+). The one flagged
failure (bare XP numerals) is resolved by the mandated M5 outline treatment.

**No state is color-only** (verified per state, UX §5):
- *active relic* = "● ATTUNED" **word + dot** + the gold frame/halo — never
  gold alone.
- *active pet* = "● ACTIVE" **word + dot** + the ally-violet frame — never
  violet alone.
- *evolution stage* = "Stage N of M" **in words** + the sprite-form change +
  the name change.
- *XP progress* = the `cur / next` **numerals** + `Lv. N`, never the fill
  alone.
- *NEW* = a **word pill**; *relic vs gear* = the entire **absence of pips**
  + the named effect sentence + the "Relic" word + the unique sigil.
- *relic tier* = **uniform gold everywhere** (single tier) — there is no
  per-relic color code to misread; every state survives full desaturation.

**Touch targets (≥96×96):** relic tile 236×250; Relic Collection rows
1000×140, panel CLOSE 180×96; relic card ATTUNE/DETACH 920×110, CLOSE
920×96; companion entry 200×200; Pets BACK 200×96, roster rows 1000×140; pet
card SET ACTIVE 920×110, CLOSE 920×96 — all clear. Non-interactive & exempt
(stated to pre-empt review): the XP bar, all sigils/sprites, the `●`/NEW
pills, every effect/bonus/flavor caption, and all growth transients.

**Explicit `mouse_filter` audit (Phase-4 lesson #1):** STOP — relic tile,
Relic Collection rows, both Inspector Cards' Scrim + Card, the companion
Button, all Pets roster rows and buttons. IGNORE (explicit) — every
label/sigil/sprite inside tiles/rows/cards/showcase, the XP bar + its
numerals, the `●`/NEW pills, the companion's `Lv.N`/NEW badge, and the
**entire level-up transient tree** (load-bearing over the combat area).

**Motion:** every new animation is one-shot and short — "seal breaks"
shimmer ≤0.5s, tile/companion pops 0.24s, level-up toast ~1.1s self-freeing,
evolution cross-fade ≤0.6s, relic/pet banners on the existing ≤2.2s queue.
The only loops are the companion idle hover and the showcase sprite hover,
both <1.5s and non-essential to comprehension (within the standing pre-
"Reduce Motion" rule). No animation gates input beyond its stated duration.

---

## 5. Consistency Notes

- **Two new scoped accents, one meaning each** (joining violet=game/rewards,
  teal=auto-attack, ember=boss, ice=FR creatures, rarity=item identity):
  **Aureate gold = "this is a relic"** (relic surfaces only, never chrome /
  actions / gear / pets); **ally-violet aura = "this companion is mine"**
  (pet auras + pet frames — a *reuse* of the reward violet in the ally role,
  not a new hue). Pet **body** tints (coral, ice) are flavor art, orthogonal
  to the accent system exactly as M6 rarity is orthogonal to chrome.
- **Glow hierarchy — one deliberate addition.** The relic ATTUNED halo sits
  at **shadow_size 12**, intentionally above every gear rarity shadow (8–10)
  and below PrimaryButton hover (22). This single step is the visual proof
  that a relic outranks any Mythic drop, and it respects the ceiling. All
  other glows unchanged (pet XP fill 6, banners 18).
- **Radius grammar unchanged:** 12 bars (XP bar, pb), 14 rows, 16 tiles, 18
  buttons, 20 cards, 24 pills. No new radius values.
- **Border grammar unchanged:** 1px translucent passive / 2px emphasis / 3px
  the ATTUNED tile (matching M6's equipped-tile 3px). Frame accents (gold,
  ally-violet) recolor existing borders; they do not thicken them.
- **Type roles honored, with a deliberate relic/pet split.** Cinzel stays
  **ceremonial** — relic names, the relic-drop and evolution banner
  headlines (an artifact and a transformation are solemn events). Pet
  **names use the bright default face**, not Cinzel — companions are
  friendly, not ceremonial; this is an intentional, legible distinction, not
  an inconsistency. All data (bonus lines, XP numerals, levels, counts)
  stays default-face per the standing rule.
- **`VoidBackground` reused** for the Pets scene with the current world's
  palette (per engine notes / M6 §5) — world continuity into the pet screen,
  the material already per-instance since M5.
- **Warm relic socket vs cool gear grid** — the relic tile's warm-tinted bg
  (`Color(0.11,0.09,0.06)`) is the only warm cell in the violet gear grid,
  so the relic slot is legible as special before its contents are read
  (mirroring how Void Scraps joined the currency family as a distinct
  "material").
- **Uniform accent bars carry a systemic message:** relic rows are all gold,
  pet rows are all ally-violet — the *opposite* of gear's per-item rarity
  bars, which is precisely how each set announces "we are one class," not "we
  are graded."
- **No existing color is touched.** M7 adds the Aureate family and reuses the
  reward violet for pets; every M4/M5/M6 surface, border, and text color is
  unchanged (and the M5 Frozen Ruins sky legibility work is inherited intact,
  since the Pets scene rides the same shader uniforms).
