# Monetisation go-live runbook

How to take ads and purchases from where they are today (Google's sample ads,
billing switched off) to live. Every Android build made with
`npm run android:sync` already contains AdMob and the Play Billing library.
Going live means changing values in two files and configuring two Google
consoles.

The Play Console declarations this depends on (Ads, Data safety, In-app
purchases, content rating) are listed in `design/RELEASE-CHECKLIST.md`. The
design rules come from `design/ux/milestone-14-monetization.md`: every video is
opt-in, never interstitial, and is a bonus on top of something already earned.

---

## The switches

Only two files change at launch.

| Switch | File | Today | What it does |
|---|---|---|---|
| AdMob App ID | `android/app/src/main/AndroidManifest.xml`, meta-data `com.google.android.gms.ads.APPLICATION_ID` | Google's sample `ca-app-pub-3940256099942544~3347511713` | Identifies the app to the Mobile Ads SDK. It must be the ID (with a `~`) of the same AdMob app that owns the two units below. |
| `ADMOB.bannerAdUnitId` | `src/config/monetization.ts` | sample banner unit | The adaptive banner at the bottom of the screen. |
| `ADMOB.rewardedAdUnitId` | `src/config/monetization.ts` | sample rewarded unit | One unit shared by all three rewarded offers. |
| `ADMOB.isTesting` | `src/config/monetization.ts` | `true` | While `true`, the AdMob plugin replaces whatever unit ID it is given with Google's sample ID, so real IDs plus `true` still show only test ads and earn nothing. It also starts the SDK in testing mode. Set `false` only for the production build. |
| `BILLING_ENABLED` | `src/config/monetization.ts` | `false` | While `false`, `src/services/billing.ts` never connects to Play: paid items read "COMING SOON" and nothing is granted. While `true`, on launch the app asks Play for the three products. Each one Play returns becomes buyable at Play's own localised price, and owned non-consumables are re-granted. |

Nothing else needs editing. Ad placements, caps and product contents are data
in `src/data/definitions.ts`.

## What the player gets

**Ads.** AdMob initialises first, then checks UMP consent and shows Google's
form if one is required. Only after that does it request any ad (see
`src/services/ads.ts`).

| Placement | Where it appears | Reward | Daily cap |
|---|---|---|---|
| `offline_double` | only in the offline-rewards modal | doubles the essence just granted | 3 |
| `arcade_token` | the Arcade, when out of tokens | +1 Arcade Token | 3 |
| `essence_boost` | the BAZAAR (shop) tab | 600 s of essence at the current rate | 5 |

A watch is counted after the reward is granted, so a watch that pays nothing
never uses up an offer. Remove Ads skips the video only, and the daily caps
still apply.

**Products.** None of them carries a price in code.

| Product | Play product ID | Type | Contents |
|---|---|---|---|
| Remove Ads | `vanta_remove_ads` | non-consumable | hides the banner; every offer becomes instant |
| Starter Pack | `vanta_starter_pack` | non-consumable | 25 Void Crystals, 5 Arcade Tokens, the Ember Trail |
| Astral Shards Pouch | `vanta_shards_small` | consumable | 200 Astral Shards |

Purchases are granted by `PURCHASE_GRANTED` in `src/game/reducer.ts`, once
per Play transaction id. The game saves the grant before it acknowledges an
entitlement or consumes a shard pack, so a crash in between re-grants nothing
and loses nothing. While billing is on, `syncPurchases()`
(`src/hooks/useMonetization.ts`) asks Play at launch and on resume (at most
once a minute) for every paid purchase the account still holds, and grants
and finalizes any the save is missing. A reinstall, or a new phone signed in
to the same account, therefore gets Remove Ads back without a tap.

---

## Steps

### 1. AdMob console

- [ ] Create the app (Android). It does not need to be on the Play Store yet;
      link it to the store listing once the listing is public.
- [ ] Create one **Banner** unit and one **Rewarded** unit. The game ignores
      the reward amount you type into the rewarded unit, because the game
      decides the reward itself.
- [ ] Privacy & messaging: create and publish a **European regulations
      (GDPR)** message and a **US state regulations** message.
- [ ] app-ads.txt: AdMob shows you one line for your publisher ID. Publish it
      as app-ads.txt at the root of the domain entered as "Website" in the
      Play listing. AdMob does not look under a path. If that website is this
      repo's GitHub Pages site, the root is https://kidriqrif.github.io/,
      which is served by a separate repository named kidriqrif.github.io.
      A file in this repo's `docs/` would end up under /Vanta-Eclipse/, where
      AdMob would not find it.
- [ ] Blocking controls → **Maximum ad content rating**: set it to match the
      lowest rating Play issues for the game (G for 3+ / Everyone / PEGI 3, PG
      for 7+ / E10+ / PEGI 7). Play's Ads policy requires the ads to suit the
      app's rating, and `src/services/ads.ts` sets no rating of its own.
- [ ] Settings → Test devices: register every phone you will run the release
      build on.

### 2. Ads in code

- [ ] Put the real App ID in `android/app/src/main/AndroidManifest.xml` and
      the two real unit IDs in `src/config/monetization.ts`. Leave
      `isTesting: true`.
- [ ] Bump versionCode, run `npm run android:sync`, and install. You should
      still see sample ads with a test label, which confirms the plugin's
      substitution is working.
- [ ] Production build only: set `isTesting: false`. Install it on a
      **registered test device**. AdMob should serve real-inventory ads
      marked as test ads. If an ad appears without a test label, the device is
      not registered: do not tap it.
