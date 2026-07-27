# Milestone 13 — The Journal: Quests, Dailies & Achievements

Design frame + UX spec. This is the game's **retention and direction** layer:
it never adds power the player couldn't otherwise get, it tells them what to do
next and pays them for doing it.

## 0. One-paragraph frame

Everything shipped so far is a *system*; nothing yet tells a new player where
to go. The Journal is one screen with three tabs answering three different
questions: **Quests** — "what should I do next?" (a linear chain that walks a
new player through every system in order); **Daily** — "why come back today?"
(three goals that reroll each day); **Achievements** — "what have I done?" (a
permanent record of milestones, from first kill to first Eclipse). All three
run on one definition resource and one manager, so new content is a `.tres`.

## 1. The three kinds

| | Quests | Daily | Achievements |
|---|---|---|---|
| Shape | linear chain, one active at a time | 3 at once, rerolled daily | flat list, all visible |
| Purpose | teach the game in order | a reason to return | a permanent record |
| Resets | never | every UTC day | never |
| Across an Eclipse | kept | kept | kept |

Quests unlock in sequence — completing #3 reveals #4 — so a new player always
has exactly one "next thing", and the chain deliberately walks through combat →
upgrades → auto-attack → bosses → gear → relics → pets → the Arcade → the
Eclipse, arriving at each just after that system unlocks.

## 2. Progress tracking: two metric shapes

Every goal names a **metric** and a **target**. Metrics come in two shapes, and
the distinction is load-bearing:

- **Cumulative** — a counter that only ever rises, owned and saved by the
  Journal because nothing else records it: `kills`, `boss_wins`,
  `essence_earned`, `items_dropped`, `minigames_won`, `eclipses`,
  `upgrades_bought`, `tokens_spent`. Fed by EventBus.
- **Snapshot** — a value that already exists in a manager and is simply read
  live: `enemy_level` (deepest reached), `relics_owned`, `pets_owned`,
  `crystals` (balance), `skill_levels`. Never stored twice; a save that already
  satisfies one is complete the moment the Journal opens.

Storing a snapshot metric as a counter would double-count on load and drift
from the manager that actually owns it, which is why the two are separated at
the definition level rather than in ad-hoc special cases.

## 3. Rewards

Rewards use the same trick the Arcade proved: **essence rewards are priced in
seconds of the player's live essence rate**, so "kill 1,000 enemies" is worth
the same *relative* progress at level 20 and level 2,000, forever, with no
retuning. Other reward kinds are flat because they are already absolute:

- `essence_seconds` — N seconds of current rate (the default)
- `arcade_tokens` — a bonus Arcade play
- `void_crystals` — reserved for major achievements and the quest chain's
  later beats; small numbers, always meaningful

Rewards are **claimed, never auto-granted**: a completed goal shows a CLAIM
button and waits. That is the satisfying beat, and it means a reward can never
be missed while the player is away from the screen.

## 4. The Journal screen

Reached from a **JOURNAL button in the top bar** beside MENU (the bottom row
already carries four doors; a fifth would crowd it below comfortable width).
The button carries a durable unclaimed-count badge — the same pattern as the
GEAR pill and the companion NEW badge, driven by state rather than by a fired
signal, so an unclaimed reward can never be lost to a missed banner.

- **Header:** BACK · "JOURNAL" · the unclaimed count.
- **Segmented control** (QUESTS | DAILY | ACHIEVEMENTS) — the M8 pattern, with
  the active tab carrying fill, brighter text, and an underline.
- **Goal row** (one card per goal):
  - Name @30 ivory, one-line description @24 muted.
  - A progress bar with `12 / 50` in words beneath it, never bar-only.
  - Reward line: "+4m of Essence", "+1 Arcade Token", "+3 Void Crystals".
  - Right side: **CLAIM** (PrimaryButton) when complete-and-unclaimed;
    "● CLAIMED" when done; the progress figure when incomplete.
- **Locked quests** in the chain are not listed at all — only the active one
  and the completed ones, so the chain reads as a path, not a wall.

## 5. Daily reset

Dailies are keyed to the **UTC day index** (`floor(unix / 86400)`), not to an
elapsed timer:

- On load and on opening the Journal, if the stored day index is **lower** than
  today's, three new dailies are drawn from the daily pool and progress clears.
- Strictly lower, never merely different: a backwards-set clock must not reroll
  and hand out a fresh set of goals.
- Unclaimed rewards from yesterday are **lost on reroll**, and the UI says so
  ("Resets in 4h") so the player is never surprised. Claiming is one tap and
  the badge makes it visible, so this is fair.

## 6. Accessibility (Enhanced tier)
- Text ≥24px; touch targets ≥96px (CLAIM is 220×96).
- Progress is never bar-only — the numeric `12 / 50` always accompanies it, and
  completion carries the word CLAIM or CLAIMED, never a colour change alone.
- Locked/complete/claimed states each carry a word.
- No loop ≥1.5s; the claim flourish is a one-shot.
- Explicit `mouse_filter` on every built node (the list is a ScrollContainer —
  the Scroll-Safe Built Content pattern).

## 7. Manager architecture

One new autoload, **QuestManager**, loading after MinigameManager (it reads the
live essence rate for payouts and queries other managers for snapshot metrics)
and last among content managers.

Owns: definitions, cumulative counters, per-goal claim state, the active quest
index, the daily set + day index, and its own `"journal"` save section.
Everything is kept across an Eclipse — these are lifetime records.

New EventBus signals: `goal_completed(id)`, `goal_claimed(id, reward_text)`,
`dailies_rerolled`.

New scene constant `SCENE_JOURNAL`.

## 8. Edge cases
- **A goal completed while the Journal is closed** simply shows as claimable
  when it opens; the badge is the durable record.
- **Migration:** a save with no `"journal"` section starts with zeroed counters.
  Snapshot metrics are satisfied immediately for an advanced save (correct — a
  level-300 player *has* reached level 50), and the quest chain fast-forwards
  to the first genuinely incomplete link rather than replaying the tutorial.
- **Cumulative counters start at zero for existing saves.** A returning player
  will not get retroactive credit for kills already made; the chain's snapshot
  metrics cover the "you've clearly done this" cases, and no goal is ever
  required to progress.
- **Claim is idempotent** — double-tapping cannot pay twice.
