# Milestone 4 UX Spec — Auto-Attack Unlock & Offline Rewards

Author: ux-designer · Status: revised after Phase 1c review round 1
Serves: `design/player-journey.md` Stage 4 (Idle Discovery) and Stage 5
(Return Session).

---

## 1. Overview

Two connected features that turn Vanta Eclipse from a pure tap-clicker into
an idle game:

1. **Auto-Attack unlock + HUD presence.** At enemy level 15 (game-designer
   threshold, not re-derived here), the player's hero starts attacking on
   its own, forever, with no toggle. This is the mechanical seed for
   offline progression — nothing can be earned while the player is away
   until this has happened once.
2. **Offline-rewards return popup.** When the player comes back after time
   away, they see one flat number: the Essence their now-automatic hero
   earned while they were gone.

These are one feature in two halves: Auto-Attack is *why* idle progress is
possible; the return popup is *how the player learns it happened*. The
Overview→Wireframe→Interaction ordering below treats them as a single
continuous flow because that's how the player experiences them — unlock
now, get paid for it later, possibly much later.

Per `design/gdd/game-concept.md`: "a meaningful reward every time the
player returns after time away" is a stated core-loop target, not a nice
extra. Per `player-journey.md` Stage 4/5, the two hard requirements this
spec is graded against are: (a) the unlock must be *celebratory*, not a
silent flag flip, and (b) the return popup must never block or slow down
getting back into the game.

---

## 2. User Flow

### 2A. Auto-Attack Unlock

```
Player is tapping (or not — they may be mid-tap, or just watching)
        │
        ▼
CombatManager.enemy_level reaches 15 for the first time
        │
        ▼
[Steady-state auto-attack flag flips permanently ON — no further branches,
 no toggle, this never turns off again for the rest of the save file]
        │
        ├─▶ HUD: AutoAttackBadge appears in the top bar (pop-in animation)
        ├─▶ Overlay: Unlock Celebration Toast plays over the combat area,
        │            non-blocking — any taps during it still land as normal
        │            attacks
        └─▶ Haptic: one distinct "milestone" buzz (Haptics setting respected)
        │
        ▼
Toast auto-dismisses after ~2s. Badge stays forever. Player keeps playing —
nothing was ever blocked.
        │
        ▼
From this point on, every auto-attack hit spawns a Floating Damage Number
above the enemy and triggers the same Enemy Animation hit-reaction as a
manual tap (see Interaction Details §4B).
```

**Branch — player already past level 15 on load** (feature ships into an
existing save, or player reloads after unlocking in a prior session): no
toast, ever, for that unlock. The badge simply renders in its steady
"active" state the moment the gameplay screen appears. Celebration is a
one-time, live-crossing-of-the-threshold event, never replayed on load.
See Edge Cases §6.

### 2B. Offline-Rewards Return Popup

```
App becomes active again — either:
  (a) cold launch (EventBus.game_loaded fires), or
  (b) OS resume from background (Android bringing the app back to front)
        │
        ▼
Compute elapsed = now_unix − last_save_unix (the save timestamp from
right before this away-period started)
        │
        ▼
   ┌────────────────────────────────────────────────────────┐
   │ Eligibility gate — ALL of these must be true:           │
   │  1. NOT a first-ever launch (is_new_game == false)      │
   │  2. elapsed ≥ MIN_OFFLINE_SECONDS (placeholder: 60s)    │
   │  3. Auto-Attack was already unlocked before this gap     │
   │  4. Computed offline Essence reward rounds to ≥ 1        │
   └────────────────────────────────────────────────────────┘
        │                                   │
     any false                          all true
        │                                   │
        ▼                                   ▼
  No popup. No reward.          CurrencyManager.add(ESSENCE, reward)
  Game proceeds exactly         fires immediately (EventBus.essence_earned,
  as if nothing happened.       source &"offline" — signal already
                                 anticipates this per event_bus.gd comment)
                                        │
                                        ▼
                          Popup is marked "pending" until the gameplay
                          screen is the one on screen:
                                        │
                    ┌───────────────────┴────────────────────┐
                    │                                          │
        (a) Already on gameplay              (b) Not on gameplay (e.g. on
            when eligibility was                 main menu, or cold launch
            computed — i.e. OS-resume             hasn't reached PLAY yet)
            happened mid-session                          │
                    │                                       │
                    ▼                                       ▼
        Popup renders immediately,             Popup is deferred. Main menu
        on top of the current                  is untouched — player taps
        gameplay screen.                        PLAY whenever they choose.
                    │                            Popup renders the instant
                    │                            the gameplay scene's fade-in
                    │                            finishes (see §4C for why).
                    └───────────────────┬───────────────────┘
                                         ▼
                        Modal blocks input to the HUD behind it (by
                        design — see §7, Centered Modal Dialog) until:
                                         │
                                         ▼
                        Player taps COLLECT (single, obvious, always
                        visible — Enhanced accessibility requirement)
                                         │
                                         ▼
                        Modal dismisses. Player is back in active
                        gameplay, taps register immediately.
```