- [ ] Consent: the code passes no debug geography to
      `AdMob.requestConsentInfo`, so the GDPR form only appears where it
      legally applies. To see it from outside the EEA/UK, temporarily pass
      `debugGeography` and `testDeviceIdentifiers` in `src/services/ads.ts`,
      then remove them before release. The privacy policy promises an "Ad
      privacy options" entry in Settings where consent applies. It is driven
      by `usePrivacyOptionsRequired()` in `src/hooks/useMonetization.ts` and
      `ads.showPrivacyOptions()`, so check that the entry appears.

### 3. Play Console (billing)

- [ ] Set up a payments profile (merchant account). Without one you cannot
      create paid products.
- [ ] Put a bundle from this codebase on the closed testing track. It carries
      the BILLING permission, and Play Console may refuse to create in-app
      products until an uploaded build has it.
- [ ] Monetize → one-time products: create `vanta_remove_ads`,
      `vanta_starter_pack` and `vanta_shards_small`, with exactly those IDs
      (they are `storeId` in `src/data/definitions.ts`). Set the names,
      descriptions and prices, then activate them. Play Console has no
      consumable switch: the app consumes the product, based on `consumable`
      in the definitions.
- [ ] Settings → License testing: add the Google accounts you will test
      with. Each one must also be opted in to the closed track and must
      install the app **from Play**, not by sideloading.

### 4. Billing in code

- [ ] Set `BILLING_ENABLED = true`, bump versionCode, run
      `npm run android:sync`, sign and upload to closed testing.
- [ ] **That build charges real money** to any closed tester who is not a
      license tester. Keep the track to license testers while you test, or
      warn testers.

### 5. Test

Test ads on a registered test device:

- [ ] The banner appears at the bottom and does not cover the navigation bar.
- [ ] Each rewarded offer: watching to the end grants the reward and lowers
      the remaining count. Closing early grants nothing and costs nothing. At
      the cap the offer is disabled.
- [ ] In airplane mode the offers are unavailable and the game still plays.
- [ ] In the EEA (real or debug geography), the consent form appears before
      any ad, and declining it does not block the game.

Test purchases with a license-tester account:

- [ ] Each product shows Play's price, not "COMING SOON".
- [ ] Buy each one. It is granted once, and a cancelled purchase grants
      nothing.
- [ ] Remove Ads: the banner disappears and offers become instant, with the
      caps unchanged.
- [ ] Starter Pack: 25 crystals, 5 tokens and the Ember Trail arrive, and it
      cannot be bought a second time.
- [ ] Shards Pouch: it can be bought again, because it is consumed.
- [ ] Clear the app's data (or reinstall) and launch: Remove Ads and the
      Starter Pack come back on their own. Restore Purchases in Settings does
      the same on demand. Shards are not restored, which is expected for a
      consumable.
- [ ] Pending payment (the license tester's "slow" test card): the game says
      the purchase is pending and grants nothing. Once the payment clears,
      bring the app back to the foreground (or relaunch it): the item arrives,
      including a Shards Pouch, and the order shows as acknowledged in Play
      Console (Order management).
- [ ] Buy Remove Ads on one device, then tap it again on a second device with
      the same account: the game says it is already owned and restores it.

### 6. Release

- [ ] Production build: real IDs, `isTesting: false`, `BILLING_ENABLED` set to
      `true` (or left `false` to launch with ads only), versionCode bumped.
- [ ] Play Console declarations updated to match: see
      `design/RELEASE-CHECKLIST.md`. Play checks the bundle, the Ads
      declaration, Data safety and the privacy policy against each other.
      Shipping ads you have not declared is the failure that gets an app
      suspended.
- [ ] Once the listing is public, link the AdMob app to it. AdMob limits ad
      serving until the app is linked and has passed its review.

---

## What not to do

- **Never click your own live ads**, and never ask friends or testers to.
  AdMob treats it as invalid traffic and can disable the account. Register
  your own phones as test devices instead.
- **Keep `isTesting: true` until the real IDs are in place** and you are
  building for production. Shipping real IDs with `isTesting: true` serves
  test ads to every player and earns nothing.
- Don't mix the sample App ID with real unit IDs, or the other way round.
  Change all three IDs together.
- Don't rename or recreate products. Play product IDs are permanent and must
  equal `storeId` in `src/data/definitions.ts`.
- Don't add interstitials or forced ads. The spec and the published privacy
  policy both promise that every video is optional.
- Don't test monetisation in the browser. The web build has no ad network.
  `npm run dev` simulates a rewarded watch so the flows can be tested, and a
  production web build offers nothing.

## Known gaps (decisions, not blockers)

- **No server-side receipt validation.** The game has no server. Grants rely
  on the Play Billing client's purchase state, and the save's `entitlements`
  list is the record, so a rooted device could edit it. For these three
  products that is an acceptable trade. Closing the gap would mean a backend
  holding a Play service-account key.
- **Refunds are not revoked.** Entitlements are only ever added (purchase,
  restore). A refunded Remove Ads stays in the save.
- **Pending purchases.** `src/services/billing.ts` grants nothing while a
  payment is pending. Once it clears, the purchase sync at the next launch or
  resume grants it (a Shards Pouch included) and then acknowledges or
  consumes it. A player who never reopens the game within three days is
  refunded by Play, because the purchase is never acknowledged.
- **Saves from the AI Studio build.** That build granted Remove Ads and the
  Starter Pack without payment. The v1 → v2 migration in `src/game/save.ts`
  drops those entitlements and keeps what the pack contained. Closed testers
  who "bought" them will see the banner again, so mention it in the release
  notes.
