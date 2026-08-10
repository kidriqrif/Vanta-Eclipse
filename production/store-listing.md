# Play Console store listing — Vanta Eclipse

Copy-paste source for the Play Console listing fields. Character limits are
Play's own and are enforced at submission; the counts in brackets are current.

---

## App name  *(30 max)*

```
Vanta Eclipse
```
`[13]`

## Short description  *(80 max)*

```
An idle RPG in the dark. Your hero fights on while you're away.
```
`[63]`

## Full description  *(4000 max)*

```
The light went out a long time ago. Something still hunts in the dark, and it
is yours.

Vanta Eclipse is an idle RPG built for short visits and long absences. Tap to
strike, or unlock the auto-attacker at level 15 and let your hero fight
without you. Come back tomorrow and the essence will be waiting.

DESCEND
Fifty levels of the Dark Forest, then fifty more through the Frozen Ruins,
with a boss guarding every tenth gate. Bosses are on a timer — lose, and you
farm the gate until you are strong enough. Nothing is ever permanently lost.

BUILD
• Five upgrade lines that compound, from raw damage to essence gain
• Seven equipment slots, five rarities, and affixes that actually stack
• Salvage what you don't want into Void Scraps and forge what you do
• Five relics with real trade-offs — Twin Fang doubles your attack cadence
• Two pets that level from your kills, on or offline

COLLAPSE
When progress slows, trigger an Eclipse. The run resets; you keep Void
Crystals, and you spend them on Ascendant Powers that make the next run
faster than the last. Long Slumber extends how long you earn while away.
Eternal Reflex hands you the auto-attacker from level one.

THE ARCADE
Four real minigames — Connect Four, Battleship, Memory Match, Void Reflex —
played with tokens that refill on their own. They pay in essence priced
against your current rate, so they never go stale and never become the
optimal way to play.

FAIR BY DESIGN
No mechanic in this game is behind a paywall. There are no ads, no purchases,
no energy meter, no timer blocking a door, and no way to buy power. Every
cosmetic is earned by playing.

Plays in portrait, one-handed, offline.
```
`[1662]`

> The FAIR BY DESIGN paragraph above is written for the **current, unmonetised
> build**. The original copy described opt-in ads and cosmetic purchases, which
> is the design intent but not what installs today — and a listing that
> promises "the option to skip the ads" for an app with no ads is a
> misrepresentation. Restore the longer version alongside
> `UseStubProviders = false`.

---

## Categorisation

| Field | Value |
|---|---|
| App or game | Game |
| Category | Role Playing |
| Tags | Idle, RPG, Offline |
| Contains ads | **No** — for the build that ships today (see below) |
| In-app purchases | **No** — for the build that ships today (see below) |
| Target audience | 13+ (see note) |

> **These two answers describe the BUILD, not the design.**
> `MonetizationManager.UseStubProviders` is `true`, so
> `PAID_SURFACES_AVAILABLE` is `false` and every paid surface is hidden: there
> is no ad SDK in the bundle and no Play Billing library, so the app shows no
> ads and takes no money. Declaring "Yes" would be a false declaration, and
> declaring IAP with no billing integration and no SKUs in Play Console fails
> review.
>
> When real providers land, both answers become **Yes** (rewarded video only;
> $0.99–$4.99), the Data Safety form has to be redone from the ad SDK's
> disclosure, and the `AD_ID` permission declaration applies. Flip these back
> in the same change that sets `UseStubProviders = false`.

**Note on age rating.** The IARC questionnaire will ask about violence.
Combat here is a health bar and a particle burst against stylised creatures —
no gore, no human targets, no blood. That is normally *Everyone 10+* / PEGI 7.
Answer the questionnaire honestly rather than copying this; a wrong answer is
a policy strike. Targeting under-13 pulls the app into the Families policy and
changes the ad requirements substantially — the current ad setup assumes 13+.

## Data safety form

The app collects **nothing** on its own: no account, no analytics, no network
calls anywhere in the codebase (verified — there is no `HTTPRequest` in the
project). All progress is a local JSON file in the app's private storage.

**However**, once the AdMob SDK is added, *it* collects Advertising ID and
approximate device data. The Data Safety form must declare what the ad SDK
does, not just what this code does. Fill it in from the SDK's own disclosure
after integration — not before, and not from this file.

## Required assets checklist

| Asset | Spec | Status |
|---|---|---|
| App icon | 512×512 32-bit PNG, no alpha | ✅ `production/icons/store_icon_512.png` |
| Feature graphic | 1024×500 PNG/JPG, no alpha | ✅ `production/icons/feature_graphic_1024x500.png` |
| Phone screenshots | ≥2, 16:9 or 9:16, 320–3840px | ✅ six at 1080×1920 in `production/screenshots/`, regenerated from the shipping build by `tools/make_store_screenshots.py` |
| Privacy policy URL | public, reachable | ✅ live at `https://kidriqrif.github.io/Vanta-Eclipse/privacy-policy.html`, which is the exact URL `SettingsMenu` opens |
| Signed AAB | targeting current API level | ✅ `build/vanta-eclipse.aab`, targetSdk 36, arm64-v8a, 16 KB-aligned |
