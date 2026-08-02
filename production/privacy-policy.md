# Privacy Policy — Vanta Eclipse

**Draft. Not yet accurate — see "Before you publish this" at the bottom.**

Last updated: *(set on publication)*

---

## The short version

Vanta Eclipse stores your game progress on your own device and nowhere else.
The game itself does not create an account, does not ask for your name or
email, and does not send your progress anywhere.

The advertising and payment services the app uses are separate companies with
their own policies, and they do collect data. That is described below.

## What the game stores

Your progress — level, currencies, equipment, relics, pets, quest state,
settings and purchase records — is written to a single file in the app's
private storage on your device. It never leaves your device unless you back
it up yourself through Android's own backup system.

Uninstalling the app deletes this file. There is no cloud copy, so
uninstalling loses your progress permanently.

## What third parties collect

**Advertising.** Rewarded video ads are supplied by *(AD NETWORK — e.g.
Google AdMob)*. To choose and measure ads, the network may access your
device's Advertising ID, coarse location derived from your IP address, and
basic device information. Ads in this game are always optional: they are
offered, never forced, and declining one has no effect on your progress.

You can reset or delete your Advertising ID at any time in Android under
**Settings → Privacy → Ads**.

AdMob's policy: https://policies.google.com/technologies/ads

**Purchases.** In-app purchases are processed by Google Play Billing. We never
see or store your payment details — Google handles the transaction and tells
the app only whether it succeeded. Google's policy:
https://policies.google.com/privacy

## Children

Vanta Eclipse is not directed at children under 13. We do not knowingly
collect personal information from children. If you believe a child has
provided personal information through this app, contact us at the address
below and it will be deleted.

## Your rights

Because the game holds no personal data on any server, there is nothing for us
to export or delete on request — clearing the app's data or uninstalling it
removes everything the game stored. For data held by the advertising network,
use the opt-out controls linked above, or contact that provider directly.

## Changes

If this policy changes, the new version will be posted at this URL with an
updated date above.

## Contact

*(CONTACT EMAIL — required by Play, must be one you monitor)*

---

## Before you publish this

This draft describes the app **as the code stands today**, which is not yet
what will ship. Fix all of the following first, or the policy will be
inaccurate — and an inaccurate privacy policy is a Play policy violation, not
a paperwork slip:

1. **Fill in every `*(PLACEHOLDER)*`** above: ad network name, contact email,
   date.
2. **Name the actual ad network**, once chosen. If it is not AdMob, replace
   the policy link too.
3. **Re-read after the SDK lands.** Today the app makes no network calls at
   all — no `HTTPRequest` exists anywhere in the project. The moment an ad SDK
   is added that stops being true, and what it collects is the SDK's business,
   not this codebase's. Take the disclosure from the SDK's documentation.
4. **Host it at a stable public URL** (GitHub Pages off this repo is enough)
   and put that URL in both the Play Console listing and the app's Settings
   screen.
5. **Keep it consistent with the Data Safety form.** Play cross-checks the two,
   and a mismatch is a common rejection cause.
