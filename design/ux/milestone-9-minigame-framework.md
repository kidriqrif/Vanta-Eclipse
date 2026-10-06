# Milestone 9 — The Arcade: Minigame Framework

> Engine-agnostic behaviour spec. Written for an earlier engine; node and file names in bold are historical. The live implementation is the React build — see `docs/ARCHITECTURE.md`.

Design frame + UX spec. Serves player-journey stage 12 ("First Minigame").
This milestone ships the **framework** that Milestones 10–12 (Memory Match,
Connect Four, Battleship) plug into without modification, plus one small
reference game that proves the contract end to end.

## 0. One-paragraph frame

The Arcade is a side door off the combat loop: a hub of self-contained
minigames the player enters with an **Arcade Token**, plays for a minute or
two, and leaves with a burst of Essence proportional to their current
power. Minigames are never required to progress and never gate content —
they exist to break up the idle rhythm and to give a returning player
something to *do* with their hands. The framework is the real deliverable:
a definition resource, a lifecycle contract, a host that owns all framing
and payout, and a hub that builds itself from data.

## 1. Arcade Tokens (the attempt economy)

A minigame costs **1 Arcade Token** to enter. Tokens regenerate over real
time, so the Arcade is a reason to come back rather than something to grind.

- **Cap:** 5 tokens. **Regen:** 1 per 30 minutes of real time (2.5h to full).
- Regen is computed from wall-clock time the same way offline rewards are,
  so tokens accrue while the app is closed. Time beyond a full meter is
  discarded (a full meter is a full meter — no banked overflow).
- Bosses occasionally grant a token (10% on any boss win), so active play
  also feeds the Arcade.
- The meter reads "◈ 3 / 5" plus, when not full, "next in 12m".
- At zero tokens, entry is refused with a plain explanation and the timer —
  never a purchase prompt. (M14 may add an *optional* rewarded ad for one
  bonus token; the mechanic itself is never pay-gated.)

**Why a cost at all:** without one, a solvable minigame becomes the optimal
essence source and flattens the whole economy. The token meter bounds
minigame income to a known ceiling while keeping every play voluntary.

**The ceiling, concretely** (verified in **scratchpad/token_sim.py**): regen
tops out at one token per 30 minutes, so an implausibly dedicated player who
spends a token the moment it lands earns at most 48 plays/day — about 3.2
hours of equivalent progress against a game that already pays 8 hours of
offline time per day. A realistic session (check in, spend the 5 banked
tokens) is ~20 minutes of progress. The Arcade is a nice bonus at every
scale, never the optimal strategy.

## 2. Rewards (priced in time, so they never go stale)

A minigame payout is expressed as **seconds of the player's current live
essence rate**, never a flat number:

```
payout = IdleManager.get_live_essence_rate()
       * definition.reward_seconds        # the game's "worth", e.g. 240s
       * performance                      # 0.0 .. 1.0, from the game
```

Because the rate is read live, a win at level 5 and a win at level 500 are
both worth "about four minutes of progress" — the reward stays meaningful
forever with no retuning, and no minigame can ever outpace the curve. A
floor of 1 essence keeps a nominal win from paying nothing.

`performance` is the minigame's own 0–1 quality score (accuracy, speed,
margin of victory). A loss still pays `LOSS_FLOOR` (25%) of its scaled value
— attempting is never punished, it is just worth less than winning.

## 3. The lifecycle contract (what M10–M12 must implement)

Every minigame is a scene whose root extends `Minigame` (a `Control`
subclass). The host never inspects a game's internals; the game never
touches currency, tokens, saves, or scene changes.

```
Host                                  Minigame
────                                  ────────
instantiate scene
call  setup(context: Dictionary)  ──▶  store context (difficulty, etc.)
add_child                         ──▶  _ready(): build board, start play
                                       ...player plays...
receive  finished(result)         ◀──  emit finished({...})
compute payout, save, present
```

`result` is a Dictionary: `{"outcome": Outcome, "performance": float,
"score": float, "detail": String}` where `Outcome` is `WIN | LOSS | QUIT`
and `performance` is clamped 0–1. `detail` is one short line the result
banner may show ("4 of 5 in 3.2s").

