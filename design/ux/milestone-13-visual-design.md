# Milestone 13 — Visual Design: The Journal

## 1. The Journal introduces NO new accent — deliberately

Six signature families are already spoken for: relic gold
`(0.961,0.769,0.318)`, pet ally-violet `(0.545,0.361,0.965)`, boss ember
`(0.984,0.573,0.235)`, prestige crystal `(0.40,0.86,0.85)`, arcade lime
`(0.65,0.93,0.42)`, plus the five-step rarity ramp. The usable hue circle is
close to full, and a seventh family invented for a *list of goals* would be
the weakest claim on a colour in the game.

So the Journal wears the neutral chrome — ivory `(0.906,0.886,0.973)` for
names, muted `(0.62,0.57,0.75)` for description and progress — and **each
reward figure wears the colour of the family that reward belongs to**:

| Reward | Colour | Why |
|---|---|---|
| Essence | violet-light `(0.655,0.545,0.98)` | the currency's existing chrome |
| Arcade Token | arcade lime `(0.65,0.93,0.42)` | it *is* an Arcade thing |
| Void Crystal | crystal `(0.40,0.86,0.85)` | it *is* a prestige thing |

This is not a scope violation but the scope law working: a token reward shown
in arcade lime is correct attribution, and the player learns "lime = Arcade"
one more time. The Journal itself claims nothing.

## 2. Asset
`sprites/ui/journal_icon.svg` — a closed tome: a muted violet-grey cover with
an ivory page edge and a single embossed rule. Deliberately quiet, in chrome
tones, so it does not read as a sixth power system competing for attention.

## 3. The Journal screen
`VoidBackground` + 40px margins, matching every other full screen.

- **Header:** BACK (180×96) · "JOURNAL" HeaderLabel@38 · an unclaimed pill
  (BadgePanel, "N READY" in ivory) shown only when something is claimable.
- **Segmented control** (QUESTS | DAILY | **TROPHIES**), the M8 pattern:
  ("ACHIEVEMENTS" measures 384px in Cinzel at the nav's 38px against 325px of
  tab width; fitting it would mean dropping all three tabs to 30px. "TROPHIES"
  fits at full navigation size and is the clearer label.)
  active = filled `(0.16,0.14,0.24)` ground, ivory text, and a 4px ivory
  underline; inactive = transparent, muted text. Word + fill + underline, so
  the active tab survives colour loss.
- **Daily tab only:** a "Resets in 4h" line @24 muted under the tabs.
- **Goal card** (PanelContainer, bg `(0.10,0.078,0.157,0.9)`, radius 14,
  margin 16, 4px left spine):
  - The spine is ivory at 0.35 for an incomplete goal and **full ivory** for a
    claimable one — so a claimable goal is scannable down the left edge before
    reading a word.
  - Row 1: name @30 ivory · reward @24 in the reward's family colour.
  - Row 2: description @24 muted.
  - Row 3: a ProgressBar (h=28, radius 12, fill ivory) with `12 / 50` @24
    beside it — **the numeric is never omitted**, so progress never depends on
    reading a bar.
  - Row 4 / right: CLAIM (`PrimaryButton`, 220×96) when claimable; "● CLAIMED"
    @24 muted when done; nothing when incomplete (the numeric carries it).
- Claimed cards drop to `modulate` 0.75 — a card, not its text, and the word
  CLAIMED carries the state regardless.

## 4. The gameplay entry
A `JournalButton` (96×96) in the top bar beside MENU, carrying the journal
icon and a durable unclaimed-count badge (BadgePanel, ivory, top-right). The
bottom row already holds four doors; a fifth would push the widest label
("UPGRADES") against its minimum. The top bar has room and the Journal is a
check-in, not a door the player walks through mid-combat.

## 5. Motion
- Claiming: the card gives the shared one-shot scale-pop and the reward line
  re-texts to "● CLAIMED". No loop.
- A goal completing while the Journal is open re-dresses that row in place; it
  never rebuilds the list under the player's thumb (the Arcade's idiom).

## 6. Consistency checklist
- No new accent, no new radius (14 cards / 12 tabs), no new glow step.
- Cinzel for the header only; all goal data uses the default face.
- No `◈ ◆ ★ ● →` in Button or Header text (Cinzel lacks them); `●` appears
  only in plain Labels, and `·` is Cinzel-safe.
- All text ≥24px, all touch targets ≥96px.
