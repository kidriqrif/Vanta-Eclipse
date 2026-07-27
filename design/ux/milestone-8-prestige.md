# Milestone 8 — Eclipse (Prestige) & Ascendant Powers

Design frame + UX spec. Serves player-journey stage 8 ("Prestige — become
stronger, repeat forever") and establishes the game's long-term meta loop.

## 0. One-paragraph frame

When a run has been climbed as far as the player cares to push it, they
**collapse it into the Eclipse**: the current run's essence economy resets
to the beginning, and in exchange the player is paid **Void Crystals** — a
permanent prestige currency spent in the **Ascendant Powers** tree for
forever-bonuses. The RPG collection (equipment, relics, pets) is *kept*, so
each re-climb is faster than the last, and the player chases a higher peak
each time because a higher peak pays more crystals. This is the loop the
game runs on for years.

## 1. What resets vs. what is kept

The single most important thing to communicate: the player must never be
surprised by what an Eclipse costs them. The Eclipse screen states it
plainly, every time, before the confirm.

**RESET by an Eclipse (the run economy):**
- Eclipse Essence balance → 0
- Every upgrade-shop purchase (Void Claws, Eclipse Fangs, …) → cleared
- Enemy level → 1, back to the Dark Forest
- World unlocks → re-locked (worlds are re-climbed each run)
- Auto-Attack → re-locked (re-earned at level 15), *unless* the Eternal
  Reflex power is owned, which starts every future run with it already on

**KEPT across an Eclipse (identity + meta):**
- Void Crystals and every Ascendant Power bought with them
- The whole equipment inventory and what's equipped
- The relic collection and the attuned relic
- The pet roster, the active pet, and all pet levels/XP
- Void Scraps, Astral Shards
- Lifetime stats (kills, play time), settings

Rationale: resetting the RPG collection every Eclipse would negate
Milestones 6–7 and read as a take-back. Resetting the essence economy is
what gives the *active* loop a purpose after prestige — there is always a
shop to rebuild — while kept gear makes the rebuild quick and powerful.

## 2. Unlock & the crystal reward

**Unlock gate.** The Eclipse is hidden until the player's run peak level
reaches **50** (the first world boss, i.e. they have conquered one whole
world). It announces itself once, on crossing, with a Result Banner: "THE
ECLIPSE AWAITS — collapse your run into permanent power." After that a
persistent ECLIPSE button lives in the gameplay bottom row.

**Run peak.** PrestigeManager tracks the highest enemy level reached *this
run* (the high-water mark — it does not fall when a boss wall knocks the
player back to farming). The crystal payout is always computed from the run
peak, so time already earned is never lost to a bad boss timer.

**Reward formula** (final constants owned by the sim,
`scratchpad/prestige_sim.py`): crystals grow super-linearly with the run
peak so pushing deeper each cycle is always worth it, but the first Eclipse
at level 50 still pays a satisfying starter handful (enough for one or two
powers). The Crystalline power multiplies this payout.

## 3. The Eclipse screen (new scene)

Portrait, reached by the gameplay ECLIPSE button. A segmented control
switches between two panels that share one Void-Crystal balance header.

### 3A. ASCEND panel
- **Yield line:** "Collapsing now yields **N Void Crystals**." (peak level
  named beneath it: "Run peak: Lv. 63".)
- **RESET / KEPT summary:** the two lists from §1, always visible, as two
  labelled columns — the player reads exactly what happens before deciding.
- **COLLAPSE INTO ECLIPSE** — a full-width PrimaryButton using the Two-Tap
  Arm pattern (§7 pattern library): first tap arms and re-labels to
  disclose the outcome ("TAP AGAIN: +N CRYSTALS, RESET RUN"), a second tap
  within the window commits, and it disarms after ~2.5s. This is a
  deliberate, irreversible act, so it earns the same disclosed-confirm
  treatment as a destructive salvage.
- On commit: the reset runs, a celebration Result Banner fires ("ECLIPSE ·
  +N Void Crystals"), and the scene returns to a fresh gameplay run.

### 3B. POWERS panel (Ascendant Powers tree)
- Data-driven from SkillNodeDefinition resources, grouped into four
  branches, each a labelled section of node cards:
  - **Might** — Void Edge (tap %), Ruin (crit damage)
  - **Fortune** — Abundance (essence %), Deep Rest (offline efficiency),
    Long Slumber (offline cap hours)
  - **Ascendance** — Crystalline (crystal payout %), Dominion (boss damage)
  - **Automation** — Eternal Reflex (auto-attack from run start, 1 level),
    Swift Hunt (auto-attack speed %)
- **Node card:** name, one-line current→next effect, cost in crystals, and
  a BUY PrimaryButton. States, each carried by word+shape not color alone:
  - *Buyable* — BUY enabled, cost shown.
  - *Can't afford* — button disabled, reads "NEED N ◆".
  - *Locked* — prereq unmet; button disabled, reads "REQUIRES <node> Lv. N",
    and the card is dimmed.
  - *Maxed* — button gone, a "● MAXED" marker in its place.
- Prereqs keep the tree shallow and legible: each branch's second/third node
  requires its predecessor at level ≥ 1.

## 4. Accessibility (Enhanced tier — non-negotiable)
- All text ≥ 24px at the 1080 reference; all touch targets ≥ 96px.
- Every state reads without color: the segmented control marks its active
  side with fill **and** the selected word **and** an underline; node states
  use words ("BUY" / "NEED N ◆" / "REQUIRES …" / "● MAXED"); the armed
  confirm re-texts the button face.
- No looping animation longer than 1.5s; the Eclipse celebration is a
  one-shot. Explicit `mouse_filter` on every node.
- Void Crystal count is shown in full precision (small numbers) via
  NumberFormat; nothing is color-only.

## 5. Manager architecture

Two new autoloads, both slotting into the existing patterns:

- **SkillTreeManager** — loads *before* PlayerStats (which reads its
  bonuses). Owns SkillNodeDefinition resources + a purchased-levels dict;
  spends Void Crystals; exposes `get_stat_additive(stat)`,
  `get_attack_speed_mult()`, `has_flag(flag)`, and a save section. Its
  bonuses layer into the existing PlayerStats / IdleManager getters exactly
  as relics and pets do — no calling code changes.
- **PrestigeManager** — loads last. Tracks run peak + lifetime peak +
  prestige count; computes the crystal reward (× Crystalline); performs the
  Eclipse by calling `reset_for_prestige()` on the run-scoped managers
  (Currency essence, Upgrade, World, Combat, Idle) in a fixed order; grants
  crystals; saves; emits `eclipse_performed`. Save section of its own.

New EventBus signals: `eclipse_available`, `eclipse_performed(reward,
prestige_count)`, `skill_purchased(id, new_level)`.

New scene constant `SCENE_ECLIPSE`; new currency already exists
(`VOID_CRYSTALS`).

## 6. Edge cases the implementation must honor
- **Mid-boss Eclipse.** Collapsing during a held/active boss fight is fine —
  the reset drops state to NORMAL level 1 and respawns cleanly; no boss
  timer survives.
- **Offline + Eclipse.** A pending offline reward is essence; it is granted
  before any Eclipse (normal flow) and simply gets wiped with the essence
  reset if the player ascends immediately — no double-counting, no crash.
- **Auto-attack flag.** After the reset, IdleManager's unlocked flag is set
  from `SkillTreeManager.has_flag(&"auto_attack_start")`; the tick timer is
  started or stopped to match, and pending offline state is cleared.
- **Save timing.** The Eclipse persists immediately on commit (like a world
  unlock) so a force-kill can never replay the payout or lose it.
- **Grandfather.** A returning save with a high level but no prestige
  section defaults cleanly (prestige_count 0, powers empty) and the unlock
  banner fires on the next live peak crossing, never on load.
