# Milestone 5 Visual Design — Bosses, Worlds & Unlocks

Author: lead dev in the art-director role (produced inline during the
subagent-credit outage; method identical to the M4 visual spec — ramp
mirroring, composited WCAG verification with computed ratios, theme
vocabulary). Gives visual treatment to the approved
`design/ux/milestone-5-bosses-worlds.md`.

---

## 1. Palette Additions

### 1A. Danger accent family (bosses, timer urgency)

Stop-for-stop mirror of the violet/teal ramps, hue rotated to ember
(orange-red ~20°). Verified distinct from the violet UI family, the teal
auto-attack family (`#2DD4BF`, hue ~172°), the crit gold
`Color(1.0, 0.8, 0.25)` (yellow, far lighter), and the health-bar crimson
`Color(0.73, 0.2, 0.34)` (pink-red, hue ~345°). Under red-green CVD,
ember vs crit-gold separates on lightness and ember vs crimson on the
blue axis; no state is hue-only anyway (UX §5).

| name | hex | `Color()` | used for |
|---|---|---|---|
| `danger-veil` | `#FFE3D4` | `Color(1.0, 0.89, 0.83, 1)` | skull icon top-facet highlight |
| `danger-light` | `#FB923C` | `Color(0.984, 0.573, 0.235, 1)` | boss name text, urgent timer accents, icon cross-facet |
| `danger-glow` | `#F0562A` | `Color(0.941, 0.337, 0.165, 1)` | icon glow disc, urgent TimerBar fill, boss glow shadows |
| `danger-deep` | `#C2410C` | `Color(0.761, 0.255, 0.047, 1)` | boss-bar border, icon dark facet |
| `danger-abyss` | `#7C2D12` | `Color(0.486, 0.176, 0.071, 1)` | boss name outline, icon darkest facet |

**Scope rule:** ember means exactly one thing — *boss threat*. BossPlate,
urgent TimerBar, skull icon, boss glow dressing, Elder/world-boss
particles. Never on buttons, never on rewards (win banner celebrates in
violet/gold territory, fail banner is neutral — UX §3C).

### 1B. Ice accent family (Frozen Ruins creatures)

True blue (~217°), deliberately deeper than Shade Stalker's sky-blue
(`#7DD3FC`, ~199°) and far from the auto-attack teal:

| name | hex | `Color()` |
|---|---|---|
| `ice-veil` | `#DBEAFE` | `Color(0.859, 0.918, 0.996, 1)` |
| `ice-light` | `#93C5FD` | `Color(0.576, 0.773, 0.992, 1)` |
| `ice-glow` | `#3B82F6` | `Color(0.231, 0.51, 0.965, 1)` |
| `ice-deep` | `#1D4ED8` | `Color(0.114, 0.306, 0.847, 1)` |
| `ice-abyss` | `#1E3A8A` | `Color(0.118, 0.227, 0.541, 1)` |

### 1C. World sky palettes (the three shader uniforms)

| world | `deep_color` | `nebula_color` | `accent_color` |
|---|---|---|---|
| 1 · Dark Forest (canonical restate of current defaults) | `Color(0.016, 0.008, 0.035)` | `Color(0.10, 0.05, 0.22)` | `Color(0.36, 0.19, 0.66)` |
| 2 · Frozen Ruins | `Color(0.008, 0.018, 0.035)` | `Color(0.03, 0.095, 0.15)` | `Color(0.10, 0.31, 0.47)` |

Frozen Ruins was tuned DOWN from two brighter candidates specifically to
keep HUD text legible: the binding constraint is the brightest fog patch
(`nebula + accent × 0.32 ≈ Color(0.062, 0.194, 0.30)`), verified in §4.
World palettes are HUD backgrounds first, art second.

---

## 2. Per-Element Treatment

### 2A. BossPlate
HBox in the EnemyNameLabel slot (UX §3A). Skull icon 36×36
(`boss_skull_icon.svg`, §3). Name label: Cinzel via `HeaderLabel`
variation, 42px, `font_color = danger-light`,
`font_outline_color = Color(0.486, 0.176, 0.071, 0.8)` (danger-abyss),
`outline_size = 6`, shadow `Color(0.02, 0.01, 0.05, 0.5)` offset-y 4 —
the M4 toast-headline recipe transposed to ember. No panel behind it:
the name floats like EnemyNameLabel does; the dressing lives in the bars.

### 2B. BossHealthBar (theme variation, base `ProgressBar`)
```
background: StyleBoxFlat_pb_bg values, border_color -> Color(0.761, 0.255, 0.047, 0.9)
fill:       bg_color Color(0.73, 0.2, 0.34, 1)   # unchanged crimson — HP is HP
            border_width_* = 1, border_color danger-deep @ 0.9
            corner_radius_* = 12
            shadow_color Color(0.941, 0.337, 0.165, 0.3), shadow_size = 10
```
Height 46→60 is the UX spec's non-color cue; the dress adds the ember
border + halo. Fill hue stays the established HP crimson so "enemy
health" reads continuously across normal and boss fights.

