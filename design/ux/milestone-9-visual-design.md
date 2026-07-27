# Milestone 9 — Visual Design: The Arcade

Transcribes the M9 UX spec. Reuses all established chrome (void background,
PrimaryButton, BadgePanel, Result Banner, Two-Tap Arm, Segmented/Scroll
patterns). One new reserved identity: the **Arcade** family.

## 1. The Arcade family (a new, reserved accent)

Every signature family owns exactly one hue and never lends it (the §5 scope
law). Taken already: relic gold `(0.961,0.769,0.318)`, pet ally-violet
`(0.545,0.361,0.965)`, boss ember `(0.984,0.573,0.235)`, prestige crystal
`(0.40,0.86,0.85)`, and the rarity ramp — Rare sky `(0.22,0.741,0.973)`,
Epic `(0.753,0.518,0.988)`, Legendary amber `(0.984,0.749,0.141)`, Mythic
rose `(0.984,0.353,0.49)`.

The remaining unoccupied hue is **green**, so the Arcade is lime:

- `arcade-core` `Color(0.83, 0.98, 0.70)` — highlight / flare peak
- `arcade`      `Color(0.65, 0.93, 0.42)` — the primary accent
- `arcade-deep` `Color(0.24, 0.42, 0.16)` — filled button base
- `arcade-veil` `Color(0.65, 0.93, 0.42, 0.28)` — glow / shadow

Hue ≈ 92°, a clear 87° from crystal teal (≈179°) and well clear of amber
(≈45°). As always the accent carries *identity*, never *state* — every state
also carries a word or glyph.

**Glyph:** `◈` marks token figures — **in Labels only**. Cinzel (the Button
and Header face) has no `◈ ◆ ★ ● →`, so those render as `.notdef` boxes in any
button or header text. Buttons therefore spell the unit out ("PLAY · 1 TOKEN",
"NEED 12 MORE"); only `·` and `—` are Cinzel-safe punctuation. The token meter
uses the token **icon** beside "3 / 5" rather than the glyph, which is a
stronger cue than a character anyway.

## 2. Assets (SVG, gradients only, no filters, readable at 64px)
- `sprites/ui/arcade_token_icon.svg` — a rounded rhombus token: arcade-deep
  rim, arcade body, an arcade-core inner spark. Used in the meter and cards.
- `sprites/ui/minigame_reflex_icon.svg` — the Void Reflex sigil at rest: a
  ringed circle with a small core, in the arcade family.

## 3. The Arcade hub
`VoidBackground` + 40px margins, matching gear/pets/eclipse.

- **Header row:** BACK (180×96) · "ARCADE" HeaderLabel@38 · token meter pill
  (BadgePanel, token icon + "3 / 5" in `arcade`@30).
- **Sub-line:** when the meter isn't full, "Next token in 12m" muted@24,
  centered. Hidden at full.
- **Cards** (PanelContainer, bg `Color(0.10,0.078,0.157,0.9)`, radius 14,
  content margin 16, uniform 4px `arcade` left spine — the family marker):
  - Row 1: icon (96×96) · name@30 ivory · "Best: N"@24 `arcade` (omitted
    with no record).
  - Row 2: description@24 muted.
  - Row 3: PLAY button (220×96) — `PrimaryButton` reading "PLAY  ◈ 1".
    - Locked: disabled, "REACHES Lv. N", card background dims to 55% alpha
      (background only — never modulate the card, which would drag the text
      under the contrast floor).
    - No tokens: disabled, "NEXT TOKEN 12m".

## 4. The minigame host
- **Header:** QUIT (180×96, top-left) · game name HeaderLabel@38 centered ·
  a spacer matching QUIT so the title stays optically centered.
- Two-Tap Arm on QUIT: armed face reads "TAP AGAIN: FORFEIT" on
  `arcade-core` fill with dark text, disarming after 2.5s (the shared
  pattern's timing).
- **Body:** the loaded minigame fills the remainder; the host adds no chrome
  inside it.
- **Result:** the standard Result Banner — win variant for `WIN`, neutral
  for `LOSS`/`QUIT` (failure copy redirects, never scolds).

## 5. Void Reflex
- A single 400×400 tap target centered in the body, plus a round counter
  ("Round 3 of 5")@26 above and the last reaction line@24 below.
- **At rest:** the sigil icon at `modulate` 0.45, scale 1.0, and the word
  "WAIT" muted beneath.
- **Flared:** scale 1.25, full modulate, an added `arcade-core` ring, and the
  word "TAP!" in `arcade`@40. The state change is therefore *size + shape +
  word*, so it survives total color loss.
- Round transitions are one-shot 0.15s tweens; nothing loops.

## 6. Consistency checklist
- Arcade lime is Arcade-only; never on gear/relic/pet/boss/prestige/chrome.
- No new radius (14 cards / 12 buttons) or glow steps.
- Cinzel (`HeaderLabel`) for headers only; card and game data use the
  default face.
- Every token figure carries `◈`; every state carries a word.
- All text ≥24px, all touch targets ≥96px.
