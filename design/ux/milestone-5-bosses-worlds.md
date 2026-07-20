# Milestone 5 UX Spec — Boss Battles, World Progression & Unlocks

Author: ux-designer · Status: revised after Phase 1c review round 1
Serves: `design/player-journey.md` Stage 6 (First Boss) and Stage 7
(World Unlock).

Game-design decisions taken as fixed (not re-derived here): a boss guards
every 10th enemy level and is auto-entered on arrival; the fight is a
single big enemy on a ~30s countdown with several-times-normal HP; taps
and auto-attack both work during it; a win pays several levels' worth of
essence and opens the next level; a loss drops the player to farming
level N−1 with a free, unlimited retry; the level-50/100/150 boss is a
world boss whose defeat permanently unlocks the next 50-level world, and
play continues there immediately. The exact numbers (timer seconds, HP
multiple, payout multiple) are being tuned by simulation in parallel —
**every presentation below is parameterized and stays correct whatever
those numbers turn out to be** (the timer display reads identically at
20s or 45s; the payout line formats any magnitude via `NumberFormat`).

---

## 1. Overview

Three connected features that give the infinite kill-loop its first walls
and its first doors:

1. **Boss encounters.** Every 10th enemy level, the respawn loop delivers
   a boss instead of a normal enemy: bigger art, a name plate, a boss-dressed
   health bar, and a countdown Timer Bar. Combat input is *unchanged* —
   taps and auto-attack hit the boss through the exact same
   `player_tap_attack()` / `auto_attack()` path, with the same Floating
   Damage Numbers and Enemy Animation States. The boss fight is normal
   combat wearing dramatic clothes, plus one new resource: time.