### 2C. TimerBar (Countdown Timer Bar pattern)
```
track:       bg Color(0.07, 0.05, 0.11, 0.92), border 1 Color(0.3, 0.22, 0.45, 0.9), radius 12
fill normal: bg Color(0.51, 0.44, 0.72, 1)          # calm lavender — time as neutral resource
             radius 12
fill urgent: bg danger-glow, shadow danger-glow @ 0.35 size 10
```
Label: 28px (UX-pinned), `font_color = Color(0.95, 0.93, 1, 1)` **with
`outline_size = 6`, `font_outline_color = Color(0.06, 0.03, 0.12, 1)`** —
required: computed contrast of bare white on the fills is 3.7:1 (normal)
and 3.0:1 (urgent), both failing; against the dark outline the numerals
measure 15.4:1 regardless of what the bar underneath is doing. (The same
outline treatment is the systemic answer for any label-inside-bar text
crossing a filled/empty boundary; retrofitting it onto `HealthLabel` is
noted in §6 as inherited polish, non-blocking.)
Urgency state swaps fill stylebox + starts the 0.6s pulse; the label
never changes color (numerals are the load-bearing signal, UX §5).

### 2D. Result Banners (win / fail variants)
Both use the `CelebrationToast` card recipe with the border re-accented:
- **Win:** border `Color(0.655, 0.545, 0.98, 0.9)` (violet-light) +
  violet glow shadow 18 — celebration lives in the game's reward color.
  Headline "BOSS FELLED": Cinzel 40, `TitleLabel` colors (violet recipe).
  Icon slot 56×56: `boss_skull_icon.svg` (the threat, ended).
- **Fail:** border `Color(0.29, 0.22, 0.44, 0.8)` (the passive panel
  border) + the plain panel shadow — deliberately *neutral*, per UX §3C
  ("failure copy redirects, never scolds"). Headline "THE BOSS ENDURES":
  Cinzel 40, standard label color `Color(0.906, 0.886, 0.973, 1)`, no
  ember anywhere. Body 28px standard color.

### 2E. World Unlock Modal (content treatments; structure is pattern-standard)
Card: `ModalCard` variation unchanged, 860×720. Kicker "WORLD UNLOCKED":
30px, `HeaderLabel` variation (muted lavender). World name: Cinzel 64px,
full `TitleLabel` recipe at `outline_size = 8`, `shadow_outline_size = 10`
(between the menu title and M4's 44px WELCOME BACK). Star flourishes
36×36 flank the name (existing asset). Permanence + level-range lines:
28px standard color / 26px muted. Payout row: exact M4 offline-modal
treatment (essence icon 52, figure 48px `Color(0.769, 0.71, 0.992)`,
hold-hint 24px muted). ENTER: stock `PrimaryButton`, 500×110 — measured
6.1:1 in M4, unchanged. Reward-line for the multiplier: "Essence ×2.5 in
this world" — 28px, `Color(0.655, 0.545, 0.98, 1)` (violet-light,
10.6:1 on the card).

### 2F. CHALLENGE BOSS button
Stock `PrimaryButton`, no deltas. Text fits at 44px Cinzel in 1000px
width. The one glowing element in farm mode by design (UX §3B).

### 2G. Global adjustment required by the Frozen Ruins sky
The gameplay footer color `Color(0.45, 0.41, 0.56)` measures 3.4:1 over
the FR sky's bottom-edge patch (vignette-dimmed) — fail. The footer
(`SessionLabel`, `PlayTimeLabel` in `Assets/Scenes/Gameplay.unity`) brightens one step
to **`Color(0.55, 0.51, 0.68)`**: 4.9:1 over the FR worst case, improves
Dark Forest too, and stays visibly the dimmest text tier. No other
existing color is touched.

---

## 3. Asset Manifest

Construction idiom for all: glow-disc + faceted polygons, radial/linear
gradients only, NO SVG filters. All in `sprites/`.

1. **`sprites/ui/boss_skull_icon.svg`** — 128×128. Danger family. Radial
   glow disc r=62 (`danger-glow` stops 0.4→0.45, 0.8→0.1, 1→0). Stylized
   angular skull: cranium from two facet polygons (upper-left
   `danger-veil`→`danger-light`, lower-right `danger-deep`→`danger-abyss`
   linear gradients, split on a vertical center seam), two eye sockets as
   dark negative shapes (`#12060A`-family), a three-tooth jaw silhouette.
   Bold masses only — used at 36px (plate) and 56px (banners).
