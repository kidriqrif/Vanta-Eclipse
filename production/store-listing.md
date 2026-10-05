# Play Console store listing — Vanta Eclipse

Copy to paste into the Play Console listing fields. The character limits are
Play's own, and the bracketed counts are the current lengths.

Each paragraph in the blocks below is a single line. Play keeps line breaks, so
wrapping a paragraph across lines would put breaks in the middle of sentences in
the published listing.

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

Use this version while `BILLING_ENABLED` in `src/config/monetization.ts` is
`false`: the build shows ads but sells nothing.

```
The light went out a long time ago. Something still hunts in the dark, and it is yours.

Vanta Eclipse is an idle RPG built for short visits and long absences. Tap to strike, or reach level 15 and let auto-attack fight for you. Come back later and the essence will be waiting.

DESCEND
Fifty levels of the Dark Forest, then the Frozen Ruins from level 51 on, with a boss guarding every tenth gate. Bosses fight on a 30-second timer. Lose, and you farm the level below until you are ready to challenge again.

BUILD
• Five upgrade lines, from tap damage and crits to essence gain
• Six gear slots, five rarities, and affixes that stack
• Salvage what you don't want into Void Scraps and forge what you do
• Five relics, one attuned at a time: Twin Fang doubles your auto-attack speed, Eclipse Heart triples what you earn while away
• Two companions that level up as you fight and evolve at level 10. Feed them cards to speed it up.

COLLAPSE
Once a run reaches level 50, trigger an Eclipse. The run resets; you keep your Void Crystals, gear, relics and companions, and spend crystals on Ascendant Powers that make the next run faster. Long Slumber extends how long you earn while away. Eternal Reflex gives you auto-attack from level one.

THE ARCADE
Seven minigames, unlocking from level 20: Void Reflex, Memory Match, Lights Out, Connect Four, Sequence Echo, Rune Sweeper and Void Salvo. Tokens refill on their own, even while the game is closed. Winnings are paid in essence priced against your current rate, so they never go stale.

EVERY DAY
Four daily quests and a bonus for clearing all of them, plus quest chains and achievements in the Codex.

FAIR BY DESIGN
No mechanic is behind a paywall, and there is no way to buy power. A small banner sits at the bottom of the screen. Video ads are only ever offered, in exchange for a bonus on top of something you have already earned. They are never forced, each has a daily limit so watching more is never the best way to play, and saying no costs you nothing. Every cosmetic is earned by playing.

Plays in portrait, one-handed, and offline.
```
`[2093]`

### FAIR BY DESIGN — once billing is on

When `BILLING_ENABLED` is `true` and the products are active, replace
everything from FAIR BY DESIGN to the end with this:

```
FAIR BY DESIGN
No mechanic is behind a paywall, and there is no way to buy power. A small banner sits at the bottom of the screen. Video ads are only ever offered, in exchange for a bonus on top of something you have already earned. They are never forced, each has a daily limit so watching more is never the best way to play, and saying no costs you nothing.

Remove Ads takes the banner away and makes every bonus instant, with no video. The daily limits stay, so it removes the chore, not the balance.

Every cosmetic can be earned by playing.

Plays in portrait, one-handed, and offline.
```
`[2243 with the rest of the description]`

### What the copy claims, and where it comes from

Every number above comes from the code. Check this list again if the content
changes.

| Claim | Source |
|---|---|
| auto-attack at level 15; Eternal Reflex from level one | `src/game/state.ts`, `src/game/stats.ts` |
| Dark Forest 1–50, Frozen Ruins from 51; boss every 10th level, 30 s timer | `src/data/definitions.ts` (`WORLDS`), `src/game/state.ts` |
| 5 upgrade lines, 6 gear slots (the 7th, Relic, is sealed), 5 rarities | `src/data/definitions.ts` (`UPGRADES`, `SLOTS`, `RARITIES`) |
| 5 relics, one active; Twin Fang ×2 auto-attack speed; Eclipse Heart ×3 offline | `src/data/definitions.ts` (`RELICS`) |
| 2 companions (Ember → Blaze, Frostling → Frostwyrm), evolve at level 10 | `src/data/definitions.ts` (`PETS`) |
| Eclipse from run level 50; keeps crystals, gear, relics, companions | `src/game/reducer.ts` (`PERFORM_ECLIPSE`) |
| 7 minigames, Arcade from level 20, tokens regenerate while closed | `src/data/definitions.ts` (`MINIGAMES`), `src/game/state.ts`, `src/game/arcade.ts` |
| 4 daily quests plus an all-clear bonus; chains and achievements | `src/data/definitions.ts` (`QUESTS`, `getDailyQuestIdsForDate`) |
| banner, opt-in rewarded offers with daily caps; Remove Ads keeps the caps | `src/data/definitions.ts` (`ADS`, `PRODUCTS`), `src/hooks/useMonetization.ts` |

---

## Categorisation

| Field | Value |
|---|---|
| App or game | Game |
| Category | Role Playing |
| Tags | Idle, RPG, Offline |
| Contains ads | **Yes**. Every build includes the AdMob banner and rewarded offers. |
| In-app purchases | **Yes, once billing is enabled**: when `BILLING_ENABLED` is `true` and `vanta_remove_ads`, `vanta_starter_pack` and `vanta_shards_small` are active in Play Console. Until then, nothing can be bought. |
| Target audience | 13+ (see below) |

**Age rating and audience.** Answer the IARC questionnaire from what is on
screen: tap combat with health bars against stylised pixel-art creatures. Answer
it again once purchases are live. The privacy policy states that the app is not
directed at children under 13. Selecting an under-13 age group brings in the
Families policy, which needs child-directed ad requests (not set in
`src/services/ads.ts`) and a rewritten policy.

## Data safety form

The game itself collects nothing. There is no account and no analytics, and
progress is a local save on the device with no cloud copy. Android's own backup
may restore it on a new phone. The AdMob SDK does collect data, so the form has
to declare what the SDK collects, taken from Google's disclosure page
(https://developers.google.com/admob/android/privacy/play-data-disclosure):

- **Device or other IDs**: the advertising ID.
- **App interactions** and **diagnostics**: ad requests, impressions and
  taps, plus SDK performance data.
- **Approximate location**: derived from the IP address. The privacy policy
  says so.
- **Purchase history**: once billing is enabled.

The data is collected for advertising, analytics and fraud prevention, and it
is encrypted in transit. The full list is in
`design/RELEASE-CHECKLIST.md`.

## Required assets

| Asset | Spec | Status |
|---|---|---|
| App icon | 512×512 PNG, no alpha | ✅ `production/icons/store_icon_512.png` |
| Feature graphic | 1024×500 PNG/JPG, no alpha | ✅ `production/icons/feature_graphic_1024x500.png` |
| Phone screenshots | 2–8; each side 320–3840 px, long side at most twice the short side | ❌ The six 1080×1920 PNGs in `production/screenshots/` come from the old Unity build (SHOP / MENU / GEAR layout, "Development build" banner). Recapture the current UI at 9:16. |
| Privacy policy URL | public, reachable | ⚠️ https://kidriqrif.github.io/Vanta-Eclipse/privacy-policy.html is reachable, but it still serves the 2026-08-10 no-ads version. `docs/privacy-policy.html` has the AdMob and Play Billing version and needs to reach the branch GitHub Pages publishes from. |
| Signed AAB | current target API | Built in Android Studio from `npm run android:sync` (versionCode 5, targetSdk 36). Bundles are gitignored, so none is kept in the repo. |
