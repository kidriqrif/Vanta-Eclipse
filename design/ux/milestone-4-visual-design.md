# Milestone 4 Visual Design — Auto-Attack Unlock & Offline Rewards

Author: art-director · Phase 2 of the UI pipeline
Gives visual treatment to the approved UX spec
`design/ux/milestone-4-idle-offline.md` (§3B badge, §3C toast, §3D/§3E/§7
modal). All values are stated in `ui/theme/main_theme.tres` vocabulary
(StyleBoxFlat parameters, `Color()` constructors, theme-variation names) so
they can be transcribed directly. No code, scenes, or SVGs ship with this
document — the asset manifest in §3 is the artist's work order.

Reference canvas: 1080×1920, matching `Assets/Scenes/Gameplay.unity`.

---

## 1. Palette Additions — the Teal Accent Family

The UX spec requires the auto-attack elements to sit in a teal/cyan family
"distinct from the violet `PrimaryButton` family." The existing violet ramp
(from `sprites/ui/essence_icon.svg` and `main_theme.tres`) is:

| role | violet | where it lives today |
|---|---|---|
| veil / highlight | `#DDD3FF` | essence icon top facet |
| light | `#C4B5FD` | essence icon cross-facet, emblem ring |
| glow | `#8B5CF6` = `Color(0.545, 0.361, 0.965)` | glow discs, slider fill, every shadow glow |
| deep | `#7C3AED` | essence icon right facet |
| abyss | `#4C1D95` | essence icon dark facet |