2. **`sprites/enemies/hollow_sovereign.svg`** — 512×512, Dark Forest
   world boss. Crowned antlered tree-lord: tall trunk-body silhouette
   (violet-family darks, `#1E1240`/`#120826`), branching antler crown
   (6-8 spiked polygons), hollow void face (near-black ellipse) with
   asymmetric ember eyes (`danger-light` radial glow — the world boss
   wears the danger accent in its own body), root-tendrils at the base
   reusing the wisp's flame-lick construction. Aura disc: violet glow at
   0.45 with an inner `danger-glow` ring stop at 0.25 opacity.
3. **`sprites/enemies/frost_shade.svg`** — 512×512. FR roster 1: drifting
   shard-spirit — inverted-teardrop body in ice-deep/abyss gradients,
   three orbiting ice-shard polygons, `ice-light` eyes. Aura `ice-glow`.
4. **`sprites/enemies/rime_fiend.svg`** — 512×512. FR roster 2: squat
   crystalline brute — hexagonal faceted body (the essence-crystal facet
   logic in ice colors), stalagmite spikes down the back, `ice-veil`
   glint facets, `ice-light` eyes.
5. **`sprites/enemies/hollow_sentinel.svg`** — 512×512. FR roster 3: tall
   broken statue-guardian — rectangular cracked-monolith silhouette
   (ice-abyss darks), a single horizontal visor-eye in `ice-light`,
   floating fracture fragments beside the shoulders.
6. **`sprites/enemies/silent_colossus.svg`** — FR world boss.
   **DEFERRABLE** (players reach level 100 weeks out; the data slot may
   ship pointing at `hollow_sentinel.svg` with a `TODO(content)` until
   the art lands in a content drop).

**Elder variant rule (no new art):** Elder bosses reuse the base
creature's SVG at the 1.3× view scale with boss dressing, and their
`EnemyDefinition.glow_color` is set to `danger-light` — spawn/death
particles turn ember, which reads as "same species, wrong weight class."
No modulate tint: multiplying these dark faceted bodies muddies them
(verified visually in M2 flash work).

**Explicitly NOT needed:** ☠ as a text glyph (font-fallback seam — the
icon asset exists precisely for this); a BossPlate panel texture (it is
label + icon only); win/fail banner bespoke scenes (parameterized Result
Banner per UX §7.2); FR-recolored UI icons (world identity lives in sky
+ roster, not in chrome).

---

## 4. Accessibility Verification (computed, composited)

| text | color | against | ratio | verdict |
|---|---|---|---|---|
| Boss name 42px | danger-light | brightest DF sky patch | **8.6:1** | pass |
| Boss name 42px | danger-light | toast/banner bg | **8.4:1** | pass |
| Timer numerals 28px | white on 6px dark outline | any fill state | **15.4:1** | pass (outline-anchored) |
| ~~Timer numerals, bare~~ | white | normal / urgent fill | 3.7 / 3.0 | **fail → outline required (§2C)** |
| Fail-banner headline 40px | standard label | banner bg | **15.1:1** | pass |
| World name 64px | TitleLabel recipe | ModalCard bg | **15.9:1** | pass (M4-measured, unchanged) |
| Multiplier line 28px | violet-light | ModalCard bg | **10.6:1** | pass |
| WorldLabel/StageLabel muted | `Color(0.62,0.57,0.75)` | FR brightest patch | **4.6:1** | pass (palette tuned down to achieve this) |
| Damage numbers | white + existing outline | FR brightest patch | **11.7:1** | pass |
| ~~Footer grey~~ | `Color(0.45,0.41,0.56)` | FR bottom-edge patch | 3.4:1 | **fail → global brighten (§2G)** |
| Footer (adjusted) | `Color(0.55,0.51,0.68)` | FR bottom-edge patch | **4.9:1** | pass |

No state is color-only (verified per-state in UX §5; the ember family is
always accompanied by icon/text/structure). CVD: ember vs gold separates
on lightness, ember vs crimson on blue axis, ice vs teal on hue distance
+ role (creatures vs UI chrome) — and never load-bearing.

---

## 5. Consistency Notes

Radius grammar unchanged (12 bars, 16/18 buttons, 20 cards). Border
grammar: 1px translucent passive, 2px emphasis — boss dress uses 1px
(it is a state, not a control). Glow hierarchy preserved: nothing
out-glows PrimaryButton hover (22); boss glows sit at 10, banners 18.
Type roles: Cinzel stays ceremonial (boss names, banner headlines, world
name), data stays default-face (timer numerals, payouts, durations).
Ember and ice join violet/teal as scoped accents — one meaning each:
violet = the game/rewards, teal = auto-attack, ember = boss threat,
ice = Frozen Ruins creatures. The sky palettes recolor only the shader
uniforms; every surface, border, and text color in the HUD is
world-invariant by design (and §4 proves it survives the brightest sky).
