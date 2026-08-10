# The monetisation switch

Everything that has to change **in one commit** when AdMob and Play Billing go
in. Not a sequence — a single atomic flip, because each half of it makes the
other half a false declaration to Google.

The privacy policy for the monetised build is already written and sits at
`docs/privacy-policy-ads.html`. It is **not published**: the live page at
`docs/privacy-policy.html` describes the app that actually installs today, which
takes no money, shows no adverts, and does not even hold the `INTERNET`
permission. Publishing an advertising policy for a build with no advertising is
a false statement to users and contradicts the Data Safety form, so it waits.

---

## Why it is atomic

Play cross-checks four things against each other and against the artifact:

| | must say |
|---|---|
| The bundle | contains the advert SDK, declares `AD_ID` and `INTERNET` |
| Data safety | Advertising ID collected, device data collected, purpose "advertising" |
| Store listing | Contains ads = **Yes**, In-app purchases = **Yes** |
| Privacy policy URL | describes exactly that collection |

Any one of them out of step with the others is a policy violation, and the two
directions fail differently. Declaring ads you do not serve gets the listing
rejected. **Serving ads you did not declare gets the app suspended.**

---

## What only the account holder can supply

None of this can be produced from inside the repository, and the code cannot be
written blind against it — an ad unit ID is not guessable and a billing
integration cannot be tested without a Play Console that has the SKUs in it.

| Needed | Where it comes from | Blocks |
|---|---|---|
| AdMob account + app registered for Android | admob.google.com, free | everything advert |
| **App ID** `ca-app-pub-…~…` | AdMob, per app | goes in `GoogleMobileAdsSettings`; a wrong one crashes on launch |
| **Rewarded ad unit IDs** ×3 | AdMob, one per placement | `arcade_token`, `essence_boost`, `offline_double` |
| A certified CMP configured for EEA/UK | AdMob → Privacy & messaging | lawful ads in Europe, and the promise the policy already makes |
| Play Console app entry, package uploaded once | play.google.com/console | Billing cannot be tested until a build with the library is on a track |
| **Three SKUs created and activated** | Play Console → Products | `vanta_remove_ads`, `vanta_starter_pack`, `vanta_shards_small` |
| Prices confirmed per SKU | Play Console | $4.99 / $2.99 / $1.99 are the current placeholders |
| A licence-tester account | Play Console → Setup → Licence testing | buying without being charged |
| A decision on receipt validation | you | see below — it is the one item with a cost attached |

**Receipt validation is the fork in the road.** Client-only "the purchase
succeeded" is trivially spoofable on a rooted device. Validating properly means
a server — Cloud Functions, a small VPS, anything — holding a Google Play
service-account key and answering "does this token entitle this account". That
is a running service with a bill, however small, attached to an app that
currently has no backend at all and no `INTERNET` permission. The honest
alternative for a $4.99 cosmetic-and-convenience SKU is to accept client-side
grants and treat the save file as the record, which is what the code does
today. It is a real trade-off and it is yours to make.

---

## The list

### Code
- [ ] Add the Google Mobile Ads Unity package and Play Billing. **Neither is in
      `Packages/manifest.json` today** — the dependency list is ten Unity
      modules and Newtonsoft, nothing else. That is why the bundle can honestly
      declare no advert SDK.
- [ ] Implement `UnityAdProvider : IAdProvider` and
      `UnityBillingProvider : IBillingProvider` in
      `Assets/Scripts/Monetization/Providers.cs`, including `RestorePurchases()`
      — the Shop already calls it. Both classes exist and both deliberately
      **refuse**: they log an error and report failure rather than returning the
      stub's silent success, so a half-finished switch cannot grant anything.
- [ ] **The EEA/UK consent form (Google UMP) is a separate integration.**
      `docs/privacy-policy-ads.html` already promises that "the advert SDK will
      ask for your consent, or offer you a way to refuse". AdMob does not do
      that on its own — it needs the User Messaging Platform SDK and a certified
      CMP configured in the AdMob console, gathered *before* the first ad
      request. Without it that sentence is a false statement to European users
      and serving personalised ads there is a GDPR problem, not just a policy
      one.
- [ ] **Show the store's localised price, not `priceText`.** Every product asset
      carries a hardcoded `"$4.99"`-style string and `Shop.MakeProductCard`
      renders it directly. Play Billing returns the real, currency-correct price
      per user; a British player must not be shown dollars. Query the SKU and
      keep `priceText` only as the pre-connection fallback.
- [ ] **Server-side receipt validation.** A client-only "purchase succeeded" is
      trivially spoofable. Nothing that costs real money may be granted on the
      client's word alone.
- [ ] Decide where entitlements live. Today they are plain strings in
      `savegame.json`, so adding `"remove_ads"` by hand grants it. `SaveRead`
      deliberately preserves unrecognised entitlements rather than erasing them,
      which is right for a local cache and wrong for an authority: once billing
      is real, the store's response must be what grants an entitlement and the
      save file only caches it offline.