The teal family below is a stop-for-stop mirror of that ramp — same
lightness rung per role, hue rotated to teal — so any construction rule that
works in violet ("light facet uses *light*, glow disc uses *glow* at 0.45
alpha") transfers verbatim:

| name | hex | `Color()` | used for |
|---|---|---|---|
| `teal-veil` | `#D9FBF4` | `Color(0.851, 0.984, 0.957, 1)` | icon top-facet highlight (analog of `#DDD3FF`) |
| `teal-light` | `#5EEAD4` | `Color(0.369, 0.918, 0.831, 1)` | badge text, toast headline, icon cross-facet (analog of `#C4B5FD`) |
| `teal-glow` | `#2DD4BF` | `Color(0.176, 0.831, 0.749, 1)` | icon glow disc, badge/toast shadow glows, toast border (analog of `#8B5CF6`) |
| `teal-deep` | `#0D9488` | `Color(0.051, 0.580, 0.533, 1)` | badge border, icon dark facet (analog of `#7C3AED`) |
| `teal-abyss` | `#134E4A` | `Color(0.075, 0.306, 0.290, 1)` | icon darkest facet, headline outline (analog of `#4C1D95`) |

Plus one derived surface color (not a ramp stop — it is to the teal family
what `Color(0.13, 0.09, 0.22, 0.9)` is to the violet button family):

| name | value | used for |
|---|---|---|
| `teal-surface` | `Color(0.04, 0.12, 0.11, 0.9)` (≈ `#0A1F1C` @ 0.9) | AutoAttackBadge pill fill |

**Collision check.** Teal stays clear of every accent already in play: the
violet UI family, the crit gold `Color(1.0, 0.8, 0.25)`
(`Assets/Scripts/UI/DamageNumber.cs`), and the health-bar crimson `Color(0.73, 0.2, 0.34)`
(`StyleBoxFlat_pb_fill`). It also survives the two CVD cases the Enhanced
tier names: under red-green deficiency teal vs violet separates on the
blue axis; under blue-yellow deficiency they separate on lightness
(`#5EEAD4` is far lighter than `#8B5CF6`) — and no state depends on the
hue anyway (§4).

**Scope rule:** teal means exactly one thing — *auto-attack*. It appears on
the badge, the toast frame/headline/icon, and nowhere else. The offline
modal stays violet (it is about Essence, not about auto-attack), which
keeps the accent from diluting into a general "second brand color."

---

## 2. Per-Element Treatment

### 2A. AutoAttackBadge (UX §3B)

Pill-shaped status chip, third child of `WorldVBox`, left-aligned,
auto-width ≈ 280×40px. Non-interactive (`mouse_filter = IGNORE`).

**Container** — `PanelContainer` with theme variation `AutoAttackBadge`
(base `PanelContainer`), StyleBoxFlat:

```
content_margin_left = 22.0
content_margin_top = 6.0
content_margin_right = 26.0
content_margin_bottom = 6.0
bg_color = Color(0.04, 0.12, 0.11, 0.9)      # teal-surface
border_width_left/top/right/bottom = 1
border_color = Color(0.051, 0.58, 0.533, 0.8) # teal-deep @ 0.8
corner_radius_* = 20                          # = half the 40px height → true pill
shadow_color = Color(0.176, 0.831, 0.749, 0.22) # teal-glow @ 0.22
shadow_size = 10
```

Rationale in theme grammar: 1px border + 0.8 border alpha is the *passive
surface* treatment (`StyleBoxFlat_panel` uses exactly that); 2px opaque
borders are reserved for tappable buttons. The shadow glow at size 10 sits
below the PrimaryButton resting glow (16) so the badge never outshines a
real control. Radius 20 (vs 16/18/20 elsewhere) reads as pill because it
equals half the element height — the only fully-round shape in the HUD,
which is itself a recognition cue.

**Contents** — HBox, separation 10:
- Icon: `sprites/ui/auto_attack_icon.svg` (§3, new) in a `TextureRect`,
  28×28, `stretch_mode` keep-aspect-centered. Its baked-in glow disc reads
  correctly at this size; no modulate.
- Label: plain `Label` (default font — deliberately **not** Cinzel, see
  §5), `font_size = 24` (the accessibility floor, per UX §3B),
  `font_color = Color(0.369, 0.918, 0.831, 1)` (`teal-light`). Text
  "AUTO-ATTACK ACTIVE". No outline, no shadow — this is data, not display
  type, matching `StageLabel` directly above it.

**Idle pulse** (UX §3B): animate the whole `PanelContainer`'s
`modulate.a` 1.0 ↔ 0.75, 1.2s cycle, `TRANS_SINE`. Modulate, not a second
StyleBox — the border, glow, icon and text breathe together as one object.

### 2B. Unlock Celebration Toast (UX §3C)

~800×180px card, x-centered at 540, y ≈ 430–610, own CanvasLayer (50),
`mouse_filter = IGNORE` throughout.

**Panel** — `PanelContainer`, theme variation `CelebrationToast`,
StyleBoxFlat:

```
content_margin_left/right = 32.0
content_margin_top/bottom = 16.0
bg_color = Color(0.075, 0.055, 0.12, 0.94)   # panel hue, +0.06 alpha over the shop's 0.88
border_width_* = 2
border_color = Color(0.176, 0.831, 0.749, 0.9) # teal-glow @ 0.9
corner_radius_* = 20                          # matches StyleBoxFlat_panel
shadow_color = Color(0.176, 0.831, 0.749, 0.3) # teal-glow @ 0.3
shadow_size = 18
```

The card body is the standard violet-black panel surface — kin to the shop
— while the 2px teal border + teal halo announce "this moment belongs to
the new teal thing." Shadow 18 sits between PrimaryButton normal (16) and
hover (22): celebratory, but never brighter than a pressed-state glow. The
0.94 bg alpha lets the nebula stars faintly ghost through without
compromising text contrast (verified §4).

**Contents** — VBox, separation 6, all centered:
1. **Icon slot:** `TextureRect`, 56×56, `sprites/ui/auto_attack_icon.svg`
   (the same asset as the badge — one icon, one meaning). The SVG's own
   radial glow disc supplies the halo; no additional styling, no modulate.
   The ⚡ in the UX wireframe is a placeholder for this texture, **not** a
   text glyph — do not put U+26A1 in a Label (see §3, "not needed" list).
2. **Headline:** "AUTO-ATTACK UNLOCKED" — Cinzel (`ExtResource("1")`),
   `font_size = 40`, `font_color = Color(0.369, 0.918, 0.831, 1)`
   (`teal-light`), `font_outline_color = Color(0.075, 0.306, 0.290, 0.8)`
   (`teal-abyss` @ 0.8), `outline_size = 6`,
   `font_shadow_color = Color(0.02, 0.01, 0.05, 0.5)`,
   `shadow_offset_y = 4`. This is the `TitleLabel` recipe (bright fill,
   dark same-hue outline, drop shadow) transposed to teal and scaled from
   92px→40px (outline 10→6, shadow offset 6→4).
3. **Body:** "Your hero fights on, even when you're not tapping." — plain
   `Label`, default font, `font_size = 28`,
   `font_color = Color(0.906, 0.886, 0.973, 1)` (the standard Label
   color). Full-brightness body text, not muted: a 2-second transient must
   be readable in one glance.

Vertical budget: 16 + 56 + 6 + ~46 + 6 + ~34 + 16 ≈ 180px. ✓

### 2C. Offline-Rewards Modal (UX §3D/§3E, pattern §7)

**Scrim** — full-screen `ColorRect`, `mouse_filter = STOP`:

```
color = Color(0.016, 0.008, 0.031, 0.72)
```

That is `SceneFlow.FadeColor` (`Assets/Scripts/Core/SceneFlow.cs`) with alpha 0.72
— literally the same void the scene fade uses, so "the world dims" is one
consistent color everywhere. 0.72 keeps the HUD faintly legible behind the
card (context, not competition) while killing enough background luminance
that the card's 1px border reads crisply.

**Card** — ~860×600px `PanelContainer`, theme variation `ModalCard`,
StyleBoxFlat — the shop-panel recipe with three deliberate deltas:

```
content_margin_left/right = 28.0        # identical to StyleBoxFlat_panel
content_margin_top/bottom = 26.0        # identical
bg_color = Color(0.075, 0.055, 0.12, 0.96)   # panel hue; alpha 0.88 → 0.96
border_width_* = 1                       # identical
border_color = Color(0.29, 0.22, 0.44, 0.8)  # identical
corner_radius_* = 20                     # identical
shadow_color = Color(0.02, 0.01, 0.05, 0.6)  # panel shadow, alpha 0.5 → 0.6
shadow_size = 24                         # panel 12 → 24
```

Same hue, same border, same radius as the shop card = instantly kin. The
deltas encode *floating vs docked*: higher bg alpha (nothing should ghost
through a blocking modal), and a deeper, wider drop shadow because this
card hovers mid-screen rather than docking to the bottom edge. Shadow stays
the void-black panel shadow, **not** a violet glow — glows mean "tap me"
in this language, and the card is not a button.

**Contents** — VBox, separation 12, all centered:

1. **Headline row** — HBox, separation 20, centered:
   `star_flourish.svg` 36×36 · headline · `star_flourish.svg` 36×36.
   - The ✦ flourishes are **SVG textures, not text** (decision + risk in
     §3). The 4-point star is symmetric; the same asset flanks both sides.
   - Headline "WELCOME BACK": Cinzel, `font_size = 44`, exact `TitleLabel`
     colors scaled down: `font_color = Color(0.93, 0.91, 1, 1)`,
     `font_outline_color = Color(0.42, 0.26, 0.8, 0.55)`,
     `outline_size = 6`, `font_shadow_color = Color(0.25, 0.12, 0.55, 0.5)`,
     `shadow_offset_y = 4`, `shadow_outline_size = 8`. This is the main
     menu title's treatment at card scale — the strongest "you are home"
     signal the theme owns.
2. **Body:** "Your hero kept fighting while you were away." — default
   font, `font_size = 30`, `font_color = Color(0.906, 0.886, 0.973, 1)`.
3. **Essence figure row** — HBox, separation 12, centered:
   `essence_icon.svg` (existing) 52×52 + Label "+1.24K Essence", default
   font (matches the HUD `EssenceLabel`, which is default-font 42px —
   numbers are never Cinzel in this game), `font_size = 48`,
   `font_color = Color(0.769, 0.71, 0.992, 1)` (`#C4B5FD`, the essence
   icon's own cross-facet violet — the number wears the currency's color).
   No outline; the card surface provides all needed contrast (10.3:1, §4).
4. **Precision caption:** "(tap and hold for exact amount)" — default
   font, `font_size = 24`,
   `font_color = Color(0.62, 0.57, 0.75, 1)` (the `HeaderLabel` /
   `StageLabel` muted lavender). While held, the revealed exact integer
   renders in the same style at 24px.
5. **Duration line:** "Away for 3h 42m" — default font, `font_size = 28`,
   `font_color = Color(0.62, 0.57, 0.75, 1)`.
6. **Cap sub-line (§3E variant only):** "(offline earnings cap at 8h)" —
   default font, `font_size = 24`,
   `font_color = Color(0.62, 0.57, 0.75, 1)`. **Deliberately not** the
   footer color `Color(0.45, 0.41, 0.56, 1)` — that fails contrast on this
   card (3.7:1, see §4). Hierarchy under the duration line comes from size
   (24 vs 28), not from a third grey.
7. **COLLECT button** — `theme_type_variation = &"PrimaryButton"`,
   `custom_minimum_size = Vector2(500, 110)`. **Confirmed: needs no
   modification.** Existing recipe (fill `Color(0.42, 0.24, 0.83, 1)`,
   2px `Color(0.72, 0.58, 1, 0.9)` border, radius 18, glow
   `Color(0.545, 0.361, 0.965, 0.35)` size 16, Cinzel 44px
   `Color(0.98, 0.97, 1, 1)`) measures 6.1:1 text contrast — passes 4.5:1
   outright, and it is the only glowing element on the card, so the single
   dismiss action is also the single point of light. Ship as-is.

---

## 3. Asset Manifest

### New assets (2)

**1. `sprites/ui/auto_attack_icon.svg`** — folder `sprites/ui/`,
canvas **128×128** (matches `essence_icon.svg`).
Used by: AutoAttackBadge @ 28×28, Celebration Toast @ 56×56.
Must harmonize with: `essence_icon.svg` — same construction, hue-swapped.
Construction (established idiom, gradients only, **no SVG filters** — the
rasterizer does not support `feGaussianBlur`; every glow is a radial
gradient disc):
- Radial glow disc, r=62 centered: `#2DD4BF` stops at
  0.4→opacity 0.45, 0.8→0.1, 1.0→0 (exact stop structure of the essence
  icon's `glow` gradient, hue-swapped).
- A faceted lightning bolt (~56px wide × ~100px tall, on the essence
  crystal's vertical axis) built from 2 main polygons meeting on a center
  seam, mirroring the crystal's facet logic:
  - upper-left facet: linearGradient `#D9FBF4` → `#2DD4BF`
    (analog of the crystal's `left`: `#DDD3FF` → `#8B5CF6`)
  - lower-right facet: linearGradient `#0D9488` → `#134E4A`
    (analog of `right`: `#7C3AED` → `#4C1D95`)
  - cross-facet overlay polygon at the bolt's kink: `#5EEAD4` at
    fill-opacity 0.55 (analog of the `#C4B5FD` @ 0.55 cross-facet)
  - small glint triangle near the top edge: `#F0FFFC` at
    fill-opacity 0.85 (analog of the `#F4F0FF` glint)
Silhouette note: keep the bolt's outline readable at 28px — bold zigzag,
no thin spurs; the badge is this icon's smallest and most important use.

**2. `sprites/ui/star_flourish.svg`** — folder `sprites/ui/`,
canvas **64×64**.
Used by: Offline modal headline row @ 36×36, one per side (symmetric —
one asset, no mirrored variant). Future reuse: any Centered Modal Dialog
headline (UX §7 names prestige/delete-save confirmations).
Must harmonize with: the four star accents in `eclipse_emblem.svg`
(`#C4B5FD`/`#A78BFA` dots) and the essence icon's facet language.
Construction:
- Faint radial glow disc, r=30 centered: `#8B5CF6` stops 0.4→0.35,
  0.8→0.08, 1.0→0.
- 4-point star (concave diamond, points at N/E/S/W, ~48px tip-to-tip):
  two polygons split on the vertical axis — left half linearGradient
  `#DDD3FF` → `#8B5CF6`, right half `#7C3AED` → `#4C1D95` — the essence
  crystal's exact light/dark facet split, in miniature.
- Center glint: 6px `#F4F0FF` circle at fill-opacity 0.85.
Violet family, **not** teal: it decorates the Essence-centric modal.

### Explicitly NOT needed (and why)

- **⚡ as a text glyph (U+26A1) in the toast/badge** — replaced by
  `auto_attack_icon.svg` in both places. An emoji codepoint would rasterize
  from whatever fallback the platform provides: unstyled, un-themed, and
  inconsistent across Android vendors.
- **✦ as text glyphs (U+2726 BLACK FOUR-POINTED STAR) in "✦ WELCOME BACK ✦"**
  — replaced by `star_flourish.svg`. The font file is
  `cinzel-latin-700-normal.woff2` — a *latin-subset titling face*; U+2726
  is not in it. An engine silently falls back to its default font for
  missing glyphs, which means a thin generic sans star butted against
  Cinzel's engraved capitals (or a .notdef box on a bad day) — an
  unacceptable seam in the game's most ceremonial headline. Rendering the
  flourish as an SVG removes the font-fallback risk entirely and gives the
  flourish the same lit-facet materiality as every other icon.
- **A separate toast icon** — badge and toast share
  `auto_attack_icon.svg`. One glyph = one concept; the toast teaches the
  symbol the badge then wears forever.
- **Scrim/pill/card textures** — the scrim is a `ColorRect`, the pill and
  cards are StyleBoxFlats. No bitmap or SVG needed for any surface.
- **Essence icon for the modal** — `sprites/ui/essence_icon.svg` already
  exists and is used as-is at 52×52.

---

## 4. Accessibility Verification (Enhanced tier, UX §5)

Ratios computed per WCAG 2.x relative luminance, with translucent fills
composited over their real backgrounds first (worst case: the *brightest*
plausible nebula patch `≈ Color(0.06, 0.03, 0.13)` under the top bar;
`nebula_background.gdshader` peaks around its `nebula_color` with the
vignette applied). Requirement: ≥ 4.5:1 for body-size text; ≥ 3:1 for
large text (I apply 4.5:1 everywhere — at 1080px reference width even
28px text is physically small on a phone).

| text | color | against | ratio | verdict |
|---|---|---|---|---|
| Badge "AUTO-ATTACK ACTIVE" 24px | `#5EEAD4` | pill fill composited on nebula | **11.8:1** | pass |
| — same, worst-case alpha (pill over brightest fog) | `#5EEAD4` | raw nebula patch | 13.2:1 | pass (alpha can only help) |
| Toast headline 40px | `#5EEAD4` | toast bg composited | **12.9:1** | pass |
| Toast body 28px | `Color(0.906, 0.886, 0.973)` | toast bg | **15.1:1** | pass |
| Modal headline 44px | `Color(0.93, 0.91, 1)` | card bg composited | **15.9:1** | pass |
| Essence figure 48px | `#C4B5FD` | card bg | **10.3:1** | pass |
| Modal body 30px | `Color(0.906, 0.886, 0.973)` | card bg | **15.0:1** | pass |
| Captions/duration 24–28px | `Color(0.62, 0.57, 0.75)` | card bg | **6.6:1** | pass |
| ~~Cap sub-line in footer grey~~ | `Color(0.45, 0.41, 0.56)` | card bg | **3.7:1** | **fail → adjusted** |
| Cap sub-line (adjusted) | `Color(0.62, 0.57, 0.75)` @ 24px | card bg | **6.6:1** | pass |
| COLLECT label 44px | `Color(0.98, 0.97, 1)` | `Color(0.42, 0.24, 0.83)` fill | **6.1:1** | pass, unmodified |

The one adjustment: the gameplay footer's dimmest grey
(`Color(0.45, 0.41, 0.56)`, used for `SessionLabel`) fails on the modal
card and is barred from it; the cap sub-line uses the mid-muted lavender
and drops to 24px for hierarchy instead.

**No state is color-only.** The badge's state is *present-with-text* vs
*absent* — teal is pure decoration over the words "AUTO-ATTACK ACTIVE"
plus the bolt icon (shape cue). The toast pairs color with text, icon, and
motion. The modal's cap condition is stated in words ("offline earnings
cap at 8h"), never encoded as a color change. The COLLECT affordance is
carried by size, position, border, glow, *and* label — not hue alone.

**Motion:** the only looping animation is the badge's 1.2s opacity pulse
(under the 1.5s ceiling; decorative — text/icon carry the state with the
pulse off). All other treatment here is static styling; entrance/exit
timings stay exactly as the UX spec defines them.

**Touch targets:** COLLECT at 500×110 clears 96×96; badge and flourishes
are non-interactive by spec.

---

## 5. Consistency Notes — How This Stays Kin

- **One surface hue.** Every new dark surface is the theme's panel
  aubergine `Color(0.075, 0.055, 0.12)` (toast, modal card) except the
  badge, whose teal-shifted `Color(0.04, 0.12, 0.11)` is the *point* — it
  is the single element allowed to be teal-bodied, and it earns that by
  being the feature's permanent home.
- **Radius grammar unchanged.** 20 = panels/cards (shop, toast, modal),
  18 = primary action, 16 = secondary buttons, 20-as-half-height = the one
  pill. No new radius values introduced.
- **Border grammar:** 1px translucent = passive surface (shop panel,
  badge, modal card); 2px opaque = emphasis (buttons; the toast borrows it
  for its 2-second celebration). The modal card deliberately keeps the
  shop's exact 1px `Color(0.29, 0.22, 0.44, 0.8)` border so §3D's "kin to
  the shop panel's card look" is literal.
- **Glow = the game's one light source.** All glows remain
  shadow-as-bloom StyleBoxFlat shadows or SVG radial discs. Teal glows
  reuse the violet glow's exact alphas and sizes (0.22–0.3, sizes 10–18),
  and no new element out-glows PrimaryButton hover (22) — the tap
  affordance keeps the brightest halo on any screen.
- **Type roles unchanged.** Cinzel remains ceremonial (toast headline =
  `TitleLabel` recipe in teal; modal headline = `TitleLabel` recipe at
  44px). Data stays in the default face: badge status text, essence
  figures, durations, captions — matching `StageLabel`, `EssenceLabel`,
  and the footer today. No new font, no new weight.
- **Icon idiom:** both new SVGs are glow-disc + faceted-polygon
  constructions with the essence crystal's exact gradient-stop structure,
  gradients only — safe for the rasterizer's no-filter constraint.
- **Scrim = FADE_COLOR.** The modal dims the world with the same
  `Color(0.016, 0.008, 0.031)` the `SceneManager` fades with, so every
  darkness in the game is the same void.