Rules a minigame must honor:
- It must emit `finished` exactly once. The host disconnects after the first.
- It must not change scenes, spend/grant currency, or call SaveManager.
- It must be playable in portrait at the 1080 reference and obey the
  Enhanced accessibility tier.
- `QUIT` is emitted only via the host's quit flow, never self-initiated.

## 4. The host (owns everything that isn't the game)

A single `MinigameHost` scene wraps whatever game is loaded:
- **Header:** game name, and a QUIT button (top-left, 96px).
- **Body:** the loaded minigame fills the remaining space.
- **Quit flow:** QUIT uses the **Two-Tap Arm** pattern — the token is
  already spent, so quitting forfeits it, and the armed face says so
  ("TAP AGAIN: FORFEIT RUN"). No blocking dialog.
- **On `finished`:** the host computes the payout, grants it, saves, records
  a new best if beaten, and presents a **Result Banner** (win/loss variant)
  reading the outcome, the payout, and the game's `detail` line. On the
  banner's exit it returns to the Arcade hub.

Because the host owns framing, payout, and exit, a new minigame is a scene
plus a `.tres` — no framework change, ever.

## 5. The Arcade hub

Reached from a gameplay ARCADE button (revealed once the Arcade unlocks at
enemy level 20 — after Auto-Attack at 15, so the player meets one new thing
at a time).

- **Header:** BACK · "ARCADE" · the token meter (◈ N / 5, and "next in Xm").
- **Cards, one per definition** (data-driven, so M10–12 add themselves):
  name, one-line description, icon, "Best: N" when a record exists, and a
  PLAY button reading "PLAY  ◈ 1".
- **Locked card** (below its unlock level): dimmed background, PLAY replaced
  by "REACHES Lv. N" — the word carries the state, never color alone.
- **No tokens:** PLAY is disabled and reads "NEXT TOKEN 12m".

## 6. The reference game — Void Reflex

Small on purpose; it exists to prove the contract, not to headline.

Five rounds. Each round a sigil sits dim for a random 0.8–2.2s, then flares.
Tap after the flare = a hit, scored by reaction time; tap before = a miss for
that round. Win = 3+ hits. `performance` = mean normalized reaction across
hits (a 250ms reaction ≈ 1.0, 900ms ≈ 0.0), so a sharp player earns near the
full `reward_seconds`. `detail` reads "4 of 5 · avg 312ms".

A flare left untapped for 2.5s auto-misses and moves on, so an interrupted
run always reaches an end instead of waiting forever for a tap that is not
coming. Taps register on PRESS, not release: billing a slow finger-lift as
reaction time would penalise players with motor impairments for no reason.

Deliberately: no failure state that ends the run early, no timer pressure
beyond the round itself, and a full run is ~15 seconds.

## 7. Accessibility (Enhanced tier)
- Text ≥24px; touch targets ≥96px (the Void Reflex tap target is 400×400).
- No state by color alone: the sigil's flare is a **shape and size** change
  (dim small circle → bright large ringed sigil) plus the word "TAP!", so it
  reads without color; card lock/afford states carry words.
- The flare is a one-shot per round; nothing loops ≥1.5s.
- Explicit `mouse_filter` on every built node (the hub list is a
  ScrollContainer — see the Scroll-Safe Built Content pattern).
- Reaction-time games are inherently timing-based; the 0.8–2.2s window and
  the generous 900ms scoring tail keep it playable without fast reflexes,
  and losing still pays.

## 8. Manager architecture

One new autoload, **MinigameManager**, loading after IdleManager (it reads
`get_live_essence_rate()` for payouts) and before PrestigeManager is
irrelevant — order only requires it after IdleManager.

Owns: definitions, token count + last-regen timestamp, per-game best scores,
unlock checks, payout computation, and its own `"arcade"` save section.
Tokens and records are **kept across an Eclipse** (they are meta, like
crystals), so `reset_for_prestige()` is a no-op.