- [ ] Set `MonetizationManager.UseStubProviders = false`. This one line flips
      `PaidSurfacesAvailable`, which un-hides the Shop's offers tab, the arcade
      token offer and the offline doubler.
- [ ] Restore `INTERNET` and `ACCESS_NETWORK_STATE` in
      `Assets/Plugins/Android/AndroidManifest.xml`. They are absent on purpose
      today and that absence is what makes the current policy's "makes no
      network requests" claim true rather than aspirational.
- [ ] The advert SDK adds `com.google.android.gms.permission.AD_ID` itself.
      Confirm it in the built artifact with `aapt2 dump badging`, do not assume.

### Published pages
- [ ] `cp docs/privacy-policy-ads.html docs/privacy-policy.html`, then
      `python tools/make_docs.py` to restyle it, then check the date at the top
      says the day it goes live.
- [ ] `Assets/Scripts/UI/SettingsMenu.cs` already opens
      `https://kidriqrif.github.io/Vanta-Eclipse/privacy-policy.html`, so the
      URL does not change. Verify the page it lands on is the new one.

### Play Console
- [ ] Store listing: **Contains ads = Yes**, **In-app purchases = Yes**
      (rewarded video only; $0.99–$4.99).
- [ ] Redo **Data Safety** from the advert SDK's own disclosure — not from this
      file, and not from the game's code, because the SDK collects things the
      game never sees.
- [ ] Advertising ID declaration.
- [ ] Create the SKUs matching `store_id` in the product definitions:
      `vanta_remove_ads`, `vanta_starter_pack`, `vanta_shards_small`.
- [ ] Re-check the content rating questionnaire — it asks about advertising.

### Listing copy
- [ ] `production/store-listing.md` currently declares no ads and no IAP, and
      its FAIR BY DESIGN paragraph says "no ads, no purchases". Both have to
      change in the same commit. The design intent — every advert opt-in, every
      advert a bonus rather than a gate, nothing pay-gated — is what the
      replacement paragraph should say, because that is what the code enforces
      through `MonetizationManager`.

---

## What is already built, and does not need touching

The whole surface exists and is wired; only the two providers are hollow.

| | |
|---|---|
| Rewarded placements | `arcade_token` (1 token, 3/day), `essence_boost` (600s of essence at the live rate, 5/day), `offline_double` (doubles the collection, 3/day, contextual) |
| Products | `remove_ads` $4.99, `starter_pack` $2.99, `shards_small` $1.99 — SKUs `vanta_remove_ads`, `vanta_starter_pack`, `vanta_shards_small` |
| Surfaces | Shop offers tab, Arcade's out-of-tokens offer, the offline modal's doubler, Restore Purchases |
| `remove_ads` behaviour | every offer becomes one-tap and instant; the daily caps still apply, so it removes the chore and never the balance |
| Integrity | a use is burned only on a completed watch that actually paid; entitlements survive a definition that fails to load; a double-tap cannot run two |

## What is NOT optimised, and is a decision rather than a bug

- **Nothing upsells `remove_ads`.** It is one card on the Shop's offers tab and
  appears nowhere else. The moment a remove-ads SKU converts is the moment a
  player has just watched their third advert of the day and is told "none left
  today" — and that string is rendered by `Shop.MakeOfferCard` with no route to
  the product sitting two cards below it. Same for the Arcade offer and the
  offline modal, both of which say *watch* without ever saying *or don't*.
- **`essence_boost` is worth 10 minutes; `offline_double` is worth up to 8.**
  The offline cap is `IdleManager.OfflineCapSeconds` = 8h before Long Slumber
  extends it, so the contextual placement can pay ~48× what the standing one
  does for the same 30-second advert. Players learn that ratio fast and the
  Shop's offers go dead. Either raise `rewardAmount` or accept that the offline
  doubler is the real placement and the other two are garnish.
- **One shard pack against a 320-shard shortfall.** ~420 shards are earnable
  and every cosmetic costs 740, so the gap is exactly 1.6 × `shards_small`.
  A player who wants the last two trails must buy the same $1.99 pack twice
  and overshoot. A second, larger tier would price the whole set in one go.
- **`starter_pack` is permanent and unframed.** Starter packs convert on
  first-session urgency; this one is card five in a list, forever.

None of these block the switch. They are the difference between monetisation
that exists and monetisation that earns, and each one is a design call rather
than a defect — which is why they are listed here and not in the checklist.

---

## What stays true either way

The stance in the GDD does not move: **no mechanic is ever pay-gated.** Every
advert is offered and opt-in, never interstitial; every advert reward is a bonus
on top of something already earned, never a gate on receiving it; declining is
never punished; offers are capped per day so "grind adverts" is never optimal.
`MonetizationManager` enforces the caps and `PaidSurfacesAvailable` is the
single switch that hides every paid surface, so a monetisation-free build stays
shippable from the same source.