**Why the popup lives on the gameplay screen, never the main menu**
(resolves the open design question from the task):

- `player-journey.md` Stage 1 is explicit that the main menu's only job is
  "feel the tone... find PLAY without hunting" — no modal, ever, competes
  with that on a screen whose entire design intent is "nothing to explain
  yet."
- Stacking the popup in front of the main menu would add a *second* gate
  before the player even reaches the PLAY button they were already going
  to press — the opposite of "never feel blocked from getting back into
  the game."
- Showing it on gameplay ties the number on screen to the currency the
  player is about to keep earning, in the exact place they'll watch it
  grow. When gameplay was already active (background-resume case), this
  costs the player literally nothing extra — no scene change, no new tap.
  When it wasn't (cold-launch case), it costs exactly the one PLAY tap
  they were already going to make. That satisfies "immediately" without
  ever inserting a screen the player didn't ask for.

---

## 3. Wireframe

Reference canvas 1080×1920, matching `scenes/gameplay/gameplay.tscn`'s
current `MarginContainer` (margins 40/40/40/28) and `GameplayVBox`
(separation 18). All Y-values below are derived from that scene's actual
node sizes and are accurate to roughly ±25px — enough to build against,
not sub-pixel.

### 3A. Top bar, before Auto-Attack unlocks (current, unchanged)

```
x=40                                                          x=1040
y=40  ┌──────────────────────────────────────────┬──────────┐
      │ DARK FOREST                               │  MENU    │
      │ Enemy Lv. 14                               │  button  │
y=136 └──────────────────────────────────────────┴──────────┘
```

### 3B. Top bar, after Auto-Attack unlocks — NEW `AutoAttackBadge`

Added as a third child of the existing `WorldVBox` (below `StageLabel`),
not a new overlay — it's part of the normal top-bar flow and reuses the
same container. Non-interactive (`mouse_filter = IGNORE`); the 96×96
touch-target minimum does not apply since it is a status readout, not a
control.

```
x=40                                                          x=1040
y=40  ┌──────────────────────────────────────────┬──────────┐
      │ DARK FOREST                               │  MENU    │
      │ Enemy Lv. 32                               │  button  │
      │ ⚡ AUTO-ATTACK ACTIVE                       │          │
y≈174 └──────────────────────────────────────────┴──────────┘
```

