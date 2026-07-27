# Milestone 8 — Visual Design: Eclipse & Ascendant Powers

Transcribes the M8 UX spec into concrete visual language. Reuses the
established chrome (void background, PrimaryButton, BadgePanel, Result
Banner, Two-Tap Arm, slide-up/segmented patterns); the only new identity is
the **Void Crystal** prestige family.

## 1. The Void Crystal family (a new, reserved accent)

Prestige gets one signature color, scoped like every other class (§5 of the
pattern library): **crystal teal-cyan**. It never appears on non-prestige
chrome, and no other family borrows it.

- `crystal-core`  `Color(0.76, 0.97, 0.96)` — bright highlight / glyph core
- `crystal`       `Color(0.40, 0.86, 0.85)` — the primary accent (text,
  borders, cost figures, the ◆ glyph)
- `crystal-deep`  `Color(0.16, 0.44, 0.47)` — filled segment / button base
- `crystal-veil`  `Color(0.40, 0.86, 0.85, 0.28)` — glow / shadow

This is deliberately green-cyan so it never collides with relic gold, pet
ally-violet (purple), boss ember (orange), the frostling periwinkle
`(0.576,0.773,0.992)`, or any rarity color.

**Glyph:** `◆` precedes every crystal figure ("◆ 24", "NEED 8 ◆"), so the
currency reads by shape as well as color.

## 2. Assets (SVGs, gradients only, no filters, read at 64px)
- `sprites/ui/void_crystal_icon.svg` — a faceted upright gem: crystal-core
  top facet, crystal body, crystal-deep base, a thin bright edge. The
  header + cost rows + celebration use it.
- `sprites/ui/eclipse_icon.svg` — the eclipse motif: a near-black disc with
  a crystal-teal corona ring (the ASCEND panel header + the ECLIPSE gameplay
  button + the celebration banner). Corona is a soft radial, no `<filter>`.

## 3. The Eclipse screen
Portrait, `VoidBackground` + 40px margins, matching gear/pets.

- **Header row:** BACK (180×96) · "ECLIPSE" HeaderLabel@38 centered · a
  crystal-balance pill on the right (`◆ N`, crystal color, BadgePanel).
- **Segmented control** (`ASCEND | POWERS`): one HBox of two equal buttons,
  h=96. Active segment = crystal-deep fill + crystal-core text + a 4px
  crystal underline bar; inactive = transparent fill, muted text. The active
  word itself is the label, so state survives color loss.

### 3A. ASCEND panel
- Eclipse-icon centered, then the yield line: "Collapsing now yields" (muted
  28px) over "◆ N Void Crystals" (crystal, 48px). "Run peak: Lv. K" muted
  24px beneath.
- **RESET / KEPT** — two PanelContainer columns side by side. RESET column
  header in a warm-muted tone, KEPT in crystal; each lists the §1 items at
  24px with a leading `·`. Always visible.
- **COLLAPSE INTO ECLIPSE** — full-width PrimaryButton, h=120, but tinted
  with a crystal-deep normal stylebox override so it reads as the prestige
  action, not a routine primary. Two-Tap Arm: armed face re-texts to "TAP
  AGAIN · +N ◆ · RESETS RUN" on a crystal-core fill, disarms ~2.5s.

### 3B. POWERS panel
- Reuses the crystal-balance context. A ScrollContainer of branch sections.
- **Branch header:** the branch name as HeaderLabel@30, a hairline rule
  under it.
- **Node card** (PanelContainer, bg `Color(0.10,0.078,0.157,0.9)`, radius
  14, content margin 16, a uniform 4px crystal left spine — the prestige
  "one class" marker):
  - Row 1: node name @30 (ivory `Color(0.906,0.886,0.973)`); on the right a
    state marker — "● Lv. K/M" (crystal) or "● MAXED" (crystal-core).
  - Row 2: current→next effect @24 muted ("+16% tap → +24% tap").
  - Row 3: a BUY PrimaryButton (min 220×96) OR the disabled state text.
    Buyable = "BUY  ◆ N". Can't afford = disabled "NEED N ◆". Locked =
    disabled "REQUIRES <Node> Lv. N" and the whole card dims to modulate
    0.55. Maxed = the button is replaced by the "● MAXED" marker alone.

## 4. Gameplay ECLIPSE button
Added to the bottom row (`GEAR | UPGRADES | ECLIPSE`). Hidden until
prestige unlocks; when hidden the row is the existing two buttons. Its face
carries the eclipse icon + "ECLIPSE" and a crystal-deep tint so it's visibly
the special door. h=110 like its neighbors.

## 5. Motion & celebration
- Unlock: a one-shot Result Banner (eclipse icon, "THE ECLIPSE AWAITS",
  subtitle), reusing the M5/M7 banner queue.
- Commit: a one-shot celebration Result Banner (eclipse icon, "ECLIPSE",
  "+N Void Crystals"), then the scene returns to a fresh gameplay run.
- Buying a power: the node card gives the shared `_pop_control` scale-pop;
  the balance pill re-texts. No loop exceeds 1.5s.

## 6. Consistency checklist (§5 scope rules)
- Crystal teal is prestige-only; never on gear/relic/pet/boss/chrome.
- No new corner radius (14) or glow step values.
- Cinzel (`HeaderLabel`/`TitleLabel` variations) for headers only; node
  data uses the default face.
- Every crystal figure carries the ◆ glyph; every state carries a word.
