# Play Console answers — Vanta Eclipse 1.4.0

Ready-to-paste answers for every declaration on Play Console's **App content**
page, the Store settings, the 1.4.0 release notes and a message for the closed
testers. Checked on 2026-10-06 against the code on the main branch and against Google's
own pages, which were fetched the same day (listed under Sources at the end).

The build in question: package com.vantrexagames.vantaeclipse, versionName
1.4.0, versionCode 5, targetSdk 36 (`android/app/build.gradle`,
`android/variables.gradle`). It is on the closed testing track.

**How to read the question wording.** Each question is marked:

- **(G)**: taken from a Google help page (or Google's sample Data safety CSV)
  fetched on 2026-10-06, quoted or closely paraphrased.
- **(B)**: the best-known Console wording. Google publishes no text for it, so
  check it against the live form. The answer does not change if the wording
  differs.

**Two states.** Today BILLING_ENABLED is false in
`src/config/monetization.ts`: the shop shows COMING SOON and nothing can be
bought. The answers below are for today. The section
[When billing goes on](#when-billing-goes-on) lists the few answers that change
when that switch is turned on.

**What is the owner's decision.** Answers marked **Owner's call** are judgement
calls. Each one comes with a recommendation and its reason, but the choice is
yours.

---

## 0. The facts the answers rest on

### What leaves the phone

| Component | What it sends | Where in the code |
|---|---|---|
| Google Mobile Ads SDK (play-services-ads 25.4.0, via @capacitor-community/admob 8.1.0) and the UMP consent SDK (user-messaging-platform 4.0.0) | Google's disclosure lists four types: **IP address** (used to estimate general location), **user product interactions** (app launch, taps, video views), **diagnostic information** (app launch time, hang rate, energy usage), and **device and account identifiers** (advertising ID, app set ID, and "if applicable" identifiers of signed-in accounts). All of it is sent over TLS. The SDK starts on every launch, including for players who bought Remove Ads (`src/context/GameProvider.tsx` calls the ads start-up unconditionally). | `src/services/ads.ts` (initialise, then UMP consent, then a banner and opt-in rewarded videos; no interstitials), `src/components/BannerSlot.tsx` |
| Google Play Billing Library 9.1.0 (via @capgo/native-purchases 8.8.1) | **Nothing today.** The library ships in every build, but `src/services/billing.ts` returns before calling it while BILLING_ENABLED is false, and the plugin creates no billing client until it is called. Once billing is on, the app asks Google Play, on the device, for products and purchases, and keeps the product IDs and transaction IDs in the local save so it can restore them. There is no server, so nothing goes to the developer. The library's own dependencies include Google's datatransport logging library and play-services-location; the app has no location permission, and Google publishes no data disclosure for the Billing Library. | `src/services/billing.ts`, `src/game/reducer.ts` (PURCHASE_GRANTED) |
| The game itself | **Nothing.** There is no account, no analytics, no crash reporting and no server. Progress is a local save (WebView localStorage, `src/game/save.ts`). Export and Import in Settings copy the save to the clipboard, and only by hand. Fonts are bundled (@fontsource) and the audio loads from the app's own files (`src/services/audio.ts`). The only outside link is the privacy policy, which opens in the browser (`src/components/SettingsModal.tsx`). | `package.json`, `src/main.tsx` |
| Android Auto Backup | android:allowBackup="true" (`android/app/src/main/AndroidManifest.xml`), so Android may copy the save into the user's own Google account backup. This is a system feature run by Google; the developer cannot read the copy. The privacy policy describes it. | `android/app/src/main/AndroidManifest.xml` |

**Permissions** in the merged release manifest (build output under
android/app/build/, built today): INTERNET, ACCESS_NETWORK_STATE, VIBRATE,
com.google.android.gms.permission.AD_ID, ACCESS_ADSERVICES_AD_ID,
ACCESS_ADSERVICES_ATTRIBUTION, ACCESS_ADSERVICES_TOPICS,
com.android.vending.BILLING, WAKE_LOCK, FOREGROUND_SERVICE, and the app's own
signature-level DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION. Only INTERNET is in
the source manifest. The merger report (also under android/app/build/) gives
the sources: ACCESS_NETWORK_STATE, AD_ID and the three ACCESS_ADSERVICES_*
permissions come from the AdMob SDK; WAKE_LOCK (from WorkManager and
play-services-measurement-sdk-api) and FOREGROUND_SERVICE (from WorkManager)
come from libraries the AdMob SDK pulls in; BILLING
comes from the Billing Library; VIBRATE from @capacitor/haptics; and the
signature permission from androidx.core. The AdMob SDK removes WorkManager's
RECEIVE_BOOT_COMPLETED itself. The app has no location, camera, microphone,
contacts, storage or phone permission. No foreground service declares a type,
so the Foreground service declaration should not be asked for.

**SDK version.** Google's disclosure page describes SDK 25.5.0 and asks apps on
older versions to consider updating so the disclosure stays accurate. This
build resolves 25.4.0 (the plugin pins 25.4.+). The four data types are the
same; re-check the page whenever the SDK version changes.

### What is in the game

- **Combat.** You tap 64×64 pixel-art fantasy creatures (wisps, fiends,
  shades, a red four-legged shade stalker, a robot-like sentinel, and round
  sun- or orb-like bosses such as the Hollow Sovereign and the Silent Colossus;
  see `public/art/enemies/`), and each has a health bar. A hit makes the sprite
  flash and shake (`src/index.css`). A defeated enemy is replaced by the next
  one. There is no player avatar, no human character and no blood on screen.
  The text says "kill" and "slay" ("Every kill gives you essence"), the first
  chain quest is called "First Blood" ("Slay 10 enemies in the Dark Forest"),
  and a skull icon marks boss fights (`src/data/definitions.ts`, QUESTS).
- **Words.** There is no swearing, no sexual content, and no drugs, alcohol or
  tobacco.
- **The seven minigames** (`src/data/definitions.ts`, MINIGAMES): Void Reflex,
  Memory Match, Lights Out, Connect Four, Sequence Echo, Rune Sweeper (like
  Minesweeper) and Void Salvo (like Battleship). They are puzzle and reflex
  games. Each one costs 1 Arcade Token and pays essence by how well you played
  (`src/game/arcade.ts`). There are no casino games, no betting and no wagers.
- **Random rewards, all earned by playing.** Gear drops and forging roll a
  rarity from Common to Mythic. Bosses drop collectible cards, and relics drop
  in the second world (`src/game/loot.ts`, `src/game/reducer.ts`). Forging costs
  Void Scraps, which come only from salvage.
- **Paid products** (`src/data/definitions.ts`, PRODUCTS): Remove Ads (one
  time), the Starter Pack (one time: 25 Void Crystals, 5 Arcade Tokens and the
  Ember Trail) and the Astral Shards Pouch (200 shards, repeatable). Shards buy
  trails at fixed prices, crystals buy Ascendant Powers at fixed costs, and
  tokens play the minigames. **Nothing random can be bought with real money.**
- **Ads** (`src/data/definitions.ts`, ADS): a banner and three opt-in rewarded
  offers, capped at 3, 3 and 5 a day. The IDs are Google's sample IDs until
  launch. Google's disclosure makes no exception for test ads, so the same
  data types apply.

---

## 1. Privacy policy

| Question | Answer | Why |
|---|---|---|
| Privacy policy URL (G) | https://kidriqrif.github.io/Vanta-Eclipse/privacy-policy.html | Live on 2026-10-06 (HTTP 200, "last updated 2026-10-06", byte-identical to `docs/privacy-policy.html`). It covers AdMob, Play Billing, the permissions and backup. The game also links to it from Settings (`src/components/SettingsModal.tsx`). |

```
https://kidriqrif.github.io/Vanta-Eclipse/privacy-policy.html
```

**The policy matches these answers.** Google requires the policy to disclose
the app's data handling comprehensively, and a reviewer may compare it with the
Data safety form. The 2026-10-06 policy names everything declared below: the
advertising ID and app set ID, approximate location from the IP address, device
and app information with the SDK's performance diagnostics, advert interactions,
all eleven permissions in the bundle with where each comes from, and the
Android backup. It says the developer holds no personal data, matching the
deletion answer in section 8. If an answer below changes, change the policy in
the same commit (keep `docs/privacy-policy.html` and `public/privacy-policy.html`
identical and bump the date).

## 2. App access (now titled "Sign-in details")

Google's help page now calls this section **Sign-in details**. Older Consoles
call it **App access**.

| Question | Answer | Why |
|---|---|---|
| Is all or part of the app restricted by login, membership, location or other authentication? (G, paraphrased) | **All functionality is available without any special access** (B: the option's exact label is not on Google's page). Add no instructions. | The game has no login, account or region gate. The Arcade (level 20), the Eclipse (level 50) and the Frozen Ruins (level 51) open through play, which is progression, not restricted access (`src/game/state.ts`). |

## 3. Ads

| Question | Answer | Why |
|---|---|---|
| Does your app contain ads? (G, paraphrased) | **Yes, my app contains ads** (B: Google's page says only "select Yes or No"). | Every build has the AdMob banner and the rewarded offers (`src/services/ads.ts`, `src/components/BannerSlot.tsx`). Test ads count too. The "Contains ads" label is correct even after a player buys Remove Ads, because other players still see ads. |

## 4. Content rating (IARC questionnaire)

The IARC questionnaire can only be opened inside a store's console (IARC FAQ),
so there is no public copy of its wording. The questions below are grouped by
topic, and the wording is (B). Follow-up questions appear only after a Yes.

| Topic | Question (B) | Answer | Why |
|---|---|---|---|
| Email | Email for IARC correspondence (G: "used for correspondence with International Age Rating Coalition") | **Owner's call:** your developer email | IARC sends the certificate there. |
| Category (G) | Select a category | **Game** | It is an idle RPG with minigames. |
| Violence | Does the game contain violence? | **Yes** | You tap to damage and defeat creatures. |
| Violence: kind | Is it cartoon or fantasy violence, or realistic? | **Fantasy / cartoon, not realistic** | The enemies are stylised 64×64 pixel creatures (`public/art/enemies/`). A hit is a flash and a shake. |
| Violence: targets | Is violence directed at human-looking characters or realistic animals? | **No** | The enemies are wisps, fiends, shades, a red four-legged shade stalker (a stylised beast, not a realistic animal), a robot-like sentinel and round sun- or orb-like bosses. There is no player avatar and no human. |
| Blood and gore | Does the game show blood or gore? | **No** | Neither appears in any sprite or effect (`src/index.css`). The word appears only in the quest name "First Blood", an idiom for a first kill; nothing is shown. |
| Fear | Does the game contain content that might frighten young children? | **No** | The palette is dark and a boss fight opens with a short warning sound and screen shake, but there are no horror images or jump scares. If IARC treats this as mildly frightening, the result is PEGI 7 / IARC 7+, which the expected result below already allows for. |
| Sexuality | Nudity, sexual content or suggestive themes? | **No** | None. |
| Language | Profanity, crude humour or discriminatory language? | **No** | None in `src/data/definitions.ts` or the UI text. |
| Controlled substances | References to drugs, alcohol or tobacco? | **No** | None. |
| Gambling: real | Can users bet or win real money or anything of value? | **No** | Nothing can be cashed out. Winnings are in-game essence. |
| Gambling: simulated | Does the game simulate gambling (casino, slots, card betting)? | **No** | The seven minigames are puzzle and reflex games, and each pays by performance (`src/game/arcade.ts`). |
| User interaction | Can users interact or exchange content (chat, voice, images)? | **No** | The game is single player with no network features. |
| Location | Does the app share the user's current physical location with other users? | **No** | It has no location permission. |
| Digital purchases | Can users purchase digital goods? | **Today: No.** Retake the questionnaire **with Yes** in the same release that turns billing on. | While BILLING_ENABLED is false nothing can be bought. Play requires a new questionnaire when features change the answers (G). **Owner's call:** answering Yes now saves a retake but describes a build that sells nothing. |
| Digital purchases: random | Do any purchases include randomised items (loot boxes, gacha)? | **No** | Every product has fixed contents (`src/data/definitions.ts`, PRODUCTS). The only random roll, the forge, costs Void Scraps, which cannot be bought. |
| Internet | Does the app give unrestricted access to the internet (browser, search)? | **No** | The only link is the privacy policy. |
| Miscellaneous (shown in some regions) | Nazi symbols, other region-specific items | **No** | None. |

**Expected result (Play calculates it, so this is not guaranteed):**
ESRB Everyone or Everyone 10+ with Fantasy Violence; PEGI 7 (possibly 3);
USK 6; IARC Generic 7+ (possibly 3+), which covers Malaysia and other countries
without their own authority; Australia G or PG. Once billing is on, the
interactive element **In-Game Purchases** is added. It does not say "includes
random items".

**Ads must match the rating** (Play's Ads policy: ads "must be appropriate for
the content rating of your app"). `src/services/ads.ts` sets no maximum ad
content rating, so the AdMob account default applies. **Owner's call:** in
AdMob, open Blocking controls (for the app, or for the whole account) and set
the maximum ad content rating to match the **lowest** rating you receive, since
one setting serves every country. AdMob's own table pairs **G with Google
Play's 3+** and **PG with 7+** (T is 12+). So: **G** if any authority rates the
game for everyone (ESRB Everyone, PEGI 3, IARC 3+); **PG** only if the lowest
rating is Everyone 10+, PEGI 7 or IARC 7+.

## 5. Target audience and content

| Question | Answer | Why |
|---|---|---|
| Target age (G): 5 and under, 6–8, 9–12, 13–15, 16–17, 18 and over | **Owner's call. Recommended: 13–15, 16–17, 18 and over.** Leave the three under-13 groups unticked. Google notes that 13–15 and 16–17 "may be considered to include children in some locales"; if the Console then asks Families or ads questions, they apply. | (1) The privacy policy says the app is not directed at children under 13 (`docs/privacy-policy.html`). (2) Ad requests are not child-directed: `src/services/ads.ts` sets no child-directed tag and no maximum ad rating, and the advertising ID is collected. (3) For children, the Families ad format rules require rewarded and opt-in ads to be closeable after 5 seconds (G), and the rewarded flow has never been built or tested for that. (4) The game is built around percentages, affixes and prestige maths. |
| App details: could your store listing unintentionally appeal to children? (B) | **Owner's call. Recommended: No.** | The listing copy is a dark-fantasy idle RPG. Google may reject a listing whose art suggests a child audience (G), so keep the new screenshots about the systems, not cute characters. |
| Ads (only asked if ads are served to children) | Not shown with 13+ only | |
| Store presence / Teacher Approved | Not eligible | It needs a child age group. |

**What choosing an under-13 group would trigger** (G: Families policies, the
Families Self-Certified Ads SDK list, AdMob Help):

- The whole app falls under the Families policy, for content, ads and
  monetisation.
- Ads shown to children or to users of unknown age must come from a Families
  Self-Certified Ads SDK. Google AdMob, play-services-ads 19.0.0 or later, is
  on that list, so the SDK itself qualifies. It also needs all of the
  following:
  - Every ad request to those users tagged child-directed
    (setTagForChildDirectedTreatment(true)), with the maximum ad content rating
    set to G.
  - No interest-based ads or remarketing.
  - The advertising ID must not be sent. An app aimed only at children should
    not even declare the AD_ID permission when it targets API 33 or higher.
  - A mixed audience (children and older) needs a neutral age screen so that
    only older users get ordinary ads.
  - Rewarded and opt-in ads must be closeable after 5 seconds.
- The privacy policy has to be rewritten. Today it says the game is not
  directed at children.
- None of this is built. It would mean code in `src/services/ads.ts`, a
  manifest change and an age screen.

## 6. Other App content declarations

| Declaration | Question | Answer | Why |
|---|---|---|---|
| News and Magazine apps | Is your app a news or magazine app? (G) | **No** | It is a game. |
| Government apps | Is your app developed by or on behalf of a government? (B) | **No** | It was made by a solo developer. |
| Financial features | Select the financial features your app provides (G) | **"My app doesn't provide any financial features"** (G) | In-app purchases through Google Play and in-game currencies are not on Google's list, which covers banking and loans, payments and transfers, purchase agreements (rewards and points schemes, buy now pay later), trading and funds (including crypto and NFTs), and support services such as insurance and credit reporting. Arcade Tokens are game currency, not crypto tokens. |
| Health apps | Select the health features your app provides (G) | **"My app doesn't provide any health features"** (G) | It has none and reads no health data. |
| COVID-19 contact tracing and status apps (if still listed) | Select the statements that apply (G) | **The app is not a publicly available COVID-19 contact tracing or status app** (B) | Not applicable. |
| Foreground service / sensitive permissions | n/a | **Not expected to be asked.** If Play asks: the app starts no foreground service. FOREGROUND_SERVICE and WAKE_LOCK come from WorkManager (WAKE_LOCK also from the measurement API), both pulled in by the AdMob SDK, and no service type is declared. Play asks for the declaration for the foreground service types an app uses (G). | Merged release manifest and merger report. |

## 7. Advertising ID

| Question | Answer | Why |
|---|---|---|
| Does your app use advertising ID? (B) | **Yes** | The AdMob SDK reads it for ads. The AD_ID permission is merged in from play-services-ads; it is not in the source manifest, which is expected (G: Advertising ID). Answering No would mean removing the permission. |
| Why does your app use advertising ID? (B; the options match the Data safety purposes) | **Advertising or marketing**, **Analytics**, **Fraud prevention, security, and compliance** | Google says the SDK collects identifiers "for advertising, analytics, and fraud prevention purposes" (G: AdMob disclosure). Use the same purposes as Device or other IDs in the Data safety form, so the two declarations agree. |

The ACCESS_ADSERVICES_* permissions (Android's Privacy Sandbox) also come from
the AdMob SDK. No separate declaration is known for them.

## 8. Data safety

The Data safety form describes the sum of every version on any track except
internal testing, so closed testing counts (G). If the form was submitted
earlier saying that no data is collected, it is already wrong for the build on
closed testing: correct it now, not at production. Once 1.4.0 replaces the old
build on every non-internal track, the old build's Play Games sign-in no longer
counts. Use **Export to CSV** on the form afterwards to keep a copy.

### 8.1 Data collection and security

| Question | Answer | Why |
|---|---|---|
| Does your app collect or share any of the required user data types? (G) | **Yes** | The AdMob SDK sends data off the device. SDK collection counts as the app's collection (G). |
| Is all of the user data collected by your app encrypted in transit? (G) | **Yes** | AdMob: "encrypted in transit using the Transport Layer Security (TLS) protocol" (G). The game itself sends nothing. |
| Which methods of account creation does your app support? (B) | **My app does not allow users to create an account** (B) | The game has no account, login or sign-in. The Play Games sign-in was removed in 1.4.0. |
| Do you provide a way for users to request that their data is deleted? (G: the label in Google's sample CSV) | **Owner's call. Recommended: No.** | The developer holds no user data. Google holds the AdMob data and controls deletion of it. Users can reset or delete their advertising ID in Android settings, and uninstalling deletes the save. The privacy policy's "Your rights" and "Children" sections both say there is nothing on the developer's side to delete. Answering Yes would promise a mechanism that can delete nothing. Google also allows Yes when collected data is automatically deleted or anonymised within 90 days (G); that does not apply, because Google, not the developer, sets how long AdMob keeps the data. |
| Independent security review (G) | **No** | None was done. |
| Committed to the Families policy (G) | Not applicable | No child age group (section 5). |

### 8.2 Data types: tick exactly these

| Category | Data type | Tick? | Why |
|---|---|---|---|
| Location | Approximate location | **Yes** | The SDK collects the IP address, "which may be used to estimate the general location" (G). Google: "Approximate location that is inferred, such as via IP address … must be disclosed here" (G). |
| App activity | App interactions | **Yes** | "user product interactions … including app launch, taps, and video views" (G). |
| App info and performance | Diagnostics | **Yes** | "app launch time, hang rate, and energy usage" (G). |
| Device or other IDs | Device or other IDs | **Yes** | "Android advertising (ad) ID, app set ID" (G). |
| Financial info | Purchase history | **Not today** (see [When billing goes on](#when-billing-goes-on)) | Billing is off, so the Billing Library is never called. |
| Location | Precise location | No | It has no location permission, and the IP only gives an approximate area. |
| Personal info | Name, Email, User IDs, others | No | The game has no account and asks for nothing. Google's disclosure puts "other identifiers related to signed-in accounts on the device, if applicable" in the same row as the ad ID ("Device and Account identifiers") and does not map it to a Play data type. The game has no sign-in of its own, so the recommendation is Device or other IDs only. Ticking User IDs as well would be the cautious reading, not a requirement. |
| Financial info | User payment info | No | Google Play takes the payment. The app never sees card details, and payment-service data is exempt when the app never accesses it (G). |
| App activity | Other actions (gameplay), Other user-generated content | No | Gameplay stays in the local save and is never sent. |
| App info and performance | Crash logs | No | There is no crash SDK. Android vitals is Google Play's own reporting, not the app's. |
| Files and docs | Files and docs | No | Export copies the save to the clipboard by hand and nothing is sent. |
| Everything else | Messages, photos, audio, contacts, calendar, health, web history, installed apps, search history | No | None is accessed. |

### 8.3 Data usage and handling: the same answers for each of the four types

Fill this in identically for **Approximate location**, **App interactions**,
**Diagnostics** and **Device or other IDs**:

| Question | Answer | Why |
|---|---|---|
| Is this data collected, shared, or both? (G) | **Collected** and **Shared** (tick both) | The SDK sends it off the device (collected) straight to Google (shared). An SDK that builds advertising profiles across apps is not a "service provider", so the transfer counts as sharing (G). |
| Is this data processed ephemerally? (G) | **No** | Data used to build advertising profiles cannot be called ephemeral (G). |
| Is this data required for your app, or can users choose whether it's collected? (G) | **Data collection is required (users can't turn off this data collection)** (G: the label in Google's sample CSV) | Optional is allowed only if all users, "regardless of device or region", can opt out (G). The banner loads for everyone, consent is asked only in some regions, refusing it still brings non-personalised or limited ads, and the SDK starts even with Remove Ads (`src/components/BannerSlot.tsx`, `src/context/GameProvider.tsx`). Deleting the advertising ID still leaves the app set ID and the IP address. |
| Why is this user data collected? (G) | **Advertising or marketing**; **Analytics**; **Fraud prevention, security, and compliance** | Google: the SDK "collects and shares the following data types automatically for advertising, analytics, and fraud prevention purposes" (G). |
| Why is this user data shared? (G) | **Advertising or marketing**; **Analytics**; **Fraud prevention, security, and compliance** | The same sentence. |

Leave App functionality, Developer communications, Personalization and Account
management unticked for these four. The game uses none of this data itself.

The privacy policy says this data "is collected by Google, not by us". That
does not contradict "Collected" here: Play counts data that an SDK sends off
the device as the app's collection, "irrespective of whether data is
transmitted to you or a third-party server" (G).

### 8.4 What the listing will then show

- **Data shared:** Location, App activity, App info and performance, Device or
  other IDs.
- **Data collected:** the same four.
- **Security practices:** data is encrypted in transit. If you answer No to
  deletion, it also shows that data can't be deleted (Play writes the wording).

The UMP consent SDK has no data disclosure page of its own: Google's UMP
disclosure address (https://developers.google.com/admob/ump/android/play-data-disclosure)
redirects to the AdMob page above. Its consent check sends device and app
information and the IP address to Google, which the four types above cover.
Swapping the sample AdMob IDs for real ones changes nothing in this form.

---

## When billing goes on

Do this in the **same release** that ships BILLING_ENABLED set to true to any
track other than internal testing. Closed testing counts. The products are
created first, as described in `production/monetisation-switch.md`.

| Where | Change |
|---|---|
| Data safety, data types | Tick **Financial info → Purchase history**. Nothing else changes. |
| Data safety, Purchase history handling | Collected **Yes**, shared **No**; ephemeral **No**; **Users can choose whether this data is collected** (data exists only for someone who buys); purpose **App functionality**. Why: the app reads the purchases from Google Play, then grants, acknowledges and restores them, and keeps product IDs and transaction IDs in the local save (`src/services/billing.ts`, `src/game/reducer.ts`). Nothing goes to the developer. |
| Content rating | Retake the questionnaire. Digital purchases **Yes**; random items **No**. |
| Store listing | Use the "once billing is on" description in `production/store-listing.md`. |
| Privacy policy | No billing-related change. It already describes Google Play Billing and the local purchase record. |

**Owner's call on Purchase history.** Strictly, Google defines "collect" as
sending data off the device, and the app never sends the purchase record
anywhere: Google Play itself processes the payment, which is exempt (G).
Google's "Declare your app's data use" guide still names "Uses Google Play's
Billing Library" as a way an app accesses financial info (G), and the Data
safety help asks apps that use a payment service to consider "whether your app
collects other financial information, like purchase history" (G).
**Recommended: declare it** as above. It only adds Financial info to the
listing, while leaving it off risks a discrepancy flag for an app that ships
the Billing Library.

---

## 9. Store settings

| Field | Answer | Why |
|---|---|---|
| App or game | **Game** | |
| Category | **Owner's call. Recommended: Role Playing.** | Gear, relics, companions and prestige make it an RPG; idle RPGs are listed there. Casual is the alternative. Google's game categories: Action, Adventure, Arcade, Board, Card, Casino, Casual, Educational, Music, Puzzle, Racing, Role Playing, Simulation, Sports, Strategy, Trivia, Word (G). |
| Tags (up to five, G) | **Owner's call.** Pick from Play's suggested list: something for idle, role playing, offline, single player and pixel art, if offered. | Tags must be obviously relevant from the listing (G). Skip the accessibility tags unless tested with TalkBack. |
| Email address (required) | **Owner's call.** The privacy policy and the store listing should show the same address; the privacy policy uses vantrexagames@gmail.com. | |
| Phone number (optional) | **Owner's call.** | |
| Website (optional) | **Owner's call.** | AdMob looks for app-ads.txt at the **root of the website's host** (G). The project site https://kidriqrif.github.io/Vanta-Eclipse/ cannot provide that: https://kidriqrif.github.io/app-ads.txt returned 404 on 2026-10-06. Options: a user-site repository named kidriqrif.github.io, your own domain, or Firebase Hosting as AdMob suggests. |
| External marketing | **Owner's call.** | |
| Google Play Games on PC | **Owner's call. Recommended: opt out until it has been tested.** | Free games appear there by default (G). This is a portrait, touch-only build that has not been tried on PC. The opt-out is a distribution setting rather than a Store settings field; where it sits in the Console is (B). |

---

## 10. Release notes for 1.4.0 ("What's new", en-US)

For the closed-testing release. **477 characters** including the 8 line breaks
(485 if Play counts a line break as two), under the 500 limit.

```
<en-US>
Rebuilt so the rules work as described.
• Bosses are a real 30-second gate fight. Lose, farm the level below, then try again.
• All seven minigames fixed, with one payout per game. Records start fresh.
• Quests that could not be claimed now can be.
• Forge cost, duplicate items and salvage fixed.
• Real music, sound effects and vibration.
• Progress saves when you leave the app.
• The broken Play Games sign-in is removed.
• Paid items show COMING SOON until purchases open.
</en-US>
```

Each line comes from the code: the 30-second timer (BOSS_FIGHT_SECONDS in
`src/game/state.ts`) and farming below the gate (`src/game/reducer.ts`); one
payout per run and records from wins only (`src/game/reducer.ts`); the quest,
forge, audio, save and Play Games fixes listed in `HANDOFF.md`; COMING SOON
(`src/components/ShopPanel.tsx`, `src/components/NoAdsModal.tsx`, gated by
`src/services/billing.ts`).

**Optional variant for the first production release**, when public players have
never seen the old build. **401 characters** including the 7 line breaks (408
if a line break counts as two):

```
<en-US>
First public release.
• Tap to fight; auto-attack takes over from level 15.
• A boss guards every tenth level, on a 30-second timer.
• Two worlds, gear in five rarities, five relics and two companions.
• Eclipse resets a run for Void Crystals and permanent powers.
• Seven arcade minigames from level 20.
• Daily quests, quest chains and achievements.
• Plays offline. Progress is saved on your phone.
</en-US>
```

---

## 11. Message to the closed testers

Send by email or post on the testers' group. Change the sign-off and the
contact address as you like.

```
Subject: Vanta Eclipse 1.4.0 is on the test track

Hi,

Version 1.4.0 of Vanta Eclipse is now on the closed test. Update it from the
Play Store as usual. If the update has not appeared yet, wait a few hours and
check Manage apps & device. Please stay opted in to the test.

Your progress carries over by itself: levels, currencies, gear, relics,
companions, cards, quest progress and trails. Three things are different:

1. Remove Ads and the Starter Pack. The old build gave these to everyone
   without payment, so they are not carried over. The crystals, tokens and
   Ember Trail you got from the pack stay with you. The banner comes back, and
   bonuses go back to being optional videos with daily limits. Paid items show
   COMING SOON until Google Play purchases are switched on.

2. Minigame records start fresh. The old build saved some losses as records
   and kept some the wrong way round. New records count wins only.

3. Ads are Google's test ads for now, labelled as test ads.

The full list of changes is in the "What's new" notes on the Play Store page.
If anything looks wrong, reply to this email or write to
vantrexagames@gmail.com.

Thank you for testing.
```

Where it comes from: `src/game/save.ts` (the v1 migration drops the
entitlements and the minigame records, and keeps currencies and owned trails),
`src/hooks/useMonetization.ts` (bonuses are instant only with Remove Ads), and
`src/config/monetization.ts` (sample ad IDs, isTesting true).

---

## Sources

Fetched on 2026-10-06 and used above:

- AdMob, Google Play data disclosure (last updated 2026-10-02, describes SDK
  25.5.0): https://developers.google.com/admob/android/privacy/play-data-disclosure
- Play Console Help, Data safety section: https://support.google.com/googleplay/android-developer/answer/10787469
- Android Developers, Declare your app's data use (Billing Library under
  Financial info): https://developer.android.com/privacy-and-security/declare-data-use
- Google Play services SDKs data disclosure (base, basement and tasks collect
  nothing): https://developers.google.com/android/guides/play-data-disclosure
- Play Console Help, account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111
- Play Console Help, target audience and app content: https://support.google.com/googleplay/android-developer/answer/9867159
- Play Console Help, Families policies: https://support.google.com/googleplay/android-developer/answer/9893335
- Play Console Help, Families Self-Certified Ads SDK Program: https://support.google.com/googleplay/android-developer/answer/12289447
- AdMob Help, complying with the Families policy: https://support.google.com/admob/answer/6223431
- Play Console Help, Prepare your app for review (privacy policy, ads, sign-in
  details, news, COVID-19): https://support.google.com/googleplay/android-developer/answer/9859455
- Play Console Help, content ratings: https://support.google.com/googleplay/android-developer/answer/9859655
- IARC: https://www.globalratings.com/how-iarc-works/, https://www.globalratings.com/faq/, https://www.globalratings.com/ratings-definitions/
- Play Console Help, Advertising ID: https://support.google.com/googleplay/android-developer/answer/6048248
- Play Console Help, Ads policy: https://support.google.com/googleplay/android-developer/answer/9857753
- Play Console Help, Financial features declaration: https://support.google.com/googleplay/android-developer/answer/13849271
- Play Console Help, Health apps declaration: https://support.google.com/googleplay/android-developer/answer/14738291
- Play Console Help, government apps: https://support.google.com/googleplay/android-developer/answer/9514050
- Play Console Help, foreground services: https://support.google.com/googleplay/android-developer/answer/13392821
- Play Console Help, category and tags: https://support.google.com/googleplay/android-developer/answer/9859673
- AdMob Help, app-ads.txt: https://support.google.com/admob/answer/9363762
- AdMob Help, digital content labels (G, PG, T, MA and the Google Play ages
  they match): https://support.google.com/admob/answer/10478094
- AdMob Help, setting the maximum ad content rating:
  https://support.google.com/admob/answer/7562142
- Google's sample Data safety CSV, linked from the Data safety help page
  (question and answer labels for collection, encryption, deletion and
  required or optional collection)
- UMP disclosure address, which redirects to the AdMob page:
  https://developers.google.com/admob/ump/android/play-data-disclosure

Not available, so check those answers against the live form:

- The IARC questionnaire's wording. IARC says it is available only inside a
  store's console.
- The wording of the Advertising ID declaration and the Government apps
  question. Google has no help page showing either.
- The Data safety account-creation question and its options. Google's sample
  CSV predates them.
- A data safety disclosure page for the Play Billing Library. None was found.
  The UMP SDK has none of its own; its address redirects to the AdMob page.
