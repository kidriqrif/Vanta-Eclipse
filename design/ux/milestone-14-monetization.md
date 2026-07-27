# Milestone 14 — Monetization: Offers, Purchases, Cosmetics

## 0. SCOPE WARNING — READ FIRST

**This milestone ships the architecture, not a store-ready integration.**

Real rewarded ads need the AdMob (or equivalent) Godot Android plugin, a
publisher account, and a signed build. Real purchases need Google Play Billing,
a Play Console with configured SKUs, and server-side receipt validation. None
of that can exist in this repository yet.

What ships here is the **provider abstraction plus a stub provider**: the game
calls one interface, and a `StubAdProvider` / `StubBillingProvider` satisfies it
locally so the flows, entitlements, caps, and UI are all real and testable.
Swapping in the live SDKs later means writing one new provider class and
changing one line that picks it — no game code changes.

**Before release, Milestone 15 must:** add the billing/ads plugins, implement
`AdMobProvider` and `PlayBillingProvider`, add receipt validation, and set
`MonetizationManager.USE_STUB_PROVIDERS = false`. Until then, every purchase in
this build is free and local, and every "ad" is a simulated 3-second wait. The
Shop screen says so in a dev banner that only appears while the stubs are live.

## 1. The stance (from the GDD, non-negotiable)

Player-friendly. **No mechanic is ever pay-gated.** Ads and purchases only
*accelerate* or *decorate*. Specifically:

- Every ad is **opt-in and offered, never interstitial**. Nothing ever
  interrupts play. There is no "watch to continue".
- Every ad reward is a bonus on top of something the player already earned —
  never a gate on receiving it. Declining always keeps the base reward.
- Nothing purchasable is unobtainable by playing, except cosmetics, which
  affect nothing.
- Ad offers are **capped daily**, so the optimal strategy is never "grind ads".

## 2. Ad placements (three, all opt-in)

| Placement | Where | Offer | Daily cap |
|---|---|---|---|
| `offline_double` | the offline-rewards modal | double the essence just granted | 3 |
| `arcade_token` | the Arcade, when the meter is empty | +1 Arcade Token | 3 |
| `essence_boost` | gameplay, a quiet button | 10 minutes of essence at the live rate | 5 |

Each placement is a `.tres`, so tuning caps or adding a placement is data.
Rewards use the seconds-of-live-rate pricing the Arcade and Journal proved, so
they stay proportionate forever.

The offline modal's flow: the base reward is **already granted and stated**
before the offer appears. The button reads "WATCH · DOUBLE IT" and the modal's
dismiss remains a single tap at all times. Declining is never punished, never
re-prompted.

## 3. Purchases

| Product | Effect |
|---|---|
| `remove_ads` | every ad offer becomes **free and instant** — the reward is granted with no watch. It removes the *chore*, not the benefit. |
| `starter_pack` | 25 Void Crystals, 5 Arcade Tokens, and the Ember Trail cosmetic |
| `cosmetic_*` | one cosmetic each |

`remove_ads` is deliberately the strongest value: it converts every ad into a
one-tap bonus, permanently, with the daily caps still applying so it cannot
break the economy. Nobody who buys it loses access to anything, and nobody who
doesn't is gated.

Entitlements persist in the save under `"purchases"` and are **kept across an
Eclipse** — they are account-level, not run-level.

## 4. Cosmetics — tap trails

Cosmetics must not touch any state colour (the scope law), so they live where
no state is encoded: **the tap-impact effect and its damage numbers**.

A `CosmeticDefinition` names a display name, a trail colour, and a damage-number
colour. The default is the shipped violet. Alternatives (Ember, Frost, Crystal,
Verdant, Gold) each reuse an existing family hue — which is safe precisely
because a tap trail encodes no state, and the player chose it deliberately.

Cosmetics are bought with **Astral Shards** (the premium currency defined since
M1 and unused until now) or granted by a pack. Shards themselves are purchasable
and are never required for anything else.

## 5. The Shop screen
Reached from a SHOP button in the top bar beside JOURNAL.

- **Segmented control:** OFFERS | COSMETICS.
- **OFFERS:** the three ad placements (each showing its remaining daily count),
  then the purchase products. `remove_ads` shows as owned once bought.
- **COSMETICS:** a card per cosmetic, with an OWNED / EQUIP / price state and a
  live preview swatch.
- **The dev banner** at the top while stubs are live: "Development build —
  purchases are simulated and not charged." It is not subtle, on purpose.

## 6. Accessibility (Enhanced tier)
- Text ≥24px, targets ≥96px.
- Every state carries a word: WATCH / FREE (owned remove_ads) / "0 LEFT TODAY"
  / OWNED / EQUIPPED.
- The simulated ad wait shows a countdown with a numeric, not a spinner alone.
- No loop ≥1.5s.

## 7. Manager architecture

**MonetizationManager** (autoload, after QuestManager): owns placement and
product definitions, the daily ad counters (UTC-day keyed, same rule as the
Journal's dailies), entitlements, owned/equipped cosmetics, and its own
`"shop"` save section. `reset_for_prestige()` is a no-op.

Providers are plain objects behind two tiny interfaces, so the live SDKs slot
in without touching any caller:

```
AdProvider.request_rewarded(placement_id) -> bool (awaited)
BillingProvider.purchase(product_id) -> bool (awaited)
```

New EventBus signals: `ad_reward_granted(placement, amount)`,
`purchase_completed(product_id)`, `cosmetic_equipped(id)`.