- Pill-style badge, left-aligned, auto-width (~280×40px): small icon
  (NEW asset needed — no lightning/auto icon exists yet in
  `sprites/ui/`, artist to add one matching `essence_icon.svg`'s style)
  + label text "AUTO-ATTACK ACTIVE", 24px font (the accessibility-doc
  floor for this canvas), teal/cyan accent color distinct from the
  violet `PrimaryButton` family so it doesn't compete with the essence
  counter or MENU button for attention.
- Adding this row grows `TopBar` from 96px to ~134px tall. Everything
  below it in `GameplayVBox` reflows down by that difference automatically
  (it's a container, nothing is hand-positioned) and `CombatArea` — which
  fills remaining space and is roughly 1300px tall — simply gets ~38px
  shorter. This is imperceptible against its size and doubles as a subtle
  secondary "something changed" cue at the moment of unlock.
- Permanent once shown. There is no code path that hides it again.
- **Idle pulse (steady state):** once in steady state the badge's opacity
  gently pulses 1.0 ↔ 0.75 on a 1.2s cycle. Purely decorative — the icon
  and text alone communicate "auto-attack active" with the pulse switched
  off entirely (this is the property the accessibility notes in §5 rely
  on). Cycle length is deliberately under the 1.5s ceiling in
  `design/accessibility-requirements.md`.

### 3C. Unlock Celebration Toast (transient, plays once per save file)

Rendered on its own `CanvasLayer` (layer 50 — above the gameplay HUD and
the shop's Slide-Up Panel, below `SceneManager`'s fade layer at 100), not
as a `CombatArea` child, so it always draws above the shop panel as §4A
requires. Positioned in the upper portion of the screen so it never covers
the enemy sprite (`EnemyView` occupies roughly y 744–1244, centered
horizontally) — the player can keep looking at, and tapping, the enemy the
whole time this is on screen.

```
x=140                                                    x=940
y≈430 ┌────────────────────────────────────────────────┐
      │                      ⚡                          │
      │            AUTO-ATTACK UNLOCKED                 │
      │     Your hero fights on, even when you're        │
      │              not tapping.                        │
y≈610 └────────────────────────────────────────────────┘

                  (enemy sprite renders below, y 744+,
                   fully clear of the toast, fully tappable
                   through the toast's non-blocking region too)
```

- Centered horizontally (x center = 540), ~800px wide, ~180px tall.
- `mouse_filter = IGNORE` on the whole container — taps pass straight
  through to `CombatArea` beneath it. A player mid-tap when this fires
  never has an attack "eaten" by the celebration.
- Two lines max: a short headline + one line of plain-language
  explanation. No wall of text, per Stage 4's stated need.

### 3D. Offline-Rewards Modal (new — Centered Modal Dialog, see §7)

Full-screen scrim behind a centered card, added on a `CanvasLayer` above
the gameplay HUD (below `SceneManager`'s fade layer at 100, so a scene
change can still cover it if one somehow raced it — see Edge Cases).

```
Scrim: full 1080×1920, semi-transparent near-black, blocks all input
       to the HUD behind it (mouse_filter = STOP)

x=110                                                      x=970
y≈660 ┌────────────────────────────────────────────────────┐
      │                                                      │
      │                 ✦  WELCOME BACK  ✦                  │
      │                                                      │
      │        Your hero kept fighting while you              │
      │                  were away.                            │
      │                                                      │
      │                 [essence icon]                       │
      │                +1.24K Essence                        │
      │           (tap and hold for exact amount)             │
      │                                                      │
      │               Away for 3h 42m                        │
      │                                                      │
      │        ┌──────────────────────────────┐              │
      │        │           COLLECT              │              │
      │        └──────────────────────────────┘              │
      │                                                      │
y≈1260└────────────────────────────────────────────────────┘
```

- Card: ~860×600px, centered on the full 1080×1920 canvas (x 110–970,
  y 660–1260 — vertical center at 960, matching screen center).
  `PanelContainer` styled consistent with `UpgradeShopPanel`'s card look
  from `ui/theme/main_theme.tres`.
- "+1.24K Essence" uses the existing `NumberFormat` abbreviation (same
  formatter as the HUD essence counter — exact integers with comma
  grouping are never shown as the headline; the exact value lives behind
  the tap-and-hold interaction) at a large font size (~48px, matching
  `EssenceLabel`'s visual weight) so it reads as *the* headline number in
  the card.
- "Away for 3h 42m" is a **rough** duration — see §4C for the exact
  formatting rules. This is deliberately coarser than
  `GameManager.format_time()` (which shows seconds); seconds precision
  on a "you were away" line would contradict "roughly."
- COLLECT button: reuses `PrimaryButton` theme variation (same violet
  fill/glow as the main menu's PLAY button), ~500×110px, centered near
  the card's bottom. This is the single, obvious, always-visible dismiss
  action the Enhanced accessibility tier requires.

### 3E. Capped-duration variant of 3D (see §6 for when this applies)

```
      │               Essence icon
      │              +9.6K Essence
      │
      │      Away for 19h 10m
      │      (offline earnings cap at 8h)
      │
      │        ┌──────────────────────────────┐
      │        │           COLLECT              │
      │        └──────────────────────────────┘
```

Same layout as 3D; only the duration line grows a second, smaller
sub-line. The cap is always stated plainly when it applies — never
silently shown as a shorter time. See §6 and the open question in §8
about the exact cap value.

---

## 4. Interaction Details

### 4A. Auto-Attack unlock

- **Trigger:** `CombatManager.enemy_level` becomes 15 for the first time
  ever on this save (a persisted `auto_attack_unlocked` flag guards the
  celebration so it fires exactly once per save file, never again even
  across relaunches). This happens right after the kill that pushes
  `enemy_level` to 15, essentially concurrent with the level-15 enemy's
  spawn-in — the celebration and "a tougher foe just appeared" read as
  one moment, which is the good outcome.
- **Badge appear animation:** an appear-from-nothing variant of the
  existing **Currency Pop/Bounce Feedback** pattern — scale 0 → 1.12 →
  1.0 over 0.24s, `TRANS_BACK`/`EASE_OUT` (same easing language as
  `_pop_essence_display()` in `scripts/ui/gameplay.gd`, adapted for an
  element becoming visible rather than an already-visible value ticking
  up).
- **Toast animation:** container scale 0 → 1.05 → 1.0 + fade in over
  0.3s (`TRANS_BACK`/`EASE_OUT`, matching the project's established
  bounce idiom), holds static 1.4s, fades out over 0.3s
  (`TRANS_LINEAR`), then frees itself. Total lifetime ~2.0s.
  Non-blocking throughout (`mouse_filter = IGNORE` from frame one — the
  animation itself is never gating input, satisfying the Enhanced-tier
  motion rule even though this doesn't strictly count as "blocking" to
  begin with).
- **Haptic:** one **Haptic Feedback on Impact Events**-style pulse,
  distinct from the existing crit (20ms) and kill (35ms) buzzes —
  something a little longer to read as "milestone," e.g. ~50ms, gated
  by the Haptics setting exactly like the existing calls. Always paired
  with the visual toast + badge, never the only signal.
- **If the shop's Slide-Up Panel is open when the threshold crosses:**
  the toast and badge still render — the badge lives in the top bar,
  which stays visible above the shop panel (the panel only covers
  "roughly the bottom half of the screen" per its existing spec), and
  the toast overlay draws above the panel too since it's on a higher
  layer. No suppression needed.

### 4B. Ongoing Auto-Attack combat feedback

- Auto-Attack logic belongs in `CombatManager` (per
  `docs/ARCHITECTURE.md`'s manager pattern), calling the same damage
  path `player_tap_attack()` already uses, so it automatically inherits
  crit rolls, essence rewards, and every existing `EventBus` signal
  (`enemy_damaged`, `enemy_died`) with zero UI-layer special-casing.
- Each auto-attack hit must trigger the same **Floating Damage Number**
  and **Enemy Animation States** hit-reaction a manual tap does — this
  is already half-built: `gameplay.gd`'s `_spawn_damage_number()`
  already branches on `_has_tap_position` and spawns the number above
  the enemy's center when there's no tap point, specifically commented
  `# Auto attacks (Milestone 4) have no tap point`. No new visual
  vocabulary is needed here, only wiring the new signal path into it.
- **UX constraint on attack cadence** (the exact interval is a
  `CombatManager` balancing decision, out of this spec's scope): it
  must be slow enough that consecutive Floating Damage Numbers don't
  visually stack into noise. That pattern's number fades over ~0.75s;
  recommend an auto-attack interval of at least 1.0s so numbers never
  overlap mid-animation. Flagged as an open question in §8.
- No visual differentiation between a manual-tap hit and an auto-attack
  hit is proposed — the point (per the task) is that they read as *the
  same kind of thing happening*, just without a finger involved.

### 4C. Offline popup — exact trigger and timing

- **Eligibility check** runs once per foreground-return event (cold
  launch via `EventBus.game_loaded`, or OS resume — see the technical
  dependency note in §8, since only `NOTIFICATION_APPLICATION_PAUSED`
  is currently handled in `SaveManager`/`SettingsManager`, not a resume
  notification). It compares `now_unix` against the `last_save_unix`
  that was current the moment the away-period began.
- **Reward granted immediately** on eligibility (not on COLLECT tap) via
  `CurrencyManager.add(CurrencyManager.ESSENCE, reward)`, emitting
  `EventBus.essence_earned` with `source = &"offline"` — the signal's
  doc comment in `event_bus.gd` already names this exact source string
  as planned. If the gameplay screen is already alive when this fires
  (background-resume case), the existing **Currency Pop/Bounce Feedback**
  on the essence counter plays automatically, for free, with no new
  code — the popup then appears on top explaining a number the player
  may have already glimpsed tick up behind it. If gameplay hasn't loaded
  yet (cold-launch case), the essence label simply initializes already
  including the offline reward, exactly like `_ready()` already does
  today — no animated pop on that path, which is consistent with how
  the label behaves on every other scene load.
- **Why the popup waits for the gameplay fade-in (deferred path):** the
  modal's appear trigger on the cold-launch path is
  `EventBus.scene_transition_finished` for the gameplay scene — not the
  scene's `_ready()`. Rendering during the fade would mean the modal is
  born underneath `SceneManager`'s still-fading overlay, its entrance
  animation half-eaten and its COLLECT button technically live while the
  screen is still dark. Waiting for the transition-finished signal
  guarantees the modal's entrance plays once, in full view, on a settled
  screen.
- **Save immediately after granting:** the eligibility-time grant is
  followed by an immediate `SaveManager.save_game()`, which advances
  `last_save_unix` past the away-window. This shrinks the crash-regrant
  window (crash after grant but before any save would otherwise re-run
  the same eligibility on next launch) to near zero.
- **Modal entrance:** scrim fades in 0.2s; card scales 0.85 → 1.0 and
  fades in over 0.25s, `TRANS_BACK`/`EASE_OUT`. The COLLECT button is
  interactive from frame one — a player who taps immediately dismisses
  immediately, the entrance animation never gates the tap.
- **Modal exit (on COLLECT):** card scales to 0.9 and fades out over
  0.18s (`TRANS_CUBIC`/`EASE_IN`), scrim fades out over 0.2s, node frees
  itself. No further essence changes happen on dismiss — the money was
  already granted at eligibility time; COLLECT is acknowledgment, not a
  claim action.
- **Haptic:** one light buzz on modal appearance (Haptics setting
  respected), paired with the visual as always.
- **Duration formatting** ("Away for …"): rougher than
  `GameManager.format_time()`, which shows seconds. Needs a small new
  helper (or an extra branch on the existing one) with rules along these
  lines:
  - < 1 minute: never shown (gated out at eligibility, §2B condition 2).
  - 1–59 minutes: `"42m"`
  - 1–23 hours: `"3h 42m"`
  - ≥ 1 day: `"2d 5h"`
  This keeps the line skimmable ("roughly," per the task) instead of a
  precise duration.
- **Essence figure precision:** the large "+1.24K Essence" figure uses
  the existing `NumberFormat.format()` abbreviation. Per the Enhanced
  accessibility tier's "Readable numbers" requirement, tap-and-hold on
  the figure reveals the exact unabbreviated integer for as long as
  held (small caption line under the number, as sketched in §3D). This
  interaction does not exist anywhere in the game yet — see the
  accessibility note in §5 and the open item in §8; this spec treats it
  as new, small, in-scope work rather than scope creep, since it's the
  one place the Enhanced tier's "Readable numbers" bullet directly
  applies to a brand-new number the player has never seen before.

### 4D. System ownership

Per `docs/ARCHITECTURE.md`, UI never owns state, so every piece of this
milestone's state has a named manager owner:

- **A new `IdleManager` autoload** (registered after `CombatManager`)
  owns: the persisted `auto_attack_unlocked` flag (its own `"idle"` save
  section via `SaveManager.register_saveable`), the auto-attack tick
  timer, offline-reward eligibility computation, the "popup pending"
  state, and the app-resume notification hook flagged in §8. It emits
  the EventBus signals the UI renders (unlock moment, offline rewards
  ready).
- **`CombatManager`** owns the actual attacking: `IdleManager`'s tick
  calls into the same damage path `player_tap_attack()` uses, so
  crits/essence/signals are inherited (§4B), and `CombatManager` remains
  the only system that touches enemy state.
- **UI (`gameplay.gd`, the toast, the badge, the modal)** owns nothing:
  it renders `IdleManager`/`CombatManager` state and EventBus signals,
  and reports exactly one input — the COLLECT tap — back as a dismiss.

---

## 5. Accessibility Notes

Mapped against the committed **Enhanced** tier in
`design/accessibility-requirements.md`.

- **Motion reduction.** All new animations are one-shot or short-cycle:
  the unlock toast (~2.0s total, plays once ever), the badge pop-in
  (0.24s, plays once), the modal entrance/exit (0.25s/0.18s, gated on a
  real event, not decorative looping). The only *looping* new animation
  is the badge's idle pulse (§3B, opacity 1.0↔0.75, 1.2s cycle) — under
  the doc's 1.5s-cycle ceiling for "keep it short until Reduce Motion
  exists," and purely decorative: the badge's text and icon communicate
  "auto-attack active" with the pulse switched off entirely. No new
  animation blocks the player from acting for longer than its own
  stated duration — the offline modal's *input-blocking* is a deliberate
  design choice sanctioned by the task ("unlike the shop it isn't
  optional to acknowledge"), not an accidental side effect of an
  animation running long; the COLLECT button is live from the first
  rendered frame regardless of whether the entrance tween has finished.
- **Color-independent state.** The `AutoAttackBadge`'s only state is
  present-with-text or absent-entirely — there is no color-coded
  on/off pair to confuse under red-green or blue-yellow color-vision
  deficiency; the text "AUTO-ATTACK ACTIVE" alone communicates the
  state with color as pure decoration. Crits during auto-attack keep
  using the existing Floating Damage Number crit treatment (larger,
  differently colored, *and* a distinct outline) — unchanged, already
  compliant.
- **Readable numbers.** The offline popup's Essence figure uses
  `NumberFormat` plus a new tap-and-hold-for-exact-value interaction
  (§4C). Flagged honestly: this exact interaction does not exist
  anywhere else in the game today (the main HUD essence counter is
  abbreviation-only), so this spec is introducing it, not reusing it.
  Recommend the same tap-and-hold affordance be retrofitted onto the
  main HUD essence counter in a follow-up pass so the pattern is
  consistent everywhere large numbers appear — noted as an open item in
  §8, not blocking this milestone.
- **Interruptible modals.** This is the accessibility document's own
  named example ("popups (e.g. offline-rewards) must be dismissible
  with a single, obvious, always-visible action"). The Centered Modal
  Dialog (§7) has exactly one dismiss action — the COLLECT
  `PrimaryButton` — full-width-ish, high-contrast, bottom-centered,
  live from frame one. No secondary dismiss paths (no tap-outside, no
  swipe, no timeout) that could create ambiguity about which action is
  "the" exit.
- **Sound has a non-audio equivalent.** Not yet applicable — audio
  isn't wired up until Milestone 14+. Noted for that future pass: the
  unlock moment and modal appearance already carry a visual (toast/
  modal) and a haptic cue independent of any sound, so whatever chime
  gets added later is additive, never load-bearing.
- **Touch targets.** The only new interactive element is the COLLECT
  button at ~500×110px, well above the 96×96px floor. The
  `AutoAttackBadge` is intentionally non-interactive and exempt from
  the touch-target rule for that reason (stated explicitly in §3B to
  head off a future review question).

---

## 6. Edge Cases

- **First-ever launch.** `EventBus.game_loaded` fires with
  `is_new_game == true`. Eligibility condition 1 (§2B) fails
  immediately — no popup, no computation attempted, nothing to compare
  `last_save_unix` against since it's 0. This is the same path a
  deleted save takes (`SaveManager.delete_save()` resets
  `last_save_unix` to 0), so a fresh start after deleting a save behaves
  identically to a true first launch.
- **Auto-Attack never unlocked.** If the player has never reached enemy
  level 15, eligibility condition 3 fails — there's no idle-production
  mechanism running while they're away, so there is nothing to report.
  No popup, ever, until the first time they cross the threshold in a
  live session (§2A). This is also naturally covered by condition 4
  (computed reward rounds to 0) as a second line of defense, but the
  conceptual reason (no Auto-Attack ⇒ no idle production) is the real
  one and should be checked directly rather than relying on the reward
  happening to compute to zero.
- **Extremely long offline durations** (days/weeks). The Essence reward
  formula almost certainly needs a cap — the exact cap value is a
  balancing decision for the game designer, not this spec (placeholder
  used throughout: 8h). What *is* in scope here: the cap must be
  communicated, never hidden. `player-journey.md` Stage 5 explicitly
  warns against the player feeling "punished... without understanding
  why." The popup always shows the player's *true* elapsed time (up to
  the day-granular format in §4C) and, only when a cap actually reduced
  their reward, adds the explicit sub-line "(offline earnings cap at
  Xh)" as shown in §3E. Never silently substitutes a shorter fake
  duration.
- **Rapid app-switching** (a few seconds in the app switcher, phone
  screen lock/unlock, a notification pulling focus). Two things
  cooperate to make this a non-event: (1) `SaveManager` already saves
  on `NOTIFICATION_APPLICATION_PAUSED`, which refreshes
  `last_save_unix` to the moment of backgrounding, so a quick
  resume computes a tiny `elapsed`; (2) the MIN_OFFLINE_SECONDS gate
  (placeholder 60s, condition 2) exists specifically to swallow
  anything under that regardless. No popup, no flicker, no "you earned
  0 Essence."
- **Repeated background/foreground cycles before ever reaching
  gameplay** (e.g., cold launch → main menu → backgrounded for 2h →
  resumed, still on main menu, not pressed PLAY → backgrounded again for
  3h → resumed → finally PLAY). Eligibility is recomputed fresh at each
  resume against the latest `last_save_unix`; nothing accumulates
  separately. The player sees exactly one popup, on entering gameplay,
  reflecting the full elapsed time since their last real save point. No
  special-case logic needed beyond "always compute from the most recent
  save."
- **Threshold already crossed before this feature existed** (player is
  already enemy level 20+ when this milestone ships, or reloads a save
  from after they unlocked it in a previous session). No toast replay —
  the `auto_attack_unlocked` flag is already `true`, so the badge simply
  renders in steady state the moment gameplay loads. Covered in §2A's
  branch.
- **Offline eligibility computed while the shop panel or another modal
  is mid-transition.** Not expected to occur in practice since the shop
  only opens via explicit player tap and the popup's trigger points
  (cold launch, OS resume) don't coincide with an open shop panel by
  construction — noted here only so the engineer knows it wasn't missed,
  not because a specific handling rule is needed.

---

## 7. New Patterns Proposed

### Centered Modal Dialog (Blocking)

**Used in:** offline-rewards return popup (this milestone). Expected
future reuse: prestige confirmation, delete-save confirmation
(`SaveManager.delete_save()` already carries a
`TODO(Milestone 8): expose in Settings behind a confirmation dialog`),
and any future "must acknowledge before continuing" moment (boss-defeat
summary, world-unlock announcement per Stage 6's future stages).

**Behavior:** distinct from the existing Slide-Up Panel (bottom sheet,
covers half the screen, leaves the rest of the screen tappable, used for
*optional* browsing like the shop). This pattern is for moments the
player must actively acknowledge before continuing:

- A full-screen semi-transparent scrim (near-black, consistent with
  `SceneManager`'s `FADE_COLOR` family) blocks all input to whatever is
  behind it (`mouse_filter = STOP`). The scrim itself is never a dismiss
  target — no tap-outside-to-close — so there is exactly one, unambiguous
  way to exit, satisfying the "single, obvious, always-visible action"
  accessibility bar.
- A centered card (`PanelContainer`, styled per `main_theme.tres`) holds
  the content and exactly one primary dismiss action, styled with the
  `PrimaryButton` theme variation.
- Entrance: scrim fades in over 0.2s while the card scales 0.85 → 1.0
  and fades in over 0.25s, `TRANS_BACK`/`EASE_OUT` — the same back-ease
  bounce vocabulary the project already uses for Currency Pop and the
  Slide-Up Panel, so it reads as native rather than a new visual
  language.
- Exit: card scales to 0.9 and fades out over 0.18s
  (`TRANS_CUBIC`/`EASE_IN`), scrim fades out over 0.2s, node frees
  itself.
- The dismiss button is interactive immediately, not gated behind the
  entrance animation finishing.
- Rendered on its own `CanvasLayer`, above normal gameplay UI but below
  `SceneManager`'s fade-transition layer (layer 100), so a scene change
  can still visually cover it if one is ever triggered while it's open.

**Implementation:** proposed as a new script, e.g.
`scripts/ui/centered_modal_dialog.gd` + a base scene under
`scenes/common/`, generic enough to host different body content per
use (this milestone: essence figure + duration line + COLLECT; future:
a confirmation question + CONFIRM/CANCEL). Left for the Godot UI
specialist (Phase 3 pre-req) to structure as a reusable scene rather
than a one-off.

---

## 8. Open Questions for the Game Designer

- **Auto-attack interval.** §4B recommends ≥1.0s between auto-attack
  hits purely so Floating Damage Numbers don't visually overlap. The
  actual balancing number (how fast auto-attack should feel relative to
  manual tapping) is a combat-tuning decision this spec doesn't make.
- **Offline earnings formula and cap.** This spec assumes a flat,
  capped reward exists (placeholder: 8 hours, used only for illustrative
  copy in §3E) but doesn't derive the rate or the cap — that's balancing
  work parallel to the existing `ENEMY_HP_GROWTH`/`ESSENCE_REWARD_GROWTH`
  tuning in `combat_manager.gd`. Whatever the cap turns out to be, §6
  requires the popup to state it plainly when it applies.
- **MIN_OFFLINE_SECONDS placeholder (60s).** Reasonable default to
  suppress rapid app-switching; confirm or adjust.
- **Retrofit tap-and-hold-for-precision onto the main HUD essence
  counter.** Not part of this milestone's scope, but noted in §5 as an
  existing gap against the committed Enhanced accessibility tier that
  this spec is introducing the pattern for; worth a small follow-up
  ticket.
- **Technical dependency flagged for engineering, not the designer:**
  `SaveManager`/`SettingsManager` currently only handle
  `NOTIFICATION_APPLICATION_PAUSED` (save-on-background); there is no
  existing resume-notification hook. Per §4D this hook belongs to the
  new `IdleManager`, which listens for
  `NOTIFICATION_APPLICATION_RESUMED` (and cold-start `game_loaded`
  alike) and runs the §2B eligibility check on both paths, so the popup
  triggers correctly without a full scene reload. Mentioned here so it
  isn't lost between the UX spec and implementation.
