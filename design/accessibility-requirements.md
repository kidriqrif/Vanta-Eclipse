# Vanta Eclipse — Accessibility Requirements

## Committed tier: Enhanced

Three tiers are defined for this project. We commit to **Enhanced** for all
milestones from Milestone 4 onward (Milestones 1-3 already satisfy most of
Basic and several Enhanced items; this document makes the bar explicit and
auditable going forward).

### Basic (floor — already met)
- Body text legible at default OS scale; no text below ~24px at our
  1080-width reference canvas.
- Touch targets at least 96×96px on the reference canvas (~44dp), per
  `docs/ARCHITECTURE.md` mobile-first conventions.
- No feedback is color-only: every state change pairs color with a second
  signal (size, motion, icon, or text).
- A haptics on/off setting exists and is respected everywhere haptics fire.

### Enhanced (committed tier — required for every new feature)
- **Motion reduction:** every non-essential animation (idle hover loops,
  decorative particle drift) must be skippable or reducible; no animation
  may block the player from acting for longer than its stated duration.
  TODO(Milestone 4+): add a "Reduce Motion" setting that shortens/removes
  hover and drift animations; until it exists, keep all such animations
  short (<1.5s cycle) and non-essential to comprehension.
- **Color-independent state:** already required at Basic; Enhanced adds
  that this must hold under common color-vision deficiencies specifically
  (red-green, blue-yellow) — verified by checking the non-color signal
  alone would still communicate the state.
- **Readable numbers:** any earned/spent amount shown to the player uses
  `NumberFormat` with full precision available on tap-and-hold or a details
  view where relevant (not just abbreviated "1.2K").
- **Interruptible modals:** popups (e.g. offline-rewards) must be dismissible
  with a single, obvious, always-visible action — never require reading to
  find the exit.
- **Sound has a non-audio equivalent:** every UI sound cue (Milestone 14+
  when audio is fully wired) pairs with a visual and/or haptic cue, since
  many mobile players play muted.

### Full (future consideration, not yet committed)
- Full TalkBack/VoiceOver traversal order and accessible labels on every
  interactive Control.
- Remappable input / adjustable touch-target sizing.
- A high-contrast theme variant.
- Adjustable global text scale.

## How to use this document

Every UX spec must state which committed-tier requirements apply and how
the design satisfies them. The accessibility-specialist review pass in
`/team-ui` Phase 4 checks against the **Enhanced** tier above and blocks on
any violation.