New EventBus signals: `arcade_tokens_changed(count)`,
`minigame_finished(id, outcome, payout)`, `arcade_unlocked`.

New scene constants: `SCENE_ARCADE`, `SCENE_MINIGAME_HOST`.

## 9. Edge cases
- **Token spend timing:** the token is spent on entry, before the game
  loads, so a crash mid-game costs the token but can never double-spend.
- **Regen across a closed app:** computed from a saved unix timestamp; a
  backwards-set clock clamps to zero elapsed (never negative, never a grant).
- **Full meter:** the regen anchor resets to now whenever the meter is full,
  so a player who idles at full doesn't bank hours of instant tokens.
- **Boss token grant** respects the cap silently (no "wasted" message).
- **Migration:** a save with no `"arcade"` section starts with a full meter
  (5 tokens) — the update's welcome gift, granted once by absence-defaults.

## 10. The other three games

The React build ships seven games: Void Reflex (§6), Memory Match, Connect
Four and Void Salvo (Battleship) from M10–M12, and the three below. Each is a
component in `src/components/minigames/` registered in
`src/components/minigames/registry.ts`; its definition (unlock level,
`rewardSeconds`, `lowerIsBetter`, `scoreUnit`) lives in `MINIGAMES` in
`src/data/definitions.ts`.

**Rules every game follows** (contract in `src/components/minigames/types.ts`,
enforced in `src/components/minigames/MinigameHost.tsx` and `src/game/reducer.ts`):
- **One result per run.** A game calls `onFinish` once. The host latches on
  the first call and ignores any later one, and the reducer only accepts a
  finish for the run that is open. QUIT (Two-Tap Arm) forfeits the token and
  pays nothing.
- **Records come from wins only**, compared in the game's own direction
  (`lowerIsBetter`). A loss still pays 25% of its scaled value (§2).
- **A boss fight is held while a game is open**, so it is not won or lost
  off-screen: the timer stops, auto-attack does not touch the boss, and taps
  are refused (`isBossHeld` in `src/game/reducer.ts`). Ordinary enemies keep
  being farmed. The offline-rewards and world-unlock dialogs hold a boss the
  same way.
- **Unlock levels are checked against the lifetime peak level**, so an
  Eclipse never re-locks a game.

### Lights Out (unlocks at level 30, worth 260 s)

- A 4×4 board. A tap flips that pane and its orthogonal neighbours. Win by
  turning every pane dark.
- Boards are generated by applying 5–8 random distinct presses to a dark
  board, so every board is solvable in that many moves or fewer, and a roll
  that comes out already dark is re-rolled, so a board never starts solved.
- 20-move cap: reaching it with panes still lit is a loss.
- Score = moves, lower is better. Performance on a win = k / moves, where k is
  the number of presses that built the board, clamped to 0.4–1. A loss reports
  0.2.

### Sequence Echo (unlocks at level 40, worth 300 s)

- Four runes (Circle, Diamond, Triangle, Hexagon). The whole pattern is drawn
  once at the start. Each round the call grows by one rune and replays from
  the beginning, then the player echoes it.
- Input is locked during playback, during the pause between rounds and after
  the run ends. A wrong rune ends the run and shows which rune was needed.
- Win = echo the full target sequence (`TARGET_LENGTH`, 5 in the current
  build).
- Score = rounds completed, higher is better. Performance = rounds completed /
  target length (1.0 on a win).

### Rune Sweeper (unlocks at level 50, worth 450 s)

- Minesweeper on a 6×6 field with 6 mines. Mines are placed on the first
  reveal, away from the tapped rune and its neighbours, so the first reveal is
  always safe and opens a region.
- Flag with a long-press, a right-click or FLAG mode. Flags are capped at the
  mine count, and a flagged rune cannot be revealed until it is unflagged.
- The board locks as soon as a mine is hit or every safe rune is open.
- Score = whole seconds from the first reveal to the end (at least 1), lower
  is better. Performance on a win = 1 − (secs − 20) / 100, clamped to 0.4–1
  (full marks at 20 s or less). On a loss it is half the share of safe runes
  cleared.