2. **Fail → farm mode.** A timer expiry is a redirect, never a dead end
   (Stage 6's hardest requirement). The boss withdraws — it is not
   "defeated you," it simply *endures* — the player farms level-N−1
   enemies that still pay essence, and a persistent full-width
   **CHALLENGE BOSS** button owns the bottom of the screen until they win.
   Nothing is lost at fail: no essence, no levels, no cooldown.
3. **World unlock.** Defeating a world boss triggers the game's biggest
   celebration to date: a blocking World Unlock modal (the Centered Modal
   Dialog pattern, second consumer) that reveals the new world's name
   while the nebula sky *visibly recolors behind the scrim*. Dismissing it
   lands the player at the new world's first level with new enemies under
   a new sky — the unlock is something they can see, not just a label
   (Stage 7's stated need). Unlocks are permanent and are granted at the
   moment of the kill, before any presentation, so no crash or interruption
   can ever take one back.

Grading criteria from `player-journey.md`: Stage 6 — "this is different
and dangerous" must be readable with zero tutorial text, and losing must
say "grow stronger, then come back" with an obvious retry path. Stage 7 —
a "new chapter" moment bigger than any celebration so far, acknowledged
before play continues, followed by *immediately visible* change and a
sense of permanence.

---

## 2. User Flow

### 2A. Boss gate — enter, win, fail

```
Player kills the level-9 enemy (tap or auto-attack — no difference)
        │
        ▼
CombatManager.enemy_level advances to 10 (a boss gate)
        │
        ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ Unobstructed-screen check — boss entry DEFERS while any of:  │
   │  · a blocking modal (layer 60) is on screen                  │
   │  · the upgrade shop panel is open                            │
   │  · the gameplay scene is not current / a transition is live  │
   │ The spawn simply holds (empty combat area) until clear.       │
   │ Mechanism (fully specified in §4E): overlays announce their   │
   │ own open/close on the EventBus; CombatManager counts them     │
   │ and tracks the current scene from the existing transition     │
   │ signals. When the count hits zero on the gameplay scene, any  │
   │ held boss entry proceeds.                                     │
   └─────────────────────────────────────────────────────────────┘
        │ screen clear
        ▼
BOSS ENTRANCE (~1.1s total, never input-blocking):
  boss spawns big (same EnemyView spawn state, boss-scaled art)
  + BossPlate slams in over the enemy-name slot ("☠ HOLLOW WARDEN")
  + StageLabel → "Boss · Lv. 10"
  + HealthBar swaps to boss dress and refills
  + TimerBar appears below the health bar, full, NOT yet ticking
  + one "milestone" haptic (~50ms, Haptics setting respected)
        │
        ▼
Timer starts ticking only when the entrance settles. (The boss is
damageable from its first spawn frame — any tap or auto-attack tick
during the entrance already counts. Player-favorable by design.)
        │
        ▼
FIGHT: identical combat loop — taps, auto-attack, crits, damage
numbers, hit squash, haptics. Shop may be opened mid-fight (§6);
the timer keeps running — shopping mid-boss is a deliberate
speed-vs-power gamble, not a pause.
        │
   ┌────┴──────────────────────────────┐
   │                                    │
Boss HP reaches 0                  Timer reaches 0:00
before the timer                   before HP reaches 0
   │                                    │
   ▼                                    ▼
WIN (see 2B for the                FAIL → FARM MODE (see 2C)
world-boss branch):
  boss death animation (existing state, particles scaled up)
  + big essence payout, granted immediately
    (essence counter pops via Currency Pop/Bounce)
  + Transient Result Banner: "BOSS FELLED  +12.4K Essence"
  + strongest combat haptic yet (~60ms)
  + TimerBar freezes, then fades out with the BossPlate
  + CHALLENGE BOSS button (if present) pops out
        │
        ▼
Level 11 enemy spawns after an extended beat (~1.0s vs the normal
0.45s respawn) — the moment gets one breath, then the loop resumes.
StageLabel → "Enemy Lv. 11". Wall broken, visible progress (Stage 6).
```

### 2B. World-boss win → world unlock

```
The boss at level 50 / 100 / 150 dies (same WIN path as 2A, except:)
        │
        ▼
UNLOCK IS GRANTED AND SAVED IMMEDIATELY at the kill:
  WorldManager records the new world as unlocked (permanent),
  essence payout lands, SaveManager.save_game() runs.
  Presentation is only presentation from here on — a crash,
  force-quit, or dead battery can never lose the unlock.
  (Same grant-then-present idiom as offline rewards, M4 §4C.)
        │
        ▼
No Result Banner (the modal IS the celebration — never both)
        │  ~0.6s beat: death animation + payout pop play out
        ▼
WORLD UNLOCK MODAL (Centered Modal Dialog, layer 60, blocking):
  kicker "WORLD UNLOCKED" → world name "FROZEN RUINS" pops in
  a staged half-second later (the name reveal is the headline act)
  + payout figure with Hold-to-Reveal exact amount
  + permanence line ("…yours — forever") + "Levels 51–100"
  + single ENTER button, live from the first frame
        │
        │   Behind the 0.72-alpha scrim, once the card settles:
        │   the nebula palette tweens Dark Forest → Frozen Ruins
        │   over ~0.8s, faintly visible through the scrim — the
        │   world changes while the player reads its name.
        ▼
Player taps ENTER (whenever they choose — no timeout)
        │
        ▼
Modal exits (pattern-standard 0.18s/0.2s) revealing the recolored sky
  + WorldLabel crossfades "DARK FOREST" → "FROZEN RUINS" with a
    one-time scale pop (the badge-pop idiom)
  + first Frozen Ruins enemy (Lv. 51, new roster) spawns with the
    normal spawn animation — new creature under a new sky, immediately
        │
        ▼
Normal combat continues in World 2. No world-select screen exists this
milestone; navigation back to unlocked worlds is explicitly future work.
```

### 2C. Fail → farm mode → retry loop

```
Timer reaches 0:00 with the boss still alive
        │
        ▼
FAIL MOMENT (~2s, nothing blocked, nothing taken away):
  boss WITHDRAWS — fade + shrink, NO death particles, NO reward
  (a new minimal EnemyView micro-state; the boss leaves, it does
  not die — visually distinct from every kill the player has seen)
  + TimerBar freezes at 0:00, then fades out with the BossPlate
  + Transient Result Banner: "THE BOSS ENDURES — farm essence, grow
    stronger, challenge again anytime." (redirect copy, Stage 6)
  + NO haptic (haptics in this game mark rewards and impacts;
    buzzing a failure would read as punishment)
        │
        ▼
FARM MODE:
  CHALLENGE BOSS button pops in, full width, PrimaryButton style —
    the mode's primary action gets the game's primary-action dress
  StageLabel → "Enemy Lv. 9 · Boss at Lv. 10"
  Level-9 enemy spawns after the normal 0.45s respawn
        │
        ├───────────────────────────────────────────────┐
        ▼                                               │
  Player farms: level-9 enemies pay normal level-9      │
  essence forever; kills do NOT advance enemy_level     │
  (progression above the gate is walled until the win). │
  Auto-attack farms too. Offline rewards accrue at      │
  this same farm rate, honestly (§6). The player may    │
  shop, leave to the menu, or close the app — farm      │
  mode is fully persistent.                             │
        │                                               │
        ▼                                               │
  Player taps CHALLENGE BOSS (their choice, their       │
  timing — free, unlimited):                            │
    farm enemy withdraws (~0.4s, same micro-state)      │
    → BOSS ENTRANCE replays exactly as in 2A            │
    (~1.1s tap-to-ticking — snappy enough to never      │
    make retrying feel like a chore)                    │
        │                                               │
        ▼                                               │
  WIN → 2A win path, farm mode ends, button pops out    │
  FAIL → banner + button return ────────────────────────┘
```

---

## 3. Wireframes

Reference canvas 1080×1920, matching `scenes/gameplay/gameplay.tscn`'s
`MarginContainer` (margins 40/40/40/28) and `GameplayVBox` (separation
18). Y-values are derived from the scene's real node sizes, accurate to
roughly ±25px. The first boss (level 10) happens *before* the Auto-Attack
badge exists (unlock is level 15), so 3A uses the badge-less top bar; from
level 20 on, everything shifts down ~38px with the badge present, exactly
as M4 §3B described — nothing below changes.

Per the Phase-4 lesson from last milestone, **every new node states its
`mouse_filter` explicitly in this spec** — container defaults have caused
interactive-blocking bugs before, so no new element is allowed to rely on
a default.

### 3A. Boss fight HUD (new nodes: BossPlate, TimerBar; dressed: HealthBar)

```
x=40                                                          x=1040
y=40   ┌──────────────────────────────────────────┬──────────┐
       │ DARK FOREST                               │  MENU    │
       │ Boss · Lv. 10          ◄── StageLabel     │  button  │
y=136  └──────────────────────────────────────────┴──────────┘
y≈154            [essence icon]  12.4K            ◄── unchanged
y≈230  ┌────────────────────────────────────────────────────┐
       │            ☠  HOLLOW WARDEN                         │ ◄── BossPlate
y≈288  └────────────────────────────────────────────────────┘     (replaces
y≈306  ┌────────────────────────────────────────────────────┐      EnemyName-
       │████████████████████░░░░░░░░  28.1K / 40.2K          │      Label's slot)
y≈366  └────────────────────────────────────────────────────┘ ◄── HealthBar,
y≈384  ┌────────────────────────────────────────────────────┐      boss dress,
       │██████████████████████████░░░░░░   0:21              │      46→60 tall
y≈424  └────────────────────────────────────────────────────┘ ◄── TimerBar (NEW)
y≈442  ┌────────────────────────────────────────────────────┐
       │                                                     │
       │                 (boss art, ~1.3× the                │
       │                  normal enemy scale,                │ ◄── CombatArea
       │                  same EnemyView, same               │     (~1220px tall,
       │                  spawn/idle/hit/death               │      all tappable)
       │                  animation states)                  │
       │                                                     │
y≈1662 └────────────────────────────────────────────────────┘
y≈1680   Void creatures slain: 214            ◄── unchanged
y≈1734 ┌────────────────────────────────────────────────────┐
       │                    UPGRADES                          │ ◄── unchanged
y≈1844 └────────────────────────────────────────────────────┘
        Session #4                              12m 30s
```

- **BossPlate** — a new HBox row occupying the same `GameplayVBox` slot as
  `EnemyNameLabel` (which hides for the fight's duration; same ~58px
  height, so swapping them causes no reflow): skull icon 36×36 (NEW asset,
  `sprites/ui/boss_skull_icon.svg`, essence-icon construction rules — see
  asset note in §4A) + boss name in the `HeaderLabel`/Cinzel treatment at
  the same 42px as `EnemyNameLabel`, in a danger accent family (crimson/
  gold territory — exact values are the art director's Phase 2 call; the
  UX requirement is only *distinct from violet, teal, and the crit gold*,
  and never the sole boss signal — the skull icon, the "Boss ·" stage
  text, the TimerBar, and the larger art all carry the state without
  color). Row and children `mouse_filter = IGNORE` (explicit — HBox
  containers do not default to it).
- **StageLabel** — text becomes `"Boss · Lv. 10"` (world boss:
  `"World Boss · Lv. 50"`). Same node, same font, same position.
- **HealthBar** — same node; gains a `BossHealthBar` theme variation for
  the fight (art director defines it; requirement: distinguishable by
  more than hue — this spec sets `custom_minimum_size.y` 46 → 60 during
  boss fights as the guaranteed non-color cue). `HealthLabel` inside it
  is unchanged: `"28.1K / 40.2K"` via `NumberFormat`. Everything below
  reflows down 14px at boss start and back at boss end — imperceptible
  against CombatArea's ~1220px, and a subtle secondary "mode changed"
  cue, the same trick M4 used with the badge row.
- **TimerBar** (NEW — pattern proposal §7.1) — a new `GameplayVBox` child
  between `HealthBar` and `CombatArea`, full width × 40px, visible only
  during boss fights (+58px total shift with its separation). It is the
  Countdown Timer Bar pattern: a `ProgressBar` draining left→right from
  the configured duration to zero, with a centered label *inside* the bar
  reading `M:SS` ("0:21") — the exact label-inside-bar idiom `HealthBar` +
  `HealthLabel` already established, so the two bars read as siblings:
  *their* resource above, *your* resource below. Works identically for
  any tuned duration: `max_value` = whatever the balancing sim picks, the
  label formats any value, no layout depends on digit count. The label is
  **28px** — above the 24px accessibility floor and a step past
  `HealthLabel`'s 26px, because these numerals are the load-bearing
  urgency signal (§5) and the densest glyphs on the HUD. Bar, label:
  `mouse_filter = IGNORE` (explicit).
- **Urgency state** (final stretch): when remaining time ≤
  `min(10s, duration / 3)` — 10s on a 30s timer, ~7s on a 20s timer — the
  TimerBar shifts to the danger accent AND begins a 0.6s-cycle opacity
  pulse AND the label keeps counting. Three simultaneous signals; the
  numeric countdown alone is sufficient (accessibility §5).

### 3B. Farm mode HUD (new node: ChallengeBossButton)

```
x=40                                                          x=1040
y=40   ┌──────────────────────────────────────────┬──────────┐
       │ DARK FOREST                               │  MENU    │
       │ Enemy Lv. 9 · Boss at Lv. 10              │  button  │
y=136  └──────────────────────────────────────────┴──────────┘
y≈154            [essence icon]  13.1K
y≈230              Gloom Wisp                     ◄── EnemyNameLabel, normal
y≈306  ┌────────────────────────────────────────────────────┐
       │███████████████░░░░░░░░░░░░░░   31 / 46              │ ◄── normal dress,
y≈352  └────────────────────────────────────────────────────┘     46px again
y≈370  ┌────────────────────────────────────────────────────┐
       │              (level-9 enemy, normal                 │
       │               scale — pays essence,                 │ ◄── CombatArea
       │               never advances the level)             │     (~1180px)
y≈1552 └────────────────────────────────────────────────────┘
y≈1570   Void creatures slain: 219
y≈1606 ┌────────────────────────────────────────────────────┐
       │              ⚔  CHALLENGE BOSS                      │ ◄── NEW, Primary-
y≈1716 └────────────────────────────────────────────────────┘     Button style
y≈1734 ┌────────────────────────────────────────────────────┐
       │                    UPGRADES                          │
y≈1844 └────────────────────────────────────────────────────┘
        Session #4                              13m 05s
```

- **ChallengeBossButton** — a new full-width, 110px-tall button inserted
  into `GameplayVBox` between `KillsLabel` and `UpgradesButton`, visible
  only in farm mode. `theme_type_variation = &"PrimaryButton"` — in farm
  mode, retrying the boss *is* the primary action, and per the Button
  Styles pattern the primary action wears the violet fill and glow. It
  deliberately sits *above* UPGRADES: the eye travels enemy → kills →
  CHALLENGE BOSS, and the one glowing element on the screen is the retry
  path (Stage 6: "an obvious retry path, never a dead end").
  Touch target ~1000×110 — an order of magnitude over the 96px floor. A
  side-by-side split with UPGRADES was considered and rejected: it would
  halve both targets, break UPGRADES' established full-width muscle
  memory, and visually demote the retry to a secondary action.
  CombatArea gives up 128px (110 + separation) while it exists; at
  ~1180px remaining, the tap area is still enormous.
  Text `"CHALLENGE BOSS"` (Cinzel via PrimaryButton, fits comfortably at
  1000px width). The gate level is already stated 30px away in
  StageLabel's `"· Boss at Lv. 10"` suffix, so the button stays short and
  loud.
- **StageLabel** — `"Enemy Lv. 9 · Boss at Lv. 10"`: current farm level
  plus the wall's location in one line. The wall is thus stated in words
  (label) and affordance (button) — never inferred from a missing thing.

### 3C. Transient Result Banner (win and fail variants)

Same geometry, layer, and motion as the Unlock Celebration Toast (x
140–940, y ≈ 430–610, CanvasLayer 50, `mouse_filter = IGNORE` on every
node, explicitly — the M4 implementation notes documented that
PanelContainer does not default to IGNORE and eats taps when forgotten).
During a boss fight nothing ever occupies this region (the TimerBar ends
at y≈424), and banners only ever appear *after* a fight ends, so a banner
never covers the timer or either health bar.

```
WIN                                        FAIL
┌────────────────────────────────┐   ┌────────────────────────────────┐
│           ☠→✦                  │   │              ☠                 │
│         BOSS FELLED             │   │        THE BOSS ENDURES        │
│   +12.4K Essence — the path     │   │  Farm essence, grow stronger — │
│        ahead is open.           │   │   challenge again anytime.     │
└────────────────────────────────┘   └────────────────────────────────┘
   headline: Cinzel, celebratory        headline: Cinzel, neutral —
   accent (art director)                NOT the danger accent; failure
                                        copy redirects, it never scolds
```

Two lines max, exactly like the M4 toast. The payout figure uses
`NumberFormat` abbreviation; the same amount has already landed in the
always-visible essence counter (which popped), so the exact value is one
Hold-to-Reveal retrofit away (M4 §8's open item, unchanged). Unlike the
Unlock Celebration Toast this banner is **repeatable** — it plays on
every boss result, which is why it is a distinct pattern (§7.2) rather
than a reuse of the once-per-save toast.

### 3D. World Unlock Modal (Centered Modal Dialog — second consumer)

Layer 60, `%Scrim` (`mouse_filter = STOP`, `SceneManager` fade color at
0.72 alpha — same as the offline modal), `%Card` (`mouse_filter = STOP`),
`%ConfirmButton` — the exact `CenteredModalDialog` script contract. Card
is taller than the offline modal's 860×600: ~860×720, centered (x
110–970, y ≈ 600–1320), because the name reveal needs headline-scale type.

```
Scrim: full 1080×1920 — and BEHIND it, once the card settles, the
nebula sky visibly tweens to the new world's palette (§4C)

x=110                                                      x=970
y≈600 ┌────────────────────────────────────────────────────┐
      │                                                      │
      │                 WORLD UNLOCKED                       │  kicker, 30px
      │                                                      │
      │            ✦   FROZEN RUINS   ✦                     │  Cinzel ~64px,
      │                                                      │  pops in staged
      │        The Dark Forest falls behind you.             │  ~0.5s after
      │           This world is yours — forever.             │  the card
      │                                                      │
      │               Levels 51 – 100                        │
      │                                                      │
      │              [essence icon]                          │
      │              +84.2K Essence                          │
      │        (tap and hold for exact amount)               │  Hold-to-Reveal
      │                                                      │
      │        ┌──────────────────────────────┐              │
      │        │            ENTER              │              │  PrimaryButton
      │        └──────────────────────────────┘              │  ~500×110
      │                                                      │
y≈1320└────────────────────────────────────────────────────┘
```

- **Fits the pattern; needs only a content variant, not a new pattern.**
  Everything structural is pattern-standard: scrim, card, exactly one
  dismiss action, no tap-outside, no timeout, button live from frame one,
  standard entrance/exit tweens. The variant elements are (a) the staged
  world-name pop (a content animation inside the card — it never gates
  the ENTER button), and (b) the behind-scrim palette transition, which
  belongs to the world sky, not to the modal (§4C). An in-card
  before/after palette swatch was considered and rejected: the *actual
  sky* changing behind the scrim is the before/after, at full screen
  size, in the real material — a thumbnail preview would only compete
  with it.
- `✦` flourishes reuse `sprites/ui/star_flourish.svg` (the M4 asset,
  explicitly built for "any Centered Modal Dialog headline").
  Payout figure reuses the Hold-to-Reveal Exact Number pattern exactly as
  the offline modal implements it (`mouse_filter = STOP` on that label
  only).
- Button text is `"ENTER"` — one Cinzel word, unmistakable, and honest:
  the world beyond this card is already unlocked and already recolored;
  the button enters it. (COLLECT would be wrong — the essence is already
  granted; CONTINUE undersells the moment.)
- World-boss fights on later worlds produce the same modal with the next
  world's name. The modal never lists features ("crafting planned") —
  future mechanics announce themselves in their own milestones.

### 3E. Shop open during a boss fight — layout verification

`UpgradeShopPanel` opens to `offset_top = -1010` → it covers y 910–1920.
Against 3A's geometry, everything fight-critical sits above y≈442:

```
y    0–424   TopBar · Essence · BossPlate · boss HealthBar · TimerBar
             — ALL fully visible above the sheet
y  442–910   upper CombatArea: ~468px of live tap target, including
             the top of the boss art (boss sprite spans ~y 727–1377)
y 910–1920   shop sheet (browsing, buying — per its pattern, the
             screen above stays tappable)
```

Verified: shopping mid-boss is fully supported by the existing layout
with zero changes. The player watches the timer drain and the boss HP
tick (auto-attack keeps hitting) while they buy damage — the exact
strategic loop the game design intends. The timer deliberately keeps
running (§4A). The ChallengeBossButton only exists in farm mode, where
there is no timer, so it being covered by the open sheet costs nothing.

### 3F. Top bar after a world unlock (ongoing identity)

```
x=40                                                          x=1040
y=40  ┌──────────────────────────────────────────┬──────────┐
      │ FROZEN RUINS                              │  MENU    │
      │ Enemy Lv. 51                               │  button  │
      │ ⚡ AUTO-ATTACK ACTIVE                       │          │
y≈174 └──────────────────────────────────────────┴──────────┘
        (sky behind everything: the Frozen Ruins nebula palette)
```

`WorldLabel` becomes data-driven (it is currently the hardcoded string
"DARK FOREST" in the scene file) — it renders
`WorldManager.get_current_world().display_name`, always. World identity
is carried by three permanent, simultaneous signals: the label (words),
the sky palette (color — never alone), and the enemy roster (shape).

---

## 4. Interaction Details

### 4A. Boss encounter — entrance, timer, combat

- **Trigger:** `CombatManager` reaches a gate level (any multiple of 10)
  via its normal kill loop. Instead of the standard respawn, it enters
  the boss flow — after the unobstructed-screen check in §2A. The boss is
  announced with a new EventBus signal
  `boss_fight_started(definition, level, max_hp, duration)`; the boss
  itself also fires the ordinary `enemy_spawned` so `EnemyView` and the
  HUD render it through their existing handlers.
- **Boss data is content, not code:** bosses are `EnemyDefinition`
  resources (per-world, in `data/enemies/`), extended with an
  `is_boss: bool` and a view scale (~1.3× — final value with the art
  director), plus distinct larger art. `EnemyView` renders them through
  the same four animation states; the only view change is the scale and
  one new micro-state (withdraw, §4B). One boss = one `.tres` + one
  sprite, matching the Data-Driven Content Rows philosophy.
- **Entrance choreography (~1.1s, never blocking):** boss spawn pop
  (existing spawn state, reads bigger because the art is bigger) → 
  BossPlate slam (scale 1.4 → 1.0, `TRANS_BACK`/`EASE_OUT`, 0.3s — the
  project's bounce idiom at higher amplitude) + HealthBar re-dress and
  refill + StageLabel swap → TimerBar slides in (0.25s) showing the full
  duration, static → timer begins. One ~50ms milestone haptic at the
  slam (Haptics setting respected, paired with visuals as always).
  Input is live throughout: the boss is damageable from its first frame,
  and the timer only starts when the entrance settles — the animation can
  only ever *give* the player time, never cost it (Enhanced motion rule,
  applied in spirit and letter).
- **During the fight, combat is untouched:** taps through the
  Tap-to-Attack Combat Area, auto-attack ticks from `IdleManager`
  (deliberately not paused — auto-attack is part of the player's built
  power and the tuning sim accounts for it), Floating Damage Numbers,
  crit treatment, hit squash + flash, kill/crit haptics. Zero new input
  vocabulary: Stage 6 asks the danger to be readable *without* the
  mechanics changing underneath the player's finger.
- **Timer rendering:** the countdown is `CombatManager` state; the HUD
  reads `CombatManager.get_boss_time_remaining()` in `_process()` — the
  exact precedent of `PlayTimeLabel` polling `GameManager`. The bar
  drains smoothly (per-frame), the label updates per second. Urgency
  threshold as in §3A. The timer is game-time (pausable with the
  SceneTree), so OS backgrounding freezes it (§6).
- **Timer keeps running while the shop is open** — a deliberate design
  statement, not an oversight: the Slide-Up Panel's whole point is that
  the game continues behind it, and pausing would turn every boss into a
  solved puzzle (shop forever, win always). The visible drain above the
  sheet (§3E) makes the cost of shopping legible in real time.
- **Asset note (art director):** `sprites/ui/boss_skull_icon.svg`,
  128×128 canvas, glow-disc + faceted-polygon construction per the M4
  asset manifest idiom, in the danger accent family; used at 36×36 in
  the BossPlate and at ~56×56 in Result Banners. As with M4's bolt: an
  emoji/text glyph is not acceptable (font-fallback seam).

### 4B. Fail → farm mode → retry

- **Trigger:** the timer reaches zero with the boss alive.
  `CombatManager` emits `boss_fight_failed(level)`, enters farm mode
  (persisted — §4E), and the presentation plays: boss **withdraw**
  (new `EnemyView` micro-state: ~0.4s fade + shrink toward 0.7 scale,
  no particles, no rotation — pointedly *not* the death animation; the
  player has seen hundreds of deaths and this must not read as one),
  TimerBar freezes at 0:00 for a beat then fades with the plate, fail
  banner (§3C) plays, ChallengeBossButton pops in (badge-pop idiom,
  0.24s), farm enemy spawns after the standard 0.45s respawn.
- **No haptic on fail** (reasoned in §2C). No essence change, no stat
  change, no cooldown — the fail costs literally nothing but the walk
  back, and the copy says where the door is.
- **Farm mode rules:** enemies spawn at gate-level−1 from the normal
  world roster; they pay their normal level-(N−1) essence; kills
  increment `total_kills` but **never advance `enemy_level`** — the wall
  holds until the win. Farm mode survives shop visits, menu round-trips,
  app restarts, and offline periods (§6).
- **Retry:** tapping CHALLENGE BOSS despawns the current farm enemy via
  the same withdraw micro-state (~0.4s, matching the boss withdraw
  exactly — one micro-state, one duration; no reward — it leaves, it isn't
  killed; awarding a free kill here would teach players to fish for
  retries) and replays the full entrance of §4A. Tap-to-ticking is
  ~1.1s. Retries are free and unlimited; the entrance is kept identical
  on every attempt — at ~1.1s it is short enough that consistency beats
  a special shortened variant (revisit only if playtests say otherwise,
  §8). The button ignores re-taps once the transition starts
  (`disabled` until resolution) so double-taps cannot double-enter.
- **Win from farm mode:** the win path of §2A plus the button's exit
  (scale/fade out 0.2s, layout reflows back). StageLabel drops its
  "· Boss at Lv. N" suffix.

### 4C. Boss win, world-boss win, and the palette transition

- **Regular boss win:** `CombatManager` emits
  `boss_fight_won(level, payout, is_world_boss=false)` and grants the
  payout immediately via `CurrencyManager.add()` with
  `essence_earned` source `&"boss"` (the source enum grows by one).
  The essence counter pops (existing Currency Pop/Bounce — free), the
  win banner (§3C) shows the amount, the ~60ms haptic fires (a step
  above the 35ms kill buzz, a step above meaning "wall broken"), and
  the next level's enemy spawns after ~1.0s. Deliberately a banner and
  not a modal: there are five bosses per world; a must-acknowledge
  interruption every 10 levels would turn celebration into friction.
  The Centered Modal Dialog stays reserved for the one per-world moment
  that genuinely warrants stopping play.
- **World-boss win:** same win mechanics, `is_world_boss=true`, no
  banner. `WorldManager` (listening on the EventBus) records the unlock,
  advances the current world, saves immediately, and emits
  `world_unlocked(world)`. The gameplay scene presents the World Unlock
  modal after the ~0.6s death-and-payout beat. Because grant precedes
  presentation, the modal is pure ceremony (like COLLECT in M4 — 
  acknowledgment, not a claim action).
- **The palette transition — decided: animated behind the scrim, not an
  instant swap.** Once the modal card settles (~0.45s in), the
  `VoidBackground` shader's three uniforms (`deep_color`,
  `nebula_color`, `accent_color`) tween from the old world's set to the
  new world's over ~0.8s. Through the 0.72-alpha scrim the player
  *watches the sky change while reading the world's name* — the unlock
  becomes visible during its own announcement, which is precisely
  Stage 7's "the unlock feels real, not just a label." Enhanced-tier
  motion check: it is a one-shot ~0.8s tween, blocks nothing (ENTER is
  live from frame one; a player who dismisses instantly simply watches
  the last fraction finish in full view), and carries no information
  that the WorldLabel and enemy roster don't also carry. An instant
  swap was rejected because a full-sky discontinuity behind a
  semi-transparent scrim reads as a rendering glitch, not a reward.
- **On ENTER:** modal exits (pattern-standard), WorldLabel crossfades to
  the new name with a one-time pop, `CombatManager` spawns the new
  world's first enemy (gate+1, new roster) through the normal spawn
  path. The world's essence multiplier applies from this kill onward —
  mechanically invisible this milestone (no HUD multiplier readout; a
  future world-select screen is the natural home for that number, §8).
- **Cold-load palette:** on any load, `VoidBackground` reads the current
  world's palette and applies it instantly before the scene fades in.
  Transitions are for live unlocks only — the exact principle M4
  established for the unlock toast (celebrations never replay on load).
- **Engineering note — per-instance shader material:** the
  `VoidBackground` scene's ShaderMaterial is a shared sub-resource; as
  shipped, tweening the gameplay instance's uniforms would recolor the
  main menu's cached copy too, breaking §4D's "menu keeps the brand
  palette." The material must be made per-instance
  (`resource_local_to_scene = true` on the ShaderMaterial, or the
  world-tinting code operates on a runtime `duplicate()` assigned to the
  gameplay instance only).

### 4D. Ongoing world identity

- `WorldLabel` = current world name, always, from `WorldManager`
  (§3F). The label is never the only signal: palette + roster travel
  with it.
- Worlds are `WorldDefinition` resources (`data/worlds/`): display name,
  level range, enemy roster (paths), the three nebula palette colors,
  essence multiplier. Adding World 6 is a data drop, per the
  architecture's content-as-data rule.
- The main menu's `VoidBackground` instance keeps the default brand
  palette; only the gameplay instance is world-tinted. The menu is the
  game's identity, the gameplay screen is the world's — and the moment
  of pressing PLAY landing you under *your* current sky keeps the
  "where was I" answer inside the gameplay screen where it belongs.
- No world-select / world-travel UI this milestone (fixed decision).
  Navigation between unlocked worlds is future work; the permanence
  promise ("worlds never re-lock") is carried now by the modal's copy
  and by the save structure (§4E), so the future screen inherits an
  already-true fact.

### 4E. System ownership

Per `docs/ARCHITECTURE.md`, UI owns nothing; every new piece of state has
a named manager owner:

- **A new `WorldManager` autoload** (registered between `PlayerStats`
  and `CombatManager`, so `CombatManager` may call downward into it for
  roster/multiplier queries): owns the `WorldDefinition` set, the
  current/highest-unlocked world (its own `"world"` save section via
  `SaveManager.register_saveable`), the per-world palette data, and the
  persisted `unlock_celebration_pending` flag (§6). It listens for
  `boss_fight_won(is_world_boss=true)` on the EventBus, performs the
  unlock + immediate save, and emits `world_unlocked(world)`. It never
  touches scenes.
- **`CombatManager` stays the only combat owner:** the boss state
  machine (normal / boss_fight / farm_mode — farm_mode persisted in its
  existing `"combat"` save section), gate detection, the countdown
  (game-time, exposed via `get_boss_time_remaining()`), boss HP through
  the existing `enemy_hp` path, farm-level spawning (gate−1, no level
  advance), the unobstructed-screen entry deferral, payout granting,
  and the new signals: `boss_fight_started`, `boss_fight_won`,
  `boss_fight_failed`. Bosses flow through the existing
  `_spawn_enemy`/`_apply_damage` internals so taps, auto-attack, crits,
  and every existing signal work unmodified. Mid-fight state (remaining
  time, boss HP) is deliberately **not** saved — see §6.
- **The unobstructed-screen check's inputs, mechanized.** Two sources,
  neither an upward call:
  1. *Overlay presence:* the EventBus gains a pair of presentation
     signals, `ui_overlay_opened` / `ui_overlay_closed`, emitted by the
     shop panel (open/close) and by every Centered Modal Dialog
     (`_ready`/exit). `CombatManager` maintains a simple counter from
     them. These carry no game state — they are presentation facts
     announced on the bus, the same direction UI already reports taps.
  2. *Current scene:* `CombatManager` tracks
     `scene_transition_started`/`finished` (existing EventBus signals)
     to know whether the gameplay scene is current. So the comparison
     constant is legal downward, the autoload order changes this
     milestone: `SceneManager` moves ABOVE `WorldManager` and
     `CombatManager` (new order: ... PlayerStats, SceneManager,
     WorldManager, CombatManager, IdleManager). Every direct call in
     the codebase remains strictly downward under the new order; the
     engineer must re-verify the M4 connect-ordering comment in
     IdleManager still holds (it does — IdleManager stays last).
- **`IdleManager`** is unchanged in role; its offline rate computation
  gains one input: it prices kills at `CombatManager`'s *effective farm
  level* (gate−1 whenever the player is at a wall) instead of raw
  `enemy_level` (§6), with the world essence multiplier flowing through
  `get_essence_reward()` automatically.
- **UI (`gameplay.gd`, BossPlate, TimerBar, ChallengeBossButton, the
  banners, the World Unlock modal, `VoidBackground`)** owns nothing: it
  renders manager state and EventBus signals, polls the timer read-only,
  and reports exactly two *actions* — the CHALLENGE BOSS tap
  (→ `CombatManager.request_boss_challenge()`) and the modal's ENTER
  (→ dismiss + `WorldManager.acknowledge_unlock_celebration()`) — plus
  the passive overlay open/close announcements described above, which
  are presentation facts, not decisions.
  `_render_current_state()` grows branches for boss-fight and farm-mode
  so re-entering the scene mid-state renders correctly, exactly as it
  already does for the badge and enemy state.

---

## 5. Accessibility Notes

Mapped against the committed **Enhanced** tier in
`design/accessibility-requirements.md`, including both Phase-4 lessons
from Milestone 4's review pass.

- **Touch targets (Phase-4 lesson #2 — every interactive element
  ≥ 96×96px):** the only new interactive elements are
  ChallengeBossButton (~1000×110) and the modal's ENTER (~500×110) —
  both clear the floor by an order of magnitude. The Hold-to-Reveal
  payout label in the modal matches the offline modal's existing
  implementation (48px-type label, generous hit area within the card;
  it is a supplementary affordance, with the primary reading being the
  always-visible abbreviated figure). Everything else new — BossPlate,
  TimerBar, banners — is deliberately non-interactive and exempt, and
  says so here to head off the review question, per the M4 precedent.
- **Explicit input-blocking audit (Phase-4 lesson #1 — containers'
  `mouse_filter` defaults have caused interactive-blocking bugs):**
  every new node's filter is stated in §3, not left to defaults.
  IGNORE: BossPlate + children, TimerBar + label, both Result Banner
  trees (taps pass through to combat during all of them — a player
  mid-tap never has an attack eaten by a celebration or a failure).
  STOP: the World Unlock modal's Scrim and Card (blocking is the
  pattern's contract) and its Hold-to-Reveal label. The
  ChallengeBossButton is a Button (STOP by nature).
- **Motion reduction:** all new animations are one-shot and short —
  entrance ~1.1s (and can only *add* time, never gate input: boss
  damageable from frame one, timer starts after), withdraw ~0.4s,
  banners ~2s self-freeing, plate slam 0.3s, palette tween ~0.8s
  one-shot, modal per pattern spec. The only new *looping* animation is
  the TimerBar urgency pulse: 0.6s cycle (well under the 1.5s ceiling)
  and purely additive — the draining bar and the numeric countdown carry
  the urgency with the pulse switched off entirely. The "Reduce Motion"
  setting remains TODO at tier level; nothing here depends on it
  existing.
- **Color-independent state, verified per-state:** *boss fight* = skull
  icon + "Boss ·" stage text + boss name plate + TimerBar presence +
  larger art + taller HP bar (color is sixth in line). *Timer urgency* =
  shrinking bar + live numerals + pulse (color fourth). *Farm mode* =
  button presence with text + "· Boss at Lv. N" stage text (color
  absent from the signal entirely). *World change* = label text + new
  enemy shapes (palette is the celebratory layer, never the identifier).
  *Fail vs win* = different words, different icons, different
  choreography (withdraw vs death), not a red/green pair — explicitly
  safe under both CVD axes the tier names; the art director's Phase 2
  pass verifies the danger-accent choices with the M4 §4 method.
- **Readable numbers:** all payouts and HP figures use `NumberFormat`.
  The World Unlock modal's payout carries the Hold-to-Reveal Exact
  Number pattern (reused as implemented). Banner figures are
  abbreviated-only, mirrored in the always-on essence counter; the M4
  open item to retrofit Hold-to-Reveal onto that counter remains the
  right systemic fix and is re-flagged in §8.
- **Interruptible modals:** the World Unlock modal has exactly one
  obvious, always-visible dismiss (ENTER, PrimaryButton, live from the
  first frame, no tap-outside, no timeout) — pattern-compliant by
  construction. Banners and the boss entrance require no acknowledgment
  at all.
- **Sound:** still Milestone 14+ territory; every cue here (entrance,
  win, fail, unlock) already pairs visual + (where appropriate) haptic,
  so future audio is additive, never load-bearing.

---

## 6. Edge Cases

- **App closed / killed mid-boss-fight.** Mid-fight state (remaining
  seconds, boss HP) is deliberately never saved. Quick app-switches
  don't need it: the timer is game-time, so OS backgrounding freezes it
  and a resume continues the fight exactly where it was — a notification
  can never drain the timer. If the OS *kills* the app, the save knows
  only "at gate N, farm mode true/false": relaunching mid-first-attempt
  re-enters the boss fresh (full timer, full HP — the auto-enter rule
  doing its normal job), and relaunching from farm mode restores farm
  mode with the button. Persisting a half-elapsed timer across a
  process death would be strictly worse on both axes: unfair if time
  kept draining, exploitable if it didn't. Retries are free; a fresh
  fight is the honest reset.
- **Offline rewards during a boss wall — pay the farm rate, honestly.**
  `IdleManager` prices offline essence by kill rate at the player's
  level; at a wall the auto-attacker is *actually* killing gate−1
  enemies, so the offline calculation uses the effective farm level
  (gate−1), never the gate level (the rate model cannot kill a boss and
  must not pretend to). This also covers an away period that began
  mid-first-attempt: the save is at the gate, the rate is the farm
  rate. The offline popup needs no new copy — it reports what actually
  accrued, which is the M4 spec's honesty bar ("never feel punished
  without understanding why"). Enemy level still never advances while
  away; a world unlock can never happen offline.
- **Shopping mid-boss.** Fully supported and verified against real
  geometry in §3E: timer, boss HP, plate, and essence all visible above
  the open sheet; ~468px of combat area stays tappable; auto-attack
  keeps hitting; a purchased damage upgrade applies to the very next
  hit. The timer keeps running by design (§4A).
- **Auto-attack during the boss timer.** Ticks normally — the boss is a
  normal `_alive` enemy to `CombatManager.auto_attack()`. During the
  entrance beat, early ticks land (player-favorable, §4A). During the
  post-fight beats and farm-enemy withdraw there is briefly nothing
  alive to hit; ticks no-op exactly as they already do between kill and
  respawn today.
- **Reaching a gate while the offline modal (or any blocking modal) is
  up.** Auto-attack can grind to a gate behind the offline modal on a
  return session. The unobstructed-screen check (§2A) holds the boss
  entry until the modal is dismissed — a countdown must never tick
  behind a scrim the player is reading. Same rule covers the shop
  being open at the gate kill (entry waits for the sheet to close) and
  the player being on the main menu (autoloads run without scenes;
  entry waits for the gameplay screen).
- **Reaching a gate while a non-blocking toast/banner is up.** Toasts
  never defer combat (they're specifically designed not to interrupt).
  If a Result Banner would spawn while another layer-50 transient is
  mid-life, it queues behind it (a queue of one) rather than stacking
  in the same slot. In current content the only cohabitant is the
  level-15 Auto-Attack toast, which cannot coincide with a gate level —
  the rule exists for future unlocks.
- **World unlock granted but never acknowledged** (app killed while the
  modal was up, or before it appeared). The unlock and payout were
  saved at the kill (§2B), so nothing is lost. `WorldManager` persists
  `unlock_celebration_pending`; on the next arrival at the gameplay
  screen the modal re-presents (the IdleManager pending-presentation
  idiom exactly), against a sky that already wears the new palette —
  the ceremony is late, the facts never are. Cleared only by ENTER.
- **Two pending modals on the same arrival (offline rewards + unlock
  celebration).** Both present on `scene_transition_finished`, and both
  are blocking layer-60 dialogs — they must never stack. The gameplay
  scene owns a one-at-a-time presentation queue: when multiple modal
  presentations are pending on the same arrival, the **offline-rewards
  modal presents first** (chronology: it reports the past away-period),
  and the **World Unlock modal presents on its dismissal** (it
  announces the go-forward state). Each modal's `confirmed`/exit hands
  off to the next queued presentation; nothing else may present while
  the queue is non-empty. The same queue rule covers any future
  must-acknowledge moment landing on an arrival.
- **MENU navigation mid-fight.** Leaving the gameplay scene voids the
  attempt silently (no fail banner into a dying screen, no farm-mode
  entry from a first attempt): `CombatManager` cancels the countdown
  and, on return, the gate auto-enters fresh — indistinguishable in
  cost from a fail with an instant free retry. From farm mode, farm
  mode simply persists.
- **Boss gates in later worlds.** Nothing special: gates are every 10th
  level forever; world gates every 50th. Frozen Ruins' first boss is
  level 60, its world boss 100. All flows above are world-agnostic;
  only the data (roster, palette, names, multiplier) changes.
- **Save migration — grandfather everything at or below the save's
  level.** Existing saves predate farm mode and worlds, and per
  `docs/ARCHITECTURE.md`'s own pacing (level 50 at ~8 min active,
  level 60 at ~19 min, plus M4 idle/offline pushing further), saves
  *above* level 50 are the norm among real players, not an edge. The
  rule, stated completely:
  - World: derived as `floor((enemy_level − 1) / 50)` — a level-63 save
    loads directly into Frozen Ruins at level 63, with every world at
    or below that index recorded unlocked. Progress is never taken
    away, and no retroactive wall is ever inserted behind a player.
  - Bosses: every gate strictly below `enemy_level` counts as beaten
    (they were "passed" before walls existed). A save sitting exactly
    ON a gate level meets that boss on next launch via the normal
    auto-enter rule.
  - Absent flags default safely: not in farm mode, no pending
    celebrations — a grandfathered world unlock arrives silently, like
    M4's silent auto-attack migration; celebrations are for live
    crossings only.

---

## 7. New Patterns Proposed

### 7.1 Countdown Timer Bar

**Used in:** boss fights (this milestone). Expected future reuse: timed
minigames (Milestone 9+), timed ad-bonus windows, any future "do X
before T" mechanic.
**Behavior:** a full-width horizontal bar that drains smoothly from a
configured duration to zero, with a centered `M:SS` label at 28px
rendered *inside* the bar — the established HealthBar + HealthLabel
label-inside-bar idiom, so paired bars read as siblings. Parameterized:
`max_value` is whatever the feature configures; no layout or copy
depends on the duration. Urgency state at ≤ `min(10s, duration/3)`
remaining: accent shift + 0.6s opacity pulse + the numerals — three
simultaneous signals, numerals sufficient alone. Non-interactive
(`mouse_filter = IGNORE`, stated explicitly on bar and label). Appears/
disappears with a 0.25s slide+fade, never persists outside its mechanic.
**Implementation:** proposed as `scenes/common/countdown_timer_bar.tscn`
+ `scripts/ui/countdown_timer_bar.gd`; owner system exposes
`get_time_remaining()` and the UI polls in `_process()` (the
PlayTimeLabel precedent) — the bar never owns the countdown.

### 7.2 Transient Result Banner (repeatable, non-blocking)

**Used in:** boss win and boss fail (this milestone). Expected future
reuse: minigame results, equipment drop announcements — any *repeatable*
event worth a two-second flourish that must never interrupt play.
**Behavior:** the Unlock Celebration Toast's exact geometry, layer (50),
motion (back-ease pop in, ~1.4–1.8s hold, fade, self-free) and
input-transparency (`mouse_filter = IGNORE` on every node, explicitly),
with two differences that make it a distinct pattern rather than a
reuse: (1) it is **repeatable** — it plays on every qualifying event,
where the Toast is contractually once-per-save; (2) it is
**parameterized** (icon, headline, body, accent) rather than a
hardcoded scene per moment. If another transient occupies layer 50, a
pending banner queues (depth 1) instead of stacking. The Unlock
Celebration Toast remains in the library unchanged as the once-per-save
special case; implementation may unify them behind one scene later —
that is an engineering choice, not a pattern merge.
**Implementation:** proposed as `scenes/common/result_banner.tscn` +
`scripts/ui/result_banner.gd` with a `setup()` contract, instanced by
the gameplay scene on `boss_fight_won` / `boss_fight_failed`.

*(Considered and NOT proposed as patterns: the BossPlate — a one-slot
HUD dressing specific to boss fights, spec'd in §3A; the
ChallengeBossButton — an existing Button Styles pattern member whose
only novelty is conditional presence; the behind-scrim palette
transition — a property of the world sky, spec'd in §4C, with no second
consumer in sight.)*

---

## 8. Open Questions for the Game Designer / Team

- **Tuning triple (timer seconds, boss HP multiple, payout multiple).**
  Being balanced by simulation in parallel; every surface here is
  parameterized (§3A TimerBar, §3C/§3D payout lines). One UX-side
  request back to the sim: the timer should account for auto-attack DPS
  being active during fights (§4A keeps it on), and the first boss (level
  10, pre-auto-attack) is fought on taps alone — worth a dedicated
  balancing pass since it is also the Stage 6 first impression.
- **Urgency threshold formula** — `min(10s, duration/3)` (§3A) is a UX
  placeholder; confirm against the final timer length.
- **Boss names and art per world** (writer + artist): one boss
  definition per gate minimum; "Hollow Warden" throughout this spec is
  illustrative placeholder only. Asset order so far:
  `boss_skull_icon.svg` (§4A), five Dark Forest boss sprites, Frozen
  Ruins roster + palette values, world 2 boss sprites.
- **Frozen Ruins palette values** (art director): three shader uniforms
  per world (§4C); needs the M4-style contrast verification of HUD text
  over the brightest new-nebula patch, since world palettes sit behind
  every label in the game.
- **Repeated-entrance fatigue:** the boss entrance replays identically
  (~1.1s) on every retry (§4B). If playtests show grinding players
  irritated by it, a shortened repeat entrance (~0.6s) is the
  pre-agreed fallback — flag, don't build yet.
- **Hold-to-Reveal retrofit on the HUD essence counter** — carried
  forward from M4 §8, now mildly more pressing since boss payouts are
  the largest single numbers the counter has ever absorbed.
- **World essence multiplier surfacing** — invisible this milestone
  (§4C); the future world-select screen is its natural home. Confirm
  the game designer is comfortable with it being mechanically silent
  until then.
- **For engineering, not design:** (a) `IdleManager`'s offline rate must
  read the effective farm level (§6) — a one-line dependency on the new
  `CombatManager` state, flagged so it isn't lost; (b) `WorldLabel` and
  the enemy-roster constant in `CombatManager` become
  `WorldManager`-driven (the `TODO(Milestone 5)` already in
  `combat_manager.gd`); (c) the `EnemyView` withdraw micro-state (§4B)
  is the only view-layer code ask in this spec.
